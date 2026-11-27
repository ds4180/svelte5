<script>
	/**
	 * @file v1/+page.svelte (직급·역할별 맞춤형 /v1 렌딩 페이지)
	 * @description 비회원(기본 안내) / 운전원(당일·명일 배차 브리핑 + 운행 링크) / 사무직 / 관리자별 맞춤 랜딩 뷰
	 */
	import { onMount, untrack } from 'svelte';
	import { formatDateTime } from '$lib/utils';
	import { fastApi } from '$lib/api';
	import { customGetMyDispatchBriefing } from '$lib/api/custom';
	import { miniappStore } from '$lib/runes/miniapps.svelte';
	import Chart from '$lib/components/Chart.svelte';
	import Icon from '@iconify/svelte';

	let { data } = $props();

	let now = $state(/** @type {Date | null} */ (null));
	let briefing = $state(/** @type {any} */ (null));
	let briefingLoaded = $state(false);
	let briefingLoading = $state(false);
	let briefingError = $state(false);

	$effect.pre(() => {
		if (data?.dispatchBriefing) {
			briefing = data.dispatchBriefing;
			briefingLoaded = true;
			briefingError = false;
		}
	});

	$effect.pre(() => {
		if (data?.initialMiniappSummary) {
			untrack(() => miniappStore.hydrateSummary(data.initialMiniappSummary));
		}
	});

	let dispatchWorkRates = $state(/** @type {any[] | null} */ (null));
	let dispatchWorkRatesLoading = $state(false);
	let dispatchWorkRatesError = $state(false);

	$effect.pre(() => {
		if (Array.isArray(data?.initialDispatchWorkRates)) {
			dispatchWorkRates = data.initialDispatchWorkRates;
			dispatchWorkRatesError = false;
		}
	});

	async function loadDispatchWorkRates() {
		if (dispatchWorkRatesLoading) return;
		dispatchWorkRatesLoading = true;
		dispatchWorkRatesError = false;
		try {
			const res = await fastApi('GET', '/api/v1/admin/dispatch/work-rates?days=10', {}, { offline: false });
			if (Array.isArray(res)) {
				dispatchWorkRates = res;
			} else {
				dispatchWorkRatesError = true;
			}
		} catch {
			dispatchWorkRatesError = true;
		} finally {
			dispatchWorkRatesLoading = false;
		}
	}

	$effect(() => {
		if (rankLevel >= 8 && dispatchWorkRates === null && !dispatchWorkRatesLoading && !dispatchWorkRatesError) {
			untrack(() => loadDispatchWorkRates());
		}
	});

	let user = $derived(data?.user ?? null);
	let rankLevel = $derived(Number(user?.rank_level ?? 0));

	/**
	 * 랭크 기반 4단계 랜딩 분기:
	 * - Lv.0, 1 (또는 비로그인): BASIC (기본 화면)
	 * - Lv.2: DRIVER (기사 화면 — 근무일 / 휴무일 브리핑)
	 * - Lv.3, 4, 5 (및 6, 7): OFFICE (사무실 화면)
	 * - Lv.8, 9: ADMIN (관리자 화면)
	 */
	let userRole = $derived.by(() => {
		if (!user || rankLevel <= 1) return 'BASIC';
		if (rankLevel === 2) return 'DRIVER';
		if (rankLevel >= 8) return 'ADMIN';
		return 'OFFICE';
	});

	const DAYOFF_TYPE_LABELS = /** @type {Record<string, string>} */ ({
		ANNUAL: '연차',
		SICK: '병가',
		SPECIAL: '경조사',
		OFFICIAL: '공가'
	});

	// 당일 운전원 다음(또는 현재 예정) 운행 1건 계산
	let nextTodayTrip = $derived.by(() => {
		const list = briefing?.today_dispatches || [];
		if (!list.length) return null;
		const nowHHMM = briefing?.now_hhmm || '';
		return list.find((/** @type {any} */ d) => (d.start_time || '') >= nowHHMM) || list[list.length - 1];
	});

	// 명일 근무 첫 회차 및 배차 예고 공개 상태 (admin/dispatch 설정 연동)
	let firstTomorrowTrip = $derived((briefing?.tomorrow_dispatches || [])[0] ?? null);
	let isTomorrowOpen = $derived(Boolean(briefing?.is_preview_open ?? briefing?.is_after_17));
	let previewOpenTime = $derived(briefing?.preview_open_time || '17:00');

	// 📌 사무실 화면(Lv.3~5) 전용: 최근 현장·직원 요청 3건 (미처리 우선 -> 최신순)
	let officeRecentRequests = $derived.by(() => {
		const list = [...(miniappStore.items || [])];
		list.sort((a, b) => {
			const aPending = a.status === 'PENDING' || a.status === 'ONGOING' ? 0 : 1;
			const bPending = b.status === 'PENDING' || b.status === 'ONGOING' ? 0 : 1;
			if (aPending !== bPending) return aPending - bPending;
			return String(b.created_at || '').localeCompare(String(a.created_at || ''));
		});
		return list.slice(0, 3);
	});

	const MINIAPP_CATEGORY_META = /** @type {Record<string, { label: string, badge: string }>} */ ({
		INSTRUCTION: { label: '요청·지시', badge: 'bg-rose-100 text-rose-700 border-rose-200' },
		NOTIFICATION: { label: '신고·알림', badge: 'bg-amber-100 text-amber-800 border-amber-200' },
		MESSAGE: { label: '메시지', badge: 'bg-blue-100 text-blue-700 border-blue-200' },
		ALARM: { label: '알람', badge: 'bg-purple-100 text-purple-700 border-purple-200' },
		MEMO: { label: '메모', badge: 'bg-slate-100 text-slate-700 border-slate-200' }
	});

	// 📌 관리자 칸반 보드용 요청 통계 (itemsLoaded 보장 후에만 처리율 산출 — 미로딩/실패 시 가짜 100% 차단)
	let kanbanData = $derived.by(() => {
		const ready = miniappStore.itemsLoaded;
		const raw = miniappStore.items || [];
		const pending = raw.filter((i) => i.status === 'PENDING');
		const ongoing = raw.filter((i) => i.status === 'ONGOING');
		const completed = raw.filter((i) => i.status === 'COMPLETED' || i.status === 'READ');
		const total = pending.length + ongoing.length + completed.length;
		const rate = !ready ? null : total > 0 ? Math.round((completed.length / total) * 100) : 100;
		return { ready, pending, ongoing, completed, total, rate };
	});

	// 📌 Lv.8~9 관리자 전용 Chart.js 반응형 데이터/옵션 ($lib/components/Chart.svelte 사용)
	let rateChartData = $derived.by(() => {
		const pCount = kanbanData.pending.length;
		const oCount = kanbanData.ongoing.length;
		const cCount = kanbanData.completed.length;
		const hasAny = kanbanData.ready && pCount + oCount + cCount > 0;
		return {
			labels: ['처리 완료', '처리 중', '접수 대기'],
			datasets: [
				{
					data: hasAny ? [cCount, oCount, pCount] : [1, 0, 0],
					backgroundColor: hasAny
						? ['#10b981', '#3b82f6', '#f43f5e']
						: ['#e2e8f0', '#e2e8f0', '#e2e8f0'],
					borderWidth: 0
				}
			]
		};
	});

	const rateChartOptions = {
		responsive: true,
		maintainAspectRatio: false,
		cutout: '70%',
		plugins: {
			legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11, weight: 'bold' } } }
		}
	};

	let dispatchWorkRateChartData = $derived.by(() => {
		const items = Array.isArray(dispatchWorkRates) ? dispatchWorkRates : [];
		return {
			labels: items.map((d) => d.label),
			datasets: [
				{
					label: '배차 작업률 (%)',
					data: items.map((d) => Number(d.rate ?? 0)),
					backgroundColor: items.map((d) => {
						const r = Number(d.rate ?? 0);
						if (r >= 90) return '#10b981';
						if (r >= 50) return '#2563eb';
						if (r > 0) return '#f59e0b';
						return '#cbd5e1';
					}),
					borderRadius: 6
				}
			]
		};
	});

	let dispatchWorkRateChartOptions = $derived.by(() => {
		const items = Array.isArray(dispatchWorkRates) ? dispatchWorkRates : [];
		return {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: { display: false },
				tooltip: {
					callbacks: {
						label: (/** @type {any} */ ctx) => {
							const item = items[ctx.dataIndex];
							if (!item) return `${ctx.parsed.y}%`;
							return ` ${item.rate}% (${item.assigned}/${item.total}대) · ${item.date}`;
						}
					}
				}
			},
			scales: {
				y: {
					beginAtZero: true,
					min: 0,
					max: 100,
					ticks: {
						stepSize: 25,
						font: { size: 10 },
						callback: (/** @type {any} */ v) => `${v}%`
					}
				},
				x: { ticks: { font: { size: 10, weight: 'bold' } }, grid: { display: false } }
			}
		};
	});

	let categoryChartData = $derived.by(() => ({
		labels: ['비디오 확인', '만차 신고', '습득물', '지시·메시지'],
		datasets: [
			{
				label: '미처리 건수',
				data: [
					2,
					3,
					1,
					miniappStore.counts.INSTRUCTION + miniappStore.counts.MESSAGE
				],
				backgroundColor: ['#f43f5e', '#f59e0b', '#3b82f6', '#8b5cf6'],
				borderRadius: 6
			}
		]
	}));

	const categoryChartOptions = {
		indexAxis: 'y',
		responsive: true,
		maintainAspectRatio: false,
		plugins: { legend: { display: false } },
		scales: {
			x: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } },
			y: { ticks: { font: { size: 11, weight: 'bold' } }, grid: { display: false } }
		}
	};

	async function loadDriverBriefing() {
		if (briefingLoading) return;
		briefingLoading = true;
		briefingError = false;
		for (let attempt = 0; attempt < 2; attempt++) {
			try {
				const res = await customGetMyDispatchBriefing();
				briefing = res;
				briefingLoaded = true;
				briefingError = false;
				briefingLoading = false;
				return;
			} catch {
				if (attempt === 0) {
					await new Promise((r) => setTimeout(r, 1200));
				}
			}
		}
		briefingError = true;
		briefingLoading = false;
	}

	onMount(async () => {
		now = new Date();
	});

	$effect(() => {
		if (user && userRole === 'DRIVER' && !briefingLoaded && !briefingLoading && !briefingError) {
			untrack(() => loadDriverBriefing());
		}
	});

	$effect(() => {
		if (user && (userRole === 'OFFICE' || userRole === 'ADMIN') && !miniappStore.itemsLoaded && !miniappStore.loading) {
			untrack(() => miniappStore.ensureSummaryLoaded(true));
		}
	});

	const driverLinks = [
		{
			href: '/v1/custom/dispatch',
			title: '전체 배차표',
			desc: '노선별 일일 배차 현황 조회',
			icon: 'solar:bus-bold-duotone',
			badge: '배차'
		},
		{
			href: '/v1/custom/dayoff',
			title: '휴무 · 결근계 신청',
			desc: '선착순 휴무 신청 및 내역 확인',
			icon: 'solar:calendar-mark-bold-duotone',
			badge: '휴무'
		},
		{
			href: '/v1/pages/sgv4',
			title: '202번 노선 시뮬레이션',
			desc: '시간대별 버스 운행 위치 보기',
			icon: 'solar:map-point-wave-bold-duotone',
			badge: '노선도'
		},
		{
			href: '/v1/pages/schedule',
			title: '업무 일정',
			desc: '공지 및 주요 운행 일정 확인',
			icon: 'solar:clock-circle-bold-duotone',
			badge: '일정'
		}
	];

	const officeLinks = [
		{
			href: '/v1/pages/schedule',
			title: '업무 일정 · 캘린더',
			desc: '사무실·전사 일정 및 결근계 확인',
			icon: 'solar:calendar-bold-duotone',
			badge: '일정'
		},
		{
			href: '/v1/custom/dayoff',
			title: '휴무 · 결근계 신청',
			desc: '휴무 신청 및 승인 현황 조회',
			icon: 'solar:calendar-mark-bold-duotone',
			badge: '휴무'
		},
		{
			href: '/v1/custom/dispatch',
			title: '전체 배차표',
			desc: '노선별 일일 배차 현황 조회',
			icon: 'solar:bus-bold-duotone',
			badge: '배차'
		},
		{
			href: '/v1/admin/dayoff',
			title: '근태 · 휴무 관리',
			desc: '사원 휴무 승인 및 결근 내역 조회',
			icon: 'solar:clipboard-check-bold-duotone',
			badge: '관리'
		}
	];

	const adminLinks = [
		{
			href: '/v1/admin',
			title: '관리자 관제 센터',
			desc: '전체 시스템 요약 및 승인 현황',
			icon: 'solar:shield-user-bold-duotone',
			badge: '관제'
		},
		{
			href: '/v1/admin/dispatch',
			title: '배차 편성 관리',
			desc: '노선별 기사·차량 배정 및 확정',
			icon: 'solar:bus-bold-duotone',
			badge: '배차'
		},
		{
			href: '/v1/admin/dayoff',
			title: '휴무 · 정원 관리',
			desc: '승인 처리 및 선착순 정원 설정',
			icon: 'solar:calendar-bold-duotone',
			badge: '휴무'
		},
		{
			href: '/v1/admin/observability',
			title: '접속기록 · 감사로그',
			desc: '실시간 세션 및 앱별 변경 이력',
			icon: 'solar:eye-bold-duotone',
			badge: '로그'
		}
	];

	// 📌 사무실 현장 요청 요약 카드 (목 데이터 — 추후 각 도메인 API 연동 예정)
	const mockFieldRequests = [
		{
			id: 'video',
			title: '비디오 확인 요청',
			count: 2,
			unit: '건 대기',
			badge: '블랙박스',
			badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
			cardClass: 'border-rose-200 hover:border-rose-400',
			icon: 'solar:videocamera-record-bold-duotone',
			iconClass: 'text-rose-600',
			href: '/v1/custom/blackbox',
			items: ['202번 1421호 · 접촉 의심 (09:15)', '201번 1108호 · 승객 민원 (어제)']
		},
		{
			id: 'fullbus',
			title: '만차 신고',
			count: 3,
			unit: '건 접수',
			badge: '운행현황',
			badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
			cardClass: 'border-amber-200 hover:border-amber-400',
			icon: 'solar:bus-bold-duotone',
			iconClass: 'text-amber-600',
			href: '/v1/custom/dispatch',
			items: ['202번 제주시청 정류장 (08:20)', '201번 한라병원 앞 (08:05)']
		},
		{
			id: 'lost',
			title: '습득물 신고',
			count: 1,
			unit: '건 보관',
			badge: '유실물',
			badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
			cardClass: 'border-blue-200 hover:border-blue-400',
			icon: 'solar:backpack-bold-duotone',
			iconClass: 'text-blue-600',
			href: '/v1/pages/schedule',
			items: ['1421호 검정 장지갑 (기사 인계 대기)']
		},
		{
			id: 'urgent',
			title: '차량 · 현장 요청',
			count: 1,
			unit: '건 확인',
			badge: '정비/지원',
			badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
			cardClass: 'border-emerald-200 hover:border-emerald-400',
			icon: 'solar:wrench-bold-duotone',
			iconClass: 'text-emerald-600',
			href: '/v1/pages/schedule',
			items: ['1305호 단말기 재부팅 요청']
		}
	];

	// 📌 사무실 출근·휴무 현황 (목 데이터 — 추후 Redis API 연동 예정)
	let showDayoffStaff = $state(false);
	const mockOfficeAttendance = {
		working_staff: [
			{ id: 1, name: '홍길동', group: '배차팀', rank: '팀장', phone: '010-1234-5678' },
			{ id: 2, name: '김미영', group: '총무팀', rank: '대리', phone: '010-2345-6789' },
			{ id: 3, name: '박철수', group: '정비팀', rank: '과장', phone: '010-3456-7890' },
			{ id: 4, name: '이지은', group: '운수관리팀', rank: '주임', phone: '010-4567-8901' }
		],
		dayoff_staff: [
			{ id: 5, name: '최민수', group: '총무팀', type: '연차', phone: '010-5678-9012' },
			{ id: 6, name: '정하나', group: '배차팀', type: '병가', phone: '010-6789-0123' }
		]
	};
