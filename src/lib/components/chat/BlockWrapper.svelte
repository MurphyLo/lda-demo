<script lang="ts">
	import type { Snippet } from "svelte";

	interface Props {
		icon: Snippet;
		iconBg?: string;
		iconRing?: string;
		hasNext?: boolean;
		loading?: boolean;
		children: Snippet;
	}

	let {
		icon,
		iconBg = "bg-gray-50 dark:bg-gray-800",
		iconRing = "ring-gray-100 dark:ring-gray-700",
		hasNext = false,
		loading = false,
		children,
	}: Props = $props();
</script>

<div class="group flex items-start gap-2 has-[+.prose]:mb-1.5 [.prose+&]:mt-3">
	<!-- Left column: icon + connector line -->
	<div class="flex w-[22px] flex-shrink-0 self-stretch flex-col items-center">
		<div
			class="relative z-0 flex h-[22px] w-[22px] items-center justify-center rounded-md ring-1 transition-shadow duration-300 {iconBg} {iconRing}"
			class:loading-glow={loading}
		>
			{@render icon()}
			{#if loading}
				<div class="pointer-events-none absolute inset-[-3px] rounded-[8px] bg-purple-500/18 blur-[5px] dark:bg-purple-400/18"></div>
				<svg
					class="pointer-events-none absolute inset-[-1px] h-[24px] w-[24px]"
					viewBox="0 0 24 24"
					fill="none"
					xmlns="http://www.w3.org/2000/svg"
				>
					<rect
						x="1.25"
						y="1.25"
						width="21.5"
						height="21.5"
						rx="6.25"
						class="loading-track stroke-current text-purple-500/25 dark:text-purple-400/25"
						stroke-width="1.75"
						fill="none"
					/>
					<rect
						x="1.25"
						y="1.25"
						width="21.5"
						height="21.5"
						rx="6.25"
						class="loading-path stroke-current text-purple-500 dark:text-purple-300"
						stroke-width="2.25"
						stroke-linecap="round"
						fill="none"
					/>
				</svg>
			{/if}
		</div>
		{#if hasNext}
			<div class="my-1 w-px flex-1 bg-gray-200 dark:bg-gray-700"></div>
		{/if}
	</div>

	<!-- Right column: content -->
	<div class="min-w-0 flex-1 pb-2 pt-px">
		{@render children()}
	</div>
</div>

<style>
	@keyframes loading {
		to {
			stroke-dashoffset: -96;
		}
	}

	@keyframes loading-glow-pulse {
		0%,
		100% {
			box-shadow: 0 0 0 rgba(168, 85, 247, 0), 0 0 0 rgba(168, 85, 247, 0);
		}
		50% {
			box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.18), 0 0 10px rgba(168, 85, 247, 0.28);
		}
	}

	.loading-track {
		opacity: 0.95;
	}

	.loading-path {
		stroke-dasharray: 28 68;
		animation: loading 1.35s cubic-bezier(0.4, 0, 0.2, 1) infinite;
		filter: drop-shadow(0 0 4px rgba(168, 85, 247, 0.45));
	}

	.loading-glow {
		animation: loading-glow-pulse 1.6s ease-in-out infinite;
	}
</style>
