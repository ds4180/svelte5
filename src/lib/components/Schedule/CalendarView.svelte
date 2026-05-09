<script>
    /**
     * @file CalendarView.svelte
     * @description [v1.0] 일정 관리를 위한 프리미엄 캘린더 뷰
     */
    import Icon from '@iconify/svelte';

    let { schedules = [], onDateClick = () => {}, onScheduleClick = () => {} } = $props();

    let currentDate = $state(new Date());
    let viewMode = $state('month'); // month, week, day

    const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];

    // 캘린더 날짜 계산
    const calendarDays = $derived.by(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        const startDay = firstDay.getDay(); // 0 (Sun) to 6 (Sat)
        const totalDays = lastDay.getDate();
        
        const prevMonthLastDay = new Date(year, month, 0).getDate();
        
        let days = [];
        
        // 이전 달 날짜 채우기
        for (let i = startDay - 1; i >= 0; i--) {
            days.push({
                date: new Date(year, month - 1, prevMonthLastDay - i),
                isCurrentMonth: false
            });
        }
        
        // 이번 달 날짜 채우기
        for (let i = 1; i <= totalDays; i++) {
            days.push({
                date: new Date(year, month, i),
                isCurrentMonth: true
            });
        }
        
        // 다음 달 날짜 채우기
        const remainingDays = 42 - days.length; // 6주 고정
        for (let i = 1; i <= remainingDays; i++) {
            days.push({
                date: new Date(year, month + 1, i),
                isCurrentMonth: false
            });
        }
        
        return days;
    });

    function nextMonth() {
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
    }

    function prevMonth() {
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
    }

    function isToday(date) {
        const today = new Date();
        return date.getDate() === today.getDate() &&
               date.getMonth() === today.getMonth() &&
               date.getFullYear() === today.getFullYear();
    }
</script>

