<script>
    /**
     * @file (app)/v1/app/dayoff/+page.svelte
     * @description [v2.0] 근무자 전용 휴무 신청 및 관리 시스템 (Svelte 5 Runes & Premium Design)
     */
    import { enhance } from "$app/forms";
    import Calendar from "$lib/components/Calendar.svelte";
    import { timestampToDateString } from "$lib/utils.js";
    import { alertState } from "$lib/runes/alert.svelte.js";
    import Icon from '@iconify/svelte';

    let { data, form } = $props();

    // 📌 입력 상태 관리 ($state)
    /** @type {number[]} */
    let selectedDates = $state([]);
    /** @type {number|null} */
    let startDate = $state(null); // 범위 선택 시작일 (timestamp)
    let selectedType = $state("ANNUAL");
    let memo = $state("");
    let isSubmitting = $state(false);

    // 서버 응답 처리용 Guard 변수 (불필요한 리렌더링 트리거 방지용)
    let lastProcessedForm = $state(null);
    // 💡 참고: 알림 로직은 이제 use:enhance 내부에서 직접 처리합니다. (무한 루프 원천 차단)

    /**
     * @function handleDayClick
     * @description 범위 선택 지원 (시작일 클릭 -> 종료일 클릭 시 사이 기간 자동 선택)
     */
    /**
     * @param {any} event
     */
    function handleDayClick(event) {
        const clicked = event.detail.timestamp;
        
        // 1. 이미 범위 선택이 완료된 상태거나, 아무것도 선택되지 않은 경우 -> 새로 시작
        if (selectedDates.length > 1 || !startDate) {
            startDate = clicked;
            selectedDates = [clicked];
            return;
        }

        // 2. 시작일만 있는 상태에서 클릭 -> 범위 완성
        if (startDate) {
            const endNode = clicked;
            const start = Math.min(startDate, endNode);
            const end = Math.max(startDate, endNode);
            
            const range = [];
            const oneDay = 24 * 60 * 60 * 1000;
            for (let t = start; t <= end; t += oneDay) {
                range.push(t);
            }
            
            selectedDates = range;
            // 선택 완료 후 다음 클릭을 위해 초기화 로직은 상황에 따라 다르지만
            // "다시 선택하면 기존 취소" 요구사항에 따라 selectedDates.length > 1 조건으로 체크
        }
    }

    /** @param {string} s */
    const getBadgeClass = (s) => {
        if (s === 'REQUESTED') return 'bg-amber-100 text-amber-700 border-amber-200';
        if (s === 'APPROVED') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        if (s === 'REJECTED') return 'bg-rose-100 text-rose-700 border-rose-200';
        return 'bg-slate-100 text-slate-500 border-slate-200';
    };

    /** @param {string} t */
    const getTypeLabel = (t) => {
        /** @type {Record<string, string>} */
        const map = { ANNUAL: '연차', SICK: '병가', SPECIAL: '경조사', OFFICIAL: '공가' };
        return map[t] || t;
    };
</script>