</script>

<div class="mx-auto max-w-6xl space-y-6 pb-20 font-['Noto_Sans_KR','Outfit',sans-serif] text-slate-900 md:space-y-8 md:pb-8">
	{#if userRole === 'DRIVER'}
		<!-- 🚌 랭크 2: 기사 화면 (근무일 / 휴무일 브리핑) -->
		{@const isTodayDayoff = Boolean(briefing?.today_dayoff)}
		{@const isTodayWork = !isTodayDayoff && (briefing?.today_dispatches || []).length > 0}
		<div class="flex flex-col justify-between gap-4 border-b-4 border-slate-900 pb-6 md:flex-row md:items-end">
			<div>
				<div class="mb-2 flex flex-wrap items-center gap-2">
					<span class="inline-block rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-black text-emerald-800">
						기사 전용 브리핑 · Lv.{rankLevel}
					</span>
					{#if !briefingLoaded}
						<span class="inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-black {briefingError ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-600'}">
							{briefingError ? '⚠️ 배차 브리핑 조회 실패' : '⏳ 배차 정보 확인 중...'}
						</span>
					{:else if isTodayDayoff}
						<span class="inline-flex items-center gap-1 rounded-full bg-amber-500 px-3 py-0.5 text-xs font-black text-white">
							🏖️ 오늘 휴무일 ({DAYOFF_TYPE_LABELS[briefing.today_dayoff.type] || briefing.today_dayoff.type})
						</span>
					{:else if isTodayWork}
						<span class="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-black text-white">
							🚌 오늘 근무일 ({briefing.today_dispatches.length}회 운행)
						</span>
					{:else}
						<span class="inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-0.5 text-xs font-black text-slate-700">
							⏸️ 배차 대기 / 미배정
						</span>
					{/if}
				</div>
				<h1 class="text-3xl font-black text-slate-900 md:text-4xl">
					{user?.real_name || user?.username} 기사님, 안전 운행하세요
				</h1>
			</div>
			<div class="text-left md:text-right">
				<span class="block text-xs font-bold text-slate-400">오늘 날짜</span>
				<span class="font-mono text-xl font-black text-slate-900">
					{briefing?.today || (now ? formatDateTime(now).split(' ')[0] : '-')}
				</span>
			</div>
		</div>

		<!-- 당일 & 명일(17시 이후) 근무일/휴무일 브리핑 카드 2개 -->
		<div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
			<!-- 당일 근무 / 휴무 안내 -->
			<div
				class="rounded-3xl border-2 p-6 shadow-md {isTodayDayoff
					? 'border-amber-400 bg-amber-50/50'
					: 'border-slate-900 bg-white'}"
			>
				<div class="mb-4 flex items-center justify-between">
					<span
						class="badge font-bold {!briefingLoaded
							? 'badge-ghost'
							: isTodayDayoff
								? 'border-none bg-amber-500 text-white'
								: isTodayWork
									? 'badge-primary'
									: 'badge-ghost'}"
					>
						{!briefingLoaded
							? (briefingError ? '조회 실패' : '확인 중...')
							: isTodayDayoff
								? '오늘 · 휴무일'
								: isTodayWork
									? '오늘 · 근무일'
									: '오늘 · 배차 없음'}
					</span>
					<span class="font-mono text-xs font-bold text-slate-400">
						기준 {briefing?.now_hhmm || '--:--'}
					</span>
				</div>

				{#if !briefingLoaded}
					{#if briefingError}
						<p class="text-lg font-black text-rose-700">배차 정보를 불러오지 못했습니다.</p>
						<button
							type="button"
							onclick={loadDriverBriefing}
							class="mt-3 rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white hover:bg-rose-700"
						>
							다시 불러오기
						</button>
					{:else}
						<p class="text-lg font-black text-slate-400">오늘의 배차·휴무 정보를 확인하고 있습니다...</p>
					{/if}
				{:else if isTodayDayoff}
					<p class="text-2xl font-black tracking-tight text-amber-900 md:text-3xl">
						오늘은 승인된 <span class="text-amber-600">{DAYOFF_TYPE_LABELS[briefing.today_dayoff.type] || briefing.today_dayoff.type}</span> 휴무일입니다.
					</p>
					{#if briefing.today_dayoff.memo}
						<p class="mt-2 text-sm font-bold text-amber-800/80">
							사유: {briefing.today_dayoff.memo}
						</p>
					{/if}
					<p class="mt-1 text-xs font-medium text-amber-700/80">
						충분한 휴식을 취하시고, 내일 배차는 {briefing?.preview_open_time || '17:00'} 이후 아래 우측 카드에서 확인하세요.
					</p>
				{:else if nextTodayTrip}
					<p class="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
						{nextTodayTrip.start_location} · {nextTodayTrip.route_name}번
						<span class="text-blue-600">{nextTodayTrip.start_time} 출발</span>
					</p>
					<p class="mt-2 text-sm font-bold text-slate-600">
						배정 차량: <span class="font-mono text-slate-900">{nextTodayTrip.vehicle_no}호</span>
						· 도착지: {nextTodayTrip.end_location} ({nextTodayTrip.end_time || '-'})
					</p>
				{:else}
					<p class="text-xl font-black text-slate-700">오늘 배정된 운행 일정이 없습니다.</p>
					<p class="mt-1 text-xs font-medium text-slate-400">휴무이거나 배차 확정 대기 중입니다.</p>
				{/if}

				{#if !isTodayDayoff && (briefing?.today_dispatches || []).length > 0}
					<div class="mt-5 space-y-2 border-t border-slate-100 pt-4">
						<span class="block text-xs font-bold text-slate-400">오늘 전체 운행 ({briefing.today_dispatches.length}회)</span>
						<div class="space-y-1.5">
							{#each briefing.today_dispatches as item (item.id)}
								<div class="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold">
									<span>
										<span class="font-mono text-blue-600">{item.start_time}</span>
										· {item.start_location} → {item.end_location} ({item.route_name}번)
									</span>
									<span class="font-mono text-slate-600">{item.vehicle_no}호</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- 명일 근무 / 휴무 안내 (배차 예고 공개 시각 설정 연동) -->
			<div
				class="rounded-3xl border-2 p-6 shadow-md {isTomorrowOpen && (firstTomorrowTrip || briefing?.tomorrow_dayoff)
					? 'border-amber-500 bg-amber-50/60'
					: 'border-slate-200 bg-slate-50'}"
			>
				<div class="mb-4 flex items-center justify-between">
					<span
						class="badge font-bold {isTomorrowOpen
							? 'bg-amber-500 text-white border-none'
							: 'badge-ghost'}"
					>
						내일 근무 · 휴무 ({previewOpenTime} 이후)
					</span>
					<span class="font-mono text-xs font-bold text-slate-500">
						{briefing?.tomorrow || '내일'}
					</span>
				</div>

				{#if !isTomorrowOpen}
					{#if briefing?.is_preview_paused}
						<p class="text-lg font-black text-slate-700">배차 예고가 일시 중지되었습니다.</p>
						<p class="mt-1 text-xs font-medium text-slate-500">
							{briefing?.preview_reason || '관리자가 명일 배차를 준비 중입니다.'}
						</p>
					{:else}
						<p class="text-lg font-black text-slate-700">명일 배차는 {previewOpenTime} 이후 표시됩니다.</p>
						<p class="mt-1 text-xs font-medium text-slate-500">
							배차 확정 후 {previewOpenTime}부터 내일 근무일/휴무일 및 첫 출발 시각을 확인할 수 있습니다.
						</p>
					{/if}
				{:else if briefing?.tomorrow_dayoff}
					<p class="text-2xl font-black tracking-tight text-amber-900 md:text-3xl">
						내일은 <span class="text-amber-600">{DAYOFF_TYPE_LABELS[briefing.tomorrow_dayoff.type] || briefing.tomorrow_dayoff.type}</span> 휴무일입니다.
					</p>
					<p class="mt-2 text-xs font-bold text-amber-800/80">
						승인 확정된 휴무 일정이 등록되어 있습니다.
					</p>
				{:else if firstTomorrowTrip}
					<p class="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
						내일 근무일 · <span class="text-amber-700">{firstTomorrowTrip.vehicle_no}호</span>
						{firstTomorrowTrip.start_time}
					</p>
					<p class="mt-2 text-sm font-bold text-slate-700">
						{firstTomorrowTrip.start_location} · {firstTomorrowTrip.route_name}번 출발
						(총 {briefing.tomorrow_dispatches.length}회)
					</p>
				{:else}
					<p class="text-lg font-black text-slate-700">내일 배정된 근무가 없습니다.</p>
					<p class="mt-1 text-xs font-medium text-slate-500">휴무 또는 배차 대기 상태입니다.</p>
				{/if}
			</div>
		</div>

		<!-- 운행 관련 빠른 링크 -->
		<div class="space-y-3">
			<h2 class="text-sm font-black text-slate-500">운행 관련 빠른 이동</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{#each driverLinks as link (link.href)}
					<a
						href={link.href}
						class="group flex flex-col justify-between rounded-2xl border-2 border-slate-200 bg-white p-5 transition hover:border-slate-900 hover:shadow-md"
					>
						<div class="flex items-center justify-between">
							<Icon icon={link.icon} class="text-3xl text-blue-600" />
							<span class="badge badge-sm font-bold badge-outline">{link.badge}</span>
						</div>
						<div class="mt-5">
							<h3 class="text-base font-black text-slate-900 group-hover:text-blue-600">{link.title}</h3>
							<p class="mt-1 text-xs font-medium text-slate-500">{link.desc}</p>
						</div>
					</a>
				{/each}
			</div>
		</div>
	{:else if userRole === 'ADMIN'}
		<!-- 🛡️ 랭크 8, 9: 관리자 전용 관제 랜딩 뷰 (상단 3종 그래프 + 처리율 + 미니 칸반 보드) -->
		<div class="flex flex-col justify-between gap-3 border-b-4 border-slate-900 pb-4 md:flex-row md:items-end">
			<div>
				<span class="mb-1 inline-block rounded-full bg-slate-900 px-3 py-0.5 text-xs font-black text-emerald-400">
					최고 · 시스템 관제 모드 · Lv.{rankLevel}
				</span>
				<h1 class="text-3xl font-black text-slate-900 md:text-4xl">
					{user?.real_name || user?.username}님, 통합 관제 센터
				</h1>
			</div>
			<div class="flex items-center gap-3">
				{#if kanbanData.ready}
					<span class="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-700">
						요청 처리율 <span class="ml-1 text-base text-blue-600">{kanbanData.rate}%</span>
					</span>
				{:else if miniappStore.error}
					<button
						type="button"
						onclick={() => miniappStore.refresh()}
						class="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100"
					>
						집계 실패 · 다시 시도
					</button>
				{:else}
					<span class="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-black text-slate-400">
						요청 처리율 <span class="ml-1 text-base">--%</span>
					</span>
				{/if}
				<span class="font-mono text-lg font-black text-slate-700">
					{now ? formatDateTime(now).split(' ')[0] : '-'}
				</span>
			</div>
		</div>

		<!-- 📊 1. 상단 3대 관제 그래프 (처리율 도넛 · 주간 추이 · 유형별 현황) -->
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
			<!-- 그래프 1: 전체 요청 처리율 -->
			<div class="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-xs">
				<div class="mb-2 flex items-center justify-between">
					<h2 class="text-sm font-black text-slate-900">전체 요청 처리율</h2>
					{#if kanbanData.ready}
						<span class="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-black text-emerald-700">
							완료 {kanbanData.completed.length} / 총 {kanbanData.total}건
						</span>
					{:else if miniappStore.error}
						<button
							type="button"
							onclick={() => miniappStore.refresh()}
							class="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-black text-rose-700 hover:bg-rose-100"
						>
							재시도
						</button>
					{:else}
						<span class="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-black text-slate-400">
							집계 중...
						</span>
					{/if}
				</div>
				<div class="relative h-48">
					<Chart
						type="doughnut"
						data={rateChartData}
						options={rateChartOptions}
						containerClass="relative h-48 w-full"
						ariaLabel="전체 요청 처리율"
					/>
					<div class="pointer-events-none absolute inset-0 flex flex-col items-center justify-center pb-6">
						{#if kanbanData.ready}
							<span class="text-2xl font-black text-slate-900">{kanbanData.rate}%</span>
							<span class="text-[10px] font-bold text-slate-400">처리율</span>
						{:else if miniappStore.error}
							<span class="text-sm font-black text-rose-600">조회 실패</span>
							<span class="text-[10px] font-bold text-slate-400">데이터 미확정</span>
						{:else}
							<span class="text-xl font-black text-slate-400">--%</span>
							<span class="text-[10px] font-bold text-slate-400">로딩 중</span>
						{/if}
					</div>
				</div>
			</div>

			<!-- 그래프 2: 향후 10일(D+1 ~ D+10) 배차 작업률 -->
			<div class="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-xs">
				<div class="mb-2 flex items-center justify-between">
					<h2 class="text-sm font-black text-slate-900">배차 작업률</h2>
					<span class="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-black text-blue-700">
						D+1 ~ D+10{dispatchWorkRates?.[0]?.is_mock ? ' (예시)' : ''}
					</span>
				</div>
				<div class="h-48">
					{#if Array.isArray(dispatchWorkRates) && dispatchWorkRates.length > 0}
						<Chart
							type="bar"
							data={dispatchWorkRateChartData}
							options={dispatchWorkRateChartOptions}
							containerClass="relative h-48 w-full"
							ariaLabel="D+1부터 D+10일까지 배차 작업률"
						/>
					{:else if dispatchWorkRatesError}
						<div class="flex h-full flex-col items-center justify-center gap-2 text-center">
							<span class="text-xs font-bold text-rose-600">배차 작업률을 불러오지 못했습니다.</span>
							<button
								type="button"
								onclick={loadDispatchWorkRates}
								class="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-200"
							>
								다시 시도
							</button>
						</div>
					{:else}
						<div class="flex h-full items-center justify-center text-xs font-bold text-slate-400">
							배차 작업률 집계 중...
						</div>
					{/if}
				</div>
			</div>

			<!-- 그래프 3: 요청 유형별 미처리 분포 -->
			<div class="rounded-2xl border-2 border-slate-200 bg-white p-4 shadow-xs">
				<div class="mb-2 flex items-center justify-between">
					<h2 class="text-sm font-black text-slate-900">현장 요청 · 지시 분포</h2>
					<span class="rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-black text-rose-700">
						대기 {miniappStore.counts.TOTAL}건
					</span>
				</div>
				<div class="h-48">
					<Chart
						type="bar"
						data={categoryChartData}
						options={categoryChartOptions}
						containerClass="relative h-48 w-full"
						ariaLabel="현장 요청 지시 분포"
					/>
				</div>
			</div>
		</div>

		<!-- 📋 2. 요청 처리 미니 칸반 보드 (접수 대기 | 처리 중 | 처리 완료) -->
		<div class="space-y-2.5">
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-2">
					<h2 class="text-base font-black text-slate-900">요청 · 지시 처리 칸반 보드</h2>
					<span class="text-xs font-bold text-slate-400">원클릭 상태 전환</span>
				</div>
				<button
					type="button"
					onclick={() => miniappStore.refresh()}
					disabled={miniappStore.loading}
					class="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
				>
					<Icon icon="solar:restart-bold" class="text-sm {miniappStore.loading ? 'animate-spin' : ''}" />
					<span>새로고침</span>
				</button>
			</div>

			<div class="grid grid-cols-1 gap-3 lg:grid-cols-3">
				<!-- 컬럼 1: 접수 대기 -->
				<div class="rounded-2xl border-2 border-rose-200 bg-rose-50/40 p-3.5">
					<div class="mb-2.5 flex items-center justify-between">
						<span class="text-xs font-black text-rose-700">🔴 접수 대기</span>
						<span class="rounded-full bg-rose-600 px-2 py-0.5 text-[11px] font-black text-white">
							{kanbanData.pending.length}
						</span>
					</div>
					<div class="space-y-2">
						{#each kanbanData.pending.slice(0, 4) as item (item.id)}
							<div class="rounded-xl border border-rose-200 bg-white p-3 shadow-2xs">
								<div class="text-sm font-black text-slate-900 truncate">{item.title || item.content}</div>
								<div class="mt-1 flex items-center justify-between text-[11px] font-bold text-slate-400">
									<span>{item.sender_name || '시스템'}</span>
									<div class="flex gap-1">
										<button
											type="button"
											onclick={() => miniappStore.updateItem(item.id, { status: 'ONGOING' })}
											class="rounded-lg bg-blue-50 px-2 py-0.5 text-blue-700 hover:bg-blue-600 hover:text-white"
										>
											진행
										</button>
										<button
											type="button"
											onclick={() => miniappStore.updateItem(item.id, { is_done: true })}
											class="rounded-lg bg-emerald-50 px-2 py-0.5 text-emerald-700 hover:bg-emerald-600 hover:text-white"
										>
											완료
										</button>
									</div>
								</div>
							</div>
						{:else}
							<div class="rounded-xl border border-dashed border-rose-200 bg-white/60 py-6 text-center text-xs font-bold text-slate-400">
								대기 중인 요청 없음
							</div>
						{/each}
					</div>
				</div>

				<!-- 컬럼 2: 처리 중 -->
				<div class="rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-3.5">
					<div class="mb-2.5 flex items-center justify-between">
						<span class="text-xs font-black text-blue-700">🔵 처리 중</span>
						<span class="rounded-full bg-blue-600 px-2 py-0.5 text-[11px] font-black text-white">
							{kanbanData.ongoing.length}
						</span>
					</div>
					<div class="space-y-2">
						{#each kanbanData.ongoing.slice(0, 4) as item (item.id)}
							<div class="rounded-xl border border-blue-200 bg-white p-3 shadow-2xs">
								<div class="text-sm font-black text-slate-900 truncate">{item.title || item.content}</div>
								<div class="mt-1 flex items-center justify-between text-[11px] font-bold text-slate-400">
									<span>{item.sender_name || '시스템'}</span>
									<button
										type="button"
										onclick={() => miniappStore.updateItem(item.id, { is_done: true })}
										class="rounded-lg bg-emerald-50 px-2 py-0.5 text-emerald-700 hover:bg-emerald-600 hover:text-white"
									>
										완료 처리
									</button>
								</div>
							</div>
						{:else}
							<div class="rounded-xl border border-dashed border-blue-200 bg-white/60 py-6 text-center text-xs font-bold text-slate-400">
								진행 중인 요청 없음
							</div>
						{/each}
					</div>
				</div>

				<!-- 컬럼 3: 처리 완료 -->
				<div class="rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 p-3.5">
					<div class="mb-2.5 flex items-center justify-between">
						<span class="text-xs font-black text-emerald-700">🟢 처리 완료</span>
						<span class="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-black text-white">
							{kanbanData.completed.length}
						</span>
					</div>
					<div class="space-y-2">
						{#each kanbanData.completed.slice(0, 4) as item (item.id)}
							<div class="rounded-xl border border-emerald-200 bg-white p-3 shadow-2xs opacity-85">
								<div class="text-sm font-bold text-slate-700 truncate line-through decoration-emerald-400">
									{item.title || item.content}
								</div>
								<div class="mt-1 flex items-center justify-between text-[11px] font-bold text-slate-400">
									<span>{item.sender_name || '시스템'}</span>
									<button
										type="button"
										onclick={() => miniappStore.updateItem(item.id, { is_done: false })}
										class="rounded-lg bg-slate-100 px-2 py-0.5 text-slate-600 hover:bg-slate-200"
									>
										되돌리기
									</button>
								</div>
							</div>
						{:else}
							<div class="rounded-xl border border-dashed border-emerald-200 bg-white/60 py-6 text-center text-xs font-bold text-slate-400">
								완료된 내역 없음
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- 3. 관리자 메뉴 바로가기 -->
		<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{#each adminLinks as link (link.href)}
				<a
					href={link.href}
					class="group flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-4 transition hover:bg-slate-900 hover:text-white"
				>
					<div class="flex items-center justify-between">
						<Icon icon={link.icon} class="text-2xl text-indigo-600 group-hover:text-emerald-400" />
						<span class="badge badge-sm font-bold">{link.badge}</span>
					</div>
					<div class="mt-3">
						<h3 class="text-base font-black">{link.title}</h3>
						<p class="mt-0.5 text-xs opacity-70">{link.desc}</p>
					</div>
				</a>
			{/each}
		</div>

		<div class="space-y-3">
			<h2 class="text-sm font-black text-slate-500">현장 서비스 바로가기</h2>
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{#each driverLinks as link (link.href)}
					<a
						href={link.href}
						class="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-900"
					>
						<Icon icon={link.icon} class="text-2xl text-blue-600" />
						<div>
							<div class="text-sm font-black text-slate-900">{link.title}</div>
							<div class="text-xs text-slate-500">{link.desc}</div>
						</div>
					</a>
				{/each}
			</div>
		</div>
	{:else if userRole === 'OFFICE'}
		<!-- 🏢 랭크 3, 4, 5: 사무실 화면 (실시간 요청/신고 위젯 + 사무실 업무 바로가기) -->
		<div class="flex flex-col justify-between gap-4 border-b-4 border-slate-900 pb-6 md:flex-row md:items-end">
			<div>
				<span class="mb-1.5 inline-block rounded-full bg-blue-100 px-3 py-0.5 text-xs font-black text-blue-800">
					사무실 · 운영 관제 · {user?.primary_group || '사무실'} (Lv.{rankLevel})
				</span>
				<h1 class="text-3xl font-black text-slate-900 md:text-4xl">
					{user?.real_name || user?.username}님, 안녕하세요
				</h1>
				<p class="mt-2 text-sm font-medium text-slate-500">
					운전원·직원 요청사항(비디오 확인, 만차 신고 등)과 사무실 주요 업무를 한눈에 파악합니다.
				</p>
			</div>
			<span class="font-mono text-lg font-black text-slate-700">
				{now ? formatDateTime(now).split(' ')[0] : '-'}
			</span>
		</div>

		<!-- 📌 상단: 현장 주요 요청 요약 카드 ('비디오 요청', '만차 신고', '습득물 신고', '차량·현장 요청' — 임시 목 데이터) -->
		<div class="space-y-2">
			<div class="flex items-center justify-between">
				<span class="text-sm font-black text-slate-700">현장 주요 요청 현황</span>
				<span class="text-xs font-bold text-slate-400">임시 목 데이터</span>
			</div>
			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{#each mockFieldRequests as reqCard (reqCard.id)}
					<a
						href={reqCard.href}
						class="group flex flex-col justify-between rounded-2xl border-2 bg-white p-3.5 shadow-xs transition hover:-translate-y-0.5 hover:shadow-md {reqCard.cardClass}"
					>
						<div>
							<div class="flex items-center justify-between gap-2">
								<span class="inline-flex items-center gap-1.5 text-sm font-black text-slate-900">
									<Icon icon={reqCard.icon} class="text-xl {reqCard.iconClass}" />
									<span>{reqCard.title}</span>
								</span>
								<span class="rounded-full border px-2.5 py-0.5 text-xs font-black {reqCard.badgeClass}">
									{reqCard.count}{reqCard.unit}
								</span>
							</div>
							<ul class="mt-2 space-y-1">
								{#each reqCard.items as line}
									<li class="truncate text-xs font-bold text-slate-600">
										· {line}
									</li>
								{/each}
							</ul>
						</div>
						<div class="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-xs font-black text-slate-400 group-hover:text-blue-600">
							<span>{reqCard.badge}</span>
							<span>확인하기 →</span>
						</div>
					</a>
				{/each}
			</div>
		</div>

		<!-- 📌 기사 화면의 배차 브리핑 자리에 배치되는 사무실 실시간 요청·신고 위젯 (리벳 + 최근 3건) -->
		<div class="grid grid-cols-1 gap-4 lg:grid-cols-12">
			<!-- 좌측(8칸): 실시간 요청·신고 리스트 최근 3건 -->
			<div class="rounded-3xl border-2 border-slate-900 bg-white p-4 shadow-md sm:p-5 lg:col-span-8">
				<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
					<div class="flex items-center gap-2">
						<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-xs font-black text-white">
							<span class="h-2 w-2 animate-ping rounded-full bg-rose-400"></span>
							실시간 현장 · 직원 요청
						</span>
						<span class="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-black text-rose-700">
							미처리 {miniappStore.counts.TOTAL}건
						</span>
					</div>
					<button
						type="button"
						onclick={() => miniappStore.refresh()}
						disabled={miniappStore.loading}
						class="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
					>
						<Icon icon="solar:restart-bold" class="text-sm {miniappStore.loading ? 'animate-spin' : ''}" />
						<span>새로고침</span>
					</button>
				</div>

				{#if miniappStore.loading && officeRecentRequests.length === 0}
					<div class="flex h-32 items-center justify-center">
						<span class="loading loading-md loading-spinner text-blue-600"></span>
					</div>
				{:else if officeRecentRequests.length === 0}
					<div class="flex h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
						<Icon icon="solar:check-circle-bold-duotone" class="mb-1 text-3xl text-emerald-500" />
						<p class="text-sm font-black text-slate-700">현재 대기 중인 요청·신고가 없습니다.</p>
						<p class="mt-0.5 text-xs font-medium text-slate-400">운전원이나 직원의 새 요청이 들어오면 여기에 실시간 표시됩니다.</p>
					</div>
				{:else}
					<div class="space-y-2">
						{#each officeRecentRequests as req (req.id)}
							{@const catMeta = MINIAPP_CATEGORY_META[req.category] || { label: req.category, badge: 'bg-slate-100 text-slate-700 border-slate-200' }}
							{@const isPending = req.status === 'PENDING' || req.status === 'ONGOING'}
							<div class="flex items-center justify-between gap-3 rounded-2xl border p-3 transition {isPending ? 'border-rose-200 bg-rose-50/40' : 'border-slate-100 bg-slate-50'}">
								<div class="min-w-0 flex-1">
									<div class="flex flex-wrap items-center gap-2">
										<span class="rounded-md border px-2 py-0.5 text-xs font-black {catMeta.badge}">
											{catMeta.label}
										</span>
										<span class="truncate text-base font-black text-slate-900">
											{req.title || req.content || '요청 사항'}
										</span>
									</div>
									<div class="mt-0.5 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
										<span>요청자: {req.sender_name || '시스템'}</span>
										{#if req.content && req.title && req.content !== req.title}
											<span class="truncate text-slate-400">· {req.content}</span>
										{/if}
									</div>
								</div>

								<div class="flex shrink-0 items-center gap-1.5">
									{#if req.link}
										<a
											href={req.link}
											class="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-black text-white transition hover:bg-blue-600"
										>
											바로 확인
										</a>
									{/if}
									<button
										type="button"
										onclick={() => miniappStore.updateItem(req.id, { is_done: isPending })}
										class="rounded-xl border px-2.5 py-1.5 text-xs font-black transition {isPending
											? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white'
											: 'border-slate-200 bg-white text-slate-500'}"
									>
										{isPending ? '처리 완료' : '완료됨'}
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- 우측(4칸): 유형별 요청 리벳 현황판 -->
			<div class="flex flex-col justify-between rounded-3xl border-2 border-slate-200 bg-slate-50 p-4 shadow-sm sm:p-5 lg:col-span-4">
				<div>
					<div class="mb-3 flex items-center justify-between">
						<h2 class="text-sm font-black text-slate-900">요청 유형별 대기 현황</h2>
						<span class="text-xs font-bold text-slate-400">실시간 동기화</span>
					</div>
					<div class="grid grid-cols-2 gap-2">
						<div class="rounded-2xl border border-rose-200 bg-white p-3">
							<span class="block text-xs font-black text-rose-600">요청 · 지시</span>
							<span class="mt-0.5 block text-2xl font-black text-slate-900">
								{miniappStore.counts.INSTRUCTION}<span class="ml-0.5 text-xs font-bold text-slate-400">건</span>
							</span>
						</div>
						<div class="rounded-2xl border border-amber-200 bg-white p-3">
							<span class="block text-xs font-black text-amber-600">신고 · 알림</span>
							<span class="mt-0.5 block text-2xl font-black text-slate-900">
								{miniappStore.counts.NOTIFICATION}<span class="ml-0.5 text-xs font-bold text-slate-400">건</span>
							</span>
						</div>
						<div class="rounded-2xl border border-blue-200 bg-white p-3">
							<span class="block text-xs font-black text-blue-600">업무 메시지</span>
							<span class="mt-0.5 block text-2xl font-black text-slate-900">
								{miniappStore.counts.MESSAGE}<span class="ml-0.5 text-xs font-bold text-slate-400">건</span>
							</span>
						</div>
						<div class="rounded-2xl border border-purple-200 bg-white p-3">
							<span class="block text-xs font-black text-purple-600">알람 · 메모</span>
							<span class="mt-0.5 block text-2xl font-black text-slate-900">
								{miniappStore.counts.ALARM + miniappStore.counts.MEMO}<span class="ml-0.5 text-xs font-bold text-slate-400">건</span>
							</span>
						</div>
					</div>
				</div>
				<p class="mt-3 text-xs font-bold text-slate-400">
					※ 우측 상단 요술봉 버튼에서 전체 요청 목록 확인 가능
				</p>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each officeLinks as link (link.href)}
				<a
					href={link.href}
					class="group flex flex-col justify-between rounded-2xl border-2 border-slate-200 bg-white p-6 transition hover:border-slate-900 hover:shadow-md"
				>
					<div class="flex items-center justify-between">
						<Icon icon={link.icon} class="text-3xl text-blue-600" />
						<span class="badge badge-sm font-bold badge-outline">{link.badge}</span>
					</div>
					<div class="mt-6">
						<h3 class="text-lg font-black text-slate-900 group-hover:text-blue-600">{link.title}</h3>
						<p class="mt-1 text-xs text-slate-500">{link.desc}</p>
					</div>
				</a>
			{/each}
		</div>
	{:else}
		<!-- 🌐 랭크 0, 1 (또는 비로그인): 기본 화면 -->
		<div class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-10 md:flex-row md:items-end">
			<div class="space-y-3">
				<span class="inline-block rounded-full bg-slate-100 px-3 py-0.5 text-xs font-black text-slate-600">
					{user ? `기본 화면 · Lv.${rankLevel}` : '제주 라이브 통합 관제'}
				</span>
				<h1 class="text-5xl leading-none font-black tracking-tight text-slate-900 md:text-6xl">
					Jeju.Live <span class="text-blue-600">v5</span>
				</h1>
				<p class="max-w-lg text-sm leading-relaxed font-medium text-slate-600">
					{#if user}
						{user.real_name || user.username}님 환영합니다. 사내 공개 일정과 노선 현황을 확인하실 수 있습니다.
					{:else}
						제주 라이브 통합 운행·근태 관리 시스템입니다. 로그인하시면 권한에 맞는 개인화 화면을 바로 이용하실 수 있습니다.
					{/if}
				</p>
			</div>
			<div class="flex flex-col items-start gap-3 md:items-end">
				<div class="flex items-center gap-2">
					<span class="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500"></span>
					<span class="font-mono text-xl font-black text-slate-900">
						{now ? formatDateTime(now).split(' ')[0] : '준비 완료'}
					</span>
				</div>
				{#if !user}
					<a href="/login" class="btn rounded-xl px-6 text-sm font-black btn-primary">
						로그인하기
					</a>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<a
				href="/v1/pages/schedule"
				class="group rounded-2xl border-2 border-slate-900 bg-white p-7 transition hover:bg-slate-900 hover:text-white"
			>
				<div class="flex items-center justify-between">
					<span class="text-3xl">🗓️</span>
					<span class="badge badge-sm font-bold">일정</span>
				</div>
				<h3 class="mt-6 text-xl font-black">업무 일정</h3>
				<p class="mt-1 text-xs opacity-60">공개 업무 일정 및 주요 안내</p>
			</a>

			<a
				href="/v1/pages/sgv4"
				class="group rounded-2xl border-2 border-slate-900 bg-white p-7 transition hover:bg-slate-900 hover:text-white"
			>
				<div class="flex items-center justify-between">
					<span class="text-3xl">🚍</span>
					<span class="badge badge-sm font-bold">노선도</span>
				</div>
				<h3 class="mt-6 text-xl font-black">202번 노선 시뮬레이션</h3>
				<p class="mt-1 text-xs opacity-60">버스 노선 실시간 운행 현황 보기</p>
			</a>

			<a
				href="/v1/pages/chart"
				class="group rounded-2xl border-2 border-slate-900 bg-white p-7 transition hover:bg-slate-900 hover:text-white"
			>
				<div class="flex items-center justify-between">
					<span class="text-3xl">📊</span>
					<span class="badge badge-sm font-bold">통계</span>
				</div>
				<h3 class="mt-6 text-xl font-black">데이터 시각화</h3>
				<p class="mt-1 text-xs opacity-60">운행·매출 통계 차트 데모</p>
			</a>
		</div>
	{/if}

	<!-- 🏢 레벨 2 이상(기사·사무실·관리자) 공통: 사무실 출근 직원 · 연락처 & 휴무자 폴딩 -->
	{#if user && rankLevel >= 2}
		<section class="space-y-4 border-t border-slate-200 pt-6">
			<div class="flex flex-wrap items-center justify-between gap-2">
				<div class="flex items-center gap-2">
					<h2 class="text-base font-black text-slate-900">사무실 출근 직원</h2>
					<span class="badge badge-sm font-bold badge-success text-white">
						{mockOfficeAttendance.working_staff.length}명 출근
					</span>
				</div>
				<span class="text-xs font-medium text-slate-400">임시 목 데이터</span>
			</div>

			<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{#each mockOfficeAttendance.working_staff as staff (staff.id)}
					<div class="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-2xs">
						<div>
							<div class="flex items-center gap-1.5">
								<span class="text-sm font-black text-slate-900">{staff.name}</span>
								<span class="text-xs font-bold text-slate-400">{staff.rank}</span>
							</div>
							<span class="text-xs font-medium text-slate-500">{staff.group}</span>
						</div>
						{#if staff.phone}
							<a
								href={`tel:${staff.phone}`}
								class="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-2.5 py-1.5 font-mono text-xs font-bold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
							>
								<Icon icon="solar:phone-bold" class="text-sm" />
								<span>{staff.phone}</span>
							</a>
						{/if}
					</div>
				{/each}
			</div>

			<!-- 휴무자 폴딩 영역 -->
			<div class="rounded-2xl border border-slate-200 bg-slate-50">
				<button
					type="button"
					onclick={() => (showDayoffStaff = !showDayoffStaff)}
					class="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-black text-slate-700"
				>
					<span class="flex items-center gap-2">
						<span>오늘 사무실 휴무자</span>
						<span class="badge badge-sm badge-ghost font-bold">
							{mockOfficeAttendance.dayoff_staff.length}명
						</span>
					</span>
					<Icon
						icon="solar:alt-arrow-down-bold"
						class="text-base text-slate-400 transition-transform {showDayoffStaff ? 'rotate-180' : ''}"
					/>
				</button>

				{#if showDayoffStaff}
					<div class="grid grid-cols-1 gap-2 border-t border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-4">
						{#each mockOfficeAttendance.dayoff_staff as staff (staff.id)}
							<div class="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 text-xs">
								<div>
									<span class="font-black text-slate-800">{staff.name}</span>
									<span class="ml-1 text-slate-400">({staff.group})</span>
									<span class="ml-1.5 badge badge-xs badge-warning font-bold">{staff.type}</span>
								</div>
								{#if staff.phone}
									<a
										href={`tel:${staff.phone}`}
										class="font-mono font-bold text-slate-500 hover:text-blue-600"
									>
										{staff.phone}
									</a>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</section>
	{/if}
</div>
