<script lang="ts">
	/**
	 * ============================================================================
	 * [통합 관제 — Diff-Patch · 로그 상세 · 세션 추방 확인 모달 (ObservabilityModals.svelte)]
	 * ============================================================================
	 * - 모든 모달을 use:portal로 body 루트에 마운트하고 ESC/백드롭 닫기를 지원합니다.
	 * - 기존 metadata vs metadata_payload 불일치 버그를 수정하여 요청 컨텍스트와 Request-ID를 정확히 표시합니다.
	 * - 브라우저 기본 window.confirm 대신 전용 세션 강제 추방 확인 모달을 제공합니다.
	 */
	import Icon from '@iconify/svelte';
	import { fade, scale } from 'svelte/transition';
	import { portal } from '$lib/actions/portal';
	import {
		getLogMetadata,
		getSeverityBadge,
		type AuditLogItem,
		type LiveSessionItem
	} from '$lib/services/observabilityAdminService';
	import { formatDateTime } from '$lib/utils';

	interface Props {
		activeDiffLog: AuditLogItem | null;
		onCloseDiff: () => void;

		activeDetailLog: AuditLogItem | null;
		onCloseDetail: () => void;

		kickTargetSession: LiveSessionItem | null;
		isKicking: boolean;
		onCloseKick: () => void;
		onConfirmKick: (session: LiveSessionItem) => Promise<void> | void;
	}

	let {
		activeDiffLog = null,
		onCloseDiff,
		activeDetailLog = null,
		onCloseDetail,
		kickTargetSession = null,
		isKicking = false,
		onCloseKick,
		onConfirmKick
	}: Props = $props();

	function formatDiffValue(val: any): string {
		if (val === null || val === undefined) return 'null';
		if (typeof val === 'object') return JSON.stringify(val);
		return String(val);
	}
</script>

