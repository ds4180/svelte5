<script>
	/**
	 * @file (app)/v1/admin/services/+page.svelte
	 * @description 서비스 엔진 및 앱 통합 관리 페이지 (Lego Architecture)
	 *              - 전사 표준 모던 엔터프라이즈 헤더 & 4대 핵심 관제 지표 요약 카드
	 *              - 반응형 카드 기반 본문 레이아웃 (모바일 세로/태블릿/데스크탑 최적화)
	 *              - 브라우저 탭 단일 진실 공급원(SSOT) 환경설정 타이틀 연동
	 *              - 4대 탭 기반 네비게이션 (번들 / 앱 / 엔진 / 레지스트리)
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin';
	import { toast } from '$lib/runes/toast.svelte';
	import { getSiteTitle } from '$lib/config/site';
	import Icon from '@iconify/svelte';
	import { fade, fly } from 'svelte/transition';

	let registries = $state(/** @type {any[]} */ ([]));
	let engines = $state(/** @type {any[]} */ ([]));
	let serviceApps = $state(/** @type {any[]} */ ([]));
	let serviceInstances = $state(/** @type {any[]} */ ([]));
	let loading = $state(true);
	let activeTab = $state('instances'); // instances, apps, engines, registries

	// 📊 4대 관제 지표 요약 수치
	const countInstances = $derived(serviceInstances.length);
	const countApps = $derived(serviceApps.length);
	const countEngines = $derived(engines.length);
	const countRegistries = $derived(registries.length);

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
		} catch (/** @type {any} */ err) {
			toast.error('데이터 로드 실패: ' + (err.message || '오류 발생'));
		} finally {
			loading = false;
		}
	}

	onMount(loadAll);

	// --- [CRUD Helpers] ---
	let showModal = $state(false);
	let modalType = $state(''); // registry, engine, app, instance
	let formData = $state(/** @type {any} */ ({}));

	/**
	 * @param {string} type
	 * @param {any} target
	 */
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
			toast.success('성공적으로 저장되었습니다.');
			showModal = false;
			loadAll();
		} catch (/** @type {any} */ err) {
			toast.error('저장 실패: ' + (err.message || '오류 발생'));
		}
	}

	/**
	 * @param {string} type
	 * @param {any} id
	 */
	async function handleDelete(type, id) {
		if (!confirm('정말 삭제하시겠습니까?')) return;
		try {
			if (type === 'registry') await api.adminDeleteServiceRegistry(id);
			else if (type === 'engine') await api.adminDeleteServiceEngine(id);
			else if (type === 'instance') await api.adminDeleteServiceInstance(id);
			toast.success('삭제되었습니다.');
			loadAll();
		} catch (/** @type {any} */ err) {
			toast.error('삭제 실패: ' + (err.message || '오류 발생'));
		}
	}
</script>

<svelte:head>
	<title>{getSiteTitle('서비스 마스터 (Add-on)')}</title>
</svelte:head>

