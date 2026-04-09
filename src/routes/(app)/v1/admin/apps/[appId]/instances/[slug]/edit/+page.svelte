<script>
	/**
	 * @file (app)/v1/admin/apps/[appId]/instances/[slug]/edit/+page.svelte
	 * @description 기존 인스턴스(게시판) 정보 및 동적 필드 수정
	 */
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import Icon from '@iconify/svelte';

	const appId = $derived(page.params.appId);
	const slug = $derived(page.params.slug);

	let isSaving = $state(false);
	let isReady = $state(false);
	let appInfo = $state(null);
	let configSchema = $state({});
	let formData = $state({});
	let customOptions = $state([]); // 주입된 JSONB 설정값들 리스트
	let originalBoard = $state(null);

	async function loadData() {
		try {
			appInfo = await api.adminGetAppDetail(appId);
			configSchema = appInfo?.config_schema || {};

			if (appId === 'board') {
				const boards = await api.adminGetBoards();
				originalBoard = boards.find(b => b.slug === slug);
				
				if (!originalBoard) throw new Error('인스턴스를 찾을 수 없습니다.');

				// 게시판 폴백 스키마 적용
				if (!configSchema.slug) {
					configSchema = {
						...configSchema,
						slug: { type: 'string', label: 'Instance Slug (ID)', icon: 'ph:hash-bold', required: true },
						name: { type: 'string', label: 'Display Title', icon: 'ph:bookmark-bold', required: true },
						description: { type: 'string', label: 'Description', icon: 'ph:text-align-left-bold' },
						layout_type: { type: 'select', label: 'Layout Style', icon: 'ph:layout-bold', options: [{value: 'list', label: 'List Style'}, {value: 'gallery', label: 'Gallery Style'}] },
						items_per_page: { type: 'number', label: 'Items Per Page', icon: 'ph:list-numbers-bold' }
					};
				}

				// 1. 폼 데이터 채우기
				formData = { ...originalBoard };

				// 2. JSONB options 중 스키마에 없는 커스텀 값들을 추출하여 customOptions에 주입
				const options = originalBoard.options || {};
				const schemaKeys = Object.keys(configSchema);
				const baseKeys = ['id', 'slug', 'name', 'description', 'layout_type', 'items_per_page', 'fields_def', 'is_active', 'create_date', 'options'];
				
				customOptions = Object.entries(options)
					.filter(([k]) => !schemaKeys.includes(k) && !baseKeys.includes(k))
					.map(([k, v]) => ({ key: k, value: v }));
			}
			
			isReady = true;
		} catch (e) {
			alertState.send(e.message, { level: 3, style: 'error' });
		}
	}

	function addOption() {
		customOptions = [...customOptions, { key: '', value: '' }];
	}

	function removeOption(idx) {
		customOptions = customOptions.filter((_, i) => i !== idx);
	}

	onMount(loadData);

	async function handleUpdate() {
		// --- [데이터 정제: Base 필드와 Options(JSONB) 필드 분리] ---
		const baseFields = ['id', 'slug', 'name', 'description', 'layout_type', 'items_per_page', 'fields_def', 'is_active', 'create_date'];
		const refinedData = {};
		const options = {};

		// 1. 기본 폼 데이터 분류
		for (const [key, value] of Object.entries(formData)) {
			if (baseFields.includes(key)) {
				refinedData[key] = value;
			} else {
				options[key] = value;
			}
		}

		// 2. 수동 주입(JSONB Injection) 필드 병합
		customOptions.forEach(opt => {
			if (opt.key.trim()) options[opt.key.trim()] = opt.value;
		});

		refinedData.options = options;
		// ---------------------------------------------------

		isSaving = true;
		try {
			if (appId === 'board') {
				await api.adminUpdateBoard(originalBoard.id, refinedData);
				alertState.send('인스턴스 설정이 업데이트되었습니다.', { level: 1, style: 'success' });
				goto(`/v1/admin/apps/${appId}/instances`);
			}
		} catch (e) {
			alertState.send(e.message, { level: 3, style: 'error' });
		} finally {
			isSaving = false;
		}
	}
