<script>
    /**
     * @file src/lib/components/Nav/DynamicSidebar.svelte
     * @description [v1.1] 모바일 슬라이딩 가동 보증 (좌표 및 트랜지션 초기화 최적화)
     */
    import Icon from '@iconify/svelte';
    import { navState } from '$lib/runes/nav.svelte.js';
    import { auth } from '$lib/runes/auth.svelte.js';

    /**
     * @typedef {Object} Props
     * @property {boolean} [isMobile] - 모바일 환경 여부
     * @property {boolean} [isOpen] - 사이드바 열림 상태
     * @property {import('svelte/elements').MouseEventHandler<HTMLElement>} [onClose] - 닫기 이벤트 핸들러
     */
    let { 
        isMobile = false, 
        isOpen = false, 
        onClose = () => {} 
    } = $props();

    /** @type {Record<string|number, boolean>} */
    let openMenus = $state({});
    /** @param {any} id */
    function toggleMenu(id) { openMenus[id] = !openMenus[id]; }
</script>

<!-- 📱/💻 오버레이 차단 배경 (Root-level Scrim) -->
{#if isOpen}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div 
        class="fixed inset-0 bg-slate-950/40 backdrop-blur-[4px] z-[9998] transition-opacity animate-fade-in" 
        onclick={onClose} 
        aria-label="동적 폼 닫기 배경">
    </div>
{/if}

<!-- ➡️ 우측 동적 폼 사이드바 (분리 전 완벽 작동 로직 복원) -->
<aside 
    class="bg-white text-slate-900 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-[9999] shadow-[-20px_0_60px_-15px_rgba(0,0,0,0.4)] fixed overflow-hidden 
          {isMobile 
             ? 'left-0 right-0 h-full rounded-t-[3.5rem] bottom-0 top-0 border-t-8 border-slate-900 shadow-[0_-20px_50px_rgba(0,0,0,0.5)]' 
             : 'w-[450px] border-l-4 border-slate-900 right-0 top-20 bottom-0'} 
          {isOpen 
             ? (isMobile ? 'translate-y-[0%]' : 'translate-x-0') 
             : (isMobile ? 'translate-y-full' : 'translate-x-full')}"
    aria-label="동적 폼 사이드바 패널">
    
    <div class="w-full h-full flex flex-col overflow-y-auto custom-scrollbar px-2 divide-y divide-slate-100 pb-40">
        
        <!-- [0] 헤더 및 닫기 버튼 -->
        <header class="flex items-center justify-between p-8 md:p-10 bg-slate-50/50 flex-none sticky top-0 z-10 backdrop-blur-md border-b border-slate-100">
            <div class="flex flex-col">
                <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2 underline underline-offset-4 decoration-slate-200">Interactive Panel</span>
                <h2 class="text-3xl font-black text-slate-900 italic uppercase tracking-tighter leading-none">Dynamic Form</h2>
            </div>
            <button class="btn btn-ghost btn-circle btn-sm bg-white shadow-sm border border-slate-200 hover:bg-slate-900 hover:text-white transition-all transform active:scale-95" onclick={onClose} aria-label="사이드바 닫기">
                <Icon icon="ph:x-bold" class="w-5 h-5 text-slate-500 group-hover:text-white" />
            </button>
        </header>

        <!-- [1] 상단 구역: Context Action (본문 전용 메뉴) -->
        <section class="p-10 flex flex-col gap-6">
            <h3 class="text-[11px] font-black italic uppercase tracking-widest text-emerald-600 flex items-center gap-3 mb-2 underline underline-offset-8">
                <Icon icon="ph:lightning-fill" class="w-5 h-5" /> [01] Contextual Entry
            </h3>
            {#if navState.pageMenus && navState.pageMenus.length > 0}
                 <div class="grid grid-cols-1 gap-3">
                     {#each navState.pageMenus as pc (pc.title + pc.url)}
                         <a href={pc.url} class="group flex items-center justify-between p-6 bg-slate-50 rounded-[2.5rem] hover:bg-black hover:text-white transition-all border border-slate-100 shadow-sm">
                             <span class="font-black italic uppercase tracking-tighter text-sm uppercase">{pc.title}</span>
                             <Icon icon="ph:caret-right-bold" class="w-4 h-4 opacity-30 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                         </a>
                     {/each}
                 </div>
            {:else}
                <div class="py-24 border-2 border-dashed border-slate-100 rounded-[3rem] flex flex-col items-center justify-center text-slate-300 bg-slate-50/5">
                    <Icon icon="ph:circles-three-plus-duotone" class="w-16 h-16 opacity-10 mb-5" />
                    <p class="text-[10px] font-black uppercase tracking-widest opacity-30 text-center leading-relaxed"> Standby Mode <br/> No contextual tools injected </p>
                </div>
            {/if}
        </section>

        <!-- [2] 중단 구역: Admin Navigation (레이아웃 네비게이션) -->
        <section class="p-10 flex flex-col gap-4">
            <div class="flex items-center justify-between mb-4">
                <h3 class="text-[11px] font-black italic uppercase tracking-widest text-blue-600 flex items-center gap-3 underline underline-offset-8">
                    <Icon icon="ph:grid-four-fill" class="w-5 h-5" /> [02] Navigation Suite
                </h3>
            </div>
            {#if navState.menus && navState.menus.length > 0}
                 <div class="flex flex-col gap-2">
                     {#each navState.menus as m, i (m.id || i)}
                         <button 
                            class="w-full h-16 flex items-center justify-between p-4 px-6 bg-slate-50 rounded-2xl text-[11px] font-black italic uppercase tracking-tighter text-slate-500 hover:bg-slate-900 hover:text-white transition-all shadow-sm group"
                            onclick={() => toggleMenu(m.id)}>
                            <span class="flex items-center gap-3">
                                <Icon icon={m.icon_name || 'ph:folder-fill'} class="w-5 h-5 {openMenus[m.id] ? 'text-blue-500' : 'opacity-40'} group-hover:text-white" />
                                {m.title}
                            </span>
                            <Icon icon="ph:caret-down-bold" class="text-[8px] {openMenus[m.id] ? 'rotate-180 text-blue-500' : ''}" />
                         </button>
                         {#if openMenus[m.id]}
                            <div class="flex flex-col mb-4 p-2 bg-slate-100/50 rounded-2xl mx-2 border-l-4 border-slate-300 transition-all">
                                {#each (m.sub_menus || []) as sub, si (sub.external_url || si)}
                                    <a href={sub.external_url} class="p-4 px-8 text-[10px] font-black uppercase italic tracking-tighter text-slate-500 hover:text-blue-600 transition-all border-b border-white last:border-none">
                                        {sub.title}
                                    </a>
                                {/each}
                            </div>
                         {/if}
                     {/each}
                 </div>
            {/if}
        </section>

        <!-- [3] 하단 구역: System Core (로그아웃 통합) -->
        <section class="p-10 flex flex-col gap-6 bg-slate-50/30">
            <h3 class="text-[11px] font-black italic uppercase tracking-widest text-slate-400 flex items-center gap-3 mb-2 underline underline-offset-8">
                 <Icon icon="ph:power-fill" class="w-5 h-5" /> [03] Logout Console
            </h3>
            <div class="grid grid-cols-1 gap-4">
                 {#if auth.user}
                    <div class="block w-full">
                        <a href="/logout" data-sveltekit-reload class="w-full flex flex-col gap-4 p-6 bg-rose-50 border border-rose-200 rounded-[3rem] items-center text-center hover:bg-rose-600 hover:text-white transition-all shadow-sm group">
                            <Icon icon="ph:sign-out-bold" class="w-8 h-8 text-rose-300 group-hover:text-white" />
                            <span class="text-[9px] font-black uppercase tracking-tight">Logout System</span>
                        </a>
                    </div>
                 {/if}
            </div>
        </section>

    </div>
</aside>

<style>
    /* ✅ Svelte 내부 개별 스크롤바 커스텀 */
    .custom-scrollbar::-webkit-scrollbar { width: 8px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.05); }
    .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(0, 0, 0, 0.1); }

    .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

    :global(.btn) { border-radius: 0; }
</style>
