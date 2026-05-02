<script>
	/**
	 * @file AlertModal.svelte
	 * @description 레벨 3, 4, 5 전역 알림 (Modal/Fullscreen) 전용 컴포넌트
	 * - 레벨 4: 징벌적 타이머 (조기 클릭 시 초기화)
	 * - 레벨 5: 시스템 락 스타일링
	 */
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { fade } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import Icon from '@iconify/svelte';

	let { alert } = $props();
	let penaltyMsg = $state('');

	// 레벨 4, 5 전용 타이머 시작 (alertState 내 메서드 호출)
	$effect(() => {
		if (alert.level >= 4 && alertState.countdowns[alert.id] === undefined) {
			const startSec = alert.level === 5 ? 10 : (alert.reset_sec || 5);
			alertState.startCountdown(alert.id, startSec);
		}
	});

	const countdown = $derived(alertState.countdowns[alert.id] ?? 0);

	function handleConfirm() {
		// 🚨 레벨 4 징벌적 로직: 타이머가 남았는데 클릭하면 리셋
		if (alert.level === 4 && countdown > 0) {
			penaltyMsg = `집중하세요! ${alert.reset_sec || 5}초 동안 다시 읽으세요.`;
			alertState.resetTimer(alert.id, alert.reset_sec || 5);
			return;
		}
		
		// 🚨 레벨 5 강제 대기: 타이머가 끝나야 확인 가능
		if (alert.level === 5 && countdown > 0) {
			penaltyMsg = `시스템 락 상태입니다. 지시를 충분히 숙지하십시오. (${countdown}초 남음)`;
			return;
		}

		alertState.dismiss(alert.id);
		if (alert.redirect_url) goto(alert.redirect_url);
	}
</script>

<dialog class="modal modal-open backdrop-blur-md" transition:fade>
	<div
		class="modal-box relative max-w-lg rounded-[2rem] border-2 p-12 shadow-2xl transition-all
               {alert.level === 5 ? 'bg-gradient-to-br from-red-600 via-red-800 to-black text-white border-none' : 'bg-white text-slate-900'}
               {alert.style === 'success' ? 'border-emerald-500 shadow-emerald-100' : ''}
               {alert.style === 'warning' ? 'border-amber-500 shadow-amber-100' : ''}
               {alert.style === 'danger' && alert.level < 5 ? 'border-rose-500 shadow-rose-100' : ''}
               {alert.style === 'info' ? 'border-blue-500 shadow-blue-100' : ''}
               {alert.level === 4 ? 'animate-pulse ring-8 ring-slate-900/5' : ''}"
	>
		<div class="text-center">
			<div class="mb-4 text-[10px] font-black tracking-[0.3em] uppercase opacity-60">
				{alert.level === 5 ? 'System Critical Lock' : `${alert.style} Notification`}
			</div>

			<div class="py-8">
				<h3 class="text-3xl font-black leading-tight tracking-tighter whitespace-pre-wrap 
                           {alert.level === 5 ? 'text-white' : 
                            alert.style === 'success' ? 'text-emerald-700' :
                            alert.style === 'warning' ? 'text-amber-700' :
                            alert.style === 'danger' ? 'text-rose-700' : 'text-slate-900'}">
					{alert.level === 5 ? '🚨 ' : ''}{alert.message}
				</h3>
				{#if penaltyMsg}
					<p class="mt-4 text-xs font-bold text-rose-500 animate-bounce">{penaltyMsg}</p>
				{/if}
			</div>

			<div class="modal-action mt-8 flex flex-col gap-4">
				<!-- 확인 버튼 -->
				<button
					class="btn h-16 rounded-2xl text-lg font-black shadow-lg transition-all btn-lg hover:scale-[1.02] active:scale-[0.98]
                           {alert.level === 5 ? 'bg-white text-red-700 border-none hover:bg-slate-100' : 
                            alert.style === 'success' ? 'btn-success text-white' :
                            alert.style === 'warning' ? 'btn-warning text-white' :
                            alert.style === 'danger' ? 'btn-error text-white' : 'btn-primary text-white'}"
					onclick={handleConfirm}
				>
					{#if (alert.level === 4 || alert.level === 5) && countdown > 0}
						{(alert.level === 5 ? '지시 숙지 중... ' : '읽는 중... ') + `(${countdown}s)`}
					{:else}
						{alert.confirm_text || '확인하였습니다'}
					{/if}
				</button>

				<!-- 하루 동안 보지 않기 (L4 카운트다운 완료 후 또는 L3 이하 표시) -->
				{#if alert.level !== 5 && (alert.level !== 4 || countdown <= 0)}
					<button
						class="btn btn-ghost btn-sm text-xs font-bold opacity-40 transition-opacity hover:opacity-100"
						onclick={() => alertState.neverShowAgain(alert.id)}
					>
						하루 동안 보지 않기
					</button>
				{/if}
			</div>
		</div>
	</div>
</dialog>

<style>
	:global(.modal-open) {
		pointer-events: auto;
	}
</style>
