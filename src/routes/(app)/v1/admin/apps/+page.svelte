<script>
	/**
	 * @file (app)/v1/admin/apps/+page.svelte
	 * @description 시스템 앱(App) 및 서비스(Service) 엔진 레지스트리 관리자 (Svelte 5)
	 * @features 신규 앱 등록(POST), 기존 앱 수정(PATCH), 백엔드 스키마 완전 동기화
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin.js';
	import { toast } from '$lib/runes/toast.svelte.ts';
	import { fade, fly } from 'svelte/transition';
	import Icon from '@iconify/svelte';

	let apps = $state([]);
	let loading = $state(true);
	let isEditMode = $state(false); // 등록/수정 모드 판별

	// 백엔드 admin_schema.py의 AppRegistryBase 및 AppRegistryUpdate 모델 필드 전체 반영
	let editingApp = $state({
		app_id: '',
		name: '',
		title: '',
		description: '',
		app_type: 'INSTANCE',
		frontend_route: '',
		main_component: '',
		icon_default: '🚀',
		min_read_rank: 0,
		min_write_rank: 2,
		is_active: true
	});

	/**
	 * @function loadApps
	 * @description DB로부터 등록된 앱 엔진 목록 로드
	 */
	async function loadApps() {
		loading = true;
		try {
			apps = await api.adminGetApps();
		} catch (e) {
			toast.error(e.message);
		} finally {
			loading = false;
		}
	}

	onMount(loadApps);

	/**
	 * @function startCreate
	 * @description 신규 등록 모드로 전환 (폼 초기화)
	 */
	function startCreate() {
		isEditMode = false;
		resetForm();
		document.getElementById('form-anchor')?.scrollIntoView({ behavior: 'smooth' });
	}

	/**
	 * @function startEdit
	 * @description 특정 앱 수정 모드로 전환
	 */
	function startEdit(app) {
		isEditMode = true;
		editingApp = {
			...app,
			app_type: app.app_type === 'STATIC' ? 'CUSTOM' : (app.app_type || 'INSTANCE'),
			min_read_rank: Number(app.min_read_rank ?? 0),
			min_write_rank: Number(app.min_write_rank ?? 2)
		};
		document.getElementById('form-anchor')?.scrollIntoView({ behavior: 'smooth' });
	}

	/**
	 * @function handleDelete
	 * @description 앱 삭제 (SYSTEM 앱은 삭제 불가)
	 */
	async function handleDelete(app) {
		if (app.app_type === 'SYSTEM') {
			toast.warning('SYSTEM 앱은 시스템 필수 관제 앱이므로 삭제할 수 없습니다.');
			return;
		}
		if (!confirm(`'${app.title || app.name || app.app_id}' 앱을 삭제하시겠습니까?`)) return;
		try {
			await api.adminDeleteApp(app.app_id);
			toast.success('앱이 삭제되었습니다.');
			if (editingApp.app_id === app.app_id) {
				resetForm();
				isEditMode = false;
			}
			await loadApps();
		} catch (e) {
			toast.error(e.message);
		}
	}

	function resetForm() {
		editingApp = {
			app_id: '',
			name: '',
			title: '',
			description: '',
			app_type: 'INSTANCE',
			frontend_route: '',
			main_component: '',
			icon_default: '🚀',
			min_read_rank: 0,
			min_write_rank: 2,
			is_active: true
		};
	}

	/**
	 * @function handleSave
	 * @description 모드에 따라 POST(신규) 또는 PATCH(수정) 호출
	 */
	async function handleSave() {
		if (!editingApp.app_id || !editingApp.name) {
			toast.warning('ID와 내부 이름은 필수 항목입니다.');
			return;
		}

		try {
			// 전송 전 데이터 정제
			const { app_id, ...updateData } = editingApp; // 👈 app_id를 추출하여 분리

			const payload = {
				...updateData, // 👈 수정 시에는 app_id 제외
				min_read_rank: Number(editingApp.min_read_rank),
				min_write_rank: Number(editingApp.min_write_rank)
			};

			if (isEditMode) {
				// 기존 앱 수정 (PATCH) - URL에만 id가 들어가고 body에는 빠져야 함
				await api.adminUpdateApp(app_id, payload);
				toast.success('앱 엔진 설정이 업데이트되었습니다.');
			} else {
				// 신규 앱 등록 (POST) - 여기서는 app_id가 포함된 전체 데이터(editingApp) 필요
				await api.adminCreateApp(editingApp);
				toast.success('새로운 앱 엔진이 등록되었습니다.');
			}

			resetForm();
			isEditMode = false;
			await loadApps();
		} catch (e) {
			toast.error(e.message);
		}
	}
