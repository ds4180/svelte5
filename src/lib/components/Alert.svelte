<script>
	/**
	 * @file Alert.svelte
	 * @description daisyUI 기반의 프로젝트 전역 알림 컴포넌트 (Svelte 5)
	 * 이 컴포넌트는 전역 알림(Toast, Modal 등)을 담당하며, daisyUI 클래스를 적극 활용합니다.
	 */
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { fly, fade, slide } from 'svelte/transition';
	import { onMount, onDestroy, untrack } from 'svelte';
	import Icon from '@iconify/svelte'; // Icon 컴포넌트 추가

	/** @type {{ positionFilter: 'top' | 'bottom' | 'modal' }} */
	let { positionFilter } = $props();
	let interval;
	let isFetching = false; // 호출 중복 방지용 플래그
	async function fetchActiveAlerts() {
		if (isFetching) return; // 이미 호출 중이면 대기
		isFetching = true;
		try {
			const response = await fetch('/api/alert/active');
			if (response.ok) {
				const json = await response.json();

				// ⚠️ [중요] 실제 데이터가 변했을 때만 상태를 업데이트하여 불필요한 재렌더링 유발 차단
				if (JSON.stringify(alertState.all) !== JSON.stringify(json)) {
					untrack(() => {
						alertState.all = json;
					});
				}
			}
		} catch (e) {
			console.warn('[Alert] 실시간 갱신 실패', e);
		} finally {
			isFetching = false;
		}
	}
	onMount(() => {
		// modal 필터일 때만 실행하며 주기를 60초(1분)로 넉넉하게 조정합니다.
		if (positionFilter === 'modal') {
			fetchActiveAlerts();
			interval = setInterval(fetchActiveAlerts, 60000);
		}
	});

	onDestroy(() => {
		console.log('[Alert] onDestroy 실행됨. 인터벌 정리.');
		if (interval) clearInterval(interval);
	});

	/**
	 * 현재 화면에 표시해야 할 대상들을 필터링 ($derived)
	 * ⚠️ [하이드레이션 방어] 서버와 클라이언트의 시간 차이를 극복하기 위해 now를 외부에서 제어하거나 안정화합니다.
	 */
	let displayAlerts = $derived.by(() => {
		console.log(
			'[Alert] displayAlerts 계산 시작. alertState.all:',
			$state.snapshot(alertState.all)
		);
		const alerts = alertState?.all || [];
		if (alerts.length === 0) {
			console.log('[Alert] 필터링 후 displayAlerts (초기/빈 배열):', []);
			return [];
		}

		// 서버 사이드 렌더링 시에는 시간 필터링을 최소화하거나 고정된 시간을 사용합니다.
		const now = new Date();

		const filteredAlerts = alerts.filter((a) => {
			if (!a) return false;

			// 1. 기간 체크 (서버/클라이언트 정합성을 위해 유효성 검사 강화)
			if (a.start_date && new Date(a.start_date) > now) return false;
			if (a.end_date && new Date(a.end_date) < now) return false;

			// 2. 차단 체크
			if (alertState.dismissedIds && alertState.dismissedIds[a.id]) return false;
			if (alertState.sessionHiddenIds && alertState.sessionHiddenIds.has(a.id)) return false;

			// 3. 방해 금지 모드 필터링
			if (alertState.isQuietMode && a.level < 4) return false;

			// 4. 경로 체크 (안전한 옵셔널 체이닝 및 기본값 적용)
			const currentPath = $page?.url?.pathname || '/';
			const pathMatch =
				!a.route ||
				a.route.trim() === '' ||
				a.route === '*' ||
				a.route.split(',').some((r) => r.trim() === currentPath);
			if (!pathMatch) return false;

			// 5. 위치 분류
			if (positionFilter === 'modal') return a.level >= 3;
			const pos = a.position || 'top';
			return a.level < 3 && pos === positionFilter;
		});

		console.log('[Alert] 필터링 후 displayAlerts:', $state.snapshot(filteredAlerts));
		return filteredAlerts;
	});

	// Lv.1 알림 자동 소멸 로직 (안전한 체킹)
	$effect(() => {
		if (!displayAlerts) return;
		displayAlerts.forEach((alert) => {
			if (alert && alert.level === 1 && !alert.timerStarted) {
				alert.timerStarted = true;
				setTimeout(() => alertState.dismiss(alert.id), 10000);
			}
		});
	});

	let penaltyMsg = $state({}); // 강제 정독 미준수 시 메시지

	/**
	 * 확인 버튼 클릭 핸들러
	 * @param {Object} alert - 알림 객체
	 */
	function handleConfirm(alert) {
		// Lv.4/5는 정독 타이머 체크 예정 (추후 타이머 기능 복원 시 추가)
		alertState.dismiss(alert.id);
		if (alert.redirect_url) goto(alert.redirect_url);
	}

	// 🛡️ [하이드레이션 방어] 서버/클라이언트 마크업 불일치 방지
	let isMounted = $state(false);
	onMount(() => {
		isMounted = true;
	});
