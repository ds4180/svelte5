<script lang="ts">
	/**
	 * ============================================================================
	 * [미디어 관리 — 액션 모달 3종 묶음 (MediaActionModals.svelte)]
	 * ============================================================================
	 * - 새 폴더 생성 모달 (예약 폴더명 안내 포함)
	 * - 일괄 격리 삭제 확인 모달 (설정된 유예 일수 동적 표시)
	 * - 시스템 정리(GC) 실행·예약 모달 (개별 작업 체크박스 선택 및 동적 수명주기 표시)
	 */
	import Icon from '@iconify/svelte';
	import { fade, fly, slide } from 'svelte/transition';
	import { portal } from '$lib/actions/portal';
	import { toast } from '$lib/runes/toast.svelte';
	import {
		getGcTaskDefinitions,
		type MediaSettings,
		type MediaTabItem
	} from '$lib/services/mediaAdminService';

	interface Props {
		currentTab: MediaTabItem;
		currentSubPath: string;
		settings: MediaSettings;

		newFolderModalOpen: boolean;
		isCreatingFolder: boolean;
		onCloseNewFolder: () => void;
		onCreateFolder: (folderName: string) => void;

		deleteConfirmModalOpen: boolean;
		isDeleting: boolean;
		selectedFileCount: number;
		selectedFolderCount: number;
		onCloseDeleteConfirm: () => void;
		onConfirmBulkDelete: () => void;

		gcModalOpen: boolean;
		onCloseGcModal: () => void;
		onRunGc: (params: { indices: number[]; runMode: 'now' | 'later'; scheduledAt: string }) => void;
	}

	let {
		currentTab,
		currentSubPath,
		settings,

		newFolderModalOpen = false,
		isCreatingFolder = false,
		onCloseNewFolder,
		onCreateFolder,

		deleteConfirmModalOpen = false,
		isDeleting = false,
		selectedFileCount = 0,
		selectedFolderCount = 0,
		onCloseDeleteConfirm,
		onConfirmBulkDelete,

		gcModalOpen = false,
		onCloseGcModal,
		onRunGc
	}: Props = $props();

	let newFolderName = $state('');
	let gcRunMode = $state<'now' | 'later'>('now');
	let gcScheduledAt = $state('');
	let selectedGcIndices = $state<number[]>([1, 2, 3, 4, 5, 6]);

	$effect(() => {
		if (newFolderModalOpen) {
			newFolderName = '';
		}
	});

	$effect(() => {
		if (gcModalOpen) {
			selectedGcIndices = [...(settings.default_gc_indices || [1, 2, 3, 4, 5, 6])];
			gcRunMode = 'now';
			gcScheduledAt = '';
		}
	});

	const gcDefs = $derived(getGcTaskDefinitions(settings));

	function toggleGcIndex(idx: number) {
		if (selectedGcIndices.includes(idx)) {
			if (selectedGcIndices.length === 1) {
				toast.warning('최소 1개 이상의 정리 항목을 선택해 주세요.');
				return;
			}
			selectedGcIndices = selectedGcIndices.filter((i) => i !== idx);
		} else {
			selectedGcIndices = [...selectedGcIndices, idx].sort((a, b) => a - b);
		}
	}
</script>

