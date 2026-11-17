<script lang="ts">
    /**
     * @file +page.svelte
     * @description [v2.0] 통합 일정 관리 페이지 (Schedule DB + 개인/사무실 결근계 + Tier 2 공휴일/사무실 일정 통합)
     * @route /v1/pages/schedule
     */
    import { onMount, untrack } from 'svelte';
    import Icon from '@iconify/svelte';
    import Calendar, {
        type CalendarEvent,
        type CalendarDayCell
    } from '$lib/components/Calendar.svelte';
    import RecurrenceEditor from './components/RecurrenceEditor.svelte';
    import * as scheduleApi from '$lib/api/schedule';
    import { getAuthContext } from '$lib/runes/auth.svelte';
    import { formatDDay, toLocalISOString } from '$lib/utils';
    import { formatApiError } from '$lib/utils/error';
    import { getKstTimeSnapshot, parseDateStrAsLocalDate } from '$lib/utils/serverTime';
    import { toast } from '$lib/runes/toast.svelte';

    let { data } = $props();
    const auth = getAuthContext();

    const initialServerTime = untrack(() => data?.serverTime ?? getKstTimeSnapshot());
    const initialDateStr = initialServerTime.dateStr;
    const initialTodayDate = parseDateStrAsLocalDate(initialDateStr);

    let todayStr = $state(initialDateStr);
    let calYear = $state(initialServerTime.year);
    let calMonth = $state(initialServerTime.month);
    let selectedDate = $state<string | null>(initialDateStr);

    let loading = $state(true);
    let saving = $state(false);
    let userRank = $state<number>(
        Number(auth?.user?.rank_level ?? auth?.user?.profile?.rank_level ?? 0)
    );
    let isTier2 = $derived(userRank >= 2);

    let rawEvents = $state<any[]>([]);
    let rawSchedules = $state<any[]>([]);
    let myDayoffs = $state<any[]>([]);
    let officeDayoffs = $state<any[]>([]);

    const CATEGORY_META: Record<string, { type: CalendarEvent['type']; badge: string }> = {
        HOLIDAY: { type: 'HOLIDAY', badge: '공휴일' },
        GLOBAL: { type: 'PRIMARY', badge: '전사공지' },
        OFFICE: { type: 'INFO', badge: '사무실' },
        DAYOFF: { type: 'WARNING', badge: '결근계' },
        ATTENDANCE: { type: 'INFO', badge: '근태' },
        PERSONAL: { type: 'SUCCESS', badge: '개인' }
    };

    let calendarEvents = $derived<CalendarEvent[]>(
        rawEvents.map((ev) => {
            const meta = CATEGORY_META[ev.category] || { type: 'PRIMARY', badge: ev.category };
            const isBg = ev.display_mode === 'background';
            return {
                id: ev.id,
                date: ev.date,
                endDate: ev.endDate ?? undefined,
                title: ev.title,
                time: ev.time,
                type: ev.category === 'HOLIDAY' ? 'HOLIDAY' : isBg ? 'DANGER' : meta.type,
                display: isBg ? 'background' : 'bar',
                color: ev.color || undefined,
                badge: ev.source === 'DAYOFF' ? (ev.dayoff_status === 'APPROVED' ? '결근확정' : '결근대기') : meta.badge,
                isDday: Boolean(ev.is_dday),
                isHoliday: Boolean(ev.is_holiday || ev.category === 'HOLIDAY'),
                raw: ev
            };
        })
    );

    let activeDdaySchedules = $derived(
        rawSchedules.filter((s) => s.is_dday).slice(0, 2)
    );

    let todayPersonalSchedules = $derived(
        rawSchedules.filter((s) => s.category === 'PERSONAL' && s.date === todayStr)
    );

    let showAddModal = $state(false);
    let editingScheduleId = $state<number | null>(null);
    let timeMode = $state<'all-day' | 'timed'>('timed');
    let newSchedule = $state({
        title: '',
        color: '#3b82f6',
        content: '',
        start_at: '',
        end_at: '',
        is_all_day: false,
        display_mode: 'bar' as 'bar' | 'background',
        is_dday: false,
        importance: 1,
        category: 'PERSONAL',
        recurrence: { freq: 'NONE', interval: 1, byDay: [] as string[], byMonthDay: null as number | null, until: null as string | null, count: null as number | null }
    });

    async function loadMonthSchedules(y = calYear, mIdx = calMonth) {
        loading = true;
        try {
            const res = await scheduleApi.getSchedules({ year: y, month: mIdx + 1 });
            rawEvents = res?.events || [];
            rawSchedules = res?.schedules || [];
            myDayoffs = res?.my_dayoffs || [];
            officeDayoffs = res?.office_dayoffs || [];
            if (typeof res?.user_rank === 'number') {
                userRank = res.user_rank;
            }
        } catch (err) {
            toast.error(formatApiError(err, '일정을 불러오지 못했습니다.'));
        } finally {
            loading = false;
        }
    }

    function openAddModal(dateObj: Date, presetCategory = 'PERSONAL') {
        editingScheduleId = null;
        const iso = toLocalISOString(dateObj);
        const dateOnly = iso.slice(0, 10);
        const isAllDayPreset = presetCategory === 'HOLIDAY';
        timeMode = isAllDayPreset ? 'all-day' : 'timed';
        newSchedule = {
            title: '',
            color: presetCategory === 'HOLIDAY' ? '#ef4444' : presetCategory === 'OFFICE' ? '#0ea5e9' : '#3b82f6',
            content: '',
            start_at: isAllDayPreset ? dateOnly : iso,
            end_at: isAllDayPreset ? dateOnly : iso,
            is_all_day: isAllDayPreset,
            display_mode: 'bar',
            is_dday: false,
            importance: presetCategory === 'HOLIDAY' || presetCategory === 'GLOBAL' ? 4 : 1,
            category: presetCategory,
            recurrence: { freq: 'NONE', interval: 1, byDay: [], byMonthDay: null, until: null, count: null }
        };
        showAddModal = true;
    }

    function openEditModal(raw: any) {
        editingScheduleId = raw.schedule_id;
        timeMode = raw.is_all_day ? 'all-day' : 'timed';
        const rec = raw.recurrence || {};
        newSchedule = {
            title: raw.title || '',
            color: raw.color || '#3b82f6',
            content: raw.content || '',
            start_at: raw.is_all_day ? String(raw.start_at || raw.date).slice(0, 10) : String(raw.start_at || '').slice(0, 16),
            end_at: raw.is_all_day ? String(raw.end_at || raw.endDate || raw.date).slice(0, 10) : String(raw.end_at || raw.start_at || '').slice(0, 16),
            is_all_day: Boolean(raw.is_all_day),
            display_mode: raw.display_mode === 'background' ? 'background' : 'bar',
            is_dday: Boolean(raw.is_dday),
            importance: Number(raw.importance || 1),
            category: raw.category || 'PERSONAL',
            recurrence: {
                freq: rec.freq || 'NONE',
                interval: rec.interval || 1,
                byDay: Array.isArray(rec.byDay) ? rec.byDay : [],
                byMonthDay: rec.byMonthDay ?? null,
                until: rec.until ?? null,
                count: rec.count ?? null
            }
        };
        showAddModal = true;
    }

    async function saveSchedule() {
        const title = newSchedule.title.trim();
        if (!title) {
            toast.warning('일정 제목을 입력해 주세요.');
            return;
        }
        saving = true;
        try {
            const payload = {
                title,
                content: newSchedule.content.trim() || null,
                category: newSchedule.category,
                color: newSchedule.color,
                start_at: newSchedule.start_at,
                end_at: newSchedule.end_at || newSchedule.start_at,
                is_all_day: newSchedule.is_all_day || newSchedule.category === 'HOLIDAY',
                display_mode: newSchedule.display_mode,
                importance: newSchedule.importance,
                is_dday: newSchedule.is_dday,
                recurrence: newSchedule.recurrence
            };
            if (editingScheduleId) {
                await scheduleApi.updateSchedule(editingScheduleId, payload);
                toast.success('일정이 수정되었습니다.');
            } else {
                await scheduleApi.createSchedule(payload);
                toast.success('일정이 등록되었습니다.');
            }
            showAddModal = false;
            await loadMonthSchedules(calYear, calMonth);
        } catch (err) {
            toast.error(formatApiError(err, '일정 저장에 실패했습니다.'));
        } finally {
            saving = false;
        }
    }

    async function removeEditingSchedule() {
        if (!editingScheduleId) return;
        if (!confirm('이 일정을 삭제하시겠습니까?')) return;
        saving = true;
        try {
            await scheduleApi.deleteSchedule(editingScheduleId);
            toast.success('일정이 삭제되었습니다.');
            showAddModal = false;
            await loadMonthSchedules(calYear, calMonth);
        } catch (err) {
            toast.error(formatApiError(err, '일정 삭제에 실패했습니다.'));
        } finally {
            saving = false;
        }
    }

    function handleEventClick(ev: CalendarEvent, cell: CalendarDayCell) {
        const raw = ev.raw;
        if (!raw) return;
        if (raw.source === 'DAYOFF') {
            toast.info(`[결근계 · ${cell.dateStr}] ${raw.title}${raw.content ? ` — ${raw.content}` : ''}`);
            return;
        }
        if (raw.source === 'SCHEDULE' && raw.schedule_id) {
            if (raw.user_id === auth?.user?.id || (isTier2 && (raw.scope === 'OFFICE' || raw.scope === 'GLOBAL'))) {
                openEditModal(raw);
            } else {
                toast.info(`[${cell.dateStr}] ${ev.title}`);
            }
        }
    }

    onMount(() => {
        const liveToday = getKstTimeSnapshot().dateStr;
        if (liveToday !== todayStr) {
            todayStr = liveToday;
        }
        loadMonthSchedules(calYear, calMonth);
    });
