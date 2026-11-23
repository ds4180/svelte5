<script lang="ts">
	/**
	 * ============================================================================
	 * [관리자 근태·휴무 관제 센터 (/v1/admin/dayoff/+page.svelte)]
	 * ============================================================================
	 * - 비즈니스 로직: $lib/services/dayoffAdminService
	 * - 탭 UI: 승인 목록 | 월간 캘린더 | 월간 타임라인 | 결근 내역 | 설정 (맨 오른쪽)
	 */
	import { onMount, untrack } from 'svelte';
	import * as api from '$lib/api/dayoff';
	import type { DayoffEntry, DayoffMonthlyQuotaDay, DayoffPolicy } from '$lib/api/dayoff';
	import DayoffApprovalListTab from '$lib/components/dayoff/DayoffApprovalListTab.svelte';
	import DayoffCalendarTab from '$lib/components/dayoff/DayoffCalendarTab.svelte';
	import DayoffTimelineTab from '$lib/components/dayoff/DayoffTimelineTab.svelte';
	import DayoffRecordsTab from '$lib/components/dayoff/DayoffRecordsTab.svelte';
	import DayoffSettingsTab from '$lib/components/dayoff/DayoffSettingsTab.svelte';
	import {
		buildDayoffCalendarEvents,
		buildTimelineLayout,
		buildTimelineMonthsMeta,
		computeDayoffMonthlyStats,
		computeSelectedDateQuotaInfo,
		computeTimelineStartStr,
		computeWorkTypeCounts,
		createDefaultDayoffPolicy,
		extractDisplaySettings,
		filterAndSortDayoffRecords,
		loadDayoffWorkspace,
		summarizeDayoffRecords,
		type DayoffRecordFilterState,
		type WorkTypeFilter
	} from '$lib/services/dayoffAdminService';
	import { getDayoffStatusLabel } from '$lib/utils/dayoff';
	import { getKstTimeSnapshot } from '$lib/utils/serverTime';
	import { getSiteTitle } from '$lib/config/site';
	import { toast } from '$lib/runes/toast.svelte';
	import Icon from '@iconify/svelte';

	let { data } = $props();

	const initialServerTime = untrack(() => data?.serverTime ?? getKstTimeSnapshot());
	const currentYear = initialServerTime.year;
	const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

	let dayoffs = $state<DayoffEntry[]>([]);
	let loading = $state(true);
	let currentView = $state<'list' | 'calendar' | 'timeline' | 'records' | 'settings'>('list');

	let workTypeFilter = $state<WorkTypeFilter>('ALL');
	let historyStatusFilter = $state<'ALL' | 'APPROVED' | 'REJECTED' | 'REQUESTED'>('ALL');
	let selectedYear = $state(currentYear);
	let selectedMonth = $state(initialServerTime.month);
	let selectedCalendarDate = $state<string | null>(initialServerTime.dateStr);
	let calendarStatusFilter = $state<'ALL' | 'APPROVED' | 'REQUESTED'>('ALL');

	// 결근 내역 탭 필터 & 페이지네이션
	let recordFilters = $state<DayoffRecordFilterState>({
		search: '',
		status: 'ALL',
		type: 'ALL',
		group: 'ALL',
		startDate: '',
		endDate: '',
		sort: 'date_desc'
	});
	let recordPage = $state(1);
	let recordPageSize = $state(20);

	// 타임라인 상태
	let timelineMonthsCount = $state(3);
	let timelineStatusFilter = $state<'APPROVED' | 'ALL' | 'REQUESTED'>('APPROVED');
	let quotaByMonthCache = $state<Record<string, Record<string, DayoffMonthlyQuotaDay>>>({});
	let loadingQuotaMonths = $state<Record<string, boolean>>({});

	// 정책 및 정원 상태
	let todayStr = $state(initialServerTime.dateStr);
	let policy = $state<DayoffPolicy>(createDefaultDayoffPolicy(initialServerTime.dateStr));
	let reservedPolicy = $state<DayoffPolicy | null>(null);
	let dateOverrides = $state<Record<string, number>>({});
	let availableGroups = $state<string[]>([]);
	let monthlyQuotaDays = $state<Record<string, DayoffMonthlyQuotaDay>>({});

	const filteredDayoffs = $derived.by(() =>
		workTypeFilter === 'ALL'
			? dayoffs
			: dayoffs.filter((d) => (d.work_type || 'APPROVAL') === workTypeFilter)
	);
	const workTypeCounts = $derived(computeWorkTypeCounts(dayoffs));
	const stats = $derived(computeDayoffMonthlyStats(filteredDayoffs, selectedYear, selectedMonth));
	const displaySettings = $derived(extractDisplaySettings(policy));

	const pendingList = $derived(filteredDayoffs.filter((d) => d.status === 'REQUESTED'));
	const processedOrFcfsList = $derived.by(() => {
		const base =
			workTypeFilter === 'FCFS'
				? filteredDayoffs
				: filteredDayoffs.filter((d) => d.status !== 'REQUESTED');
		return historyStatusFilter === 'ALL'
			? base
			: base.filter((d) => d.status === historyStatusFilter);
	});

	// 결근 내역 파생 상태
	const recordGroupOptions = $derived.by(() => {
		const set = new Set<string>();
		for (const d of dayoffs) if (d.primary_group) set.add(d.primary_group);
		return Array.from(set).sort((a, b) => a.localeCompare(b, 'ko'));
	});
	const filteredRecordList = $derived(filterAndSortDayoffRecords(filteredDayoffs, recordFilters));
	const recordSummary = $derived(summarizeDayoffRecords(filteredRecordList));
	const recordTotalPages = $derived(
		recordPageSize <= 0 ? 1 : Math.max(1, Math.ceil(filteredRecordList.length / recordPageSize))
	);
	const pagedRecordList = $derived.by(() => {
		if (recordPageSize <= 0) return filteredRecordList;
		const safePage = Math.min(recordPage, recordTotalPages);
		const start = (safePage - 1) * recordPageSize;
		return filteredRecordList.slice(start, start + recordPageSize);
	});

	$effect(() => {
		void [
			workTypeFilter,
			recordFilters.search,
			recordFilters.status,
			recordFilters.type,
			recordFilters.group,
			recordFilters.startDate,
			recordFilters.endDate,
			recordFilters.sort,
			recordPageSize
		];
		recordPage = 1;
	});

	function resetRecordFilters() {
		recordFilters = {
			search: '',
			status: 'ALL',
			type: 'ALL',
			group: 'ALL',
			startDate: '',
			endDate: '',
			sort: 'date_desc'
		};
		recordPage = 1;
	}

	// 월간 캘린더 파생 상태
	const calendarEvents = $derived(
		buildDayoffCalendarEvents({
			filteredDayoffs,
			monthlyQuotaDays,
			statusFilter: calendarStatusFilter,
			showQuotaBgAlarm: displaySettings.show_quota_bg_alarm
		})
	);
	const selectedDateDayoffs = $derived.by(() => {
		if (!selectedCalendarDate) return [];
		return filteredDayoffs.filter(
			(d) =>
				d.date === selectedCalendarDate &&
				d.status !== 'CANCELLED' &&
				(calendarStatusFilter === 'ALL' || d.status === calendarStatusFilter)
		);
	});
	const selectedDateQuotaInfo = $derived(
		computeSelectedDateQuotaInfo({
			selectedDate: selectedCalendarDate,
			monthlyQuotaDays,
			dateOverrides,
			policy,
			allDayoffs: dayoffs
		})
	);
	const dateOverrideCount = $derived(Object.keys(dateOverrides || {}).length);

	// 타임라인 파생 상태
	const timelineStartStr = $derived(computeTimelineStartStr(selectedYear, selectedMonth, todayStr));
	const timelineMonths = $derived(
		buildTimelineMonthsMeta(selectedYear, selectedMonth, timelineStartStr, timelineMonthsCount)
	);
	const timelineQuotaDays = $derived.by(() => {
		const merged: Record<string, DayoffMonthlyQuotaDay> = { ...(monthlyQuotaDays || {}) };
		for (const m of timelineMonths) {
			const chunk = quotaByMonthCache[m.key];
			if (chunk) Object.assign(merged, chunk);
		}
		return merged;
	});
	const timelineData = $derived(
		buildTimelineLayout({
			filteredDayoffs,
			statusFilter: timelineStatusFilter,
			timelineStartStr,
			timelineMonths,
			todayStr,
			timelineQuotaDays
		})
	);

	const inFlightQuotaKeys = new Set<string>();
	let lastLoadedQuotaKey = '';

	async function loadDayoffs() {
		loading = true;
		const y = selectedYear;
		const m = selectedMonth + 1;
		const key = `${y}-${m}`;
		lastLoadedQuotaKey = key;
		inFlightQuotaKeys.add(key);
		try {
			const ws = await loadDayoffWorkspace(y, m);
			dayoffs = ws.dayoffs;
			if (ws.policy) policy = ws.policy;
			reservedPolicy = ws.reservedPolicy;
			dateOverrides = ws.dateOverrides;
			if (ws.availableGroups) availableGroups = ws.availableGroups;
			monthlyQuotaDays = ws.monthlyQuotaDays;
			quotaByMonthCache = Object.keys(ws.monthlyQuotaDays).length
				? { [key]: ws.monthlyQuotaDays }
				: {};
		} catch (e: any) {
			toast.error(`데이터 로드 실패: ${e.message}`);
		} finally {
			inFlightQuotaKeys.delete(key);
			loading = false;
		}
	}

	$effect(() => {
		const y = selectedYear;
		const m = selectedMonth + 1;
		const key = `${y}-${m}`;
		if (!lastLoadedQuotaKey || lastLoadedQuotaKey === key) return;
		lastLoadedQuotaKey = key;
		inFlightQuotaKeys.add(key);
		api
			.adminGetDayoffPolicy(y, m)
			.then((res) => {
				const basePolicy = res?.today_policy || res?.policy;
				if (basePolicy) policy = basePolicy;
				reservedPolicy = res?.reserved_policy ?? null;
				if (res?.date_overrides) dateOverrides = res.date_overrides;
				if (res?.monthly_quota?.days) {
					monthlyQuotaDays = res.monthly_quota.days;
					quotaByMonthCache = { ...quotaByMonthCache, [key]: res.monthly_quota.days };
				}
			})
			.catch(() => {})
			.finally(() => inFlightQuotaKeys.delete(key));
	});

	let prevTimelineAnchor = '';
	$effect(() => {
		const anchor = `${selectedYear}-${selectedMonth}`;
		if (!prevTimelineAnchor) {
			prevTimelineAnchor = anchor;
			return;
		}
		if (anchor !== prevTimelineAnchor) {
			prevTimelineAnchor = anchor;
			timelineMonthsCount = 3;
		}
	});

	$effect(() => {
		if (currentView !== 'timeline') return;
		for (const item of timelineMonths) {
			if (quotaByMonthCache[item.key] || inFlightQuotaKeys.has(item.key)) continue;
			inFlightQuotaKeys.add(item.key);
			loadingQuotaMonths = { ...loadingQuotaMonths, [item.key]: true };
			api
				.adminGetDayoffPolicy(item.year, item.monthNum)
				.then((res) => {
					quotaByMonthCache = { ...quotaByMonthCache, [item.key]: res?.monthly_quota?.days || {} };
				})
				.catch(() => {
					quotaByMonthCache = { ...quotaByMonthCache, [item.key]: {} };
				})
				.finally(() => {
					inFlightQuotaKeys.delete(item.key);
					const next = { ...loadingQuotaMonths };
					delete next[item.key];
					loadingQuotaMonths = next;
				});
		}
	});

	function loadNextTimelineMonth() {
		if (Object.keys(loadingQuotaMonths).length > 0 || timelineMonthsCount >= 24) return;
		timelineMonthsCount += 1;
	}

	async function updateStatus(id: number, status: string) {
		try {
			await api.adminUpdateDayoffStatus(id, status);
			toast.success(`[${getDayoffStatusLabel(status)}] 처리가 완료되었습니다.`);
			await loadDayoffs();
		} catch (e: any) {
			toast.error(`상태 변경 실패: ${e.message}`);
		}
	}

	async function applyDateOverride(dates: string[], quota: number | null) {
		if (!dates?.length) return;
		try {
			const res = await api.adminUpdateDayoffDateOverride(dates, quota);
			if (res?.date_overrides) dateOverrides = res.date_overrides;
			toast.success(
				quota === null
					? `${dates.length}개 날짜의 정원이 기본값(${policy.daily_quota}명)으로 복원되었습니다.`
					: `${dates.length}개 날짜의 선착순 정원이 ${quota}명으로 설정되었습니다.`
			);
			await loadDayoffs();
		} catch (e: any) {
			toast.error(`특정일 정원 변경 실패: ${e.message}`);
		}
	}

	onMount(() => {
		const liveToday = getKstTimeSnapshot().dateStr;
		if (liveToday !== todayStr) todayStr = liveToday;
		loadDayoffs();
	});
