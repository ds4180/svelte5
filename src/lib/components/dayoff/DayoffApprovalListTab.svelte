<script lang="ts">
	/**
	 * ============================================================================
	 * [결근계 관리자 — 신청 승인 목록 탭 (DayoffApprovalListTab.svelte)]
	 * ============================================================================
	 */
	import type { DayoffEntry } from '$lib/api/dayoff';
	import type { WorkTypeFilter } from '$lib/services/dayoffAdminService';
	import { formatDateTime } from '$lib/utils';
	import {
		getDayoffBadgeClass,
		getDayoffStatusLabel,
		getDayoffTypeLabel,
		getDayoffWorkTypeLabel
	} from '$lib/utils/dayoff';

	interface Props {
		loading: boolean;
		workTypeFilter: WorkTypeFilter;
		pendingList: DayoffEntry[];
		processedOrFcfsList: DayoffEntry[];
		historyStatusFilter: 'ALL' | 'APPROVED' | 'REJECTED' | 'REQUESTED';
		onUpdateStatus: (id: number, status: string) => void;
	}

	let {
		loading,
		workTypeFilter,
		pendingList,
		processedOrFcfsList,
		historyStatusFilter = $bindable('ALL'),
		onUpdateStatus
	}: Props = $props();
</script>

{#snippet dayoffRowCore(d: DayoffEntry, showCreatedAt: boolean)}
	<!-- 1열: 신청자(성명/부서·직급) + 운영 방식(2줄 1셀) -->
	<td class="px-4 py-3.5 sm:px-6">
		<div class="flex items-center gap-2.5 sm:gap-3">
			<div
				class="hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black sm:flex {d.work_type ===
				'FCFS'
					? 'bg-emerald-100 text-emerald-700'
					: 'bg-slate-100 text-slate-600'}"
			>
				{d.real_name?.[0] || d.username[0]}
			</div>
			<div class="min-w-0 space-y-0.5">
				<div class="flex flex-wrap items-center gap-1.5">
					<span class="font-black text-slate-900">{d.real_name || d.username}</span>
					<span
						class="rounded-full border px-2 py-0.5 text-[9px] font-black {d.work_type === 'FCFS'
							? 'border-emerald-200 bg-emerald-50 text-emerald-700'
							: 'border-blue-200 bg-blue-50 text-blue-700'}"
					>
						{getDayoffWorkTypeLabel(d.work_type)}
					</span>
				</div>
				<div class="flex items-center gap-1 text-[10px] font-bold text-slate-400">
					<span>{d.primary_group || '미지정'}</span>
					<span>·</span>
					<span>Lv.{d.rank_level ?? 0}</span>
				</div>
			</div>
		</div>
	</td>

	<!-- 2열: 휴무일·유형 / 사유(메모)·묶음번호 (2줄 1셀) -->
	<td class="px-3 py-3.5 sm:px-4">
		<div class="space-y-0.5">
			<div class="flex flex-wrap items-center gap-1.5">
				<span class="font-mono text-xs font-black text-slate-800">{d.date}</span>
				<span
					class="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-black tracking-tighter text-slate-700"
				>
					{getDayoffTypeLabel(d.type)}
				</span>
			</div>
			<div class="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
				<span class="max-w-[160px] truncate sm:max-w-[220px]" title={d.memo || ''}>
					{d.memo || '사유 없음'}
				</span>
				{#if d.group_id}
					<span class="text-[9px] font-bold text-blue-500 opacity-80">#{d.group_id}</span>
				{/if}
			</div>
		</div>
	</td>

	<!-- 3열: 상태 / 신청 일시 (2줄 1셀) -->
	<td class="px-3 py-3.5 sm:px-4">
		<div class="space-y-1">
			<div>
				<span
					class="rounded-md border px-2 py-0.5 text-[10px] font-black tracking-tighter {getDayoffBadgeClass(
						d.status
					)}"
				>
					{getDayoffStatusLabel(d.status)}
				</span>
			</div>
			{#if showCreatedAt && d.create_date}
				<div class="font-mono text-[10px] text-slate-400">
					{formatDateTime(d.create_date)}
				</div>
			{/if}
		</div>
	</td>
{/snippet}

<div class="space-y-6">
	{#if workTypeFilter !== 'FCFS'}
		<div
			class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg md:rounded-[2rem] md:shadow-2xl"
		>
			<div
				class="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 p-6 md:p-8"
			>
				<h3 class="text-lg font-black tracking-tight text-slate-900">
					승인 대기 목록
					<span class="ml-2 text-sm font-bold text-blue-600">
						검토 대기 중인 신청 건 (사무직 승인제 · {pendingList.length}건)
					</span>
				</h3>
			</div>

			<div class="overflow-x-auto">
				<table class="table w-full">
					<thead
						class="border-b border-slate-100 bg-slate-50 text-xs font-bold tracking-wider text-slate-500"
					>
						<tr>
							<th class="px-4 py-3.5 sm:px-6">신청자 / 직군·부서</th>
							<th class="px-3 py-3.5 sm:px-4">휴무일·유형 / 사유</th>
							<th class="px-3 py-3.5 sm:px-4">상태 / 신청일</th>
							<th class="px-4 py-3.5 text-right sm:px-6">승인 처리</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-50">
						{#if loading}
							<tr>
								<td colspan="4" class="py-14 text-center">
									<span class="loading loading-lg loading-bars text-blue-600"></span>
								</td>
							</tr>
						{:else if pendingList.length === 0}
							<tr>
								<td
									colspan="4"
									class="py-12 text-center text-base font-black tracking-wider text-slate-300"
								>
									승인 대기 건 없음
								</td>
							</tr>
						{:else}
							{#each pendingList as d (d.id)}
								<tr class="group transition-colors hover:bg-slate-50">
									{@render dayoffRowCore(d, true)}
									<td class="px-4 text-right sm:px-6">
										<div class="flex justify-end gap-1.5 py-1">
											<button
												type="button"
												class="btn rounded-lg border-none bg-emerald-600 font-black text-white transition-all btn-sm hover:bg-emerald-700"
												onclick={() => onUpdateStatus(d.id, 'APPROVED')}>승인</button
											>
											<button
												type="button"
												class="btn rounded-lg border-none bg-rose-500 font-black text-white transition-all btn-sm hover:bg-rose-600"
												onclick={() => onUpdateStatus(d.id, 'REJECTED')}>반려</button
											>
										</div>
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- 선착순(운전직) 신청·확정 및 근태 처리 이력 -->
	<div
		class="overflow-hidden rounded-xl border {workTypeFilter === 'FCFS'
			? 'border-emerald-300 shadow-lg md:shadow-2xl'
			: 'border-slate-200 shadow-sm'} bg-white md:rounded-[2rem]"
	>
		<div
			class="flex flex-col justify-between gap-3 border-b border-slate-100 {workTypeFilter ===
			'FCFS'
				? 'bg-emerald-50/50'
				: 'bg-slate-50/50'} p-6 md:flex-row md:items-center md:p-8"
		>
			<div>
				<h3 class="text-lg font-black tracking-tight text-slate-900">
					{workTypeFilter === 'FCFS' ? '운전직 선착순 대장' : '처리 완료 · 선착순 대장'}
					<span
						class="ml-2 text-sm font-bold {workTypeFilter === 'FCFS'
							? 'text-emerald-700'
							: 'text-slate-600'}"
					>
						{workTypeFilter === 'FCFS'
							? `🚌 운전직 선착순 신청·확정 목록 (${processedOrFcfsList.length}건)`
							: `선착순 자동확정 및 처리 완료 내역 (${processedOrFcfsList.length}건)`}
					</span>
				</h3>
				<p class="mt-0.5 text-[11px] font-medium text-slate-500">
					{workTypeFilter === 'FCFS'
						? '운전직(선착순) 신청은 정원 내 제출 시 즉시 승인 확정되며, 필요 시 관리자 반려/되돌리기가 가능합니다.'
						: '선착순 자동확정 건과 관리자 승인·반려 처리 이력을 함께 확인할 수 있습니다.'}
				</p>
			</div>

			<div
				class="inline-flex shrink-0 rounded-xl border border-slate-200 bg-white p-1 text-[11px] font-black"
			>
				{#each [{ id: 'ALL', label: '전체' }, { id: 'APPROVED', label: '승인 확정' }, { id: 'REJECTED', label: '반려' }, ...(workTypeFilter === 'FCFS' ? [{ id: 'REQUESTED', label: '승인 대기' }] : [])] as stOpt (stOpt.id)}
					<button
						type="button"
						onclick={() => (historyStatusFilter = stOpt.id as any)}
						class="rounded-lg px-2.5 py-1 transition {historyStatusFilter === stOpt.id
							? 'bg-slate-900 text-white shadow-xs'
							: 'text-slate-600 hover:text-slate-900'}"
					>
						{stOpt.label}
					</button>
				{/each}
			</div>
		</div>

		<div class="overflow-x-auto">
			<table class="table w-full">
				<thead
					class="border-b border-slate-100 bg-slate-50 text-xs font-bold tracking-wider text-slate-500"
				>
					<tr>
						<th class="px-4 py-3.5 sm:px-6">신청자 / 직군·부서</th>
						<th class="px-3 py-3.5 sm:px-4">휴무일·유형 / 사유</th>
						<th class="px-3 py-3.5 sm:px-4">상태 / 신청일시</th>
						<th class="px-4 py-3.5 text-right sm:px-6">상태 관리</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-50">
					{#if loading}
						<tr>
							<td colspan="4" class="py-16 text-center">
								<span class="loading loading-lg loading-bars text-emerald-600"></span>
							</td>
						</tr>
					{:else if processedOrFcfsList.length === 0}
						<tr>
							<td
								colspan="4"
								class="py-14 text-center text-sm font-black tracking-wider text-slate-400"
							>
								{workTypeFilter === 'FCFS'
									? '조건에 해당하는 운전직 선착순 신청 내역이 없습니다.'
									: '표시할 처리 완료·선착순 내역이 없습니다.'}
							</td>
						</tr>
					{:else}
						{#each processedOrFcfsList as d (d.id)}
							<tr class="group transition-colors hover:bg-slate-50">
								{@render dayoffRowCore(d, true)}
								<td class="px-4 text-right sm:px-6">
									<div class="flex flex-wrap justify-end gap-2">
										{#if d.status === 'REQUESTED'}
											<button
												type="button"
												class="btn rounded-lg border-none bg-emerald-600 font-black text-white btn-xs hover:bg-emerald-700"
												onclick={() => onUpdateStatus(d.id, 'APPROVED')}>승인</button
											>
											<button
												type="button"
												class="btn rounded-lg border-none bg-rose-500 font-black text-white btn-xs hover:bg-rose-600"
												onclick={() => onUpdateStatus(d.id, 'REJECTED')}>반려</button
											>
										{:else if d.status === 'APPROVED'}
											<button
												type="button"
												class="text-[11px] font-black text-slate-500 underline hover:text-blue-600"
												onclick={() => onUpdateStatus(d.id, 'REQUESTED')}>대기전환</button
											>
											<button
												type="button"
												class="text-[11px] font-black text-rose-500 underline hover:text-rose-700"
												onclick={() => onUpdateStatus(d.id, 'REJECTED')}>반려</button
											>
										{:else}
											<button
												type="button"
												class="text-[11px] font-black text-emerald-600 underline hover:text-emerald-800"
												onclick={() => onUpdateStatus(d.id, 'APPROVED')}>승인복원</button
											>
											<button
												type="button"
												class="text-[11px] font-black text-slate-500 underline hover:text-blue-600"
												onclick={() => onUpdateStatus(d.id, 'REQUESTED')}>대기전환</button
											>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
