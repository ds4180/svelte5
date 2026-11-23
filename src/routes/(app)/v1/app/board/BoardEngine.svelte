<script>
	/**
	 * @file BoardEngine.svelte
	 * @description Svelte 5 기반의 범용 게시판 엔진 (목록, 상세, 쓰기, 수정 통합)
	 * @prop {string} slug  - URL 슬러그 (예: "notice", "notice/42", "notice/42/edit")
	 * @prop {string} appId - 앱 식별자 (기본값: "board")
	 */
	import { onDestroy, untrack } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import * as api from '$lib/api/board';
	import { adminGetAppData, adminUpdateBoard } from '$lib/api/admin';
	import { buildOptionMenuItems } from '$lib/utils/dynamicOptions';
	import * as engines from '$lib/index';
	import ServiceBundleRenderer from '$lib/components/ServiceBundleRenderer.svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import TiptapEditor from '$lib/components/TiptapEditor.svelte';
	import SafeHtml from '$lib/components/SafeHtml.svelte';
	import ServiceLockNotice from '$lib/components/ServiceLockNotice.svelte';
	import SearchFilterBar from '$lib/components/SearchFilterBar.svelte';
	import Pagination from '$lib/components/Pagination.svelte';
	import BoardListLayout from './layouts/BoardListLayout.svelte';
	import BoardGalleryLayout from './layouts/BoardGalleryLayout.svelte';
	import BoardBlogLayout from './layouts/BoardBlogLayout.svelte';
	import {
		getBoardCategories,
		buildPostMetaMenuItems,
		getPostMetaPresentation
	} from './layouts/boardUtils';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { navState } from '$lib/runes/nav.svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatDate } from '$lib/utils';
	import { formatApiError } from '$lib/utils/error';
	import { env } from '$env/dynamic/public';
	import {
		parseBoardRoute,
		isUserBoardAdmin,
		computeEditorLockPermission,
		validateBoardPostForm,
		saveBoardPost
	} from '$lib/services/boardService';

	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';

	/** @type {{ slug: string, appId?: string, initialData?: any }} */
	let { slug, appId = 'board', initialData = null } = $props();

	const auth = getAuthContext();

	// --- [라우팅 및 모드 분석] ---
	let mode = $state('list'); // list, view, write, edit
	let boardSlug = $state('');
	let postId = $state(/** @type {string | null} */ (null));
	let currentPage = $state(1);
	let pageSize = $state(10);
	let keyword = $state('');
	let selectedCategory = $state('전체');
	let sort = $state('latest');

	// --- [데이터 상태] ---
	let appInfo = $state(initialData?.app_info || null);
	let posts = $state(initialData?.posts || []);
	let board = $state(initialData?.board || null);
	let post = $state(initialData?.post || null);
	let bindings = $state(initialData?.bindings || []);
	let total = $state(initialData?.total || 0);
	let isLoading = $state(false);
	let errorMessage = $state('');
	let boardCategories = $derived(getBoardCategories(board?.options));
	let boardAdminRank = $derived(Number(appInfo?.min_write_rank ?? 4));

	// 🛡️ [4단계 권한 기반 쓰기 권한 파생 상태]
	let canWrite = $derived(
		auth.canAccess({
			action: 'write',
			minWriteRank: board?.min_write_rank ?? 2,
			minReadRank: board?.min_read_rank ?? 0,
			allowGroups: board?.allow_groups ?? [],
			denyGroups: board?.deny_groups ?? []
		})
	);

	let isBoardAdmin = $derived(isUserBoardAdmin(auth.user, board, boardAdminRank));

	let canModifyPost = $derived(
		Boolean(post) &&
			(isBoardAdmin ||
				(canWrite &&
					((post.user_id && post.user_id === auth.user?.id) ||
						(post.author_id && post.author_id === auth.user?.id))))
	);

	// 🛡️ 글쓰기/수정 URL 직접 진입 시 사전 잠금 판별 객체
	let editorLockPermission = $derived(
		computeEditorLockPermission(auth.user, /** @type {any} */ (mode), canWrite, canModifyPost, post)
	);

	let ActiveListLayout = $derived(
		board?.layout_type === 'gallery'
			? BoardGalleryLayout
			: board?.layout_type === 'blog'
				? BoardBlogLayout
				: BoardListLayout
	);

	// --- [폼 상태] ---
	let editForm = $state({
		title: '',
		content: '',
		content_json: null,
		extra_data: {},
		status: 'published'
	});

	function resetEditForm() {
		editForm = {
			title: '',
			content: '',
			content_json: null,
			extra_data: {},
			status: 'published'
		};
	}

	/** 경로 파싱 함수 */
	function parsePath() {
		const parsed = parseBoardRoute(slug);
		boardSlug = parsed.boardSlug;
		mode = parsed.mode;
		postId = parsed.postId;
		if (mode === 'write') {
			resetEditForm();
		}
	}

	// 초기 파싱
	parsePath();

	/** @param {string} key @param {any} nextValue */
	async function handleBoardOptionChange(key, nextValue) {
		if (!board) return;
		const prevOptions = board.options && typeof board.options === 'object' ? board.options : {};
		const nextOptions = { ...prevOptions, [key]: nextValue };
		board = { ...board, options: nextOptions };

		if ((auth.user?.rank_level ?? 0) >= 4 && board.id) {
			try {
				await adminUpdateBoard(board.id, { options: nextOptions });
				toast.success(`세부 옵션('${key}')이 저장되었습니다.`);
				if (key === 'use_pin' && mode === 'list') {
					await loadData(true);
				}
			} catch (e) {
				board = { ...board, options: prevOptions };
				toast.error('옵션 저장 실패: ' + formatApiError(e));
			}
		} else {
			toast.info(`세부 옵션('${key}')이 현재 화면에 적용되었습니다.`);
		}
	}

	let activeExtra = $derived(/** @type {Record<string, any>} */ (editForm.extra_data || {}));
	let isPinFeatureEnabled = $derived.by(() => {
		const raw = board?.options?.use_pin;
		if (raw === undefined) return true;
		if (raw && typeof raw === 'object' && 'value' in raw) return Boolean(raw.value);
		return Boolean(raw);
	});

	async function handleQuickPostMetaToggle(
		/** @type {string} */ key,
		/** @type {any} */ nextValue
	) {
		if (!post?.id) return;
		const prevExtra = post.extra_data && typeof post.extra_data === 'object' ? post.extra_data : {};
		const nextExtra = { ...prevExtra, [key]: nextValue };
		post = { ...post, extra_data: nextExtra };
		try {
			await api.updatePost(post.id, { extra_data: nextExtra });
			if (key === 'is_pinned') {
				toast.success(
					nextValue ? '📌 이 글이 상단 고정되었습니다.' : '상단 고정이 해제되었습니다.'
				);
			} else {
				toast.success('게시물 설정이 저장되었습니다.');
			}
		} catch (e) {
			post = { ...post, extra_data: prevExtra };
			toast.error('저장 실패: ' + formatApiError(e));
		}
	}

	function handlePostMetaChange(/** @type {string} */ key, /** @type {any} */ nextValue) {
		const prev =
			editForm.extra_data && typeof editForm.extra_data === 'object' ? editForm.extra_data : {};
		editForm.extra_data = /** @type {Record<string, any>} */ ({ ...prev, [key]: nextValue });
	}

	// 📌 우측 다이나믹 폼(DynamicSidebar): 글쓰기/수정 시 게시물 메타 폼, 목록/상세 시 게시판 설정(+관리자 빠른 고정) 폼 주입
	$effect(() => {
		const slugVal = boardSlug;
		const b = board;
		const currentMode = mode;
		const currentPost = post;
		const pinEnabled = isPinFeatureEnabled;

		if (!slugVal || !b) {
			navState.clearPageMenus();
			return;
		}

		const isAdmin = isBoardAdmin;

		if (currentMode === 'write' || currentMode === 'edit') {
			const metaSnapshot = editForm.extra_data;
			const writeKeys = Array.isArray(b.options?.write_meta_keys)
				? b.options.write_meta_keys
				: null;
			let items = buildPostMetaMenuItems(
				metaSnapshot,
				isAdmin,
				handlePostMetaChange,
				writeKeys,
				boardCategories
			);
			if (!pinEnabled) {
				items = items.filter(
					(item) => item.metaKey !== 'is_pinned' && item.metaKey !== 'pin_until'
				);
			}
			navState.setPageMenus(items);
		} else {
			const items = [];
			if (currentMode === 'view' && currentPost && (isAdmin || canModifyPost)) {
				const viewKeys = Array.isArray(b.options?.view_meta_keys) ? b.options.view_meta_keys : null;
				let metaItems = buildPostMetaMenuItems(
					currentPost.extra_data,
					isAdmin,
					handleQuickPostMetaToggle,
					viewKeys,
					boardCategories
				);
				if (!pinEnabled) {
					metaItems = metaItems.filter(
						(item) => item.metaKey !== 'is_pinned' && item.metaKey !== 'pin_until'
					);
				}
				items.push(...metaItems);
			}
			items.push(...buildOptionMenuItems(b.options, handleBoardOptionChange));
			navState.setPageMenus(items);
		}
	});

	onDestroy(() => {
		navState.clearPageMenus();
	});

	// 🔄 initialData 변경(invalidateAll 등) 시 목록/상세 상태 즉시 동기화
	$effect(() => {
		if (initialData) {
			appInfo = initialData.app_info || appInfo;
			posts = initialData.posts || [];
			post = initialData.post || null;
			board = initialData.board || null;
			bindings = initialData.bindings || [];
			total = initialData.total || 0;
		}
	});

	// 🔄 슬러그 변경 감지 (Svelte 5 클라이언트 라우팅 대응)
	let currentSlug = $state(slug);
	$effect(() => {
		if (slug !== currentSlug) {
			untrack(() => {
				const prevBoardSlug = boardSlug;
				currentSlug = slug;
				parsePath();

				if (boardSlug !== prevBoardSlug) {
					keyword = '';
					sort = 'latest';
					currentPage = 1;
				}

				if (initialData) {
					posts = initialData.posts || [];
					post = initialData.post || null;
					board = initialData.board || null;
					bindings = initialData.bindings || [];
					total = initialData.total || 0;
				}

				loadData(true);
			});
		}
	});

	// 컴포넌트 초기화 시 데이터 로드
	loadData();

	// --- [데이터 로드] ---
	async function loadData(forceRefresh = false) {
		if (isLoading) return;

		if (!boardSlug) {
			errorMessage = '잘못된 접근입니다. 게시판 주소(Slug)를 입력해 주세요.';
			return;
		}

		const hasSSRData =
			!forceRefresh && Boolean(initialData) && (mode === 'list' ? board !== null : post !== null);

		if (hasSSRData) {
			console.log('🚀 [BoardEngine] SSR data hydrated — skipping API fetch');
			if (mode === 'edit' && post) {
				editForm = {
					title: post.title || '',
					content: post.content || '',
					content_json: post.content_json ?? null,
					extra_data: post.extra_data || {},
					status: post.status || 'published'
				};
			}
			return;
		}

		isLoading = true;
		errorMessage = '';
		try {
			// ✅ [Hardcoding Zero] 게시판 전용 API 대신 범용 데이터 API 호출
			const data = await adminGetAppData('board', slug, {
				page: currentPage - 1,
				size: pageSize,
				keyword: keyword,
				sort: sort,
				category: selectedCategory === '전체' ? '' : selectedCategory
			});

			if (data?.app_info) {
				appInfo = data.app_info;
			}
			if (mode === 'list') {
				const instance = data.instance || {};
				posts = instance.posts || [];
				board = data.parent_config || null;
				total = instance.total || 0;
				bindings = data.bindings || [];
			} else if (mode === 'view' || mode === 'edit') {
				post = data.instance || null;
				board = data.parent_config || null;
				bindings = data.bindings || [];

				if (mode === 'edit' && post) {
					editForm = {
						title: post.title,
						content: post.content,
						content_json: post.content_json,
						extra_data: post.extra_data || {},
						status: post.status || 'published'
					};
				}
			}
		} catch (e) {
			console.error('[BoardEngine] 데이터 로딩 실패:', e);
			errorMessage = `데이터를 불러오지 못했습니다: ${formatApiError(e)}`;
		} finally {
			isLoading = false;
		}
	}

	// --- [액션 핸들러] ---
	async function handleSave() {
		if (isLoading) return;

		const validation = validateBoardPostForm(editForm);
		if (!validation.ok) {
			toast.warning(validation.message);
			return;
		}

		try {
			isLoading = true;
			const result = await saveBoardPost({
				mode: mode === 'edit' ? 'edit' : 'write',
				boardSlug,
				postId,
				board,
				editForm,
				serverUrl: PUBLIC_SERVER_URL
			});
			editForm.content = result.content;
			editForm.content_json = result.content_json;
			toast.success(mode === 'write' ? '게시글이 등록되었습니다.' : '게시글이 수정되었습니다.');

			if (mode === 'write') {
				currentPage = 1;
				keyword = '';
				sort = 'latest';
			}
			resetEditForm();
			isLoading = false;
			const targetUrl = result.savedId
				? `/v1/app/board/${boardSlug}/${result.savedId}`
				: `/v1/app/board/${boardSlug}`;
			await goto(targetUrl, { invalidateAll: true });
			await invalidateAll();
		} catch (e) {
			toast.error('저장 실패: ' + formatApiError(e));
		} finally {
			isLoading = false;
		}
	}

	async function handleDelete() {
		if (!confirm('정말 삭제하시겠습니까?')) return;
		try {
			isLoading = true;
			await api.deletePost(postId);
			toast.success('게시물이 삭제되었습니다.');
			isLoading = false;
			await goto(`/v1/app/board/${boardSlug}`, { invalidateAll: true });
			await invalidateAll();
		} catch (e) {
			toast.error('삭제 실패: ' + formatApiError(e));
		} finally {
			isLoading = false;
		}
	}

	function goToEdit() {
		goto(`/v1/app/board/${boardSlug}/${postId}/edit`);
	}

	function handlePageChange(p) {
		currentPage = p;
		loadData(true);
	}

	function handleSearch() {
		currentPage = 1;
		loadData(true);
	}