<div class="space-y-12 animate-fade-in font-['Noto_Sans_KR','Outfit'] pb-40 px-4 md:px-8 max-w-7xl mx-auto">
    
    <!-- 📄 Page Header -->
    <div class="border-b-4 border-slate-900 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
            <span class="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase block mb-2">Employee Self-Service / Attendance</span>
            <h1 class="text-4xl md:text-6xl font-black tracking-tighter uppercase italic text-slate-900">휴무 <span class="text-blue-600 NOT-ITALIC">신청 <Icon icon="mdi:calendar-check" class="inline-block align-text-bottom text-blue-600 ml-1" /></span></h1>
            <p class="text-sm font-bold text-slate-500 mt-4">개인별 휴무 일정을 계획하고 승인 상태를 실시간으로 확인합니다.</p>
        </div>
        <div class="flex items-center gap-6">
            <div class="text-right">
                <span class="text-[8px] font-black text-slate-300 uppercase tracking-widest block mb-1">Lifetime Record</span>
                <div class="text-3xl font-black text-slate-900 tracking-tighter leading-none">{data.total} <span class="text-xs opacity-50 not-italic">건</span></div>
            </div>
        </div>
    </div>

    <!-- 📊 Main Layout -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        <!-- Left: Calendar Area -->
        <div class="lg:col-span-8 bg-white border-2 border-slate-900 rounded-[3rem] p-6 md:p-10 shadow-2xl overflow-hidden min-h-[600px]">
             <div class="mb-8 flex justify-between items-center px-4">
                 <h3 class="text-xl font-black italic text-slate-900 uppercase tracking-tighter">Schedule Selector</h3>
                 <span class="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">날짜를 클릭하여 선택하세요 (다중 선택 가능)</span>
             </div>
             <Calendar 
                selectedDates={selectedDates}
                on:dayclick={handleDayClick}
             />
        </div>

        <!-- Right: Request Input -->
        <div class="lg:col-span-4 space-y-6">
            <div class="bg-slate-900 border-2 border-slate-900 p-8 md:p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden">
                <!-- Decorative background icon -->
                <Icon icon="mdi:file-document-edit-outline" class="absolute -right-4 -bottom-4 w-40 h-40 opacity-5" />

                <h3 class="text-2xl font-black italic uppercase tracking-tighter mb-10 border-b border-slate-700 pb-4">Application Form</h3>
                
                <form method="post" action="?/create" use:enhance={() => {
                    isSubmitting = true;
                    return async ({ result, update }) => {
                        await update();
                        isSubmitting = false;

                        // 🛡️ [무한 루프 방어] 동작(Action) 직후 한 번만 실행되는 명령형 알림
                        if (result.type === 'success') {
                            window.alert("휴무 신청이 성공적으로 완료되었습니다.");
                            selectedDates = [];
                            startDate = null;
                            memo = "";
                        } else if (result.type === 'failure') {
                            // @ts-ignore
                            window.alert(result.data?.error || "신청에 실패했습니다.");
                        }
                    };
                }} class="space-y-8">
                    <input type="hidden" name="dates" value={JSON.stringify(selectedDates.map(ts => timestampToDateString(ts)))} />
                    
                    <!-- Type Selection -->
                    <div class="space-y-4">
                        <span class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block ml-1">Absence Category</span>
                        <div class="grid grid-cols-2 gap-2">
                            {#each ['ANNUAL', 'SICK', 'SPECIAL', 'OFFICIAL'] as type (type)}
                                <label for="type-{type}" class="group relative h-12 flex items-center justify-center cursor-pointer transition-all rounded-xl font-black text-xs border-2 border-slate-800
                                             {selectedType === type ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-slate-800/50 text-slate-400 hover:border-slate-600'}">
                                    <input type="radio" id="type-{type}" name="type" value={type} bind:group={selectedType} class="hidden" />
                                    {getTypeLabel(type)}
                                </label>
                            {/each}
                        </div>
                    </div>

                    <!-- Memo textarea -->
                    <div class="space-y-4">
                        <label class="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 block ml-1" for="memo">Detail Reason / Memo</label>
                        <textarea 
                            id="memo"
                            class="w-full bg-slate-800/50 border-2 border-slate-800 rounded-2xl p-4 text-sm font-medium text-white focus:border-blue-500 focus:outline-none transition-all placeholder:text-slate-600" 
                            name="memo" 
                            rows="3"
                            placeholder="사유를 입력하세요 (선택 사항)"
                            bind:value={memo}
                        ></textarea>
                    </div>

                    <!-- Selected List Summary -->
                    <div class="bg-slate-800/30 rounded-2xl p-6 border border-slate-800">
                        <div class="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                             <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Total selection</span>
                             <span class="font-black text-lg text-emerald-400">{selectedDates.length} <span class="text-xs font-bold">DAYS</span></span>
                        </div>
                        <div class="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-2 custom-scrollbar">
                            {#each selectedDates as ts (ts)}
                                <span class="bg-slate-700 text-white text-[9px] px-2 py-1 rounded-md font-bold border border-slate-600">
                                    {timestampToDateString(ts)}
                                </span>
                            {/each}
                            {#if selectedDates.length === 0}
                                <p class="text-[10px] text-slate-600 font-black italic uppercase py-2">Select dates from the left</p>
                            {/if}
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        class="btn btn-lg w-full bg-blue-600 hover:bg-blue-700 text-white border-none rounded-2xl font-black uppercase shadow-xl transition-all h-16 disabled:opacity-30" 
                        disabled={selectedDates.length === 0 || isSubmitting}
                    >
                        {#if isSubmitting}
                            <span class="loading loading-spinner loading-sm"></span>
                        {:else}
                            Send Request <Icon icon="mdi:send" class="w-5 h-5 ml-2" />
                        {/if}
                    </button>
                </form>
            </div>
        </div>
    </div>

    <!-- 📜 History Table -->
    <div class="space-y-8 pt-20">
        <div class="flex items-center justify-between">
            <h3 class="text-2xl md:text-4xl font-black tracking-tighter flex items-end gap-3 uppercase italic text-slate-900 border-l-8 border-slate-900 pl-6">
                Request Ledger
                <span class="text-xs opacity-40 font-bold not-italic">최근 신청 이력 현황</span>
            </h3>
        </div>

        {#if data.dayoff_list && data.dayoff_list.length > 0}
            <div class="bg-white border-2 border-slate-900 rounded-[3rem] shadow-2xl overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="table w-full">
                        <thead class="bg-slate-900 text-white uppercase text-[10px] tracking-[0.2em] font-black">
                            <tr>
                                <th class="py-6 px-10">Application Date</th>
                                <th>Category</th>
                                <th>Process Status</th>
                                <th>Memo Description</th>
                                <th class="text-right px-10">Action</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 italic font-medium text-slate-700">
                            {#each data.dayoff_list as d (d.id)}
                                <tr class="hover:bg-slate-50 transition-colors group">
                                    <td class="py-6 px-10">
                                        <div class="flex items-center gap-3">
                                            <Icon icon="mdi:calendar-month-outline" class="w-5 h-5 text-slate-300" />
                                            <span class="font-black text-slate-900 text-lg tracking-tighter not-italic">{d.date}</span>
                                        </div>
                                    </td>
                                    <td>
                                        <span class="px-3 py-1 rounded-full text-[10px] font-black not-italic border-2 border-slate-100 bg-white">
                                            {getTypeLabel(d.type)}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="px-3 py-1 rounded-lg text-[10px] font-black tracking-tighter border-2 not-italic {getBadgeClass(d.status)}">
                                            {d.status}
                                        </span>
                                    </td>
                                    <td class="max-w-[150px] truncate opacity-40 text-xs">{d.memo || "-"}</td>
                                    <td class="text-right px-10">
                                        {#if d.status === 'REQUESTED'}
                                            <form method="post" action="?/delete" use:enhance class="inline">
                                                <input type="hidden" name="dayoff_id" value={d.id} />
                                                <button 
                                                    type="submit" 
                                                    class="btn btn-ghost btn-sm text-rose-500 font-black uppercase hover:bg-rose-50 hover:border-rose-100 rounded-xl"
                                                    onclick={(/** @type {any} */ e) => { if (!confirm("신청을 취소하시겠습니까?")) e.preventDefault(); }}
                                                >
                                                    Cancel Request
                                                </button>
                                            </form>
                                        {:else}
                                            <span class="text-[10px] font-black text-slate-200 uppercase tracking-widest border border-slate-100 px-3 py-1 rounded-md">Locked</span>
                                        {/if}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        {:else}
            <div class="py-32 text-center border-4 border-slate-100 border-dashed rounded-[4rem]">
                 <Icon icon="mdi:database-off-outline" class="w-20 h-20 mx-auto text-slate-200 mb-6" />
                 <p class="text-2xl font-black text-slate-300 italic uppercase">Records Not Found</p>
                 <p class="text-xs font-bold text-slate-400 mt-2">최근 신청한 결근계 내역이 없습니다.</p>
            </div>
        {/if}
    </div>
</div>

<style>
    .animate-fade-in {
        animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
        background: transparent;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
        background: #334155;
        border-radius: 10px;
    }
</style>
