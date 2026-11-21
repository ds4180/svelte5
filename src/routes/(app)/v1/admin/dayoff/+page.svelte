<script>
	/**
	 * @file +page.svelte (Admin Day-Off Management)
	 * @description [v3.1] 관리자 전용 결근계 관리 및 직군별(사무직 승인제 vs 운전직 선착순) 정책·정원 관제 시스템.
	 *              승인 대기 목록(List), 월간 캘린더(Calendar), 월간 타임라인(Timeline), 선착순·정원 정책(Policy) 4가지 뷰를 제공합니다.
	 * @standard Svelte 5 Runes ($state, $derived, $effect)
	 */
	import { onMount, untrack } from 'svelte';
	import * as api from '$lib/api/dayoff';
	import Icon from '@iconify/svelte';
	import Calendar from '$lib/components/Calendar.svelte';
	import DayoffPolicyModal from '$lib/components/DayoffPolicyModal.svelte';
	import DayoffDateOverrideModal from '$lib/components/DayoffDateOverrideModal.svelte';
	import DayoffDateQuotaCard from '$lib/components/DayoffDateQuotaCard.svelte';
	import { formatDateTime, timestampToDateString } from '$lib/utils';
	import {
		getDayoffTypeLabel,
		groupConsecutiveDayoffs,
		getDatesInRange,
		getDayColor,
		getDayLabel,
		getDayoffBadgeClass as getBadgeClass
	} from '$lib/utils/dayoff';
	import { getKstTimeSnapshot } from '$lib/utils/serverTime';
	import { getSiteTitle } from '$lib/config/site';
	import { toast } from '$lib/runes/toast.svelte';

	let { data } = $props();

	/**
	 * @typedef {Object} DayoffEntry
	 * @property {number} id - 고유 ID
	 * @property {number} user_id - 사용자 ID
	 * @property {string} username - 사용자 계정명
	 * @property {string} real_name - 사용자 실명
	 * @property {string} [primary_group] - 주그룹 코드
	 * @property {number} [rank_level] - 권한 랭크 (0~9)
	 * @property {'FCFS' | 'APPROVAL'} [work_type] - 운전직(선착순) | 사무직(승인제)
	 * @property {string} date - 휴무 일자 (YYYY-MM-DD)
	 * @property {string} type - ANNUAL(연차), SICK(병가), SPECIAL(경조사), OFFICIAL(공가)
	 * @property {string} status - REQUESTED, APPROVED, REJECTED, CANCELLED
	 * @property {string} memo - 사유
	 * @property {string} group_id - 그룹 ID (연속된 날짜 신청용)
	 * @property {string} create_date - 등록 시각
	 */

	const initialServerTime = untrack(() => data?.serverTime ?? getKstTimeSnapshot());
	const currentYear = initialServerTime.year;
	const yearOptions = [currentYear - 1, currentYear, currentYear + 1];

	/** @type {DayoffEntry[]} 전체 데이터 저장용 상태 */
	let dayoffs = $state([]);

	/** @type {boolean} 로딩 상태 제어 */
	let loading = $state(true);

	/** @type {'list' | 'calendar' | 'timeline' | 'records'} 현재 탭 보기 형식 */
	let currentView = $state('list');

	// =====================================================================
	// 📋 '결근 내역' 게시판 리스트 탭 전용 검색 · 필터링 · 정렬 · 페이지네이션 상태
	// =====================================================================
	/** @type {string} 검색어 (이름, 아이디, 부서, 사유, 신청일) */
	let recordSearch = $state('');
	/** @type {'ALL' | 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED'} 상태 필터 */
	let recordStatusFilter = $state('ALL');
	/** @type {'ALL' | 'ANNUAL' | 'SICK' | 'SPECIAL' | 'OFFICIAL'} 유형 필터 */
	let recordTypeFilter = $state('ALL');
	/** @type {string} 부서(주그룹) 필터 ('ALL' 또는 그룹명) */
	let recordGroupFilter = $state('ALL');
	/** @type {string} 시작일 필터 ('YYYY-MM-DD') */
	let recordStartDate = $state('');
	/** @type {string} 종료일 필터 ('YYYY-MM-DD') */
	let recordEndDate = $state('');
	/** @type {'date_desc' | 'date_asc' | 'created_desc' | 'name_asc'} 정렬 기준 */
	let recordSort = $state('date_desc');
	/** @type {number} 현재 페이지 (1부터 시작) */
	let recordPage = $state(1);
	/** @type {number} 페이지당 표시 행 수 (0이면 전체 표시) */
	let recordPageSize = $state(20);

	/** 상태 코드 → 한글 레이블 변환 */
	/** @param {string} s */
	function getStatusLabel(s) {
		if (s === 'REQUESTED') return '승인 대기';
		if (s === 'APPROVED') return '승인 확정';
		if (s === 'REJECTED') return '반려';
		if (s === 'CANCELLED') return '취소';
		return s || '-';
	}

	/** 결근 내역에 존재하는 고유 부서(주그룹) 목록 */
	let recordGroupOptions = $derived.by(() => {
		const set = new Set();
		for (const d of dayoffs) {
			if (d.primary_group) set.add(d.primary_group);
		}
		return Array.from(set).sort((a, b) => String(a).localeCompare(String(b), 'ko'));
	});

	/** 검색·필터·정렬이 적용된 전체 결근 내역 리스트 */
	let filteredRecordList = $derived.by(() => {
		const q = recordSearch.trim().toLowerCase();
		const list = filteredDayoffs.filter((d) => {
			if (recordStatusFilter !== 'ALL' && d.status !== recordStatusFilter) return false;
			if (recordTypeFilter !== 'ALL' && d.type !== recordTypeFilter) return false;
			if (recordGroupFilter !== 'ALL' && (d.primary_group || '미지정') !== recordGroupFilter)
				return false;
			if (recordStartDate && d.date < recordStartDate) return false;
			if (recordEndDate && d.date > recordEndDate) return false;
			if (q) {
				const haystack = [
					d.real_name,
					d.username,
					d.primary_group,
					d.date,
					d.memo,
					getTypeLabel(d.type),
					getStatusLabel(d.status)
				]
					.filter(Boolean)
					.join(' ')
					.toLowerCase();
				if (!haystack.includes(q)) return false;
			}
			return true;
		});

		const sorted = [...list];
		if (recordSort === 'date_desc') {
			sorted.sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id);
		} else if (recordSort === 'date_asc') {
			sorted.sort((a, b) => (a.date || '').localeCompare(b.date || '') || a.id - b.id);
		} else if (recordSort === 'created_desc') {
			sorted.sort(
				(a, b) => (b.create_date || '').localeCompare(a.create_date || '') || b.id - a.id
			);
		} else if (recordSort === 'name_asc') {
			sorted.sort((a, b) =>
				(a.real_name || a.username || '').localeCompare(b.real_name || b.username || '', 'ko')
			);
		}
		return sorted;
	});

	/** 필터링된 결근 내역 요약 집계 */
	let recordSummary = $derived.by(() => {
		let approved = 0;
		let requested = 0;
		let rejected = 0;
		let cancelled = 0;
		for (const d of filteredRecordList) {
			if (d.status === 'APPROVED') approved++;
			else if (d.status === 'REQUESTED') requested++;
			else if (d.status === 'REJECTED') rejected++;
			else if (d.status === 'CANCELLED') cancelled++;
		}
		return {
			total: filteredRecordList.length,
			approved,
			requested,
			rejected,
			cancelled
		};
	});

	/** 페이지네이션 계산 */
	let recordTotalPages = $derived(
		recordPageSize <= 0 ? 1 : Math.max(1, Math.ceil(filteredRecordList.length / recordPageSize))
	);
	let pagedRecordList = $derived.by(() => {
		if (recordPageSize <= 0) return filteredRecordList;
		const safePage = Math.min(recordPage, recordTotalPages);
		const start = (safePage - 1) * recordPageSize;
		return filteredRecordList.slice(start, start + recordPageSize);
	});

	// 필터 조건이 바뀌면 1페이지로 자동 복귀
	$effect(() => {
		void [
			workTypeFilter,
			recordSearch,
			recordStatusFilter,
			recordTypeFilter,
			recordGroupFilter,
			recordStartDate,
			recordEndDate,
			recordSort,
			recordPageSize
		];
		recordPage = 1;
	});

	/** 결근 내역 검색·필터 초기화 */
	function resetRecordFilters() {
		recordSearch = '';
		recordStatusFilter = 'ALL';
		recordTypeFilter = 'ALL';
		recordGroupFilter = 'ALL';
		recordStartDate = '';
		recordEndDate = '';
		recordSort = 'date_desc';
		recordPage = 1;
	}

	/** 결근 내역 전용 인쇄 실행 (필터링된 전체 건을 A4 표로 인쇄) */
	function printRecordLedger() {
		if (typeof window === 'undefined') return;
		window.print();
	}

	/** @type {'ALL' | 'APPROVAL' | 'FCFS'} 직군(운영 방식) 필터 */
	let workTypeFilter = $state('ALL');

	/** @type {'ALL' | 'APPROVED' | 'REJECTED' | 'REQUESTED'} 처리 완료 및 선착순 목록 상태 필터 */
	let historyStatusFilter = $state('ALL');

	/** @type {boolean} 선착순·정원 정책 설정 모달 표시 상태 */
	let showPolicyModal = $state(false);

	/** @type {boolean} 특정일 예외 정원 관리 모달 표시 상태 */
	let showOverrideModal = $state(false);

	/** @type {number} 월간 조회를 위한 연도 선택 (캘린더/타임라인 공용 동기화) */
	let selectedYear = $state(currentYear);

	/** @type {number} 월간 조회를 위한 월 선택 (0-11, 캘린더/타임라인 공용 동기화) */
	let selectedMonth = $state(initialServerTime.month);

	/** @type {string | null} 캘린더에서 선택된 날짜 ('YYYY-MM-DD') */
	let selectedCalendarDate = $state(initialServerTime.dateStr);

	/** @type {'ALL' | 'APPROVED' | 'REQUESTED'} 캘린더 상태 필터 */
	let calendarStatusFilter = $state('ALL');

	/** @type {number} 타임라인 연속 표시 개월 수 (기본 3개월, 하단 스크롤 시 +1개월 자동 연장) */
	let timelineMonthsCount = $state(3);

	/** @type {'APPROVED' | 'ALL' | 'REQUESTED'} 타임라인 상태 필터 */
	let timelineStatusFilter = $state('APPROVED');

	/** @type {Record<string, Record<string, any>>} 월별('YYYY-M') 선착순 정원 days 캐시 */
	let quotaByMonthCache = $state({});

	/** @type {Record<string, boolean>} 월별 정원 API 로딩 진행 상태 */
	let loadingQuotaMonths = $state({});

	/** @type {HTMLElement | null} 타임라인 스크롤 컨테이너 */
	let timelineScrollEl = $state(null);

	/** @type {HTMLElement | null} 타임라인 영속 스크롤 하단 센티넬 */
	let timelineSentinelEl = $state(null);

	/** @type {{ entry: DayoffEntry, span: any, left: number, top: number, placeBelow: boolean } | null} */
	let hoveredTimelineInfo = $state(null);

	/** @type {string | null} 현재 마우스 오버 중인 연속 결근 Span 키 */
	let hoveredSpanKey = $state(null);

	// =====================================================================
	// ⚙️ 선착순(운전직) vs 승인제(사무직) 오늘 적용 정책 · 예약(1건) · 예외 정원 상태
	// =====================================================================
	let todayStr = $state(initialServerTime.dateStr);

	/** @type {{ effective_date: string, classify_mode: string, fcfs_groups: string[], fcfs_ranks: number[], daily_quota: number, max_monthly_count: number, max_days_per_request: number, min_advance_days: number, max_advance_days: number, etc: Record<string, any> }} */
	let policy = $state({
		effective_date: initialServerTime.dateStr,
		classify_mode: 'BOTH',
		fcfs_groups: ['운전직', '운수팀', '운수1팀', '운수2팀'],
		fcfs_ranks: [1],
		daily_quota: 3,
		max_monthly_count: 0,
		max_days_per_request: 0,
		min_advance_days: 0,
		max_advance_days: 0,
		etc: {}
	});

	/** @type {any | null} 오늘 이후 적용 예정인 예약 정책 (최대 1건) */
	let reservedPolicy = $state(null);

	/** @type {Record<string, number>} 특정일 예외 정원 맵 (정책 이력과 완전 분리) */
	let dateOverrides = $state({});

	/** @type {string[]} 선택 가능한 그룹 후보 목록 */
	let availableGroups = $state(['운전직', '운수팀', '사무직', '관리팀']);

	/** @type {Record<string, any>} 선택된 월의 일자별 정원/신청 현황 */
	let monthlyQuotaDays = $state({});

	const getTypeLabel = getDayoffTypeLabel;

	/** 직군 필터가 적용된 휴무 목록 */
	let filteredDayoffs = $derived.by(() => {
		if (workTypeFilter === 'ALL') return dayoffs;
		return dayoffs.filter((d) => (d.work_type || 'APPROVAL') === workTypeFilter);
	});

	/** 직군별 전체 건수 */
	let workTypeCounts = $derived.by(() => {
		const fcfs = dayoffs.filter((d) => d.work_type === 'FCFS').length;
		return {
			all: dayoffs.length,
			fcfs,
			approval: dayoffs.length - fcfs
		};
	});

	/** 승인 대기(REQUESTED) 목록 */
	let pendingList = $derived(filteredDayoffs.filter((d) => d.status === 'REQUESTED'));

	/** 선착순(FCFS) 전체 또는 처리 완료(APPROVED/REJECTED) 목록 */
	let processedOrFcfsList = $derived.by(() => {
		const base =
			workTypeFilter === 'FCFS'
				? filteredDayoffs
				: filteredDayoffs.filter((d) => d.status !== 'REQUESTED');
		if (historyStatusFilter === 'ALL') return base;
		return base.filter((d) => d.status === historyStatusFilter);
	});

	/**
	 * 선택된 연/월 기준('YYYY-MM-') 실시간 통계 지표 계산
	 */
	let stats = $derived.by(() => {
		const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-`;
		const approvedThisMonth = filteredDayoffs.filter(
			(d) => d.status === 'APPROVED' && d.date?.startsWith(monthPrefix)
		);
		const requested = filteredDayoffs.filter((d) => d.status === 'REQUESTED');
		return {
			total: filteredDayoffs.length,
			approvedCount: approvedThisMonth.length,
			requestedCount: requested.length,
			fcfsApprovedThisMonth: approvedThisMonth.filter((d) => d.work_type === 'FCFS').length,
			officeApprovedThisMonth: approvedThisMonth.filter((d) => d.work_type !== 'FCFS').length,
			typeStats: {
				ANNUAL: approvedThisMonth.filter((d) => d.type === 'ANNUAL').length,
				SICK: approvedThisMonth.filter((d) => d.type === 'SICK').length,
				SPECIAL: approvedThisMonth.filter((d) => d.type === 'SPECIAL').length,
				OFFICIAL: approvedThisMonth.filter((d) => d.type === 'OFFICIAL').length
			}
		};
	});

	/**
	 * 전체 사원 휴무 이력 + 일자별 선착순 정원/마감 현황을 공용 Calendar 이벤트로 변환합니다.
	 */
	let calendarEvents = $derived.by(() => {
		const spans = groupConsecutiveDayoffs(filteredDayoffs, calendarStatusFilter);

		/** @type {any[]} */
		const events = [];

		// 1. 운전직 선착순 마감일 배경 알람 및 특정일 예외 정원 배지 표시
		for (const [dStr, qInfo] of Object.entries(monthlyQuotaDays || {})) {
			if (!qInfo) continue;
			if (qInfo.is_full) {
				events.push({
					id: `admin-quota-full-${dStr}`,
					date: dStr,
					title:
						qInfo.quota === 0
							? `선착순 신청불가 (정원 0명)`
							: `운전직 마감 (${qInfo.approved_count}/${qInfo.quota}명)`,
					type: 'DANGER',
					display: 'background',
					badge: '마감'
				});
			} else if (qInfo.is_override) {
				events.push({
					id: `admin-quota-override-${dStr}`,
					date: dStr,
					title: `⚡예외정원 ${qInfo.approved_count}/${qInfo.quota}명`,
					type: 'INFO',
					display: 'background',
					badge: `정원${qInfo.quota}`
				});
			}
		}

		// 2. 사원별 휴무 일정 연속선 표시
		for (const sp of spans) {
			const startRow = sp.firstEntry;
			const staffName = startRow.real_name || startRow.username || `사원#${startRow.user_id}`;
			const typeLabel = getTypeLabel(startRow.type);
			const isApproved = startRow.status === 'APPROVED';
			const isFcfs = startRow.work_type === 'FCFS';
			events.push({
				id: sp.spanKey,
				date: sp.startDate,
				endDate: sp.isMultiDay ? sp.endDate : null,
				title: `${isFcfs ? '🚌' : '🏢'}${staffName} (${typeLabel})`,
				type: isApproved ? 'SUCCESS' : 'WARNING',
				display: 'bar',
				badge: isApproved ? (isFcfs ? '선착순' : '승인') : '대기',
				raw: startRow
			});
		}

		return events;
	});

	/** 캘린더에서 선택한 날짜에 해당하는 휴무 내역 */
	let selectedDateDayoffs = $derived.by(() => {
		if (!selectedCalendarDate) return [];
		return filteredDayoffs.filter(
			(d) =>
				d.date === selectedCalendarDate &&
				d.status !== 'CANCELLED' &&
				(calendarStatusFilter === 'ALL' || d.status === calendarStatusFilter)
		);
	});

	/** 캘린더에서 선택한 날짜의 선착순 정원 상세 정보 (서버 monthlyQuotaDays · 분리된 dateOverrides 기준) */
	let selectedDateQuotaInfo = $derived.by(() => {
		if (!selectedCalendarDate) return null;
		const dayFromServer = monthlyQuotaDays?.[selectedCalendarDate];
		const isOverride = dayFromServer
			? Boolean(dayFromServer.is_override)
			: selectedCalendarDate in (dateOverrides || {});
		const baseQuota = Number(policy?.daily_quota ?? 3);
		const quota = dayFromServer
			? Number(dayFromServer.quota)
			: isOverride
				? Number(dateOverrides[selectedCalendarDate])
				: baseQuota;
		const approvedFcfsCount = dayoffs.filter(
			(d) =>
				d.date === selectedCalendarDate &&
				d.status === 'APPROVED' &&
				d.work_type === 'FCFS'
		).length;
		return {
			date: selectedCalendarDate,
			quota,
			baseQuota,
			effectiveDate: dayFromServer?.effective_date || policy?.effective_date,
			isOverride,
			approvedCount: approvedFcfsCount,
			remaining: Math.max(0, quota - approvedFcfsCount),
			isFull: approvedFcfsCount >= quota
		};
	});

	/** 예외 정원 개수 */
	let dateOverrideCount = $derived(Object.keys(dateOverrides || {}).length);

	/** 타임라인 시작일 (이번 달 선택 시 오늘 기준 D-5일부터, 다른 달 선택 시 해당 월 1일부터) */
	let timelineStartStr = $derived.by(() => {
		const [ty, tm, td] = String(todayStr).split('-').map(Number);
		if (selectedYear === ty && selectedMonth === tm - 1) {
			return timestampToDateString(new Date(ty, tm - 1, td - 5).getTime());
		}
		return `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
	});

	/** @type {Array<{ year: number, monthIndex: number, monthNum: number, key: string, label: string }>} 타임라인 연속 월 메타 목록 */
	let timelineMonths = $derived.by(() => {
		const list = [];
		const startMonthStr = timelineStartStr.slice(0, 7);
		const selectedMonthStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
		// D-5가 전달로 넘어간 경우 전달 정원 데이터도 함께 조회
		if (startMonthStr < selectedMonthStr) {
			const [py, pm] = startMonthStr.split('-').map(Number);
			list.push({
				year: py,
				monthIndex: pm - 1,
				monthNum: pm,
				key: `${py}-${pm}`,
				label: `${py}년 ${pm}월`
			});
		}
		for (let offset = 0; offset < timelineMonthsCount; offset++) {
			const dt = new Date(selectedYear, selectedMonth + offset, 1);
			const y = dt.getFullYear();
			const mIdx = dt.getMonth();
			const mNum = mIdx + 1;
			list.push({
				year: y,
				monthIndex: mIdx,
				monthNum: mNum,
				key: `${y}-${mNum}`,
				label: `${y}년 ${mNum}월`
			});
		}
		return list;
	});

	/** @type {Record<string, any>} 타임라인 표시 구간 전체의 병합된 일자별 선착순 정원 맵 */
	let timelineQuotaDays = $derived.by(() => {
		/** @type {Record<string, any>} */
		const merged = { ...(monthlyQuotaDays || {}) };
		for (const m of timelineMonths) {
			const chunk = quotaByMonthCache[m.key];
			if (chunk) Object.assign(merged, chunk);
		}
		return merged;
	});

	/**
	 * @derived timelineData
	 * @description 시작 기준일(이번 달은 D-5일, 다른 달은 1일)부터 연속 N개월을 달 경계 없이 이어 붙이고,
	 *              Calendar.svelte의 단차 0px 트랙 배정 알고리즘으로 직선 레인(Track 0, 1, 2...)을 산출합니다.
	 */
	let timelineData = $derived.by(() => {
		if (timelineMonths.length === 0) {
			return { days: [], maxTrackCount: 0, totalEntries: 0 };
		}

		const lastMonth = timelineMonths[timelineMonths.length - 1];
		const rangeStartStr = timelineStartStr;
		const endMonthLastDay = new Date(lastMonth.year, lastMonth.monthIndex + 1, 0).getDate();
		const rangeEndStr = `${lastMonth.year}-${String(lastMonth.monthNum).padStart(2, '0')}-${String(endMonthLastDay).padStart(2, '0')}`;

		// 1. 연속 결근 Span 추출 및 다일(연속) -> 시작일 빠른 순 -> 기간 긴 순 정렬
		const spans = groupConsecutiveDayoffs(filteredDayoffs, timelineStatusFilter).filter(
			(sp) => sp.endDate >= rangeStartStr && sp.startDate <= rangeEndStr
		);
		spans.sort((a, b) => {
			const aMulti = a.isMultiDay ? 1 : 0;
			const bMulti = b.isMultiDay ? 1 : 0;
			if (aMulti !== bMulti) return bMulti - aMulti;
			if (a.startDate !== b.startDate) return a.startDate.localeCompare(b.startDate);
			if (a.endDate !== b.endDate) return b.endDate.localeCompare(a.endDate);
			const aName = a.firstEntry.real_name || a.firstEntry.username || '';
			const bName = b.firstEntry.real_name || b.firstEntry.username || '';
			return aName.localeCompare(bName);
		});

		// 2. 전체 가시 구간(다개월 연속) 기준 고정 트랙 번호(trackIndex) 배정 -> 단차 0px 세로 직선
		/** @type {Map<string, Array<any | null>>} */
		const tracksByDate = new Map();
		let maxTrackCount = 0;

		for (const sp of spans) {
			const visStart = sp.startDate < rangeStartStr ? rangeStartStr : sp.startDate;
			const visEnd = sp.endDate > rangeEndStr ? rangeEndStr : sp.endDate;
			const visDays = getDatesInRange(visStart, visEnd, 800);
			if (visDays.length === 0) continue;

			let trackIndex = 0;
			while (true) {
				const isFree = visDays.every((dStr) => {
					const rowTracks = tracksByDate.get(dStr);
					return !rowTracks || !rowTracks[trackIndex];
				});
				if (isFree) break;
				trackIndex++;
			}

			if (trackIndex + 1 > maxTrackCount) {
				maxTrackCount = trackIndex + 1;
			}

			for (let idx = 0; idx < visDays.length; idx++) {
				const dStr = visDays[idx];
				const rowTracks = tracksByDate.get(dStr) || [];
				while (rowTracks.length <= trackIndex) rowTracks.push(null);
				const entry = sp.entryByDate.get(dStr) || sp.firstEntry;
				rowTracks[trackIndex] = {
					span: sp,
					entry,
					trackIndex,
					dayNumberInSpan: idx + 1,
					totalDaysInSpan: sp.entries.length,
					isStart: dStr === sp.startDate,
					isEnd: dStr === sp.endDate,
					isVisibleFirst: idx === 0,
					isVisibleLast: idx === visDays.length - 1,
					isMultiDay: sp.isMultiDay
				};
				tracksByDate.set(dStr, rowTracks);
			}
		}

		// 3. 달 경계로 끊기지 않는 연속 일자 행 배열 생성 (rangeStartStr ~ rangeEndStr)
		/** @type {Array<{ date: string, year: number, monthNum: number, day: number, dayOfWeek: number, isToday: boolean, isMonthStart: boolean, qInfo: any, tracks: Array<any | null>, activeCount: number }>} */
		const days = [];
		let totalEntries = 0;

		for (const dateStr of getDatesInRange(rangeStartStr, rangeEndStr, 800)) {
			const [y, mNum, d] = dateStr.split('-').map(Number);
			const dayOfWeek = new Date(y, mNum - 1, d).getDay();
			const tracks = tracksByDate.get(dateStr) || [];
			const activeCount = tracks.reduce((acc, s) => (s ? acc + 1 : acc), 0);
			totalEntries += activeCount;
			days.push({
				date: dateStr,
				year: y,
				monthNum: mNum,
				day: d,
				dayOfWeek,
				isToday: dateStr === todayStr,
				isMonthStart: d === 1,
				qInfo: timelineQuotaDays[dateStr],
				tracks,
				activeCount
			});
		}

		return { days, maxTrackCount, totalEntries };
	});

	/**
	 * 타임라인 트랙 색상 스타일 반환
	 * @param {DayoffEntry} entry
	 */
	function getTimelineSlotStyle(entry) {
		if (entry.status === 'REQUESTED') {
			return {
				line: 'bg-amber-400',
				lineActive: 'bg-amber-500 ring-2 ring-amber-200',
				chip: 'border-amber-300 bg-amber-50 text-amber-900',
				avatar: 'bg-amber-500',
				dot: 'bg-amber-500',
				subText: 'text-amber-700'
			};
		}
		if (entry.work_type === 'FCFS') {
			return {
				line: 'bg-emerald-500',
				lineActive: 'bg-emerald-600 ring-2 ring-emerald-200',
				chip: 'border-emerald-200 bg-white text-slate-900',
				avatar: 'bg-emerald-700',
				dot: 'bg-emerald-600',
				subText: 'text-emerald-700'
			};
		}
		return {
			line: 'bg-blue-600',
			lineActive: 'bg-blue-700 ring-2 ring-blue-200',
			chip: 'border-slate-200 bg-white text-slate-900',
			avatar: 'bg-slate-900',
			dot: 'bg-blue-600',
			subText: 'text-blue-600'
		};
	}

	/**
	 * 스크롤/overflow 클리핑 없는 고정 좌표 상세 툴팁 표시
	 * @param {MouseEvent | FocusEvent} e
	 * @param {any} slot
	 */
	function showTimelineTooltip(e, slot) {
		const el = /** @type {HTMLElement} */ (e.currentTarget);
		if (!el) return;
		const rect = el.getBoundingClientRect();
		const placeBelow = rect.top < 190;
		const clampedLeft = Math.max(120, Math.min(window.innerWidth - 120, rect.left + rect.width / 2));
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

	/** @type {Set<string>} 중복 정원 API 호출 방지용 비반응형 Set */
	const inFlightQuotaKeys = new Set();

	/** @type {string} 마지막으로 조회한 연-월 키 (초기 마운트 시 중복 호출 방지) */
	let lastLoadedQuotaKey = '';

	/**
	 * 백엔드 API를 통해 전체 휴무 내역 및 선착순·정원 정책 로드
	 */
	async function loadDayoffs() {
		loading = true;
		const y = selectedYear;
		const m = selectedMonth + 1;
		const key = `${y}-${m}`;
		lastLoadedQuotaKey = key;
		inFlightQuotaKeys.add(key);
		try {
			const [dayoffRes, policyRes] = await Promise.all([
				api.adminGetAllDayoffs(),
				api.adminGetDayoffPolicy(y, m)
			]);
			dayoffs = Array.isArray(dayoffRes) ? dayoffRes : dayoffRes.data || [];
			const basePolicy = policyRes?.today_policy || policyRes?.policy;
			if (basePolicy) policy = basePolicy;
			reservedPolicy = policyRes?.reserved_policy ?? null;
			dateOverrides = policyRes?.date_overrides || {};
			if (Array.isArray(policyRes?.available_groups)) {
				availableGroups = policyRes.available_groups;
			}
			if (policyRes?.monthly_quota?.days) {
				monthlyQuotaDays = policyRes.monthly_quota.days;
				quotaByMonthCache = { [key]: policyRes.monthly_quota.days };
			} else {
				quotaByMonthCache = {};
			}
		} catch (error) {
			const e = /** @type {Error} */ (error);
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
			.finally(() => {
				inFlightQuotaKeys.delete(key);
			});
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
			if (timelineScrollEl) timelineScrollEl.scrollTop = 0;
		}
	});

	$effect(() => {
		if (currentView !== 'timeline') return;
		const monthsToEnsure = timelineMonths;
		for (const item of monthsToEnsure) {
			if (quotaByMonthCache[item.key] || inFlightQuotaKeys.has(item.key)) continue;
			inFlightQuotaKeys.add(item.key);
			loadingQuotaMonths = { ...loadingQuotaMonths, [item.key]: true };
			api
				.adminGetDayoffPolicy(item.year, item.monthNum)
				.then((res) => {
					const daysMap = res?.monthly_quota?.days || {};
					quotaByMonthCache = { ...quotaByMonthCache, [item.key]: daysMap };
				})
				.catch(() => {
					quotaByMonthCache = { ...quotaByMonthCache, [item.key]: {} };
				})
				.finally(() => {
					inFlightQuotaKeys.delete(item.key);
					const nextLoading = { ...loadingQuotaMonths };
					delete nextLoading[item.key];
					loadingQuotaMonths = nextLoading;
				});
		}
	});

	function loadNextTimelineMonth() {
		if (Object.keys(loadingQuotaMonths).length > 0) return;
		if (timelineMonthsCount >= 24) return;
		timelineMonthsCount += 1;
	}

	$effect(() => {
		if (currentView !== 'timeline' || !timelineSentinelEl || !timelineScrollEl) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					loadNextTimelineMonth();
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

	/**
	 * @param {number} id
	 * @param {string} status
	 */
	async function updateStatus(id, status) {
		try {
			await api.adminUpdateDayoffStatus(id, status);
			toast.success(`[${getStatusLabel(status)}] 처리가 완료되었습니다.`);
			await loadDayoffs();
		} catch (error) {
			const e = /** @type {Error} */ (error);
			toast.error(`상태 변경 실패: ${e.message}`);
		}
	}

	/**
	 * 특정 날짜(또는 기간) 정원 예외 설정 / 해제
	 * @param {string[]} dates
	 * @param {number | null} quota (null이면 기본 정원으로 복원)
	 */
	async function applyDateOverride(dates, quota) {
		if (!dates || dates.length === 0) return;
		try {
			const res = await api.adminUpdateDayoffDateOverride(dates, quota);
			if (res?.date_overrides) dateOverrides = res.date_overrides;
			toast.success(
				quota === null
					? `${dates.length}개 날짜의 정원이 기본값(${policy.daily_quota}명)으로 복원되었습니다.`
					: `${dates.length}개 날짜의 선착순 정원이 ${quota}명으로 설정되었습니다.`
			);
			await loadDayoffs();
		} catch (error) {
			const e = /** @type {Error} */ (error);
			toast.error(`특정일 정원 변경 실패: ${e.message}`);
		}
	}

	onMount(() => {
		const liveToday = getKstTimeSnapshot().dateStr;
		if (liveToday !== todayStr) {
			todayStr = liveToday;
		}
		loadDayoffs();
	});
</script>

<svelte:head>
	<title>{getSiteTitle('근태·휴무 관리')}</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 lg:px-8 print:max-w-none print:space-y-4 print:p-0">
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 액션 바 (기본값: 새로고침 + 관리자 홈) -->
	<!-- ===================================================================== -->
	<div class="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between md:border-b-4 md:pb-8 print:hidden">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-wider text-emerald-400">
					<span class="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
					통합 근태·인사 관제
				</span>
				<span class="text-xs font-bold text-slate-400">관리자 · 휴무/결근</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
				근태·휴무 <span class="text-blue-600">관리</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				전체 사원의 휴무(결근계) 신청 내역을 검토·승인하고 전사 캘린더, 타임라인 및 결근 내역 게시판으로 현황을 파악합니다.
			</p>
		</div>

		<!-- 상단 버튼 그룹 (새로고침과 관리자 홈) -->
		<div class="flex flex-wrap items-center gap-3">
			<button
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

	<!-- ===================================================================== -->
	<!-- 2. 상단 4대 관제 지표 요약 카드 (선택된 연/월 기준) -->
	<!-- ===================================================================== -->
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-5 xl:grid-cols-4 print:hidden">
		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex w-full items-center justify-between gap-2">
				<span class="min-w-0 truncate text-xs font-black tracking-wider text-slate-400">승인 대기</span>
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
					<Icon icon="solar:clock-circle-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-amber-600">{stats.requestedCount} <span class="text-xs font-normal text-slate-500">건</span></div>
				<div class="mt-1 text-xs font-bold text-slate-400">검토 대기 중인 신청</div>
			</div>
		</div>

		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex w-full items-center justify-between gap-2">
				<span class="min-w-0 truncate text-xs font-black tracking-wider text-slate-400">승인 확정 ({selectedMonth + 1}월)</span>
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
					<Icon icon="solar:check-circle-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-emerald-600">{stats.approvedCount} <span class="text-xs font-normal text-slate-500">일</span></div>
				<div class="mt-1 text-xs font-bold text-slate-400">{selectedYear}년 {selectedMonth + 1}월 승인 휴무</div>
			</div>
		</div>

		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex w-full items-center justify-between gap-2">
				<span class="min-w-0 truncate text-xs font-black tracking-wider text-slate-400">정기 연차</span>
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
					<Icon icon="solar:calendar-date-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-blue-600">{stats.typeStats.ANNUAL} <span class="text-xs font-normal text-slate-500">일</span></div>
				<div class="mt-1 text-xs font-bold text-slate-400">{selectedMonth + 1}월 정기 연차 사용</div>
			</div>
		</div>

		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex w-full items-center justify-between gap-2">
				<span class="min-w-0 truncate text-xs font-black tracking-wider text-slate-400">기타 (병가·경조사·공가)</span>
				<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
					<Icon icon="solar:hospital-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-rose-600">{stats.typeStats.SICK + stats.typeStats.SPECIAL + stats.typeStats.OFFICIAL} <span class="text-xs font-normal text-slate-500">일</span></div>
				<div class="mt-1 text-xs font-bold text-slate-400">{selectedMonth + 1}월 병가·경조사·공가</div>
			</div>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 3. 전사 공통 탭 바 (신청 승인 목록 | 월간 캘린더 | 월간 타임라인 현황 | 결근 내역) -->
	<!-- ===================================================================== -->
	<div class="flex items-center overflow-x-auto border-b-2 border-slate-200 print:hidden">
		<button
			type="button"
			onclick={() => (currentView = 'list')}
			class="flex shrink-0 items-center gap-2 border-b-4 px-5 py-3 text-xs font-black rounded-t-2xl transition {currentView === 'list' ? 'border-blue-600 bg-blue-50/50 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'}"
		>
			<Icon icon="solar:list-check-bold-duotone" class="text-base" />
			<span>신청 승인 목록</span>
			{#if stats.requestedCount > 0}
				<span class="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white">{stats.requestedCount}</span>
			{/if}
		</button>
		<button
			type="button"
			onclick={() => (currentView = 'calendar')}
			class="flex shrink-0 items-center gap-2 border-b-4 px-5 py-3 text-xs font-black rounded-t-2xl transition {currentView === 'calendar' ? 'border-blue-600 bg-blue-50/50 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'}"
		>
			<Icon icon="solar:calendar-mark-bold-duotone" class="text-base" />
			<span>월간 캘린더</span>
		</button>
		<button
			type="button"
			onclick={() => (currentView = 'timeline')}
			class="flex shrink-0 items-center gap-2 border-b-4 px-5 py-3 text-xs font-black rounded-t-2xl transition {currentView === 'timeline' ? 'border-blue-600 bg-blue-50/50 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'}"
		>
			<Icon icon="solar:calendar-bold-duotone" class="text-base" />
			<span>월간 타임라인 현황</span>
		</button>
		<button
			type="button"
			onclick={() => (currentView = 'records')}
			class="flex shrink-0 items-center gap-2 border-b-4 px-5 py-3 text-xs font-black rounded-t-2xl transition {currentView === 'records' ? 'border-blue-600 bg-blue-50/50 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-900'}"
		>
			<Icon icon="solar:document-text-bold-duotone" class="text-base" />
			<span>결근 내역</span>
			<span class="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-700">{filteredDayoffs.length}</span>
		</button>
	</div>

	<!-- ===================================================================== -->
	<!-- 3-1. 줄바꿈 후 직군 선택 필터 + 옆에 선착순·정원 설정 모달 버튼 -->
	<!-- ===================================================================== -->
	<div class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm print:hidden">
		<div class="flex flex-wrap items-center gap-2">
			<span class="mr-1 text-xs font-black tracking-wider text-slate-400 uppercase">직군 구분:</span>
			<div class="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 text-xs font-black">
				<button
					type="button"
					onclick={() => {
						workTypeFilter = 'ALL';
						historyStatusFilter = 'ALL';
					}}
					class="rounded-lg px-3.5 py-1.5 transition {workTypeFilter === 'ALL' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}"
				>
					전체 직군 ({workTypeCounts.all})
				</button>
				<button
					type="button"
					onclick={() => {
						workTypeFilter = 'APPROVAL';
						historyStatusFilter = 'ALL';
					}}
					class="rounded-lg px-3.5 py-1.5 transition {workTypeFilter === 'APPROVAL' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}"
				>
					🏢 사무직 (승인제 · {workTypeCounts.approval})
				</button>
				<button
					type="button"
					onclick={() => {
						workTypeFilter = 'FCFS';
						historyStatusFilter = 'ALL';
					}}
					class="rounded-lg px-3.5 py-1.5 transition {workTypeFilter === 'FCFS' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}"
				>
					🚌 운전직 (선착순 · {workTypeCounts.fcfs})
				</button>
			</div>

			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onclick={() => (showPolicyModal = true)}
					class="inline-flex items-center gap-2 rounded-xl border-2 border-slate-900 bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:border-blue-600 hover:bg-blue-600 active:scale-95"
				>
					<Icon icon="solar:settings-bold-duotone" class="text-base text-emerald-400" />
					<span>선착순·정원 설정</span>
				</button>
				<button
					type="button"
					onclick={() => (showOverrideModal = true)}
					class="inline-flex items-center gap-2 rounded-xl border-2 border-amber-500 bg-amber-50 px-4 py-2 text-xs font-black text-amber-800 shadow-sm transition hover:bg-amber-100 active:scale-95"
				>
					<Icon icon="solar:calendar-mark-bold-duotone" class="text-base text-amber-600" />
					<span>특정일 예외 정원{dateOverrideCount > 0 ? ` (${dateOverrideCount})` : ''}</span>
				</button>
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
			<span class="rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700">
				🚌 운전직 기본 정원: 일 {policy.daily_quota}명
			</span>
			{#if policy.max_monthly_count > 0}
				<span class="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">
					월 최대 {policy.max_monthly_count}회
				</span>
			{/if}
			{#if policy.max_days_per_request > 0}
				<span class="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[11px] font-black text-indigo-700">
					1회 최대 {policy.max_days_per_request}일
				</span>
			{/if}
			{#if policy.min_advance_days > 0 || policy.max_advance_days > 0}
				<span class="rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-black text-violet-700">
					신청기간: D+{policy.min_advance_days} ~ {policy.max_advance_days > 0 ? `D+${policy.max_advance_days}` : '무제한'}
				</span>
			{/if}
			{#if reservedPolicy}
				<span class="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">
					📅 예약됨: {reservedPolicy.effective_date} (정원 {reservedPolicy.daily_quota}명)
				</span>
			{/if}
			{#if dateOverrideCount > 0}
				<span class="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-800">
					⚡ 특정일 예외 정원: {dateOverrideCount}일
				</span>
			{/if}
		</div>
	</div>

	{#if currentView === 'list'}
		<!-- 📋 신청 내역 상세 리스트 (승인 대기 + 선착순/처리 완료 내역 통합) -->
		<div class="space-y-6">
			{#snippet dayoffRowCore(/** @type {DayoffEntry} */ d)}
				<td class="px-6 py-4">
					<div class="flex items-center gap-3">
						<div
							class="flex h-9 w-9 items-center justify-center rounded-xl font-black text-xs {d.work_type === 'FCFS' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}"
						>
							{d.real_name?.[0] || d.username[0]}
						</div>
						<div>
							<div class="font-black text-slate-900">{d.real_name || d.username}</div>
							<div class="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
								<span>{d.primary_group || '미지정'}</span>
								<span>·</span>
								<span>Lv.{d.rank_level ?? 0}</span>
							</div>
						</div>
					</div>
				</td>
				<td>
					{#if d.work_type === 'FCFS'}
						<span class="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-700 border border-emerald-200">
							🚌 운전직(선착순)
						</span>
					{:else}
						<span class="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-black text-blue-700 border border-blue-200">
							🏢 사무직(승인제)
						</span>
					{/if}
				</td>
				<td>
					<div class="font-bold text-slate-800">{d.date}</div>
					{#if d.group_id}
						<div class="text-[9px] font-bold text-blue-500 opacity-75">
							묶음번호: {d.group_id}
						</div>
					{/if}
				</td>
				<td>
					<span
						class="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black tracking-tighter text-slate-700"
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
						{getStatusLabel(d.status)}
					</span>
				</td>
				<td class="max-w-[180px] truncate text-xs text-slate-500">
					{d.memo || '-'}
				</td>
			{/snippet}

			{#if workTypeFilter !== 'FCFS'}
				<div
					class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg md:rounded-[2rem] md:shadow-2xl"
				>
					<div
						class="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6 md:p-8"
					>
						<h3 class="text-lg font-black tracking-tight text-slate-900">
							승인 대기 목록 <span class="ml-2 text-sm font-bold text-blue-600"
								>검토 대기 중인 신청 건 (사무직 승인제 · {pendingList.length}건)</span
							>
						</h3>
					</div>

					<div class="overflow-x-auto">
						<table class="table w-full">
							<thead
								class="border-b border-slate-100 bg-slate-50 text-xs font-bold tracking-wider text-slate-500"
							>
								<tr>
									<th class="px-6 py-4">성명 / 부서 · 직급</th>
									<th>운영 방식</th>
									<th>신청 날짜</th>
									<th>유형</th>
									<th>상태</th>
									<th>사유 (메모)</th>
									<th class="px-6 text-right">승인 처리</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-50">
								{#if loading}
									<tr
										><td colspan="7" class="py-14 text-center"
											><span class="loading loading-lg loading-bars text-blue-600"></span></td
										></tr
									>
								{:else if pendingList.length === 0}
									<tr
										><td
											colspan="7"
											class="py-12 text-center text-base font-black tracking-wider text-slate-300"
											>승인 대기 건 없음</td
										></tr
									>
								{:else}
									{#each pendingList as d (d.id)}
										<tr class="group transition-colors hover:bg-slate-50">
											{@render dayoffRowCore(d)}
											<td class="px-6 text-right">
												<div class="flex justify-end gap-2 px-1 py-1">
													<button
														class="btn rounded-lg border-none bg-emerald-600 font-black text-white transition-all btn-sm hover:bg-emerald-700"
														onclick={() => updateStatus(d.id, 'APPROVED')}>승인</button
													>
													<button
														class="btn rounded-lg border-none bg-rose-500 font-black text-white transition-all btn-sm hover:bg-rose-600"
														onclick={() => updateStatus(d.id, 'REJECTED')}>반려</button
													>
												</div>
											</td>
										</tr>
									{/each}
								{/if}
							</tbody>
						</table>
					</div>
				</div>
			{/if}

			<!-- 🚌 선착순(운전직) 신청·확정 및 근태 처리 이력 (workTypeFilter === 'FCFS' 일 때는 최상단 메인 카드) -->
			<div
				class="overflow-hidden rounded-xl border {workTypeFilter === 'FCFS' ? 'border-emerald-300 shadow-lg md:shadow-2xl' : 'border-slate-200 shadow-sm'} bg-white md:rounded-[2rem]"
			>
				<div
					class="flex flex-col justify-between gap-3 border-b border-slate-100 {workTypeFilter === 'FCFS' ? 'bg-emerald-50/50' : 'bg-slate-50/50'} p-6 md:flex-row md:items-center md:p-8"
				>
					<div>
						<h3 class="text-lg font-black tracking-tight text-slate-900">
							{workTypeFilter === 'FCFS' ? '운전직 선착순 대장' : '처리 완료 · 선착순 대장'}
							<span class="ml-2 text-sm font-bold {workTypeFilter === 'FCFS' ? 'text-emerald-700' : 'text-slate-600'}">
								{workTypeFilter === 'FCFS'
									? `🚌 운전직 선착순 신청·확정 목록 (${processedOrFcfsList.length}건)`
									: `선착순 자동확정 및 처리 완료 내역 (${processedOrFcfsList.length}건)`}
							</span>
						</h3>
						<p class="mt-0.5 text-[11px] font-medium text-slate-500">
							{workTypeFilter === 'FCFS'
								? '운전직(선착순) 신청은 정원 내 제출 시 즉시 승인 확정되며, 필요 시 관리자 반려/되돌리기가 가능합니다.'
								: '선착순 자동확정 건과 관리자 승인·반려 처리 이력을 함께 확인할 수 있습니다.'}
						</p>
					</div>

					<div class="inline-flex shrink-0 rounded-xl border border-slate-200 bg-white p-1 text-[11px] font-black">
						{#each [
							{ id: 'ALL', label: '전체' },
							{ id: 'APPROVED', label: '승인 확정' },
							{ id: 'REJECTED', label: '반려' },
							...(workTypeFilter === 'FCFS' ? [{ id: 'REQUESTED', label: '승인 대기' }] : [])
						] as stOpt (stOpt.id)}
							<button
								type="button"
								onclick={() => (historyStatusFilter = /** @type {any} */ (stOpt.id))}
								class="rounded-lg px-2.5 py-1 transition {historyStatusFilter === stOpt.id
									? 'bg-slate-900 text-white shadow-xs'
									: 'text-slate-600 hover:text-slate-900'}"
							>
								{stOpt.label}
							</button>
						{/each}
					</div>
				</div>

				<div class="overflow-x-auto">
					<table class="table w-full">
						<thead
							class="border-b border-slate-100 bg-slate-50 text-xs font-bold tracking-wider text-slate-500"
						>
							<tr>
								<th class="px-6 py-4">성명 / 부서 · 직급</th>
								<th>운영 방식</th>
								<th>신청 날짜</th>
								<th>유형</th>
								<th>상태</th>
								<th>사유 (메모)</th>
								<th>신청 일시</th>
								<th class="px-6 text-right">상태 관리</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-50">
							{#if loading}
								<tr
									><td colspan="8" class="py-16 text-center"
										><span class="loading loading-lg loading-bars text-emerald-600"></span></td
									></tr
								>
							{:else if processedOrFcfsList.length === 0}
								<tr
									><td
										colspan="8"
										class="py-14 text-center text-sm font-black tracking-wider text-slate-400"
									>
										{workTypeFilter === 'FCFS'
											? '조건에 해당하는 운전직 선착순 신청 내역이 없습니다.'
											: '표시할 처리 완료·선착순 내역이 없습니다.'}
									</td></tr
								>
							{:else}
								{#each processedOrFcfsList as d (d.id)}
									<tr class="group transition-colors hover:bg-slate-50">
										{@render dayoffRowCore(d)}
										<td class="font-mono text-[10px] text-slate-400">
											{formatDateTime(d.create_date)}
										</td>
										<td class="px-6 text-right">
											<div class="flex justify-end gap-2">
												{#if d.status === 'REQUESTED'}
													<button
														type="button"
														class="btn rounded-lg border-none bg-emerald-600 font-black text-white btn-xs hover:bg-emerald-700"
														onclick={() => updateStatus(d.id, 'APPROVED')}>승인</button
													>
													<button
														type="button"
														class="btn rounded-lg border-none bg-rose-500 font-black text-white btn-xs hover:bg-rose-600"
														onclick={() => updateStatus(d.id, 'REJECTED')}>반려</button
													>
												{:else if d.status === 'APPROVED'}
													<button
														type="button"
														class="text-[11px] font-black text-slate-500 underline hover:text-blue-600"
														onclick={() => updateStatus(d.id, 'REQUESTED')}>대기전환</button
													>
													<button
														type="button"
														class="text-[11px] font-black text-rose-500 underline hover:text-rose-700"
														onclick={() => updateStatus(d.id, 'REJECTED')}>반려</button
													>
												{:else}
													<button
														type="button"
														class="text-[11px] font-black text-emerald-600 underline hover:text-emerald-800"
														onclick={() => updateStatus(d.id, 'APPROVED')}>승인복원</button
													>
													<button
														type="button"
														class="text-[11px] font-black text-slate-500 underline hover:text-blue-600"
														onclick={() => updateStatus(d.id, 'REQUESTED')}>대기전환</button
													>
												{/if}
											</div>
										</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{:else if currentView === 'calendar'}
		<!-- 🗓️ 전사 월간 캘린더 뷰 (공용 Calendar.svelte + 선택일 정원 제어 & 승인/반려 패널) -->
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
						<div class="inline-flex rounded-xl border-2 border-slate-200 bg-slate-100 p-0.5 text-[11px] font-black">
							<button
								type="button"
								onclick={() => (calendarStatusFilter = 'ALL')}
								class="rounded-lg px-2.5 py-1 transition {calendarStatusFilter === 'ALL' ? 'bg-slate-900 text-white' : 'text-slate-600'}"
							>
								전체
							</button>
							<button
								type="button"
								onclick={() => (calendarStatusFilter = 'APPROVED')}
								class="rounded-lg px-2.5 py-1 transition {calendarStatusFilter === 'APPROVED' ? 'bg-emerald-600 text-white' : 'text-slate-600'}"
							>
								승인
							</button>
							<button
								type="button"
								onclick={() => (calendarStatusFilter = 'REQUESTED')}
								class="rounded-lg px-2.5 py-1 transition {calendarStatusFilter === 'REQUESTED' ? 'bg-amber-500 text-white' : 'text-slate-600'}"
							>
								대기
							</button>
						</div>
					{/snippet}
					{#snippet dayFooter(cell)}
						{@const qInfo = cell.isCurrentMonth ? monthlyQuotaDays?.[cell.dateStr] : null}
						{#if qInfo}
							<div
								class="flex h-3.5 sm:h-4 w-full items-center justify-between gap-0.5 rounded px-0.5 sm:px-1.5 text-[9px] sm:text-[10px] font-black leading-none
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
								<span class="hidden sm:inline shrink-0 font-mono text-[9px] opacity-80">
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
			<div class="lg:col-span-4 space-y-5">
				<!-- ① 선택한 날짜 운전직 선착순 정원 제어 카드 -->
				<DayoffDateQuotaCard
					selectedDate={selectedCalendarDate}
					quotaInfo={selectedDateQuotaInfo}
					onApplyOverride={applyDateOverride}
				/>

				<!-- ② 선택한 날짜의 사원별 휴무 목록 -->
				<div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg md:rounded-[2rem] md:shadow-2xl">
					<div class="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-5 md:p-6">
						<div>
							<span class="text-[10px] font-black tracking-wider text-slate-400">선택 날짜 신청 내역</span>
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
								<Icon icon="solar:calendar-check-bold-duotone" class="mx-auto mb-2 text-4xl text-slate-200" />
								<p class="text-xs font-bold text-slate-400">해당 날짜에 등록된 휴무 내역이 없습니다.</p>
							</div>
						{:else}
							{#each selectedDateDayoffs as d (d.id)}
								<div class="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3">
									<div class="flex items-start justify-between gap-2">
										<div class="flex items-center gap-2.5">
											<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">
												{d.real_name?.[0] || d.username?.[0] || '?'}
											</div>
											<div>
												<div class="flex items-center gap-1.5">
													<span class="text-sm font-black text-slate-900">{d.real_name || d.username}</span>
													<span class="rounded px-1.5 py-0.5 text-[9px] font-black {d.work_type === 'FCFS' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}">
														{d.work_type === 'FCFS' ? '🚌선착순' : '🏢승인제'}
													</span>
												</div>
												<div class="text-[11px] font-bold text-slate-400">
													{d.primary_group || '미지정'} · Lv.{d.rank_level ?? 0} · {getTypeLabel(d.type)}
												</div>
											</div>
										</div>
										<span class="rounded-md border px-2 py-0.5 text-[10px] font-black {getBadgeClass(d.status)}">
											{getStatusLabel(d.status)}
										</span>
									</div>

									{#if d.memo}
										<p class="rounded-xl bg-white px-3 py-2 text-xs text-slate-600 border border-slate-100">
											{d.memo}
										</p>
									{/if}

									{#if d.status === 'REQUESTED'}
										<div class="flex gap-2 pt-1">
											<button
												type="button"
												onclick={() => updateStatus(d.id, 'APPROVED')}
												class="btn btn-xs flex-1 rounded-lg border-none bg-emerald-600 font-black text-white hover:bg-emerald-700"
											>
												승인
											</button>
											<button
												type="button"
												onclick={() => updateStatus(d.id, 'REJECTED')}
												class="btn btn-xs flex-1 rounded-lg border-none bg-rose-500 font-black text-white hover:bg-rose-600"
											>
												반려
											</button>
										</div>
									{:else if d.status === 'APPROVED'}
										<div class="flex justify-end gap-3">
											<button
												type="button"
												onclick={() => updateStatus(d.id, 'REQUESTED')}
												class="text-[10px] font-black text-slate-400 underline hover:text-blue-600"
											>
												승인 취소(대기로 되돌리기)
											</button>
											<button
												type="button"
												onclick={() => updateStatus(d.id, 'REJECTED')}
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
	{:else if currentView === 'timeline'}
		<!-- 📅 월간 현황 (타임라인) -->
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
								{timelineMonths[0].label} ~ {timelineMonths[timelineMonths.length - 1].label} ({timelineMonthsCount}개월 연속)
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
					<!-- 승인 확정 / 전체(대기 포함) 필터 -->
					<div class="flex items-center rounded-xl bg-slate-200 p-1">
						{#each [{ key: 'APPROVED', label: '승인 확정' }, { key: 'ALL', label: '승인+대기' }] as stOpt (stOpt.key)}
							<button
								type="button"
								onclick={() => (timelineStatusFilter = /** @type {any} */ (stOpt.key))}
								class="rounded-lg px-2.5 py-1 text-[11px] font-black transition {timelineStatusFilter ===
								stOpt.key
									? 'bg-white text-slate-900 shadow-xs'
									: 'text-slate-600 hover:text-slate-900'}"
							>
								{stOpt.label}
							</button>
						{/each}
					</div>

					<!-- 시작 기준 연/월 선택 -->
					<div class="flex items-center gap-2 rounded-2xl bg-slate-200 p-1.5">
						<select
							class="select rounded-xl border-none bg-transparent select-sm font-black text-slate-900 focus:outline-none"
							bind:value={selectedYear}
						>
							{#each yearOptions as year (year)}
								<option value={year}>{year}년</option>
							{/each}
						</select>
						<div class="h-6 w-px bg-slate-300"></div>
						<select
							class="select rounded-xl border-none bg-transparent select-sm font-black text-slate-900 focus:outline-none"
							bind:value={selectedMonth}
						>
							{#each Array.from({ length: 12 }, (_, i) => i) as month (month)}
								<option value={month}>{month + 1}월</option>
							{/each}
						</select>
					</div>
				</div>
			</div>

			{#snippet timelineBadgeCard(staffName, subLabel, style, isHighlighted)}
				<span
					class="relative z-10 flex w-[84px] items-center gap-1 rounded-lg border px-1.5 py-1 text-left shadow-xs transition-all hover:border-blue-500 hover:shadow-md {style.chip} {isHighlighted
						? 'ring-2 ring-blue-400 shadow-md'
						: ''}"
				>
					<span class="h-5 w-1 shrink-0 rounded-full {style.avatar}"></span>
					<span class="flex min-w-0 flex-1 flex-col leading-none">
						<span class="truncate text-[11px] font-black text-slate-900">{staffName}</span>
						<span class="mt-0.5 truncate text-[8.5px] font-black {style.subText}">
							{subLabel}
						</span>
					</span>
				</span>
			{/snippet}

			<!-- 📌 Continuous Scrollable Track Table (단차 0px 세로 직선 트랙 + 달 끊김 없음) -->
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
							>
								일
							</th>
							<th
								class="sticky left-[68px] z-40 w-[46px] min-w-[46px] border-b border-slate-200 bg-slate-50 px-1 py-3.5 text-center"
							>
								요일
							</th>
							<th
								class="sticky left-[114px] z-40 w-[96px] min-w-[96px] border-r border-b border-slate-200 bg-slate-50 px-2 py-3.5 text-center"
							>
								운전직 정원
							</th>
							<th class="min-w-[320px] border-b border-slate-200 bg-slate-50 px-4 py-3.5">
								<div class="flex items-center justify-between gap-2">
									<span>
										{timelineStatusFilter === 'APPROVED'
											? '승인 확정 타임라인 (단차 0px 직선 배치)'
											: '승인·대기 통합 타임라인 (단차 0px 직선 배치)'}
									</span>
									{#if timelineData.maxTrackCount > 0}
										<span class="rounded-full bg-slate-200 px-2 py-0.5 text-[9px] font-black text-slate-700">
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
								<!-- 1. 날짜 (월 1일에는 월 배지를 같이 표기해 달 구분 유지, 높이 52px 고정) -->
								<td
									class="sticky left-0 z-20 h-[52px] w-[68px] min-w-[68px] border-b border-slate-100 px-1.5 text-center align-middle transition-colors {stickyBg} {monthBorder}"
								>
									<div class="flex items-center justify-center gap-1 leading-none">
										{#if day.isMonthStart}
											<span
												class="rounded bg-blue-600 px-1 py-0.5 text-[9px] font-black text-white leading-none"
												>{day.monthNum}월</span
											>
										{/if}
										<span
											class="text-lg font-black leading-none {day.isToday
												? 'rounded-lg bg-slate-900 px-1.5 py-1 text-white'
												: getDayColor(day.dayOfWeek)}">{day.day}</span
										>
									</div>
								</td>

								<!-- 2. 요일 -->
								<td
									class="sticky left-[68px] z-20 h-[52px] w-[46px] min-w-[46px] border-b border-slate-100 px-1 text-center align-middle transition-colors {stickyBg} {monthBorder}"
								>
									<span class="text-xs font-black uppercase {getDayColor(day.dayOfWeek)}"
										>{getDayLabel(day.dayOfWeek)}</span
									>
								</td>

								<!-- 3. 운전직 정원 -->
								<td
									class="sticky left-[114px] z-20 h-[52px] w-[96px] min-w-[96px] border-r border-b border-slate-200 px-1.5 text-center align-middle transition-colors {stickyBg} {monthBorder}"
								>
									{#if day.qInfo}
										<span
											class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-black {day.qInfo.is_full
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

								<!-- 4. 고정 트랙(단차 0px 직선 레인) 기록 영역 -->
								<td class="h-[52px] border-b border-slate-100 p-0 align-middle {monthBorder}">
									<div class="flex h-[52px] items-center px-3">
										{#if day.tracks.length === 0}
											<span
												class="ml-1 text-[10px] font-bold tracking-wider text-slate-300"
												>결근 없음</span
											>
										{:else}
											{#each day.tracks as slot, tIdx (`${day.date}-t${tIdx}`)}
												<div class="relative flex h-[52px] w-[92px] shrink-0 items-center justify-center">
													<!-- 세로 레인 중심 가이드 (단차 없는 직선 기준축) -->
													<span
														class="pointer-events-none absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 bg-slate-100/90"
													></span>

													{#if slot}
														{@const entry = slot.entry}
														{@const style = getTimelineSlotStyle(entry)}
														{@const staffName = entry.real_name || entry.username || `사원#${entry.user_id}`}
														{@const isHighlighted = hoveredSpanKey === slot.span.spanKey}

														{#if !slot.isMultiDay}
															<!-- ① 하루 단일 결근 카드 -->
															<button
																type="button"
																onmouseenter={(e) => showTimelineTooltip(e, slot)}
																onmouseleave={hideTimelineTooltip}
																onfocus={(e) => showTimelineTooltip(e, slot)}
																onblur={hideTimelineTooltip}
																onclick={(e) => showTimelineTooltip(e, slot)}
																class="relative z-10 flex cursor-pointer items-center justify-center"
																title={`${staffName} · ${getTypeLabel(entry.type)} (${entry.date})`}
															>
																{@render timelineBadgeCard(
																	staffName,
																	`${entry.work_type === 'FCFS' ? '🚌' : '🏢'}${getTypeLabel(entry.type)}`,
																	style,
																	isHighlighted
																)}
															</button>
														{:else}
															<!-- ② 다일 연속 결근 (월간 캘린더 단차 0px 방식의 세로 직선 트랙) -->
															<button
																type="button"
																onmouseenter={(e) => showTimelineTooltip(e, slot)}
																onmouseleave={hideTimelineTooltip}
																onfocus={(e) => showTimelineTooltip(e, slot)}
																onblur={hideTimelineTooltip}
																onclick={(e) => showTimelineTooltip(e, slot)}
																aria-label={`${staffName} ${getTypeLabel(entry.type)} (${slot.span.startDate} ~ ${slot.span.endDate})`}
																title={`${staffName} · ${getTypeLabel(entry.type)} (${slot.span.startDate} ~ ${slot.span.endDate}, ${slot.totalDaysInSpan}일)`}
																class="relative flex h-full w-full cursor-pointer items-center justify-center"
															>
																<!-- 셀 경계(-top-[2px] ~ -bottom-[2px])를 끊김 없이 관통하는 세로 기준 직선 -->
																<span
																	class="pointer-events-none absolute left-1/2 z-[5] -translate-x-1/2 transition-all {isHighlighted
																		? `w-[14px] ${style.lineActive}`
																		: `w-[10px] ${style.line}`} {slot.isStart ? 'top-1/2' : '-top-[2px]'} {slot.isEnd
																		? 'bottom-1/2'
																		: '-bottom-[2px]'}"
																></span>

																{#if slot.isStart || slot.isVisibleFirst}
																	<!-- 연속 시작일(또는 가시구간 첫날): 세로 직선 정중앙 위 배지 -->
																	{@render timelineBadgeCard(
																		staffName,
																		`${entry.work_type === 'FCFS' ? '🚌' : '🏢'}${getTypeLabel(entry.type)}·${slot.totalDaysInSpan}일${!slot.isStart ? '↑' : ''}`,
																		style,
																		isHighlighted
																	)}
																{:else if slot.isEnd}
																	<!-- 연속 종료일: 원형 종료 마커 캡 -->
																	<span
																		class="pointer-events-none relative z-10 h-4 w-4 rounded-full ring-2 ring-white shadow-xs transition-transform {isHighlighted
																			? 'scale-125'
																			: ''} {style.dot}"
																	></span>
																{:else}
																	<!-- 연속 중간일: 굵은 세로 기준선 중앙 체크 점 -->
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

				<!-- 영속 스크롤 하단 자동 로드 센티넬 -->
				<div
					bind:this={timelineSentinelEl}
					class="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-6 py-4 text-xs font-bold text-slate-500"
				>
					<div class="flex items-center gap-2">
						{#if Object.keys(loadingQuotaMonths).length > 0}
							<span class="loading loading-xs loading-spinner text-blue-600"></span>
							<span>다음 달 선착순 정원 및 타임라인 데이터를 이어서 불러오는 중...</span>
						{:else if timelineMonthsCount >= 24}
							<span>최대 연속 표시 범위(24개월)에 도달했습니다. 상단 연/월을 변경해 기준 월을 이동하세요.</span>
						{:else}
							<Icon icon="solar:double-alt-arrow-down-bold-duotone" class="text-base text-blue-600" />
							<span>아래로 스크롤하면 다음 달 타임라인이 자동으로 이어집니다. (현재 {timelineMonthsCount}개월 로드됨)</span>
						{/if}
					</div>
					{#if timelineMonthsCount < 24}
						<button
							type="button"
							onclick={loadNextTimelineMonth}
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
	{:else if currentView === 'records'}
		<!-- ===================================================================== -->
		<!-- 📑 결근 내역 게시판 리스트 탭 (검색 · 다중 필터링 · 정렬 · 인쇄 지원) -->
		<!-- ===================================================================== -->
		<div
			class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg md:rounded-[2rem] md:shadow-2xl print:rounded-none print:border-none print:shadow-none"
		>
			<!-- 인쇄 전용 공식 문서 헤더 (화면에서는 숨김, 프린트 시 최상단 출력) -->
			<div class="hidden border-b-2 border-slate-900 pb-4 mb-4 print:block">
				<div class="flex items-end justify-between">
					<div>
						<h2 class="text-2xl font-black text-slate-900">사원 결근·휴무 내역 대장</h2>
						<p class="mt-1 text-xs font-bold text-slate-600">
							직군: {workTypeFilter === 'ALL' ? '전체' : workTypeFilter === 'FCFS' ? '운전직(선착순)' : '사무직(승인제)'}
							· 상태: {recordStatusFilter === 'ALL' ? '전체' : getStatusLabel(recordStatusFilter)}
							· 유형: {recordTypeFilter === 'ALL' ? '전체' : getTypeLabel(recordTypeFilter)}
							· 부서: {recordGroupFilter === 'ALL' ? '전체' : recordGroupFilter}
							{#if recordStartDate || recordEndDate}
								· 기간: {recordStartDate || '처음'} ~ {recordEndDate || '현재'}
							{/if}
							{#if recordSearch.trim()}
								· 검색어: "{recordSearch.trim()}"
							{/if}
						</p>
					</div>
					<div class="text-right text-xs font-bold text-slate-600">
						<div>출력일: {todayStr}</div>
						<div>총 {recordSummary.total}건 (승인 {recordSummary.approved} / 대기 {recordSummary.requested} / 반려 {recordSummary.rejected})</div>
					</div>
				</div>
			</div>

			<!-- 상단 타이틀 & 인쇄/초기화 액션 바 (인쇄 시 숨김) -->
			<div
				class="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-6 md:flex-row md:items-center md:p-8 print:hidden"
			>
				<div>
					<h3 class="text-lg font-black tracking-tight text-slate-900">
						결근 내역 <span class="text-blue-600">전체 게시판</span>
					</h3>
					<p class="mt-0.5 text-xs font-medium text-slate-500">
						전체 사원의 결근·휴무 신청 내역을 검색·필터링하고 A4 양식으로 바로 인쇄할 수 있습니다.
					</p>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onclick={resetRecordFilters}
						class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-black text-slate-600 shadow-xs transition hover:bg-slate-50 active:scale-95"
					>
						<Icon icon="solar:refresh-bold" class="text-sm" />
						<span>필터 초기화</span>
					</button>
					<button
						type="button"
						onclick={printRecordLedger}
						disabled={filteredRecordList.length === 0}
						class="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:border-blue-600 hover:bg-blue-600 active:scale-95 disabled:opacity-40"
					>
						<Icon icon="solar:printer-bold-duotone" class="text-base text-emerald-400" />
						<span>인쇄 ({filteredRecordList.length}건)</span>
					</button>
				</div>
			</div>

			<!-- 검색 및 다중 필터링 바 (인쇄 시 숨김) -->
			<div class="space-y-3 border-b border-slate-100 bg-white p-5 md:px-8 print:hidden">
				<div class="grid grid-cols-1 gap-3 md:grid-cols-12">
					<!-- 키워드 검색 -->
					<div class="relative md:col-span-4">
						<Icon
							icon="solar:magnifer-bold-duotone"
							class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base text-slate-400"
						/>
						<input
							type="search"
							bind:value={recordSearch}
							placeholder="이름, 아이디, 부서, 사유, 날짜 검색..."
							class="w-full rounded-xl border border-slate-300 bg-slate-50/70 py-2.5 pr-3 pl-10 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
						/>
					</div>

					<!-- 상태 필터 -->
					<div class="md:col-span-2">
						<select
							bind:value={recordStatusFilter}
							aria-label="상태 필터"
							class="select select-sm h-[38px] w-full rounded-xl border border-slate-300 bg-slate-50/70 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
						>
							<option value="ALL">상태: 전체</option>
							<option value="APPROVED">승인 확정</option>
							<option value="REQUESTED">승인 대기</option>
							<option value="REJECTED">반려</option>
							<option value="CANCELLED">취소</option>
						</select>
					</div>

					<!-- 유형 필터 -->
					<div class="md:col-span-2">
						<select
							bind:value={recordTypeFilter}
							aria-label="유형 필터"
							class="select select-sm h-[38px] w-full rounded-xl border border-slate-300 bg-slate-50/70 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
						>
							<option value="ALL">유형: 전체</option>
							<option value="ANNUAL">연차</option>
							<option value="SICK">병가</option>
							<option value="SPECIAL">경조사</option>
							<option value="OFFICIAL">공가</option>
						</select>
					</div>

					<!-- 부서(주그룹) 필터 -->
					<div class="md:col-span-2">
						<select
							bind:value={recordGroupFilter}
							aria-label="부서 필터"
							class="select select-sm h-[38px] w-full rounded-xl border border-slate-300 bg-slate-50/70 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
						>
							<option value="ALL">부서: 전체</option>
							{#each recordGroupOptions as grp (grp)}
								<option value={grp}>{grp}</option>
							{/each}
						</select>
					</div>

					<!-- 정렬 기준 -->
					<div class="md:col-span-2">
						<select
							bind:value={recordSort}
							aria-label="정렬 기준"
							class="select select-sm h-[38px] w-full rounded-xl border border-slate-300 bg-slate-50/70 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
						>
							<option value="date_desc">결근일 최신순</option>
							<option value="date_asc">결근일 오래된순</option>
							<option value="created_desc">신청일시 최신순</option>
							<option value="name_asc">이름 가나다순</option>
						</select>
					</div>
				</div>

				<!-- 기간 필터 + 결과 요약 배지 -->
				<div class="flex flex-wrap items-center justify-between gap-3 pt-1">
					<div class="flex flex-wrap items-center gap-2">
						<span class="text-xs font-black text-slate-500">기간 조회:</span>
						<input
							type="date"
							bind:value={recordStartDate}
							aria-label="조회 시작일"
							class="rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
						/>
						<span class="text-xs font-bold text-slate-400">~</span>
						<input
							type="date"
							bind:value={recordEndDate}
							aria-label="조회 종료일"
							class="rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
						/>
					</div>

					<div class="flex flex-wrap items-center gap-2 text-[11px] font-black">
						<span class="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">
							검색 결과 {recordSummary.total}건
						</span>
						<span class="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700">
							승인 {recordSummary.approved}
						</span>
						<span class="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-700">
							대기 {recordSummary.requested}
						</span>
						<span class="rounded-lg bg-rose-50 px-2.5 py-1 text-rose-700">
							반려 {recordSummary.rejected}
						</span>
						<select
							bind:value={recordPageSize}
							aria-label="페이지당 표시 개수"
							class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 focus:border-blue-500 focus:outline-none"
						>
							<option value={20}>20건씩 보기</option>
							<option value={50}>50건씩 보기</option>
							<option value={100}>100건씩 보기</option>
							<option value={0}>전체 보기</option>
						</select>
					</div>
				</div>
			</div>

			<!-- 게시판 리스트 테이블 (화면: 페이지네이션 표시 / 인쇄: 필터링된 전체 건 출력) -->
			<div class="overflow-x-auto print:overflow-visible">
				<table class="table w-full print:text-xs">
					<thead
						class="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wider text-slate-600 print:bg-slate-100"
					>
						<tr>
							<th class="w-14 px-4 py-3.5 text-center">번호</th>
							<th class="px-4 py-3.5">성명 / 부서</th>
							<th class="px-4 py-3.5">운영 방식</th>
							<th class="px-4 py-3.5">결근·휴무일</th>
							<th class="px-4 py-3.5">유형</th>
							<th class="px-4 py-3.5">상태</th>
							<th class="px-4 py-3.5">사유 (메모)</th>
							<th class="px-4 py-3.5">신청 일시</th>
							<th class="px-4 py-3.5 text-right print:hidden">상태 관리</th>
						</tr>
					</thead>
					<!-- 화면 표시용 tbody (페이지네이션 적용) -->
					<tbody class="divide-y divide-slate-100 print:hidden">
						{#if loading}
							<tr>
								<td colspan="9" class="py-16 text-center">
									<span class="loading loading-lg loading-bars text-blue-600"></span>
								</td>
							</tr>
						{:else if pagedRecordList.length === 0}
							<tr>
								<td colspan="9" class="py-16 text-center">
									<Icon icon="solar:document-text-bold-duotone" class="mx-auto mb-2 text-4xl text-slate-200" />
									<p class="text-sm font-black text-slate-400">조건에 해당하는 결근 내역이 없습니다.</p>
								</td>
							</tr>
						{:else}
							{#each pagedRecordList as d, idx (d.id)}
								{@const rowNum =
									filteredRecordList.length -
									((recordPageSize > 0 ? (Math.min(recordPage, recordTotalPages) - 1) * recordPageSize : 0) + idx)}
								<tr class="transition-colors hover:bg-slate-50">
									<td class="px-4 py-3.5 text-center font-mono text-xs font-bold text-slate-400">
										{rowNum}
									</td>
									<td class="px-4 py-3.5">
										<div class="font-black text-slate-900">{d.real_name || d.username}</div>
										<div class="text-[11px] font-bold text-slate-400">
											{d.primary_group || '미지정'} · Lv.{d.rank_level ?? 0}
										</div>
									</td>
									<td class="px-4 py-3.5">
										{#if d.work_type === 'FCFS'}
											<span class="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-black text-emerald-700">
												🚌 운전직(선착순)
											</span>
										{:else}
											<span class="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[10px] font-black text-blue-700">
												🏢 사무직(승인제)
											</span>
										{/if}
									</td>
									<td class="px-4 py-3.5 font-mono text-xs font-black text-slate-800">
										{d.date}
									</td>
									<td class="px-4 py-3.5">
										<span class="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-700">
											{getTypeLabel(d.type)}
										</span>
									</td>
									<td class="px-4 py-3.5">
										<span class="rounded-md border px-2 py-0.5 text-[10px] font-black {getBadgeClass(d.status)}">
											{getStatusLabel(d.status)}
										</span>
									</td>
									<td class="max-w-[240px] truncate px-4 py-3.5 text-xs text-slate-600" title={d.memo || ''}>
										{d.memo || '-'}
									</td>
									<td class="px-4 py-3.5 font-mono text-[11px] text-slate-400">
										{formatDateTime(d.create_date)}
									</td>
									<td class="px-4 py-3.5 text-right">
										<div class="flex justify-end gap-2">
											{#if d.status === 'REQUESTED'}
												<button
													type="button"
													class="btn btn-xs rounded-lg border-none bg-emerald-600 font-black text-white hover:bg-emerald-700"
													onclick={() => updateStatus(d.id, 'APPROVED')}>승인</button
												>
												<button
													type="button"
													class="btn btn-xs rounded-lg border-none bg-rose-500 font-black text-white hover:bg-rose-600"
													onclick={() => updateStatus(d.id, 'REJECTED')}>반려</button
												>
											{:else if d.status === 'APPROVED'}
												<button
													type="button"
													class="text-[11px] font-black text-slate-500 underline hover:text-blue-600"
													onclick={() => updateStatus(d.id, 'REQUESTED')}>대기전환</button
												>
												<button
													type="button"
													class="text-[11px] font-black text-rose-500 underline hover:text-rose-700"
													onclick={() => updateStatus(d.id, 'REJECTED')}>반려</button
												>
											{:else}
												<button
													type="button"
													class="text-[11px] font-black text-emerald-600 underline hover:text-emerald-800"
													onclick={() => updateStatus(d.id, 'APPROVED')}>승인복원</button
												>
												<button
													type="button"
													class="text-[11px] font-black text-slate-500 underline hover:text-blue-600"
													onclick={() => updateStatus(d.id, 'REQUESTED')}>대기전환</button
												>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>

					<!-- 인쇄 전용 tbody (필터링된 전체 건을 끊김 없이 출력) -->
					<tbody class="hidden divide-y divide-slate-200 print:table-row-group">
						{#each filteredRecordList as d, idx (d.id)}
							<tr class="break-inside-avoid">
								<td class="px-2 py-2 text-center font-mono text-[11px] text-slate-600">
									{filteredRecordList.length - idx}
								</td>
								<td class="px-2 py-2">
									<div class="font-bold text-slate-900">{d.real_name || d.username}</div>
									<div class="text-[10px] text-slate-500">{d.primary_group || '미지정'}</div>
								</td>
								<td class="px-2 py-2 text-[11px] text-slate-700">
									{d.work_type === 'FCFS' ? '운전직(선착순)' : '사무직(승인제)'}
								</td>
								<td class="px-2 py-2 font-mono text-[11px] font-bold text-slate-900">{d.date}</td>
								<td class="px-2 py-2 text-[11px] text-slate-800">{getTypeLabel(d.type)}</td>
								<td class="px-2 py-2 text-[11px] font-bold text-slate-800">{getStatusLabel(d.status)}</td>
								<td class="px-2 py-2 text-[11px] text-slate-700">{d.memo || '-'}</td>
								<td class="px-2 py-2 font-mono text-[10px] text-slate-500">{formatDateTime(d.create_date)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<!-- 하단 페이지네이션 바 (인쇄 시 숨김) -->
			{#if recordPageSize > 0 && recordTotalPages > 1}
				<div class="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4 print:hidden">
					<span class="text-xs font-bold text-slate-500">
						총 {filteredRecordList.length}건 중 {Math.min(recordPage, recordTotalPages)} / {recordTotalPages} 페이지
					</span>
					<div class="flex items-center gap-1.5">
						<button
							type="button"
							onclick={() => (recordPage = 1)}
							disabled={recordPage <= 1}
							class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
						>
							처음
						</button>
						<button
							type="button"
							onclick={() => (recordPage = Math.max(1, recordPage - 1))}
							disabled={recordPage <= 1}
							class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
						>
							이전
						</button>
						<span class="px-2 text-xs font-black text-blue-600">
							{Math.min(recordPage, recordTotalPages)} / {recordTotalPages}
						</span>
						<button
							type="button"
							onclick={() => (recordPage = Math.min(recordTotalPages, recordPage + 1))}
							disabled={recordPage >= recordTotalPages}
							class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
						>
							다음
						</button>
						<button
							type="button"
							onclick={() => (recordPage = recordTotalPages)}
							disabled={recordPage >= recordTotalPages}
							class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
						>
							마지막
						</button>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- 스크롤/테이블 영역 밖 고정 좌표 플로팅 상세 툴팁 (overflow 클리핑 방지) -->
{#if currentView === 'timeline' && hoveredTimelineInfo}
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
				{tipEntry.work_type === 'FCFS' ? '🚌선착순' : '🏢승인'} · {getTypeLabel(tipEntry.type)}
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

<DayoffPolicyModal
	bind:open={showPolicyModal}
	{todayStr}
	todayPolicy={policy}
	{reservedPolicy}
	{availableGroups}
	onSaved={loadDayoffs}
/>

<DayoffDateOverrideModal
	bind:open={showOverrideModal}
	{todayStr}
	defaultQuota={policy.daily_quota}
	{dateOverrides}
	onApply={applyDateOverride}
/>
