<script>
	/**
	 * PageEngine.svelte (v1.0 - 복원 버전)
	 * @description 단일 페이지 컨텐츠를 렌더링하고 관리하는 엔진
	 */
	import { page as pageState } from '$app/state';
	import { onMount, onDestroy } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import { auth } from '$lib/runes/auth.svelte.js';
	import * as api from '$lib/api/page.js';
	import TiptapEditor from '$lib/components/TiptapEditor.svelte';
	import Icon from '@iconify/svelte';

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
		published_at: new Date().toISOString().slice(0, 16),
		expired_at: null,
		redirect_url: ''
	});

	// 권한 체크
	let isAdmin = $derived(auth.rank >= 4);

	// 초기화
	onMount(() => {
		if (page) {
			syncForm();
			// URL 파라미터에 edit=true가 있으면 즉시 편집 모드로 진입
			if (pageState.url.searchParams.get('edit') === 'true') {
				mode = 'edit';
			}
		} else {
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
			published_at: page.published_at ? new Date(page.published_at).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
			expired_at: page.expired_at ? new Date(page.expired_at).toISOString().slice(0, 16) : null,
			redirect_url: page.redirect_url || ''
		};
	}

	async function handleSave() {
		if (!editForm.title || !editForm.slug) {
			alert('제목과 슬러그는 필수입니다.');
			return;
		}

		isLoading = true;
		try {
			if (editForm.id) {
				page = await api.adminUpdatePage(editForm);
				alert('페이지가 성공적으로 수정되었습니다.');
			} else {
				page = await api.adminCreatePage(editForm);
				alert('새 페이지가 생성되었습니다.');
				// 생성 후 해당 슬러그 주소로 이동
				goto(`/v1/custom/page/${page.slug}`, { replaceState: true });
			}
			mode = 'view';
			invalidateAll();
		} catch (e) {
			alert('저장 실패: ' + (e.detail || e.message || '알 수 없는 오류'));
		} finally {
			isLoading = false;
		}
	}

	async function handleDelete() {
		if (!confirm('정말로 이 페이지를 삭제하시겠습니까?')) return;
		try {
			await api.adminDeletePage(page.id);
			alert('삭제되었습니다.');
			goto('/v1/admin/apps/page/instances'); // 목록으로 이동
		} catch (e) {
			alert('삭제 실패: ' + e.detail);
		}
	}

	function toggleEdit() {
		if (mode === 'create') {
			goto('/v1/admin/page');
			return;
		}
		if (mode === 'edit') {
			syncForm();
			mode = 'view';
		} else {
			mode = 'edit';
		}
	}
</script>

<div 
	class="page-engine min-h-screen font-['Outfit'] text-black selection:bg-yellow-200 transition-colors duration-500"
	style:background-color={page?.config?.bgColor || 'white'}
>
	<!-- 🛰️ Floating Control Bar (Admin Only) -->
	{#if isAdmin}
		<div class="fixed top-24 right-8 z-50 flex flex-col gap-3">
			<button
				onclick={toggleEdit}
				class="group flex h-14 w-14 items-center justify-center border-2 border-black bg-white text-black shadow-[4px_4px_0_rgba(0,0,0,1)] transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_rgba(0,0,0,1)]"
				title={mode === 'view' ? 'Edit Content' : 'Cancel Edit'}
			>
				<Icon icon={mode === 'view' ? 'ph:pencil-line-bold' : 'ph:x-bold'} class="h-6 w-6" />
			</button>
			{#if mode === 'edit' || mode === 'create'}
				<button
					onclick={handleSave}
					disabled={isLoading}
					class="group flex h-14 w-14 items-center justify-center border-2 border-black bg-emerald-400 text-black shadow-[4px_4px_0_rgba(0,0,0,1)] transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_rgba(0,0,0,1)]"
				>
					{#if isLoading}
						<span class="loading loading-spinner loading-xs"></span>
					{:else}
						<Icon icon="ph:floppy-disk-back-bold" class="h-6 w-6" />
					{/if}
				</button>
			{/if}
		</div>
	{/if}

	<main class="mx-auto max-w-5xl px-6 py-20 pb-40">
		{#if mode === 'view'}
			<!-- 📄 PAGE VIEW (Body-Focused) -->
			{#if page}
				<article class="animate-fade-in">
					<header class="mb-14 border-b border-white/20 pb-6">
						{#if page.status === 'DRAFT'}
							<span class="mb-3 inline-block bg-black px-2 py-0.5 text-[9px] font-black text-white uppercase italic">DRAFT MODE</span>
						{/if}
						<div class="flex flex-col gap-2">
							<h1 class="text-xs font-bold tracking-[0.2em] uppercase opacity-20">
								{page.title}
							</h1>
							<div class="flex items-center gap-4 text-[9px] font-bold italic opacity-10 uppercase tracking-widest">
								<span class="flex items-center gap-1"><Icon icon="ph:calendar-bold" /> {new Date(page.published_at).toLocaleDateString()}</span>
								<span class="flex items-center gap-1"><Icon icon="ph:eye-bold" /> {page.view_count || 0} views</span>
							</div>
						</div>
					</header>

					{#if page.redirect_url}
						<div class="mb-12 border-4 border-black bg-blue-50 p-8">
							<p class="mb-4 text-sm font-bold italic leading-relaxed text-blue-800">
								이 주소는 현재 외부 링크로 연결되어 있습니다.
							</p>
							<a href={page.redirect_url} target="_blank" class="btn btn-black rounded-none px-10 font-black italic uppercase">
								Open Link <Icon icon="ph:arrow-square-out-bold" />
							</a>
						</div>
					{/if}

					<div class="prose prose-xl max-w-none prose-headings:font-black prose-headings:italic prose-headings:uppercase prose-p:leading-relaxed">
						{@html page.content}
					</div>
				</article>
			{:else}
				<div class="flex h-60 flex-col items-center justify-center gap-4 opacity-20">
					<Icon icon="ph:file-search-bold" class="h-20 w-20" />
					<p class="font-black italic uppercase">Page not found or unauthorized</p>
				</div>
			{/if}
		{:else}
			<!-- ✍️ PAGE EDIT / CREATE -->
			<div class="animate-fade-in space-y-12">
				<div class="border-b-4 border-black pb-8">
					<h2 class="text-4xl font-black tracking-tighter uppercase italic">
						Page <span class="text-blue-600">Constructor</span>
					</h2>
				</div>

				<div class="space-y-10">
					<!-- Title -->
					<div class="space-y-3">
						<label class="text-[10px] font-black tracking-widest uppercase opacity-30">Identity Header</label>
						<input
							type="text"
							bind:value={editForm.title}
							class="h-24 w-full border-4 border-black bg-white px-8 text-4xl font-black uppercase italic transition-all focus:ring-8 focus:ring-blue-100 focus:outline-none"
							placeholder="ENTER PAGE TITLE..."
						/>
					</div>

					<!-- Slug & Redirect -->
					<div class="grid grid-cols-1 gap-10 md:grid-cols-2">
						<div class="space-y-3">
							<label class="text-[10px] font-black tracking-widest uppercase opacity-30">Slug (URL Path)</label>
							<div class="flex items-center border-4 border-black bg-[#eee]">
								<span class="px-4 font-black italic opacity-30">/v1/page/</span>
								<input type="text" bind:value={editForm.slug} class="h-14 flex-1 bg-white px-4 font-black text-blue-600 focus:outline-none" placeholder="about-us" />
							</div>
						</div>
						<div class="space-y-3">
							<label class="text-[10px] font-black tracking-widest uppercase opacity-30">Redirect URL (Optional)</label>
							<input type="text" bind:value={editForm.redirect_url} class="h-16 w-full border-4 border-black px-6 font-bold focus:outline-none" placeholder="https://..." />
						</div>
					</div>

					<!-- Status & Timing -->
					<div class="grid grid-cols-1 gap-10 border-y-2 border-black/5 py-10 md:grid-cols-3">
						<div class="space-y-3">
							<label class="text-[10px] font-black tracking-widest uppercase opacity-30">Publication Status</label>
							<select bind:value={editForm.status} class="h-16 w-full appearance-none border-4 border-black bg-white px-6 font-black uppercase italic">
								<option value="DRAFT">DRAFT (Hidden)</option>
								<option value="PUBLISHED">PUBLISHED (Live)</option>
							</select>
						</div>
						<div class="space-y-3">
							<label class="text-[10px] font-black tracking-widest uppercase opacity-30">Release Date</label>
							<input type="datetime-local" bind:value={editForm.published_at} class="h-16 w-full border-4 border-black px-6 font-black" />
						</div>
						<div class="space-y-3">
							<label class="text-[10px] font-black tracking-widest uppercase opacity-30">Security Rank</label>
							<input type="number" bind:value={editForm.min_rank} class="h-16 w-full border-4 border-black px-6 text-center font-black" min="0" max="10" />
						</div>
					</div>

					<!-- Content Editor -->
					<div class="space-y-3">
						<label class="text-[10px] font-black tracking-widest uppercase opacity-30">Core Content Body</label>
						<div class="min-h-[600px] border-4 border-black bg-white">
							<TiptapEditor bind:content={editForm.content} bind:content_json={editForm.content_json} />
						</div>
					</div>
				</div>

				<div class="flex justify-end gap-6 pt-10">
					<button onclick={toggleEdit} class="h-20 border-2 border-black px-12 text-sm font-black uppercase italic opacity-40 hover:opacity-100">
						Discard Changes
					</button>
					<button 
						onclick={handleSave} 
						disabled={isLoading}
						class="flex h-20 flex-1 items-center justify-center gap-4 border-4 border-black bg-black text-xl font-black tracking-[0.2em] text-white uppercase transition-all hover:bg-white hover:text-black"
					>
						{#if isLoading}
							<span class="loading loading-lg loading-spinner"></span> Deploying...
						{:else}
							<Icon icon="ph:paper-plane-tilt-bold" class="h-8 w-8" /> Commit Page
						{/if}
					</button>
				</div>
			</div>
		{/if}
	</main>
</div>

<style>
	:global(.prose img) {
		border: 4px solid black;
		margin: 2rem 0;
	}
	:global(.prose blockquote) {
		border-left: 8px solid black;
		font-style: italic;
		font-weight: 900;
		background: #f0f0f0;
		padding: 2rem;
	}
</style>
