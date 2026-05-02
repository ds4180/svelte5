<script>
	/**
	 * @file (app)/v1/admin/apps/[appId]/instances/+page.svelte
	 * @description 특정 앱 엔진의 인스턴스(게시판 등) 목록 관리
	 */
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import Icon from '@iconify/svelte';

	const appId = $derived(page.params.appId);

	let instances = $state([]);
	let loading = $state(true);
	let appInfo = $state(null);

	async function loadData() {
		loading = true;
		try {
			// 1. 앱 정보 로드
			appInfo = await api.adminGetAppDetail(appId);

			// 2. 인스턴스 목록 로드
			if (appId === 'board') {
				instances = await api.adminGetBoards();
			} else if (appId === 'page') {
				// 페이지 엔진의 경우 '페이지' 목록을 인스턴스처럼 취급하여 로드
				// admin.js 에 adminGetPages 가 없다면 대비하여 api 객체 확인 필요
				if (api.adminGetPages) {
					instances = await api.adminGetPages();
				} else {
					// page.js 에서 가져오는 로직 (추후 admin.js 통합 권장)
					const pageApi = await import('$lib/api/page.js');
					instances = await pageApi.adminGetPages();
				}
			} else {
				instances = [];
			}
		} catch (e) {
			alertState.send(e.message, { level: 3, style: 'error' });
		} finally {
			loading = false;
		}
	}

	onMount(loadData);
</script>

<div class="animate-fade-in mx-auto max-w-7xl space-y-10 px-4 pb-40 font-['Outfit'] text-black">
	<!-- 📄 Header -->
	<div
		class="flex flex-col items-start justify-between gap-6 border-b-4 border-black pb-8 md:flex-row md:items-end"
	>
		<div>
			<div class="mb-2 flex items-center gap-3">
				<a
					href="/v1/admin/apps"
					class="group btn rounded-none border-black px-2 text-[9px] font-black tracking-widest uppercase btn-outline btn-xs"
				>
					<span class="transition-transform group-hover:-translate-x-1">←</span> Back to Registry
				</a>
				<span class="text-[10px] font-black tracking-[0.4em] uppercase opacity-30"
					>Instance Cluster</span
				>
			</div>
			<h1 class="line-clamp-1 text-5xl font-black tracking-tighter uppercase italic">
				{appInfo?.title || appId} <span class="NOT-ITALIC text-emerald-600">Instances</span>
			</h1>
			<p class="mt-3 text-xs font-bold italic opacity-40">
				{appInfo?.description || '이 엔진을 사용하는 활성 인스턴스 목록입니다.'}
			</p>
		</div>
		<div class="flex gap-4">
			<a
				href="/v1/admin/apps/{appId}/instances/create"
				class="btn-black btn h-14 rounded-none border-2 border-black px-8 font-black uppercase transition-all"
			>
				+ New Instance
			</a>
		</div>
	</div>

	{#if loading}
		<div
			class="flex h-60 items-center justify-center border border-dashed border-black font-black uppercase italic opacity-10 grayscale"
		>
			Synchronizing Instances...
		</div>
	{:else if instances.length === 0}
		<div
			class="flex h-80 flex-col items-center justify-center gap-4 border-2 border-black bg-slate-50"
		>
			<Icon icon="ph:ghost-bold" class="h-16 w-16 opacity-10" />
			<p class="text-center text-sm font-black tracking-widest uppercase italic opacity-30">
				No active instances found for this engine.<br />
				<span class="NOT-ITALIC text-[10px] normal-case"
					>첫 번째 인스턴스를 생성하여 엔진을 가동해 보세요.</span
				>
			</p>
		</div>
	{:else}
		<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each instances as ins}
				<div
					class="group relative border-2 border-black bg-white p-8 transition-all hover:-translate-x-1 hover:-translate-y-1 hover:shadow-[8px_8px_0_rgba(16,185,129,1)]"
				>
					<div class="mb-6 flex items-start justify-between">
						<div
							class="rounded bg-emerald-50 px-2 py-1 font-mono text-[10px] font-black text-emerald-600"
						>
							/{ins.slug}
						</div>
						<div class="flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
							<a 
								href="/v1/admin/apps/{appId}/instances/{ins.slug}/edit"
								class="p-1 text-black hover:text-blue-600"
							>
								<Icon icon="ph:pencil-simple-bold" class="h-4 w-4" />
							</a>
						</div>
					</div>

					<h4 class="mb-2 text-2xl font-black tracking-tight uppercase">{ins.title || ins.name || ins.slug}</h4>
					<p
						class="mb-6 line-clamp-2 h-10 overflow-hidden text-xs leading-relaxed font-bold italic opacity-40"
					>
						{ins.description || '인스턴스에 대한 상세 설명이 제공되지 않았습니다.'}
					</p>

					<div class="flex items-center justify-between border-t border-black/5 pt-6">
						<div class="flex gap-2">
							{#if ins.layout_type}
								<span
									class="badge h-5 rounded-none badge-outline border-black/20 px-2 text-[8px] font-black uppercase"
									>{ins.layout_type}</span
								>
							{/if}
							{#if ins.status}
								<span
									class="badge h-5 rounded-none border-black px-2 text-[8px] font-black uppercase {ins.status === 'PUBLISHED' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}"
									>{ins.status}</span
								>
							{/if}
						</div>
						<a
							href={(appInfo?.frontend_route || '/v1/app/[appId]/[slug]').replace('[appId]', appId).replace('[slug]', ins.slug)}
							target="_blank"
							class="flex items-center gap-1 text-[9px] font-black text-black uppercase hover:underline"
						>
							Visit <Icon icon="ph:arrow-square-out-bold" class="h-3 w-3" />
						</a>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>
