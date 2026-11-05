<script>
	/**
	 * @file (app)/v1/admin/media/+page.svelte
	 * @description 미디어 자산 통합 관리 및 백업 시스템 (File Master)
	 *              - 4대 핵심 관제 지표 요약 카드 및 모던 엔터프라이즈 헤더
	 *              - 4단계 저장 계층(PUBLIC, PROTECTED, PRIVATE, SYSTEM) 권한별 탐색
	 *              - 숨김/격리 파일 열람 토글(show_hidden) 및 소프트 삭제 거버넌스
	 *              - toast.svelte.js 100% 전환 (구식 alert/confirm/prompt 완전 퇴출)
	 */
	import { onMount } from 'svelte';
	import { env } from '$env/dynamic/public';
	import { getMediaUrl, getSecureMediaUrl } from '$lib/config/media';
	import { fade, slide, fly } from 'svelte/transition';
	import ImageUploader from '$lib/components/ImageUploader.svelte';
	import Icon from '@iconify/svelte';
	import { page } from '$app/stores';
	import { toast } from '$lib/runes/toast.svelte.js';
	import {
		adminGetMediaStats,
		adminGetMediaRecent,
		adminGetMediaList,
		adminCreateMediaFolder,
		adminBackupMedia,
		adminBulkDeleteMedia,
		adminRunMediaGC,
		adminDeleteMedia
	} from '$lib/api/admin.js';

	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';

	// --- 탭 구성 및 권한 설정 ---
	const userRank = $derived($page.data.user?.rank_level ?? 0);
	const userId = $derived($page.data.user?.id ?? 0);

	const tabConfigs = $derived([
		{ id: 'SHARED', label: '공용폴더 (OFFICE)', tier: 'SYSTEM', basePath: 'GLOBAL/OFFICE' },
		{ id: 'PERSONAL', label: '내 파일함 (USERS)', tier: 'PRIVATE', basePath: `USERS/${userId}` },
		{ id: 'PUBLIC', label: '공개 자산 (PUBLIC)', tier: 'PUBLIC', basePath: '' },
		{ id: 'PROTECTED', label: '사내 보안 (PROTECTED)', tier: 'PROTECTED', basePath: '' },
		{ id: 'SYSTEM', label: '시스템 코어 (SYSTEM)', tier: 'SYSTEM', basePath: '', minRank: 4 },
		{ id: 'PRIVATE', label: '전체 유저함 (PRIVATE)', tier: 'PRIVATE', basePath: '', minRank: 4 },
	].filter(tab => !tab.minRank || userRank >= tab.minRank));

	// --- States ---
	let stats = $state({ total_count: 0, total_size_bytes: 0, tier_summary: {}, folder_physical_summary: {} });
	let recentMedia = $state({ public: [], protected: [], private: [], system: [] });
	
	let folders = $state([]); 
	let recursiveFiles = $state([]); 
	
	let isLoadingStats = $state(true);
	let isLoadingMedia = $state(true);
	
	let selectedAsset = $state(null);
	let uploadedInSession = $state([]);
	
	// 탐색기 전용 상태
	let activeTabId = $state('SHARED'); 
	let currentSubPath = $state(''); 
	let searchQuery = $state('');
	let viewMode = $state('grid'); 
	let isRecursive = $state(true); // 하위 파일 포함 여부 토글
	let showHidden = $state(false); // 닷(.) 숨김/격리 파일 열람 토글 (관리자 전용)
	
	// 선택 관리 (Set Reassignment for Svelte 5 Reactivity)
	let selectedIds = $state(new Set());
	let selectedFolders = $state(new Set());

	// 모달 상태
	let gcModalOpen = $state(false);
	let gcRunMode = $state('now'); // 'now' or 'later'
	let gcScheduledAt = $state(''); // 'YYYY-MM-DDTHH:mm' 형식

	let newFolderModalOpen = $state(false);
	let newFolderName = $state('');
	let isCreatingFolder = $state(false);

	let deleteConfirmModalOpen = $state(false);
	let isDeleting = $state(false);

	const currentTab = $derived(tabConfigs.find(t => t.id === activeTabId) || tabConfigs[0]);

	// --- Functions ---
	async function handleUploadSuccess() {
		toast.success('파일이 성공적으로 업로드되었습니다.');
		await Promise.all([loadStats(), loadRecent(), loadMedia()]);
		uploadedInSession = [];
	}

	async function loadStats() {
		isLoadingStats = true;
		try {
			stats = await adminGetMediaStats();
		} catch (err) {
			console.error('Stats fail', err);
		} finally {
			isLoadingStats = false;
		}
	}

	async function loadRecent() {
		try {
			recentMedia = await adminGetMediaRecent(12);
		} catch (err) {
			console.error('Recent fail', err);
		}
	}

	async function loadMedia() {
		if (!currentTab) return;
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
			console.error('Media list fail', err);
			toast.error(err?.detail || '미디어 목록을 불러오지 못했습니다.');
		} finally {
			isLoadingMedia = false;
		}
	}

	function toggleSelect(id) {
		if (selectedIds.has(id)) selectedIds.delete(id);
		else selectedIds.add(id);
		selectedIds = new Set(selectedIds);
	}

	function toggleFolderSelect(path) {
		if (selectedFolders.has(path)) selectedFolders.delete(path);
		else selectedFolders.add(path);
		selectedFolders = new Set(selectedFolders);
	}

	function toggleSelectAll() {
		const currentlySelected = selectedIds.size + selectedFolders.size;
		if (currentlySelected > 0) {
			selectedIds = new Set();
			selectedFolders = new Set();
		} else {
			const newIds = new Set();
			const newFolders = new Set();
			recursiveFiles.forEach(f => newIds.add(f.id));
			folders.forEach(f => newFolders.add(f.path));
			selectedIds = newIds;
			selectedFolders = newFolders;
		}
	}

	// --- [Action Handlers] ---

	function openCreateFolderModal() {
		newFolderName = '';
		newFolderModalOpen = true;
	}

	async function handleCreateFolder() {
		const name = newFolderName.trim();
		if (!name) {
			toast.warning('폴더 이름을 입력해 주세요.');
			return;
		}
		if (name.includes('/') || name.includes('\\') || name === '.' || name === '..') {
			toast.warning('폴더 이름에 특수문자(/, \\)나 점(.)을 사용할 수 없습니다.');
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
			newFolderName = '';
			loadMedia();
		} catch (err) {
			toast.error('폴더 생성 실패: ' + (err.detail || '오류가 발생했습니다.'));
		} finally {
			isCreatingFolder = false;
		}
	}

	async function handleBackup(assetIdsOverride = null) {
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
			loadMedia();
		} catch (err) {
			toast.error('백업 실패: ' + (err.detail || '오류가 발생했습니다.'));
		}
	}

	function openBulkDeleteConfirm() {
		if (selectedIds.size === 0 && selectedFolders.size === 0) {
			toast.warning('삭제할 항목을 먼저 선택해 주세요.');
			return;
		}
		deleteConfirmModalOpen = true;
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
			toast.error('삭제 실패: ' + (err.detail || '오류가 발생했습니다.'));
		} finally {
			isDeleting = false;
		}
	}

	async function handleRunGC() {
		try {
			const res = await adminRunMediaGC({ 
				indices: [1, 2, 3, 4, 5],
				scheduled_at: (gcRunMode === 'later' && gcScheduledAt) ? new Date(gcScheduledAt).toISOString() : null
			});
			toast.success(res.message || '시스템 정리(GC) 작업이 예약되었습니다.');
			gcModalOpen = false;
			gcScheduledAt = '';
			gcRunMode = 'now';
			await loadStats();
		} catch (err) { 
			const msg = err.detail ? (typeof err.detail === 'object' ? JSON.stringify(err.detail) : err.detail) : '오류';
			toast.error('GC 예약 실패: ' + msg); 
		}
	}

	async function handleZipDownload() {
		if (selectedIds.size === 0 && selectedFolders.size === 0) {
			toast.warning('다운로드할 항목을 선택해 주세요.');
			return;
		}
		try {
			const response = await fetch('/api/media/admin/zip-download', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					asset_ids: Array.from(selectedIds),
					folder_paths: Array.from(selectedFolders),
					tier: currentTab.tier
				})
			});
			if (!response.ok) throw new Error('ZIP 생성 응답 실패');
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `media_export_${new Date().getTime()}.zip`;
			document.body.appendChild(a);
			a.click();
			a.remove();
			window.URL.revokeObjectURL(url);
			toast.success('ZIP 다운로드가 시작되었습니다.');
		} catch (err) {
			toast.error('다운로드 실패: ' + err.message);
		}
	}

	async function downloadSingleFile(asset) {
		try {
			const response = await fetch(getSecureMediaUrl(PUBLIC_SERVER_URL, asset), {
				credentials: 'include'
			});
			if (!response.ok) throw new Error('파일 다운로드 실패');
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = asset.original_name;
			document.body.appendChild(a);
			a.click();
			a.remove();
			window.URL.revokeObjectURL(url);
			toast.success(`${asset.original_name} 다운로드가 완료되었습니다.`);
		} catch (err) {
			toast.error('다운로드 실패: ' + err.message);
		}
	}

	async function deleteAsset(id) {
		try {
			await adminDeleteMedia(id);
			toast.success('파일이 안전하게 삭제(격리)되었습니다.');
			selectedAsset = null;
			await Promise.all([loadStats(), loadRecent(), loadMedia()]);
		} catch (err) {
			toast.error('삭제 실패: ' + (err.detail || '오류가 발생했습니다.'));
		}
	}

	function formatBytes(bytes) {
		if (!bytes || bytes === 0) return '0 B';
		const k = 1024;
		const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
		const i = Math.floor(Math.log(bytes) / Math.log(k));
		return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
	}

	function selectTab(tab) {
		activeTabId = tab.id;
		currentSubPath = tab.basePath;
		loadMedia();
	}

	function enterFolder(path) {
		currentSubPath = path;
		loadMedia();
	}

	function goToParent() {
		if (currentSubPath === currentTab.basePath) return;
		const parts = currentSubPath.split('/').filter(p => p);
		parts.pop();
		currentSubPath = parts.join('/');
		loadMedia();
	}

	function getFileRelativePath(filePath) {
		const prefix = `${currentTab.tier}/${currentSubPath}`.replace(/\/$/, '') + '/';
		if (filePath.startsWith(prefix)) {
			const relative = filePath.substring(prefix.length);
			const parts = relative.split('/');
			if (parts.length > 1) return parts.slice(0, -1).join('/') + '/';
		}
		return './';
	}

	onMount(() => {
		loadStats();
		loadRecent();
		const initialTab = tabConfigs.find(t => t.id === activeTabId) || tabConfigs[0];
		currentSubPath = initialTab.basePath;
		loadMedia();
	});