<!-- 1. Diff-Patch Git 스타일 시각 비교 모달 -->
{#if activeDiffLog}
	<div
		use:portal
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => e.target === e.currentTarget && onCloseDiff()}
		onkeydown={(e) => e.key === 'Escape' && onCloseDiff()}
	>
		<div
			transition:scale={{ duration: 150, start: 0.97 }}
			class="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
		>
			<div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4">
				<div class="flex items-center gap-2.5 min-w-0">
					<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
						<Icon icon="solar:git-commit-bold" class="text-lg" />
					</div>
					<div class="min-w-0">
						<h3 class="text-sm sm:text-base font-black text-slate-900">데이터 변경 내역 (Diff-Patch)</h3>
						<p class="text-xs text-slate-500 truncate">
							{activeDiffLog.title} · {formatDateTime(activeDiffLog.created_at)}
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={onCloseDiff}
					class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
					aria-label="Diff 창 닫기"
				>
					<Icon icon="solar:close-circle-bold" class="text-2xl" />
				</button>
			</div>

			<div class="max-h-[68vh] overflow-y-auto p-5 sm:p-6 space-y-4">
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
					<div>
						<span class="text-slate-400 font-bold">수정자:</span>
						<span class="text-slate-900 font-black ml-1">{activeDiffLog.user_summary || '시스템'}</span>
					</div>
					<div>
						<span class="text-slate-400 font-bold">대상 앱:</span>
						<span class="font-mono text-blue-600 font-bold ml-1">{activeDiffLog.app_id || 'system'}</span>
					</div>
					<div>
						<span class="text-slate-400 font-bold">리소스 타입:</span>
						<span class="font-mono text-slate-700 font-bold ml-1">{activeDiffLog.resource_type || '-'}</span>
					</div>
					<div>
						<span class="text-slate-400 font-bold">리소스 ID:</span>
						<span class="font-mono text-slate-700 font-bold ml-1">#{activeDiffLog.resource_id || '-'}</span>
					</div>
				</div>

				<div class="overflow-x-auto rounded-xl border border-slate-200">
					<table class="w-full text-left text-xs">
						<thead class="bg-slate-100 font-black text-slate-600 border-b border-slate-200">
							<tr>
								<th class="px-4 py-2.5 w-1/4">수정된 필드 (Field)</th>
								<th class="px-4 py-2.5 w-3/8 text-rose-700 bg-rose-50/50">수정 전 (Before)</th>
								<th class="px-4 py-2.5 w-3/8 text-emerald-700 bg-emerald-50/50">수정 후 (After)</th>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-100 font-mono">
							{#each activeDiffLog.diff_payload || [] as diff, i (i)}
								<tr class="hover:bg-slate-50">
									<td class="px-4 py-3 font-bold text-slate-900 break-all">{diff.field}</td>
									<td class="px-4 py-3 bg-rose-50/30 text-rose-700 break-all">
										{#if diff.from === null || diff.from === undefined}
											<span class="italic text-slate-400">null</span>
										{:else}
											<span class="line-through bg-rose-100 px-1.5 py-0.5 rounded text-rose-900">
												{formatDiffValue(diff.from)}
											</span>
										{/if}
									</td>
									<td class="px-4 py-3 bg-emerald-50/30 text-emerald-700 break-all font-bold">
										{#if diff.to === null || diff.to === undefined}
											<span class="italic text-slate-400">null</span>
										{:else}
											<span class="bg-emerald-100 px-1.5 py-0.5 rounded text-emerald-900">
												{formatDiffValue(diff.to)}
											</span>
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<div class="border-t border-slate-200 bg-slate-50 px-6 py-3.5 text-right">
				<button
					type="button"
					onclick={onCloseDiff}
					class="rounded-xl bg-slate-900 px-5 py-2 text-xs font-black text-white hover:bg-blue-600 transition"
				>
					닫기
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 2. 감사로그 · 오류 스택 상세 모달 (metadata_payload 호환 수정 완료) -->
{#if activeDetailLog}
	{@const metaObj = getLogMetadata(activeDetailLog)}
	{@const isErrorTone =
		activeDetailLog.log_type === 'ERROR' ||
		activeDetailLog.severity === 'ERROR' ||
		activeDetailLog.severity === 'CRITICAL'}
	<div
		use:portal
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => e.target === e.currentTarget && onCloseDetail()}
		onkeydown={(e) => e.key === 'Escape' && onCloseDetail()}
	>
		<div
			transition:scale={{ duration: 150, start: 0.97 }}
			class="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
		>
			<div
				class="flex items-center justify-between border-b border-slate-200 px-6 py-4 {isErrorTone ? 'bg-rose-50' : 'bg-slate-50'}"
			>
				<div class="flex items-center gap-2.5 min-w-0">
					<div
						class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white {isErrorTone ? 'bg-rose-600' : 'bg-blue-600'}"
					>
						<Icon icon={isErrorTone ? 'solar:danger-triangle-bold' : 'solar:document-text-bold'} class="text-lg" />
					</div>
					<div class="min-w-0">
						<h3 class="text-sm sm:text-base font-black {isErrorTone ? 'text-rose-900' : 'text-slate-900'}">
							{isErrorTone ? '서버 장애 및 오류 세부 내역' : '감사로그 상세 내역'}
						</h3>
						<p class="text-xs font-mono truncate {isErrorTone ? 'text-rose-700' : 'text-slate-500'}">
							#{activeDetailLog.id} · Request-ID: {metaObj.request_id || '-'} · {formatDateTime(activeDetailLog.created_at)}
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={onCloseDetail}
					class="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition"
					aria-label="상세창 닫기"
				>
					<Icon icon="solar:close-circle-bold" class="text-2xl" />
				</button>
			</div>

			<div class="max-h-[68vh] overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
				<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-200">
					<div>
						<span class="block text-[10px] font-bold text-slate-400">앱 / 유형</span>
						<span class="mt-0.5 block font-mono font-black text-slate-800">
							{activeDetailLog.app_id || 'system'} / {activeDetailLog.log_type}
						</span>
					</div>
					<div>
						<span class="block text-[10px] font-bold text-slate-400">심각도</span>
						<span class="mt-0.5 inline-block rounded border px-2 py-0.5 text-[10px] font-black {getSeverityBadge(activeDetailLog.severity)}">
							{activeDetailLog.severity}
						</span>
					</div>
					<div>
						<span class="block text-[10px] font-bold text-slate-400">행위 (Action)</span>
						<span class="mt-0.5 block font-mono font-bold text-blue-700 truncate">{activeDetailLog.action}</span>
					</div>
					<div>
						<span class="block text-[10px] font-bold text-slate-400">IP / 수행자</span>
						<span class="mt-0.5 block font-bold text-slate-800 truncate">
							{activeDetailLog.user_summary || '시스템'} {activeDetailLog.ip_address ? `(${activeDetailLog.ip_address})` : ''}
						</span>
					</div>
				</div>

				<div>
					<span class="text-xs font-bold text-slate-400">제목:</span>
					<div class="mt-1 font-bold text-slate-900 text-sm bg-slate-50 p-3 rounded-xl border border-slate-200">
						{activeDetailLog.title}
					</div>
				</div>

				{#if activeDetailLog.message}
					<div>
						<span class="text-xs font-bold text-slate-400">상세 메시지 / 스택 트레이스:</span>
						<pre class="mt-1 font-mono text-xs bg-slate-900 {isErrorTone ? 'text-rose-300' : 'text-emerald-300'} p-4 rounded-xl overflow-x-auto whitespace-pre-wrap max-h-80 leading-relaxed border border-slate-800">{activeDetailLog.message}</pre>
					</div>
				{/if}

				{#if Object.keys(metaObj).length > 0}
					<div>
						<span class="text-xs font-bold text-slate-400">요청 컨텍스트 메타데이터 (metadata_payload):</span>
						<pre class="mt-1 font-mono text-xs bg-slate-100 text-slate-800 p-3.5 rounded-xl overflow-x-auto max-h-56">{JSON.stringify(metaObj, null, 2)}</pre>
					</div>
				{/if}
			</div>

			<div class="border-t border-slate-200 bg-slate-50 px-6 py-3.5 text-right">
				<button
					type="button"
					onclick={onCloseDetail}
					class="rounded-xl bg-slate-900 px-5 py-2 text-xs font-black text-white hover:bg-blue-600 transition"
				>
					닫기
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 3. 세션 강제 추방 확인 모달 (window.confirm 대체) -->
{#if kickTargetSession}
	{@const targetLabel =
		kickTargetSession.real_name ||
		kickTargetSession.user_name ||
		kickTargetSession.username ||
		`세션 #${kickTargetSession.id}`}
	<div
		use:portal
		transition:fade={{ duration: 140 }}
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => !isKicking && e.target === e.currentTarget && onCloseKick()}
		onkeydown={(e) => !isKicking && e.key === 'Escape' && onCloseKick()}
	>
		<div
			transition:scale={{ duration: 140, start: 0.96 }}
			class="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden"
		>
			<div class="p-6">
				<div class="flex items-start gap-3.5">
					<div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
						<Icon icon="solar:shield-cross-bold-duotone" class="text-2xl" />
					</div>
					<div class="min-w-0">
						<h3 class="text-base font-black text-slate-900">접속 세션 강제 추방</h3>
						<p class="mt-1.5 text-xs font-medium leading-relaxed text-slate-600">
							<strong class="text-slate-900">{targetLabel} (@{kickTargetSession.username})</strong> 님의 접속 세션(IP: <code class="font-mono">{kickTargetSession.ip_address || '-'}</code>)을 즉시 강제 종료하시겠습니까?
						</p>
						<p class="mt-1 text-[11px] text-rose-600 font-bold">
							종료 즉시 해당 기기에서 로그아웃되며, 보안 감사로그(SESSION_KICKED)에 영구 기록됩니다.
						</p>
					</div>
				</div>
			</div>

			<div class="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-3.5">
				<button
					type="button"
					disabled={isKicking}
					onclick={onCloseKick}
					class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
				>
					취소
				</button>
				<button
					type="button"
					disabled={isKicking}
					onclick={() => kickTargetSession && onConfirmKick(kickTargetSession)}
					class="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-black text-white shadow-xs hover:bg-rose-700 disabled:opacity-50 transition"
				>
					{#if isKicking}
						<Icon icon="solar:refresh-circle-bold-duotone" class="animate-spin text-sm" />
					{/if}
					<span>즉시 강제 추방</span>
				</button>
			</div>
		</div>
	</div>
{/if}
