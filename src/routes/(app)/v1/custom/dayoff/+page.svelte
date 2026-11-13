<script lang="ts">
	/**
	 * @file (app)/v1/custom/dayoff/+page.svelte
	 * @description [v3.1 TS] 근무자 전용 휴무 신청 및 관리 (공용 Calendar 컴포넌트 적용 / admin 기본 UI 기준)
	 */
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Calendar, { type CalendarDayCell, type CalendarEvent } from '$lib/components/Calendar.svelte';
	import { fastApi } from '$lib/api';
	import { timestampToDateString } from '$lib/utils';
	import { formatApiError } from '$lib/utils/error';
	import { getSiteTitle } from '$lib/config/site';
	import { toast } from '$lib/runes/toast.svelte';
	import type {
		DayoffEntry,
		DayoffPolicy,
		DayoffQuotaDay,
		DayoffQuotaStatus
	} from '$lib/types/dayoff';
	import Icon from '@iconify/svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const now = new Date();
	const todayStr = timestampToDateString(now.getTime());

	// 📌 달력 연/월 상태 및 입력 상태 관리 ($state)
	let calYear = $state(now.getFullYear());
	let calMonth = $state(now.getMonth());
	/** 선택된 날짜 ('YYYY-MM-DD'[]) — range 모드에서 시작~종료 사이 전체 날짜가 담김 */
	let selectedDates = $state<string[]>([]);
	let selectedType = $state('ANNUAL');
	let memo = $state('');
	let isSubmitting = $state(false);

	// 📌 직군 모드(APPROVAL: 사무직 승인제 / FCFS: 운전직 선착순) 및 월별 정원 현황 상태
	let quotaInfo = $state<DayoffQuotaStatus | null>(null);

	$effect(() => {
		if (data.quota_info) {
			quotaInfo = data.quota_info;
		}
	});

	/**
	 * 달력 연/월 변경 시 해당 월의 일자별 선착순 정원 현황 조회
	 */
	async function fetchMonthQuota(y: number, m0: number): Promise<void> {
		try {
			const res = await fastApi<DayoffQuotaStatus>('GET', `/api/dayoff/quota-status?year=${y}&month=${m0 + 1}`);
			if (res) quotaInfo = res;
		} catch {
			// 조용히 폴백 유지
		}
	}

	$effect(() => {
		const y = calYear;
		const m0 = calMonth;
		if (quotaInfo && quotaInfo.year === y && quotaInfo.month === m0 + 1) return;
		fetchMonthQuota(y, m0);
	});

	const DEFAULT_POLICY: DayoffPolicy = {
		daily_quota: 3,
		max_monthly_count: 0,
		max_days_per_request: 0,
		min_advance_days: 0,
		max_advance_days: 0
	};

	const isFcfsMode = $derived((quotaInfo?.user_mode || data.quota_info?.user_mode) === 'FCFS');
	const policy = $derived<DayoffPolicy>(quotaInfo?.policy || data.quota_info?.policy || DEFAULT_POLICY);
	const todayPolicy = $derived<DayoffPolicy>(
		quotaInfo?.today_policy || data.quota_info?.today_policy || policy
	);
	const requestWindow = $derived(
		quotaInfo?.request_window || data.quota_info?.request_window || null
	);
	const quotaDays = $derived<Record<string, DayoffQuotaDay>>(
		quotaInfo?.days || data.quota_info?.days || {}
	);
	const maxMonthlyCount = $derived(Number(policy?.max_monthly_count || 0));
	const maxDaysPerRequest = $derived(Number(policy?.max_days_per_request || 0));
	const minAdvanceDays = $derived(
		Number(requestWindow?.min_advance_days ?? todayPolicy?.min_advance_days ?? 0)
	);
	const maxAdvanceDays = $derived(
		Number(requestWindow?.max_advance_days ?? todayPolicy?.max_advance_days ?? 0)
	);
	const monthlyUsedCount = $derived(
		Number(quotaInfo?.monthly_used_count ?? data.quota_info?.monthly_used_count ?? 0)
	);

	/**
	 * 'YYYY-MM-DD' 문자열에 일수를 더한 날짜 문자열('YYYY-MM-DD') 반환
	 */
	function shiftDateStr(baseStr: string, offsetDays: number): string {
		const [y, m, d] = String(baseStr || todayStr).slice(0, 10).split('-').map(Number);
		const dt = new Date(y, (m || 1) - 1, (d || 1) + Number(offsetDays || 0));
		return timestampToDateString(dt.getTime());
	}

	const minAllowedDate = $derived(requestWindow?.min_date || shiftDateStr(todayStr, minAdvanceDays));
	const maxAllowedDate = $derived(
		requestWindow?.max_date ??
			(maxAdvanceDays > 0 ? shiftDateStr(todayStr, maxAdvanceDays) : null)
	);

	const TYPE_LABELS: Record<string, string> = {
		ANNUAL: '연차',
		SICK: '병가',
		SPECIAL: '경조사',
		OFFICIAL: '공가'
	};
	const STATUS_LABELS: Record<string, string> = {
		REQUESTED: '승인 대기',
		APPROVED: '승인 확정',
		REJECTED: '반려',
		CANCELLED: '취소'
	};

	const getTypeLabel = (t: string): string => TYPE_LABELS[t] || t;

	const getBadgeClass = (s: string): string => {
		if (s === 'REQUESTED') return 'bg-amber-100 text-amber-700 border-amber-200';
		if (s === 'APPROVED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
		if (s === 'REJECTED') return 'bg-rose-100 text-rose-700 border-rose-200';
		return 'bg-slate-100 text-slate-500 border-slate-200';
	};

	/**
	 * 시작일~종료일 사이의 모든 'YYYY-MM-DD' 배열 생성
	 */
	function expandDateRange(startStr: string, endStr: string): string[] {
		if (!startStr) return [];
		const s = startStr.slice(0, 10);
		const e = (endStr || startStr).slice(0, 10);
		const [sy, sm, sd] = s.split('-').map(Number);
		const [ey, em, ed] = e.split('-').map(Number);
		const cur = new Date(sy, sm - 1, sd);
		const last = new Date(ey, em - 1, ed);
		const out: string[] = [];
		while (cur <= last && out.length < 366) {
			out.push(timestampToDateString(cur.getTime()));
			cur.setDate(cur.getDate() + 1);
		}
		return out;
	}

	/**
	 * 내 휴무 이력 + 운전직(FCFS) 일별 선착순 정원/마감 현황을 공용 Calendar 이벤트로 변환합니다.
	 */
	function buildEvents(
		list: DayoffEntry[],
		fcfs: boolean,
		qDays: Record<string, DayoffQuotaDay>
	): CalendarEvent[] {
		const result: CalendarEvent[] = [];
		const STATUS_TYPE: Record<string, string> = {
			REQUESTED: 'WARNING',
			APPROVED: 'SUCCESS',
			REJECTED: 'DANGER'
		};

		// 1. 내 휴무 신청 이력 (연속선 bar 이벤트)
		for (const d of list) {
			if (!d || d.status === 'CANCELLED') continue;
			const startStr = (d.start_date || String(d.date).slice(0, 10)).trim();
			const endStr = (d.end_date || startStr).trim();
			result.push({
				id: `my-${d.id}-${startStr}`,
				date: startStr,
				endDate: endStr !== startStr ? endStr : null,
				title: `[내 휴무] ${getTypeLabel(d.type)} · ${STATUS_LABELS[d.status] || d.status}`,
				type: STATUS_TYPE[d.status] || 'PRIMARY',
				display: 'bar',
				badge: getTypeLabel(d.type),
				raw: d
			});
		}

		// 2. 운전직(선착순) 모드일 때 일별 정원 마감 배경 알람 및 신청 현황 표시
		if (fcfs && qDays) {
			for (const [dStr, info] of Object.entries(qDays)) {
				if (!info) continue;
				if (info.is_full) {
					result.push({
						id: `quota-full-${dStr}`,
						date: dStr,
						title:
							info.quota === 0
								? '휴무 신청 불가일'
								: `선착순 마감 (${info.approved_count}/${info.quota}명)`,
						type: 'DANGER',
						display: 'background',
						badge: '마감',
						raw: { isQuotaInfo: true, ...info }
					});
				} else if (info.approved_count > 0 || info.is_override) {
					result.push({
						id: `quota-avail-${dStr}`,
						date: dStr,
						title: `선착순 ${info.approved_count}/${info.quota}명 (잔여 ${info.remaining})`,
						type: info.is_override ? 'INFO' : 'PRIMARY',
						display: 'bar',
						badge: `잔여${info.remaining}`,
						raw: { isQuotaInfo: true, ...info }
					});
				}
			}
		}

		return result;
	}

	// 📌 달력 이벤트 / 통계 / 중복 및 정원 마감 검사 ($derived)
	const events = $derived(buildEvents(data.dayoff_list || [], isFcfsMode, quotaDays));

	const stats = $derived.by(() => {
		const list: DayoffEntry[] = data.dayoff_list || [];
		return {
			total: data.total ?? list.length,
			requested: list.filter((d) => d.status === 'REQUESTED').length,
			approved: list.filter((d) => d.status === 'APPROVED').length,
			rejected: list.filter((d) => d.status === 'REJECTED').length
		};
	});

	/** 대기·승인 상태로 이미 신청된 내 날짜 집합 */
	const busyDates = $derived.by(() => {
		const set = new Set<string>();
		for (const d of data.dayoff_list || []) {
			if (d.status !== 'REQUESTED' && d.status !== 'APPROVED') continue;
			const startStr = (d.start_date || String(d.date).slice(0, 10)).trim();
			const endStr = (d.end_date || startStr).trim();
			for (const dayStr of expandDateRange(startStr, endStr)) {
				set.add(dayStr);
			}
		}
		return set;
	});

	/** 선택한 날짜 중 이미 본인이 신청한 날짜 */
	const duplicateDates = $derived(selectedDates.filter((d) => busyDates.has(d)));

	/** 운전직(선착순) 모드에서 선택한 날짜 중 정원이 마감된 날짜 */
	const fullQuotaDates = $derived(
		isFcfsMode
			? selectedDates.filter((d) => quotaDays[d]?.is_full === true && !busyDates.has(d))
			: []
	);

	/** 1회 최대 사용 일수 초과 여부 */
	const exceedsMaxDays = $derived(maxDaysPerRequest > 0 && selectedDates.length > maxDaysPerRequest);

	/** 월 최대 사용 횟수 도달 여부 */
	const exceedsMonthlyCount = $derived(
		maxMonthlyCount > 0 && selectedDates.length > 0 && monthlyUsedCount >= maxMonthlyCount
	);

	/** 신청 가능 기간(D+X ~ D+Y)을 벗어난 날짜 */
	const outOfWindowDates = $derived(
		selectedDates.filter((d) => d < minAllowedDate || (maxAllowedDate ? d > maxAllowedDate : false))
	);

	/**
	 * 취소 가능 여부 판별 (대기 중이거나, 시작일이 오늘 이후인 미래 승인 건)
	 */
	function canCancelEntry(d: DayoffEntry): boolean {
		if (d.status === 'REQUESTED') return true;
		if (d.status === 'APPROVED') {
			const startStr = (d.start_date || String(d.date).slice(0, 10)).trim();
			return startStr >= todayStr;
		}
		return false;
	}

	function handleEventClick(ev: CalendarEvent): void {
		const row = ev.raw;
		if (row?.isQuotaInfo) {
			toast.info(
				`${row.date}: 선착순 정원 ${row.quota}명 중 ${row.approved_count}명 확정 (잔여 ${row.remaining}명)`
			);
			return;
		}
		toast.info(
			`${getTypeLabel(row?.type)} · ${STATUS_LABELS[row?.status] || row?.status} (${ev.date}${ev.endDate ? ' ~ ' + ev.endDate : ''})`
		);
	}

	const handleCreateEnhance: SubmitFunction = () => {
		isSubmitting = true;
		return async ({ result, update }) => {
			await update({ reset: false });
			isSubmitting = false;

			if (result.type === 'success') {
				toast.success(
					isFcfsMode
						? '선착순 휴무가 즉시 승인 확정되었습니다!'
						: '휴무 신청이 완료되었습니다. 관리자 승인 후 확정됩니다.'
				);
				selectedDates = [];
				memo = '';
				await fetchMonthQuota(calYear, calMonth);
			} else if (result.type === 'failure') {
				const errPayload = (result.data as { error?: unknown } | undefined)?.error;
				toast.error(formatApiError(errPayload, '신청에 실패했습니다.'));
				await fetchMonthQuota(calYear, calMonth);
			} else if (result.type === 'error') {
				toast.error(formatApiError(result.error, '신청 처리 중 오류가 발생했습니다.'));
			}
		};
	};

	const handleDeleteEnhance: SubmitFunction = () => {
		return async ({ result, update }) => {
			await update({ reset: false });
			if (result.type === 'success') {
				toast.success('휴무 신청이 취소되었습니다.');
				await fetchMonthQuota(calYear, calMonth);
			} else if (result.type === 'failure') {
				const errPayload = (result.data as { error?: unknown } | undefined)?.error;
				toast.error(formatApiError(errPayload, '휴무 취소에 실패했습니다.'));
			} else if (result.type === 'error') {
				toast.error(formatApiError(result.error, '취소 처리 중 오류가 발생했습니다.'));
			}
		};
	};

	function handleDisabledDateClick(cell: CalendarDayCell): void {
		toast.warning(
			`${cell.dateStr}은(는) 신청 가능 기간(${minAllowedDate} ~ ${maxAllowedDate || '제한없음'}) 밖이라 선택할 수 없습니다.`
		);
	}
</script>

<svelte:head>
	<title>{getSiteTitle('휴무 신청')}</title>
</svelte:head>

<div
	class="mx-auto max-w-7xl space-y-6 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 lg:px-8"
>
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 직군별 운영 방식 배지 (admin 기본 UI) -->
	<!-- ===================================================================== -->
	<div
		class="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between md:border-b-4 md:pb-8"
	>
		<div>
			<div class="flex flex-wrap items-center gap-2">
				<span
					class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-widest text-emerald-400 uppercase"
				>
					<span class="h-2 w-2 animate-ping rounded-full bg-emerald-400"></span>
					Employee Self-Service
				</span>
				{#if isFcfsMode}
					<span
						class="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black text-emerald-700"
					>
						<Icon icon="solar:bus-bold-duotone" class="text-sm" />
						운전직 · 선착순 즉시 확정제 (기본 일 최대 {policy.daily_quota}명)
					</span>
				{:else}
					<span
						class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-[11px] font-black text-blue-700"
					>
						<Icon icon="solar:buildings-2-bold-duotone" class="text-sm" />
						사무직 · 신청 후 관리자 승인제
					</span>
				{/if}
				{#if maxMonthlyCount > 0}
					<span
						class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-700"
					>
						{calMonth + 1}월 사용: {monthlyUsedCount}/{maxMonthlyCount}회
					</span>
				{/if}
				{#if maxDaysPerRequest > 0}
					<span
						class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-black text-slate-700"
					>
						1회 최대 {maxDaysPerRequest}일
					</span>
				{/if}
				{#if minAdvanceDays > 0 || maxAdvanceDays > 0}
					<span
						class="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-[11px] font-black text-violet-700"
					>
						신청 기간: D+{minAdvanceDays} ~ {maxAdvanceDays > 0 ? `D+${maxAdvanceDays}` : '무제한'} ({minAllowedDate} ~ {maxAllowedDate || '제한없음'})
					</span>
				{/if}
			</div>
			<h1
				class="mt-2 text-3xl font-black tracking-tight text-slate-900 uppercase italic md:text-4xl"
			>
				휴무 <span class="not-italic text-blue-600">신청</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				{#if isFcfsMode}
					운전직 선착순 휴무입니다. 일별 정원 내 신청 시 즉시 <b>승인 확정</b>되며, 정원이 찬 날짜(마감)는 신청할 수 없습니다.
				{:else}
					달력에서 시작일과 종료일을 차례로 눌러 기간을 선택하고, 신청 후 관리자 승인 상태를 확인합니다.
				{/if}
			</p>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 2. 요약 카드 (admin Status Cards 스타일) -->
	<!-- ===================================================================== -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
		<div
			class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Pending</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
					<Icon icon="solar:clock-circle-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-amber-600">
					{stats.requested} <span class="text-xs font-normal text-slate-500">건</span>
				</div>
				<div class="mt-1 text-xs font-bold text-slate-400">승인 대기 중</div>
			</div>
		</div>

		<div
			class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Approved</span>
				<div
					class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"
				>
					<Icon icon="solar:check-circle-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-emerald-600">
					{stats.approved} <span class="text-xs font-normal text-slate-500">건</span>
				</div>
				<div class="mt-1 text-xs font-bold text-slate-400">승인 확정 휴무</div>
			</div>
		</div>

		<div
			class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Rejected</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
					<Icon icon="solar:close-circle-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-rose-600">
					{stats.rejected} <span class="text-xs font-normal text-slate-500">건</span>
				</div>
				<div class="mt-1 text-xs font-bold text-slate-400">반려된 신청</div>
			</div>
		</div>

		<div
			class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Lifetime</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
					<Icon icon="solar:calendar-date-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-blue-600">
					{stats.total} <span class="text-xs font-normal text-slate-500">건</span>
				</div>
				<div class="mt-1 text-xs font-bold text-slate-400">누적 신청 기록</div>
			</div>
		</div>
	</div>

	{#if data.error}
		<div
			class="rounded-2xl border-2 border-rose-200 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-700"
		>
			{data.error}
		</div>
	{/if}

	<!-- ===================================================================== -->
	<!-- 3. 메인: 좌측 공용 달력 + 우측 신청 폼 -->
	<!-- ===================================================================== -->
	<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8">
		<!-- 좌측: 공용 Calendar (range 선택 / 모바일 무여백) -->
		<div class="lg:col-span-8">
			<Calendar
				bind:year={calYear}
				bind:month={calMonth}
				bind:selectedDates
				{events}
				selectionMode="range"
				fullBleedMobile={true}
				minSelectableDate={minAllowedDate}
				maxSelectableDate={maxAllowedDate}
				onDisabledDateClick={handleDisabledDateClick}
				subtitle={isFcfsMode
					? `운전직 선착순 캘린더 · 기본 일일 정원 ${policy.daily_quota}명`
					: '사무직 승인제 캘린더 · 시작일 → 종료일 클릭'}
				onEventClick={handleEventClick}
			/>

			<!-- 범례 -->
			<div class="mt-3 flex flex-wrap items-center gap-3 px-1 text-[11px] font-bold text-slate-500">
				<span class="flex items-center gap-1.5">
					<span class="h-2.5 w-2.5 rounded-full bg-amber-500"></span> 승인 대기
				</span>
				<span class="flex items-center gap-1.5">
					<span class="h-2.5 w-2.5 rounded-full bg-emerald-500"></span> 승인 확정
				</span>
				<span class="flex items-center gap-1.5">
					<span class="h-2.5 w-2.5 rounded-full bg-rose-500"></span> 반려 / 선착순 마감
				</span>
			</div>
		</div>

		<!-- 우측: 신청 폼 -->
		<div class="lg:col-span-4">
			<div
				class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg md:rounded-[2rem] md:shadow-2xl"
			>
				<div class="border-b border-slate-100 bg-slate-50/50 p-5 md:p-6">
					<div class="flex items-center justify-between">
						<h3 class="text-lg font-black tracking-tighter text-slate-900 uppercase italic">
							Application <span class="not-italic ml-1 text-sm font-bold text-blue-600">휴무 신청서</span>
						</h3>
						<span
							class="rounded-full px-2.5 py-0.5 text-[10px] font-black {isFcfsMode
								? 'bg-emerald-100 text-emerald-700'
								: 'bg-blue-100 text-blue-700'}"
						>
							{isFcfsMode ? '선착순 즉시확정' : '관리자 승인제'}
						</span>
					</div>
				</div>

				<form
					method="post"
					action="?/create"
					use:enhance={handleCreateEnhance}
					class="space-y-6 p-5 md:p-6"
				>
					<input type="hidden" name="dates" value={JSON.stringify(selectedDates)} />
					<input type="hidden" name="type" value={selectedType} />

					<!-- 휴무 유형 -->
					<div class="space-y-2.5">
						<span class="block text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase">
							Absence Category
						</span>
						<div class="grid grid-cols-2 gap-2">
							{#each ['ANNUAL', 'SICK', 'SPECIAL', 'OFFICIAL'] as type (type)}
								<label
									for="type-{type}"
									class="relative flex h-11 cursor-pointer items-center justify-center rounded-xl border-2 text-xs font-black transition-all
									{selectedType === type
										? 'border-blue-600 bg-blue-600 text-white shadow-md'
										: 'border-slate-200 bg-white text-slate-600 hover:border-slate-400'}"
								>
									<input
										type="radio"
										id="type-{type}"
										value={type}
										bind:group={selectedType}
										class="hidden"
									/>
									{getTypeLabel(type)}
								</label>
							{/each}
						</div>
					</div>

					<!-- 사유 -->
					<div class="space-y-2.5">
						<label
							class="block text-[10px] font-black tracking-[0.2em] text-slate-400 uppercase"
							for="memo">Detail Reason / Memo</label
						>
						<textarea
							id="memo"
							class="w-full rounded-2xl border-2 border-slate-200 bg-white p-3.5 text-sm font-medium text-slate-900 transition-all placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
							name="memo"
							rows="3"
							placeholder="사유를 입력하세요 (선택 사항)"
							bind:value={memo}
						></textarea>
					</div>

					<!-- 선택 요약 -->
					<div class="rounded-2xl border border-slate-200 bg-slate-50 p-4">
						<div class="mb-3 flex items-center justify-between border-b border-slate-200 pb-2">
							<span class="text-[10px] font-black tracking-widest text-slate-400 uppercase">
								Total selection
							</span>
							<span class="text-lg font-black text-blue-600">
								{selectedDates.length} <span class="text-xs font-bold">DAYS</span>
							</span>
						</div>

						{#if selectedDates.length > 0}
							<div class="mb-2 text-xs font-black text-slate-700">
								{selectedDates[0]}
								{#if selectedDates.length > 1}
									<span class="mx-1 text-slate-400">~</span>
									{selectedDates[selectedDates.length - 1]}
								{/if}
							</div>
							<div class="custom-scrollbar flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pr-1">
								{#each selectedDates as d (d)}
									{@const qInfo = quotaDays[d]}
									{@const outWin = d < minAllowedDate || (maxAllowedDate ? d > maxAllowedDate : false)}
									<span
										class="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[9px] font-bold
										{busyDates.has(d) || outWin || (isFcfsMode && qInfo?.is_full)
											? 'border-rose-300 bg-rose-50 text-rose-700'
											: 'border-slate-200 bg-white text-slate-700'}"
									>
										<span>{d}</span>
										{#if isFcfsMode && qInfo}
											<span
												class="rounded px-1 py-0.2 text-[8px] font-black {qInfo.is_full
													? 'bg-rose-200 text-rose-800'
													: 'bg-emerald-100 text-emerald-700'}"
											>
												{qInfo.approved_count}/{qInfo.quota}명
											</span>
										{/if}
									</span>
								{/each}
							</div>
						{:else}
							<p class="py-2 text-[10px] font-black tracking-widest text-slate-400 uppercase italic">
								달력에서 시작일 → 종료일을 선택하세요
							</p>
						{/if}

						{#if duplicateDates.length > 0}
							<div
								class="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[11px] font-bold text-rose-700"
							>
								<Icon icon="solar:danger-triangle-bold-duotone" class="mt-0.5 shrink-0 text-base" />
								<span>
									이미 신청된 날짜({duplicateDates.length}일)가 포함되어 있습니다. 기간을 다시 선택해
									주세요.
								</span>
							</div>
						{/if}

						{#if outOfWindowDates.length > 0}
							<div
								class="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[11px] font-bold text-rose-700"
							>
								<Icon icon="solar:calendar-mark-bold-duotone" class="mt-0.5 shrink-0 text-base" />
								<span>
									신청 가능 기간(D+{minAdvanceDays} ~ {maxAdvanceDays > 0 ? `D+${maxAdvanceDays}` : '무제한'}: {minAllowedDate} ~ {maxAllowedDate || '제한없음'})을 벗어난 날짜({outOfWindowDates.length}일)가 포함되어 있습니다.
								</span>
							</div>
						{/if}

						{#if fullQuotaDates.length > 0}
							<div
								class="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[11px] font-bold text-rose-700"
							>
								<Icon icon="solar:Forbidden-circle-bold-duotone" class="mt-0.5 shrink-0 text-base" />
								<span>
									선착순 정원이 마감된 날짜({fullQuotaDates.join(', ')})가 포함되어 신청할 수 없습니다.
								</span>
							</div>
						{/if}

						{#if exceedsMaxDays}
							<div
								class="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[11px] font-bold text-rose-700"
							>
								<Icon icon="solar:danger-triangle-bold-duotone" class="mt-0.5 shrink-0 text-base" />
								<span>
									1회 신청 가능 최대 일수({maxDaysPerRequest}일)를 초과했습니다. (현재 {selectedDates.length}일 선택)
								</span>
							</div>
						{/if}

						{#if exceedsMonthlyCount}
							<div
								class="mt-3 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-[11px] font-bold text-rose-700"
							>
								<Icon icon="solar:danger-triangle-bold-duotone" class="mt-0.5 shrink-0 text-base" />
								<span>
									{calYear}년 {calMonth + 1}월 최대 사용 횟수({maxMonthlyCount}회)를 모두 사용했습니다.
								</span>
							</div>
						{/if}
					</div>

					<button
						type="submit"
						class="btn h-14 w-full rounded-2xl border-none font-black text-white uppercase shadow-lg transition-all btn-lg disabled:opacity-30 {isFcfsMode
							? 'bg-emerald-600 hover:bg-emerald-700'
							: 'bg-blue-600 hover:bg-blue-700'}"
						disabled={selectedDates.length === 0 ||
							duplicateDates.length > 0 ||
							outOfWindowDates.length > 0 ||
							fullQuotaDates.length > 0 ||
							exceedsMaxDays ||
							exceedsMonthlyCount ||
							isSubmitting}
					>
						{#if isSubmitting}
							<span class="loading loading-sm loading-spinner"></span>
						{:else if isFcfsMode}
							선착순 즉시 확정 신청 <Icon icon="mdi:check-decagram" class="ml-2 h-5 w-5" />
						{:else}
							승인 요청 제출 <Icon icon="mdi:send" class="ml-2 h-5 w-5" />
						{/if}
					</button>
				</form>
			</div>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 4. 신청 이력 (admin 목록 테이블 스타일) -->
	<!-- ===================================================================== -->
	<div
		class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg md:rounded-[2rem] md:shadow-2xl"
	>
		<div class="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6 md:p-8">
			<h3 class="text-lg font-black tracking-tighter text-slate-900 uppercase italic">
				Request Ledger
				<span class="not-italic ml-2 text-sm font-bold text-blue-600">최근 신청 이력 현황</span>
			</h3>
		</div>

		{#if data.dayoff_list && data.dayoff_list.length > 0}
			<div class="overflow-x-auto">
				<table class="table w-full">
					<thead
						class="border-b border-slate-100 bg-slate-50 text-[10px] font-bold tracking-widest text-slate-500 uppercase"
					>
						<tr>
							<th class="px-6 py-4">Application Date</th>
							<th>Category</th>
							<th>Status</th>
							<th>Reason (Memo)</th>
							<th class="px-6 text-right">Action</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-50">
						{#each data.dayoff_list as d (d.id)}
							<tr class="group transition-colors hover:bg-slate-50">
								<td class="px-6 py-4">
									<div class="flex items-center gap-3">
										<Icon icon="mdi:calendar-month-outline" class="h-5 w-5 text-slate-300" />
										<span class="font-bold text-slate-800">{d.date}</span>
									</div>
								</td>
								<td>
									<span
										class="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black tracking-tighter text-slate-700 uppercase"
									>
										{getTypeLabel(d.type)}
									</span>
								</td>
								<td>
									<span
										class="rounded-md border px-2 py-0.5 text-[10px] font-black tracking-tighter {getBadgeClass(
											d.status
										)}"
									>
										{STATUS_LABELS[d.status] || d.status}
									</span>
								</td>
								<td class="max-w-[200px] truncate text-xs text-slate-500 italic">
									{d.memo || '-'}
								</td>
								<td class="px-6 text-right">
									{#if canCancelEntry(d)}
										<form
											method="post"
											action="?/delete"
											use:enhance={handleDeleteEnhance}
											class="inline"
										>
											<input type="hidden" name="dayoff_id" value={d.id} />
											<button
												type="submit"
												class="btn rounded-lg font-black text-rose-500 uppercase btn-ghost btn-sm hover:bg-rose-50"
												onclick={(e: MouseEvent) => {
													if (!confirm('해당 휴무 신청을 취소하시겠습니까?')) e.preventDefault();
												}}
											>
												Cancel
											</button>
										</form>
									{:else}
										<span
											class="rounded-md border border-slate-100 px-3 py-1 text-[10px] font-black tracking-widest text-slate-300 uppercase"
										>
											Locked
										</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<div class="py-20 text-center">
				<Icon icon="mdi:database-off-outline" class="mx-auto mb-4 h-14 w-14 text-slate-200" />
				<p class="text-xl font-black tracking-widest text-slate-300 uppercase italic">
					Records Not Found
				</p>
				<p class="mt-2 text-xs font-bold text-slate-400">최근 신청한 결근계 내역이 없습니다.</p>
			</div>
		{/if}
	</div>
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: transparent;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #cbd5e1;
		border-radius: 10px;
	}
</style>