<div class="flex flex-col min-h-max bg-base-100 rounded-3xl shadow-2xl border border-base-200 overflow-visible">
    <!-- Calendar Header -->
    <div class="flex flex-wrap items-center justify-between p-6 bg-gradient-to-r from-primary/10 to-secondary/10 border-b border-base-200">
        <div class="flex items-center gap-4">
            <h2 class="text-2xl font-black tracking-tight text-base-content">
                {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
            </h2>
            <div class="join shadow-sm border border-base-300">
                <button class="btn btn-sm join-item bg-base-100" onclick={prevMonth}>
                    <Icon icon="lucide:chevron-left" />
                </button>
                <button class="btn btn-sm join-item bg-base-100 font-bold" onclick={() => currentDate = new Date()}>오늘</button>
                <button class="btn btn-sm join-item bg-base-100" onclick={nextMonth}>
                    <Icon icon="lucide:chevron-right" />
                </button>
            </div>
        </div>

        <div class="flex items-center gap-2 mt-4 sm:mt-0">
            <div class="tabs tabs-box bg-base-200/50 p-1 rounded-xl">
                <button class="tab tab-sm {viewMode === 'month' ? 'tab-active btn-primary rounded-lg text-white' : ''}" onclick={() => viewMode = 'month'}>월</button>
                <button class="tab tab-sm {viewMode === 'week' ? 'tab-active btn-primary rounded-lg text-white' : ''}" onclick={() => viewMode = 'week'}>주</button>
                <button class="tab tab-sm {viewMode === 'day' ? 'tab-active btn-primary rounded-lg text-white' : ''}" onclick={() => viewMode = 'day'}>일</button>
            </div>
            <button class="btn btn-primary btn-sm rounded-xl gap-2 shadow-lg shadow-primary/20" onclick={() => onDateClick(new Date())}>
                <Icon icon="lucide:plus" class="text-lg" />
                <span class="hidden sm:inline">일정 추가</span>
            </button>
        </div>
    </div>

    <!-- Weekdays Header -->
    <div class="grid grid-cols-7 bg-base-200/30 border-b border-base-200">
        {#each daysOfWeek as day, i}
            <div class="py-4 text-center text-sm md:text-base font-black uppercase tracking-widest {i === 0 ? 'text-error' : i === 6 ? 'text-info' : 'text-base-content/60'}">
                {day}
            </div>
        {/each}
    </div>

    <!-- Calendar Grid: 고정 높이 대신 내용에 따라 확장되도록 설정 -->
    <div class="grid grid-cols-7 grid-rows-6 divide-x divide-y divide-base-200 bg-base-100">
        {#each calendarDays as day}
            {@const dayHolidays = schedules.filter(s => s.date.toDateString() === day.date.toDateString() && s.category === 'HOLIDAY')}
            <div 
                class="p-4 transition-colors hover:bg-base-200/40 cursor-pointer group flex flex-col gap-3
                       {day.isCurrentMonth ? 'bg-base-100' : 'bg-base-200/10 text-base-content/20'} 
                       {isToday(day.date) ? 'ring-2 ring-inset ring-primary' : ''}"
                onclick={() => onDateClick(day.date)}
            >
                <div class="flex justify-between items-start flex-shrink-0">
                    <div class="flex flex-col items-center gap-1">
                        <!-- 날짜 숫자: 모바일 대응을 위해 반응형 크기 적용 -->
                        <span 
                            class="inline-flex items-center justify-center w-10 h-10 md:w-12 md:h-12 rounded-xl text-xl md:text-2xl font-black transition-all flex-shrink-0
                                   {isToday(day.date) ? 'bg-slate-900 shadow-xl scale-105' : ''}"
                            style="color: {isToday(day.date) ? '#ffffff' : (day.date.getDay() === 0 || dayHolidays.length > 0) ? '#ff0000' : day.date.getDay() === 6 ? '#0000ff' : '#1e293b'};"
                        >
                            {day.date.getDate()}
                        </span>
                        
                        {#if isToday(day.date)}
                            <span class="text-[10px] font-black uppercase tracking-tighter text-slate-900">Today</span>
                        {/if}
                    </div>
                    
                    <div class="flex flex-col items-end gap-1 flex-1 min-w-0">
                        <!-- Holiday Text display -->
                        {#each dayHolidays as holiday}
                            <span class="text-xs font-black text-red-600 truncate w-full text-right bg-red-50 px-1 rounded">
                                {holiday.title}
                            </span>
                        {/each}
                    </div>
                </div>

                <!-- Schedule List inside Day: 최대 높이 설정 및 스크롤로 날짜 영역 보호 -->
                <div class="flex flex-col gap-1 mt-1 overflow-y-auto max-h-[100px] custom-scrollbar-mini">
                    {#each schedules.filter(s => s.date.toDateString() === day.date.toDateString() && s.category !== 'HOLIDAY') as schedule}
                        {@const colorClass = 
                            schedule.category === 'PERSONAL' ? 'bg-success/10 text-success border-success' :
                            schedule.category === 'ATTENDANCE' ? 'bg-info/10 text-info border-info' :
                            schedule.category === 'DAYOFF' ? 'bg-warning/10 text-warning border-warning' :
                            schedule.category === 'GLOBAL' ? 'bg-primary/10 text-primary border-primary' :
                            'bg-base-300 text-base-content border-base-content'}
                        
                        <button 
                            class="text-[10px] sm:text-xs p-1.5 rounded-lg truncate text-left transition-transform hover:scale-[1.02] active:scale-95 shadow-sm border-l-4 {colorClass}"
                            onclick={(e) => { e.stopPropagation(); onScheduleClick(schedule); }}
                        >
                            <div class="flex items-center justify-between gap-1">
                                <div class="flex items-center gap-1 truncate">
                                    {#if schedule.is_dday}
                                        <span class="bg-black text-white px-1.5 py-0.5 rounded text-[8px] font-black italic shrink-0">
                                            {(() => {
                                                const diff = new Date(schedule.date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
                                                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                                return days === 0 ? "D-Day" : days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
                                            })()}
                                        </span>
                                    {/if}
                                    <span class="font-black truncate">{schedule.title}</span>
                                </div>
                                {#if schedule.importance > 0}
                                    <div class="flex gap-0.5">
                                        {#each Array(schedule.importance) as _}
                                            <div class="w-1 h-1 rounded-full bg-current opacity-60"></div>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        </button>
                    {/each}
                </div>
            </div>
        {/each}
    </div>
</div>
