<script>
	/**
	 * @file (app)/v1/admin/page/+page.svelte
	 * @description 컨벤션에 따른 페이지 엔진 전용 관리자 화면
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/page.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import Icon from '@iconify/svelte';

	let { data } = $props();

	let pages = $state(data.pages || []);
	let loading = $state(false);
	let isSavingMeta = $state(false);

	// 메타데이터 수정을 위한 상태
	let showMetaModal = $state(false);
	let selectedPage = $state(null);
	let metaForm = $state({
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
	});

	let stats = $derived({
		total: pages.length,
		published: pages.filter(p => p.status === 'PUBLISHED').length,
		draft: pages.filter(p => p.status === 'DRAFT').length
	});

	async function loadData() {
		try {
			pages = await api.adminGetPages();
		} catch (e) {
			alertState.send(e.message, { level: 3, style: 'error' });
		}
	}

	function openMetaModal(page) {
		selectedPage = page;
		
		// 1. 기존 옵션 필터링 (기본 필드 제외한 나머지를 JSONB로 취급)
		const baseFields = ['id', 'slug', 'title', 'status', 'redirect_url', 'published_at', 'expired_at', 'min_rank', 'is_active', 'content', 'content_json', 'view_count', 'created_at', 'updated_at'];
		const customOpts = Object.entries(page)
			.filter(([k]) => !baseFields.includes(k))
			.map(([k, v]) => ({ key: k, value: v }));

		metaForm = {
			id: page.id,
			title: page.title,
			slug: page.slug,
			status: page.status,
			redirect_url: page.redirect_url || '',
			published_at: page.published_at ? new Date(page.published_at).toISOString().slice(0, 16) : '',
			expired_at: page.expired_at ? new Date(page.expired_at).toISOString().slice(0, 16) : '',
			min_rank: page.min_rank || 0,
			is_active: page.is_active ?? true,
			customOptions: customOpts
		};
		showMetaModal = true;
	}

	function addCustomOption() {
		metaForm.customOptions = [...metaForm.customOptions, { key: '', value: '' }];
	}

	function removeCustomOption(idx) {
		metaForm.customOptions = metaForm.customOptions.filter((_, i) => i !== idx);
	}

	async function handleSaveMeta() {
		isSavingMeta = true;
		try {
			// 데이터 전처리
			const payload = { ...metaForm };
			delete payload.customOptions;

			// 커스텀 옵션 병합
			metaForm.customOptions.forEach(opt => {
				if (opt.key.trim()) payload[opt.key.trim()] = opt.value;
			});

			await api.adminUpdatePage(payload);
			alertState.send('페이지 설정이 완벽하게 업데이트되었습니다.', { level: 1, style: 'success' });
			showMetaModal = false;
			loadData();
		} catch (e) {
			alertState.send(e.message, { level: 3, style: 'error' });
		} finally {
			isSavingMeta = false;
		}
	}

	async function handleDelete(id) {
		if (!confirm('정말로 이 페이지를 영구 삭제하시겠습니까?')) return;
		try {
			await api.adminDeletePage(id);
			alertState.send('페이지가 삭제되었습니다.', { level: 1, style: 'success' });
			loadData();
		} catch (e) {
			alertState.send(e.message, { level: 3, style: 'error' });
		}
	}

	onMount(loadData);
</script>

<div class="animate-fade-in mx-auto max-w-7xl px-4 pb-40 font-['Outfit'] text-black">
	<!-- 📄 Header -->
	<div class="mb-12 flex flex-col items-start justify-between gap-6 border-b-4 border-black pb-8 md:flex-row md:items-end">
		<div>
			<div class="mb-2 flex items-center gap-3">
				<span class="bg-black px-2 py-0.5 text-[10px] font-black tracking-widest text-white uppercase italic">Management</span>
				<span class="text-[10px] font-black tracking-[0.4em] uppercase opacity-30">Page Control Center</span>
			</div>
			<h1 class="text-5xl font-black tracking-tighter uppercase italic">
				Page <span class="text-blue-600">Engine</span> Admin
			</h1>
		</div>
		<div class="flex gap-4">
			<a
				href="/v1/custom/page/new-page"
				class="btn-black btn h-14 rounded-none border-2 border-black px-8 font-black uppercase transition-all hover:bg-white hover:text-black"
			>
				+ Create New Page
			</a>
		</div>
	</div>

	<!-- 📊 Stats Grid -->
	<div class="mb-12 grid grid-cols-1 gap-6 sm:grid-cols-3">
		<div class="border-2 border-black bg-white p-6 shadow-[8px_8px_0_rgba(0,0,0,0.05)]">
			<div class="text-[10px] font-black uppercase opacity-30">Total Pages</div>
			<div class="text-4xl font-black italic">{stats.total}</div>
		</div>
		<div class="border-2 border-black bg-emerald-50 p-6 shadow-[8px_8px_0_rgba(0,0,0,0.05)]">
			<div class="text-[10px] font-black uppercase text-emerald-600 opacity-60">Live (Published)</div>
			<div class="text-4xl font-black italic text-emerald-800">{stats.published}</div>
		</div>
		<div class="border-2 border-black bg-slate-50 p-6 shadow-[8px_8px_0_rgba(0,0,0,0.05)]">
			<div class="text-[10px] font-black uppercase opacity-30">Drafts</div>
			<div class="text-4xl font-black italic opacity-40">{stats.draft}</div>
		</div>
	</div>

	<!-- 📑 Page List Table -->
	{#if loading}
		<div class="flex h-60 items-center justify-center border-2 border-dashed border-black font-black uppercase italic opacity-20">
			Syncing with Database...
		</div>
	{:else if pages.length === 0}
		<div class="flex h-60 flex-col items-center justify-center border-2 border-black bg-slate-50 opacity-30">
			<Icon icon="ph:file-x-bold" class="h-16 w-16 mb-4" />
			<p class="font-black uppercase italic">No pages created yet.</p>
		</div>
	{:else}
		<div class="overflow-x-auto border-4 border-black bg-white shadow-[20px_20px_0_rgba(0,0,0,0.05)]">
			<table class="w-full text-left">
				<thead>
					<tr class="border-b-4 border-black bg-black text-[10px] font-black tracking-widest text-white uppercase italic">
						<th class="p-6">Status</th>
						<th class="p-6">Identity & Slug</th>
						<th class="p-6">Visits</th>
						<th class="p-6">Published At</th>
						<th class="p-6 text-right">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y-2 divide-black/5 font-bold">
					{#each pages as p}
						<tr class="group hover:bg-slate-50">
							<td class="p-6">
								<span class="rounded-none px-2 py-1 text-[9px] font-black uppercase {p.status === 'PUBLISHED' ? 'bg-emerald-400 text-black' : 'bg-slate-200 text-slate-500'}">
									{p.status}
								</span>
							</td>
							<td class="p-6">
								<div class="text-lg font-black uppercase italic tracking-tight">{p.title}</div>
								<div class="font-mono text-[10px] opacity-30">/v1/custom/page/{p.slug}</div>
							</td>
							<td class="p-6">
								<div class="flex items-center gap-2">
									<Icon icon="ph:chart-line-up-bold" class="text-blue-600" />
									<span class="font-black italic">{p.view_count || 0}</span>
								</div>
							</td>
							<td class="p-6 text-xs italic opacity-40">
								{new Date(p.published_at).toLocaleString()}
							</td>
							<td class="p-6 text-right">
								<div class="flex justify-end gap-3 transition-transform group-hover:scale-105">
									<a href="/v1/custom/page/{p.slug}?edit=true" class="btn btn-square btn-outline btn-sm rounded-none border-black hover:bg-black" title="Edit Content">
										<Icon icon="ph:pencil-line-bold" class="h-4 w-4" />
									</a>
									<button onclick={() => openMetaModal(p)} class="btn btn-square btn-outline btn-sm rounded-none border-black hover:bg-blue-600" title="Settings & Meta">
										<Icon icon="ph:gear-six-bold" class="h-4 w-4" />
									</button>
									<button onclick={() => handleDelete(p.id)} class="btn btn-square btn-error btn-sm rounded-none border-black hover:bg-red-600" title="Delete">
										<Icon icon="ph:trash-bold" class="h-4 w-4 text-white" />
									</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	<!-- 🛠 Meta Edit Modal -->
	{#if showMetaModal}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-4 transition-all" onclick={() => showMetaModal = false}>
			<div class="w-full max-w-2xl border-4 border-black bg-white p-12 shadow-[30px_30px_0_rgba(0,0,0,0.2)]" onclick={e => e.stopPropagation()}>
				<div class="mb-10 border-b-4 border-black pb-6">
					<h3 class="text-3xl font-black tracking-tighter uppercase italic">Meta <span class="text-blue-600">Configuration</span></h3>
					<p class="text-[10px] font-bold opacity-30 mt-1 uppercase italic tracking-widest">Target_ID: {metaForm.id}</p>
				</div>

				<div class="space-y-8">
					<!-- Title & Slug -->
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div class="space-y-2">
							<label class="text-[9px] font-black uppercase opacity-40">Page Title</label>
							<input type="text" bind:value={metaForm.title} class="h-12 w-full border-2 border-black px-4 font-bold" />
						</div>
						<div class="space-y-2">
							<label class="text-[9px] font-black uppercase opacity-40">Slug (URL)</label>
							<div class="flex items-center border-2 border-black bg-slate-50">
								<span class="px-3 text-[10px] opacity-20 italic">/page/</span>
								<input type="text" bind:value={metaForm.slug} class="h-10 w-full bg-transparent px-1 font-mono text-xs font-bold focus:outline-none" />
							</div>
						</div>
					</div>

					<!-- Status & Timing -->
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div class="space-y-2">
							<label class="text-[9px] font-black uppercase opacity-40">Status</label>
							<select bind:value={metaForm.status} class="h-12 w-full appearance-none border-2 border-black bg-white px-4 font-black text-xs uppercase italic">
								<option value="DRAFT">DRAFT (Hidden)</option>
								<option value="PUBLISHED">PUBLISHED (Live)</option>
							</select>
						</div>
						<div class="space-y-2">
							<label class="text-[9px] font-black uppercase opacity-40">Release Time</label>
							<input type="datetime-local" bind:value={metaForm.published_at} class="h-12 w-full border-2 border-black px-4 font-bold text-xs" />
						</div>
					</div>

					<!-- Advanced Options (Rank, Expired, Active) -->
					<div class="grid grid-cols-1 gap-6 md:grid-cols-3 border-t border-black/5 pt-8">
						<div class="space-y-2">
							<label class="text-[9px] font-black uppercase opacity-40">Access Rank</label>
							<input type="number" bind:value={metaForm.min_rank} min="0" max="10" class="h-12 w-full border-2 border-black px-4 font-black" />
						</div>
						<div class="space-y-2">
							<label class="text-[9px] font-black uppercase opacity-40 text-red-600">Expiration Time</label>
							<input type="datetime-local" bind:value={metaForm.expired_at} class="h-12 w-full border-2 border-dashed border-red-200 px-4 font-bold text-xs" />
						</div>
						<div class="space-y-2 flex flex-col justify-end">
							<label class="flex items-center gap-3 cursor-pointer p-3 border-2 border-black bg-slate-50 hover:bg-slate-100 transition-colors h-12">
								<input type="checkbox" bind:checked={metaForm.is_active} class="checkbox checkbox-sm rounded-none border-2 border-black" />
								<span class="text-[10px] font-black uppercase italic">System Active</span>
							</label>
						</div>
					</div>

					<!-- Redirect -->
					<div class="space-y-2">
						<label class="text-[9px] font-black uppercase opacity-40 text-blue-600">Redirect URL (External Link)</label>
						<input type="text" bind:value={metaForm.redirect_url} placeholder="https://..." class="h-12 w-full border-2 border-black px-4 font-bold text-sm bg-blue-50/30" />
					</div>

					<!-- 🚀 JSONB Injection Section -->
					<div class="space-y-4 pt-8 border-t-2 border-dashed border-black/10">
						<div class="flex items-center justify-between">
							<label class="text-[10px] font-black uppercase tracking-widest opacity-30 flex items-center gap-2">
								<Icon icon="ph:brackets-curly-bold" /> Custom Page Properties (JSONB)
							</label>
							<button type="button" onclick={addCustomOption} class="btn btn-xs h-8 rounded-none border-2 border-black bg-yellow-400 font-bold hover:bg-yellow-500 text-black">
								+ Add Entry
							</button>
						</div>
						<div class="max-h-40 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
							{#each metaForm.customOptions as opt, idx}
								<div class="flex items-center gap-2">
									<input type="text" bind:value={opt.key} placeholder="KEY" class="h-10 flex-1 border-2 border-black px-3 font-mono text-[10px] font-bold bg-black text-white" />
									<input type="text" bind:value={opt.value} placeholder="VALUE" class="h-10 flex-[1.5] border-2 border-black px-3 text-xs font-bold" />
									<button type="button" onclick={() => removeCustomOption(idx)} class="btn btn-square h-10 w-10 min-h-0 border-2 border-black bg-slate-100 hover:bg-red-500 hover:text-white transition-colors">
										<Icon icon="ph:x-bold" />
									</button>
								</div>
							{/each}
						</div>
					</div>
				</div>

				<div class="mt-12 flex gap-4">
					<button onclick={() => showMetaModal = false} class="flex-1 border-2 border-black h-16 font-black uppercase italic opacity-40 hover:opacity-100 transition-opacity">
						Cancel
					</button>
					<button onclick={handleSaveMeta} disabled={isSavingMeta} class="flex-2 flex items-center justify-center gap-2 bg-black text-white h-16 font-black uppercase italic tracking-widest hover:bg-blue-600 transition-colors">
						{#if isSavingMeta}
							<span class="loading loading-spinner loading-xs"></span>
						{:else}
							<Icon icon="ph:check-circle-bold" class="h-5 w-5" /> Sync All Attributes
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.custom-scrollbar::-webkit-scrollbar {
		width: 4px;
	}
	.custom-scrollbar::-webkit-scrollbar-track {
		background: #f1f1f1;
	}
	.custom-scrollbar::-webkit-scrollbar-thumb {
		background: #000;
	}
</style>
