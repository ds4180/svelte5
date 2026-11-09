<script>
	/**
	 * @file Alert.svelte (Container Version)
	 * @description [v4.0] 전역 알림 컨테이너
	 * - 필터링 로직을 alertState로 이관
	 * - 레벨별 전용 컴포넌트(Toast, Banner, Modal) 호출
	 */
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { websocket } from '$lib/runes/websocket.svelte.js';
	import { notifyAlert } from '$lib/utils/sound';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	
	// 분리된 서브 컴포넌트들 임포트
	import AlertToast from './Alert/AlertToast.svelte';
	import AlertBanner from './Alert/AlertBanner.svelte';
	import AlertModal from './Alert/AlertModal.svelte';

	/** @type {{ positionFilter: 'top' | 'bottom' | 'modal' }} */
	let { positionFilter } = $props();
	let initializedFirstLoad = false;

	// 실시간 데이터 동기화 (Polling)
	async function fetchActiveAlerts() {
		try {
			const response = await fetch('/api/alert/active');
			if (response.ok) {
				const serverAlerts = await response.json();
				const existingIds = new Set(alertState.all.map(oldA => oldA.id));
				
				// 🛡️ [데이터 병합] 서버 데이터를 돌면서 기존 로컬 상태 보존
				const mergedAlerts = serverAlerts.map(newA => {
					const existing = alertState.all.find(oldA => oldA.id === newA.id);
					if (existing) {
						// 기존 객체와 서버 데이터를 합치되, timerStarted 같은 로컬 플래그 유지
						return { ...newA, timerStarted: existing.timerStarted };
					}
					return newA;
				});

				// 🔊 최초 페이지 로드 이후 웹소켓/폴링으로 새로 도착한 L1, L2 알림에 대해 사운드/진동 트리거
				// (L3~L5는 AlertModal.svelte 마운트 시 자동 트리거됨)
				if (initializedFirstLoad) {
					for (const newA of serverAlerts) {
						if (!existingIds.has(newA.id) && (newA.level === 1 || newA.level === 2)) {
							notifyAlert(newA.level);
							break;
						}
					}
				}
				initializedFirstLoad = true;

				// 최종적으로 데이터가 변경되었을 때만 업데이트
				if (JSON.stringify(alertState.all) !== JSON.stringify(mergedAlerts)) {
					alertState.all = mergedAlerts;
				}
			}
		} catch (e) {
			console.warn('⚠️ [Alert] 실시간 갱신 실패', e);
		}
	}

	onMount(() => {
		// modal 컨테이너에서만 대표로 실시간 리스너 및 백업 폴링 수행
		if (positionFilter === 'modal') {
			fetchActiveAlerts();

			// 🌐 [실시간 웹소켓 연동] 관리자의 새 알림 등록 및 상태 변경 시 0초 즉각 반영
			const unsubscribeWs = websocket.addMessageListener((msg) => {
				if (msg && msg.type === 'new_alert') {
					console.log('🔔 [Alert] 새 알림 웹소켓 신호 감지 -> 즉시 갱신 시작');
					fetchActiveAlerts();
				}
			});

			// 혹시 모를 웹소켓 일시 단절에 대비한 백업 폴링 (60초 주기)
			const interval = setInterval(fetchActiveAlerts, 60000);

			return () => {
				unsubscribeWs();
				clearInterval(interval);
			};
		}
	});

	// 현재 경로와 필터에 맞는 알림들만 계산 ($derived)
	const visibleAlerts = $derived(alertState.getVisibleAlerts(positionFilter, page.url.pathname));

	// 레벨별 필터링 분리 ($derived)
	const l1Alerts = $derived(visibleAlerts.filter(a => a.level === 1));
	const l2Alerts = $derived(visibleAlerts.filter(a => a.level === 2));
</script>

<!-- 🔔 Toast Layer (Lv.1: 모바일 퀵메뉴 위 z-[10002] 및 bottom-20 안착) -->
{#if positionFilter !== 'modal' && l1Alerts.length > 0}
	{@const activeL1 = l1Alerts[l1Alerts.length - 1]}
	<div 
		class="toast toast-center z-[10002] pointer-events-auto gap-2 p-2 w-full max-w-[96vw] flex flex-col items-center !whitespace-normal {positionFilter === 'top' ? 'toast-top fixed top-24 bottom-auto left-1/2 -translate-x-1/2' : 'toast-bottom fixed bottom-20 md:bottom-6 top-auto left-1/2 -translate-x-1/2'}"
	>
		<AlertToast 
			alert={activeL1} 
			{positionFilter} 
			totalCount={l1Alerts.length} 
			currentIndex={l1Alerts.length} 
		/>
	</div>
{/if}

<!-- 🚩 Banner Layer (Lv.2: 2건 이상이어도 1줄 높이 완전 고정 5초 롤링 티커) -->
{#if positionFilter !== 'modal' && l2Alerts.length > 0}
	<AlertBanner alerts={l2Alerts} {positionFilter} />
{/if}

<!-- 📦 Modal Layer (Lv.3, 4, 5) -->
{#if positionFilter === 'modal'}
	{#each visibleAlerts as alert (alert.id)}
		<AlertModal {alert} />
	{/each}
{/if}
