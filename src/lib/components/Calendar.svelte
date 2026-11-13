<script lang="ts">
	/**
	 * ============================================================================
	 * [전사 공용 확장형 캘린더 컴포넌트 (src/lib/components/Calendar.svelte)]
	 * ============================================================================
	 *
	 * 💡 핵심 아키텍처 및 기능 명세:
	 *
	 * 1. [모바일 세로 모드 무여백(Full-Bleed) 반응형 레이아웃]:
	 *    - 모바일 세로 화면(< 640px, sm 미만)에서는 폭이 매우 좁기 때문에
	 *      좌우 패딩(px-0), 좌우 외곽 보더(border-x-0), 모서리 라운딩(rounded-none)을 제거하고
	 *      부모 여백을 상쇄(-mx-4 sm:mx-0)하여 화면 가로폭 100%를 7열(일~토)에 온전히 할당합니다.
	 *
	 * 2. [중요 알람 — 셀 배경색(Background) 표시 및 상/하단 2분할 연속 연결]:
	 *    - `display: 'background'` (또는 `isBackground: true`)로 지정된 중요 알람/일정은
	 *      날짜 칸의 배경색 자체를 변경하여 높은 시인성으로 알립니다.
	 *    - 하루에 최대 2개까지 배경 알람을 표시할 수 있으며:
	 *      · 상단 슬롯(Slot 0, Top 50%)과 하단 슬롯(Slot 1, Bottom 50%)으로 나누어 서로 다른 색상을 칠합니다.
	 *      · 단독 1개이고 `bgPosition: 'full'`인 경우 셀 전체(100%) 배경을 채웁니다.
	 *    - 연속된 기간(date ~ endDate)의 중요 알람인 경우:
	 *      · 기간 전체에 걸쳐 동일한 상단(Slot 0) 또는 하단(Slot 1) 트랙을 고정 유지합니다.
	 *      · 셀과 셀 사이의 1px 경계선을 덮어(-left-px, -right-px) 끊어지지 않고 하나로 이어진 배경 띠로 렌더링합니다.
	 *
	 * 3. [일반 일정 — 단차 없는(Zero-Step) 연속선(Line) 렌더링 & 위치 조정]:
	 *    - `display: 'bar'`(기본값)인 일반 일정이 2일 이상 연속(date ~ endDate)될 때:
	 *      · 시작일(isStart): 일정 제목 배지를 표시하고, 그 아래/우측으로 중심 높이(top-1/2)가 고정된 연결 선을 뻗습니다.
	 *      · 연속일(중간일 isMiddle ~ 종료일 isEnd): 제목 텍스트를 중복 표기하지 않고,
	 *        시작일과 **1px의 단차도 없이 정확히 동일한 수직 중심선(top-1/2 -translate-y-1/2)**에
	 *        연속된 컬러 선(Horizontal Line)만 가로질러 표시합니다.
	 *    - [단차 원천 차단 구조]:
	 *      · 모든 날짜 셀의 상단 헤더 높이(h-6 sm:h-7)와 트랙 슬롯 개수(고정 2줄 슬롯)를 모든 칸에서
	 *        100% 동일한 고정 높이로 렌더링하여, 어떤 날에 일정이 0개든 4개든 연속선의 수평 높이가 절대 흔들리지 않습니다.
	 *    - [연속선 위치 및 굵기 조정]:
	 *      · 개별 일정의 `lineSlot` (0: 상단 트랙, 1: 하단 트랙, 'auto': 자동 배정) 지원
	 *      · 캘린더 전역 `lineAlign` ('top' | 'center' | 'bottom') 및 `lineThickness` ('thin' | 'normal' | 'thick') 지원
	 *
	 * 4. [3개 이상 일정 시 `...` 배지 및 플로팅 툴팁(Tooltip) 표시]:
	 *    - 한 날짜에 일반 일정이 3개 이상(또는 트랙 슬롯 2개를 초과) 등록된 경우,
	 *      셀 높이를 늘려 단차를 유발하는 대신 **`...` (+N) 배지**로 축약 표시합니다.
	 *    - `...` 배지에 마우스를 올리거나(hover) 포커스/클릭하면 해당 날짜의 전체 일정 목록을
	 *      **플로팅 툴팁(Tooltip Popover)** 형태로 즉시 보여줍니다.
	 */
	import Icon from '@iconify/svelte';
	import type { Snippet } from 'svelte';
	import { formatDate, formatDDay, timestampToDateString } from '$lib/utils';

	export type CalendarEventType =
		| 'PRIMARY'
		| 'SUCCESS'
		| 'WARNING'
		| 'DANGER'
		| 'INFO'
		| 'HOLIDAY'
		| string;

	export interface CalendarEvent {
		id?: string | number;
		/** 시작 날짜 ('YYYY-MM-DD', ISO 문자열, Date 객체, 또는 밀리초 타임스탬프) */
		date: string | number | Date;
		/** 종료 날짜 (연속 일정/알람인 경우 지정, 'YYYY-MM-DD') */
		endDate?: string | number | Date | null;
		/** 일정 또는 중요 알람 제목 */
		title: string;
		/** 시간 표시 텍스트 (예: '09:30', '종일') */
		time?: string;
		/** 테마 색상 분류 ('PRIMARY' | 'SUCCESS' | 'WARNING' | 'DANGER' | 'INFO' | 'HOLIDAY') */
		type?: CalendarEventType;
		/**
		 * 표시 방식:
		 * - 'bar' (기본값): 일반 일정 (단일 칩 또는 연속 일정 시 첫날 제목 + 이후 연속 선 표시)
		 * - 'background': 중요 알람 (날짜 셀 배경색 변경, 하루 최대 2개 상/하단 분할 및 연속 연결)
		 */
		display?: 'bar' | 'background';
		/** display === 'background'와 동일한 단축 플래그 */
		isBackground?: boolean;
		/**
		 * 중요 알람(background)의 상/하단 위치 지정:
		 * - 'auto' (기본값): 겹침 여부에 따라 상단(Slot 0) / 하단(Slot 1) 자동 배정
		 * - 'top': 항상 상단 절반(Top 50%)에 표시
		 * - 'bottom': 항상 하단 절반(Bottom 50%)에 표시
		 * - 'full': 단독일 때 셀 전체(100%) 배경으로 표시
		 */
		bgPosition?: 'auto' | 'top' | 'bottom' | 'full';
		/**
		 * 일반 연속 일정(bar)의 수직 트랙 줄 위치 직접 지정:
		 * - 'auto' (기본값): 비어있는 가장 빠른 트랙에 자동 배정
		 * - 0: 첫 번째 줄(상단 트랙)에 고정
		 * - 1: 두 번째 줄(하단 트랙)에 고정
		 */
		lineSlot?: 'auto' | 0 | 1 | number;
		/** 사용자 지정 색상 (HEX/RGB, 지정 시 type 기본 색상보다 우선 적용) */
		color?: string;
		/** 보조 배지 텍스트 (예: '알람', '연차', '공지') */
		badge?: string;
		/** D-Day 카운트다운 배지 자동 표시 여부 */
		isDday?: boolean;
		/** 법정 공휴일 여부 (true 시 해당 날짜 숫자를 적색 표시) */
		isHoliday?: boolean;
		/** 부모 앱 원본 데이터 보관용 */
		raw?: any;
	}

	export interface CalendarDayCell {
		dateObj: Date;
		dateStr: string; // 'YYYY-MM-DD'
		day: number;
		dayOfWeek: number; // 0(일) ~ 6(토)
		timestamp: number; // 00:00:00 기준 ms
		isCurrentMonth: boolean;
		isToday: boolean;
	}

	/**
	 * 내부 렌더링용: 날짜별로 계산된 배경 알람(중요 알람) 슬롯 정보
	 */
	interface RenderedBgAlarm {
		event: CalendarEvent;
		slot: 0 | 1; // 0: 상단(Top), 1: 하단(Bottom)
		splitHalf: boolean; // true이면 상/하단 50% 분할, false이면 셀 전체 100%
		isStart: boolean; // 연속 알람의 시작일 여부
		isEnd: boolean; // 연속 알람의 종료일 여부
		isMultiDay: boolean; // 2일 이상 연속 알람 여부
	}

	/**
	 * 내부 렌더링용: 날짜별로 트랙(행 번호)이 고정 배정된 일반 일정 슬롯 정보
	 */
	interface RenderedBarSlot {
		event: CalendarEvent;
		trackIndex: number;
		isStart: boolean; // 시작일 여부 (이 날에만 제목 텍스트를 표시!)
		isEnd: boolean; // 종료일 여부 (연속 선이 끝나는 날)
		isMultiDay: boolean; // 2일 이상 연속 일정 여부
	}

	interface Props {
		/** 현재 표시 연도 (양방향 바인딩 가능) */
		year?: number;
		/** 현재 표시 월 (0 ~ 11, 양방향 바인딩 가능) */
		month?: number;
		/** 날짜별 표시할 일정/알림/휴무 이벤트 배열 */
		events?: CalendarEvent[];
		/** 선택 모드: 'single' | 'range' | 'multiple' | 'none' */
		selectionMode?: 'single' | 'range' | 'multiple' | 'none';
		/** 단일 선택된 날짜 ('YYYY-MM-DD', 양방향 바인딩 가능) */
		selectedDate?: string | null;
		/** 다중 또는 범위 선택된 날짜 목록 ('YYYY-MM-DD'[], 양방향 바인딩 가능) */
		selectedDates?: string[];
		/** 모바일 세로 모드에서 좌우 여백/보더를 완전히 제거할지 여부 (기본: true) */
		fullBleedMobile?: boolean;
		/**
		 * 셀 내부에 직접 렌더링할 고정 트랙 줄 수 (기본: 2).
		 * 3개 이상의 일정이 있는 날은 단차 방지를 위해 고정 2줄만 표시하고 나머지는 `...` 툴팁으로 제공합니다.
		 */
		maxVisibleEvents?: number;
		/** 연속선 및 일정 트랙 영역의 셀 내 수직 정렬 위치 ('top' | 'center' | 'bottom', 기본: 'center') */
		lineAlign?: 'top' | 'center' | 'bottom';
		/** 연속선의 두께 ('thin' | 'normal' | 'thick', 기본: 'normal') */
		lineThickness?: 'thin' | 'normal' | 'thick';
		/** 달력 하단에 선택된 날짜의 상세 일정/알림 브리핑 영역 표시 여부 (기본: true) */
		showSelectedDayPanel?: boolean;
		/** 6주(42일) 고정 여부 (기본: true) */
		fixedSixWeeks?: boolean;
		/** 상단 서브 타이틀 라벨 */
		subtitle?: string;
		/** 날짜 셀 클릭 콜백 */
		onDateClick?: (cell: CalendarDayCell, dayEvents: CalendarEvent[]) => void;
		/** 개별 이벤트 클릭 콜백 */
		onEventClick?: (event: CalendarEvent, cell: CalendarDayCell) => void;
		/** 월 이동 콜백 */
		onMonthChange?: (year: number, month: number) => void;
		/** 범위 선택 완료 콜백 (selectionMode === 'range') */
		onRangeSelect?: (startDate: string, endDate: string, rangeDates: string[]) => void;
		/** 선택된 날짜 패널에서 '+ 일정/알림 추가' 클릭 콜백 */
		onAddEventClick?: (dateStr: string) => void;
		/** 헤더 우측 커스텀 액션 영역 스니펫 */
		headerRight?: Snippet;
		/** 각 날짜 셀 하단 커스텀 렌더링 스니펫 */
		dayFooter?: Snippet<[CalendarDayCell, CalendarEvent[]]>;
		/** 선택 가능한 최소 날짜 ('YYYY-MM-DD', 미만 날짜 선택 비활성화) */
		minSelectableDate?: string | null;
		/** 선택 가능한 최대 날짜 ('YYYY-MM-DD', 초과 날짜 선택 비활성화) */
		maxSelectableDate?: string | null;
		/** 선택 불가 날짜 클릭 시 콜백 */
		onDisabledDateClick?: (cell: CalendarDayCell) => void;
	}

	const now = new Date();
	const todayStr = timestampToDateString(now.getTime());

	let {
		year = $bindable(now.getFullYear()),
		month = $bindable(now.getMonth()),
		events = [],
		selectionMode = 'single',
		selectedDate = $bindable<string | null>(todayStr),
		selectedDates = $bindable<string[]>([]),
		fullBleedMobile = true,
		maxVisibleEvents = 2,
		lineAlign = $bindable<'top' | 'center' | 'bottom'>('center'),
		lineThickness = $bindable<'thin' | 'normal' | 'thick'>('normal'),
		showSelectedDayPanel = true,
		fixedSixWeeks = true,
		subtitle = 'Integrated Schedule & Alert Calendar',
		onDateClick,
		onEventClick,
		onMonthChange,
		onRangeSelect,
		onAddEventClick,
		headerRight,
		dayFooter,
		minSelectableDate = null,
		maxSelectableDate = null,
		onDisabledDateClick
	}: Props = $props();

	const DAYS_OF_WEEK = ['일', '월', '화', '수', '목', '금', '토'];

	// 범위 선택('range') 진행 중 시작점 상태
	let rangeAnchor = $state<string | null>(null);

	// 부모에서 selectedDates를 비우면 진행 중이던 범위 시작점도 함께 초기화
	$effect(() => {
		if (selectedDates.length === 0) {
			rangeAnchor = null;
		}
	});

	// 모바일/데스크톱 겸용 `...` 툴팁 수동 토글 상태 (호버뿐만 아니라 클릭/터치 시에도 열림)
	let openTooltipDate = $state<string | null>(null);

	// 연속선 두께 클래스 계산
	const thicknessClass = $derived(
		lineThickness === 'thin'
			? 'h-[2px] sm:h-[3px]'
			: lineThickness === 'thick'
				? 'h-[5px] sm:h-[7px]'
				: 'h-[3px] sm:h-[5px]'
	);

	// 트랙 영역 수직 정렬 클래스 계산 (모든 셀의 트랙 슬롯 수가 동일하므로 어느 정렬이든 단차 0px 보장)
	const trackAlignClass = $derived(
		lineAlign === 'top'
			? 'justify-start'
			: lineAlign === 'bottom'
				? 'justify-end'
				: 'justify-center'
	);

	/**
	 * 임의의 날짜 입력값을 KST 기준 'YYYY-MM-DD' 문자열로 정규화합니다.
	 */
	function normalizeDateKey(input: string | number | Date | null | undefined): string {
		if (!input) return '';
		if (typeof input === 'string') {
			const trimmed = input.trim();
			if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
				return trimmed.slice(0, 10);
			}
		}
		if (typeof input === 'number') {
			return timestampToDateString(input);
		}
		const formatted = formatDate(input);
		return formatted !== '-' ? formatted : '';
	}

	/**
	 * 시작일('YYYY-MM-DD')부터 종료일('YYYY-MM-DD')까지의 모든 날짜 키 배열을 반환합니다.
	 */
	function expandDateRange(startKey: string, endKey: string): string[] {
		if (!startKey) return [];
		if (!endKey || endKey <= startKey) return [startKey];

		const sParts = startKey.split('-').map(Number);
		const eParts = endKey.split('-').map(Number);
		const cur = new Date(sParts[0], sParts[1] - 1, sParts[2]);
		const last = new Date(eParts[0], eParts[1] - 1, eParts[2]);
		const result: string[] = [];
		let guard = 0;
		while (cur <= last && guard < 120) {
			result.push(timestampToDateString(cur.getTime()));
			cur.setDate(cur.getDate() + 1);
			guard++;
		}
		return result;
	}

	/**
	 * 테마 타입별 스타일 팔레트 반환
	 */
	function getEventStyle(type: CalendarEventType = 'PRIMARY') {
		const upper = (type || 'PRIMARY').toUpperCase();
		switch (upper) {
			case 'HOLIDAY':
			case 'DANGER':
			case 'ALARM':
				return {
					bar: 'bg-rose-600 text-white border-rose-700',
					chip: 'bg-rose-50 text-rose-900 border-rose-500',
					line: 'bg-rose-500',
					dot: 'bg-rose-600',
					badge: 'bg-rose-600 text-white',
					bgFill: 'bg-rose-200/75',
					bgBorder: 'border-rose-500',
					bgText: 'text-rose-950 bg-rose-300/90'
				};
			case 'SUCCESS':
			case 'PERSONAL':
				return {
					bar: 'bg-emerald-600 text-white border-emerald-700',
					chip: 'bg-emerald-50 text-emerald-900 border-emerald-500',
					line: 'bg-emerald-500',
					dot: 'bg-emerald-500',
					badge: 'bg-emerald-600 text-white',
					bgFill: 'bg-emerald-200/75',
					bgBorder: 'border-emerald-500',
					bgText: 'text-emerald-950 bg-emerald-300/90'
				};
			case 'WARNING':
			case 'DAYOFF':
				return {
					bar: 'bg-amber-500 text-slate-950 border-amber-600',
					chip: 'bg-amber-50 text-amber-950 border-amber-500',
					line: 'bg-amber-500',
					dot: 'bg-amber-500',
					badge: 'bg-amber-500 text-slate-950',
					bgFill: 'bg-amber-200/80',
					bgBorder: 'border-amber-500',
					bgText: 'text-amber-950 bg-amber-300/90'
				};
			case 'INFO':
			case 'ATTENDANCE':
				return {
					bar: 'bg-cyan-600 text-white border-cyan-700',
					chip: 'bg-cyan-50 text-cyan-950 border-cyan-500',
					line: 'bg-cyan-500',
					dot: 'bg-cyan-500',
					badge: 'bg-cyan-600 text-white',
					bgFill: 'bg-cyan-200/75',
					bgBorder: 'border-cyan-500',
					bgText: 'text-cyan-950 bg-cyan-300/90'
				};
			default:
				return {
					bar: 'bg-blue-600 text-white border-blue-700',
					chip: 'bg-blue-50 text-blue-950 border-blue-500',
					line: 'bg-blue-600',
					dot: 'bg-blue-600',
					badge: 'bg-blue-600 text-white',
					bgFill: 'bg-blue-200/75',
					bgBorder: 'border-blue-500',
					bgText: 'text-blue-950 bg-blue-300/90'
				};
		}
	}

	/**
	 * ============================================================================
	 * [핵심 알고리즘 1] 전체 이벤트 인덱싱 (날짜별 전체 이벤트 목록)
	 * ============================================================================
	 */
	const eventsByDate = $derived.by(() => {
		const map = new Map<string, CalendarEvent[]>();
		for (const ev of events || []) {
			const startKey = normalizeDateKey(ev.date);
			if (!startKey) continue;
			const endKey = ev.endDate ? normalizeDateKey(ev.endDate) : startKey;
			const days = expandDateRange(startKey, endKey);
			for (const dKey of days) {
				const list = map.get(dKey) || [];
				list.push(ev);
				map.set(dKey, list);
			}
		}
		return map;
	});

	/**
	 * ============================================================================
	 * [핵심 알고리즘 2] 중요 알람(Background) 상/하단 2분할 슬롯 배정 및 연속 연결 계산
	 * ============================================================================
	 */
	const bgAlarmsByDate = $derived.by(() => {
		const map = new Map<string, RenderedBgAlarm[]>();
		const occupied = new Map<string, [RenderedBgAlarm | null, RenderedBgAlarm | null]>();

		const bgEvents = (events || []).filter(
			(ev) => ev.display === 'background' || ev.isBackground === true
		);

		const sortedBg = [...bgEvents].sort((a, b) => {
			const aStart = normalizeDateKey(a.date);
			const bStart = normalizeDateKey(b.date);
			if (aStart !== bStart) return aStart.localeCompare(bStart);
			const aEnd = normalizeDateKey(a.endDate || a.date);
			const bEnd = normalizeDateKey(b.endDate || b.date);
			return bEnd.localeCompare(aEnd);
		});

		const placements: {
			ev: CalendarEvent;
			days: string[];
			slot: 0 | 1;
		}[] = [];

		for (const ev of sortedBg) {
			const startKey = normalizeDateKey(ev.date);
			if (!startKey) continue;
			const endKey = ev.endDate ? normalizeDateKey(ev.endDate) : startKey;
			const days = expandDateRange(startKey, endKey);

			const preferredSlots: (0 | 1)[] =
				ev.bgPosition === 'bottom' ? [1, 0] : [0, 1];

			let chosenSlot: 0 | 1 | null = null;
			for (const candidate of preferredSlots) {
				const canFit = days.every((dKey) => {
					const pair = occupied.get(dKey) || [null, null];
					return pair[candidate] === null;
				});
				if (canFit) {
					chosenSlot = candidate;
					break;
				}
			}

			if (chosenSlot === null) {
				chosenSlot = preferredSlots[0];
			}

			placements.push({ ev, days, slot: chosenSlot });

			for (const dKey of days) {
				const pair = occupied.get(dKey) || [null, null];
				if (pair[chosenSlot] === null) {
					pair[chosenSlot] = {
						event: ev,
						slot: chosenSlot,
						splitHalf: true,
						isStart: dKey === startKey,
						isEnd: dKey === endKey,
						isMultiDay: days.length > 1
					};
					occupied.set(dKey, pair);
				}
			}
		}

		for (const { ev, days, slot } of placements) {
			const startKey = days[0];
			const endKey = days[days.length - 1];
			const hasOverlapInSpan = days.some((dKey) => {
				const pair = occupied.get(dKey);
				return pair && pair[0] !== null && pair[1] !== null;
			});

			const splitHalf =
				ev.bgPosition === 'top' ||
				ev.bgPosition === 'bottom' ||
				hasOverlapInSpan ||
				ev.bgPosition !== 'full';

			for (const dKey of days) {
				const pair = occupied.get(dKey);
				if (!pair || pair[slot]?.event !== ev) continue;

				const list = map.get(dKey) || [];
				list.push({
					event: ev,
					slot,
					splitHalf,
					isStart: dKey === startKey,
					isEnd: dKey === endKey,
					isMultiDay: days.length > 1
				});
				map.set(dKey, list);
			}
		}

		return map;
	});

	/**
	 * ============================================================================
	 * [핵심 알고리즘 3] 일반 일정(Bar/Line) 수평 트랙 고정 배정 (단차 0px 보장)
	 * ============================================================================
	 * - 각 일정에 고유한 수평 트랙 번호(`trackIndex`: 0, 1, 2...)를 배정합니다.
	 * - 사용자가 `ev.lineSlot` (예: 0 또는 1)을 명시한 경우 해당 트랙을 우선 배정하고,
	 *   그 외(`'auto'`)에는 전체 기간(date ~ endDate) 동안 비어 있는 가장 낮은 트랙에 배정합니다.
	 */
	const barTracksByDate = $derived.by(() => {
		const map = new Map<string, (RenderedBarSlot | null)[]>();

		const normalEvents = (events || []).filter(
			(ev) =>
				ev.display !== 'background' &&
				!ev.isBackground &&
				ev.type !== 'HOLIDAY' &&
				!ev.isHoliday
		);

		// 1순위: lineSlot이 명시된 일정 또는 다일(연속) 일정 우선 -> 2순위: 시작일 빠른 순 -> 3순위: 기간 긴 순
		const sorted = [...normalEvents].sort((a, b) => {
			const aMulti = a.endDate && normalizeDateKey(a.endDate) > normalizeDateKey(a.date) ? 1 : 0;
			const bMulti = b.endDate && normalizeDateKey(b.endDate) > normalizeDateKey(b.date) ? 1 : 0;
			if (aMulti !== bMulti) return bMulti - aMulti;

			const aStart = normalizeDateKey(a.date);
			const bStart = normalizeDateKey(b.date);
			if (aStart !== bStart) return aStart.localeCompare(bStart);

			const aEnd = normalizeDateKey(a.endDate || a.date);
			const bEnd = normalizeDateKey(b.endDate || b.date);
			return bEnd.localeCompare(aEnd);
		});

		for (const ev of sorted) {
			const startKey = normalizeDateKey(ev.date);
			if (!startKey) continue;
			const endKey = ev.endDate ? normalizeDateKey(ev.endDate) : startKey;
			const days = expandDateRange(startKey, endKey);

			let trackIndex =
				typeof ev.lineSlot === 'number' && ev.lineSlot >= 0 ? ev.lineSlot : 0;

			while (true) {
				const isFree = days.every((dKey) => {
					const tracks = map.get(dKey) || [];
					return !tracks[trackIndex];
				});
				if (isFree) break;
				trackIndex++;
			}

			for (const dKey of days) {
				const tracks = map.get(dKey) || [];
				while (tracks.length <= trackIndex) {
					tracks.push(null);
				}
				tracks[trackIndex] = {
					event: ev,
					trackIndex,
					isStart: dKey === startKey,
					isEnd: dKey === endKey,
					isMultiDay: days.length > 1
				};
				map.set(dKey, tracks);
			}
		}

		return map;
	});

	/**
	 * 날짜별 일반 일정(배경 알람·공휴일 제외) 배열 맵 (3개 이상 여부 및 툴팁 표시용)
	 */
	const normalEventsByDate = $derived.by(() => {
		const map = new Map<string, CalendarEvent[]>();
		for (const [dKey, list] of eventsByDate.entries()) {
			const filtered = list.filter(
				(ev) =>
					ev.display !== 'background' &&
					!ev.isBackground &&
					ev.type !== 'HOLIDAY' &&
					!ev.isHoliday
			);
			map.set(dKey, filtered);
		}
		return map;
	});

	/**
	 * 현재 연/월의 달력 그리드 셀 배열 생성
	 */
	const calendarCells = $derived.by<CalendarDayCell[]>(() => {
		const firstDayOfWeek = new Date(year, month, 1).getDay();
		const lastDateOfMonth = new Date(year, month + 1, 0).getDate();
		const prevMonthLastDate = new Date(year, month, 0).getDate();

		const cells: CalendarDayCell[] = [];

		for (let i = firstDayOfWeek - 1; i >= 0; i--) {
			const d = prevMonthLastDate - i;
			const dateObj = new Date(year, month - 1, d);
			dateObj.setHours(0, 0, 0, 0);
			const ts = dateObj.getTime();
			const dateStr = timestampToDateString(ts);
			cells.push({
				dateObj,
				dateStr,
				day: d,
				dayOfWeek: dateObj.getDay(),
				timestamp: ts,
				isCurrentMonth: false,
				isToday: dateStr === todayStr
			});
		}

		for (let d = 1; d <= lastDateOfMonth; d++) {
			const dateObj = new Date(year, month, d);
			dateObj.setHours(0, 0, 0, 0);
			const ts = dateObj.getTime();
			const dateStr = timestampToDateString(ts);
			cells.push({
				dateObj,
				dateStr,
				day: d,
				dayOfWeek: dateObj.getDay(),
				timestamp: ts,
				isCurrentMonth: true,
				isToday: dateStr === todayStr
			});
		}

		const targetTotal = fixedSixWeeks ? 42 : Math.ceil(cells.length / 7) * 7;
		const remaining = targetTotal - cells.length;
		for (let d = 1; d <= remaining; d++) {
			const dateObj = new Date(year, month + 1, d);
			dateObj.setHours(0, 0, 0, 0);
			const ts = dateObj.getTime();
			const dateStr = timestampToDateString(ts);
			cells.push({
				dateObj,
				dateStr,
				day: d,
				dayOfWeek: dateObj.getDay(),
				timestamp: ts,
				isCurrentMonth: false,
				isToday: dateStr === todayStr
			});
		}

		return cells;
	});

	function moveMonth(offset: number) {
		const next = new Date(year, month + offset, 1);
		year = next.getFullYear();
		month = next.getMonth();
		openTooltipDate = null;
		onMonthChange?.(year, month);
	}

	function goToToday() {
		const current = new Date();
		year = current.getFullYear();
		month = current.getMonth();
		selectedDate = todayStr;
		openTooltipDate = null;
		if (selectionMode === 'single') {
			selectedDates = [todayStr];
		}
		onMonthChange?.(year, month);
	}

	function isDateOutOfRange(dateStr: string): boolean {
		if (minSelectableDate && dateStr < minSelectableDate) return true;
		if (maxSelectableDate && dateStr > maxSelectableDate) return true;
		return false;
	}

	function handleCellClick(cell: CalendarDayCell) {
		const dayEvents = eventsByDate.get(cell.dateStr) || [];

		if (selectionMode !== 'none' && isDateOutOfRange(cell.dateStr)) {
			onDisabledDateClick?.(cell);
			return;
		}

		if (!cell.isCurrentMonth) {
			year = cell.dateObj.getFullYear();
			month = cell.dateObj.getMonth();
			onMonthChange?.(year, month);
		}

		selectedDate = cell.dateStr;

		if (selectionMode === 'single') {
			selectedDates = [cell.dateStr];
		} else if (selectionMode === 'multiple') {
			if (selectedDates.includes(cell.dateStr)) {
				selectedDates = selectedDates.filter((d) => d !== cell.dateStr);
			} else {
				selectedDates = [...selectedDates, cell.dateStr].sort();
			}
		} else if (selectionMode === 'range') {
			if (!rangeAnchor || selectedDates.length === 0 || selectedDates.length > 1) {
				rangeAnchor = cell.dateStr;
				selectedDates = [cell.dateStr];
			} else {
				const startStr = rangeAnchor <= cell.dateStr ? rangeAnchor : cell.dateStr;
				const endStr = rangeAnchor <= cell.dateStr ? cell.dateStr : rangeAnchor;
				const range = expandDateRange(startStr, endStr);
				selectedDates = range;
				rangeAnchor = null;
				onRangeSelect?.(startStr, endStr, range);
			}
		}

		onDateClick?.(cell, dayEvents);
	}

	function isCellSelected(dateStr: string): boolean {
		if (selectionMode === 'none') return false;
		if (selectionMode === 'single') {
			return selectedDate === dateStr || selectedDates.includes(dateStr);
		}
		return selectedDates.includes(dateStr);
	}

	const activeDateEvents = $derived(
		selectedDate ? eventsByDate.get(selectedDate) || [] : []
	);
