<script>
	/**
	 * @file (app)/v1/admin/services/binding/+page.svelte
	 * @description 앱 인스턴스(게시판 등)와 서비스 번들(Instance)을 연결하는 매핑 페이지
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import Icon from '@iconify/svelte';
	import { fade, fly } from 'svelte/transition';

	let boards = $state([]);
	let serviceInstances = $state([]);
	let loading = $state(true);

	async function loadData() {
		loading = true;
		try {
			const [b, i] = await Promise.all([
				api.adminGetBoards(),
				api.adminGetServiceInstances()
			]);
			boards = b;
			serviceInstances = i;
		} catch (err) {
			alertState.send(err.message, { level: 3, style: 'error' });
		} finally {
			loading = false;
		}
	}

	onMount(loadData);

	async function updateBinding(boardId, instanceId) {
		try {
			// 기존 보드 정보를 찾아서 service_instance_id만 업데이트
			const board = boards.find(b => b.id === boardId);
			if (!board) return;

			await api.adminUpdateBoard(boardId, {
				...board,
				service_instance_id: instanceId ? Number(instanceId) : null
			});
			
			alertState.send('서비스 바인딩이 업데이트되었습니다.', { style: 'success' });
			loadData();
		} catch (err) {
			alertState.send(err.message, { level: 3, style: 'error' });
		}
	}
</script>

<div class="mx-auto max-w-5xl space-y-8 px-4 pb-20 font-['Outfit'] md:px-8">
	<!-- Header -->
	<header class="flex flex-col items-start justify-between gap-6 border-b-4 border-black pb-8 md:flex-row md:items-end">
		<div>
			<span class="mb-2 block text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase">Step 2: Connect</span>
			<h1 class="text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-6xl">
				서비스 <span class="NOT-ITALIC text-blue-600">바인딩</span>
			</h1>
			<p class="mt-4 text-sm font-bold text-slate-500">
				인스턴스 앱(게시판)에 어떤 서비스 묶음(Bundle)을 탑재할지 결정합니다.
			</p>
		</div>
		<a href="/v1/admin/services" class="btn h-12 rounded-xl border-2 border-slate-200 px-6 font-black text-slate-600 hover:bg-slate-50">
			← 서비스 마스터로 이동
		</a>
	</header>

	{#if loading}
		<div class="flex h-64 items-center justify-center">
			<div class="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-4">
			{#each boards as board}
				<div in:fly={{ y: 10 }} class="flex flex-col items-center justify-between gap-4 rounded-3xl border-2 border-slate-100 bg-white p-6 shadow-sm hover:border-blue-200 md:flex-row md:p-8">
					<div class="flex items-center gap-6">
						<div class="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-50 text-slate-400">
							<Icon icon="ph:layout-bold" class="text-2xl" />
						</div>
						<div>
							<div class="flex items-center gap-2">
								<h3 class="text-xl font-black">{board.name}</h3>
								<span class="rounded bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase text-slate-500">Board</span>
							</div>
							<p class="text-xs font-bold text-slate-400 uppercase tracking-tighter italic">Slug: {board.slug}</p>
						</div>
					</div>

					<div class="flex w-full items-center gap-3 md:w-auto">
						<Icon icon="ph:link-bold" class="hidden text-slate-200 md:block" />
						<select 
							value={board.service_instance_id || ''} 
							onchange={(e) => updateBinding(board.id, e.target.value)}
							class="h-14 w-full rounded-2xl border-2 border-slate-100 bg-slate-50 px-6 font-black text-slate-900 focus:border-blue-600 focus:outline-none md:w-64"
						>
							<option value="">서비스 없음 (Clean)</option>
							{#each serviceInstances as inst}
								<option value={inst.id}>
									{inst.name} ({inst.service_app_ids?.length || 0} Apps)
								</option>
							{/each}
						</select>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<footer class="mt-12 rounded-3xl bg-blue-50 p-10">
		<div class="flex gap-4">
			<div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
				<Icon icon="ph:info-bold" class="text-xl" />
			</div>
			<div>
				<h4 class="text-lg font-black text-blue-900">도움말: 바인딩 원리</h4>
				<p class="mt-2 text-sm font-bold leading-relaxed text-blue-800 opacity-70">
					게시판에 서비스 번들을 연결하면, 해당 게시판의 모든 게시물 하단에 지정된 서비스들이 차례대로 조립되어 나타납니다. 
					번들을 변경하면 실시간으로 정합성이 유지되며, '서비스 없음' 선택 시 기본 기능만 작동합니다.
				</p>
			</div>
		</div>
	</footer>
</div>

<style>
	:global(body) { background-color: #fcfcfc; }
</style>
