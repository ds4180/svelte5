<script>
    /**
     * @file svelte5/src/routes/(app)/v1/pages/miniapps/+page.svelte
     * @description 통합 미니앱 허브 대시보드 (Unified Feed Architecture)
     */
    import Icon from '@iconify/svelte';
    import { onMount } from 'svelte';
    import FeedItem from '$lib/components/Miniapps/FeedItem.svelte';
    import { miniappStore } from '$lib/runes/miniapps.svelte.js';

    let memoInput = $state('');

    onMount(() => {
        // 페이지 로드 시 해시 이동
        if (window.location.hash) {
            const el = document.querySelector(window.location.hash);
            if (el) el.scrollIntoView({ behavior: 'smooth' });
        }
    });

    // 액션 핸들러
    function handleAction(id, action, value) {
        if (action === 'status') {
            miniappStore.updateItem(id, { status: value });
        } else if (action === 'toggle_done') {
            miniappStore.updateItem(id, { is_done: value });
        } else if (action === 'delete') {
            miniappStore.deleteItem(id);
        } else if (action === 'reply') {
            alert('답장 기능을 준비 중입니다.');
        }
    }

    function addMemo() {
        if (!memoInput.trim()) return;
        miniappStore.addItem('MEMO', memoInput, { is_done: false });
        memoInput = '';
    }
</script>

<div class="container mx-auto max-w-4xl p-8 pb-40">
    <header class="mb-12 border-b-2 border-slate-900 pb-8 flex justify-between items-end">
        <div>
            <h1 class="text-4xl font-black uppercase italic tracking-tighter text-slate-900">
                Miniapps Hub
            </h1>
            <p class="text-slate-500 text-sm mt-2 font-bold italic">Real-time Unified Action Feed</p>
        </div>
        <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <span class="text-[10px] font-black uppercase tracking-widest text-slate-400">Live Syncing</span>
        </div>
    </header>

    <div class="space-y-12">
        <!-- 📝 Quick Memo Input -->
        <section id="memo-input" class="bg-slate-900 p-8 rounded-[40px] shadow-2xl relative overflow-hidden group">
            <div class="absolute right-0 top-0 w-1/2 h-full bg-gradient-to-l from-white/5 to-transparent"></div>
            <div class="relative z-10">
                <h2 class="text-white font-black text-xl mb-6 italic uppercase tracking-tighter flex items-center gap-3">
                    <Icon icon="ph:pencil-line-fill" /> 무엇을 도와드릴까요?
                </h2>
                <div class="flex gap-4">
                    <input 
                        type="text" 
                        bind:value={memoInput}
                        onkeydown={(e) => e.key === 'Enter' && addMemo()}
                        placeholder="새로운 메모나 할 일을 입력하세요..."
                        class="flex-1 bg-white/10 border-none rounded-2xl px-6 text-white font-bold placeholder:text-white/20 focus:ring-2 focus:ring-white/30 transition-all outline-none"
                    />
                    <button 
                        class="btn btn-square bg-white hover:bg-slate-200 border-none rounded-2xl group-active:scale-95 transition-all"
                        onclick={addMemo}
                    >
                        <Icon icon="ph:plus-bold" class="text-slate-900 text-xl" />
                    </button>
                </div>
            </div>
        </section>

        <!-- 🔔 Global Notifications -->
        {#if miniappStore.items.filter(i => i.type === 'NOTIFICATION').length > 0}
            <section id="notifications" class="scroll-mt-20">
                <h3 class="flex items-center gap-3 font-black text-xl tracking-tighter uppercase italic mb-6">
                    <Icon icon="ph:bell-ringing-fill" class="text-rose-500" /> 실시간 알림
                </h3>
                <div class="space-y-4">
                    {#each miniappStore.items.filter(i => i.type === 'NOTIFICATION') as item (item.id)}
                        <FeedItem {item} onAction={(a, v) => handleAction(item.id, a, v)} />
                    {/each}
                </div>
            </section>
        {/if}

        <!-- 📋 Instructions -->
        <section id="instructions" class="scroll-mt-20">
            <h3 class="flex items-center gap-3 font-black text-xl tracking-tighter uppercase italic mb-6">
                <Icon icon="ph:info-fill" class="text-indigo-600" /> 지시사항 및 업무
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {#each miniappStore.items.filter(i => i.type === 'INSTRUCTION') as item (item.id)}
                    <FeedItem {item} onAction={(a, v) => handleAction(item.id, a, v)} />
                {/each}
            </div>
        </section>
        
        <!-- 💬 Messaging -->
        <section id="messaging" class="scroll-mt-20">
            <h3 class="flex items-center gap-3 font-black text-xl tracking-tighter uppercase italic mb-6">
                <Icon icon="ph:paper-plane-tilt-fill" class="text-blue-600" /> 최근 메시지 및 질문
            </h3>
            <div class="space-y-4">
                {#each miniappStore.items.filter(i => i.type === 'MESSAGE') as item (item.id)}
                    <FeedItem {item} onAction={(a, v) => handleAction(item.id, a, v)} />
                {/each}
            </div>
        </section>

        <!-- 📒 Quick Memo & Tasks -->
        <section id="memo" class="scroll-mt-20">
            <h3 class="flex items-center gap-3 font-black text-xl tracking-tighter uppercase italic mb-6">
                <Icon icon="ph:notepad-fill" class="text-amber-500" /> 메모 및 할 일
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {#each miniappStore.items.filter(i => i.type === 'MEMO') as item (item.id)}
                    <FeedItem {item} onAction={(a, v) => handleAction(item.id, a, v)} />
                {/each}
            </div>
        </section>
    </div>
</div>
