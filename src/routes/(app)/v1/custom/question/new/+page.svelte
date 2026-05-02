<script>
	/**
	 * @file (app)/v1/app/question/new/+page.svelte
	 * @description 신규 질문 등록 페이지 (Svelte 5 Runes & DaisyUI)
	 */
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import Icon from '@iconify/svelte';
	import { alertState } from '$lib/runes/alert.svelte.js';

	let subject = $state('');
	let content = $state('');
	let loading = $state(false);
	let buildingColor = $state('#3b82f6');
	let id = $state('');

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
				>Create Knowledge Entry</span
			>
			<h1 class="text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-6xl">
				질문 <span class="NOT-ITALIC text-blue-600"
					>작성 <Icon
						icon="mdi:pencil-outline"
						class="ml-1 inline-block align-text-bottom text-blue-600"
					/></span
				>
			</h1>
			<p class="mt-4 text-sm font-bold text-slate-500">
				궁금한 내용을 아래 양식에 맞춰 상세히 작성해주세요.
			</p>
		</div>
		<a
			href="/v1/app/question"
			class="btn border-none text-[10px] font-black tracking-widest text-slate-400 uppercase btn-ghost hover:text-slate-900"
		>
			Cancel
		</a>
	</div>

	<!-- Form -->
	<form
		onsubmit={handleSubmit}
		class="relative space-y-12 overflow-hidden rounded-[3rem] border-2 border-slate-900 bg-white p-10 shadow-2xl md:p-14"
	>
		{#if loading}
			<div
				class="absolute inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm"
			>
				<span class="loading loading-lg loading-bars text-blue-600"></span>
			</div>
		{/if}

		<div class="space-y-4">
			<label
				class="ml-1 block text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase"
				for="subject">Question Subject / Title</label
			>
			<div class="grid grid-cols-4 gap-4">
				{#each ['#f43f5e', '#10b981', '#3b82f6', '#f59e0b'] as color (color)}
					<button
						type="button"
						aria-label="Change building color to {color}"
						class="aspect-square w-full rounded-2xl border-4 transition-all {buildingColor === color
							? 'scale-110 border-white shadow-lg'
							: 'border-transparent'}"
						style="background: {color};"
						onclick={() => (buildingColor = color)}
					></button>
				{/each}
			</div>
			<input
				type="text"
				id="subject"
				bind:value={subject}
				placeholder="질문의 핵심 내용을 입력하세요"
				class="w-full rounded-2xl border-none bg-slate-50 p-6 text-xl font-black text-slate-900 italic transition-all outline-none placeholder:text-slate-200 focus:ring-4 focus:ring-blue-100 md:text-2xl"
				maxlength="200"
				required
			/>
		</div>

		<div class="space-y-4">
			<label
				class="ml-1 block text-[10px] font-black tracking-[0.3em] text-slate-400 uppercase"
				for="content">Article Body / Context</label
			>
			<textarea
				id="content"
				bind:value={content}
				placeholder="문제를 해결하기 위해 필요한 정보나 재현 단차 등을 상세히 적어주시면 빠른 답변을 받을 수 있습니다."
				class="min-h-[400px] w-full rounded-3xl border-none bg-slate-50 p-8 text-lg leading-relaxed font-medium text-slate-700 transition-all outline-none placeholder:text-slate-200 focus:ring-4 focus:ring-blue-100"
				required
			></textarea>
		</div>

		<div class="flex justify-end pt-6">
			<button
				type="submit"
				class="group btn rounded-2xl border-none bg-blue-600 px-12 font-black text-white shadow-xl transition-all btn-lg hover:bg-blue-700"
				disabled={loading}
			>
				{loading ? 'Submitting...' : '질문 등록하기'}
				<Icon icon="mdi:send" class="h-6 w-6 transition-transform group-hover:translate-x-2" />
			</button>
		</div>
	</form>
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