</script>

{#if isMounted}
	<!-- 🛡️ 브라우저 탑재 완료 후에만 렌더링 (하이드레이션 불일치 방지) -->
	<!-- Lv.2 배너 (상단 레이아웃 아래 고정) -->
	{#each displayAlerts.filter((a) => a.level === 2 && a.position === 'top') as alert (alert.id)}
		<div
			class="relative z-[999] w-full bg-blue-600 p-3 text-center text-sm font-bold text-white shadow-lg md:p-4 md:text-base"
			transition:slide={{ y: -100, duration: 300 }}
		>
			<div class="mx-auto flex max-w-7xl items-center justify-between">
				<span
					><Icon
						icon="mdi:information-variant"
						class="mr-2 inline-block align-text-bottom"
					/>{alert.message}</span
				>
				<button
					onclick={() => alertState.dismiss(alert.id)}
					class="btn btn-circle text-white btn-ghost btn-sm hover:bg-white hover:text-blue-600"
				>
					<Icon icon="mdi:close" class="h-5 w-5" />
				</button>
			</div>
		</div>
	{/each}

	<!-- daisyUI Toast (Lv.1) : 상단/하단 부유형 알림 -->
	{#if positionFilter !== 'modal' && displayAlerts.filter((a) => a.level === 1).length > 0}
		<div class="toast toast-{positionFilter} toast-center z-[1000] gap-2 p-4">
			{#each displayAlerts.filter((a) => a.level === 1) as alert (alert.id)}
				<div
					class="alert alert-{alert.style === 'danger'
						? 'error'
						: alert.style} min-w-[280px] rounded-3xl border-none px-5 py-3 shadow-xl"
					transition:fly={{ y: positionFilter === 'top' ? -50 : 50, duration: 600 }}
				>
					<div class="flex items-center gap-3">
						<span class="text-sm font-semibold">{alert.message}</span>
					</div>
					<div class="flex-none">
						<button
							class="btn btn-circle btn-ghost btn-xs"
							onclick={() => alertState.neverShowAgain(alert.id)}>✕</button
						>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- daisyUI Modal (Lv.3, Lv.4, Lv.5) : 전체화면 및 중앙 팝업 -->
	{#if positionFilter === 'modal'}
		{#each displayAlerts.filter((a) => a.level >= 3) as alert (alert.id)}
			<!-- Level 3, 4, 5만 Modal 처리 -->
			<dialog class="modal-open modal backdrop-blur-md" transition:fade>
				<div
					class="modal-box max-w-lg rounded-[2rem] border border-white/20 p-12 shadow-2xl {alert.level ===
					5
						? 'bg-gradient-to-br from-red-600 via-red-800 to-black text-white'
						: 'bg-base-100'}"
				>
					<div class="text-center">
						<div class="mb-2 text-[10px] tracking-widest uppercase opacity-40">
							Important Notification
						</div>
						<div class="py-8">
							<h3 class="text-3xl leading-tight font-black tracking-tighter whitespace-pre-wrap">
								{alert.level === 5 ? '🚨 ' : ''}{alert.message}
							</h3>
						</div>

						<div class="modal-action mt-8 flex flex-col gap-4">
							<button
								class="btn h-16 rounded-2xl text-lg font-black shadow-lg transition-all btn-lg hover:scale-[1.02] active:scale-[0.98] {alert.level ===
								5
									? 'border-none bg-white text-red-700 hover:bg-gray-100'
									: 'btn-' + (alert.style === 'danger' ? 'error' : alert.style)}"
								onclick={() => handleConfirm(alert)}
							>
								{penaltyMsg[alert.id] || alert.confirm_text || '확인하였습니다'}
							</button>

							<button
								class="btn text-xs opacity-40 btn-ghost transition-opacity btn-sm hover:opacity-100"
								onclick={() => alertState.neverShowAgain(alert.id)}
							>
								다시 보이지 않음
							</button>
						</div>
					</div>
				</div>
			</dialog>
		{/each}
	{/if}
{/if}

<style>
	/* daisyUI 기반이므로 인라인 스타일을 최소화합니다. */
	:global(.modal-open) {
		pointer-events: auto;
	}
</style>
