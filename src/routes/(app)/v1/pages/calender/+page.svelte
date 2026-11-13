<script lang="ts">
	/**
	 * ============================================================================
	 * [공용 확장형 캘린더 데모 및 검증 페이지 (/v1/pages/calender/+page.svelte)]
	 * ============================================================================
	 *
	 * 💡 이 페이지에서 시연·검증하는 핵심 기능:
	 * 1. [중요 알람 (배경색 표시 & 상/하단 2분할 & 연속 연결)]:
	 *    - `display: 'background'`로 등록된 중요 알람은 날짜 칸의 배경색을 바꿉니다.
	 *    - 하루 최대 2개까지 상단(50%)과 하단(50%)으로 나누어 서로 다른 색상으로 표시되며,
	 *      연속된 기간인 경우 셀 경계를 넘어 하나로 연결된 배경 띠 형태로 표시됩니다.
	 * 2. [일반 일정 (단차 0px 연속선 & 위치/굵기 조정)]:
	 *    - 연속 일정은 시작일에만 제목 배지를 표시하고, 이후 날짜에는 시작일과 1px의 단차도 없이
	 *      동일한 수평 중심선(top-1/2)에 연속된 컬러 선(Line)만 표시합니다.
	 *    - 상단 컨트롤 바에서 연속선의 수직 정렬 위치(상단/중앙/하단)와 선 굵기를 실시간 조정할 수 있습니다.
	 * 3. [3개 이상 일정 시 `...` 배지 및 플로팅 툴팁(Tooltip)]:
	 *    - 한 날짜에 일정이 3개 이상 겹쳐도 셀 높이가 늘어나거나 연속선에 단차가 생기지 않도록,
	 *      우측 상단에 `...` 배지를 띄우고 마우스 호버/클릭 시 전체 일정을 툴팁으로 보여줍니다.
	 */
	import Calendar, {
		type CalendarEvent,
		type CalendarDayCell
	} from '$lib/components/Calendar.svelte';
	import { getSiteTitle } from '$lib/config/site';
	import { toast } from '$lib/runes/toast.svelte';
	import { timestampToDateString } from '$lib/utils';
	import Icon from '@iconify/svelte';

	const now = new Date();
	const currentYear = now.getFullYear();
	const currentMonth = now.getMonth();
	const todayStr = timestampToDateString(now.getTime());

	/** 현재 월의 특정 일자('YYYY-MM-DD') 생성 헬퍼 */
	function makeMonthDate(day: number): string {
		const d = new Date(currentYear, currentMonth, day);
		return timestampToDateString(d.getTime());
	}

	// 📌 캘린더 바인딩 상태
	let year = $state(currentYear);
	let month = $state(currentMonth);
	let selectedDate = $state<string | null>(todayStr);
	let selectedDates = $state<string[]>([todayStr]);
	let selectionMode = $state<'single' | 'range' | 'multiple'>('single');
	let fullBleedMobile = $state(true);

	// 📌 연속선 수직 정렬 위치 및 굵기 상태
	let lineAlign = $state<'top' | 'center' | 'bottom'>('center');
	let lineThickness = $state<'thin' | 'normal' | 'thick'>('normal');

	// 📌 초기 샘플 데이터:
	//    1) 중요 알람(배경색) 연속 및 상/하단 2분할 겹침 예제 (4~7일 상단 적색 + 6~9일 하단 황색)
	//    2) 일반 연속 일정 단차 0px 일직선 예제 (11~14일 1열 파란선 + 13~16일 2열 초록선)
	//    3) 14일: 3개 이상 일정 중첩(`... 4` 플로팅 툴팁 표시 예제 — 단차 없이 연속선 일직선 유지)
	let events = $state<CalendarEvent[]>([
		// 🔔 [중요 알람 1] 04일 ~ 07일 연속 배경색 알람 (상단 Slot 0)
		{
			id: 101,
			date: makeMonthDate(4),
			endDate: makeMonthDate(7),
			title: '기상특보 비상대기 발령',
			time: '상시',
			type: 'DANGER',
			display: 'background',
			bgPosition: 'top',
			badge: '중요알람'
		},
		// 🔔 [중요 알람 2] 06일 ~ 09일 연속 배경색 알람 (하단 Slot 1 -> 06, 07일에 상/하단 2색 분할!)
		{
			id: 102,
			date: makeMonthDate(6),
			endDate: makeMonthDate(9),
			title: '전 차량 제동장치 특별점검',
			time: '상시',
			type: 'WARNING',
			display: 'background',
			bgPosition: 'bottom',
			badge: '중요알람'
		},
		// 🔔 [중요 알람 3] 24일 단독 전체 배경 알람
		{
			id: 103,
			date: makeMonthDate(24),
			title: '전사 서버 정기 점검일',
			time: '02:00',
			type: 'INFO',
			display: 'background',
			bgPosition: 'full',
			badge: '배경알림'
		},
		// 📏 [일반 연속 일정 1] 11일 ~ 14일 (11일에만 제목 표시 + 12~14일은 단차 없는 파란 연속선)
		{
			id: 201,
			date: makeMonthDate(11),
			endDate: makeMonthDate(14),
			title: '동절기 노선개편 시범운행',
			time: '09:00',
			type: 'PRIMARY',
			display: 'bar',
			lineSlot: 0,
			badge: '연속일정'
		},
		// 📏 [일반 연속 일정 2] 13일 ~ 16일 (13일에만 제목 표시 + 14~16일은 단차 없는 초록 연속선)
		{
			id: 202,
			date: makeMonthDate(13),
			endDate: makeMonthDate(16),
			title: '김제주 기사 정기 연차휴가',
			time: '종일',
			type: 'SUCCESS',
			display: 'bar',
			lineSlot: 1,
			badge: '휴무'
		},
		// 💬 [14일 3개 이상 중첩 테스트용 추가 일정들 -> 14일 우측 상단에 `... 4` 툴팁 버튼 생성!]
		{
			id: 203,
			date: makeMonthDate(14),
			title: '오후 정비팀 합동 브리핑',
			time: '14:00',
			type: 'INFO',
			display: 'bar',
			badge: '회의'
		},
		{
			id: 204,
			date: makeMonthDate(14),
			title: '타이어 마모도 전수 보고 마감',
			time: '17:30',
			type: 'DANGER',
			display: 'bar',
			badge: '마감'
		},
		// 📌 [단일 일반 일정 & 공휴일 & D-Day]
		{
			id: 301,
			date: makeMonthDate(1),
			title: '월례 안전운행 조회',
			time: '08:30',
			type: 'PRIMARY',
			badge: '공지'
		},
		{
			id: 302,
			date: makeMonthDate(18),
			title: '창립기념 공휴일',
			type: 'HOLIDAY',
			isHoliday: true
		},
		{
			id: 303,
			date: makeMonthDate(21),
			title: '분기 보안감사 제출 마감',
			time: '18:00',
			type: 'PRIMARY',
			isDday: true
		}
	]);

	// 📌 우측 빠른 등록 폼 상태
	let newTitle = $state('');
	let newStartDate = $state(todayStr);
	let newEndDate = $state(todayStr);
	let newDisplay = $state<'bar' | 'background'>('bar');
	let newBgPosition = $state<'auto' | 'top' | 'bottom' | 'full'>('auto');
	let newLineSlot = $state<'auto' | 0 | 1>('auto');
	let newTime = $state('09:00');
	let newType = $state<CalendarEvent['type']>('PRIMARY');
	let newBadge = $state('일정');
	let newIsDday = $state(false);

	// 달력에서 날짜나 범위가 선택되면 등록 폼의 시작일/종료일도 자동 연동
	$effect(() => {
		if (selectionMode === 'range' && selectedDates.length > 1) {
			newStartDate = selectedDates[0];
			newEndDate = selectedDates[selectedDates.length - 1];
		} else if (selectedDate) {
			newStartDate = selectedDate;
			if (!newEndDate || newEndDate < selectedDate) {
				newEndDate = selectedDate;
			}
		}
	});

	function handleAddEvent(e: SubmitEvent) {
		e.preventDefault();
		if (!newStartDate) {
			toast.warning('시작 날짜를 선택해 주세요.');
			return;
		}
		if (!newTitle.trim()) {
			toast.warning('일정 또는 중요 알람 제목을 입력해 주세요.');
			return;
		}

		const safeEnd = newEndDate && newEndDate >= newStartDate ? newEndDate : newStartDate;

		const created: CalendarEvent = {
			id: Date.now(),
			date: newStartDate,
			endDate: safeEnd !== newStartDate ? safeEnd : null,
			title: newTitle.trim(),
			time: newTime || '종일',
			type: newType,
			display: newDisplay,
			isBackground: newDisplay === 'background',
			bgPosition: newDisplay === 'background' ? newBgPosition : undefined,
			lineSlot: newDisplay === 'bar' ? newLineSlot : undefined,
			badge: newDisplay === 'background' ? '중요알람' : newBadge,
			isDday: newIsDday,
			isHoliday: newType === 'HOLIDAY'
		};

		events = [...events, created];
		newTitle = '';
		newIsDday = false;
		toast.success(
			`[${newStartDate}${safeEnd !== newStartDate ? ' ~ ' + safeEnd : ''}] ${newDisplay === 'background' ? '중요 배경 알람' : '일정'}이 등록되었습니다.`
		);
	}

	function handleDeleteEvent(id: string | number | undefined) {
		if (id === undefined) return;
		events = events.filter((e) => e.id !== id);
		toast.info('이벤트가 삭제되었습니다.');
	}

	function handleEventClick(ev: CalendarEvent, cell: CalendarDayCell) {
		const modeLabel =
			ev.display === 'background' || ev.isBackground ? '🔔 중요 배경 알람' : '📅 일반 일정';
		toast.info(`${modeLabel}: [${cell.dateStr}] ${ev.title}`);
	}
