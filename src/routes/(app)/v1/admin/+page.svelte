<script>
    /**
     * @file (app)/v1/admin/+page.svelte
     * @description 시스템 통합 관리 관제탑 (한글화 버전)
     */
    import { onMount } from "svelte";
    import * as api from "$lib/api/admin.js";
    import { alertState } from "$lib/runes/alert.svelte.js";
    import { fade, fly } from "svelte/transition";

    let stats = $state({
        user_count: 0,
        board_count: 0,
        post_count: 0,
        app_count: 0,
        admin_name: "관리자"
    });
    let loading = $state(true);

    async function loadStats() {
        loading = true;
        try {
            stats = await api.adminGetDashboard();
        } catch (e) {
            alertState.send(e.message, { level: 3, style: 'error' });
        } finally {
            loading = false;
        }
    }

    onMount(loadStats);

    const adminModules = [
        { title: "메뉴 마스터", desc: "시스템 전체 내비게이션 및 권한 구조 편집", link: "/v1/admin/menu", icon: "🌳", color: "bg-blue-600" },
        { title: "앱 레지스트리", desc: "게시판, 캘린더 등 시스템 엔진 등록 및 관리", link: "/v1/admin/apps", icon: "📦", color: "bg-indigo-600" },
        { title: "사용자 관리", desc: "회원 등급 조정 및 시스템 승인 프로토콜", link: "#", icon: "👤", color: "bg-emerald-600" },
        { title: "게시판 관리", desc: "개별 게시판 슬러그 및 레이아웃 정책 설정", link: "#", icon: "📑", color: "bg-orange-600" },
        { title: "시스템 설정", desc: "글로벌 환경 변수 및 공통 코드 동적 수정", link: "#", icon: "⚙️", color: "bg-slate-700" },
        { title: "휴무 승인", desc: "직원 휴무 신청 내역 실시간 검토 및 결재", link: "#", icon: "📅", color: "bg-pink-600" }
    ];
</script>

<div class="space-y-12 animate-fade-in text-black font-['Outfit','Noto_Sans_KR'] pb-40">
    
    <!-- 📄 상단 로고 및 상태 -->
    <div class="border-b-4 border-black pb-8 flex justify-between items-end">
        <div>
            <span class="text-[10px] font-black tracking-[0.4em] opacity-30 uppercase block mb-2">Central Operations</span>
            <h1 class="text-6xl font-black tracking-tighter uppercase italic">관리자 <span class="text-blue-600 NOT-ITALIC">관제센터</span></h1>
            <p class="text-sm font-bold opacity-40 mt-3">{stats.admin_name}님, 오늘도 시스템은 안정적으로 가동 중입니다.</p>
        </div>
        <div class="flex gap-2 text-center">
             <div class="px-6 py-2 border border-black font-black text-[10px] uppercase bg-white">서버: <span class="text-success">가동 중</span></div>
             <div class="px-6 py-2 border border-black font-black text-[10px] uppercase bg-black text-white">버전: v5.1.0</div>
        </div>
    </div>

    <!-- 📊 실시간 주요 지표 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="border-2 border-black p-8 bg-white shadow-[10px_10px_0_rgba(0,0,0,0.05)]">
            <div class="text-[10px] font-black opacity-30 uppercase tracking-widest mb-4">전체 사용자</div>
            <div class="flex items-baseline gap-2">
                <span class="text-5xl font-black tracking-tighter">{stats.user_count}</span>
                <span class="text-xs font-bold opacity-40">명</span>
            </div>
        </div>
        <div class="border-2 border-black p-8 bg-white shadow-[10px_10px_0_rgba(0,0,0,0.05)]">
            <div class="text-[10px] font-black opacity-30 uppercase tracking-widest mb-4">전체 게시물</div>
            <div class="flex items-baseline gap-2">
                <span class="text-5xl font-black tracking-tighter">{stats.post_count}</span>
                <span class="text-xs font-bold opacity-40">건</span>
            </div>
        </div>
        <div class="border-2 border-black p-8 bg-white shadow-[10px_10px_0_rgba(0,0,0,0.05)]">
            <div class="text-[10px] font-black opacity-30 uppercase tracking-widest mb-4">작동 중인 엔진</div>
            <div class="flex items-baseline gap-2">
                <span class="text-5xl font-black tracking-tighter">{stats.app_count}</span>
                <span class="text-xs font-bold opacity-40">개</span>
            </div>
        </div>
        <div class="border-2 border-black p-8 bg-blue-600 text-white shadow-[10px_10px_0_rgba(37,99,235,0.2)]">
            <div class="text-[10px] font-black opacity-60 uppercase tracking-widest mb-4">활성 게시판</div>
            <div class="flex items-baseline gap-2">
                <span class="text-5xl font-black tracking-tighter">{stats.board_count}</span>
                <span class="text-xs font-bold opacity-60">그룹</span>
            </div>
        </div>
    </div>

    <!-- 🕹️ 시스템 관리 모듈 (벤토 그리드) -->
    <div class="space-y-6">
        <h3 class="text-2xl font-black tracking-tighter italic border-l-8 border-black pl-4">시스템 관리 모듈</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each adminModules as mod}
                <a href={mod.link} class="group border-2 border-black p-8 bg-white hover:bg-slate-900 hover:text-white transition-all duration-300 relative overflow-hidden">
                    <div class="flex justify-between items-start relative z-10">
                        <div class="w-14 h-14 {mod.color} text-white flex items-center justify-center text-2xl border-2 border-black shadow-[4px_4px_0_black] group-hover:scale-110 transition-transform">
                            {mod.icon}
                        </div>
                        <div class="text-[9px] font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2">
                            모듈 진입 <span class="translate-x-0 group-hover:translate-x-2 transition-transform">→</span>
                        </div>
                    </div>
                    <div class="mt-8 relative z-10">
                        <h4 class="text-2xl font-black tracking-tighter mb-2">{mod.title}</h4>
                        <p class="text-xs font-bold opacity-40 group-hover:opacity-60 leading-relaxed">{mod.desc}</p>
                    </div>
                </a>
            {/each}
        </div>
    </div>

    <!-- ⚙️ 퀵 링크: 메뉴 마스터 -->
    <div class="border-2 border-black p-10 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-8">
        <div class="flex items-center gap-6">
            <div class="w-20 h-20 bg-blue-600 border-2 border-black flex items-center justify-center text-4xl shadow-[8px_8px_0_black]">🌳</div>
            <div>
                <h4 class="text-3xl font-black tracking-tighter italic">메뉴 구조를 먼저 수정하시겠습니까?</h4>
                <p class="text-sm font-bold opacity-40">전체 사이트의 주소 체계와 메뉴 구성을 실시간으로 변경합니다.</p>
            </div>
        </div>
        <a href="/v1/admin/menu" class="btn btn-black rounded-none px-12 h-16 font-black text-lg shadow-[8px_8px_0_rgba(0,0,0,0.1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all">
            메뉴 마스터 바로가기
        </a>
    </div>

</div>

<style>
    :global(body) { background-color: #f1f5f9; }
    .animate-fade-in { animation: fadeIn 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
</style>
