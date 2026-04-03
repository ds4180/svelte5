<script>
    /**
     * @file (app)/v1/app/question/new/+page.svelte
     * @description 신규 질문 등록 페이지 (Svelte 5 Runes & DaisyUI)
     */
    import { enhance } from "$app/forms";
    import { goto } from "$app/navigation";
    import Icon from '@iconify/svelte';
    import { alertState } from "$lib/runes/alert.svelte.js";

    let subject = $state("");
    let content = $state("");
    let loading = $state(false);
    let buildingColor = $state("#3b82f6");
    let id = $state("");

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
                body: JSON.stringify({ question_id: parseInt(id), subject, content })
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
            <span class="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase block mb-2">Create Knowledge Entry</span>
            <h1 class="text-4xl md:text-6xl font-black tracking-tighter uppercase italic text-slate-900">질문 <span class="text-blue-600 NOT-ITALIC">작성 <Icon icon="mdi:pencil-outline" class="inline-block align-text-bottom text-blue-600 ml-1" /></span></h1>
            <p class="text-sm font-bold text-slate-500 mt-4">궁금한 내용을 아래 양식에 맞춰 상세히 작성해주세요.</p>
        </div>
        <a href="/v1/app/question" class="btn btn-ghost text-slate-400 hover:text-slate-900 font-black uppercase text-[10px] tracking-widest border-none">
             Cancel
        </a>
    </div>

    <!-- Form -->
    <form onsubmit={handleSubmit} class="space-y-12 bg-white border-2 border-slate-900 rounded-[3rem] p-10 md:p-14 shadow-2xl overflow-hidden relative">
        {#if loading}
            <div class="absolute inset-0 bg-white/80 z-50 flex items-center justify-center backdrop-blur-sm">
                <span class="loading loading-bars loading-lg text-blue-600"></span>
            </div>
        {/if}

        <div class="space-y-4">
            <label class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 block ml-1" for="subject">Question Subject / Title</label>
            <div class="grid grid-cols-4 gap-4">
                {#each ['#f43f5e', '#10b981', '#3b82f6', '#f59e0b'] as color (color)}
                    <button 
                        type="button"
                        aria-label="Change building color to {color}"
                        class="w-full aspect-square rounded-2xl border-4 transition-all {buildingColor === color ? 'border-white scale-110 shadow-lg' : 'border-transparent'}"
                        style="background: {color};"
                        onclick={() => buildingColor = color}
                    ></button>
                {/each}
            </div>
            <input 
                type="text" 
                id="subject"
                bind:value={subject}
                placeholder="질문의 핵심 내용을 입력하세요"
                class="w-full bg-slate-50 border-none rounded-2xl p-6 text-xl md:text-2xl font-black text-slate-900 placeholder:text-slate-200 focus:ring-4 focus:ring-blue-100 transition-all outline-none italic"
                maxlength="200"
                required
            />
        </div>

        <div class="space-y-4">
            <label class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 block ml-1" for="content">Article Body / Context</label>
            <textarea 
                id="content"
                bind:value={content}
                placeholder="문제를 해결하기 위해 필요한 정보나 재현 단차 등을 상세히 적어주시면 빠른 답변을 받을 수 있습니다."
                class="w-full bg-slate-50 border-none rounded-3xl p-8 text-lg font-medium text-slate-700 min-h-[400px] leading-relaxed placeholder:text-slate-200 focus:ring-4 focus:ring-blue-100 transition-all outline-none"
                required
            ></textarea>
        </div>

        <div class="flex justify-end pt-6">
            <button type="submit" class="group btn btn-lg bg-blue-600 text-white rounded-2xl px-12 font-black hover:bg-blue-700 border-none transition-all shadow-xl" disabled={loading}>
                 {loading ? 'Submitting...' : '질문 등록하기'}
                 <Icon icon="mdi:send" class="w-6 h-6 group-hover:translate-x-2 transition-transform" />
            </button>
        </div>
    </form>
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
