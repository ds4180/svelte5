<script lang="ts">
	/**
	 * ============================================================================
	 * [태스크 관제 — 상세 뷰어 · 스케줄 수정 · 실행 확인 모달 묶음 (TaskModals.svelte)]
	 * ============================================================================
	 * - 브라우저 기본 window.confirm을 제거하고 일관된 포털 모달로 통합합니다.
	 * - 상세 뷰어: 상태, 재시도, 워커 ID, 시각 타임라인, 에러 로그, Payload/Result JSON 표시
	 * - 스케줄·옵션 수정: 예약 일시, Cron 표현식(동적 프리셋 지원), 반복 주기(초), 우선순위, 제한시간, Payload 수정
	 * - 확인 모달: 재실행, 취소, 영구 삭제, 실패 일괄 정리 확인
	 */
	import Icon from '@iconify/svelte';
	import { fade, scale } from 'svelte/transition';
	import { portal } from '$lib/actions/portal';
	import { toast } from '$lib/runes/toast.svelte';
	import {
		formatIntervalReadable,
		getTaskStatusBadge,
		parseJsonPayloadSafe,
		resolveTaskTypeInfo,
		type TaskSettings,
		type TaskTypeMeta
	} from '$lib/services/taskAdminService';
	import { formatDateTime, toLocalISOString } from '$lib/utils';

	export interface TaskConfirmAction {
		title: string;
		description: string;
		confirmLabel: string;
		tone: 'danger' | 'primary';
		onConfirm: () => Promise<void> | void;
	}

	interface Props {
		taskTypes: TaskTypeMeta[];
		settings: TaskSettings;
		canWrite: boolean;

		detailTask: any | null;
		onCloseDetail: () => void;
		onRequestRetry: (taskId: number) => void;
		onRequestCancel: (taskId: number) => void;
		onRequestDelete: (taskId: number) => void;
		onSwitchToEdit: (task: any) => void;

		editingTask: any | null;
		onCloseEdit: () => void;
		onSaveEdit: (taskId: number, payload: Record<string, any>) => Promise<void>;

		confirmAction: TaskConfirmAction | null;
		isConfirmBusy: boolean;
		onCloseConfirm: () => void;
	}

	let {
		taskTypes = [],
		settings,
		canWrite = false,
		detailTask = null,
		onCloseDetail,
		onRequestRetry,
		onRequestCancel,
		onRequestDelete,
		onSwitchToEdit,
		editingTask = null,
		onCloseEdit,
		onSaveEdit,
		confirmAction = null,
		isConfirmBusy = false,
		onCloseConfirm
	}: Props = $props();

	let isSavingEdit = $state(false);
	let editForm = $state({
		scheduled_at: '',
		cron_expression: '',
		repeat_interval: '' as string | number,
		priority: 5,
		max_retries: 3,
		timeout_sec: 300,
		payload_str: '{}',
		tags_str: ''
	});

	function toLocalDatetimeInputValue(isoStr?: string | null): string {
		if (!isoStr) return '';
		const d = new Date(isoStr);
		if (Number.isNaN(d.getTime())) return '';
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}

	$effect(() => {
		if (editingTask) {
			editForm = {
				scheduled_at: toLocalDatetimeInputValue(editingTask.scheduled_at),
				cron_expression: editingTask.cron_expression || '',
				repeat_interval: editingTask.repeat_interval ?? '',
				priority: editingTask.priority ?? settings.default_priority,
				max_retries: editingTask.max_retries ?? settings.default_max_retries,
				timeout_sec: editingTask.timeout_sec ?? settings.default_timeout_sec,
				payload_str: JSON.stringify(editingTask.payload || {}, null, 2),
				tags_str: Array.isArray(editingTask.tags) ? editingTask.tags.join(', ') : ''
			};
		}
	});

	async function submitEditForm() {
		if (!editingTask) return;
		const parsed = parseJsonPayloadSafe(editForm.payload_str);
		if (!parsed.ok) {
			toast.error(parsed.error);
			return;
		}

		const intervalNum =
			editForm.repeat_interval === '' || editForm.repeat_interval === null
				? null
				: Math.max(10, Number(editForm.repeat_interval) || 60);

		const updatePayload: Record<string, any> = {
			scheduled_at: editForm.scheduled_at ? toLocalISOString(editForm.scheduled_at) : null,
			cron_expression: editForm.cron_expression.trim() || null,
			repeat_interval: intervalNum,
			priority: Math.min(10, Math.max(1, Number(editForm.priority) || settings.default_priority)),
			max_retries: Math.min(10, Math.max(0, Number(editForm.max_retries ?? settings.default_max_retries))),
			timeout_sec: Math.min(3600, Math.max(10, Number(editForm.timeout_sec) || settings.default_timeout_sec)),
			payload: parsed.data,
			tags: editForm.tags_str
				.split(',')
				.map((t) => t.trim())
				.filter(Boolean)
		};

		isSavingEdit = true;
		try {
			await onSaveEdit(editingTask.id, updatePayload);
		} finally {
			isSavingEdit = false;
		}
	}
