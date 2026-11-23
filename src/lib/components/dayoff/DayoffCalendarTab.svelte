<script lang="ts">
	/**
	 * ============================================================================
	 * [결근계 관리자 — 월간 캘린더 탭 (DayoffCalendarTab.svelte)]
	 * ============================================================================
	 */
	import type { DayoffEntry, DayoffMonthlyQuotaDay } from '$lib/api/dayoff';
	import Calendar from '$lib/components/Calendar.svelte';
	import DayoffDateQuotaCard from '$lib/components/DayoffDateQuotaCard.svelte';
	import {
		getDayoffBadgeClass,
		getDayoffStatusLabel,
		getDayoffTypeLabel,
		getDayoffWorkTypeLabel
	} from '$lib/utils/dayoff';
	import Icon from '@iconify/svelte';

	interface Props {
		selectedYear: number;
		selectedMonth: number;
		selectedCalendarDate: string | null;
		todayStr: string;
		calendarEvents: any[];
		calendarStatusFilter: 'ALL' | 'APPROVED' | 'REQUESTED';
		monthlyQuotaDays: Record<string, DayoffMonthlyQuotaDay>;
		selectedDateQuotaInfo: any;
		selectedDateDayoffs: DayoffEntry[];
		onApplyOverride: (dates: string[], quota: number | null) => Promise<void>;
		onUpdateStatus: (id: number, status: string) => void;
	}

	let {
		selectedYear = $bindable(),
		selectedMonth = $bindable(),
		selectedCalendarDate = $bindable<string | null>(),
		todayStr,
		calendarEvents,
		calendarStatusFilter = $bindable<'ALL' | 'APPROVED' | 'REQUESTED'>('ALL'),
		monthlyQuotaDays,
		selectedDateQuotaInfo,
		selectedDateDayoffs,
		onApplyOverride,
		onUpdateStatus
	}: Props = $props();
</script>

