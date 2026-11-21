<script>
	/**
	 * @file (app)/v1/pages/+page.svelte
	 * @description [PAGES 레이어] 정적 웹페이지 갤러리 (표준 대시보드 디자인 & 모바일 하단 퀵메뉴 여백 확보)
	 */
	import Icon from '@iconify/svelte';

	let { data } = $props();
	let searchQuery = $state('');

	// 각 정적 페이지별 설명 및 아이콘 메타
	const PAGE_INFO = {
		calender: { title: '통합 확장형 캘린더', desc: '모바일 무여백 반응형 및 날짜별 일정·알림 이벤트를 지원하는 공용 캘린더', icon: '📅' },
		chart: { title: '차트 통계 데모', desc: 'Chart.js 기반 대화형 데이터 시각화 정적 웹페이지', icon: '📊' },
		canvas: { title: '2D 캔버스 도면', desc: 'HTML5 2D Canvas 약도 및 그래픽 렌더링 정적 웹페이지', icon: '🎨' },
		uploadfile: { title: '파일 업로드 자산', desc: '미디어 스토리지 연동 및 파일 업로드 데모 페이지', icon: '📁' }
	};

	let filteredPages = $derived(
		(data.pages || []).filter((p) => {
			const q = searchQuery.trim().toLowerCase();
			if (!q) return true;
			const info = PAGE_INFO[p.slug];
			return (
				p.slug.toLowerCase().includes(q) ||
				(info?.title || '').toLowerCase().includes(q) ||
				(info?.desc || '').toLowerCase().includes(q)
			);
		})
	);
</script>

<svelte:head>
	<title>정적 페이지 갤러리 | Jeju.live</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 px-4 py-6 pb-28 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 md:pb-12 lg:px-8">
	<!-- 헤더 섹션 (표준 디자인) -->
	<div class="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:border-b-4 md:pb-8">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-wider text-emerald-400">
					<span class="h-2 w-2 animate-ping rounded-full bg-emerald-400"></span>
					독립 정적 웹페이지
				</span>
				<span class="text-xs font-bold text-slate-400">총 {filteredPages.length}건</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
				정적 웹페이지 <span class="text-blue-600">갤러리</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				물리 파일 시스템 기반으로 직접 렌더링되는 독립 정적 웹페이지 모음입니다.
			</p>
		</div>
		<div class="relative w-full md:w-72">
			<Icon
				icon="solar:magnifer-bold-duotone"
				class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base text-slate-400"
			/>
			<input
				type="search"
				bind:value={searchQuery}
				placeholder="페이지 이름·설명 검색..."
				class="h-11 w-full rounded-xl border-2 border-slate-200 bg-white pr-4 pl-10 text-xs font-bold text-slate-800 placeholder:text-slate-400 transition focus:border-blue-500 focus:outline-none"
			/>
		</div>
	</div>

	<!-- 정적 페이지 카드 그리드 -->
	{#if filteredPages.length === 0}
		<div class="flex h-64 flex-col items-center justify-center rounded-3xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
			<Icon icon="solar:magnifer-bold-duotone" class="text-5xl text-slate-200" />
			<p class="mt-3 text-base font-black text-slate-500">일치하는 정적 웹페이지가 없습니다.</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
			{#each filteredPages as p (p.slug)}
				{@const info = PAGE_INFO[p.slug] || { title: p.slug, desc: '순수 물리 파일 기반 정적 페이지', icon: '📄' }}
				<a
					href={p.url}
					class="group flex flex-col justify-between rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-lg"
				>
					<div>
						<div class="flex items-center justify-between gap-2">
							<span class="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
								{info.icon}
							</span>
							<span class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-mono text-[11px] font-black text-slate-600">
								{p.slug}
							</span>
						</div>
						<h2 class="mt-4 text-lg font-black tracking-tight text-slate-900 transition-colors group-hover:text-blue-600">
							{info.title}
						</h2>
						<p class="mt-1.5 text-xs font-medium leading-relaxed text-slate-500">
							{info.desc}
						</p>
					</div>
					<div class="mt-6 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-black text-slate-500 group-hover:text-blue-600">
						<span>페이지 열기</span>
						<span class="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-slate-400 group-hover:text-blue-600">
							<span>{p.url}</span>
							<Icon icon="mdi:arrow-right" class="text-sm transition-transform group-hover:translate-x-1" />
						</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
