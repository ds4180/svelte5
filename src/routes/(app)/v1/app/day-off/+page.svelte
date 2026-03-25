<script>
    /**
     * @file +page.svelte (day-off - 사무소 모델)
     * @description 고대비 블랙&화이트, 1px 선명한 경계선 기반의 휴무 관리 시스템
     */
    import { enhance } from "$app/forms";
    import Calendar from "$lib/components/Calendar.svelte";
    import { formatDateTime, timestampToDateString } from "$lib/utils.js";
    import { alertState } from "$lib/runes/alert.svelte.js";

    let { data, form } = $props();

    // 📌 입력 상태 관리
    let selectedDates = $state([]);
    let selectedType = $state("ANNUAL");
    let memo = $state("");

    // 서버 응답 처리
    $effect(() => {
        if (form?.error) {
            alertState.send(form.error, { level: 2, style: 'error' });
        } else if (form?.success) {
            alertState.send("신청되었습니다.", { level: 1, style: 'success' });
            selectedDates = [];
            memo = "";
        }
    });

    function handleDayClick(event) {
        const clicked = event.detail.timestamp;
        const index = selectedDates.indexOf(clicked);
        if (index > -1) {
            selectedDates = selectedDates.filter(d => d !== clicked);
        } else {
            selectedDates = [...selectedDates, clicked].sort();
        }
    }

    /**
     * @function getTypeStatus
     * @description 휴무 유형 문자열 매핑
     */
    function getTypeStatus(type) {
        const map = { ANNUAL: '연차', SICK: '병가', SPECIAL: '경조사', OFFICIAL: '공가' };
        return map[type] || type;
    }
</script>