<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
	<div class="lg:col-span-8">
		<Calendar
			bind:year={selectedYear}
			bind:month={selectedMonth}
			bind:selectedDate={selectedCalendarDate}
			{todayStr}
			events={calendarEvents}
			selectionMode="single"
			fullBleedMobile={true}
			showSelectedDayPanel={false}
			subtitle="날짜 클릭 시 우측에서 해당일 운전직 정원 수정 및 휴무 승인 제어"
		>
			{#snippet headerRight()}
				<div
					class="inline-flex rounded-xl border-2 border-slate-200 bg-slate-100 p-0.5 text-[11px] font-black"
				>
					{#each [{ id: 'ALL', label: '전체', activeClass: 'bg-slate-900 text-white' }, { id: 'APPROVED', label: '승인', activeClass: 'bg-emerald-600 text-white' }, { id: 'REQUESTED', label: '대기', activeClass: 'bg-amber-500 text-white' }] as f (f.id)}
						<button
							type="button"
							onclick={() => (calendarStatusFilter = f.id as any)}
							class="rounded-lg px-2.5 py-1 transition {calendarStatusFilter === f.id
								? f.activeClass
								: 'text-slate-600'}"
						>
							{f.label}
						</button>
					{/each}
				</div>
			{/snippet}

			{#snippet dayFooter(cell)}
				{@const qInfo = cell.isCurrentMonth ? monthlyQuotaDays?.[cell.dateStr] : null}
				{#if qInfo}
					<div
						class="flex h-3.5 w-full items-center justify-between gap-0.5 rounded px-0.5 text-[9px] leading-none font-black sm:h-4 sm:px-1.5 sm:text-[10px]
							{qInfo.is_full
							? 'bg-rose-100/90 text-rose-700'
							: qInfo.is_override
								? 'bg-amber-100/90 text-amber-800'
								: 'bg-emerald-50 text-emerald-700'}"
						title={`운전직 정원: ${qInfo.approved_count}/${qInfo.quota}명 (${qInfo.is_full ? '마감' : `잔여 ${qInfo.remaining}명`})`}
					>
						<span class="truncate">
							{#if qInfo.quota === 0}
								불가
							{:else if qInfo.is_full}
								마감
							{:else if qInfo.is_override}
								⚡잔여 {qInfo.remaining}<span class="hidden sm:inline">명</span>
							{:else}
								잔여 {qInfo.remaining}명
							{/if}
						</span>
						<span class="hidden shrink-0 font-mono text-[9px] opacity-80 sm:inline">
							{qInfo.approved_count}/{qInfo.quota}
						</span>
					</div>
				{:else}
					<div class="h-3.5 sm:h-4" aria-hidden="true"></div>
				{/if}
			{/snippet}
		</Calendar>
	</div>

	<!-- 우측: 선택한 날짜의 선착순 정원 즉시 수정 + 사원별 휴무 상세 -->
	<div class="space-y-5 lg:col-span-4">
		<DayoffDateQuotaCard
			selectedDate={selectedCalendarDate}
			quotaInfo={selectedDateQuotaInfo}
			{onApplyOverride}
		/>

		<div
			class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg md:rounded-[2rem] md:shadow-2xl"
		>
			<div
				class="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-5 md:p-6"
			>
				<div>
					<span class="text-[10px] font-black tracking-wider text-slate-400"
						>선택 날짜 신청 내역</span
					>
					<h3 class="text-lg font-black tracking-tight text-slate-900">
						{selectedCalendarDate || '-'} 신청 내역
					</h3>
				</div>
				<span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-600">
					{selectedDateDayoffs.length}건
				</span>
			</div>

			<div class="max-h-[420px] space-y-3 overflow-y-auto p-5 md:p-6">
				{#if selectedDateDayoffs.length === 0}
					<div class="py-12 text-center">
						<Icon
							icon="solar:calendar-check-bold-duotone"
							class="mx-auto mb-2 text-4xl text-slate-200"
						/>
						<p class="text-xs font-bold text-slate-400">해당 날짜에 등록된 휴무 내역이 없습니다.</p>
					</div>
				{:else}
					{#each selectedDateDayoffs as d (d.id)}
						<div class="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
							<div class="flex items-start justify-between gap-2">
								<div class="flex items-center gap-2.5">
									<div
										class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white"
									>
										{d.real_name?.[0] || d.username?.[0] || '?'}
									</div>
									<div>
										<div class="flex items-center gap-1.5">
											<span class="text-sm font-black text-slate-900"
												>{d.real_name || d.username}</span
											>
											<span
												class="rounded px-1.5 py-0.5 text-[9px] font-black {d.work_type === 'FCFS'
													? 'bg-emerald-100 text-emerald-700'
													: 'bg-blue-100 text-blue-700'}"
											>
												{getDayoffWorkTypeLabel(d.work_type)}
											</span>
										</div>
										<div class="text-[11px] font-bold text-slate-400">
											{d.primary_group || '미지정'} · Lv.{d.rank_level ?? 0} · {getDayoffTypeLabel(
												d.type
											)}
										</div>
									</div>
								</div>
								<span
									class="rounded-md border px-2 py-0.5 text-[10px] font-black {getDayoffBadgeClass(
										d.status
									)}"
								>
									{getDayoffStatusLabel(d.status)}
								</span>
							</div>

							{#if d.memo}
								<p
									class="rounded-xl border border-slate-100 bg-white px-3 py-2 text-xs text-slate-600"
								>
									{d.memo}
								</p>
							{/if}

							{#if d.status === 'REQUESTED'}
								<div class="flex gap-2 pt-1">
									<button
										type="button"
										onclick={() => onUpdateStatus(d.id, 'APPROVED')}
										class="btn flex-1 rounded-lg border-none bg-emerald-600 font-black text-white btn-xs hover:bg-emerald-700"
									>
										승인
									</button>
									<button
										type="button"
										onclick={() => onUpdateStatus(d.id, 'REJECTED')}
										class="btn flex-1 rounded-lg border-none bg-rose-500 font-black text-white btn-xs hover:bg-rose-600"
									>
										반려
									</button>
								</div>
							{:else if d.status === 'APPROVED'}
								<div class="flex justify-end gap-3">
									<button
										type="button"
										onclick={() => onUpdateStatus(d.id, 'REQUESTED')}
										class="text-[10px] font-black text-slate-400 underline hover:text-blue-600"
									>
										승인 취소(대기로 되돌리기)
									</button>
									<button
										type="button"
										onclick={() => onUpdateStatus(d.id, 'REJECTED')}
										class="text-[10px] font-black text-rose-400 underline hover:text-rose-600"
									>
										강제 반려
									</button>
								</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>
</div>
