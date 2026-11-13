<script>
	/**
	 * @file (app)/v1/pages/+page.svelte
	 * @description [PAGES 레이어] 순수 파일 시스템 기반 정적 웹페이지 갤러리 (No DB)
	 */
	let { data } = $props();
	let searchQuery = $state('');

	let filteredPages = $derived(
		(data.pages || []).filter((p) => p.slug.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	// 각 정적 페이지별 설명 및 아이콘 메타
	const PAGE_INFO = {
		calender: { title: '통합 확장형 캘린더', desc: '모바일 무여백 반응형 및 날짜별 일정·알림 이벤트를 지원하는 공용 캘린더', icon: '📅' },
		chart: { title: '차트 통계 데모', desc: 'Chart.js 기반 대화형 데이터 시각화 정적 웹페이지', icon: '📊' },
		canvas: { title: '2D 캔버스 도면', desc: 'HTML5 2D Canvas 약도 및 그래픽 렌더링 정적 웹페이지', icon: '🎨' },
		uploadfile: { title: '파일 업로드 자산', desc: '미디어 스토리지 연동 및 파일 업로드 데모 페이지', icon: '📁' }
	};
</script>

<svelte:head>
	<title>정적 페이지 갤러리 | Jeju.live Pages</title>
</svelte:head>

<div class="mx-auto max-w-6xl p-6 sm:p-10">
	<!-- 헤더 섹션 -->
	<div class="mb-10 flex flex-col justify-between gap-6 border-b-4 border-black pb-8 md:flex-row md:items-end">
		<div>
			<span class="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
				Pure File-System Static Layer (No DB)
			</span>
			<h1 class="mt-2 text-4xl font-black italic tracking-tight uppercase">
				정적 웹페이지 <span class="not-italic text-blue-600">갤러리</span>
			</h1>
			<p class="mt-2 text-sm font-bold text-slate-500">
				물리 파일 시스템 기반으로 직접 렌더링되는 독립 정적 웹페이지 모음입니다.
			</p>
		</div>
		<div class="w-full md:w-72">
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="페이지 검색..."
				class="h-12 w-full border-2 border-black bg-slate-50 px-4 text-sm font-black transition-all focus:bg-white focus:outline-none"
			/>
		</div>
	</div>

	<!-- 정적 페이지 카드 그리드 -->
	{#if filteredPages.length === 0}
		<div class="flex h-64 flex-col items-center justify-center border-2 border-dashed border-slate-300 p-8 text-center">
			<span class="text-4xl opacity-30">🔍</span>
			<p class="mt-4 text-base font-black text-slate-600">일치하는 정적 웹페이지가 없습니다.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each filteredPages as p (p.slug)}
				{@const info = PAGE_INFO[p.slug] || { title: p.slug, desc: '순수 물리 파일 기반 정적 페이지', icon: '📄' }}
				<a
					href={p.url}
					class="group flex flex-col justify-between border-2 border-black bg-white p-6 shadow-[6px_6px_0_rgba(0,0,0,1)] transition-all hover:-translate-y-1 hover:shadow-[10px_10px_0_rgba(0,0,0,1)]"
				>
					<div>
						<div class="flex items-center justify-between">
							<span class="text-3xl">{info.icon}</span>
							<span class="border border-black bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-black uppercase">
								{p.slug}
							</span>
						</div>
						<h2 class="mt-4 text-xl font-black tracking-tight text-slate-900 group-hover:text-blue-600">
							{info.title}
						</h2>
						<p class="mt-2 text-xs font-bold leading-relaxed text-slate-500">
							{info.desc}
						</p>
					</div>
					<div class="mt-6 flex items-center justify-between border-t border-slate-200 pt-4 text-xs font-black text-slate-700">
						<span>페이지 열기 ➔</span>
						<span class="font-mono text-[10px] text-slate-400">{p.url}</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
