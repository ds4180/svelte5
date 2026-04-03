<script>
    /**
     * @file (app)/v1/admin/apps/+page.svelte
     * @description 시스템 앱(App) 및 서비스(Service) 엔진 레지스트리 관리자 (Svelte 5)
     * @features 신규 앱 등록(POST), 기존 앱 수정(PATCH), 백엔드 스키마 완전 동기화
     */
    import { onMount } from "svelte";
    import * as api from "$lib/api/admin.js";
    import { alertState } from "$lib/runes/alert.svelte.js";
    import { fade, fly } from "svelte/transition";
    import Icon from "@iconify/svelte";

    let apps = $state([]);
    let loading = $state(true);
    let isEditMode = $state(false); // 등록/수정 모드 판별
    
    // 백엔드 admin_schema.py의 AppRegistryBase 및 AppRegistryUpdate 모델 필드 전체 반영
    let editingApp = $state({
        app_id: "", 
        name: "",
        title: "", 
        description: "", 
        app_type: "INSTANCE",
        frontend_route: "", 
        main_component: "",
        icon_default: "🚀",
        min_read_rank: 0,
        min_write_rank: 2,
        is_active: true
    });

    /**
     * @function loadApps
     * @description DB로부터 등록된 앱 엔진 목록 로드
     */
    async function loadApps() {
        loading = true;
        try {
            apps = await api.adminGetApps();
        } catch (e) {
            alertState.send(e.message, { level: 3, style: 'error' });
        } finally {
            loading = false;
        }
    }

    onMount(loadApps);

    /**
     * @function startCreate
     * @description 신규 등록 모드로 전환 (폼 초기화)
     */
    function startCreate() {
        isEditMode = false;
        resetForm();
        document.getElementById("form-anchor")?.scrollIntoView({ behavior: 'smooth' });
    }

    /**
     * @function startEdit
     * @description 특정 앱 수정 모드로 전환
     */
    function startEdit(app) {
        isEditMode = true;
        editingApp = { 
            ...app,
            min_read_rank: Number(app.min_read_rank ?? 0),
            min_write_rank: Number(app.min_write_rank ?? 2)
        };
        document.getElementById("form-anchor")?.scrollIntoView({ behavior: 'smooth' });
    }

    function resetForm() {
        editingApp = { 
            app_id: "", name: "", title: "", description: "", 
            app_type: "INSTANCE", frontend_route: "", main_component: "",
            icon_default: "🚀", min_read_rank: 0, min_write_rank: 2, is_active: true 
        };
    }

    /**
     * @function handleSave
     * @description 모드에 따라 POST(신규) 또는 PATCH(수정) 호출
     */
        async function handleSave() {
        if (!editingApp.app_id || !editingApp.name) {
            alertState.send("ID와 내부 이름은 필수 항목입니다.", { level: 2, style: 'warning' });
            return;
        }

        try {
            // 전송 전 데이터 정제
            const { app_id, ...updateData } = editingApp; // 👈 app_id를 추출하여 분리
            
            const payload = { 
                ...updateData, // 👈 수정 시에는 app_id 제외
                min_read_rank: Number(editingApp.min_read_rank),
                min_write_rank: Number(editingApp.min_write_rank)
            };
            
            if (isEditMode) {
                // 기존 앱 수정 (PATCH) - URL에만 id가 들어가고 body에는 빠져야 함
                await api.adminUpdateApp(app_id, payload);
                alertState.send("앱 엔진 설정이 업데이트되었습니다.", { level: 1, style: 'success' });
            } else {
                // 신규 앱 등록 (POST) - 여기서는 app_id가 포함된 전체 데이터(editingApp) 필요
                await api.adminCreateApp(editingApp); 
                alertState.send("새로운 앱 엔진이 등록되었습니다.", { level: 1, style: 'success' });
            }
            
            resetForm();
            isEditMode = false;
            await loadApps();
        } catch (e) {
            alertState.send(e.message, { level: 3, style: 'error' });
        }
    }
</script>

