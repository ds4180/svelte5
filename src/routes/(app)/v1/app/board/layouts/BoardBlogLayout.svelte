<script>
	/**
	 * BoardBlogLayout.svelte
	 * @description 블로그형(피드 요약 + 대표 이미지) 게시판 목록 레이아웃
	 */
	import Icon from '@iconify/svelte';
	import { formatDate } from '$lib/utils';
	import { extractFirstImage, stripHtml } from './boardUtils';

	let { posts = [], boardSlug = '' } = $props();
</script>

<div class="flex flex-col gap-5">
	{#each posts as p (p.id)}
		{@const thumb = extractFirstImage(p.content)}
		<a
			href="/v1/app/board/{boardSlug}/{p.id}"
			class="board-fullbleed-card group flex flex-col gap-4 rounded-3xl border-2 border-slate-200 bg-white p-5 shadow-2xs transition hover:border-blue-400 hover:shadow-md sm:flex-row sm:items-stretch sm:p-6"
		>
			{#if thumb}
				<div class="aspect-[16/10] w-full shrink-0 overflow-hidden rounded-2xl bg-slate-100 sm:aspect-square sm:w-44">
					<img
						src={thumb}
						alt={p.title}
						loading="lazy"
						class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
					/>
				</div>
			{/if}

			<div class="flex min-w-0 flex-1 flex-col justify-between">
				<div>
					<div class="mb-2 flex items-center justify-between gap-2">
						<span class="rounded-lg bg-blue-50 px-2.5 py-0.5 font-mono text-[11px] font-bold text-blue-700">
							NO.{p.id}
						</span>
						<span class="text-[11px] font-bold text-slate-400">
							{formatDate(p.create_date || p.created_at)}
						</span>
					</div>

					<h3
						class="line-clamp-2 text-xl font-black tracking-tight text-slate-900 transition-colors group-hover:text-blue-600 sm:text-2xl"
					>
						{p.title}
					</h3>

					<p class="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">
						{stripHtml(p.content) || '본문 내용이 없습니다.'}
					</p>
				</div>

				<div class="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs font-bold text-slate-400">
					<span class="inline-flex items-center gap-1.5 text-slate-600">
						<Icon icon="ph:user-bold" class="h-3.5 w-3.5 text-slate-400" />
						<span>{p.user_name || p.author_name || '작성자'}</span>
					</span>
					<div class="flex items-center gap-3">
						<span class="inline-flex items-center gap-1">
							<Icon icon="ph:eye-bold" class="h-3.5 w-3.5" />
							<span>조회 {p.view_count || 0}</span>
						</span>
						<span class="inline-flex items-center gap-1 text-blue-600">
							<span>자세히 보기</span>
							<Icon icon="ph:arrow-right-bold" class="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
						</span>
					</div>
				</div>
			</div>
		</a>
	{/each}
</div>
