<script lang="ts">
	/**
	 * ============================================================================
	 * [차량 배차 관리자 — 조율 캔버스 테이블 (DispatchCanvasTable.svelte)]
	 * ============================================================================
	 */
	import type {
		DispatchRow,
		DispatchSettings,
		DriverAssignColorsConfig,
		DriverResource,
		DriverWorkStat,
		RouteMasterItem
	} from '$lib/api/dispatch';
	import {
		buildDuplicateDriverSet,
		DEFAULT_DISPATCH_SETTINGS,
		DEFAULT_DRIVER_ASSIGN_COLORS,
		evaluateDriverCompliance
	} from '$lib/services/dispatchAdminService';

	interface Props {
		activeRoutesForRender: RouteMasterItem[];
		dispatchRows: DispatchRow[];
		driverPool: DriverResource[];
		otherRouteAssignedDrivers?: string[];
		driverStats?: Record<string, DriverWorkStat>;
		settings?: DispatchSettings;
		driverAssignColors?: DriverAssignColorsConfig;
		selectedDriver: DriverResource | null;
		isHideRecommendations: boolean;
		onAssignToday: (row: DispatchRow) => void;
		onAssignTomorrow: (row: DispatchRow) => void;
	}

	let {
		activeRoutesForRender,
		dispatchRows = $bindable(),
		driverPool = [],
		otherRouteAssignedDrivers = [],
		driverStats = {},
		settings,
		driverAssignColors = DEFAULT_DRIVER_ASSIGN_COLORS,
		selectedDriver,
		isHideRecommendations,
		onAssignToday,
		onAssignTomorrow
	}: Props = $props();

	const effectiveSettings = $derived(settings ?? DEFAULT_DISPATCH_SETTINGS);
	const duplicateDriverSet = $derived(
		buildDuplicateDriverSet(dispatchRows, otherRouteAssignedDrivers, isHideRecommendations)
	);

	/** 배정 기사의 유형 판별: RESERVE(예비기사/고정차량 없음) | CROSS(타차 배정) | NORMAL */
	function getDriverAssignKind(
		driverName?: string | null,
		rowVehicleNo?: string | null
	): 'RESERVE' | 'CROSS' | 'NORMAL' {
		const dName = String(driverName || '').trim();
		if (!dName) return 'NORMAL';
		const drv = driverPool.find((d) => d.name === dName);
		if (!drv) return 'NORMAL';
		const dVeh = String(drv.vehicle_no || '').trim();
		if (!dVeh) return 'RESERVE';
		const rVeh = String(rowVehicleNo || '').trim();
		if (rVeh && dVeh !== rVeh) return 'CROSS';
		return 'NORMAL';
	}

	function getAssignColorStyle(
		kind: 'RESERVE' | 'CROSS' | 'NORMAL',
		hasDriver: boolean
	): { bg: string; text: string } | null {
		if (!hasDriver || kind === 'NORMAL') return null;
		const cfg = kind === 'RESERVE' ? driverAssignColors?.reserve : driverAssignColors?.cross;
		if (!cfg?.enabled) return null;
		return { bg: cfg.bg_color, text: cfg.text_color };
	}
</script>

