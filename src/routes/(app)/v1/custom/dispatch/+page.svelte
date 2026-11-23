<script lang="ts">
	/**
	 * ============================================================================
	 * [일반 임직원·기사용 배차표 뷰어 (/v1/custom/dispatch/+page.svelte)]
	 * ============================================================================
	 * - 백엔드 설정(/api/v1/custom/dispatch/settings) 기반으로 예고 범위·공개 시각·정지 상태·
	 *   노선-차량 매핑·대인/대차 컬럼 표시를 동적으로 제어합니다.
	 */
	import { onMount, untrack } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import { formatDate } from '$lib/utils';
	import {
		getKstTimeSnapshot,
		parseDateStrAsLocalDate,
		shiftCalendarDateStr
	} from '$lib/utils/serverTime';
	import { formatApiError } from '$lib/utils/error';
	import { customGetActiveRouteMasters, customGetDailyDispatch } from '$lib/api/custom';
	import * as dispatchApi from '$lib/api/dispatch';
	import type {
		DispatchPreviewWindow,
		DispatchRow,
		RouteFleetRule,
		RouteMasterItem
	} from '$lib/api/dispatch';
	import {
		DEFAULT_DISPATCH_SETTINGS,
		fetchDispatchForRoutes
	} from '$lib/services/dispatchAdminService';

	let { data } = $props();

	let routes = $state<RouteMasterItem[]>([]);
	let selectedRoute = $state<RouteMasterItem | null>(null);
	let dispatchRows = $state<DispatchRow[]>([]);
	let isLoading = $state(false);
	let errorMessage = $state('');
	let showLockScreen = $state(false);

	let previewWindow = $state<DispatchPreviewWindow>({
		is_paused: false,
		is_force_open: false,
		open_time: '17:00',
		min_offset: 3,
		max_offset: 7,
		offsets: [3, 4, 5, 6, 7],
		allowed_dates: [],
		reason: '조회 가능 범위: 오늘 기준 +3일 ~ +7일'
	});
	let showSubstituteColumns = $state(true);
	let routeFleetRules = $state<RouteFleetRule[]>(DEFAULT_DISPATCH_SETTINGS.route_fleet_rules);
	let vehiclesByGroup = $state<Record<string, string[]>>({});
	let settingsLoaded = $state(false);

	const initialDateStr = untrack(() => data?.serverTime?.dateStr ?? getKstTimeSnapshot().dateStr);
	let todayStr = $state(initialDateStr);
	const today = $derived(parseDateStrAsLocalDate(todayStr));
	let selectedDate = $state(parseDateStrAsLocalDate(shiftCalendarDateStr(initialDateStr, 3)));

	const formatDateISO = (date: Date) => formatDate(date);
	const formatDateDisplay = (date: Date) =>
		`${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
	const formatFullDate = (date: Date) => {
		const days = ['일', '월', '화', '수', '목', '금', '토'];
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} (${days[date.getDay()]})`;
	};

	const selectedDateKey = $derived(formatDateISO(selectedDate));
	const selectedFullDate = $derived(formatFullDate(selectedDate));

	const allowedOffsets = $derived(previewWindow.offsets || []);
	const minOffset = $derived(previewWindow.min_offset ?? 3);
	const maxOffset = $derived(previewWindow.max_offset ?? 7);
	const currentDiffDays = $derived(
		Math.round((selectedDate.getTime() - today.getTime()) / 86400000)
	);
	const isPrevDisabled = $derived(
		previewWindow.is_paused || allowedOffsets.length === 0 || currentDiffDays <= minOffset
	);
	const isNextDisabled = $derived(
		previewWindow.is_paused || allowedOffsets.length === 0 || currentDiffDays >= maxOffset
	);

	const routesWithDispatches = $derived(
		selectedRoute?.id === 'ALL'
			? routes.map((r) => ({
					route: r,
					rows: dispatchRows.filter((row) => row.route_id === r.id)
				}))
			: selectedRoute
				? [{ route: selectedRoute, rows: dispatchRows }]
				: []
	);

	function setDate(date: Date) {
		selectedDate = new Date(date);
		selectedDate.setHours(0, 0, 0, 0);
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
		return diff > 0 ? `${diff}일 뒤` : `${Math.abs(diff)}일 전`;
	}

	async function loadCustomSettings() {
		try {
			const res = await dispatchApi.customGetDispatchSettings();
			if (res.preview_window) previewWindow = res.preview_window;
			showSubstituteColumns = res.show_substitute_columns ?? true;
			if (Array.isArray(res.route_fleet_rules)) routeFleetRules = res.route_fleet_rules;
			vehiclesByGroup = res.vehicles_by_group || {};
			if (previewWindow.offsets?.length && !previewWindow.offsets.includes(currentDiffDays)) {
				selectedDate = parseDateStrAsLocalDate(
					shiftCalendarDateStr(todayStr, previewWindow.offsets[0])
				);
			}
		} catch {
			// 폴백 기본값 유지
		} finally {
			settingsLoaded = true;
		}
	}

	let fetchToken = 0;
	let lastLoadedRoutesDate = '';

	async function syncData(dateKey: string, forceRouteId: number | 'ALL' | null = null) {
		const token = ++fetchToken;
		isLoading = true;
		errorMessage = '';
		showLockScreen = false;

		if (
			previewWindow.is_paused ||
			previewWindow.offsets.length === 0 ||
			!previewWindow.offsets.includes(currentDiffDays)
		) {
			isLoading = false;
			showLockScreen = true;
			errorMessage = previewWindow.reason || '현재 배차 예고를 조회할 수 없습니다.';
			dispatchRows = [];
			return;
		}

		try {
			if (dateKey !== lastLoadedRoutesDate) {
				const activeRoutes = await customGetActiveRouteMasters(dateKey);
				if (token !== fetchToken) return;
				routes = activeRoutes;
				lastLoadedRoutesDate = dateKey;

				if (activeRoutes.length > 0) {
					if (forceRouteId === 'ALL' || !selectedRoute) {
						selectedRoute = { id: 'ALL', route_name: '전체 노선' };
					} else {
						const found = activeRoutes.find(
							(r: RouteMasterItem) =>
								r.id === selectedRoute?.id || r.route_name === selectedRoute?.route_name
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

			const targetRoutes = selectedRoute.id === 'ALL' ? routes : [selectedRoute];
			const combined = await fetchDispatchForRoutes({
				dateKey,
				targetRoutes,
				vehiclesByGroup,
				routeFleetRules,
				isAdmin: false,
				customFetchFn: (d, id) => customGetDailyDispatch(d, id)
			});
			if (token !== fetchToken) return;
			dispatchRows = combined;
		} catch (err) {
			if (token !== fetchToken) return;
			dispatchRows = [];
			errorMessage = formatApiError(err, '데이터를 로드하는 데 실패했습니다.');
			showLockScreen = true;
		} finally {
			if (token === fetchToken) isLoading = false;
		}
	}

	$effect(() => {
		if (settingsLoaded) {
			void selectedDateKey;
			syncData(selectedDateKey);
		}
	});

	onMount(async () => {
		const liveTodayStr = getKstTimeSnapshot().dateStr;
		if (liveTodayStr !== todayStr) todayStr = liveTodayStr;
		await loadCustomSettings();
		await syncData(selectedDateKey);
	});
</script>

<div class="min-h-screen bg-slate-100 pb-6 text-slate-900">
	<header
		class="sticky top-0 z-40 border-b border-slate-200 bg-white/95 px-2 py-1.5 shadow-sm sm:px-4"
	>
		<div class="mx-auto flex max-w-7xl items-center justify-between gap-2">
			<div class="min-w-0">
				<div class="flex items-center gap-1.5">
					<span class="rounded-md bg-slate-900 p-1 text-white">
						<Icon icon="lucide:calendar-range" class="h-3.5 w-3.5" />
					</span>
					<h1 class="truncate text-sm font-extrabold tracking-tight text-slate-800 sm:text-base">
						배차표 뷰어
					</h1>
				</div>
			</div>

			<div class="flex shrink-0 items-center gap-0.5 rounded-lg bg-slate-200/70 p-0.5">
				<button
					type="button"
					class="rounded-md bg-white p-1 text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
					onclick={() => moveDate(-1)}
					disabled={isPrevDisabled}
					aria-label="이전 날짜"
				>
					<Icon icon="lucide:chevron-left" class="h-3.5 w-3.5" />
				</button>
				<div class="min-w-[96px] px-2 py-0 text-center">
					<div class="text-[11px] leading-tight font-black text-slate-800">{selectedFullDate}</div>
					<div class="text-[9px] leading-none font-black text-indigo-600 uppercase">
						{getRelativeLabel(selectedDate)}
					</div>
				</div>
				<button
					type="button"
					class="rounded-md bg-white p-1 text-slate-700 shadow-sm transition-all hover:bg-slate-50 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
					onclick={() => moveDate(1)}
					disabled={isNextDisabled}
					aria-label="다음 날짜"
				>
					<Icon icon="lucide:chevron-right" class="h-3.5 w-3.5" />
				</button>
			</div>
		</div>
	</header>

	<main class="mx-auto mt-1.5 max-w-7xl px-1 sm:px-3">
		{#if !previewWindow.is_paused && allowedOffsets.length > 0}
			<div class="flex scrollbar-none items-center gap-1 overflow-x-auto pb-1">
				{#each allowedOffsets as offset (offset)}
					{@const targetDate = parseDateStrAsLocalDate(shiftCalendarDateStr(todayStr, offset))}
					{@const active = formatDateISO(selectedDate) === formatDateISO(targetDate)}
					<button
						type="button"
						class="shrink-0 rounded-md border px-2.5 py-1 text-[10.5px] font-extrabold transition-all active:scale-95
						{active
							? 'border-indigo-600 bg-indigo-600 text-white'
							: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}"
						onclick={() => setDate(targetDate)}
					>
						+{offset}일 ({formatDateDisplay(targetDate)})
					</button>
				{/each}
			</div>
		{/if}

		{#if routes.length > 0 && !showLockScreen}
			<div class="flex scrollbar-none items-center gap-1 overflow-x-auto pb-1.5" in:fade>
				<button
					type="button"
					class="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold transition-all
                    {selectedRoute?.id === 'ALL'
						? 'border-indigo-600 bg-indigo-600 text-white'
						: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
					onclick={() => syncData(selectedDateKey, 'ALL')}
				>
					<Icon icon="lucide:layout-grid" class="h-3 w-3" />
					전체
				</button>
				{#each routes as r (r.id)}
					<button
						type="button"
						class="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold transition-all
                        {selectedRoute?.id === r.id
							? 'border-indigo-600 bg-indigo-600 text-white'
							: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
						onclick={() => syncData(selectedDateKey, r.id)}
					>
						<span
							class="h-1.5 w-1.5 rounded-full {selectedRoute?.id === r.id
								? 'bg-white'
								: 'bg-slate-300'}"
						></span>
						{r.route_name}
					</button>
				{/each}
			</div>
		{/if}

		{#if isLoading}
			<div class="flex flex-col items-center justify-center py-24" in:fade>
				<div
					class="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"
				></div>
				<p class="mt-4 text-xs font-bold text-slate-500">배차표를 불러오는 중입니다...</p>
			</div>
		{:else if showLockScreen}
			<div
				class="mx-auto mt-6 max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg"
				in:scale={{ duration: 250 }}
			>
				<div
					class="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-indigo-600"
				>
					<Icon icon="lucide:lock" class="h-8 w-8 animate-bounce" />
				</div>
				<h2 class="mb-1 text-base font-black text-slate-800">
					{previewWindow.is_paused ? '배차 예고 일시 정지' : '배차표 비공개 대상일'}
				</h2>
				<p class="mx-auto mb-4 max-w-sm text-xs leading-relaxed text-slate-500">{errorMessage}</p>
				{#if previewWindow.reason}
					<div
						class="inline-block rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-bold text-slate-600"
					>
						{previewWindow.reason}
					</div>
				{/if}
			</div>
		{:else if routes.length === 0}
			<div
				class="mx-auto mt-6 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
				in:fade
			>
				<Icon icon="lucide:calendar-range" class="mx-auto mb-3 h-7 w-7 text-slate-400" />
				<h3 class="mb-0.5 text-sm font-bold text-slate-700">계획된 운행 노선 없음</h3>
				<p class="text-[11px] text-slate-400">
					선택된 날짜({selectedDateKey})의 활성화된 노선 정보를 찾을 수 없습니다.
				</p>
			</div>
		{:else}
			<div class="mt-0.5" in:fade>
				{#each routesWithDispatches as item (item.route.id)}
					{#if item.rows.length > 0}
						<div class="mb-2.5">
							<div class="mb-1 flex items-center justify-between px-0.5">
								<h2
									class="flex items-center gap-1 text-xs font-extrabold text-slate-800 sm:text-sm"
								>
									<span class="inline-block h-3.5 w-2 rounded-xs bg-indigo-600"></span>
									{item.route.route_name} 배차표
								</h2>
								<span
									class="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600"
								>
									{item.rows.length}개 로번
								</span>
							</div>

							<div class="w-full overflow-x-auto rounded-lg border border-slate-900 bg-white">
								<table class="excel-table w-full border-collapse text-center">
									<thead>
										<tr
											class="border-b border-slate-200 bg-slate-100 font-extrabold text-slate-600 uppercase"
										>
											<th
												class={showSubstituteColumns ? 'w-[13%] md:w-[10%]' : 'w-[15%] md:w-[11%]'}
												>차량</th
											>
											<th class={showSubstituteColumns ? 'w-[9%] md:w-[7%]' : 'w-[10%] md:w-[8%]'}
												>로번</th
											>
											<th
												class={showSubstituteColumns ? 'w-[14%] md:w-[12%]' : 'w-[16%] md:w-[14%]'}
												>출발/종료</th
											>
											<th
												class={showSubstituteColumns ? 'w-[21%] md:w-[23%]' : 'w-[25%] md:w-[27%]'}
												>시작/종료 위치</th
											>
											<th
												class={showSubstituteColumns ? 'w-[15%] md:w-[14%]' : 'w-[18%] md:w-[17%]'}
												style="background-color: #ecfdf5; color: #047857;">기사</th
											>
											{#if showSubstituteColumns}
												<th class="w-[8%] md:w-[9%]">대인</th>
												<th class="w-[8%] md:w-[9%]">대차</th>
											{/if}
											<th
												class={showSubstituteColumns ? 'w-[12%] md:w-[16%]' : 'w-[16%] md:w-[23%]'}
												>상태/비고</th
											>
										</tr>
									</thead>
									<tbody class="divide-y divide-slate-200">
										{#each item.rows as row (`${item.route.id}-${row.timetable_id}`)}
											<tr
												class="transition-all hover:bg-indigo-50/20 {row.is_regular_duty
													? 'bg-indigo-50/10'
													: ''}"
											>
												<td
													class="important-cell bg-blue-50/10 font-black {row.is_inherited
														? 'text-indigo-700 italic'
														: 'text-blue-700'}"
												>
													{row.vehicle_no || '-'}
												</td>
												<td
													class="important-cell turn-cell relative bg-amber-50/20 font-black text-amber-900"
												>
													{row.seq}
													{#if row.is_regular_duty}
														<div
															class="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-indigo-600"
															title="당연 근무"
														></div>
													{/if}
												</td>
												<td class="stacked-cell bg-blue-50/20">
													<div class="leading-tight font-bold text-blue-700">
														{row.start_time || '-'}
													</div>
													<div class="leading-tight font-semibold text-slate-500">
														{row.end_time || '-'}
													</div>
												</td>
												<td
													class="stacked-cell bg-slate-50/40"
													title={`${row.start_location || ''} → ${row.end_location || ''}`}
												>
													<div class="truncate leading-tight font-semibold text-slate-700">
														{row.start_location || '-'}
													</div>
													<div class="truncate leading-tight font-medium text-slate-500">
														{row.end_location || '-'}
													</div>
												</td>
												<td
													class="important-cell relative font-black {row.driver_name
														? row.is_inherited
															? 'bg-indigo-50/80 text-indigo-700 italic'
															: 'bg-emerald-50 text-emerald-700'
														: 'bg-emerald-50/20 text-slate-300 italic'}"
												>
													<span class="block truncate">{row.driver_name || '미지정'}</span>
													{#if row.is_inherited && row.driver_name}
														<span
															class="absolute top-[1px] right-0.5 text-[9px] leading-none font-extrabold tracking-tighter text-indigo-500"
															>승계</span
														>
													{/if}
												</td>
												{#if showSubstituteColumns}
													<td class="bg-white"></td>
													<td class="bg-white"></td>
												{/if}
												<td class="stacked-cell status-cell" title={row.memo || ''}>
													<div>
														{#if row.status === 'CONFIRMED'}
															<span
																class="inline-flex items-center justify-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] leading-none font-black text-emerald-700 sm:text-xs"
																>확정</span
															>
														{:else if row.status === 'ANNOUNCED'}
															<span
																class="inline-flex items-center justify-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] leading-none font-black text-blue-700 sm:text-xs"
																>공지</span
															>
														{:else}
															<span
																class="inline-flex items-center justify-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] leading-none font-black text-slate-600 sm:text-xs"
																>임시</span
															>
														{/if}
													</div>
													<div class="truncate leading-tight font-medium text-slate-500">
														{row.memo || '-'}
													</div>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					{/if}
				{/each}
			</div>
		{/if}
	</main>
</div>

<style>
	.excel-table {
		border-collapse: collapse;
		width: 100%;
		table-layout: fixed;
	}
	.excel-table th,
	.excel-table td {
		box-sizing: border-box;
		border: 1px solid #cbd5e1;
		padding: 0 1px !important;
		text-align: center;
		overflow: hidden;
		text-overflow: ellipsis;
		vertical-align: middle;
	}
	.excel-table th {
		background-color: #f8fafc;
		font-weight: 800;
		color: #64748b;
		text-transform: uppercase;
		padding: 2px 1px !important;
		font-size: 11px;
		line-height: 1.05;
		letter-spacing: -0.03em;
	}
	.excel-table td.important-cell {
		font-size: 14px;
		line-height: 1.05;
		letter-spacing: -0.03em;
		white-space: nowrap;
	}
	.excel-table td.turn-cell {
		font-size: 15.5px;
	}
	.excel-table td.stacked-cell {
		font-size: 12px;
		line-height: 1.05;
		letter-spacing: -0.03em;
	}
	@media (min-width: 768px) {
		.excel-table th {
			font-size: 13px;
			padding: 3px 3px !important;
		}
		.excel-table td {
			padding: 1px 3px !important;
		}
		.excel-table td.important-cell {
			font-size: 16px;
		}
		.excel-table td.turn-cell {
			font-size: 17px;
		}
		.excel-table td.stacked-cell {
			font-size: 13.5px;
		}
	}
	.scrollbar-none::-webkit-scrollbar {
		display: none;
	}
	.scrollbar-none {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
