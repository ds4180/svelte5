<script>
	/**
	 * @file AlertModal.svelte
	 * @description 레벨 3, 4, 5 전역 알림 모달 (친근하고 명확한 안내 UI)
	 * - 레벨 4: 천천히 읽기 안내 타이머 (기본 reset_sec 또는 5초)
	 * - 레벨 5: 중요 안내 5초 강제 확인 타이머 (기본 5초)
	 */
	import { onMount } from 'svelte';
	import { alertState } from '$lib/runes/alert.svelte';
	import { notifyAlert } from '$lib/utils/sound';
	import { fade, scale } from 'svelte/transition';
	import { goto } from '$app/navigation';
	import Icon from '@iconify/svelte';

	let { alert } = $props();
	let guideMsg = $state('');

	// 🔔 모달 팝업 시 L3~L5 차임벨 사운드 및 진동 트리거
	onMount(() => {
		notifyAlert(alert.level || 3);
	});

	const initialSec = $derived(
		alert.level === 5
			? (alert.reset_sec && alert.reset_sec > 0 ? alert.reset_sec : 5)
			: (alert.reset_sec || 5)
	);

	// 레벨 4, 5 전용 타이머 시작 (기본 5초)
	$effect(() => {
		if (alert.level >= 4 && alertState.countdowns[alert.id] === undefined) {
			alertState.startCountdown(alert.id, initialSec);
		}
	});

	const isL5 = $derived(alert.level === 5);
	const countdown = $derived(alertState.countdowns[alert.id] ?? 0);
	const progressPct = $derived(
		initialSec > 0 ? Math.min(100, Math.max(0, Math.round(((initialSec - countdown) / initialSec) * 100))) : 100
	);

	const headerMeta = $derived.by(() => {
		if (alert.level === 5) {
			return {
				badge: '중요 안내 · 꼭 확인해 주세요',
				icon: 'solar:bell-bing-bold-duotone',
				iconWrap: 'bg-rose-100 text-rose-600 ring-4 ring-rose-50',
				badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
				borderClass: 'border-rose-200',
				btnClass: 'bg-rose-500 hover:bg-rose-600 text-white border-none',
				barClass: 'bg-rose-400'
			};
		}
		if (alert.level === 4 || alert.style === 'warning') {
			return {
				badge: '주요 공지 · 안내 말씀',
				icon: 'solar:megaphone-bold-duotone',
				iconWrap: 'bg-amber-100 text-amber-600 ring-4 ring-amber-50',
				badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
				borderClass: 'border-amber-200',
				btnClass: 'bg-amber-500 hover:bg-amber-600 text-white border-none',
				barClass: 'bg-amber-400'
			};
		}
		if (alert.style === 'success') {
			return {
				badge: '안내 알림',
				icon: 'solar:check-circle-bold-duotone',
				iconWrap: 'bg-emerald-100 text-emerald-600 ring-4 ring-emerald-50',
				badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
				borderClass: 'border-emerald-200',
				btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white border-none',
				barClass: 'bg-emerald-400'
			};
		}
		return {
			badge: '사내 알림 안내',
			icon: 'solar:chat-round-dots-bold-duotone',
			iconWrap: 'bg-blue-100 text-blue-600 ring-4 ring-blue-50',
			badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
			borderClass: 'border-blue-200',
			btnClass: 'bg-blue-600 hover:bg-blue-700 text-white border-none',
			barClass: 'bg-blue-400'
		};
	});

	function handleConfirm() {
		// 레벨 4: 아직 읽는 중일 때 부드럽게 안내
		if (alert.level === 4 && countdown > 0) {
			guideMsg = `조금만 천천히 읽어 주세요! (${countdown}초 남음)`;
			return;
		}

		// 레벨 5: 5초 강제 대기 후 확인 가능
		if (alert.level === 5 && countdown > 0) {
			guideMsg = `잠시만요! 중요한 안내라서 ${countdown}초 뒤에 확인 버튼이 열려요.`;
			return;
		}

		alertState.dismiss(alert.id);
		if (alert.redirect_url) goto(alert.redirect_url);
	}
</script>

