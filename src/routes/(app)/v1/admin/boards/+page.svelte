<script>
	/**
	 * @file (app)/v1/admin/boards/+page.svelte
	 * @description 게시판 인스턴스(공지, 자유 등) 통합 관리자
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { fade } from 'svelte/transition';

	let boards = $state([]);
	let loading = $state(true);
	let editingBoard = $state({
		id: null,
		slug: '',
		name: '',
		description: '',
		layout_type: 'list',
		items_per_page: 10
	});

	async function loadBoards() {
		loading = true;
		try {
			boards = await api.adminGetBoards();
		} catch (e) {
			alertState.send(e.message, { level: 3, style: 'error' });
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

	async function handleSave() {
		if (!editingBoard.slug || !editingBoard.name) {
			alertState.send('슬러그와 이름은 필수입니다.', { level: 2, style: 'warning' });
			return;
		}
		try {
			if (!editingBoard.id) {
				await api.adminCreateBoard(editingBoard);
				alertState.send(`[${editingBoard.name}] 게시판이 생성되었습니다.`, {
					level: 1,
					style: 'success'
				});
			} else {
				await api.adminUpdateBoard(editingBoard.id, editingBoard);
				alertState.send('게시판 설정이 업데이트되었습니다.', { level: 1, style: 'success' });
			}
			resetForm();
			await loadBoards();
		} catch (e) {
			alertState.send(e.message, { level: 3, style: 'error' });
		}
	}

	function startEdit(b) {
		editingBoard = { ...b };
	}
</script>

<div
	class="animate-fade-in mx-auto max-w-7xl space-y-10 px-4 pb-40 font-['Noto_Sans_KR'] text-black"
>
	<!-- 📄 헤더 -->
	<div class="flex items-end justify-between border-b-4 border-black pb-8">
		<div>
			<span class="mb-2 block text-[10px] font-black tracking-[0.4em] uppercase opacity-30"
				>Board Cluster Registry</span
			>
			<h1 class="text-5xl font-black tracking-tighter uppercase italic">
				게시판 <span class="NOT-ITALIC text-blue-600">마스터</span>
			</h1>
			<p class="mt-3 text-xs font-bold opacity-40">
				공지사항, 자유게시판 등 시스템에서 가동할 실제 게시판들을 설계합니다.
			</p>
		</div>
		<div class="flex gap-4">
			<a href="/v1/admin" class="btn h-14 rounded-none border-black px-8 font-black btn-outline"
				>← 대시보드</a
			>
			<button class="btn-black btn h-14 rounded-none px-10 font-black" onclick={loadBoards}
				>목록 갱신</button
			>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-10 lg:grid-cols-12">
		<!-- 📑 등록된 게시판 목록 -->
		<div class="space-y-4 lg:col-span-5">
			<h3 class="mb-6 border-b-2 border-black pb-2 text-xl font-black italic">활성 게시판 목록</h3>

			{#if loading}
				<div
					class="flex h-60 items-center justify-center border border-dashed border-black font-black uppercase italic opacity-10 grayscale"
				>
					엔진 스캔 중...
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-4">
					{#each boards as b}
						<button
							class="group flex items-center justify-between border-2 border-black bg-white p-6 text-left transition-all hover:bg-slate-50 {editingBoard.id ===
							b.id
								? 'border-blue-600 ring-2 ring-blue-600'
								: ''}"
							onclick={() => startEdit(b)}
						>
							<div>
								<div class="mb-1 text-[9px] font-black tracking-widest uppercase italic opacity-30">
									/{b.slug}
								</div>
								<h4 class="text-xl font-black tracking-tight">{b.name}</h4>
								<p class="mt-1 text-[10px] font-bold opacity-40">
									{b.description || '설명이 없습니다.'}
								</p>
							</div>
							<span
								class="font-black text-blue-600 opacity-0 transition-opacity group-hover:opacity-100"
								>EDIT →</span
							>
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- 📝 생성/수정 폼 -->
		<div class="lg:col-span-7">
			<div
				class="sticky top-24 border-2 border-black bg-white p-10 shadow-[15px_15px_0_rgba(0,0,0,0.05)]"
			>
				<div class="mb-10 flex items-baseline justify-between border-b-2 border-black pb-4">
					<h3 class="text-3xl font-black italic">
						{editingBoard.id ? '게시판 엔진 수정' : '새 게시판 엔진 개발'}
					</h3>
					<span class="text-[9px] font-black tracking-widest uppercase italic opacity-40"
						>Type: Board_v1.2</span
					>
				</div>

				<div class="mb-8 grid grid-cols-1 gap-8 md:grid-cols-2">
					<div class="space-y-2">
						<label class="text-[10px] font-black tracking-widest uppercase opacity-30"
							>게시판 주소 (Slug / ID)</label
						>
						<input
							type="text"
							bind:value={editingBoard.slug}
							class="h-14 w-full border border-black bg-slate-50 px-5 font-black text-blue-600 transition-all focus:bg-white focus:outline-none"
							placeholder="예: notice, free, gallery"
						/>
					</div>
					<div class="space-y-2">
						<label class="text-[10px] font-black tracking-widest uppercase opacity-30"
							>게시판 이름</label
						>
						<input
							type="text"
							bind:value={editingBoard.name}
							class="h-14 w-full border border-black bg-slate-50 px-5 font-black transition-all focus:bg-white focus:outline-none"
							placeholder="예: 공지사항"
						/>
					</div>
				</div>

				<div class="space-y-8">
					<div class="space-y-2">
						<label class="text-[10px] font-black tracking-widest uppercase opacity-30"
							>게시판 설명</label
						>
						<input
							type="text"
							bind:value={editingBoard.description}
							class="h-14 w-full border border-black bg-white px-5 font-bold transition-all focus:outline-none"
							placeholder="사용자에게 보여줄 짧은 설명"
						/>
					</div>

					<div class="grid grid-cols-2 gap-8">
						<div class="space-y-2">
							<label class="text-[10px] font-black tracking-widest uppercase opacity-30"
								>레이아웃 스타일</label
							>
							<select
								bind:value={editingBoard.layout_type}
								class="h-14 w-full border border-black bg-slate-50 px-4 text-sm font-black"
							>
								<option value="list">리스트형 (표준)</option>
								<option value="gallery">갤러리형 (이미지 위주)</option>
								<option value="blog">블로그형 (본문 요약)</option>
							</select>
						</div>
						<div class="space-y-2">
							<label class="text-[10px] font-black tracking-widest uppercase opacity-30"
								>페이지당 게시물 수</label
							>
							<input
								type="number"
								bind:value={editingBoard.items_per_page}
								class="h-14 w-full border border-black bg-white px-5 font-black"
							/>
						</div>
					</div>

					<div class="flex gap-4 pt-8">
						<button
							class="h-20 flex-1 border-2 border-black bg-black text-xl font-black tracking-widest text-white uppercase transition-all hover:bg-white hover:text-black"
							onclick={handleSave}
						>
							{editingBoard.id ? '게시판 설정 저장' : '게시판 신규 생성'}
						</button>
						<button
							class="h-20 w-24 border-2 border-black text-[10px] font-black uppercase transition-all hover:bg-slate-100"
							onclick={resetForm}>초기화</button
						>
					</div>

					<div
						class="mt-6 border border-blue-200 bg-blue-50 p-4 text-[10px] leading-relaxed font-bold text-blue-600 italic"
					>
						* 게시판을 생성한 후 [메뉴 마스터]로 이동하여 이 게시판을 하위 메뉴로 등록하면 최종
						노출됩니다.
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