<div class="w-full max-w-full lg:w-[580px] lg:flex-none xl:w-[620px]">
	{#each activeRoutesForRender as route (route.id)}
		{@const routeRowsCount = dispatchRows.filter((row) => row.route_id === route.id).length}
		{#if routeRowsCount > 0}
			<div class="mb-6">
				<div class="mb-2 flex items-center justify-between px-1">
					<h3 class="flex items-center gap-1.5 text-sm font-extrabold text-slate-800">
						<span class="inline-block h-4 w-2 rounded-sm bg-indigo-600"></span>
						{route.route_name} 배차표
					</h3>
					<span
						class="rounded border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-black tracking-wider text-indigo-700 uppercase"
					>
						{routeRowsCount}개 로번
					</span>
				</div>

				<div
					class="w-full overflow-x-auto rounded-xl border-2 border-slate-900 bg-white shadow-[2px_2px_0_rgba(0,0,0,1)]"
				>
					<table class="excel-table w-full border-collapse text-center">
						<thead>
							<tr
								class="border-b border-slate-200 bg-slate-100 text-[10.5px] font-extrabold text-slate-600 uppercase sm:text-xs"
							>
								<th class="w-[12%] py-1">차량</th>
								<th class="w-[8%] py-1">로번</th>
								<th class="w-[14%] py-1">출발/종료</th>
								<th class="w-[20%] py-1">시작/종료</th>
								<th class="w-[15%] py-1" style="background-color: #ecfdf5; color: #047857;">기사</th
								>
								<th class="w-[15%] py-1" style="background-color: #f5f3ff; color: #4338ca;">
									내일기사
								</th>
								<th class="w-[16%] py-1">비고</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-200">
							{#each dispatchRows as row (`${row.route_id}-${row.timetable_id}`)}
								{#if row.route_id === route.id}
									{@const todayKind = getDriverAssignKind(row.driver_name, row.vehicle_no)}
									{@const tomorrowKind = getDriverAssignKind(
										row.tomorrow_driver_name,
										row.vehicle_no
									)}
									{@const todayColor = getAssignColorStyle(
										todayKind,
										Boolean(row.driver_name && (!isHideRecommendations || !row.is_inherited))
									)}
									{@const tomorrowColor = getAssignColorStyle(
										tomorrowKind,
										Boolean(
											row.tomorrow_driver_name &&
											(!isHideRecommendations || !row.is_tomorrow_inherited)
										)
									)}
									{@const todayCompliance = evaluateDriverCompliance({
										driverName: isHideRecommendations && row.is_inherited ? '' : row.driver_name,
										driverStats,
										settings: effectiveSettings,
										rowStartTime: row.start_time,
										isRegularDuty: Boolean(row.is_regular_duty || row.is_yesterday_regular_duty),
										isDuplicateToday: duplicateDriverSet.has(
											String(
												isHideRecommendations && row.is_inherited ? '' : row.driver_name || ''
											).trim()
										)
									})}
									{@const isTodayBlink =
										todayCompliance.isViolation && effectiveSettings.enable_validation_blink}
									<tr
										class="transition-all hover:bg-indigo-50/20 {row.is_regular_duty
											? 'bg-indigo-50/10'
											: ''}"
									>
										<!-- 차량 번호 -->
										<td class="border-r bg-blue-50/10">
											<input
												type="text"
												bind:value={row.vehicle_no}
												oninput={() => (row.is_inherited = false)}
												placeholder="차량"
												class="excel-input text-center font-bold {row.is_inherited
													? 'text-indigo-700 italic'
													: 'text-blue-700'}"
											/>
										</td>

										<!-- 로번 -->
										<td
											class="turn-cell relative border-r bg-amber-50/20 font-extrabold text-amber-900"
										>
											{row.seq}
											{#if row.is_regular_duty}
												<div
													class="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-indigo-600"
													title="당연 근무"
												></div>
											{/if}
										</td>

										<!-- 출발 / 종료 (2줄 1셀, 동일 크기) -->
										<td class="stacked-cell border-r bg-blue-50/20">
											<input
												type="text"
												bind:value={row.start_time}
												class="w-full rounded bg-transparent text-center text-[13px] leading-tight font-bold text-blue-700 focus:bg-white focus:outline-none"
											/>
											<div class="text-[13px] leading-tight font-semibold text-slate-500">
												{row.end_time || '-'}
											</div>
										</td>

										<!-- 시작 / 종료 (2줄 1셀, 동일 크기) -->
										<td
											class="stacked-cell border-r bg-slate-50/40"
											title={`${row.start_location || ''} → ${row.end_location || ''}`}
										>
											<div class="truncate text-[13px] leading-tight font-semibold text-slate-700">
												{row.start_location || '-'}
											</div>
											<div class="truncate text-[13px] leading-tight font-medium text-slate-500">
												{row.end_location || '-'}
											</div>
										</td>

										<!-- 오늘 기사 배정 -->
										<td
											title={todayCompliance.isViolation ? todayCompliance.reasons.join(' / ') : ''}
											class="relative cursor-pointer border-r border-slate-200 transition-colors {selectedDriver
												? 'animate-pulse bg-emerald-100'
												: isTodayBlink
													? 'dispatch-warning-blink'
													: todayColor
														? ''
														: row.driver_name && (!isHideRecommendations || !row.is_inherited)
															? row.is_inherited
																? 'bg-indigo-50/80'
																: 'bg-emerald-50'
															: 'bg-emerald-50/20'}"
											style={!selectedDriver && todayColor
												? `background-color: ${todayColor.bg};`
												: ''}
											onclick={() => onAssignToday(row)}
										>
											<input
												type="text"
												value={isHideRecommendations && row.is_inherited
													? ''
													: row.driver_name || ''}
												placeholder={selectedDriver ? '배정하기' : '기사 배정'}
												class="excel-input pointer-events-none text-center font-black {todayColor
													? ''
													: row.is_inherited
														? 'text-indigo-700 italic'
														: 'text-emerald-700'}"
												style={todayColor ? `color: ${todayColor.text};` : ''}
												readonly
											/>
											{#if row.is_inherited && !isHideRecommendations}
												<span
													class="absolute top-[1px] right-1 origin-top-right scale-90 text-[10px] leading-none font-extrabold tracking-tighter text-indigo-500"
													>승계</span
												>
											{/if}
											{#if todayCompliance.isViolation}
												<span
													class="absolute right-1 bottom-[1px] origin-bottom-right scale-90 rounded bg-rose-600 px-1 py-0.5 text-[9px] leading-none font-black text-white"
													>⚠ {todayCompliance.reasons[0]}</span
												>
											{/if}
										</td>

										<!-- 다음 날 기사 배정 -->
										<td
											class="relative cursor-pointer border-r border-slate-200 transition-colors {selectedDriver
												? 'animate-pulse bg-indigo-100'
												: tomorrowColor
													? ''
													: row.tomorrow_driver_name &&
														  (!isHideRecommendations || !row.is_tomorrow_inherited)
														? row.is_tomorrow_inherited
															? 'bg-indigo-50/50'
															: 'bg-indigo-50'
														: 'bg-indigo-50/20'}"
											style={!selectedDriver && tomorrowColor
												? `background-color: ${tomorrowColor.bg};`
												: ''}
											onclick={() => onAssignTomorrow(row)}
										>
											<input
												type="text"
												value={isHideRecommendations && row.is_tomorrow_inherited
													? ''
													: row.tomorrow_driver_name || ''}
												placeholder={selectedDriver ? '배정하기' : '기사 지정'}
												class="excel-input pointer-events-none text-center font-black {tomorrowColor
													? ''
													: row.is_tomorrow_inherited
														? 'text-indigo-600/70 italic'
														: 'text-indigo-800'}"
												style={tomorrowColor ? `color: ${tomorrowColor.text};` : ''}
												readonly
											/>
											{#if row.is_tomorrow_inherited && !isHideRecommendations}
												<span
													class="absolute top-[1px] right-1 origin-top-right scale-90 text-[10px] leading-none font-extrabold tracking-tighter text-indigo-500"
													>자동</span
												>
											{/if}
										</td>

										<!-- 비고/메모 -->
										<td>
											<input
												type="text"
												bind:value={row.memo}
												class="excel-input font-semibold text-slate-600"
												placeholder="메모"
											/>
										</td>
									</tr>
								{/if}
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}
	{/each}
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
		border: 1px solid #ddd;
		padding: 1px 1px !important;
		height: auto;
		font-size: 13px;
		letter-spacing: -0.04em;
		line-height: 1.1;
		text-align: center;
		vertical-align: middle;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.excel-table td.stacked-cell {
		padding: 1px 1px !important;
		line-height: 1.1;
	}
	.excel-table th {
		background-color: #f8fafc;
		font-weight: 800;
		color: #64748b;
		text-transform: uppercase;
		padding: 3px 1px !important;
		font-size: 10.5px;
		letter-spacing: -0.04em;
	}
	.excel-input {
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		border: none;
		padding: 1px 0 !important;
		margin: 0 !important;
		font-size: 13px;
		letter-spacing: -0.04em;
		line-height: 1.15;
		outline: none;
		background: transparent;
		font-weight: 600;
		text-align: center;
	}
	.excel-input:focus {
		background-color: #f0f7ff;
		box-shadow: inset 0 0 0 2px #3b82f6;
	}
	.turn-cell {
		background-color: #fffbeb;
		font-weight: 900;
		text-align: center;
		letter-spacing: -0.03em;
		line-height: 1.15;
	}
	@media (min-width: 768px) {
		.excel-table th,
		.excel-table td {
			padding: 1px 2px !important;
			font-size: 16px;
			letter-spacing: -0.03em;
			line-height: 1.15;
		}
		.excel-table th {
			padding: 4px 2px !important;
			font-size: 13px;
		}
		.excel-input {
			padding: 1px !important;
			font-size: 16px;
			letter-spacing: -0.03em;
			line-height: 1.2;
		}
	}
	@keyframes dispatch-warning-blink {
		0%,
		100% {
			box-shadow: inset 0 0 0 2px #e11d48;
			background-color: rgba(255, 228, 230, 0.9);
		}
		50% {
			box-shadow: inset 0 0 0 2px #fda4af;
			background-color: rgba(255, 241, 242, 0.45);
		}
	}
	.dispatch-warning-blink {
		animation: dispatch-warning-blink 1.1s ease-in-out infinite;
	}
</style>