<!-- 📁 새 폴더 생성 모달 -->
{#if newFolderModalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" transition:fade>
		<div class="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-7" in:fly={{ y: 20 }}>
			<div class="flex items-center gap-3 mb-5">
				<div class="p-3 bg-rose-50 rounded-2xl text-rose-600">
					<Icon icon="ph:folder-plus-bold" class="text-2xl" />
				</div>
				<div class="min-w-0">
					<h3 class="text-xl font-black text-slate-900 uppercase">새 폴더 생성</h3>
					<p class="text-xs font-bold text-slate-400 truncate">
						/{currentTab?.tier}{currentSubPath ? `/${currentSubPath}` : ''} 하위에 생성합니다.
					</p>
				</div>
			</div>

			<div class="space-y-3">
				<div>
					<label for="folder-input" class="block text-[11px] font-black text-slate-500 uppercase tracking-wider mb-2">
						폴더 이름
					</label>
					<input
						id="folder-input"
						type="text"
						bind:value={newFolderName}
						placeholder="예: 2026_운행기록, 증빙자료 등"
						class="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-rose-500 outline-none transition-all font-bold text-slate-800"
						onkeydown={(e) => e.key === 'Enter' && onCreateFolder(newFolderName)}
					/>
				</div>
				<p class="text-[11px] font-medium text-slate-400 leading-relaxed">
					• 시스템 예약어(<code class="font-mono">THUMB</code>, <code class="font-mono">tmp</code>, <code class="font-mono">DEL_*</code>) 및 점(<code class="font-mono">.</code>)으로 시작하는 이름은 사용할 수 없습니다.
				</p>
			</div>

			<div class="flex gap-3 mt-7">
				<button
					type="button"
					onclick={onCloseNewFolder}
					class="flex-1 py-3.5 rounded-2xl border-2 border-slate-200 font-black text-slate-500 hover:bg-slate-50 transition-all text-xs uppercase tracking-wider"
					disabled={isCreatingFolder}
				>
					취소
				</button>
				<button
					type="button"
					onclick={() => onCreateFolder(newFolderName)}
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
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs" transition:fade>
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
				<p>
					선택된 항목:
					<span class="text-rose-600 font-black">
						파일 {selectedFileCount}개, 폴더 {selectedFolderCount}개
					</span>
				</p>
				<p class="text-slate-500 text-[11px] leading-relaxed">
					• 삭제된 자산은 DB에서 소프트 삭제(<code class="font-mono">is_deleted=True</code>) 처리되며, 물리 파일과 폴더는 <code class="font-mono">.DEL_</code> 접두어로 즉시 격리됩니다.<br />
					• 격리된 항목은 정책 설정 기준 <strong>{settings.isolation_retention_days}일</strong> 경과 후 GC 실행 시 영구 파기됩니다.
				</p>
			</div>

			<div class="flex gap-3 mt-8">
				<button
					type="button"
					onclick={onCloseDeleteConfirm}
					class="flex-1 py-3.5 rounded-2xl border-2 border-slate-200 font-black text-slate-500 hover:bg-slate-50 transition-all text-xs uppercase tracking-wider"
					disabled={isDeleting}
				>
					취소
				</button>
				<button
					type="button"
					onclick={onConfirmBulkDelete}
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
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		use:portal
		class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
		transition:fade
		onclick={(e) => {
			if (e.target === e.currentTarget) onCloseGcModal();
		}}
	>
		<div class="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-7 sm:p-8" in:fly={{ y: 20 }}>
			<div class="flex items-center gap-3 mb-5">
				<div class="p-3 bg-indigo-100 rounded-2xl text-indigo-600">
					<Icon icon="mdi:broom" class="text-2xl" />
				</div>
				<div>
					<h3 class="text-xl font-black text-slate-900 uppercase">System Optimize</h3>
					<p class="text-xs font-bold text-slate-400">스토리지 가비지 컬렉션 실행 항목 및 스케줄</p>
				</div>
			</div>

			<div class="space-y-4">
				<div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
					<p class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2.5">
						실행할 정리 항목 선택 ({selectedGcIndices.length}/6)
					</p>
					<div class="space-y-2">
						{#each gcDefs as item (item.index)}
							<label class="flex cursor-pointer items-start gap-2.5 text-xs font-bold text-slate-700 leading-snug">
								<input
									type="checkbox"
									checked={selectedGcIndices.includes(item.index)}
									onchange={() => toggleGcIndex(item.index)}
									class="checkbox checkbox-xs checkbox-primary rounded mt-0.5 shrink-0"
								/>
								<span>[{item.index}] {item.label}</span>
							</label>
						{/each}
					</div>
				</div>

				<div class="space-y-2.5">
					<p class="text-[10px] font-black text-slate-400 uppercase tracking-widest">실행 모드 선택</p>
					<div class="grid grid-cols-2 gap-3">
						<button
							type="button"
							onclick={() => (gcRunMode = 'now')}
							class="flex items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all {gcRunMode === 'now' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'}"
						>
							<Icon icon="mdi:flash" class="text-lg" />
							<span class="text-xs font-black uppercase">즉시 실행</span>
						</button>
						<button
							type="button"
							onclick={() => (gcRunMode = 'later')}
							class="flex items-center justify-center gap-2 p-3 rounded-2xl border-2 transition-all {gcRunMode === 'later' ? 'border-indigo-600 bg-indigo-50 text-indigo-600' : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300'}"
						>
							<Icon icon="mdi:calendar-clock" class="text-lg" />
							<span class="text-xs font-black uppercase">예약 실행</span>
						</button>
					</div>
				</div>

				{#if gcRunMode === 'later'}
					<div in:slide>
						<label for="gc-time" class="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
							예약 시간 설정
						</label>
						<input
							id="gc-time"
							type="datetime-local"
							bind:value={gcScheduledAt}
							class="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-2xl focus:border-indigo-500 outline-none transition-all font-bold text-slate-700"
						/>
					</div>
				{/if}
			</div>

			<div class="flex gap-3 mt-7">
				<button
					type="button"
					onclick={onCloseGcModal}
					class="flex-1 py-3.5 rounded-2xl border-2 border-slate-200 font-black text-slate-500 hover:bg-slate-50 transition-all text-xs uppercase tracking-wider"
				>
					취소
				</button>
				<button
					type="button"
					onclick={() =>
						onRunGc({
							indices: selectedGcIndices,
							runMode: gcRunMode,
							scheduledAt: gcScheduledAt
						})}
					class="flex-1 py-3.5 rounded-2xl bg-indigo-600 text-white font-black hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 text-xs uppercase tracking-wider"
				>
					{gcRunMode === 'now' ? '지금 즉시 실행' : '예약 등록'}
				</button>
			</div>
		</div>
	</div>
{/if}
