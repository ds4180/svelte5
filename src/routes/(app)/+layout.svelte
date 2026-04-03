<script>
    /**
     * @file (app)/+layout.svelte (Premium Dashboard: Modular Architecture)
     * @description [v15.0] 우측 동적 폼을 독립 컴포넌트로 분리하여 레이아웃 가독성 및 유지보수성을 극대화한 버전
     */
    import { page } from "$app/state";
    import { onMount, untrack } from "svelte";
    import { alertState } from "$lib/runes/alert.svelte.js";
    import { auth } from "$lib/runes/auth.svelte.js";
    import { navState } from "$lib/runes/nav.svelte.js";
    import DynamicSidebar from "$lib/components/Nav/DynamicSidebar.svelte";
    import "../layout.css";
    import Icon from '@iconify/svelte';

    let { data, children } = $props();
    
    // 컴포넌트 생성 시점에 상태 동기화
    untrack(() => {
        auth.setUser(data.user);
        if (data.menus) {
            navState.setMenus(data.menus);
            navState.isLoading = false;
        }
    });

    // --- [상태 관리] ---
    let isLeftOpen = $state(true);     
    let isRightOpen = $state(false);   
    let isScrolled = $state(false);
    /** @type {Record<string|number, boolean>} */
    let openMenus = $state({}); 
    let isMounted = $state(false);
    let isMobile = $state(false);

    onMount(() => {
        const updateMedia = () => {
            isMobile = window.innerWidth < 1200;
            if (isMobile) {
                isLeftOpen = false;
            } else {
                isLeftOpen = true;
            }
            isRightOpen = false; 
        };

        setTimeout(() => {
            isMounted = true;
            updateMedia();
            if (data.menus) {
                data.menus.forEach((/** @type {any} */ m) => {
                    if (openMenus[m.id] === undefined) openMenus[m.id] = true;
                });
            }
        }, 0);
        
        const handleScroll = () => { isScrolled = window.scrollY > 10; };
        window.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', updateMedia);

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', updateMedia);
        };
    });

    $effect(() => {
        if (page.url.pathname) {
            navState.clearPageMenus();
            isRightOpen = false; 
            if (isMobile) isLeftOpen = false;
        }
    });

    function toggleLeft() { isLeftOpen = !isLeftOpen; }
    function toggleRight() { isRightOpen = !isRightOpen; }
    /** @param {any} menuId */
    function toggleMenu(menuId) { openMenus[menuId] = !openMenus[menuId]; }

    /** @param {any} path */
    function isActive(path) { 
        if (!path || path === "#") return false;
        const currentPath = page.url.pathname;
        let targetPath;
        try { targetPath = new URL(path, page.url.origin).pathname; } catch { targetPath = path; }
        if (currentPath === targetPath) return true;
        if (targetPath !== '/' && currentPath.startsWith(targetPath)) {
            const nextChar = currentPath.charAt(targetPath.length);
            if (nextChar === '/' || nextChar === '') return true;
        }
        return false; 
    }
</script>

