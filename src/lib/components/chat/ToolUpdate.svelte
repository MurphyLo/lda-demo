<script lang="ts">
	import { slide } from "svelte/transition";
	import { MessageToolUpdateType, type MessageToolUpdate } from "$lib/types/MessageUpdate";
	import {
		isMessageToolCallUpdate,
		isMessageToolErrorUpdate,
		isMessageToolProgressUpdate,
		isMessageToolResultUpdate,
	} from "$lib/utils/messageUpdates";
	import { formatToolProgressLabel } from "$lib/utils/toolProgress";
	import LucideHammer from "~icons/lucide/hammer";
	import LucideCheck from "~icons/lucide/check";
	import { ToolResultStatus, type ToolFront } from "$lib/types/Tool";
	import { page } from "$app/state";
	import CarbonChevronRight from "~icons/carbon/chevron-right";
	import BlockWrapper from "./BlockWrapper.svelte";
	import Inspect from "svelte-inspect-value";
	import { subscribeToTheme } from "$lib/switchTheme";
	import { onDestroy, onMount } from "svelte";

	interface Props {
		tool: MessageToolUpdate[];
		loading?: boolean;
		hasNext?: boolean;
	}

	let { tool, loading = false, hasNext = false }: Props = $props();

	let isOpen = $state(false);
	let isDark = $state(false);

	let unsubscribeTheme: (() => void) | undefined;

	onMount(() => {
		unsubscribeTheme = subscribeToTheme(({ isDark: nextIsDark }) => {
			isDark = nextIsDark;
		});
	});

	onDestroy(() => {
		unsubscribeTheme?.();
	});

	// Inspect 组件统一配置
	const inspectOptions = $derived({
		theme: isDark ? "dark" : "light",
		borderless: true,
		showPreview: true,
		showLength: false,
		showTypes: false,
		showTools: false,
		heading: false,
		search: false,
		expandLevel: 1,
		stringCollapse: 40,
		previewDepth: 1,
		previewEntries: 3,
		animRate: 1.5,
		stores: "full" as const,
		quotes: "single" as const,
	});

	let toolFnName = $derived(tool.find(isMessageToolCallUpdate)?.call.name);
	let toolError = $derived(tool.some(isMessageToolErrorUpdate));
	let toolDone = $derived(tool.some(isMessageToolResultUpdate));
	let isExecuting = $derived(!toolDone && !toolError && loading);
	let toolSuccess = $derived(toolDone && !toolError);
	let toolProgress = $derived.by(() => {
		for (let i = tool.length - 1; i >= 0; i -= 1) {
			const update = tool[i];
			if (isMessageToolProgressUpdate(update)) return update;
		}
		return undefined;
	});
	let progressLabel = $derived.by(() => formatToolProgressLabel(toolProgress));

	const availableTools: ToolFront[] = $derived.by(
		() => (page.data as { tools?: ToolFront[] } | undefined)?.tools ?? []
	);

	type ToolOutput = Record<string, unknown>;
	type McpImageContent = {
		type: "image";
		data: string;
		mimeType: string;
	};

	const isImageBlock = (value: unknown): value is McpImageContent => {
		if (typeof value !== "object" || value === null) return false;
		const obj = value as Record<string, unknown>;
		return (
			obj["type"] === "image" &&
			typeof obj["data"] === "string" &&
			typeof obj["mimeType"] === "string"
		);
	};

	const getImageBlocks = (output: ToolOutput): McpImageContent[] => {
		const blocks = output["content"];
		if (!Array.isArray(blocks)) return [];
		return blocks.filter(isImageBlock);
	};

	// 解析工具输出，提取文本内容并尝试解析为 JSON
	interface ParsedToolOutput {
		data: Record<string, unknown> | null;
		images: McpImageContent[];
	}

	const parseToolOutputs = (outputs: ToolOutput[]): ParsedToolOutput[] =>
		outputs.map((output) => {
			const images = getImageBlocks(output);

			// 提取文本内容：先尝试从 content 数组中的 text 块获取
			const contentBlocks = output["content"];
			let textContent: string | undefined;

			if (Array.isArray(contentBlocks)) {
				const textBlock = contentBlocks.find(
					(block) => typeof block === "object" && block !== null && block["type"] === "text"
				);
				if (textBlock) {
					textContent = textBlock["text"] ?? textBlock["content"];
				}
			}

			// 如果 content 中没有找到，尝试直接获取 text 字段
			if (!textContent && typeof output["text"] === "string") {
				textContent = output["text"];
			}

			// 尝试解析 JSON
			let data: Record<string, unknown> | null = null;
			if (textContent) {
				try {
					const parsed = JSON.parse(textContent);
					if (typeof parsed === "object" && parsed !== null) {
						data = parsed;
					}
				} catch {
					// JSON 解析失败，将原始文本作为 text 字段展示
					data = { text: textContent };
				}
			}

			// 如果没有提取到文本内容，则展示原始 output 中除 content 外的字段
			if (!data) {
				const filteredEntries = Object.entries(output).filter(
					([key, value]) => value != null && key !== "content"
				);
				if (filteredEntries.length > 0) {
					data = Object.fromEntries(filteredEntries);
				}
			}

			return { data, images };
		});

	// Icon styling based on state
	let iconBg = $derived(
		toolError ? "bg-red-100 dark:bg-red-900/40" : "bg-purple-100 dark:bg-purple-900/40"
	);

	let iconRing = $derived(
		toolError ? "ring-red-200 dark:ring-red-500/30" : "ring-purple-200 dark:ring-purple-500/30"
	);