<dialog class="modal modal-open bg-slate-900/45 backdrop-blur-sm" transition:fade={{ duration: 180 }}>
	<div
		in:scale={{ duration: 200, start: 0.96 }}
		class="modal-box relative w-[calc(100%-1.5rem)] overflow-hidden rounded-3xl border-2 bg-white text-slate-900 shadow-2xl {headerMeta.borderClass}
			{isL5 ? 'max-w-2xl p-8 sm:p-12' : 'max-w-md p-6 sm:p-8'}"
	>
		<!-- 상단 카운트다운 진행 바 (L4/L5 대기 중일 때 부드럽게 채워짐) -->
		{#if alert.level >= 4 && countdown > 0}
			<div class="absolute inset-x-0 top-0 bg-slate-100 {isL5 ? 'h-2.5' : 'h-1.5'}">
				<div
					class="h-full transition-all duration-1000 ease-linear {headerMeta.barClass}"
					style="width: {progressPct}%"
				></div>
			</div>
		{/if}

		<div class="min-w-0 text-center">
			<!-- 친근한 아이콘 & 한글 배지 -->
			<div
				class="mx-auto flex items-center justify-center rounded-2xl {headerMeta.iconWrap}
					{isL5 ? 'mb-5 h-20 w-20' : 'mb-3 h-14 w-14'}"
			>
				<Icon icon={headerMeta.icon} class={isL5 ? 'text-5xl' : 'text-3xl'} />
			</div>

			<div class="flex justify-center {isL5 ? 'mb-6' : 'mb-4'}">
				<span
					class="inline-flex items-center gap-1.5 rounded-full border font-black {headerMeta.badgeClass}
						{isL5 ? 'px-4 py-1.5 text-sm sm:text-base' : 'px-3 py-1 text-xs'}"
				>
					{headerMeta.badge}
				</span>
			</div>

			<!-- 본문 메시지 -->
			<div
				class="overflow-y-auto overflow-x-hidden rounded-2xl border border-slate-100 bg-slate-50/80
					{isL5 ? 'max-h-[55vh] px-6 py-8 sm:px-8 sm:py-10' : 'max-h-[45vh] px-4 py-5'}"
			>
				<h3
					class="font-black leading-relaxed tracking-tight text-slate-800 whitespace-pre-wrap break-words [overflow-wrap:anywhere]
						{isL5 ? 'text-2xl sm:text-3xl' : 'text-lg sm:text-xl'}"
				>
					{alert.message}
				</h3>
			</div>

			{#if guideMsg}
				<p class="mt-3 font-bold text-rose-600 {isL5 ? 'text-sm sm:text-base' : 'text-xs'}">{guideMsg}</p>
			{/if}

			<div class="modal-action flex flex-col gap-2.5 {isL5 ? 'mt-8' : 'mt-6'}">
				<button
					type="button"
					class="btn w-full rounded-2xl font-black shadow-md transition-all active:scale-[0.98]
						{isL5 ? 'h-16 min-h-16 text-xl sm:text-2xl' : 'h-13 min-h-13 text-base'}
						{(alert.level === 4 || alert.level === 5) && countdown > 0
							? 'bg-slate-200 text-slate-500 border-none hover:bg-slate-200 cursor-not-allowed'
							: headerMeta.btnClass}"
					onclick={handleConfirm}
				>
					{#if (alert.level === 4 || alert.level === 5) && countdown > 0}
						<Icon icon="solar:clock-circle-bold-duotone" class={isL5 ? 'text-2xl' : 'text-lg'} />
						<span>내용을 확인하고 있어요 ({countdown}초)</span>
					{:else}
						<Icon icon="solar:check-circle-bold" class={isL5 ? 'text-2xl' : 'text-lg'} />
						<span>{alert.confirm_text || '확인했어요'}</span>
					{/if}
				</button>

				{#if alert.level !== 5 && (alert.level !== 4 || countdown <= 0)}
					<button
						type="button"
						class="btn btn-ghost btn-sm text-xs font-bold text-slate-400 hover:text-slate-700"
						onclick={() => alertState.neverShowAgain(alert.id)}
					>
						오늘 하루 보지 않기
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
