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

	// 사용 가능한 프론트엔드 서비스 플러그인 목록 ($lib/index.ts 기준)
	const AVAILABLE_PLUGINS = ['CommentEngine', 'CommentFileUploadEngine', 'UploadEngine', 'ReactionEngine', 'ReadReceiptEngine'];

	// --- [CRUD Helpers] ---
	let showModal = $state(false);
	let modalType = $state(''); // registry, engine, app, instance
	let isEditMode = $state(false);
	let formData = $state(/** @type {any} */ ({}));

	/**
	 * @param {string} type
	 * @param {any} target
	 */
	function openModal(type, target = null) {
		modalType = type;
		isEditMode = Boolean(target);
		if (type === 'registry') {
			formData = target
				? { id: target.id, name: target.name || '', description: target.description || '' }
				: { id: '', name: '', description: '' };
		} else if (type === 'engine') {
			formData = target
				? {
						...target,
						version: target.version || '1.0.0',
						is_active: target.is_active ?? true,
						config_schema_str: JSON.stringify(target.config_schema || {}, null, 2)
					}
				: {
						id: '',
						registry_id: registries[0]?.id || '',
						version: '1.0.0',
						frontend_plugin: '',
						config_schema_str: '{}',
						is_active: true
					};
		} else if (type === 'app') {
			formData = target
				? {
						id: target.id,
						name: target.name || '',
						engine_id: target.engine_id || '',
						is_active: target.is_active ?? true,
						config_str: JSON.stringify(target.config || {}, null, 2)
					}
				: {
						name: '',
						engine_id: engines[0]?.id || '',
						is_active: true,
						config_str: '{}'
					};
		} else if (type === 'instance') {
			formData = target
				? {
						id: target.id,
						name: target.name || '',
						service_app_ids: [...(target.service_app_ids || [])],
						is_active: target.is_active ?? true
					}
				: {
						name: '',
						service_app_ids: [],
						is_active: true
					};
		}
		showModal = true;
	}

	/**
	 * 번들에 포함된 서비스 앱의 렌더링 순서를 위/아래로 이동합니다.
	 * @param {number} idx
	 * @param {number} delta
	 */
	function moveBundleApp(idx, delta) {
		const list = [...(formData.service_app_ids || [])];
		const nextIdx = idx + delta;
		if (nextIdx < 0 || nextIdx >= list.length) return;
		[list[idx], list[nextIdx]] = [list[nextIdx], list[idx]];
		formData.service_app_ids = list;
	}

	async function handleSubmit() {
		try {
			if (modalType === 'registry') {
				if (!formData.id?.trim() || !formData.name?.trim()) {
					toast.warning('분류 ID와 표시 이름을 입력하세요.');
					return;
				}
				if (isEditMode) {
					await api.adminUpdateServiceRegistry(formData.id.trim(), {
						name: formData.name.trim(),
						description: formData.description || null
					});
				} else {
					await api.adminCreateServiceRegistry({
						id: formData.id.trim(),
						name: formData.name.trim(),
						description: formData.description || null
					});
				}
			} else if (modalType === 'engine') {
				if (!formData.id?.trim() || !formData.registry_id) {
					toast.warning('엔진 ID와 소속 서비스 분류(레지스트리)를 입력하세요.');
					return;
				}
				let parsedSchema = {};
				try {
					parsedSchema = formData.config_schema_str ? JSON.parse(formData.config_schema_str) : {};
				} catch {
					toast.error('엔진 설정 스키마(config_schema)가 올바른 JSON 형식이 아닙니다.');
					return;
				}
				if (isEditMode) {
					await api.adminUpdateServiceEngine(formData.id.trim(), {
						version: formData.version || '1.0.0',
						frontend_plugin: formData.frontend_plugin?.trim() || null,
						config_schema: parsedSchema,
						is_active: Boolean(formData.is_active ?? true)
					});
				} else {
					await api.adminCreateServiceEngine({
						id: formData.id.trim(),
						registry_id: formData.registry_id,
						version: formData.version || '1.0.0',
						frontend_plugin: formData.frontend_plugin?.trim() || null,
						config_schema: parsedSchema,
						is_active: Boolean(formData.is_active ?? true)
					});
				}
			} else if (modalType === 'app') {
				if (!formData.name?.trim() || !formData.engine_id) {
					toast.warning('모듈 이름과 기반 엔진을 선택하세요.');
					return;
				}
				let parsedConfig = {};
				try {
					parsedConfig = formData.config_str ? JSON.parse(formData.config_str) : {};
				} catch {
					toast.error('옵션 설정(JSON)이 올바른 JSON 형식이 아닙니다.');
					return;
				}
				const data = {
					name: formData.name.trim(),
					engine_id: formData.engine_id,
					config: parsedConfig,
					is_active: Boolean(formData.is_active ?? true)
				};
				if (formData.id) {
					await api.adminUpdateServiceApp(formData.id, data);
				} else {
					await api.adminCreateServiceApp(data);
				}
			} else if (modalType === 'instance') {
				if (!formData.name?.trim()) {
					toast.warning('번들 명칭을 입력하세요.');
					return;
				}
				const payload = {
					name: formData.name.trim(),
					service_app_ids: formData.service_app_ids || [],
					is_active: Boolean(formData.is_active ?? true)
				};
				if (formData.id) {
					await api.adminUpdateServiceInstance(formData.id, payload);
				} else {
					await api.adminCreateServiceInstance(payload);
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
	<!-- 2. 4단계 조립 파이프라인 요약 카드 (1단계 분류 → 2단계 엔진 → 3단계 설정 모듈 → 4단계 조립 번들) -->
	<!-- ===================================================================== -->
	<section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
		<!-- 1단계: 서비스 분류 (레지스트리) -->
		<button
			onclick={() => (activeTab = 'registries')}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {activeTab === 'registries' ? 'border-amber-500 bg-amber-50/20 ring-2 ring-amber-500/20' : 'border-slate-100 hover:border-amber-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-[11px] font-black tracking-wide text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg">1단계 · 서비스 분류</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:books-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countRegistries}
				<span class="text-sm font-bold text-slate-400 ml-1">개 분류</span>
			</div>
			<p class="mt-2 text-[11px] font-bold text-slate-500">댓글·업로드 등 기능 카테고리 정의</p>
		</button>

		<!-- 2단계: 구현 엔진 (플러그인) -->
		<button
			onclick={() => (activeTab = 'engines')}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {activeTab === 'engines' ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/20' : 'border-slate-100 hover:border-emerald-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-[11px] font-black tracking-wide text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg">2단계 · 구현 엔진</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:cpu-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countEngines}
				<span class="text-sm font-bold text-slate-400 ml-1">개 엔진</span>
			</div>
			<p class="mt-2 text-[11px] font-bold text-slate-500">실제 화면 Svelte 플러그인 연결</p>
		</button>

		<!-- 3단계: 엔진 인스턴스 (서비스 앱) -->
		<button
			onclick={() => (activeTab = 'apps')}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {activeTab === 'apps' ? 'border-purple-500 bg-purple-50/20 ring-2 ring-purple-500/20' : 'border-slate-100 hover:border-purple-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-[11px] font-black tracking-wide text-purple-700 bg-purple-50 px-2 py-0.5 rounded-lg">3단계 · 엔진 인스턴스</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:puzzle-piece-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countApps}
				<span class="text-sm font-bold text-slate-400 ml-1">개 인스턴스</span>
			</div>
			<p class="mt-2 text-[11px] font-bold text-slate-500">엔진에 옵션(JSON)을 넣어 생성한 인스턴스</p>
		</button>

		<!-- 4단계: 조립 번들 (완성 패키지) -->
		<button
			onclick={() => (activeTab = 'instances')}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {activeTab === 'instances' ? 'border-rose-500 bg-rose-50/20 ring-2 ring-rose-500/20' : 'border-slate-100 hover:border-rose-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-[11px] font-black tracking-wide text-rose-700 bg-rose-50 px-2 py-0.5 rounded-lg">4단계 · 조립 번들</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:package-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countInstances}
				<span class="text-sm font-bold text-slate-400 ml-1">개 번들</span>
			</div>
			<p class="mt-2 text-[11px] font-bold text-slate-500">인스턴스를 순서대로 묶어 게시판에 장착</p>
		</button>
	</section>

	<!-- ===================================================================== -->
	<!-- 3. 모드 탭 바 (조립 순서 1→2→3→4) -->
	<!-- ===================================================================== -->
	<nav class="flex gap-2 border-b-2 border-slate-200 overflow-x-auto no-scrollbar">
		<button
			onclick={() => (activeTab = 'registries')}
			class="px-5 py-3.5 text-xs font-black tracking-wide transition-all whitespace-nowrap {activeTab === 'registries' ? 'border-b-4 border-amber-600 text-amber-800 bg-amber-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
		>
			1. 레지스트리 · 추상화 ({registries.length})
		</button>
		<button
			onclick={() => (activeTab = 'engines')}
			class="px-5 py-3.5 text-xs font-black tracking-wide transition-all whitespace-nowrap {activeTab === 'engines' ? 'border-b-4 border-emerald-600 text-emerald-800 bg-emerald-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
		>
			2. 구현 엔진 ({engines.length})
		</button>
		<button
			onclick={() => (activeTab = 'apps')}
			class="px-5 py-3.5 text-xs font-black tracking-wide transition-all whitespace-nowrap {activeTab === 'apps' ? 'border-b-4 border-purple-600 text-purple-800 bg-purple-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
		>
			3. 엔진 인스턴스 ({serviceApps.length})
		</button>
		<button
			onclick={() => (activeTab = 'instances')}
			class="px-5 py-3.5 text-xs font-black tracking-wide transition-all whitespace-nowrap {activeTab === 'instances' ? 'border-b-4 border-rose-600 text-rose-700 bg-rose-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
		>
			4. 조립 번들 ({serviceInstances.length})
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
							<p><span class="font-bold text-slate-400">기반 엔진:</span> <span class="font-mono">{app.engine_id}</span></p>
							<p class="truncate"><span class="font-bold text-slate-400">옵션:</span> <span class="font-mono">{JSON.stringify(app.config || {})}</span></p>
						</div>
					</div>

					<div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
						<span class="text-[10px] font-bold px-2 py-0.5 rounded border {app.is_active !== false ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}">
							{app.is_active !== false ? '활성' : '비활성'}
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
							<td class="px-6 py-4 text-right space-x-3">
								<button onclick={() => openModal('engine', engine)} class="text-blue-600 hover:underline font-bold">
									수정
								</button>
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
							<div class="flex items-center gap-1.5">
								<button
									type="button"
									onclick={() => openModal('registry', reg)}
									class="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition"
								>
									수정
								</button>
								<button
									type="button"
									onclick={() => handleDelete('registry', reg.id)}
									class="px-2.5 py-1 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition"
								>
									삭제
								</button>
							</div>
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
					<h3 class="text-xl font-black text-slate-900">
						{#if modalType === 'registry'}
							1단계 · 서비스 분류(레지스트리) {isEditMode ? '수정' : '등록'}
						{:else if modalType === 'engine'}
							2단계 · 구현 엔진(플러그인) {isEditMode ? '수정' : '등록'}
						{:else if modalType === 'app'}
							3단계 · 엔진 인스턴스 {formData.id ? '수정' : '생성'}
						{:else}
							4단계 · 조립 번들(장착 세트) {formData.id ? '수정' : '생성'}
						{/if}
					</h3>
				</div>
				<button type="button" onclick={() => (showModal = false)} class="text-slate-400 hover:text-slate-700 p-1">
					<Icon icon="ph:x-bold" class="text-xl" />
				</button>
			</header>

			<div class="p-6 sm:p-8 space-y-5 overflow-y-auto">
				{#if modalType === 'registry'}
					<div>
						<label for="reg-id-input" class="block text-xs font-black text-slate-700 mb-1.5">분류 ID (영문 키)</label>
						<input
							id="reg-id-input"
							type="text"
							bind:value={formData.id}
							disabled={isEditMode}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-mono font-bold focus:border-rose-600 focus:outline-none transition disabled:bg-slate-100 disabled:text-slate-500"
							placeholder="예: comment, upload, reaction"
						/>
					</div>
					<div>
						<label for="reg-name-input" class="block text-xs font-black text-slate-700 mb-1.5">표시 이름</label>
						<input
							id="reg-name-input"
							type="text"
							bind:value={formData.name}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold focus:border-rose-600 focus:outline-none transition"
							placeholder="예: 댓글 서비스"
						/>
					</div>
					<div>
						<label for="reg-desc-input" class="block text-xs font-black text-slate-700 mb-1.5">설명</label>
						<textarea
							id="reg-desc-input"
							bind:value={formData.description}
							rows="2"
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-medium focus:border-rose-600 focus:outline-none transition"
							placeholder="이 서비스 분류의 역할을 간단히 입력하세요."
						></textarea>
					</div>
				{:else if modalType === 'engine'}
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label for="engine-id-input" class="block text-xs font-black text-slate-700 mb-1.5">엔진 ID</label>
							<input
								id="engine-id-input"
								type="text"
								bind:value={formData.id}
								disabled={isEditMode}
								class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-mono font-bold focus:border-rose-600 focus:outline-none transition disabled:bg-slate-100 disabled:text-slate-500"
								placeholder="예: comment_v1"
							/>
						</div>
						<div>
							<label for="engine-reg-select" class="block text-xs font-black text-slate-700 mb-1.5">소속 서비스 분류</label>
							<select
								id="engine-reg-select"
								bind:value={formData.registry_id}
								disabled={isEditMode}
								class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold bg-white focus:border-rose-600 focus:outline-none transition disabled:bg-slate-100 disabled:text-slate-500"
							>
								<option value="">-- 레지스트리 선택 --</option>
								{#each registries as r}
									<option value={r.id}>{r.name} ({r.id})</option>
								{/each}
							</select>
						</div>
					</div>
					<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label for="engine-plugin-input" class="block text-xs font-black text-slate-700 mb-1.5">프론트엔드 플러그인 (Svelte)</label>
							<input
								id="engine-plugin-input"
								type="text"
								bind:value={formData.frontend_plugin}
								class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-mono font-bold focus:border-rose-600 focus:outline-none transition"
								placeholder="예: CommentEngine"
							/>
							<div class="mt-1.5 flex flex-wrap gap-1.5">
								{#each AVAILABLE_PLUGINS as pluginName}
									<button
										type="button"
										onclick={() => (formData.frontend_plugin = pluginName)}
										class="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700"
									>
										{pluginName}
									</button>
								{/each}
							</div>
						</div>
						<div>
							<label for="engine-version-input" class="block text-xs font-black text-slate-700 mb-1.5">버전</label>
							<input
								id="engine-version-input"
								type="text"
								bind:value={formData.version}
								class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-mono font-bold focus:border-rose-600 focus:outline-none transition"
								placeholder="1.0.0"
							/>
						</div>
					</div>
					<div>
						<label for="engine-schema-input" class="block text-xs font-black text-slate-700 mb-1.5">설정 스키마 (config_schema JSON)</label>
						<textarea
							id="engine-schema-input"
							bind:value={formData.config_schema_str}
							rows="3"
							placeholder={'{}'}
							class="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 p-3 font-mono text-xs focus:bg-white focus:border-rose-600 focus:outline-none transition"
						></textarea>
					</div>
					<label class="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
						<input type="checkbox" bind:checked={formData.is_active} class="h-4 w-4 rounded border-slate-300 text-emerald-600" />
						<span>엔진 활성화</span>
					</label>
				{:else if modalType === 'app'}
					<div>
						<label for="app-name-input" class="block text-xs font-black text-slate-700 mb-1.5">모듈 이름</label>
						<input
							id="app-name-input"
							type="text"
							bind:value={formData.name}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold focus:border-rose-600 focus:outline-none transition"
							placeholder="예: 자유게시판 댓글"
						/>
					</div>
					<div>
						<label for="app-engine-select" class="block text-xs font-black text-slate-700 mb-1.5">기반 구현 엔진</label>
						<select
							id="app-engine-select"
							bind:value={formData.engine_id}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold bg-white focus:border-rose-600 focus:outline-none transition"
						>
							<option value="">-- 기본 엔진 선택 --</option>
							{#each engines as e}
								<option value={e.id}>{e.id} ({e.frontend_plugin || '플러그인 미지정'} · {e.version || 'v1'})</option>
							{/each}
						</select>
					</div>
					<div>
						<label for="app-config-input" class="block text-xs font-black text-slate-700 mb-1.5">모듈 옵션 설정 (JSON)</label>
						<textarea
							id="app-config-input"
							bind:value={formData.config_str}
							rows="5"
							placeholder={'{\n  "maxDepth": 3\n}'}
							class="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 p-4 font-mono text-xs focus:bg-white focus:border-rose-600 focus:outline-none transition"
						></textarea>
					</div>
					<label class="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
						<input type="checkbox" bind:checked={formData.is_active} class="h-4 w-4 rounded border-slate-300 text-purple-600" />
						<span>모듈 활성화</span>
					</label>
				{:else if modalType === 'instance'}
					<div>
						<label for="bundle-name-input" class="block text-xs font-black text-slate-700 mb-1.5">번들 명칭</label>
						<input
							id="bundle-name-input"
							type="text"
							bind:value={formData.name}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold focus:border-rose-600 focus:outline-none transition"
							placeholder="예: 표준 게시판 플러그인 세트"
						/>
					</div>

					<div class="space-y-2.5">
						<span class="block text-xs font-black text-slate-700">포함할 기능 모듈 선택 및 순서</span>
						<div class="space-y-2 max-h-60 overflow-y-auto rounded-2xl border-2 border-slate-100 bg-slate-50/50 p-2.5">
							{#each serviceApps as app}
								{@const orderIdx = (formData.service_app_ids || []).indexOf(app.id)}
								{@const isSelected = orderIdx !== -1}
								<div
									class="flex items-center gap-3 p-3 rounded-xl border transition-all {isSelected
										? 'bg-rose-50 border-rose-200 shadow-xs'
										: 'bg-white border-slate-100 hover:border-slate-300'}"
								>
									<input
										type="checkbox"
										checked={isSelected}
										onchange={(e) => {
											if (!formData.service_app_ids) formData.service_app_ids = [];
											if (e.currentTarget.checked) {
												formData.service_app_ids = [...formData.service_app_ids, app.id];
											} else {
												formData.service_app_ids = formData.service_app_ids.filter((/** @type {any} */ id) => id !== app.id);
											}
										}}
										class="h-4 w-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
									/>
									<div class="flex-1 min-w-0">
										<div class="text-xs font-black text-slate-900 truncate">{app.name}</div>
										<div class="text-[10px] font-bold uppercase text-slate-400 font-mono">{app.engine_id}</div>
									</div>
									{#if isSelected}
										<div class="flex items-center gap-1">
											<span class="text-[10px] font-black text-rose-600 bg-white px-2 py-1 rounded-lg border border-rose-200 shadow-xs">
												{orderIdx + 1}번
											</span>
											<button
												type="button"
												onclick={() => moveBundleApp(orderIdx, -1)}
												disabled={orderIdx === 0}
												class="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-100 disabled:opacity-30"
												title="위로"
											>
												▲
											</button>
											<button
												type="button"
												onclick={() => moveBundleApp(orderIdx, 1)}
												disabled={orderIdx === (formData.service_app_ids?.length || 0) - 1}
												class="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-black text-slate-600 hover:bg-slate-100 disabled:opacity-30"
												title="아래로"
											>
												▼
											</button>
										</div>
									{/if}
								</div>
							{/each}
						</div>
						<p class="text-[11px] font-medium text-slate-400">※ 지정된 순서(1번 → 2번…)대로 게시글/페이지 하단에 렌더링됩니다.</p>
					</div>
					<label class="inline-flex cursor-pointer items-center gap-2 text-xs font-bold text-slate-700">
						<input type="checkbox" bind:checked={formData.is_active} class="h-4 w-4 rounded border-slate-300 text-rose-600" />
						<span>번들 활성화</span>
					</label>
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
