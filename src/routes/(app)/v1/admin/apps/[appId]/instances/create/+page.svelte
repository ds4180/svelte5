<script>
	/**
	 * @file (app)/v1/admin/apps/[appId]/instances/create/+page.svelte
	 * @description API의 config_schema를 참조하여 동적으로 폼을 구성하는 인스턴스 생성 마법사
	 */
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import Icon from '@iconify/svelte';

	const appId = $derived(page.params.appId);

	let isSaving = $state(false);
	let isReady = $state(false);
	let appInfo = $state(null);
	let configSchema = $state({});
	let formData = $state({});
	let customOptions = $state([]); // 사용자가 수동으로 주입할 Key-Value 리스트 (JSONB용)

	async function loadSchema() {
		try {
			appInfo = await api.adminGetAppDetail(appId);
			configSchema = appInfo?.config_schema || {};

			// 백엔드 스키마에 화면용 필드(slug 등)가 정의되어 있지 않으면, Board 전용 폴백 폼 스키마를 덮어씌웁니다.
			if (!configSchema.slug && appId === 'board') {
				configSchema = {
					...configSchema,
					slug: { type: 'string', label: 'Instance Slug (ID)', description: '이 인스턴스의 고유 주소(URL)가 됩니다. 영소문자와 하이픈(-)만 권장.', icon: 'ph:hash-bold', placeholder: '예: free-board', required: true },
					name: { type: 'string', label: 'Display Title', description: '사용자에게 보여질 실제 명칭입니다.', icon: 'ph:bookmark-bold', placeholder: '예: 자유게시판', required: true },
					description: { type: 'string', label: 'Description', description: '사용자와 관리자에게 보여줄 짧은 설명', icon: 'ph:text-align-left-bold', placeholder: '옵션 설명' },
					layout_type: { type: 'select', label: 'Layout Style', icon: 'ph:layout-bold', options: [{value: 'list', label: 'List Style (Standard)'}, {value: 'gallery', label: 'Gallery Style (Image Centered)'}, {value: 'blog', label: 'Blog Style (Summary/Full Body)'}], default: 'list' },
					items_per_page: { type: 'number', label: 'Items Per Page', icon: 'ph:list-numbers-bold', default: 10 }
				};
			}

			// 스키마를 바탕으로 formData 초기화 (UI용 필드만 추출: type 속성이 있는 것)
			const initialData = {};
			for (const [key, field] of Object.entries(configSchema)) {
				if (!field.type) continue; // instance_info 같은 시스템 메타데이터 무시
				initialData[key] = field.default !== undefined ? field.default : (field.type === 'number' ? 0 : '');
			}

			// 게시판인 경우 필드 정의 배열 추가
			if (appId === 'board') {
				initialData.fields_def = [];
			}

			formData = initialData;
			isReady = true;

		} catch (e) {
			alertState.send('앱 스키마 정보를 불러오지 못했습니다.', { level: 3, style: 'error' });
		}
	}

	function addOption() {
		customOptions = [...customOptions, { key: '', value: '' }];
	}

	function removeOption(idx) {
		customOptions = customOptions.filter((_, i) => i !== idx);
	}

	function addFieldDef() {
		formData.fields_def = [
			...formData.fields_def,
			{ label: '', key: '', type: 'text', required: false, placeholder: '' }
		];
	}

	function removeFieldDef(index) {
		formData.fields_def = formData.fields_def.filter((_, i) => i !== index);
	}

	onMount(loadSchema);

	async function handleCreate() {
		// --- [데이터 정제: Base 필드와 Options(JSONB) 필드 분리] ---
		const baseFields = ['slug', 'name', 'description', 'layout_type', 'items_per_page', 'fields_def', 'is_active'];
		const refinedData = {};
		const options = {};

		// 1. 기본 폼 데이터 분류
		for (const [key, value] of Object.entries(formData)) {
			if (baseFields.includes(key)) {
				refinedData[key] = value;
			} else {
				// 스키마 기반 동적 필드
				options[key] = value;
			}
		}

		// 2. 수동 주입(JSONB Injection) 필드 병합
		customOptions.forEach(opt => {
			if (opt.key.trim()) {
				options[opt.key.trim()] = opt.value;
			}
		});

		refinedData.options = options;
		// ---------------------------------------------------

		// 필수 항목 검증
		for (const [key, field] of Object.entries(configSchema)) {
			if (field.required && !formData[key]) {
				alertState.send(`${field.label || key} 항목은 필수입니다.`, { level: 2, style: 'warning' });
				return;
			}
		}

		isSaving = true;
		try {
			if (appId === 'board') {
				await api.adminCreateBoard(refinedData);
				alertState.send(`인스턴스가 성공적으로 생성되었습니다.`, {
					level: 1,
					style: 'success'
				});
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
				<a
					href="/v1/admin/apps/{appId}/instances"
					class="group btn rounded-none border-black px-2 text-[9px] font-black tracking-widest uppercase btn-outline btn-xs"
				>
					<span class="transition-transform group-hover:-translate-x-1">←</span> Back to Instances
				</a>
				<span class="text-[10px] font-black tracking-[0.4em] uppercase opacity-30">Factory Wizard</span>
			</div>
			<h1 class="text-5xl font-black tracking-tighter uppercase italic">
				{appInfo?.title || appId} <span class="NOT-ITALIC text-blue-600">Factory</span>
			</h1>
			<p class="mt-3 text-xs font-bold italic opacity-40">
				{appInfo?.description || 'API 스키마 규칙에 따라 새로운 인스턴스를 설계하고 시스템에 배치합니다.'}
			</p>
		</div>
	</div>

	<!-- 🧬 Creation Form -->
	{#if !isReady}
		<div class="flex h-60 items-center justify-center border-2 border-dashed border-black font-black uppercase italic opacity-20">
			Loading Schema...
		</div>
	{:else}
		<div class="border-2 border-black bg-white p-10 shadow-[20px_20px_0_rgba(0,0,0,0.05)] md:p-14">
			<div class="mb-12 flex items-baseline justify-between border-b-2 border-black pb-4">
				<h3 class="mr-4 text-3xl font-black tracking-tighter uppercase italic">New Instance Build</h3>
				<span class="text-[10px] font-black tracking-widest uppercase opacity-30">Dynamic Schema v1.1</span>
			</div>

			<div class="space-y-12">
				<!-- 1. Basic configuration fields -->
				<div class="grid grid-cols-1 gap-10 md:grid-cols-2">
					{#each Object.entries(configSchema).filter(([k, f]) => f.type) as [key, field]}
						<div class="space-y-3 {field.type === 'textarea' ? 'md:col-span-2' : ''}">
							<label class="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase opacity-30">
								<Icon icon={field.icon || 'ph:cube-bold'} class="h-4 w-4" /> {field.label || key.toUpperCase()}
								{#if field.required} <span class="text-red-500">*</span> {/if}
							</label>
							
							{#if field.type === 'select' && field.options}
								<select
									bind:value={formData[key]}
									class="h-16 w-full appearance-none border-2 border-black bg-slate-50 px-5 text-base font-black transition-colors focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100"
								>
									{#each field.options as opt}
										<option value={opt.value}>{opt.label}</option>
									{/each}
								</select>
							{:else if field.type === 'number'}
								<input
									type="number"
									bind:value={formData[key]}
									class="h-16 w-full border-2 border-black bg-white px-6 text-xl font-black transition-all focus:outline-none focus:ring-4 focus:ring-slate-100"
								/>
							{:else}
								<input
									type="text"
									bind:value={formData[key]}
									class="h-16 w-full border-2 border-black bg-slate-50 px-6 text-lg font-black transition-all focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-100"
									placeholder={field.placeholder || ''}
								/>
							{/if}

							{#if field.description}
								<p class="mt-2 text-[9px] font-bold italic opacity-40">{field.description}</p>
							{/if}
						</div>
					{/each}
				</div>

				<!-- 2. Dynamic Field Definition Section (for Boards) -->
				{#if appId === 'board'}
					<div class="space-y-6 pt-10 border-t-2 border-dashed border-black/10">
						<div class="flex items-center justify-between">
							<div class="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase opacity-30">
								<Icon icon="ph:list-plus-bold" class="h-4 w-4" /> Dynamic Content Fields
							</div>
							<button 
								type="button"
								onclick={addFieldDef}
								class="btn btn-xs h-8 rounded-none border-2 border-black bg-emerald-400 font-black text-black hover:bg-emerald-500"
							>
								+ New Field Def
							</button>
						</div>

						{#if (formData.fields_def || []).length === 0}
							<div class="flex h-32 items-center justify-center border-2 border-dashed border-black/10 bg-slate-50 text-[10px] font-bold italic opacity-30">
								No custom fields defined. Basic Title/Content only.
							</div>
						{:else}
							<div class="space-y-4">
								{#each formData.fields_def as fdef, idx}
									<div class="flex flex-col gap-4 border-2 border-black bg-slate-50 p-6 md:flex-row md:items-end">
										<div class="flex-1 space-y-2">
											<label class="text-[9px] font-black uppercase opacity-40">Label</label>
											<input type="text" bind:value={fdef.label} placeholder="예: 카테고리" class="h-10 w-full border border-black px-3 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
										</div>
										<div class="flex-1 space-y-2">
											<label class="text-[9px] font-black uppercase opacity-40">Key (DB)</label>
											<input type="text" bind:value={fdef.key} placeholder="예: category" class="h-10 w-full border border-black px-3 font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-blue-200" />
										</div>
										<div class="w-32 space-y-2">
											<label class="text-[9px] font-black uppercase opacity-40">Type</label>
											<select bind:value={fdef.type} class="h-10 w-full border border-black px-2 text-xs font-black focus:outline-none">
												<option value="text">Text</option>
												<option value="number">Number</option>
												<option value="date">Date</option>
												<option value="select">Select (Dropdown)</option>
											</select>
										</div>

										{#if fdef.type === 'select'}
											<div class="flex-[2] space-y-2">
												<label class="text-[9px] font-black uppercase opacity-40 text-blue-600">Choices (Comma separated)</label>
												<input type="text" bind:value={fdef.options_text} placeholder="예: 공지, 일반, 이벤트" class="h-10 w-full border-2 border-blue-600 px-3 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
											</div>
										{/if}

										<button 
											type="button" 
											onclick={() => removeFieldDef(idx)}
											class="btn btn-square h-10 w-10 min-h-0 border-2 border-black bg-red-500 text-white hover:bg-red-600"
										>
											<Icon icon="ph:trash-bold" />
										</button>
									</div>
								{/each}
							</div>
						{/if}
						<p class="text-[9px] font-bold italic opacity-40">제목(Title)과 본문(Content) 외에 추가로 저장하고 싶은 고유 데이터를 정의합니다.</p>
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
					<p class="text-[9px] font-bold italic opacity-40 text-blue-600">이곳에 추가한 값들은 인스턴스의 'options' 필드에 JSON 고유 데이터로 직결 주입됩니다.</p>
				</div>

				<!-- Action Buttons -->
				<div class="flex flex-col gap-6 pt-10 md:flex-row border-t-2 border-black">
					<button
						class="group flex h-24 flex-1 items-center justify-center gap-4 border-4 border-black bg-black text-xl font-black tracking-[0.2em] text-white uppercase transition-all hover:bg-white hover:text-black"
						onclick={handleCreate}
						disabled={isSaving}
					>
						{#if isSaving}
							<span class="loading loading-md loading-spinner"></span> Constructing...
						{:else}
							<Icon
								icon="ph:factory-bold"
								class="h-8 w-8 transition-transform group-hover:rotate-12"
							/> Build Instance
						{/if}
					</button>
				</div>

				<!-- Hint Box -->
				<div class="mt-10 flex items-start gap-4 border-2 border-black/5 bg-slate-50 p-6 text-[11px] leading-relaxed font-bold text-black/40 italic">
					<Icon icon="ph:info-bold" class="NOT-ITALIC h-5 w-5 flex-shrink-0 text-blue-600" />
					<div>
						인스턴스를 생성한 직후에는 사용자 메뉴에 자동으로 나타나지 않습니다.<br />
						필요한 경우 <strong class="text-black">[메뉴 관리]</strong> 메뉴에서 신규 메뉴 항목을 추가하고, 앱 링크 대상을 이 인스턴스로 연결해 주십시오.
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
