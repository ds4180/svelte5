<script>
	/**
	 * @file (app)/v1/admin/services/+page.svelte
	 * @description 서비스 엔진 및 앱 통합 관리 페이지 (Lego Architecture)
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import Icon from '@iconify/svelte';
	import { fade, fly } from 'svelte/transition';

	let registries = $state([]);
	let engines = $state([]);
	let serviceApps = $state([]);
	let serviceInstances = $state([]);
	let loading = $state(true);
	let activeTab = $state('instances'); // instances, apps, engines, registries

	async function loadAll() {
		loading = true;
		try {
			const [r, e, a, i] = await Promise.all([
				api.adminGetServiceRegistries(),
				api.adminGetServiceEngines(),
				api.adminGetServiceApps(),
				api.adminGetServiceInstances()
			]);
			registries = r;
			engines = e;
			serviceApps = a;
			serviceInstances = i;
		} catch (err) {
			alertState.send(err.message, { level: 3, style: 'error' });
		} finally {
			loading = false;
		}
	}

	onMount(loadAll);

	// --- [CRUD Helpers] ---
	let showModal = $state(false);
	let modalType = $state(''); // registry, engine, app
	let formData = $state({});

	function openModal(type, target = null) {
		modalType = type;
		formData = target ? { ...target } : {};
		if (type === 'app' && target?.config) {
			formData.config_str = JSON.stringify(target.config, null, 2);
		}
		if (type === 'instance' && !target) {
			formData.service_app_ids = [];
		}
		showModal = true;
	}

	async function handleSubmit() {
		try {
			if (modalType === 'registry') {
				await api.adminCreateServiceRegistry(formData);
			} else if (modalType === 'engine') {
				await api.adminCreateServiceEngine({
					...formData,
					config_schema: formData.config_schema_str ? JSON.parse(formData.config_schema_str) : {}
				});
			} else if (modalType === 'app') {
				const data = {
					...formData,
					config: formData.config_str ? JSON.parse(formData.config_str) : {}
				};
				if (formData.id) {
					await api.adminUpdateServiceApp(formData.id, data);
				} else {
					await api.adminCreateServiceApp(data);
				}
			} else if (modalType === 'instance') {
				if (formData.id) {
					await api.adminUpdateServiceInstance(formData.id, formData);
				} else {
					await api.adminCreateServiceInstance(formData);
				}
			}
			alertState.send('성공적으로 저장되었습니다.', { style: 'success' });
			showModal = false;
			loadAll();
		} catch (err) {
			alertState.send(err.message, { level: 3, style: 'error' });
		}
	}

	async function handleDelete(type, id) {
		if (!confirm('정말 삭제하시겠습니까?')) return;
		try {
			if (type === 'registry') await api.adminDeleteServiceRegistry(id);
			else if (type === 'engine') await api.adminDeleteServiceEngine(id);
			else if (type === 'instance') await api.adminDeleteServiceInstance(id);
			alertState.send('삭제되었습니다.', { style: 'success' });
			loadAll();
		} catch (err) {
			alertState.send(err.message, { level: 3, style: 'error' });
		}
	}
</script>

<div class="mx-auto max-w-7xl space-y-8 px-4 pb-20 font-['Outfit'] md:px-8">
	<!-- Header -->
	<header class="flex flex-col items-start justify-between gap-6 border-b-4 border-black pb-8 md:flex-row md:items-end">
		<div>
			<span class="mb-2 block text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase">Modular Services</span>
			<h1 class="text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-6xl">
				서비스 <span class="NOT-ITALIC text-rose-600">마스터</span>
			</h1>
			<p class="mt-4 text-sm font-bold text-slate-500">
				댓글, 업로드, 추천 등 독립된 레고 조각들을 관리하고 앱 인스턴스에 주입할 준비를 합니다.
			</p>
		</div>
		<div class="flex gap-2">
			<button onclick={() => openModal('app')} class="btn h-14 rounded-xl bg-rose-600 px-8 font-black text-white shadow-lg transition-all hover:bg-rose-700">
				<Icon icon="ph:plus-bold" /> 서비스 앱 생성
			</button>
		</div>
	</header>

	<!-- Tabs -->
	<nav class="sticky top-0 z-20 -mx-4 mb-8 flex gap-2 border-b-2 border-slate-100 bg-white/80 px-4 backdrop-blur-md overflow-x-auto no-scrollbar md:mx-0 md:px-0">
		<button onclick={() => activeTab = 'instances'} class="whitespace-nowrap px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all md:text-sm {activeTab === 'instances' ? 'border-b-4 border-rose-600 text-rose-600' : 'text-slate-400 opacity-50 hover:opacity-100'}">
			Service Bundles
		</button>
		<button onclick={() => activeTab = 'apps'} class="whitespace-nowrap px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all md:text-sm {activeTab === 'apps' ? 'border-b-4 border-rose-600 text-rose-600' : 'text-slate-400 opacity-50 hover:opacity-100'}">
			Service Apps
		</button>
		<button onclick={() => activeTab = 'engines'} class="whitespace-nowrap px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all md:text-sm {activeTab === 'engines' ? 'border-b-4 border-rose-600 text-rose-600' : 'text-slate-400 opacity-50 hover:opacity-100'}">
			Engines
		</button>
		<button onclick={() => activeTab = 'registries'} class="whitespace-nowrap px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all md:text-sm {activeTab === 'registries' ? 'border-b-4 border-rose-600 text-rose-600' : 'text-slate-400 opacity-50 hover:opacity-100'}">
			Registries
		</button>
	</nav>

	<!-- Content Area -->
	<main class="min-h-[400px]">
		{#if loading}
			<div class="flex h-64 items-center justify-center">
				<div class="h-12 w-12 animate-spin rounded-full border-4 border-rose-600 border-t-transparent"></div>
			</div>
		{:else if activeTab === 'instances'}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each serviceInstances as inst}
					<div in:fly={{ y: 20 }} class="rounded-2xl border-2 border-slate-100 bg-white p-8 shadow-sm group hover:border-rose-300 transition-all">
						<div class="flex justify-between items-start mb-4">
							<Icon icon="ph:package-bold" class="text-3xl text-rose-600" />
							<div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
								<button onclick={() => openModal('instance', inst)} class="p-2 text-slate-400 hover:text-blue-600">
									<Icon icon="ph:pencil-simple-bold" />
								</button>
								<button onclick={() => handleDelete('instance', inst.id)} class="p-2 text-slate-400 hover:text-rose-600">
									<Icon icon="ph:trash-bold" />
								</button>
							</div>
						</div>
						<h3 class="text-xl font-black mb-1">{inst.name}</h3>
						<div class="flex flex-wrap gap-1 mb-6">
							{#each (inst.service_app_ids || []) as appId}
								<span class="text-[8px] font-black bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded border border-rose-100 uppercase">
									{serviceApps.find(a => a.id === appId)?.name || appId}
								</span>
							{/each}
						</div>
						<a href="/v1/admin/services/binding" class="text-[10px] font-black uppercase text-rose-600 hover:underline">Go to Bindings →</a>
					</div>
				{/each}
				<button onclick={() => openModal('instance')} class="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-slate-300 hover:border-rose-400 hover:text-rose-400">
					<Icon icon="ph:plus-bold" class="text-2xl mb-2" />
					<span class="text-[10px] font-black uppercase">Create New Bundle</span>
				</button>
			</div>
		{:else if activeTab === 'apps'}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each serviceApps as app}
					<div in:fly={{ y: 20 }} class="group relative overflow-hidden rounded-2xl border-2 border-slate-100 bg-white p-8 shadow-sm transition-all hover:border-rose-200 hover:shadow-xl">
						<div class="mb-6 flex items-center justify-between">
							<div class="h-12 w-12 bg-rose-50 text-rose-600 flex items-center justify-center rounded-xl text-xl">
								<Icon icon="ph:puzzle-piece-bold" />
							</div>
							<div class="flex gap-1">
								<button onclick={() => openModal('app', app)} class="btn btn-square btn-ghost btn-sm text-slate-400 hover:text-blue-600">
									<Icon icon="ph:pencil-simple-bold" />
								</button>
							</div>
						</div>
						<h3 class="mb-2 text-xl font-black tracking-tight">{app.name}</h3>
						<div class="space-y-2 text-xs font-bold text-slate-500">
							<p><span class="opacity-50 uppercase">Engine:</span> {app.engine_id}</p>
							<p><span class="opacity-50 uppercase">Next Chain:</span> {app.child_app_id || 'None'}</p>
						</div>
						<div class="mt-6 flex flex-wrap gap-2">
							<span class="rounded bg-slate-100 px-2 py-1 text-[9px] font-black uppercase">v1.2.0</span>
							<span class="rounded bg-emerald-50 text-emerald-600 px-2 py-1 text-[9px] font-black uppercase">Active</span>
						</div>
					</div>
				{/each}
			</div>
		{:else if activeTab === 'engines'}
			<div class="overflow-x-auto rounded-2xl border-2 border-slate-100 bg-white">
				<table class="w-full text-left">
					<thead class="bg-slate-50 text-[10px] font-black uppercase tracking-widest text-slate-400">
						<tr>
							<th class="px-8 py-4">ID / Version</th>
							<th class="px-8 py-4">Registry</th>
							<th class="px-8 py-4">Frontend Plugin</th>
							<th class="px-8 py-4 text-right">Actions</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100 font-bold">
						{#each engines as engine}
							<tr class="hover:bg-slate-50/50">
								<td class="px-8 py-6">
									<div class="text-slate-900">{engine.id}</div>
									<div class="text-[10px] opacity-40">{engine.version}</div>
								</td>
								<td class="px-8 py-6 text-rose-600 uppercase text-xs">{engine.registry_id}</td>
								<td class="px-8 py-6">
									<span class="rounded-lg bg-blue-50 px-3 py-1 text-xs text-blue-600">{engine.frontend_plugin}</span>
								</td>
								<td class="px-8 py-6 text-right">
									<button onclick={() => handleDelete('engine', engine.id)} class="text-slate-300 hover:text-rose-600 transition-colors">
										<Icon icon="ph:trash-bold" />
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
				<div class="p-8 border-t border-slate-100">
					<button onclick={() => openModal('engine')} class="btn btn-outline border-2 border-slate-200 font-black uppercase tracking-widest hover:bg-black hover:text-white">
						<Icon icon="ph:plus-bold" /> 엔진 추가 등록
					</button>
				</div>
			</div>
		{:else if activeTab === 'registries'}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
				{#each registries as reg}
					<div class="rounded-2xl border-2 border-slate-100 bg-white p-6">
						<div class="mb-4 text-xs font-black text-rose-600 uppercase tracking-widest">{reg.id}</div>
						<h4 class="mb-2 text-lg font-black">{reg.name}</h4>
						<p class="text-xs text-slate-400 leading-relaxed font-bold">{reg.description || 'No description provided.'}</p>
						<button onclick={() => handleDelete('registry', reg.id)} class="mt-6 text-xs font-black text-rose-600/30 hover:text-rose-600 uppercase">Delete Registry</button>
					</div>
				{/each}
				<button onclick={() => openModal('registry')} class="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-slate-300 transition-all hover:border-rose-400 hover:text-rose-400">
					<Icon icon="ph:plus-circle-bold" class="text-4xl mb-2" />
					<span class="text-xs font-black uppercase tracking-widest">Add Registry</span>
				</button>
			</div>
		{/if}
	</main>
</div>

<!-- Modal -->
{#if showModal}
	<div transition:fade class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
		<div transition:fly={{ y: 50 }} class="w-full max-w-xl overflow-hidden rounded-3xl bg-white shadow-2xl">
			<header class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-10 py-6">
				<h2 class="text-2xl font-black tracking-tighter uppercase italic">{modalType} <span class="text-rose-600">Configuration</span></h2>
				<button onclick={() => showModal = false} class="text-slate-400 hover:text-black">
					<Icon icon="ph:x-bold" class="text-2xl" />
				</button>
			</header>
			
			<div class="p-10 space-y-6 max-h-[70vh] overflow-y-auto">
				{#if modalType === 'registry'}
					<div class="space-y-2">
						<label class="text-[10px] font-black uppercase tracking-widest opacity-40">Registry ID (Key)</label>
						<input type="text" bind:value={formData.id} class="w-full border-b-2 border-slate-200 py-2 font-bold focus:border-rose-600 focus:outline-none" placeholder="e.g., comment" />
					</div>
					<div class="space-y-2">
						<label class="text-[10px] font-black uppercase tracking-widest opacity-40">Display Name</label>
						<input type="text" bind:value={formData.name} class="w-full border-b-2 border-slate-200 py-2 font-bold focus:border-rose-600 focus:outline-none" placeholder="e.g., 댓글 서비스" />
					</div>
				{:else if modalType === 'engine'}
					<div class="grid grid-cols-2 gap-6">
						<div class="space-y-2">
							<label class="text-[10px] font-black uppercase tracking-widest opacity-40">Engine ID</label>
							<input type="text" bind:value={formData.id} class="w-full border-b-2 border-slate-200 py-2 font-bold focus:border-rose-600 focus:outline-none" />
						</div>
						<div class="space-y-2">
							<label class="text-[10px] font-black uppercase tracking-widest opacity-40">Registry Group</label>
							<select bind:value={formData.registry_id} class="w-full border-b-2 border-slate-200 py-2 font-bold focus:border-rose-600 focus:outline-none">
								{#each registries as r}<option value={r.id}>{r.name}</option>{/each}
							</select>
						</div>
					</div>
					<div class="space-y-2">
						<label class="text-[10px] font-black uppercase tracking-widest opacity-40">Frontend Plugin (Svelte Component)</label>
						<input type="text" bind:value={formData.frontend_plugin} class="w-full border-b-2 border-slate-200 py-2 font-bold focus:border-rose-600 focus:outline-none" placeholder="e.g., CommentEngine" />
					</div>
				{:else if modalType === 'app'}
					<div class="space-y-2">
						<label class="text-[10px] font-black uppercase tracking-widest opacity-40">App Name</label>
						<input type="text" bind:value={formData.name} class="w-full border-b-2 border-slate-200 py-2 font-bold focus:border-rose-600 focus:outline-none" />
					</div>
					<div class="grid grid-cols-2 gap-6">
						<div class="space-y-2">
							<label class="text-[10px] font-black uppercase tracking-widest opacity-40">Base Engine</label>
							<select bind:value={formData.engine_id} class="w-full border-b-2 border-slate-200 py-2 font-bold focus:border-rose-600 focus:outline-none">
								{#each engines as e}<option value={e.id}>{e.id} ({e.version})</option>{/each}
							</select>
						</div>
						<div class="space-y-2">
							<label class="text-[10px] font-black uppercase tracking-widest opacity-40">Child (Chain)</label>
							<select bind:value={formData.child_app_id} class="w-full border-b-2 border-slate-200 py-2 font-bold focus:border-rose-600 focus:outline-none">
								<option value={null}>None</option>
								{#each serviceApps.filter(a => a.id !== formData.id) as a}<option value={a.id}>{a.name}</option>{/each}
							</select>
						</div>
					</div>
					<div class="space-y-2">
						<label class="text-[10px] font-black uppercase tracking-widest opacity-40">JSON Configuration</label>
						<textarea bind:value={formData.config_str} rows="5" class="w-full rounded-xl border-2 border-slate-100 bg-slate-50 p-4 font-mono text-xs focus:border-rose-600 focus:outline-none"></textarea>
					</div>
				{:else if modalType === 'instance'}
					<div class="space-y-6">
						<div class="space-y-2">
							<label class="text-[10px] font-black uppercase tracking-widest opacity-40">Bundle Name</label>
							<input type="text" bind:value={formData.name} class="w-full border-b-2 border-slate-200 py-2 font-bold focus:border-rose-600 focus:outline-none" placeholder="e.g., Standard Board Plugin Set" />
						</div>
						
						<div class="space-y-4">
							<label class="text-[10px] font-black uppercase tracking-widest opacity-40">Included Service Apps (Select & Order)</label>
							<div class="space-y-2 max-h-60 overflow-y-auto rounded-xl border-2 border-slate-50 p-2">
								{#each serviceApps as app}
									<label class="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors {formData.service_app_ids?.includes(app.id) ? 'bg-rose-50 border-rose-100 border' : ''}">
										<input 
											type="checkbox" 
											checked={formData.service_app_ids?.includes(app.id)}
											onchange={(e) => {
												if (!formData.service_app_ids) formData.service_app_ids = [];
												if (e.target.checked) {
													formData.service_app_ids = [...formData.service_app_ids, app.id];
												} else {
													formData.service_app_ids = formData.service_app_ids.filter(id => id !== app.id);
												}
											}}
											class="checkbox checkbox-rose checkbox-sm" 
										/>
										<div class="flex-1">
											<div class="text-sm font-black">{app.name}</div>
											<div class="text-[9px] opacity-40 uppercase font-bold">{app.engine_id}</div>
										</div>
										{#if formData.service_app_ids?.includes(app.id)}
											<span class="text-[10px] font-black text-rose-600 bg-white px-2 py-1 rounded-lg">
												Order: {formData.service_app_ids.indexOf(app.id) + 1}
											</span>
										{/if}
									</label>
								{/each}
							</div>
							<p class="text-[9px] font-bold text-slate-400">※ 체크한 순서대로 화면에 렌더링됩니다.</p>
						</div>
					</div>
				{/if}
			</div>

			<footer class="flex justify-end gap-3 bg-slate-50 px-10 py-6">
				<button onclick={() => showModal = false} class="btn btn-ghost font-black uppercase tracking-widest opacity-50">Cancel</button>
				<button onclick={handleSubmit} class="btn bg-black px-10 font-black text-white transition-all hover:bg-rose-600">Save Changes</button>
			</footer>
		</div>
	</div>
{/if}

<style>
	:global(body) { background-color: #fcfcfc; }
	.no-scrollbar::-webkit-scrollbar { display: none; }
	.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