<div class="animate-fade-in mx-auto max-w-7xl space-y-8 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:px-8">
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 우측 컨트롤 바 -->
	<!-- ===================================================================== -->
	<header class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end">
		<div>
			<div class="flex items-center gap-2 mb-2">
				<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-rose-50 text-rose-700 border border-rose-200">
					<Icon icon="ph:lego-bold" class="text-sm" />
					SYSTEM GOVERNANCE • MODULAR SERVICES
				</span>
				<span class="text-xs font-bold text-slate-400 font-mono">v1/admin/services</span>
			</div>
			<h1 class="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
				서비스 <span class="not-italic text-rose-600">마스터 (Add-on)</span>
			</h1>
			<p class="mt-2 text-xs sm:text-sm font-bold text-slate-500">
				댓글, 업로드, 추천 등 독립된 레고형 서비스 번들을 관리하고 앱 인스턴스에 주입합니다.
			</p>
		</div>

		<!-- 상단 액션 버튼 그룹 -->
		<div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
			<button
				onclick={() =>
					openModal(
						activeTab === 'apps'
							? 'app'
							: activeTab === 'engines'
								? 'engine'
								: activeTab === 'registries'
									? 'registry'
									: 'instance'
					)}
				class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-rose-600 bg-rose-600 text-white font-black text-xs uppercase tracking-wider hover:bg-rose-700 transition shadow-sm"
			>
				<Icon icon="ph:plus-circle-bold" class="text-base" />
				<span>
					{activeTab === 'apps'
						? '새 서비스 앱 추가'
						: activeTab === 'engines'
							? '엔진 추가 등록'
							: activeTab === 'registries'
								? '레지스트리 추가'
								: '새 번들 생성'}
				</span>
			</button>

			<button
				onclick={loadAll}
				disabled={loading}
				class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-slate-200 bg-white font-black text-xs uppercase tracking-wider text-slate-700 hover:border-slate-400 transition shadow-sm disabled:opacity-50"
			>
				<Icon icon="ph:arrows-clockwise-bold" class="text-base {loading ? 'animate-spin' : ''}" />
				<span>새로고침</span>
			</button>

			<a
				href="/v1/admin"
				class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-slate-200 bg-white font-black text-xs uppercase tracking-wider text-slate-700 hover:border-slate-400 transition shadow-sm"
			>
				<Icon icon="ph:house-bold" class="text-base text-slate-500" />
				<span>관리자 홈</span>
			</a>
		</div>
	</header>

	<!-- ===================================================================== -->
	<!-- 2. 알림/요약 지표 카드 (최대 4개, 최소 1개 규격) -->
	<!-- ===================================================================== -->
	<section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
		<!-- 카드 1: 서비스 번들 -->
		<button
			onclick={() => (activeTab = 'instances')}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {activeTab === 'instances' ? 'border-rose-500 bg-rose-50/20 ring-2 ring-rose-500/20' : 'border-slate-100 hover:border-rose-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-rose-600">Service Bundles</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:package-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countInstances}
				<span class="text-sm font-bold text-slate-400 ml-1">개 번들</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-rose-600">
				<span class="rounded-lg bg-rose-50 px-2 py-0.5 font-mono">조합 세트</span>
			</div>
		</button>

		<!-- 카드 2: 서비스 앱 -->
		<button
			onclick={() => (activeTab = 'apps')}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {activeTab === 'apps' ? 'border-purple-500 bg-purple-50/20 ring-2 ring-purple-500/20' : 'border-slate-100 hover:border-purple-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-purple-600">Service Apps</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:puzzle-piece-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countApps}
				<span class="text-sm font-bold text-slate-400 ml-1">개 모듈</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-purple-600">
				<span class="rounded-lg bg-purple-50 px-2 py-0.5 font-mono">독립 기능</span>
			</div>
		</button>

		<!-- 카드 3: 구동 엔진 -->
		<button
			onclick={() => (activeTab = 'engines')}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {activeTab === 'engines' ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/20' : 'border-slate-100 hover:border-emerald-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-emerald-600">Engines</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:cpu-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countEngines}
				<span class="text-sm font-bold text-slate-400 ml-1">개 엔진</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-emerald-600">
				<span class="rounded-lg bg-emerald-50 px-2 py-0.5 font-mono">런타임 코어</span>
			</div>
		</button>

		<!-- 카드 4: 레지스트리 -->
		<button
			onclick={() => (activeTab = 'registries')}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {activeTab === 'registries' ? 'border-amber-500 bg-amber-50/20 ring-2 ring-amber-500/20' : 'border-slate-100 hover:border-amber-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-amber-600">Registries</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:books-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countRegistries}
				<span class="text-sm font-bold text-slate-400 ml-1">개 등록소</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-amber-600">
				<span class="rounded-lg bg-amber-50 px-2 py-0.5 font-mono">프로토콜 규격</span>
			</div>
		</button>
	</section>

	<!-- ===================================================================== -->
	<!-- 3. 모드 탭 바 (최소 1개, 일관성 및 확장성) -->
	<!-- ===================================================================== -->
	<nav class="flex gap-2 border-b-2 border-slate-200 overflow-x-auto no-scrollbar">
		<button
			onclick={() => (activeTab = 'instances')}
			class="px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeTab === 'instances' ? 'border-b-4 border-rose-600 text-rose-700 bg-rose-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
		>
			서비스 번들 ({serviceInstances.length})
		</button>
		<button
			onclick={() => (activeTab = 'apps')}
			class="px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeTab === 'apps' ? 'border-b-4 border-rose-600 text-rose-700 bg-rose-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
		>
			서비스 앱 ({serviceApps.length})
		</button>
		<button
			onclick={() => (activeTab = 'engines')}
			class="px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeTab === 'engines' ? 'border-b-4 border-rose-600 text-rose-700 bg-rose-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
		>
			구동 엔진 ({engines.length})
		</button>
		<button
			onclick={() => (activeTab = 'registries')}
			class="px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeTab === 'registries' ? 'border-b-4 border-rose-600 text-rose-700 bg-rose-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
		>
			레지스트리 ({registries.length})
		</button>
	</nav>

	<!-- ===================================================================== -->
	<!-- 4. 본문 컨텐츠 (반응형 카드 형식 위주) -->
	<!-- ===================================================================== -->
	{#if loading}
		<div class="flex justify-center py-20">
			<div class="flex flex-col items-center gap-3">
				<div class="h-10 w-10 animate-spin rounded-full border-4 border-rose-600 border-t-transparent"></div>
				<p class="text-xs font-bold text-slate-400 font-mono">서비스 마스터 스캔 중...</p>
			</div>
		</div>
	{:else if activeTab === 'instances'}
		<!-- 탭 1: 서비스 번들 카드 목록 -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
			{#each serviceInstances as inst}
				<div class="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm hover:border-rose-400 transition-all flex flex-col justify-between">
					<div>
						<div class="flex justify-between items-start mb-3">
							<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 text-2xl">
								<Icon icon="ph:package-bold" />
							</div>
							<div class="flex items-center gap-1.5">
								<button
									type="button"
									onclick={() => openModal('instance', inst)}
									class="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition"
								>
									수정
								</button>
								<button
									type="button"
									onclick={() => handleDelete('instance', inst.id)}
									class="px-2.5 py-1 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition"
								>
									삭제
								</button>
							</div>
						</div>
						<h3 class="text-xl font-black text-slate-900 tracking-tight">{inst.name}</h3>
						<div class="flex flex-wrap gap-1.5 mt-3">
							{#each (inst.service_app_ids || []) as appId}
								<span class="text-[10px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200">
									{serviceApps.find((a) => a.id === appId)?.name || appId}
								</span>
							{/each}
						</div>
					</div>

					<div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
						<span class="text-xs text-slate-400 font-mono">id: {inst.id}</span>
						<a href="/v1/admin/services/binding" class="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1">
							<span>바인딩 관리</span>
							<Icon icon="ph:arrow-right-bold" class="text-xs" />
						</a>
					</div>
				</div>
			{/each}

			<button
				type="button"
				onclick={() => openModal('instance')}
				class="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center flex flex-col items-center justify-center hover:border-rose-400 hover:bg-rose-50/30 transition min-h-[180px] group"
			>
				<Icon icon="ph:plus-circle-bold" class="text-3xl text-slate-300 group-hover:text-rose-500 transition mb-2" />
				<span class="text-xs font-black uppercase text-slate-400 group-hover:text-rose-600 transition">새 번들 생성</span>
			</button>
		</div>
	{:else if activeTab === 'apps'}
		<!-- 탭 2: 서비스 앱 카드 목록 -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
			{#each serviceApps as app}
				<div class="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm hover:border-purple-400 transition-all flex flex-col justify-between">
					<div>
						<div class="flex items-center justify-between mb-3">
							<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 text-2xl">
								<Icon icon="ph:puzzle-piece-bold" />
							</div>
							<button
								type="button"
								onclick={() => openModal('app', app)}
								class="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition"
							>
								수정
							</button>
						</div>
						<h3 class="text-xl font-black text-slate-900 tracking-tight">{app.name}</h3>
						<div class="mt-3 space-y-1 text-xs text-slate-500">
							<p><span class="font-bold text-slate-400">엔진:</span> {app.engine_id}</p>
							<p><span class="font-bold text-slate-400">체인:</span> {app.child_app_id || '없음'}</p>
						</div>
					</div>

					<div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
						<span class="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
							Active
						</span>
						<span class="text-xs text-slate-400 font-mono">id: {app.id}</span>
					</div>
				</div>
			{/each}

			<button
				type="button"
				onclick={() => openModal('app')}
				class="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center flex flex-col items-center justify-center hover:border-purple-400 hover:bg-purple-50/30 transition min-h-[180px] group"
			>
				<Icon icon="ph:plus-circle-bold" class="text-3xl text-slate-300 group-hover:text-purple-500 transition mb-2" />
				<span class="text-xs font-black uppercase text-slate-400 group-hover:text-purple-600 transition">새 서비스 앱 추가</span>
			</button>
		</div>
	{:else if activeTab === 'engines'}
		<!-- 탭 3: 구동 엔진 목록 -->
		<div class="overflow-x-auto rounded-2xl border-2 border-slate-200 bg-white">
			<table class="w-full text-left text-xs">
				<thead class="bg-slate-50 text-[11px] font-black uppercase text-slate-400 border-b border-slate-200">
					<tr>
						<th class="px-6 py-4">ID / Version</th>
						<th class="px-6 py-4">Registry</th>
						<th class="px-6 py-4">Frontend Plugin</th>
						<th class="px-6 py-4 text-right">Actions</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-100 font-bold">
					{#each engines as engine}
						<tr class="hover:bg-slate-50">
							<td class="px-6 py-4 font-mono font-black text-slate-900">{engine.id} ({engine.version || 'v1'})</td>
							<td class="px-6 py-4 text-rose-600 font-black uppercase">{engine.registry_id}</td>
							<td class="px-6 py-4">
								<span class="rounded-lg bg-blue-50 px-2.5 py-1 text-xs text-blue-700 font-mono border border-blue-200">
									{engine.frontend_plugin || '-'}
								</span>
							</td>
							<td class="px-6 py-4 text-right">
								<button onclick={() => handleDelete('engine', engine.id)} class="text-rose-500 hover:underline font-bold">
									삭제
								</button>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<div class="p-5 border-t border-slate-100 bg-slate-50/50">
				<button
					type="button"
					onclick={() => openModal('engine')}
					class="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-slate-300 bg-white text-xs font-black uppercase tracking-wider text-slate-700 hover:border-slate-900 hover:bg-slate-900 hover:text-white transition"
				>
					<Icon icon="ph:plus-bold" />
					<span>엔진 추가 등록</span>
				</button>
			</div>
		</div>
	{:else}
		<!-- 탭 4: 레지스트리 목록 -->
		<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
			{#each registries as reg}
				<div class="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between hover:border-amber-400 transition-all">
					<div>
						<div class="flex items-center justify-between mb-3">
							<span class="text-xs font-black text-rose-600 uppercase tracking-widest font-mono bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200">
								{reg.id}
							</span>
							<button
								type="button"
								onclick={() => handleDelete('registry', reg.id)}
								class="px-2.5 py-1 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition"
							>
								삭제
							</button>
						</div>
						<h4 class="text-lg font-black text-slate-900">{reg.name}</h4>
						<p class="text-xs text-slate-500 mt-1.5 leading-relaxed">{reg.description || '등록된 설명이 없습니다.'}</p>
					</div>
				</div>
			{/each}

			<button
				type="button"
				onclick={() => openModal('registry')}
				class="rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center flex flex-col items-center justify-center hover:border-amber-400 hover:bg-amber-50/30 transition min-h-[150px] group"
			>
				<Icon icon="ph:plus-circle-bold" class="text-3xl text-slate-300 group-hover:text-amber-500 transition mb-2" />
				<span class="text-xs font-black uppercase text-slate-400 group-hover:text-amber-600 transition">레지스트리 추가</span>
			</button>
		</div>
	{/if}
</div>

<!-- 모달 다이얼로그 (생성/수정) -->
{#if showModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		transition:fade
		onclick={() => (showModal = false)}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
	>
		<div
			transition:fly={{ y: 30 }}
			onclick={(e) => e.stopPropagation()}
			class="w-full max-w-xl rounded-3xl border-2 border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
		>
			<header class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-5 sm:px-8">
				<div>
					<span class="text-[10px] font-black tracking-widest text-rose-600 uppercase">Service Architecture</span>
					<h3 class="text-xl font-black text-slate-900 uppercase">
						{formData.id && modalType !== 'registry' && modalType !== 'engine' ? '수정' : '신규 생성'} ({modalType})
					</h3>
				</div>
				<button type="button" onclick={() => (showModal = false)} class="text-slate-400 hover:text-slate-700 p-1">
					<Icon icon="ph:x-bold" class="text-xl" />
				</button>
			</header>

			<div class="p-6 sm:p-8 space-y-5 overflow-y-auto">
				{#if modalType === 'registry'}
					<div>
						<label for="reg-id-input" class="block text-xs font-black text-slate-700 mb-1.5">Registry ID (Key)</label>
						<input
							id="reg-id-input"
							type="text"
							bind:value={formData.id}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-mono font-bold focus:border-rose-600 focus:outline-none transition"
							placeholder="예: comment, upload"
						/>
					</div>
					<div>
						<label for="reg-name-input" class="block text-xs font-black text-slate-700 mb-1.5">Display Name</label>
						<input
							id="reg-name-input"
							type="text"
							bind:value={formData.name}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold focus:border-rose-600 focus:outline-none transition"
							placeholder="예: 댓글 서비스"
						/>
					</div>
				{:else if modalType === 'engine'}
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label for="engine-id-input" class="block text-xs font-black text-slate-700 mb-1.5">Engine ID</label>
							<input
								id="engine-id-input"
								type="text"
								bind:value={formData.id}
								class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-mono font-bold focus:border-rose-600 focus:outline-none transition"
								placeholder="예: comment_v1"
							/>
						</div>
						<div>
							<label for="engine-reg-select" class="block text-xs font-black text-slate-700 mb-1.5">Registry Group</label>
							<select
								id="engine-reg-select"
								bind:value={formData.registry_id}
								class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold bg-white focus:border-rose-600 focus:outline-none transition"
							>
								<option value="">-- 레지스트리 선택 --</option>
								{#each registries as r}
									<option value={r.id}>{r.name} ({r.id})</option>
								{/each}
							</select>
						</div>
					</div>
					<div>
						<label for="engine-plugin-input" class="block text-xs font-black text-slate-700 mb-1.5">Frontend Plugin (Svelte Component)</label>
						<input
							id="engine-plugin-input"
							type="text"
							bind:value={formData.frontend_plugin}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-mono font-bold focus:border-rose-600 focus:outline-none transition"
							placeholder="예: CommentEngine"
						/>
					</div>
				{:else if modalType === 'app'}
					<div>
						<label for="app-name-input" class="block text-xs font-black text-slate-700 mb-1.5">App Name</label>
						<input
							id="app-name-input"
							type="text"
							bind:value={formData.name}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold focus:border-rose-600 focus:outline-none transition"
							placeholder="예: 자유게시판 댓글"
						/>
					</div>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label for="app-engine-select" class="block text-xs font-black text-slate-700 mb-1.5">Base Engine</label>
							<select
								id="app-engine-select"
								bind:value={formData.engine_id}
								class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold bg-white focus:border-rose-600 focus:outline-none transition"
							>
								<option value="">-- 기본 엔진 선택 --</option>
								{#each engines as e}
									<option value={e.id}>{e.id} ({e.version || 'v1'})</option>
								{/each}
							</select>
						</div>
						<div>
							<label for="app-child-select" class="block text-xs font-black text-slate-700 mb-1.5">Child (Chain)</label>
							<select
								id="app-child-select"
								bind:value={formData.child_app_id}
								class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold bg-white focus:border-rose-600 focus:outline-none transition"
							>
								<option value={null}>None (단독 실행)</option>
								{#each serviceApps.filter((a) => a.id !== formData.id) as a}
									<option value={a.id}>{a.name}</option>
								{/each}
							</select>
						</div>
					</div>
					<div>
						<label for="app-config-input" class="block text-xs font-black text-slate-700 mb-1.5">JSON Configuration</label>
						<textarea
							id="app-config-input"
							bind:value={formData.config_str}
							rows="5"
							placeholder={'{\n  "maxDepth": 3\n}'}
							class="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 font-mono text-xs focus:bg-white focus:border-rose-600 focus:outline-none transition"
						></textarea>
					</div>
				{:else if modalType === 'instance'}
					<div>
						<label for="bundle-name-input" class="block text-xs font-black text-slate-700 mb-1.5">Bundle Name (번들 명칭)</label>
						<input
							id="bundle-name-input"
							type="text"
							bind:value={formData.name}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold focus:border-rose-600 focus:outline-none transition"
							placeholder="예: Standard Board Plugin Set"
						/>
					</div>

					<div class="space-y-2.5">
						<span class="block text-xs font-black text-slate-700">Included Service Apps (Select & Order)</span>
						<div class="space-y-2 max-h-60 overflow-y-auto rounded-2xl border-2 border-slate-100 bg-slate-50/50 p-2.5">
							{#each serviceApps as app}
								<label
									class="flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer {formData.service_app_ids?.includes(app.id)
										? 'bg-rose-50 border-rose-200 shadow-xs'
										: 'bg-white border-slate-100 hover:border-slate-300'}"
								>
									<input
										type="checkbox"
										checked={formData.service_app_ids?.includes(app.id)}
										onchange={(e) => {
											if (!formData.service_app_ids) formData.service_app_ids = [];
											if (e.currentTarget.checked) {
												formData.service_app_ids = [...formData.service_app_ids, app.id];
											} else {
												formData.service_app_ids = formData.service_app_ids.filter((/** @type {any} */ id) => id !== app.id);
											}
										}}
										class="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
									/>
									<div class="flex-1 min-w-0">
										<div class="text-xs font-black text-slate-900 truncate">{app.name}</div>
										<div class="text-[10px] font-bold uppercase text-slate-400 font-mono">{app.engine_id}</div>
									</div>
									{#if formData.service_app_ids?.includes(app.id)}
										<span class="text-[10px] font-black text-rose-600 bg-white px-2.5 py-1 rounded-lg border border-rose-200 shadow-xs">
											Order: {formData.service_app_ids.indexOf(app.id) + 1}
										</span>
									{/if}
								</label>
							{/each}
						</div>
						<p class="text-[11px] font-medium text-slate-400">※ 체크한 순서대로 화면에 렌더링됩니다.</p>
					</div>
				{/if}
			</div>

			<footer class="flex justify-end gap-2.5 border-t border-slate-100 bg-slate-50 px-6 py-4 sm:px-8">
				<button
					type="button"
					onclick={() => (showModal = false)}
					class="px-5 py-2.5 rounded-2xl border-2 border-slate-200 bg-white text-xs font-black text-slate-600 hover:border-slate-400 transition"
				>
					취소
				</button>
				<button
					type="button"
					onclick={handleSubmit}
					class="px-6 py-2.5 rounded-2xl bg-rose-600 text-white text-xs font-black hover:bg-rose-700 shadow-sm transition"
				>
					저장하기
				</button>
			</footer>
		</div>
	</div>
{/if}