</script>

<svelte:head>
	<title>파일·사진 관리 | Core Governance</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-8 px-4 pb-20 font-['Outfit','Noto_Sans_KR'] md:px-8">
	<!-- 🏛️ 모던 엔터프라이즈 통합 헤더 규격 -->
	<header class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end">
		<div>
			<div class="flex items-center gap-2 mb-2">
				<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 border border-rose-200">
					<Icon icon="ph:database-duotone" class="text-sm" />
					SYSTEM GOVERNANCE • FILE & MEDIA MASTER
				</span>
				<span class="text-xs font-bold text-slate-400 font-mono">Rank {userRank}</span>
			</div>
			<h1 class="text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
				파일·<span class="text-rose-600">사진 관리</span>
			</h1>
			<p class="mt-2 text-sm font-bold text-slate-500">
				4단계 저장 계층(Tier)으로 분리된 물리 미디어를 탐색하고 안전하게 백업 및 수명주기를 관제합니다.
			</p>
		</div>

		<!-- 상단 헤더 액션 버튼 모음 -->
		<div class="flex flex-wrap items-center gap-3">
			<!-- 관리자용 숨김/격리 파일 열람 토글 -->
			{#if userRank >= 4}
				<button 
					onclick={() => { showHidden = !showHidden; loadMedia(); }}
					class="flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 font-black text-xs uppercase tracking-wider transition-all shadow-sm {showHidden ? 'bg-amber-500 border-amber-500 text-white shadow-amber-200' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'}"
					title="닷(.)으로 시작하는 격리/숨김 파일과 폴더를 목록에 표시합니다."
				>
					<Icon icon={showHidden ? "ph:eye-bold" : "ph:eye-slash-bold"} class="text-base" />
					<span>숨김·격리 파일 {showHidden ? 'ON' : 'OFF'}</span>
				</button>
			{/if}

			<!-- 시스템 정리 (GC) 모달 버튼 -->
			{#if userRank >= 4}
				<button 
					onclick={() => gcModalOpen = true}
					class="flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 border-indigo-600 bg-indigo-50 text-indigo-700 font-black text-xs uppercase tracking-wider hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
				>
					<Icon icon="mdi:broom" class="text-base" />
					<span>시스템 정리 (GC)</span>
				</button>
			{/if}

			<!-- 새로고침 버튼 -->
			<button 
				onclick={() => { loadStats(); loadRecent(); loadMedia(); toast.info('미디어 자산 현황을 새로고침했습니다.'); }}
				class="flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 border-slate-200 bg-white font-black text-xs uppercase tracking-wider text-slate-700 hover:border-rose-500 hover:text-rose-600 transition-all shadow-sm"
			>
				<Icon icon="ph:arrows-clockwise-bold" class="text-base {isLoadingMedia ? 'animate-spin' : ''}" />
				<span>새로고침</span>
			</button>
		</div>
	</header>

	<!-- 📊 전사 표준 4대 핵심 관제 지표 요약 카드 -->
	<section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
		<!-- 카드 1: 전체 미디어 자산 -->
		<div class="relative overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white p-6 shadow-sm hover:border-indigo-200 transition-all">
			<div class="flex items-center justify-between mb-4">
				<span class="text-[11px] font-black tracking-widest uppercase text-slate-400">Total Assets</span>
				<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
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

		<!-- 카드 2: 공개 서비스 자산 (PUBLIC) -->
		<button 
			onclick={() => { const tab = tabConfigs.find(t => t.id === 'PUBLIC'); if (tab) selectTab(tab); }}
			class="text-left relative overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white p-6 shadow-sm hover:border-emerald-300 transition-all group"
		>
			<div class="flex items-center justify-between mb-4">
				<span class="text-[11px] font-black tracking-widest uppercase text-slate-400 group-hover:text-emerald-600">Public Tier</span>
				<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
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

		<!-- 카드 3: 사내 보안 자산 (PROTECTED) -->
		<button 
			onclick={() => { const tab = tabConfigs.find(t => t.id === 'PROTECTED'); if (tab) selectTab(tab); }}
			class="text-left relative overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white p-6 shadow-sm hover:border-amber-300 transition-all group"
		>
			<div class="flex items-center justify-between mb-4">
				<span class="text-[11px] font-black tracking-widest uppercase text-slate-400 group-hover:text-amber-600">Protected Tier</span>
				<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
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

		<!-- 카드 4: 개인·시스템 자산 (PRIVATE & SYSTEM) -->
		<button 
			onclick={() => { const tab = tabConfigs.find(t => t.id === 'PERSONAL' || t.id === 'SHARED'); if (tab) selectTab(tab); }}
			class="text-left relative overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white p-6 shadow-sm hover:border-rose-300 transition-all group"
		>
			<div class="flex items-center justify-between mb-4">
				<span class="text-[11px] font-black tracking-widest uppercase text-slate-400 group-hover:text-rose-600">Private & Core</span>
				<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:lock-key-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{isLoadingStats ? '...' : (((stats.tier_summary['PRIVATE']?.count || 0) + (stats.tier_summary['SYSTEM']?.count || 0))).toLocaleString()}
				<span class="text-sm font-bold text-slate-400 ml-1">건</span>
			</div>
			<div class="mt-3 flex items-center gap-2 text-xs font-bold text-rose-600">
				<span class="rounded-lg bg-rose-50 px-2 py-0.5 font-mono">개인 {stats.tier_summary['PRIVATE']?.count || 0} / 시스템 {stats.tier_summary['SYSTEM']?.count || 0}</span>
			</div>
		</button>
	</section>

	<!-- 🗂️ 탭 내비게이션 -->
	<nav class="flex gap-2 border-b-2 border-slate-200 overflow-x-auto no-scrollbar">
		{#each tabConfigs as tab}
			<button 
				onclick={() => selectTab(tab)} 
				class="px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeTabId === tab.id ? 'border-b-4 border-rose-600 text-rose-600 bg-rose-50/50 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
			>
				{tab.label}
			</button>
		{/each}
	</nav>

	<div class="flex flex-col lg:flex-row gap-8">
		<!-- 좌측 사이드바: 빠른 업로더 -->
		<aside class="lg:w-80 flex-shrink-0 space-y-6">
			<div class="bg-white rounded-[2.5rem] border-2 border-slate-100 p-7 shadow-sm sticky top-8 transition-all hover:border-rose-200">
				<div class="mb-5 flex items-center justify-between">
					<h3 class="text-xs font-black uppercase tracking-widest text-rose-600 flex items-center gap-2">
						<Icon icon="ph:cloud-arrow-up-bold" class="text-lg" /> 빠른 파일 업로드
					</h3>
				</div>
				<div class="p-4 bg-slate-50 rounded-2xl mb-6 border border-slate-200">
					<p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Target Directory</p>
					<p class="text-xs font-bold text-slate-900 font-mono truncate leading-none uppercase">
						/{currentTab?.tier}/{currentSubPath}
					</p>
				</div>
				<ImageUploader 
					app_id="admin" 
					access_level={currentTab?.tier} 
					sub_path={currentSubPath} 
					bind:uploadedAssets={uploadedInSession} 
					onUpload={handleUploadSuccess} 
				/>
			</div>
		</aside>

		<!-- 우측 메인 영역: 파일 및 폴더 탐색기 -->
		<main class="flex-1 space-y-6 min-w-0">
			<!-- 탐색기 툴바 -->
			<div class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-slate-50 p-5 rounded-[2rem] border-2 border-slate-100">
				<!-- 브레드크럼 -->
				<div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex flex-wrap items-center gap-2">
					<button onclick={() => currentSubPath = currentTab.basePath} class="hover:text-rose-600 flex items-center gap-1 font-black text-slate-700">
						<Icon icon="ph:house-bold" class="text-sm" /> {currentTab?.label}
					</button>
					{#each currentSubPath.substring(currentTab.basePath.length).split('/').filter(p => p) as part, i}
						<span class="text-slate-300">/</span>
						<button 
							onclick={() => {
								const subParts = currentSubPath.substring(currentTab.basePath.length).split('/').filter(p => p).slice(0, i + 1);
								currentSubPath = currentTab.basePath + (currentTab.basePath ? '/' : '') + subParts.join('/');
								loadMedia();
							}} 
							class="hover:text-rose-600 font-bold text-slate-600"
						>
							{part}
						</button>
					{/each}
				</div>

				<!-- 액션 버튼들 -->
				<div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
					<!-- 전체 선택 토글 -->
					<button 
						class="flex items-center gap-2 px-3.5 py-2 bg-white border-2 border-slate-200 rounded-full hover:border-rose-300 transition-all shadow-sm group" 
						onclick={toggleSelectAll}
					>
						<div class="h-4 w-4 rounded border-2 flex items-center justify-center transition-all { (selectedIds.size + selectedFolders.size) > 0 ? 'bg-rose-600 border-rose-600' : 'border-slate-300' }">
							{#if (selectedIds.size + selectedFolders.size) === (folders.length + recursiveFiles.length) && (folders.length + recursiveFiles.length) > 0}
								<Icon icon="ph:check-bold" class="text-white text-[10px]" />
							{:else if (selectedIds.size + selectedFolders.size) > 0}
								<div class="w-2 h-0.5 bg-white"></div>
							{/if}
						</div>
						<span class="text-[11px] font-black uppercase tracking-wider text-slate-600 group-hover:text-rose-600">전체 선택</span>
					</button>

					<!-- 하위 전체 보기 토글 -->
					<button 
						class="flex items-center gap-2 px-3.5 py-2 bg-white border-2 border-slate-200 rounded-full transition-all shadow-sm hover:border-indigo-300" 
						onclick={() => { isRecursive = !isRecursive; loadMedia(); }}
					>
						<Icon icon={isRecursive ? "mdi:file-tree" : "mdi:file-document"} class="text-sm {isRecursive ? 'text-indigo-600' : 'text-slate-400'}" />
						<span class="text-[11px] font-black uppercase tracking-wider {isRecursive ? 'text-indigo-600' : 'text-slate-600'}">
							{isRecursive ? '하위 전체 보기' : '폴더 내 파일만'}
						</span>
					</button>

					<!-- 선택된 항목 플로팅 액션 바 -->
					{#if selectedIds.size > 0 || selectedFolders.size > 0}
						<div class="flex items-center gap-2 bg-rose-600 text-white px-4 py-2 rounded-full shadow-lg" in:fly={{ x: 20 }}>
							<span class="text-[11px] font-black uppercase tracking-tight">{selectedIds.size + selectedFolders.size}건 선택됨</span>
							<div class="w-px h-4 bg-white/20 mx-1"></div>
							<button class="text-[11px] font-black uppercase hover:underline" onclick={handleZipDownload}>Zip 다운</button>
							<button class="text-[11px] font-black uppercase hover:underline" onclick={() => handleBackup()}>백업</button>
							<button class="text-[11px] font-black uppercase hover:underline text-rose-200 hover:text-white" onclick={openBulkDeleteConfirm}>삭제(격리)</button>
						</div>
					{/if}

					<!-- 새 폴더 생성 모달 버튼 -->
					<button 
						class="flex items-center gap-1.5 px-3.5 py-2 bg-white border-2 border-slate-200 rounded-full font-black text-[11px] uppercase tracking-wider text-slate-700 hover:border-slate-800 transition-all shadow-sm"
						onclick={openCreateFolderModal}
					>
						<Icon icon="ph:folder-plus-bold" class="text-rose-600 text-sm" /> 새 폴더
					</button>

					<!-- Grid / List 뷰 모드 토글 -->
					<div class="flex items-center border-2 border-slate-200 rounded-full overflow-hidden bg-white shadow-sm">
						<button 
							class="px-3 py-1.5 text-xs font-black {viewMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-700'}" 
							onclick={() => viewMode = 'grid'}
						>
							<Icon icon="ph:squares-four-bold" />
						</button>
						<button 
							class="px-3 py-1.5 text-xs font-black {viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-700'}" 
							onclick={() => viewMode = 'list'}
						>
							<Icon icon="ph:list-bullets-bold" />
						</button>
					</div>
				</div>
			</div>

			<!-- 폴더 및 파일 리스트 본문 -->
			{#if isLoadingMedia}
				<div class="flex h-64 items-center justify-center">
					<div class="flex flex-col items-center gap-3">
						<div class="h-10 w-10 animate-spin rounded-full border-4 border-rose-600 border-t-transparent"></div>
						<p class="text-xs font-bold text-slate-400 font-mono">자산 목록 로딩 중...</p>
					</div>
				</div>
			{:else}
				<!-- 폴더 영역 -->
				<section class="space-y-4">
					<div class="flex items-center gap-3">
						<div class="h-px flex-1 bg-slate-200"></div>
						<h3 class="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
							Folders ({folders.length})
						</h3>
						<div class="h-px flex-1 bg-slate-200"></div>
					</div>

					<div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
						{#if currentSubPath !== currentTab.basePath}
							<button 
								class="flex flex-col items-center p-5 rounded-[2rem] border-2 border-slate-100 bg-white hover:border-rose-400 transition-all group shadow-sm" 
								onclick={goToParent}
							>
								<Icon icon="ph:arrow-u-up-left-bold" class="text-3xl text-slate-300 group-hover:text-rose-600 mb-2 transition-colors" />
								<span class="text-[11px] font-black uppercase tracking-wider text-slate-500 group-hover:text-rose-600">상위 폴더</span>
							</button>
						{/if}

						{#each folders as folder}
							<div class="relative group">
								<button 
									class="flex flex-col items-center w-full p-5 rounded-[2rem] border-2 {folder.is_hidden ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100 bg-white'} hover:border-rose-400 hover:shadow-xl transition-all group" 
									onclick={() => enterFolder(folder.path)}
								>
									<Icon 
										icon={folder.is_hidden ? "ph:folder-dotted-duotone" : "ph:folder-duotone"} 
										class="text-5xl {folder.is_hidden ? 'text-amber-500/60' : 'text-rose-600/30'} group-hover:text-rose-600 transition-colors mb-2" 
									/>
									<p class="text-xs font-black truncate w-full text-center tracking-tight text-slate-700 group-hover:text-rose-600">
										{#if folder.is_hidden}
											<span class="text-amber-600 font-mono text-[9px] mr-1">[숨김]</span>
										{/if}
										{folder.name}
									</p>
								</button>
								<button 
									class="absolute right-4 top-4 h-6 w-6 z-10 rounded-full border-2 border-slate-200 flex items-center justify-center transition-all {selectedFolders.has(folder.path) ? 'bg-rose-600 border-rose-600 scale-110 shadow-lg' : 'bg-white opacity-0 group-hover:opacity-100'}" 
									onclick={() => toggleFolderSelect(folder.path)}
								>
									{#if selectedFolders.has(folder.path)}
										<Icon icon="ph:check-bold" class="text-white text-xs" />
									{/if}
								</button>
							</div>
						{/each}
					</div>
				</section>

				<!-- 파일 영역 -->
				<section class="space-y-4">
					<div class="flex items-center gap-3">
						<div class="h-px flex-1 bg-slate-200"></div>
						<h3 class="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
							Files ({recursiveFiles.length})
						</h3>
						<div class="h-px flex-1 bg-slate-200"></div>
					</div>

					{#if recursiveFiles.length === 0}
						<div class="py-20 text-center rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-slate-50/50">
							<Icon icon="ph:images-square-bold" class="text-6xl text-slate-300 mx-auto mb-3" />
							<p class="text-xs font-black text-slate-400 uppercase tracking-widest">등록된 파일 자산이 없습니다.</p>
							<p class="text-[11px] font-bold text-slate-400 mt-1">좌측 '빠른 파일 업로드' 패널에서 새 파일을 업로드해 보세요.</p>
						</div>
					{:else}
						{#if viewMode === 'grid'}
							<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
								{#each recursiveFiles as asset}
									<div in:fade class="group relative flex flex-col items-center">
										<div 
											class="relative aspect-square w-full overflow-hidden rounded-[2rem] border-2 {asset.is_deleted ? 'border-rose-300 bg-rose-50/40' : 'border-slate-100 bg-white'} p-2 transition-all hover:border-rose-600 hover:shadow-xl hover:-translate-y-1 cursor-pointer" 
											onclick={() => selectedAsset = asset} 
											role="button" 
											tabindex="0"
										>
											{#if asset.category === 'image'}
												<img 
													src={getSecureMediaUrl(PUBLIC_SERVER_URL, asset, 'sm')} 
													alt="" 
													class="h-full w-full rounded-[1.5rem] object-cover transition-transform duration-500 group-hover:scale-105" 
												/>
											{:else}
												<div class="flex h-full w-full flex-col items-center justify-center rounded-[1.5rem] bg-slate-50 text-slate-400">
													<Icon icon="ph:file-bold" class="text-4xl text-slate-300 group-hover:text-rose-500 transition-colors" />
													<span class="mt-1 text-[9px] font-black uppercase font-mono">{asset.file_path.split('.').pop()}</span>
												</div>
											{/if}

											{#if asset.is_deleted}
												<div class="absolute inset-x-2 bottom-2 bg-rose-600/90 text-white text-[9px] font-black py-0.5 rounded-lg text-center uppercase tracking-wider">
													격리 보관됨
												</div>
											{/if}
										</div>

										<button 
											class="absolute right-4 top-4 h-6 w-6 z-10 rounded-full border-2 border-white flex items-center justify-center transition-all {selectedIds.has(asset.id) ? 'bg-rose-600 scale-110 shadow-lg' : 'bg-black/30 opacity-0 group-hover:opacity-100 hover:bg-black/50'}" 
											onclick={(e) => { e.stopPropagation(); toggleSelect(asset.id); }}
										>
											{#if selectedIds.has(asset.id)}
												<Icon icon="ph:check-bold" class="text-white text-xs" />
											{/if}
										</button>

										<div class="mt-2.5 w-full px-2 text-center">
											<p class="truncate text-xs font-black tracking-tight text-slate-800" title={asset.original_name}>
												{asset.original_name}
											</p>
											<p class="truncate text-[9px] font-bold text-slate-400 uppercase tracking-tight font-mono">
												{getFileRelativePath(asset.file_path)}
											</p>
										</div>
									</div>
								{/each}
							</div>
						{:else}
							<!-- List View -->
							<div class="overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white shadow-sm">
								<table class="w-full text-left">
									<thead class="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
										<tr>
											<th class="px-6 py-4 w-12 text-center"></th>
											<th class="px-6 py-4">파일명 및 경로</th>
											<th class="px-6 py-4">용량</th>
											<th class="px-6 py-4">등록일</th>
											<th class="px-6 py-4 text-right">다운로드</th>
										</tr>
									</thead>
									<tbody class="divide-y divide-slate-100 text-xs font-bold">
										{#each recursiveFiles as asset}
											<tr 
												class="group hover:bg-slate-50/70 transition-colors cursor-pointer {asset.is_deleted ? 'bg-rose-50/20' : ''}" 
												onclick={() => selectedAsset = asset}
											>
												<td class="px-6 py-4 text-center">
													<button 
														class="h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all {selectedIds.has(asset.id) ? 'bg-rose-600 border-rose-600 shadow-sm' : 'border-slate-300'}" 
														onclick={(e) => { e.stopPropagation(); toggleSelect(asset.id); }}
													>
														{#if selectedIds.has(asset.id)}
															<Icon icon="ph:check-bold" class="text-white text-[10px]" />
														{/if}
													</button>
												</td>
												<td class="px-6 py-4">
													<div class="flex items-center gap-4">
														<div class="h-10 w-10 flex-shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
															{#if asset.category === 'image'}
																<img src={getSecureMediaUrl(PUBLIC_SERVER_URL, asset, 'sm')} alt="" class="h-full w-full object-cover" />
															{:else}
																<div class="flex h-full w-full items-center justify-center text-slate-400">
																	<Icon icon="ph:file-bold" class="text-xl" />
																</div>
															{/if}
														</div>
														<div class="min-w-0">
															<div class="font-black text-slate-900 truncate max-w-sm flex items-center gap-2">
																<span>{asset.original_name}</span>
																{#if asset.is_deleted}
																	<span class="rounded bg-rose-100 text-rose-700 px-1.5 py-0.5 text-[9px] font-mono">격리</span>
																{/if}
															</div>
															<div class="text-[10px] font-bold text-slate-400 uppercase truncate font-mono">
																{asset.file_path}
															</div>
														</div>
													</div>
												</td>
												<td class="px-6 py-4 text-slate-500 font-mono">
													{formatBytes(asset.file_size)}
												</td>
												<td class="px-6 py-4 text-slate-400 font-mono">
													{new Date(asset.created_at).toLocaleDateString()}
												</td>
												<td class="px-6 py-4 text-right">
													<button 
														class="p-2 text-slate-400 hover:text-rose-600 transition-colors rounded-xl hover:bg-slate-100" 
														onclick={(e) => { e.stopPropagation(); downloadSingleFile(asset); }}
														title="다운로드"
													>
														<Icon icon="ph:download-simple-bold" class="text-lg" />
													</button>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					{/if}
				</section>
			{/if}
		</main>
	</div>
</div>

<!-- 📁 새 폴더 생성 모달 -->
{#if newFolderModalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" transition:fade>
		<div class="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-7" in:fly={{ y: 20 }}>
			<div class="flex items-center gap-3 mb-6">
				<div class="p-3 bg-rose-50 rounded-2xl text-rose-600">
					<Icon icon="ph:folder-plus-bold" class="text-2xl" />
				</div>
				<div>
					<h3 class="text-xl font-black text-slate-900 uppercase">새 폴더 생성</h3>
					<p class="text-xs font-bold text-slate-400">/{currentTab?.tier}/{currentSubPath} 하위에 폴더를 생성합니다.</p>
				</div>
			</div>

			<div class="space-y-4">
				<div>
					<label for="folder-input" class="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">폴더 이름</label>
					<input 
						id="folder-input"
						type="text" 
						bind:value={newFolderName}
						placeholder="예: 2026_운행기록, 증빙자료 등" 
						class="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-rose-500 outline-none transition-all font-bold text-slate-800"
						onkeydown={(e) => e.key === 'Enter' && handleCreateFolder()}
						autofocus
					/>
				</div>
			</div>

			<div class="flex gap-3 mt-8">
				<button 
					onclick={() => newFolderModalOpen = false} 
					class="flex-1 py-3.5 rounded-2xl border-2 border-slate-200 font-black text-slate-500 hover:bg-slate-50 transition-all text-xs uppercase tracking-wider"
					disabled={isCreatingFolder}
				>
					취소
				</button>
				<button 
					onclick={handleCreateFolder} 
					class="flex-1 py-3.5 rounded-2xl bg-rose-600 text-white font-black hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 text-xs uppercase tracking-wider"
					disabled={isCreatingFolder}
				>
					{isCreatingFolder ? '생성 중...' : '폴더 만들기'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 🗑️ 일괄 삭제 확인 모달 -->
{#if deleteConfirmModalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" transition:fade>
		<div class="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-7" in:fly={{ y: 20 }}>
			<div class="flex items-center gap-3 mb-6">
				<div class="p-3 bg-rose-100 rounded-2xl text-rose-600">
					<Icon icon="ph:trash-bold" class="text-2xl" />
				</div>
				<div>
					<h3 class="text-xl font-black text-slate-900 uppercase">자산 격리 삭제 확인</h3>
					<p class="text-xs font-bold text-slate-400">소프트 삭제 원칙에 따라 안전하게 격리됩니다.</p>
				</div>
			</div>

			<div class="p-4 bg-rose-50/60 rounded-2xl border border-rose-100 text-xs font-bold text-slate-700 space-y-2">
				<p>선택된 항목: <span class="text-rose-600 font-black">파일 {selectedIds.size}개, 폴더 {selectedFolders.size}개</span></p>
				<p class="text-slate-500 text-[11px] leading-relaxed">
					• 삭제된 자산은 DB에서 소프트 삭제(`is_deleted=True`) 처리되며, 물리 파일은 `.DEL_` 숨김 폴더로 격리됩니다.<br>
					• 최종 파기는 관리자가 시스템 정리(GC)를 수행할 때만 진행됩니다.
				</p>
			</div>

			<div class="flex gap-3 mt-8">
				<button 
					onclick={() => deleteConfirmModalOpen = false} 
					class="flex-1 py-3.5 rounded-2xl border-2 border-slate-200 font-black text-slate-500 hover:bg-slate-50 transition-all text-xs uppercase tracking-wider"
					disabled={isDeleting}
				>
					취소
				</button>
				<button 
					onclick={handleBulkDelete} 
					class="flex-1 py-3.5 rounded-2xl bg-rose-600 text-white font-black hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 text-xs uppercase tracking-wider"
					disabled={isDeleting}
				>
					{isDeleting ? '처리 중...' : '격리 삭제 실행'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 🧹 GC 시스템 정리 예약 모달 -->
{#if gcModalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" transition:fade>
		<div class="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-8" in:fly={{ y: 20 }}>
			<div class="flex items-center gap-3 mb-6">
				<div class="p-3 bg-indigo-100 rounded-2xl text-indigo-600">
					<Icon icon="mdi:broom" class="text-2xl" />
				</div>
				<div>
					<h3 class="text-xl font-black text-slate-900 uppercase">System Optimize</h3>
					<p class="text-xs font-bold text-slate-400">시스템 스토리지 가비지 컬렉션(GC)</p>
				</div>
			</div>

			<div class="space-y-4">
				<div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
					<p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">정리 대상 항목</p>
					<ul class="text-xs font-bold text-slate-600 space-y-1.5">
						<li>• 고립 파일 및 DB 유령 레코드 정리</li>
						<li>• 원본 없는 불필요 썸네일 파일 정리</li>
						<li>• 만료된 `.DEL_` 삭제 격리 폴더 영구 제거</li>
						<li>• 시스템 내 모든 빈 폴더 청소</li>
					</ul>
				</div>

				<div class="space-y-3">
					<p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">실행 모드 선택</p>
					<div class="grid grid-cols-2 gap-3">
						<button 
							onclick={() => gcRunMode = 'now'}
							class="flex items-center justify-center gap-2 p-3.5 rounded-2xl border-2 transition-all {gcRunMode === 'now' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'}"
						>
							<Icon icon="mdi:flash" class="text-lg" />
							<span class="text-xs font-black uppercase">즉시 실행</span>
						</button>
						<button 
							onclick={() => gcRunMode = 'later'}
							class="flex items-center justify-center gap-2 p-3.5 rounded-2xl border-2 transition-all {gcRunMode === 'later' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'}"
						>
							<Icon icon="mdi:calendar-clock" class="text-lg" />
							<span class="text-xs font-black uppercase">예약 실행</span>
						</button>
					</div>
				</div>

				{#if gcRunMode === 'later'}
					<div in:slide>
						<label for="gc-time" class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">예약 시간 설정</label>
						<input 
							id="gc-time"
							type="datetime-local" 
							bind:value={gcScheduledAt}
							class="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
						/>
					</div>
				{/if}
			</div>

			<div class="flex gap-3 mt-8">
				<button 
					onclick={() => gcModalOpen = false} 
					class="flex-1 py-3.5 rounded-2xl border-2 border-slate-200 font-black text-slate-500 hover:bg-slate-50 transition-all text-xs uppercase tracking-wider"
				>
					취소
				</button>
				<button 
					onclick={handleRunGC} 
					class="flex-1 py-3.5 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-xs uppercase tracking-wider"
				>
					{gcRunMode === 'now' ? '지금 즉시 실행' : '예약 등록'}
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 🔍 파일 상세 정보 모달 -->
{#if selectedAsset}
	<div transition:fade class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md">
		<div transition:fly={{ y: 50 }} class="relative w-full max-w-6xl overflow-hidden rounded-[3rem] bg-white shadow-2xl flex flex-col md:flex-row">
			<button 
				class="absolute top-6 right-6 z-10 h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-black hover:bg-slate-200 transition-all" 
				onclick={() => selectedAsset = null}
			>
				<Icon icon="ph:x-bold" class="text-xl" />
			</button>

			<!-- 좌측 이미지/미리보기 영역 -->
			<div class="md:w-2/3 bg-slate-950 flex items-center justify-center p-4 min-h-[480px]">
				{#if selectedAsset.category === 'image'}
					<img 
						src={getSecureMediaUrl(PUBLIC_SERVER_URL, selectedAsset, 'lg')} 
						alt="" 
						class="w-full h-full max-h-[80vh] rounded-2xl object-contain shadow-2xl shadow-black/50" 
					/>
				{:else}
					<div class="flex flex-col items-center text-slate-600">
						<Icon icon="ph:file-bold" class="text-8xl mb-4" />
						<span class="text-xl font-black uppercase font-mono">{selectedAsset.file_path.split('.').pop()} FILE</span>
					</div>
				{/if}
			</div>

			<!-- 우측 상세 정보 영역 -->
			<div class="md:w-1/3 p-8 flex flex-col justify-between bg-white border-l border-slate-100">
				<div class="space-y-6">
					<header>
						<span class="text-[10px] font-black tracking-[0.4em] text-rose-600 uppercase mb-2 block">Asset Details</span>
						<h2 class="text-2xl font-black tracking-tighter text-slate-900 leading-tight break-all">
							{selectedAsset.original_name}
						</h2>
					</header>

					<div class="grid grid-cols-2 gap-4 border-y border-slate-100 py-5">
						<div class="space-y-1">
							<span class="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Access Tier</span>
							<div class="flex items-center gap-2">
								<span class="h-2 w-2 rounded-full {selectedAsset.access_level === 'PUBLIC' ? 'bg-emerald-500' : 'bg-rose-500'}"></span>
								<span class="text-xs font-black text-slate-800 uppercase">{selectedAsset.access_level}</span>
							</div>
						</div>
						<div class="space-y-1">
							<span class="text-[10px] font-black text-slate-400 uppercase tracking-wider block">File Weight</span>
							<span class="text-xs font-black text-slate-800 font-mono">{formatBytes(selectedAsset.file_size)}</span>
						</div>
					</div>

					<div class="space-y-2">
						<span class="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Physical Path</span>
						<code class="block bg-slate-50 p-4 rounded-2xl text-[10px] font-bold text-slate-500 break-all border border-slate-200 font-mono">
							{selectedAsset.file_path}
						</code>
					</div>
				</div>

				<div class="pt-8 flex flex-col gap-3">
					<button 
						onclick={() => downloadSingleFile(selectedAsset)} 
						class="flex items-center justify-center gap-2 h-14 rounded-2xl bg-slate-900 text-white font-black uppercase tracking-wider hover:bg-rose-600 transition-all text-xs"
					>
						<Icon icon="ph:download-simple-bold" class="text-lg" /> 원본 다운로드
					</button>
					<div class="flex gap-2">
						<button 
							onclick={() => handleBackup([selectedAsset.id])} 
							class="flex-1 flex items-center justify-center gap-1.5 h-12 rounded-2xl border-2 border-slate-200 bg-white text-slate-800 hover:border-indigo-600 hover:text-indigo-600 transition-all text-xs font-black"
						>
							<Icon icon="ph:copy-bold" class="text-base" />
							<span>백업</span>
						</button>
						<button 
							onclick={() => deleteAsset(selectedAsset.id)} 
							class="flex-1 flex items-center justify-center gap-1.5 h-12 rounded-2xl border-2 border-slate-200 bg-white text-rose-500 hover:bg-rose-50 hover:border-rose-600 hover:text-rose-600 transition-all text-xs font-black"
						>
							<Icon icon="ph:trash-bold" class="text-base" />
							<span>격리 삭제</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(body) { background-color: #fcfcfc; }
	.no-scrollbar::-webkit-scrollbar { display: none; }
	.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
