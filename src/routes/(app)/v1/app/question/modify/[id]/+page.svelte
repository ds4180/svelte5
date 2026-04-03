<script>
    /**
     * @file (app)/v1/app/question/modify/[id]/+page.svelte
     * @description 기존 질문 수정 페이지 (Svelte 5 Runes & DaisyUI)
     */
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import Icon from '@iconify/svelte';
    import { alertState } from "$lib/runes/alert.svelte.js";

    let { data } = $props();
    const id = page.params.id;

    // 초기값 설정 ($state) - snapshot to avoid reactive warning
    let subject = $state($state.snapshot(data.question?.subject) || "");
    let content = $state($state.snapshot(data.question?.content) || "");
    let loading = $state(false);

    /**
     * @param {SubmitEvent} event
     */
    async function handleSubmit(event) {
        event.preventDefault();
        loading = true;

        try {
            const response = await fetch('/api/question/update', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ question_id: parseInt(id || "0"), subject, content })
            });

            if (response.ok) {
                alertState.send("질문이 성공적으로 수정되었습니다.", { level: 1, style: 'success' });
                goto(`/v1/app/question/${id}`);
            } else {
                const err = await response.json();
                alertState.send(err.detail || "수정에 실패했습니다.", { level: 3, style: 'error' });
            }
        } catch (error) {
            const e = /** @type {Error} */ (error);
            alertState.send(e.message, { level: 3, style: 'error' });
        } finally {
            loading = false;
        }
    }
</script>

<div class="space-y-12 animate-fade-in font-['Noto_Sans_KR','Outfit'] pb-40 px-4 md:px-8 max-w-4xl mx-auto">
    <!-- Header -->
    <div class="border-b-4 border-slate-900 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
            <span class="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase block mb-2">Revision Interface v1.0</span>
            <h1 class="text-4xl md:text-6xl font-black tracking-tighter uppercase italic text-slate-900">지식 <span class="text-rose-500 NOT-ITALIC">보정 <Icon icon="mdi:pencil-ruler" class="inline-block align-text-bottom text-rose-500 ml-1" /></span></h1>
            <p class="text-sm font-bold text-slate-500 mt-4">질문 내용 #{id} 번의 오타나 누락된 정보를 보강합니다.</p>
        </div>
        <a href="/v1/app/question/{id}" class="btn btn-ghost text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] tracking-widest border-none">
             Cancel
        </a>
    </div>

    {#if data.error}
        <div class="bg-rose-50 border-2 border-rose-100 p-12 rounded-[2rem] text-center">
            <Icon icon="mdi:alert-box" class="w-16 h-16 text-rose-500 mx-auto mb-4" />
            <h2 class="text-xl font-black text-rose-900">{data.error}</h2>
            <p class="text-rose-600 mt-2">유효하지 않은 요청이거나 인증이 만료되었습니다.</p>
        </div>
    {:else if data.question}
        <!-- Form -->
        <form onsubmit={handleSubmit} class="space-y-12 bg-white border-2 border-slate-900 rounded-[3rem] p-10 md:p-14 shadow-2xl relative">
            {#if loading}
                <div class="absolute inset-0 bg-white/80 z-50 flex items-center justify-center backdrop-blur-sm">
                    <span class="loading loading-spinner loading-lg text-rose-600"></span>
                </div>
            {/if}

            <div class="space-y-4">
                <label class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 block ml-1" for="subject">Revision Subject / Draft</label>
                <input 
                    type="text" 
                    id="subject"
                    bind:value={subject}
                    class="w-full bg-slate-50 border-none rounded-2xl p-6 text-xl md:text-2xl font-black text-slate-900 focus:ring-4 focus:ring-rose-100 transition-all outline-none italic"
                    maxlength="200"
                    required
                />
            </div>

            <div class="space-y-4">
                <label class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 block ml-1" for="content">Context Refinement</label>
                <textarea 
                    id="content"
                    bind:value={content}
                    class="w-full bg-slate-50 border-none rounded-3xl p-8 text-lg font-medium text-slate-700 min-h-[400px] leading-relaxed focus:ring-4 focus:ring-rose-100 transition-all outline-none"
                    required
                ></textarea>
            </div>

            <div class="flex justify-end pt-6">
                <button type="submit" class="group btn btn-lg bg-rose-600 text-white rounded-2xl px-12 font-black hover:bg-rose-700 border-none transition-all shadow-xl" disabled={loading}>
                     {loading ? 'Processing...' : '수정사항 적용'}
                     <Icon icon="mdi:check-decagram" class="w-6 h-6 group-hover:scale-125 transition-transform" />
                </button>
            </div>
        </form>
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
