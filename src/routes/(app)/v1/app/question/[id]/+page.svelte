<script>
    /**
     * @file (app)/v1/app/question/[id]/+page.svelte
     * @description 질문 상세 보기 및 댓글(답변) 영역 (Svelte 5 Runes & DaisyUI)
     */
    import Icon from '@iconify/svelte';
    import { formatDateTime } from "$lib/utils.js";
    import { page } from '$app/state';
    import { enhance } from '$app/forms';

    let { data } = $props();
    const id = page.params.id;

    /**
     * @param {SubmitEvent} event
     */
    function confirmDelete(event) {
        if (!confirm("이 질문을 정말 삭제하시겠습니까? 관련 답변도 모두 사라집니다.")) {
            event.preventDefault();
        }
    }
</script>

<div class="space-y-12 animate-fade-in font-['Noto_Sans_KR','Outfit'] pb-40 px-4 md:px-8 max-w-4xl mx-auto">
    <!-- Navigation -->
    <div class="flex items-center gap-4">
        <a href="/v1/app/question" class="group flex items-center gap-2 text-slate-400 hover:text-slate-900 transition-colors font-black uppercase text-[10px] tracking-widest">
            <Icon icon="mdi:arrow-left" class="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Archive
        </a>
    </div>

    {#if data.error}
        <div class="bg-rose-50 border-2 border-rose-100 p-12 rounded-[2rem] text-center">
            <Icon icon="mdi:alert-circle" class="w-16 h-16 text-rose-500 mx-auto mb-4" />
            <h2 class="text-2xl font-black text-rose-900 uppercase">ACCESS DENIED</h2>
            <p class="text-rose-600 font-bold mt-2">{data.error}</p>
        </div>
    {:else if data.question}
        <article class="bg-white border-2 border-slate-900 rounded-[3rem] overflow-hidden shadow-2xl">
            <!-- Article Header -->
            <header class="p-10 md:p-14 bg-slate-900 text-white">
                <div class="flex items-center gap-3 mb-6">
                    <span class="px-3 py-1 bg-emerald-500 text-slate-900 font-black text-[10px] rounded-full uppercase tracking-widest">Question #{id}</span>
                    <span class="text-slate-400 font-bold text-xs">{formatDateTime(data.question.create_date)}</span>
                </div>
                <h1 class="text-4xl md:text-5xl font-black tracking-tighter leading-tight italic">
                    {data.question.subject}
                </h1>
                <div class="flex items-center gap-2 mt-8 opacity-60">
                    <div class="w-6 h-6 rounded-md bg-slate-700 flex items-center justify-center font-black text-[10px]">
                        {data.question.user_id}
                    </div>
                    <span class="text-[10px] font-black uppercase tracking-widest">Author: Staff_ID_{data.question.user_id}</span>
                </div>
            </header>

            <!-- Article Content -->
            <div class="p-10 md:p-14 text-slate-900 text-lg leading-relaxed font-medium whitespace-pre-wrap min-h-[300px]">
                {data.question.content}
            </div>

            <!-- Article Actions -->
            <footer class="px-10 md:p-14 py-8 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                <div class="flex gap-4">
                    <a href="/v1/app/question/modify/{id}" class="btn btn-neutral rounded-xl px-6 font-black uppercase italic text-xs">Edit</a>
                    <form method="POST" action="?/delete" use:enhance onsubmit={confirmDelete}>
                        <button type="submit" class="btn btn-ghost text-rose-500 hover:bg-rose-50 border-none rounded-xl px-6 font-black uppercase italic text-xs">Delete</button>
                    </form>
                </div>
                <div class="flex items-center gap-6">
                    <button class="flex items-center gap-2 text-slate-400 hover:text-blue-600 transition-colors group">
                        <Icon icon="mdi:thumb-up" class="w-5 h-5 group-hover:scale-125 transition-transform" />
                        <span class="font-black text-xs">HELPFUL</span>
                    </button>
                    <button class="flex items-center gap-2 text-slate-400 hover:text-rose-600 transition-colors group">
                        <Icon icon="mdi:bookmark" class="w-5 h-5 group-hover:scale-125 transition-transform" />
                        <span class="font-black text-xs">SAVE</span>
                    </button>
                </div>
            </footer>
        </article>

        <!-- Answers Section (Legacy placeholder) -->
        <div class="space-y-8 pt-10 px-8">
            <h3 class="text-2xl font-black italic text-slate-300 uppercase tracking-tighter flex items-center gap-3">
                Expert Replies
                <span class="bg-slate-100 text-slate-400 text-[10px] not-italic px-2 py-0.5 rounded-md font-bold">{data.question.answers?.length || 0}</span>
            </h3>
            
            {#if data.question.answers && data.question.answers.length > 0}
                <div class="space-y-6">
                    {#each data.question.answers as ans (ans.id)}
                        <div class="bg-white border border-slate-100 p-8 rounded-[2rem] shadow-lg">
                            <div class="flex justify-between items-center mb-4">
                                <div class="flex items-center gap-2">
                                    <div class="w-6 h-6 rounded bg-slate-100 flex items-center justify-center font-black text-[10px] text-slate-400">
                                        {ans.user_id}
                                    </div>
                                    <span class="text-[10px] font-black text-slate-500 uppercase tracking-widest">Expert_ID_{ans.user_id}</span>
                                </div>
                                <span class="text-[10px] font-bold text-slate-300">{formatDateTime(ans.create_date)}</span>
                            </div>
                            <p class="text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">
                                {ans.content}
                            </p>
                        </div>
                    {/each}
                </div>
            {:else}
                <div class="py-20 text-center border-2 border-slate-100 border-dashed rounded-[3rem] opacity-50">
                    <Icon icon="mdi:comment-question-outline" class="w-12 h-12 text-slate-200 mx-auto mb-4" />
                    <p class="text-sm font-bold text-slate-300 uppercase italic">No answers registered yet</p>
                </div>
            {/if}
        </div>
    {:else}
        <div class="py-32 text-center">
            <span class="loading loading-spinner loading-lg text-slate-200"></span>
        </div>
    {/if}
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
