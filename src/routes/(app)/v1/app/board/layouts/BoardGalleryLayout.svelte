<script>
	/**
	 * BoardGalleryLayout.svelte
	 * @description 갤러리형(썸네일 카드 그리드) 게시판 목록 레이아웃
	 */
	import Icon from '@iconify/svelte';
	import { formatDate } from '$lib/utils';
	import { extractFirstImage, stripHtml } from './boardUtils';

	let { posts = [], boardSlug = '' } = $props();
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
	{#each posts as p (p.id)}
		{@const thumb = extractFirstImage(p.content)}
		<a
			href="/v1/app/board/{boardSlug}/{p.id}"
			class="board-fullbleed-card group flex flex-col overflow-hidden rounded-2xl border-2 border-slate-200 bg-white shadow-2xs transition hover:border-blue-400 hover:shadow-md"
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
				<span
					class="absolute top-2.5 left-2.5 rounded-lg bg-slate-900/75 px-2 py-0.5 font-mono text-[10px] font-bold text-white backdrop-blur-xs"
				>
					NO.{p.id}
				</span>
			</div>

			<div class="flex flex-1 flex-col justify-between p-4">
				<div>
					<h3
						class="line-clamp-1 text-base font-black tracking-tight text-slate-900 transition-colors group-hover:text-blue-600"
					>
						{p.title}
					</h3>
					<p class="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
						{stripHtml(p.content) || '본문 내용이 없습니다.'}
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
