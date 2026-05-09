<script>
    /**
     * @file RecurrenceEditor.svelte
     * @description [v1.0] 일정 반복 설정을 위한 복잡한 UI 컴포넌트
     */
    import Icon from '@iconify/svelte';

    let { 
        recurrence = $bindable({
            freq: 'NONE', // NONE, DAILY, WEEKLY, MONTHLY, YEARLY
            interval: 1,
            byDay: [], // ['MO', 'TU', ...]
            byMonthDay: null,
            until: null,
            count: null
        }) 
    } = $props();

    const days = [
        { label: '월', value: 'MO' },
        { label: '화', value: 'TU' },
        { label: '수', value: 'WE' },
        { label: '목', value: 'TH' },
        { label: '금', value: 'FR' },
        { label: '토', value: 'SA' },
        { label: '일', value: 'SU' }
    ];

    const frequencies = [
        { label: '반복 없음', value: 'NONE' },
        { label: '매일', value: 'DAILY' },
        { label: '매주', value: 'WEEKLY' },
        { label: '매월', value: 'MONTHLY' },
        { label: '매년', value: 'YEARLY' }
    ];

    function toggleDay(day) {
        if (recurrence.byDay.includes(day)) {
            recurrence.byDay = recurrence.byDay.filter(d => d !== day);
        } else {
            recurrence.byDay = [...recurrence.byDay, day];
        }
    }
</script>

<div class="space-y-6 p-4 bg-base-200/50 rounded-xl border border-base-300">
    <!-- Frequency Select -->
    <div class="form-control w-full">
        <label class="label font-bold text-sm">
            <span class="label-text">반복 주기</span>
        </label>
        <select class="select select-bordered w-full bg-base-100" bind:value={recurrence.freq}>
            {#each frequencies as f}
                <option value={f.value}>{f.label}</option>
            {/each}
        </select>
    </div>

    {#if recurrence.freq !== 'NONE'}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <!-- Interval -->
            <div class="form-control w-full">
                <label class="label font-bold text-sm">
                    <span class="label-text">반복 간격</span>
                </label>
                <div class="join">
                    <input type="number" min="1" class="input input-bordered join-item w-full bg-base-100" bind:value={recurrence.interval} />
                    <span class="join-item btn btn-ghost no-animation border-base-300 bg-base-200">
                        {#if recurrence.freq === 'DAILY'}일 마다
                        {:else if recurrence.freq === 'WEEKLY'}주 마다
                        {:else if recurrence.freq === 'MONTHLY'}개월 마다
                        {:else if recurrence.freq === 'YEARLY'}년 마다
                        {/if}
                    </span>
                </div>
            </div>

            <!-- WEEKLY: Day Selection -->
            {#if recurrence.freq === 'WEEKLY'}
                <div class="form-control w-full col-span-full">
                    <label class="label font-bold text-sm">
                        <span class="label-text">반복 요일</span>
                    </label>
                    <div class="flex flex-wrap gap-2">
                        {#each days as day}
                            <button 
                                type="button"
                                class="btn btn-sm transition-all {recurrence.byDay.includes(day.value) ? 'btn-primary' : 'btn-outline'}"
                                onclick={() => toggleDay(day.value)}
                            >
                                {day.label}
                            </button>
                        {/each}
                    </div>
                </div>
            {/if}

            <!-- MONTHLY: Month Day Selection -->
            {#if recurrence.freq === 'MONTHLY'}
                <div class="form-control w-full">
                    <label class="label font-bold text-sm">
                        <span class="label-text">반복 날짜</span>
                    </label>
                    <div class="flex items-center gap-2">
                        <input type="number" min="1" max="31" class="input input-bordered w-20 bg-base-100" bind:value={recurrence.byMonthDay} />
                        <span class="text-sm">일</span>
                    </div>
                </div>
            {/if}
        </div>

        <!-- End Condition -->
        <div class="divider text-xs opacity-50 uppercase tracking-widest">종료 조건</div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="form-control w-full">
                <label class="label font-bold text-sm">
                    <span class="label-text">종료 날짜</span>
                </label>
                <input type="date" class="input input-bordered w-full bg-base-100" bind:value={recurrence.until} />
            </div>
            <div class="form-control w-full">
                <label class="label font-bold text-sm">
                    <span class="label-text">반복 횟수</span>
                </label>
                <div class="join">
                    <input type="number" min="1" class="input input-bordered join-item w-full bg-base-100" bind:value={recurrence.count} />
                    <span class="join-item btn btn-ghost no-animation border-base-300 bg-base-200">회 후 종료</span>
                </div>
            </div>
        </div>
    {/if}
</div>