<div class="flex flex-col h-screen bg-slate-50 text-slate-900 font-['Noto_Sans_KR','Outfit'] antialiased overflow-hidden selection:bg-blue-100 selection:text-blue-700 relative">
    
    <!-- 🌐 Premium Navbar (Global Header) -->
    <header class="navbar bg-white border-b-4 border-slate-900 z-[1001] px-2 md:px-8 h-20 flex-none transition-all {isScrolled ? 'shadow-2xl' : ''}">
        <div class="flex-none lg:pr-6">
            <button class="btn btn-ghost btn-square rounded-none border-2 border-slate-900 hover:bg-slate-900 hover:text-white transition-all transform active:scale-95 shadow-[4px_4px_0_0_#1e293b]" onclick={toggleLeft} aria-label="메뉴 열기">
                <Icon icon="ph:list-bold" class="w-6 h-6" />
            </button>
        </div>
        <div class="flex-1 px-4 sm:px-0">
             <a href="/" class="text-xl md:text-3xl font-black tracking-tighter uppercase italic text-slate-900 border-none group leading-none">
                Jeju.Live <span class="text-blue-600 NOT-ITALIC group-hover:underline decoration-4 underline-offset-4">Admin</span>
            </a>
        </div>
        <div class="flex-none gap-2 md:gap-4 flex items-center h-full sm:border-l-2 border-slate-100 px-2 sm:pl-6">
            
            <!-- 🔔 알림 설정 -->
            <button class="btn btn-sm btn-outline border-slate-300 rounded-none font-black text-[10px] tracking-widest gap-2 hover:bg-slate-900 hover:text-white transition-all p-2 px-3" onclick={() => alertState.toggleQuietMode()}>
                <span class="relative flex h-2 w-2">
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full {isMounted && alertState.isQuietMode ? 'bg-rose-400' : 'bg-emerald-400'} opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 {isMounted && alertState.isQuietMode ? 'bg-rose-500' : 'bg-emerald-500'}"></span>
                </span>
                <span class="hidden md:inline">{isMounted && alertState.isQuietMode ? 'MUTE' : 'LIVE'}</span>
            </button>

            <!-- 👤 인증 (로그인/로그아웃) -->
            <div class="flex items-center">
                {#if auth.user}
                    <a href="/logout" data-sveltekit-reload class="btn btn-sm btn-outline border-slate-900 rounded-none font-black text-[10px] uppercase hover:bg-rose-600 hover:text-white hover:border-rose-600 transition-all px-4 shadow-[4px_4px_0_0_#94a3b8] scale-90 sm:scale-100" aria-label="로그아웃 버튼">
                         <span class="hidden sm:inline">Sign Out</span>
                         <Icon icon="ph:sign-out-bold" class="sm:hidden w-4 h-4" />
                    </a>
                {:else}
                    <a href="/login" class="btn btn-sm bg-slate-900 text-white rounded-none font-black uppercase tracking-widest px-6 border-none hover:bg-black transition-all shadow-[4px_4px_0_0_#2563eb]">Sign In</a>
                {/if}
            </div>

            <!-- 🍔 동적 폼 호출 -->
            <button class="btn btn-neutral btn-square rounded-none border-2 border-slate-900 flex-none group relative overflow-hidden" onclick={toggleRight} aria-label="동적 폼 열기">
                <Icon icon="ph:magic-wand-fill" class="w-6 h-6 z-10" />
                {#if navState.pageMenus && navState.pageMenus.length > 0}
                    <span class="absolute top-1 right-1 flex h-2 w-2 pointer-events-none">
                        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                {/if}
            </button>
        </div>
    </header>

    <div class="flex flex-1 overflow-hidden relative">
        
        <!-- ⬅️ 왼쪽 네비게이션 사이드바 -->
        <aside class="bg-slate-900 text-slate-300 transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] z-[1000] shadow-2xl flex-none overflow-hidden 
                      {isMobile ? 'absolute top-0 bottom-0 left-0 h-full' : ''} 
                      {isLeftOpen ? 'w-72' : 'w-0'} border-r-4 border-black">
            
            <div class="w-72 h-full flex flex-col pt-12 pb-32 overflow-y-auto custom-scrollbar-dark px-4">
                 <div class="px-4 mb-2 flex flex-col gap-1 border-l-4 border-blue-600 ml-2">
                     <span class="text-[10px] font-black text-slate-600 uppercase tracking-widest block leading-none">Console System</span>
                     <h2 class="text-xl font-black text-white italic uppercase tracking-tighter leading-none">Main Navigation</h2>
                 </div>

                 <nav class="flex flex-col gap-1 mb-20 mt-8 uppercase">
                    {#if data.menus}
                        {#each data.menus as m, i (m.id || i)}
                             {#if m.sub_menus && m.sub_menus.length > 0}
                                 <div class="flex flex-col mb-1 group">
                                     <button 
                                        type="button" 
                                        class="w-full h-15 flex items-center justify-between px-6 py-6 text-lg font-black italic uppercase tracking-tighter transition-all border-b border-white/5" 
                                        onclick={() => toggleMenu(m.id)}>
                                        <span class="flex items-center gap-5">
                                            <Icon icon={m.icon_name || 'ph:folder-fill'} class="w-7 h-7 {openMenus[m.id] ? 'text-blue-500' : 'opacity-20'}" /> 
                                            {m.title}
                                        </span>
                                        <Icon icon="ph:caret-down-bold" class="text-xs transition-transform duration-300 {openMenus[m.id] ? 'rotate-180 text-blue-500' : ''}" />
                                    </button>
                                    {#if openMenus[m.id]}
                                       <div class="flex flex-col gap-1 mt-1 transition-all">
                                           {#each m.sub_menus as sub, si (sub.external_url || si)}
                                               <a 
                                                  href={sub.external_url} 
                                                  class="flex items-center gap-6 px-10 py-4.5 text-base font-black italic uppercase tracking-tighter transition-all 
                                                         {isActive(sub.external_url) 
                                                            ? 'bg-blue-600 text-white border-l-8 border-white' 
                                                            : 'text-slate-500 hover:bg-slate-800 hover:text-white hover:border-l-4 hover:border-slate-700'}">
                                                   <span>{sub.title}</span>
                                               </a>
                                           {/each}
                                       </div>
                                    {/if}
                                 </div>
                             {:else}
                                 <a 
                                    href={m.external_url || '#'} 
                                    class="flex items-center gap-6 px-6 py-6 text-xl font-black italic uppercase tracking-tighter transition-all mb-1
                                           {isActive(m.external_url) 
                                              ? 'bg-blue-600 text-white border-l-8 border-white shadow-xl' 
                                              : 'text-slate-500 hover:text-white hover:bg-slate-800 hover:border-l-4 hover:border-slate-700'}">
                                    <Icon icon={m.icon_name || 'ph:rocket-fill'} class="w-8 h-8 {isActive(m.external_url) ? 'text-white' : 'opacity-30'}" />
                                    {m.title}
                                 </a>
                             {/if}
                        {/each}
                    {/if}
                 </nav>
            </div>
        </aside>

        <!-- 🚀 가운데 본문 영역 -->
        <main class="flex-1 overflow-y-auto bg-slate-50 transition-all custom-scrollbar flex flex-col relative z-[100]">
            <div class="p-6 md:p-12 lg:p-20 max-w-[1700px] mx-auto min-h-full w-full">
                {@render children?.()}
            </div>
        </main>

    </div>
</div>

<!-- 🍱 동적 폼 (독립 컴포넌트: Scrim 포함) -->
<DynamicSidebar 
    {isMobile} 
    isOpen={isRightOpen} 
    onClose={toggleRight} 
/>

<style>
    :global(.btn) { border-radius: 0; }
    .custom-scrollbar::-webkit-scrollbar { width: 8px; }
    .custom-scrollbar-dark::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.05); }
</style>
