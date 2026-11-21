<script lang="ts">
	/**
	 * ============================================================================
	 * [개인 파일함(PRIVATE/USERS/{user_id}) 선택 피커 모달]
	 * ============================================================================
	 * - ImageUploader, TiptapEditor, 설문 사진 첨부 등에서 본인 개인 폴더(USERS/{id})
	 *   및 하위 폴더(WEBCAM 등)에 보관 중인 파일을 탐색하여 선택할 수 있게 합니다.
	 */
	import { untrack } from 'svelte';
	import { env } from '$env/dynamic/public';
	import { fastApi } from '$lib/api';
	import { getSecureMediaUrl } from '$lib/config/media';
	import { getAuthContext } from '$lib/runes/auth.svelte';
	import { portal } from '$lib/actions/portal';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatBytes } from '$lib/utils';
	import { formatApiError } from '$lib/utils/error';
	import Icon from '@iconify/svelte';

	const PUBLIC_SERVER_URL = env.PUBLIC_SERVER_URL || '';
	const auth = getAuthContext();

	interface Props {
		open?: boolean;
		multiple?: boolean;
		onlyImages?: boolean;
		title?: string;
		onSelect?: (assets: any[]) => void | Promise<void>;
	}

	let {
		open = $bindable(false),
		multiple = true,
		onlyImages = false,
		title = '내 파일함 (/USERS)에서 선택',
		onSelect
	}: Props = $props();

	const userId = $derived(auth.user?.id ?? 0);
	const basePath = $derived(userId ? `USERS/${userId}` : '');

	let currentSubPath = $state('');
	let folders = $state<any[]>([]);
	let files = $state<any[]>([]);
	let loading = $state(false);
	let keyword = $state('');
	let showAllRecursive = $state(true);
	let selectedMap = $state<Record<number, any>>({});

	const selectedList = $derived(Object.values(selectedMap));
	const selectedCount = $derived(selectedList.length);

	const breadcrumbs = $derived.by(() => {
		if (!basePath) return [];
		const rel = currentSubPath.startsWith(basePath)
			? currentSubPath.slice(basePath.length).replace(/^\/+/, '')
			: '';
		const parts = rel ? rel.split('/').filter(Boolean) : [];
		const crumbs = [{ name: '내 파일함 (USERS)', path: basePath }];
		let acc = basePath;
		for (const p of parts) {
			acc = `${acc}/${p}`;
			crumbs.push({ name: p, path: acc });
		}
		return crumbs;
	});

	const filteredFiles = $derived.by(() => {
		const kw = keyword.trim().toLowerCase();
		return files.filter((f) => {
			if (onlyImages && f.category !== 'image') return false;
			if (kw && !(f.original_name || '').toLowerCase().includes(kw)) return false;
			return true;
		});
	});

	async function loadFolder(pathOverride?: string) {
		if (!basePath) return;
		const target = pathOverride || currentSubPath || basePath;
		currentSubPath = target.startsWith(basePath) ? target : basePath;
		loading = true;
		try {
			const recursiveFlag = showAllRecursive || Boolean(keyword.trim());
			const res = await fastApi<any>(
				'GET',
				`/api/media/admin/list?tier=PRIVATE&sub_path=${encodeURIComponent(currentSubPath)}&recursive=${recursiveFlag}`
			);
			folders = res?.folders || [];
			files = res?.files || [];
		} catch (e) {
			toast.error('개인 파일함 조회 실패: ' + formatApiError(e, '오류'));
		} finally {
			loading = false;
		}
	}

	function enterFolder(folderPath: string) {
		loadFolder(folderPath);
	}

	function toggleFile(asset: any) {
		if (!asset?.id) return;
		if (!multiple) {
			selectedMap = selectedMap[asset.id] ? {} : { [asset.id]: asset };
			return;
		}
		const next = { ...selectedMap };
		if (next[asset.id]) {
			delete next[asset.id];
		} else {
			next[asset.id] = asset;
		}
		selectedMap = next;
	}

	async function confirmSelection() {
		if (selectedCount === 0) {
			toast.warning('사용할 파일을 먼저 선택해 주세요.');
			return;
		}
		const picked = [...selectedList];
		open = false;
		selectedMap = {};
		if (onSelect) {
			await onSelect(picked);
		}
	}

	let prevOpen = false;
	$effect(() => {
		const isOpenNow = open;
		const bp = basePath;
		if (isOpenNow && bp && !prevOpen) {
			prevOpen = true;
			untrack(() => {
				selectedMap = {};
				keyword = '';
				loadFolder(bp);
			});
		} else if (!isOpenNow) {
			prevOpen = false;
		}
	});
</script>

