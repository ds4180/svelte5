<script lang="ts">
	/**
	 * ============================================================================
	 * [미디어·파일 통합 관제탑 오케스트레이터 ((app)/v1/admin/media/+page.svelte)]
	 * ============================================================================
	 * - 관리자 표준 템플릿(통합 헤더 + 4대 핵심 지표 카드 + 탭 바 + 우측 끝 '설정' 탭) 구조로 정비
	 * - 비즈니스 로직·파일 다운로드·필터링은 mediaAdminService로,
	 *   탐색기/모달/정책 설정/상세 뷰어는 전용 컴포넌트로 완전 분리
	 */
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';
	import Icon from '@iconify/svelte';
	import {
		adminBackupMedia,
		adminBulkDeleteMedia,
		adminCreateMediaFolder,
		adminDeleteMedia,
		adminGetMediaList,
		adminGetMediaSettings,
		adminGetMediaStats,
		adminRunMediaGC
	} from '$lib/api/admin';
	import MediaAssetDetailModal from '$lib/components/media/MediaAssetDetailModal.svelte';
	import { validateMediaFolderName, type MediaAssetLike } from '$lib/config/media';
	import { getSiteTitle } from '$lib/config/site';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { toast } from '$lib/runes/toast.svelte';
	import {
		buildMediaExplorerTabs,
		DEFAULT_MEDIA_SETTINGS,
		downloadMediaAssetBlob,
		downloadMediaZipBlob,
		normalizeMediaSettings,
		type MediaPermissions,
		type MediaSettings,
		type MediaTabItem
	} from '$lib/services/mediaAdminService';
	import { formatBytes, toLocalISOString } from '$lib/utils';
	import { formatApiError } from '$lib/utils/error';

	import MediaActionModals from './components/MediaActionModals.svelte';
	import MediaExplorerTab from './components/MediaExplorerTab.svelte';
	import MediaSettingsTab from './components/MediaSettingsTab.svelte';

	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';
	const auth = getAuthContext();

	const userRank = $derived(Number(auth.user?.rank_level ?? 0));
	const userId = $derived(Number(auth.user?.id ?? 0));

	// --- 동적 정책 및 거버넌스 권한 상태 ---
	let mediaSettings = $state<MediaSettings>({ ...DEFAULT_MEDIA_SETTINGS });
	let permissions = $state<MediaPermissions>({
		can_admin_read: false,
		can_admin_write: false
	});

	const canAdminRead = $derived(permissions.can_admin_read || userRank >= 4);
	const canAdminWrite = $derived(permissions.can_admin_write || userRank >= 4);

	const tabConfigs = $derived(
		buildMediaExplorerTabs({
			userId,
			canAdminRead,
			canAdminWrite,
			settings: mediaSettings
		})
	);

	// --- 관제 지표 및 탐색기 상태 ---
	let stats = $state<{
		total_count: number;
		total_size_bytes: number;
		tier_summary: Record<string, { count: number; size: number }>;
	}>({
		total_count: 0,
		total_size_bytes: 0,
		tier_summary: {}
	});

	let folders = $state<any[]>([]);
	let recursiveFiles = $state<MediaAssetLike[]>([]);
	let isLoadingStats = $state(true);
	let isLoadingMedia = $state(true);

	let activeTabId = $state('SHARED');
	let currentSubPath = $state('GLOBAL/OFFICE');
	let viewMode = $state<'grid' | 'list'>('grid');
	let isRecursive = $state(true);
	let showHidden = $state(false);

	let selectedIds = $state(new Set<number>());
	let selectedFolders = $state(new Set<string>());
	let selectedAsset = $state<MediaAssetLike | null>(null);

	// 모달 상태
	let newFolderModalOpen = $state(false);
	let isCreatingFolder = $state(false);
	let deleteConfirmModalOpen = $state(false);
	let isDeleting = $state(false);
	let gcModalOpen = $state(false);

	const currentTab = $derived(
		tabConfigs.find((t) => t.id === activeTabId) || tabConfigs[0]
	);

	async function loadSettings() {
		try {
			const res = await adminGetMediaSettings();
			const normalized = normalizeMediaSettings(res?.settings);
			mediaSettings = normalized;
			if (res?.permissions) {
				permissions = res.permissions;
			}
			viewMode = normalized.default_view_mode;
			isRecursive = normalized.default_recursive_view;
		} catch (err) {
			console.error('[MediaAdmin] Settings load fail:', err);
		}
	}

	async function loadStats() {
		if (!canAdminRead) {
			isLoadingStats = false;
			return;
		}
		isLoadingStats = true;
		try {
			stats = await adminGetMediaStats();
		} catch (err) {
			console.error('[MediaAdmin] Stats fail:', err);
		} finally {
			isLoadingStats = false;
		}
	}

	async function loadMedia() {
		if (!currentTab || currentTab.isSettings) return;
		isLoadingMedia = true;
		selectedIds = new Set();
		selectedFolders = new Set();
		try {
			const res = await adminGetMediaList({
				tier: currentTab.tier,
				sub_path: currentSubPath,
				recursive: isRecursive,
				show_hidden: showHidden
			});
			folders = res.folders || [];
			recursiveFiles = res.files || [];
		} catch (err) {
			toast.error(formatApiError(err, '미디어 목록을 불러오지 못했습니다.'));
		} finally {
			isLoadingMedia = false;
		}
	}

	function selectTab(tab: MediaTabItem) {
		activeTabId = tab.id;
		if (!tab.isSettings) {
			currentSubPath = tab.basePath;
			loadMedia();
		}
	}

	function navigateSubPath(nextPath: string) {
		currentSubPath = nextPath;
		loadMedia();
	}

	function goToParent() {
		if (!currentTab || currentSubPath === currentTab.basePath) return;
		const parts = currentSubPath.split('/').filter(Boolean);
		parts.pop();
		const joined = parts.join('/');
		currentSubPath =
			currentTab.basePath && !joined.startsWith(currentTab.basePath)
				? currentTab.basePath
				: joined;
		loadMedia();
	}

	function toggleSelectFile(id: number) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedIds = next;
	}

	function toggleSelectFolder(path: string) {
		const next = new Set(selectedFolders);
		if (next.has(path)) next.delete(path);
		else next.add(path);
		selectedFolders = next;
	}

	function toggleSelectAll(visibleFolderPaths: string[], visibleFileIds: number[]) {
		if (selectedIds.size + selectedFolders.size > 0) {
			selectedIds = new Set();
			selectedFolders = new Set();
		} else {
			selectedFolders = new Set(visibleFolderPaths);
			selectedIds = new Set(visibleFileIds);
		}
	}

	async function handleCreateFolder(rawName: string) {
		const name = rawName.trim();
		const validationError = validateMediaFolderName(name, currentSubPath);
		if (validationError) {
			toast.warning(validationError);
			return;
		}
		isCreatingFolder = true;
		try {
			await adminCreateMediaFolder({
				tier: currentTab.tier,
				sub_path: currentSubPath,
				folder_name: name
			});
			toast.success(`'${name}' 폴더가 생성되었습니다.`);
			newFolderModalOpen = false;
			await loadMedia();
		} catch (err) {
			toast.error('폴더 생성 실패: ' + formatApiError(err));
		} finally {
			isCreatingFolder = false;
		}
	}

	async function handleBackup(assetIdsOverride: number[] | null = null) {
		const targetIds = assetIdsOverride || Array.from(selectedIds);
		if (targetIds.length === 0 && selectedFolders.size === 0) {
			toast.warning('백업할 파일을 선택해 주세요.');
			return;
		}
		if (!assetIdsOverride && selectedFolders.size > 0) {
			toast.warning('폴더 백업은 지원되지 않습니다. 파일만 선택하여 백업해 주세요.');
			return;
		}
		try {
			const res = await adminBackupMedia({
				asset_ids: targetIds,
				folder_paths: [],
				tier: currentTab.tier
			});
			toast.success(res.message || '백업 작업이 예약되었습니다.');
			selectedIds = new Set();
			selectedFolders = new Set();
			await loadMedia();
		} catch (err) {
			toast.error('백업 실패: ' + formatApiError(err));
		}
	}

	async function handleBulkDelete() {
		if (selectedIds.size === 0 && selectedFolders.size === 0) return;
		isDeleting = true;
		try {
			const res = await adminBulkDeleteMedia({
				asset_ids: Array.from(selectedIds),
				folder_paths: Array.from(selectedFolders),
				tier: currentTab.tier
			});
			toast.success(res.message || '선택한 항목이 격리 삭제 처리되었습니다.');
			deleteConfirmModalOpen = false;
			selectedIds = new Set();
			selectedFolders = new Set();
			await Promise.all([loadMedia(), loadStats()]);
		} catch (err) {
			toast.error('삭제 실패: ' + formatApiError(err));
		} finally {
			isDeleting = false;
		}
	}

	async function handleDeleteSingle(assetId: number) {
		try {
			await adminDeleteMedia(assetId);
			toast.success('파일이 안전하게 삭제(격리)되었습니다.');
			selectedAsset = null;
			await Promise.all([loadStats(), loadMedia()]);
		} catch (err) {
			toast.error('삭제 실패: ' + formatApiError(err));
		}
	}

	async function handleZipDownload() {
		if (selectedIds.size === 0 && selectedFolders.size === 0) {
			toast.warning('다운로드할 항목을 선택해 주세요.');
			return;
		}
		try {
			await downloadMediaZipBlob({
				asset_ids: Array.from(selectedIds),
				folder_paths: Array.from(selectedFolders),
				tier: currentTab.tier
			});
			toast.success('ZIP 다운로드가 시작되었습니다.');
		} catch (err: any) {
			toast.error('다운로드 실패: ' + (err?.message || '오류'));
		}
	}

	async function handleDownloadSingle(asset: MediaAssetLike, size: string | null = null) {
		try {
			const fileName = await downloadMediaAssetBlob(PUBLIC_SERVER_URL, asset, size);
			toast.success(`${fileName} 다운로드가 완료되었습니다.`);
		} catch (err: any) {
			toast.error('다운로드 실패: ' + (err?.message || '오류'));
		}
	}

	async function handleRunGC(params: {
		indices: number[];
		runMode: 'now' | 'later';
		scheduledAt: string;
	}) {
		try {
			const res = await adminRunMediaGC({
				indices: params.indices,
				scheduled_at:
					params.runMode === 'later' && params.scheduledAt
						? toLocalISOString(params.scheduledAt)
						: null
			});
			toast.success(res.message || '시스템 정리(GC) 작업이 예약되었습니다.');
			gcModalOpen = false;
			await loadStats();
		} catch (err) {
			toast.error('GC 예약 실패: ' + formatApiError(err, '오류'));
		}
	}

	onMount(async () => {
		await loadSettings();
		const initialTab = tabConfigs.find((t) => t.id === activeTabId) || tabConfigs[0];
		if (initialTab && !initialTab.isSettings) {
			currentSubPath = initialTab.basePath;
		}
		await Promise.all([loadStats(), loadMedia()]);
	});
