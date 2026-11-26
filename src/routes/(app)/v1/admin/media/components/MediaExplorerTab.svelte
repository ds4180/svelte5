<script lang="ts">
	/**
	 * ============================================================================
	 * [미디어 관리 — 탐색기 본문 탭 (MediaExplorerTab.svelte)]
	 * ============================================================================
	 * - 좌측 빠른 업로드 패널(현재 정책 요약 배지 포함)과
	 *   우측 브레드크럼·실시간 검색·액션바·폴더 및 파일 그리드/리스트 뷰를 전담합니다.
	 */
	import Icon from '@iconify/svelte';
	import { fade, fly } from 'svelte/transition';
	import ImageUploader from '$lib/components/ImageUploader.svelte';
	import { getSecureMediaUrl, type MediaAssetLike } from '$lib/config/media';
	import {
		filterMediaExplorerItems,
		getFileRelativeDir,
		type MediaSettings,
		type MediaTabItem
	} from '$lib/services/mediaAdminService';
	import { formatBytes, formatDate } from '$lib/utils';

	interface FolderEntry {
		name: string;
		path: string;
		type?: string;
		is_hidden?: boolean;
	}

	interface Props {
		currentTab: MediaTabItem;
		currentSubPath: string;
		folders: FolderEntry[];
		files: MediaAssetLike[];
		isLoadingMedia: boolean;
		isRecursive: boolean;
		viewMode: 'grid' | 'list';
		selectedIds: Set<number>;
		selectedFolders: Set<string>;
		canAdminWrite: boolean;
		settings: MediaSettings;
		serverUrl: string;
		onUploadSuccess: () => void;
		onNavigateSubPath: (nextPath: string) => void;
		onGoToParent: () => void;
		onToggleRecursive: () => void;
		onChangeViewMode: (mode: 'grid' | 'list') => void;
		onToggleSelectFile: (id: number) => void;
		onToggleSelectFolder: (path: string) => void;
		onToggleSelectAll: (visibleFolderPaths: string[], visibleFileIds: number[]) => void;
		onOpenCreateFolder: () => void;
		onZipDownload: () => void;
		onBackupSelected: () => void;
		onOpenBulkDelete: () => void;
		onSelectAssetDetail: (asset: MediaAssetLike) => void;
		onDownloadSingle: (asset: MediaAssetLike) => void;
	}

	let {
		currentTab,
		currentSubPath,
		folders = [],
		files = [],
		isLoadingMedia = false,
		isRecursive = true,
		viewMode = 'grid',
		selectedIds,
		selectedFolders,
		canAdminWrite = false,
		settings,
		serverUrl = '',
		onUploadSuccess,
		onNavigateSubPath,
		onGoToParent,
		onToggleRecursive,
		onChangeViewMode,
		onToggleSelectFile,
		onToggleSelectFolder,
		onToggleSelectAll,
		onOpenCreateFolder,
		onZipDownload,
		onBackupSelected,
		onOpenBulkDelete,
		onSelectAssetDetail,
		onDownloadSingle
	}: Props = $props();

	let searchQuery = $state('');
	let uploadedInSession = $state<any[]>([]);

	const filtered = $derived(filterMediaExplorerItems(folders, files, searchQuery));
	const visibleFolders = $derived(filtered.filteredFolders);
	const visibleFiles = $derived(filtered.filteredFiles);

	const totalSelectedCount = $derived(selectedIds.size + selectedFolders.size);
	const totalVisibleCount = $derived(visibleFolders.length + visibleFiles.length);

	const breadcrumbSegments = $derived.by(() => {
		const base = currentTab?.basePath || '';
		const tail = currentSubPath.startsWith(base)
			? currentSubPath.substring(base.length)
			: currentSubPath;
		return tail.split('/').filter(Boolean);
	});

	function handleUploadDone() {
		uploadedInSession = [];
		onUploadSuccess();
	}
</script>

