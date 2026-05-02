<script>
	/**
	 * @file (app)/v1/app/question/[id]/+page.svelte
	 * @description 질문 상세 보기 및 댓글(답변) 영역 (Svelte 5 Runes & DaisyUI)
	 */
	import Icon from '@iconify/svelte';
	import { formatDateTime } from '$lib/utils.js';
	import { page } from '$app/state';
	import { enhance } from '$app/forms';

	let { data } = $props();
	const id = page.params.id;

	/**
	 * @param {SubmitEvent} event
	 */
	function confirmDelete(event) {
		if (!confirm('이 질문을 정말 삭제하시겠습니까? 관련 답변도 모두 사라집니다.')) {
			event.preventDefault();
		}
	}
</script>

<div
	class="animate-fade-in mx-auto max-w-4xl space-y-12 px-4 pb-40 font-['Noto_Sans_KR','Outfit'] md:px-8"
>
	<!-- Navigation -->
	<div class="flex items-center gap-4">
		<a
			href="/v1/app/question"
			class="group flex items-center gap-2 text-[10px] font-black tracking-widest text-slate-400 uppercase transition-colors hover:text-slate-900"
		>
			<Icon icon="mdi:arrow-left" class="h-4 w-4 transition-transform group-hover:-translate-x-1" />
			Back to Archive
		</a>
	</div>

	{#if data.error}
		<div class="rounded-[2rem] border-2 border-rose-100 bg-rose-50 p-12 text-center">
			<Icon icon="mdi:alert-circle" class="mx-auto mb-4 h-16 w-16 text-rose-500" />
			<h2 class="text-2xl font-black text-rose-900 uppercase">ACCESS DENIED</h2>
			<p class="mt-2 font-bold text-rose-600">{data.error}</p>
		</div>
	{:else if data.question}
		<article class="overflow-hidden rounded-[3rem] border-2 border-slate-900 bg-white shadow-2xl">
			<!-- Article Header -->
			<header class="bg-slate-900 p-10 text-white md:p-14">
				<div class="mb-6 flex items-center gap-3">
					<span
						class="rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-black tracking-widest text-slate-900 uppercase"
						>Question #{id}</span
					>
					<span class="text-xs font-bold text-slate-400"
						>{formatDateTime(data.question.create_date)}</span
					>
				</div>
				<h1 class="text-4xl leading-tight font-black tracking-tighter italic md:text-5xl">
					{data.question.subject}
				</h1>
				<div class="mt-8 flex items-center gap-2 opacity-60">
					<div
						class="flex h-6 w-6 items-center justify-center rounded-md bg-slate-700 text-[10px] font-black"
					>
						{data.question.user_id}
					</div>
					<span class="text-[10px] font-black tracking-widest uppercase"
						>Author: Staff_ID_{data.question.user_id}</span
					>
				</div>
			</header>

			<!-- Article Content -->
			<div
				class="min-h-[300px] p-10 text-lg leading-relaxed font-medium whitespace-pre-wrap text-slate-900 md:p-14"
			>
				{data.question.content}
			</div>

			<!-- Article Actions -->
			<footer
				class="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-10 py-8 md:p-14"
			>
				<div class="flex gap-4">
					<a
						href="/v1/app/question/modify/{id}"
						class="btn rounded-xl px-6 text-xs font-black uppercase italic btn-neutral">Edit</a
					>
					<form method="POST" action="?/delete" use:enhance onsubmit={confirmDelete}>
						<button
							type="submit"
							class="btn rounded-xl border-none px-6 text-xs font-black text-rose-500 uppercase italic btn-ghost hover:bg-rose-50"
							>Delete</button
						>
					</form>
				</div>
				<div class="flex items-center gap-6">
					<button
						class="group flex items-center gap-2 text-slate-400 transition-colors hover:text-blue-600"
					>
						<Icon icon="mdi:thumb-up" class="h-5 w-5 transition-transform group-hover:scale-125" />
						<span class="text-xs font-black">HELPFUL</span>
					</button>
					<button
						class="group flex items-center gap-2 text-slate-400 transition-colors hover:text-rose-600"
					>
						<Icon icon="mdi:bookmark" class="h-5 w-5 transition-transform group-hover:scale-125" />
						<span class="text-xs font-black">SAVE</span>
					</button>
				</div>
			</footer>
		</article>

		<!-- Answers Section (Legacy placeholder) -->
		<div class="space-y-8 px-8 pt-10">
			<h3
				class="flex items-center gap-3 text-2xl font-black tracking-tighter text-slate-300 uppercase italic"
			>
				Expert Replies
				<span
					class="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-400 not-italic"
					>{data.question.answers?.length || 0}</span
				>
			</h3>

			{#if data.question.answers && data.question.answers.length > 0}
				<div class="space-y-6">
					{#each data.question.answers as ans (ans.id)}
						<div class="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-lg">
							<div class="mb-4 flex items-center justify-between">
								<div class="flex items-center gap-2">
									<div
										class="flex h-6 w-6 items-center justify-center rounded bg-slate-100 text-[10px] font-black text-slate-400"
									>
										{ans.user_id}
									</div>
									<span class="text-[10px] font-black tracking-widest text-slate-500 uppercase"
										>Expert_ID_{ans.user_id}</span
									>
								</div>
								<span class="text-[10px] font-bold text-slate-300"
									>{formatDateTime(ans.create_date)}</span
								>
							</div>
							<p class="leading-relaxed font-medium whitespace-pre-wrap text-slate-700">
								{ans.content}
							</p>
						</div>
					{/each}
				</div>
			{:else}
				<div
					class="rounded-[3rem] border-2 border-dashed border-slate-100 py-20 text-center opacity-50"
				>
					<Icon icon="mdi:comment-question-outline" class="mx-auto mb-4 h-12 w-12 text-slate-200" />
					<p class="text-sm font-bold text-slate-300 uppercase italic">No answers registered yet</p>
				</div>
			{/if}
		</div>
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
