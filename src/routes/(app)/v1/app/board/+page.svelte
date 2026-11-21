<script>
	/**
	 * @file (app)/v1/app/board/+page.svelte
	 * @description 게시판 인스턴스 카탈로그 허브 (/v1/app/board)
	 *              표준 대시보드 레이아웃 & 모바일 하단 퀵메뉴 여백(pb-28 md:pb-12) 적용
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin';
	import { toast } from '$lib/runes/toast.svelte';
	import { getSiteTitle } from '$lib/config/site';
	import Icon from '@iconify/svelte';

	let boards = $state(/** @type {any[]} */ ([]));
	let loading = $state(true);
	let searchQuery = $state('');

	async function loadBoards() {
		loading = true;
		try {
			boards = await api.adminGetBoards();
		} catch (e) {
			console.error('게시판 목록 로드 실패:', e);
			toast.error('게시판 목록을 불러오지 못했습니다.');
		} finally {
			loading = false;
		}
	}

	onMount(loadBoards);

	/** @param {string | undefined} layoutType */
	function getLayoutLabel(layoutType) {
		if (layoutType === 'gallery') return '갤러리형';
		if (layoutType === 'blog') return '블로그형';
		return '목록형';
	}

	// 🔍 검색 필터링된 게시판 목록
	const filteredBoards = $derived(
		boards.filter((b) => {
			const q = searchQuery.trim().toLowerCase();
			if (!q) return true;
			return (
				(b.name && b.name.toLowerCase().includes(q)) ||
				(b.slug && b.slug.toLowerCase().includes(q)) ||
				(b.description && b.description.toLowerCase().includes(q))
			);
		})
	);
</script>

<svelte:head>
	<title>{getSiteTitle('게시판 허브')}</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 px-4 py-6 pb-28 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 md:pb-12 lg:px-8">
	<!-- 헤더 섹션 (표준 대시보드 레이아웃) -->
	<header class="flex flex-col justify-between gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:border-b-4 md:pb-8">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-wider text-emerald-400">
					<span class="h-2 w-2 animate-ping rounded-full bg-emerald-400"></span>
					게시판 인스턴스
				</span>
				<span class="text-xs font-bold text-slate-400">총 {filteredBoards.length}건</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 md:text-4xl">
				게시판 <span class="text-blue-600">허브</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				사내에 개설된 전체 게시판을 탐색하고 바로 이동할 수 있습니다.
			</p>
		</div>

		<!-- 검색 및 새로고침 -->
		<div class="flex w-full items-center gap-2.5 md:w-auto">
			<div class="relative flex-1 md:w-72">
				<Icon
					icon="solar:magnifer-bold-duotone"
					class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base text-slate-400"
				/>
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="게시판 이름 또는 슬러그 검색..."
					class="w-full rounded-2xl border-2 border-slate-200 bg-white py-2.5 pr-4 pl-10 text-xs font-bold text-slate-800 transition focus:border-blue-500 focus:outline-none"
				/>
			</div>
			<button
				type="button"
				onclick={loadBoards}
				disabled={loading}
				class="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border-2 border-slate-200 bg-white px-4 py-2.5 text-xs font-black text-slate-700 shadow-xs transition hover:border-slate-400 disabled:opacity-50"
			>
				<Icon icon="ph:arrows-clockwise-bold" class="text-sm {loading ? 'animate-spin' : ''}" />
				<span>새로고침</span>
			</button>
		</div>
	</header>

	<!-- 게시판 카드 그리드 -->
	<main>
		{#if loading}
			<div class="flex h-64 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
				<div class="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
				<p class="text-xs font-bold text-slate-400">게시판 목록을 불러오는 중...</p>
			</div>
		{:else if filteredBoards.length === 0}
			<div class="flex h-64 flex-col items-center justify-center gap-3 rounded-3xl border-2 border-dashed border-slate-200 bg-white p-8 text-center">
				<Icon icon="solar:folder-open-bold-duotone" class="text-5xl text-slate-200" />
				<p class="text-base font-black text-slate-500">
					{searchQuery ? '검색 결과와 일치하는 게시판이 없습니다.' : '등록된 게시판이 없습니다.'}
				</p>
				<a
					href="/v1/admin/board"
					class="mt-1 inline-flex items-center gap-1.5 rounded-2xl bg-slate-900 px-5 py-2.5 text-xs font-black text-white transition hover:bg-blue-600"
				>
					<Icon icon="ph:plus-circle-bold" class="text-sm" />
					<span>게시판 관리로 이동</span>
				</a>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredBoards as b (b.id)}
					<a
						href="/v1/app/board/{b.slug}"
						class="group flex flex-col justify-between rounded-3xl border-2 border-slate-200 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-lg"
					>
						<div>
							<div class="flex items-center justify-between gap-2">
								<span class="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-mono text-[11px] font-black text-blue-700">
									/{b.slug}
								</span>
								<span class="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600">
									{getLayoutLabel(b.layout_type)}
								</span>
							</div>

							<h2 class="mt-4 text-lg font-black tracking-tight text-slate-900 transition-colors group-hover:text-blue-600">
								{b.name}
							</h2>

							<p class="mt-1.5 line-clamp-2 text-xs leading-relaxed font-medium text-slate-500">
								{b.description || '등록된 게시판 설명이 없습니다.'}
							</p>
						</div>

						<div class="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
							<div class="flex items-center gap-1.5">
								<span class="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
									읽기 Lv.{b.min_read_rank ?? 0}
								</span>
								<span class="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
									쓰기 Lv.{b.min_write_rank ?? 2}
								</span>
							</div>
							<span class="inline-flex items-center gap-1 text-xs font-black text-blue-600 transition-transform group-hover:translate-x-0.5">
								<span>진입하기</span>
								<Icon icon="ph:arrow-right-bold" class="text-xs" />
							</span>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</main>
</div>
