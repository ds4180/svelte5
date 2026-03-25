<script>
    /**
     * @file (app)/v1/admin/apps/+page.svelte
     * @description 시스템 앱(App) 및 서비스(Service) 엔진 레지스트리 관리자 (Svelte 5)
     * @modernization DaisyUI + 1px 고대비 오피스 디자인 (벤토 그리드) 적용
     */
    import { onMount } from "svelte";
    import * as api from "$lib/api/admin.js";
    import { alertState } from "$lib/runes/alert.svelte.js";
    import { fade, fly } from "svelte/transition";

    let apps = $state([]);
    let loading = $state(true);
    let editingApp = $state({
        app_id: "", title: "", description: "", 
        frontend_route: "", admin_route: "", config_schema: {}, is_active: true
    });

    /**
     * @function loadApps
     * @description DB로부터 등록된 앱 엔진 목록 로드
     */
    async function loadApps() {
        loading = true;
        try {
            apps = await api.adminGetApps();
            console.log("🛠️ App Registry Loaded:", apps.length);
        } catch (e) {
            alertState.send(e.message, { level: 3, style: 'error' });
        } finally {
            loading = false;
        }
    }

    onMount(loadApps);

    function startEdit(app) {
        editingApp = { ...app };
        document.getElementById("form-anchor")?.scrollIntoView({ behavior: 'smooth' });
    }

    function resetForm() {
        editingApp = { app_id: "", title: "", description: "", frontend_route: "", admin_route: "", config_schema: {}, is_active: true };
    }

    async function handleSave() {
        try {
            // ID 가 이미 있으면 업데이트, 없으면 생성 (생성 API 부재 시 업데이트만 우선 구현)
            await api.adminUpdateApp(editingApp.app_id, editingApp);
            alertState.send("앱 엔진 설정이 업데이트되었습니다.", { level: 1, style: 'success' });
            resetForm();
            await loadApps();
        } catch (e) {
            alertState.send(e.message, { level: 3, style: 'error' });
        }
    }
</script>

<div class="space-y-12 animate-fade-in text-black font-['Outfit'] pb-40">
    
    <!-- 📄 Page Title (1px Border Hero) -->
    <div class="border-b-4 border-black pb-8 flex justify-between items-end">
        <div>
            <span class="text-[10px] font-black tracking-[0.4em] opacity-30 uppercase block mb-2">Engine Infrastructure Registry</span>
            <h1 class="text-5xl font-black tracking-tighter uppercase italic italic">App <span class="text-blue-600 NOT-ITALIC">Registry</span></h1>
            <p class="text-xs font-bold opacity-40 mt-3">게시판, 캘린더 등 시스템을 구성하는 독립 엔진들의 메타데이터를 관리합니다.</p>
        </div>
        <button class="btn btn-black rounded-none px-10 h-14 font-black uppercase tracking-widest border border-black hover:bg-white hover:text-black transition-all" onclick={loadApps}>
            Sync Registry
        </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        <!-- 📦 등록된 앱 엔진 목록 (벤토 그리드 스타일) -->
        <div class="lg:col-span-7 space-y-6">
            <h3 class="text-xl font-black uppercase tracking-tighter italic mb-4">Registered Engines</h3>
            
            {#if loading}
                <div class="h-60 border border-black border-dashed flex items-center justify-center grayscale opacity-10 font-black italic uppercase">Analyzing Registry...</div>
            {:else}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {#each apps as app (app.app_id)}
                        <div class="border-2 border-black p-6 bg-white transition-all group hover:bg-slate-50 relative overflow-hidden">
                            {#if !app.is_active}
                                <div class="absolute inset-0 bg-white/80 z-10 flex items-center justify-center font-black text-red-500 uppercase tracking-widest">Disabled</div>
                            {/if}
                            <div class="flex justify-between items-start mb-4">
                                <div class="w-10 h-10 bg-black text-white flex items-center justify-center font-black text-xs uppercase">
                                    {app.app_id.substring(0, 2)}
                                </div>
                                <button class="btn btn-xs btn-outline border-black rounded-none font-black text-[9px] uppercase hover:bg-black hover:text-white" onclick={() => startEdit(app)}>Modify</button>
                            </div>
                            <h4 class="text-lg font-black tracking-tight mb-2 uppercase italic">{app.title || app.app_id}</h4>
                            <p class="text-[10px] font-bold opacity-40 leading-relaxed mb-4">{app.description || 'No description provided for this engine.'}</p>
                            
                            <div class="space-y-1">
                                <div class="text-[8px] font-black opacity-20 uppercase">Static Route Protocol</div>
                                <div class="text-[10px] font-bold font-mono truncate bg-slate-100 p-1">{app.frontend_route}</div>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- 📝 앱 설정 폼 -->
        <div class="lg:col-span-5" id="form-anchor">
            <div class="border-2 border-black p-10 bg-white shadow-[15px_15px_0_rgba(0,0,0,0.05)]">
                 <div class="mb-10 border-b-2 border-black pb-4 flex justify-between items-baseline">
                    <h3 class="text-2xl font-black uppercase tracking-tighter italic">Engine Config</h3>
                    <span class="text-[9px] font-black opacity-40 italic uppercase">System Core v5.1</span>
                </div>

                <div class="space-y-6">
                     <div class="space-y-2">
                        <label class="text-[9px] font-black uppercase tracking-widest opacity-30">Engine Identifier (Read-only)</label>
                        <input type="text" bind:value={editingApp.app_id} readonly class="w-full h-12 border border-black px-4 font-bold bg-slate-50 opacity-50 cursor-not-allowed" />
                    </div>

                    <div class="space-y-2">
                        <label class="text-[9px] font-black uppercase tracking-widest opacity-30">Display Title</label>
                        <input type="text" bind:value={editingApp.title} class="w-full h-12 border border-black px-4 font-bold bg-slate-50 focus:bg-white focus:outline-none transition-all" />
                    </div>

                     <div class="space-y-2">
                        <label class="text-[9px] font-black uppercase tracking-widest opacity-30">Standard Entry Endpoint</label>
                        <input type="text" bind:value={editingApp.frontend_route} class="w-full h-12 border border-black px-4 font-bold bg-slate-50 focus:bg-white focus:outline-none transition-all font-mono text-xs" placeholder="/v1/page/[slug]" />
                    </div>

                    <div class="flex items-center gap-4 py-4">
                         <label class="flex items-center gap-4 cursor-pointer h-12 border border-black px-6 bg-white font-black text-[10px] uppercase transition-colors hover:bg-slate-50">
                            <input type="checkbox" bind:checked={editingApp.is_active} class="checkbox checkbox-xs rounded-none" />
                            Engine Enabled
                        </label>
                    </div>

                    <div class="pt-6">
                        <button class="w-full h-16 bg-black text-white font-black text-lg uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black transition-all" onclick={handleSave}>
                            Commit Engine Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>

    </div>
</div>
