<script>
    /**
     * @file Calendar.svelte (오피스 고대비 고해상도 버전)
     * @description 요일 대형화, 7행 확장(이전달 context 강화), 컴팩트 디자인 고도화
     */
    import { createEventDispatcher, onMount } from 'svelte';
    const dispatch = createEventDispatcher();

    let { 
        year = $bindable(null), 
        month = $bindable(null), 
        selectedDates = $bindable([]) 
    } = $props();

    onMount(() => {
        if (year === null) year = new Date().getFullYear();
        if (month === null) month = new Date().getMonth();
    });

    const days = ['일', '월', '화', '수', '목', '금', '토'];

    /**
     * @function calendarDays
     * @description 7행(49일)을 생성하여 이전 달 한 줄이 항상 더 보이게 조정
     */
    let calendarDays = $derived.by(() => {
        if (year === null || month === null) return [];
        
        const firstDay = new Date(year, month, 1).getDay();
        const lastDate = new Date(year, month + 1, 0).getDate();
        const prevLastDate = new Date(year, month, 0).getDate();

        const result = [];
        
        // 📌 이전 달 데이터 추가 (항상 "이전 한 줄"을 더 확보하기 위해 firstDay + 7 기반)
        const offset = (firstDay === 0) ? 7 : firstDay + 7; 
        
        for (let i = offset - 1; i >= 0; i--) {
            const date = new Date(year, month, 0 - i); // 이전 달 날짜 계산
            result.push({ 
                day: date.getDate(), 
                current: false, 
                timestamp: date.setHours(0,0,0,0) 
            });
        }

        // 현재 달
        for (let i = 1; i <= lastDate; i++) {
            const date = new Date(year, month, i);
            result.push({ day: i, current: true, timestamp: date.setHours(0,0,0,0) });
        }

        // 📌 총 49일(7줄)을 채움
        const remain = 49 - result.length;
        for (let i = 1; i <= remain; i++) {
            const date = new Date(year, month + 1, i);
            result.push({ 
                day: i, 
                current: false, 
                timestamp: date.setHours(0,0,0,0) 
            });
        }
        return result;
    });

    function navigate(offset) {
        if (year === null || month === null) return;
        let newDate = new Date(year, month + offset, 1);
        year = newDate.getFullYear();
        month = newDate.getMonth();
        dispatch('navigate', { year, month });
    }

    function handleDayClick(day) {
        dispatch('dayclick', { timestamp: day.timestamp });
    }

    function isSelected(timestamp) { return selectedDates.includes(timestamp); }
    
    // 🛡️ [하이드레이션 방어] isToday도 브라우저에서만 실시간 체크하도록 유도하거나 null 가드
    function isToday(timestamp) {
        const today = new Date().setHours(0,0,0,0);
        return today === timestamp;
    }
</script>

<div class="bg-white border-2 border-black p-8 rounded-none shadow-[20px_20px_0_rgba(0,0,0,0.05)]">
    
    <!-- Header: 고대비 오피스 디자인 -->
    <div class="flex justify-between items-end mb-10 border-b-2 border-black pb-8">
        <div class="flex flex-col gap-1">
            <span class="text-[10px] font-black tracking-[0.4em] opacity-30 uppercase leading-none italic">Management Ledger</span>
            <div class="flex items-baseline gap-4">
                <h2 class="text-6xl font-black tracking-tighter text-black">{year ?? '----'}</h2>
                <span class="text-4xl font-bold opacity-20">/</span>
                <h2 class="text-6xl font-black tracking-tighter text-blue-600">{(month !== null) ? String(month + 1).padStart(2, '0') : '--'}</h2>
            </div>
        </div>
        
        <div class="flex border-2 border-black h-14 overflow-hidden bg-black">
            <button class="px-8 font-black text-white hover:bg-white hover:text-black transition-all border-r border-black uppercase text-xs" onclick={() => navigate(-1)}>
                Prev
            </button>
            <button class="px-8 font-black text-white hover:bg-white hover:text-black transition-all uppercase text-xs" onclick={() => navigate(1)}>
                Next
            </button>
        </div>
    </div>

    <!-- Weeks Labels: 📌 요일 크기 강화 -->
    <div class="grid grid-cols-7 gap-px bg-black border-2 border-black mb-px overflow-hidden">
        {#each days as day}
            <div class="py-6 text-center text-xl md:text-2xl font-black uppercase tracking-tighter bg-white text-black
                        {day === '일' ? 'text-red-500 bg-red-50' : ''}
                        {day === '토' ? 'text-blue-500 bg-blue-50' : ''}">
                {day}
            </div>
        {/each}
    </div>

    <!-- Days Grid: 📌 간격 75% 감소 & 7행 확장 모델 -->
    <div class="grid grid-cols-7 gap-px bg-black border-2 border-black p-px">
        {#each calendarDays as d}
            <button 
                class="relative h-16 md:h-18 flex flex-col items-center justify-center transition-all duration-150 bg-white group
                       {d.current ? 'hover:bg-slate-50' : 'opacity-[0.3] grayscale bg-slate-100'} 
                       {isSelected(d.timestamp) ? '!bg-black text-white z-10' : ''}"
                onclick={() => handleDayClick(d)}
            >
                <!-- 📌 Today Indicator: 강렬한 시인성 -->
                {#if isToday(d.timestamp) && !isSelected(d.timestamp)}
                    <div class="absolute inset-0 border-4 border-blue-600 z-[5] pointer-events-none"></div>
                    <div class="absolute top-0 right-0 bg-blue-600 text-[8px] px-1.5 py-0.5 text-white font-black uppercase z-10">Today</div>
                {/if}
                
                <span class="text-2xl font-black tracking-tight {d.current ? '' : 'text-slate-400'}">{d.day}</span>
                
                {#if isSelected(d.timestamp)}
                    <div class="absolute bottom-1.5 w-4 h-0.5 bg-white/40"></div>
                {/if}
            </button>
        {/each}
    </div>
</div>

<style>
    :global(body) { letter-spacing: -0.02em; }
</style>