</script>

<svelte:head>
	<title>{getSiteTitle('파일·사진 관리')}</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-8 px-4 pb-24 font-['Outfit','Noto_Sans_KR'] md:px-8">
	<!-- 🏛️ 모던 엔터프라이즈 통합 헤더 -->
	<header class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end">
		<div>
			<div class="flex items-center gap-2 mb-2">
				<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-200">
					<Icon icon="ph:database-duotone" class="text-sm" />
					SYSTEM GOVERNANCE • FILE & MEDIA MASTER
				</span>
				<span class="text-xs font-bold text-slate-400 font-mono">Rank {userRank}</span>
			</div>
			<h1 class="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
				파일·<span class="text-rose-600 not-italic">사진 관리</span>
			</h1>
			<p class="mt-2 text-xs sm:text-sm font-bold text-slate-500">
				4단계 저장 계층(Tier) 미디어를 탐색하고 수명주기·용량·변환 정책을 동적으로 관제합니다.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
			{#if canAdminRead && !currentTab?.isSettings}
				<button
					type="button"
					onclick={() => {
						showHidden = !showHidden;
						loadMedia();
					}}
					class="flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 font-black text-xs uppercase tracking-wider transition-all shadow-xs {showHidden ? 'bg-amber-500 border-amber-500 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}"
					title="닷(.) 및 DEL_ 격리 파일과 폴더를 목록에 표시합니다."
				>
					<Icon icon={showHidden ? 'ph:eye-bold' : 'ph:eye-slash-bold'} class="text-base" />
					<span>숨김·격리 {showHidden ? 'ON' : 'OFF'}</span>
				</button>
			{/if}

			{#if canAdminWrite}
				<button
					type="button"
					onclick={() => (gcModalOpen = true)}
					class="flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 border-indigo-600 bg-indigo-50 text-indigo-700 font-black text-xs uppercase tracking-wider hover:bg-indigo-600 hover:text-white transition-all shadow-xs"
				>
					<Icon icon="mdi:broom" class="text-base" />
					<span>시스템 정리 (GC)</span>
				</button>
			{/if}

			<button
				type="button"
				onclick={() => {
					loadSettings();
					loadStats();
					loadMedia();
					toast.info('미디어 자산 및 정책 현황을 새로고침했습니다.');
				}}
				class="flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 border-slate-200 bg-white font-black text-xs uppercase tracking-wider text-slate-700 hover:border-rose-500 hover:text-rose-600 transition-all shadow-xs"
			>
				<Icon icon="ph:arrows-clockwise-bold" class="text-base {isLoadingMedia ? 'animate-spin' : ''}" />
				<span>새로고침</span>
			</button>

			<a
				href="/v1/admin"
				class="flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 border-slate-200 bg-white font-black text-xs uppercase tracking-wider text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-all shadow-xs"
			>
				<Icon icon="solar:home-smile-angle-bold-duotone" class="text-base text-slate-500" />
				<span>관리자 홈</span>
			</a>
		</div>
	</header>

	<!-- 📊 전사 표준 4대 핵심 관제 지표 요약 카드 -->
	{#if canAdminRead}
		<section class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
			<div class="relative overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white p-6 shadow-xs hover:border-indigo-200 transition-all">
				<div class="flex w-full items-center justify-between gap-2 mb-4">
					<span class="min-w-0 truncate text-[11px] font-black tracking-widest uppercase text-slate-400">Total Assets</span>
					<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
						<Icon icon="ph:files-bold" class="text-2xl" />
					</div>
				</div>
				<div class="text-3xl font-black text-slate-900 tracking-tight">
					{isLoadingStats ? '...' : stats.total_count.toLocaleString()}
					<span class="text-sm font-bold text-slate-400 ml-1">건</span>
				</div>
				<div class="mt-3 flex items-center gap-2 text-xs font-bold text-indigo-600">
					<span class="rounded-lg bg-indigo-50 px-2 py-0.5 font-mono">{formatBytes(stats.total_size_bytes)}</span>
					<span class="text-slate-400">누적 스토리지</span>
				</div>
			</div>

			<button
				type="button"
				onclick={() => {
					const tab = tabConfigs.find((t) => t.id === 'PUBLIC');
					if (tab) selectTab(tab);
				}}
				class="w-full text-left relative overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white p-6 shadow-xs hover:border-emerald-300 transition-all group"
			>
				<div class="flex w-full items-center justify-between gap-2 mb-4">
					<span class="min-w-0 truncate text-[11px] font-black tracking-widest uppercase text-slate-400 group-hover:text-emerald-600">Public Tier</span>
					<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
						<Icon icon="ph:globe-hemisphere-west-bold" class="text-2xl" />
					</div>
				</div>
				<div class="text-3xl font-black text-slate-900 tracking-tight">
					{isLoadingStats ? '...' : (stats.tier_summary['PUBLIC']?.count || 0).toLocaleString()}
					<span class="text-sm font-bold text-slate-400 ml-1">건</span>
				</div>
				<div class="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-600">
					<span class="rounded-lg bg-emerald-50 px-2 py-0.5 font-mono">{formatBytes(stats.tier_summary['PUBLIC']?.size || 0)}</span>
					<span class="text-slate-400">서비스 노출 자산</span>
				</div>
			</button>

			<button
				type="button"
				onclick={() => {
					const tab = tabConfigs.find((t) => t.id === 'PROTECTED');
					if (tab) selectTab(tab);
				}}
				class="w-full text-left relative overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white p-6 shadow-xs hover:border-amber-300 transition-all group"
			>
				<div class="flex w-full items-center justify-between gap-2 mb-4">
					<span class="min-w-0 truncate text-[11px] font-black tracking-widest uppercase text-slate-400 group-hover:text-amber-600">Protected Tier</span>
					<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
						<Icon icon="ph:shield-check-bold" class="text-2xl" />
					</div>
				</div>
				<div class="text-3xl font-black text-slate-900 tracking-tight">
					{isLoadingStats ? '...' : (stats.tier_summary['PROTECTED']?.count || 0).toLocaleString()}
					<span class="text-sm font-bold text-slate-400 ml-1">건</span>
				</div>
				<div class="mt-3 flex items-center gap-2 text-xs font-bold text-amber-600">
					<span class="rounded-lg bg-amber-50 px-2 py-0.5 font-mono">{formatBytes(stats.tier_summary['PROTECTED']?.size || 0)}</span>
					<span class="text-slate-400">임직원 전용 업무</span>
				</div>
			</button>

			<button
				type="button"
				onclick={() => {
					const tab = tabConfigs.find((t) => t.id === 'PERSONAL' || t.id === 'SHARED');
					if (tab) selectTab(tab);
				}}
				class="w-full text-left relative overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white p-6 shadow-xs hover:border-rose-300 transition-all group"
			>
				<div class="flex w-full items-center justify-between gap-2 mb-4">
					<span class="min-w-0 truncate text-[11px] font-black tracking-widest uppercase text-slate-400 group-hover:text-rose-600">Private & Core</span>
					<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
						<Icon icon="ph:lock-key-bold" class="text-2xl" />
					</div>
				</div>
				<div class="text-3xl font-black text-slate-900 tracking-tight">
					{isLoadingStats
						? '...'
						: ((stats.tier_summary['PRIVATE']?.count || 0) + (stats.tier_summary['SYSTEM']?.count || 0)).toLocaleString()}
					<span class="text-sm font-bold text-slate-400 ml-1">건</span>
				</div>
				<div class="mt-3 flex items-center gap-2 text-xs font-bold text-rose-600">
					<span class="rounded-lg bg-rose-50 px-2 py-0.5 font-mono">
						개인 {stats.tier_summary['PRIVATE']?.count || 0} / 시스템 {stats.tier_summary['SYSTEM']?.count || 0}
					</span>
				</div>
			</button>
		</section>
	{/if}

	<!-- 🗂️ 탭 내비게이션 (가장 오른쪽에 '설정' 탭 배치) -->
	<nav class="flex items-center gap-2 border-b-2 border-slate-200 overflow-x-auto no-scrollbar">
		{#each tabConfigs as tab (tab.id)}
			<button
				type="button"
				onclick={() => selectTab(tab)}
				class="px-5 py-3.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5 {tab.isSettings ? 'ml-auto' : ''} {activeTabId === tab.id
					? tab.isSettings
						? 'border-b-4 border-slate-900 text-slate-900 bg-slate-100 rounded-t-2xl'
						: 'border-b-4 border-rose-600 text-rose-600 bg-rose-50/50 rounded-t-2xl'
					: 'text-slate-400 hover:text-slate-700'}"
			>
				{#if tab.isSettings}
					<Icon icon="ph:gear-six-bold" class="text-sm" />
				{/if}
				<span>{tab.label}</span>
			</button>
		{/each}
	</nav>

	<!-- 본문 영역: 설정 탭 vs 탐색기 탭 -->
	{#if currentTab?.isSettings}
		<MediaSettingsTab
			settings={mediaSettings}
			onSaved={(saved) => {
				mediaSettings = saved;
				viewMode = saved.default_view_mode;
				isRecursive = saved.default_recursive_view;
			}}
		/>
	{:else if currentTab}
		<MediaExplorerTab
			{currentTab}
			{currentSubPath}
			{folders}
			files={recursiveFiles}
			{isLoadingMedia}
			{isRecursive}
			{viewMode}
			{selectedIds}
			{selectedFolders}
			{canAdminWrite}
			settings={mediaSettings}
			serverUrl={PUBLIC_SERVER_URL}
			onUploadSuccess={() => {
				loadStats();
				loadMedia();
			}}
			onNavigateSubPath={navigateSubPath}
			onGoToParent={goToParent}
			onToggleRecursive={() => {
				isRecursive = !isRecursive;
				loadMedia();
			}}
			onChangeViewMode={(mode) => (viewMode = mode)}
			onToggleSelectFile={toggleSelectFile}
			onToggleSelectFolder={toggleSelectFolder}
			onToggleSelectAll={toggleSelectAll}
			onOpenCreateFolder={() => (newFolderModalOpen = true)}
			onZipDownload={handleZipDownload}
			onBackupSelected={() => handleBackup(null)}
			onOpenBulkDelete={() => {
				if (selectedIds.size === 0 && selectedFolders.size === 0) {
					toast.warning('삭제할 항목을 먼저 선택해 주세요.');
					return;
				}
				deleteConfirmModalOpen = true;
			}}
			onSelectAssetDetail={(asset) => (selectedAsset = asset)}
			onDownloadSingle={(asset) => handleDownloadSingle(asset, null)}
		/>
	{/if}
</div>

<!-- 액션 모달 (새 폴더 / 일괄 삭제 / GC 예약) -->
{#if currentTab}
	<MediaActionModals
		{currentTab}
		{currentSubPath}
		settings={mediaSettings}
		{newFolderModalOpen}
		{isCreatingFolder}
		onCloseNewFolder={() => (newFolderModalOpen = false)}
		onCreateFolder={handleCreateFolder}
		{deleteConfirmModalOpen}
		{isDeleting}
		selectedFileCount={selectedIds.size}
		selectedFolderCount={selectedFolders.size}
		onCloseDeleteConfirm={() => (deleteConfirmModalOpen = false)}
		onConfirmBulkDelete={handleBulkDelete}
		{gcModalOpen}
		onCloseGcModal={() => (gcModalOpen = false)}
		onRunGc={handleRunGC}
	/>
{/if}

<!-- 공통 파일 상세 인스펙터 & 초고화질 줌 라이트박스 -->
<MediaAssetDetailModal
	asset={selectedAsset}
	allFiles={recursiveFiles}
	serverUrl={PUBLIC_SERVER_URL}
	onClose={() => (selectedAsset = null)}
	onSelectAsset={(next) => (selectedAsset = next)}
	onDownload={(asset, size) => handleDownloadSingle(asset, size ?? null)}
	onDelete={(id) => handleDeleteSingle(id)}
	onBackup={canAdminWrite ? (id) => handleBackup([id]) : null}
/>

<style>
	:global(body) {
		background-color: #fcfcfc;
	}
	.no-scrollbar::-webkit-scrollbar {
		display: none;
	}
	.no-scrollbar {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
</style>
