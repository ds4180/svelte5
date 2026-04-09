<script>
	/**
	 * @file (app)/v1/app/question/+page.svelte
	 * @description 레거시 질문 게시판 목록 (Svelte 5 Runes & DaisyUI)
	 */
	import { onMount } from 'svelte';
	import Icon from '@iconify/svelte';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { formatDateTime } from '$lib/utils.js';

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
				throw new Error('질문 목록을 불러오지 못했습니다.');
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

<div
	class="animate-fade-in mx-auto max-w-5xl space-y-10 px-4 pb-40 font-['Noto_Sans_KR','Outfit'] md:px-8"
>
	<!-- Header -->
	<div
		class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end"
	>
		<div>
			<span class="mb-2 block text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase"
				>Q&A Knowledge Base</span
			>
			<h1 class="text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-6xl">
				지식 <span class="NOT-ITALIC text-emerald-600"
					>공유 <Icon
						icon="mdi:frequently-asked-questions"
						class="ml-1 inline-block align-text-bottom text-emerald-600"
					/></span
				>
			</h1>
			<p class="mt-4 text-sm font-bold text-slate-500">
				궁금한 점을 질문하고 함께 해답을 찾아가는 레거시 지식 플랫폼입니다.
			</p>
		</div>
		<a
			href="/v1/app/question/new"
			class="btn rounded-2xl border-none bg-emerald-600 px-10 font-black text-white shadow-xl transition-all btn-lg hover:bg-emerald-700"
		>
			<Icon icon="mdi:plus-circle" class="h-6 w-6" />
			질문하기
		</a>
	</div>

	<!-- Question Grid -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
		{#if loading}
			{#each Array(4) as _, i (i)}
				<div
					class="animate-pulse space-y-4 rounded-2xl border border-slate-100 bg-white p-8 opacity-50 shadow-xl"
				>
					<div class="h-4 w-1/3 rounded bg-slate-200"></div>
					<div class="h-8 w-full rounded bg-slate-300"></div>
					<div class="h-4 w-2/3 rounded bg-slate-200"></div>
				</div>
			{/each}
		{:else if questions.length === 0}
			<div
				class="col-span-full rounded-[3rem] border-4 border-dashed border-slate-100 py-32 text-center"
			>
				<Icon icon="mdi:database-off-outline" class="mx-auto mb-6 h-20 w-20 text-slate-200" />
				<p class="text-2xl font-black text-slate-300 italic">아직 등록된 질문이 없습니다.</p>
				<p class="mt-2 text-sm font-bold text-slate-400">첫 번째 질문의 주인공이 되어보세요!</p>
			</div>
		{:else}
			{#each questions as q (q.id)}
				<a
					href="/v1/app/question/{q.id}"
					class="group flex flex-col justify-between rounded-[2rem] border border-slate-100 bg-white p-8 shadow-lg transition-all duration-300 hover:border-emerald-200 hover:shadow-2xl"
				>
					<div>
						<div class="mb-6 flex items-start justify-between">
							<span
								class="rounded-md border border-slate-100 px-2 py-0.5 text-[10px] font-black tracking-widest text-slate-300 uppercase"
								>Q. {q.id}</span
							>
							<span class="text-[10px] font-bold text-slate-400"
								>{formatDateTime(q.create_date)}</span
							>
						</div>
						<h2
							class="mb-4 text-2xl leading-tight font-black tracking-tight text-slate-900 transition-colors group-hover:text-emerald-700"
						>
							{q.subject}
						</h2>
						<p class="mb-8 line-clamp-2 text-sm leading-relaxed font-medium text-slate-500">
							{q.content}
						</p>
					</div>
					<div class="flex items-center justify-between border-t border-slate-50 pt-6">
						<div class="flex items-center gap-2">
							<div
								class="flex h-8 w-8 items-center justify-center rounded-full bg-slate-50 text-xs font-black text-slate-400 transition-colors group-hover:bg-emerald-50 group-hover:text-emerald-600"
							>
								{q.user_id}
							</div>
							<span class="text-xs font-bold text-slate-400">User_{q.user_id}</span>
						</div>
						<span class="text-emerald-600 transition-transform group-hover:translate-x-1">
							<Icon icon="mdi:arrow-right-circle" class="h-8 w-8" />
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
