<script>
    /**
     * @file (app)/v1/admin/apps/[appId]/instances/create/+page.svelte
     * @description 신규 인스턴스(게시판) 생성 마법사 (Svelte 5)
     */
    import { page } from "$app/state";
    import { goto } from "$app/navigation";
    import * as api from "$lib/api/admin.js";
    import { alertState } from "$lib/runes/alert.svelte.js";
    import Icon from "@iconify/svelte";

    const appId = $derived(page.params.appId);
    
    let isSaving = $state(false);
    let formData = $state({
        slug: "",
        name: "",
        description: "",
        layout_type: "list",
        items_per_page: 10
    });

    async function handleCreate() {
        if (!formData.slug || !formData.name) {
            alertState.send("Slug와 Title은 필수 항목입니다.", { level: 2, style: 'warning' });
            return;
        }

        isSaving = true;
        try {
            if (appId === 'board') {
                await api.adminCreateBoard(formData);
                alertState.send(`[${formData.name}] 인스턴스가 성공적으로 생성되었습니다.`, { level: 1, style: 'success' });
                goto(`/v1/admin/apps/${appId}/instances`);
            } else {
                throw new Error("현재 이 앱 엔진에 대한 인스턴스 생성이 지원되지 않습니다.");
            }
        } catch (e) {
            alertState.send(e.message, { level: 3, style: 'error' });
        } finally {
            isSaving = false;
        }
    }
</script>

<div class="animate-fade-in text-black font-['Outfit'] pb-40 px-4 max-w-4xl mx-auto">
    
    <!-- 📄 Header -->
    <div class="border-b-4 border-black pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <div>
            <div class="flex items-center gap-3 mb-2">
                <a href="/v1/admin/apps/{appId}/instances" class="btn btn-xs btn-outline border-black rounded-none font-black text-[9px] uppercase tracking-widest px-2 group">
                    <span class="group-hover:-translate-x-1 transition-transform">←</span> Back to Instances
                </a>
                <span class="text-[10px] font-black tracking-[0.4em] opacity-30 uppercase">Factory Wizard</span>
            </div>
            <h1 class="text-5xl font-black tracking-tighter uppercase italic">
                {appId} <span class="text-blue-600 NOT-ITALIC">Factory</span>
            </h1>
            <p class="text-xs font-bold opacity-40 mt-3 italic">새로운 인스턴스를 설계하고 시스템에 배치합니다.</p>
        </div>
    </div>

    <!-- 🧬 Creation Form -->
    <div class="border-2 border-black p-10 md:p-14 bg-white shadow-[20px_20px_0_rgba(0,0,0,0.05)]">
        <div class="mb-12 border-b-2 border-black pb-4 flex justify-between items-baseline">
            <h3 class="text-3xl font-black uppercase tracking-tighter italic mr-4">New Instance Build</h3>
            <span class="text-[10px] font-black opacity-30 uppercase tracking-widest">Specifications v1.0</span>
        </div>

        <div class="space-y-10">
            <!-- Basic Identifiers -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-10">
                <div class="space-y-3">
                    <label class="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 flex items-center gap-2">
                        <Icon icon="ph:hash-bold" class="w-4 h-4" /> Instance Slug (ID)
                    </label>
                    <input type="text" bind:value={formData.slug} class="w-full h-16 border-2 border-black px-6 font-black text-blue-600 bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all text-lg" placeholder="예: free-board" />
                    <p class="text-[9px] font-bold opacity-40 italic mt-2">이 인스턴스의 고유 주소(URL)가 됩니다. 영문소문자와 하이픈(-)만 권장합니다.</p>
                </div>
                <div class="space-y-3">
                    <label class="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 flex items-center gap-2">
                        <Icon icon="ph:bookmark-bold" class="w-4 h-4" /> Display Title
                    </label>
                    <input type="text" bind:value={formData.name} class="w-full h-16 border-2 border-black px-6 font-black bg-slate-50 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all text-lg" placeholder="예: 자유게시판" />
                    <p class="text-[9px] font-bold opacity-40 italic mt-2">사용자에게 보여질 실제 명칭입니다.</p>
                </div>
            </div>

            <!-- Description -->
            <div class="space-y-3">
                <label class="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 flex items-center gap-2">
                    <Icon icon="ph:text-align-left-bold" class="w-4 h-4" /> Description
                </label>
                <input type="text" bind:value={formData.description} class="w-full h-16 border-2 border-black px-6 font-bold bg-white focus:outline-none focus:ring-4 focus:ring-slate-100 transition-all" placeholder="사용자와 관리자에게 보여줄 짧은 설명" />
            </div>

            <!-- UI Configuration -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-10 border-t-2 border-slate-100 pt-10">
                <div class="space-y-3">
                    <label class="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 flex items-center gap-2">
                        <Icon icon="ph:layout-bold" class="w-4 h-4" /> Layout Style
                    </label>
                    <select bind:value={formData.layout_type} class="w-full h-16 border-2 border-black px-5 font-black bg-slate-50 text-base appearance-none focus:bg-white transition-colors">
                        <option value="list">List Style (Standard)</option>
                        <option value="gallery">Gallery Style (Image Centered)</option>
                        <option value="blog">Blog Style (Summary/Full Body)</option>
                    </select>
                </div>
                <div class="space-y-3">
                    <label class="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 flex items-center gap-2">
                        <Icon icon="ph:list-numbers-bold" class="w-4 h-4" /> Items Per Page
                    </label>
                    <input type="number" bind:value={formData.items_per_page} class="w-full h-16 border-2 border-black px-6 font-black bg-white focus:outline-none transition-all text-lg text-center" min="1" max="100" />
                </div>
            </div>

            <!-- Action Buttons -->
            <div class="pt-10 flex flex-col md:flex-row gap-6">
                <button 
                    class="flex-1 h-24 bg-black text-white font-black text-xl uppercase tracking-[0.2em] border-4 border-black hover:bg-white hover:text-black transition-all flex items-center justify-center gap-4 group" 
                    onclick={handleCreate}
                    disabled={isSaving}
                >
                    {#if isSaving}
                        <span class="loading loading-spinner loading-md"></span> Constructing...
                    {:else}
                        <Icon icon="ph:factory-bold" class="w-8 h-8 group-hover:rotate-12 transition-transform" /> Build Instance
                    {/if}
                </button>
                <button 
                    class="h-24 px-10 border-2 border-black font-black uppercase text-[10px] tracking-widest hover:bg-slate-50 transition-all opacity-40 hover:opacity-100" 
                    onclick={() => (formData = { slug: "", name: "", description: "", layout_type: "list", items_per_page: 10 })}
                >
                    Wipe Clean
                </button>
            </div>

            <!-- Hint Box -->
            <div class="mt-10 p-6 bg-slate-50 border-2 border-black/5 text-[11px] font-bold text-black/40 flex items-start gap-4 italic leading-relaxed">
                <Icon icon="ph:info-bold" class="w-5 h-5 flex-shrink-0 text-blue-600 NOT-ITALIC" />
                <div>
                    인스턴스를 생성한 직후에는 사용자 메뉴에 자동으로 나타나지 않습니다.<br/>
                    필요한 경우 <strong class="text-black">[메뉴 관리]</strong> 메뉴에서 신규 메뉴 항목을 추가하고, 앱 링크 대상을 이 인스턴스로 연결해 주십시오.
                </div>
            </div>
        </div>
    </div>
</div>
