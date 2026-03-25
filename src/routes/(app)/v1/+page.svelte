<script>
    /**
     * @file v1/+page.svelte (통합 대시보드 메인)
     * @description 시스템 접속 시 처음 마주하는 실무형 대시보드
     */
    import { onMount } from "svelte";
    import { formatDateTime } from "$lib/utils.js";
    
    // ⚠️ [하이드레이션 방어] 서버와 클라이언트의 시간 차이를 방지하기 위해 초기값을 null로 설정
    let now = $state(null);

    onMount(() => {
        now = new Date();
    });
</script>

<div class="space-y-12 animate-fade-in text-black font-['Outfit']">
    <!-- 📄 Section: Welcome Hero (고대비 사무용 헤더) -->
    <div class="border-b-4 border-black pb-10 flex flex-col md:flex-row justify-between items-end gap-6">
        <div class="space-y-4">
            <span class="text-[10px] font-black tracking-[0.4em] opacity-30 uppercase block">Infrastructure Core Engine</span>
            <h1 class="text-6xl font-black tracking-tighter uppercase italic leading-none">Jeju.Live <span class="text-primary NOT-ITALIC tracking-normal">v5</span></h1>
            <p class="text-sm font-bold opacity-60 max-w-lg leading-relaxed">제주 라이브 관리 시스템에 오신 것을 환영합니다. 왼쪽 메뉴를 통해 실시간 버스 관제, 근태 관리, 스케줄링 통합 서비스를 이용하실 수 있습니다.</p>
        </div>
        <div class="flex flex-col items-end text-right">
            <span class="text-[9px] font-black opacity-30 uppercase tracking-widest mb-1">Last Sync Status</span>
            <div class="flex items-center gap-3">
                <div class="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></div>
                <!-- 🕒 [하이드레이션 해결] 데이터가 로드된 후에만 날짜 출력 -->
                <span class="text-3xl font-black tracking-tighter">
                    {now ? formatDateTime(now).split(' ')[0] : 'LOADING...'}
                </span>
            </div>
            <p class="text-[10px] font-black opacity-20 mt-1 uppercase">Cloud Connection Stable</p>
        </div>
    </div>

    <!-- 📊 Section: Quick Access Grid (1px Border Bento) -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <!-- Card 1: Schedule -->
        <a href="/v1/app/calendar" class="group border border-black p-8 bg-white hover:bg-black hover:text-white transition-all">
            <div class="flex flex-col h-full justify-between gap-10">
                <div class="flex justify-between items-start">
                    <span class="text-4xl">🗓️</span>
                    <span class="text-[9px] font-black border border-current px-2 py-0.5 uppercase">Schedule</span>
                </div>
                <div>
                   <h3 class="text-2xl font-black tracking-tight mb-2">Main Schedule</h3>
                   <p class="text-xs font-bold opacity-40 group-hover:opacity-60">전체 업무 일정 및 배차표 통합 관리</p>
                </div>
            </div>
        </a>

        <!-- Card 2: Day-Off -->
        <a href="/v1/app/day-off" class="group border border-black p-8 bg-white hover:bg-black hover:text-white transition-all">
            <div class="flex flex-col h-full justify-between gap-10">
                <div class="flex justify-between items-start">
                    <span class="text-4xl">📑</span>
                    <span class="text-[9px] font-black border border-current px-2 py-0.5 uppercase">Personnel</span>
                </div>
                <div>
                   <h3 class="text-2xl font-black tracking-tight mb-2">Leave Request</h3>
                   <p class="text-xs font-bold opacity-40 group-hover:opacity-60">근태 신청 및 인가 관리 시스템</p>
                </div>
            </div>
        </a>

        <!-- Card 3: simulation -->
        <a href="/sgv4" class="group border border-black p-8 bg-white hover:bg-black hover:text-white transition-all">
            <div class="flex flex-col h-full justify-between gap-10">
                <div class="flex justify-between items-start">
                    <span class="text-4xl">🚍</span>
                    <span class="text-[9px] font-black border border-current px-2 py-0.5 uppercase">simulation</span>
                </div>
                <div>
                   <h3 class="text-2xl font-black tracking-tight mb-2">Route Control</h3>
                   <p class="text-xs font-bold opacity-40 group-hover:opacity-60">버스 노선 실시간 현황 및 시뮬레이션</p>
                </div>
            </div>
        </a>
    </div>

    <!-- 📋 Section: System Log Summary -->
    <div class="pt-20 pb-40 space-y-8">
        <h3 class="text-3xl font-black tracking-tighter uppercase italic border-b border-black pb-4">Realtime Service Log</h3>
        <div class="border border-black bg-slate-50 p-12 text-center select-none grayscale opacity-30">
            <p class="text-lg font-black tracking-widest leading-loose uppercase italic">Current Session is Healthy / No Immediate Actions Required</p>
            <p class="text-[9px] font-bold mt-2 tracking-widest">실시간 리포팅을 위해 데이터를 백그라운드에서 동기화 중입니다.</p>
        </div>
    </div>
</div>
