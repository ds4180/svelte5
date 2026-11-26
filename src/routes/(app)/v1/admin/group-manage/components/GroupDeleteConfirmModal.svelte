<script lang="ts">
	/**
	 * ============================================================================
	 * [그룹·권한 관리 — 그룹 삭제 확인 모달 (GroupDeleteConfirmModal.svelte)]
	 * ============================================================================
	 * - 기존 window.confirm()을 대체하며, 영향받는 회원 수 및 앱·게시판·페이지 연동 수와
	 *   현재 삭제 보호 정책(block_delete_in_use_group) 상태를 명확히 안내합니다.
	 */
	import Icon from '@iconify/svelte';
	import { fade, scale } from 'svelte/transition';
	import { portal } from '$lib/actions/portal';
	import type { GroupItem, GroupManageSettings } from '$lib/services/groupAdminService';

	interface Props {
		targetGroup: GroupItem | null;
		settings: GroupManageSettings;
		isDeleting: boolean;
		onClose: () => void;
		onConfirmDelete: (group: GroupItem) => Promise<void> | void;
	}

	let {
		targetGroup = null,
		settings,
		isDeleting = false,
		onClose,
		onConfirmDelete
	}: Props = $props();

	const memberCount = $derived(
		targetGroup ? (targetGroup.primary_count || 0) + (targetGroup.secondary_count || 0) : 0
	);
	const resourceCount = $derived(
		targetGroup
			? (targetGroup.allow_apps?.length || 0) + (targetGroup.deny_apps?.length || 0)
			: 0
	);
	const isInUse = $derived(memberCount > 0 || resourceCount > 0);
	const isBlockedByPolicy = $derived(Boolean(settings.block_delete_in_use_group && isInUse));
</script>

{#if targetGroup}
	<div
		use:portal
		transition:fade={{ duration: 140 }}
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => !isDeleting && e.target === e.currentTarget && onClose()}
		onkeydown={(e) => !isDeleting && e.key === 'Escape' && onClose()}
	>
		<div
			transition:scale={{ duration: 140, start: 0.96 }}
			class="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
		>
			<div class="p-6 space-y-4">
				<div class="flex items-start gap-3.5">
					<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
						<Icon icon="solar:trash-bin-trash-bold-duotone" class="text-2xl" />
					</div>
					<div class="min-w-0">
						<h3 class="text-base font-black text-slate-900">
							그룹 [{targetGroup.name}] 영구 삭제
						</h3>
						<p class="mt-1 text-xs font-mono text-slate-500">코드: {targetGroup.code}</p>
					</div>
				</div>

				{#if isInUse}
					<div class="rounded-xl border p-3.5 text-xs space-y-1.5 {isBlockedByPolicy ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-rose-200 bg-rose-50 text-rose-900'}">
						<div class="font-black flex items-center gap-1.5">
							<Icon icon="solar:danger-triangle-bold" class="text-base shrink-0" />
							<span>현재 사용 중인 그룹입니다</span>
						</div>
						<p class="leading-relaxed">
							연결 현황: <strong>회원 {memberCount}명</strong> · <strong>앱·게시판·페이지 {resourceCount}곳</strong>
						</p>
						{#if isBlockedByPolicy}
							<p class="font-bold text-amber-800">
								현재 [설정] 탭의 '사용 중 그룹 삭제 차단' 정책이 켜져 있어 삭제가 차단됩니다.
							</p>
						{:else}
							<p class="text-[11px] text-rose-700">
								삭제 시 연결된 모든 회원 프로필 및 앱·게시판·페이지의 Allow/Deny 설정에서 자동 해제(Cascade)됩니다.
							</p>
						{/if}
					</div>
				{:else}
					<p class="text-xs font-medium text-slate-600 leading-relaxed">
						현재 연결된 회원 및 권한 리소스가 없는 그룹입니다. 영구 삭제하시겠습니까?
					</p>
				{/if}
			</div>

			<div class="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-3.5">
				<button
					type="button"
					disabled={isDeleting}
					onclick={onClose}
					class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
				>
					취소
				</button>
				<button
					type="button"
					disabled={isDeleting || isBlockedByPolicy}
					onclick={() => targetGroup && onConfirmDelete(targetGroup)}
					class="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-black text-white shadow-xs hover:bg-rose-700 disabled:opacity-40 transition"
				>
					{#if isDeleting}
						<Icon icon="solar:refresh-circle-bold-duotone" class="animate-spin text-sm" />
					{/if}
					<span>영구 삭제</span>
				</button>
			</div>
		</div>
	</div>
{/if}