<div class="flex flex-col lg:flex-row gap-8">
	<!-- 좌측 사이드바: 빠른 업로더 및 적용 정책 안내 -->
	<aside class="lg:w-80 shrink-0 space-y-6">
		<div class="bg-white rounded-[2.5rem] border-2 border-slate-100 p-6 sm:p-7 shadow-sm sticky top-8 transition-all hover:border-rose-200">
			<div class="mb-4 flex items-center justify-between">
				<h3 class="text-xs font-black uppercase tracking-widest text-rose-600 flex items-center gap-2">
					<Icon icon="ph:cloud-arrow-up-bold" class="text-lg" /> 빠른 파일 업로드
				</h3>
				<span class="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[10px] font-black text-slate-600">
					Max {settings.max_file_size_mb}MB
				</span>
			</div>

			<div class="p-3.5 bg-slate-50 rounded-2xl mb-4 border border-slate-200 space-y-1">
				<p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Directory</p>
				<p class="text-xs font-bold text-slate-900 font-mono truncate leading-none uppercase">
					/{currentTab?.tier}{currentSubPath ? `/${currentSubPath}` : ''}
				</p>
			</div>

			<div class="mb-5 flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-500">
				<span class="rounded-lg bg-indigo-50 text-indigo-700 px-2 py-0.5">
					WebP {settings.webp_quality}%
				</span>
				<span class="rounded-lg bg-amber-50 text-amber-700 px-2 py-0.5">
					{settings.enable_original_auto_expiry
						? `원본 ${settings.original_keep_days}일 보관`
						: '원본 영구 보존'}
				</span>
			</div>

			<ImageUploader
				app_id="admin"
				access_level={currentTab?.tier}
				sub_path={currentSubPath}
				allowPersonalPicker={false}
				bind:uploadedAssets={uploadedInSession}
				onUpload={handleUploadDone}
			/>
		</div>
	</aside>

	<!-- 우측 메인 영역: 파일 및 폴더 탐색기 -->
	<main class="flex-1 space-y-6 min-w-0">
		<!-- 탐색기 툴바 -->
		<div class="space-y-3 bg-slate-50 p-4 sm:p-5 rounded-[2rem] border-2 border-slate-100">
			<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
				<!-- 브레드크럼 -->
				<div class="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex flex-wrap items-center gap-1.5 min-w-0">
					<button
						type="button"
						onclick={() => onNavigateSubPath(currentTab.basePath)}
						class="hover:text-rose-600 flex items-center gap-1 font-black text-slate-700"
					>
						<Icon icon="ph:house-bold" class="text-sm shrink-0" />
						<span>{currentTab?.label}</span>
					</button>
					{#each breadcrumbSegments as part, i (i)}
						<span class="text-slate-300">/</span>
						<button
							type="button"
							onclick={() => {
								const nextSub = breadcrumbSegments.slice(0, i + 1).join('/');
								const full = currentTab.basePath
									? `${currentTab.basePath}/${nextSub}`
									: nextSub;
								onNavigateSubPath(full);
							}}
							class="hover:text-rose-600 font-bold text-slate-600 truncate max-w-[160px]"
						>
							{part}
						</button>
					{/each}
				</div>

				<!-- 실시간 파일·폴더 검색창 -->
				<div class="relative w-full sm:w-64 shrink-0">
					<Icon icon="ph:magnifying-glass-bold" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="파일명·경로·폴더 검색..."
						class="w-full rounded-full border border-slate-200 bg-white pl-8 pr-7 py-1.5 text-xs font-bold text-slate-800 focus:border-rose-400 outline-none"
					/>
					{#if searchQuery}
						<button
							type="button"
							onclick={() => (searchQuery = '')}
							class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
							aria-label="검색어 지우기"
						>
							<Icon icon="ph:x-bold" />
						</button>
					{/if}
				</div>
			</div>

			<!-- 액션 버튼 바 -->
			<div class="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-slate-200/70">
				<div class="flex flex-wrap items-center gap-2">
					<button
						type="button"
						class="flex items-center gap-2 px-3.5 py-2 bg-white border-2 border-slate-200 rounded-full hover:border-rose-300 transition-all shadow-xs group"
						onclick={() =>
							onToggleSelectAll(
								visibleFolders.map((f) => f.path),
								visibleFiles.map((f) => Number(f.id))
							)}
					>
						<div class="h-4 w-4 rounded border-2 flex items-center justify-center transition-all {totalSelectedCount > 0 ? 'bg-rose-600 border-rose-600' : 'border-slate-300'}">
							{#if totalSelectedCount === totalVisibleCount && totalVisibleCount > 0}
								<Icon icon="ph:check-bold" class="text-white text-[10px]" />
							{:else if totalSelectedCount > 0}
								<div class="w-2 h-0.5 bg-white"></div>
							{/if}
						</div>
						<span class="text-[11px] font-black uppercase tracking-wider text-slate-600 group-hover:text-rose-600">전체 선택</span>
					</button>

					<button
						type="button"
						class="flex items-center gap-1.5 px-3.5 py-2 bg-white border-2 border-slate-200 rounded-full transition-all shadow-xs hover:border-indigo-300"
						onclick={onToggleRecursive}
					>
						<Icon icon={isRecursive ? 'mdi:file-tree' : 'mdi:file-document'} class="text-sm {isRecursive ? 'text-indigo-600' : 'text-slate-400'}" />
						<span class="text-[11px] font-black uppercase tracking-wider {isRecursive ? 'text-indigo-600' : 'text-slate-600'}">
							{isRecursive ? '하위 전체 보기' : '폴더 내 파일만'}
						</span>
					</button>

					<button
						type="button"
						class="flex items-center gap-1.5 px-3.5 py-2 bg-white border-2 border-slate-200 rounded-full font-black text-[11px] uppercase tracking-wider text-slate-700 hover:border-slate-800 transition-all shadow-xs"
						onclick={onOpenCreateFolder}
					>
						<Icon icon="ph:folder-plus-bold" class="text-rose-600 text-sm" /> 새 폴더
					</button>
				</div>

				<div class="flex flex-wrap items-center gap-2">
					{#if totalSelectedCount > 0}
						<div class="flex items-center gap-2 bg-rose-600 text-white px-3.5 py-1.5 rounded-full shadow-md" in:fly={{ x: 16 }}>
							<span class="text-[11px] font-black uppercase tracking-tight">{totalSelectedCount}건</span>
							<div class="w-px h-3.5 bg-white/25"></div>
							<button type="button" class="text-[11px] font-black uppercase hover:underline" onclick={onZipDownload}>Zip 다운</button>
							{#if canAdminWrite}
								<button type="button" class="text-[11px] font-black uppercase hover:underline" onclick={onBackupSelected}>백업</button>
							{/if}
							<button type="button" class="text-[11px] font-black uppercase hover:underline text-rose-100 hover:text-white" onclick={onOpenBulkDelete}>삭제(격리)</button>
						</div>
					{/if}

					<div class="flex items-center border-2 border-slate-200 rounded-full overflow-hidden bg-white shadow-xs">
						<button
							type="button"
							class="px-3 py-1.5 text-xs font-black {viewMode === 'grid' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-700'}"
							onclick={() => onChangeViewMode('grid')}
							title="그리드 보기"
						>
							<Icon icon="ph:squares-four-bold" />
						</button>
						<button
							type="button"
							class="px-3 py-1.5 text-xs font-black {viewMode === 'list' ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-700'}"
							onclick={() => onChangeViewMode('list')}
							title="리스트 보기"
						>
							<Icon icon="ph:list-bullets-bold" />
						</button>
					</div>
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
						Folders ({visibleFolders.length})
					</h3>
					<div class="h-px flex-1 bg-slate-200"></div>
				</div>

				<div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
					{#if currentSubPath !== currentTab.basePath}
						<button
							type="button"
							class="flex flex-col items-center p-5 rounded-[2rem] border-2 border-slate-100 bg-white hover:border-rose-400 transition-all group shadow-xs"
							onclick={onGoToParent}
						>
							<Icon icon="ph:arrow-u-up-left-bold" class="text-3xl text-slate-300 group-hover:text-rose-600 mb-2 transition-colors" />
							<span class="text-[11px] font-black uppercase tracking-wider text-slate-500 group-hover:text-rose-600">상위 폴더</span>
						</button>
					{/if}

					{#each visibleFolders as folder (folder.path)}
						<div class="relative group">
							<button
								type="button"
								class="flex flex-col items-center w-full p-5 rounded-[2rem] border-2 {folder.is_hidden ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100 bg-white'} hover:border-rose-400 hover:shadow-xl transition-all group"
								onclick={() => onNavigateSubPath(folder.path)}
							>
								<Icon
									icon={folder.is_hidden ? 'ph:folder-dotted-duotone' : 'ph:folder-duotone'}
									class="text-5xl {folder.is_hidden ? 'text-amber-500/60' : 'text-rose-600/30'} group-hover:text-rose-600 transition-colors mb-2"
								/>
								<span class="block text-xs font-black truncate w-full text-center tracking-tight text-slate-700 group-hover:text-rose-600">
									{#if folder.is_hidden}
										<span class="text-amber-600 font-mono text-[9px] mr-1">[숨김]</span>
									{/if}
									{folder.name}
								</span>
							</button>
							<button
								type="button"
								class="absolute right-4 top-4 h-6 w-6 z-10 rounded-full border-2 border-slate-200 flex items-center justify-center transition-all {selectedFolders.has(folder.path) ? 'bg-rose-600 border-rose-600 scale-110 shadow-lg' : 'bg-white opacity-0 group-hover:opacity-100'}"
								onclick={() => onToggleSelectFolder(folder.path)}
								aria-label="{folder.name} 선택"
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
						Files ({visibleFiles.length})
					</h3>
					<div class="h-px flex-1 bg-slate-200"></div>
				</div>

				{#if visibleFiles.length === 0}
					<div class="py-20 text-center rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-slate-50/50">
						<Icon icon="ph:images-square-bold" class="text-6xl text-slate-300 mx-auto mb-3" />
						<p class="text-xs font-black text-slate-400 uppercase tracking-widest">
							{searchQuery ? '검색 조건에 일치하는 파일이 없습니다.' : '등록된 파일 자산이 없습니다.'}
						</p>
						<p class="text-[11px] font-bold text-slate-400 mt-1">좌측 '빠른 파일 업로드' 패널에서 새 파일을 업로드해 보세요.</p>
					</div>
				{:else if viewMode === 'grid'}
					<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
						{#each visibleFiles as asset (asset.id)}
							<div in:fade class="group relative flex flex-col items-center">
								<div
									class="relative aspect-square w-full overflow-hidden rounded-[2rem] border-2 {asset.is_deleted ? 'border-rose-300 bg-rose-50/40' : 'border-slate-100 bg-white'} p-2 transition-all hover:border-rose-600 hover:shadow-xl hover:-translate-y-1 cursor-pointer"
									onclick={() => onSelectAssetDetail(asset)}
									onkeydown={(e) => e.key === 'Enter' && onSelectAssetDetail(asset)}
									role="button"
									tabindex="0"
								>
									{#if asset.category === 'image'}
										<img
											src={getSecureMediaUrl(serverUrl, asset, 'sm')}
											alt={asset.original_name || ''}
											class="h-full w-full rounded-[1.5rem] object-cover transition-transform duration-500 group-hover:scale-105"
										/>
									{:else}
										<div class="flex h-full w-full flex-col items-center justify-center rounded-[1.5rem] bg-slate-50 text-slate-400">
											<Icon icon="ph:file-bold" class="text-4xl text-slate-300 group-hover:text-rose-500 transition-colors" />
											<span class="mt-1 text-[9px] font-black uppercase font-mono">
												{(asset.file_path || '').split('.').pop()}
											</span>
										</div>
									{/if}

									{#if asset.is_deleted}
										<div class="absolute inset-x-2 bottom-2 bg-rose-600/90 text-white text-[9px] font-black py-0.5 rounded-lg text-center uppercase tracking-wider">
											격리 보관됨
										</div>
									{/if}
								</div>

								<button
									type="button"
									class="absolute right-4 top-4 h-6 w-6 z-10 rounded-full border-2 border-white flex items-center justify-center transition-all {selectedIds.has(Number(asset.id)) ? 'bg-rose-600 scale-110 shadow-lg' : 'bg-black/30 opacity-0 group-hover:opacity-100 hover:bg-black/50'}"
									onclick={(e) => {
										e.stopPropagation();
										onToggleSelectFile(Number(asset.id));
									}}
									aria-label="{asset.original_name} 선택"
								>
									{#if selectedIds.has(Number(asset.id))}
										<Icon icon="ph:check-bold" class="text-white text-xs" />
									{/if}
								</button>

								<div class="mt-2.5 w-full px-2 text-center">
									<p class="truncate text-xs font-black tracking-tight text-slate-800" title={asset.original_name}>
										{asset.original_name}
									</p>
									<p class="truncate text-[9px] font-bold text-slate-400 uppercase tracking-tight font-mono">
										{getFileRelativeDir(asset.file_path || '', currentTab.tier, currentSubPath)}
									</p>
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="overflow-x-auto rounded-[2rem] border-2 border-slate-100 bg-white shadow-xs">
						<table class="w-full text-left min-w-[540px]">
							<thead class="bg-slate-50 text-[11px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-100">
								<tr>
									<th class="px-5 py-4 w-12 text-center"></th>
									<th class="px-5 py-4">파일명 및 경로</th>
									<th class="px-5 py-4">용량</th>
									<th class="px-5 py-4">등록일</th>
									<th class="px-5 py-4 text-right">다운로드</th>
								</tr>
							</thead>
							<tbody class="divide-y divide-slate-100 text-xs font-bold">
								{#each visibleFiles as asset (asset.id)}
									<tr
										class="group hover:bg-slate-50/70 transition-colors cursor-pointer {asset.is_deleted ? 'bg-rose-50/20' : ''}"
										onclick={() => onSelectAssetDetail(asset)}
									>
										<td class="px-5 py-4 text-center">
											<button
												type="button"
												class="h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all {selectedIds.has(Number(asset.id)) ? 'bg-rose-600 border-rose-600 shadow-xs' : 'border-slate-300'}"
												onclick={(e) => {
													e.stopPropagation();
													onToggleSelectFile(Number(asset.id));
												}}
												aria-label="{asset.original_name} 선택"
											>
												{#if selectedIds.has(Number(asset.id))}
													<Icon icon="ph:check-bold" class="text-white text-[10px]" />
												{/if}
											</button>
										</td>
										<td class="px-5 py-4">
											<div class="flex items-center gap-3.5">
												<div class="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
													{#if asset.category === 'image'}
														<img src={getSecureMediaUrl(serverUrl, asset, 'sm')} alt="" class="h-full w-full object-cover" />
													{:else}
														<div class="flex h-full w-full items-center justify-center text-slate-400">
															<Icon icon="ph:file-bold" class="text-xl" />
														</div>
													{/if}
												</div>
												<div class="min-w-0">
													<div class="font-black text-slate-900 truncate max-w-xs sm:max-w-sm flex items-center gap-2">
														<span>{asset.original_name}</span>
														{#if asset.is_deleted}
															<span class="rounded bg-rose-100 text-rose-700 px-1.5 py-0.5 text-[9px] font-mono">격리</span>
														{/if}
													</div>
													<div class="text-[10px] font-bold text-slate-400 uppercase truncate font-mono max-w-xs sm:max-w-md">
														{asset.file_path}
													</div>
												</div>
											</div>
										</td>
										<td class="px-5 py-4 text-slate-500 font-mono whitespace-nowrap">
											{formatBytes(asset.file_size)}
										</td>
										<td class="px-5 py-4 text-slate-400 font-mono whitespace-nowrap">
											{formatDate(asset.created_at)}
										</td>
										<td class="px-5 py-4 text-right">
											<button
												type="button"
												class="p-2 text-slate-400 hover:text-rose-600 transition-colors rounded-xl hover:bg-slate-100"
												onclick={(e) => {
													e.stopPropagation();
													onDownloadSingle(asset);
												}}
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
			</section>
		{/if}
	</main>
</div>
