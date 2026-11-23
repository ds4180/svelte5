<script lang="ts">
	/**
	 * ============================================================================
	 * [결근계 관리자 — 월간 타임라인 현황 탭 (DayoffTimelineTab.svelte)]
	 * ============================================================================
	 */
	import type { DayoffEntry } from '$lib/api/dayoff';
	import { getTimelineSlotStyle, type TimelineMonthMeta } from '$lib/services/dayoffAdminService';
	import { formatDateTime } from '$lib/utils';
	import { getDayColor, getDayLabel, getDayoffTypeLabel } from '$lib/utils/dayoff';
	import Icon from '@iconify/svelte';

	interface Props {
		selectedYear: number;
		selectedMonth: number;
		yearOptions: number[];
		timelineMonths: TimelineMonthMeta[];
		timelineMonthsCount: number;
		timelineStatusFilter: 'APPROVED' | 'ALL' | 'REQUESTED';
		timelineData: { days: any[]; maxTrackCount: number; totalEntries: number };
		loadingQuotaMonths: Record<string, boolean>;
		onLoadNextMonth: () => void;
	}

	let {
		selectedYear = $bindable(),
		selectedMonth = $bindable(),
		yearOptions,
		timelineMonths,
		timelineMonthsCount,
		timelineStatusFilter = $bindable<'APPROVED' | 'ALL' | 'REQUESTED'>('APPROVED'),
		timelineData,
		loadingQuotaMonths,
		onLoadNextMonth
	}: Props = $props();

	let timelineScrollEl = $state<HTMLElement | null>(null);
	let timelineSentinelEl = $state<HTMLElement | null>(null);
	let hoveredSpanKey = $state<string | null>(null);
	let hoveredTimelineInfo = $state<{
		entry: DayoffEntry;
		span: any;
		left: number;
		top: number;
		placeBelow: boolean;
	} | null>(null);

	function showTimelineTooltip(e: MouseEvent | FocusEvent, slot: any) {
		const el = e.currentTarget as HTMLElement;
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const placeBelow = rect.top < 190;
		const clampedLeft = Math.max(
			120,
			Math.min(window.innerWidth - 120, rect.left + rect.width / 2)
		);
		hoveredSpanKey = slot.span.spanKey;
		hoveredTimelineInfo = {
			entry: slot.entry,
			span: slot.span,
			left: clampedLeft,
			top: placeBelow ? rect.bottom + 8 : rect.top - 8,
			placeBelow
		};
	}

	function hideTimelineTooltip() {
		hoveredTimelineInfo = null;
		hoveredSpanKey = null;
	}

	$effect(() => {
		if (!timelineSentinelEl || !timelineScrollEl) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					onLoadNextMonth();
				}
			},
			{
				root: timelineScrollEl,
				rootMargin: '0px 0px 240px 0px',
				threshold: 0.01
			}
		);
		observer.observe(timelineSentinelEl);
		return () => observer.disconnect();
	});
</script>

{#snippet timelineBadgeCard(
	staffName: string,
	subLabel: string,
	style: any,
	isHighlighted: boolean
)}
	<span
		class="relative z-10 flex w-[84px] items-center gap-1 rounded-lg border px-1.5 py-1 text-left shadow-xs transition-all hover:border-blue-500 hover:shadow-md {style.chip} {isHighlighted
			? 'shadow-md ring-2 ring-blue-400'
			: ''}"
	>
		<span class="h-5 w-1 shrink-0 rounded-full {style.avatar}"></span>
		<span class="flex min-w-0 flex-1 flex-col leading-none">
			<span class="truncate text-[11px] font-black text-slate-900">{staffName}</span>
			<span class="mt-0.5 truncate text-[8.5px] font-black {style.subText}">{subLabel}</span>
		</span>
	</span>
{/snippet}

<div
	class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg md:rounded-[2rem] md:shadow-2xl"