{#if open}
	<div
		use:portal
		class="fixed inset-0 z-[10050] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
		aria-label={title}
	>
		<div class="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border-2 border-slate-200 bg-white shadow-2xl">
			<!-- 헤더 -->
			<div class="flex items-center justify-between border-b border-slate-200 px-6 py-4">
				<div>
					<h3 class="flex items-center gap-2 text-base font-black text-slate-900">
						<Icon icon="solar:folder-open-bold-duotone" class="text-xl text-indigo-600" />
						<span>{title}</span>
					</h3>
					<p class="mt-0.5 text-xs font-medium text-slate-500">
						개인 보관함(PRIVATE/{basePath})의 기존 사진·문서를 선택해 바로 첨부하거나 삽입합니다.
					</p>
				</div>
				<button
					type="button"
					onclick={() => (open = false)}
					class="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700"
					aria-label="닫기"
				>
					<Icon icon="ph:x-bold" class="h-4 w-4" />
				</button>
			</div>

			<!-- 경로 & 검색 바 -->
			<div class="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-6 py-3">
				<div class="flex flex-wrap items-center gap-1 text-xs font-bold">
					{#each breadcrumbs as crumb, idx}
						{#if idx > 0}
							<span class="text-slate-300">/</span>
						{/if}
						<button
							type="button"
							onclick={() => {
								loadFolder(crumb.path);
							}}
							class="rounded-lg px-2 py-1 transition {currentSubPath === crumb.path
								? 'bg-indigo-600 text-white'
								: 'bg-white text-slate-700 hover:bg-indigo-50'}"
						>
							{crumb.name}
						</button>
					{/each}
				</div>

				<div class="flex flex-wrap items-center gap-2">
					<label class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">
						<input
							type="checkbox"
							bind:checked={showAllRecursive}
							onchange={() => loadFolder()}
							class="rounded text-indigo-600"
						/>
						<span>하위 폴더 전체 보기</span>
					</label>
					<input
						type="text"
						bind:value={keyword}
						placeholder="파일명 검색..."
						class="w-40 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none sm:w-48"
					/>
				</div>
			</div>

			<!-- 본문 그리드 -->
			<div class="flex-1 overflow-y-auto p-6 space-y-5">
				{#if loading}
					<div class="py-16 text-center text-xs font-bold text-slate-400">내 파일함을 불러오는 중...</div>
				{:else}
					{#if folders.length > 0}
						<div>
							<div class="mb-2 text-[11px] font-black tracking-wider text-slate-400 uppercase">하위 폴더</div>
							<div class="flex flex-wrap gap-2">
								{#each folders as folder}
									<button
										type="button"
										onclick={() => enterFolder(folder.path)}
										class="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-black text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
									>
										<Icon icon="solar:folder-with-files-bold-duotone" class="text-base text-amber-500" />
										<span>{folder.name}</span>
									</button>
								{/each}
							</div>
						</div>
					{/if}

					{#if filteredFiles.length === 0}
						<div class="rounded-2xl border-2 border-dashed border-slate-200 py-14 text-center">
							<Icon icon="solar:gallery-remove-bold-duotone" class="mx-auto text-4xl text-slate-300" />
							<p class="mt-2 text-xs font-bold text-slate-400">
								{keyword.trim() ? '검색어와 일치하는 파일이 없습니다.' : '이 폴더에 등록된 파일이 없습니다.'}
							</p>
						</div>
					{:else}
						<div>
							<div class="mb-2 flex items-center justify-between text-[11px] font-black text-slate-400">
								<span>파일 목록 ({filteredFiles.length}건)</span>
								<span>{multiple ? '여러 파일 다중 선택 가능' : '1개 선택'}</span>
							</div>
							<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
								{#each filteredFiles as asset (asset.id)}
									{@const isSelected = Boolean(selectedMap[asset.id])}
									<button
										type="button"
										onclick={() => toggleFile(asset)}
										class="group relative flex flex-col overflow-hidden rounded-2xl border-2 text-left transition {isSelected
											? 'border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-200'
											: 'border-slate-200 bg-white hover:border-slate-300'}"
									>
										<div class="relative aspect-square w-full bg-slate-100">
											{#if asset.category === 'image'}
												<img
													src={getSecureMediaUrl(PUBLIC_SERVER_URL, asset, 'sm')}
													alt={asset.original_name}
													class="h-full w-full object-cover"
												/>
											{:else}
												<div class="flex h-full w-full flex-col items-center justify-center text-slate-400">
													<Icon icon="solar:document-text-bold-duotone" class="text-4xl text-indigo-400" />
													<span class="mt-1 text-[10px] font-bold uppercase">{asset.mime_type?.split('/')[1] || 'FILE'}</span>
												</div>
											{/if}
											<div
												class="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full border-2 shadow-sm transition {isSelected
													? 'border-indigo-600 bg-indigo-600 text-white'
													: 'border-white bg-slate-900/40 text-transparent group-hover:text-white/70'}"
											>
												<Icon icon="ph:check-bold" class="text-xs" />
											</div>
										</div>
										<div class="p-2.5">
											<div class="truncate text-xs font-bold text-slate-800" title={asset.original_name}>
												{asset.original_name}
											</div>
											<div class="mt-0.5 text-[10px] font-medium text-slate-400">
												{formatBytes(asset.file_size || 0)}
											</div>
										</div>
									</button>
								{/each}
							</div>
						</div>
					{/if}
				{/if}
			</div>

			<!-- 하단 푸터 -->
			<div class="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-3.5">
				<span class="text-xs font-bold text-slate-600">
					선택됨: <strong class="text-indigo-700">{selectedCount}개</strong>
				</span>
				<div class="flex items-center gap-2">
					<button
						type="button"
						onclick={() => (open = false)}
						class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-100"
					>
						취소
					</button>
					<button
						type="button"
						disabled={selectedCount === 0}
						onclick={confirmSelection}
						class="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-indigo-700 disabled:opacity-40"
					>
						선택한 파일 사용 ({selectedCount})
					</button>
				</div>
			</div>
		</div>
	</div>
{/if}
