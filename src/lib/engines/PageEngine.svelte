<script>
	/**
	 * PageEngine.svelte (v1.0 - 복원 버전)
	 * @description 단일 페이지 컨텐츠를 렌더링하고 관리하는 엔진
	 */
	import { page as pageState } from '$app/state';
	import { onMount, onDestroy } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatDate, toLocalISOString } from '$lib/utils';
	import { formatApiError } from '$lib/utils/error';
	import * as api from '$lib/api/page';
	import TiptapEditor from '$lib/components/TiptapEditor.svelte';
	import SafeHtml from '$lib/components/SafeHtml.svelte';
	import Icon from '@iconify/svelte';

	const auth = getAuthContext();

	let { data = {} } = $props();

	// 상태 관리
	let page = $state(data.page || null);
	let mode = $state('view'); // view | edit | create
	let isLoading = $state(false);
	let error = $state(null);

	// 편집 폼 데이터
	let editForm = $state({
		id: null,
		slug: '',
		title: '',
		content: '',
		content_json: null,
		status: 'PUBLISHED',
		is_active: true,
		min_rank: 0,
		published_at: toLocalISOString(),
		expired_at: null,
		redirect_url: ''
	});

	// 권한 체크
	let isAdmin = $derived((auth.user?.rank_level ?? 0) >= 4);

	// 초기화
	onMount(() => {
		if (page) {
			syncForm();
			// URL 파라미터에 edit=true가 있으면 관리자만 편집 모드로 진입
			if (pageState.url.searchParams.get('edit') === 'true' && isAdmin) {
				mode = 'edit';
			}
		} else if (isAdmin) {
			mode = 'create';
		}
	});

	function syncForm() {
		if (!page) return;
		editForm = {
			id: page.id,
			slug: page.slug,
			title: page.title,
			content: page.content || '',
			content_json: page.content_json,
			status: page.status || 'PUBLISHED',
			is_active: page.is_active ?? true,
			min_rank: page.min_rank || 0,
			published_at: page.published_at ? toLocalISOString(page.published_at) : toLocalISOString(),
			expired_at: page.expired_at ? toLocalISOString(page.expired_at) : null,
			redirect_url: page.redirect_url || ''
		};
	}

	async function handleSave() {
		if (!editForm.title || !editForm.slug) {
			toast.warning('제목과 슬러그는 필수입니다.');
			return;
		}

		isLoading = true;
		try {
			if (editForm.id) {
				page = await api.adminUpdatePage(editForm);
				toast.success('페이지가 성공적으로 수정되었습니다.');
			} else {
				page = await api.adminCreatePage(editForm);
				toast.success('새 페이지가 생성되었습니다.');
			}
			mode = 'view';
			await invalidateAll();
			await goto(`/v1/custom/page/${page.slug}`, { replaceState: true });
		} catch (e) {
			toast.error('저장 실패: ' + formatApiError(e));
		} finally {
			isLoading = false;
		}
	}

	async function handleDelete() {
		if (!confirm('정말로 이 페이지를 삭제하시겠습니까?')) return;
		try {
			await api.adminDeletePage(page.id);
			toast.success('삭제되었습니다.');
			goto('/v1/admin/apps/page/instances'); // 목록으로 이동
		} catch (e) {
			toast.error('삭제 실패: ' + formatApiError(e, '오류'));
		}
	}

	function toggleEdit() {
		if (!isAdmin) return;
		if (mode === 'create') {
			goto('/v1/admin/page');
			return;
		}
		if (mode === 'edit') {
			syncForm();
			mode = 'view';
			if (pageState.url.searchParams.get('edit') === 'true' && page?.slug) {
				goto(`/v1/custom/page/${page.slug}`, { replaceState: true });
			}
		} else {
			mode = 'edit';
		}
	}
</script>

<div 
	class="page-engine min-h-screen text-slate-900 selection:bg-blue-100 transition-colors duration-300 {mode !== 'view' ? 'bg-slate-50' : ''}"
	style:background-color={mode === 'view' ? (page?.config?.bgColor || 'white') : undefined}
