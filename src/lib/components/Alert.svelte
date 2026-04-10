<script>
	/**
	 * @file Alert.svelte (Container Version)
	 * @description [v4.0] 전역 알림 컨테이너
	 * - 필터링 로직을 alertState로 이관
	 * - 레벨별 전용 컴포넌트(Toast, Banner, Modal) 호출
	 */
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	
	// 분리된 서브 컴포넌트들 임포트
	import AlertToast from './Alert/AlertToast.svelte';
	import AlertBanner from './Alert/AlertBanner.svelte';
	import AlertModal from './Alert/AlertModal.svelte';

	/** @type {{ positionFilter: 'top' | 'bottom' | 'modal' }} */
	let { positionFilter } = $props();

	// 실시간 데이터 동기화 (Polling)
	async function fetchActiveAlerts() {
		try {
			const response = await fetch('/api/alert/active');
			if (response.ok) {
				const serverAlerts = await response.json();
				
				// 🛡️ [데이터 병합] 서버 데이터를 돌면서 기존 로컬 상태 보존
				const mergedAlerts = serverAlerts.map(newA => {
					const existing = alertState.all.find(oldA => oldA.id === newA.id);
					if (existing) {
						// 기존 객체와 서버 데이터를 합치되, timerStarted 같은 로컬 플래그 유지
						return { ...newA, timerStarted: existing.timerStarted };
					}
					return newA;
				});

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
		// modal 컨테이너에서만 대표로 폴링 수행
		if (positionFilter === 'modal') {
			fetchActiveAlerts();
			const interval = setInterval(fetchActiveAlerts, 30000); // 30초 주기
			return () => clearInterval(interval);
		}
	});

	// 현재 경로와 필터에 맞는 알림들만 계산 ($derived)
	const visibleAlerts = $derived(alertState.getVisibleAlerts(positionFilter, page.url.pathname));
</script>

<!-- 🔔 Toast Layer (Lv.1) -->
{#if positionFilter !== 'modal'}
	<div class="toast toast-{positionFilter} toast-center z-[1000] gap-2 p-4">
		{#each visibleAlerts.filter(a => a.level === 1) as alert (alert.id)}
			<AlertToast {alert} {positionFilter} />
		{/each}
	</div>
{/if}

<!-- 🚩 Banner Layer (Lv.2) -->
{#each visibleAlerts.filter(a => a.level === 2) as alert (alert.id)}
	<AlertBanner {alert} />
{/each}

<!-- 📦 Modal Layer (Lv.3, 4, 5) -->
{#if positionFilter === 'modal'}
	{#each visibleAlerts as alert (alert.id)}
		<AlertModal {alert} />
	{/each}
{/if}
