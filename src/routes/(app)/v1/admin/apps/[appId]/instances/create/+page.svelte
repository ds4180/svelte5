<script>
	/**
	 * @file (app)/v1/admin/apps/[appId]/instances/create/+page.svelte
	 * @description 신규 인스턴스(게시판) 생성 마법사 (Svelte 5)
	 */
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import * as api from '$lib/api/admin.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import Icon from '@iconify/svelte';

	const appId = $derived(page.params.appId);

	let isSaving = $state(false);
	let formData = $state({
		slug: '',
		name: '',
		description: '',
		layout_type: 'list',
		items_per_page: 10
	});

	async function handleCreate() {
		if (!formData.slug || !formData.name) {
			alertState.send('Slug와 Title은 필수 항목입니다.', { level: 2, style: 'warning' });
			return;
		}

		isSaving = true;
		try {
			if (appId === 'board') {
				await api.adminCreateBoard(formData);
				alertState.send(`[${formData.name}] 인스턴스가 성공적으로 생성되었습니다.`, {
					level: 1,
					style: 'success'
				});
				goto(`/v1/admin/apps/${appId}/instances`);
			} else {
				throw new Error('현재 이 앱 엔진에 대한 인스턴스 생성이 지원되지 않습니다.');
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
	<div
		class="mb-12 flex flex-col items-start justify-between gap-6 border-b-4 border-black pb-8 md:flex-row md:items-end"
	>
		<div>
			<div class="mb-2 flex items-center gap-3">
				<a
					href="/v1/admin/apps/{appId}/instances"
					class="group btn rounded-none border-black px-2 text-[9px] font-black tracking-widest uppercase btn-outline btn-xs"
				>
					<span class="transition-transform group-hover:-translate-x-1">←</span> Back to Instances
				</a>
				<span class="text-[10px] font-black tracking-[0.4em] uppercase opacity-30"
					>Factory Wizard</span
				>
			</div>
			<h1 class="text-5xl font-black tracking-tighter uppercase italic">
				{appId} <span class="NOT-ITALIC text-blue-600">Factory</span>
			</h1>
			<p class="mt-3 text-xs font-bold italic opacity-40">
				새로운 인스턴스를 설계하고 시스템에 배치합니다.
			</p>
		</div>
	</div>

	<!-- 🧬 Creation Form -->
	<div class="border-2 border-black bg-white p-10 shadow-[20px_20px_0_rgba(0,0,0,0.05)] md:p-14">
		<div class="mb-12 flex items-baseline justify-between border-b-2 border-black pb-4">
			<h3 class="mr-4 text-3xl font-black tracking-tighter uppercase italic">New Instance Build</h3>
			<span class="text-[10px] font-black tracking-widest uppercase opacity-30"
				>Specifications v1.0</span
			>
		</div>

		<div class="space-y-10">
			<!-- Basic Identifiers -->
			<div class="grid grid-cols-1 gap-10 md:grid-cols-2">
				<div class="space-y-3">
					<label
						class="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase opacity-30"
					>
						<Icon icon="ph:hash-bold" class="h-4 w-4" /> Instance Slug (ID)
					</label>
					<input
						type="text"
						bind:value={formData.slug}
						class="h-16 w-full border-2 border-black bg-slate-50 px-6 text-lg font-black text-blue-600 transition-all focus:bg-white focus:ring-4 focus:ring-blue-100 focus:outline-none"
						placeholder="예: free-board"
					/>
					<p class="mt-2 text-[9px] font-bold italic opacity-40">
						이 인스턴스의 고유 주소(URL)가 됩니다. 영문소문자와 하이픈(-)만 권장합니다.
					</p>
				</div>
				<div class="space-y-3">
					<label
						class="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase opacity-30"
					>
						<Icon icon="ph:bookmark-bold" class="h-4 w-4" /> Display Title
					</label>
					<input
						type="text"
						bind:value={formData.name}
						class="h-16 w-full border-2 border-black bg-slate-50 px-6 text-lg font-black transition-all focus:bg-white focus:ring-4 focus:ring-blue-100 focus:outline-none"
						placeholder="예: 자유게시판"
					/>
					<p class="mt-2 text-[9px] font-bold italic opacity-40">
						사용자에게 보여질 실제 명칭입니다.
					</p>
				</div>
			</div>

			<!-- Description -->
			<div class="space-y-3">
				<label
					class="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase opacity-30"
				>
					<Icon icon="ph:text-align-left-bold" class="h-4 w-4" /> Description
				</label>
				<input
					type="text"
					bind:value={formData.description}
					class="h-16 w-full border-2 border-black bg-white px-6 font-bold transition-all focus:ring-4 focus:ring-slate-100 focus:outline-none"
					placeholder="사용자와 관리자에게 보여줄 짧은 설명"
				/>
			</div>

			<!-- UI Configuration -->
			<div class="grid grid-cols-1 gap-10 border-t-2 border-slate-100 pt-10 md:grid-cols-2">
				<div class="space-y-3">
					<label
						class="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase opacity-30"
					>
						<Icon icon="ph:layout-bold" class="h-4 w-4" /> Layout Style
					</label>
					<select
						bind:value={formData.layout_type}
						class="h-16 w-full appearance-none border-2 border-black bg-slate-50 px-5 text-base font-black transition-colors focus:bg-white"
					>
						<option value="list">List Style (Standard)</option>
						<option value="gallery">Gallery Style (Image Centered)</option>
						<option value="blog">Blog Style (Summary/Full Body)</option>
					</select>
				</div>
				<div class="space-y-3">
					<label
						class="flex items-center gap-2 text-[10px] font-black tracking-[0.2em] uppercase opacity-30"
					>
						<Icon icon="ph:list-numbers-bold" class="h-4 w-4" /> Items Per Page
					</label>
					<input
						type="number"
						bind:value={formData.items_per_page}
						class="h-16 w-full border-2 border-black bg-white px-6 text-center text-lg font-black transition-all focus:outline-none"
						min="1"
						max="100"
					/>
				</div>
			</div>

			<!-- Action Buttons -->
			<div class="flex flex-col gap-6 pt-10 md:flex-row">
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
				<button
					class="h-24 border-2 border-black px-10 text-[10px] font-black tracking-widest uppercase opacity-40 transition-all hover:bg-slate-50 hover:opacity-100"
					onclick={() =>
						(formData = {
							slug: '',
							name: '',
							description: '',
							layout_type: 'list',
							items_per_page: 10
						})}
				>
					Wipe Clean
				</button>
			</div>

			<!-- Hint Box -->
			<div
				class="mt-10 flex items-start gap-4 border-2 border-black/5 bg-slate-50 p-6 text-[11px] leading-relaxed font-bold text-black/40 italic"
			>
				<Icon icon="ph:info-bold" class="NOT-ITALIC h-5 w-5 flex-shrink-0 text-blue-600" />
				<div>
					인스턴스를 생성한 직후에는 사용자 메뉴에 자동으로 나타나지 않습니다.<br />
					필요한 경우 <strong class="text-black">[메뉴 관리]</strong> 메뉴에서 신규 메뉴 항목을 추가하고,
					앱 링크 대상을 이 인스턴스로 연결해 주십시오.
				</div>
			</div>
		</div>
	</div>
</div>
