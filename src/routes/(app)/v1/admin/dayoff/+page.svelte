<script>
    /**
     * @file +page.svelte (Admin Day-Off Management)
     * @description [v2.0] 관리자 전용 결근계 관리 시스템. 리스트 뷰와 월간 타임라인(레코드) 뷰를 제공합니다.
     * @standard Svelte 5 Runes ($state, $derived, $effect)
     */
    import { onMount } from "svelte";
    import * as api from "$lib/api/admin.js";
    import { alertState } from "$lib/runes/alert.svelte.js";
    import Icon from '@iconify/svelte';
    import { formatDateTime } from "$lib/utils.js";

    let { } = $props();

    /**
     * @typedef {Object} DayoffEntry
     * @property {number} id - 고유 ID
     * @property {number} user_id - 사용자 ID
     * @property {string} username - 사용자 계정명
     * @property {string} real_name - 사용자 실명
     * @property {string} date - 휴무 일자 (YYYY-MM-DD)
     * @property {string} type - ANNUAL(연차), SICK(병가), SPECIAL(경조사), OFFICIAL(공가)
     * @property {string} status - REQUESTED, APPROVED, REJECTED, CANCELLED
     * @property {string} memo - 사유
     * @property {string} group_id - 그룹 ID (연속된 날짜 신청용)
     * @property {string} create_date - 등록 시각
     */

    /** @type {DayoffEntry[]} 전체 데이터 저장용 상태 */
    let dayoffs = $state([]);
    
    /** @type {boolean} 로딩 상태 제어 */
    let loading = $state(true);
    
    /** @type {string} 현재 탭 보기 형식 ('list' 또는 'timeline') */
    let currentView = $state('list'); 

    /** @type {number} 월간 조회를 위한 년도 선택 */
    let selectedYear = $state(new Date().getFullYear());
    
    /** @type {number} 월간 조회를 위한 월 선택 (0-11) */
    let selectedMonth = $state(new Date().getMonth());

    /**
     * @derived stats
     * @description 실시간 데이터 기반 통계 지표 계산
     */
    let stats = $derived.by(() => {
        const approved = dayoffs.filter(d => d.status === 'APPROVED');
        const requested = dayoffs.filter(d => d.status === 'REQUESTED');
        return {
            total: dayoffs.length,
            approvedCount: approved.length,
            requestedCount: requested.length,
            typeStats: {
                ANNUAL: approved.filter(d => d.type === 'ANNUAL').length,
                SICK: approved.filter(d => d.type === 'SICK').length,
                SPECIAL: approved.filter(d => d.type === 'SPECIAL').length,
                OFFICIAL: approved.filter(d => d.type === 'OFFICIAL').length,
            }
        };
    });

    /**
     * @derived timelineData
     * @description [핵심] 선택된 월의 날짜별로 결근 내역을 '레코드 형식'으로 재배열
     */
    let timelineData = $derived.by(() => {
        const lastDay = new Date(selectedYear, selectedMonth + 1, 0).getDate();
        const days = [];
        for (let i = 1; i <= lastDay; i++) {
            const dateStr = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
            const dateObj = new Date(selectedYear, selectedMonth, i);
            const dayOfWeek = dateObj.getDay(); 
            
            // 해당 날짜에 '승인'된 휴무 내역만 필터링
            const entries = dayoffs.filter(d => d.date === dateStr && d.status === 'APPROVED');
            days.push({ date: dateStr, day: i, dayOfWeek, entries });
        }
        return days;
    });

    /**
     * @function loadDayoffs
     * @description 백엔드 API를 통해 전체 휴무 내역 로드
     */
    async function loadDayoffs() {
        loading = true;
        try {
            const response = await api.adminGetAllDayoffs();
            dayoffs = Array.isArray(response) ? response : (response.data || []);
        } catch (error) {
            const e = /** @type {Error} */ (error);
            window.alert(`데이터 로드 실패: ${e.message}`);
        } finally {
            loading = false;
        }
    }

    /**
     * @param {number} id
     * @param {string} status
     */
    async function updateStatus(id, status) {
        try {
            await api.adminUpdateDayoffStatus(id, status);
            window.alert(`[${status}] 처리가 완료되었습니다.`);
            await loadDayoffs(); // 데이터 새로고침
        } catch (error) {
            const e = /** @type {Error} */ (error);
            window.alert(`상태 변경 실패: ${e.message}`);
        }
    }

    onMount(loadDayoffs);

    /** @param {number} dow */
    const getDayColor = (dow) => dow === 0 ? 'text-rose-500' : (dow === 6 ? 'text-blue-500' : 'text-slate-900');
    /** @param {number} dow */
    const getDayLabel = (dow) => ['일', '월', '화', '수', '목', '금', '토'][dow];
    /** @param {string} s */
    const getBadgeClass = (s) => {
        if (s === 'REQUESTED') return 'bg-amber-100 text-amber-700 border-amber-200';
        if (s === 'APPROVED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        if (s === 'REJECTED') return 'bg-rose-100 text-rose-700 border-rose-200';
        return 'bg-slate-100 text-slate-500 border-slate-200';
    };
</script>

<div class="space-y-6 md:space-y-10 animate-fade-in font-['Noto_Sans_KR','Outfit'] pb-20 md:pb-40 px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
    
    <!-- 📄 페이지 타이틀 & 탭 전환 -->
    <div class="border-b-2 md:border-b-4 border-slate-900 pb-6 md:pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-6">
        <div>
            <span class="text-[8px] md:text-[10px] font-black tracking-[0.2em] md:tracking-[0.4em] text-slate-400 uppercase block mb-1 md:mb-2">Admin Control / HR-System</span>
            <h1 class="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-slate-900">결근계 <span class="text-blue-600 NOT-ITALIC">마스터 시트 <Icon icon="mdi:calendar-multiselect" class="inline-block align-text-bottom text-blue-600 ml-1" /></span></h1>
            <p class="text-xs md:text-sm font-bold text-slate-500 mt-2 md:mt-3">전체 인원 휴무 내역을 통합 관리하고 레코드 기반으로 현황을 파악합니다.</p>
        </div>
        <div class="flex flex-wrap gap-2 md:gap-4">
            <div class="join border border-slate-200 rounded-lg overflow-hidden md:rounded-2xl">
                <button class="btn btn-sm md:btn-lg join-item {currentView === 'list' ? 'btn-neutral' : 'btn-ghost'}" onclick={() => currentView = 'list'}>신청 목록</button>
                <button class="btn btn-sm md:btn-lg join-item {currentView === 'timeline' ? 'btn-timeline' : 'btn-ghost'}" onclick={() => currentView = 'timeline'}>월간 현황</button>
            </div>
            <button class="btn btn-sm md:btn-lg bg-slate-900 text-white rounded-lg md:rounded-2xl px-4 md:px-8 font-black hover:bg-slate-800 border-none transition-all shadow-md md:shadow-xl" onclick={loadDayoffs} disabled={loading}>
                {#if loading}
                    <span class="loading loading-spinner"></span>
                {:else}
                    <Icon icon="mdi:refresh" class="w-4 h-4 md:w-6 md:h-6" />
                    새로고침
                {/if}
            </button>
        </div>
    </div>

    <!-- 📊 주요 수치 (Dashboard Summary) -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
        <div class="bg-white border border-slate-200 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg md:shadow-xl">
            <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Approval Pending</div>
            <div class="text-2xl md:text-4xl font-black text-amber-600">{stats.requestedCount} <span class="text-xs opacity-50">건</span></div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg md:shadow-xl">
            <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Approved This Month</div>
            <div class="text-2xl md:text-4xl font-black text-emerald-600">{stats.approvedCount} <span class="text-xs opacity-50">일</span></div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg md:shadow-xl">
            <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Annual Leave</div>
            <div class="text-2xl md:text-4xl font-black text-blue-600">{stats.typeStats.ANNUAL} <span class="text-xs opacity-50">일</span></div>
        </div>
        <div class="bg-white border border-slate-200 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg md:shadow-xl">
            <div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Others (Sick/ETC)</div>
            <div class="text-2xl md:text-4xl font-black text-rose-500">{stats.typeStats.SICK + stats.typeStats.SPECIAL} <span class="text-xs opacity-50">일</span></div>
        </div>
    </div>

    {#if currentView === 'list'}
        <!-- 📋 신청 내역 상세 리스트 -->
        <div class="bg-white rounded-xl md:rounded-[2rem] border border-slate-200 shadow-lg md:shadow-2xl overflow-hidden">
            <div class="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h3 class="font-black text-slate-900 text-lg uppercase tracking-tighter italic">Pending Applications <span class="text-blue-600 NOT-ITALIC text-sm font-bold ml-2">검토 대기 중인 신청 건</span></h3>
            </div>
            
            <div class="overflow-x-auto">
                <table class="table w-full">
                    <thead class="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-widest border-b border-slate-100">
                        <tr>
                            <th class="py-4 px-6">Name / ID</th>
                            <th>Date / Range</th>
                            <th>Category</th>
                            <th>Status</th>
                            <th>Reason (Memo)</th>
                            <th class="text-right px-6">Action Control</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50">
                        {#if loading}
                            <tr><td colspan="6" class="text-center py-20"><span class="loading loading-bars loading-lg text-blue-600"></span></td></tr>
                        {:else if dayoffs.filter(d => d.status === 'REQUESTED').length === 0}
                            <tr><td colspan="6" class="text-center py-20 font-black text-slate-300 italic text-xl uppercase tracking-widest">No pending queue</td></tr>
                        {:else}
                            {#each dayoffs.filter(d => d.status === 'REQUESTED') as d (d.id)}
                                <tr class="hover:bg-slate-50 transition-colors group">
                                    <td class="py-4 px-6">
                                        <div class="flex items-center gap-3">
                                            <div class="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400 group-hover:text-blue-600 transition-colors">
                                                {d.real_name?.[0] || d.username[0]}
                                            </div>
                                            <div>
                                                <div class="font-black text-slate-900">{d.real_name || d.username}</div>
                                                <div class="text-[9px] text-slate-400 font-mono tracking-tighter uppercase italic">User_ptr: {d.user_id}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div class="font-bold text-slate-800">{d.date}</div>
                                        {#if d.group_id}
                                            <div class="text-[8px] font-black text-blue-500 uppercase italic opacity-60">GroupRef: {d.group_id}</div>
                                        {/if}
                                    </td>
                                    <td>
                                        <span class="px-2 py-0.5 rounded-md text-[10px] font-black tracking-tighter bg-slate-100 text-slate-700 border border-slate-200 uppercase">
                                            {d.type}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="px-2 py-0.5 rounded-md text-[10px] font-black tracking-tighter border {getBadgeClass(d.status)}">
                                            {d.status}
                                        </span>
                                    </td>
                                    <td class="max-w-[200px] truncate text-xs text-slate-500 italic">
                                        {d.memo || '-'}
                                    </td>
                                    <td class="text-right px-6">
                                        <div class="flex justify-end gap-2 px-1 py-1">
                                            <button class="btn btn-sm bg-emerald-600 hover:bg-emerald-700 text-white border-none rounded-lg font-black transition-all" onclick={() => updateStatus(d.id, 'APPROVED')}>APPROVE</button>
                                            <button class="btn btn-sm bg-rose-500 hover:bg-rose-600 text-white border-none rounded-lg font-black transition-all" onclick={() => updateStatus(d.id, 'REJECTED')}>REJECT</button>
                                        </div>
                                    </td>
                                </tr>
                            {/each}
                        {/if}
                    </tbody>
                </table>
            </div>
        </div>
    {:else}
        <!-- 📅 월간 현황 (Timeline / Monthly Staff Record) -->
        <div class="bg-white rounded-xl md:rounded-[2rem] border border-slate-200 shadow-lg md:shadow-2xl overflow-hidden">
            <div class="p-6 md:p-8 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center bg-slate-50/50 gap-4">
                <div>
                    <h3 class="font-black text-slate-900 text-lg uppercase tracking-tighter italic">Month Activity View <span class="text-blue-600 NOT-ITALIC text-sm font-bold ml-2">월간 결근계 타임라인</span></h3>
                    <p class="text-[10px] font-bold text-slate-400 uppercase mt-1">Daily records of approved absences</p>
                </div>
                
                <div class="flex items-center gap-2 bg-slate-200 p-1.5 rounded-2xl">
                    <select class="select select-sm border-none bg-transparent rounded-xl font-black text-slate-900 focus:outline-none" bind:value={selectedYear}>
                        {#each [2024, 2025, 2026] as year (year)}
                            <option value={year}>{year} YR</option>
                        {/each}
                    </select>
                    <div class="w-px h-6 bg-slate-300"></div>
                    <select class="select select-sm border-none bg-transparent rounded-xl font-black text-slate-900 focus:outline-none" bind:value={selectedMonth}>
                        {#each Array.from({length: 12}, (_, i) => i) as month (month)}
                            <option value={month}>{month + 1} MO</option>
                        {/each}
                    </select>
                </div>
            </div>

            <!-- 📌 Timeline Table (Date Records) -->
            <div class="overflow-x-auto">
                <table class="table w-full">
                    <thead class="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-widest border-b border-slate-100">
                        <tr>
                            <th class="w-20 py-4 px-6 text-center">Day</th>
                            <th class="w-20 text-center">Week</th>
                            <th>Approved Records (Staff on Leave)</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50">
                        {#each timelineData as day (day.date)}
                            <tr class="hover:bg-slate-50/50 transition-colors {day.dayOfWeek === 0 ? 'bg-rose-50/40' : day.dayOfWeek === 6 ? 'bg-blue-50/40' : ''}">
                                <td class="py-4 px-6 text-center font-black text-2xl {getDayColor(day.dayOfWeek)}">{day.day}</td>
                                <td class="text-center">
                                    <span class="text-xs font-black uppercase {getDayColor(day.dayOfWeek)}">{getDayLabel(day.dayOfWeek)}</span>
                                </td>
                                <td class="py-2">
                                    <div class="flex flex-wrap gap-3">
                                        {#if day.entries.length === 0}
                                            <span class="text-[10px] font-bold text-slate-200 italic uppercase ml-2 tracking-widest">Available</span>
                                        {:else}
                                            {#each day.entries as entry (entry.id)}
                                                <div class="group relative flex items-center gap-2 bg-white border border-slate-200 pl-1.5 pr-4 py-1.5 rounded-xl shadow-sm hover:border-blue-500 hover:shadow-lg transition-all cursor-default">
                                                    <div class="w-8 h-8 rounded-lg bg-slate-900 text-[10px] text-white flex items-center justify-center font-black uppercase">
                                                        {entry.real_name?.[0] || entry.username[0]}
                                                    </div>
                                                    <div class="flex flex-col leading-none">
                                                        <span class="text-sm font-black text-slate-900">{entry.real_name || entry.username}</span>
                                                        <span class="text-[9px] font-black text-blue-600 uppercase italic mt-0.5">{entry.type}</span>
                                                    </div>
                                                    
                                                    <!-- Detailed Tooltip -->
                                                    <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 hidden group-hover:block z-[200] bg-slate-900 p-4 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-56 animate-bounce-in border border-slate-700">
                                                        <div class="flex justify-between items-center mb-2 border-b border-slate-700 pb-2">
                                                            <span class="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Detail Info</span>
                                                            <span class="text-[8px] font-mono text-slate-500 italic">#{entry.id}</span>
                                                        </div>
                                                        <p class="text-xs text-white leading-relaxed font-bold italic mb-3">"{entry.memo || '명시된 사유 없음'}"</p>
                                                        <div class="flex flex-col gap-1 text-[8px] font-black uppercase tracking-tight text-slate-400">
                                                            <span>신청: {formatDateTime(entry.create_date)}</span>
                                                            <span>코드: {entry.group_id || 'SINGLE_REQ'}</span>
                                                        </div>
                                                        <div class="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-slate-900 rotate-45 border-r border-b border-slate-700"></div>
                                                    </div>
                                                </div>
                                            {/each}
                                        {/if}
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>
    {/if}

    <!-- 📌 보조 섹션: 최근 처리 완료 내역 (History) -->
    {#if currentView === 'list'}
        <div class="mt-16 space-y-8 opacity-60 hover:opacity-100 transition-opacity">
            <h3 class="text-2xl font-black italic text-slate-400 tracking-tighter uppercase">Audit Trail <span class="text-xs NOT-ITALIC font-bold ml-2">근태 처리 이력</span></h3>
            <div class="bg-white rounded-xl md:rounded-[2rem] border border-slate-200 border-dashed overflow-hidden">
                <table class="table w-full">
                    <thead class="bg-slate-50 text-slate-500 font-bold text-[10px] uppercase tracking-widest border-b border-slate-100">
                        <tr>
                            <th class="py-4 px-6 w-20">Control</th>
                            <th>Staff Name</th>
                            <th>Date Ref</th>
                            <th>Type</th>
                            <th>Final Status</th>
                            <th class="text-right px-6">Timestamp</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-50 font-['Outfit']">
                        {#each dayoffs.filter(d => d.status !== 'REQUESTED').slice(0, 30) as d (d.id)}
                            <tr class="hover:bg-slate-50 transition-all group">
                                <td class="py-3 px-6">
                                    <button class="text-[9px] font-black underline text-slate-400 hover:text-blue-600 transition-colors" onclick={() => updateStatus(d.id, 'REQUESTED')}>REVOKE</button>
                                </td>
                                <td><span class="font-bold text-slate-800">{d.real_name || d.username}</span></td>
                                <td class="text-xs font-medium text-slate-500">{d.date}</td>
                                <td><span class="text-[8px] font-black uppercase px-2 py-1 bg-slate-100 rounded-lg">{d.type}</span></td>
                                <td>
                                    <span class="px-2 py-0.5 rounded-md text-[9px] font-black tracking-tighter border {getBadgeClass(d.status)}">
                                        {d.status}
                                    </span>
                                </td>
                                <td class="text-right px-6 text-[9px] text-slate-400 font-mono italic">
                                    {formatDateTime(d.create_date)}
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>
    {/if}
</div>

<style>
    .animate-fade-in {
        animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    .animate-bounce-in {
        animation: bounceIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    @keyframes bounceIn {
        from { opacity: 0; transform: translate(-50%, 15px) scale(0.85); }
        to { opacity: 1; transform: translate(-50%, 0) scale(1); }
    }
</style>
