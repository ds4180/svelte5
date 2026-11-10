<script>
	/**
	 * @file (app)/v1/admin/boards/+page.svelte
	 * @description 게시판 인스턴스(공지, 자유, 갤러리 등) 통합 관리자
	 *              - 전사 표준 모던 엔터프라이즈 헤더 & 4대 핵심 관제 지표 요약 카드
	 *              - 반응형 카드 기반 본문 레이아웃 (모바일 세로/태블릿/데스크탑 최적화)
	 *              - 브라우저 탭 단일 진실 공급원(SSOT) 환경설정 타이틀 연동
	 *              - 탭 기반 네비게이션 (명부 조회 / 새 인스턴스 생성 및 설정)
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin.js';
	import { toast } from '$lib/runes/toast.svelte.js';
	import { getSiteTitle } from '$lib/config/site';
	import Icon from '@iconify/svelte';

	let boards = $state(/** @type {any[]} */ ([]));
	let loading = $state(true);
	let activeTab = $state('list'); // 'list' | 'create'
	let filterLayout = $state('ALL'); // 'ALL' | 'list' | 'gallery' | 'blog'

	let editingBoard = $state({
		id: /** @type {number|null} */ (null),
		slug: '',
		name: '',
		description: '',
		layout_type: 'list',
		items_per_page: 10
	});

	// 📊 4대 관제 지표 요약 (반응형 파생 상태)
	const countTotal = $derived(boards.length);
	const countList = $derived(boards.filter((b) => !b.layout_type || b.layout_type === 'list').length);
	const countGallery = $derived(boards.filter((b) => b.layout_type === 'gallery').length);
	const countBlog = $derived(boards.filter((b) => b.layout_type === 'blog').length);

	// 필터링된 게시판 목록
	const filteredBoards = $derived(
		filterLayout === 'ALL'
			? boards
			: boards.filter((b) => (b.layout_type || 'list') === filterLayout)
	);

	async function loadBoards() {
		loading = true;
		try {
			boards = await api.adminGetBoards();
		} catch (/** @type {any} */ e) {
			toast.error('게시판 목록 로드 실패: ' + (e.message || '오류가 발생했습니다.'));
		} finally {
			loading = false;
		}
	}

	onMount(loadBoards);

	function resetForm() {
		editingBoard = {
			id: null,
			slug: '',
			name: '',
			description: '',
			layout_type: 'list',
			items_per_page: 10
		};
	}

	function startCreate() {
		resetForm();
		activeTab = 'create';
	}

	/**
	 * @param {any} b
	 */
	function startEdit(b) {
		editingBoard = { ...b, layout_type: b.layout_type || 'list' };
		activeTab = 'create';
	}

	async function handleSave() {
		if (!editingBoard.slug || !editingBoard.name) {
			toast.warning('게시판 주소(슬러그)와 이름은 필수 항목입니다.');
			return;
		}
		try {
			if (!editingBoard.id) {
				await api.adminCreateBoard(editingBoard);
				toast.success(`[${editingBoard.name}] 게시판 인스턴스가 성공적으로 생성되었습니다.`);
			} else {
				await api.adminUpdateBoard(editingBoard.id, editingBoard);
				toast.success(`[${editingBoard.name}] 게시판 설정이 업데이트되었습니다.`);
			}
			resetForm();
			activeTab = 'list';
			await loadBoards();
		} catch (/** @type {any} */ e) {
			toast.error('저장 실패: ' + (e.message || '오류가 발생했습니다.'));
		}
	}

	/**
	 * @param {string} type
	 */
	function getLayoutBadge(type) {
		switch (type) {
			case 'gallery':
				return { label: '갤러리형', class: 'bg-amber-50 text-amber-700 border-amber-200' };
			case 'blog':
				return { label: '블로그형', class: 'bg-purple-50 text-purple-700 border-purple-200' };
			default:
				return { label: '리스트형', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
		}
	}
</script>

<svelte:head>
	<title>{getSiteTitle('게시판 인스턴스 관리')}</title>
</svelte:head>

<div class="animate-fade-in mx-auto max-w-7xl space-y-8 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:px-8">
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 우측 컨트롤 바 -->
	<!-- ===================================================================== -->
	<header class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end">
		<div>
			<div class="flex items-center gap-2 mb-2">
				<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-200">
					<Icon icon="ph:clipboard-text-bold" class="text-sm" />
					SYSTEM GOVERNANCE • BOARD INSTANCE
				</span>
				<span class="text-xs font-bold text-slate-400 font-mono">v1/admin/boards</span>
			</div>
			<h1 class="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
				게시판 <span class="not-italic text-blue-600">인스턴스 관리</span>
			</h1>
			<p class="mt-2 text-xs sm:text-sm font-bold text-slate-500">
				공지사항, 자유게시판 등 시스템에서 가동할 실제 게시판 인스턴스를 설계하고 설정합니다.
			</p>
		</div>

		<!-- 상단 액션 버튼 그룹 -->
		<div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
			<button
				onclick={startCreate}
				class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-blue-600 bg-blue-600 text-white font-black text-xs uppercase tracking-wider hover:bg-blue-700 transition shadow-sm"
			>
				<Icon icon="ph:plus-circle-bold" class="text-base" />
				<span>새 게시판 등록</span>
			</button>

			<button
				onclick={loadBoards}
				disabled={loading}
				class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-slate-200 bg-white font-black text-xs uppercase tracking-wider text-slate-700 hover:border-slate-400 transition shadow-sm disabled:opacity-50"
			>
				<Icon icon="ph:arrows-clockwise-bold" class="text-base {loading ? 'animate-spin' : ''}" />
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
	<section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
		<!-- 카드 1: 전체 게시판 -->
		<button
			onclick={() => { activeTab = 'list'; filterLayout = 'ALL'; }}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {filterLayout === 'ALL' ? 'border-blue-500 bg-blue-50/20 ring-2 ring-blue-500/20' : 'border-slate-100 hover:border-blue-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-blue-600">Total Boards</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:squares-four-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countTotal}
				<span class="text-sm font-bold text-slate-400 ml-1">개 인스턴스</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-blue-600">
				<span class="rounded-lg bg-blue-50 px-2 py-0.5 font-mono">가동률 100%</span>
				<span class="text-slate-400 font-normal">전체 클러스터</span>
			</div>
		</button>

		<!-- 카드 2: 표준 리스트형 -->
		<button
			onclick={() => { activeTab = 'list'; filterLayout = 'list'; }}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {filterLayout === 'list' ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/20' : 'border-slate-100 hover:border-emerald-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-emerald-600">List Layout</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:list-bullets-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countList}
				<span class="text-sm font-bold text-slate-400 ml-1">개 목록형</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-emerald-600">
				<span class="rounded-lg bg-emerald-50 px-2 py-0.5 font-mono">공지·사내게시</span>
				<span class="text-slate-400 font-normal">표준 목록</span>
			</div>
		</button>

		<!-- 카드 3: 갤러리/사진형 -->
		<button
			onclick={() => { activeTab = 'list'; filterLayout = 'gallery'; }}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {filterLayout === 'gallery' ? 'border-amber-500 bg-amber-50/20 ring-2 ring-amber-500/20' : 'border-slate-100 hover:border-amber-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-amber-600">Gallery Layout</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:image-square-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countGallery}
				<span class="text-sm font-bold text-slate-400 ml-1">개 갤러리</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-amber-600">
				<span class="rounded-lg bg-amber-50 px-2 py-0.5 font-mono">현장 사진·미디어</span>
				<span class="text-slate-400 font-normal">카드 뷰</span>
			</div>
		</button>

		<!-- 카드 4: 블로그/피드형 -->
		<button
			onclick={() => { activeTab = 'list'; filterLayout = 'blog'; }}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {filterLayout === 'blog' ? 'border-purple-500 bg-purple-50/20 ring-2 ring-purple-500/20' : 'border-slate-100 hover:border-purple-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-purple-600">Blog Layout</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:article-medium-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countBlog}
				<span class="text-sm font-bold text-slate-400 ml-1">개 피드형</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-purple-600">
				<span class="rounded-lg bg-purple-50 px-2 py-0.5 font-mono">주간 보고서</span>
				<span class="text-slate-400 font-normal">본문 요약</span>
			</div>
		</button>
	</section>

	<!-- ===================================================================== -->
	<!-- 3. 모드 탭 바 (최소 1개, 일관성 및 확장성) -->
	<!-- ===================================================================== -->
	<nav class="flex gap-2 border-b-2 border-slate-200 overflow-x-auto no-scrollbar">
		<button
			onclick={() => (activeTab = 'list')}
			class="px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeTab === 'list' ? 'border-b-4 border-blue-600 text-blue-700 bg-blue-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
		>
			게시판 인스턴스 명부 ({filteredBoards.length})
		</button>
		<button
			onclick={startCreate}
			class="px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeTab === 'create' ? 'border-b-4 border-blue-600 text-blue-700 bg-blue-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
		>
			{editingBoard.id ? `설정 수정: ${editingBoard.name}` : '새 게시판 인스턴스 등록'}
		</button>
	</nav>

	<!-- ===================================================================== -->
	<!-- 4. 본문 컨텐츠 (반응형 카드 형식 위주) -->
	<!-- ===================================================================== -->
	{#if loading}
		<div class="flex justify-center py-20">
			<div class="flex flex-col items-center gap-3">
				<div class="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
				<p class="text-xs font-bold text-slate-400 font-mono">게시판 인스턴스 스캔 중...</p>
			</div>
		</div>
	{:else if activeTab === 'list'}
		<!-- 탭 1: 게시판 카드 목록 뷰 -->
		<div class="space-y-4">
			{#if filteredBoards.length === 0}
				<div class="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
					<Icon icon="ph:clipboard-text-light" class="mx-auto text-4xl text-slate-300 mb-3" />
					<p class="text-sm font-bold text-slate-500">선택된 조건의 게시판 인스턴스가 없습니다.</p>
					<button
						onclick={startCreate}
						class="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition"
					>
						첫 게시판 등록하기
					</button>
				</div>
			{:else}
				<!-- 반응형 카드 그리드: 모바일 세로 1열, 태블릿 2열, 데스크탑 3열 -->
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
					{#each filteredBoards as b}
						{@const badge = getLayoutBadge(b.layout_type)}
						<div
							class="rounded-2xl border-2 bg-white p-6 shadow-sm hover:border-blue-400 transition-all flex flex-col justify-between {editingBoard.id === b.id ? 'border-blue-600 ring-2 ring-blue-600/20' : 'border-slate-200'}"
						>
							<div>
								<div class="flex items-center justify-between mb-2">
									<span class="px-2.5 py-0.5 rounded-full text-[11px] font-black uppercase bg-slate-100 text-slate-700 font-mono">
										/{b.slug}
									</span>
									<span class="px-2.5 py-0.5 rounded-md text-[10px] font-bold border {badge.class}">
										{badge.label}
									</span>
								</div>
								<h3 class="text-xl font-black text-slate-900 tracking-tight mt-1">{b.name}</h3>
								<p class="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
									{b.description || '별도의 설명이 설정되지 않았습니다.'}
								</p>
							</div>

							<div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
								<span class="text-xs font-bold text-slate-400 font-mono">
									페이지당 {b.items_per_page || 10}건
								</span>
								<div class="flex items-center gap-2">
									<button
										type="button"
										onclick={() => startEdit(b)}
										class="px-3 py-1.5 text-xs font-black text-blue-600 hover:bg-blue-50 rounded-xl transition"
									>
										설정 수정
									</button>
									<a
										href="/v1/app/board/{b.slug}"
										class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black bg-slate-900 text-white hover:bg-blue-600 rounded-xl transition shadow-sm"
										title="사용자 화면으로 이동"
									>
										<span>열기</span>
										<Icon icon="ph:arrow-right-bold" class="text-xs" />
									</a>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<!-- 탭 2: 생성/수정 폼 카드 -->
		<div class="rounded-3xl border-2 border-slate-200 bg-white p-6 sm:p-10 shadow-sm max-w-4xl">
			<div class="mb-8 flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-slate-100 pb-4">
				<div>
					<h3 class="text-2xl font-black text-slate-900 tracking-tight">
						{editingBoard.id ? `게시판 인스턴스 수정: ${editingBoard.name}` : '새 게시판 인스턴스 설계 및 등록'}
					</h3>
					<p class="text-xs font-bold text-slate-400 mt-1">
						경로(Slug)와 명칭, 레이아웃 규격을 지정하여 새 게시판 서비스를 즉시 활성화합니다.
					</p>
				</div>
				{#if editingBoard.id && editingBoard.slug}
					<a
						href="/v1/app/board/{editingBoard.slug}"
						class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50 text-xs font-black text-blue-700 hover:bg-blue-600 hover:text-white transition"
					>
						<span>게시판 바로가기</span>
						<Icon icon="ph:arrow-square-out-bold" class="text-xs" />
					</a>
				{/if}
			</div>

			<div class="space-y-6">
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
					<div class="space-y-1.5">
						<label for="board-slug-input" class="block text-xs font-black text-slate-700 tracking-wide">
							게시판 주소 (Slug / ID) <span class="text-rose-500">*</span>
						</label>
						<input
							id="board-slug-input"
							type="text"
							bind:value={editingBoard.slug}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold font-mono text-blue-600 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none transition"
							placeholder="예: notice, free, gallery, qna"
						/>
						<p class="text-[11px] text-slate-400">URL 경로(/v1/app/board/[slug])로 사용됩니다.</p>
					</div>

					<div class="space-y-1.5">
						<label for="board-name-input" class="block text-xs font-black text-slate-700 tracking-wide">
							게시판 공식 명칭 <span class="text-rose-500">*</span>
						</label>
						<input
							id="board-name-input"
							type="text"
							bind:value={editingBoard.name}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none transition"
							placeholder="예: 전사 공지사항"
						/>
						<p class="text-[11px] text-slate-400">화면 상단 및 메뉴에 노출되는 한글 명칭입니다.</p>
					</div>
				</div>

				<div class="space-y-1.5">
					<label for="board-desc-input" class="block text-xs font-black text-slate-700 tracking-wide">게시판 상세 설명</label>
					<input
						id="board-desc-input"
						type="text"
						bind:value={editingBoard.description}
						class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold text-slate-800 bg-white focus:border-blue-600 focus:outline-none transition"
						placeholder="사용자 및 임직원에게 안내할 게시판의 역할과 이용 수칙"
					/>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
					<div class="space-y-1.5">
						<label for="board-layout-select" class="block text-xs font-black text-slate-700 tracking-wide">표준 레이아웃 스타일</label>
						<select
							id="board-layout-select"
							bind:value={editingBoard.layout_type}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold text-slate-800 bg-white focus:border-blue-600 focus:outline-none transition"
						>
							<option value="list">리스트형 (일반 텍스트 목록 표준)</option>
							<option value="gallery">갤러리형 (현장 사진·이미지 썸네일 카드)</option>
							<option value="blog">블로그형 (피드 본문 요약 카드)</option>
						</select>
					</div>

					<div class="space-y-1.5">
						<label for="board-items-input" class="block text-xs font-black text-slate-700 tracking-wide">페이지당 기본 노출 건수</label>
						<input
							id="board-items-input"
							type="number"
							bind:value={editingBoard.items_per_page}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold text-slate-800 bg-white focus:border-blue-600 focus:outline-none transition"
						/>
					</div>
				</div>

				<div class="pt-6 border-t border-slate-100 flex flex-wrap items-center gap-3">
					<button
						onclick={handleSave}
						class="px-6 py-3 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-wider hover:bg-blue-700 transition shadow-md"
					>
						{editingBoard.id ? '게시판 설정 저장하기' : '새 게시판 인스턴스 활성화'}
					</button>

					<button
						onclick={() => { resetForm(); activeTab = 'list'; }}
						class="px-5 py-3 rounded-2xl border-2 border-slate-200 text-slate-600 font-black text-xs uppercase hover:bg-slate-50 transition"
					>
						목록으로 돌아가기
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
