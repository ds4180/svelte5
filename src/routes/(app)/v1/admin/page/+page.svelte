<script>
	/**
	 * @file (app)/v1/admin/page/+page.svelte
	 * @description 컨벤션에 따른 페이지 엔진 전용 관리자 화면 (Svelte 5 모던 템플릿)
	 *              - 전사 표준 모던 엔터프라이즈 헤더 & 핵심 관제 지표 요약 카드
	 *              - 반응형 카드 기반 본문 레이아웃 (모바일 세로/태블릿/데스크탑 최적화)
	 *              - 브라우저 탭 단일 진실 공급원(SSOT) 환경설정 타이틀 연동
	 */
	import { onMount, untrack } from 'svelte';
	import * as api from '$lib/api/page.js';
	import { toast } from '$lib/runes/toast.svelte.js';
	import { getSiteTitle } from '$lib/config/site';
	import { toLocalISOString } from '$lib/utils';
	import Icon from '@iconify/svelte';

	let { data } = $props();

	let pages = $state(/** @type {any[]} */ (untrack(() => data?.pages || [])));
	let loading = $state(false);
	let isSavingMeta = $state(false);

	// 📑 1. 탭 상태 ('list' | 'create')
	let activeTab = $state('list');
	let isCreating = $state(false);

	// 📝 2. 새 페이지 생성 폼 상태
	let createForm = $state({
		title: '',
		slug: '',
		status: 'PUBLISHED',
		min_rank: 0,
		is_active: true,
		redirect_url: '',
		content: ''
	});

	function startCreate() {
		createForm = {
			title: '',
			slug: '',
			status: 'PUBLISHED',
			min_rank: 0,
			is_active: true,
			redirect_url: '',
			content: ''
		};
		activeTab = 'create';
	}

	async function handleCreatePage() {
		if (!createForm.title.trim()) {
			toast.warning('페이지 제목을 입력해 주세요.');
			return;
		}
		if (!createForm.slug.trim()) {
			toast.warning('페이지 경로(Slug)를 입력해 주세요.');
			return;
		}

		isCreating = true;
		try {
			await api.adminCreatePage({
				title: createForm.title.trim(),
				slug: createForm.slug.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-'),
				status: createForm.status,
				min_rank: Number(createForm.min_rank) || 0,
				is_active: createForm.is_active,
				redirect_url: createForm.redirect_url ? createForm.redirect_url.trim() : null,
				content: createForm.content
			});
			toast.success(`'${createForm.title}' 페이지가 성공적으로 생성되었습니다.`);
			activeTab = 'list';
			await loadData();
		} catch (/** @type {any} */ e) {
			console.error('❌ 페이지 생성 실패:', e);
			toast.error('페이지 생성 실패: ' + (e.message || '오류 발생'));
		} finally {
			isCreating = false;
		}
	}

	// 메타데이터 수정을 위한 상태
	let showMetaModal = $state(false);
	let selectedPage = $state(/** @type {any} */ (null));
	let metaForm = $state(/** @type {any} */ ({
		id: null,
		title: '',
		slug: '',
		status: 'PUBLISHED',
		redirect_url: '',
		published_at: '',
		expired_at: '',
		min_rank: 0,
		is_active: true,
		customOptions: []
	}));

	let stats = $derived({
		total: pages.length,
		published: pages.filter((p) => p.status === 'PUBLISHED').length,
		draft: pages.filter((p) => p.status === 'DRAFT').length
	});

	async function loadData() {
		loading = true;
		try {
			pages = await api.adminGetPages();
		} catch (/** @type {any} */ e) {
			toast.error('페이지 목록 로드 실패: ' + (e.message || '오류 발생'));
		} finally {
			loading = false;
		}
	}

	/**
	 * @param {any} page
	 */
	function openMetaModal(page) {
		selectedPage = page;

		const baseFields = [
			'id',
			'slug',
			'title',
			'status',
			'redirect_url',
			'published_at',
			'expired_at',
			'min_rank',
			'is_active',
			'content',
			'content_json',
			'view_count',
			'created_at',
			'updated_at'
		];
		const customOpts = Object.entries(page)
			.filter(([k]) => !baseFields.includes(k))
			.map(([k, v]) => ({ key: k, value: v }));

		metaForm = {
			id: page.id,
			title: page.title,
			slug: page.slug,
			status: page.status,
			redirect_url: page.redirect_url || '',
			published_at: page.published_at ? toLocalISOString(page.published_at) : '',
			expired_at: page.expired_at ? toLocalISOString(page.expired_at) : '',
			min_rank: page.min_rank || 0,
			is_active: page.is_active ?? true,
			customOptions: customOpts
		};
		showMetaModal = true;
	}

	function addCustomOption() {
		metaForm.customOptions = [...metaForm.customOptions, { key: '', value: '' }];
	}

	/**
	 * @param {number} idx
	 */
	function removeCustomOption(idx) {
		metaForm.customOptions = metaForm.customOptions.filter((/** @type {any} */ _, /** @type {number} */ i) => i !== idx);
	}

	async function handleSaveMeta() {
		isSavingMeta = true;
		try {
			const payload = { ...metaForm };
			delete payload.customOptions;

			metaForm.customOptions.forEach((/** @type {{ key: string; value: any }} */ opt) => {
				if (opt.key.trim()) payload[opt.key.trim()] = opt.value;
			});

			await api.adminUpdatePage(payload);
			toast.success('페이지 설정이 업데이트되었습니다.');
			showMetaModal = false;
			loadData();
		} catch (/** @type {any} */ e) {
			toast.error('설정 저장 실패: ' + (e.message || '오류 발생'));
		} finally {
			isSavingMeta = false;
		}
	}

	/**
	 * @param {any} id
	 */
	async function handleDelete(id) {
		if (!confirm('정말로 이 페이지를 영구 삭제하시겠습니까?')) return;
		try {
			await api.adminDeletePage(id);
			toast.success('페이지가 삭제되었습니다.');
			loadData();
		} catch (/** @type {any} */ e) {
			toast.error('삭제 실패: ' + (e.message || '오류 발생'));
		}
	}

	onMount(loadData);