<div class="max-w-7xl mx-auto space-y-12 animate-fade-in text-black">
    <!-- 📄 Header Section (고대비 사무용 헤더) -->
    <div class="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b-4 border-black pb-8">
        <div class="space-y-2">
            <span class="text-[9px] font-black tracking-[0.3em] opacity-40 uppercase">Personnel System Engine</span>
            <h1 class="text-5xl font-black tracking-tighter uppercase italic">Day-Off Request</h1>
            <p class="text-sm font-bold opacity-60">근무자의 휴무 신청과 승인 상태를 통합 관리합니다.</p>
        </div>
        <div class="flex flex-col items-end gap-1">
           <span class="text-[10px] font-black opacity-30 uppercase">Operational Stats</span>
           <div class="text-3xl font-black tracking-tighter">TOTAL {data.total} <span class="text-xs opacity-50">RECORDED</span></div>
        </div>
    </div>

    <!-- 📊 Main Content Layout (1px Border Grid) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        <!-- Left: Calendar Area -->
        <div class="lg:col-span-12 xl:col-span-8">
            <Calendar 
                selectedDates={selectedDates}
                on:dayclick={handleDayClick}
            />
        </div>

        <!-- Right: Request Input Card (1px Border) -->
        <div class="lg:col-span-12 xl:col-span-4 space-y-6">
            <div class="border border-black bg-white p-8 rounded-none">
                <h3 class="text-2xl font-black tracking-tight mb-8 uppercase border-b border-black pb-4">New Application</h3>
                
                <form method="post" action="?/create" use:enhance class="space-y-10">
                    <input type="hidden" name="dates" value={JSON.stringify(selectedDates.map(ts => timestampToDateString(ts)))} />
                    
                    <!-- 유형 선택 (고대비 사무용 Radio Group) -->
                    <div class="space-y-4">
                        <label class="text-[10px] font-black uppercase tracking-widest leading-none opacity-40 block">Type of absence</label>
                        <div class="grid grid-cols-2 gap-px bg-black border border-black overflow-hidden">
                            {#each ['ANNUAL', 'SICK', 'SPECIAL', 'OFFICIAL'] as type}
                                <label class="h-14 flex items-center justify-center cursor-pointer transition-all bg-white font-black text-xs
                                             {selectedType === type ? '!bg-black text-white' : 'hover:bg-gray-50'}">
                                    <input type="radio" name="type" value={type} bind:group={selectedType} class="hidden" />
                                    {getTypeStatus(type)}
                                </label>
                            {/each}
                        </div>
                    </div>

                    <!-- 메모 입력 (사무용 필드) -->
                    <div class="space-y-4">
                        <label class="text-[10px] font-black uppercase tracking-widest leading-none opacity-40 block" for="memo">Reference Memo</label>
                        <textarea 
                            class="w-full border border-black p-4 text-xs font-bold focus:bg-gray-50 focus:outline-none transition-all placeholder:italic" 
                            name="memo" 
                            id="memo" 
                            rows="4"
                            placeholder="상세 내용을 입력하세요 (결재 권한자 참고용)"
                            bind:value={memo}
                        ></textarea>
                    </div>

                    <!-- 선택 확인 영역 (고대비 블랙 리스트) -->
                    <div class="bg-gray-50 border border-black/5 p-6">
                        <div class="flex justify-between items-center mb-4 border-b border-black pb-2">
                            <span class="text-[10px] font-black uppercase tracking-widest">Total Selection</span>
                            <span class="font-black text-lg">{selectedDates.length} Days</span>
                        </div>
                        <div class="flex flex-wrap gap-1 mt-4">
                            {#each selectedDates as ts}
                                <span class="bg-black text-white text-[9px] px-2 py-1 font-bold">
                                    {timestampToDateString(ts)}
                                </span>
                            {/each}
                            {#if selectedDates.length === 0}
                                <p class="text-[10px] opacity-20 font-black italic uppercase">Select dates from calendar</p>
                            {/if}
                        </div>
                    </div>

                    <button type="submit" class="btn btn-black w-full h-16 rounded-none font-black text-lg uppercase tracking-widest shadow-none border border-black hover:bg-white hover:text-black transition-all" 
                            disabled={selectedDates.length === 0}>
                        Send Request
                    </button>
                </form>
            </div>
        </div>
    </div>

    <!-- 📜 History Section (Black Table Design) -->
    <div class="space-y-8 pt-20 pb-40">
        <h3 class="text-3xl font-black tracking-tighter flex items-end gap-3 uppercase italic">
            History Ledger
            <span class="text-xs opacity-30 font-bold not-italic">근태 신청 이력 일람</span>
        </h3>
        
        {#if data.dayoff_list && data.dayoff_list.length > 0}
            <div class="overflow-x-auto border border-black bg-white">
                <table class="table w-full text-xs font-bold border-collapse">
                    <thead class="bg-black text-white">
                        <tr class="tracking-widest uppercase border-none text-[9px]">
                            <th class="py-6 px-8 text-left">Period</th>
                            <th class="py-6">Type</th>
                            <th class="py-6">Status</th>
                            <th class="py-6 hidden md:table-cell">Memo Description</th>
                            <th class="py-6 hidden lg:table-cell">Registered</th>
                            <th class="py-6 text-right px-8">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-black/5">
                        {#each data.dayoff_list as dayoff}
                            <tr class="hover:bg-gray-50 transition-colors border-none group">
                                <td class="py-6 px-8 text-[13px] font-black tracking-tighter">{dayoff.date}</td>
                                <td class="py-6">
                                    <span class="border border-black px-3 py-1 text-[10px] font-black">
                                        {getTypeStatus(dayoff.type)}
                                    </span>
                                </td>
                                <td class="py-6">
                                    <span class="font-black italic uppercase text-[10px] tracking-wider {dayoff.status === 'APPROVED' ? 'text-blue-600' : (dayoff.status === 'REJECTED' ? 'text-red-500' : '')}">
                                        {dayoff.status}
                                    </span>
                                </td>
                                <td class="py-6 opacity-40 hidden md:table-cell text-xs italic">{dayoff.memo || "-"}</td>
                                <td class="py-6 opacity-20 text-[9px] hidden lg:table-cell">
                                    {console.log('Dayoff Date:', dayoff.create_date)}
                                    {formatDateTime(dayoff.create_date)}
                                </td>
                                <td class="py-6 text-right px-8">
                                    <form method="post" action="?/delete" use:enhance class="inline">
                                        <input type="hidden" name="dayoff_id" value={dayoff.id} />
                                        <button 
                                            type="submit" 
                                            class="btn btn-ghost btn-xs text-black font-black uppercase border border-transparent hover:border-black active:bg-black active:text-white transition-all"
                                            onclick={(e) => { if (!confirm("승인 대기 중인 요청을 취소하시겠습니까?")) e.preventDefault(); }}
                                        >
                                            Delete
                                        </button>
                                    </form>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {:else}
            <div class="p-32 text-center border-2 border-black border-dashed opacity-10 grayscale">
                <p class="text-xl font-black italic tracking-widest uppercase leading-loose">No Records Found / Ledger Empty</p>
                <p class="text-[10px] font-bold mt-2">등록된 근태 신청 데이터가 존재하지 않습니다.</p>
            </div>
        {/if}
    </div>
</div>

<style>
    .animate-fade-in {
        animation: fadeIn 0.4s ease-out;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(5px); }
        to { opacity: 1; transform: translateY(0); }
    }
    :global(.btn-black) {
        background-color: #000;
        color: #fff;
    }
    :global(.btn-black:hover) {
        background-color: #fff;
        color: #000;
    }
</style>
