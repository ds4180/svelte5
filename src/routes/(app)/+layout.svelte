<script>
    /**
     * @file (app)/+layout.svelte (랜딩 페이지 최적화 버전)
     * @description 하이드레이션 오류를 원천 차단한 표준 대시보드 레이아웃
     */
    import { page } from "$app/stores";
    import { onMount, untrack } from "svelte";
    import { alertState } from "$lib/runes/alert.svelte.js";
    import { auth } from "$lib/runes/auth.svelte.js";
    import { navState } from "$lib/runes/nav.svelte.js";
    import "../layout.css";
    import Icon from '@iconify/svelte'; // Iconify Icon component import

    let { data, children } = $props();
    
    // 컴포넌트 생성 시점에 즉시 상태를 동기화하여 하이드레이션 오류를 해결합니다.
    untrack(() => {
        auth.setUser(data.user);
        if (data.menus) {
            navState.setMenus(data.menus);
            navState.isLoading = false;
        }
    });

    // --- [상태 관리] ---
    let isSidebarOpen = $state(true);
    let isScrolled = $state(false);
    let openMenus = $state({}); 

    let isMounted = $state(false);

    onMount(() => {
        // 하이드레이션 오류를 방지하기 위해, DOM에 영향을 주는 모든 초기 상태 설정을
        // 초기 렌더링이 완료된 후(다음 이벤트 루프)로 지연시킵니다.
        setTimeout(() => {
            isMounted = true;
            if (window.innerWidth < 1200) isSidebarOpen = false;

            console.log('data.menus:', data.menus);

            if (data.menus) {
                data.menus.forEach(m => {
                    if (openMenus[m.id] === undefined) openMenus[m.id] = true;
                });
            }
        }, 0);
        
        const handleScroll = () => { isScrolled = window.scrollY > 10; };
        window.addEventListener('scroll', handleScroll);

        return () => window.removeEventListener('scroll', handleScroll);
    });

    function toggleSidebar() { isSidebarOpen = !isSidebarOpen; }
    function toggleMenu(menuId) { openMenus[menuId] = !openMenus[menuId]; }

    function isActive(path) { 
        if (!path || path === "#") return false;
        return $page.url.pathname.includes(path); 
    }
</script>

<div class="flex flex-col min-h-screen bg-slate-50 text-slate-900 font-['Noto_Sans_KR','Outfit'] antialiased">
    
    <!-- 🌐 상단 Navbar -->
    <header class="navbar bg-white border-b border-slate-200 sticky top-0 z-[1000] px-4 h-16 transition-all {isScrolled ? 'shadow-md' : ''}">
        <div class="flex-none">
            <button class="btn btn-ghost btn-square" onclick={toggleSidebar} aria-label="사이드바 토글">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-6 h-6 stroke-current">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
                </svg>
            </button>
        </div>
        <div class="flex-1 px-4 text-center">
            <a href="/" class="text-xl font-black tracking-tighter uppercase italic">Jeju.Live <span class="text-blue-600">Admin</span></a>
        </div>
        <div class="flex-none gap-4">
             <button class="btn btn-sm btn-outline border-slate-300" onclick={() => alertState.toggleQuietMode()}>
                <span class={isMounted && alertState.isQuietMode ? 'text-error' : 'text-success'}>●</span>
                <span>{isMounted && alertState.isQuietMode ? 'MUTE' : 'LIVE'}</span>
            </button>
            {#if auth.user}
                <div class="flex items-center gap-3 bg-slate-100 px-4 py-1.5 rounded-full border border-slate-200">
                    <span class="text-xs font-bold">{auth.user.username}</span>
                    <a href="/logout" data-sveltekit-reload class="text-[10px] font-black text-slate-400 hover:text-error uppercase">Logout</a>
                </div>
            {:else}
                <a href="/login" class="btn btn-sm border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-white">Login</a>
            {/if}
        </div>
    </header>

    <div class="flex flex-1 overflow-hidden relative">
        
        <!-- 📱 사이드바 (구조 고정) -->
                <aside class="bg-[#1e293b] text-slate-300 transition-all duration-300 ease-in-out z-[900] shadow-2xl overflow-hidden {isSidebarOpen ? 'w-64' : 'w-0'}">
            <div class="w-64 h-full flex flex-col pt-8 pb-10 overflow-y-auto">
                <nav class="flex flex-col gap-1 px-3">
                    {#if !data.menus}
                        <div class="p-10 text-center opacity-20 italic">Loading...</div>
                    {:else}
                        {#each data.menus as m, i (m.id || i)}
                            {#if (m.sub_menus && m.sub_menus.length > 0) || m.link_type === 'FOLDER'}
                                <div class="flex flex-col">
                                    <button class="flex items-center justify-between px-5 py-4 text-xs font-black text-slate-500 hover:text-white uppercase tracking-widest" onclick={() => toggleMenu(m.id)}>
                                        <span class="flex items-center gap-2"><Icon icon={m.icon_name || 'ph:folder-fill'} class="w-4 h-4" /> {m.title}</span>
                                        <span class="text-[8px] transition-transform {openMenus[m.id] ? 'rotate-180' : ''}">▼</span>
                                    </button>
                                    {#if openMenus[m.id]}
                                       <div class="pl-6 mt-1 space-y-1 mb-4 border-l border-slate-800 ml-7">
                                           {#each (m.sub_menus || []) as sub, si (sub.id || si)}
                                               <a href={sub.external_url} class="flex items-center gap-4 px-4 py-3 text-sm font-bold rounded-xl {isActive(sub.external_url) ? 'bg-blue-600 text-white' : 'hover:bg-slate-800 hover:text-white'}">
                                                   <Icon icon={sub.icon_name || 'ph:link-fill'} class="w-4 h-4 opacity-40" />
                                                   <span>{sub.title}</span>
                                               </a>
                                           {/each}
                                       </div>
                                    {/if}
                                </div>
                            {:else}
                                <a href={m.external_url} class="flex items-center gap-4 px-5 py-4 text-sm font-black rounded-2xl mb-1 {isActive(m.external_url) ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white hover:bg-slate-800'}">
                                    <Icon icon={m.icon_name || 'ph:rocket-fill'} class="w-4 h-4 opacity-70" />
                                    <span>{m.title}</span>
                                </a>
                            {/if}
                        {/each}
                    {/if}
                </nav>
            </div>
        </aside>

        <!-- 🚀 메인 본문 -->
        <main class="flex-1 overflow-auto bg-slate-50 transition-all">
            <div class="p-4 md:p-8 lg:p-12 max-w-[1600px] mx-auto min-h-screen">
                {@render children()}
            </div>
        </main>
    </div>
</div>

<style>
    :global(.btn) { border-radius: 8px; transition: all 0.2s; }
</style>
