<script>
	// @ts-nocheck
	/**
	 * @file (app)/v1/admin/menu/+page.svelte
	 * @description 시스템 메뉴 아키텍처 실시간 편집기 (Svelte 5 모던 템플릿)
	 *              - 전사 표준 모던 엔터프라이즈 헤더 & 4대 핵심 관제 지표 요약 카드
	 *              - 반응형 카드 기반 본문 레이아웃 (모바일 세로/태블릿/데스크탑 최적화)
	 *              - 브라우저 탭 단일 진실 공급원(SSOT) 환경설정 타이틀 연동
	 *              - 탭 기반 네비게이션 (메뉴 트리 조회 / 새 메뉴 등록 및 설정)
	 */
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import * as api from '$lib/api/admin.js';
	import { adminGetPages } from '$lib/api/page.js';
	import { toast } from '$lib/runes/toast.svelte.js';
	import { getSiteTitle } from '$lib/config/site';
	import { browser } from '$app/environment';
	import Icon from '@iconify/svelte';
	import SmartIcon from '$lib/components/SmartIcon.svelte';

	let menus = $state([]);
	let apps = $state([]);
	let boards = $state([]);
	let pages = $state([]);
	let loading = $state(true);
	let activeTab = $state('tree'); // 'tree' | 'form'

	let editingMenu = $state({
		id: '',
		parent_id: '',
		title: '',
		icon_name: '🚀',
		link_type: 'INSTANCE',
		external_url: '',
		app_id: '',
		app_instance_id: '',
		page_mode: 'user',
		order: 0,
		is_visible: true,
		min_rank: 0
	});

	// 📊 4대 관제 지표 요약 수치
	const countRootMenus = $derived(menus.length);
	const countTotalSubMenus = $derived(menus.reduce((acc, cur) => acc + (cur.sub_menus?.length || 0), 0));
	const countTotalMenus = $derived(countRootMenus + countTotalSubMenus);
	const countAppLinked = $derived(
		menus.filter((m) => ['INSTANCE', 'CUSTOM', 'SYSTEM', 'APP'].includes(m.link_type)).length +
		menus.reduce((acc, cur) => acc + (cur.sub_menus?.filter((s) => ['INSTANCE', 'CUSTOM', 'SYSTEM', 'APP'].includes(s.link_type)).length || 0), 0)
	);

	// 🔗 백엔드 resolve_menu_url 규칙과 100% 동기화된 URL 예측기
	function getRecursiveUrl(menu) {
		if (!menu) return '';
		if (menu.link_type === 'FOLDER' || menu.link_type === 'DIVIDER') return '#';

		let currentPath = '';
		if (menu.link_type === 'URL') {
			currentPath = menu.external_url || '';
		} else if (['INSTANCE', 'CUSTOM', 'SYSTEM', 'APP'].includes(menu.link_type) && menu.app_id) {
			const targetApp = apps.find((a) => a.app_id === menu.app_id);
			const cleanId = String(menu.app_id);
			const is_admin =
				menu.link_type === 'SYSTEM' ||
				targetApp?.app_type === 'SYSTEM' ||
				String(menu.app_instance_id) === '-1';

			if (is_admin) {
				currentPath = targetApp?.frontend_route || (cleanId === 'dashboard' || cleanId === '' ? '/v1/admin' : `/v1/admin/${cleanId}`);
			} else if (menu.link_type === 'CUSTOM' || targetApp?.app_type === 'CUSTOM') {
				currentPath = `/v1/custom/${cleanId}`;
			} else if (menu.link_type === 'INSTANCE' || targetApp?.app_type === 'INSTANCE') {
				if (menu.app_instance_id && String(menu.app_instance_id) !== '-1') {
					const target = boards.find((b) => String(b.id) === String(menu.app_instance_id));
					const slug = target ? target.slug : String(menu.app_instance_id);
					const prefix = cleanId.endsWith('s') ? cleanId.slice(0, -1) : cleanId;
					currentPath = `/v1/app/${prefix}/${slug}`;
				} else {
					currentPath = `/v1/app/${cleanId}`;
				}
			} else {
				currentPath = `/v1/app/${cleanId}`;
			}
		}

		return currentPath;
	}

	let predictedUrl = $derived(getRecursiveUrl(editingMenu) || '(입력 대기...)');

	async function loadData() {
		loading = true;
		try {
			const [m, a, b, p] = await Promise.all([
				api.adminGetMenus(),
				api.adminGetApps(),
				api.adminGetBoards(),
				adminGetPages()
			]);
			menus = m;
			apps = a;
			boards = b;
			pages = p;
		} catch (e) {
			toast.error('데이터 로드 실패: ' + (e.message || '오류 발생'));
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		if (browser) loadData();
	});

	function resetForm() {
		editingMenu = {
			id: '',
			parent_id: '',
			title: '',
			icon_name: '🚀',
			link_type: 'INSTANCE',
			external_url: '',
			app_id: '',
			app_instance_id: '',
			page_mode: 'user',
			order: 0,
			is_visible: true,
			min_rank: 0
		};
	}

	function startCreate() {
		resetForm();
		activeTab = 'form';
	}

	function startEdit(m) {
		editingMenu = {
			id: m.id,
			parent_id: m.parent_id || '',
			title: m.title || '',
			icon_name: m.icon_name || '🚀',
			link_type: m.link_type === 'APP' ? 'INSTANCE' : (m.link_type || 'INSTANCE'),
			external_url: m.external_url || '',
			app_id: m.app_id || '',
			app_instance_id: m.link_type === 'SYSTEM' ? '-1' : (m.app_instance_id != null ? String(m.app_instance_id) : ''),
			page_mode: 'user',
			order: m.order ?? 0,
			is_visible: m.is_visible !== false,
			min_rank: m.min_rank ?? 0
		};
		activeTab = 'form';
	}

	async function handleSave() {
		if (!editingMenu.title?.trim()) {
			toast.warning('메뉴 이름은 필수입니다.');
			return;
		}

		try {
			const data = { ...editingMenu };
			delete data.page_mode;

			data.parent_id = data.parent_id ? Number(data.parent_id) : null;
			data.order = Number(data.order) || 0;
			data.min_rank = Number(data.min_rank) || 0;
			data.is_visible = Boolean(data.is_visible);

			// SYSTEM 앱이거나 관리자 모드인 경우 -1 고정
			if (data.link_type === 'SYSTEM' || String(data.app_instance_id) === '-1') {
				data.app_instance_id = -1;
			} else if (data.app_instance_id === '' || data.app_instance_id == null) {
				data.app_instance_id = null;
			} else if (!isNaN(Number(data.app_instance_id))) {
				data.app_instance_id = Number(data.app_instance_id);
			}

			// 엔진 기반 링크인 경우 정규화된 URL 자동 계산 반영
			if (data.link_type !== 'URL' && data.link_type !== 'FOLDER' && data.link_type !== 'DIVIDER') {
				data.external_url = getRecursiveUrl(data);
			}

			for (const key in data) {
				if (data[key] === '') data[key] = null;
			}

			if (!data.id) {
				delete data.id;
				await api.adminCreateMenu(data);
				toast.success(`[${data.title}] 메뉴가 생성되었습니다.`);
			} else {
				await api.adminUpdateMenu(data.id, data);
				toast.success(`[${data.title}] 메뉴 설정이 갱신되었습니다.`);
			}
			resetForm();
			activeTab = 'tree';
			await loadData();
		} catch (e) {
			toast.error('저장 실패: ' + (e.message || '오류 발생'));
		}
	}

	async function handleDelete(menuId) {
		if (!confirm('이 메뉴를 삭제하시겠습니까?')) return;
		try {
			await api.adminDeleteMenu(menuId);
			toast.success('메뉴가 삭제되었습니다.');
			await loadData();
		} catch (e) {
			toast.error('삭제 실패: ' + (e.message || '오류 발생'));
		}
	}

	function getLinkTypeBadge(type) {
		switch (type) {
			case 'SYSTEM':
				return { label: 'SYSTEM', class: 'bg-purple-50 text-purple-700 border-purple-200' };
			case 'CUSTOM':
				return { label: 'CUSTOM', class: 'bg-rose-50 text-rose-700 border-rose-200' };
			case 'FOLDER':
				return { label: 'FOLDER', class: 'bg-amber-50 text-amber-700 border-amber-200' };
			case 'URL':
				return { label: 'URL', class: 'bg-slate-100 text-slate-700 border-slate-200' };
			default:
				return { label: 'INSTANCE', class: 'bg-blue-50 text-blue-700 border-blue-200' };
		}
	}
