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
		buildClassifiedDriverBoard,
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
	const todayDateKey = formatDateISO(today);
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
	const isPreviewWaitingOpen = $derived(
		dispatchSettings.preview_enabled &&
			!dispatchSettings.preview_force_open &&
			Boolean(previewWindow && previewWindow.offsets.length === 0)
	);
	const isPreviewDatePublic = $derived(
		Boolean(
			dispatchSettings.preview_enabled &&
			previewWindow &&
			!previewWindow.is_paused &&
			previewWindow.allowed_dates?.includes(selectedDateKey)
		)
	);
	const isPastDate = $derived(selectedDateKey < todayDateKey);
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
		!isD1Announced &&
			!isD1PartialAnnounced &&
			statusCounts.total > 0 &&
			statusCounts.confirmed === statusCounts.total
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
	const driverBoardSummary = $derived.by(() => {
		const classified = buildClassifiedDriverBoard({
			availableDrivers,
			driverStats,
			settings: dispatchSettings
		});
		const reserveCount = classified.reserve.length;
		const fixedCount = classified.fixed.length;
		const dayoffCount = classified.dayoff.length;
		const sickDisciplineCount = classified.sickDiscipline.length;
		const boardTotal = reserveCount + fixedCount + dayoffCount + sickDisciplineCount;
		const assignedInPool = driverPool.filter((d) =>
			assignedDrivers.includes(String(d.name || '').trim())
		).length;
		const missingDrivers = Math.max(0, driverPool.length - (assignedInPool + boardTotal));
		const unassignedSlots = Math.max(0, dispatchRows.length - assignedDriversCount);
		return {
			totalDrivers: driverPool.length,
			assignedInPool,
			boardTotal,
			reserveCount,
			fixedCount,
			dayoffCount,
			sickDisciplineCount,
			missingDrivers,
			unassignedSlots
		};
	});

	function selectDriver(driver: DriverResource) {
		if (isPastDate) {
			toast.warning('과거 날짜(어제 이전)의 배차는 수정할 수 없습니다.');
			return;
		}
		selectedDriver = selectedDriver?.name === driver.name ? null : driver;
	}

	function assignTodayDriver(row: DispatchRow) {
		if (isPastDate) return;
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
		if (isPastDate) return;
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
		if (isPastDate) {
			toast.warning('과거 날짜(어제 이전)의 배차는 수정할 수 없습니다.');
			return;
		}
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
					wasPublished: Boolean(tmrSource.was_published),
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
		opts?: { silent?: boolean; toastMessage?: string }
	) {
		if (isPastDate) {
			toast.warning('과거 날짜(어제 이전)의 배차 데이터는 수정·저장할 수 없습니다.');
			return;
		}
		if ((status === 'CONFIRMED' || status === 'ANNOUNCED') && !isDMinus1) {
			toast.warning('배차 확정 및 공개는 운행 전날(D-1, 내일 배차)에만 수행할 수 있습니다.');
			return;
		}
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
				if (opts?.toastMessage) {
					toast.success(opts.toastMessage);
				} else if (status === 'ANNOUNCED') {
					toast.success('명일 배차가 즉시 배포되었습니다.');
				} else if (status === 'CONFIRMED') {
					toast.success(
						tomorrowSummary.wasPublished
							? "명일 배차가 확정되었습니다. '재공개' 버튼을 눌러 수동으로 재공개해 주세요."
							: dispatchSettings.auto_announce_enabled
								? `명일 배차가 확정되었습니다. (${dispatchSettings.auto_announce_time || '17:00'} 최초 1회 자동 공개 또는 수동 공개)`
								: '명일 배차가 확정되었습니다.'
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
	const d1ConfirmButton = $derived.by(() => {
		if (selectedDatePublished) {
			return {
				disabled: true,
				label: '공개 중',
				icon: 'solar:lock-bold',
				title: '공개 중일 때는 먼저 공개 취소를 눌러 주세요',
				colorClass:
					'cursor-not-allowed bg-slate-200 text-slate-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500'
			};
		}
		if (isD1Confirmed) {
			return {
				disabled: false,
				label: '확정 취소',
				icon: 'solar:close-circle-bold',
				title: '명일 배차 확정을 취소하고 저장 상태로 되돌립니다',
				colorClass: 'bg-rose-600 text-white hover:bg-rose-700'
			};
		}
		return {
			disabled: false,
			label: '배차 확정',
			icon: 'solar:check-circle-bold',
			title: '명일 배차를 확정합니다',
			colorClass: 'bg-blue-600 text-white hover:bg-blue-700'
		};
	});

	function resolvePreservedSaveStatus(): 'DRAFT' | 'CONFIRMED' | 'ANNOUNCED' {
		if (!isDMinus1) return 'DRAFT';
		if (selectedDatePublished || isD1Announced || isD1PartialAnnounced) return 'ANNOUNCED';
		if (isD1Confirmed) return 'CONFIRMED';
		return 'DRAFT';
	}

	function handleSaveDispatch() {
		saveDispatch(resolvePreservedSaveStatus(), {
			toastMessage: '배차 정보가 저장되었습니다.'
		});
	}

	function handleToggleD1Confirm() {
		if (!isDMinus1 || selectedDatePublished) return;
		saveDispatch(isD1Confirmed ? 'DRAFT' : 'CONFIRMED');
	}
	let tomorrowSummary = $state<{
		published: boolean;
		wasPublished: boolean;
		confirmed: boolean;
		confirmedCount: number;
		savedCount: number;
		totalCount: number;
	}>({
		published: false,
		wasPublished: false,
		confirmed: false,
		confirmedCount: 0,
		savedCount: 0,
		totalCount: 0
	});
	let announcingNow = $state(false);
	async function handlePublishTomorrowFromCard() {
		if (announcingNow || !tomorrowSummary.confirmed) return;
		const confirmMsg = tomorrowSummary.wasPublished
			? '확정된 명일(D-1) 배차를 변경 재공지(재배포)하고 재공지 알림·푸시를 발송할까요?'
			: '확정된 명일(D-1) 배차를 공개(배포)하고 알림·푸시를 발송할까요?';
		if (!confirm(confirmMsg)) {
			return;
		}
		announcingNow = true;
		try {
			const res = await dispatchApi.adminAnnounceDispatchNow();
			if (isDMinus1) selectedDatePublished = true;
			toast.success(
				res.message ||
					(res.is_reannounce
						? '명일 배차가 변경 재공지(재배포)되었습니다.'
						: '명일 배차가 공개(배포)되었습니다.')
			);
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
				wasPublished: true,
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

{#snippet d1ConfirmToggle(compact: boolean)}
	<span
		class={compact ? 'inline-flex shrink-0' : 'inline-flex w-full shrink-0 sm:w-auto'}
		title={d1ConfirmButton.title}
	>
		<button
			type="button"
			disabled={d1ConfirmButton.disabled}
			class="btn shrink-0 gap-1.5 whitespace-nowrap rounded-xl border-2 border-transparent font-black transition-all {compact
				? 'px-3.5 btn-sm'
				: 'h-11 min-h-11 w-full justify-center px-5 text-sm shadow-sm sm:w-auto'} {d1ConfirmButton.colorClass}"
			onclick={handleToggleD1Confirm}
		>
			<Icon
				icon={d1ConfirmButton.icon}
				class={compact ? 'h-3.5 w-3.5 shrink-0' : 'h-4 w-4 shrink-0'}
			/>
			<span>{d1ConfirmButton.label}</span>
		</button>
	</span>
{/snippet}

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
			class="col-span-2 flex min-w-0 flex-col justify-between rounded-[1.75rem] border-2 p-4 shadow-sm sm:col-span-1 sm:p-5 lg:col-span-4 {!dispatchSettings.preview_enabled
				? 'border-rose-200 bg-rose-50/40'
				: isPreviewWaitingOpen
					? 'border-amber-200 bg-amber-50/40'
					: 'border-emerald-200 bg-emerald-50/40'}"
		>
			<div class="flex items-center justify-between gap-2">
				<span class="truncate text-xs font-black text-slate-500 uppercase">배차 예고 상태</span>
				<span
					class="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-black {!dispatchSettings.preview_enabled
						? 'bg-rose-100 text-rose-700'
						: isPreviewWaitingOpen
							? 'bg-amber-100 text-amber-800'
							: 'bg-emerald-100 text-emerald-700'}"
				>
					<span
						class="h-2 w-2 rounded-full {!dispatchSettings.preview_enabled
							? 'bg-rose-500'
							: isPreviewWaitingOpen
								? 'bg-amber-500'
								: 'bg-emerald-500'}"
					></span>
					{!dispatchSettings.preview_enabled
						? '중지 중'
						: isPreviewWaitingOpen
							? '공개 대기'
							: '공개 중'}
				</span>
			</div>
			<div class="mt-3 flex flex-wrap items-end justify-between gap-3">
				<div class="min-w-0 flex-1">
					<div
						class="truncate text-xl font-black sm:text-2xl {!dispatchSettings.preview_enabled
							? 'text-rose-700'
							: isPreviewWaitingOpen
								? 'text-amber-700'
								: 'text-emerald-700'}"
					>
						{!dispatchSettings.preview_enabled
							? '배차 예고 중지 중'
							: isPreviewWaitingOpen
								? `${dispatchSettings.preview_open_time} 공개 예정`
								: '배차 예고 중'}
					</div>
					<div class="mt-1 truncate text-xs font-bold text-slate-500">
						노출 구간: +{dispatchSettings.preview_start_offset ??
							3}~+{(dispatchSettings.preview_start_offset ?? 3) +
							(dispatchSettings.preview_days ?? 5) -
							1}일 · {dispatchSettings.preview_force_open
							? '즉시 예고'
							: `매일 ${dispatchSettings.preview_open_time} 공개`}
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
								? tomorrowSummary.wasPublished
									? "재공개 대기 (수동 '재공개' 버튼으로만 처리)"
									: `공개 대기 (${dispatchSettings.auto_announce_enabled ? `${dispatchSettings.auto_announce_time || '17:00'} 자동 공개` : '지금 공개 가능'})`
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
						{tomorrowSummary.confirmed
							? tomorrowSummary.wasPublished
								? '재공개'
								: '지금 공개'
							: '확정 필요'}
					</button>
				{/if}
			</div>
		</div>

		<!-- 카드 3: 운전원 요약 (투입기사 등록 보드 집계 · 누락 인원 확인용) -->
		<div
			class="col-span-2 flex min-w-0 flex-col justify-between rounded-[1.75rem] border-2 p-4 shadow-sm sm:p-5 lg:col-span-4 {driverBoardSummary.missingDrivers > 0
				? 'border-rose-300 bg-rose-50/30'
				: driverBoardSummary.unassignedSlots > 0
					? 'border-amber-200 bg-white'
					: 'border-emerald-200 bg-white'}"
		>
			<div class="flex items-center justify-between gap-2">
				<span class="truncate text-xs font-black text-slate-500">
					운전원 요약 ({selectedDateKey})
				</span>
				{#if driverBoardSummary.missingDrivers > 0}
					<span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-black text-rose-700">
						<Icon icon="solar:danger-triangle-bold" class="text-xs" />
						누락 {driverBoardSummary.missingDrivers}명
					</span>
				{:else if driverBoardSummary.unassignedSlots > 0}
					<span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-700">
						미배정 {driverBoardSummary.unassignedSlots}회차
					</span>
				{:else}
					<span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-700">
						<span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
						누락 없음 ({assignRate}%)
					</span>
				{/if}
			</div>

			<div class="mt-2.5 grid grid-cols-4 gap-1.5">
				<div class="rounded-xl border border-sky-200 bg-sky-50/70 px-2 py-1.5 text-center">
					<div class="text-[10px] font-black text-sky-700 truncate">휴무 예비</div>
					<div class="text-base font-black text-sky-900">{driverBoardSummary.reserveCount}</div>
				</div>
				<div class="rounded-xl border border-slate-200 bg-slate-50 px-2 py-1.5 text-center">
					<div class="text-[10px] font-black text-slate-600 truncate">휴무 고정</div>
					<div class="text-base font-black text-slate-800">{driverBoardSummary.fixedCount}</div>
				</div>
				<div class="rounded-xl border border-amber-200 bg-amber-50/70 px-2 py-1.5 text-center">
					<div class="text-[10px] font-black text-amber-700 truncate">결근계</div>
					<div class="text-base font-black text-amber-900">{driverBoardSummary.dayoffCount}</div>
				</div>
				<div class="rounded-xl border border-rose-200 bg-rose-50/70 px-2 py-1.5 text-center">
					<div class="text-[10px] font-black text-rose-700 truncate">병가·징계</div>
					<div class="text-base font-black text-rose-900">{driverBoardSummary.sickDisciplineCount}</div>
				</div>
			</div>

			<div class="mt-2 flex flex-wrap items-center justify-between gap-1 text-[11px] font-bold text-slate-500">
				<span>
					전체 <strong class="text-slate-900">{driverBoardSummary.totalDrivers}</strong>명
					= 투입 <strong class="text-emerald-700">{driverBoardSummary.assignedInPool}</strong>
					+ 보드 <strong class="text-blue-700">{driverBoardSummary.boardTotal}</strong>
				</span>
				<span class="font-mono text-[10px] text-slate-400">
					배정 {assignedDriversCount}/{dispatchRows.length || 0}
				</span>
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
			<div class="flex min-w-0 flex-wrap items-center gap-2">
				<button
					type="button"
					class="btn shrink-0 whitespace-nowrap rounded-xl border-slate-200 bg-slate-50 font-black text-slate-700 btn-sm hover:bg-slate-200"
					onclick={() => moveDate(-1)}
				>
					<Icon icon="lucide:chevron-left" class="h-4 w-4" />
					{formatDateDisplay(prevDate)}
				</button>
				<button
					type="button"
					class="btn shrink-0 whitespace-nowrap rounded-xl border-none bg-slate-900 px-4 font-black text-white btn-sm"
					onclick={() => setDate(today)}
				>
					오늘
				</button>
				<button
					type="button"
					class="btn shrink-0 whitespace-nowrap rounded-xl border-slate-200 bg-slate-50 font-black text-slate-700 btn-sm hover:bg-slate-200"
					onclick={() => moveDate(1)}
				>
					{formatDateDisplay(nextDate)}
					<Icon icon="lucide:chevron-right" class="h-4 w-4" />
				</button>
				<div class="flex items-center gap-1.5 sm:ml-1">
					<span class="whitespace-nowrap text-sm font-black text-slate-800">{selectedFullDate}</span>
					<span
						class="shrink-0 whitespace-nowrap rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-black text-indigo-700"
					>
						{getRelativeLabel(selectedDate)}
					</span>
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2 sm:gap-3">
				<div class="flex flex-wrap items-center gap-2">
					{#if isPastDate}
						<span
							class="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-800"
							title="어제 이전의 과거 배차 이력은 수정할 수 없습니다"
						>
							<Icon icon="solar:lock-bold" class="h-3.5 w-3.5 shrink-0" />
							<span>과거 이력 · 수정 불가</span>
						</span>
					{:else}
						<button
							type="button"
							class="btn shrink-0 whitespace-nowrap rounded-xl border-2 border-slate-200 bg-white px-3.5 font-black text-slate-800 btn-sm hover:bg-slate-50"
							onclick={handleSaveDispatch}
						>
							<Icon icon="solar:diskette-bold" class="h-3.5 w-3.5 shrink-0" />
							<span>저장하기</span>
						</button>
					{/if}
					{#if isDMinus1}
						{@render d1ConfirmToggle(true)}
					{/if}
				</div>
				<label
					class="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap text-xs font-bold text-slate-600"
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
						readOnly={isPastDate}
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

				<div class="mt-6 space-y-2">
					<div
						class="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-3"
					>
						{#if isPastDate}
							<span
								class="inline-flex h-11 min-h-11 items-center justify-center gap-1.5 rounded-xl border-2 border-amber-200 bg-amber-50 px-5 text-sm font-black text-amber-800"
							>
								<Icon icon="solar:lock-bold" class="h-4 w-4 shrink-0" />
								<span>과거 배차 이력 (읽기 전용 · 수정 불가)</span>
							</span>
						{:else}
							<button
								type="button"
								class="btn h-11 min-h-11 w-full shrink-0 justify-center gap-1.5 whitespace-nowrap rounded-xl border-2 px-5 text-sm font-black shadow-sm transition-all sm:w-auto {isAutoFilled
									? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
									: 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}"
								onclick={autoFillDrivers}
							>
								{#if isAutoFilled}
									<Icon icon="ph:x-circle-fill" class="h-4 w-4 shrink-0" />
									<span>채우기 취소</span>
								{:else}
									<Icon icon="ph:magic-wand-fill" class="h-4 w-4 shrink-0" />
									<span>자동 채우기</span>
								{/if}
							</button>
							<button
								type="button"
								class="btn h-11 min-h-11 w-full shrink-0 justify-center gap-1.5 whitespace-nowrap rounded-xl border-2 border-slate-200 bg-white px-5 text-sm font-black text-slate-800 shadow-sm transition-all hover:bg-slate-50 sm:w-auto"
								onclick={handleSaveDispatch}
							>
								<Icon icon="solar:diskette-bold" class="h-4 w-4 shrink-0" />
								<span>저장하기</span>
							</button>
						{/if}
						{#if isDMinus1}
							{@render d1ConfirmToggle(false)}
							{#if selectedDatePublished}
								<button
									type="button"
									disabled={announcingNow}
									class="btn h-11 min-h-11 w-full shrink-0 justify-center gap-1.5 whitespace-nowrap rounded-xl border-2 border-rose-200 bg-rose-50 px-5 text-sm font-black text-rose-700 shadow-sm transition-all hover:bg-rose-100 disabled:opacity-50 sm:w-auto"
									onclick={handleUnpublishD1}
								>
									<Icon icon="lucide:eye-off" class="h-4 w-4 shrink-0" />
									<span>공개 취소</span>
								</button>
							{:else}
								<button
									type="button"
									disabled={announcingNow || !tomorrowSummary.confirmed}
									title={tomorrowSummary.confirmed
										? tomorrowSummary.wasPublished
											? '확정된 명일 배차를 재배포합니다'
											: '확정된 명일 배차를 최초 배포합니다'
										: '모든 노선의 명일 배차를 먼저 확정해야 배포할 수 있습니다'}
									class="btn h-11 min-h-11 w-full shrink-0 justify-center gap-1.5 whitespace-nowrap rounded-xl border-2 border-transparent bg-emerald-600 px-5 text-sm font-black text-white shadow-sm transition-all hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 sm:w-auto"
									onclick={handlePublishTomorrowFromCard}
								>
									<Icon icon="lucide:send" class="h-4 w-4 shrink-0" />
									<span>
										{announcingNow
											? '배포 중...'
											: !tomorrowSummary.confirmed
												? '확정 필요'
												: tomorrowSummary.wasPublished
													? '재배포'
													: '지금 배포'}
									</span>
								</button>
							{/if}
						{/if}
					</div>
					{#if isDMinus1 && selectedDatePublished}
						<p class="text-right text-xs font-semibold text-slate-500">
							공개 중에는 먼저 공개 취소를 눌러 주세요.
						</p>
					{/if}
				</div>
			</main>
		{/if}
	{/if}
</div>
