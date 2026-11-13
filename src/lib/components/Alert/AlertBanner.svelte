<script>
	/**
	 * @file AlertBanner.svelte
	 * @description 레벨 2 상단/하단 고정 배너 (Shimmer 효과 및 복수 건 5초 롤링 티커 지원)
	 * - 2건 이상 등록되어도 화면 높이를 1줄로 완전 고정하여 레이아웃 겹침 방지
	 * - 5초 자동 롤링 티커, 마우스 호버 시 일시 정지, 이전/다음 수동 탐색 지원
	 * - ✕ 닫기 클릭 시 24시간 동안 보지 않기(neverShowAgain) 자동 연동
	 */
	import { alertState } from '$lib/runes/alert.svelte';
	import { slide, fade } from 'svelte/transition';
	import Icon from '@iconify/svelte';

	let { alerts = [], alert = null, positionFilter = 'top' } = $props();

	// 단일 객체(alert) 또는 복수 배열(alerts) 호환성 보장
	const bannerList = $derived.by(() => {
		if (Array.isArray(alerts) && alerts.length > 0) return alerts;
		if (alert) return [alert];
		return [];
	});

	let currentIndex = $state(0);
	let isPaused = $state(false);

	// 5초 자동 롤링 인터벌 타이머
	$effect(() => {
		if (bannerList.length > 1 && !isPaused) {
			const interval = setInterval(() => {
				currentIndex = (currentIndex + 1) % bannerList.length;
			}, 5000);
			return () => clearInterval(interval);
		}
	});

	// 안전한 인덱스 계산
	const safeIndex = $derived(bannerList.length > 0 ? currentIndex % bannerList.length : 0);
	const activeAlert = $derived(bannerList[safeIndex]);

	function prevAlert() {
		if (bannerList.length <= 1) return;
		currentIndex = (safeIndex - 1 + bannerList.length) % bannerList.length;
	}

	function nextAlert() {
		if (bannerList.length <= 1) return;
		currentIndex = (safeIndex + 1) % bannerList.length;
	}

	function handleDismiss() {
		if (!activeAlert) return;
		// ✕ 클릭 시 24시간 동안 브라우저에 다시 뜨지 않도록 영구 차단
		alertState.neverShowAgain(activeAlert.id);
	}
</script>

{#if activeAlert}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="{positionFilter === 'bottom' ? 'fixed bottom-16 md:bottom-0 left-0 right-0' : 'fixed top-14 md:top-16 left-0 right-0'} z-[1002] h-10 sm:h-11 w-full overflow-hidden px-4 text-center text-xs font-bold text-white shadow-lg md:text-sm flex items-center justify-between
	           {activeAlert.style === 'danger' ? 'bg-rose-600' : 'bg-blue-600'}"
		transition:slide={{ duration: 300 }}
		onmouseenter={() => (isPaused = true)}
		onmouseleave={() => (isPaused = false)}
	>
		<!-- 🌊 Ocean Wave Shimmer Effect Layers -->
		<div class="wave-layer wave-1 absolute inset-0 pointer-events-none opacity-30"></div>
		<div class="wave-layer wave-2 absolute inset-0 pointer-events-none opacity-20"></div>

		<!-- 좌측/중앙: 메시지 내용 -->
		<div class="relative mx-auto flex max-w-7xl w-full items-center justify-between gap-3">
			<div class="flex items-center gap-2 min-w-0 flex-1 justify-center sm:justify-start">
				<Icon icon="mdi:information-variant" class="text-lg shrink-0" />
				{#key activeAlert.id}
					<span in:fade={{ duration: 200 }} class="truncate">
						{activeAlert.message}
					</span>
				{/key}
			</div>

			<!-- 우측: 롤링 네비게이션 컨트롤러 & 닫기 -->
			<div class="flex items-center gap-2 shrink-0">
				{#if bannerList.length > 1}
					<div class="flex items-center gap-1 bg-black/25 rounded-full px-2.5 py-0.5 text-[11px] font-black tracking-wider text-white">
						<button 
							type="button" 
							class="hover:opacity-75 transition px-1 cursor-pointer" 
							onclick={prevAlert}
							title="이전 공지"
						>‹</button>
						<span>{safeIndex + 1}/{bannerList.length}</span>
						<button 
							type="button" 
							class="hover:opacity-75 transition px-1 cursor-pointer" 
							onclick={nextAlert}
							title="다음 공지"
						>›</button>
					</div>
				{/if}

				<button
					type="button"
					onclick={handleDismiss}
					class="btn btn-circle btn-ghost btn-xs text-white hover:bg-white/20 h-6 w-6 min-h-0"
					aria-label="알림 닫기 (오늘 하루 보지 않기)"
					title="닫기 (오늘 하루 보지 않기)"
				>
					<Icon icon="mdi:close" class="h-4 w-4" />
				</button>
			</div>
		</div>
	</div>
{/if}

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
