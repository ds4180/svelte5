<script>
	/**
	 * @file (app)/v1/admin/pages/+page.svelte
	 * @description 순수 파일 시스템 기반 정적 페이지 내비게이터 (Svelte 5 모던 템플릿)
	 *              - 전사 표준 모던 엔터프라이즈 헤더 & 핵심 관제 지표 요약 카드
	 *              - 반응형 카드 기반 본문 레이아웃 (모바일 세로/태블릿/데스크탑 최적화)
	 *              - 브라우저 탭 단일 진실 공급원(SSOT) 환경설정 타이틀 연동
	 */
	import { getSiteTitle } from '$lib/config/site';
	import { invalidateAll } from '$app/navigation';
	import Icon from '@iconify/svelte';

	let { data } = $props();

	let searchQuery = $state('');
	const pagesList = $derived(data?.pages || []);
	let filteredPages = $derived(
		pagesList.filter((p) => p.slug.toLowerCase().includes(searchQuery.toLowerCase()))
	);

	const countTotal = $derived(pagesList.length);

	/**
	 * @param {any} date
	 */
	function formatDate(date) {
		if (!date) return '-';
		return new Date(date).toLocaleString('ko-KR', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>{getSiteTitle('고정 정적 페이지 탐색기')}</title>
</svelte:head>

<div class="animate-fade-in mx-auto max-w-7xl space-y-8 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:px-8">
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 우측 컨트롤 바 -->
	<!-- ===================================================================== -->
	<header class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end">
		<div>
			<div class="flex items-center gap-2 mb-2">
				<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200">
					<Icon icon="ph:file-html-bold" class="text-sm" />
					SYSTEM GOVERNANCE • STATIC PAGES
				</span>
				<span class="text-xs font-bold text-slate-400 font-mono">v1/admin/pages</span>
			</div>
			<h1 class="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
				고정 정적 <span class="not-italic text-blue-600">페이지 탐색기</span>
			</h1>
			<p class="mt-2 text-xs sm:text-sm font-bold text-slate-500">
				물리 파일 시스템(/v1/pages/*)을 실시간으로 스캔하여 관리하며 모니터링합니다.
			</p>
		</div>

		<!-- 상단 액션 버튼 그룹 (맨 우측 [관리자 홈], 그 좌측 [새로고침] 고정, 이후 버튼은 새로고침 좌측) -->
		<div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
			<a
				href="/v1/pages"
				class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-blue-600 bg-blue-600 text-white font-black text-xs uppercase tracking-wider hover:bg-blue-700 transition shadow-sm"
			>
				<Icon icon="ph:browsers-bold" class="text-base" />
				<span>사용자 갤러리</span>
			</a>

			<button
				onclick={() => invalidateAll()}
				class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-slate-200 bg-white font-black text-xs uppercase tracking-wider text-slate-700 hover:border-slate-400 transition shadow-sm"
			>
				<Icon icon="ph:arrows-clockwise-bold" class="text-base" />
				<span>새로고침</span>
			</button>

			<a
				href="/v1/admin"
				class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-slate-200 bg-white font-black text-xs uppercase tracking-wider text-slate-700 hover:border-slate-400 transition shadow-sm"
			>
				<Icon icon="ph:house-bold" class="text-base text-slate-500" />
				<span>관리자 홈</span>
			</a>
		</div>
	</header>

	<!-- ===================================================================== -->
	<!-- 2. 알림/요약 지표 카드 (최대 4개, 최소 1개 규격) -->
	<!-- ===================================================================== -->
	<section class="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
		<!-- 카드 1: 스캔된 정적 페이지 수 -->
		<div class="relative overflow-hidden rounded-[1.75rem] border-2 border-slate-100 bg-white p-5 shadow-sm hover:border-blue-300 transition group">
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-blue-600">Static Pages</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
					<Icon icon="ph:files-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{countTotal}
				<span class="text-sm font-bold text-slate-400 ml-1">개 페이지</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-blue-600">
				<span class="rounded-lg bg-blue-50 px-2 py-0.5 font-mono">물리 파일 감지</span>
			</div>
		</div>

		<!-- 카드 2: 라우팅 소스 경로 -->
		<div class="relative overflow-hidden rounded-[1.75rem] border-2 border-slate-100 bg-white p-5 shadow-sm hover:border-emerald-300 transition group">
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-emerald-600">Source Route</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
					<Icon icon="ph:folder-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-xl font-black font-mono text-slate-900 tracking-tight">
				/v1/pages/*
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-emerald-600">
				<span class="rounded-lg bg-emerald-50 px-2 py-0.5 font-mono">No DB / File Driven</span>
			</div>
		</div>

		<!-- 카드 3: 사용자 갤러리 -->
		<div class="relative overflow-hidden rounded-[1.75rem] border-2 border-slate-100 bg-white p-5 shadow-sm hover:border-amber-300 transition group">
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-amber-600">Public Gallery</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
					<Icon icon="ph:compass-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-xl font-black font-mono text-slate-900 tracking-tight">
				/v1/pages
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-amber-600">
				<span class="rounded-lg bg-amber-50 px-2 py-0.5 font-mono">공개 브라우징 가능</span>
			</div>
		</div>
	</section>

	<!-- ===================================================================== -->
	<!-- 3. 모드 탭 바 & 검색 필터 -->
	<!-- ===================================================================== -->
	<div class="flex flex-col sm:flex-row items-center justify-between gap-4">
		<nav class="flex gap-2 border-b-2 border-slate-200 overflow-x-auto no-scrollbar w-full sm:w-auto">
			<div class="px-6 py-3.5 text-xs font-black uppercase tracking-widest border-b-4 border-blue-600 text-blue-700 bg-blue-50/60 rounded-t-2xl whitespace-nowrap">
				물리 정적 페이지 목록 ({filteredPages.length})
			</div>
		</nav>

		<div class="relative w-full sm:w-72">
			<Icon icon="ph:magnifying-glass-bold" class="absolute top-1/2 left-3.5 -translate-y-1/2 text-slate-400 text-sm" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="슬러그(slug) 검색..."
				class="w-full px-4 py-2.5 pl-9 rounded-2xl border-2 border-slate-200 text-xs font-bold focus:border-blue-600 focus:outline-none transition"
			/>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 4. 본문 컨텐츠 (반응형 카드 형식 위주) -->
	<!-- ===================================================================== -->
	{#if filteredPages.length === 0}
		<div class="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
			<Icon icon="ph:file-x-light" class="mx-auto text-4xl text-slate-300 mb-3" />
			<p class="text-sm font-bold text-slate-500">일치하는 정적 페이지가 없습니다.</p>
		</div>
	{:else}
		<!-- 반응형 카드 그리드: 모바일 세로 1열, 태블릿 2열, 데스크탑 3열 -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
			{#each filteredPages as page (page.slug)}
				<div class="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm hover:border-blue-400 transition-all flex flex-col justify-between">
					<div>
						<div class="flex items-center justify-between mb-3">
							<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 text-2xl">
								<Icon icon="ph:file-text-bold" />
							</div>
							<a
								href={page.url}
								class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black bg-slate-900 text-white hover:bg-blue-600 rounded-xl transition shadow-sm"
								title="페이지 바로가기"
							>
								<span>열기</span>
								<Icon icon="ph:arrow-right-bold" class="text-xs" />
							</a>
						</div>

						<h3 class="text-xl font-black text-slate-900 tracking-tight">{page.slug}</h3>
						<p class="font-mono text-xs font-bold text-blue-600 mt-1">{page.url}</p>
					</div>

					<div class="mt-6 pt-4 border-t border-slate-100 space-y-1.5 text-xs">
						<div class="flex items-center justify-between text-slate-500">
							<span class="text-[11px] font-bold text-slate-400">최근 수정</span>
							<span class="font-bold text-[11px]">{formatDate(page.last_modified)}</span>
						</div>
						<div class="flex items-center justify-between text-slate-500">
							<span class="text-[11px] font-bold text-slate-400">소스 파일</span>
							<span class="font-mono text-[10px] text-slate-600 truncate max-w-[170px]" title={page.path}>
								{page.path}
							</span>
						</div>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
