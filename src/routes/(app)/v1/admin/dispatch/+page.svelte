<script lang="ts">
	/**
	 * ============================================================================
	 * [관리자 차량 배차 관제 센터 (/v1/admin/dispatch/+page.svelte)]
	 * ============================================================================
	 * - 비즈니스 로직: $lib/services/dispatchAdminService
	 * - 탭 구성: 배차 조율 캔버스 | 설정 (항상 맨 오른쪽)
	 */
	import { onMount, untrack } from 'svelte';
	import { fade } from 'svelte/transition';
	import * as dispatchApi from '$lib/api/dispatch';
	import type {
		DispatchPreviewWindow,
		DispatchRow,
		DispatchSettings,
		DriverResource,
		DriverWorkStat,
		RouteMasterItem
	} from '$lib/api/dispatch';
	import DispatchCanvasTable from '$lib/components/dispatch/DispatchCanvasTable.svelte';
	import DispatchDriverBoard from '$lib/components/dispatch/DispatchDriverBoard.svelte';
	import DispatchSettingsTab from '$lib/components/dispatch/DispatchSettingsTab.svelte';
	import {
		buildDispatchSavePayloads,
		computeTomorrowPredictions,
		DEFAULT_DISPATCH_SETTINGS,
		fetchDispatchForRoutes,
		toggleAutoFillDispatch
	} from '$lib/services/dispatchAdminService';
	import { getSiteTitle } from '$lib/config/site';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatDate } from '$lib/utils';
	import { formatApiError } from '$lib/utils/error';
	import Icon from '@iconify/svelte';

	let activeTab = $state<'canvas' | 'settings'>('canvas');
	let routes = $state<RouteMasterItem[]>([]);
	let selectedRoute = $state<RouteMasterItem | null>(null);
	let dispatchRows = $state<DispatchRow[]>([]);
	let originalDispatchRows = $state<DispatchRow[]>([]);
	let isAutoFilled = $state(false);
	let isHideRecommendations = $state(false);
	let isLocked = $state(false);
	let lockedBy = $state('');

	// 서버에서 로드하는 리소스 & 설정 (정적 JSON 하드코딩 제거)
	let vehiclesByGroup = $state<Record<string, string[]>>({});
	let driverPool = $state<DriverResource[]>([]);
	let driverStats = $state<Record<string, DriverWorkStat>>({});
	let lastSyncedDateKey = '';
	let dispatchSettings = $state<DispatchSettings>({ ...DEFAULT_DISPATCH_SETTINGS });
	let previewWindow = $state<DispatchPreviewWindow | null>(null);

	async function refreshDriverStats(dateKey: string) {
		try {
			const res = await dispatchApi.adminGetDriverWorkStats(dateKey);
			driverStats = res.stats || {};
		} catch (err) {
			console.warn('⚠️ Failed to fetch driver work stats:', err);
		}
	}

	const getToday = () => {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d;
	};
	let today = getToday();
	let selectedDate = $state(getToday());

	const formatDateISO = (date: Date) => formatDate(date);
	const tomorrowObj = new Date(today);
	tomorrowObj.setDate(tomorrowObj.getDate() + 1);
	const tomorrowDateKey = formatDateISO(tomorrowObj);
	const formatDateDisplay = (date: Date) =>
		`${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
	const formatFullDate = (date: Date) => {
		const days = ['일', '월', '화', '수', '목', '금', '토'];
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} (${days[date.getDay()]})`;
	};

	const selectedDateKey = $derived(formatDateISO(selectedDate));
	const selectedFullDate = $derived(formatFullDate(selectedDate));
	const activeRoutesForRender = $derived(
		selectedRoute?.id === 'ALL' ? routes : selectedRoute ? [selectedRoute] : []
	);
	const assignedDriversCount = $derived(dispatchRows.filter((r) => r.driver_name).length);
	const assignRate = $derived(
		dispatchRows.length > 0 ? Math.round((assignedDriversCount / dispatchRows.length) * 100) : 0
	);
	const isPreviewDatePublic = $derived(
		Boolean(
			dispatchSettings.preview_enabled &&
			previewWindow &&
			!previewWindow.is_paused &&
			previewWindow.allowed_dates?.includes(selectedDateKey)
		)
	);
	const isDMinus1 = $derived(selectedDateKey === tomorrowDateKey);
	const statusCounts = $derived.by(() => {
		let announced = 0;
		let confirmed = 0;
		let draft = 0;
		for (const row of dispatchRows) {
			if (row.status === 'ANNOUNCED') announced += 1;
			else if (row.status === 'CONFIRMED') confirmed += 1;
			else draft += 1;
		}
		return { announced, confirmed, draft, total: dispatchRows.length };
	});
	const isD1Announced = $derived(
		statusCounts.total > 0 && statusCounts.announced === statusCounts.total
	);
	const isD1PartialAnnounced = $derived(
		statusCounts.announced > 0 && statusCounts.announced < statusCounts.total
	);
	const isD1Confirmed = $derived(
		!isD1Announced && !isD1PartialAnnounced && statusCounts.confirmed > 0
	);

	function setDate(date: Date) {
		selectedDate = new Date(date);
		selectedDate.setHours(0, 0, 0, 0);
		selectedDriver = null;
	}

	function moveDate(offset: number) {
		const next = new Date(selectedDate);
		next.setDate(selectedDate.getDate() + offset);
		setDate(next);
	}

	function getRelativeLabel(targetDate: Date) {
		const diff = Math.round((targetDate.getTime() - today.getTime()) / 86400000);
		if (diff === 0) return '오늘';
		if (diff === 1) return '내일';
		if (diff === 2) return '모레';
		if (diff === -1) return '어제';
		if (diff === -2) return '그저께';
		return diff > 0 ? `${diff}일 뒤` : `${Math.abs(diff)}일 전`;
	}

	let prevDate = $derived.by(() => {
		const d = new Date(selectedDate);
		d.setDate(d.getDate() - 1);
		return d;
	});
	let nextDate = $derived.by(() => {
		const d = new Date(selectedDate);
		d.setDate(d.getDate() + 1);
		return d;
	});

	let selectedDriver = $state<DriverResource | null>(null);
	let otherRouteAssignedDrivers = $state<string[]>([]);
	const assignedDrivers = $derived(
		Array.from(
			new Set([
				...dispatchRows.map((d) => String(d.driver_name || '').trim()).filter(Boolean),
				...otherRouteAssignedDrivers
			])
		)
	);
	const availableDrivers = $derived(
		driverPool.filter((driver) => !assignedDrivers.includes(String(driver.name || '').trim()))
	);

	function selectDriver(driver: DriverResource) {
		selectedDriver = selectedDriver?.name === driver.name ? null : driver;
	}

	function assignTodayDriver(row: DispatchRow) {
		if (selectedDriver) {
			row.driver_name = selectedDriver.name;
			if (!String(row.vehicle_no || '').trim() && selectedDriver.vehicle_no) {
				row.vehicle_no = selectedDriver.vehicle_no;
			}
			selectedDriver = null;
		} else {
			row.driver_name = '';
		}
		row.is_inherited = false;
		dispatchRows = computeTomorrowPredictions(dispatchRows, driverPool);
	}

	function assignTomorrowDriver(row: DispatchRow) {
		if (selectedDriver) {
			row.tomorrow_driver_name = selectedDriver.name;
			row.is_tomorrow_inherited = false;
			selectedDriver = null;
		} else {
			row.tomorrow_driver_name = '';
			row.is_tomorrow_inherited = false;
		}
		row.is_inherited = false;
	}

	function autoFillDrivers() {
		const res = toggleAutoFillDispatch({
			rows: dispatchRows,
			originalRows: originalDispatchRows,
			isAutoFilled,
			driverPool,
			driverStats
		});
		dispatchRows = res.rows;
		originalDispatchRows = res.originalRows;
		isAutoFilled = res.isAutoFilled;
	}

	let fetchToken = 0;
	let lastLoadedRoutesDate = '';

	async function loadResourcesAndSettings() {
		try {
			const [res, setRes] = await Promise.all([
				dispatchApi.adminGetDispatchResources(),
				dispatchApi.adminGetDispatchSettings().catch(() => null)
			]);
			vehiclesByGroup = res.vehicles_by_group || {};
			driverPool = res.drivers || [];
			if (setRes?.settings) {
				dispatchSettings = { ...DEFAULT_DISPATCH_SETTINGS, ...setRes.settings };
				previewWindow = setRes.preview_window || null;
			} else if (res.settings) {
				dispatchSettings = { ...DEFAULT_DISPATCH_SETTINGS, ...res.settings };
			}
		} catch (e) {
			toast.error('배차 리소스/설정 로드 실패: ' + formatApiError(e, '오류'));
		}
	}

	async function syncData(dateKey: string, forceRouteId: number | 'ALL' | null = null) {
		const token = ++fetchToken;
		try {
			if (dateKey !== lastLoadedRoutesDate) {
				const activeRoutes = await dispatchApi.adminGetActiveRouteMasters(dateKey);
				if (token !== fetchToken) return;
				routes = activeRoutes;
				lastLoadedRoutesDate = dateKey;

				if (activeRoutes.length > 0) {
					const targetId = forceRouteId || selectedRoute?.id;
					if (targetId === 'ALL') {
						selectedRoute = { id: 'ALL', route_name: '전체 노선' };
					} else {
						const found = activeRoutes.find(
							(r: RouteMasterItem) =>
								r.id === targetId || r.route_name === selectedRoute?.route_name
						);
						selectedRoute = found || { id: 'ALL', route_name: '전체 노선' };
					}
				} else {
					selectedRoute = null;
				}
			} else if (forceRouteId !== null) {
				if (forceRouteId === 'ALL') {
					selectedRoute = { id: 'ALL', route_name: '전체 노선' };
				} else {
					const found = routes.find((r) => r.id === forceRouteId);
					if (found) selectedRoute = found;
				}
			}

			if (!selectedRoute) {
				dispatchRows = [];
				return;
			}

			lastSyncedDateKey = dateKey;
			const targetRoutes = selectedRoute.id === 'ALL' ? routes : [selectedRoute];
			const [combined, statsRes, pubRes, tomorrowPubRes] = await Promise.all([
				fetchDispatchForRoutes({
					dateKey,
					targetRoutes,
					vehiclesByGroup,
					routeFleetRules: dispatchSettings.route_fleet_rules,
					isAdmin: true
				}),
				dispatchApi.adminGetDriverWorkStats(dateKey).catch((err) => {
					console.warn('⚠️ Failed to fetch driver work stats:', err);
					return null;
				}),
				dispatchApi.adminGetDispatchPublishStatus(dateKey).catch(() => null),
				dateKey === tomorrowDateKey
					? Promise.resolve(null)
					: dispatchApi.adminGetDispatchPublishStatus(tomorrowDateKey).catch(() => null)
			]);
			if (token !== fetchToken) return;
			selectedDatePublished = Boolean(pubRes?.published);
			const tmrSource = dateKey === tomorrowDateKey ? pubRes : tomorrowPubRes;
			if (tmrSource) {
				tomorrowSummary = {
					published: Boolean(tmrSource.published),
					confirmed: Boolean(tmrSource.confirmed),
					confirmedCount: Number(tmrSource.confirmed_count ?? 0),
					savedCount: Number(tmrSource.saved_count ?? 0),
					totalCount: Number(tmrSource.total_count ?? 0)
				};
			}
			dispatchRows = combined;
			originalDispatchRows = JSON.parse(JSON.stringify(combined));
			if (statsRes) {
				driverStats = statsRes.stats || {};
				if (selectedRoute.id !== 'ALL') {
					const currentRouteSaved = new Set(
						combined.map((r) => String(r.driver_name || '').trim()).filter(Boolean)
					);
					otherRouteAssignedDrivers = (statsRes.assigned_today_drivers || []).filter(
						(name) => !currentRouteSaved.has(name)
					);
				} else {
					otherRouteAssignedDrivers = [];
				}
			} else {
				otherRouteAssignedDrivers = [];
			}
			isAutoFilled = false;
		} catch (err) {
			console.error('❌ Failed to sync dispatch data:', err);
			if (token === fetchToken) dispatchRows = [];
		}
	}

	function selectRoute(route: RouteMasterItem) {
		selectedRoute = route;
		selectedDriver = null;
		syncData(selectedDateKey, route.id);
	}

	async function saveDispatch(
		status: 'DRAFT' | 'CONFIRMED' | 'ANNOUNCED',
		opts?: { silent?: boolean }
	) {
		if (!selectedRoute) {
			toast.warning('선택된 노선이 없습니다.');
			return;
		}
		try {
			const payloads = buildDispatchSavePayloads({
				selectedRoute,
				routes,
				dispatchRows,
				dateKey: selectedDateKey,
				status
			});
			await Promise.all(payloads.map((p) => dispatchApi.adminSaveDailyDispatch(p)));
			dispatchRows = dispatchRows.map((r) => ({ ...r, status }));
			if (!opts?.silent) {
				if (status === 'ANNOUNCED') {
					toast.success('명일 배차가 즉시 배포되었습니다.');
				} else if (status === 'CONFIRMED') {
					toast.success(
						isDMinus1
							? `명일 배차가 확정되었습니다. (${dispatchSettings.auto_announce_time || '17:00'} 자동 배포)`
							: '배차 예고에 공개되었습니다.'
					);
				} else {
					toast.success(
						isDMinus1 ? '명일 배차 확정이 취소(저장)되었습니다.' : '배차 정보가 저장되었습니다.'
					);
				}
			}
			await syncData(selectedDateKey, selectedRoute.id);
		} catch (err) {
			toast.error('배차 저장 실패: ' + formatApiError(err, '오류'));
		}
	}

	let selectedDatePublished = $state(false);
	let tomorrowSummary = $state<{
		published: boolean;
		confirmed: boolean;
		confirmedCount: number;
		savedCount: number;
		totalCount: number;
	}>({
		published: false,
		confirmed: false,
		confirmedCount: 0,
		savedCount: 0,
		totalCount: 0
	});
	let announcingNow = $state(false);
	async function handleDeployNowD1() {
		if (announcingNow || !selectedRoute) return;
		if (
			!confirm('명일(D-1) 배차를 저장·확정 후 지금 즉시 공개(배포)하고 알림·푸시를 발송할까요?')
		) {
			return;
		}
		announcingNow = true;
		try {
			// 저장하기 -> 배차 확정 -> 배포(공개) 순서 실행
			await saveDispatch('CONFIRMED', { silent: true });
			const res = await dispatchApi.adminAnnounceDispatchNow();
			selectedDatePublished = true;
			toast.success(res.message || '명일 배차가 저장·확정 및 공개(배포)되었습니다.');
			await syncData(selectedDateKey, selectedRoute.id);
		} catch (err) {
			toast.error('지금 공개 실패: ' + formatApiError(err, '오류'));
		} finally {
			announcingNow = false;
		}
	}

	async function handlePublishTomorrowFromCard() {
		if (announcingNow || !tomorrowSummary.confirmed) return;
		if (!confirm('확정된 명일(D-1) 배차를 공개(배포)하고 알림·푸시를 발송할까요?')) {
			return;
		}
		announcingNow = true;
		try {
			const res = await dispatchApi.adminAnnounceDispatchNow();
			selectedDatePublished = true;
			toast.success(res.message || '명일 배차가 공개(배포)되었습니다.');
			await syncData(selectedDateKey, selectedRoute?.id ?? null);
		} catch (err) {
			toast.error('명일 배차 공개 실패: ' + formatApiError(err, '오류'));
		} finally {
			announcingNow = false;
		}
	}

	let togglingPreview = $state(false);
	async function toggleGlobalPreviewEnabled() {
		if (togglingPreview) return;
		togglingPreview = true;
		try {
			const nextEnabled = !dispatchSettings.preview_enabled;
			const res = await dispatchApi.adminUpdateDispatchSettings({
				...dispatchSettings,
				preview_enabled: nextEnabled
			});
			dispatchSettings = res.settings;
			previewWindow = res.preview_window;
			toast.success(
				nextEnabled
					? '배차 예고가 전역 공개(표시) 상태로 전환되었습니다.'
					: '배차 예고가 전역 숨김(일시정지) 상태로 전환되었습니다.'
			);
		} catch (err) {
			toast.error('배차 예고 표시 설정 변경 실패: ' + formatApiError(err, '오류'));
		} finally {
			togglingPreview = false;
		}
	}

	async function handleUnpublishD1() {
		if (announcingNow) return;
		if (!confirm('명일(D-1) 배차 공개를 취소하고 비공개(공개 전) 상태로 되돌릴까요?')) {
			return;
		}
		announcingNow = true;
		try {
			const res = await dispatchApi.adminSetDispatchPublishStatus(tomorrowDateKey, false);
			if (isDMinus1) selectedDatePublished = false;
			tomorrowSummary = {
				...tomorrowSummary,
				published: false,
				confirmed: false,
				confirmedCount: 0
			};
			toast.success(res.message || '명일 배차가 비공개 처리되었습니다.');
			await syncData(selectedDateKey, selectedRoute?.id ?? null);
		} catch (err) {
			toast.error('공개 취소 실패: ' + formatApiError(err, '오류'));
		} finally {
			announcingNow = false;
		}
	}

	onMount(async () => {
		await loadResourcesAndSettings();
		await syncData(selectedDateKey);
	});

	$effect(() => {
		const date = selectedDateKey;
		if (date && Object.keys(vehiclesByGroup).length > 0) {
			untrack(() => {
				syncData(date);
			});
		}
	});
