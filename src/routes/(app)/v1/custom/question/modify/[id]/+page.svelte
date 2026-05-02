<script>
	/**
	 * @file (app)/v1/app/question/modify/[id]/+page.svelte
	 * @description 기존 질문 수정 페이지 (Svelte 5 Runes & DaisyUI)
	 */
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Icon from '@iconify/svelte';
	import { alertState } from '$lib/runes/alert.svelte.js';

	let { data } = $props();
	const id = page.params.id;

	// 초기값 설정 ($state) - snapshot to avoid reactive warning
	let subject = $state($state.snapshot(data.question?.subject) || '');
	let content = $state($state.snapshot(data.question?.content) || '');
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
				body: JSON.stringify({ question_id: parseInt(id || '0'), subject, content })
			});

			if (response.ok) {
				alertState.send('질문이 성공적으로 수정되었습니다.', { level: 1, style: 'success' });
				goto(`/v1/app/question/${id}`);
			} else {
				const err = await response.json();
				alertState.send(err.detail || '수정에 실패했습니다.', { level: 3, style: 'error' });
			}
		} catch (error) {
			const e = /** @type {Error} */ (error);
			alertState.send(e.message, { level: 3, style: 'error' });
		} finally {
			loading = false;
		}
	}
</script>

<div
	class="animate-fade-in mx-auto max-w-4xl space-y-12 px-4 pb-40 font-['Noto_Sans_KR','Outfit'] md:px-8"
>
	<!-- Header -->
	<div
		class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end"
	>
		<div>
			<span class="mb-2 block text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase"
				>Revision Interface v1.0</span
			>
			<h1 class="text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-6xl">
				지식 <span class="NOT-ITALIC text-rose-500"
					>보정 <Icon
						icon="mdi:pencil-ruler"
						class="ml-1 inline-block align-text-bottom text-rose-500"
					/></span
				>
			</h1>
			<p class="mt-4 text-sm font-bold text-slate-500">
				질문 내용 #{id} 번의 오타나 누락된 정보를 보강합니다.
			</p>
		</div>
		<a
			href="/v1/app/question/{id}"
			class="btn border-none text-[10px] font-black tracking-widest text-slate-400 uppercase btn-ghost hover:text-slate-900"
		>
			Cancel
		</a>
	</div>

	{#if data.error}
		<div class="rounded-[2rem] border-2 border-rose-100 bg-rose-50 p-12 text-center">
			<Icon icon="mdi:alert-box" class="mx-auto mb-4 h-16 w-16 text-rose-500" />
			<h2 class="text-xl font-black text-rose-900">{data.error}</h2>
			<p class="mt-2 text-rose-600">유효하지 않은 요청이거나 인증이 만료되었습니다.</p>
		</div>
	{:else if data.question}
		<!-- Form -->
		<form
			onsubmit={handleSubmit}
			class="relative space-y-12 rounded-[3rem] border-2 border-slate-900 bg-white p-10 shadow-2xl md:p-14"
		>
			{#if loading}
				<div
					class="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm"
				>
					<span class="loading loading-lg loading-spinner text-rose-600"></span>
				</div>
			{/if}

			<div class="space-y-4">
				<label
					class="ml-1 block text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase"
					for="subject">Revision Subject / Draft</label
				>
				<input
					type="text"
					id="subject"
					bind:value={subject}
					class="w-full rounded-2xl border-none bg-slate-50 p-6 text-xl font-black text-slate-900 italic transition-all outline-none focus:ring-4 focus:ring-rose-100 md:text-2xl"
					maxlength="200"
					required
				/>
			</div>

			<div class="space-y-4">
				<label
					class="ml-1 block text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase"
					for="content">Context Refinement</label
				>
				<textarea
					id="content"
					bind:value={content}
					class="min-h-[400px] w-full rounded-3xl border-none bg-slate-50 p-8 text-lg leading-relaxed font-medium text-slate-700 transition-all outline-none focus:ring-4 focus:ring-rose-100"
					required
				></textarea>
			</div>

			<div class="flex justify-end pt-6">
				<button
					type="submit"
					class="group btn rounded-2xl border-none bg-rose-600 px-12 font-black text-white shadow-xl transition-all btn-lg hover:bg-rose-700"
					disabled={loading}
				>
					{loading ? 'Processing...' : '수정사항 적용'}
					<Icon
						icon="mdi:check-decagram"
						class="h-6 w-6 transition-transform group-hover:scale-125"
					/>
				</button>
			</div>
		</form>
	{:else}
		<div class="py-32 text-center">
			<span class="loading loading-lg loading-spinner text-slate-200"></span>
		</div>
	{/if}
</div>

<style>
	.animate-fade-in {
		animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