>
	<div
		class="flex flex-col items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-6 md:flex-row md:p-8"
	>
		<div class="space-y-2">
			<div class="flex flex-wrap items-center gap-2">
				<h3 class="text-lg font-black tracking-tight text-slate-900">
					월간 결근계 <span class="text-blue-600">타임라인</span>
				</h3>
				{#if timelineMonths.length > 0}
					<span
						class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-black text-blue-700"
					>
						<Icon icon="solar:infinity-bold" class="text-sm" />
						{timelineMonths[0].label} ~ {timelineMonths[timelineMonths.length - 1].label} ({timelineMonthsCount}개월
						연속)
					</span>
				{/if}
			</div>
			<div class="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-500">
				<span class="text-slate-400">
					다개월 연속 세로 트랙 (단차 0px 직선 정렬 · 스크롤 시 다음 달 자동 연장)
				</span>
				<span class="inline-flex items-center gap-1">
					<span class="inline-block h-2.5 w-2.5 rounded-full bg-emerald-600"></span>
					운전직 선착순
				</span>
				<span class="inline-flex items-center gap-1">
					<span class="inline-block h-2.5 w-2.5 rounded-full bg-blue-600"></span>
					사무직 승인
				</span>
				{#if timelineStatusFilter !== 'APPROVED'}
					<span class="inline-flex items-center gap-1">
						<span class="inline-block h-2.5 w-2.5 rounded-full bg-amber-500"></span>
						승인 대기
					</span>
				{/if}
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-2.5">
			<div class="flex items-center rounded-xl bg-slate-200 p-1">
				{#each [{ key: 'APPROVED', label: '승인 확정' }, { key: 'ALL', label: '승인+대기' }] as stOpt (stOpt.key)}
					<button
						type="button"
						onclick={() => (timelineStatusFilter = stOpt.key as any)}
						class="rounded-lg px-2.5 py-1 text-[11px] font-black transition {timelineStatusFilter ===
						stOpt.key
							? 'bg-white text-slate-900 shadow-xs'
							: 'text-slate-600 hover:text-slate-900'}"
					>
						{stOpt.label}
					</button>
				{/each}
			</div>

			<div class="flex items-center gap-2 rounded-2xl bg-slate-200 p-1.5">
				<select
					class="select rounded-xl border-none bg-transparent font-black text-slate-900 select-sm focus:outline-none"
					bind:value={selectedYear}
				>
					{#each yearOptions as year (year)}
						<option value={year}>{year}년</option>
					{/each}
				</select>
				<div class="h-6 w-px bg-slate-300"></div>
				<select
					class="select rounded-xl border-none bg-transparent font-black text-slate-900 select-sm focus:outline-none"
					bind:value={selectedMonth}
				>
					{#each Array.from({ length: 12 }, (_, i) => i) as month (month)}
						<option value={month}>{month + 1}월</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<div
		bind:this={timelineScrollEl}
		onscroll={hideTimelineTooltip}
		class="relative max-h-[72vh] overflow-auto bg-white"
	>
		<table class="w-full border-separate border-spacing-0 text-left">
			<thead
				class="sticky top-0 z-30 bg-slate-50 text-xs font-bold tracking-wider text-slate-500 shadow-2xs"
			>
				<tr>
					<th
						class="sticky left-0 z-40 w-[68px] min-w-[68px] border-b border-slate-200 bg-slate-50 px-2 py-3.5 text-center"
						>일</th
					>
					<th
						class="sticky left-[68px] z-40 w-[46px] min-w-[46px] border-b border-slate-200 bg-slate-50 px-1 py-3.5 text-center"
						>요일</th
					>
					<th
						class="sticky left-[114px] z-40 w-[96px] min-w-[96px] border-r border-b border-slate-200 bg-slate-50 px-2 py-3.5 text-center"
						>운전직 정원</th
					>
					<th class="min-w-[320px] border-b border-slate-200 bg-slate-50 px-4 py-3.5">
						<div class="flex items-center justify-between gap-2">
							<span>
								{timelineStatusFilter === 'APPROVED'
									? '승인 확정 타임라인 (단차 0px 직선 배치)'
									: '승인·대기 통합 타임라인 (단차 0px 직선 배치)'}
							</span>
							{#if timelineData.maxTrackCount > 0}
								<span
									class="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-black text-slate-700"
								>
									동시 최대 {timelineData.maxTrackCount}라인 · 총 {timelineData.totalEntries}일
								</span>
							{/if}
						</div>
					</th>
				</tr>
			</thead>
			<tbody>
				{#each timelineData.days as day (day.date)}
					{@const stickyBg = day.isToday
						? 'bg-amber-50 group-hover/row:bg-amber-100/90'
						: day.dayOfWeek === 0
							? 'bg-rose-50 group-hover/row:bg-rose-100/80'
							: day.dayOfWeek === 6
								? 'bg-blue-50 group-hover/row:bg-blue-100/80'
								: 'bg-white group-hover/row:bg-slate-50'}
					{@const rowBg = day.isToday
						? 'bg-amber-50/45 hover:bg-amber-50/80'
						: day.dayOfWeek === 0
							? 'bg-rose-50/35 hover:bg-rose-50/60'
							: day.dayOfWeek === 6
								? 'bg-blue-50/35 hover:bg-blue-50/60'
								: 'hover:bg-slate-50/70'}
					{@const monthBorder = day.isMonthStart ? 'border-t-2 border-t-blue-200' : ''}
					<tr class="group/row h-[52px] transition-colors {rowBg}">
						<td
							class="sticky left-0 z-20 h-[52px] w-[68px] min-w-[68px] border-b border-slate-100 px-1.5 text-center align-middle transition-colors {stickyBg} {monthBorder}"
						>
							<div class="flex items-center justify-center gap-1 leading-none">
								{#if day.isMonthStart}
									<span
										class="rounded bg-blue-600 px-1 py-0.5 text-[9px] leading-none font-black text-white"
										>{day.monthNum}월</span
									>
								{/if}
								<span
									class="text-lg leading-none font-black {day.isToday
										? 'rounded-lg bg-slate-900 px-1.5 py-1 text-white'
										: getDayColor(day.dayOfWeek)}"
								>
									{day.day}
								</span>
							</div>
						</td>
						<td
							class="sticky left-[68px] z-20 h-[52px] w-[46px] min-w-[46px] border-b border-slate-100 px-1 text-center align-middle transition-colors {stickyBg} {monthBorder}"
						>
							<span class="text-xs font-black uppercase {getDayColor(day.dayOfWeek)}"
								>{getDayLabel(day.dayOfWeek)}</span
							>
						</td>
						<td
							class="sticky left-[114px] z-20 h-[52px] w-[96px] min-w-[96px] border-r border-b border-slate-200 px-1.5 text-center align-middle transition-colors {stickyBg} {monthBorder}"
						>
							{#if day.qInfo}
								<span
									class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black {day
										.qInfo.is_full
										? 'bg-rose-100 text-rose-700'
										: day.qInfo.is_override
											? 'bg-amber-100 text-amber-800'
											: 'bg-emerald-50 text-emerald-700'}"
								>
									{day.qInfo.approved_count}/{day.qInfo.quota}명
								</span>
							{:else if loadingQuotaMonths[`${day.year}-${day.monthNum}`]}
								<span class="text-[9px] font-bold text-slate-300">...</span>
							{:else}
								<span class="text-[10px] text-slate-300">-</span>
							{/if}
						</td>
						<td class="h-[52px] border-b border-slate-100 p-0 align-middle {monthBorder}">
							<div class="flex h-[52px] items-center px-3">
								{#if day.tracks.length === 0}
									<span class="ml-1 text-[10px] font-bold tracking-wider text-slate-300"
										>결근 없음</span
									>
								{:else}
									{#each day.tracks as slot, tIdx (`${day.date}-t${tIdx}`)}
										<div
											class="relative flex h-[52px] w-[92px] shrink-0 items-center justify-center"
										>
											<span
												class="pointer-events-none absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-slate-100/90"
											></span>
											{#if slot}
												{@const entry = slot.entry}
												{@const style = getTimelineSlotStyle(entry)}
												{@const staffName =
													entry.real_name || entry.username || `사원#${entry.user_id}`}
												{@const isHighlighted = hoveredSpanKey === slot.span.spanKey}
												{#if !slot.isMultiDay}
													<button
														type="button"
														onmouseenter={(e) => showTimelineTooltip(e, slot)}
														onmouseleave={hideTimelineTooltip}
														onfocus={(e) => showTimelineTooltip(e, slot)}
														onblur={hideTimelineTooltip}
														onclick={(e) => showTimelineTooltip(e, slot)}
														class="relative z-10 flex cursor-pointer items-center justify-center"
														title={`${staffName} · ${getDayoffTypeLabel(entry.type)} (${entry.date})`}
													>
														{@render timelineBadgeCard(
															staffName,
															`${entry.work_type === 'FCFS' ? '🚌' : '🏢'}${getDayoffTypeLabel(entry.type)}`,
															style,
															isHighlighted
														)}
													</button>
												{:else}
													<button
														type="button"
														onmouseenter={(e) => showTimelineTooltip(e, slot)}
														onmouseleave={hideTimelineTooltip}
														onfocus={(e) => showTimelineTooltip(e, slot)}
														onblur={hideTimelineTooltip}
														onclick={(e) => showTimelineTooltip(e, slot)}
														aria-label={`${staffName} ${getDayoffTypeLabel(entry.type)} (${slot.span.startDate} ~ ${slot.span.endDate})`}
														title={`${staffName} · ${getDayoffTypeLabel(entry.type)} (${slot.span.startDate} ~ ${slot.span.endDate}, ${slot.totalDaysInSpan}일)`}
														class="relative flex h-full w-full cursor-pointer items-center justify-center"
													>
														<span
															class="pointer-events-none absolute left-1/2 z-[5] -translate-x-1/2 transition-all {isHighlighted
																? `w-[14px] ${style.lineActive}`
																: `w-[10px] ${style.line}`} {slot.isStart
																? 'top-1/2'
																: '-top-[2px]'} {slot.isEnd ? 'bottom-1/2' : '-bottom-[2px]'}"
														></span>
														{#if slot.isStart || slot.isVisibleFirst}
															{@render timelineBadgeCard(
																staffName,
																`${entry.work_type === 'FCFS' ? '🚌' : '🏢'}${getDayoffTypeLabel(entry.type)}·${slot.totalDaysInSpan}일${!slot.isStart ? '↑' : ''}`,
																style,
																isHighlighted
															)}
														{:else if slot.isEnd}
															<span
																class="pointer-events-none relative z-10 h-4 w-4 rounded-full shadow-xs ring-2 ring-white transition-transform {isHighlighted
																	? 'scale-125'
																	: ''} {style.dot}"
															></span>
														{:else}
															<span
																class="pointer-events-none relative z-10 h-2 w-2 rounded-full bg-white/90 shadow-2xs transition-transform {isHighlighted
																	? 'scale-125'
																	: ''}"
															></span>
														{/if}
													</button>
												{/if}
											{/if}
										</div>
									{/each}
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>

		<div
			bind:this={timelineSentinelEl}
			class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4 text-xs font-bold text-slate-500"
		>
			<div class="flex items-center gap-2">
				{#if Object.keys(loadingQuotaMonths).length > 0}
					<span class="loading loading-xs loading-spinner text-blue-600"></span>
					<span>다음 달 선착순 정원 및 타임라인 데이터를 이어서 불러오는 중...</span>
				{:else if timelineMonthsCount >= 24}
					<span
						>최대 연속 표시 범위(24개월)에 도달했습니다. 상단 연/월을 변경해 기준 월을 이동하세요.</span
					>
				{:else}
					<Icon icon="solar:double-alt-arrow-down-bold-duotone" class="text-base text-blue-600" />
					<span
						>아래로 스크롤하면 다음 달 타임라인이 자동으로 이어집니다. (현재 {timelineMonthsCount}개월
						로드됨)</span
					>
				{/if}
			</div>
			{#if timelineMonthsCount < 24}
				<button
					type="button"
					onclick={onLoadNextMonth}
					disabled={Object.keys(loadingQuotaMonths).length > 0}
					class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-[11px] font-black text-slate-700 shadow-xs transition hover:border-blue-500 hover:text-blue-600 disabled:opacity-50"
				>
					<Icon icon="solar:add-circle-bold-duotone" class="text-sm text-blue-600" />
					다음 달 (+1개월) 더 보기
				</button>
			{/if}
		</div>
	</div>
</div>

{#if hoveredTimelineInfo}
	{@const tipEntry = hoveredTimelineInfo.entry}
	{@const tipSpan = hoveredTimelineInfo.span}
	<div
		class="pointer-events-none fixed z-[260] w-60 -translate-x-1/2 rounded-2xl border border-slate-700 bg-slate-900 p-4 text-white shadow-[0_20px_50px_rgba(0,0,0,0.35)] {hoveredTimelineInfo.placeBelow
			? ''
			: '-translate-y-full'}"
		style="left: {hoveredTimelineInfo.left}px; top: {hoveredTimelineInfo.top}px;"
	>
		<div class="mb-2 flex items-center justify-between border-b border-slate-700 pb-2">
			<span class="text-[9px] font-black tracking-widest text-emerald-400 uppercase">
				{tipEntry.primary_group || '소속미정'} · Lv.{tipEntry.rank_level ?? 0}
			</span>
			<span class="font-mono text-[9px] text-slate-400">#{tipEntry.id}</span>
		</div>
		<div class="mb-1.5 flex items-center justify-between gap-2">
			<span class="text-sm font-black text-white">{tipEntry.real_name || tipEntry.username}</span>
			<span
				class="rounded-md px-1.5 py-0.5 text-[9px] font-black {tipEntry.work_type === 'FCFS'
					? 'bg-emerald-600/30 text-emerald-300'
					: 'bg-blue-600/30 text-blue-300'}"
			>
				{tipEntry.work_type === 'FCFS' ? '🚌선착순' : '🏢승인'} · {getDayoffTypeLabel(
					tipEntry.type
				)}
			</span>
		</div>
		<div class="mb-2 text-[10px] font-bold text-amber-300">
			{tipSpan.isMultiDay
				? `연속 ${tipSpan.entries.length}일 (${tipSpan.startDate} ~ ${tipSpan.endDate})`
				: `당일 휴무 (${tipEntry.date})`}
		</div>
		<p class="mb-2.5 text-xs leading-relaxed font-bold text-slate-200 italic">
			"{tipEntry.memo || '명시된 사유 없음'}"
		</p>
		<div class="flex flex-col gap-0.5 text-[9px] font-bold tracking-tight text-slate-400">
			<span>신청: {formatDateTime(tipEntry.create_date)}</span>
			<span>코드: {tipEntry.group_id || '단일 신청'}</span>
		</div>
	</div>
{/if}