</script>

<div class="flex flex-col min-h-screen gap-10 p-4 lg:p-10 bg-base-200/30 pb-32">
    <!-- Header Section -->
    <header class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 class="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900">SCHEDULE</h1>
            <p class="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">
                Integrated Task & Attendance Management
                {#if isTier2}
                    <span class="badge badge-info ml-2 text-[10px] font-black text-white">TIER 2 · 사무실/공휴일 관제</span>
                {/if}
            </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
            {#if isTier2}
                <button
                    type="button"
                    onclick={() => openAddModal(selectedDate ? parseDateStrAsLocalDate(selectedDate) : new Date(initialTodayDate), 'HOLIDAY')}
                    class="btn btn-sm rounded-xl border-rose-200 bg-rose-50 font-black text-rose-700 hover:bg-rose-100"
                >
                    🚩 공휴일 등록
                </button>
                <button
                    type="button"
                    onclick={() => openAddModal(selectedDate ? parseDateStrAsLocalDate(selectedDate) : new Date(initialTodayDate), 'OFFICE')}
                    class="btn btn-sm rounded-xl border-sky-200 bg-sky-50 font-black text-sky-700 hover:bg-sky-100"
                >
                    🏢 사무실 일정 작성
                </button>
            {/if}
            <button
                type="button"
                onclick={() => loadMonthSchedules(calYear, calMonth)}
                disabled={loading}
                class="btn btn-sm btn-outline rounded-xl font-bold"
            >
                <Icon icon="solar:restart-bold" class="text-base {loading ? 'animate-spin' : ''}" />
                새로고침
            </button>
        </div>
    </header>

    <!-- Main Calendar Area (공용 Calendar 컴포넌트) -->
    <main class="w-full">
        <Calendar
            bind:year={calYear}
            bind:month={calMonth}
            bind:selectedDate
            {todayStr}
            events={calendarEvents}
            selectionMode="single"
            fullBleedMobile={true}
            showSelectedDayPanel={true}
            subtitle="Integrated Task & Attendance Calendar"
            onMonthChange={(y, m) => loadMonthSchedules(y, m)}
            onEventClick={handleEventClick}
            onAddEventClick={(dateStr) => openAddModal(parseDateStrAsLocalDate(dateStr))}
        >
            {#snippet headerRight()}
                <button
                    type="button"
                    onclick={() => openAddModal(selectedDate ? parseDateStrAsLocalDate(selectedDate) : new Date(initialTodayDate))}
                    class="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-black text-white shadow-sm transition hover:bg-blue-700"
                >
                    <Icon icon="solar:add-circle-bold" class="text-sm" />
                    <span>일정 추가</span>
                </button>
            {/snippet}
        </Calendar>
    </main>

    <!-- Bottom Feature Blocks (2-Tier 통합 구조: Tier 3은 Tier 2로 통합) -->
    <div class="flex flex-col gap-10">

        <!-- [Tier 1] PERSONAL FOCUS & 내 결근계 확인: 모든 사용자 공통 (Rank 0+) -->
        <section class="flex flex-col gap-6">
            <div class="flex items-center gap-3">
                <div class="w-1.5 h-6 bg-success rounded-full"></div>
                <h3 class="text-xl font-black tracking-tight italic uppercase">Tier 1: Personal Focus & 내 결근계</h3>
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Today's Focus + My Dayoffs -->
                <div class="lg:col-span-2 bg-white border border-slate-200 p-6 sm:p-8 rounded-3xl shadow-sm space-y-6">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="p-3 bg-success/10 rounded-2xl">
                                <Icon icon="lucide:sparkles" class="text-2xl text-success" />
                            </div>
                            <div>
                                <h4 class="text-lg font-black tracking-tight">오늘의 집중 일정 · 내 결근계</h4>
                                <p class="text-xs font-bold text-slate-400">개인 일정과 승인·대기 중인 본인 결근계가 함께 표시됩니다</p>
                            </div>
                        </div>
                        <a href="/v1/custom/dayoff" class="btn btn-ghost btn-sm text-xs font-bold text-blue-600">결근계 신청 →</a>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <div class="text-[11px] font-black uppercase text-slate-400">오늘 개인 일정 ({todayPersonalSchedules.length})</div>
                            {#each todayPersonalSchedules as s}
                                <button
                                    type="button"
                                    onclick={() => openEditModal(s)}
                                    class="w-full flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-left hover:border-blue-300"
                                >
                                    <div class="flex items-center gap-3 min-w-0">
                                        <div class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {s.color || '#10b981'};"></div>
                                        <span class="font-black text-slate-700 truncate text-sm">{s.title}</span>
                                    </div>
                                    <span class="text-[11px] font-mono font-bold text-slate-400 shrink-0 ml-2">{s.time}</span>
                                </button>
                            {:else}
                                <div class="p-5 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <p class="text-xs font-bold text-slate-400">오늘 예정된 개인 일정이 없습니다.</p>
                                </div>
                            {/each}
                        </div>

                        <div class="space-y-2">
                            <div class="text-[11px] font-black uppercase text-slate-400">이번 조회구간 내 결근계 ({myDayoffs.length})</div>
                            {#each myDayoffs.slice(0, 4) as d}
                                <div class="flex items-center justify-between p-3.5 bg-amber-50/70 rounded-2xl border border-amber-200">
                                    <div class="min-w-0">
                                        <div class="text-xs font-black text-slate-800 truncate">{d.title}</div>
                                        <div class="text-[11px] font-mono text-slate-500">
                                            {d.date}{d.endDate ? ` ~ ${d.endDate}` : ''} ({d.days_count}일)
                                        </div>
                                    </div>
                                    <span class="badge badge-xs font-bold {d.dayoff_status === 'APPROVED' ? 'badge-success text-white' : 'badge-warning'}">
                                        {d.dayoff_status === 'APPROVED' ? '확정' : '대기'}
                                    </span>
                                </div>
                            {:else}
                                <div class="p-5 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    <p class="text-xs font-bold text-slate-400">조회 구간 내 본인 결근계가 없습니다.</p>
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>

                <!-- Active D-Days -->
                <div class="bg-slate-900 text-white p-8 rounded-3xl shadow-2xl flex flex-col justify-between group overflow-hidden relative">
                    <div class="absolute -right-4 -top-4 opacity-10 group-hover:scale-110 transition-transform duration-500">
                        <Icon icon="lucide:flag" class="text-9xl" />
                    </div>
                    <div class="relative z-10">
                        <div class="flex items-center justify-between mb-6">
                            <h4 class="text-lg font-black tracking-tight italic">ACTIVE D-DAY</h4>
                            <Icon icon="lucide:arrow-up-right" class="text-xl opacity-40" />
                        </div>
                        <div class="flex flex-col gap-5">
                            {#each activeDdaySchedules as s}
                                <button
                                    type="button"
                                    onclick={() => openEditModal(s)}
                                    class="text-left hover:opacity-80 transition"
                                >
                                    <p class="text-xs font-bold opacity-50 mb-1 uppercase tracking-widest">{s.title}</p>
                                    <p class="text-4xl font-black italic">
                                        {formatDDay(parseDateStrAsLocalDate(s.date), initialTodayDate)}
                                    </p>
                                </button>
                            {:else}
                                <p class="text-xs font-bold opacity-40">활성화된 디데이가 없습니다.</p>
                            {/each}
                        </div>
                    </div>
                    <button
                        type="button"
                        onclick={() => openAddModal(selectedDate ? parseDateStrAsLocalDate(selectedDate) : new Date(initialTodayDate), 'PERSONAL')}
                        class="btn btn-primary btn-sm w-full mt-8 rounded-xl font-black"
                    >
                        D-Day 일정 추가
                    </button>
                </div>
            </div>
        </section>

        <!-- [Tier 2] OFFICE & HOLIDAY GOVERNANCE (기존 Tier 3 기능 통합, Rank 2+) -->
        {#if isTier2}
            <section class="flex flex-col gap-6">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                        <div class="w-1.5 h-6 bg-primary rounded-full"></div>
                        <h3 class="text-xl font-black tracking-tight italic uppercase">Tier 2: 공휴일 · 사무실 일정 & 사무실 결근계 관제</h3>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onclick={() => openAddModal(selectedDate ? parseDateStrAsLocalDate(selectedDate) : new Date(initialTodayDate), 'HOLIDAY')}
                            class="btn btn-sm rounded-xl border-rose-200 bg-rose-50 font-black text-rose-700 hover:bg-rose-100"
                        >
                            + 공휴일 입력
                        </button>
                        <button
                            type="button"
                            onclick={() => openAddModal(selectedDate ? parseDateStrAsLocalDate(selectedDate) : new Date(initialTodayDate), 'OFFICE')}
                            class="btn btn-sm rounded-xl border-sky-200 bg-sky-50 font-black text-sky-700 hover:bg-sky-100"
                        >
                            + 사무실 일정
                        </button>
                        {#if userRank >= 4}
                            <a href="/v1/admin/dayoff" class="btn btn-sm btn-outline rounded-xl font-bold">
                                결근계 승인 관리 →
                            </a>
                        {/if}
                    </div>
                </div>

                <div class="bg-white border border-slate-200 p-6 sm:p-8 rounded-3xl shadow-sm space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="text-base font-black text-slate-900">사무실 직원 결근계 현황 ({officeDayoffs.length}건)</h4>
                            <p class="text-xs font-medium text-slate-400">운전직(FCFS) 제외, 사무실 전 직원의 조회 기간 내 휴무/연차 내역입니다.</p>
                        </div>
                        <span class="badge badge-info badge-sm font-black text-white">Tier 2 통합 관제</span>
                    </div>

                    {#if officeDayoffs.length === 0}
                        <div class="py-8 text-center text-xs font-bold text-slate-400">
                            조회 기간 내 사무실 직원 결근계 내역이 없습니다.
                        </div>
                    {:else}
                        <div class="overflow-x-auto">
                            <table class="w-full text-left text-xs">
                                <thead class="border-b border-slate-200 bg-slate-50 font-black text-slate-500">
                                    <tr>
                                        <th class="px-3 py-2.5">상태</th>
                                        <th class="px-3 py-2.5">성명 · 부서</th>
                                        <th class="px-3 py-2.5">유형</th>
                                        <th class="px-3 py-2.5">기간</th>
                                        <th class="px-3 py-2.5">사유</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    {#each officeDayoffs as od (od.id)}
                                        <tr class="hover:bg-slate-50">
                                            <td class="px-3 py-2">
                                                <span class="badge badge-xs font-black {od.dayoff_status === 'APPROVED' ? 'badge-success text-white' : 'badge-warning'}">
                                                    {od.dayoff_status === 'APPROVED' ? '승인' : '대기'}
                                                </span>
                                            </td>
                                            <td class="px-3 py-2 font-black text-slate-900">
                                                {od.staff_name}
                                                {#if od.primary_group}
                                                    <span class="ml-1 text-[11px] font-bold text-slate-400">({od.primary_group})</span>
                                                {/if}
                                            </td>
                                            <td class="px-3 py-2 font-bold text-slate-700">{od.dayoff_type}</td>
                                            <td class="px-3 py-2 font-mono text-slate-600">
                                                {od.date}{od.endDate ? ` ~ ${od.endDate}` : ''} ({od.days_count}일)
                                            </td>
                                            <td class="px-3 py-2 text-slate-500">{od.content || '-'}</td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {/if}
                </div>
            </section>
        {/if}
    </div>
</div>

<!-- Add/Edit Modal -->
{#if showAddModal}
    <div class="modal modal-open p-4">
        <div class="modal-box w-full max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden p-5 sm:p-8 rounded-3xl bg-base-100 border border-base-200 shadow-2xl">
            <!-- Header -->
            <div class="flex justify-between items-center mb-8">
                <div>
                    <h3 class="text-3xl font-black tracking-tighter italic">{editingScheduleId ? 'EDIT EVENT' : 'NEW EVENT'}</h3>
                    <p class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
                        {editingScheduleId ? '일정 수정 및 삭제' : '신규 일정 등록'}
                    </p>
                </div>
                <button type="button" aria-label="모달 닫기" class="btn btn-circle btn-ghost bg-slate-50" onclick={() => (showAddModal = false)}>
                    <Icon icon="lucide:x" class="text-2xl" />
                </button>
            </div>

            <div class="flex flex-col gap-8">
                <!-- Section 1: Basic Info (Title & Color) -->
                <div class="flex flex-col gap-3">
                    <label for="sched-title" class="text-[10px] font-black uppercase opacity-40 tracking-widest">Event Identity</label>
                    <div class="flex flex-col md:flex-row gap-4 items-center">
                        <div class="flex-1 w-full">
                            <input
                                id="sched-title"
                                type="text"
                                class="input input-ghost w-full text-3xl font-black placeholder:opacity-20 border-b-4 focus:bg-transparent px-0 rounded-none transition-all outline-none"
                                placeholder="제목을 입력하세요"
                                bind:value={newSchedule.title}
                                style="color: {newSchedule.color}; border-color: {newSchedule.color}40;"
                            />
                        </div>
                        <div class="flex gap-2 p-2 bg-slate-50 rounded-2xl border border-slate-100 shrink-0">
                            {#each ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#0f172a'] as color}
                                <button
                                    type="button"
                                    aria-label={`색상 ${color}`}
                                    class="w-7 h-7 rounded-full transition-all hover:scale-125 {newSchedule.color === color ? 'ring-4 ring-offset-2 ring-slate-200 scale-110' : 'opacity-60 hover:opacity-100'}"
                                    style="background-color: {color};"
                                    onclick={() => (newSchedule.color = color)}
                                ></button>
                            {/each}
                        </div>
                    </div>
                </div>

                <!-- Section 2: Time Configuration & Category -->
                <div class="flex flex-col gap-5">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                        <div class="flex flex-col gap-2">
                            <span class="text-[10px] font-black uppercase opacity-40 tracking-widest">Time Mode</span>
                            <div class="flex gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit">
                                <button
                                    type="button"
                                    class="btn btn-sm border-none rounded-xl px-6 {timeMode === 'all-day' ? 'bg-white shadow-md font-black text-slate-900' : 'bg-transparent opacity-50 font-bold'}"
                                    onclick={() => {
                                        timeMode = 'all-day';
                                        newSchedule.is_all_day = true;
                                        newSchedule.start_at = String(newSchedule.start_at).slice(0, 10);
                                        newSchedule.end_at = String(newSchedule.end_at).slice(0, 10);
                                    }}
                                >종일</button>
                                <button
                                    type="button"
                                    class="btn btn-sm border-none rounded-xl px-6 {timeMode === 'timed' ? 'bg-white shadow-md font-black text-slate-900' : 'bg-transparent opacity-50 font-bold'}"
                                    onclick={() => {
                                        timeMode = 'timed';
                                        newSchedule.is_all_day = false;
                                        if (newSchedule.start_at.length === 10) newSchedule.start_at = `${newSchedule.start_at}T09:00`;
                                        if (newSchedule.end_at.length === 10) newSchedule.end_at = `${newSchedule.end_at}T18:00`;
                                    }}
                                >시간 지정</button>
                            </div>
                        </div>
                        <div class="form-control min-w-0 w-full">
                            <label for="sched-cat" class="label font-black text-[10px] uppercase opacity-40"><span class="label-text">Category</span></label>
                            <select id="sched-cat" class="select select-bordered w-full min-w-0 bg-slate-50 border-slate-200 font-bold rounded-xl" bind:value={newSchedule.category}>
                                <option value="PERSONAL">🙋 개인 일정</option>
                                <option value="ATTENDANCE">💼 근태 기록</option>
                                {#if isTier2}
                                    <option value="OFFICE">🏢 사무실 일정 (Tier 2)</option>
                                    <option value="GLOBAL">📢 전사 공지 (Tier 2)</option>
                                    <option value="HOLIDAY">🚩 공휴일 설정 (Tier 2)</option>
                                {/if}
                            </select>
                        </div>
                    </div>

                    <!-- Date/Time Inputs -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-5 bg-slate-50 rounded-3xl border border-slate-100">
                        <div class="form-control min-w-0 w-full">
                            <label for="sched-start" class="label font-black text-[10px] uppercase opacity-40"><span class="label-text">Start {timeMode === 'all-day' ? 'Date' : 'Time'}</span></label>
                            <input
                                id="sched-start"
                                type={timeMode === 'all-day' ? 'date' : 'datetime-local'}
                                class="input input-bordered w-full min-w-0 bg-white border-slate-200 font-bold rounded-xl"
                                bind:value={newSchedule.start_at}
                            />
                        </div>
                        <div class="form-control min-w-0 w-full">
                            <label for="sched-end" class="label font-black text-[10px] uppercase opacity-40"><span class="label-text">End {timeMode === 'all-day' ? 'Date' : 'Time'}</span></label>
                            <input
                                id="sched-end"
                                type={timeMode === 'all-day' ? 'date' : 'datetime-local'}
                                class="input input-bordered w-full min-w-0 bg-white border-slate-200 font-bold rounded-xl"
                                bind:value={newSchedule.end_at}
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label for="sched-content" class="block text-[10px] font-black uppercase opacity-40 mb-1">메모 (선택)</label>
                    <textarea id="sched-content" rows="2" bind:value={newSchedule.content} placeholder="일정 상세 내용..." class="textarea textarea-bordered w-full rounded-xl bg-slate-50 font-medium"></textarea>
                </div>

                <!-- Section 3: Importance, Display Mode & D-Day -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div class="space-y-3">
                        <div class="form-control">
                            <span class="label font-black text-[10px] uppercase opacity-40 mb-1">Importance</span>
                            <div class="rating rating-md gap-1">
                                {#each [1, 2, 3, 4, 5] as i}
                                    <input type="radio" aria-label={`중요도 ${i}`} name="importance" class="mask mask-star-2 bg-warning" checked={newSchedule.importance === i} onclick={() => (newSchedule.importance = i)} />
                                {/each}
                            </div>
                        </div>
                        {#if isTier2}
                            <label class="flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
                                <input
                                    type="checkbox"
                                    class="checkbox checkbox-sm checkbox-error"
                                    checked={newSchedule.display_mode === 'background'}
                                    onchange={(e) => (newSchedule.display_mode = e.currentTarget.checked ? 'background' : 'bar')}
                                />
                                <span>중요 배경 알람으로 표시 (달력 칸 배경색 강조)</span>
                            </label>
                        {/if}
                    </div>
                    <div class="p-5 bg-primary/5 rounded-[22px] border border-primary/10 flex items-center justify-between">
                        <div class="flex items-center gap-4">
                            <div class="p-3 bg-primary/10 rounded-xl">
                                <Icon icon="lucide:flag" class="text-xl text-primary" />
                            </div>
                            <div>
                                <h4 class="font-black text-sm">D-Day Mode</h4>
                                <p class="text-[10px] font-bold opacity-40">메인 화면 카운트다운</p>
                            </div>
                        </div>
                        <input type="checkbox" aria-label="D-Day 모드" class="toggle toggle-primary toggle-md" bind:checked={newSchedule.is_dday} />
                    </div>
                </div>

                {#if newSchedule.is_dday && newSchedule.start_at}
                    <div class="bg-slate-900 text-white p-5 rounded-3xl flex items-center justify-between shadow-xl shadow-slate-200">
                        <div class="flex items-center gap-4">
                            <Icon icon="lucide:zap" class="text-2xl text-yellow-400" />
                            <span class="text-[10px] font-black opacity-40 uppercase tracking-widest">Countdown Preview</span>
                        </div>
                        <span class="text-3xl font-black italic">
                            {formatDDay(parseDateStrAsLocalDate(newSchedule.start_at.slice(0, 10)), initialTodayDate)}
                        </span>
                    </div>
                {/if}

                <!-- Recurrence -->
                <div class="border-t border-base-200 pt-6">
                    <h4 class="text-xs font-black uppercase opacity-40 mb-3">반복 설정 (Recurrence)</h4>
                    <RecurrenceEditor bind:recurrence={newSchedule.recurrence} />
                </div>

                <div class="modal-action flex flex-wrap justify-between items-center gap-3">
                    <div>
                        {#if editingScheduleId}
                            <button type="button" disabled={saving} class="btn btn-error btn-outline rounded-xl font-bold" onclick={removeEditingSchedule}>삭제</button>
                        {/if}
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button type="button" class="btn btn-ghost rounded-xl font-bold" onclick={() => (showAddModal = false)}>취소</button>
                        <button type="button" disabled={saving} class="btn btn-primary px-6 rounded-xl font-black text-white" onclick={saveSchedule}>
                            {#if saving}<span class="loading loading-xs loading-spinner"></span>{/if}
                            {editingScheduleId ? '수정 저장' : '저장하기'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
