<script>
	/**
	 * @file (app)/v1/app/boards/+page.svelte
	 * @description 복수형 게시판 인스턴스 카탈로그 허브 (/v1/app/boards)
	 *              시스템에 개설된 모든 게시판 인스턴스 목록을 탐색하고 개별 게시판(/v1/app/board/[slug])으로 진입합니다.
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin';
	import { toast } from '$lib/runes/toast.svelte';
	import Icon from '@iconify/svelte';

	let boards = $state([]);
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
	<title>게시판 클러스터 허브 | jeju.live</title>
</svelte:head>

<div class="animate-fade-in mx-auto max-w-7xl space-y-12 px-4 py-8 pb-40 font-['Outfit','Noto_Sans_KR'] text-black">
	<!-- 🏷️ Header -->
	<header class="flex flex-col items-start justify-between gap-6 border-b-4 border-black pb-8 md:flex-row md:items-end">
		<div>
			<div class="flex items-center gap-2 mb-2">
				<span class="badge border-none bg-blue-600 text-white rounded-none px-2 py-0.5 text-[10px] font-black uppercase">
					INSTANCE HUB
				</span>
				<span class="text-[10px] font-black tracking-[0.3em] uppercase opacity-40">
					Cluster v2.0
				</span>
			</div>
			<h1 class="text-5xl font-black tracking-tighter uppercase italic">
				게시판 <span class="NOT-ITALIC text-blue-600">클러스터</span>
			</h1>
			<p class="mt-3 text-xs font-bold opacity-50">
				사내에 개설된 모든 게시판 인스턴스를 탐색하고 바로 진입할 수 있는 통합 허브입니다.
			</p>
		</div>

		<!-- 🔍 검색창 -->
		<div class="flex w-full items-center gap-3 md:w-auto">
			<div class="relative flex-1 md:w-80">
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="게시판 이름 또는 슬러그 검색..."
					class="h-14 w-full border-2 border-black bg-white px-4 pr-10 text-xs font-bold transition-all focus:ring-4 focus:ring-blue-100 focus:outline-none"
				/>
				<Icon
					icon="ph:magnifying-glass-bold"
					class="pointer-events-none absolute top-1/2 right-3 h-5 w-5 -translate-y-1/2 opacity-30"
				/>
			</div>
			<button
				class="btn h-14 rounded-none border-2 border-black bg-black px-6 text-xs font-black uppercase text-white hover:bg-blue-600"
				onclick={loadBoards}
			>
				새로고침
			</button>
		</div>
	</header>

	<!-- 📦 게시판 카드 그리드 -->
	<main>
		{#if loading}
			<div class="flex h-80 flex-col items-center justify-center gap-4 border-4 border-dashed border-black opacity-20 grayscale">
				<div class="h-12 w-12 animate-spin rounded-full border-4 border-black border-t-blue-600"></div>
				<p class="font-black tracking-widest uppercase italic">게시판 인스턴스 탐색 중...</p>
			</div>
		{:else if filteredBoards.length === 0}
			<div class="flex h-80 flex-col items-center justify-center gap-4 border-4 border-dashed border-black opacity-30">
				<Icon icon="ph:folder-dashed-bold" class="h-16 w-16" />
				<p class="text-sm font-black uppercase italic">
					{searchQuery ? '일치하는 게시판이 없습니다.' : '등록된 게시판 인스턴스가 없습니다.'}
				</p>
				<a
					href="/v1/admin/boards"
					class="border-2 border-black bg-black px-6 py-2.5 text-xs font-black uppercase text-white hover:bg-blue-600"
				>
					+ 게시판 인스턴스 생성하러 가기
				</a>
			</div>
		{:else}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredBoards as b (b.id)}
					<a
						href="/v1/app/board/{b.slug}"
						class="group relative flex flex-col justify-between border-4 border-black bg-white p-8 transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[12px_12px_0_rgba(37,99,235,1)]"
					>
						<div>
							<!-- 카드 헤더 -->
							<div class="mb-4 flex items-center justify-between">
								<span class="rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-black text-slate-700">
									/{b.slug}
								</span>
								<span class="badge border-none bg-blue-50 text-blue-700 font-mono text-[9px] font-black uppercase">
									{b.layout_type || 'list'} view
								</span>
							</div>

							<!-- 게시판 제목 -->
							<h3 class="mb-2 text-2xl font-black tracking-tight uppercase group-hover:text-blue-600 transition-colors">
								{b.name}
							</h3>

							<!-- 설명 -->
							<p class="mb-6 line-clamp-2 text-xs leading-relaxed font-bold opacity-50">
								{b.description || '등록된 게시판 설명이 없습니다.'}
							</p>
						</div>

						<!-- 카드 푸터 -->
						<div class="border-t-2 border-black/5 pt-4">
							<div class="flex items-center justify-between text-[10px] font-bold">
								<div class="flex gap-2">
									<span class="badge h-4 rounded-none border border-slate-300 bg-white px-1 text-[8px] font-black">
										읽기 R{b.min_read_rank ?? 0}
									</span>
									<span class="badge h-4 rounded-none border border-slate-300 bg-white px-1 text-[8px] font-black">
										쓰기 R{b.min_write_rank ?? 2}
									</span>
								</div>
								<span class="flex items-center gap-1 font-black text-blue-600 group-hover:underline">
									진입하기
									<Icon icon="ph:arrow-right-bold" class="h-3 w-3" />
								</span>
							</div>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</main>
</div>
