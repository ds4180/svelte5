<script>
    /**
     * @file (app)/v1/admin/apps/[appId]/instances/+page.svelte
     * @description 특정 앱 엔진의 인스턴스(게시판 등) 목록 관리
     */
    import { page } from "$app/state";
    import { onMount } from "svelte";
    import * as api from "$lib/api/admin.js";
    import { alertState } from "$lib/runes/alert.svelte.js";
    import Icon from "@iconify/svelte";

    const appId = $derived(page.params.appId);
    
    let instances = $state([]);
    let loading = $state(true);
    let appInfo = $state(null);

    async function loadData() {
        loading = true;
        try {
            // 1. 앱 정보 로드
            appInfo = await api.adminGetAppDetail(appId);
            
            // 2. 인스턴스 목록 로드 (게시판 엔진인 경우)
            if (appId === 'board') {
                instances = await api.adminGetBoards();
            } else {
                instances = [];
            }
        } catch (e) {
            alertState.send(e.message, { level: 3, style: 'error' });
        } finally {
            loading = false;
        }
    }

    onMount(loadData);
</script>

<div class="space-y-10 animate-fade-in text-black font-['Outfit'] pb-40 px-4 max-w-7xl mx-auto">
    
    <!-- 📄 Header -->
    <div class="border-b-4 border-black pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
            <div class="flex items-center gap-3 mb-2">
                <a href="/v1/admin/apps" class="btn btn-xs btn-outline border-black rounded-none font-black text-[9px] uppercase tracking-widest px-2 group">
                    <span class="group-hover:-translate-x-1 transition-transform">←</span> Back to Registry
                </a>
                <span class="text-[10px] font-black tracking-[0.4em] opacity-30 uppercase">Instance Cluster</span>
            </div>
            <h1 class="text-5xl font-black tracking-tighter uppercase italic line-clamp-1">
                {appInfo?.title || appId} <span class="text-emerald-600 NOT-ITALIC">Instances</span>
            </h1>
            <p class="text-xs font-bold opacity-40 mt-3 italic">{appInfo?.description || '이 엔진을 사용하는 활성 인스턴스 목록입니다.'}</p>
        </div>
        <div class="flex gap-4">
            <a href="/v1/admin/apps/{appId}/instances/create" class="btn btn-black rounded-none px-8 h-14 font-black uppercase border-2 border-black transition-all">
                + New Instance
            </a>
        </div>
    </div>

    {#if loading}
        <div class="h-60 border border-black border-dashed flex items-center justify-center grayscale opacity-10 font-black italic uppercase">Synchronizing Instances...</div>
    {:else if instances.length === 0}
        <div class="h-80 border-2 border-black flex flex-col items-center justify-center bg-slate-50 gap-4">
            <Icon icon="ph:ghost-bold" class="w-16 h-16 opacity-10" />
            <p class="font-black uppercase italic opacity-30 tracking-widest text-sm text-center">
                No active instances found for this engine.<br/>
                <span class="text-[10px] normal-case NOT-ITALIC">첫 번째 인스턴스를 생성하여 엔진을 가동해 보세요.</span>
            </p>
        </div>
    {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {#each instances as ins}
                <div class="border-2 border-black p-8 bg-white transition-all group hover:shadow-[8px_8px_0_rgba(16,185,129,1)] hover:-translate-x-1 hover:-translate-y-1 relative">
                    <div class="flex justify-between items-start mb-6">
                        <div class="text-[10px] font-black font-mono text-emerald-600 bg-emerald-50 px-2 py-1 rounded">/{ins.slug}</div>
                        <div class="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button class="text-black hover:text-blue-600 p-1"><Icon icon="ph:pencil-simple-bold" class="w-4 h-4" /></button>
                        </div>
                    </div>
                    
                    <h4 class="text-2xl font-black tracking-tight mb-2 uppercase">{ins.name || ins.slug}</h4>
                    <p class="text-xs font-bold opacity-40 leading-relaxed mb-6 h-10 overflow-hidden line-clamp-2 italic">{ins.description || '인스턴스에 대한 상세 설명이 제공되지 않았습니다.'}</p>
                    
                    <div class="flex items-center justify-between pt-6 border-t border-black/5">
                        <div class="flex gap-2">
                             {#if ins.layout_type}
                                <span class="badge badge-outline border-black/20 rounded-none text-[8px] font-black px-2 h-5 uppercase">{ins.layout_type}</span>
                             {/if}
                             {#if ins.items_per_page}
                                <span class="badge badge-outline border-black/20 rounded-none text-[8px] font-black px-2 h-5 uppercase">LIMIT {ins.items_per_page}</span>
                             {/if}
                        </div>
                        <a href="/v1/app/{appId}/{ins.slug}" target="_blank" class="text-[9px] font-black uppercase text-black hover:underline flex items-center gap-1">
                            Visit <Icon icon="ph:arrow-square-out-bold" class="w-3 h-3" />
                        </a>
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>
