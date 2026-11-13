<script>
	/**
	 * @file v1/+page.svelte (통합 대시보드 메인)
	 * @description 시스템 접속 시 처음 마주하는 실무형 대시보드
	 */
	import { onMount } from 'svelte';
	import { formatDateTime } from '$lib/utils';

	// ⚠️ [하이드레이션 방어] 서버와 클라이언트의 시간 차이를 방지하기 위해 초기값을 null로 설정
	let now = $state(null);

	onMount(() => {
		now = new Date();
	});
</script>

<div class="animate-fade-in space-y-12 font-['Outfit'] text-black">
	<!-- 📄 Section: Welcome Hero (고대비 사무용 헤더) -->
	<div
		class="flex flex-col items-end justify-between gap-6 border-b-4 border-black pb-10 md:flex-row"
	>
		<div class="space-y-4">
			<span class="block text-[10px] font-black tracking-[0.4em] uppercase opacity-30"
				>Infrastructure Core Engine</span
			>
			<h1 class="text-6xl leading-none font-black tracking-tighter uppercase italic">
				Jeju.Live <span class="NOT-ITALIC tracking-normal text-primary">v5</span>
			</h1>
			<p class="max-w-lg text-sm leading-relaxed font-bold opacity-60">
				machine - 제주 라이브 관리 시스템에 오신 것을 환영합니다. 왼쪽 메뉴를 통해 실시간 버스 관제,
				근태 관리, 스케줄링 통합 서비스를 이용하실 수 있습니다.
			</p>
		</div>
		<div class="flex flex-col items-end text-right">
			<span class="mb-1 text-[9px] font-black tracking-widest uppercase opacity-30"
				>Last Sync Status</span
			>
			<div class="flex items-center gap-3">
				<div class="h-2.5 w-2.5 animate-pulse rounded-full bg-green-500"></div>
				<!-- 🕒 [하이드레이션 해결] 데이터가 로드된 후에만 날짜 출력 -->
				<span class="text-3xl font-black tracking-tighter">
					{now ? formatDateTime(now).split(' ')[0] : 'LOADING...'}
				</span>
			</div>
			<p class="mt-1 text-[10px] font-black uppercase opacity-20">Cloud Connection Stable</p>
		</div>
	</div>

	<!-- 📊 Section: Quick Access Grid (1px Border Bento) -->
	<div class="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-3">
		<!-- Card 1: Schedule -->
		<a
			href="/v1/pages/schedule"
			class="group border border-black bg-white p-8 transition-all hover:bg-black hover:text-white"
		>
			<div class="flex h-full flex-col justify-between gap-10">
				<div class="flex items-start justify-between">
					<span class="text-4xl">🗓️</span>
					<span class="border border-current px-2 py-0.5 text-[9px] font-black uppercase"
						>Schedule</span
					>
				</div>
				<div>
					<h3 class="mb-2 text-2xl font-black tracking-tight">Main Schedule</h3>
					<p class="text-xs font-bold opacity-40 group-hover:opacity-60">
						전체 업무 일정 및 배차표 통합 관리
					</p>
				</div>
			</div>
		</a>

		<!-- Card 2: Day-Off (CUSTOM 단일 앱 표준 경로: /v1/custom/dayoff) -->
		<a
			href="/v1/custom/dayoff"
			class="group border border-black bg-white p-8 transition-all hover:bg-black hover:text-white"
		>
			<div class="flex h-full flex-col justify-between gap-10">
				<div class="flex items-start justify-between">
					<span class="text-4xl">📑</span>
					<span class="border border-current px-2 py-0.5 text-[9px] font-black uppercase"
						>Personnel</span
					>
				</div>
				<div>
					<h3 class="mb-2 text-2xl font-black tracking-tight">Leave Request</h3>
					<p class="text-xs font-bold opacity-40 group-hover:opacity-60">
						근태 신청 및 인가 관리 시스템
					</p>
				</div>
			</div>
		</a>

		<!-- Card 3: simulation -->
		<a
			href="/sgv4"
			class="group border border-black bg-white p-8 transition-all hover:bg-black hover:text-white"
		>
			<div class="flex h-full flex-col justify-between gap-10">
				<div class="flex items-start justify-between">
					<span class="text-4xl">🚍</span>
					<span class="border border-current px-2 py-0.5 text-[9px] font-black uppercase"
						>simulation</span
					>
				</div>
				<div>
					<h3 class="mb-2 text-2xl font-black tracking-tight">Route Control</h3>
					<p class="text-xs font-bold opacity-40 group-hover:opacity-60">
						버스 노선 실시간 현황 및 시뮬레이션
					</p>
				</div>
			</div>
		</a>
	</div>

	<!-- 📋 Section: System Log Summary -->
	<div class="space-y-8 pt-20 pb-40">
		<h3 class="border-b border-black pb-4 text-3xl font-black tracking-tighter uppercase italic">
			Realtime Service Log
		</h3>
		<div class="border border-black bg-slate-50 p-12 text-center opacity-30 grayscale select-none">
			<p class="text-lg leading-loose font-black tracking-widest uppercase italic">
				Current Session is Healthy / No Immediate Actions Required
			</p>
			<p class="mt-2 text-[9px] font-bold tracking-widest">
				실시간 리포팅을 위해 데이터를 백그라운드에서 동기화 중입니다.
			</p>
		</div>
	</div>
</div>