</script>

<div class="animate-fade-in mx-auto max-w-4xl px-4 pb-40 font-['Outfit'] text-black">
	<!-- 📄 Header -->
	<div class="mb-12 flex flex-col items-start justify-between gap-6 border-b-4 border-black pb-8 md:flex-row md:items-end">
		<div>
			<div class="mb-2 flex items-center gap-3">
				<a href="/v1/admin/apps/{appId}/instances" class="group btn rounded-none border-black px-2 text-[9px] font-black tracking-widest uppercase btn-outline btn-xs">
					<span class="transition-transform group-hover:-translate-x-1">←</span> Back to Instances
				</a>
				<span class="text-[10px] font-black tracking-[0.4em] uppercase opacity-30">Field Configuration</span>
			</div>
			<h1 class="text-5xl font-black tracking-tighter uppercase italic">
				Edit <span class="NOT-ITALIC text-orange-500">{originalBoard?.name || slug}</span>
			</h1>
		</div>
	</div>

	{#if !isReady}
		<div class="flex h-60 items-center justify-center border-2 border-dashed border-black font-black uppercase italic opacity-20">
			Initializing Data...
		</div>
	{:else}
		<div class="border-2 border-black bg-white p-10 shadow-[20px_20px_0_rgba(0,0,0,0.05)] md:p-14">
			<div class="space-y-12">
				<!-- 1. Basic Fields -->
				<div class="grid grid-cols-1 gap-10 md:grid-cols-2">
					{#each Object.entries(configSchema).filter(([k, f]) => f.type) as [key, field]}
						<div class="space-y-3 {field.type === 'textarea' ? 'md:col-span-2' : ''}">
							<label class="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase opacity-30">
								<Icon icon={field.icon || 'ph:cube-bold'} class="h-4 w-4" /> {field.label || key.toUpperCase()}
							</label>
							{#if field.type === 'select' && field.options}
								<select bind:value={formData[key]} class="h-16 w-full appearance-none border-2 border-black bg-slate-50 px-5 text-base font-black outline-none focus:bg-white focus:ring-4 focus:ring-blue-100">
									{#each field.options as opt}
										<option value={opt.value}>{opt.label}</option>
									{/each}
								</select>
							{:else if field.type === 'number'}
								<input type="number" bind:value={formData[key]} class="h-16 w-full border-2 border-black bg-white px-6 text-xl font-black outline-none focus:ring-4 focus:ring-slate-100" />
							{:else}
								<input type="text" bind:value={formData[key]} class="h-16 w-full border-2 border-black bg-slate-50 px-6 text-lg font-black outline-none focus:bg-white focus:ring-4 focus:ring-blue-100" />
							{/if}
						</div>
					{/each}
				</div>

				<!-- 2. Dynamic Field Designer -->
				{#if appId === 'board'}
					<div class="space-y-6 pt-10 border-t-2 border-dashed border-black/10">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase opacity-30">
								<Icon icon="ph:list-plus-bold" class="h-4 w-4" /> Dynamic Content Fields
							</div>
							<button type="button" onclick={addFieldDef} class="btn btn-xs h-8 rounded-none border-2 border-black bg-emerald-400 font-black text-black">
								+ New Field Def
							</button>
						</div>

						<div class="space-y-4">
							{#each formData.fields_def || [] as fdef, idx}
								<div class="flex flex-col gap-4 border-2 border-black bg-slate-50 p-6 md:flex-row md:items-end">
									<div class="flex-1 space-y-2">
										<label class="text-[9px] font-black uppercase opacity-40">Label</label>
										<input type="text" bind:value={fdef.label} class="h-10 w-full border border-black px-3 font-bold text-sm" />
									</div>
									<div class="flex-1 space-y-2">
										<label class="text-[9px] font-black uppercase opacity-40">Key (DB)</label>
										<input type="text" bind:value={fdef.key} class="h-10 w-full border border-black px-3 font-mono text-xs" />
									</div>
									<div class="w-32 space-y-2">
										<label class="text-[9px] font-black uppercase opacity-40">Type</label>
										<select bind:value={fdef.type} class="h-10 w-full border border-black px-2 text-xs font-black">
											<option value="text">Text</option>
											<option value="number">Number</option>
											<option value="date">Date</option>
											<option value="select">Select (Dropdown)</option>
										</select>
									</div>
									{#if fdef.type === 'select'}
										<div class="flex-[2] space-y-2">
											<label class="text-[9px] font-black uppercase opacity-40 text-blue-600">Choices</label>
											<input type="text" bind:value={fdef.options_text} placeholder="A, B, C" class="h-10 w-full border-2 border-blue-600 px-3 font-bold text-sm" />
										</div>
									{/if}
									<button type="button" onclick={() => removeFieldDef(idx)} class="btn btn-square h-10 w-10 border-2 border-black bg-red-500 text-white"><Icon icon="ph:trash-bold" /></button>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- 3. Custom Configuration (JSONB Injection) Section -->
				<div class="space-y-6 pt-10 border-t-2 border-dashed border-black/10">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase opacity-30">
							<Icon icon="ph:brackets-curly-bold" class="h-4 w-4" /> Custom Configuration (JSONB Injection)
						</div>
						<button 
							type="button"
							onclick={addOption}
							class="btn btn-xs h-8 rounded-none border-2 border-black bg-blue-400 font-black text-black hover:bg-blue-500"
						>
							+ Add Config
						</button>
					</div>

					{#if customOptions.length === 0}
						<div class="flex h-20 items-center justify-center border-2 border-dashed border-black/10 bg-slate-50 text-[10px] font-bold italic opacity-30">
							No custom JSONB settings injected.
						</div>
					{:else}
						<div class="space-y-3">
							{#each customOptions as opt, idx}
								<div class="flex items-center gap-4">
									<div class="flex-1 flex items-center bg-black">
										<div class="px-3 text-[10px] font-black text-white italic">KEY</div>
										<input type="text" bind:value={opt.key} placeholder="예: theme_color" class="h-10 w-full border-y border-r border-black px-3 font-mono font-bold text-xs focus:outline-none focus:bg-yellow-50" />
									</div>
									<div class="flex-1 flex items-center border border-black group italic">
										<div class="px-3 text-[10px] font-black opacity-30">VALUE</div>
										<input type="text" bind:value={opt.value} placeholder="#ff0000" class="h-10 w-full px-3 font-bold text-sm focus:outline-none" />
									</div>
									<button 
										type="button" 
										onclick={() => removeOption(idx)}
										class="btn btn-square h-10 w-10 min-h-0 border-2 border-black bg-slate-100 text-black hover:bg-red-500 hover:text-white"
									>
										<Icon icon="ph:x-bold" />
									</button>
								</div>
							{/each}
						</div>
					{/if}
					<p class="text-[9px] font-bold italic opacity-40 text-blue-600">이곳에 나타나는 값들은 인스턴스의 'options' 필드에 주입된 데이터입니다.</p>
				</div>

				<!-- Action -->
				<div class="flex flex-col gap-6 pt-10 border-t-2 border-black">
					<button class="group flex h-24 flex-1 items-center justify-center gap-4 bg-orange-500 border-4 border-black text-xl font-black tracking-[0.2em] text-white uppercase transition-all hover:bg-black" onclick={handleUpdate} disabled={isSaving}>
						{#if isSaving}
							<span class="loading loading-md loading-spinner"></span> Syncing...
						{:else}
							<Icon icon="ph:floppy-disk-back-bold" class="h-8 w-8 transition-transform group-hover:scale-125" /> Update Configuration
						{/if}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
