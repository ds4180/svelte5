<script>
	/**
	 * BoardListLayout.svelte
	 * @description 표준 리스트형(1열 카드) 게시판 목록 레이아웃
	 */
	import Icon from '@iconify/svelte';
	import { formatDate } from '$lib/utils';
	import { getPostMetaPresentation, stripHtml } from './boardUtils';

	let { posts = [], boardSlug = '', boardOptions = {} } = $props();
</script>

<div class="grid grid-cols-1 gap-4">
	{#each posts as p (p.id)}
		{@const meta = getPostMetaPresentation(p, boardOptions)}
		<a
			href="/v1/app/board/{boardSlug}/{p.id}"
			class="board-fullbleed-card group block rounded-2xl border-2 p-5 shadow-2xs transition hover:border-blue-400 hover:shadow-sm sm:p-6 {meta.cardToneClass}"
		>
			<div class="mb-2 flex items-start justify-between gap-3">
				<div class="flex flex-wrap items-center gap-1.5">
					{#if meta.isPinned}
						<span class="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-2 py-0.5 text-[11px] font-black text-white">
							📌 고정
						</span>
					{/if}
					{#if meta.category}
						<span class="rounded-lg px-2 py-0.5 text-[11px] font-black {meta.categoryClass}">
							{meta.category}
						</span>
					{/if}
					{#if meta.isNew}
						<span class="rounded-lg bg-rose-500 px-1.5 py-0.5 text-[10px] font-black text-white">
							NEW
						</span>
					{/if}
					{#if meta.isSecret}
						<span class="inline-flex items-center gap-0.5 rounded-lg bg-slate-800 px-2 py-0.5 text-[10px] font-black text-white">
							🔒 비밀
						</span>
					{/if}
					{#if meta.requireReadReceipt && !p.is_read}
						<span class="rounded-lg bg-purple-600 px-2 py-0.5 text-[10px] font-black text-white">
							필독
						</span>
					{/if}
					<span
						class="rounded-lg bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-600"
					>
						NO.{p.board_seq ?? p.id}
					</span>
					{#if meta.routeNo || meta.vehicleNo}
						<span class="rounded-lg bg-sky-50 px-2 py-0.5 text-[11px] font-bold text-sky-700">
							{[meta.routeNo, meta.vehicleNo].filter(Boolean).join(' · ')}
						</span>
					{/if}
					{#if meta.effectiveDate}
						<span class="rounded-lg bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
							시행 {meta.effectiveDate}
						</span>
					{/if}
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
				class="mb-1.5 line-clamp-1 text-lg tracking-tight transition-colors group-hover:text-blue-600 sm:text-xl {meta.titleWeightClass} {meta.titleColorClass}"
			>
				{#if meta.icon}<span class="mr-1.5">{meta.icon}</span>{/if}{p.title}
			</h3>
			<p
				class="line-clamp-2 max-w-3xl text-xs leading-relaxed font-medium text-slate-500 sm:text-sm"
			>
				{meta.summaryLine || stripHtml(p.content) || '본문 내용이 없습니다.'}
			</p>
		</a>
	{/each}
</div>