</script>

<svelte:head>
	<title>{getSiteTitle('페이지 엔진 관리')}</title>
</svelte:head>

<div class="animate-fade-in mx-auto max-w-7xl space-y-8 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:px-8">
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 우측 컨트롤 바 -->
	<!-- ===================================================================== -->
	<header class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end">
		<div>
			<div class="flex items-center gap-2 mb-2">
				<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-200">
					<Icon icon="ph:article-bold" class="text-sm" />
					SYSTEM GOVERNANCE • CMS PAGE ENGINE
				</span>
				<span class="text-xs font-bold text-slate-400 font-mono">v1/admin/page</span>
			</div>
			<h1 class="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
				페이지 <span class="not-italic text-blue-600">엔진 관리</span>
			</h1>
			<p class="mt-2 text-xs sm:text-sm font-bold text-slate-500">
				DB CMS 기반 동적 페이지 콘텐츠 생성·편집 및 게시 상태를 관제합니다.
			</p>
		</div>

		<!-- 상단 액션 버튼 그룹 -->
		<div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
			<button
				onclick={startCreate}
				class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-blue-600 bg-blue-600 text-white font-black text-xs uppercase tracking-wider hover:bg-blue-700 transition shadow-sm"
			>
				<Icon icon="ph:plus-circle-bold" class="text-base" />
				<span>새 페이지 작성</span>
			</button>

			<button
				onclick={loadData}
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
	<section class="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
		<!-- 카드 1: 전체 페이지 -->
		<div class="relative overflow-hidden rounded-[1.75rem] border-2 border-slate-100 bg-white p-5 shadow-sm hover:border-blue-300 transition group">
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-blue-600">Total Pages</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
					<Icon icon="ph:files-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{stats.total}
				<span class="text-sm font-bold text-slate-400 ml-1">개 등록</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-blue-600">
				<span class="rounded-lg bg-blue-50 px-2 py-0.5 font-mono">CMS DB</span>
			</div>
		</div>

		<!-- 카드 2: 게시 중 -->
		<div class="relative overflow-hidden rounded-[1.75rem] border-2 border-slate-100 bg-white p-5 shadow-sm hover:border-emerald-300 transition group">
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-emerald-600">Published Live</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
					<Icon icon="ph:check-circle-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-emerald-600 tracking-tight">
				{stats.published}
				<span class="text-sm font-bold text-slate-400 ml-1">개 공개</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-emerald-600">
				<span class="rounded-lg bg-emerald-50 px-2 py-0.5 font-mono">정상 노출 중</span>
			</div>
		</div>

		<!-- 카드 3: 임시 저장 -->
		<div class="relative overflow-hidden rounded-[1.75rem] border-2 border-slate-100 bg-white p-5 shadow-sm hover:border-amber-300 transition group">
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-amber-600">Drafts</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
					<Icon icon="ph:note-pencil-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-amber-700 tracking-tight">
				{stats.draft}
				<span class="text-sm font-bold text-slate-400 ml-1">개 작성 중</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-amber-600">
				<span class="rounded-lg bg-amber-50 px-2 py-0.5 font-mono">비공개 보관</span>
			</div>
		</div>
	</section>

	<!-- ===================================================================== -->
	<!-- 3. 모드 탭 바 -->
	<!-- ===================================================================== -->
	<nav class="flex gap-2 border-b-2 border-slate-200 overflow-x-auto no-scrollbar">
		<button
			onclick={() => (activeTab = 'list')}
			class="flex items-center gap-2 px-6 py-3.5 text-xs font-black uppercase tracking-widest border-b-4 transition whitespace-nowrap {activeTab === 'list'
				? 'border-blue-600 text-blue-700 bg-blue-50/60 rounded-t-2xl'
				: 'border-transparent text-slate-500 hover:text-slate-900'}"
		>
			<Icon icon="ph:list-dashes-bold" class="text-base" />
			<span>발행된 페이지 명부 ({pages.length})</span>
		</button>
		<button
			onclick={startCreate}
			class="flex items-center gap-2 px-6 py-3.5 text-xs font-black uppercase tracking-widest border-b-4 transition whitespace-nowrap {activeTab === 'create'
				? 'border-blue-600 text-blue-700 bg-blue-50/60 rounded-t-2xl'
				: 'border-transparent text-slate-500 hover:text-slate-900'}"
		>
			<Icon icon="ph:plus-circle-bold" class="text-base" />
			<span>새 페이지 작성</span>
		</button>
	</nav>

	<!-- ===================================================================== -->
	<!-- 4. 본문 컨텐츠 (반응형 카드 형식 위주) -->
	<!-- ===================================================================== -->
	{#if activeTab === 'create'}
		<!-- 새 페이지 작성 인라인 폼 -->
		<div class="rounded-3xl border-2 border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
			<div class="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
				<div class="flex items-center gap-2">
					<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
						<Icon icon="ph:file-plus-bold" class="text-2xl" />
					</div>
					<div>
						<h2 class="text-xl font-black text-slate-900">새 페이지 작성</h2>
						<p class="text-xs font-bold text-slate-500">동적으로 렌더링될 신규 CMS 페이지를 생성하고 즉시 발행합니다.</p>
					</div>
				</div>
				<button
					type="button"
					onclick={() => (activeTab = 'list')}
					class="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition"
				>
					목록으로 돌아가기
				</button>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleCreatePage(); }} class="space-y-6">
				<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
					<div>
						<label for="create-title-input" class="block text-xs font-bold text-slate-700 mb-2">
							페이지 제목 <span class="text-rose-500">*</span>
						</label>
						<input
							id="create-title-input"
							type="text"
							bind:value={createForm.title}
							placeholder="예: 회사 소개, 이용약관, 이벤트 안내"
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-sm font-bold focus:border-blue-600 focus:outline-none transition"
							required
						/>
					</div>

					<div>
						<label for="create-slug-input" class="block text-xs font-bold text-slate-700 mb-2">
							URL 경로 (Slug) <span class="text-rose-500">*</span>
						</label>
						<div class="flex items-center">
							<span class="px-3 py-3 rounded-l-2xl border-2 border-r-0 border-slate-200 bg-slate-50 text-xs font-mono font-bold text-slate-400">
								/v1/custom/page/
							</span>
							<input
								id="create-slug-input"
								type="text"
								bind:value={createForm.slug}
								placeholder="about-us"
								class="w-full px-4 py-3 rounded-r-2xl border-2 border-slate-200 text-sm font-mono font-bold focus:border-blue-600 focus:outline-none transition"
								required
							/>
						</div>
					</div>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-3 gap-5">
					<div>
						<label for="create-status-select" class="block text-xs font-bold text-slate-700 mb-2">게시 상태</label>
						<select
							id="create-status-select"
							bind:value={createForm.status}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold focus:border-blue-600 focus:outline-none bg-white transition"
						>
							<option value="PUBLISHED">게시 중 (PUBLISHED)</option>
							<option value="DRAFT">임시 저장 (DRAFT)</option>
						</select>
					</div>

					<div>
						<label for="create-rank-select" class="block text-xs font-bold text-slate-700 mb-2">접근 권한 (최소 등급)</label>
						<select
							id="create-rank-select"
							bind:value={createForm.min_rank}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold focus:border-blue-600 focus:outline-none bg-white transition"
						>
							<option value={0}>전체 공개 (R0)</option>
							<option value={1}>직원 전용 (R1)</option>
							<option value={2}>관리자 전용 (R2)</option>
							<option value={4}>시스템 마스터 전용 (R4)</option>
						</select>
					</div>

					<div>
						<label for="create-redirect-input" class="block text-xs font-bold text-slate-700 mb-2">리다이렉트 URL (선택)</label>
						<input
							id="create-redirect-input"
							type="text"
							bind:value={createForm.redirect_url}
							placeholder="외부 또는 내부 링크 (선택사항)"
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-mono font-bold focus:border-blue-600 focus:outline-none transition"
						/>
					</div>
				</div>

				<div>
					<label for="create-content-input" class="block text-xs font-bold text-slate-700 mb-2">
						본문 콘텐츠 (HTML / Markdown)
					</label>
					<textarea
						id="create-content-input"
						bind:value={createForm.content}
						rows="12"
						placeholder="페이지 본문 내용을 입력하세요. (HTML 또는 일반 텍스트)"
						class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-mono font-medium focus:border-blue-600 focus:outline-none transition"
					></textarea>
				</div>

				<div class="flex items-center justify-between border-t border-slate-100 pt-6">
					<label class="flex items-center gap-2 cursor-pointer">
						<input
							type="checkbox"
							bind:checked={createForm.is_active}
							class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
						/>
						<span class="text-xs font-bold text-slate-700">페이지 즉시 활성화</span>
					</label>

					<div class="flex items-center gap-3">
						<button
							type="button"
							onclick={() => (activeTab = 'list')}
							class="px-5 py-2.5 rounded-2xl border-2 border-slate-200 bg-white text-xs font-black text-slate-600 hover:border-slate-400 transition"
						>
							취소
						</button>
						<button
							type="submit"
							disabled={isCreating}
							class="flex items-center gap-1.5 px-6 py-2.5 rounded-2xl border-2 border-blue-600 bg-blue-600 text-white text-xs font-black uppercase tracking-wider hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
						>
							<Icon icon="ph:check-circle-bold" class="text-base {isCreating ? 'animate-spin' : ''}" />
							<span>{isCreating ? '생성 중...' : '페이지 생성 및 발행'}</span>
						</button>
					</div>
				</div>
			</form>
		</div>
	{:else}
		<!-- 목록 탭 -->
		{#if loading}
			<div class="flex justify-center py-20">
				<div class="flex flex-col items-center gap-3">
					<div class="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
					<p class="text-xs font-bold text-slate-400 font-mono">페이지 데이터 로드 중...</p>
				</div>
			</div>
		{:else if pages.length === 0}
			<div class="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
				<Icon icon="ph:file-x-light" class="mx-auto text-4xl text-slate-300 mb-3" />
				<p class="text-sm font-bold text-slate-500">생성된 페이지가 없습니다.</p>
				<button
					type="button"
					onclick={startCreate}
					class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition shadow-sm"
				>
					<Icon icon="ph:plus-circle-bold" class="text-base" />
					<span>첫 페이지 만들기</span>
				</button>
			</div>
		{:else}
			<!-- 반응형 카드 그리드: 모바일 세로 1열, 태블릿 2열, 데스크탑 3열 -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
				{#each pages as p (p.id)}
					<div class="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm hover:border-blue-400 transition-all flex flex-col justify-between">
						<div>
							<div class="flex items-center justify-between mb-3">
								<div class="flex items-center gap-1.5">
									<span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase font-mono {p.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-600'}">
										{p.status}
									</span>
									{#if p.is_active === false}
										<span class="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200">
											비활성
										</span>
									{/if}
								</div>
								<div class="flex items-center gap-1.5">
									<button
										type="button"
										onclick={() => openMetaModal(p)}
										class="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition"
									>
										설정
									</button>
									<button
										type="button"
										onclick={() => handleDelete(p.id)}
										class="px-2.5 py-1 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition"
									>
										삭제
									</button>
								</div>
							</div>

							<h3 class="text-xl font-black text-slate-900 tracking-tight">{p.title}</h3>
							<p class="font-mono text-xs font-bold text-blue-600 mt-1 truncate">/v1/custom/page/{p.slug}</p>
						</div>

						<div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
							<div class="flex items-center gap-1 text-xs text-slate-400">
								<Icon icon="ph:eye-bold" class="text-sm" />
								<span class="font-bold">{p.view_count || 0}</span>
							</div>
							<div class="flex items-center gap-1.5">
								<a
									href="/v1/custom/page/{p.slug}?edit=true"
									class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold border border-slate-200 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-600 rounded-xl transition"
								>
									<Icon icon="ph:pencil-simple-bold" class="text-xs" />
									<span>편집</span>
								</a>
								<a
									href="/v1/custom/page/{p.slug}"
									class="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-black bg-slate-900 text-white hover:bg-blue-600 rounded-xl transition shadow-sm"
								>
									<span>보기</span>
									<Icon icon="ph:arrow-right-bold" class="text-xs" />
								</a>
							</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<!-- 메타데이터 수정 모달 -->
{#if showMetaModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		onclick={() => (showMetaModal = false)}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
	>
		<div
			onclick={(e) => e.stopPropagation()}
			class="w-full max-w-2xl rounded-3xl border-2 border-slate-200 bg-white p-6 sm:p-8 shadow-2xl max-h-[90vh] overflow-y-auto"
		>
			<div class="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
				<div>
					<h3 class="text-xl font-black text-slate-900">페이지 메타데이터 설정</h3>
					<p class="text-[11px] font-mono font-bold text-slate-400 mt-0.5">Target ID: {metaForm.id}</p>
				</div>
				<button type="button" onclick={() => (showMetaModal = false)} class="text-slate-400 hover:text-slate-700 p-1">
					<Icon icon="ph:x-bold" class="text-xl" />
				</button>
			</div>

			<div class="space-y-5">
				<!-- 제목 & Slug -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<label for="meta-title-input" class="block text-xs font-black text-slate-700 mb-1.5">페이지 제목</label>
						<input
							id="meta-title-input"
							type="text"
							bind:value={metaForm.title}
							class="w-full px-4 py-2.5 rounded-2xl border-2 border-slate-200 text-xs font-bold focus:border-blue-600 focus:outline-none transition"
						/>
					</div>

					<div>
						<label for="meta-slug-input" class="block text-xs font-black text-slate-700 mb-1.5">경로 (Slug)</label>
						<div class="flex items-center">
							<span class="px-2.5 py-2.5 rounded-l-2xl border-2 border-r-0 border-slate-200 bg-slate-50 text-[11px] font-mono font-bold text-slate-400">
								/page/
							</span>
							<input
								id="meta-slug-input"
								type="text"
								bind:value={metaForm.slug}
								class="w-full px-3 py-2.5 rounded-r-2xl border-2 border-slate-200 text-xs font-bold font-mono focus:border-blue-600 focus:outline-none transition"
							/>
						</div>
					</div>
				</div>

				<!-- 상태 & 게시 시작일시 -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<label for="meta-status-select" class="block text-xs font-black text-slate-700 mb-1.5">게시 상태</label>
						<select
							id="meta-status-select"
							bind:value={metaForm.status}
							class="w-full px-4 py-2.5 rounded-2xl border-2 border-slate-200 text-xs font-bold focus:border-blue-600 focus:outline-none bg-white transition"
						>
							<option value="PUBLISHED">게시 중 (PUBLISHED)</option>
							<option value="DRAFT">임시 저장 (DRAFT)</option>
						</select>
					</div>

					<div>
						<label for="meta-pub-input" class="block text-xs font-black text-slate-700 mb-1.5">게시 시작 일시 (Release Time)</label>
						<input
							id="meta-pub-input"
							type="datetime-local"
							bind:value={metaForm.published_at}
							class="w-full px-4 py-2.5 rounded-2xl border-2 border-slate-200 text-xs font-bold focus:border-blue-600 focus:outline-none transition"
						/>
					</div>
				</div>

				<!-- 최소 권한, 만료 일시, 활성화 여부 -->
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
					<div>
						<label for="meta-rank-select" class="block text-xs font-black text-slate-700 mb-1.5">최소 권한</label>
						<select
							id="meta-rank-select"
							bind:value={metaForm.min_rank}
							class="w-full px-3 py-2.5 rounded-2xl border-2 border-slate-200 text-xs font-bold focus:border-blue-600 focus:outline-none bg-white transition"
						>
							<option value={0}>전체 (R0)</option>
							<option value={1}>직원 (R1)</option>
							<option value={2}>관리자 (R2)</option>
							<option value={4}>마스터 (R4)</option>
						</select>
					</div>

					<div>
						<label for="meta-exp-input" class="block text-xs font-black text-rose-600 mb-1.5">만료 일시 (Expiration)</label>
						<input
							id="meta-exp-input"
							type="datetime-local"
							bind:value={metaForm.expired_at}
							class="w-full px-3 py-2.5 rounded-2xl border-2 border-dashed border-rose-200 text-xs font-bold focus:border-rose-500 focus:outline-none transition"
						/>
					</div>

					<div class="flex flex-col justify-end">
						<label class="flex items-center gap-2.5 cursor-pointer rounded-2xl border-2 px-3.5 py-2.5 transition {metaForm.is_active ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'}">
							<input
								type="checkbox"
								bind:checked={metaForm.is_active}
								class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
							/>
							<span class="text-xs font-black text-slate-800">시스템 활성화</span>
						</label>
					</div>
				</div>

				<!-- 리다이렉트 URL -->
				<div>
					<label for="meta-redirect-input" class="block text-xs font-black text-blue-600 mb-1.5">리다이렉트 URL (외부/내부 강제 이동 링크)</label>
					<input
						id="meta-redirect-input"
						type="text"
						bind:value={metaForm.redirect_url}
						placeholder="https://... 또는 /v1/..."
						class="w-full px-4 py-2.5 rounded-2xl border-2 border-slate-200 bg-blue-50/20 text-xs font-mono font-bold focus:border-blue-600 focus:outline-none transition"
					/>
				</div>

				<!-- JSONB 커스텀 속성 동적 추가 -->
				<div class="space-y-3 pt-4 border-t-2 border-dashed border-slate-200">
					<div class="flex items-center justify-between">
						<span class="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
							<Icon icon="ph:brackets-curly-bold" class="text-blue-600" />
							Custom Page Properties (JSONB)
						</span>
						<button
							type="button"
							onclick={addCustomOption}
							class="px-3 py-1.5 rounded-xl bg-amber-100 border border-amber-300 text-[11px] font-black text-amber-800 hover:bg-amber-200 transition"
						>
							+ 속성 추가
						</button>
					</div>

					{#if metaForm.customOptions && metaForm.customOptions.length > 0}
						<div class="max-h-40 overflow-y-auto space-y-2 pr-1">
							{#each metaForm.customOptions as opt, idx}
								<div class="flex items-center gap-2">
									<input
										type="text"
										bind:value={opt.key}
										placeholder="KEY"
										class="flex-1 px-3 py-2 rounded-xl border-2 border-slate-200 bg-slate-900 text-white font-mono text-xs font-bold focus:border-blue-500 focus:outline-none"
									/>
									<input
										type="text"
										bind:value={opt.value}
										placeholder="VALUE"
										class="flex-[1.5] px-3 py-2 rounded-xl border-2 border-slate-200 text-xs font-bold focus:border-blue-600 focus:outline-none"
									/>
									<button
										type="button"
										onclick={() => removeCustomOption(idx)}
										class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-500 hover:border-rose-500 hover:bg-rose-500 hover:text-white transition"
										aria-label="속성 삭제"
									>
										<Icon icon="ph:x-bold" class="text-sm" />
									</button>
								</div>
							{/each}
						</div>
					{:else}
						<p class="text-[11px] font-medium text-slate-400">등록된 커스텀 JSONB 속성이 없습니다.</p>
					{/if}
				</div>

				<div class="pt-4 flex justify-end gap-2 border-t border-slate-100">
					<button
						type="button"
						onclick={() => (showMetaModal = false)}
						class="px-5 py-2.5 rounded-2xl border-2 border-slate-200 bg-white text-xs font-black text-slate-600 hover:border-slate-400 transition"
					>
						취소
					</button>
					<button
						type="button"
						onclick={handleSaveMeta}
						disabled={isSavingMeta}
						class="flex items-center gap-1.5 px-6 py-2.5 rounded-2xl bg-blue-600 text-white text-xs font-black hover:bg-blue-700 shadow-sm disabled:opacity-50 transition"
					>
						<Icon icon="ph:check-circle-bold" class="text-base {isSavingMeta ? 'animate-spin' : ''}" />
						<span>{isSavingMeta ? '저장 중...' : '모든 설정 저장'}</span>
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
