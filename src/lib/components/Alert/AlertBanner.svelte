<script>
	/**
	 * @file AlertBanner.svelte
	 * @description 레벨 2 상단/하단 고정 배너 (Shimmer 효과 포함)
	 */
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { slide } from 'svelte/transition';
	import Icon from '@iconify/svelte';

	let { alert } = $props();
</script>

<div
	class="relative z-[999] w-full overflow-hidden p-3 text-center text-sm font-bold text-white shadow-lg md:p-4 md:text-base
           {alert.style === 'danger' ? 'bg-rose-600' : 'bg-blue-600'}"
	transition:slide={{ duration: 300 }}
>
	<!-- 🌊 Ocean Wave Shimmer Effect Layers -->
	<div class="wave-layer wave-1 absolute inset-0 pointer-events-none opacity-30"></div>
	<div class="wave-layer wave-2 absolute inset-0 pointer-events-none opacity-20"></div>

	<div class="relative mx-auto flex max-w-7xl items-center justify-between">
		<span class="flex items-center gap-2">
			<Icon icon="mdi:information-variant" class="text-xl" />
			{alert.message}
		</span>
		<button
			onclick={() => alertState.dismiss(alert.id)}
			class="btn btn-circle btn-ghost btn-sm text-white hover:bg-white/20"
		>
			<Icon icon="mdi:close" class="h-5 w-5" />
		</button>
	</div>
</div>

<style>
	.wave-layer {
		background: linear-gradient(
			110deg,
			rgba(255, 255, 255, 0) 0%,
			rgba(255, 255, 255, 0.2) 20%,
			rgba(255, 255, 255, 0.5) 40%,
			rgba(255, 255, 255, 0.2) 60%,
			rgba(255, 255, 255, 0) 100%
		);
		background-size: 200% 100%;
	}

	.wave-1 {
		animation: ocean-wave 4s infinite ease-in-out;
	}

	.wave-2 {
		animation: ocean-wave 7s infinite ease-in-out reverse;
		filter: blur(8px);
	}

	@keyframes ocean-wave {
		0% {
			background-position: -200% 0;
			transform: scaleY(1) skewX(0deg);
		}
		50% {
			background-position: 0% 0;
			transform: scaleY(1.2) skewX(5deg);
		}
		100% {
			background-position: 200% 0;
			transform: scaleY(1) skewX(0deg);
		}
	}
</style>