</script>

<!-- 🎨 메인 디자인 컨테이너 -->
<div class="board-engine-container w-full text-slate-900">
	{#if isLoading}
		<div
			class="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-white/75 backdrop-blur-xs"
		>
			<div
				class="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"
			></div>
			<p class="text-xs font-bold text-slate-500">데이터 불러오는 중...</p>
		</div>
	{/if}

	{#if errorMessage}
		<div
			class="mx-auto mb-6 flex max-w-4xl items-center gap-4 rounded-2xl border-2 border-rose-200 bg-rose-50 p-5 text-rose-800"
		>
			<Icon icon="ph:warning-circle-bold" class="h-8 w-8 flex-shrink-0 text-rose-600" />
			<div>
				<h3 class="text-sm font-black">오류 안내</h3>
				<p class="text-xs font-bold opacity-80">{errorMessage}</p>
			</div>
		</div>
	{/if}

	<div class="mx-auto max-w-5xl space-y-8 pb-20">
		{#if !boardSlug}
			<div
				class="flex h-[50vh] flex-col items-center justify-center gap-6 rounded-3xl border-2 border-slate-200 bg-white p-10 text-center shadow-sm"
			>
				<Icon icon="ph:map-pin-line-bold" class="h-16 w-16 text-rose-500" />
				<div class="space-y-2">
					<h2 class="text-2xl font-black tracking-tight text-slate-900">잘못된 게시판 경로</h2>
					<p class="max-w-md text-sm font-medium text-slate-500">
						요청하신 경로가 불완전합니다. 전체 게시판 목록에서 게시판을 선택해 주세요.
					</p>
				</div>
				<a
					href="/v1/app/board"
					class="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-6 py-3 text-xs font-black text-white transition hover:bg-blue-600"
				>
					전체 게시판 목록 보기
				</a>
			</div>
		{:else}
			<!-- 📑 HEADER AREA -->
			<header
				class="flex flex-col items-start justify-between gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-end"
			>
				<div class="space-y-2">
					<div class="flex items-center gap-2">
						<span class="rounded-lg bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">
							{boardSlug}
						</span>
						<span class="text-xs font-bold text-slate-400">
							{mode === 'list'
								? '목록'
								: mode === 'view'
									? '상세'
									: mode === 'write'
										? '글쓰기'
										: '수정'}
						</span>
					</div>
					<h1 class="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">
						{board?.name || boardSlug || '불러오는 중...'}
					</h1>
					{#if board?.description}
						<p class="max-w-xl text-xs font-medium text-slate-500 sm:text-sm">
							{board.description}
						</p>
					{/if}
				</div>

				<div class="flex flex-wrap items-center gap-2.5">
					<div class="flex items-center gap-2">
						{#if mode === 'list' && canWrite}
							<a
								href="/v1/app/board/{boardSlug}/write"
								class="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 text-xs font-black text-white shadow-sm transition hover:bg-blue-700"
							>
								<Icon icon="ph:pencil-line-bold" class="h-4 w-4" />
								<span>글쓰기</span>
							</a>
						{:else if mode !== 'list'}
							<a
								href="/v1/app/board/{boardSlug}"
								class="inline-flex h-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
							>
								← 목록으로
							</a>
						{/if}
						<a
							href="/v1/app/board"
							class="inline-flex h-10 items-center justify-center rounded-xl border-2 border-slate-200 bg-white px-4 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
							title="전체 게시판 목록"
						>
							전체 게시판
						</a>
					</div>
				</div>
			</header>

			<!-- 📄 MAIN CONTENT AREA -->
			<main class="animate-fade-in">
				{#if mode === 'list'}
					<div class="flex flex-col gap-4">
						<!-- 카테고리 필터 바 -->
						<div class="flex flex-wrap items-center gap-1.5">
							{#each ['전체', ...boardCategories] as cat}
								<button
									type="button"
									onclick={() => {
										selectedCategory = cat;
										currentPage = 1;
										loadData(true);
									}}
									class="rounded-xl px-3 py-1.5 text-xs font-black transition {selectedCategory ===
									cat
										? 'bg-slate-900 text-white shadow-xs'
										: 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100'}"
								>
									{cat}
								</button>
							{/each}
						</div>

						<SearchFilterBar bind:keyword bind:sort bind:pageSize {total} onSearch={handleSearch} />

						{#if posts.length === 0 && !isLoading}
							<div
								class="flex h-60 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-200 bg-white text-slate-400"
							>
								<Icon icon="ph:article-bold" class="h-14 w-14 opacity-40" />
								<p class="text-sm font-bold">등록된 게시글이 없습니다.</p>
							</div>
						{:else}
							<ActiveListLayout {posts} {boardSlug} boardOptions={board?.options || {}} />

							<!-- 🔢 PAGINATION (공용 Pagination 컴포넌트) -->
							<Pagination
								{total}
								currentPage={currentPage - 1}
								size={pageSize}
								onPageChange={(pageZero) => handlePageChange(pageZero + 1)}
							/>
						{/if}
					</div>
				{:else if mode === 'view'}
					{#if !post && !isLoading}
						<div
							class="flex h-64 flex-col items-center justify-center gap-4 rounded-3xl border-2 border-dashed border-slate-200 bg-white text-slate-400"
						>
							<Icon icon="ph:file-dashed-bold" class="h-14 w-14 opacity-40" />
							<p class="text-sm font-bold">게시물을 찾을 수 없습니다.</p>
							<a
								href="/v1/app/board/{boardSlug}"
								class="rounded-xl border-2 border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
							>
								← 목록으로
							</a>
						</div>
					{:else if post}
						{@const viewMeta = getPostMetaPresentation(post, board?.options)}
						{@const viewBindings = viewMeta.allowComment
							? bindings
							: (bindings || []).filter(
									(/** @type {any} */ b) =>
										!String(b?.engine_key || b?.registry_code || b?.app_id || '').includes(
											'comment'
										)
								)}
						<article class="mx-auto max-w-4xl" in:fade={{ duration: 250 }}>
							<div
								class="board-fullbleed-card rounded-3xl border-2 p-6 shadow-sm sm:p-10 {viewMeta.cardToneClass}"
							>
								<!-- 📋 게시물 헤더 블록 -->
								<header class="border-b border-slate-200 pb-6">
									<div class="flex flex-wrap items-center gap-2">
										{#if viewMeta.isPinned}
											<span
												class="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-black text-white"
												>📌 상단고정</span
											>
										{/if}
										{#if viewMeta.category}
											<span
												class="rounded-lg px-2.5 py-1 text-xs font-black {viewMeta.categoryClass}"
												>{viewMeta.category}</span
											>
										{/if}
										{#if viewMeta.isNew}
											<span
												class="rounded-lg bg-rose-500 px-2 py-0.5 text-[11px] font-black text-white"
												>NEW</span
											>
										{/if}
										{#if viewMeta.isSecret}
											<span
												class="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-black text-white"
												>🔒 비밀글</span
											>
										{/if}
										{#if viewMeta.effectiveDate}
											<span
												class="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700"
												>시행일 {viewMeta.effectiveDate}</span
											>
										{/if}
										{#if viewMeta.routeNo || viewMeta.vehicleNo}
											<span class="rounded-lg bg-sky-50 px-2.5 py-1 text-xs font-bold text-sky-700"
												>{[viewMeta.routeNo, viewMeta.vehicleNo].filter(Boolean).join(' · ')}</span
											>
										{/if}
										<a
											href="/v1/app/board/{boardSlug}"
											class="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-200"
										>
											{board?.name || boardSlug} · NO.{post.board_seq ?? post.id}
										</a>
										{#if post.status && post.status !== 'published'}
											<span
												class="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800"
											>
												{post.status}
											</span>
										{/if}
									</div>

									<h1
										class="mt-3 text-2xl tracking-tight sm:text-3xl {viewMeta.titleWeightClass} {viewMeta.titleColorClass}"
									>
										{#if viewMeta.icon}<span class="mr-2">{viewMeta.icon}</span>{/if}{post.title}
									</h1>

									<div
										class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-bold text-slate-500"
									>
										<span class="inline-flex items-center gap-1.5 text-slate-700">
											<Icon icon="ph:user-bold" class="h-3.5 w-3.5 text-slate-400" />
											<span
												>{post.user_name ||
													post.author_name ||
													post.user?.real_name ||
													post.user?.username ||
													'작성자'}</span
											>
										</span>
										<span class="inline-flex items-center gap-1.5 text-slate-400">
											<Icon icon="ph:calendar-blank-bold" class="h-3.5 w-3.5" />
											<span>작성 {formatDate(post.create_date || post.created_at)}</span>
										</span>
										{#if post.modify_date || post.updated_at}
											<span class="inline-flex items-center gap-1.5 text-slate-400">
												<Icon icon="ph:pencil-line-bold" class="h-3.5 w-3.5" />
												<span>수정 {formatDate(post.modify_date || post.updated_at)}</span>
											</span>
										{/if}
										<span class="inline-flex items-center gap-1.5 text-slate-500 sm:ml-auto">
											<Icon icon="ph:eye-bold" class="h-3.5 w-3.5 text-slate-400" />
											<span>조회 {post.view_count || 0}</span>
										</span>
									</div>
								</header>

								<!-- 📄 본문 콘텐츠 -->
								<SafeHtml
									html={post.content}
									class="prose max-w-none pt-8 text-base leading-relaxed text-slate-800 prose-slate"
								/>

								{#if viewMeta.ctaUrl}
									<div class="mt-6">
										<a
											href={viewMeta.ctaUrl}
											class="inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-xs font-black text-white shadow-sm transition hover:bg-indigo-700"
										>
											<Icon icon="ph:arrow-square-out-bold" class="h-4 w-4" />
											<span>{viewMeta.ctaLabel}</span>
										</a>
									</div>
								{/if}

								<!-- 🗂 extra_data 필드 표시 -->
								{#if post.extra_data && Object.keys(post.extra_data).length > 0}
									<section class="mt-8 rounded-2xl border border-slate-200 bg-slate-50 p-5">
										<h3 class="mb-3 flex items-center gap-1.5 text-xs font-black text-slate-700">
											<Icon icon="ph:list-dashes-bold" class="h-4 w-4 text-blue-600" />
											<span>추가 정보</span>
										</h3>
										<dl class="grid grid-cols-1 gap-3 md:grid-cols-2">
											{#each Object.entries(post.extra_data) as [key, val]}
												<div class="rounded-xl border border-slate-200 bg-white p-3.5">
													<dt class="mb-0.5 text-[11px] font-bold text-slate-400">{key}</dt>
													<dd class="text-sm font-bold text-slate-800">{val}</dd>
												</div>
											{/each}
										</dl>
									</section>
								{/if}

								<!-- 🔧 액션 푸터 -->
								<footer
									class="mt-10 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-6"
								>
									<div class="flex flex-wrap gap-2">
										{#if canModifyPost}
											<button
												class="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
												onclick={goToEdit}
											>
												<Icon icon="ph:pencil-simple-bold" class="h-4 w-4" /> 수정
											</button>
											<button
												class="inline-flex items-center gap-1.5 rounded-xl border-2 border-rose-200 bg-white px-4 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
												onclick={handleDelete}
											>
												<Icon icon="ph:trash-bold" class="h-4 w-4" /> 삭제
											</button>
										{/if}
									</div>
									<a
										href="/v1/app/board/{boardSlug}"
										class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white transition hover:bg-blue-600"
									>
										<Icon icon="ph:list-bold" class="h-4 w-4" /> 목록으로
									</a>
								</footer>
							</div>

							<!-- 💬 Dynamic Service Bindings (블록/인라인/2분할/카드묶음 동적 레이아웃 렌더링) -->
							<ServiceBundleRenderer
								bindings={viewBindings}
								{post}
								{appId}
								instanceId={postId}
								accessLevel={Number(board?.min_read_rank ?? 0) === 0 ? 'PUBLIC' : 'PROTECTED'}
								{boardSlug}
							/>
						</article>
					{/if}
				{:else if mode === 'write' || mode === 'edit'}
					{#if editorLockPermission}
						<div
							class="mx-auto max-w-3xl space-y-4 rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm sm:p-8"
						>
							<ServiceLockNotice
								permission={editorLockPermission}
								serviceLabel={mode === 'edit' ? '게시글 수정' : '게시글 작성'}
							/>
							<div class="flex justify-end">
								<a
									href="/v1/app/board/{boardSlug}"
									class="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white transition hover:bg-blue-600"
								>
									<Icon icon="ph:list-bold" class="h-4 w-4" /> 목록으로
								</a>
							</div>
						</div>
					{:else}
						<div class="mx-auto max-w-5xl">
							<div
								class="board-fullbleed-card rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm sm:p-8"
							>
								<div class="mb-6 flex items-center justify-between border-b border-slate-100 pb-4">
									<div class="flex items-center gap-3">
										<div
											class="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"
										>
											<Icon icon="ph:pencil-simple-line-bold" class="text-xl" />
										</div>
										<div>
											<h2 class="text-lg font-black text-slate-900">
												{mode === 'write' ? '새 게시글 작성' : '게시글 수정'}
											</h2>
											<p class="text-xs font-bold text-slate-500">
												{board?.name || boardSlug}
											</p>
										</div>
									</div>
									<a
										href="/v1/app/board/{boardSlug}"
										class="rounded-xl px-3.5 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
									>
										취소
									</a>
								</div>

								<div class="space-y-6">
									<!-- 우측 다이나믹 폼 메타 안내 배너 -->
									<div
										class="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-indigo-200 bg-indigo-50/70 px-4 py-3 text-xs"
									>
										<div class="flex items-center gap-2 font-bold text-indigo-800">
											<Icon icon="ph:magic-wand-bold" class="h-4 w-4 shrink-0 text-indigo-600" />
											<span
												>우측 <strong>Dynamic Form</strong> 패널에서 카테고리·상단고정·배경색·NEW·비밀글·예약게시
												등 메타 정보를 설정할 수 있습니다.</span
											>
										</div>
										<div class="flex flex-wrap items-center gap-1.5">
											{#if activeExtra.category}
												<span
													class="rounded-md bg-white px-2 py-0.5 text-[11px] font-black text-indigo-700"
													>{activeExtra.category}</span
												>
											{/if}
											{#if activeExtra.is_pinned}
												<span
													class="rounded-md bg-amber-500 px-2 py-0.5 text-[11px] font-black text-white"
													>📌 상단고정</span
												>
											{/if}
											{#if activeExtra.is_secret}
												<span
													class="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] font-black text-white"
													>🔒 비밀글</span
												>
											{/if}
										</div>
									</div>

									<div>
										<label
											for="board-title-input"
											class="mb-2 block text-xs font-bold text-slate-700"
										>
											제목 <span class="text-rose-500">*</span>
										</label>
										<input
											id="board-title-input"
											type="text"
											bind:value={editForm.title}
											class="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-bold transition focus:border-blue-600 focus:outline-none"
											placeholder="게시글 제목을 입력하세요"
										/>
									</div>

									<!-- 동적 커스텀 필드 -->
									{#if board?.fields_def && board.fields_def.length > 0}
										<div
											class="grid grid-cols-1 gap-5 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 md:grid-cols-2"
										>
											{#each board.fields_def as field}
												<div>
													<label class="mb-1.5 block text-xs font-bold text-slate-700">
														{field.label}
													</label>
													{#if field.type === 'number'}
														<input
															type="number"
															bind:value={editForm.extra_data[field.key]}
															class="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-bold transition focus:border-blue-600 focus:outline-none"
														/>
													{:else if field.type === 'date'}
														<input
															type="date"
															bind:value={editForm.extra_data[field.key]}
															class="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-bold transition focus:border-blue-600 focus:outline-none"
														/>
													{:else if field.type === 'select'}
														<select
															bind:value={editForm.extra_data[field.key]}
															class="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-bold transition focus:border-blue-600 focus:outline-none"
														>
															<option value="">-- 선택하세요 --</option>
															{#each (field.options_text || '')
																.split(',')
																.map((s) => s.trim()) as opt}
																{#if opt}
																	<option value={opt}>{opt}</option>
																{/if}
															{/each}
														</select>
													{:else}
														<input
															type="text"
															bind:value={editForm.extra_data[field.key]}
															placeholder={field.placeholder || ''}
															class="w-full rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm font-bold transition focus:border-blue-600 focus:outline-none"
														/>
													{/if}
												</div>
											{/each}
										</div>
									{/if}

									<div>
										<span class="mb-2 block text-xs font-bold text-slate-700">
											본문 콘텐츠 (표준 에디터)
										</span>
										<TiptapEditor
											bind:content={editForm.content}
											bind:content_json={editForm.content_json}
											slug={boardSlug}
										/>
									</div>

									<div class="flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
										<a
											href="/v1/app/board/{boardSlug}"
											class="rounded-2xl border-2 border-slate-200 bg-white px-6 py-3 text-xs font-bold text-slate-600 transition hover:bg-slate-50"
										>
											취소
										</a>
										<button
											type="button"
											class="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-3 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
											onclick={handleSave}
											disabled={isLoading}
										>
											{#if isLoading}
												<span class="loading loading-xs loading-spinner"></span>
												<span>저장 중...</span>
											{:else}
												<Icon icon="ph:floppy-disk-back-bold" class="h-4 w-4" />
												<span>{mode === 'write' ? '게시글 등록' : '수정사항 저장'}</span>
											{/if}
										</button>
									</div>
								</div>
							</div>
						</div>
					{/if}
				{/if}
			</main>
		{/if}
	</div>
</div>

<style>
	/* 📱 모바일 세로 모드 + 하단 퀵 내비게이션 바 활성화(< 768px) 구간: 게시판 카드 좌우 여백 0 */
	@media (max-width: 767px) and (orientation: portrait) {
		:global(.board-fullbleed-card) {
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