</script>

<svelte:head>
	<title>{getSiteTitle('메뉴 설정')}</title>
</svelte:head>

<div class="animate-fade-in mx-auto max-w-7xl space-y-8 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:px-8">
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 우측 컨트롤 바 -->
	<!-- ===================================================================== -->
	<header class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end">
		<div>
			<div class="flex items-center gap-2 mb-2">
				<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-blue-50 text-blue-700 border border-blue-200">
					<Icon icon="ph:list-dashes-bold" class="text-sm" />
					SYSTEM GOVERNANCE • MENU CONFIG
				</span>
				<span class="text-xs font-bold text-slate-400 font-mono">v1/admin/menu</span>
			</div>
			<h1 class="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
				메뉴 <span class="not-italic text-blue-600">설정</span>
			</h1>
			<p class="mt-2 text-xs sm:text-sm font-bold text-slate-500">
				시스템 전체 내비게이션 트리 및 앱 연결, URL 라우팅 경로와 권한을 일괄 편집합니다.
			</p>
		</div>

		<!-- 상단 액션 버튼 그룹 -->
		<div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
			<button
				onclick={startCreate}
				class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-blue-600 bg-blue-600 text-white font-black text-xs uppercase tracking-wider hover:bg-blue-700 transition shadow-sm"
			>
				<Icon icon="ph:plus-circle-bold" class="text-base" />
				<span>새 메뉴 등록</span>
			</button>

			<button
				onclick={loadData}
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
		<!-- 카드 1: 전체 메뉴 항목 수 -->
		<div class="relative overflow-hidden rounded-[1.75rem] border-2 border-slate-100 bg-white p-5 shadow-sm hover:border-blue-300 transition group">
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-blue-600">Total Items</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
					<Icon icon="ph:list-numbers-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countTotalMenus}
				<span class="text-sm font-bold text-slate-400 ml-1">개 노드</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-blue-600">
				<span class="rounded-lg bg-blue-50 px-2 py-0.5 font-mono">활성 네비게이션</span>
			</div>
		</div>

		<!-- 카드 2: 최상위 폴더 그룹 -->
		<div class="relative overflow-hidden rounded-[1.75rem] border-2 border-slate-100 bg-white p-5 shadow-sm hover:border-amber-300 transition group">
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-amber-600">Root Folders</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
					<Icon icon="ph:folder-notch-open-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countRootMenus}
				<span class="text-sm font-bold text-slate-400 ml-1">개 대메뉴</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-amber-600">
				<span class="rounded-lg bg-amber-50 px-2 py-0.5 font-mono">1계층 그룹</span>
			</div>
		</div>

		<!-- 카드 3: 하위 서브메뉴 -->
		<div class="relative overflow-hidden rounded-[1.75rem] border-2 border-slate-100 bg-white p-5 shadow-sm hover:border-emerald-300 transition group">
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-emerald-600">Sub Menus</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
					<Icon icon="ph:git-fork-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countTotalSubMenus}
				<span class="text-sm font-bold text-slate-400 ml-1">개 소메뉴</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-emerald-600">
				<span class="rounded-lg bg-emerald-50 px-2 py-0.5 font-mono">2계층 세부링크</span>
			</div>
		</div>

		<!-- 카드 4: 앱 엔진 직결 링크 -->
		<div class="relative overflow-hidden rounded-[1.75rem] border-2 border-slate-100 bg-white p-5 shadow-sm hover:border-purple-300 transition group">
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black tracking-widest uppercase text-slate-400 group-hover:text-purple-600">App Bindings</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
					<Icon icon="ph:link-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : countAppLinked}
				<span class="text-sm font-bold text-slate-400 ml-1">개 바인딩</span>
			</div>
			<div class="mt-2 flex items-center gap-2 text-xs font-bold text-purple-600">
				<span class="rounded-lg bg-purple-50 px-2 py-0.5 font-mono">동적 엔진 연결</span>
			</div>
		</div>
	</section>

	<!-- ===================================================================== -->
	<!-- 3. 모드 탭 바 (최소 1개, 일관성 및 확장성) -->
	<!-- ===================================================================== -->
	<nav class="flex gap-2 border-b-2 border-slate-200 overflow-x-auto no-scrollbar">
		<button
			onclick={() => (activeTab = 'tree')}
			class="px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeTab === 'tree' ? 'border-b-4 border-blue-600 text-blue-700 bg-blue-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
		>
			메뉴 트리 및 구조 ({menus.length})
		</button>
		<button
			onclick={startCreate}
			class="px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeTab === 'form' ? 'border-b-4 border-blue-600 text-blue-700 bg-blue-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
		>
			{editingMenu.id ? `메뉴 항목 수정: ${editingMenu.title}` : '새 메뉴 등록'}
		</button>
	</nav>

	<!-- ===================================================================== -->
	<!-- 4. 본문 컨텐츠 (반응형 카드 형식 위주) -->
	<!-- ===================================================================== -->
	{#if loading}
		<div class="flex justify-center py-20">
			<div class="flex flex-col items-center gap-3">
				<div class="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
				<p class="text-xs font-bold text-slate-400 font-mono">메뉴 아키텍처 동기화 중...</p>
			</div>
		</div>
	{:else if activeTab === 'tree'}
		<!-- 탭 1: 메뉴 계층 카드 목록 -->
		<div class="space-y-4">
			{#if menus.length === 0}
				<div class="rounded-3xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
					<Icon icon="ph:list-dashes-light" class="mx-auto text-4xl text-slate-300 mb-3" />
					<p class="text-sm font-bold text-slate-500">등록된 메뉴 항목이 없습니다.</p>
					<button
						onclick={startCreate}
						class="mt-4 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs hover:bg-blue-700 transition"
					>
						첫 메뉴 등록하기
					</button>
				</div>
			{:else}
				<div class="grid grid-cols-1 md:grid-cols-2 gap-5">
					{#each menus as m (m.id)}
						{@const badge = getLinkTypeBadge(m.link_type)}
						<div class="rounded-2xl border-2 border-slate-200 bg-white p-6 shadow-sm hover:border-blue-400 transition-all flex flex-col justify-between">
							<div>
								<div class="flex items-center justify-between mb-3">
									<div class="flex items-center gap-3">
										<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 text-blue-600">
											<SmartIcon
												icon={m.icon_name}
												fallback="ph:squares-four-bold"
												class="h-6 w-6"
												emojiClass="text-2xl leading-none"
											/>
										</div>
										<div>
											<h3 class="text-lg font-black text-slate-900 tracking-tight leading-snug">{m.title}</h3>
											<span class="font-mono text-xs text-slate-400">{m.external_url || '#'}</span>
										</div>
									</div>
									<div class="flex flex-wrap items-center gap-1.5 justify-end">
										<span class="px-2 py-0.5 rounded text-[10px] font-black bg-slate-900 text-white font-mono" title="정렬 순서">
											#{m.order ?? 0}
										</span>
										<span class="px-2 py-0.5 rounded text-[10px] font-bold border {badge.class}">
											{badge.label}
										</span>
										<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 font-mono">
											R{m.min_rank ?? 0}
										</span>
										{#if m.is_visible === false}
											<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
												숨김
											</span>
										{/if}
									</div>
								</div>

								<!-- 하위 서브메뉴가 있는 경우 -->
								{#if m.sub_menus && m.sub_menus.length > 0}
									<div class="mt-4 pt-3 border-t border-slate-100 space-y-2">
										<span class="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
											하위 서브메뉴 ({m.sub_menus.length})
										</span>
										{#each m.sub_menus as sub (sub.id)}
											<div class="flex items-center justify-between bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-100">
												<div class="flex items-center gap-2 min-w-0">
													<span class="text-slate-400 text-xs">└</span>
													<span class="px-1.5 py-0.5 rounded bg-slate-200 text-[10px] font-black text-slate-700 font-mono">
														#{sub.order ?? 0}
													</span>
													<SmartIcon
														icon={sub.icon_name}
														fallback="ph:link-bold"
														class="h-3.5 w-3.5 text-slate-400 shrink-0"
														emojiClass="text-xs leading-none shrink-0"
													/>
													<span class="text-xs font-bold text-slate-800 truncate">{sub.title}</span>
													<span class="font-mono text-[10px] text-slate-400">R{sub.min_rank ?? 0}</span>
													{#if sub.is_visible === false}
														<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
															숨김
														</span>
													{/if}
												</div>
												<div class="flex items-center gap-1.5">
													<button
														type="button"
														onclick={() => startEdit(sub)}
														class="px-2 py-0.5 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded"
													>
														수정
													</button>
													<button
														type="button"
														onclick={() => handleDelete(sub.id)}
														class="px-2 py-0.5 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded"
													>
														삭제
													</button>
												</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>

							<div class="mt-6 pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
								<button
									type="button"
									onclick={() => startEdit(m)}
									class="px-3 py-1.5 text-xs font-black text-blue-600 hover:bg-blue-50 rounded-xl transition"
								>
									수정
								</button>
								<button
									type="button"
									onclick={() => handleDelete(m.id)}
									class="px-3 py-1.5 text-xs font-bold text-rose-500 hover:bg-rose-50 rounded-xl transition"
								>
									삭제
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{:else}
		<!-- 탭 2: 등록/수정 폼 카드 -->
		<div class="rounded-3xl border-2 border-slate-200 bg-white p-6 sm:p-10 shadow-sm max-w-4xl">
			<div class="mb-8 flex flex-wrap items-baseline justify-between gap-3 border-b-2 border-slate-100 pb-4">
				<div>
					<h3 class="text-2xl font-black text-slate-900 tracking-tight">
						{editingMenu.id ? `메뉴 정보 수정: ${editingMenu.title}` : '메뉴 신규 등록'}
					</h3>
					<p class="text-xs font-bold text-slate-400 mt-1">
						상위 메뉴를 지정하거나 앱 엔진을 연결하여 내비게이션 경로를 생성합니다.
					</p>
				</div>
				<div class="flex items-center gap-2">
					<span class="text-xs font-bold text-slate-400">예측 경로:</span>
					<span class="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
						{predictedUrl}
					</span>
				</div>
			</div>

			<div class="space-y-6">
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
					<div class="space-y-1.5">
						<label for="menu-parent" class="block text-xs font-black text-slate-700 tracking-wide">
							상위 메뉴 (소속 그룹)
						</label>
						<select
							id="menu-parent"
							bind:value={editingMenu.parent_id}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold text-slate-800 bg-white focus:border-blue-600 focus:outline-none transition"
						>
							<option value="">-- 최상위 메뉴 (그룹 없음) --</option>
							{#each menus as m}
								{#if m.id !== editingMenu.id}
									<option value={m.id}>📂 {m.title} (ID: {m.id})</option>
								{/if}
							{/each}
						</select>
					</div>

					<div class="space-y-1.5">
						<label for="menu-title" class="block text-xs font-black text-slate-700 tracking-wide">
							메뉴 이름 <span class="text-rose-500">*</span>
						</label>
						<input
							id="menu-title"
							type="text"
							bind:value={editingMenu.title}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold text-slate-800 bg-slate-50 focus:bg-white focus:border-blue-600 focus:outline-none transition"
							placeholder="예: 공지사항, 차량 배차"
						/>
					</div>
				</div>

				<div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
					<div class="space-y-1.5">
						<label for="menu-type" class="block text-xs font-black text-slate-700 tracking-wide">
							연결 방식 (타입)
						</label>
						<select
							id="menu-type"
							bind:value={editingMenu.link_type}
							onchange={() => {
								if (editingMenu.link_type === 'SYSTEM') {
									editingMenu.app_instance_id = '-1';
								} else if (editingMenu.app_instance_id !== '-1') {
									editingMenu.app_instance_id = '';
								}
							}}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold text-slate-800 bg-white focus:border-blue-600 focus:outline-none transition"
						>
							<option value="INSTANCE">🧩 인스턴스 앱 (INSTANCE)</option>
							<option value="CUSTOM">🛠️ 커스텀 앱 (CUSTOM)</option>
							<option value="SYSTEM">🛡️ 시스템 앱 (SYSTEM)</option>
							<option value="URL">🔗 고정 주소 (URL)</option>
							<option value="FOLDER">📁 메뉴 그룹 (FOLDER)</option>
						</select>
					</div>

					<div class="space-y-1.5">
						<label for="menu-rank" class="block text-xs font-black text-slate-700 tracking-wide">
							필요 등급
						</label>
						<select
							id="menu-rank"
							bind:value={editingMenu.min_rank}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold text-slate-800 bg-white focus:border-blue-600 focus:outline-none transition"
						>
							<option value={0}>전체 (R0)</option>
							<option value={1}>직원 (R1)</option>
							<option value={2}>관리자 (R2)</option>
							<option value={4}>마스터 (R4)</option>
							<option value={8}>시스템관리자 (R8)</option>
						</select>
					</div>

					<div class="space-y-1.5">
						<label for="menu-icon" class="block text-xs font-black text-slate-700 tracking-wide">
							아이콘
						</label>
						<div class="flex items-center gap-2">
							<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50 text-blue-600">
								<SmartIcon
									icon={editingMenu.icon_name}
									fallback="ph:rocket-fill"
									class="h-5 w-5"
									emojiClass="text-xl leading-none"
								/>
							</div>
							<input
								id="menu-icon"
								type="text"
								bind:value={editingMenu.icon_name}
								class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-bold text-slate-800 bg-white focus:border-blue-600 focus:outline-none transition"
								placeholder="이모지 또는 Iconify (예: ph:rocket-fill)"
							/>
						</div>
					</div>
				</div>

				<!-- 앱 엔진 연결 섹션 -->
				{#if ['INSTANCE', 'CUSTOM', 'SYSTEM', 'APP'].includes(editingMenu.link_type)}
					<div class="space-y-5 rounded-2xl border-2 border-blue-100 bg-blue-50/50 p-6">
						<div class="space-y-1.5">
							<label for="menu-app-id" class="block text-xs font-black text-blue-700 tracking-wide">
								1. 연결할 앱 엔진 선택
							</label>
							<select
								id="menu-app-id"
								bind:value={editingMenu.app_id}
								onchange={() => {
									const selected = apps.find((a) => a.app_id === editingMenu.app_id);
									if (selected) {
										if (['INSTANCE', 'CUSTOM', 'SYSTEM'].includes(selected.app_type)) {
											editingMenu.link_type = selected.app_type;
											if (selected.app_type === 'SYSTEM') {
												editingMenu.app_instance_id = '-1';
											} else if (editingMenu.app_instance_id !== '-1') {
												editingMenu.app_instance_id = '';
											}
										}
									}
								}}
								class="w-full px-4 py-3 rounded-2xl border-2 border-blue-200 text-xs font-bold text-slate-800 bg-white focus:border-blue-600 focus:outline-none transition"
							>
								<option value="">-- 연결할 앱 엔진 선택 --</option>
								{#each apps as app}
									<option value={app.app_id}>[{app.app_type}] {app.title || app.name} ({app.app_id})</option>
								{/each}
							</select>
						</div>

						<div class="space-y-1.5">
							<label for="menu-instance" class="block text-xs font-black text-blue-700 tracking-wide">
								2. 상세 인스턴스 / 화면 모드
							</label>
							{#if editingMenu.link_type === 'SYSTEM'}
								<div class="flex h-12 w-full items-center rounded-2xl border-2 border-blue-200 bg-slate-100 px-4 text-xs font-bold text-slate-700">
									🛡️ 시스템 관리자 화면 전용 ({apps.find((a) => a.app_id === editingMenu.app_id)?.frontend_route || `/v1/admin/${editingMenu.app_id}`})
								</div>
							{:else if editingMenu.link_type === 'CUSTOM'}
								<select
									id="menu-instance"
									bind:value={editingMenu.app_instance_id}
									class="w-full px-4 py-3 rounded-2xl border-2 border-blue-200 text-xs font-bold text-slate-800 bg-white focus:border-blue-600 focus:outline-none transition"
								>
									<option value="-1">🛠️ 관리자 화면 ({apps.find((a) => a.app_id === editingMenu.app_id)?.frontend_route || `/v1/admin/${editingMenu.app_id}`})</option>
									<option value="">👤 사용자 화면 (/v1/custom/{editingMenu.app_id})</option>
								</select>
							{:else}
								<select
									id="menu-instance"
									bind:value={editingMenu.app_instance_id}
									class="w-full px-4 py-3 rounded-2xl border-2 border-blue-200 text-xs font-bold text-slate-800 bg-white focus:border-blue-600 focus:outline-none transition"
								>
									<option value="-1">🛠️ 관리자 관제탑 (/v1/admin/{editingMenu.app_id})</option>
									<option value="">🌐 인스턴스 카탈로그 허브 (/v1/app/{editingMenu.app_id})</option>
									{#if boards && boards.length > 0}
										<optgroup label="개별 게시판 인스턴스">
											{#each boards as b}
												<option value={String(b.id)}>📋 {b.name} (/{b.slug})</option>
											{/each}
										</optgroup>
									{/if}
								</select>
							{/if}
						</div>
					</div>
				{:else if editingMenu.link_type === 'URL'}
					<div class="space-y-4 rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-6">
						<div class="space-y-1.5">
							<label for="menu-url" class="block text-xs font-black text-slate-700 tracking-wide">
								고정 경로 / URL 직접 입력
							</label>
							<input
								id="menu-url"
								type="text"
								bind:value={editingMenu.external_url}
								class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-mono font-bold text-slate-800 bg-white focus:border-blue-600 focus:outline-none transition"
								placeholder="/v1/pages/schedule 또는 https://..."
							/>
						</div>
						{#if pages && pages.length > 0}
							<div class="flex flex-wrap items-center gap-1.5 pt-1">
								<span class="text-[11px] font-bold text-slate-400 mr-1">CMS 페이지 빠른 연결:</span>
								{#each pages as p}
									<button
										type="button"
										onclick={() => (editingMenu.external_url = `/v1/custom/page/${p.slug}`)}
										class="px-2.5 py-1 rounded-xl border border-slate-200 bg-white text-[11px] font-bold text-slate-600 hover:border-blue-400 hover:text-blue-600 transition"
									>
										📄 {p.title}
									</button>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- 정렬 순서 및 가시성 설정 -->
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
					<div class="space-y-1.5">
						<label for="menu-order" class="block text-xs font-black text-slate-700 tracking-wide">
							정렬 순서 (Order)
						</label>
						<input
							id="menu-order"
							type="number"
							bind:value={editingMenu.order}
							class="w-full px-4 py-3 rounded-2xl border-2 border-slate-200 text-xs font-mono font-black text-slate-900 bg-white focus:border-blue-600 focus:outline-none transition"
							placeholder="0"
						/>
						<p class="text-[11px] font-medium text-slate-400">숫자가 작을수록 메뉴 상단에 먼저 배치됩니다. (예: 0, 1, 2...)</p>
					</div>

					<div class="space-y-1.5">
						<span class="block text-xs font-black text-slate-700 tracking-wide">메뉴 노출 여부</span>
						<label
							for="menu-visible"
							class="flex cursor-pointer items-center justify-between rounded-2xl border-2 px-4 py-3 transition {editingMenu.is_visible
								? 'border-emerald-200 bg-emerald-50/50'
								: 'border-slate-200 bg-slate-50'}"
						>
							<div class="flex items-center gap-2.5">
								<input
									id="menu-visible"
									type="checkbox"
									bind:checked={editingMenu.is_visible}
									class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
								/>
								<span class="text-xs font-black {editingMenu.is_visible ? 'text-emerald-700' : 'text-slate-500'}">
									{editingMenu.is_visible ? '사이드바 표시함 (Visible)' : '숨김 처리됨 (Hidden)'}
								</span>
							</div>
							<span class="rounded-full px-2 py-0.5 text-[10px] font-black {editingMenu.is_visible ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}">
								{editingMenu.is_visible ? 'ON' : 'OFF'}
							</span>
						</label>
					</div>
				</div>

				<div class="pt-6 border-t border-slate-100 flex flex-wrap items-center gap-3">
					<button
						onclick={handleSave}
						class="px-6 py-3 rounded-2xl bg-blue-600 text-white font-black text-xs uppercase tracking-wider hover:bg-blue-700 transition shadow-md"
					>
						{editingMenu.id ? '메뉴 설정 저장하기' : '새 메뉴 생성하기'}
					</button>

					<button
						onclick={() => { resetForm(); activeTab = 'tree'; }}
						class="px-5 py-3 rounded-2xl border-2 border-slate-200 text-slate-600 font-black text-xs uppercase hover:bg-slate-50 transition"
					>
						목록으로 돌아가기
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
