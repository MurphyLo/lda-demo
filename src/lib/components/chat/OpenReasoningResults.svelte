<script lang="ts">
	import MarkdownRenderer from "./MarkdownRenderer.svelte";
	import BlockWrapper from "./BlockWrapper.svelte";
	import { slide, fade } from "svelte/transition";
	import CarbonChevronRight from "~icons/carbon/chevron-right";

	interface Props {
		content: string;
		loading?: boolean;
		hasNext?: boolean;
	}

	let { content, loading = false, hasNext = false }: Props = $props();
	let isOpen = $state(false);
	let wasLoading = $state(false);
	let initialized = $state(false);

	// Track loading transitions to auto-expand/collapse
	$effect(() => {
		// Auto-expand on first render if already loading
		if (!initialized) {
			initialized = true;
			if (loading) {
				isOpen = true;
				wasLoading = true;
				return;
			}
		}

		if (loading && !wasLoading) {
			// Loading started - auto-expand
			isOpen = true;
		} else if (!loading && wasLoading) {
			// Loading finished - auto-collapse
			isOpen = false;
		}
		wasLoading = loading;
	});
</script>

{#snippet icon()}
	<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 32 32">
		<path
			class="stroke-gray-500 dark:stroke-gray-400"
			style="stroke-width: 1.9; fill: none; stroke-linecap: round; stroke-linejoin: round;"
			d="M16 6v3.33M16 6c0-2.65 3.25-4.3 5.4-2.62 1.2.95 1.6 2.65.95 4.04a3.63 3.63 0 0 1 4.61.16 3.45 3.45 0 0 1 .46 4.37 5.32 5.32 0 0 1 1.87 4.75c-.22 1.66-1.39 3.6-3.07 4.14M16 6c0-2.65-3.25-4.3-5.4-2.62a3.37 3.37 0 0 0-.95 4.04 3.65 3.65 0 0 0-4.6.16 3.37 3.37 0 0 0-.49 4.27 5.57 5.57 0 0 0-1.85 4.85 5.3 5.3 0 0 0 3.07 4.15M16 9.33v17.34m0-17.34c0 2.18 1.82 4 4 4m6.22 7.5c.67 1.3.56 2.91-.27 4.11a4.05 4.05 0 0 1-4.62 1.5c0 1.53-1.05 2.9-2.66 2.9A2.7 2.7 0 0 1 16 26.66m10.22-5.83a4.05 4.05 0 0 0-3.55-2.17m-16.9 2.18a4.05 4.05 0 0 0 .28 4.1c1 1.44 2.92 2.09 4.59 1.5 0 1.52 1.12 2.88 2.7 2.88A2.7 2.7 0 0 0 16 26.67M5.78 20.85a4.04 4.04 0 0 1 3.55-2.18"
		/>
	</svg>
{/snippet}

<BlockWrapper
	{icon}
	{hasNext}
	iconBg="bg-gray-100 dark:bg-gray-700"
	iconRing="ring-gray-200 dark:ring-gray-600"
>
	<div class="flex flex-col">
		<!-- Header view (clickable to expand) -->
		<div class="flex w-full items-center gap-2">
			<button
				type="button"
				class="group/text flex min-h-[22px] flex-1 cursor-pointer items-center gap-2 text-left"
				onclick={() => (isOpen = !isOpen)}
			>
				<span
					class="select-none text-sm font-medium leading-relaxed text-gray-500 transition-colors group-hover/text:text-gray-700 dark:text-gray-400 dark:group-hover/text:text-gray-200"
				>
					Thought Process
				</span>
				{#if !isOpen}
					<div
						transition:fade={{ duration: 150 }}
						class="line-clamp-1 flex-1 select-none text-sm leading-relaxed text-gray-400 dark:text-gray-500"
						class:animate-pulse={loading}
					>
						{content
							.replace(/[#*_`~[\]]/g, "")
							.replace(/\n+/g, " ")
							.trim()}
					</div>
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

		{#if isOpen}
			<!-- Expanded: show full content -->
			<div transition:slide={{ duration: 250 }} class="overflow-hidden">
				<div
					class="prose prose-sm max-w-none select-text pt-2 text-sm leading-relaxed text-gray-500 prose-p:first:mt-0 prose-headings:first:mt-0 dark:prose-invert dark:text-gray-400"
				>
					<MarkdownRenderer {content} {loading} />
				</div>
			</div>
		{/if}
	</div>
</BlockWrapper>
