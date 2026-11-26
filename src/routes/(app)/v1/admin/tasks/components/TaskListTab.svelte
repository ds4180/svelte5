<script lang="ts">
	/**
	 * ============================================================================
	 * [태스크 관제 — 실시간 작업 & 정기 예약 목록 탭 (TaskListTab.svelte)]
	 * ============================================================================
	 * - 상태 필터, 키워드 검색, 실패 작업 일괄 정리 및
	 *   모바일 카드 뷰(< md) + 데스크톱 테이블(md 이상) 반응형 레이아웃을 제공합니다.
	 */
	import Icon from '@iconify/svelte';
	import {
		formatIntervalReadable,
		getTaskStatusBadge,
		resolveTaskTypeInfo,
		type TaskTypeMeta
	} from '$lib/services/taskAdminService';
	import { formatDateTime, timeAgo } from '$lib/utils';

	interface Props {
		mode: 'monitor' | 'schedule';
		tasks: any[];
		total: number;
		isLoading: boolean;
		taskTypes: TaskTypeMeta[];
		selectedStatus: string;
		searchQuery: string;
		failedCount: number;
		canWrite: boolean;
		onStatusChange: (nextStatus: string) => void;
		onSearchChange: (nextQuery: string) => void;
		onClearAllFailed: () => void;
		onViewDetail: (task: any) => void;
		onOpenEdit: (task: any) => void;
		onRetry: (taskId: number) => void;
		onCancel: (taskId: number) => void;
		onDelete: (taskId: number) => void;
	}

	let {
		mode,
		tasks = [],
		total = 0,
		isLoading = false,
		taskTypes = [],
		selectedStatus = '',
		searchQuery = '',
		failedCount = 0,
		canWrite = false,
		onStatusChange,
		onSearchChange,
		onClearAllFailed,
		onViewDetail,
		onOpenEdit,
		onRetry,
		onCancel,
		onDelete
	}: Props = $props();

	let localSearch = $state('');

	$effect(() => {
		localSearch = searchQuery;
	});

	function submitSearch() {
		onSearchChange(localSearch);
	}
</script>

