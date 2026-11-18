<script>
	/**
	 * BoardListLayout.svelte
	 * @description 표준 리스트형(1열 카드) 게시판 목록 레이아웃
	 */
	import Icon from '@iconify/svelte';
	import { formatDate } from '$lib/utils';
	import { stripHtml } from './boardUtils';

	let { posts = [], boardSlug = '' } = $props();
</script>

<div class="grid grid-cols-1 gap-4">
	{#each posts as p (p.id)}
		<a
			href="/v1/app/board/{boardSlug}/{p.id}"
			class="board-fullbleed-card group block rounded-2xl border-2 border-slate-200 bg-white p-5 shadow-2xs transition hover:border-blue-400 hover:shadow-sm sm:p-6"
		>
			<div class="mb-2 flex items-start justify-between gap-3">
				<div class="flex flex-wrap items-center gap-2">
					<span
						class="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600"
					>
						NO.{p.id}
					</span>
					{#if p.user_name || p.author_name}
						<span class="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-600">
							<Icon icon="ph:user-bold" class="h-3 w-3 text-slate-400" />
							<span>{p.user_name || p.author_name}</span>
						</span>
					{/if}
				</div>
				<div class="flex shrink-0 flex-col items-end gap-0.5 text-right">
					<span class="inline-flex items-center gap-1 text-xs font-bold text-slate-500">
						<Icon icon="ph:eye-bold" class="h-3.5 w-3.5 text-slate-400" />
						<span>{p.view_count || 0}</span>
					</span>
					<span class="text-[11px] font-medium text-slate-400">
						{formatDate(p.create_date || p.created_at)}
					</span>
				</div>
			</div>
			<h3
				class="mb-1.5 line-clamp-1 text-lg font-black tracking-tight text-slate-900 transition-colors group-hover:text-blue-600 sm:text-xl"
			>
				{p.title}
			</h3>
			<p
				class="line-clamp-2 max-w-3xl text-xs leading-relaxed font-medium text-slate-500 sm:text-sm"
			>
				{stripHtml(p.content) || '본문 내용이 없습니다.'}
			</p>
		</a>
	{/each}
</div>
