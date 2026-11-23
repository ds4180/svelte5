<script>
	/**
	 * @file src/routes/(app)/v1/custom/dispatch/+page.svelte
	 * @description 일반 임직원 및 기사용 전용 엑셀 격자형(Excel-Density Table) 배차 통합 뷰어
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
	import fleetData from '$lib/data/vehicles.json';

	/** @param {string} routeName */
	function getTargetFleet(routeName = '') {
		if (routeName.includes('121') || routeName.includes('122')) {
			return fleetData.vehicles['121/122'] || [];
		}
		if (routeName.includes('291') || routeName.includes('292') || routeName.includes('293')) {
			return fleetData.vehicles['291/292/293'] || [];
		}
		return [...(fleetData.vehicles['121/122'] || []), ...(fleetData.vehicles['291/292/293'] || [])];
	}

	let { data } = $props();

	let routes = $state([]); // 활성 노선 목록
	let selectedRoute = $state(null); // 선택된 노선 (기본값: 전체 노선)
	let dispatchRows = $state([]); // 최종 화면에 보여줄 배차 로우들
	let isLoading = $state(false);
	let errorMessage = $state('');
	let showLockScreen = $state(false);

	// --- 날짜 관리 로직 (SSR <-> CSR 하이드레이션 일관성 보장) ---
	const initialDateStr = untrack(() => data?.serverTime?.dateStr ?? getKstTimeSnapshot().dateStr);
	let todayStr = $state(initialDateStr);
	let today = $derived(parseDateStrAsLocalDate(todayStr));
	let selectedDate = $state(parseDateStrAsLocalDate(shiftCalendarDateStr(initialDateStr, 3)));

	const formatDateISO = (date) => formatDate(date);

	const formatDateDisplay = (date) => {
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		return `${m}.${d}`;
	};

	const formatFullDate = (date) => {
		const days = ['일', '월', '화', '수', '목', '금', '토'];
		const y = date.getFullYear();
		const m = String(date.getMonth() + 1).padStart(2, '0');
		const d = String(date.getDate()).padStart(2, '0');
		const day = days[date.getDay()];
		return `${y}-${m}-${d} (${day})`;
	};

	let selectedDateKey = $derived(formatDateISO(selectedDate));
	let selectedFullDate = $derived(formatFullDate(selectedDate));

	// 🔒 보안 타임라인 범위 바인딩 및 이전/다음 차단
	let isPrevDisabled = $derived(
		Math.round((selectedDate.getTime() - today.getTime()) / 86400000) <= 3
	);
	let isNextDisabled = $derived(
		Math.round((selectedDate.getTime() - today.getTime()) / 86400000) >= 7
	);

	// 노선별 분할 데이터를 위한 반응형 바인딩
	let routesWithDispatches = $derived(
		selectedRoute?.id === 'ALL'
			? routes.map((r) => ({
					route: r,
					rows: dispatchRows.filter((row) => row.route_id === r.id)
				}))
			: selectedRoute
				? [{ route: selectedRoute, rows: dispatchRows }]
				: []
	);

	function setDate(date) {
		selectedDate = new Date(date);
		selectedDate.setHours(0, 0, 0, 0);
	}

	function moveDate(offset) {
		const newDate = new Date(selectedDate);
		newDate.setDate(selectedDate.getDate() + offset);
		setDate(newDate);
	}

	function getRelativeLabel(targetDate) {
		const diff = Math.round((targetDate.getTime() - today.getTime()) / 86400000);
		if (diff === 0) return '오늘';
		if (diff === 1) return '내일';
		if (diff === 2) return '모레';
		if (diff === -1) return '어제';
		return diff > 0 ? `${diff}일 뒤` : `${Math.abs(diff)}일 전`;
	}

	// --- API 연동 & 동기화 (전체 노선 병렬 수집 탑재) ---
	let fetchToken = 0;
	let lastLoadedRoutesDate = '';

	async function syncData(dateKey, forceRouteId = null) {
		const token = ++fetchToken;
		isLoading = true;
		errorMessage = '';
		showLockScreen = false;

		// 🔒 프론트엔드단에서 사전에 타임라인 비공개 대상일 선제적 필터링
		const diffDays = Math.round((selectedDate.getTime() - today.getTime()) / 86400000);
		if (diffDays < 3 || diffDays > 7) {
			isLoading = false;
			showLockScreen = true;
			errorMessage = '배차 비공개 대상일입니다. (조회 가능 범위: 오늘 기준 +3일 ~ +7일)';
			dispatchRows = [];
			return;
		}

		try {
			// 1. 날짜 변경 시 활성 노선 신규 수집
			if (dateKey !== lastLoadedRoutesDate) {
				const activeRoutes = await customGetActiveRouteMasters(dateKey);
				if (token !== fetchToken) return;

				routes = activeRoutes;
				lastLoadedRoutesDate = dateKey;

				// 전체 노선 모드 탑재를 위해 selectedRoute를 'ALL' 구조로 초기 설정
				if (activeRoutes.length > 0) {
					if (forceRouteId === 'ALL' || !selectedRoute) {
						selectedRoute = { id: 'ALL', route_name: '전체 노선' };
					} else {
						const found = activeRoutes.find(
							(r) => r.id === selectedRoute.id || r.route_name === selectedRoute.route_name
						);
						selectedRoute = found ? found : { id: 'ALL', route_name: '전체 노선' };
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

			// 2. 배차 데이터 가공 및 수집 분기
			if (selectedRoute) {
				if (selectedRoute.id === 'ALL') {
					// 🌟 [통합 뷰어] 날짜 내 모든 활성 노선의 배차 데이터를 병렬 비동기 수집
					const fetchPromises = routes.map(async (r) => {
						try {
							const data = await customGetDailyDispatch(dateKey, r.id);
							const targetFleet = getTargetFleet(r.route_name || '');
							return data.map((row, index) => ({
								...row,
								route_id: r.id,
								route_name: r.route_name,
								vehicle_no: row.vehicle_no || targetFleet[index] || ''
							}));
						} catch (e) {
							console.error(`❌ [${r.route_name}] 개별 노선 로드 실패:`, e);
							return [];
						}
					});

					const results = await Promise.all(fetchPromises);
					if (token !== fetchToken) return;

					// 수집된 모든 노선의 배차 로우들을 하나의 배열로 평탄화 통합
					const combined = results.flat();
					dispatchRows = combined;
				} else {
					// 단일 노선 조회 모드
					const data = await customGetDailyDispatch(dateKey, selectedRoute.id);
					if (token !== fetchToken) return;
					const targetFleet = getTargetFleet(selectedRoute.route_name || '');
					dispatchRows = data.map((row, index) => ({
						...row,
						route_id: selectedRoute.id,
						route_name: selectedRoute.route_name,
						vehicle_no: row.vehicle_no || targetFleet[index] || ''
					}));
				}
			} else {
				dispatchRows = [];
			}
		} catch (err) {
			if (token !== fetchToken) return;
			console.error('❌ 배차 조회 실패:', err);

			dispatchRows = [];
			errorMessage = formatApiError(err, '데이터를 로드하는 데 실패했습니다.');
			showLockScreen = true;
		} finally {
			if (token === fetchToken) {
				isLoading = false;
			}
		}
	}

	$effect(() => {
		syncData(selectedDateKey);
	});

	onMount(() => {
		const liveTodayStr = getKstTimeSnapshot().dateStr;
		if (liveTodayStr !== todayStr) {
			todayStr = liveTodayStr;
			selectedDate = parseDateStrAsLocalDate(shiftCalendarDateStr(liveTodayStr, 3));
		}
		syncData(selectedDateKey);
	});
</script>

<div class="min-h-screen bg-slate-100 pb-6 text-slate-900">
	<!-- 🔝 상단 앱바 네비게이션 (초고밀도 컴팩트) -->
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

			<!-- 📅 날짜 선택 (컴팩트 대시보드) -->
			<div class="flex shrink-0 items-center gap-0.5 rounded-lg bg-slate-200/70 p-0.5">
				<button
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
		<!-- ⚡ 빠른 날짜 전환 칩 버튼 그룹 (+3일 ~ +7일 범위 고정) -->
		<div class="flex scrollbar-none items-center gap-1 overflow-x-auto pb-1">
			{#each [3, 4, 5, 6, 7] as offset}
				{@const targetDate = parseDateStrAsLocalDate(shiftCalendarDateStr(todayStr, offset))}
				{@const active = formatDateISO(selectedDate) === formatDateISO(targetDate)}
				<button
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

		<!-- 🚌 노선 선택 수평 칩 그룹 (전체 노선 포함) -->
		{#if routes.length > 0 && !showLockScreen}
			<div class="flex scrollbar-none items-center gap-1 overflow-x-auto pb-1.5" in:fade>
				<!-- 🌟 "전체 노선" 전용 버튼 탑재 -->
				<button
					class="flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-extrabold transition-all
                    {selectedRoute?.id === 'ALL'
						? 'border-indigo-600 bg-indigo-600 text-white'
						: 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}"
					onclick={() => syncData(selectedDateKey, 'ALL')}
				>
					<Icon icon="lucide:layout-grid" class="h-3 w-3" />
					전체
				</button>

				{#each routes as r}
					<button
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

		<!-- 🔄 로딩 오버레이 -->
		{#if isLoading}
			<div class="flex flex-col items-center justify-center py-24" in:fade>
				<div
					class="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-indigo-600"
				></div>
				<p class="mt-4 text-xs font-bold text-slate-500">
					격자 데이터를 고화질로 조립하고 있습니다...
				</p>
			</div>
		{:else if showLockScreen}
			<!-- 🔒 보안 차단 락 스크린 -->
			<div
				class="mx-auto mt-6 max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-lg"
				in:scale={{ duration: 250 }}
			>
				<div
					class="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-indigo-600"
				>
					<Icon icon="lucide:lock" class="h-8 w-8 animate-bounce" />
					<span class="absolute top-0 right-0 flex h-3.5 w-3.5">
						<span
							class="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75"
						></span>
						<span class="relative inline-flex h-3.5 w-3.5 rounded-full bg-indigo-500"></span>
					</span>
				</div>

				<h2 class="mb-1 text-base font-black text-slate-800">배차표 비공개 대상일</h2>
				<p class="mx-auto mb-5 max-w-sm text-xs leading-relaxed text-slate-500">
					{errorMessage}
				</p>
				<div
					class="inline-block rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[10px] font-bold text-slate-500"
				>
					조회 가능 범위: 오늘 기준 +3일 ~ +7일
				</div>
			</div>
		{:else if routes.length === 0}
			<!-- 🚫 배차 정보 부재 -->
			<div
				class="mx-auto mt-6 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm"
				in:fade
			>
				<div
					class="mx-auto mb-3 flex h-10 w-12 items-center justify-center rounded-xl bg-slate-50 text-slate-400"
				>
					<Icon icon="lucide:calendar-range" class="h-6 w-6" />
				</div>
				<h3 class="mb-0.5 text-sm font-bold text-slate-700">계획된 운행 노선 없음</h3>
				<p class="text-[10px] leading-relaxed text-slate-400">
					선택된 날짜({selectedDateKey})의 활성화된 노선 정보를 찾을 수 없습니다.
				</p>
			</div>
		{:else}
			<!-- 🚐 [Density Excel Sheet] 전면 격자 노선별 표 분할 렌더링 -->
			<div class="mt-0.5" in:fade>
				{#each routesWithDispatches as item}
					{#if item.rows.length > 0}
						<div class="mb-2.5">
							<!-- 🏷️ 노선 전용 구분 헤더 -->
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
											<th class="w-[13%] md:w-[10%]">차량</th>
											<th class="w-[9%] md:w-[7%]">로번</th>
											<th class="w-[14%] md:w-[12%]">출발/종료</th>
											<th class="w-[21%] md:w-[23%]">시작/종료 위치</th>
											<th
												class="w-[15%] md:w-[14%]"
												style="background-color: #ecfdf5; color: #047857;">기사</th
											>
											<th class="w-[8%] md:w-[9%]">대인</th>
											<th class="w-[8%] md:w-[9%]">대차</th>
											<th class="w-[12%] md:w-[16%]">상태/비고</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-slate-200">
										{#each item.rows as row}
											<tr
												class="transition-all hover:bg-indigo-50/20 {row.is_regular_duty
													? 'bg-indigo-50/10'
													: ''}"
											>
												<!-- 차량 번호 (중요) -->
												<td
													class="important-cell bg-blue-50/10 font-black {row.is_inherited
														? 'text-indigo-700 italic'
														: 'text-blue-700'}"
												>
													{row.vehicle_no || '-'}
												</td>

												<!-- 로번 (중요) -->
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

												<!-- 출발 / 종료 (2줄) -->
												<td class="stacked-cell bg-blue-50/20">
													<div class="leading-tight font-bold text-blue-700">
														{row.start_time || '-'}
													</div>
													<div class="leading-tight font-semibold text-slate-500">
														{row.end_time || '-'}
													</div>
												</td>

												<!-- 시작 위치 / 종료 위치 (2줄) -->
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

												<!-- 기사 (중요) -->
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

												<!-- 대인 (빈 셀) -->
												<td class="bg-white"></td>

												<!-- 대차 (빈 셀) -->
												<td class="bg-white"></td>

												<!-- 상태 / 비고 (2줄, 작은 글씨) -->
												<td class="stacked-cell status-cell" title={row.memo || ''}>
													<div>
														{#if row.status === 'CONFIRMED'}
															<span
																class="inline-flex items-center justify-center rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] leading-none font-black text-emerald-700 sm:text-xs"
															>
																확정
															</span>
														{:else if row.status === 'ANNOUNCED'}
															<span
																class="inline-flex items-center justify-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] leading-none font-black text-blue-700 sm:text-xs"
															>
																공지
															</span>
														{:else}
															<span
																class="inline-flex items-center justify-center rounded bg-slate-100 px-1.5 py-0.5 text-[10px] leading-none font-black text-slate-600 sm:text-xs"
															>
																임시
															</span>
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

				<!-- 💡 근무 표 마일드 범례 -->
				<div
					class="mt-2.5 flex items-center justify-end gap-3 px-1 text-[10px] font-bold text-slate-400"
				>
					<div class="flex items-center gap-1">
						<span class="h-2 w-3.5 rounded-sm border border-indigo-100 bg-indigo-50"></span>
						당연 근무 로번 (연속 승계 대상)
					</div>
				</div>
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

	/* 스크롤바 커스텀 */
	.scrollbar-none::-webkit-scrollbar {
		display: none;
	}
	.scrollbar-none {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