</script>

<!-- 1. 작업 상세 진단 모달 -->
{#if detailTask}
	{@const typeInfo = resolveTaskTypeInfo(taskTypes, detailTask.task_type)}
	{@const statusBadge = getTaskStatusBadge(detailTask.status)}
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
			class="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
		>
			<div class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
				<div class="flex items-center gap-3 min-w-0">
					<span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
						<Icon icon={typeInfo.icon} class="text-xl" />
					</span>
					<div class="min-w-0">
						<h2 class="text-sm sm:text-base font-black text-slate-900 truncate">
							작업 #{detailTask.id} — {typeInfo.label}
						</h2>
						<p class="font-mono text-[11px] text-slate-500 truncate">
							{detailTask.task_type}{detailTask.unique_key ? ` · ${detailTask.unique_key}` : ''}
						</p>
					</div>
				</div>
				<button
					type="button"
					onclick={onCloseDetail}
					class="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
					aria-label="상세창 닫기"
				>
					<Icon icon="solar:close-circle-bold" class="h-6 w-6" />
				</button>
			</div>

			<div class="max-h-[75vh] space-y-5 overflow-y-auto p-5 sm:p-6 text-xs">
				<!-- 핵심 메타 요약 그리드 -->
				<div class="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl bg-slate-50 p-4 border border-slate-200">
					<div>
						<span class="block text-[10px] font-bold text-slate-400 uppercase">현재 상태</span>
						<span class="mt-1 inline-block rounded-md border px-2 py-0.5 text-[11px] font-black {statusBadge.color}">
							{statusBadge.label}
						</span>
					</div>
					<div>
						<span class="block text-[10px] font-bold text-slate-400 uppercase">재시도 / 제한시간</span>
						<span class="mt-1 block font-mono font-bold text-slate-800">
							{detailTask.retry_count} / {detailTask.max_retries}회 · {detailTask.timeout_sec || 300}초
						</span>
					</div>
					<div>
						<span class="block text-[10px] font-bold text-slate-400 uppercase">우선순위 / 진행률</span>
						<span class="mt-1 block font-mono font-bold text-slate-800">
							P{detailTask.priority} · {detailTask.progress_pct ?? 0}%
						</span>
					</div>
					<div>
						<span class="block text-[10px] font-bold text-slate-400 uppercase">담당 워커 ID</span>
						<span class="mt-1 block font-mono font-bold text-slate-700 truncate">
							{detailTask.worker_id || '대기 중'}
						</span>
					</div>
				</div>

				<!-- 시각 및 스케줄 타임라인 -->
				<div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2 rounded-xl border border-slate-200 p-4 bg-white">
					<div class="flex items-center justify-between">
						<span class="text-slate-400 font-bold">등록 시각</span>
						<span class="font-mono font-bold text-slate-700">{formatDateTime(detailTask.created_at)}</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-slate-400 font-bold">예약 실행 시각</span>
						<span class="font-mono font-bold text-blue-700">
							{detailTask.scheduled_at ? formatDateTime(detailTask.scheduled_at) : '즉시 실행'}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-slate-400 font-bold">착수 시각</span>
						<span class="font-mono text-slate-700">
							{detailTask.started_at ? formatDateTime(detailTask.started_at) : '-'}
						</span>
					</div>
					<div class="flex items-center justify-between">
						<span class="text-slate-400 font-bold">완료 시각</span>
						<span class="font-mono text-slate-700">
							{detailTask.completed_at ? formatDateTime(detailTask.completed_at) : '-'}
						</span>
					</div>
					{#if detailTask.cron_expression || detailTask.repeat_interval}
						<div class="sm:col-span-2 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
							<span class="text-slate-400 font-bold">반복 스케줄 규칙</span>
							<div class="flex items-center gap-2">
								{#if detailTask.cron_expression}
									<span class="rounded bg-blue-50 px-2 py-0.5 font-mono font-black text-blue-700">
										Cron: {detailTask.cron_expression}
									</span>
								{/if}
								{#if detailTask.repeat_interval}
									<span class="rounded bg-slate-100 px-2 py-0.5 font-bold text-slate-700">
										{formatIntervalReadable(detailTask.repeat_interval)}
									</span>
								{/if}
							</div>
						</div>
					{/if}
				</div>

				{#if detailTask.error_log}
					<div>
						<h4 class="mb-1.5 font-black text-rose-600 flex items-center gap-1.5">
							<Icon icon="solar:danger-triangle-bold" /> 오류 상세 로그 (Error Traceback)
						</h4>
						<pre class="max-h-52 overflow-auto rounded-xl border border-rose-200 bg-rose-950 p-4 font-mono text-[11px] text-rose-200 whitespace-pre-wrap">{detailTask.error_log}</pre>
					</div>
				{/if}

				<div>
					<h4 class="mb-1.5 font-black text-slate-700">전달된 입력 매개변수 (Payload)</h4>
					<pre class="max-h-40 overflow-auto rounded-xl bg-slate-900 p-3.5 font-mono text-[11px] text-emerald-300">{JSON.stringify(detailTask.payload || {}, null, 2)}</pre>
				</div>

				{#if detailTask.result && Object.keys(detailTask.result).length > 0}
					<div>
						<h4 class="mb-1.5 font-black text-slate-700">실행 결과 데이터 (Result)</h4>
						<pre class="max-h-44 overflow-auto rounded-xl bg-slate-900 p-3.5 font-mono text-[11px] text-sky-300">{JSON.stringify(detailTask.result, null, 2)}</pre>
					</div>
				{/if}
			</div>

			<div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
				<div class="flex flex-wrap items-center gap-2">
					{#if canWrite}
						{#if detailTask.status === 'FAILED'}
							<button
								type="button"
								onclick={() => {
									const id = detailTask.id;
									onCloseDetail();
									onRequestRetry(id);
								}}
								class="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-rose-700"
							>
								<Icon icon="solar:restart-bold" /> 지금 다시 실행
							</button>
							<button
								type="button"
								onclick={() => {
									const id = detailTask.id;
									onCloseDetail();
									onRequestDelete(id);
								}}
								class="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
							>
								<Icon icon="solar:trash-bin-trash-bold" /> 영구 삭제
							</button>
						{:else if detailTask.status === 'PENDING'}
							<button
								type="button"
								onclick={() => {
									const t = detailTask;
									onCloseDetail();
									onSwitchToEdit(t);
								}}
								class="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-black text-white shadow-xs hover:bg-blue-700"
							>
								<Icon icon="solar:pen-bold" /> 스케줄·옵션 수정
							</button>
							<button
								type="button"
								onclick={() => {
									const id = detailTask.id;
									onCloseDetail();
									onRequestCancel(id);
								}}
								class="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
							>
								작업 취소
							</button>
						{:else if detailTask.status === 'CANCELLED'}
							<button
								type="button"
								onclick={() => {
									const id = detailTask.id;
									onCloseDetail();
									onRequestDelete(id);
								}}
								class="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50"
							>
								<Icon icon="solar:trash-bin-trash-bold" /> 영구 삭제
							</button>
						{/if}
					{/if}
				</div>
				<button
					type="button"
					onclick={onCloseDetail}
					class="rounded-xl border border-slate-300 bg-white px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
				>
					닫기
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 2. 예약 스케줄 및 엔지니어링 옵션 수정 모달 -->
{#if editingTask}
	{@const editTypeInfo = resolveTaskTypeInfo(taskTypes, editingTask.task_type)}
	<div
		use:portal
		transition:fade={{ duration: 150 }}
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => e.target === e.currentTarget && onCloseEdit()}
		onkeydown={(e) => e.key === 'Escape' && onCloseEdit()}
	>
		<div
			transition:scale={{ duration: 150, start: 0.97 }}
			class="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
		>
			<div class="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-6 py-4">
				<div class="flex items-center gap-2.5">
					<Icon icon="solar:pen-new-square-bold-duotone" class="h-6 w-6 text-blue-600" />
					<div>
						<h2 class="text-sm sm:text-base font-black text-slate-900">
							작업 #{editingTask.id} 스케줄·옵션 수정
						</h2>
						<p class="text-[11px] font-bold text-slate-500">{editTypeInfo.label} ({editingTask.task_type})</p>
					</div>
				</div>
				<button
					type="button"
					onclick={onCloseEdit}
					class="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
					aria-label="수정창 닫기"
				>
					<Icon icon="solar:close-circle-bold" class="h-6 w-6" />
				</button>
			</div>

			<div class="max-h-[75vh] space-y-4 overflow-y-auto p-5 sm:p-6 text-xs">
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<div>
						<label for="editSchedAt" class="block font-black text-slate-700 mb-1">다음 예약 실행 시각:</label>
						<input
							type="datetime-local"
							id="editSchedAt"
							bind:value={editForm.scheduled_at}
							class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
						/>
						<p class="mt-1 text-[10px] text-slate-400">비워두고 Cron 입력 시 다음 주기가 자동 계산됩니다.</p>
					</div>

					<div>
						<label for="editInterval" class="block font-black text-slate-700 mb-1">초 단위 반복 주기 (선택):</label>
						<input
							type="number"
							id="editInterval"
							min="10"
							max="86400"
							placeholder="단발성 또는 Cron 사용 시 비움"
							bind:value={editForm.repeat_interval}
							class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
						/>
					</div>
				</div>

				<div>
					<div class="flex items-center justify-between mb-1">
						<label for="editCron" class="font-black text-slate-700">정기 반복 Cron 표현식:</label>
						{#if editForm.cron_expression}
							<button
								type="button"
								onclick={() => (editForm.cron_expression = '')}
								class="text-[11px] font-bold text-rose-600 hover:underline"
							>
								Cron 해제 (단발 전환)
							</button>
						{/if}
					</div>
					<input
						type="text"
						id="editCron"
						bind:value={editForm.cron_expression}
						placeholder="예: 0 3 * * * (비워두면 Cron 미사용)"
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-mono font-bold text-slate-800 focus:border-blue-500 focus:outline-none"
					/>
					{#if settings.cron_presets.length > 0}
						<div class="mt-2 flex flex-wrap gap-1.5">
							{#each settings.cron_presets as preset (preset.cron + preset.label)}
								<button
									type="button"
									onclick={() => (editForm.cron_expression = preset.cron)}
									class="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-bold text-slate-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700"
								>
									{preset.label} (<code>{preset.cron}</code>)
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<div class="grid grid-cols-3 gap-3">
					<div>
						<label for="editPriority" class="block font-black text-slate-700 mb-1">우선순위 (1~10):</label>
						<input
							type="number"
							id="editPriority"
							min="1"
							max="10"
							bind:value={editForm.priority}
							class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-800"
						/>
					</div>
					<div>
						<label for="editRetries" class="block font-black text-slate-700 mb-1">최대 재시도:</label>
						<input
							type="number"
							id="editRetries"
							min="0"
							max="10"
							bind:value={editForm.max_retries}
							class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-800"
						/>
					</div>
					<div>
						<label for="editTimeout" class="block font-black text-slate-700 mb-1">제한시간 (초):</label>
						<input
							type="number"
							id="editTimeout"
							min="10"
							max="3600"
							bind:value={editForm.timeout_sec}
							class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-800"
						/>
					</div>
				</div>

				<div>
					<label for="editTags" class="block font-black text-slate-700 mb-1">태그 (쉼표 구분):</label>
					<input
						type="text"
						id="editTags"
						bind:value={editForm.tags_str}
						placeholder="cron, system"
						class="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold text-slate-800"
					/>
				</div>

				<div>
					<label for="editPayload" class="block font-black text-slate-700 mb-1">매개변수 (JSON Payload):</label>
					<textarea
						id="editPayload"
						bind:value={editForm.payload_str}
						rows="4"
						class="w-full rounded-xl border border-slate-300 bg-slate-900 p-3 font-mono text-xs text-emerald-400 focus:outline-none"
					></textarea>
				</div>
			</div>

			<div class="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-4">
				<button
					type="button"
					onclick={onCloseEdit}
					class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
				>
					취소
				</button>
				<button
					type="button"
					onclick={submitEditForm}
					disabled={isSavingEdit}
					class="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-black text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
				>
					<Icon icon="solar:diskette-bold" class="text-sm" />
					<span>{isSavingEdit ? '저장 중...' : '변경사항 저장'}</span>
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 3. 통합 실행·삭제 확인 모달 (window.confirm 대체) -->
{#if confirmAction}
	<div
		use:portal
		transition:fade={{ duration: 140 }}
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
		role="dialog"
		aria-modal="true"
		tabindex="-1"
		onclick={(e) => !isConfirmBusy && e.target === e.currentTarget && onCloseConfirm()}
		onkeydown={(e) => !isConfirmBusy && e.key === 'Escape' && onCloseConfirm()}
	>
		<div
			transition:scale={{ duration: 140, start: 0.96 }}
			class="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
		>
			<div class="p-6">
				<div class="flex items-start gap-3.5">
					<div
						class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl {confirmAction.tone === 'danger' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'}"
					>
						<Icon
							icon={confirmAction.tone === 'danger' ? 'solar:danger-triangle-bold-duotone' : 'solar:restart-circle-bold-duotone'}
							class="text-2xl"
						/>
					</div>
					<div class="min-w-0">
						<h3 class="text-base font-black text-slate-900">{confirmAction.title}</h3>
						<p class="mt-1.5 text-xs font-medium leading-relaxed text-slate-600 whitespace-pre-line">
							{confirmAction.description}
						</p>
					</div>
				</div>
			</div>

			<div class="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-6 py-3.5">
				<button
					type="button"
					disabled={isConfirmBusy}
					onclick={onCloseConfirm}
					class="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
				>
					취소
				</button>
				<button
					type="button"
					disabled={isConfirmBusy}
					onclick={() => confirmAction?.onConfirm()}
					class="inline-flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-black text-white shadow-xs transition active:scale-95 disabled:opacity-50 {confirmAction.tone === 'danger' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-blue-600 hover:bg-blue-700'}"
				>
					{#if isConfirmBusy}
						<Icon icon="solar:refresh-circle-bold-duotone" class="animate-spin text-sm" />
					{/if}
					<span>{confirmAction.confirmLabel}</span>
				</button>
			</div>
		</div>
	</div>
{/if}