<div class="space-y-12 animate-fade-in text-black font-['Outfit'] pb-40 px-4 max-w-7xl mx-auto">
    
    <!-- 📄 Page Title -->
    <div class="border-b-4 border-black pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
            <span class="text-[10px] font-black tracking-[0.4em] opacity-30 uppercase block mb-2">Engine Infrastructure Registry</span>
            <h1 class="text-5xl font-black tracking-tighter uppercase italic">App <span class="text-blue-600 NOT-ITALIC">Registry</span></h1>
            <p class="text-xs font-bold opacity-40 mt-3">시스템 엔진들의 메타데이터와 보안 등급을 관리합니다.</p>
        </div>
        <div class="flex gap-4">
            <button class="btn btn-black rounded-none px-8 h-14 font-black uppercase border-2 border-black transition-all" onclick={startCreate}>
                + New Engine
            </button>
            <button class="btn btn-outline rounded-none px-8 h-14 font-black uppercase border-2 border-black hover:bg-black hover:text-white transition-all" onclick={loadApps}>
                Sync
            </button>
        </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        
        <!-- 📦 등록된 앱 엔진 목록 -->
        <div class="lg:col-span-7 space-y-6">
            <h3 class="text-xl font-black uppercase tracking-tighter italic mb-4">Registered Engines</h3>
            
            {#if loading}
                <div class="h-60 border border-black border-dashed flex items-center justify-center grayscale opacity-10 font-black italic uppercase">Analyzing Registry...</div>
            {:else}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {#each apps as app (app.app_id)}
                        <div class="border-2 border-black p-6 bg-white transition-all group hover:bg-slate-50 relative overflow-hidden">
                            {#if !app.is_active}
                                <div class="absolute inset-0 bg-white/80 z-10 flex items-center justify-center font-black text-red-500 uppercase tracking-widest text-sm">Disabled</div>
                            {/if}
                            <div class="flex justify-between items-start mb-4">
                                <div class="w-10 h-10 bg-black text-white flex items-center justify-center font-black text-xl">
                                    {app.icon_default || app.app_id.substring(0, 1).toUpperCase()}
                                </div>
                                <button class="btn btn-xs btn-outline border-black rounded-none font-black text-[9px] uppercase hover:bg-black hover:text-white" onclick={() => startEdit(app)}>Modify</button>
                            </div>
                            <h4 class="text-lg font-black tracking-tight mb-1 uppercase italic">{app.title || app.name || app.app_id}</h4>
                            <div class="flex justify-between items-center mb-2">
                                <div class="text-[9px] font-black text-blue-600 opacity-60 uppercase tracking-tighter">{app.app_type} ENGINE</div>
                                {#if app.app_type === 'INSTANCE'}
                                    <a href="/v1/admin/apps/{app.app_id}/instances" class="text-[9px] font-black text-emerald-600 hover:underline uppercase tracking-tighter flex items-center gap-1">
                                        <Icon icon="ph:circles-three-plus-bold" class="w-3 h-3" />
                                        Instances
                                    </a>
                                {/if}
                            </div>
                            <p class="text-[10px] font-bold opacity-40 leading-relaxed mb-4 h-8 overflow-hidden line-clamp-2">{app.description || 'No description provided.'}</p>
                            
                            <div class="space-y-2 border-t border-black/5 pt-3">
                                <div class="flex justify-between items-center text-[10px] font-bold">
                                    <span class="opacity-20 uppercase text-[8px]">Endpoint</span>
                                    <span class="font-mono">{app.frontend_route}</span>
                                </div>
                                <div class="flex gap-2 mt-2">
                                    <span class="badge badge-outline rounded-none text-[8px] font-black px-1 h-4">READ R{app.min_read_rank}</span>
                                    <span class="badge badge-outline rounded-none text-[8px] font-black px-1 h-4">WRITE R{app.min_write_rank}</span>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>

        <!-- 📝 앱 설정 폼 (POST/PATCH 공용) -->
        <div class="lg:col-span-5" id="form-anchor">
            <div class="border-2 border-black p-8 md:p-10 bg-white shadow-[15px_15px_0_rgba(0,0,0,0.05)] sticky top-24">
                 <div class="mb-10 border-b-2 border-black pb-4 flex justify-between items-baseline">
                    <h3 class="text-2xl font-black uppercase tracking-tighter italic">
                        {isEditMode ? 'Modify Engine' : 'Register Engine'}
                    </h3>
                    <span class="text-[9px] font-black opacity-40 italic uppercase">{isEditMode ? 'Update' : 'New'} Core v5.1</span>
                </div>

                <div class="space-y-6">
                    <div class="grid grid-cols-2 gap-4">
                        <div class="space-y-2">
                            <label class="text-[9px] font-black uppercase tracking-widest opacity-30">Engine ID (ID)</label>
                            <input type="text" bind:value={editingApp.app_id} readonly={isEditMode} class="w-full h-12 border border-black px-4 font-bold bg-slate-50 focus:bg-white focus:outline-none transition-all text-xs {isEditMode ? 'opacity-50 cursor-not-allowed' : ''}" placeholder="board, page 등" />
                        </div>
                        <div class="space-y-2">
                            <label class="text-[9px] font-black uppercase tracking-widest opacity-30">Internal Name</label>
                            <input type="text" bind:value={editingApp.name} class="w-full h-12 border border-black px-4 font-bold bg-slate-50 focus:bg-white focus:outline-none transition-all text-xs" placeholder="게시판 엔진 등" />
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label class="text-[9px] font-black uppercase tracking-widest opacity-30">Display Title</label>
                        <input type="text" bind:value={editingApp.title} class="w-full h-12 border border-black px-4 font-bold bg-slate-50 focus:bg-white focus:outline-none transition-all" placeholder="UI에 표시될 이름" />
                    </div>

                    <div class="space-y-2">
                        <label class="text-[9px] font-black uppercase tracking-widest opacity-30">Description</label>
                        <textarea bind:value={editingApp.description} class="w-full h-20 border border-black p-4 font-bold bg-slate-50 focus:bg-white focus:outline-none transition-all text-xs resize-none" placeholder="엔진 기능 요약 설명"></textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-4 border-t border-black/5 pt-6">
                        <div class="space-y-2">
                            <label class="text-[9px] font-black uppercase tracking-widest opacity-30">App Type</label>
                            <select bind:value={editingApp.app_type} class="w-full h-12 border border-black px-4 font-black bg-slate-50 text-xs">
                                <option value="INSTANCE">INSTANCE (다중)</option>
                                <option value="STATIC">STATIC (단독)</option>
                                <option value="SYSTEM">SYSTEM (핵심)</option>
                            </select>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[9px] font-black uppercase tracking-widest opacity-30">Component Name</label>
                            <input type="text" bind:value={editingApp.main_component} class="w-full h-12 border border-black px-4 font-bold bg-slate-50 focus:bg-white focus:outline-none transition-all text-xs font-mono" placeholder="예: BoardEngine" />
                        </div>
                    </div>

                    <div class="space-y-2">
                        <label class="text-[9px] font-black uppercase tracking-widest opacity-30">Entry Endpoint</label>
                        <input type="text" bind:value={editingApp.frontend_route} class="w-full h-12 border border-black px-4 font-bold bg-slate-50 focus:bg-white focus:outline-none transition-all font-mono text-xs" placeholder="/v1/app/board/[slug]" />
                    </div>

                    <div class="grid grid-cols-3 gap-4 border-t border-black/5 pt-6">
                        <div class="space-y-2">
                            <label class="text-[9px] font-black uppercase tracking-widest opacity-30">Read Rank</label>
                            <select bind:value={editingApp.min_read_rank} class="w-full h-12 border border-black px-4 font-black bg-slate-50 text-xs">
                                <option value={0}>R0 (Guest)</option>
                                <option value={1}>R1 (Staff)</option>
                                <option value={2}>R2 (Manager)</option>
                                <option value={4}>R4 (Admin)</option>
                            </select>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[9px] font-black uppercase tracking-widest opacity-30">Write Rank</label>
                            <select bind:value={editingApp.min_write_rank} class="w-full h-12 border border-black px-4 font-black bg-slate-50 text-xs">
                                <option value={0}>R0 (Guest)</option>
                                <option value={1}>R1 (Staff)</option>
                                <option value={2}>R2 (Manager)</option>
                                <option value={4}>R4 (Admin)</option>
                            </select>
                        </div>
                        <div class="space-y-2">
                            <label class="text-[9px] font-black uppercase tracking-widest opacity-30">Icon</label>
                            <input type="text" bind:value={editingApp.icon_default} class="w-full h-12 border border-black px-4 font-black text-center text-xl bg-slate-50 focus:bg-white focus:outline-none transition-all" placeholder="Emoji" />
                        </div>
                    </div>

                    <div class="flex items-center gap-4 py-4">
                         <label class="flex items-center gap-4 cursor-pointer h-12 border border-black px-6 bg-white font-black text-[10px] uppercase transition-colors hover:bg-slate-50">
                            <input type="checkbox" bind:checked={editingApp.is_active} class="checkbox checkbox-xs rounded-none" />
                            Engine Active
                        </label>
                    </div>

                    <div class="pt-6 flex gap-4">
                        <button class="flex-1 h-16 bg-black text-white font-black text-lg uppercase tracking-widest border-2 border-black hover:bg-white hover:text-black transition-all" onclick={handleSave}>
                            {isEditMode ? 'Commit Update' : 'Register Engine'}
                        </button>
                        <button class="w-20 h-16 border-2 border-black font-black uppercase text-[10px] hover:bg-slate-100 transition-all" onclick={resetForm}>
                            Reset
                        </button>
                    </div>
                </div>
            </div>
        </div>

    </div>
</div>

<style>
    :global(.btn) { border-radius: 0; }
</style>