>
	<!-- 🛰️ Floating Control Bar (Admin Only) -->
	{#if isAdmin}
		<div class="fixed top-24 right-6 z-50 flex flex-col gap-2.5">
			<button
				onclick={toggleEdit}
				class="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-slate-200 bg-white/95 text-slate-700 shadow-md backdrop-blur-sm transition hover:border-slate-400 hover:text-slate-900"
				title={mode === 'view' ? '편집하기' : '편집 취소'}
			>
				<Icon icon={mode === 'view' ? 'ph:pencil-line-bold' : 'ph:x-bold'} class="h-5 w-5" />
			</button>
			{#if mode === 'edit' || mode === 'create'}
				<button
					onclick={handleSave}
					disabled={isLoading}
					title="저장하기"
					class="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-md transition hover:bg-blue-700 disabled:opacity-50"
				>
					{#if isLoading}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<Icon icon="ph:floppy-disk-back-bold" class="h-5 w-5" />
					{/if}
				</button>
			{/if}
		</div>
	{/if}

	<main class="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 pb-28">
		{#if mode === 'view'}
			<!-- 📄 PAGE VIEW (Body-Focused) -->
			{#if page}
				<article class="animate-fade-in">
					<header class="mb-10 border-b border-slate-200 pb-6">
						{#if page.status === 'DRAFT'}
							<span class="mb-3 inline-block rounded-lg bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">임시 저장 (DRAFT)</span>
						{/if}
						<div class="flex flex-col gap-2">
							<h1 class="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
								{page.title}
							</h1>
							<div class="flex items-center gap-4 text-xs font-bold text-slate-400">
								<span class="flex items-center gap-1"><Icon icon="ph:calendar-bold" /> {formatDate(page.published_at)}</span>
								<span class="flex items-center gap-1"><Icon icon="ph:eye-bold" /> {page.view_count || 0} views</span>
							</div>
						</div>
					</header>

					{#if page.redirect_url}
						<div class="mb-10 rounded-2xl border-2 border-blue-200 bg-blue-50 p-6">
							<p class="mb-4 text-sm font-bold leading-relaxed text-blue-800">
								이 주소는 현재 외부 링크로 연결되어 있습니다.
							</p>
							<a href={page.redirect_url} target="_blank" class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-black text-white hover:bg-blue-700 transition">
								링크 열기 <Icon icon="ph:arrow-square-out-bold" />
							</a>
						</div>
					{/if}

					<SafeHtml
						html={page.content}
						class="prose prose-slate max-w-none prose-headings:font-bold prose-p:leading-relaxed"
					/>
				</article>
			{:else}
				<div class="flex h-60 flex-col items-center justify-center gap-4 text-slate-400">
					<Icon icon="ph:file-search-bold" class="h-16 w-16" />
					<p class="text-sm font-bold">페이지를 찾을 수 없거나 접근 권한이 없습니다.</p>
				</div>
			{/if}
		{:else}
			<!-- ✍️ PAGE EDIT / CREATE (Admin 스타일 통일) -->
			<div class="page-engine-card rounded-3xl border-2 border-slate-200 bg-white p-6 sm:p-8 shadow-sm">
				<div class="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
					<div class="flex items-center gap-3">
						<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
							<Icon icon="ph:pencil-simple-line-bold" class="text-2xl" />
						</div>
						<div>
							<h2 class="text-xl font-black text-slate-900">
								{mode === 'create' ? '새 페이지 작성' : '페이지 편집'}
							</h2>
							<p class="text-xs font-bold text-slate-500">
								페이지 메타데이터와 Tiptap 본문 콘텐츠를 수정합니다.
							</p>
						</div>
					</div>
					<div class="flex items-center gap-2">
						<a
							href="/v1/admin/page"
							class="rounded-xl border-2 border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-600 hover:border-slate-300 hover:text-slate-900 transition"
						>
							관리자 목록
						</a>
						<button
							type="button"
							onclick={toggleEdit}
							class="rounded-xl px-3.5 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
						>
							취소
						</button>
					</div>
				</div>

				<div class="space-y-6">
					<!-- 제목 & 슬러그 -->
					<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
						<div>
							<label for="edit-title-input" class="block text-xs font-bold text-slate-700 mb-2">
								페이지 제목 <span class="text-rose-500">*</span>
							</label>
							<input
								id="edit-title-input"
								type="text"
								bind:value={editForm.title}
								class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-sm font-bold focus:border-blue-600 focus:outline-none transition"
								placeholder="페이지 제목을 입력하세요"
							/>
						</div>

						<div>
							<label for="edit-slug-input" class="block text-xs font-bold text-slate-700 mb-2">
								URL 경로 (Slug) <span class="text-rose-500">*</span>
							</label>
							<div class="flex items-center">
								<span class="px-3 py-3 rounded-l-2xl border-2 border-r-0 border-slate-200 bg-slate-50 text-xs font-mono font-bold text-slate-400">
									/v1/custom/page/
								</span>
								<input
									id="edit-slug-input"
									type="text"
									bind:value={editForm.slug}
									class="w-full px-4 py-3 rounded-r-2xl border-2 border-slate-200 text-sm font-mono font-bold focus:border-blue-600 focus:outline-none transition"
									placeholder="about-us"
								/>
							</div>
						</div>
					</div>

					<!-- 상태, 게시일, 접근 권한, 리다이렉트 -->
					<div class="grid grid-cols-1 md:grid-cols-4 gap-5">
						<div>
							<label for="edit-status-select" class="block text-xs font-bold text-slate-700 mb-2">게시 상태</label>
							<select
								id="edit-status-select"
								bind:value={editForm.status}
								class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold focus:border-blue-600 focus:outline-none bg-white transition"
							>
								<option value="PUBLISHED">게시 중 (PUBLISHED)</option>
								<option value="DRAFT">임시 저장 (DRAFT)</option>
							</select>
						</div>

						<div>
							<label for="edit-published-input" class="block text-xs font-bold text-slate-700 mb-2">게시 일시</label>
							<input
								id="edit-published-input"
								type="datetime-local"
								bind:value={editForm.published_at}
								class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold focus:border-blue-600 focus:outline-none transition"
							/>
						</div>

						<div>
							<label for="edit-rank-input" class="block text-xs font-bold text-slate-700 mb-2">최소 등급 (Rank)</label>
							<input
								id="edit-rank-input"
								type="number"
								bind:value={editForm.min_rank}
								min="0"
								max="10"
								class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold focus:border-blue-600 focus:outline-none transition"
							/>
						</div>

						<div>
							<label for="edit-redirect-input" class="block text-xs font-bold text-slate-700 mb-2">리다이렉트 URL (선택)</label>
							<input
								id="edit-redirect-input"
								type="text"
								bind:value={editForm.redirect_url}
								class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-mono font-bold focus:border-blue-600 focus:outline-none transition"
								placeholder="https://..."
							/>
						</div>
					</div>

					<!-- Content Editor -->
					<div>
						<span class="block text-xs font-bold text-slate-700 mb-2">본문 콘텐츠 (Tiptap 에디터)</span>
						<TiptapEditor bind:content={editForm.content} bind:content_json={editForm.content_json} />
					</div>
				</div>

				<div class="mt-8 flex items-center justify-end gap-3 border-t border-slate-100 pt-6">
					<button
						type="button"
						onclick={toggleEdit}
						class="rounded-2xl border-2 border-slate-200 bg-white px-6 py-3 text-xs font-bold text-slate-600 hover:border-slate-300 hover:bg-slate-50 transition"
					>
						취소
					</button>
					<button
						type="button"
						onclick={handleSave}
						disabled={isLoading}
						class="inline-flex items-center gap-2 rounded-2xl bg-blue-600 px-8 py-3 text-sm font-black text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-50"
					>
						{#if isLoading}
							<span class="loading loading-spinner loading-xs"></span>
							<span>저장 중...</span>
						{:else}
							<Icon icon="ph:floppy-disk-back-bold" class="text-base" />
							<span>변경사항 저장</span>
						{/if}
					</button>
				</div>
			</div>
		{/if}
	</main>
</div>

<style>
	:global(.page-engine .prose img) {
		border-radius: 0.75rem;
		border: 1px solid #e2e8f0;
		margin: 1.5rem 0;
	}
	:global(.page-engine .prose blockquote) {
		border-left: 3px solid #3b82f6;
		background: #f8fafc;
		padding: 0.75rem 1rem;
		border-radius: 0 0.5rem 0.5rem 0;
	}

	/* 📱 모바일 세로 모드 + 하단 퀵 내비게이션 바 활성화(< 768px) 구간: 페이지 편집 카드 좌우 여백 0 */
	@media (max-width: 767px) and (orientation: portrait) {
		.page-engine-card {
			width: 100vw;
			max-width: 100vw;
			margin-left: calc(50% - 50vw);
			margin-right: calc(50% - 50vw);
			border-left-width: 0;
			border-right-width: 0;
			border-radius: 0;
			box-shadow: none;
			padding-left: 0.75rem;
			padding-right: 0.75rem;
		}
	}
</style>
