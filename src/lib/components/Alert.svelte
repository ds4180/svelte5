<script>
	/**
	 * @file Alert.svelte (Container Version)
	 * @description [v4.0] 전역 알림 컨테이너
	 * - 필터링 로직을 alertState로 이관
	 * - 레벨별 전용 컴포넌트(Toast, Banner, Modal) 호출
	 */
	import { alertState } from '$lib/runes/alert.svelte';
	import { page } from '$app/state';
	
	// 분리된 서브 컴포넌트들 임포트
	import AlertToast from './Alert/AlertToast.svelte';
	import AlertBanner from './Alert/AlertBanner.svelte';
	import AlertModal from './Alert/AlertModal.svelte';

	/** @type {{ positionFilter: 'top' | 'bottom' | 'modal' }} */
	let { positionFilter } = $props();

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