</script>

<svelte:head>
	<title>{getSiteTitle('통합 캘린더')}</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-5 px-4 py-4 sm:py-8 pb-28 font-['Noto_Sans_KR','Outfit'] md:px-8">
	<!-- ===================================================================== -->
	<!-- 1. 페이지 상단 헤더 및 모드·연속선 위치 전환 컨트롤 -->
	<!-- ===================================================================== -->
	<div class="flex flex-col gap-4 border-b-2 border-slate-900 pb-5 xl:flex-row xl:items-end xl:justify-between md:border-b-4">
		<div>
			<span class="text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase">
				Shared Component · $lib/components/Calendar.svelte
			</span>
			<h1 class="mt-1 text-2xl sm:text-4xl font-black tracking-tight text-slate-900 uppercase italic">
				통합 <span class="not-italic text-blue-600">캘린더</span>
			</h1>
			<p class="mt-1 text-xs sm:text-sm font-bold text-slate-500">
				① 상/하단 2분할 연속 배경 알람 &nbsp;·&nbsp; ② 단차 없는(Zero-Step) 연속선 & 위치 조정 &nbsp;·&nbsp; ③ 3개 이상 시 <code class="rounded bg-slate-900 px-1 text-white">...</code> 플로팅 툴팁
			</p>
		</div>

		<!-- 선택 모드 / 연속선 위치 / 선 굵기 / 모바일 무여백 컨트롤 -->
		<div class="flex flex-wrap items-center gap-2">
			<!-- 선택 모드 -->
			<div class="inline-flex rounded-xl border-2 border-slate-900 bg-slate-100 p-0.5 text-xs font-black">
				<button
					type="button"
					onclick={() => {
						selectionMode = 'single';
						selectedDates = selectedDate ? [selectedDate] : [];
					}}
					class="rounded-lg px-2.5 py-1.5 transition {selectionMode === 'single' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}"
				>
					단일
				</button>
				<button
					type="button"
					onclick={() => {
						selectionMode = 'range';
						selectedDates = selectedDate ? [selectedDate] : [];
					}}
					class="rounded-lg px-2.5 py-1.5 transition {selectionMode === 'range' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}"
				>
					기간(Range)
				</button>
				<button
					type="button"
					onclick={() => {
						selectionMode = 'multiple';
						selectedDates = selectedDate ? [selectedDate] : [];
					}}
					class="rounded-lg px-2.5 py-1.5 transition {selectionMode === 'multiple' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}"
				>
					다중
				</button>
			</div>

			<!-- 연속선 수직 정렬 위치 조정 -->
			<div class="inline-flex items-center rounded-xl border-2 border-slate-900 bg-slate-100 p-0.5 text-xs font-black">
				<span class="px-2 text-[10px] text-slate-500">연속선 위치</span>
				<button
					type="button"
					onclick={() => (lineAlign = 'top')}
					class="rounded-lg px-2 py-1.5 transition {lineAlign === 'top' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'}"
				>
					상단
				</button>
				<button
					type="button"
					onclick={() => (lineAlign = 'center')}
					class="rounded-lg px-2 py-1.5 transition {lineAlign === 'center' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'}"
				>
					중앙
				</button>
				<button
					type="button"
					onclick={() => (lineAlign = 'bottom')}
					class="rounded-lg px-2 py-1.5 transition {lineAlign === 'bottom' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:text-slate-900'}"
				>
					하단
				</button>
			</div>

			<!-- 연속선 굵기 조정 -->
			<div class="inline-flex items-center rounded-xl border-2 border-slate-900 bg-slate-100 p-0.5 text-xs font-black">
				<span class="px-2 text-[10px] text-slate-500">선 굵기</span>
				<button
					type="button"
					onclick={() => (lineThickness = 'thin')}
					class="rounded-lg px-2 py-1.5 transition {lineThickness === 'thin' ? 'bg-slate-900 text-white' : 'text-slate-600'}"
				>
					얇게
				</button>
				<button
					type="button"
					onclick={() => (lineThickness = 'normal')}
					class="rounded-lg px-2 py-1.5 transition {lineThickness === 'normal' ? 'bg-slate-900 text-white' : 'text-slate-600'}"
				>
					보통
				</button>
				<button
					type="button"
					onclick={() => (lineThickness = 'thick')}
					class="rounded-lg px-2 py-1.5 transition {lineThickness === 'thick' ? 'bg-slate-900 text-white' : 'text-slate-600'}"
				>
					굵게
				</button>
			</div>

			<button
				type="button"
				onclick={() => (fullBleedMobile = !fullBleedMobile)}
				class="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 px-3 py-1.5 text-xs font-black transition {fullBleedMobile ? 'bg-blue-600 text-white' : 'bg-white text-slate-700'}"
				title="모바일 세로 화면에서 좌우 여백 제거 여부"
			>
				<Icon icon="ph:device-mobile-bold" class="h-4 w-4" />
				<span>모바일 무여백: {fullBleedMobile ? 'ON' : 'OFF'}</span>
			</button>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 2. 시각적 범례 안내 배너 (3가지 핵심 기능 요약) -->
	<!-- ===================================================================== -->
	<div class="grid grid-cols-1 gap-3 md:grid-cols-3">
		<div class="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50/60 p-3 text-xs">
			<div class="flex h-9 w-9 shrink-0 flex-col overflow-hidden rounded-lg border border-slate-900">
				<div class="h-1/2 w-full bg-rose-300"></div>
				<div class="h-1/2 w-full bg-amber-300"></div>
			</div>
			<div>
				<div class="font-black text-slate-900">① 중요 알람 상·하단 배경 분할</div>
				<p class="text-[11px] font-bold text-slate-500">
					<strong>4~7일(상단 적색)</strong> + <strong>6~9일(하단 황색)</strong> 연속 연결
				</p>
			</div>
		</div>

		<div class="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/60 p-3 text-xs">
			<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-900 bg-white px-1">
				<div class="flex w-full items-center">
					<span class="h-2.5 w-3 rounded-xs bg-blue-600"></span>
					<span class="h-1 flex-1 bg-blue-600"></span>
					<span class="h-2 w-2 rounded-full bg-blue-600"></span>
				</div>
			</div>
			<div>
				<div class="font-black text-slate-900">② 단차 없는(Zero-Step) 연속선</div>
				<p class="text-[11px] font-bold text-slate-500">
					<strong>11~14일(1열)</strong> · <strong>13~16일(2열)</strong> 첫날 제목 + 일직선
				</p>
			</div>
		</div>

		<div class="flex items-center gap-3 rounded-2xl border border-slate-300 bg-slate-100/80 p-3 text-xs">
			<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 font-black text-white">
				...
			</div>
			<div>
				<div class="font-black text-slate-900">③ 3개 이상 일정 시 <code class="rounded bg-slate-900 px-1 text-white">...</code> 툴팁</div>
				<p class="text-[11px] font-bold text-slate-500">
					<strong>14일(총 4건)</strong>의 <code class="rounded bg-slate-900 px-1 text-white">... 4</code> 배지에 마우스를 올려보세요.
				</p>
			</div>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 3. 메인 레이아웃: 좌측 공용 캘린더 + 우측 일정/중요알람 등록 패널 -->
	<!-- ===================================================================== -->
	<div class="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
		<!-- 좌측: 공용 Calendar 컴포넌트 영역 -->
		<div class="lg:col-span-8">
			<Calendar
				bind:year
				bind:month
				bind:selectedDate
				bind:selectedDates
				bind:lineAlign
				bind:lineThickness
				{events}
				{selectionMode}
				{fullBleedMobile}
				onEventClick={handleEventClick}
			/>
		</div>

		<!-- 우측: 일정 / 중요 배경 알람 등록 및 목록 관리 패널 -->
		<div class="space-y-5 lg:col-span-4">
			<form
				onsubmit={handleAddEvent}
				class="rounded-2xl sm:rounded-3xl border-2 border-slate-900 bg-white p-5 sm:p-6 shadow-xl space-y-4"
			>
				<div class="flex items-center justify-between border-b border-slate-200 pb-3">
					<div class="flex items-center gap-2">
						<span class="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white">
							<Icon icon="ph:calendar-plus-bold" class="h-4.5 w-4.5" />
						</span>
						<div>
							<h2 class="text-sm font-black text-slate-900 uppercase">일정 · 중요 알람 등록</h2>
							<p class="text-[11px] font-bold text-slate-400">
								단차 없는 연속선 일정 또는 상·하단 배경 알람 추가
							</p>
						</div>
					</div>
				</div>

				<!-- 표시 방식 선택 탭 (일반 일정 vs 중요 배경 알람) -->
				<div>
					<span class="block text-xs font-black text-slate-700 mb-1.5">표시 방식</span>
					<div class="grid grid-cols-2 gap-2">
						<button
							type="button"
							onclick={() => (newDisplay = 'bar')}
							class="flex flex-col items-start rounded-xl border-2 p-2.5 text-left transition {newDisplay === 'bar' ? 'border-blue-600 bg-blue-50/70 text-blue-950' : 'border-slate-200 text-slate-600 hover:border-slate-300'}"
						>
							<span class="text-xs font-black">📏 일반 일정</span>
							<span class="text-[10px] font-bold opacity-75">첫날 제목 + 연속 선</span>
						</button>
						<button
							type="button"
							onclick={() => {
								newDisplay = 'background';
								newType = 'DANGER';
							}}
							class="flex flex-col items-start rounded-xl border-2 p-2.5 text-left transition {newDisplay === 'background' ? 'border-rose-600 bg-rose-50/70 text-rose-950' : 'border-slate-200 text-slate-600 hover:border-slate-300'}"
						>
							<span class="text-xs font-black">🔔 중요 알람</span>
							<span class="text-[10px] font-bold opacity-75">배경색 (상/하단 2분할)</span>
						</button>
					</div>
				</div>

				<div class="space-y-3">
					<div>
						<label for="ev-title" class="block text-xs font-black text-slate-700 mb-1">
							제목
						</label>
						<input
							id="ev-title"
							type="text"
							bind:value={newTitle}
							placeholder={newDisplay === 'background' ? '예: 폭설 비상대기 발령' : '예: 노선개편 시범운행'}
							class="w-full rounded-xl border-2 border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
						/>
					</div>

					<!-- 시작일 ~ 종료일 (연속 설정) -->
					<div class="grid grid-cols-2 gap-2.5">
						<div>
							<label for="ev-start" class="block text-xs font-black text-slate-700 mb-1">
								시작일
							</label>
							<input
								id="ev-start"
								type="date"
								bind:value={newStartDate}
								class="w-full rounded-xl border-2 border-slate-300 px-2.5 py-2 text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
							/>
						</div>
						<div>
							<label for="ev-end" class="block text-xs font-black text-slate-700 mb-1">
								종료일 (연속 시)
							</label>
							<input
								id="ev-end"
								type="date"
								bind:value={newEndDate}
								min={newStartDate}
								class="w-full rounded-xl border-2 border-slate-300 px-2.5 py-2 text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
							/>
						</div>
					</div>

					<div class="grid grid-cols-2 gap-2.5">
						<div>
							<label for="ev-type" class="block text-xs font-black text-slate-700 mb-1">
								색상 테마
							</label>
							<select
								id="ev-type"
								bind:value={newType}
								class="w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
							>
								<option value="PRIMARY">파랑 (기본/업무)</option>
								<option value="DANGER">빨강 (긴급/경보)</option>
								<option value="WARNING">주황 (주의/휴무)</option>
								<option value="SUCCESS">초록 (개인/완료)</option>
								<option value="INFO">청록 (안내/배차)</option>
								<option value="HOLIDAY">적색 (공휴일 지정)</option>
							</select>
						</div>

						{#if newDisplay === 'background'}
							<div>
								<label for="ev-bg-pos" class="block text-xs font-black text-slate-700 mb-1">
									배경 분할 위치
								</label>
								<select
									id="ev-bg-pos"
									bind:value={newBgPosition}
									class="w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-rose-600"
								>
									<option value="auto">자동 (상/하단 배정)</option>
									<option value="top">상단 50% 고정</option>
									<option value="bottom">하단 50% 고정</option>
									<option value="full">전체 100% (단독 시)</option>
								</select>
							</div>
						{:else}
							<div>
								<label for="ev-line-slot" class="block text-xs font-black text-slate-700 mb-1">
									연속선 줄 위치
								</label>
								<select
									id="ev-line-slot"
									bind:value={newLineSlot}
									class="w-full rounded-xl border-2 border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
								>
									<option value="auto">자동 빈자리 배정</option>
									<option value={0}>1열 (상단 트랙 고정)</option>
									<option value={1}>2열 (하단 트랙 고정)</option>
								</select>
							</div>
						{/if}
					</div>

					{#if newDisplay === 'bar'}
						<div class="grid grid-cols-2 items-center gap-2 pt-1">
							<div>
								<label for="ev-time" class="block text-[11px] font-black text-slate-600 mb-0.5">
									시간
								</label>
								<input
									id="ev-time"
									type="time"
									bind:value={newTime}
									class="w-full rounded-xl border-2 border-slate-300 px-2.5 py-1.5 text-xs font-bold text-slate-900 outline-none focus:border-blue-600"
								/>
							</div>
							<label class="flex items-center gap-2 pt-4 cursor-pointer select-none">
								<input
									type="checkbox"
									bind:checked={newIsDday}
									class="checkbox checkbox-sm checkbox-primary"
								/>
								<span class="text-xs font-bold text-slate-700">D-Day 표시</span>
							</label>
						</div>
					{/if}
				</div>

				<button
					type="submit"
					class="w-full rounded-xl py-3 text-xs font-black text-white shadow-md transition active:scale-[0.99] {newDisplay === 'background' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-blue-600'}"
				>
					+ {newDisplay === 'background' ? '중요 배경 알람 등록' : '일반 일정 등록'}
				</button>
			</form>

			<!-- 현재 등록된 전체 이벤트 요약 및 삭제 리스트 -->
			<div class="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-sm">
				<h3 class="text-xs font-black text-slate-700 uppercase mb-2.5">
					등록된 예제 이벤트 ({events.length}건)
				</h3>
				<div class="max-h-60 space-y-1.5 overflow-y-auto pr-1">
					{#each events as ev (ev.id)}
						<div class="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs">
							<div class="min-w-0">
								<div class="flex items-center gap-1.5">
									<span class="rounded px-1.5 py-0.2 text-[9px] font-black {ev.display === 'background' ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-800'}">
										{ev.display === 'background' ? '배경알람' : '일반일정'}
									</span>
									<span class="truncate font-black text-slate-800">{ev.title}</span>
								</div>
								<div class="mt-0.5 font-mono text-[10px] font-bold text-slate-400">
									{ev.date}{ev.endDate && ev.endDate !== ev.date ? ` ~ ${ev.endDate}` : ''}
								</div>
							</div>
							<button
								type="button"
								onclick={() => handleDeleteEvent(ev.id)}
								class="btn btn-ghost btn-xs text-slate-400 hover:text-rose-600"
								title="삭제"
							>
								✕
							</button>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
