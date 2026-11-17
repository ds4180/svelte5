<script>
	/**
	 * @file v1/+page.svelte (직급·역할별 맞춤형 /v1 렌딩 페이지)
	 * @description 비회원(기본 안내) / 운전원(당일·명일 배차 브리핑 + 운행 링크) / 사무직 / 관리자별 맞춤 랜딩 뷰
	 */
	import { onMount } from 'svelte';
	import { formatDateTime } from '$lib/utils';
	import { customGetMyDispatchBriefing } from '$lib/api/custom';
	import Icon from '@iconify/svelte';

	let { data } = $props();

	let now = $state(/** @type {Date | null} */ (null));
	let briefing = $state(/** @type {any} */ (null));

	$effect(() => {
		if (data?.dispatchBriefing) {
			briefing = data.dispatchBriefing;
		}
	});

	let user = $derived(data?.user ?? null);
	let rankLevel = $derived(Number(user?.rank_level ?? 0));
	let userRole = $derived.by(() => {
		if (!user) return 'GUEST';
		if (rankLevel >= 4) return 'ADMIN';
		const groups = [user.primary_group, ...(Array.isArray(user.all_groups) ? user.all_groups : [])]
			.filter(Boolean)
			.join(' ');
		if (rankLevel === 1 || /운전|운수|승무/.test(groups)) return 'DRIVER';
		return 'STAFF';
	});

	// 당일 운전원 다음(또는 현재 예정) 운행 1건 계산
	let nextTodayTrip = $derived.by(() => {
		const list = briefing?.today_dispatches || [];
		if (!list.length) return null;
		const nowHHMM = briefing?.now_hhmm || '';
		return list.find((/** @type {any} */ d) => (d.start_time || '') >= nowHHMM) || list[list.length - 1];
	});

	// 명일 근무 첫 회차 (17시 이후 표시용)
	let firstTomorrowTrip = $derived((briefing?.tomorrow_dispatches || [])[0] ?? null);

	onMount(async () => {
		now = new Date();
		if (userRole === 'DRIVER' && !briefing) {
			try {
				briefing = await customGetMyDispatchBriefing();
			} catch {
				// 무시
			}
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
		<!-- 🚌 운전원 전용 랜딩 뷰 -->
		<div class="flex flex-col justify-between gap-4 border-b-4 border-slate-900 pb-6 md:flex-row md:items-end">
			<div>
				<span class="mb-1.5 inline-block rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-black text-emerald-800">
					운전원 근무 브리핑 · Lv.{rankLevel}
				</span>
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

		<!-- 당일 & 명일(17시 이후) 핵심 브리핑 카드 2개 -->
		<div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
			<!-- 당일 운행 안내 -->
			<div class="rounded-3xl border-2 border-slate-900 bg-white p-6 shadow-md">
				<div class="mb-4 flex items-center justify-between">
					<span class="badge badge-primary font-bold">당일 운행</span>
					<span class="font-mono text-xs font-bold text-slate-400">
						기준 {briefing?.now_hhmm || '--:--'}
					</span>
				</div>

				{#if nextTodayTrip}
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

				{#if (briefing?.today_dispatches || []).length > 0}
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

			<!-- 명일 근무 안내 (17시 이후 활성화) -->
			<div
				class="rounded-3xl border-2 p-6 shadow-md {briefing?.is_after_17 && firstTomorrowTrip
					? 'border-amber-500 bg-amber-50/60'
					: 'border-slate-200 bg-slate-50'}"
			>
				<div class="mb-4 flex items-center justify-between">
					<span
						class="badge font-bold {briefing?.is_after_17
							? 'bg-amber-500 text-white border-none'
							: 'badge-ghost'}"
					>
						명일 근무 (17시 이후)
					</span>
					<span class="font-mono text-xs font-bold text-slate-500">
						{briefing?.tomorrow || '내일'}
					</span>
				</div>

				{#if !briefing?.is_after_17}
					<p class="text-lg font-black text-slate-700">명일 배차는 17:00 이후 표시됩니다.</p>
					<p class="mt-1 text-xs font-medium text-slate-500">
						배차 확정 후 오후 5시부터 내일 차량번호와 첫 출발 시각을 확인할 수 있습니다.
					</p>
				{:else if firstTomorrowTrip}
					<p class="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
						명일 근무 <span class="text-amber-700">{firstTomorrowTrip.vehicle_no}호</span>
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
		<!-- 🛡️ 관리자 전용 랜딩 뷰 -->
		<div class="flex flex-col justify-between gap-4 border-b-4 border-slate-900 pb-6 md:flex-row md:items-end">
			<div>
				<span class="mb-1.5 inline-block rounded-full bg-slate-900 px-3 py-0.5 text-xs font-black text-white">
					관리자 모드 · Lv.{rankLevel}
				</span>
				<h1 class="text-3xl font-black text-slate-900 md:text-4xl">
					{user?.real_name || user?.username}님, 시스템 관제 센터
				</h1>
				<p class="mt-2 text-sm font-medium text-slate-500">
					배차, 휴무 승인, 접속 감사로그 등 주요 관리 기능으로 바로 이동할 수 있습니다.
				</p>
			</div>
			<span class="font-mono text-lg font-black text-slate-700">
				{now ? formatDateTime(now).split(' ')[0] : '-'}
			</span>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each adminLinks as link (link.href)}
				<a
					href={link.href}
					class="group flex flex-col justify-between rounded-2xl border-2 border-slate-900 bg-white p-6 transition hover:bg-slate-900 hover:text-white"
				>
					<div class="flex items-center justify-between">
						<Icon icon={link.icon} class="text-3xl text-indigo-600 group-hover:text-emerald-400" />
						<span class="badge badge-sm font-bold">{link.badge}</span>
					</div>
					<div class="mt-6">
						<h3 class="text-lg font-black">{link.title}</h3>
						<p class="mt-1 text-xs opacity-70">{link.desc}</p>
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
	{:else if userRole === 'STAFF'}
		<!-- 🏢 일반 직원(사무직) 랜딩 뷰 -->
		<div class="flex flex-col justify-between gap-4 border-b-4 border-slate-900 pb-6 md:flex-row md:items-end">
			<div>
				<span class="mb-1.5 inline-block rounded-full bg-blue-100 px-3 py-0.5 text-xs font-black text-blue-800">
					{user?.primary_group || '임직원'} · Lv.{rankLevel}
				</span>
				<h1 class="text-3xl font-black text-slate-900 md:text-4xl">
					{user?.real_name || user?.username}님, 안녕하세요
				</h1>
				<p class="mt-2 text-sm font-medium text-slate-500">
					자주 사용하는 근태·일정·배차 조회 메뉴를 한곳에서 이용하실 수 있습니다.
				</p>
			</div>
			<span class="font-mono text-lg font-black text-slate-700">
				{now ? formatDateTime(now).split(' ')[0] : '-'}
			</span>
		</div>

		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each driverLinks as link (link.href)}
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
		<!-- 🌐 비회원(Guest) 기본 랜딩 뷰 -->
		<div class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-10 md:flex-row md:items-end">
			<div class="space-y-3">
				<span class="block text-xs font-black tracking-widest text-slate-400 uppercase">
					Infrastructure Core Engine
				</span>
				<h1 class="text-5xl leading-none font-black tracking-tight text-slate-900 md:text-6xl">
					Jeju.Live <span class="text-blue-600">v5</span>
				</h1>
				<p class="max-w-lg text-sm leading-relaxed font-medium text-slate-600">
					제주 라이브 통합 운행·근태 관리 시스템입니다. 로그인하시면 직급과 업무에 맞는 개인화 현황을 바로 확인하실 수 있습니다.
				</p>
			</div>
			<div class="flex flex-col items-start gap-3 md:items-end">
				<div class="flex items-center gap-2">
					<span class="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500"></span>
					<span class="font-mono text-xl font-black text-slate-900">
						{now ? formatDateTime(now).split(' ')[0] : 'READY'}
					</span>
				</div>
				<a href="/login" class="btn rounded-xl px-6 text-sm font-black btn-primary">
					로그인하기
				</a>
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

	<!-- 🏢 로그인 사용자 공통: 사무실 출근 직원 · 연락처 & 휴무자 폴딩 -->
	{#if userRole !== 'GUEST'}
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
