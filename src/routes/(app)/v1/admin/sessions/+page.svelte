<script>
    import { onMount } from "svelte";
    import * as api from "$lib/api/admin.js";
    import { alertState } from "$lib/runes/alert.svelte.js";

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
</script>

<div class="space-y-10 animate-fade-in text-black font-['Noto_Sans_KR','Outfit'] pb-40 px-4 max-w-7xl mx-auto">
    
    <!-- 📄 상단 헤더 -->
    <div class="border-b-4 border-black pb-8 flex justify-between items-end gap-6">
        <div>
            <span class="text-[10px] font-black tracking-[0.4em] opacity-30 uppercase block mb-2">Session Control</span>
            <h1 class="text-5xl font-black tracking-tighter uppercase italic">세션 <span class="text-blue-600 NOT-ITALIC">관리자</span></h1>
            <p class="text-xs font-bold opacity-40 mt-3">현재 활성화된 모든 사용자 세션을 확인하고 강제로 종료할 수 있습니다.</p>
        </div>
        <button class="btn btn-black rounded-none px-10 h-14 font-black border border-black hover:bg-white hover:text-black transition-all" onclick={loadSessions} disabled={loading}>
            {#if loading}
                <span class="loading loading-spinner"></span>
            {:else}
                목록 새로고침
            {/if}
        </button>
    </div>

    <!-- 📊 세션 목록 테이블 -->
    <div class="overflow-x-auto border-2 border-black bg-white">
        <table class="table table-zebra">
            <thead class="bg-slate-900 text-white font-black text-xs uppercase">
                <tr>
                    <th>ID</th>
                    <th>User</th>
                    <th>Device</th>
                    <th>Status</th>
                    <th>Login At</th>
                    <th>Logout At</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {#if loading}
                    <tr><td colspan="7" class="text-center py-20"><span class="loading loading-dots loading-lg"></span></td></tr>
                {:else if sessions.length === 0}
                    <tr><td colspan="7" class="text-center py-20 font-bold opacity-30">활성화된 세션이 없습니다.</td></tr>
                {:else}
                    {#each sessions as session (session.id)}
                        <tr class="hover">
                            <td class="font-mono text-xs">{session.id}</td>
                            <td class="font-bold">{session.username || session.user_id}</td>
                            <td><span class="font-mono text-xs px-2 py-1 rounded-full bg-slate-200">{session.device_category}</span></td>
                            <td>
                                {#if session.status === 'ACTIVE'}
                                    <span class="font-bold text-success">● ACTIVE</span>
                                {:else if session.status === 'KICKED_OUT'}
                                    <span class="font-bold text-error">● KICKED</span>
                                {:else}
                                    <span class="opacity-50">{session.status}</span>
                                {/if}
                            </td>
                            <td class="text-xs">{new Date(session.login_at).toLocaleString()}</td>
                            <td class="text-xs">{session.logout_at ? new Date(session.logout_at).toLocaleString() : '-'}</td>
                            <td>
                                {#if session.status === 'ACTIVE'}
                                    <button class="btn btn-xs btn-outline btn-error rounded-none font-black" onclick={() => kickSession(session.id)}>
                                        Kick
                                    </button>
                                {/if}
                            </td>
                        </tr>
                    {/each}
                {/if}
            </tbody>
        </table>
    </div>
</div>
