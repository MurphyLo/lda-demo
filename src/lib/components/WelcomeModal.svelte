<script lang="ts">
	import Modal from "$lib/components/Modal.svelte";
	import IconOmni from "$lib/components/icons/IconOmni.svelte";
	import { usePublicConfig } from "$lib/utils/PublicConfig.svelte";
	import type { MCPServer } from "$lib/types/Tool";

	const publicConfig = usePublicConfig();

	interface Props {
		close: () => void;
	}

	let { close }: Props = $props();

	// MCP server config state
	let mcpServers = $state<MCPServer[]>([]);
	let isLoading = $state(true);

	// Fetch MCP servers on mount
	$effect(() => {
		fetch("/api/mcp/servers")
			.then((res) => res.json())
			.then((data: MCPServer[]) => {
				mcpServers = data;
				isLoading = false;
			})
			.catch((err) => {
				console.error("Failed to fetch MCP servers:", err);
				isLoading = false;
			});
	});

	// Get the first MCP server for display (or undefined if none)
	const primaryMcpServer = $derived(mcpServers[0]);
</script>

<Modal closeOnBackdrop={false} onclose={close} width="!max-w-[420px] !m-4">
	<div
		class="flex w-full flex-col gap-8 bg-white bg-gradient-to-b to-transparent px-6 pb-7 dark:bg-black dark:from-white/10 dark:to-white/5"
	>
		<div
			class="relative -mx-6 grid h-48 select-none place-items-center bg-gradient-to-t from-black/5 dark:from-white/10"
		>
			<img
				class="size-full bg-black object-cover"
				src="{publicConfig.assetPath}/omni-welcome.gif"
				alt="Omni AI model router animation"
			/>
			<!-- <h2
				class="flex translate-y-1 items-center text-3xl font-semibold text-gray-900 dark:text-gray-100"
			>
				<Logo classNames="mr-2 size-12 dark:invert" />
				{publicConfig.PUBLIC_APP_NAME}
			</h2> -->
			<div
				class="absolute bottom-3 right-3 rounded-lg border border-blue-500/20 bg-blue-500/20 px-2 py-0.5 text-sm font-semibold text-blue-500"
			>
				Now with MCP!
			</div>
		</div>

		<div class="text-gray-700 dark:text-gray-200">
			<p class="text-[15px] leading-relaxed">
				欢迎使用 {publicConfig.PUBLIC_APP_NAME} MCP。本网站基于 <a
					href="https://github.com/huggingface/chat-ui"
					target="_blank"
					rel="noopener noreferrer"
					class="underline hover:text-blue-500">HuggingChat</a
				> 二次开发，用于对 MCP 功能进行预览。
			</p>
			<p class="mt-3 text-[15px] leading-relaxed">
				该 MCP 基于 LDA 主题模型对文章进行分类，搜索时优先返回主题标签和重要关键词而非全文，有效降低对话模
				型的上下文 Token 消耗，避免长上下文时的性能下降。
			</p>
			{#if isLoading}
				<p class="mt-3 text-[15px] leading-relaxed text-gray-500">正在加载 MCP 配置...</p>
			{:else if primaryMcpServer}
				<p class="mt-3 text-[15px] leading-relaxed">
					如果你使用的 LLM 对话工具支持 MCP，也可以参考以下配置接入 {primaryMcpServer.displayName ||
						primaryMcpServer.name}：
				</p>
				<div
					class="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/50"
				>
					<div class="space-y-1.5">
						<div class="flex">
							<span class="w-12 shrink-0 font-medium text-gray-500 dark:text-gray-400">名称</span>
							<span class="font-mono text-gray-900 dark:text-gray-100">{primaryMcpServer.name}</span
							>
						</div>
						<div class="flex">
							<span class="w-12 shrink-0 font-medium text-gray-500 dark:text-gray-400">类型</span>
							<span class="font-mono text-gray-900 dark:text-gray-100"
								>{primaryMcpServer.displayType || "Streamable HTTP"}</span
							>
						</div>
						<div class="flex">
							<span class="w-12 shrink-0 font-medium text-gray-500 dark:text-gray-400">地址</span>
							<span class="font-mono text-gray-900 dark:text-gray-100">{primaryMcpServer.url}</span>
						</div>
						<div class="flex">
							<span class="w-12 shrink-0 font-medium text-gray-500 dark:text-gray-400">认证</span>
							<span class="text-gray-900 dark:text-gray-100"
								>{primaryMcpServer.displayAuth || "无"}</span
							>
						</div>
						{#if primaryMcpServer.displayDescription}
							<div class="flex">
								<span class="w-12 shrink-0 font-medium text-gray-500 dark:text-gray-400">描述</span>
								<span class="text-gray-900 dark:text-gray-100"
									>{primaryMcpServer.displayDescription}</span
								>
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<button
			class="k w-full rounded-xl bg-black px-5 py-2.5 text-base font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black dark:hover:bg-gray-200"
			onclick={close}
		>
			Start chatting
		</button>
	</div>
</Modal>
