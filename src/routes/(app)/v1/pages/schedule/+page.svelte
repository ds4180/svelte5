<script>
    /**
     * @file +page.svelte
     * @description [v1.0] 일정 관리 통합 페이지 (랭킹별 분기 적용)
     * @route /v1/pages/schedule
     */
    import Icon from '@iconify/svelte';
    import CalendarView from '$lib/components/Schedule/CalendarView.svelte';
    import RecurrenceEditor from '$lib/components/Schedule/RecurrenceEditor.svelte';

    // 가상 데이터 및 상태 (추후 API 연동)
    let userRank = $state(4); // 테스트용: 4이상은 관리자 기능을 보여줌
    let schedules = $state([
        { id: 1, date: new Date(), title: '석가탄신일', category: 'HOLIDAY', importance: 0, is_dday: false },
        { id: 2, date: new Date(), title: '개인 운동', category: 'PERSONAL', importance: 2, is_dday: false },
        { id: 3, date: new Date(), title: '프로젝트 마감', category: 'GLOBAL', importance: 5, is_dday: true },
    ]);

    let showAddModal = $state(false);
    let newSchedule = $state({
        title: '',
        color: '#3b82f6', // 기본 파랑
        content: '',
        start_at: '',
        end_at: '',
        is_all_day: false,
        is_dday: false,
        importance: 1,
        category: 'PERSONAL',
        recurrence: { frequency: 'NONE', interval: 1, days: [] }
    });

    let timeMode = $state('timed'); // 'all-day' or 'timed'

    function openAddModal(date) {
        newSchedule.start_at = date.toISOString().slice(0, 16);
        newSchedule.end_at = date.toISOString().slice(0, 16);
        showAddModal = true;
    }

    function saveSchedule() {
        // TODO: API POST /v1/schedule
        console.log('Saving...', newSchedule);
        showAddModal = false;
    }
</script>

