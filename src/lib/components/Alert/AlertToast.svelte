<script>
	/**
	 * @file AlertToast.svelte
	 * @description 레벨 1 전역 알림 (Toast) 전용 컴포넌트
	 */
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { fly } from 'svelte/transition';

	let { alert, positionFilter } = $props();
</script>

<div
	class="alert alert-{alert.style === 'danger' ? 'error' : alert.style} min-w-[280px] rounded-3xl border-none px-5 py-3 shadow-xl"
	transition:fly={{ y: positionFilter === 'top' ? -50 : 50, duration: 600 }}
>
	<div class="flex items-center gap-3">
		<span class="text-sm font-semibold">{alert.message}</span>
	</div>
	<div class="flex-none">
		<button class="btn btn-circle btn-ghost btn-xs" onclick={() => alertState.neverShowAgain(alert.id)}
			>✕</button
		>
	</div>
</div>
