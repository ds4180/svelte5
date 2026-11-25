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
    /** 작년 동월(calYear - 1, calMonth) 중요 일정 목록 */
    let lastYearImportantSchedules = $state<any[]>([]);
    let loadingLastYear = $state(false);

    // 📌 상단 연/월 옆 캘린더 표시 필터 체크박스 ('개인일정' / '사무실 일정')
    let showPersonalEvents = $state(true);
    let showOfficeEvents = $state(true);

    const CATEGORY_META: Record<string, { type: CalendarEvent['type']; badge: string }> = {
        HOLIDAY: { type: 'HOLIDAY', badge: '공휴일' },
        GLOBAL: { type: 'PRIMARY', badge: '전사공지' },
        OFFICE: { type: 'INFO', badge: '사무실' },
        DAYOFF: { type: 'WARNING', badge: '결근계' },
        ATTENDANCE: { type: 'INFO', badge: '근태' },
        PERSONAL: { type: 'SUCCESS', badge: '개인' }
    };

    /**
     * 체크박스('개인일정', '사무실 일정')에 따라 달력에 표시할 이벤트 필터링
     * - 공휴일(HOLIDAY)은 항상 표시
     * - 개인일정: PERSONAL / ATTENDANCE / 본인 결근계(scope === 'PERSONAL')
     * - 사무실 일정: OFFICE / GLOBAL / 사무실 직원 결근계(scope === 'OFFICE' 등)
     */
    let calendarEvents = $derived<CalendarEvent[]>(
        rawEvents
            .filter((ev) => {
                if (ev.is_holiday || ev.category === 'HOLIDAY') return true;
                const isPersonal =
                    ev.category === 'PERSONAL' ||
                    ev.category === 'ATTENDANCE' ||
                    (ev.source === 'DAYOFF' && (ev.scope === 'PERSONAL' || ev.user_id === auth?.user?.id));
                const isOffice =
                    ev.category === 'OFFICE' ||
                    ev.category === 'GLOBAL' ||
                    (ev.source === 'DAYOFF' && ev.scope !== 'PERSONAL' && ev.user_id !== auth?.user?.id);

                if (isPersonal) return showPersonalEvents;
                if (isOffice) return showOfficeEvents;
                return showOfficeEvents;
            })
            .map((ev) => {
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
                    // 중요 일정(배경 강조)은 해당 날짜 칸 전체(100%) 배경색으로 적용
                    bgPosition: isBg ? 'full' : 'auto',
                    color: ev.color || undefined,
                    badge: ev.source === 'DAYOFF' ? (ev.dayoff_status === 'APPROVED' ? '결근확정' : '결근대기') : meta.badge,
                    isDday: Boolean(ev.is_dday),
                    isHoliday: Boolean(ev.is_holiday || ev.category === 'HOLIDAY'),
                    raw: ev
                };
            })
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
        loadingLastYear = true;
        const targetMonth = mIdx + 1;
        const lastYearPrefix = `${y - 1}-${String(targetMonth).padStart(2, '0')}`;
        try {
            // 현재 월 일정과 작년 동월 일정을 병렬 조회하여 참조용 중요 일정 카드 구성
            const [res, lastYearRes] = await Promise.all([
                scheduleApi.getSchedules({ year: y, month: targetMonth }),
                scheduleApi.getSchedules({ year: y - 1, month: targetMonth }).catch(() => null)
            ]);
            rawEvents = res?.events || [];
            rawSchedules = res?.schedules || [];
            myDayoffs = res?.my_dayoffs || [];
            officeDayoffs = res?.office_dayoffs || [];
            if (typeof res?.user_rank === 'number') {
                userRank = res.user_rank;
            }

            // 작년 동월 일정 중 중요 일정(배경 강조 또는 중요도 4 이상, 공휴일 제외)만 추출 및 날짜순 정렬
            const prevSchedules: any[] = lastYearRes?.schedules || [];
            const seen = new Set<string>();
            lastYearImportantSchedules = prevSchedules
                .filter((s) => {
                    if (!s || s.category === 'HOLIDAY' || s.is_holiday) return false;
                    const isImportant = s.display_mode === 'background' || Number(s.importance || 0) >= 4;
                    if (!isImportant) return false;
                    // 달력 패딩(전월/익월) 제외하고 정확히 작년 동월과 겹치는 일정만 필터링
                    const startYm = String(s.date || '').slice(0, 7);
                    const endYm = String(s.endDate || s.date || '').slice(0, 7);
                    if (startYm !== lastYearPrefix && endYm !== lastYearPrefix) return false;
                    const dedupKey = `${s.schedule_id ?? s.id}-${s.date}-${s.endDate || ''}`;
                    if (seen.has(dedupKey)) return false;
                    seen.add(dedupKey);
                    return true;
                })
                .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')));
        } catch (err) {
            toast.error(formatApiError(err, '일정을 불러오지 못했습니다.'));
        } finally {
            loading = false;
            loadingLastYear = false;
        }
    }

    /**
     * 작년 동월 중요 일정을 올해 동월 날짜로 변환하여 신규 등록 모달에 바로 복사해 줍니다.
     */
    function copyLastYearScheduleToThisYear(s: any) {
        editingScheduleId = null;
        const shiftYear = (dateStr: string) => {
            if (!dateStr || dateStr.length < 10) return `${calYear}-${String(calMonth + 1).padStart(2, '0')}-01`;
            const rest = dateStr.slice(4); // '-MM-DD...'
            return `${calYear}${rest}`;
        };
        const isAllDay = Boolean(s.is_all_day);
        timeMode = isAllDay ? 'all-day' : 'timed';
        const rawStart = isAllDay ? String(s.start_at || s.date).slice(0, 10) : String(s.start_at || `${s.date}T09:00`).slice(0, 16);
        const rawEnd = isAllDay ? String(s.end_at || s.endDate || s.date).slice(0, 10) : String(s.end_at || s.start_at || `${s.date}T18:00`).slice(0, 16);

        newSchedule = {
            title: s.title || '',
            color: s.color || '#ef4444',
            content: s.content || '',
            start_at: shiftYear(rawStart),
            end_at: shiftYear(rawEnd),
            is_all_day: isAllDay,
            display_mode: s.display_mode === 'background' ? 'background' : 'bar',
            is_dday: Boolean(s.is_dday),
            importance: Number(s.importance || 4),
            category: s.category || (isTier2 ? 'OFFICE' : 'PERSONAL'),
            recurrence: { freq: 'NONE', interval: 1, byDay: [], byMonthDay: null, until: null, count: null }
        };
        showAddModal = true;
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

<div class="mx-auto flex min-h-screen max-w-7xl flex-col gap-8 px-4 py-6 pb-32 font-['Noto_Sans_KR','Outfit'] md:px-6 lg:px-8">
    <!-- 상단 헤더 섹션 (전면 한글화 + 모던 대시보드 헤더) -->
    <header class="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:border-b-4">
        <div>
            <div class="flex flex-wrap items-center gap-2">
                <span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-wider text-emerald-400">
                    <span class="h-2 w-2 animate-ping rounded-full bg-emerald-400"></span>
                    통합 일정 · 근태 캘린더
                </span>
                {#if isTier2}
                    <span class="inline-flex items-center gap-1 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-black text-sky-700">
                        <Icon icon="solar:shield-check-bold-duotone" class="text-sm" />
                        사무실 · 공휴일 관제 권한
                    </span>
                {/if}
            </div>
            <h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
                일정 <span class="text-blue-600">관리</span>
            </h1>
            <p class="mt-1 text-sm font-medium text-slate-500">
                개인 일정, 사무실 일정, 공휴일 및 결근계 현황을 한 화면에서 통합 관리합니다.
            </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
            {#if isTier2}
                <button
                    type="button"
                    onclick={() => openAddModal(selectedDate ? parseDateStrAsLocalDate(selectedDate) : new Date(initialTodayDate), 'HOLIDAY')}
                    class="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-black text-rose-700 shadow-xs transition hover:bg-rose-100 active:scale-95"
                >
                    <Icon icon="solar:flag-bold-duotone" class="text-sm" />
                    <span>공휴일 등록</span>
                </button>
                <button
                    type="button"
                    onclick={() => openAddModal(selectedDate ? parseDateStrAsLocalDate(selectedDate) : new Date(initialTodayDate), 'OFFICE')}
                    class="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-2 text-xs font-black text-sky-700 shadow-xs transition hover:bg-sky-100 active:scale-95"
                >
                    <Icon icon="solar:buildings-2-bold-duotone" class="text-sm" />
                    <span>사무실 일정 작성</span>
                </button>
            {/if}
            <button
                type="button"
                onclick={() => loadMonthSchedules(calYear, calMonth)}
                disabled={loading}
                class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
            >
                <Icon icon="solar:restart-bold" class="text-base {loading ? 'animate-spin' : ''}" />
                <span>새로고침</span>
            </button>
        </div>
    </header>

    <!-- 메인 캘린더 영역 (공용 Calendar 컴포넌트 + 연/월 옆 개인일정·사무실 일정 체크박스) -->
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
            subtitle="통합 업무 · 근태 캘린더"
            onMonthChange={(y, m) => loadMonthSchedules(y, m)}
            onEventClick={handleEventClick}
            onAddEventClick={(dateStr) => openAddModal(parseDateStrAsLocalDate(dateStr))}
        >
            {#snippet headerLeftExtra()}
                <div class="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5">
                    <label class="flex cursor-pointer items-center gap-1.5 text-xs font-black text-slate-700 select-none">
                        <input
                            type="checkbox"
                            bind:checked={showPersonalEvents}
                            class="checkbox checkbox-xs checkbox-success rounded"
                        />
                        <span class="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                        <span>개인일정</span>
                    </label>
                    <span class="h-3.5 w-px bg-slate-200"></span>
                    <label class="flex cursor-pointer items-center gap-1.5 text-xs font-black text-slate-700 select-none">
                        <input
                            type="checkbox"
                            bind:checked={showOfficeEvents}
                            class="checkbox checkbox-xs checkbox-info rounded"
                        />
                        <span class="inline-block h-2 w-2 rounded-full bg-sky-500"></span>
                        <span>사무실 일정</span>
                    </label>
                </div>
            {/snippet}
            {#snippet headerRight()}
                <button
                    type="button"
                    onclick={() => openAddModal(selectedDate ? parseDateStrAsLocalDate(selectedDate) : new Date(initialTodayDate))}
                    class="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-95"
                >
                    <Icon icon="solar:add-circle-bold" class="text-sm" />
                    <span>일정 추가</span>
                </button>
            {/snippet}
        </Calendar>
    </main>

    <!-- 하단 기능 카드 영역 (전면 한글화 + 깔끔한 대시보드 스타일) -->
    <div class="flex flex-col gap-8">

        <!-- 개인 집중 일정 & 내 결근계 확인 (사무실 관제 카드와 동일한 단일 풀폭 레이아웃) -->
        <section class="flex flex-col gap-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3">
                    <div class="h-6 w-1.5 rounded-full bg-emerald-500"></div>
                    <h3 class="text-xl font-black tracking-tight text-slate-900">개인 집중 일정 · 내 결근계</h3>
                </div>
                <div class="flex flex-wrap gap-2">
                    <button
                        type="button"
                        onclick={() => openAddModal(selectedDate ? parseDateStrAsLocalDate(selectedDate) : new Date(initialTodayDate), 'PERSONAL')}
                        class="btn btn-sm rounded-xl border-emerald-200 bg-emerald-50 font-black text-emerald-700 hover:bg-emerald-100"
                    >
                        + 개인 일정
                    </button>
                    <a href="/v1/custom/dayoff" class="btn btn-sm btn-outline rounded-xl font-bold">
                        휴무 신청 →
                    </a>
                </div>
            </div>

            <div class="space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div class="flex items-center justify-between">
                    <div>
                        <h4 class="text-base font-black text-slate-900">오늘의 개인 일정 · 본인 결근계 현황</h4>
                        <p class="text-xs font-medium text-slate-400">오늘 예정된 개인 일정과 조회 구간 내 승인·대기 중인 본인 결근계가 함께 표시됩니다.</p>
                    </div>
                    <span class="badge badge-success badge-sm font-black text-white">개인 일정 관리</span>
                </div>

                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div class="space-y-2">
                        <div class="text-xs font-black text-slate-500">오늘 개인 일정 ({todayPersonalSchedules.length}건)</div>
                        {#each todayPersonalSchedules as s}
                            <button
                                type="button"
                                onclick={() => openEditModal(s)}
                                class="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-left transition hover:border-blue-300"
                            >
                                <div class="flex min-w-0 items-center gap-3">
                                    <div class="h-2.5 w-2.5 shrink-0 rounded-full" style="background-color: {s.color || '#10b981'};"></div>
                                    <span class="truncate text-sm font-black text-slate-700">{s.title}</span>
                                </div>
                                <span class="ml-2 shrink-0 font-mono text-[11px] font-bold text-slate-400">{s.time}</span>
                            </button>
                        {:else}
                            <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                                <p class="text-xs font-bold text-slate-400">오늘 예정된 개인 일정이 없습니다.</p>
                            </div>
                        {/each}
                    </div>

                    <div class="space-y-2">
                        <div class="text-xs font-black text-slate-500">이번 조회구간 내 결근계 ({myDayoffs.length}건)</div>
                        {#each myDayoffs.slice(0, 4) as d}
                            <div class="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5">
                                <div class="min-w-0">
                                    <div class="truncate text-xs font-black text-slate-800">{d.title}</div>
                                    <div class="font-mono text-[11px] text-slate-500">
                                        {d.date}{d.endDate ? ` ~ ${d.endDate}` : ''} ({d.days_count}일)
                                    </div>
                                </div>
                                <span class="badge badge-xs font-bold {d.dayoff_status === 'APPROVED' ? 'badge-success text-white' : 'badge-warning'}">
                                    {d.dayoff_status === 'APPROVED' ? '확정' : '대기'}
                                </span>
                            </div>
                        {:else}
                            <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
                                <p class="text-xs font-bold text-slate-400">조회 구간 내 본인 결근계가 없습니다.</p>
                            </div>
                        {/each}
                    </div>
                </div>
            </div>
        </section>

        <!-- 사무실 · 공휴일 및 직원 결근계 관제 (권한자 전용) -->
        {#if isTier2}
            <section class="flex flex-col gap-5">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-3">
                        <div class="h-6 w-1.5 rounded-full bg-blue-600"></div>
                        <h3 class="text-xl font-black tracking-tight text-slate-900">공휴일 · 사무실 일정 및 결근계 관제</h3>
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

                <div class="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                    <div class="flex items-center justify-between">
                        <div>
                            <h4 class="text-base font-black text-slate-900">사무실 직원 결근계 현황 ({officeDayoffs.length}건)</h4>
                            <p class="text-xs font-medium text-slate-400">운전직(선착순) 제외, 사무실 전 직원의 조회 기간 내 휴무/연차 내역입니다.</p>
                        </div>
                        <span class="badge badge-info badge-sm font-black text-white">사무실 통합 관제</span>
                    </div>

                    {#if officeDayoffs.length === 0}
                        <div class="py-8 text-center text-xs font-bold text-slate-400">
                            조회 기간 내 사무실 직원 결근계 내역이 없습니다.
                        </div>
                    {:else}
                        <!-- 모바일 카드 뷰 -->
                        <div class="divide-y divide-slate-100 md:hidden">
                            {#each officeDayoffs as od (od.id)}
                                <div class="space-y-2 py-3.5 first:pt-1 last:pb-1">
                                    <div class="flex items-start justify-between gap-2">
                                        <div class="min-w-0 flex-1">
                                            <div class="flex flex-wrap items-center gap-1.5">
                                                <span class="text-sm font-black text-slate-900">{od.staff_name}</span>
                                                {#if od.primary_group}
                                                    <span class="text-[11px] font-bold text-slate-400">({od.primary_group})</span>
                                                {/if}
                                            </div>
                                        </div>
                                        <span class="badge badge-xs shrink-0 font-black {od.dayoff_status === 'APPROVED' ? 'badge-success text-white' : 'badge-warning'}">
                                            {od.dayoff_status === 'APPROVED' ? '승인' : '대기'}
                                        </span>
                                    </div>
                                    <div class="flex flex-wrap items-center gap-1.5 text-xs">
                                        <span class="rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-black text-slate-700">
                                            {od.dayoff_type}
                                        </span>
                                        <span class="font-mono text-xs font-bold text-slate-700">
                                            {od.date}{od.endDate ? ` ~ ${od.endDate}` : ''} ({od.days_count}일)
                                        </span>
                                    </div>
                                    {#if od.content}
                                        <div class="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed break-words text-slate-600">
                                            {od.content}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>

                        <!-- 데스크톱 테이블 -->
                        <div class="hidden overflow-x-auto md:block">
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

                <!-- 작년 동월 중요 일정 참조 카드 (올해 업무/일정 계획 참조용) -->
                <div class="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <div>
                            <h4 class="text-base font-black text-slate-900">
                                작년 동월({calYear - 1}년 {calMonth + 1}월) 중요 일정 참조 ({lastYearImportantSchedules.length}건)
                            </h4>
                            <p class="text-xs font-medium text-slate-400">
                                전년도 같은 달에 등록된 중요 일정(배경 강조 · 중요도 4점 이상)을 올해 일정 계획에 참고하거나 바로 복사해 등록할 수 있습니다.
                            </p>
                        </div>
                        <span class="badge badge-warning badge-sm font-black text-slate-900">전년도 참조</span>
                    </div>

                    {#if loadingLastYear}
                        <div class="py-8 text-center">
                            <span class="loading loading-md loading-spinner text-blue-600"></span>
                        </div>
                    {:else if lastYearImportantSchedules.length === 0}
                        <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-8 text-center text-xs font-bold text-slate-400">
                            {calYear - 1}년 {calMonth + 1}월에 등록된 중요 일정이 없습니다.
                        </div>
                    {:else}
                        <!-- 모바일 카드 뷰 -->
                        <div class="divide-y divide-slate-100 md:hidden">
                            {#each lastYearImportantSchedules as item (item.id ?? `${item.schedule_id}-${item.date}`)}
                                <div class="space-y-2 py-3.5 first:pt-1 last:pb-1">
                                    <div class="flex items-start justify-between gap-2">
                                        <div class="min-w-0 flex-1 space-y-1">
                                            <div class="flex flex-wrap items-center gap-1.5">
                                                <span class="font-mono text-xs font-black text-slate-700">
                                                    {item.date}{#if item.endDate && item.endDate !== item.date} ~ {item.endDate}{/if}
                                                </span>
                                                <span
                                                    class="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-black text-slate-700"
                                                >
                                                    <span
                                                        class="h-2 w-2 rounded-full"
                                                        style="background-color: {item.color || '#ef4444'};"
                                                    ></span>
                                                    {CATEGORY_META[item.category]?.badge || item.category}
                                                </span>
                                            </div>
                                            <div class="text-sm font-black text-slate-900">{item.title}</div>
                                        </div>
                                        <button
                                            type="button"
                                            onclick={() => copyLastYearScheduleToThisYear(item)}
                                            class="btn btn-xs shrink-0 rounded-lg border-blue-200 bg-blue-50 font-black text-blue-700 hover:bg-blue-100"
                                        >
                                            올해로 복사
                                        </button>
                                    </div>
                                    {#if item.content}
                                        <div class="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed break-words text-slate-600">
                                            {item.content}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>

                        <!-- 데스크톱 테이블 -->
                        <div class="hidden overflow-x-auto md:block">
                            <table class="w-full text-left text-xs">
                                <thead class="border-b border-slate-200 bg-slate-50 font-black text-slate-500">
                                    <tr>
                                        <th class="px-3 py-2.5 whitespace-nowrap">날짜 / 기간</th>
                                        <th class="px-3 py-2.5 whitespace-nowrap">분류</th>
                                        <th class="px-3 py-2.5">내용</th>
                                        <th class="px-3 py-2.5 text-right whitespace-nowrap">올해 적용</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    {#each lastYearImportantSchedules as item (item.id ?? `${item.schedule_id}-${item.date}`)}
                                        <tr class="hover:bg-slate-50">
                                            <td class="px-3 py-2.5 font-mono font-bold text-slate-700 whitespace-nowrap">
                                                {item.date}{#if item.endDate && item.endDate !== item.date} ~ {item.endDate}{/if}
                                            </td>
                                            <td class="px-3 py-2.5 whitespace-nowrap">
                                                <span
                                                    class="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[10px] font-black text-slate-700"
                                                >
                                                    <span
                                                        class="h-2 w-2 rounded-full"
                                                        style="background-color: {item.color || '#ef4444'};"
                                                    ></span>
                                                    {CATEGORY_META[item.category]?.badge || item.category}
                                                </span>
                                            </td>
                                            <td class="px-3 py-2.5">
                                                <div class="font-black text-slate-900">{item.title}</div>
                                                {#if item.content}
                                                    <div class="mt-0.5 text-[11px] font-medium text-slate-500">{item.content}</div>
                                                {/if}
                                            </td>
                                            <td class="px-3 py-2.5 text-right whitespace-nowrap">
                                                <button
                                                    type="button"
                                                    onclick={() => copyLastYearScheduleToThisYear(item)}
                                                    class="btn btn-xs rounded-lg border-blue-200 bg-blue-50 font-black text-blue-700 hover:bg-blue-100"
                                                >
                                                    올해로 복사
                                                </button>
                                            </td>
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

<!-- 일정 등록 / 수정 모달 (전면 한글화 + 중요일정 배경색 전체 적용 안내) -->
{#if showAddModal}
    <div class="modal modal-open p-4">
        <div class="modal-box max-h-[90vh] w-full max-w-2xl overflow-x-hidden overflow-y-auto rounded-3xl border border-base-200 bg-base-100 p-5 shadow-2xl sm:p-8">
            <!-- 모달 헤더 -->
            <div class="mb-7 flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                    <h3 class="text-2xl font-black tracking-tight text-slate-900">
                        {editingScheduleId ? '일정 수정' : '신규 일정 등록'}
                    </h3>
                    <p class="mt-0.5 text-xs font-bold text-slate-400">
                        {editingScheduleId ? '등록된 일정의 내용을 수정하거나 삭제합니다.' : '새로운 개인 또는 사무실 일정을 등록합니다.'}
                    </p>
                </div>
                <button type="button" aria-label="모달 닫기" class="btn btn-circle btn-ghost bg-slate-50" onclick={() => (showAddModal = false)}>
                    <Icon icon="lucide:x" class="text-2xl" />
                </button>
            </div>

            <div class="flex flex-col gap-7">
                <!-- 1. 기본 정보 (제목 및 색상) -->
                <div class="flex flex-col gap-3">
                    <label for="sched-title" class="text-xs font-black text-slate-500">일정 제목 및 색상</label>
                    <div class="flex flex-col items-center gap-4 md:flex-row">
                        <div class="w-full flex-1">
                            <input
                                id="sched-title"
                                type="text"
                                class="input input-ghost w-full rounded-none border-b-4 px-0 text-2xl font-black transition-all outline-none placeholder:opacity-25 focus:bg-transparent sm:text-3xl"
                                placeholder="제목을 입력하세요"
                                bind:value={newSchedule.title}
                                style="color: {newSchedule.color}; border-color: {newSchedule.color}40;"
                            />
                        </div>
                        <div class="flex shrink-0 gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-2">
                            {#each ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#0f172a'] as color}
                                <button
                                    type="button"
                                    aria-label={`색상 ${color}`}
                                    class="h-7 w-7 rounded-full transition-all hover:scale-125 {newSchedule.color === color ? 'scale-110 ring-4 ring-slate-200 ring-offset-2' : 'opacity-60 hover:opacity-100'}"
                                    style="background-color: {color};"
                                    onclick={() => (newSchedule.color = color)}
                                ></button>
                            {/each}
                        </div>
                    </div>
                </div>

                <!-- 2. 시간 방식 및 분류 -->
                <div class="flex flex-col gap-5">
                    <div class="grid grid-cols-1 items-end gap-6 md:grid-cols-2">
                        <div class="flex flex-col gap-2">
                            <span class="text-xs font-black text-slate-500">시간 설정 방식</span>
                            <div class="flex w-fit gap-2 rounded-2xl bg-slate-100 p-1.5">
                                <button
                                    type="button"
                                    class="btn btn-sm rounded-xl border-none px-6 {timeMode === 'all-day' ? 'bg-white font-black text-slate-900 shadow-md' : 'bg-transparent font-bold opacity-50'}"
                                    onclick={() => {
                                        timeMode = 'all-day';
                                        newSchedule.is_all_day = true;
                                        newSchedule.start_at = String(newSchedule.start_at).slice(0, 10);
                                        newSchedule.end_at = String(newSchedule.end_at).slice(0, 10);
                                    }}
                                >종일</button>
                                <button
                                    type="button"
                                    class="btn btn-sm rounded-xl border-none px-6 {timeMode === 'timed' ? 'bg-white font-black text-slate-900 shadow-md' : 'bg-transparent font-bold opacity-50'}"
                                    onclick={() => {
                                        timeMode = 'timed';
                                        newSchedule.is_all_day = false;
                                        if (newSchedule.start_at.length === 10) newSchedule.start_at = `${newSchedule.start_at}T09:00`;
                                        if (newSchedule.end_at.length === 10) newSchedule.end_at = `${newSchedule.end_at}T18:00`;
                                    }}
                                >시간 지정</button>
                            </div>
                        </div>
                        <div class="form-control w-full min-w-0">
                            <label for="sched-cat" class="label text-xs font-black text-slate-500"><span class="label-text">일정 분류</span></label>
                            <select id="sched-cat" class="select select-bordered w-full min-w-0 rounded-xl border-slate-200 bg-slate-50 font-bold" bind:value={newSchedule.category}>
                                <option value="PERSONAL">🙋 개인 일정</option>
                                <option value="ATTENDANCE">💼 근태 기록</option>
                                {#if isTier2}
                                    <option value="OFFICE">🏢 사무실 일정</option>
                                    <option value="GLOBAL">📢 전사 공지</option>
                                    <option value="HOLIDAY">🚩 공휴일 설정</option>
                                {/if}
                            </select>
                        </div>
                    </div>

                    <!-- 날짜/시간 입력 -->
                    <div class="grid grid-cols-1 gap-4 rounded-3xl border border-slate-100 bg-slate-50 p-4 sm:grid-cols-2 sm:p-5">
                        <div class="form-control w-full min-w-0">
                            <label for="sched-start" class="label text-xs font-black text-slate-500"><span class="label-text">시작 {timeMode === 'all-day' ? '날짜' : '일시'}</span></label>
                            <input
                                id="sched-start"
                                type={timeMode === 'all-day' ? 'date' : 'datetime-local'}
                                class="input input-bordered w-full min-w-0 rounded-xl border-slate-200 bg-white font-bold"
                                bind:value={newSchedule.start_at}
                            />
                        </div>
                        <div class="form-control w-full min-w-0">
                            <label for="sched-end" class="label text-xs font-black text-slate-500"><span class="label-text">종료 {timeMode === 'all-day' ? '날짜' : '일시'}</span></label>
                            <input
                                id="sched-end"
                                type={timeMode === 'all-day' ? 'date' : 'datetime-local'}
                                class="input input-bordered w-full min-w-0 rounded-xl border-slate-200 bg-white font-bold"
                                bind:value={newSchedule.end_at}
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label for="sched-content" class="mb-1 block text-xs font-black text-slate-500">메모 (선택)</label>
                    <textarea id="sched-content" rows="2" bind:value={newSchedule.content} placeholder="일정 상세 내용..." class="textarea textarea-bordered w-full rounded-xl bg-slate-50 font-medium"></textarea>
                </div>

                <!-- 3. 중요도, 중요 일정 배경 강조 & 디데이 -->
                <div class="grid grid-cols-1 gap-6 md:grid-cols-2">
                    <div class="space-y-3">
                        <div class="form-control">
                            <span class="label mb-1 text-xs font-black text-slate-500">중요도</span>
                            <div class="rating rating-md gap-1">
                                {#each [1, 2, 3, 4, 5] as i}
                                    <input type="radio" aria-label={`중요도 ${i}`} name="importance" class="mask mask-star-2 bg-warning" checked={newSchedule.importance === i} onclick={() => (newSchedule.importance = i)} />
                                {/each}
                            </div>
                        </div>
                        <label class="flex cursor-pointer items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50/70 p-3 text-xs font-black text-rose-800">
                            <input
                                type="checkbox"
                                class="checkbox checkbox-sm checkbox-error"
                                checked={newSchedule.display_mode === 'background'}
                                onchange={(e) => (newSchedule.display_mode = e.currentTarget.checked ? 'background' : 'bar')}
                            />
                            <span>중요 일정으로 강조 (선택 색상으로 날짜 칸 전체 채움 + 애니메이션)</span>
                        </label>
                    </div>
                    <div class="flex items-center justify-between rounded-[22px] border border-primary/10 bg-primary/5 p-5">
                        <div class="flex items-center gap-4">
                            <div class="rounded-xl bg-primary/10 p-3">
                                <Icon icon="lucide:flag" class="text-xl text-primary" />
                            </div>
                            <div>
                                <h4 class="text-sm font-black">디데이 표시</h4>
                                <p class="text-[11px] font-bold opacity-50">메인 화면 카운트다운</p>
                            </div>
                        </div>
                        <input type="checkbox" aria-label="디데이 표시" class="toggle toggle-primary toggle-md" bind:checked={newSchedule.is_dday} />
                    </div>
                </div>

                {#if newSchedule.is_dday && newSchedule.start_at}
                    <div class="flex items-center justify-between rounded-3xl bg-slate-900 p-5 text-white shadow-xl shadow-slate-200">
                        <div class="flex items-center gap-4">
                            <Icon icon="lucide:zap" class="text-2xl text-yellow-400" />
                            <span class="text-xs font-black opacity-60">디데이 미리보기</span>
                        </div>
                        <span class="text-3xl font-black">
                            {formatDDay(parseDateStrAsLocalDate(newSchedule.start_at.slice(0, 10)), initialTodayDate)}
                        </span>
                    </div>
                {/if}

                <!-- 반복 설정 -->
                <div class="border-t border-base-200 pt-6">
                    <h4 class="mb-3 text-xs font-black text-slate-500">반복 설정</h4>
                    <RecurrenceEditor bind:recurrence={newSchedule.recurrence} />
                </div>

                <div class="modal-action flex flex-wrap items-center justify-between gap-3">
                    <div>
                        {#if editingScheduleId}
                            <button type="button" disabled={saving} class="btn btn-error btn-outline rounded-xl font-bold" onclick={removeEditingSchedule}>삭제</button>
                        {/if}
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button type="button" class="btn btn-ghost rounded-xl font-bold" onclick={() => (showAddModal = false)}>취소</button>
                        <button type="button" disabled={saving} class="btn btn-primary rounded-xl px-6 font-black text-white" onclick={saveSchedule}>
                            {#if saving}<span class="loading loading-xs loading-spinner"></span>{/if}
                            {editingScheduleId ? '수정 저장' : '저장하기'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}
