<script>
    /**
     * @file src/routes/(app)/v1/admin/dispatch/+page.svelte
     * @description [Phase 1] 관리 레이아웃 + 쌩 엑셀 표(2열) 통합 버전
     */
    import Icon from '@iconify/svelte';
    import { onMount } from 'svelte';
    import { fade } from 'svelte/transition';

    let routes = $state([
        { id: 'R-100', name: '100번 노선', vehicleCount: 10 },
        { id: 'R-200', name: '200번 노선', vehicleCount: 5 },
        { id: 'R-300', name: '300번 통근', vehicleCount: 4 },
    ]);

    let selectedRoute = $state(routes[0]);
    let isLocked = $state(false);
    let lockedBy = $state('');
    let isTomorrowAnnounced = $state(false);

    // --- 날짜 관리 로직 ---
    const getToday = () => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    };

    let today = getToday();
    let selectedDate = $state(getToday());

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

    function setDate(date) {
        selectedDate = new Date(date);
        selectedDate.setHours(0, 0, 0, 0);
        selectedDriverName = ''; // 날짜 변경 시 선택 초기화
    }

    function moveDate(offset) {
        const newDate = new Date(selectedDate);
        newDate.setDate(selectedDate.getDate() + offset);
        setDate(newDate);
    }

    // 상대적 날짜 레이블 생성 (오늘 기준)
    function getRelativeLabel(targetDate) {
        const diff = Math.round((targetDate.getTime() - today.getTime()) / 86400000);
        if (diff === 0) return '오늘';
        if (diff === 1) return '내일';
        if (diff === 2) return '모레';
        if (diff === -1) return '어제';
        if (diff === -2) return '그저께';
        return diff > 0 ? `${diff}일 뒤` : `${Math.abs(diff)}일 전`;
    }

    let prevDate = $derived.by(() => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() - 1);
        return d;
    });

    let nextDate = $derived.by(() => {
        const d = new Date(selectedDate);
        d.setDate(d.getDate() + 1);
        return d;
    });

    // --- 데이터 구조: { 'YYYY-MM-DD': { 'R-100': [...], 'R-200': [...] } } ---
    let dispatchData = $state({
        '2026-05-07': {
            'R-100': [
                { id: 1, vehicle: '3100', turnNo: 1, time: '05:00', driver: '김철수', memo: '' },
                { id: 2, vehicle: '3101', turnNo: 2, time: '05:20', driver: '이영희', memo: '' },
                { id: 3, vehicle: '3102', turnNo: 3, time: '05:40', driver: '', memo: '' },
                { id: 4, vehicle: '3103', turnNo: 4, time: '06:00', driver: '', memo: '' },
                { id: 5, vehicle: '3104', turnNo: 5, time: '06:20', driver: '', memo: '' },
                { id: 6, vehicle: '3105', turnNo: 6, time: '06:40', driver: '', memo: '' },
                { id: 7, vehicle: '3106', turnNo: 7, time: '07:00', driver: '', memo: '' },
                { id: 8, vehicle: '3107', turnNo: 8, time: '07:20', driver: '', memo: '' },
                { id: 9, vehicle: '3108', turnNo: 9, time: '07:40', driver: '', memo: '' },
                { id: 10, vehicle: '3109', turnNo: 10, time: '08:00', driver: '', memo: '' },
            ],
            'R-200': [
                { id: 11, vehicle: '2201', turnNo: 1, time: '05:30', driver: '박명수', memo: '' },
                { id: 12, vehicle: '2202', turnNo: 2, time: '05:50', driver: '', memo: '' },
            ]
        },
        '2026-05-08': {
            'R-100': [
                { id: 101, vehicle: '3100', turnNo: 1, time: '05:00', driver: '유재석', memo: '' },
            ]
        }
    });

    // 현재 선택된 날짜의 데이터 (없으면 빈 객체 반환, 원본 수정 안함)
    let currentDayData = $derived(dispatchData[selectedDateKey] || {});

    // 현재 선택된 날짜+노선의 데이터 (없으면 빈 배열 반환)
    let currentRouteData = $derived(currentDayData[selectedRoute.id] || []);

    let selectedDriverName = $state('');
    
    // 전체 기사 마스터 리스트
    const ALL_DRIVERS = ['김철수', '이영희', '박명수', '정준하', '노홍철', '하하', '유재석', '지석진', '송지효', '김종국', '개리', '양세찬'];

    // 현재 선택된 날짜의 모든 노선에 배정된 기사 목록
    let assignedDrivers = $derived(
        Object.values(currentDayData)
            .flat()
            .map(d => d.driver)
            .filter(name => name && name !== '')
    );

    // 투입 가능한 기사만 필터링 (현재 날짜 기준)
    let availableDrivers = $derived(
        ALL_DRIVERS.filter(name => !assignedDrivers.includes(name))
    );

    // 데이터 안전하게 초기화 및 기사 배정
    function assignDriver(row) {
        // 데이터가 없는 날짜/노선인 경우 초기화 우선 실행
        if (!dispatchData[selectedDateKey]) {
            dispatchData[selectedDateKey] = {};
        }
        if (!dispatchData[selectedDateKey][selectedRoute.id]) {
            // 기존 데이터를 복사하거나 새로 생성 (여기서는 예시 데이터를 유지하거나 빈 데이터로 시작)
            dispatchData[selectedDateKey][selectedRoute.id] = [];
        }

        if (selectedDriverName) {
            row.driver = selectedDriverName;
            selectedDriverName = ''; 
        } else {
            row.driver = '';
        }
    }

    function rotateTurns() {
        const items = currentRouteData;
        if (!items || items.length === 0) return;
        const max = items.length;
        
        items.forEach(item => {
            const nextTurn = (item.turnNo % max) + 1;
            item.turnNo = nextTurn;
            const startMinutes = 5 * 60;
            const totalMinutes = startMinutes + (nextTurn - 1) * 20;
            const hours = Math.floor(totalMinutes / 60);
            const mins = totalMinutes % 60;
            item.time = `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
        });
    }

    function selectRoute(route) {
        selectedRoute = route;
        selectedDriverName = '';
    }
</script>

<style>
    .excel-table {
        border-collapse: collapse;
        width: 100%;
        table-layout: fixed;
    }
    .excel-table th, .excel-table td {
        border: 1px solid #ddd;
        padding: 0;
        height: 30px;
        font-size: 13px;
    }
    .excel-table th {
        background-color: #f8fafc;
        font-weight: 800;
        color: #64748b;
        text-transform: uppercase;
        font-size: 11px;
    }
    .excel-input {
        width: 100%;
        height: 100%;
        border: none;
        padding: 0 8px;
        font-size: 13px;
        outline: none;
        background: transparent;
        font-weight: 600;
    }
    .excel-input:focus {
        background-color: #f0f7ff;
        box-shadow: inset 0 0 0 2px #3b82f6;
    }
    .turn-cell {
        background-color: #fffbeb;
        font-weight: 900;
        text-align: center;
    }
</style>

<div class="min-h-screen bg-slate-50 p-6 md:p-8 font-sans pb-40">
    <!-- 헤더 영역 -->
    <header class="mb-8 border-b-2 border-slate-900 pb-6">
        <div class="flex justify-between items-end">
            <div>
                <div class="flex items-center gap-3 mb-2">
                    <span class="badge bg-slate-900 text-white font-black uppercase text-[10px] px-3 py-1">Admin</span>
                    {#if isLocked}
                        <span class="badge badge-error text-white font-black uppercase text-[10px] animate-pulse">Lock by {lockedBy}</span>
                    {:else}
                        <span class="badge bg-emerald-100 text-emerald-700 font-black uppercase text-[10px]">Editing Mode</span>
                    {/if}
                </div>
                <h1 class="text-4xl font-black uppercase italic tracking-tighter text-slate-900 mb-1">Dispatch Canvas</h1>
                <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global Fleet Management System</p>
            </div>
            
            <button class="btn btn-sm bg-blue-600 hover:bg-blue-700 text-white border-none font-black rounded-lg px-6 shadow-lg"
                    onclick={() => isTomorrowAnnounced = !isTomorrowAnnounced}>
                {isTomorrowAnnounced ? '17시 재공지 완료' : '17시 확정 공지'}
            </button>
        </div>
    </header>

    <!-- 날짜 네비게이션 (지속 가능한 슬라이딩 방식) -->
    <div class="mb-8 flex items-center justify-between bg-white p-2 rounded-2xl border-2 border-slate-900 shadow-[4px_4px_0_rgba(0,0,0,1)]">
        <div class="flex items-center gap-1">
            <!-- 이전 날짜 -->
            <button 
                class="px-5 py-2 text-xs font-black rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all flex flex-col items-center"
                onclick={() => moveDate(-1)}
            >
                <span class="text-[9px] uppercase tracking-tighter opacity-70">{getRelativeLabel(prevDate)}</span>
                <div class="flex items-center gap-1">
                    <Icon icon="ph:caret-left-bold" />
                    {formatDateDisplay(prevDate)}
                </div>
            </button>

            <!-- 선택된 날짜 (중중) -->
            <div class="px-8 py-3 bg-slate-900 text-white rounded-xl shadow-lg flex flex-col items-center group relative overflow-hidden">
                <div class="absolute inset-0 bg-blue-600/10 translate-y-full group-hover:translate-y-0 transition-transform"></div>
                <span class="text-[9px] font-black uppercase tracking-[0.2em] text-blue-400 mb-1 z-10">
                    {getRelativeLabel(selectedDate)} Target
                </span>
                <div class="flex items-center gap-3 z-10">
                    <Icon icon="ph:calendar-star-fill" class="text-blue-400 text-lg" />
                    <span class="text-sm font-black tracking-tight">{selectedFullDate}</span>
                </div>
            </div>

            <!-- 다음 날짜 -->
            <button 
                class="px-5 py-2 text-xs font-black rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all flex flex-col items-center"
                onclick={() => moveDate(1)}
            >
                <span class="text-[9px] uppercase tracking-tighter opacity-70">{getRelativeLabel(nextDate)}</span>
                <div class="flex items-center gap-1">
                    {formatDateDisplay(nextDate)}
                    <Icon icon="ph:caret-right-bold" />
                </div>
            </button>

            <div class="w-[2px] h-8 bg-slate-100 mx-3"></div>

            <!-- 오늘로 즉시 복귀 -->
            <button 
                class="px-4 py-2 text-[10px] font-black rounded-xl border-2 border-slate-900 hover:bg-slate-900 hover:text-white transition-all uppercase tracking-tighter flex items-center gap-2"
                onclick={() => setDate(today)}
            >
                <Icon icon="ph:arrow-u-up-left-bold" />
                Jump to Today
            </button>
        </div>

        <div class="flex items-center gap-6 px-6">
            <div class="flex flex-col items-end">
                <span class="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Assigned Drivers</span>
                <div class="flex items-baseline gap-1">
                    <span class="text-xl font-black text-slate-900">{assignedDrivers.length}</span>
                    <span class="text-[10px] font-bold text-slate-400">/ {ALL_DRIVERS.length}</span>
                </div>
            </div>
            <div class="w-[1px] h-10 bg-slate-200"></div>
            <div class="flex flex-col items-end">
                <span class="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Live Routes</span>
                <span class="text-xl font-black text-blue-600">{Object.keys(currentDayData).length}</span>
            </div>
        </div>
    </div>

    <div class="flex flex-col lg:flex-row gap-8">
        <!-- 좌측: 노선 선택 -->
        <aside class="lg:w-1/5 flex flex-col gap-2">
            <h2 class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Select Route</h2>
            {#each routes as route}
                <button 
                    class="text-left px-4 py-3 rounded-xl border-2 transition-all
                        {selectedRoute.id === route.id 
                            ? 'bg-slate-900 border-slate-900 text-white shadow-lg' 
                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}"
                    onclick={() => selectRoute(route)}
                >
                    <div class="flex justify-between items-center">
                        <span class="font-black text-sm">{route.name}</span>
                        {#if currentDayData[route.id]?.length > 0}
                            <span class="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-md">LIVE</span>
                        {/if}
                    </div>
                </button>
            {/each}
            
            <div class="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-2xl">
                <p class="text-[11px] font-bold text-amber-800 mb-2">로번 자동 계산</p>
                <button class="btn btn-xs w-full bg-amber-500 hover:bg-amber-600 text-white border-none font-black rounded-md" onclick={rotateTurns}>
                    {selectedDateKey} 순환 실행
                </button>
            </div>
        </aside>

        <!-- 우측: 쌩 엑셀 스타일 배차표 (2열) -->
        <main class="lg:w-4/5 bg-white rounded-3xl border border-slate-200 shadow-xl p-6 overflow-hidden">
            <div class="flex flex-col gap-4 mb-6">
                <div class="flex justify-between items-center">
                    <h2 class="text-2xl font-black text-slate-800 flex items-center gap-3">
                        <div class="w-2 h-8 bg-blue-600 rounded-full"></div>
                        {selectedRoute.name} 배차표
                        <span class="ml-4 px-4 py-1.5 bg-slate-900 text-white text-sm font-black rounded-lg shadow-sm tracking-tight">
                            {selectedFullDate}
                        </span>
                    </h2>
                    <div class="flex items-center gap-4">
                        <div class="flex items-center gap-2">
                            <div class="w-3 h-3 bg-emerald-100 border border-emerald-300 rounded"></div>
                            <span class="text-[10px] font-bold text-slate-500">배정됨</span>
                        </div>
                        <div class="text-[11px] font-bold text-slate-400 uppercase tracking-tighter bg-slate-100 px-3 py-1 rounded-full">Excel-Density Mode</div>
                    </div>
                </div>
            </div>

            <div class="flex flex-row gap-6 w-full items-start">
            <div class="flex flex-row gap-6 w-full items-start">
                <!-- 좌측: 기사 컬럼이 포함된 초슬림 배차 시트 -->
                <div class="w-fit">
                    <table class="excel-table" style="width: 390px;">
                        <thead>
                            <tr>
                                <th style="width: 70px;">차량</th>
                                <th style="width: 50px;">로번</th>
                                <th style="width: 70px;">시간</th>
                                <th style="width: 100px;">기사</th>
                                <th style="width: 100px;">비고</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each currentRouteData as row}
                                <tr>
                                    <td><input type="text" bind:value={row.vehicle} class="excel-input text-slate-800 text-center" /></td>
                                    <td class="turn-cell"><input type="number" bind:value={row.turnNo} class="excel-input text-center text-amber-900" /></td>
                                    <td class="bg-blue-50/30"><input type="text" bind:value={row.time} class="excel-input text-center text-blue-700 text-[11px]" /></td>
                                    <td 
                                        class="cursor-pointer transition-colors {selectedDriverName ? 'bg-emerald-100 animate-pulse' : 'bg-emerald-50/30'}"
                                        onclick={() => assignDriver(row)}
                                    >
                                        <input type="text" bind:value={row.driver} placeholder={selectedDriverName ? '배정하기' : '기사 배정'} class="excel-input text-center text-emerald-700 font-black pointer-events-none" readonly />
                                    </td>
                                    <td><input type="text" bind:value={row.memo} class="excel-input text-slate-500 font-normal" /></td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <!-- 우측: 기사 목록 영역 (Data Source) -->
                <div class="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden min-h-[500px] flex flex-col">
                    <div class="bg-slate-50 px-4 py-3 border-b border-slate-200 flex justify-between items-center">
                        <h3 class="text-sm font-black text-slate-700 flex items-center gap-2">
                            <Icon icon="ph:users-four-fill" class="text-blue-600" />
                            투입 가능 기사 목록
                        </h3>
                        <span class="badge bg-blue-100 text-blue-700 font-bold text-[10px]">{availableDrivers.length}명 대기중</span>
                    </div>
                    <div class="p-4 grid grid-cols-2 xl:grid-cols-3 gap-2 overflow-y-auto">
                        {#each availableDrivers as name}
                            <button 
                                class="flex items-center justify-between p-2 rounded-lg border transition-all group
                                    {selectedDriverName === name 
                                        ? 'bg-emerald-600 border-emerald-600 text-white shadow-md' 
                                        : 'bg-slate-50 border-slate-100 hover:border-emerald-400 hover:bg-emerald-50 text-slate-700'}"
                                onclick={() => selectDriver(name)}
                            >
                                <span class="text-sm font-bold">{name}</span>
                                <Icon icon="ph:check-circle-fill" class="{selectedDriverName === name ? 'text-white' : 'text-slate-300 group-hover:text-emerald-500'} transition-colors" />
                            </button>
                        {/each}
                    </div>
                    <div class="p-4 mt-auto border-t border-slate-100 bg-slate-50/50">
                        <p class="text-[10px] text-slate-400 leading-relaxed font-medium">
                            {#if selectedDriverName}
                                <span class="text-emerald-600 font-black animate-bounce inline-block mr-1">[{selectedDriverName}]</span> 기사님이 선택되었습니다. 배차표의 빈칸을 클릭하세요.
                            {:else}
                                * 기사 이름을 클릭한 후, 왼쪽 배차표의 기사 칸을 클릭하여 배정하세요.
                            {/if}
                        </p>
                    </div>
                </div>
            </div>
            </div>

            <!-- 하단 플로팅 저장 -->
            <div class="mt-8 flex justify-end">
                <button class="btn bg-slate-900 hover:bg-black text-white border-none rounded-xl px-8 font-black shadow-xl">
                    임시저장
                </button>
            </div>
        </main>
    </div>
</div>
