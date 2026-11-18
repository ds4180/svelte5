<script>
	/**
	 * @file (app)/v1/custom/page/[slug]/+page.svelte
	 * @description [CUSTOM 앱] DB CMS 페이지 개별 본문 열람 뷰어 (SSR 즉각 렌더링)
	 */
	import { page } from '$app/state';
	import { formatDate } from '$lib/utils';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import PageEngine from '$lib/engines/PageEngine.svelte';
	import SafeHtml from '$lib/components/SafeHtml.svelte';
	import Icon from '@iconify/svelte';

	const auth = getAuthContext();
	let { data } = $props();
	let pageData = $derived(data.pageData);
	let isEditQuery = $derived(page.url.searchParams.get('edit') === 'true');
	let isAdmin = $derived((auth.user?.rank_level ?? 0) >= 4);
</script>

<svelte:head>
	<title>{pageData?.title ? `${pageData.title} | Jeju.live` : '페이지 뷰어'}</title>
</svelte:head>

{#if isEditQuery && isAdmin && pageData}
	<PageEngine data={{ page: pageData }} />
{:else}
	<div class="mx-auto max-w-4xl p-6 sm:p-10">
		{#if pageData}
			<article class="page-viewer-card rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm sm:p-10">
				<!-- 헤더 -->
				<header class="border-b border-slate-200 pb-6">
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div class="flex items-center gap-2.5">
							<span class="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-600">
								{pageData.slug}
							</span>
							{#if pageData.published_at}
								<span class="text-xs font-bold text-slate-400">
									게시일: {formatDate(pageData.published_at)}
								</span>
							{/if}
							<span class="inline-flex items-center gap-1 text-xs font-bold text-slate-400">
								<Icon icon="ph:eye-bold" class="text-sm" />
								<span>조회 {pageData.view_count ?? 0}</span>
							</span>
						</div>
						{#if isAdmin}
							<a
								href="/v1/custom/page/{pageData.slug}?edit=true"
								class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white transition hover:bg-blue-600"
							>
								<Icon icon="solar:pen-bold" class="text-sm" />
								<span>편집하기</span>
							</a>
						{/if}
					</div>
					<h1 class="mt-4 text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
						{pageData.title}
					</h1>
				</header>

				<!-- 본문 콘텐츠 -->
				<SafeHtml
					html={pageData.content || ''}
					class="prose prose-slate max-w-none pt-8 text-base leading-relaxed text-slate-800"
				/>

				<!-- 하단 푸터 -->
				<footer class="mt-12 flex justify-between border-t border-slate-100 pt-6">
					<a
						href="/v1/custom/page"
						class="rounded-xl border-2 border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
					>
						← 페이지 목록
					</a>
				</footer>
			</article>
		{/if}
	</div>
{/if}

<style>
	/* 📱 모바일 세로 모드 + 하단 퀵 내비게이션 바 활성화(< 768px) 구간: 페이지 카드 좌우 여백 0 */
	@media (max-width: 767px) and (orientation: portrait) {
		.page-viewer-card {
			width: 100vw;
			max-width: 100vw;
			margin-left: calc(50% - 50vw);
			margin-right: calc(50% - 50vw);
			border-left-width: 0;
			border-right-width: 0;
			border-radius: 0;
			box-shadow: none;
			padding-left: 1rem;
			padding-right: 1rem;
		}
	}
</style>
