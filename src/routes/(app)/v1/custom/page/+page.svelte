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

<div class="mx-auto max-w-6xl p-6 sm:p-10 font-['Outfit','Noto_Sans_KR']">
	<!-- 헤더 섹션 -->
	<div class="mb-10 border-b-4 border-black pb-6">
		<div class="flex items-center gap-3">
			<span class="text-3xl">📄</span>
			<div>
				<h1 class="text-3xl font-black tracking-tight uppercase italic">페이지 엔진 허브</h1>
				<p class="mt-1 text-sm font-bold text-slate-500">
					안내문, 이용약관, 정책 및 정보 안내 페이지 모음
				</p>
			</div>
		</div>
	</div>

	<!-- 목록 섹션 (SSR 즉각 렌더링) -->
	{#if pages.length === 0}
		<div class="flex h-64 flex-col items-center justify-center border-2 border-dashed border-slate-300 p-8 text-center">
			<span class="text-4xl opacity-30">📭</span>
			<p class="mt-4 text-base font-black text-slate-600">등록된 공개 페이지가 없습니다.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each pages as page (page.id)}
				<a
					href="/v1/custom/page/{page.slug}"
					class="group flex flex-col justify-between border-2 border-black bg-white p-6 shadow-[6px_6px_0_rgba(0,0,0,1)] transition-all hover:-translate-y-1 hover:shadow-[10px_10px_0_rgba(0,0,0,1)]"
				>
					<div>
						<div class="flex items-center justify-between">
							<span class="inline-block border border-black bg-yellow-300 px-2 py-0.5 font-mono text-[10px] font-black uppercase">
								{page.slug}
							</span>
							<span class="text-xs font-black text-slate-400">
								조회 {page.view_count || 0}
							</span>
						</div>
						<h2 class="mt-4 text-xl font-black tracking-tight text-slate-900 group-hover:text-blue-600">
							{page.title}
						</h2>
					</div>
					<div class="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-xs font-bold text-slate-500">
						<span>상세 보기 ➔</span>
						<Icon icon="mdi:arrow-right" class="text-base transition-transform group-hover:translate-x-1" />
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