</script>

<svelte:head>
	<title>{getSiteTitle('근태·휴무 관리')}</title>
</svelte:head>

<div
	class="mx-auto max-w-7xl space-y-6 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 lg:px-8 print:max-w-none print:space-y-4 print:p-0"
>
	<!-- 1. 헤더 & 액션 바 -->
	<div
		class="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between md:border-b-4 md:pb-8 print:hidden"
	>
		<div>
			<div class="flex items-center gap-2">
				<span
					class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-wider text-emerald-400"
				>
					<span class="h-2 w-2 animate-ping rounded-full bg-emerald-400"></span>
					통합 근태·인사 관제
				</span>
				<span class="text-xs font-bold text-slate-400">관리자 · 휴무/결근</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
				근태·휴무 <span class="text-blue-600">관리</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				전체 사원의 휴무(결근계) 신청 내역을 검토·승인하고 전사 캘린더, 타임라인, 결근 내역 및
				정책을 통제합니다.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-3">
			<button
				type="button"
				onclick={loadDayoffs}
				disabled={loading}
				class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
			>
				<Icon icon="solar:restart-bold" class="text-base {loading ? 'animate-spin' : ''}" />
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

	<!-- 2. 상단 4대 관제 지표 카드 -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-4 print:hidden">
		<div
			class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm"
		>
			<div class="flex w-full items-center justify-between gap-2">
				<span class="min-w-0 truncate text-xs font-black tracking-wider text-slate-400"
					>승인 대기</span
				>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600"
				>
					<Icon icon="solar:clock-circle-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-amber-600">
					{stats.requestedCount} <span class="text-xs font-normal text-slate-500">건</span>
				</div>
				<div class="mt-1 text-xs font-bold text-slate-400">검토 대기 중인 신청</div>
			</div>
		</div>

		<div
			class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm"
		>
			<div class="flex w-full items-center justify-between gap-2">
				<span class="min-w-0 truncate text-xs font-black tracking-wider text-slate-400">
					승인 확정 ({selectedMonth + 1}월)
				</span>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"
				>
					<Icon icon="solar:check-circle-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-emerald-600">
					{stats.approvedCount} <span class="text-xs font-normal text-slate-500">일</span>
				</div>
				<div class="mt-1 text-xs font-bold text-slate-400">
					{selectedYear}년 {selectedMonth + 1}월 승인 휴무
				</div>
			</div>
		</div>

		<div
			class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm"
		>
			<div class="flex w-full items-center justify-between gap-2">
				<span class="min-w-0 truncate text-xs font-black tracking-wider text-slate-400"
					>정기 연차</span
				>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"
				>
					<Icon icon="solar:calendar-date-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-blue-600">
					{stats.typeStats.ANNUAL} <span class="text-xs font-normal text-slate-500">일</span>
				</div>
				<div class="mt-1 text-xs font-bold text-slate-400">
					{selectedMonth + 1}월 정기 연차 사용
				</div>
			</div>
		</div>

		<div
			class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm"
		>
			<div class="flex w-full items-center justify-between gap-2">
				<span class="min-w-0 truncate text-xs font-black tracking-wider text-slate-400">
					기타 (병가·경조사·공가)
				</span>
				<div
					class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600"
				>
					<Icon icon="solar:hospital-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-rose-600">
					{stats.typeStats.SICK + stats.typeStats.SPECIAL + stats.typeStats.OFFICIAL}
					<span class="text-xs font-normal text-slate-500">일</span>
				</div>
				<div class="mt-1 text-xs font-bold text-slate-400">
					{selectedMonth + 1}월 병가·경조사·공가
				</div>
			</div>
		</div>
	</div>

	<!-- 3. 5대 탭 네비게이션 (설정 탭 항상 맨 오른쪽 마지막 위치) -->
	<div class="flex items-center overflow-x-auto border-b-2 border-slate-200 print:hidden">
		<button
			type="button"
			onclick={() => (currentView = 'list')}
			class="flex shrink-0 items-center gap-2 rounded-t-2xl border-b-4 px-5 py-3 text-xs font-black transition {currentView ===
			'list'
				? 'border-blue-600 bg-blue-50/50 text-blue-600'
				: 'border-transparent text-slate-500 hover:text-slate-900'}"
		>
			<Icon icon="solar:list-check-bold-duotone" class="text-base" />
			<span>신청 승인 목록</span>
			{#if stats.requestedCount > 0}
				<span class="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">
					{stats.requestedCount}
				</span>
			{/if}
		</button>
		<button
			type="button"
			onclick={() => (currentView = 'calendar')}
			class="flex shrink-0 items-center gap-2 rounded-t-2xl border-b-4 px-5 py-3 text-xs font-black transition {currentView ===
			'calendar'
				? 'border-blue-600 bg-blue-50/50 text-blue-600'
				: 'border-transparent text-slate-500 hover:text-slate-900'}"
		>
			<Icon icon="solar:calendar-mark-bold-duotone" class="text-base" />
			<span>월간 캘린더</span>
		</button>
		<button
			type="button"
			onclick={() => (currentView = 'timeline')}
			class="flex shrink-0 items-center gap-2 rounded-t-2xl border-b-4 px-5 py-3 text-xs font-black transition {currentView ===
			'timeline'
				? 'border-blue-600 bg-blue-50/50 text-blue-600'
				: 'border-transparent text-slate-500 hover:text-slate-900'}"
		>
			<Icon icon="solar:calendar-bold-duotone" class="text-base" />
			<span>월간 타임라인 현황</span>
		</button>
		<button
			type="button"
			onclick={() => (currentView = 'records')}
			class="flex shrink-0 items-center gap-2 rounded-t-2xl border-b-4 px-5 py-3 text-xs font-black transition {currentView ===
			'records'
				? 'border-blue-600 bg-blue-50/50 text-blue-600'
				: 'border-transparent text-slate-500 hover:text-slate-900'}"
		>
			<Icon icon="solar:document-text-bold-duotone" class="text-base" />
			<span>결근 내역</span>
			<span class="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-700">
				{filteredDayoffs.length}
			</span>
		</button>
		<button
			type="button"
			onclick={() => (currentView = 'settings')}
			class="ml-auto flex shrink-0 items-center gap-2 rounded-t-2xl border-b-4 px-5 py-3 text-xs font-black transition {currentView ===
			'settings'
				? 'border-blue-600 bg-blue-50/50 text-blue-600'
				: 'border-transparent text-slate-500 hover:text-slate-900'}"
		>
			<Icon icon="solar:settings-bold-duotone" class="text-base" />
			<span>설정</span>
		</button>
	</div>

	<!-- 3-1. 직군 필터 & 현재 적용 정책 요약 배지 (설정 탭 제외) -->
	{#if currentView !== 'settings'}
		<div
			class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm print:hidden"
		>
			<div class="flex flex-wrap items-center gap-2">
				<span class="mr-1 text-xs font-black tracking-wider text-slate-400 uppercase"
					>직군 구분:</span
				>
				<div
					class="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-black"
				>
					{#each [{ id: 'ALL', label: `전체 직군 (${workTypeCounts.all})`, active: 'bg-slate-900 text-white shadow-sm' }, { id: 'APPROVAL', label: `🏢 사무직 (승인제 · ${workTypeCounts.approval})`, active: 'bg-blue-600 text-white shadow-sm' }, { id: 'FCFS', label: `🚌 운전직 (선착순 · ${workTypeCounts.fcfs})`, active: 'bg-emerald-600 text-white shadow-sm' }] as wt (wt.id)}
						<button
							type="button"
							onclick={() => {
								workTypeFilter = wt.id as WorkTypeFilter;
								historyStatusFilter = 'ALL';
							}}
							class="rounded-lg px-3.5 py-1.5 transition {workTypeFilter === wt.id
								? wt.active
								: 'text-slate-600 hover:text-slate-900'}"
						>
							{wt.label}
						</button>
					{/each}
				</div>
			</div>

			<div class="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
				<span
					class="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700"
				>
					🚌 운전직 기본 정원: 일 {policy.daily_quota}명
				</span>
				{#if policy.max_monthly_count > 0}
					<span
						class="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700"
					>
						월 최대 {policy.max_monthly_count}회
					</span>
				{/if}
				{#if policy.max_days_per_request > 0}
					<span
						class="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700"
					>
						1회 최대 {policy.max_days_per_request}일
					</span>
				{/if}
				{#if reservedPolicy}
					<span
						class="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700"
					>
						📅 예약됨: {reservedPolicy.effective_date} (정원 {reservedPolicy.daily_quota}명)
					</span>
				{/if}
				{#if dateOverrideCount > 0}
					<span
						class="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-800"
					>
						⚡ 특정일 예외 정원: {dateOverrideCount}일
					</span>
				{/if}
			</div>
		</div>
	{/if}

	<!-- 4. 탭 본문 렌더링 -->
	{#if currentView === 'list'}
		<DayoffApprovalListTab
			{loading}
			{workTypeFilter}
			{pendingList}
			{processedOrFcfsList}
			bind:historyStatusFilter
			onUpdateStatus={updateStatus}
		/>
	{:else if currentView === 'calendar'}
		<DayoffCalendarTab
			bind:selectedYear
			bind:selectedMonth
			bind:selectedCalendarDate
			{todayStr}
			{calendarEvents}
			bind:calendarStatusFilter
			{monthlyQuotaDays}
			{selectedDateQuotaInfo}
			{selectedDateDayoffs}
			onApplyOverride={applyDateOverride}
			onUpdateStatus={updateStatus}
		/>
	{:else if currentView === 'timeline'}
		<DayoffTimelineTab
			bind:selectedYear
			bind:selectedMonth
			{yearOptions}
			{timelineMonths}
			{timelineMonthsCount}
			bind:timelineStatusFilter
			{timelineData}
			{loadingQuotaMonths}
			onLoadNextMonth={loadNextTimelineMonth}
		/>
	{:else if currentView === 'records'}
		<DayoffRecordsTab
			{loading}
			{todayStr}
			{workTypeFilter}
			bind:filters={recordFilters}
			groupOptions={recordGroupOptions}
			{filteredRecordList}
			{pagedRecordList}
			{recordSummary}
			bind:recordPage
			bind:recordPageSize
			{recordTotalPages}
			onResetFilters={resetRecordFilters}
			onUpdateStatus={updateStatus}
		/>
	{:else if currentView === 'settings'}
		<DayoffSettingsTab
			{todayStr}
			todayPolicy={policy}
			{reservedPolicy}
			{dateOverrides}
			{availableGroups}
			onSaved={loadDayoffs}
			onApplyOverride={applyDateOverride}
		/>
	{/if}
</div>