<div class="flex flex-col min-h-screen gap-12 p-4 lg:p-12 bg-base-200/30 pb-32">
    <!-- Header Section -->
    <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
            <h1 class="text-4xl font-black tracking-tighter text-slate-900">SCHEDULE</h1>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                Integrated Task & Attendance Management
                {#if userRank >= 4}
                    <span class="badge badge-info ml-2 text-[10px] text-white">ADMIN MODE</span>
                {/if}
            </p>
        </div>
    </header>

    <!-- Main Calendar Area -->
    <main class="w-full">
        <CalendarView 
            {schedules} 
            onDateClick={openAddModal}
            onScheduleClick={(s) => console.log('View detail', s)}
        />
    </main>

    <!-- Bottom Feature Blocks (Sequential 3-Tier System) -->
    <div class="flex flex-col gap-10">
        
        <!-- [Tier 1] PERSONAL FOCUS: 모든 사용자 공통 (Rank 0+) -->
        <section class="flex flex-col gap-6">
            <div class="flex items-center gap-3">
                <div class="w-1.5 h-6 bg-success rounded-full"></div>
                <h3 class="text-xl font-black tracking-tight italic uppercase">Tier 1: Personal Focus</h3>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Today's Focus -->
                <div class="lg:col-span-2 bg-white border border-slate-200 p-8 rounded-3xl shadow-sm hover:shadow-md transition-shadow">
                    <div class="flex items-center justify-between mb-8">
                        <div class="flex items-center gap-4">
                            <div class="p-3 bg-success/10 rounded-2xl">
                                <Icon icon="lucide:sparkles" class="text-2xl text-success" />
                            </div>
                            <div>
                                <h4 class="text-lg font-black tracking-tight">오늘의 집중 일정</h4>
                                <p class="text-xs font-bold text-slate-400">당신을 위한 맞춤 요약</p>
                            </div>
                        </div>
                        <button class="btn btn-ghost btn-sm text-xs font-bold">전체보기</button>
                    </div>
                    <div class="flex flex-col gap-3">
                        {#each schedules.filter(s => s.category === 'PERSONAL').slice(0, 2) as s}
                            <div class="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                                <div class="flex items-center gap-4">
                                    <div class="w-2 h-2 rounded-full bg-success"></div>
                                    <span class="font-black text-slate-700">{s.title}</span>
                                </div>
                                <span class="text-[10px] font-black text-slate-400">14:00 - 15:30</span>
                            </div>
                        {:else}
                            <div class="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <p class="text-sm font-bold text-slate-400">오늘 예정된 개인 일정이 없습니다.</p>
                            </div>
                        {/each}
                    </div>
                </div>

                <!-- Active D-Days -->
                <div class="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl flex flex-col justify-between group overflow-hidden relative">
                    <div class="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Icon icon="lucide:flag" class="text-9xl" />
                    </div>
                    <div class="relative z-10">
                        <div class="flex items-center justify-between mb-8">
                            <h4 class="text-lg font-black tracking-tight italic">ACTIVE D-DAY</h4>
                            <Icon icon="lucide:arrow-up-right" class="text-xl opacity-40" />
                        </div>
                        <div class="flex flex-col gap-6">
                            {#each schedules.filter(s => s.is_dday).slice(0, 1) as s}
                                <div>
                                    <p class="text-xs font-bold opacity-40 mb-1 uppercase tracking-widest">{s.title}</p>
                                    <p class="text-5xl font-black italic">
                                        {(() => {
                                            const diff = new Date(s.date).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
                                            const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                            return days === 0 ? "D-Day" : days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
                                        })()}
                                    </p>
                                </div>
                            {:else}
                                <p class="text-xs font-bold opacity-40">활성화된 디데이가 없습니다.</p>
                            {/each}
                        </div>
                    </div>
                    <button class="btn btn-primary btn-sm w-full mt-8 rounded-xl font-black">디데이 전체 관리</button>
                </div>
            </div>
        </section>

        <!-- [Tier 2] TEAM INSIGHTS: 중간 관리자 이상 (Rank 2+) -->
        {#if userRank >= 2}
            <section class="flex flex-col gap-6">
                <div class="flex items-center gap-3">
                    <div class="w-1.5 h-6 bg-primary rounded-full"></div>
                    <h3 class="text-xl font-black tracking-tight italic uppercase">Tier 2: Team Insights</h3>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div class="col-span-1 lg:col-span-3 bg-white border border-slate-200 p-8 rounded-3xl shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-8">
                        <div class="flex flex-col gap-2">
                            <h5 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Team Activity</h5>
                            <div class="flex items-end gap-2">
                                <span class="text-3xl font-black">18</span>
                                <span class="text-xs font-bold text-success mb-1">↑ 12%</span>
                            </div>
                            <p class="text-[10px] font-medium text-slate-500">전주 대비 활동량 증가</p>
                        </div>
                        <div class="flex flex-col gap-2 border-x border-slate-100 px-8">
                            <h5 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Collaborators</h5>
                            <div class="avatar-group -space-x-4 rtl:space-x-reverse mt-2">
                                <div class="avatar">
                                    <div class="w-10 bg-slate-200 rounded-full"></div>
                                </div>
                                <div class="avatar">
                                    <div class="w-10 bg-slate-300 rounded-full"></div>
                                </div>
                                <div class="avatar">
                                    <div class="w-10 bg-slate-400 rounded-full"></div>
                                </div>
                                <div class="avatar placeholder">
                                    <div class="bg-neutral text-neutral-content w-10 rounded-full">
                                        <span class="text-xs">+5</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-col gap-2">
                            <h5 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Urgent Issues</h5>
                            <p class="text-3xl font-black text-error">2</p>
                            <p class="text-[10px] font-medium text-slate-500">즉시 확인이 필요한 이슈</p>
                        </div>
                    </div>
                    <div class="bg-gradient-to-br from-primary to-primary-focus p-8 rounded-3xl text-white flex flex-col justify-center gap-2">
                        <Icon icon="lucide:users" class="text-3xl mb-2" />
                        <p class="text-sm font-black text-white">Team Status</p>
                        <p class="text-xs font-medium opacity-70">팀원들의 현재 상태를 확인하세요.</p>
                    </div>
                </div>
            </section>
        {/if}

        <!-- [Tier 3] ADMIN OVERSIGHT: 최고 관리자 (Rank 4+) -->
        {#if userRank >= 4}
            <section class="flex flex-col gap-6">
                <div class="flex items-center gap-3">
                    <div class="w-1.5 h-6 bg-info rounded-full"></div>
                    <h3 class="text-xl font-black tracking-tight italic uppercase">Tier 3: Admin Oversight</h3>
                </div>
                <div class="bg-white border border-slate-200 p-10 rounded-[40px] shadow-sm relative overflow-hidden">
                    <div class="absolute right-0 top-0 w-1/3 h-full bg-slate-50/50 -skew-x-12 translate-x-20"></div>
                    <div class="relative z-10 flex flex-col lg:flex-row gap-12 items-start lg:items-center">
                        <div class="flex-1">
                            <div class="flex items-center gap-4 mb-6">
                                <div class="p-4 bg-info/10 rounded-2xl text-info">
                                    <Icon icon="lucide:shield-check" class="text-3xl" />
                                </div>
                                <div>
                                    <h4 class="text-2xl font-black tracking-tighter uppercase">Enterprise Control</h4>
                                    <p class="text-sm font-bold text-slate-400">전사 일정 및 자원 관리 시스템</p>
                                </div>
                            </div>
                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-8">
                                <div class="flex flex-col">
                                    <span class="text-[10px] font-black text-slate-400 uppercase">Attendance</span>
                                    <span class="text-2xl font-black">94.2%</span>
                                </div>
                                <div class="flex flex-col">
                                    <span class="text-[10px] font-black text-slate-400 uppercase">Global Events</span>
                                    <span class="text-2xl font-black text-primary">12</span>
                                </div>
                                <div class="flex flex-col">
                                    <span class="text-[10px] font-black text-slate-400 uppercase">Pending Requests</span>
                                    <span class="text-2xl font-black text-warning">7</span>
                                </div>
                                <div class="flex flex-col">
                                    <span class="text-[10px] font-black text-slate-400 uppercase">System Health</span>
                                    <span class="text-2xl font-black text-success">Optimal</span>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-col gap-3 w-full lg:w-auto">
                            <button class="btn btn-neutral btn-lg rounded-2xl gap-2 font-black">
                                <Icon icon="lucide:layout-dashboard" />
                                통계 대시보드
                            </button>
                            <button class="btn btn-outline btn-lg rounded-2xl gap-2 font-black">
                                <Icon icon="lucide:settings-2" />
                                시스템 설정
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        {/if}
    </div>
</div>

<!-- Add/Edit Modal (Updated) -->
{#if showAddModal}
    <div class="modal modal-open">
        <div class="modal-box max-w-3xl p-10 rounded-[40px] bg-base-100 border border-base-200 shadow-2xl">
            <!-- Header -->
            <div class="flex justify-between items-center mb-10">
                <div>
                    <h3 class="text-4xl font-black tracking-tighter italic">NEW EVENT</h3>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Create your premium schedule</p>
                </div>
                <button class="btn btn-circle btn-ghost bg-slate-50" onclick={() => showAddModal = false}>
                    <Icon icon="lucide:x" class="text-2xl" />
                </button>
            </div>

            <div class="flex flex-col gap-10">
                <!-- Section 1: Basic Info (Title & Color) -->
                <div class="flex flex-col gap-4">
                    <label class="text-[10px] font-black uppercase opacity-40 tracking-widest">Event Identity</label>
                    <div class="flex flex-col md:flex-row gap-6 items-center">
                        <div class="flex-1 w-full">
                            <input 
                                type="text" 
                                class="input input-ghost w-full text-4xl font-black placeholder:opacity-20 border-b-4 focus:bg-transparent px-0 rounded-none transition-all outline-none" 
                                placeholder="제목을 입력하세요" 
                                bind:value={newSchedule.title}
                                style="color: {newSchedule.color}; border-color: {newSchedule.color}40;"
                            />
                        </div>
                        <!-- Color Swatches -->
                        <div class="flex gap-2 p-2.5 bg-slate-50 rounded-2xl border border-slate-100 shrink-0">
                            {#each ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#0f172a'] as color}
                                <button 
                                    class="w-8 h-8 rounded-full transition-all hover:scale-125 {newSchedule.color === color ? 'ring-4 ring-offset-2 ring-slate-200 scale-110' : 'opacity-60 hover:opacity-100'}"
                                    style="background-color: {color};"
                                    onclick={() => newSchedule.color = color}
                                ></button>
                            {/each}
                        </div>
                    </div>
                </div>

                <!-- Section 2: Time Configuration & Category -->
                <div class="flex flex-col gap-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-8 items-end">
                        <div class="flex flex-col gap-4">
                            <label class="text-[10px] font-black uppercase opacity-40 tracking-widest">Time Mode</label>
                            <div class="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
                                <button 
                                    class="btn btn-sm border-none rounded-xl px-8 {timeMode === 'all-day' ? 'bg-white shadow-md font-black text-slate-900' : 'bg-transparent opacity-50 font-bold'}"
                                    onclick={() => { timeMode = 'all-day'; newSchedule.is_all_day = true; }}
                                >종일</button>
                                <button 
                                    class="btn btn-sm border-none rounded-xl px-8 {timeMode === 'timed' ? 'bg-white shadow-md font-black text-slate-900' : 'bg-transparent opacity-50 font-bold'}"
                                    onclick={() => { timeMode = 'timed'; newSchedule.is_all_day = false; }}
                                >시간 지정</button>
                            </div>
                        </div>
                        <div class="form-control">
                            <label class="label font-black text-[10px] uppercase opacity-40"><span class="label-text">Category</span></label>
                            <select class="select select-bordered bg-slate-50 border-slate-200 font-bold rounded-xl" bind:value={newSchedule.category}>
                                <option value="PERSONAL">🙋 개인 일정</option>
                                <option value="ATTENDANCE">💼 근태 기록</option>
                                <option value="DAYOFF">☕ 휴무 신청</option>
                                {#if userRank >= 4}
                                    <option value="GLOBAL">📢 전사 공지</option>
                                    <option value="HOLIDAY">🚩 공휴일 설정</option>
                                {/if}
                            </select>
                        </div>
                    </div>

                    <!-- Date/Time Inputs -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-slate-50 rounded-[30px] border border-slate-100">
                        <div class="form-control">
                            <label class="label font-black text-[10px] uppercase opacity-40"><span class="label-text">Start {timeMode === 'all-day' ? 'Date' : 'Time'}</span></label>
                            <input 
                                type={timeMode === 'all-day' ? 'date' : 'datetime-local'} 
                                class="input input-bordered bg-white border-slate-200 font-bold rounded-xl" 
                                bind:value={newSchedule.start_at} 
                            />
                        </div>
                        <div class="form-control">
                            <label class="label font-black text-[10px] uppercase opacity-40"><span class="label-text">End {timeMode === 'all-day' ? 'Date' : 'Time'}</span></label>
                            <input 
                                type={timeMode === 'all-day' ? 'date' : 'datetime-local'} 
                                class="input input-bordered bg-white border-slate-200 font-bold rounded-xl" 
                                bind:value={newSchedule.end_at} 
                            />
                        </div>
                    </div>
                </div>

                <!-- Section 3: Importance & D-Day -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div class="form-control">
                        <label class="label font-black text-[10px] uppercase opacity-40 mb-2"><span class="label-text">Importance</span></label>
                        <div class="rating rating-md gap-1">
                            {#each [1, 2, 3, 4, 5] as i}
                                <input type="radio" name="importance" class="mask mask-star-2 bg-warning" checked={newSchedule.importance === i} onclick={() => newSchedule.importance = i} />
                            {/each}
                        </div>
                    </div>
                    <div class="p-6 bg-primary/5 rounded-[25px] border border-primary/10 flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="p-3 bg-primary/10 rounded-xl">
                                <Icon icon="lucide:flag" class="text-xl text-primary" />
                            </div>
                            <div>
                                <h4 class="font-black text-sm">D-Day Mode</h4>
                                <p class="text-[10px] font-bold opacity-40">메인 화면 카운트다운</p>
                            </div>
                        </div>
                        <input type="checkbox" class="toggle toggle-primary toggle-md" bind:checked={newSchedule.is_dday} />
                    </div>
                </div>

                <!-- Preview Area (Conditional) -->
                {#if newSchedule.is_dday && newSchedule.start_at}
                    <div class="bg-slate-900 text-white p-6 rounded-[30px] flex items-center justify-between shadow-xl shadow-slate-200">
                        <div class="flex items-center gap-4">
                            <Icon icon="lucide:zap" class="text-2xl text-yellow-400" />
                            <span class="text-[10px] font-black opacity-40 uppercase tracking-widest">Countdown Preview</span>
                        </div>
                        <span class="text-3xl font-black italic">
                            {(() => {
                                const diff = new Date(newSchedule.start_at).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
                                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                                return days === 0 ? "D-Day" : days > 0 ? `D-${days}` : `D+${Math.abs(days)}`;
                            })()}
                        </span>
                    </div>
                {/if}

                <!-- Recurrence -->
                <div class="border-t border-base-200 pt-8">
                    <h4 class="text-xs font-black uppercase opacity-40 mb-4">반복 설정 (Recurrence)</h4>
                    <RecurrenceEditor bind:config={newSchedule.recurrence} />
                </div>

                <div class="modal-action gap-4">
                    <button class="btn btn-ghost rounded-xl font-bold" onclick={() => showAddModal = false}>취소</button>
                    <button class="btn btn-primary btn-wide rounded-xl font-black text-white" onclick={saveSchedule}>저장하기</button>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .custom-scrollbar-mini::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar-mini::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar-mini::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
</style>
