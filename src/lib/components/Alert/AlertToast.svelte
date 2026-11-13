<script>
	/**
	 * @file AlertToast.svelte
	 * @description 레벨 1 전역 알림 (Toast) 전용 컴포넌트
	 * - 글자 수에 맞춘 컴팩트 크기 및 완전 가운데 정렬
	 * - ✕ 닫기 클릭 시 24시간 동안 보지 않기(neverShowAgain) 자동 연동
	 * - 2건 이상 등록 시 스택 카운트(예: 1/2) 뱃지 제공
	 */
	import { alertState } from '$lib/runes/alert.svelte';
	import { fly } from 'svelte/transition';
	import Icon from '@iconify/svelte';

	let { alert, positionFilter, totalCount = 1, currentIndex = 1 } = $props();

	function handleDismiss() {
		// ✕ 클릭 시 24시간 동안 브라우저에 다시 뜨지 않도록 영구 차단
		alertState.neverShowAgain(alert.id);
	}
</script>

<div
	class="alert alert-{alert.style === 'danger' ? 'error' : alert.style} w-auto min-w-[220px] max-w-[94vw] lg:max-w-5xl rounded-2xl border border-white/30 px-5 py-3 shadow-[0_15px_35px_-5px_rgba(0,0,0,0.35)] backdrop-blur-md flex items-center justify-center gap-3 text-white !whitespace-normal"
	transition:fly={{ y: positionFilter === 'top' ? -30 : 30, duration: 400 }}
>
	<!-- 스택 카운트 (2건 이상일 때만 표시) -->
	{#if totalCount > 1}
		<span class="rounded-full bg-black/25 px-2 py-0.5 text-[10px] font-black tracking-wider text-white shrink-0">
			{currentIndex}/{totalCount}
		</span>
	{/if}

	<div class="flex items-center justify-center gap-2.5 min-w-0 flex-1 text-center">
		<Icon 
			icon={alert.style === 'danger' || alert.style === 'error' ? 'mdi:alert-circle' : 'mdi:bell-ring'} 
			class="w-5 h-5 flex-none shrink-0" 
		/>
		<span class="text-xs sm:text-sm md:text-base font-bold leading-relaxed break-words whitespace-pre-wrap text-center">{alert.message}</span>
	</div>

	<div class="flex-none ml-1 shrink-0">
		<button
			class="btn btn-circle btn-ghost btn-xs opacity-75 hover:opacity-100 h-6 w-6 min-h-0 text-white font-bold"
			onclick={handleDismiss}
			aria-label="알림 닫기 (오늘 하루 보지 않기)"
			title="닫기 (오늘 하루 보지 않기)"
		>✕</button>
	</div>
</div>
