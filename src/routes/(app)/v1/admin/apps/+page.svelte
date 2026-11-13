<script>
	/**
	 * @file (app)/v1/admin/apps/+page.svelte
	 * @description 시스템 앱(App) 및 서비스(Service) 엔진 레지스트리 관리자 (Svelte 5)
	 *              - 전사 표준 모던 엔터프라이즈 헤더 & 4대 핵심 관제 지표 요약 카드
	 *              - 반응형 카드 기반 본문 레이아웃 (모바일 세로/태블릿/데스크탑 최적화)
	 *              - 브라우저 탭 단일 진실 공급원(SSOT) 환경설정 타이틀 연동
	 *              - 탭 기반 네비게이션 (명부 조회 / 새 엔진 등록 및 설정)
	 */
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin';
	import { toast } from '$lib/runes/toast.svelte';
	import { getSiteTitle } from '$lib/config/site';
	import Icon from '@iconify/svelte';
	import SmartIcon from '$lib/components/SmartIcon.svelte';

	let apps = $state(/** @type {any[]} */ ([]));
	let loading = $state(true);
	let activeTab = $state('list'); // 'list' | 'form'
	let isEditMode = $state(false); // 등록/수정 모드 판별
	let selectedFilter = $state('ALL'); // 'ALL' | 'SYSTEM' | 'CUSTOM' | 'INSTANCE'

	// 🏛️ 3대 분류 파생 상태 (PAGES는 DB 미등록 독립 정적 레이어)
	const systemApps = $derived(apps.filter((a) => a.app_type === 'SYSTEM'));
	const customApps = $derived(apps.filter((a) => a.app_type === 'CUSTOM'));
	const instanceApps = $derived(apps.filter((a) => a.app_type === 'INSTANCE' || a.app_type === 'APP'));

	// 📊 4대 관제 지표 요약 수치
	const countTotal = $derived(apps.length);
	const countSystem = $derived(systemApps.length);
	const countCustom = $derived(customApps.length);
	const countInstance = $derived(instanceApps.length);

	// 필터링된 앱 목록
	const filteredApps = $derived(
		selectedFilter === 'ALL'
			? apps
			: apps.filter((a) => {
					if (selectedFilter === 'INSTANCE') return a.app_type === 'INSTANCE' || a.app_type === 'APP';
					return a.app_type === selectedFilter;
				})
	);

	let editingApp = $state({
		app_id: '',
		name: '',
		title: '',
		description: '',
		app_type: 'INSTANCE',
		frontend_route: '',
		main_component: '',
		icon_default: 'mdi:apps',
		min_read_rank: 0,
		min_write_rank: 2,
		is_active: true
	});

	async function loadApps() {
		loading = true;
		try {
			apps = await api.adminGetApps();
		} catch (/** @type {any} */ e) {
			toast.error('앱 목록 로드 실패: ' + (e.message || '오류가 발생했습니다.'));
		} finally {
			loading = false;
		}
	}

	onMount(loadApps);

	function resetForm() {
		editingApp = {
			app_id: '',
			name: '',
			title: '',
			description: '',
			app_type: 'INSTANCE',
			frontend_route: '',
			main_component: '',
			icon_default: 'mdi:apps',
			min_read_rank: 0,
			min_write_rank: 2,
			is_active: true
		};
	}

	function startCreate() {
		isEditMode = false;
		resetForm();
		activeTab = 'form';
	}

	/**
	 * @param {any} app
	 */
	function startEdit(app) {
		isEditMode = true;
		editingApp = {
			...app,
			main_component: app.main_component || '',
			app_type: app.app_type || 'INSTANCE',
			min_read_rank: Number(app.min_read_rank ?? 0),
			min_write_rank: Number(app.min_write_rank ?? 2)
		};
		activeTab = 'form';
	}

	/**
	 * @param {any} app
	 */
	async function handleDelete(app) {
		if (app.app_type === 'SYSTEM') {
			toast.warning('SYSTEM 앱은 시스템 필수 관제 앱이므로 삭제할 수 없습니다.');
			return;
		}
		if (!confirm(`'${app.title || app.name || app.app_id}' 앱을 삭제하시겠습니까?`)) return;
		try {
			await api.adminDeleteApp(app.app_id);
			toast.success('앱 엔진이 삭제되었습니다.');
			if (editingApp.app_id === app.app_id) {
				resetForm();
				isEditMode = false;
				activeTab = 'list';
			}
			await loadApps();
		} catch (/** @type {any} */ e) {
			toast.error('삭제 실패: ' + (e.message || '오류가 발생했습니다.'));
		}
	}

	async function handleSave() {
		if (!editingApp.app_id || !editingApp.name) {
			toast.warning('앱 식별자(ID)와 내부 이름은 필수 항목입니다.');
			return;
		}

		try {
			const { app_id, ...updateData } = editingApp;

			const payload = {
				...updateData,
				min_read_rank: Number(editingApp.min_read_rank),
				min_write_rank: Number(editingApp.min_write_rank)
			};

			if (isEditMode) {
				await api.adminUpdateApp(app_id, payload);
				toast.success(`[${editingApp.title || editingApp.name}] 설정이 성공적으로 갱신되었습니다.`);
			} else {
				await api.adminCreateApp(editingApp);
				toast.success(`새로운 앱 [${editingApp.title || editingApp.name}]이 등록되었습니다.`);
			}

			resetForm();
			isEditMode = false;
			activeTab = 'list';
			await loadApps();
		} catch (/** @type {any} */ e) {
			toast.error('저장 실패: ' + (e.message || '오류가 발생했습니다.'));
		}
	}

	/**
	 * @param {string} type
	 */
	function getAppTypeBadge(type) {
		switch (type) {
			case 'SYSTEM':
				return { label: 'SYSTEM APP', class: 'bg-purple-50 text-purple-700 border-purple-200' };
			case 'CUSTOM':
				return { label: 'CUSTOM APP', class: 'bg-rose-50 text-rose-700 border-rose-200' };
			default:
				return { label: 'INSTANCE APP', class: 'bg-blue-50 text-blue-700 border-blue-200' };
		}
	}
