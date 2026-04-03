<script>
    /**
     * @file (app)/v1/app/question/+page.svelte
     * @description 레거시 질문 게시판 목록 (Svelte 5 Runes & DaisyUI)
     */
    import { onMount } from "svelte";
    import Icon from '@iconify/svelte';
    import { alertState } from "$lib/runes/alert.svelte.js";
    import { formatDateTime } from "$lib/utils.js";

    /**
     * @typedef {Object} Question
     * @property {number} id
     * @property {string} subject
     * @property {string} content
     * @property {string} create_date
     * @property {number} user_id
     */

    /** @type {Question[]} */
    let questions = $state([]);
    let loading = $state(true);

    async function loadQuestions() {
        loading = true;
        try {
            const response = await fetch('/api/question/list');
            if (response.ok) {
                const data = await response.json();
                questions = data.question_list || [];
            } else {
                throw new Error("질문 목록을 불러오지 못했습니다.");
            }
        } catch (error) {
            const e = /** @type {Error} */ (error);
            alertState.send(e.message, { level: 3, style: 'error' });
        } finally {
            loading = false;
        }
    }

    onMount(loadQuestions);
</script>

<div class="space-y-10 animate-fade-in font-['Noto_Sans_KR','Outfit'] pb-40 px-4 md:px-8 max-w-5xl mx-auto">
    <!-- Header -->
    <div class="border-b-4 border-slate-900 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
            <span class="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase block mb-2">Q&A Knowledge Base</span>
            <h1 class="text-4xl md:text-6xl font-black tracking-tighter uppercase italic text-slate-900">지식 <span class="text-emerald-600 NOT-ITALIC">공유 <Icon icon="mdi:frequently-asked-questions" class="inline-block align-text-bottom text-emerald-600 ml-1" /></span></h1>
            <p class="text-sm font-bold text-slate-500 mt-4">궁금한 점을 질문하고 함께 해답을 찾아가는 레거시 지식 플랫폼입니다.</p>
        </div>
        <a href="/v1/app/question/new" class="btn btn-lg bg-emerald-600 text-white rounded-2xl px-10 font-black hover:bg-emerald-700 border-none transition-all shadow-xl">
             <Icon icon="mdi:plus-circle" class="w-6 h-6" />
             질문하기
        </a>
    </div>

    <!-- Question Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {#if loading}
            {#each Array(4) as _, i (i)}
                <div class="bg-white border border-slate-100 rounded-2xl p-8 space-y-4 shadow-xl opacity-50 animate-pulse">
                    <div class="h-4 bg-slate-200 rounded w-1/3"></div>
                    <div class="h-8 bg-slate-300 rounded w-full"></div>
                    <div class="h-4 bg-slate-200 rounded w-2/3"></div>
                </div>
            {/each}
        {:else if questions.length === 0}
            <div class="col-span-full py-32 text-center border-4 border-slate-100 border-dashed rounded-[3rem]">
                <Icon icon="mdi:database-off-outline" class="w-20 h-20 mx-auto text-slate-200 mb-6" />
                <p class="text-2xl font-black text-slate-300 italic">아직 등록된 질문이 없습니다.</p>
                <p class="text-sm text-slate-400 mt-2 font-bold">첫 번째 질문의 주인공이 되어보세요!</p>
            </div>
        {:else}
            {#each questions as q (q.id)}
                <a href="/v1/app/question/{q.id}" class="group bg-white border border-slate-100 rounded-[2rem] p-8 shadow-lg hover:shadow-2xl hover:border-emerald-200 transition-all duration-300 flex flex-col justify-between">
                    <div>
                        <div class="flex justify-between items-start mb-6">
                            <span class="text-[10px] font-black text-slate-300 uppercase tracking-widest border border-slate-100 px-2 py-0.5 rounded-md">Q. {q.id}</span>
                            <span class="text-[10px] font-bold text-slate-400">{formatDateTime(q.create_date)}</span>
                        </div>
                        <h2 class="text-2xl font-black text-slate-900 group-hover:text-emerald-700 transition-colors leading-tight mb-4 tracking-tight">
                            {q.subject}
                        </h2>
                        <p class="text-sm text-slate-500 line-clamp-2 font-medium leading-relaxed mb-8">
                            {q.content}
                        </p>
                    </div>
                    <div class="flex items-center justify-between pt-6 border-t border-slate-50">
                        <div class="flex items-center gap-2">
                             <div class="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center font-black text-xs text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors">
                                {q.user_id}
                             </div>
                             <span class="text-xs font-bold text-slate-400">User_{q.user_id}</span>
                        </div>
                        <span class="text-emerald-600 group-hover:translate-x-1 transition-transform">
                             <Icon icon="mdi:arrow-right-circle" class="w-8 h-8" />
                        </span>
                    </div>
                </a>
            {/each}
        {/if}
    </div>
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