</script>

<svelte:head>
	<title>{getSiteTitle('차량 배차 관리')}</title>
</svelte:head>

<div
	class="mx-auto w-full max-w-[1800px] space-y-4 px-1 py-4 pb-20 font-['Noto_Sans_KR','Outfit'] sm:px-2 md:space-y-6 md:px-3 md:py-6 lg:px-4"
>
	<!-- 1. 헤더 & 액션 바 -->
	<div
		class="flex min-w-0 flex-col gap-4 border-b-2 border-slate-900 pb-5 md:flex-row md:items-end md:justify-between md:border-b-4 md:pb-6"
	>
		<div class="min-w-0">
			<div class="flex items-center gap-2">
				<span
					class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-wider text-emerald-400 uppercase"
				>
					<span class="h-2 w-2 animate-ping rounded-full bg-emerald-400"></span>
					Fleet Dispatch Canvas
				</span>
				<span class="text-xs font-bold text-slate-400">v1/admin/dispatch</span>
				{#if isLocked}
					<span
						class="animate-pulse rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700 uppercase"
					>
						Lock by {lockedBy}
					</span>
				{/if}
			</div>
			<h1
				class="mt-2 text-3xl font-black tracking-tight text-slate-900 uppercase italic md:text-4xl"
			>
				차량 <span class="text-blue-600 not-italic">배차 관리</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				노선별 배차표 조율, 기사 투입, 배차 예고 및 명일 자동 고지 정책을 통합 관리합니다.
			</p>
		</div>

		<div class="flex max-w-full min-w-0 flex-wrap items-center gap-2.5">
			{#if selectedRoute && activeTab === 'canvas' && !isDMinus1 && selectedDateKey !== formatDateISO(today)}
				{#if isPreviewDatePublic}
					<span
						class="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-1.5 text-sm font-black text-emerald-700"
					>
						<span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
						{selectedFullDate} · 자동 공개 중
					</span>
				{:else}
					<span
						class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-4 py-1.5 text-sm font-black text-slate-600"
					>
						<span class="h-2.5 w-2.5 rounded-full bg-slate-400"></span>
						{selectedFullDate} · 비공개 ({!dispatchSettings.preview_enabled
							? '배차 예고 중지 중'
							: '예고 구간 외'})
					</span>
				{/if}
			{/if}
			<button
				type="button"
				onclick={() => syncData(selectedDateKey, selectedRoute?.id ?? null)}
				class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
			>
				<Icon icon="solar:restart-bold" class="text-base" />
				<span>새로고침</span>
			</button>
			<a
				href="/v1/admin"
				class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
			>
				<Icon icon="solar:home-smile-angle-bold-duotone" class="text-base text-slate-500" />
				<span>관리자 홈</span>
			</a>
		</div>
	</div>

	<!-- 2. 상단 4대 관제 지표 요약 카드 -->
	<div class="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-12">
		<!-- 카드 1: 배차 예고 상태 & 전역 토글 -->
		<div
			class="col-span-2 flex min-w-0 flex-col justify-between rounded-[1.75rem] border-2 p-4 shadow-sm sm:col-span-1 sm:p-5 lg:col-span-4 {dispatchSettings.preview_enabled
				? 'border-emerald-200 bg-emerald-50/40'
				: 'border-rose-200 bg-rose-50/40'}"
		>
			<div class="flex items-center justify-between gap-2">
				<span class="truncate text-xs font-black text-slate-500 uppercase">배차 예고 상태</span>
				<span
					class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-black {dispatchSettings.preview_enabled
						? 'bg-emerald-100 text-emerald-700'
						: 'bg-rose-100 text-rose-700'}"
				>
					<span
						class="h-2 w-2 rounded-full {dispatchSettings.preview_enabled
							? 'bg-emerald-500'
							: 'bg-rose-500'}"
					></span>
					{dispatchSettings.preview_enabled ? '공개 중' : '중지 중'}
				</span>
			</div>
			<div class="mt-3 flex flex-wrap items-end justify-between gap-3">
				<div class="min-w-0 flex-1">
					<div
						class="truncate text-xl font-black sm:text-2xl {dispatchSettings.preview_enabled
							? 'text-emerald-700'
							: 'text-rose-700'}"
					>
						{dispatchSettings.preview_enabled ? '배차 예고 중' : '배차 예고 중지 중'}
					</div>
					<div class="mt-1 truncate text-xs font-bold text-slate-500">
						노출 구간: +{dispatchSettings.preview_start_offset ??
							3}~+{(dispatchSettings.preview_start_offset ?? 3) +
							(dispatchSettings.preview_days ?? 5) -
							1}일
					</div>
				</div>
				<button
					type="button"
					disabled={togglingPreview}
					onclick={toggleGlobalPreviewEnabled}
					class="w-full shrink-0 rounded-xl px-3.5 py-2 text-xs font-black text-white shadow-sm transition active:scale-95 disabled:opacity-50 sm:w-auto {dispatchSettings.preview_enabled
						? 'bg-amber-600 hover:bg-amber-700'
						: 'bg-indigo-600 hover:bg-indigo-700'}"
				>
					{dispatchSettings.preview_enabled ? '숨기기' : '표시하기'}
				</button>
			</div>
		</div>

		<!-- 카드 2: 명일 배차(D+1) 저장 상태 · 확정/공개 여부 -->
		<div
			class="col-span-2 flex min-w-0 flex-col justify-between rounded-[1.75rem] border-2 p-4 shadow-sm sm:col-span-1 sm:p-5 lg:col-span-4 {tomorrowSummary.published
				? 'border-emerald-200 bg-white'
				: 'border-amber-200 bg-amber-50/30'}"
		>
			<div class="flex items-center justify-between gap-2">
				<span class="truncate text-xs font-black text-slate-500">
					명일 배차 ({tomorrowDateKey})
				</span>
				<span
					class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-black {tomorrowSummary.published
						? 'bg-emerald-100 text-emerald-700'
						: 'bg-amber-100 text-amber-700'}"
				>
					<span
						class="h-2 w-2 rounded-full {tomorrowSummary.published
							? 'bg-emerald-500'
							: 'bg-amber-500'}"
					></span>
					{tomorrowSummary.published ? '공개 완료' : '공개 전'}
				</span>
			</div>
			<div class="mt-3 flex flex-wrap items-end justify-between gap-3">
				<div class="min-w-0 flex-1 space-y-1">
					<div class="flex flex-wrap items-center gap-1.5 text-sm font-black text-slate-900">
						<span>
							{#if tomorrowSummary.totalCount > 0 && tomorrowSummary.savedCount >= tomorrowSummary.totalCount}
								저장 완료
							{:else if tomorrowSummary.savedCount > 0}
								일부 저장
							{:else}
								미저장
							{/if}
							({tomorrowSummary.savedCount}/{tomorrowSummary.totalCount})
						</span>
						<span class="text-slate-300">·</span>
						<span class={tomorrowSummary.confirmed ? 'text-blue-700' : 'text-slate-500'}>
							{tomorrowSummary.confirmed
								? `확정 완료 (${tomorrowSummary.confirmedCount}/${tomorrowSummary.totalCount})`
								: `미확정 (${tomorrowSummary.confirmedCount}/${tomorrowSummary.totalCount})`}
						</span>
					</div>
					<div class="truncate text-xs font-bold text-slate-500">
						{tomorrowSummary.published
							? '공개됨 (기사 열람 가능)'
							: tomorrowSummary.confirmed
								? `공개 대기 (${dispatchSettings.auto_announce_enabled ? `${dispatchSettings.auto_announce_time || '17:00'} 자동 배포` : '지금 공개 가능'})`
								: '명일 배차 확정 후 공개 가능'}
					</div>
				</div>
				{#if tomorrowSummary.published}
					<button
						type="button"
						disabled={announcingNow}
						onclick={handleUnpublishD1}
						class="w-full shrink-0 rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-rose-700 active:scale-95 disabled:opacity-50 sm:w-auto"
					>
						공개 취소
					</button>
				{:else}
					<button
						type="button"
						disabled={announcingNow || !tomorrowSummary.confirmed}
						title={tomorrowSummary.confirmed
							? '확정된 명일 배차를 공개합니다'
							: '명일 배차를 먼저 확정해야 공개할 수 있습니다'}
						onclick={handlePublishTomorrowFromCard}
						class="w-full shrink-0 rounded-xl px-3.5 py-2 text-xs font-black text-white shadow-sm transition active:scale-95 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 sm:w-auto {tomorrowSummary.confirmed
							? 'bg-emerald-600 hover:bg-emerald-700'
							: ''}"
					>
						{tomorrowSummary.confirmed ? '지금 공개' : '확정 필요'}
					</button>
				{/if}
			</div>
		</div>

		<div
			class="col-span-1 flex min-w-0 flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2"
		>
			<div class="flex items-center justify-between gap-2">
				<span class="truncate text-xs font-black text-slate-400 uppercase">Assign Rate</span>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"
				>
					<Icon icon="solar:user-check-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-3">
				<div class="text-2xl font-black text-emerald-600 sm:text-3xl">
					{assignRate}<span class="text-sm font-normal text-slate-500">%</span>
				</div>
				<div class="mt-1 text-xs font-bold text-slate-400">
					기사 배정 ({assignedDriversCount}/{dispatchRows.length || 0})
				</div>
			</div>
		</div>

		<div
			class="col-span-1 flex min-w-0 flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-4 shadow-sm sm:p-5 lg:col-span-2"
		>
			<div class="flex items-center justify-between gap-2">
				<span class="truncate text-xs font-black text-slate-400 uppercase">Standby Drivers</span>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"
				>
					<Icon icon="solar:users-group-rounded-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-3">
				<div class="text-2xl font-black text-amber-600 sm:text-3xl">
					{availableDrivers.length} <span class="text-xs font-normal text-slate-500">명</span>
				</div>
				<div class="mt-1 text-xs font-bold text-slate-400">투입 가능 잔여 인원</div>
			</div>
		</div>
	</div>

	<!-- 3. 탭 네비게이션 (설정 탭은 항상 맨 오른쪽 마지막) -->
	<div class="flex items-center overflow-x-auto border-b-2 border-slate-200">
		<button
			type="button"
			onclick={() => (activeTab = 'canvas')}
			class="flex shrink-0 items-center gap-2 rounded-t-2xl border-b-4 px-5 py-3 text-xs font-black transition {activeTab ===
			'canvas'
				? 'border-blue-600 bg-blue-50/50 text-blue-600'
				: 'border-transparent text-slate-500 hover:text-slate-900'}"
		>
			<Icon icon="solar:clipboard-list-bold-duotone" class="text-base" />
			<span>배차 조율 캔버스</span>
		</button>
		<button
			type="button"
			onclick={() => (activeTab = 'settings')}
			class="ml-auto flex shrink-0 items-center gap-2 rounded-t-2xl border-b-4 px-5 py-3 text-xs font-black transition {activeTab ===
			'settings'
				? 'border-blue-600 bg-blue-50/50 text-blue-600'
				: 'border-transparent text-slate-500 hover:text-slate-900'}"
		>
			<Icon icon="solar:settings-bold-duotone" class="text-base" />
			<span>설정</span>
			{#if !dispatchSettings.preview_enabled}
				<span class="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white"
					>예고정지</span
				>
			{/if}
		</button>
	</div>

	{#if activeTab === 'settings'}
		<DispatchSettingsTab
			settings={dispatchSettings}
			{previewWindow}
			{vehiclesByGroup}
			onSaved={(nextSet, nextWin) => {
				dispatchSettings = nextSet;
				previewWindow = nextWin;
				if (lastSyncedDateKey) {
					refreshDriverStats(lastSyncedDateKey);
				}
			}}
		/>
	{:else}
		<!-- 날짜 전환 컨트롤 바 -->
		<div
			class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4"
		>
			<div class="flex items-center gap-2">
				<button
					type="button"
					class="btn rounded-xl border-slate-200 bg-slate-50 font-black text-slate-700 btn-sm hover:bg-slate-200"
					onclick={() => moveDate(-1)}
				>
					<Icon icon="lucide:chevron-left" class="h-4 w-4" />
					{formatDateDisplay(prevDate)}
				</button>
				<button
					type="button"
					class="btn rounded-xl border-none bg-slate-900 px-4 font-black text-white btn-sm"
					onclick={() => setDate(today)}
				>
					오늘
				</button>
				<button
					type="button"
					class="btn rounded-xl border-slate-200 bg-slate-50 font-black text-slate-700 btn-sm hover:bg-slate-200"
					onclick={() => moveDate(1)}
				>
					{formatDateDisplay(nextDate)}
					<Icon icon="lucide:chevron-right" class="h-4 w-4" />
				</button>
				<span class="ml-2 text-sm font-black text-slate-800">{selectedFullDate}</span>
				<span class="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-black text-indigo-700">
					{getRelativeLabel(selectedDate)}
				</span>
				<button
					type="button"
					class="btn ml-1 rounded-xl border-2 border-slate-200 bg-white px-3.5 font-black text-slate-800 btn-sm hover:bg-slate-50"
					onclick={() => saveDispatch('DRAFT')}
				>
					<Icon icon="solar:diskette-bold" class="h-3.5 w-3.5" />
					<span>저장하기</span>
				</button>
				{#if isDMinus1}
					<button
						type="button"
						class="btn rounded-xl border-none px-3.5 font-black text-white btn-sm {isD1Confirmed ||
						isD1Announced
							? 'bg-rose-600 hover:bg-rose-700'
							: 'bg-blue-600 hover:bg-blue-700'}"
						onclick={() => saveDispatch(isD1Confirmed || isD1Announced ? 'DRAFT' : 'CONFIRMED')}
					>
						<Icon
							icon={isD1Confirmed || isD1Announced
								? 'solar:close-circle-bold'
								: 'solar:check-circle-bold'}
							class="h-3.5 w-3.5"
						/>
						<span>{isD1Confirmed || isD1Announced ? '확정 취소' : '배차 확정'}</span>
					</button>
				{/if}
			</div>

			<div class="flex items-center gap-2">
				<label
					class="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-slate-600"
				>
					<input
						type="checkbox"
						bind:checked={isHideRecommendations}
						class="checkbox checkbox-xs"
					/>
					<span>승계/자동 추천 숨기기</span>
				</label>
			</div>
		</div>

		<!-- 노선 선택 칩 -->
		{#if routes.length > 0}
			<div class="flex scrollbar-none items-center gap-2 overflow-x-auto pb-1">
				<button
					type="button"
					class="flex shrink-0 items-center gap-1.5 rounded-xl border-2 px-4 py-2 text-xs font-extrabold shadow-sm transition-all
                    {selectedRoute?.id === 'ALL'
						? 'border-slate-900 bg-slate-900 text-white'
						: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
					onclick={() => selectRoute({ id: 'ALL', route_name: '전체 노선' })}
				>
					<Icon icon="lucide:layout-grid" class="h-4 w-4" />
					전체 노선
				</button>
				{#each routes as r (r.id)}
					<button
						type="button"
						class="flex shrink-0 items-center gap-1.5 rounded-xl border-2 px-4 py-2 text-xs font-extrabold shadow-sm transition-all
                        {selectedRoute?.id === r.id
							? 'border-slate-900 bg-slate-900 text-white'
							: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
						onclick={() => selectRoute(r)}
					>
						<span
							class="h-1.5 w-1.5 rounded-full {selectedRoute?.id === r.id
								? 'bg-white'
								: 'bg-slate-400'}"
						></span>
						{r.route_name}
					</button>
				{/each}
			</div>
		{/if}

		{#if !selectedRoute}
			<div
				class="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white p-12 shadow-lg"
				transition:fade
			>
				<Icon icon="ph:calendar-x-bold" class="mb-4 text-6xl text-slate-300" />
				<h3 class="mb-1 text-lg font-black text-slate-700">활성화된 노선이 없습니다</h3>
				<p class="text-sm text-slate-400">
					선택하신 날짜({selectedFullDate})에 운행 중인 노선 마스터 도면이 존재하지 않습니다.
				</p>
			</div>
		{:else}
			<main class="w-full min-w-0 space-y-4" transition:fade>
				<div class="mt-2 flex min-w-0 flex-wrap items-start gap-4">
					<DispatchCanvasTable
						{activeRoutesForRender}
						bind:dispatchRows
						{driverPool}
						{otherRouteAssignedDrivers}
						{driverStats}
						settings={dispatchSettings}
						driverAssignColors={dispatchSettings.driver_assign_colors}
						{selectedDriver}
						{isHideRecommendations}
						onAssignToday={assignTodayDriver}
						onAssignTomorrow={assignTomorrowDriver}
					/>
					<DispatchDriverBoard
						{availableDrivers}
						{driverStats}
						settings={dispatchSettings}
						{vehiclesByGroup}
						targetDate={selectedDateKey}
						{selectedDriver}
						onSelectDriver={selectDriver}
					/>
				</div>

				<div
					class="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3"
				>
					<button
						type="button"
						class="btn w-full justify-center sm:w-auto {isAutoFilled
							? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
							: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'} flex items-center gap-1.5 rounded-xl border-2 px-5 font-black shadow-sm transition-all"
						onclick={autoFillDrivers}
					>
						{#if isAutoFilled}
							<Icon icon="ph:x-circle-fill" class="h-4.5 w-4.5" />
							채우기 취소
						{:else}
							<Icon icon="ph:magic-wand-fill" class="h-4.5 w-4.5" />
							자동 채우기
						{/if}
					</button>
					<button
						type="button"
						class="btn w-full justify-center rounded-xl border-2 border-slate-200 bg-white px-5 font-black text-slate-800 hover:bg-slate-50 sm:w-auto"
						onclick={() => saveDispatch('DRAFT')}
					>
						저장하기
					</button>
					{#if isDMinus1}
						<button
							type="button"
							class="btn w-full justify-center rounded-xl border-none px-5 font-black text-white shadow-sm sm:w-auto {isD1Confirmed ||
							isD1Announced
								? 'bg-rose-600 hover:bg-rose-700'
								: 'bg-blue-600 hover:bg-blue-700'}"
							onclick={() => saveDispatch(isD1Confirmed || isD1Announced ? 'DRAFT' : 'CONFIRMED')}
						>
							{isD1Confirmed || isD1Announced ? '확정 취소' : '배차 확정'}
						</button>
						{#if selectedDatePublished}
							<button
								type="button"
								disabled={announcingNow}
								class="btn w-full justify-center rounded-xl border-2 border-rose-200 bg-rose-50 px-5 font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50 sm:w-auto"
								onclick={handleUnpublishD1}
							>
								공개 취소
							</button>
						{:else}
							<button
								type="button"
								disabled={announcingNow}
								class="btn w-full justify-center rounded-xl border-none bg-emerald-600 px-6 font-black text-white shadow-lg hover:bg-emerald-700 disabled:opacity-50 sm:w-auto"
								onclick={handleDeployNowD1}
							>
								{announcingNow ? '공개 중...' : '지금 공개(배포)'}
							</button>
						{/if}
					{/if}
				</div>
			</main>
		{/if}
	{/if}
</div>
