<script>
	/**
	 * @file (app)/v1/custom/page/[slug]/+page.svelte
	 * @description [CUSTOM 앱] DB CMS 페이지 개별 본문 열람 뷰어 (SSR 즉각 렌더링)
	 */
	import { formatDate } from '$lib/utils';

	let { data } = $props();
	let pageData = $derived(data.pageData);
</script>

<svelte:head>
	<title>{pageData?.title ? `${pageData.title} | Jeju.live` : '페이지 뷰어'}</title>
</svelte:head>

<div class="mx-auto max-w-4xl p-6 sm:p-12 font-['Outfit','Noto_Sans_KR']">
	{#if pageData}
		<article class="border-2 border-black bg-white p-8 shadow-[8px_8px_0_rgba(0,0,0,1)] sm:p-12">
			<!-- 헤더 -->
			<header class="border-b-2 border-black pb-6">
				<div class="flex items-center gap-2">
					<span class="border border-black bg-yellow-300 px-2 py-0.5 font-mono text-[10px] font-black uppercase">
						{pageData.slug}
					</span>
					{#if pageData.published_at}
						<span class="text-xs font-bold text-slate-400">
							게시일: {formatDate(pageData.published_at)}
						</span>
					{/if}
				</div>
				<h1 class="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
					{pageData.title}
				</h1>
			</header>

			<!-- 본문 콘텐츠 -->
			<div class="prose max-w-none pt-8 text-base font-medium leading-relaxed text-slate-800">
				{@html pageData.content || ''}
			</div>

			<!-- 하단 푸터 -->
			<footer class="mt-12 flex justify-between border-t border-slate-200 pt-6">
				<a
					href="/v1/custom/page"
					class="border-2 border-black px-5 py-2 text-xs font-black uppercase tracking-wider hover:bg-slate-100"
				>
					← 페이지 목록
				</a>
			</footer>
		</article>
	{/if}
</div>
