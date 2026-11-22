<script>
	/**
	 * BoardGalleryLayout.svelte
	 * @description 갤러리형(썸네일 카드 그리드) 게시판 목록 레이아웃
	 */
	import Icon from '@iconify/svelte';
	import { formatDate } from '$lib/utils';
	import { extractFirstImage, getPostMetaPresentation, stripHtml } from './boardUtils';

	let { posts = [], boardSlug = '', boardOptions = {} } = $props();
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
	{#each posts as p (p.id)}
		{@const thumb = extractFirstImage(p.content)}
		{@const meta = getPostMetaPresentation(p, boardOptions)}
		<a
			href="/v1/app/board/{boardSlug}/{p.id}"
			class="board-fullbleed-card group flex flex-col overflow-hidden rounded-2xl border-2 shadow-2xs transition hover:border-blue-400 hover:shadow-md {meta.cardToneClass}"
		>
			<div class="relative aspect-[16/10] w-full overflow-hidden bg-slate-100">
				{#if thumb}
					<img
						src={thumb}
						alt={p.title}
						loading="lazy"
						class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
					/>
				{:else}
					<div class="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-300">
						<Icon icon="ph:image-bold" class="h-10 w-10" />
						<span class="text-[11px] font-bold">이미지 없음</span>
					</div>
				{/if}
				<div class="absolute top-2.5 left-2.5 flex flex-wrap items-center gap-1">
					{#if meta.isPinned}
						<span class="rounded-lg bg-amber-500 px-2 py-0.5 text-[10px] font-black text-white shadow-xs">📌 고정</span>
					{/if}
					{#if meta.category}
						<span class="rounded-lg px-2 py-0.5 text-[10px] font-black shadow-xs {meta.categoryClass}">{meta.category}</span>
					{/if}
					{#if meta.isNew}
						<span class="rounded-lg bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white shadow-xs">NEW</span>
					{/if}
					<span class="rounded-lg bg-slate-900/75 px-2 py-0.5 font-mono text-[10px] font-bold text-white backdrop-blur-xs">
						NO.{p.board_seq ?? p.id}
					</span>
				</div>
			</div>

			<div class="flex flex-1 flex-col justify-between p-4">
				<div>
					<h3
						class="line-clamp-1 text-base tracking-tight transition-colors group-hover:text-blue-600 {meta.titleWeightClass} {meta.titleColorClass}"
					>
						{#if meta.icon}<span class="mr-1">{meta.icon}</span>{/if}{p.title}
					</h3>
					<p class="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
						{meta.summaryLine || stripHtml(p.content) || '본문 내용이 없습니다.'}
					</p>
				</div>

				<div class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] font-bold text-slate-400">
					<span class="inline-flex items-center gap-1 truncate text-slate-600">
						<Icon icon="ph:user-bold" class="h-3 w-3 text-slate-400" />
						<span class="truncate">{p.user_name || p.author_name || '작성자'}</span>
					</span>
					<div class="flex shrink-0 items-center gap-2.5">
						<span class="inline-flex items-center gap-1">
							<Icon icon="ph:eye-bold" class="h-3 w-3" />
							<span>{p.view_count || 0}</span>
						</span>
						<span>{formatDate(p.create_date || p.created_at)}</span>
					</div>
				</div>
			</div>
		</a>
	{/each}
</div>