</script>

<svelte:head>
	<title>{getSiteTitle('앱 설치 등록')}</title>
</svelte:head>

<div class="animate-fade-in mx-auto max-w-7xl space-y-8 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:px-8">
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 우측 컨트롤 바 -->
	<!-- ===================================================================== -->
	<header class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end">
		<div>
			<div class="flex items-center gap-2 mb-2">
				<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-purple-50 text-purple-700 border border-purple-200">
					<Icon icon="ph:app-window-bold" class="text-sm" />
					SYSTEM GOVERNANCE • APP REGISTRY
				</span>
				<span class="text-xs font-bold text-slate-400 font-mono">v1/admin/apps</span>
			</div>
			<h1 class="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
				앱 <span class="not-italic text-purple-600">설치 등록</span>
			</h1>
			<p class="mt-2 text-xs sm:text-sm font-bold text-slate-500">
				시스템 엔진들의 메타데이터와 권한 등급, 라우팅 경로를 일괄 관리하고 등록합니다.
			</p>
		</div>

		<!-- 상단 액션 버튼 그룹 -->
		<div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
			<button
				onclick={startCreate}
				class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-purple-600 bg-purple-600 text-white font-black text-xs uppercase tracking-wider hover:bg-purple-700 transition shadow-sm"
			>
				<Icon icon="ph:plus-circle-bold" class="text-base" />
				<span>새 앱 등록</span>
			</button>

			<button
				onclick={loadApps}
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
		<!-- 카드 1: 전체 등록 앱 -->
		<button
			onclick={() => { activeTab = 'list'; selectedFilter = 'ALL'; }}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {selectedFilter === 'ALL' ? 'border-purple-500 bg-purple-50/20 ring-2 ring-purple-500/20' : 'border-slate-100 hover:border-purple-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-purple-600">Total Apps</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:squares-four-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countTotal}
				<span class="text-sm font-bold text-slate-400 ml-1">개 등록</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-purple-600">
				<span class="rounded-lg bg-purple-50 px-2 py-0.5 font-mono">가동률 100%</span>
				<span class="text-slate-400 font-normal">전체 엔진</span>
			</div>
		</button>

		<!-- 카드 2: 시스템 필수 관제 앱 (SYSTEM) -->
		<button
			onclick={() => { activeTab = 'list'; selectedFilter = 'SYSTEM'; }}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {selectedFilter === 'SYSTEM' ? 'border-purple-500 bg-purple-50/20 ring-2 ring-purple-500/20' : 'border-slate-100 hover:border-purple-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-purple-600">System Core</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-100 text-purple-700 group-hover:scale-110 transition-transform">
					<Icon icon="ph:shield-star-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countSystem}
				<span class="text-sm font-bold text-slate-400 ml-1">개 관제</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-purple-700">
				<span class="rounded-lg bg-purple-100 px-2 py-0.5 font-mono">코어 보호</span>
				<span class="text-slate-400 font-normal">삭제 불가</span>
			</div>
		</button>

		<!-- 카드 3: 단독 도메인 비즈니스 (CUSTOM) -->
		<button
			onclick={() => { activeTab = 'list'; selectedFilter = 'CUSTOM'; }}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {selectedFilter === 'CUSTOM' ? 'border-rose-500 bg-rose-50/20 ring-2 ring-rose-500/20' : 'border-slate-100 hover:border-rose-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-rose-600">Custom Domain</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:bus-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countCustom}
				<span class="text-sm font-bold text-slate-400 ml-1">개 도메인</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-rose-600">
				<span class="rounded-lg bg-rose-50 px-2 py-0.5 font-mono">1:1 화면</span>
				<span class="text-slate-400 font-normal">배차·휴무</span>
			</div>
		</button>

		<!-- 카드 4: 다중 인스턴스 앱 (INSTANCE) -->
		<button
			onclick={() => { activeTab = 'list'; selectedFilter = 'INSTANCE'; }}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {selectedFilter === 'INSTANCE' ? 'border-blue-500 bg-blue-50/20 ring-2 ring-blue-500/20' : 'border-slate-100 hover:border-blue-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-blue-600">Multi Instance</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:stack-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countInstance}
				<span class="text-sm font-bold text-slate-400 ml-1">개 허브</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-blue-600">
				<span class="rounded-lg bg-blue-50 px-2 py-0.5 font-mono">슬러그 확장</span>
				<span class="text-slate-400 font-normal">게시판 엔진</span>
			</div>
		</button>
	</section>

	<!-- ===================================================================== -->
	<!-- 3. 모드 탭 바 (최소 1개, 일관성 및 확장성) -->
	<!-- ===================================================================== -->
	<nav class="flex gap-2 border-b-2 border-slate-200 overflow-x-auto no-scrollbar">
		<button
			onclick={() => (activeTab = 'list')}
			class="px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeTab === 'list' ? 'border-b-4 border-purple-600 text-purple-700 bg-purple-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
		>
			등록된 앱 명부 ({filteredApps.length})
		</button>
		<button
			onclick={startCreate}
			class="px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeTab === 'form' ? 'border-b-4 border-purple-600 text-purple-700 bg-purple-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
		>
			{isEditMode ? `설정 수정: ${editingApp.title || editingApp.name}` : '새 앱 엔진 등록'}
		</button>
	</nav>

	<!-- ===================================================================== -->
	<!-- 4. 본문 컨텐츠 (반응형 카드 형식 위주) -->
	<!-- ===================================================================== -->
	{#if loading}
		<div class="flex justify-center py-20">
			<div class="flex flex-col items-center gap-3">
				<div class="h-10 w-10 animate-spin rounded-full border-4 border-purple-600 border-t-transparent"></div>
				<p class="text-xs font-bold text-slate-400 font-mono">앱 레지스트리 분석 중...</p>
			</div>
		</div>
	{:else if activeTab === 'list'}
		<!-- 탭 1: 등록된 앱 카드 목록 뷰 -->
		<div class="space-y-6">
			<!-- 서브 필터 버튼 바 -->
			<div class="flex flex-wrap items-center gap-2">
				<button
					type="button"
					onclick={() => (selectedFilter = 'ALL')}
					class="px-4 py-2 rounded-xl text-xs font-black uppercase transition-all {selectedFilter === 'ALL' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white border border-slate-200 text-slate-700 hover:border-slate-400'}"
				>
					전체 ({apps.length})
				</button>
				<button
					type="button"
					onclick={() => (selectedFilter = 'SYSTEM')}
					class="px-4 py-2 rounded-xl text-xs font-black uppercase transition-all {selectedFilter === 'SYSTEM' ? 'bg-purple-600 text-white shadow-sm' : 'bg-purple-50 border border-purple-200 text-purple-700 hover:bg-purple-100'}"
				>
					🏛️ SYSTEM ({systemApps.length})
				</button>
				<button
					type="button"
					onclick={() => (selectedFilter = 'CUSTOM')}
					class="px-4 py-2 rounded-xl text-xs font-black uppercase transition-all {selectedFilter === 'CUSTOM' ? 'bg-rose-600 text-white shadow-sm' : 'bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100'}"
				>
					🚐 CUSTOM ({customApps.length})
				</button>
				<button
					type="button"
					onclick={() => (selectedFilter = 'INSTANCE')}
					class="px-4 py-2 rounded-xl text-xs font-black uppercase transition-all {selectedFilter === 'INSTANCE' ? 'bg-blue-600 text-white shadow-sm' : 'bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100'}"
				>
					🧩 INSTANCE ({instanceApps.length})
				</button>
			</div>

			<!-- 반응형 카드 그리드: 모바일 세로 1열, 태블릿 2열, 데스크탑 3열 -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
				{#each filteredApps as app (app.app_id)}
					{@const badge = getAppTypeBadge(app.app_type)}
					<div
						class="rounded-2xl border-2 bg-white p-6 shadow-sm hover:border-purple-400 transition-all flex flex-col justify-between {editingApp.app_id === app.app_id && isEditMode ? 'border-purple-600 ring-2 ring-purple-600/20' : 'border-slate-200'}"
					>
						<div>
							<div class="flex items-start justify-between mb-3">
								<div class="flex items-center gap-3">
									<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-800 text-2xl shadow-inner">
										<SmartIcon
											icon={app.icon_default}
											fallback="ph:rocket-fill"
											class="h-6 w-6"
											emojiClass="text-xl leading-none"
										/>
									</div>
									<div>
										<h3 class="text-lg font-black text-slate-900 tracking-tight leading-snug">
											{app.title || app.name || app.app_id}
										</h3>
										<span class="font-mono text-xs font-bold text-slate-400">
											id: {app.app_id}
										</span>
									</div>
								</div>

								<div class="flex flex-col items-end gap-1">
									<span class="px-2.5 py-0.5 rounded-md text-[10px] font-bold border {badge.class}">
										{badge.label}
									</span>
									{#if !app.is_active}
										<span class="px-2 py-0.5 rounded-md text-[10px] font-black bg-rose-50 text-rose-600 border border-rose-200">
											비활성화됨
										</span>
									{/if}
								</div>
							</div>

							<p class="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
								{app.description || '등록된 앱 설명이 없습니다.'}
							</p>

							<!-- 경로 및 랭크 스펙 -->
							<div class="mt-4 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
								<div class="flex items-center justify-between">
									<span class="text-[11px] font-bold text-slate-400">관리자 경로</span>
									<span class="font-mono text-[11px] font-bold text-purple-700">
										{app.frontend_route || `/v1/admin/${app.app_id}`}
									</span>
								</div>
								{#if app.app_type === 'CUSTOM'}
									<div class="flex items-center justify-between">
										<span class="text-[11px] font-bold text-slate-400">사용자 경로</span>
										<a
											href={`/v1/custom/${app.app_id}`}
											class="font-mono text-[11px] font-bold text-rose-600 hover:underline flex items-center gap-1"
										>
											<span>/v1/custom/{app.app_id}</span>
											<Icon icon="ph:arrow-square-out-bold" class="text-xs" />
										</a>
									</div>
								{:else if app.app_type === 'INSTANCE' || app.app_type === 'APP'}
									<div class="flex items-center justify-between">
										<span class="text-[11px] font-bold text-slate-400">인스턴스 허브</span>
										<a
											href={`/v1/app/${app.app_id}`}
											class="font-mono text-[11px] font-bold text-blue-600 hover:underline flex items-center gap-1"
										>
											<span>/v1/app/{app.app_id}</span>
											<Icon icon="ph:arrow-square-out-bold" class="text-xs" />
										</a>
									</div>
									{#if app.main_component}
										<div class="flex items-center justify-between">
											<span class="text-[11px] font-bold text-slate-400">엔진 컴포넌트</span>
											<span class="font-mono text-[10px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
												{app.main_component}
											</span>
										</div>
									{/if}
								{/if}
							</div>
						</div>

						<div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
							<div class="flex items-center gap-1.5">
								<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
									R{app.min_read_rank ?? 0} 읽기
								</span>
								<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
									R{app.min_write_rank ?? 2} 쓰기
								</span>
							</div>

							<div class="flex items-center gap-2">
								<a
									href={`/v1/admin/observability?app_id=${app.app_id}&tab=CHANGE`}
									class="px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
									title="감사로그 확인"
								>
									로그
								</a>
								<button
									type="button"
									onclick={() => startEdit(app)}
									class="px-3 py-1 text-xs font-black text-purple-600 hover:bg-purple-50 rounded-xl transition"
								>
									수정
								</button>
								{#if app.app_type !== 'SYSTEM'}
									<button
										type="button"
										onclick={() => handleDelete(app)}
										class="px-2 py-1 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-lg transition"
									>
										삭제
									</button>
								{/if}
							</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<!-- 탭 2: 등록/수정 폼 카드 -->
		<div class="rounded-3xl border-2 border-slate-200 bg-white p-6 sm:p-10 shadow-sm max-w-4xl">
			<div class="mb-8 flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-slate-100 pb-4">
				<div>
					<h3 class="text-2xl font-black text-slate-900 tracking-tight">
						{isEditMode ? `앱 엔진 정보 수정: ${editingApp.title || editingApp.name}` : '신규 앱 엔진 등록'}
					</h3>
					<p class="text-xs font-bold text-slate-400 mt-1">
						식별자(app_id), 3대 분류, 관리자 경로 및 보안 랭크를 설정합니다.
					</p>
				</div>
				<span class="text-xs font-mono font-bold text-purple-600 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200">
					{isEditMode ? 'MODE: UPDATE' : 'MODE: CREATE'}
				</span>
			</div>

			<div class="space-y-6">
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
					<div class="space-y-1.5">
						<label for="app-id-input" class="block text-xs font-black text-slate-700 tracking-wide">
							앱 식별자 (app_id) <span class="text-rose-500">*</span>
						</label>
						<input
							id="app-id-input"
							type="text"
							bind:value={editingApp.app_id}
							readonly={isEditMode}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold font-mono text-purple-600 bg-slate-50 focus:bg-white focus:border-purple-600 focus:outline-none transition {isEditMode ? 'opacity-60 cursor-not-allowed' : ''}"
							placeholder="예: board, dispatch, page"
						/>
						<p class="text-[11px] text-slate-400">시스템 전체에서 단 하나만 존재하는 고유 ID입니다.</p>
					</div>

					<div class="space-y-1.5">
						<label for="app-name-input" class="block text-xs font-black text-slate-700 tracking-wide">
							내부 명칭 (name) <span class="text-rose-500">*</span>
						</label>
						<input
							id="app-name-input"
							type="text"
							bind:value={editingApp.name}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:border-purple-600 focus:outline-none transition"
							placeholder="예: 차량 배차 관리"
						/>
						<p class="text-[11px] text-slate-400">내부 시스템에서 식별하는 공식 이름입니다.</p>
					</div>
				</div>

				<div class="space-y-1.5">
					<label for="app-title-input" class="block text-xs font-black text-slate-700 tracking-wide">
						표시 타이틀 (title)
					</label>
					<input
						id="app-title-input"
						type="text"
						bind:value={editingApp.title}
						class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold text-slate-800 bg-white focus:border-purple-600 focus:outline-none transition"
						placeholder="사용자 화면 및 메뉴에 표기될 타이틀"
					/>
				</div>

				<div class="space-y-1.5">
					<label for="app-desc-input" class="block text-xs font-black text-slate-700 tracking-wide">
						설명 (description)
					</label>
					<textarea
						id="app-desc-input"
						bind:value={editingApp.description}
						class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold text-slate-800 bg-white focus:border-purple-600 focus:outline-none transition h-20 resize-none"
						placeholder="엔진 기능 및 비즈니스 역할 요약 설명"
					></textarea>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
					<div class="space-y-1.5">
						<label for="app-type-select" class="block text-xs font-black text-slate-700 tracking-wide">
							앱 유형 (app_type)
						</label>
						<select
							id="app-type-select"
							bind:value={editingApp.app_type}
							disabled={isEditMode && editingApp.app_type === 'SYSTEM'}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold text-slate-800 bg-white focus:border-purple-600 focus:outline-none transition {isEditMode && editingApp.app_type === 'SYSTEM' ? 'opacity-60 cursor-not-allowed' : ''}"
						>
							<option value="SYSTEM">🏛️ SYSTEM (시스템 관제 · 삭제불가)</option>
							<option value="CUSTOM">🚐 CUSTOM (단독 도메인 비즈니스)</option>
							<option value="INSTANCE">🧩 INSTANCE (추상화 다중 인스턴스)</option>
						</select>
						{#if isEditMode && editingApp.app_type === 'SYSTEM'}
							<p class="text-[11px] font-bold text-purple-700">
								🛡️ SYSTEM 앱은 시스템 필수 관제 코어이므로 유형을 변경할 수 없습니다.
							</p>
						{/if}
					</div>

					<div class="space-y-1.5">
						<div class="flex items-center justify-between">
							<label for="main-comp-input" class="block text-xs font-black text-slate-700 tracking-wide">
								컴포넌트 명칭 (main_component)
							</label>
							{#if editingApp.app_type === 'INSTANCE'}
								<span class="px-2 py-0.5 rounded bg-blue-600 text-white text-[9px] font-black">
									🧩 인스턴스 엔진
								</span>
							{/if}
						</div>
						<input
							id="main-comp-input"
							type="text"
							bind:value={editingApp.main_component}
							class="w-full px-4 py-3 rounded-2xl border-2 text-xs font-mono font-bold text-slate-800 bg-white focus:border-purple-600 focus:outline-none transition {editingApp.app_type === 'INSTANCE' ? 'border-blue-300 bg-blue-50/20' : 'border-slate-200'}"
							placeholder={editingApp.app_type === 'INSTANCE' ? '예: BoardEngine, SurveyEngine' : '선택 사항 (단독/시스템 앱)'}
						/>
						{#if editingApp.app_type === 'INSTANCE'}
							<p class="text-[11px] font-bold text-blue-600">
								💡 다중 인스턴스 확장 시 클라이언트 공통 런처(/v1/app/[slug])에 마운트할 Svelte 엔진 컴포넌트명
							</p>
						{/if}
					</div>
				</div>

				<div class="space-y-1.5">
					<label for="app-route-input" class="block text-xs font-black text-slate-700 tracking-wide">
						관리자 진입 경로 (frontend_route)
					</label>
					<input
						id="app-route-input"
						type="text"
						bind:value={editingApp.frontend_route}
						class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold font-mono text-purple-700 bg-white focus:border-purple-600 focus:outline-none transition"
						placeholder="/v1/admin/앱이름"
					/>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
					<div class="space-y-1.5">
						<label for="min-read-rank" class="block text-xs font-black text-slate-700 tracking-wide">
							읽기 최소 랭크
						</label>
						<select
							id="min-read-rank"
							bind:value={editingApp.min_read_rank}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold text-slate-800 bg-white focus:border-purple-600 focus:outline-none transition"
						>
							<option value={0}>R0 (일반회원)</option>
							<option value={1}>R1 (정회원)</option>
							<option value={2}>R2 (매니저)</option>
							<option value={4}>R4 (운영관리자)</option>
							<option value={8}>R8 (시스템관리자)</option>
							<option value={9}>R9 (최고관리자)</option>
						</select>
					</div>

					<div class="space-y-1.5">
						<label for="min-write-rank" class="block text-xs font-black text-slate-700 tracking-wide">
							쓰기 최소 랭크
						</label>
						<select
							id="min-write-rank"
							bind:value={editingApp.min_write_rank}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold text-slate-800 bg-white focus:border-purple-600 focus:outline-none transition"
						>
							<option value={0}>R0 (일반회원)</option>
							<option value={1}>R1 (정회원)</option>
							<option value={2}>R2 (매니저)</option>
							<option value={4}>R4 (운영관리자)</option>
							<option value={8}>R8 (시스템관리자)</option>
							<option value={9}>R9 (최고관리자)</option>
						</select>
					</div>

					<div class="space-y-1.5">
						<label for="icon-default-input" class="block text-xs font-black text-slate-700 tracking-wide">
							아이콘 (이모지 또는 Iconify)
						</label>
						<div class="flex items-center gap-2">
							<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50 text-purple-600">
								<SmartIcon
									icon={editingApp.icon_default}
									fallback="ph:rocket-fill"
									class="h-5 w-5"
									emojiClass="text-xl leading-none"
								/>
							</div>
							<input
								id="icon-default-input"
								type="text"
								bind:value={editingApp.icon_default}
								class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold text-slate-800 bg-white focus:border-purple-600 focus:outline-none transition"
								placeholder="mdi:apps 또는 🚀"
							/>
						</div>
					</div>
				</div>

				<!-- 앱 활성화 상태 토글 -->
				<div class="space-y-2 pt-1">
					<span class="block text-xs font-black text-slate-700 tracking-wide">앱 엔진 운영 상태</span>
					<label
						for="app-is-active"
						class="flex w-fit items-center gap-3 rounded-2xl border-2 px-5 py-3 transition {isEditMode && editingApp.app_type === 'SYSTEM'
							? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60'
							: editingApp.is_active
								? 'cursor-pointer border-emerald-200 bg-emerald-50/50'
								: 'cursor-pointer border-rose-200 bg-rose-50/50'}"
					>
						<input
							id="app-is-active"
							type="checkbox"
							bind:checked={editingApp.is_active}
							disabled={isEditMode && editingApp.app_type === 'SYSTEM'}
							class="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
						/>
						<span class="text-xs font-black text-slate-800">
							앱 엔진 활성화 (운영 상태)
						</span>
					</label>
					{#if isEditMode && editingApp.app_type === 'SYSTEM'}
						<p class="text-[11px] font-bold text-purple-700">
							🛡️ SYSTEM 앱은 시스템 필수 관제 코어이므로 비활성화할 수 없습니다.
						</p>
					{:else}
						<p class="text-[11px] font-medium text-slate-400">
							체크 해제 시 백엔드 API 접근 및 일반 사용자 메뉴 노출이 즉시 전면 차단(점검 모드)됩니다.
						</p>
					{/if}
				</div>

				<div class="pt-6 border-t border-slate-100 flex flex-wrap items-center gap-3">
					<button
						onclick={handleSave}
						class="px-6 py-3 rounded-2xl bg-purple-600 text-white font-black text-xs uppercase tracking-wider hover:bg-purple-700 transition shadow-md"
					>
						{isEditMode ? '수정 사항 저장하기' : '새 앱 엔진 등록하기'}
					</button>

					<button
						onclick={() => { resetForm(); isEditMode = false; activeTab = 'list'; }}
						class="px-5 py-3 rounded-2xl border-2 border-slate-200 text-slate-600 font-black text-xs uppercase hover:bg-slate-50 transition"
					>
						목록으로 돌아가기
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
