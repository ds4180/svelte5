<script>
    import { onMount } from "svelte";
    import * as api from "$lib/api/admin.js";
    import { alertState } from "$lib/runes/alert.svelte.js";
    import Icon from '@iconify/svelte';

    let alerts = $state([]);
    let loading = $state(true);
    let showCreateModal = $state(false);
    let showEditModal = $state(false);
    let newAlert = $state({
        message: '',
        level: 1,
        style: 'info',
        position: 'top',
        start_date: new Date().toISOString().slice(0, 16),
        end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 16),
        reset_sec: 0,
        confirm_text: '',
        redirect_url: '',
        route: '',
        is_active: true
    });
    let editingAlert = $state(null);

    async function loadAlerts() {
        loading = true;
        try {
            alerts = await api.adminGetAlerts();
        } catch (e) {
            alertState.send(e.message, { level: 3, style: 'error' });
        } finally {
            loading = false;
        }
    }

    async function createAlert() {
        try {
            // 날짜 형식 변환 (ISO string -> Date 객체)
            const alertData = {
                ...newAlert,
                start_date: new Date(newAlert.start_date),
                end_date: new Date(newAlert.end_date),
                level: parseInt(newAlert.level) // 문자열로 넘어올 수 있으므로 정수 변환
            };
            await api.adminCreateAlert(alertData);
            alertState.send("새 알림이 생성되었습니다.", { level: 2, style: 'info' });
            showCreateModal = false;
            await loadAlerts();
        } catch (e) {
            alertState.send(e.message, { level: 3, style: 'error' });
        }
    }

    function openEditModal(alert) {
        editingAlert = { ...alert }; // 원본 객체 변경 방지를 위해 복사
        editingAlert.level = String(editingAlert.level); // select box가 string 값을 기대할 수 있으므로 변환
        // 날짜를 input[type="datetime-local"]에 맞게 포맷
        editingAlert.start_date = formatDateForInput(editingAlert.start_date);
        editingAlert.end_date = formatDateForInput(editingAlert.end_date);
        showEditModal = true;
    }

    async function updateAlert() {
        try {
            const alertData = {
                ...editingAlert,
                start_date: new Date(editingAlert.start_date),
                end_date: new Date(editingAlert.end_date),
                level: parseInt(editingAlert.level) // 문자열로 넘어올 수 있으므로 정수 변환
            };
            await api.adminUpdateAlert(editingAlert.id, alertData);
            alertState.send("알림이 수정되었습니다.", { level: 2, style: 'info' });
            showEditModal = false;
            await loadAlerts();
        } catch (e) {
            alertState.send(e.message, { level: 3, style: 'error' });
        }
    }

    async function toggleAlertStatus(alertId) {
        try {
            await api.adminToggleAlert(alertId);
            alertState.send("알림 상태가 변경되었습니다.", { level: 2, style: 'info' });
            await loadAlerts();
        } catch (e) {
            alertState.send(e.message, { level: 3, style: 'error' });
        }
    }

    async function deleteAlert(alertId) {
        if (!confirm('정말 이 알림을 삭제하시겠습니까?')) return;
        try {
            await api.adminDeleteAlert(alertId);
            alertState.send("알림이 삭제되었습니다.", { level: 2, style: 'info' });
            await loadAlerts();
        } catch (e) {
            alertState.send(e.message, { level: 3, style: 'error' });
        }
    }

    onMount(loadAlerts);

    // 시간 포맷터
    function formatDateTime(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
    }

    // 날짜 input용 포맷터 (ISO 8601 형식: YYYY-MM-DDTHH:mm)
    function formatDateForInput(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
</script>

<div class="space-y-6 md:space-y-10 animate-fade-in font-['Noto_Sans_KR','Outfit'] pb-20 md:pb-40 px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
    
    <!-- 📄 상단 헤더 -->
    <div class="border-b-2 md:border-b-4 border-slate-900 pb-6 md:pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-6">
        <div>
            <span class="text-[8px] md:text-[10px] font-black tracking-[0.2em] md:tracking-[0.4em] text-slate-400 uppercase block mb-1 md:mb-2">System Notification</span>
            <h1 class="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-slate-900">알림 <span class="text-blue-600 NOT-ITALIC">관리자 <Icon icon="mdi:bell-cog-outline" class="inline-block align-text-bottom text-blue-600 ml-1" /></span></h1>
            <p class="text-xs md:text-sm font-bold text-slate-500 mt-2 md:mt-3">시스템 전역 알림을 생성, 조회, 수정, 삭제합니다.</p>
        </div>
        <div class="flex gap-2 md:gap-4">
             <button class="btn btn-sm md:btn-lg bg-blue-600 text-white rounded-lg md:rounded-2xl px-4 md:px-8 font-black hover:bg-blue-700 border-none transition-all shadow-md md:shadow-xl" onclick={() => showCreateModal = true}>
                <Icon icon="mdi:plus-circle-outline" class="w-4 h-4 md:w-6 md:h-6" />
                새 알림 생성
            </button>
            <a href="/v1/admin" class="btn btn-sm md:btn-lg bg-slate-200 text-slate-700 rounded-lg md:rounded-2xl px-4 md:px-8 font-black hover:bg-slate-300 border-none transition-all shadow-md md:shadow-xl">
                <Icon icon="mdi:home-outline" class="w-4 h-4 md:w-6 md:h-6" />
                홈으로
            </a>
            <button class="btn btn-sm md:btn-lg bg-slate-900 text-white rounded-lg md:rounded-2xl px-4 md:px-8 font-black hover:bg-slate-800 border-none transition-all shadow-md md:shadow-xl" onclick={loadAlerts} disabled={loading}>
                {#if loading}
                    <span class="loading loading-spinner"></span>
                {:else}
                    <Icon icon="mdi:refresh" class="w-4 h-4 md:w-6 md:h-6" />
                    목록 새로고침
                {/if}
            </button>
        </div>
    </div>

    <!-- 📊 알림 목록 테이블 (Desktop/Tablet) -->
    <div class="hidden sm:block overflow-hidden rounded-xl md:rounded-[2rem] border border-slate-200 bg-white shadow-lg md:shadow-2xl">
        <table class="table w-full">
            <!-- 헤더 -->
            <thead class="bg-slate-50 text-slate-500 font-bold text-[8px] md:text-[10px] uppercase tracking-widest border-b border-slate-100">
                <tr>
                    <th class="py-4 px-4 md:py-6 md:px-8">ID</th>
                    <th>메시지</th>
                    <th>레벨</th>
                    <th>유형</th>
                    <th>기간</th>
                    <th>활성</th>
                    <th>생성일</th>
                    <th class="text-right px-4 md:px-8">작업</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
                {#if loading}
                    <tr><td colspan="8" class="text-center py-16 md:py-32"><span class="loading loading-bars loading-lg text-blue-600"></span></td></tr>
                {:else if alerts.length === 0}
                    <tr><td colspan="8" class="text-center py-16 md:py-32 font-bold text-slate-300 italic text-xl">생성된 알림이 없습니다.</td></tr>
                {:else}
                    {#each alerts as alert (alert.id)}
                        <tr class="hover:bg-slate-50/50 transition-colors group">
                            <td class="py-3 px-4 md:py-5 md:px-8">
                                <span class="font-mono text-[8px] md:text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-sm md:rounded-md group-hover:bg-white transition-colors">
                                    {alert.id}
                                </span>
                            </td>
                            <td>
                                <div class="flex flex-col">
                                    <span class="font-black text-slate-900 text-sm md:text-base">{alert.message}</span>
                                </div>
                            </td>
                            <td>
                                <span class="px-2 py-0.5 rounded-md text-[8px] md:text-[10px] font-black tracking-tighter {alert.level === 5 ? 'bg-red-100 text-red-700' : alert.level === 4 ? 'bg-purple-100 text-purple-700' : alert.level === 3 ? 'bg-yellow-100 text-yellow-700' : alert.level === 2 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}">
                                    L{alert.level}
                                </span>
                            </td>
                            <td>
                                <span class="px-2 py-0.5 rounded-md text-[8px] md:text-[10px] font-black tracking-tighter capitalize bg-slate-100 text-slate-700">
                                    {alert.style}
                                </span>
                            </td>
                            <td class="text-[8px] md:text-xs font-medium text-slate-500">
                                {formatDateTime(alert.start_date)}<br>
                                {formatDateTime(alert.end_date)}
                            </td>
                            <td>
                                <button class="btn btn-xs btn-ghost {alert.is_active ? 'text-green-500' : 'text-red-500'}" onclick={() => toggleAlertStatus(alert.id)}>
                                    <Icon icon="mdi:toggle-{alert.is_active ? 'switch' : 'switch-off'}" class="w-4 h-4" />
                                    {alert.is_active ? '활성' : '비활성'}
                                </button>
                            </td>
                            <td class="text-[8px] md:text-xs font-medium text-slate-500">
                                {formatDateTime(alert.created_at)}
                            </td>
                            <td class="text-right px-4 md:px-8">
                                <div class="flex justify-end gap-1">
                                    <button class="btn btn-xs btn-ghost text-blue-500 hover:bg-blue-50 hover:text-blue-700 font-black rounded-lg px-2" onclick={() => openEditModal(alert)}>
                                        <Icon icon="mdi:pencil-outline" class="w-3 h-3" />
                                        수정
                                    </button>
                                    <button class="btn btn-xs btn-ghost text-red-500 hover:bg-red-50 hover:text-red-700 font-black rounded-lg px-2" onclick={() => deleteAlert(alert.id)}>
                                        <Icon icon="mdi:delete-outline" class="w-3 h-3" />
                                        삭제
                                    </button>
                                </div>
                            </td>
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    </div>

    <!-- 📈 알림 목록 카드 (Mobile) -->
    <div class="sm:hidden space-y-4">
        {#if loading}
            <div class="text-center py-16"><span class="loading loading-bars loading-lg text-blue-600"></span></div>
        {:else if alerts.length === 0}
            <div class="text-center py-16 font-bold text-slate-300 italic text-xl">생성된 알림이 없습니다.</div>
        {:else}
            {#each alerts as alert (alert.id)}
                <div class="bg-white rounded-xl shadow-lg border border-slate-200 p-4 space-y-3">
                    <div class="flex items-center justify-between">
                        <div class="flex flex-col">
                             <span class="font-black text-slate-900 text-base">ID: {alert.id}</span>
                             <span class="text-[10px] text-slate-500">메시지: {alert.message}</span>
                        </div>
                        <span class="px-2 py-0.5 rounded-md text-[8px] font-black tracking-tighter {alert.level === 5 ? 'bg-red-100 text-red-700' : alert.level === 4 ? 'bg-purple-100 text-purple-700' : alert.level === 3 ? 'bg-yellow-100 text-yellow-700' : alert.level === 2 ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}">
                            L{alert.level}
                        </span>
                    </div>
                    
                    <div class="flex justify-between text-xs text-slate-500">
                        <span><span class="font-semibold">유형:</span> <span class="capitalize">{alert.style}</span> / <span class="capitalize">{alert.position}</span></span>
                        <span><span class="font-semibold">활성:</span> 
                            <button class="btn btn-xs btn-ghost {alert.is_active ? 'text-green-500' : 'text-red-500'}" onclick={() => toggleAlertStatus(alert.id)}>
                                <Icon icon="mdi:toggle-{alert.is_active ? 'switch' : 'switch-off'}" class="w-4 h-4" />
                                {alert.is_active ? '활성' : '비활성'}
                            </button>
                        </span>
                    </div>
                    <div class="text-xs text-slate-500">
                        <span class="font-semibold">기간:</span> {formatDateTime(alert.start_date)} ~ {formatDateTime(alert.end_date)}
                    </div>
                    <div class="flex justify-between items-center text-xs text-slate-500">
                        <span><span class="font-semibold">생성:</span> {formatDateTime(alert.created_at)}</span>
                        <div class="flex gap-1">
                            <button class="btn btn-xs btn-ghost text-blue-500 hover:bg-blue-50 hover:text-blue-700 font-black rounded-lg px-2" onclick={() => openEditModal(alert)}>
                                <Icon icon="mdi:pencil-outline" class="w-3 h-3" />
                                수정
                            </button>
                            <button class="btn btn-xs btn-ghost text-red-500 hover:bg-red-50 hover:text-red-700 font-black rounded-lg px-2" onclick={() => deleteAlert(alert.id)}>
                                <Icon icon="mdi:delete-outline" class="w-3 h-3" />
                                삭제
                            </button>
                        </div>
                    </div>
                </div>
            {/each}
        {/if}
    </div>

    <!-- 🆕 새 알림 생성 모달 -->
    {#if showCreateModal}
        <div class="fixed inset-0 bg-black bg-opacity-50 z-[9999]">
            <div class="bg-white rounded-2xl shadow-2xl p-6 md:p-8 w-11/12 max-w-2xl max-h-[calc(100vh-theme(spacing.16))] overflow-y-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <h3 class="font-bold text-2xl text-slate-900 mb-4">새 알림 생성</h3>
                
                <form onsubmit={(e) => { e.preventDefault(); createAlert(); }} class="space-y-4">
                    <div>
                        <label class="label"><span class="label-text">메시지</span></label>
                        <textarea placeholder="알림 메시지" class="textarea textarea-bordered w-full rounded-lg bg-white text-slate-900" bind:value={newAlert.message} required></textarea>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="label"><span class="label-text">레벨 (1-5)</span></label>
                            <select class="select select-bordered w-full rounded-lg bg-white text-slate-900" bind:value={newAlert.level}>
                                <option value="1">1 (일반 알림 - Toast)</option>
                                <option value="2">2 (상태 배너)</option>
                                <option value="3">3 (일반 확인 - Modal)</option>
                                <option value="4">4 (강제 지시 - Timed Modal)</option>
                                <option value="5">5 (시스템 락 - Full Screen)</option>
                            </select>
                        </div>
                        <div>
                            <label class="label"><span class="label-text">스타일</span></label>
                            <select class="select select-bordered w-full rounded-lg bg-white text-slate-900" bind:value={newAlert.style}>
                                <option value="info">Info (정보)</option>
                                <option value="success">Success (성공)</option>
                                <option value="warning">Warning (경고)</option>
                                <option value="error">Error (에러)</option>
                                <option value="danger">Danger (긴급)</option>
                            </select>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="label"><span class="label-text">시작일시</span></label>
                            <input type="datetime-local" class="input input-bordered w-full rounded-lg bg-white text-slate-900" bind:value={newAlert.start_date} />
                        </div>
                        <div>
                            <label class="label"><span class="label-text">종료일시</span></label>
                            <input type="datetime-local" class="input input-bordered w-full rounded-lg bg-white text-slate-900" bind:value={newAlert.end_date} />
                        </div>
                    </div>
                    <div>
                        <label class="label"><span class="label-text">경로 (콤마로 구분, 예: /v1/admin, /users/*)</span></label>
                        <input type="text" placeholder="적용 경로" class="input input-bordered w-full rounded-lg bg-white text-slate-900" bind:value={newAlert.route} />
                    </div>
                    <div>
                        <label class="label"><span class="label-text">리다이렉트 URL</span></label>
                        <input type="url" placeholder="확인 후 이동할 URL" class="input input-bordered w-full rounded-lg bg-white text-slate-900" bind:value={newAlert.redirect_url} />
                    </div>
                    <div class="flex items-center gap-4">
                        <label class="label cursor-pointer"><span class="label-text mr-2">활성 상태</span>
                            <input type="checkbox" class="toggle toggle-primary" bind:checked={newAlert.is_active} />
                        </label>
                        <label class="label cursor-pointer"><span class="label-text mr-2">정독 대기 시간 (L4 전용, 초)</span>
                            <input type="number" class="input input-bordered w-20 rounded-lg bg-white text-slate-900" bind:value={newAlert.reset_sec} min="0" max="60" />
                        </label>
                    </div>

                    <div class="mt-6 flex justify-end gap-2">
                        <button type="button" class="btn btn-ghost rounded-lg" onclick={() => showCreateModal = false}>취소</button>
                        <button type="submit" class="btn btn-primary rounded-lg">생성</button>
                    </div>
                </form>
            </div>
        </div>
    {/if}

    <!-- ✏️ 알림 수정 모달 -->
    {#if showEditModal && editingAlert}
        <div class="fixed inset-0 bg-black bg-opacity-50 z-[9999]">
            <div class="bg-white rounded-2xl shadow-2xl p-6 md:p-8 w-11/12 max-w-2xl max-h-[calc(100vh-theme(spacing.16))] overflow-y-auto absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                <h3 class="font-bold text-2xl text-slate-900 mb-4">알림 수정 (ID: {editingAlert.id})</h3>
                
                <form onsubmit={(e) => { e.preventDefault(); updateAlert(); }} class="space-y-4">
                    <div>
                        <label class="label"><span class="label-text">메시지</span></label>
                        <textarea placeholder="알림 메시지" class="textarea textarea-bordered w-full rounded-lg bg-white text-slate-900" bind:value={editingAlert.message} required></textarea>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="label"><span class="label-text">레벨 (1-5)</span></label>
                            <select class="select select-bordered w-full rounded-lg bg-white text-slate-900" bind:value={editingAlert.level}>
                                <option value="1">1 (일반 알림 - Toast)</option>
                                <option value="2">2 (상태 배너)</option>
                                <option value="3">3 (일반 확인 - Modal)</option>
                                <option value="4">4 (강제 지시 - Timed Modal)</option>
                                <option value="5">5 (시스템 락 - Full Screen)</option>
                            </select>
                        </div>
                        <div>
                            <label class="label"><span class="label-text">스타일</span></label>
                            <select class="select select-bordered w-full rounded-lg bg-white text-slate-900" bind:value={editingAlert.style}>
                                <option value="info">Info (정보)</option>
                                <option value="success">Success (성공)</option>
                                <option value="warning">Warning (경고)</option>
                                <option value="error">Error (에러)</option>
                                <option value="danger">Danger (긴급)</option>
                            </select>
                        </div>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="label"><span class="label-text">시작일시</span></label>
                            <input type="datetime-local" class="input input-bordered w-full rounded-lg bg-white text-slate-900" bind:value={editingAlert.start_date} />
                        </div>
                        <div>
                            <label class="label"><span class="label-text">종료일시</span></label>
                            <input type="datetime-local" class="input input-bordered w-full rounded-lg bg-white text-slate-900" bind:value={editingAlert.end_date} />
                        </div>
                    </div>
                    <div>
                        <label class="label"><span class="label-text">경로 (콤마로 구분, 예: /v1/admin, /users/*)</span></label>
                        <input type="text" placeholder="적용 경로" class="input input-bordered w-full rounded-lg bg-white text-slate-900" bind:value={editingAlert.route} />
                    </div>
                    <div>
                        <label class="label"><span class="label-text">리다이렉트 URL</span></label>
                        <input type="url" placeholder="확인 후 이동할 URL" class="input input-bordered w-full rounded-lg bg-white text-slate-900" bind:value={editingAlert.redirect_url} />
                    </div>
                    <div class="flex items-center gap-4">
                        <label class="label cursor-pointer"><span class="label-text mr-2">활성 상태</span>
                            <input type="checkbox" class="toggle toggle-primary" bind:checked={editingAlert.is_active} />
                        </label>
                        <label class="label cursor-pointer"><span class="label-text mr-2">정독 대기 시간 (L4 전용, 초)</span>
                            <input type="number" class="input input-bordered w-20 rounded-lg bg-white text-slate-900" bind:value={editingAlert.reset_sec} min="0" max="60" />
                        </label>
                    </div>

                    <div class="mt-6 flex justify-end gap-2">
                        <button type="button" class="btn btn-ghost rounded-lg" onclick={() => showEditModal = false}>취소</button>
                        <button type="submit" class="btn btn-primary rounded-lg">수정</button>
                    </div>
                </form>
            </div>
        </div>
    {/if}
</div>

<style>
    .animate-fade-in {
        animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(20px); }
        to { opacity: 1; transform: translateY(0); }
    }
</style>