<!-- 상단 필터 및 검색 컨트롤 바 -->
<div class="flex flex-col gap-3 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
	<div class="flex flex-wrap items-center gap-2.5">
		<span class="text-xs font-bold text-slate-500">상태:</span>
		<select
			value={selectedStatus}
			onchange={(e) => onStatusChange(e.currentTarget.value)}
			class="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
		>
			<option value="">모든 상태 보기</option>
			<option value="PENDING">대기중 (PENDING)</option>
			<option value="RUNNING">실행중 (RUNNING)</option>
			<option value="SUCCESS">성공 (SUCCESS)</option>
			<option value="FAILED">실패 (FAILED)</option>
			<option value="CANCELLED">취소됨 (CANCELLED)</option>
		</select>

		<div class="relative w-full sm:w-60">
			<Icon icon="ph:magnifying-glass-bold" class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
			<input
				type="text"
				bind:value={localSearch}
				placeholder="작업 ID, 유형, 고유키 검색..."
				onkeydown={(e) => e.key === 'Enter' && submitSearch()}
				class="w-full rounded-xl border border-slate-300 bg-slate-50 pl-8 pr-7 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
			/>
			{#if localSearch}
				<button
					type="button"
					onclick={() => {
						localSearch = '';
						onSearchChange('');
					}}
					class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 text-xs"
					aria-label="검색어 지우기"
				>
					<Icon icon="ph:x-bold" />
				</button>
			{/if}
		</div>
	</div>

	<div class="flex flex-wrap items-center justify-between sm:justify-end gap-3">
		{#if canWrite && failedCount > 0}
			<button
				type="button"
				onclick={onClearAllFailed}
				class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-xs transition shadow-xs"
			>
				<Icon icon="solar:trash-bin-trash-bold" class="text-sm" />
				<span>실패 작업({failedCount}건) 일괄 정리</span>
			</button>
		{/if}
		<div class="text-xs font-bold text-slate-400">
			총 <span class="text-blue-600 font-black">{total.toLocaleString()}</span>건
		</div>
	</div>
</div>

{#if isLoading}
	<div class="flex flex-col items-center justify-center py-20 text-slate-400">
		<Icon icon="solar:refresh-circle-bold-duotone" class="h-10 w-10 animate-spin text-blue-600" />
		<span class="mt-3 text-xs font-bold">작업 큐 데이터를 불러오는 중입니다...</span>
	</div>
{:else if tasks.length === 0}
	<div class="py-20 text-center text-slate-400 px-4">
		<Icon icon="solar:box-minimalistic-broken" class="mx-auto h-12 w-12 text-slate-300" />
		<p class="mt-2 text-sm font-bold">
			{mode === 'schedule' ? '등록된 정기 예약 일정이 없습니다.' : '조건에 해당하는 작업 내역이 없습니다.'}
		</p>
	</div>
{:else}
	<!-- 📱 모바일 전용 카드 리스트 (< md) -->
	<div class="md:hidden divide-y divide-slate-100">
		{#each tasks as task (task.id)}
			{@const typeInfo = resolveTaskTypeInfo(taskTypes, task.task_type)}
			{@const statusBadge = getTaskStatusBadge(task.status)}
			<div class="p-4 space-y-3 {task.status === 'FAILED' ? 'bg-rose-50/30' : 'bg-white'}">
				<div class="flex items-start justify-between gap-2">
					<div class="flex items-center gap-2.5 min-w-0">
						<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
							<Icon icon={typeInfo.icon} class="text-lg" />
						</div>
						<div class="min-w-0">
							<div class="flex items-center gap-1.5">
								<span class="font-mono text-[11px] font-black text-slate-400">#{task.id}</span>
								<span class="text-xs font-black text-slate-900 truncate">{typeInfo.label}</span>
							</div>
							<div class="text-[10px] font-mono text-slate-400 truncate">
								{task.task_type}{task.unique_key ? ` · ${task.unique_key}` : ''}
							</div>
						</div>
					</div>
					<span class="shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-black {statusBadge.color}">
						{statusBadge.label}
					</span>
				</div>

				<div class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] border border-slate-100">
					<div>
						{#if mode === 'schedule'}
							{#if task.cron_expression}
								<span class="font-mono font-black text-blue-700">Cron: {task.cron_expression}</span>
							{:else if task.repeat_interval}
								<span class="font-bold text-slate-700">{formatIntervalReadable(task.repeat_interval)}</span>
							{/if}
						{:else}
							<span class="font-bold text-slate-600">진행률 {task.progress_pct || 0}% · 재시도 {task.retry_count}/{task.max_retries}</span>
						{/if}
					</div>
					<div class="text-slate-500 font-mono text-[10px]">
						{mode === 'schedule' && task.scheduled_at
							? formatDateTime(task.scheduled_at)
							: timeAgo(task.created_at)}
					</div>
				</div>

				<div class="flex flex-wrap items-center justify-end gap-1.5">
					<button
						type="button"
						onclick={() => onViewDetail(task)}
						class="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700"
					>
						상세보기
					</button>
					{#if canWrite}
						{#if task.status === 'FAILED'}
							<button
								type="button"
								onclick={() => onRetry(task.id)}
								class="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-black text-white"
							>
								<Icon icon="solar:restart-bold" class="text-xs" /> 재실행
							</button>
							<button
								type="button"
								onclick={() => onDelete(task.id)}
								class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-rose-600"
							>
								삭제
							</button>
						{:else if task.status === 'PENDING'}
							<button
								type="button"
								onclick={() => onOpenEdit(task)}
								class="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700"
							>
								수정
							</button>
							<button
								type="button"
								onclick={() => onCancel(task.id)}
								class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-rose-600"
							>
								취소
							</button>
						{:else if task.status === 'CANCELLED'}
							<button
								type="button"
								onclick={() => onDelete(task.id)}
								class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-500"
							>
								삭제
							</button>
						{/if}
					{/if}
				</div>
			</div>
		{/each}
	</div>

	<!-- 🖥️ 데스크톱 테이블 뷰 (md 이상) -->
	<div class="hidden md:block overflow-x-auto">
		<table class="w-full text-left text-xs">
			<thead class="border-b border-slate-200 bg-slate-50/80 font-black text-slate-500 uppercase tracking-wider">
				<tr>
					<th class="px-5 py-3.5">작업 ID</th>
					<th class="px-4 py-3.5">작업 내용</th>
					<th class="px-4 py-3.5">진행 상태</th>
					<th class="px-4 py-3.5">{mode === 'schedule' ? '정기 반복 주기' : '진행률'}</th>
					<th class="px-4 py-3.5">재시도</th>
					<th class="px-4 py-3.5">{mode === 'schedule' ? '다음 실행 예약' : '등록 시각'}</th>
					<th class="px-5 py-3.5 text-right">관리 제어</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100 font-medium text-slate-700">
				{#each tasks as task (task.id)}
					{@const typeInfo = resolveTaskTypeInfo(taskTypes, task.task_type)}
					{@const statusBadge = getTaskStatusBadge(task.status)}
					<tr class="hover:bg-slate-50/80 transition {task.status === 'FAILED' ? 'bg-rose-50/30' : ''}">
						<td class="px-5 py-4 font-mono font-bold text-slate-500">#{task.id}</td>
						<td class="px-4 py-4">
							<div class="flex items-center gap-2.5">
								<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
									<Icon icon={typeInfo.icon} class="text-base" />
								</div>
								<div>
									<div class="font-black text-slate-900 text-xs">{typeInfo.label}</div>
									<div class="text-[10px] font-mono text-slate-400 mt-0.5">
										{task.task_type}
										{#if task.unique_key}
											· <span class="text-slate-500">{task.unique_key}</span>
										{/if}
									</div>
								</div>
							</div>
						</td>
						<td class="px-4 py-4 whitespace-nowrap">
							<span class="inline-block rounded-md border px-2.5 py-1 text-[11px] font-black {statusBadge.color}">
								{statusBadge.label}
							</span>
						</td>
						<td class="px-4 py-4">
							{#if mode === 'schedule'}
								<div class="space-y-1">
									{#if task.cron_expression}
										<span class="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-black text-blue-700">
											<Icon icon="solar:clock-circle-bold" class="text-xs" />
											Cron: {task.cron_expression}
										</span>
									{/if}
									{#if task.repeat_interval}
										<span class="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-700">
											{formatIntervalReadable(task.repeat_interval)}
										</span>
									{/if}
								</div>
							{:else}
								<div class="flex items-center gap-2 max-w-[120px]">
									<div class="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
										<div class="h-full bg-blue-600 transition-all" style="width: {task.progress_pct || 0}%"></div>
									</div>
									<span class="text-[10px] font-bold text-slate-600 whitespace-nowrap">{task.progress_pct || 0}%</span>
								</div>
							{/if}
						</td>
						<td class="px-4 py-4 font-mono text-xs">
							<span class={task.retry_count > 0 ? 'text-amber-600 font-bold' : 'text-slate-400'}>
								{task.retry_count}
							</span>
							<span class="text-slate-400">/{task.max_retries}</span>
						</td>
						<td class="px-4 py-4 whitespace-nowrap">
							{#if mode === 'schedule' && task.scheduled_at}
								<div class="font-bold text-blue-700">{formatDateTime(task.scheduled_at)}</div>
								<div class="text-[10px] text-slate-400">{timeAgo(task.scheduled_at)}</div>
							{:else}
								<div class="font-bold text-slate-900">{timeAgo(task.created_at)}</div>
								<div class="text-[10px] text-slate-400">{formatDateTime(task.created_at)}</div>
							{/if}
						</td>
						<td class="px-5 py-4 text-right whitespace-nowrap">
							<div class="inline-flex items-center gap-1.5">
								<button
									type="button"
									onclick={() => onViewDetail(task)}
									class="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
								>
									상세보기
								</button>
								{#if canWrite}
									{#if task.status === 'FAILED'}
										<button
											type="button"
											onclick={() => onRetry(task.id)}
											class="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1 text-xs font-black text-white shadow-xs transition hover:bg-rose-700 active:scale-95"
										>
											<Icon icon="solar:restart-bold" class="text-xs" />
											<span>다시 실행</span>
										</button>
										<button
											type="button"
											onclick={() => onDelete(task.id)}
											class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition"
										>
											<Icon icon="solar:trash-bin-trash-bold" class="text-xs" />
											<span>삭제</span>
										</button>
									{/if}
									{#if task.status === 'PENDING'}
										<button
											type="button"
											onclick={() => onOpenEdit(task)}
											class="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
										>
											<Icon icon="solar:pen-bold" class="text-xs" />
											<span>수정</span>
										</button>
										<button
											type="button"
											onclick={() => onCancel(task.id)}
											class="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-rose-600 transition hover:bg-rose-50"
										>
											취소
										</button>
									{/if}
									{#if task.status === 'CANCELLED'}
										<button
											type="button"
											onclick={() => onDelete(task.id)}
											class="rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-400 hover:text-rose-600 transition hover:bg-rose-50"
										>
											삭제
										</button>
									{/if}
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