</script>

<svelte:head>
	<title>앱 설치 등록 | jeju.live Core</title>
</svelte:head>

<div class="animate-fade-in mx-auto max-w-7xl space-y-12 px-4 pb-40 font-['Outfit','Noto_Sans_KR'] text-black">
	<!-- 📄 Page Title -->
	<div
		class="flex flex-col items-start justify-between gap-6 border-b-4 border-black pb-8 md:flex-row md:items-end"
	>
		<div>
			<span class="mb-2 block text-[10px] font-black tracking-[0.4em] uppercase opacity-30"
				>Engine Infrastructure Registry</span
			>
			<h1 class="text-5xl font-black tracking-tighter uppercase italic">
				앱 <span class="NOT-ITALIC text-blue-600">설치 등록</span>
			</h1>
			<p class="mt-3 text-xs font-bold opacity-40">
				시스템 엔진들의 메타데이터와 보안 등급을 관리합니다.
			</p>
		</div>
		<div class="flex gap-4">
			<button
				class="btn-black btn h-14 rounded-none border-2 border-black px-8 font-black uppercase transition-all"
				onclick={startCreate}
			>
				+ 새 앱 등록
			</button>
			<button
				class="btn h-14 rounded-none border-2 border-black px-8 font-black uppercase transition-all btn-outline hover:bg-black hover:text-white"
				onclick={loadApps}
			>
				동기화
			</button>
		</div>
	</div>

	<div class="grid grid-cols-1 items-start gap-10 lg:grid-cols-12">
		<!-- 📦 등록된 앱 엔진 목록 -->
		<div class="space-y-6 lg:col-span-7">
			<h3 class="mb-4 text-xl font-black tracking-tighter uppercase italic">등록된 앱 엔진 목록</h3>

			{#if loading}
				<div
					class="flex h-60 items-center justify-center border border-dashed border-black font-black uppercase italic opacity-20 grayscale"
				>
					앱 레지스트리 분석 중...
				</div>
			{:else}
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					{#each apps as app (app.app_id)}
						<div
							class="group relative overflow-hidden border-2 border-black bg-white p-6 transition-all hover:bg-slate-50"
						>
							{#if !app.is_active}
								<div
									class="absolute inset-0 z-10 flex items-center justify-center bg-white/80 text-sm font-black tracking-widest text-red-500 uppercase"
								>
									비활성화됨
								</div>
							{/if}
							<div class="mb-4 flex items-start justify-between">
								<div
									class="flex h-10 w-10 items-center justify-center bg-black text-xl font-black text-white"
								>
									{#if app.icon_default && app.icon_default.includes(':')}
										<Icon icon={app.icon_default} class="text-2xl" />
									{:else}
										{app.icon_default || app.app_id.substring(0, 1).toUpperCase()}
									{/if}
								</div>
								<div class="flex items-center gap-1">
									<a
										href={`/v1/admin/observability?app_id=${app.app_id}&tab=CHANGE`}
										class="btn rounded-none border-blue-600 bg-blue-50 text-[9px] font-black text-blue-700 uppercase btn-outline btn-xs hover:bg-blue-600 hover:text-white"
										title="해당 앱의 실시간 감사로그 및 변경 내역 관제"
									>
										로그 📜
									</a>
									<button
										class="btn rounded-none border-black text-[9px] font-black uppercase btn-outline btn-xs hover:bg-black hover:text-white"
										onclick={() => startEdit(app)}>수정</button
									>
									{#if app.app_type !== 'SYSTEM'}
										<button
											class="btn rounded-none border-rose-600 text-[9px] font-black text-rose-600 uppercase btn-outline btn-xs hover:bg-rose-600 hover:text-white"
											onclick={() => handleDelete(app)}>삭제</button
										>
									{:else}
										<span
											class="border border-purple-600/40 bg-purple-50 px-1.5 py-0.5 text-[8px] font-black text-purple-700 uppercase"
											title="SYSTEM 앱은 삭제할 수 없습니다">보호됨</span
										>
									{/if}
								</div>
							</div>
							<h4 class="mb-1 text-lg font-black tracking-tight uppercase italic">
								{app.title || app.name || app.app_id}
							</h4>
							<div class="mb-2 flex items-center justify-between">
								<div
									class="text-[9px] font-black {app.app_type === 'CUSTOM' || app.app_type === 'STATIC'
										? 'text-rose-600'
										: app.app_type === 'SYSTEM'
											? 'text-purple-600'
											: 'text-blue-600'} tracking-tighter uppercase opacity-80"
								>
									{app.app_type === 'STATIC' ? 'CUSTOM' : app.app_type} APP
								</div>
								{#if app.app_type === 'INSTANCE'}
									<a
										href="/v1/admin/apps/{app.app_id}/instances"
										class="flex items-center gap-1 text-[9px] font-black tracking-tighter text-emerald-600 uppercase hover:underline"
									>
										<Icon icon="mdi:layers-plus" class="h-3.5 w-3.5" />
										인스턴스
									</a>
								{/if}
							</div>
							<p
								class="mb-4 line-clamp-2 h-8 overflow-hidden text-[10px] leading-relaxed font-bold opacity-40"
							>
								{app.description || '등록된 설명이 없습니다.'}
							</p>

							<div class="space-y-2 border-t border-black/5 pt-3">
								<div class="flex items-center justify-between text-[10px] font-bold">
									<span class="text-[8px] uppercase opacity-20">진입 경로</span>
									<span class="font-mono">{app.frontend_route}</span>
								</div>
								<div class="mt-2 flex gap-2">
									<span class="badge h-4 rounded-none badge-outline px-1 text-[8px] font-black"
										>읽기 R{app.min_read_rank}</span
									>
									<span class="badge h-4 rounded-none badge-outline px-1 text-[8px] font-black"
										>쓰기 R{app.min_write_rank}</span
									>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<!-- 📝 앱 설정 폼 (POST/PATCH 공용) -->
		<div class="lg:col-span-5" id="form-anchor">
			<div
				class="sticky top-24 border-2 border-black bg-white p-8 shadow-[15px_15px_0_rgba(0,0,0,0.05)] md:p-10"
			>
				<div class="mb-10 flex items-baseline justify-between border-b-2 border-black pb-4">
					<h3 class="text-2xl font-black tracking-tighter uppercase italic">
						{isEditMode ? '앱 엔진 정보 수정' : '신규 앱 엔진 등록'}
					</h3>
					<span class="text-[9px] font-black uppercase italic opacity-40"
						>{isEditMode ? 'Update' : 'New'} Core v5.1</span
					>
				</div>

				<div class="space-y-6">
					<div class="grid grid-cols-2 gap-4">
						<div class="space-y-2">
							<label class="text-[9px] font-black tracking-widest uppercase opacity-30"
								>앱 식별자 (app_id)</label
							>
							<input
								type="text"
								bind:value={editingApp.app_id}
								readonly={isEditMode}
								class="h-12 w-full border border-black bg-slate-50 px-4 text-xs font-bold transition-all focus:bg-white focus:outline-none {isEditMode
									? 'cursor-not-allowed opacity-50'
									: ''}"
								placeholder="board, page 등"
							/>
						</div>
						<div class="space-y-2">
							<label class="text-[9px] font-black tracking-widest uppercase opacity-30"
								>내부 명칭 (name)</label
							>
							<input
								type="text"
								bind:value={editingApp.name}
								class="h-12 w-full border border-black bg-slate-50 px-4 text-xs font-bold transition-all focus:bg-white focus:outline-none"
								placeholder="앱 공식 명칭"
							/>
						</div>
					</div>

					<div class="space-y-2">
						<label class="text-[9px] font-black tracking-widest uppercase opacity-30"
							>표시 타이틀 (title)</label
						>
						<input
							type="text"
							bind:value={editingApp.title}
							class="h-12 w-full border border-black bg-slate-50 px-4 font-bold transition-all focus:bg-white focus:outline-none"
							placeholder="UI에 표시될 명칭"
						/>
					</div>

					<div class="space-y-2">
						<label class="text-[9px] font-black tracking-widest uppercase opacity-30"
							>설명 (description)</label
						>
						<textarea
							bind:value={editingApp.description}
							class="h-20 w-full resize-none border border-black bg-slate-50 p-4 text-xs font-bold transition-all focus:bg-white focus:outline-none"
							placeholder="엔진 기능 요약 설명"
						></textarea>
					</div>

					<div class="grid grid-cols-2 gap-4 border-t border-black/5 pt-6">
						<div class="space-y-2">
							<label class="text-[9px] font-black tracking-widest uppercase opacity-30"
								>앱 유형 (app_type)</label
							>
							<select
								bind:value={editingApp.app_type}
								class="h-12 w-full border border-black bg-slate-50 px-4 text-xs font-black"
							>
								<option value="INSTANCE">INSTANCE (추상화 다중 인스턴스)</option>
								<option value="CUSTOM">CUSTOM (추상화 제외 단일 앱)</option>
								<option value="SYSTEM">SYSTEM (관리자 전용 · 삭제 불가)</option>
							</select>
						</div>
						<div class="space-y-2">
							<label class="text-[9px] font-black tracking-widest uppercase opacity-30"
								>컴포넌트 명칭 (main_component)</label
							>
							<input
								type="text"
								bind:value={editingApp.main_component}
								class="h-12 w-full border border-black bg-slate-50 px-4 font-mono text-xs font-bold transition-all focus:bg-white focus:outline-none"
								placeholder="예: BoardEngine"
							/>
						</div>
					</div>

					<div class="space-y-2">
						<label class="text-[9px] font-black tracking-widest uppercase opacity-30"
							>진입 경로 (frontend_route)</label
						>
						<input
							type="text"
							bind:value={editingApp.frontend_route}
							class="h-12 w-full border border-black bg-slate-50 px-4 font-mono text-xs font-bold transition-all focus:bg-white focus:outline-none"
							placeholder={editingApp.app_type === 'CUSTOM'
								? '/v1/custom/앱이름'
								: editingApp.app_type === 'SYSTEM'
									? '/v1/admin/앱이름'
									: '/v1/app/엔진명/[slug]'}
						/>
					</div>

					<div class="grid grid-cols-3 gap-4 border-t border-black/5 pt-6">
						<div class="space-y-2">
							<label class="text-[9px] font-black tracking-widest uppercase opacity-30"
								>읽기 최소 랭크 (min_read_rank)</label
							>
							<select
								bind:value={editingApp.min_read_rank}
								class="h-12 w-full border border-black bg-slate-50 px-4 text-xs font-black"
							>
								<option value={0}>R0 (Guest)</option>
								<option value={1}>R1 (Staff)</option>
								<option value={2}>R2 (Manager)</option>
								<option value={4}>R4 (Admin)</option>
							</select>
						</div>
						<div class="space-y-2">
							<label class="text-[9px] font-black tracking-widest uppercase opacity-30"
								>쓰기 최소 랭크 (min_write_rank)</label
							>
							<select
								bind:value={editingApp.min_write_rank}
								class="h-12 w-full border border-black bg-slate-50 px-4 text-xs font-black"
							>
								<option value={0}>R0 (Guest)</option>
								<option value={1}>R1 (Staff)</option>
								<option value={2}>R2 (Manager)</option>
								<option value={4}>R4 (Admin)</option>
							</select>
						</div>
						<div class="space-y-2">
							<label class="text-[9px] font-black tracking-widest uppercase opacity-30">아이콘 (icon_default)</label>
							<input
								type="text"
								bind:value={editingApp.icon_default}
								class="h-12 w-full border border-black bg-slate-50 px-4 text-center text-xl font-black transition-all focus:bg-white focus:outline-none"
								placeholder="mdi:apps (Iconify)"
							/>
						</div>
					</div>

					<div class="flex items-center gap-4 py-4">
						<label
							class="flex h-12 cursor-pointer items-center gap-4 border border-black bg-white px-6 text-[10px] font-black uppercase transition-colors hover:bg-slate-50"
						>
							<input
								type="checkbox"
								bind:checked={editingApp.is_active}
								class="checkbox rounded-none checkbox-xs"
							/>
							앱 엔진 활성화
						</label>
					</div>

					<div class="flex gap-4 pt-6">
						<button
							class="h-16 flex-1 border-2 border-black bg-black text-lg font-black tracking-widest text-white uppercase transition-all hover:bg-white hover:text-black"
							onclick={handleSave}
						>
							{isEditMode ? '수정 사항 저장' : '새 앱 엔진 등록'}
						</button>
						<button
							class="h-16 w-20 border-2 border-black text-[10px] font-black uppercase transition-all hover:bg-slate-100"
							onclick={resetForm}
						>
							초기화
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	:global(.btn) {
		border-radius: 0;
	}
</style>
