<script>
	/**
	 * @file (app)/v1/custom/page/+page.svelte
	 * @description [CUSTOM 앱] 페이지 엔진 사용자 화면 (초고속 SSR 렌더링)
	 */
	import Icon from '@iconify/svelte';

	let { data } = $props();
	let pages = $derived(data.pages || []);
</script>

<svelte:head>
	<title>공개 페이지 허브 | Jeju.live</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 px-4 py-6 pb-28 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 md:pb-12 lg:px-8">
	<!-- 헤더 섹션 (표준 디자인) -->
	<div class="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between md:border-b-4 md:pb-8">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-wider text-emerald-400">
					<span class="h-2 w-2 animate-ping rounded-full bg-emerald-400"></span>
					공개 안내 페이지
				</span>
				<span class="text-xs font-bold text-slate-400">총 {pages.length}건</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
				페이지 <span class="text-blue-600">허브</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				안내문, 이용약관, 정책 및 사내 정보 안내 페이지 모음입니다.
			</p>
		</div>
	</div>

	<!-- 목록 섹션 (SSR 즉각 렌더링) -->
	{#if pages.length === 0}
		<div class="flex h-64 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
			<Icon icon="solar:document-text-bold-duotone" class="text-5xl text-slate-200" />
			<p class="mt-3 text-base font-black text-slate-500">등록된 공개 페이지가 없습니다.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
			{#each pages as page (page.id)}
				<a
					href="/v1/custom/page/{page.slug}"
					class="group flex flex-col justify-between rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-lg"
				>
					<div>
						<div class="flex items-center justify-between gap-2">
							<span class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-mono text-[11px] font-black text-blue-700">
								{page.slug}
							</span>
							<span class="inline-flex items-center gap-1 text-xs font-bold text-slate-400">
								<Icon icon="ph:eye-bold" class="text-sm" />
								<span>조회 {page.view_count || 0}</span>
							</span>
						</div>
						<h2 class="mt-4 text-lg font-black tracking-tight text-slate-900 transition-colors group-hover:text-blue-600">
							{page.title}
						</h2>
					</div>
					<div class="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-black text-slate-500 group-hover:text-blue-600">
						<span>상세 보기</span>
						<Icon icon="mdi:arrow-right" class="text-base transition-transform group-hover:translate-x-1" />
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
