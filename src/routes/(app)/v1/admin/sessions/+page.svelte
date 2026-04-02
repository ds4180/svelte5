<script>
    import { onMount } from "svelte";
    import * as api from "$lib/api/admin.js";
    import { alertState } from "$lib/runes/alert.svelte.js";
    import Icon from '@iconify/svelte';

    let sessions = $state([]);
    let loading = $state(true);

    async function loadSessions() {
        loading = true;
        try {
            sessions = await api.adminGetSessions();
        } catch (e) {
            alertState.send(e.message, { level: 3, style: 'error' });
        } finally {
            loading = false;
        }
    }

    async function kickSession(sessionId) {
        if (!confirm(`정말 이 세션(ID: ${sessionId})을 강제로 종료하시겠습니까?`)) return;
        try {
            await api.adminKickSession(sessionId);
            alertState.send("세션이 강제로 종료되었습니다.", { level: 2, style: 'info' });
            await loadSessions(); // 목록 새로고침
        } catch (e) {
            alertState.send(e.message, { level: 3, style: 'error' });
        }
    }

    onMount(loadSessions);

    // 시간 포맷터
    function formatDateTime(dateString) {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('ko-KR', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
    }
</script>

<div class="space-y-6 md:space-y-10 animate-fade-in font-['Noto_Sans_KR','Outfit'] pb-20 md:pb-40 px-4 md:px-6 lg:px-8 max-w-7xl mx-auto">
    
    <!-- 📄 상단 헤더 -->
    <div class="border-b-2 md:border-b-4 border-slate-900 pb-6 md:pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4 md:gap-6">
        <div>
            <span class="text-[8px] md:text-[10px] font-black tracking-[0.2em] md:tracking-[0.4em] text-slate-400 uppercase block mb-1 md:mb-2">System Infrastructure</span>
            <h1 class="text-3xl md:text-5xl font-black tracking-tighter uppercase italic text-slate-900">세션 <span class="text-blue-600 NOT-ITALIC">모니터링 <Icon icon="mdi:monitor-lock-outline" class="inline-block align-text-bottom text-blue-600 ml-1" /></span></h1>
            <p class="text-xs md:text-sm font-bold text-slate-500 mt-2 md:mt-3">현재 활성화된 모든 사용자 세션을 실시간으로 확인하고 제어합니다.</p>
        </div>
        <div class="flex gap-2 md:gap-4">
             <a href="/v1/admin" class="btn btn-sm md:btn-lg bg-slate-200 text-slate-700 rounded-lg md:rounded-2xl px-4 md:px-8 font-black hover:bg-slate-300 border-none transition-all shadow-md md:shadow-xl">
                <Icon icon="mdi:home-outline" class="w-4 h-4 md:w-6 md:h-6" />
                홈으로
            </a>
            <button class="btn btn-sm md:btn-lg bg-slate-900 text-white rounded-lg md:rounded-2xl px-4 md:px-8 font-black hover:bg-slate-800 border-none transition-all shadow-md md:shadow-xl" onclick={loadSessions} disabled={loading}>
                {#if loading}
                    <span class="loading loading-spinner"></span>
                {:else}
                    <Icon icon="mdi:refresh" class="w-4 h-4 md:w-6 md:h-6" />
                    목록 새로고침
                {/if}
            </button>
        </div>
    </div>

    <!-- 📊 세션 목록 테이블 (Desktop/Tablet) -->
    <div class="hidden sm:block overflow-hidden rounded-xl md:rounded-[2rem] border border-slate-200 bg-white shadow-lg md:shadow-2xl">
        <table class="table w-full">
            <!-- 헤더: 밝은 회색 배경으로 변경하여 검은색 텍스트와의 대비 확보 -->
            <thead class="bg-slate-50 text-slate-500 font-bold text-[8px] md:text-[10px] uppercase tracking-widest border-b border-slate-100">
                <tr>
                    <th class="py-4 px-4 md:py-6 md:px-8">ID (JTI)</th>
                    <th>사용자</th>
                    <th>디바이스</th>
                    <th>상태</th>
                    <th>로그인 일시</th>
                    <th>마지막 활동</th>
                    <th class="text-right px-4 md:px-8">작업</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
                {#if loading}
                    <tr><td colspan="7" class="text-center py-16 md:py-32"><span class="loading loading-bars loading-lg text-blue-600"></span></td></tr>
                {:else if sessions.length === 0}
                    <tr><td colspan="7" class="text-center py-16 md:py-32 font-bold text-slate-300 italic text-xl">활성화된 세션이 없습니다.</td></tr>
                {:else}
                    {#each sessions as session (session.id)}
                        <tr class="hover:bg-slate-50/50 transition-colors group">
                            <td class="py-3 px-4 md:py-5 md:px-8">
                                <span class="font-mono text-[8px] md:text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-sm md:rounded-md group-hover:bg-white transition-colors">
                                    {session.session_key?.substring(0, 12) || session.id}...
                                </span>
                            </td>
                            <td>
                                <div class="flex flex-col">
                                    <span class="font-black text-slate-900 text-sm md:text-base">{session.username || 'Unknown'}</span>
                                    <span class="text-[8px] md:text-[10px] text-slate-400 font-bold">UID: {session.user_id}</span>
                                </div>
                            </td>
                            <td>
                                <span class="flex items-center gap-1 px-2 py-0.5 rounded-md text-[8px] md:text-[10px] font-black tracking-tighter {session.device_category === 'MOBILE' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}">
                                    <Icon icon={session.device_category === 'MOBILE' ? 'mdi:cellphone' : 'mdi:desktop-mac-dashboard'} class="w-2 h-2 md:w-3 md:h-3"/>
                                    {session.device_category}
                                </span>
                            </td>
                            <td>
                                {#if session.status === 'ACTIVE'}
                                    <div class="flex items-center gap-1 md:gap-2">
                                        <span class="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
                                            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                            <span class="relative inline-flex rounded-full h-1.5 w-1.5 md:h-2 md:w-2 bg-green-500"></span>
                                        </span>
                                        <span class="font-black text-[8px] md:text-xs text-green-600 uppercase">Active</span>
                                    </div>
                                {:else if session.status === 'KICKED_OUT'}
                                    <div class="flex items-center gap-1 md:gap-2">
                                        <Icon icon="mdi:logout" class="w-3 h-3 text-red-500" />
                                        <span class="font-bold text-[8px] md:text-xs text-red-500 uppercase">Kicked</span>
                                    </div>
                                {:else}
                                    <span class="font-bold text-[8px] md:text-xs text-slate-300 uppercase italic">{session.status}</span>
                                {/if}
                            </td>
                            <td class="text-[8px] md:text-xs font-medium text-slate-500">
                                {formatDateTime(session.login_at)}
                            </td>
                            <td class="text-[8px] md:text-xs font-medium text-slate-500">
                                {session.logout_at ? formatDateTime(session.logout_at) : '현재 접속 중'}
                            </td>
                            <td class="text-right px-4 md:px-8">
                                {#if session.status === 'ACTIVE'}
                                    <button class="btn btn-xs md:btn-sm btn-ghost text-red-500 hover:bg-red-50 hover:text-red-700 font-black rounded-lg md:rounded-xl px-2 md:px-4">
                                        <Icon icon="mdi:power-plug-off-outline" class="w-3 h-3" />
                                        KICK
                                    </button>
                                {/if}
                            </td>
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    </div>

    <!-- 📈 세션 목록 카드 (Mobile) -->
    <div class="sm:hidden space-y-4">
        {#if loading}
            <div class="text-center py-16"><span class="loading loading-bars loading-lg text-blue-600"></span></div>
        {:else if sessions.length === 0}
            <div class="text-center py-16 font-bold text-slate-300 italic text-xl">활성화된 세션이 없습니다.</div>
        {:else}
            {#each sessions as session (session.id)}
                <div class="bg-white rounded-xl shadow-lg border border-slate-200 p-4 space-y-3">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="font-black text-slate-900 text-base">{session.username || 'Unknown'}</span>
                            <span class="text-[10px] text-slate-400 font-bold">UID: {session.user_id}</span>
                        </div>
                        <span class="px-2 py-0.5 rounded-md text-[8px] font-black tracking-tighter {session.device_category === 'MOBILE' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}">
                            <Icon icon={session.device_category === 'MOBILE' ? 'mdi:cellphone' : 'mdi:desktop-mac-dashboard'} class="w-3 h-3 inline-block align-middle mr-1"/>
                            {session.device_category}
                        </span>
                    </div>
                    
                    <div class="flex justify-between text-xs text-slate-500">
                        <span><span class="font-semibold">로그인:</span> {formatDateTime(session.login_at)}</span>
                        <span>
                            {#if session.status === 'ACTIVE'}
                                <span class="flex items-center gap-1 font-black text-green-600 uppercase">
                                    <span class="relative flex h-2 w-2">
                                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                                    </span>
                                    Active
                                </span>
                            {:else if session.status === 'KICKED_OUT'}
                                <span class="flex items-center gap-1 font-bold text-red-500 uppercase">
                                    <Icon icon="mdi:logout" class="w-3 h-3" />
                                    Kicked
                                </span>
                            {:else}
                                <span class="font-bold text-slate-300 uppercase italic">{session.status}</span>
                            {/if}
                        </span>
                    </div>
                    <div class="flex justify-between text-xs text-slate-500">
                        <span><span class="font-semibold">종료:</span> {session.logout_at ? formatDateTime(session.logout_at) : '현재 접속 중'}</span>
                        <div class="text-right">
                            {#if session.status === 'ACTIVE'}
                                <button class="btn btn-xs btn-ghost text-red-500 hover:bg-red-50 hover:text-red-700 font-black rounded-lg px-2">
                                    <Icon icon="mdi:power-plug-off-outline" class="w-3 h-3" />
                                    KICK
                                </button>
                            {/if}
                        </div>
                    </div>
                </div>
            {/each}
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
</style>