</script>

<!-- ============================================================================ -->
<!-- 캘린더 최외곽 컨테이너: 모바일 세로 모드에서는 좌우 여백/보더/라운딩 완전 제거 가능 -->
<!-- ============================================================================ -->
<div
	class="calendar-root bg-white border-slate-900 transition-all
	       {fullBleedMobile
		? '-mx-4 sm:mx-0 rounded-none sm:rounded-3xl border-y-2 border-x-0 sm:border-2 px-0 py-3 sm:p-6 md:p-8 shadow-none sm:shadow-xl'
		: 'rounded-2xl sm:rounded-3xl border-2 p-3 sm:p-6 md:p-8 shadow-xl'}"
>
	<!-- ===================================================================== -->
	<!-- 1. 상단 컨트롤 헤더 -->
	<!-- ===================================================================== -->
	<div
		class="mb-3 sm:mb-5 flex flex-wrap items-center justify-between gap-2 border-b-2 border-slate-900 pb-3 sm:pb-5
		       {fullBleedMobile ? 'px-3 sm:px-0' : ''}"
	>
		<div class="flex flex-col">
			{#if subtitle}
				<span class="hidden sm:block text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase italic">
					{subtitle}
				</span>
			{/if}
			<div class="flex items-baseline gap-2 sm:gap-3">
				<h2 class="text-2xl sm:text-4xl md:text-5xl font-black tracking-tighter text-slate-900">
					{year}년
				</h2>
				<h2 class="text-2xl sm:text-4xl md:text-5xl font-black tracking-tighter text-blue-600">
					{String(month + 1).padStart(2, '0')}월
				</h2>
			</div>
		</div>

		<div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
			{#if headerRight}
				{@render headerRight()}
			{/if}

			<div class="inline-flex h-9 sm:h-11 overflow-hidden rounded-xl border-2 border-slate-900 bg-white shadow-xs">
				<button
					type="button"
					onclick={() => moveMonth(-1)}
					class="flex items-center justify-center px-2.5 sm:px-3.5 text-slate-700 transition hover:bg-slate-900 hover:text-white active:scale-95"
					aria-label="이전 달"
					title="이전 달"
				>
					<Icon icon="ph:caret-left-bold" class="h-4 w-4" />
				</button>
				<button
					type="button"
					onclick={goToToday}
					class="border-x-2 border-slate-900 px-2.5 sm:px-4 text-xs font-black text-slate-900 uppercase transition hover:bg-blue-600 hover:text-white"
				>
					오늘
				</button>
				<button
					type="button"
					onclick={() => moveMonth(1)}
					class="flex items-center justify-center px-2.5 sm:px-3.5 text-slate-700 transition hover:bg-slate-900 hover:text-white active:scale-95"
					aria-label="다음 달"
					title="다음 달"
				>
					<Icon icon="ph:caret-right-bold" class="h-4 w-4" />
				</button>
			</div>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 2. 요일 헤더 (일 ~ 토 7열) -->
	<!-- ===================================================================== -->
	<div
		class="grid grid-cols-7 border-t-2 border-b-2 border-slate-900 bg-slate-100
		       {fullBleedMobile ? 'sm:border-x-2' : 'border-x-2'}"
	>
		{#each DAYS_OF_WEEK as dayLabel, idx}
			<div
				class="py-2 sm:py-3 text-center text-xs sm:text-sm md:text-base font-black tracking-tight uppercase
				       {idx === 0 ? 'bg-rose-50/70 text-rose-600' : idx === 6 ? 'bg-blue-50/70 text-blue-600' : 'text-slate-700'}"
			>
				{dayLabel}
			</div>
		{/each}
	</div>

	<!-- ===================================================================== -->
	<!-- 3. 7열 날짜 그리드 (단차 0px 고정 높이 & 3개 이상 시 ... 플로팅 툴팁) -->
	<!-- ===================================================================== -->
	<div
		class="grid grid-cols-7 gap-px bg-slate-300 border-b-2 border-slate-900
		       {fullBleedMobile ? 'sm:border-x-2 sm:bg-slate-900' : 'border-x-2 bg-slate-900'}"
	>
		{#each calendarCells as cell (cell.dateStr)}
			{@const dayEvents = eventsByDate.get(cell.dateStr) || []}
			{@const bgAlarms = bgAlarmsByDate.get(cell.dateStr) || []}
			{@const barTracks = barTracksByDate.get(cell.dateStr) || []}
			{@const normalEvents = normalEventsByDate.get(cell.dateStr) || []}
			{@const hasHoliday = dayEvents.some((e) => e.isHoliday || e.type === 'HOLIDAY')}
			{@const holidayEvent = dayEvents.find((e) => e.isHoliday || e.type === 'HOLIDAY')}
			{@const selected = isCellSelected(cell.dateStr)}
			{@const disabledDate = selectionMode !== 'none' && isDateOutOfRange(cell.dateStr)}
			{@const hasOverflow =
				normalEvents.length >= 3 ||
				barTracks.slice(maxVisibleEvents).some((slot) => slot !== null)}

			<!-- 날짜 셀 컨테이너: 모든 셀의 고정 높이를 동일하게 맞춰 행/열 수평 기준선을 100% 일치시킴 -->
			<div
				role="button"
				tabindex="0"
				aria-disabled={disabledDate || undefined}
				onclick={() => handleCellClick(cell)}
				onmouseleave={() => {
					if (openTooltipDate === cell.dateStr) openTooltipDate = null;
				}}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						handleCellClick(cell);
					}
				}}
				class="group relative flex {dayFooter ? 'h-[98px] sm:h-[120px] md:h-[130px]' : 'h-[84px] sm:h-[106px] md:h-[120px]'} flex-col p-1 sm:p-1.5 md:p-2 text-left transition-colors outline-none select-none
				       {disabledDate ? 'cursor-not-allowed bg-slate-100/80 opacity-50' : cell.isCurrentMonth || minSelectableDate || maxSelectableDate ? 'cursor-pointer bg-white hover:bg-slate-50/80' : 'cursor-pointer bg-slate-50/80 opacity-45'}
				       {selected ? 'ring-2 ring-inset ring-blue-600 z-20' : ''}
				       {cell.isToday && !selected ? 'ring-2 ring-inset ring-slate-900' : ''}"
			>
				<!-- =============================================================== -->
				<!-- [레이어 A] 중요 알람 배경색 레이어 (하루 최대 2개: 상단 50% / 하단 50% 분할 및 연속 연결) -->
				<!-- =============================================================== -->
				{#if bgAlarms.length > 0}
					<div class="pointer-events-none absolute inset-0 z-0 overflow-visible">
						{#each bgAlarms as bg (bg.event.id ?? `${bg.event.title}-${bg.slot}`)}
							{@const style = getEventStyle(bg.event.type)}
							{@const posClass = !bg.splitHalf
								? 'inset-y-0'
								: bg.slot === 0
									? 'top-0 h-1/2 border-b border-black/10'
									: 'bottom-0 h-1/2 border-t border-black/10'}
							{@const connectClass = bg.isMultiDay
								? `${bg.isStart ? 'left-0 rounded-l-md border-l-4' : '-left-px'} ${bg.isEnd ? 'right-0 rounded-r-md border-r-2' : '-right-px'}`
								: 'inset-x-0'}

							<div
								class="absolute {posClass} {connectClass} {style.bgFill} {style.bgBorder} transition-all"
								style={bg.event.color ? `background-color: ${bg.event.color}33; border-color: ${bg.event.color};` : ''}
							>
								{#if bg.isStart || cell.dayOfWeek === 0}
									<span
										class="absolute {bg.slot === 1 && bg.splitHalf ? 'bottom-0.5' : 'top-0.5'} right-1 max-w-[68%] truncate rounded px-1 py-0.2 text-[8px] sm:text-[9px] font-black leading-none shadow-2xs {style.bgText}"
									>
										🔔 {bg.event.title}
									</span>
								{/if}
							</div>
						{/each}
					</div>
				{/if}

				<!-- =============================================================== -->
				<!-- [레이어 B] 셀 상단 고정 헤더 (높이 h-6 sm:h-7 완전 고정 -> 단차 원천 차단) -->
				<!-- - 날짜 숫자 + 공휴일 라벨 + 3개 이상 일정 시 `...` 플로팅 툴팁 트리거 -->
				<!-- =============================================================== -->
				<div class="relative z-30 flex h-6 sm:h-7 shrink-0 items-center justify-between gap-0.5">
					<span
						class="inline-flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-lg text-[11px] sm:text-xs md:text-sm font-black leading-none
						       {cell.isToday
							? 'bg-slate-900 text-white shadow-xs'
							: selected
								? 'bg-blue-600 text-white'
								: cell.dayOfWeek === 0 || hasHoliday
									? 'text-rose-600'
									: cell.dayOfWeek === 6
										? 'text-blue-600'
										: 'text-slate-900'}"
					>
						{cell.day}
					</span>

					<div class="flex items-center gap-1 min-w-0">
						{#if holidayEvent && !hasOverflow}
							<span class="max-w-[64px] sm:max-w-[90px] truncate rounded bg-rose-600/10 px-1 text-[8px] sm:text-[10px] font-black text-rose-600 leading-tight">
								{holidayEvent.title}
							</span>
						{/if}

						<!-- 💬 [3개 이상 일정 시 `...` 배지 & 플로팅 툴팁] -->
						{#if hasOverflow}
							<div class="group/more relative">
								<button
									type="button"
									onclick={(e) => {
										e.stopPropagation();
										openTooltipDate =
											openTooltipDate === cell.dateStr ? null : cell.dateStr;
									}}
									aria-label={`${cell.dateStr} 전체 일정 ${normalEvents.length}건 툴팁 보기`}
									class="inline-flex items-center gap-0.5 rounded-md bg-slate-900 px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black leading-none text-white shadow-xs transition hover:bg-blue-600"
								>
									<span class="tracking-widest">...</span>
									<span class="text-[8px] text-amber-300">{normalEvents.length}</span>
								</button>

								<!-- 플로팅 툴팁 카드 (마우스 호버 또는 클릭 시 즉시 표시) -->
								<div
									class="pointer-events-auto invisible opacity-0 group-hover/more:visible group-hover/more:opacity-100 {openTooltipDate === cell.dateStr ? '!visible !opacity-100' : ''}
									       absolute top-full {cell.dayOfWeek >= 4 ? 'right-0' : 'left-0'} z-50 mt-1.5 w-52 sm:w-64 rounded-2xl border-2 border-slate-900 bg-slate-900 p-3 text-white shadow-2xl transition-all duration-150"
								>
									<div class="mb-2 flex items-center justify-between border-b border-slate-700 pb-1.5 text-[10px] font-black text-slate-300">
										<span>📅 {cell.dateStr} 전체 일정</span>
										<span class="rounded bg-blue-600 px-1.5 py-0.2 text-white">{dayEvents.length}건</span>
									</div>
									<div class="space-y-1.5 max-h-44 overflow-y-auto">
										{#each dayEvents as ev}
											{@const evStyle = getEventStyle(ev.type)}
											<div
												role="button"
												tabindex="0"
												onclick={(e) => {
													e.stopPropagation();
													onEventClick?.(ev, cell);
												}}
												onkeydown={(e) => {
													if (e.key === 'Enter') {
														e.stopPropagation();
														onEventClick?.(ev, cell);
													}
												}}
												class="flex items-center justify-between gap-2 rounded-lg bg-slate-800 px-2 py-1.5 text-[11px] hover:bg-slate-700"
											>
												<div class="flex items-center gap-1.5 min-w-0">
													<span
														class="h-2 w-2 shrink-0 rounded-full {evStyle.dot}"
														style={ev.color ? `background-color: ${ev.color};` : ''}
													></span>
													<span class="truncate font-bold text-white">{ev.title}</span>
												</div>
												{#if ev.time}
													<span class="shrink-0 font-mono text-[9px] text-slate-400">{ev.time}</span>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							</div>
						{/if}
					</div>
				</div>

				<!-- =============================================================== -->
				<!-- [레이어 C] 단차 0px 일반 일정 & 연속선 트랙 영역 (z-10) -->
				<!-- - 모든 날짜 칸이 항상 동일한 `Array(maxVisibleEvents)` 개의 고정 높이(h-5 sm:h-6) 슬롯을 가집니다. -->
				<!-- - 연속선의 수직 중심을 슬롯 정중앙(top-1/2 -translate-y-1/2)으로 통일하여 -->
				<!--   첫날(제목+시작선)과 둘째날~종료일(연속선) 사이에 단차가 전혀 발생하지 않습니다. -->
				<!-- =============================================================== -->
				<div class="relative z-10 flex flex-1 flex-col {trackAlignClass} gap-0.5">
					{#each Array(maxVisibleEvents) as _, tIdx}
						{@const slot = barTracks[tIdx]}
						<div class="relative flex h-5 sm:h-6 w-full items-center">
							{#if slot}
								{@const ev = slot.event}
								{@const style = getEventStyle(ev.type)}

								{#if !slot.isMultiDay}
									<!-- ① 하루짜리 단일 일반 일정 -->
									<button
										type="button"
										onclick={(e) => {
											e.stopPropagation();
											onEventClick?.(ev, cell);
										}}
										class="flex h-4 sm:h-5 w-full items-center justify-between gap-1 rounded border-l-3 px-1 sm:px-1.5 text-left text-[9px] sm:text-[11px] font-bold transition hover:brightness-95 {style.chip}"
										style={ev.color ? `border-left-color: ${ev.color};` : ''}
										title={ev.time ? `[${ev.time}] ${ev.title}` : ev.title}
									>
										<div class="flex items-center gap-1 min-w-0 flex-1">
											{#if ev.isDday}
												<span class="hidden sm:inline-block shrink-0 rounded bg-slate-900 px-1 text-[8px] font-black text-white">
													{formatDDay(cell.dateStr)}
												</span>
											{/if}
											<span class="truncate font-extrabold">{ev.title}</span>
										</div>
									</button>
								{:else if slot.isStart}
									<!-- ② 연속 일정의 '첫날(isStart)': -->
									<!--    슬롯 정중앙(top-1/2 -translate-y-1/2)에 우측 셀 경계까지 뻗는 연속선을 먼저 깔고, -->
									<!--    그 위에 첫날 제목 배지를 얹어 다음 날 연속선과 높이를 100% 일치시킵니다. -->
									<button
										type="button"
										onclick={(e) => {
											e.stopPropagation();
											onEventClick?.(ev, cell);
										}}
										title={`${ev.title} (${normalizeDateKey(ev.date)} ~ ${normalizeDateKey(ev.endDate)})`}
										class="group/start relative flex h-full w-full items-center text-left cursor-pointer"
									>
										<!-- 첫날에서 우측 셀 경계 밖(-right-1.5 sm:-right-2.5)까지 수평으로 뻗어나가는 기준 연속선 -->
										<span
											class="pointer-events-none absolute top-1/2 left-0 -right-1.5 sm:-right-2 md:-right-2.5 -translate-y-1/2 z-0 {thicknessClass} {style.line}"
											style={ev.color ? `background-color: ${ev.color};` : ''}
										></span>
										<!-- 첫날 제목 배지 (연속선 정중앙 위에 안착) -->
										<span
											class="relative z-10 inline-flex max-w-[92%] items-center gap-1 truncate rounded px-1 sm:px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black leading-none shadow-xs {style.bar}"
											style={ev.color ? `background-color: ${ev.color}; border-color: ${ev.color};` : ''}
										>
											<span class="truncate">{ev.title}</span>
										</span>
									</button>
								{:else}
									<!-- ③ 연속 일정의 '중간일/종료일(!isStart)': -->
									<!--    첫날과 정확히 동일한 top-1/2 -translate-y-1/2 수직 중심선에 연속선만 표시합니다. -->
									<button
										type="button"
										onclick={(e) => {
											e.stopPropagation();
											onEventClick?.(ev, cell);
										}}
										aria-label={`${ev.title} (연속 일정)`}
										title={`${ev.title} (${normalizeDateKey(ev.date)} ~ ${normalizeDateKey(ev.endDate)})`}
										class="group/line relative flex h-full w-full items-center cursor-pointer"
									>
										<!-- 좌측 셀 경계 밖(-left-1.5)에서 이어져 나오는 수평 연속선 (단차 0px) -->
										<span
											class="pointer-events-none absolute top-1/2 -left-1.5 sm:-left-2 md:-left-2.5 {slot.isEnd ? 'right-1.5 sm:right-2 rounded-r-full' : '-right-1.5 sm:-right-2 md:-right-2.5'} -translate-y-1/2 transition-all {thicknessClass} {style.line}"
											style={ev.color ? `background-color: ${ev.color};` : ''}
										></span>
										<!-- 종료일(isEnd) 끝점 마커 캡 -->
										{#if slot.isEnd}
											<span
												class="pointer-events-none absolute top-1/2 right-1 sm:right-1.5 -translate-y-1/2 h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full ring-2 ring-white {style.line}"
												style={ev.color ? `background-color: ${ev.color};` : ''}
											></span>
										{/if}
									</button>
								{/if}
							{/if}
						</div>
					{/each}
				</div>

				<!-- 셀 하단: 부모 커스텀 스니펫 슬롯 -->
				{#if dayFooter}
					<div class="relative z-10 mt-0.5 shrink-0">
						{@render dayFooter(cell, dayEvents)}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- ===================================================================== -->
	<!-- 4. 선택된 날짜의 일정/알림 상세 브리핑 바 -->
	<!-- ===================================================================== -->
	{#if showSelectedDayPanel && selectedDate}
		<div
			class="mt-3 sm:mt-5 rounded-none sm:rounded-2xl border-b sm:border-2 border-slate-200 bg-slate-50 p-3.5 sm:p-5"
		>
			<div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
				<div class="flex items-center gap-2">
					<span class="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-white">
						<Icon icon="ph:calendar-check-fill" class="h-4.5 w-4.5" />
					</span>
					<div>
						<div class="flex flex-wrap items-center gap-2">
							<h3 class="text-sm sm:text-base font-black text-slate-900">
								{selectedDate}
							</h3>
							{#if selectedDate === todayStr}
								<span class="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-black text-blue-700">
									오늘
								</span>
							{/if}
							{#if selectionMode === 'range' && selectedDates.length > 1}
								<span class="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-black text-indigo-700">
									범위 선택: {selectedDates[0]} ~ {selectedDates[selectedDates.length - 1]} ({selectedDates.length}일)
								</span>
							{:else if selectionMode === 'multiple' && selectedDates.length > 0}
								<span class="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">
									다중 선택: {selectedDates.length}일
								</span>
							{/if}
						</div>
						<p class="text-[11px] font-bold text-slate-400">
							선택한 날짜에 걸친 일정·중요알람 총 <strong class="text-blue-600">{activeDateEvents.length}</strong>건
						</p>
					</div>
				</div>

				{#if onAddEventClick}
					<button
						type="button"
						onclick={() => selectedDate && onAddEventClick(selectedDate)}
						class="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
					>
						<Icon icon="ph:plus-bold" class="h-3.5 w-3.5" />
						<span>일정·알림 추가</span>
					</button>
				{/if}
			</div>

			{#if activeDateEvents.length === 0}
				<div class="py-5 text-center text-xs font-bold text-slate-400">
					선택한 날짜에 등록된 일정이나 중요 알람이 없습니다.
				</div>
			{:else}
				<div class="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
					{#each activeDateEvents as ev}
						{@const style = getEventStyle(ev.type)}
						{@const matchedCell = calendarCells.find((c) => c.dateStr === selectedDate)}
						{@const isBg = ev.display === 'background' || ev.isBackground}
						<button
							type="button"
							onclick={() => matchedCell && onEventClick?.(ev, matchedCell)}
							class="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-2xs transition hover:border-slate-400 active:scale-[0.99]"
						>
							<div class="flex items-center gap-2.5 min-w-0">
								<span
									class="h-3 w-3 shrink-0 rounded-full {style.dot}"
									style={ev.color ? `background-color: ${ev.color};` : ''}
								></span>
								<div class="min-w-0">
									<div class="flex flex-wrap items-center gap-1.5">
										{#if isBg}
											<span class="rounded bg-slate-900 px-1.5 py-0.2 text-[9px] font-black text-amber-300">
												🔔 배경 알람
											</span>
										{/if}
										{#if ev.badge}
											<span class="rounded px-1.5 py-0.2 text-[9px] font-black {style.badge}">
												{ev.badge}
											</span>
										{/if}
										{#if ev.isDday && selectedDate}
											<span class="rounded bg-slate-900 px-1.5 py-0.2 text-[9px] font-black text-white">
												{formatDDay(selectedDate)}
											</span>
										{/if}
										<span class="truncate text-xs sm:text-sm font-black text-slate-900">
											{ev.title}
										</span>
									</div>
									{#if ev.endDate && normalizeDateKey(ev.endDate) !== normalizeDateKey(ev.date)}
										<p class="mt-0.5 text-[10px] font-bold text-slate-400">
											연속 기간: {normalizeDateKey(ev.date)} ~ {normalizeDateKey(ev.endDate)}
										</p>
									{/if}
								</div>
							</div>

							{#if ev.time}
								<span class="shrink-0 rounded-lg bg-slate-100 px-2 py-1 font-mono text-[11px] font-bold text-slate-600">
									{ev.time}
								</span>
							{/if}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>