</script>

{#snippet icon()}
	{#if toolSuccess}
		<LucideCheck class="size-3.5 text-purple-600 dark:text-purple-400" />
	{:else}
		<LucideHammer
			class="size-3.5 {toolError
				? 'text-red-500 dark:text-red-400'
				: 'text-purple-600 dark:text-purple-400'}"
		/>
	{/if}
{/snippet}

{#if toolFnName}
	<BlockWrapper {icon} {iconBg} {iconRing} {hasNext} loading={isExecuting}>
		<!-- Header row -->
		<div class="flex w-full items-center gap-2">
			<button
				type="button"
				class="flex flex-1 cursor-pointer flex-col items-start gap-1 text-left"
				onclick={() => (isOpen = !isOpen)}
			>
				<span
					class="select-none text-sm font-medium {isExecuting
						? 'text-purple-700 dark:text-purple-300'
						: toolError
							? 'text-red-600 dark:text-red-400'
							: 'text-gray-700 dark:text-gray-300'}"
				>
					{toolError ? "Error calling" : toolDone ? "Called" : "Calling"} tool
					<code
						class="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs text-gray-500 opacity-90 dark:bg-gray-800 dark:text-gray-400"
					>
						{availableTools.find((entry) => entry.name === toolFnName)?.displayName ?? toolFnName}
					</code>
				</span>
				{#if isExecuting && toolProgress}
					<span class="select-none text-xs text-gray-500 dark:text-gray-400">{progressLabel}</span>
				{/if}
			</button>

			<button
				type="button"
				class="cursor-pointer"
				onclick={() => (isOpen = !isOpen)}
				aria-label={isOpen ? "Collapse" : "Expand"}
			>
				<CarbonChevronRight
					class="size-4 text-gray-400 transition-transform duration-200 {isOpen ? 'rotate-90' : ''}"
				/>
			</button>
		</div>

		<!-- Expandable content -->
		{#if isOpen}
			<div transition:slide={{ duration: 250 }} class="overflow-hidden">
				<div class="pt-2 space-y-3">
					{#each tool as update, i (`${update.subtype}-${i}`)}
					{#if update.subtype === MessageToolUpdateType.Call}
						<div class="space-y-1">
							<div
								class="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
							>
								Input
							</div>
							<div
								class="rounded-md border border-gray-100 bg-white p-2 dark:border-gray-700 dark:bg-gray-800/50"
								style="--hover-color: transparent;"
							>
								<Inspect values={update.call.parameters} {...inspectOptions} />
							</div>
						</div>
					{:else if update.subtype === MessageToolUpdateType.Error}
						<div class="space-y-1">
							<div
								class="text-[10px] font-semibold uppercase tracking-wider text-red-500 dark:text-red-400"
							>
								Error
							</div>
							<div
								class="rounded-md border border-red-200 bg-red-50 p-2 text-red-600 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-400"
							>
								<pre class="whitespace-pre-wrap break-all font-mono text-xs">{update.message}</pre>
							</div>
						</div>
					{:else if isMessageToolResultUpdate(update) && update.result.status === ToolResultStatus.Success && update.result.display}
						<div class="space-y-1">
							<div class="flex items-center gap-2">
								<div
									class="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500"
								>
									Output
								</div>
								<svg
									xmlns="http://www.w3.org/2000/svg"
									width="12"
									height="12"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
									class="text-emerald-500"
								>
									<circle cx="12" cy="12" r="10"></circle>
									<path d="m9 12 2 2 4-4"></path>
								</svg>
							</div>
							<div
								class="scrollbar-custom rounded-md border border-gray-100 bg-white p-2 dark:border-gray-700 dark:bg-gray-800/50"
								style="--hover-color: transparent;"
							>
								{#each parseToolOutputs(update.result.outputs) as parsedOutput}
									<div class="space-y-2">
										{#if parsedOutput.data}
											<Inspect values={parsedOutput.data} {...inspectOptions} />
										{/if}

										{#if parsedOutput.images.length > 0}
											<div class="flex flex-wrap gap-2">
												{#each parsedOutput.images as image, imageIndex}
													<img
														alt={`Tool result image ${imageIndex + 1}`}
														class="max-h-60 rounded border border-gray-200 dark:border-gray-700"
														src={`data:${image.mimeType};base64,${image.data}`}
													/>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{:else if isMessageToolResultUpdate(update) && update.result.status === ToolResultStatus.Error && update.result.display}
						<div class="space-y-1">
							<div
								class="text-[10px] font-semibold uppercase tracking-wider text-red-500 dark:text-red-400"
							>
								Error
							</div>
							<div
								class="rounded-md border border-red-200 bg-red-50 p-2 text-red-600 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-400"
							>
								<pre class="whitespace-pre-wrap break-all font-mono text-xs">{update.result
										.message}</pre>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		</div>
	{/if}
	</BlockWrapper>
{/if}
