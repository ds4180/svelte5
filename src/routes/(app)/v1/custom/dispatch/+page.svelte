<script>
    /**
     * @file src/routes/(app)/v1/custom/dispatch/+page.svelte
     * @description 일반 임직원 및 기사용 전용 엑셀 격자형(Excel-Density Table) 배차 통합 뷰어
     */
    import { onMount } from 'svelte';
    import { fade, scale } from 'svelte/transition';
    import Icon from '@iconify/svelte';
    import {
        customGetActiveRouteMasters,
        customGetDailyDispatch
    } from '$lib/api/custom.js';

    let routes = $state([]); // 활성 노선 목록
    let selectedRoute = $state(null); // 선택된 노선 (기본값: 전체 노선)
    let dispatchRows = $state([]); // 최종 화면에 보여줄 배차 로우들
    let isLoading = $state(false);
    let errorMessage = $state('');
    let showLockScreen = $state(false);

    // --- 날짜 관리 로직 ---
    const getToday = () => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    };

    let today = getToday();
    let selectedDate = $state(new Date(getToday().getTime() + 86400000 * 3));

    const formatDateISO = (date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    const formatDateDisplay = (date) => {
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${m}.${d}`;
    };

    const formatFullDate = (date) => {
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const day = days[date.getDay()];
        return `${y}-${m}-${d} (${day})`;
    };

    let selectedDateKey = $derived(formatDateISO(selectedDate));
    let selectedFullDate = $derived(formatFullDate(selectedDate));

    // 🔒 보안 타임라인 범위 바인딩 및 이전/다음 차단
    let isPrevDisabled = $derived(Math.round((selectedDate.getTime() - today.getTime()) / 86400000) <= 3);
    let isNextDisabled = $derived(Math.round((selectedDate.getTime() - today.getTime()) / 86400000) >= 7);

    // 노선별 분할 데이터를 위한 반응형 바인딩
    let routesWithDispatches = $derived(
        selectedRoute?.id === 'ALL'
            ? routes.map(r => ({
                route: r,
                rows: dispatchRows.filter(row => row.route_id === r.id)
            }))
            : selectedRoute
                ? [{ route: selectedRoute, rows: dispatchRows }]
                : []
    );

    function setDate(date) {
        selectedDate = new Date(date);
        selectedDate.setHours(0, 0, 0, 0);
    }

    function moveDate(offset) {
        const newDate = new Date(selectedDate);
        newDate.setDate(selectedDate.getDate() + offset);
        setDate(newDate);
    }

    function getRelativeLabel(targetDate) {
        const diff = Math.round((targetDate.getTime() - today.getTime()) / 86400000);
        if (diff === 0) return '오늘';
        if (diff === 1) return '내일';
        if (diff === 2) return '모레';
        if (diff === -1) return '어제';
        return diff > 0 ? `${diff}일 뒤` : `${Math.abs(diff)}일 전`;
    }

    // --- API 연동 & 동기화 (전체 노선 병렬 수집 탑재) ---
    let fetchToken = 0;
    let lastLoadedRoutesDate = '';

    async function syncData(dateKey, forceRouteId = null) {
        const token = ++fetchToken;
        isLoading = true;
        errorMessage = '';
        showLockScreen = false;

        // 🔒 프론트엔드단에서 사전에 타임라인 비공개 대상일 선제적 필터링
        const diffDays = Math.round((selectedDate.getTime() - today.getTime()) / 86400000);
        if (diffDays < 3 || diffDays > 7) {
            isLoading = false;
            showLockScreen = true;
            errorMessage = '배차 비공개 대상일입니다. (조회 가능 범위: 오늘 기준 +3일 ~ +7일)';
            dispatchRows = [];
            return;
        }

        try {
            // 1. 날짜 변경 시 활성 노선 신규 수집
            if (dateKey !== lastLoadedRoutesDate) {
                const activeRoutes = await customGetActiveRouteMasters(dateKey);
                if (token !== fetchToken) return;

                routes = activeRoutes;
                lastLoadedRoutesDate = dateKey;

                // 전체 노선 모드 탑재를 위해 selectedRoute를 'ALL' 구조로 초기 설정
                if (activeRoutes.length > 0) {
                    if (forceRouteId === 'ALL' || !selectedRoute) {
                        selectedRoute = { id: 'ALL', route_name: '전체 노선' };
                    } else {
                        const found = activeRoutes.find(r => r.id === selectedRoute.id || r.route_name === selectedRoute.route_name);
                        selectedRoute = found ? found : { id: 'ALL', route_name: '전체 노선' };
                    }
                } else {
                    selectedRoute = null;
                }
            } else if (forceRouteId !== null) {
                if (forceRouteId === 'ALL') {
                    selectedRoute = { id: 'ALL', route_name: '전체 노선' };
                } else {
                    const found = routes.find(r => r.id === forceRouteId);
                    if (found) selectedRoute = found;
                }
            }

            // 2. 배차 데이터 가공 및 수집 분기
            if (selectedRoute) {
                if (selectedRoute.id === 'ALL') {
                    // 🌟 [통합 뷰어] 날짜 내 모든 활성 노선의 배차 데이터를 병렬 비동기 수집
                    const fetchPromises = routes.map(async (r) => {
                        try {
                            const data = await customGetDailyDispatch(dateKey, r.id);
                            return data.map(row => ({
                                ...row,
                                route_id: r.id,
                                route_name: r.route_name
                            }));
                        } catch (e) {
                            console.error(`❌ [${r.route_name}] 개별 노선 로드 실패:`, e);
                            return [];
                        }
                    });

                    const results = await Promise.all(fetchPromises);
                    if (token !== fetchToken) return;

                    // 수집된 모든 노선의 배차 로우들을 하나의 배열로 평탄화 통합
                    const combined = results.flat();
                    dispatchRows = combined;
                } else {
                    // 단일 노선 조회 모드
                    const data = await customGetDailyDispatch(dateKey, selectedRoute.id);
                    if (token !== fetchToken) return;
                    dispatchRows = data.map(row => ({
                        ...row,
                        route_id: selectedRoute.id,
                        route_name: selectedRoute.route_name
                    }));
                }
            } else {
                dispatchRows = [];
            }
        } catch (err) {
            if (token !== fetchToken) return;
            console.error('❌ 배차 조회 실패:', err);
            
            dispatchRows = [];
            errorMessage = err.detail || err.message || '데이터를 로드하는 데 실패했습니다.';
            showLockScreen = true;
        } finally {
            if (token === fetchToken) {
                isLoading = false;
            }
        }
    }

    $effect(() => {
        syncData(selectedDateKey);
    });

    onMount(() => {
        syncData(selectedDateKey);
    });
</script>

<div class="min-h-screen bg-slate-100 text-slate-900 pb-16">
    <!-- 🔝 상단 앱바 네비게이션 (Glassmorphism) -->
    <header class="sticky top-0 z-40 bg-white/95 border-b border-slate-200 px-4 py-3 shadow-sm">
        <div class="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
                <div class="flex items-center gap-1.5">
                    <span class="p-1.5 bg-slate-900 text-white rounded-lg">
                        <Icon icon="lucide:calendar-range" class="w-4 h-4" />
                    </span>
                    <h1 class="text-lg md:text-xl font-extrabold tracking-tight text-slate-800 flex items-center gap-1.5">
                        임직원 배차표 뷰어
                        <span class="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-black tracking-widest uppercase">Excel Mode</span>
                    </h1>
                </div>
                <p class="text-[10.5px] text-slate-500 mt-0.5 pl-0.5">
                    정렬 및 가독성을 극대화한 현장 맞춤형 격자 그리드 배차표입니다.
                </p>
            </div>

            <!-- 📅 날짜 선택 (컴팩트 대시보드) -->
            <div class="flex items-center gap-1 bg-slate-200/70 p-0.5 rounded-xl self-center md:self-auto">
                <button
                    class="p-1.5 bg-white hover:bg-slate-50 text-slate-700 active:scale-95 rounded-lg transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none"
                    onclick={() => moveDate(-1)}
                    disabled={isPrevDisabled}
                    aria-label="이전 날짜"
                >
                    <Icon icon="lucide:chevron-left" class="w-4 h-4" />
                </button>

                <div class="px-3 py-0.5 text-center min-w-[110px]">
                    <div class="text-xs font-black text-slate-800">{selectedFullDate}</div>
                    <div class="text-[9px] text-indigo-600 font-black uppercase tracking-wider">
                        {getRelativeLabel(selectedDate)}
                    </div>
                </div>

                <button
                    class="p-1.5 bg-white hover:bg-slate-50 text-slate-700 active:scale-95 rounded-lg transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none"
                    onclick={() => moveDate(1)}
                    disabled={isNextDisabled}
                    aria-label="다음 날짜"
                >
                    <Icon icon="lucide:chevron-right" class="w-4 h-4" />
                </button>
            </div>
        </div>
    </header>

    <main class="max-w-7xl mx-auto px-4 mt-4">
        <!-- ⚡ 빠른 날짜 전환 칩 버튼 그룹 (+3일 ~ +7일 범위 고정) -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-2.5 scrollbar-none">
            {#each [3, 4, 5, 6, 7] as offset}
                {@const targetDate = new Date(getToday().getTime() + 86400000 * offset)}
                {@const active = formatDateISO(selectedDate) === formatDateISO(targetDate)}
                <button
                    class="px-3.5 py-1.5 text-[11px] font-extrabold rounded-lg transition-all shrink-0 active:scale-95 border shadow-sm
                    {active ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'}"
                    onclick={() => setDate(targetDate)}
                >
                    +{offset}일 ({formatDateDisplay(targetDate)})
                </button>
            {/each}
        </div>

        <!-- 🚌 노선 선택 수평 칩 그룹 (전체 노선 포함) -->
        {#if routes.length > 0 && !showLockScreen}
            <div class="flex items-center gap-1 overflow-x-auto pb-3 pt-0.5 scrollbar-none" in:fade>
                <!-- 🌟 "전체 노선" 전용 버튼 탑재 -->
                <button
                    class="px-4 py-2 rounded-xl font-extrabold transition-all shrink-0 text-xs flex items-center gap-1.5 border shadow-sm
                    {selectedRoute?.id === 'ALL' 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-100' 
                    : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}"
                    onclick={() => syncData(selectedDateKey, 'ALL')}
                >
                    <Icon icon="lucide:layout-grid" class="w-3.5 h-3.5" />
                    전체 노선
                </button>

                {#each routes as r}
                    <button
                        class="px-4 py-2 rounded-xl font-extrabold transition-all shrink-0 text-xs flex items-center gap-1.5 border shadow-sm
                        {selectedRoute?.id === r.id 
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-100' 
                        : 'bg-white text-slate-600 hover:bg-slate-50 border-slate-200'}"
                        onclick={() => syncData(selectedDateKey, r.id)}
                    >
                        <span class="w-1.5 h-1.5 rounded-full {selectedRoute?.id === r.id ? 'bg-white' : 'bg-slate-300'}"></span>
                        {r.route_name}
                    </button>
                {/each}
            </div>
        {/if}

        <!-- 🔄 로딩 오버레이 -->
        {#if isLoading}
            <div class="flex flex-col items-center justify-center py-24" in:fade>
                <div class="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div>
                <p class="text-xs font-bold text-slate-500 mt-4">격자 데이터를 고화질로 조립하고 있습니다...</p>
            </div>
        {:else if showLockScreen}
            <!-- 🔒 보안 차단 락 스크린 -->
            <div class="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-6 text-center shadow-lg mt-6" in:scale={{ duration: 250 }}>
                <div class="w-16 h-16 bg-slate-100 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-4 relative">
                    <Icon icon="lucide:lock" class="w-8 h-8 animate-bounce" />
                    <span class="absolute top-0 right-0 flex h-3.5 w-3.5">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-indigo-500"></span>
                    </span>
                </div>

                <h2 class="text-base font-black text-slate-800 mb-1">배차표 비공개 대상일</h2>
                <p class="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto mb-5">
                    {errorMessage}
                </p>
                <div class="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 inline-block text-slate-500 text-[10px] font-bold">
                    조회 가능 범위: 오늘 기준 +3일 ~ +7일
                </div>
            </div>
        {:else if routes.length === 0}
            <!-- 🚫 배차 정보 부재 -->
            <div class="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl p-8 text-center shadow-sm mt-6" in:fade>
                <div class="w-12 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center mx-auto mb-3">
                    <Icon icon="lucide:calendar-range" class="w-6 h-6" />
                </div>
                <h3 class="text-sm font-bold text-slate-700 mb-0.5">계획된 운행 노선 없음</h3>
                <p class="text-[10px] text-slate-400 leading-relaxed">
                    선택된 날짜({selectedDateKey})의 활성화된 노선 정보를 찾을 수 없습니다.
                </p>
            </div>
        {:else}
            <!-- 🚐 [Density Excel Sheet] 전면 격자 노선별 표 분할 렌더링 -->
            <div class="mt-1" in:fade>
                {#each routesWithDispatches as item}
                    {#if item.rows.length > 0}
                        <div class="mb-8">
                            <!-- 🏷️ 노선 전용 구분 헤더 -->
                            <div class="flex items-center justify-between mb-2 px-1">
                                <h2 class="text-sm font-extrabold text-slate-800 flex items-center gap-1.5">
                                    <span class="inline-block w-2.5 h-4 bg-indigo-600 rounded-sm"></span>
                                    {item.route.route_name} 배차표
                                </h2>
                                <span class="text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-wider">
                                    {item.rows.length}개 로번
                                </span>
                            </div>

                            <div class="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-md">
                                <div class="overflow-x-auto">
                                    <table class="w-full text-left border-collapse min-w-[750px]">
                                        <thead>
                                            <tr class="bg-slate-100 border-b border-slate-200 text-[11px] text-slate-600 font-extrabold uppercase">
                                                <th class="py-2.5 px-3 border-r border-slate-200 text-center w-20">차량 번호</th>
                                                <th class="py-2.5 px-3 border-r border-slate-200 text-center w-14">로번</th>
                                                <th class="py-2.5 px-3 border-r border-slate-200 text-center w-16">출발</th>
                                                <th class="py-2.5 px-3 border-r border-slate-200 text-center w-16">종료</th>
                                                <th class="py-2.5 px-3 border-r border-slate-200 w-36">시작 위치</th>
                                                <th class="py-2.5 px-3 border-r border-slate-200 w-36">종료 위치</th>
                                                <th class="py-2.5 px-3 border-r border-slate-200 text-center w-24">기사</th>
                                                <th class="py-2.5 px-3 border-r border-slate-200 text-center w-24">상태</th>
                                                <th class="py-2.5 px-3">비고/메모</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-slate-200">
                                            {#each item.rows as row}
                                                <tr class="hover:bg-indigo-50/20 text-xs transition-all {row.is_regular_duty ? 'bg-indigo-50/10' : ''}">
                                                    <!-- 차량 번호 -->
                                                    <td class="py-2 px-3 border-r border-slate-200 font-black text-slate-900 text-center">
                                                        {row.vehicle_no || '-'}
                                                    </td>

                                                    <!-- 로번 -->
                                                    <td class="py-2 px-3 border-r border-slate-200 text-center font-black">
                                                        <span class="inline-flex min-w-[20px] h-[20px] bg-slate-800 text-white rounded-md items-center justify-center text-[10px] px-1">
                                                            {row.seq}
                                                        </span>
                                                    </td>

                                                    <!-- 출발 -->
                                                    <td class="py-2 px-3 border-r border-slate-200 font-black text-indigo-700 text-center tracking-tight">
                                                        {row.start_time}
                                                    </td>

                                                    <!-- 종료 -->
                                                    <td class="py-2 px-3 border-r border-slate-200 font-semibold text-slate-600 text-center tracking-tight">
                                                        {row.end_time}
                                                    </td>

                                                    <!-- 시작 위치 -->
                                                    <td class="py-2 px-3 border-r border-slate-200 font-bold text-slate-700">
                                                        {row.start_location}
                                                    </td>

                                                    <!-- 종료 위치 -->
                                                    <td class="py-2 px-3 border-r border-slate-200 font-semibold text-slate-600">
                                                        {row.end_location}
                                                    </td>

                                                    <!-- 기사 -->
                                                    <td class="py-2 px-3 border-r border-slate-200 text-center font-black {row.driver_name ? 'text-slate-900' : 'text-slate-300 italic'}">
                                                        {row.driver_name || '미지정'}
                                                    </td>

                                                    <!-- 상태 배지 -->
                                                    <td class="py-2 px-3 border-r border-slate-200 text-center">
                                                        {#if row.status === 'CONFIRMED'}
                                                            <span class="inline-flex items-center gap-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 px-1.5 py-0.5 rounded text-[9px] font-black">
                                                                <span class="w-1 h-1 rounded-full bg-emerald-500"></span>
                                                                확정
                                                            </span>
                                                        {:else if row.status === 'ANNOUNCED'}
                                                            <span class="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 border border-blue-100 px-1.5 py-0.5 rounded text-[9px] font-black">
                                                                <span class="w-1 h-1 rounded-full bg-blue-500"></span>
                                                                공지
                                                            </span>
                                                        {:else}
                                                            <span class="inline-flex bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[9px] font-black">
                                                                임시
                                                            </span>
                                                        {/if}
                                                    </td>

                                                    <!-- 비고/메모 -->
                                                    <td class="py-2 px-3 text-slate-500 font-medium max-w-[200px] truncate text-[11px]" title={row.memo}>
                                                        {row.memo || '-'}
                                                    </td>
                                                </tr>
                                            {/each}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    {/if}
                {/each}

                <!-- 💡 근무 표 마일드 범례 -->
                <div class="mt-2.5 flex items-center justify-end gap-3 text-[10px] text-slate-400 font-bold px-1">
                    <div class="flex items-center gap-1">
                        <span class="w-3.5 h-2 bg-indigo-50 border border-indigo-100 rounded-sm"></span>
                        당연 근무 로번 (연속 승계 대상)
                    </div>
                </div>
            </div>
        {/if}
    </main>
</div>

<style>
    /* 스크롤바 커스텀 */
    .scrollbar-none::-webkit-scrollbar {
        display: none;
    }
    .scrollbar-none {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }
</style>
