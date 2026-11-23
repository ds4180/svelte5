<script lang="ts">
	/**
	 * ============================================================================
	 * [결근계 관리자 — 결근 내역 게시판 탭 (DayoffRecordsTab.svelte)]
	 * ============================================================================
	 */
	import type { DayoffEntry } from '$lib/api/dayoff';
	import type {
		DayoffRecordFilterState,
		RecordSortOption,
		RecordStatusFilter,
		RecordTypeFilter,
		WorkTypeFilter
	} from '$lib/services/dayoffAdminService';
	import { formatDateTime } from '$lib/utils';
	import {
		DAYOFF_STATUS_LABELS,
		DAYOFF_TYPE_LABELS,
		getDayoffBadgeClass,
		getDayoffStatusLabel,
		getDayoffTypeLabel,
		getDayoffWorkTypeLabel
	} from '$lib/utils/dayoff';
	import Icon from '@iconify/svelte';

	interface Props {
		loading: boolean;
		todayStr: string;
		workTypeFilter: WorkTypeFilter;
		filters: DayoffRecordFilterState;
		groupOptions: string[];
		filteredRecordList: DayoffEntry[];
		pagedRecordList: DayoffEntry[];
		recordSummary: {
			total: number;
			approved: number;
			requested: number;
			rejected: number;
			cancelled: number;
		};
		recordPage: number;
		recordPageSize: number;
		recordTotalPages: number;
		onResetFilters: () => void;
		onUpdateStatus: (id: number, status: string) => void;
	}

	let {
		loading,
		todayStr,
		workTypeFilter,
		filters = $bindable(),
		groupOptions,
		filteredRecordList,
		pagedRecordList,
		recordSummary,
		recordPage = $bindable(1),
		recordPageSize = $bindable(20),
		recordTotalPages,
		onResetFilters,
		onUpdateStatus
	}: Props = $props();

	function printRecordLedger() {
		if (typeof window === 'undefined') return;
		window.print();
	}
</script>

<div
	class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg md:rounded-[2rem] md:shadow-2xl print:rounded-none print:border-none print:shadow-none"
>
	<!-- 인쇄 전용 공식 문서 헤더 -->
	<div class="mb-4 hidden border-b-2 border-slate-900 pb-4 print:block">
		<div class="flex items-end justify-between">
			<div>
				<h2 class="text-2xl font-black text-slate-900">사원 결근·휴무 내역 대장</h2>
				<p class="mt-1 text-xs font-bold text-slate-600">
					직군: {workTypeFilter === 'ALL'
						? '전체'
						: workTypeFilter === 'FCFS'
							? '운전직(선착순)'
							: '사무직(승인제)'}
					· 상태: {filters.status === 'ALL' ? '전체' : getDayoffStatusLabel(filters.status)}
					· 유형: {filters.type === 'ALL' ? '전체' : getDayoffTypeLabel(filters.type)}
					· 부서: {filters.group === 'ALL' ? '전체' : filters.group}
					{#if filters.startDate || filters.endDate}
						· 기간: {filters.startDate || '처음'} ~ {filters.endDate || '현재'}
					{/if}
					{#if filters.search.trim()}
						· 검색어: "{filters.search.trim()}"
					{/if}
				</p>
			</div>
			<div class="text-right text-xs font-bold text-slate-600">
				<div>출력일: {todayStr}</div>
				<div>
					총 {recordSummary.total}건 (승인 {recordSummary.approved} / 대기 {recordSummary.requested} /
					반려 {recordSummary.rejected})
				</div>
			</div>
		</div>
	</div>

	<!-- 상단 타이틀 & 액션 바 -->
	<div
		class="flex flex-col justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-6 md:flex-row md:items-center md:p-8 print:hidden"
	>
		<div>
			<h3 class="text-lg font-black tracking-tight text-slate-900">
				결근 내역 <span class="text-blue-600">전체 게시판</span>
			</h3>
			<p class="mt-0.5 text-xs font-medium text-slate-500">
				전체 사원의 결근·휴무 신청 내역을 검색·필터링하고 A4 양식으로 바로 인쇄할 수 있습니다.
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2">
			<button
				type="button"
				onclick={onResetFilters}
				class="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-black text-slate-600 shadow-xs transition hover:bg-slate-50 active:scale-95"
			>
				<Icon icon="solar:refresh-bold" class="text-sm" />
				<span>필터 초기화</span>
			</button>
			<button
				type="button"
				onclick={printRecordLedger}
				disabled={filteredRecordList.length === 0}
				class="inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-900 bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:border-blue-600 hover:bg-blue-600 active:scale-95 disabled:opacity-40"
			>
				<Icon icon="solar:printer-bold-duotone" class="text-base text-emerald-400" />
				<span>인쇄 ({filteredRecordList.length}건)</span>
			</button>
		</div>
	</div>

	<!-- 검색 및 다중 필터링 바 -->
	<div class="space-y-3 border-b border-slate-100 bg-white p-5 md:px-8 print:hidden">
		<div class="grid grid-cols-1 gap-3 md:grid-cols-12">
			<div class="relative md:col-span-4">
				<Icon
					icon="solar:magnifer-bold-duotone"
					class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-base text-slate-400"
				/>
				<input
					type="search"
					bind:value={filters.search}
					placeholder="이름, 아이디, 부서, 사유, 날짜 검색..."
					class="w-full rounded-xl border border-slate-300 bg-slate-50/70 py-2.5 pr-3 pl-10 text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
				/>
			</div>

			<div class="md:col-span-2">
				<select
					value={filters.status}
					onchange={(e) =>
						(filters.status = (e.target as HTMLSelectElement).value as RecordStatusFilter)}
					aria-label="상태 필터"
					class="select h-[38px] w-full rounded-xl border border-slate-300 bg-slate-50/70 text-xs font-bold text-slate-800 select-sm focus:border-blue-500 focus:bg-white focus:outline-none"
				>
					<option value="ALL">상태: 전체</option>
					{#each Object.entries(DAYOFF_STATUS_LABELS) as [code, label] (code)}
						<option value={code}>{label}</option>
					{/each}
				</select>
			</div>

			<div class="md:col-span-2">
				<select
					value={filters.type}
					onchange={(e) =>
						(filters.type = (e.target as HTMLSelectElement).value as RecordTypeFilter)}
					aria-label="유형 필터"
					class="select h-[38px] w-full rounded-xl border border-slate-300 bg-slate-50/70 text-xs font-bold text-slate-800 select-sm focus:border-blue-500 focus:bg-white focus:outline-none"
				>
					<option value="ALL">유형: 전체</option>
					{#each Object.entries(DAYOFF_TYPE_LABELS) as [code, label] (code)}
						<option value={code}>{label}</option>
					{/each}
				</select>
			</div>

			<div class="md:col-span-2">
				<select
					bind:value={filters.group}
					aria-label="부서 필터"
					class="select h-[38px] w-full rounded-xl border border-slate-300 bg-slate-50/70 text-xs font-bold text-slate-800 select-sm focus:border-blue-500 focus:bg-white focus:outline-none"
				>
					<option value="ALL">부서: 전체</option>
					{#each groupOptions as grp (grp)}
						<option value={grp}>{grp}</option>
					{/each}
				</select>
			</div>

			<div class="md:col-span-2">
				<select
					value={filters.sort}
					onchange={(e) =>
						(filters.sort = (e.target as HTMLSelectElement).value as RecordSortOption)}
					aria-label="정렬 기준"
					class="select h-[38px] w-full rounded-xl border border-slate-300 bg-slate-50/70 text-xs font-bold text-slate-800 select-sm focus:border-blue-500 focus:bg-white focus:outline-none"
				>
					<option value="date_desc">결근일 최신순</option>
					<option value="date_asc">결근일 오래된순</option>
					<option value="created_desc">신청일시 최신순</option>
					<option value="name_asc">이름 가나다순</option>
				</select>
			</div>
		</div>

		<div class="flex flex-wrap items-center justify-between gap-3 pt-1">
			<div class="flex flex-wrap items-center gap-2">
				<span class="text-xs font-black text-slate-500">기간 조회:</span>
				<input
					type="date"
					bind:value={filters.startDate}
					aria-label="조회 시작일"
					class="rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
				/>
				<span class="text-xs font-bold text-slate-400">~</span>
				<input
					type="date"
					bind:value={filters.endDate}
					aria-label="조회 종료일"
					class="rounded-xl border border-slate-300 bg-slate-50/70 px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
				/>
			</div>

			<div class="flex flex-wrap items-center gap-2 text-[11px] font-black">
				<span class="rounded-lg bg-slate-100 px-2.5 py-1 text-slate-700">
					검색 결과 {recordSummary.total}건
				</span>
				<span class="rounded-lg bg-emerald-50 px-2.5 py-1 text-emerald-700">
					승인 {recordSummary.approved}
				</span>
				<span class="rounded-lg bg-amber-50 px-2.5 py-1 text-amber-700">
					대기 {recordSummary.requested}
				</span>
				<span class="rounded-lg bg-rose-50 px-2.5 py-1 text-rose-700">
					반려 {recordSummary.rejected}
				</span>
				<select
					bind:value={recordPageSize}
					aria-label="페이지당 표시 개수"
					class="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-600 focus:border-blue-500 focus:outline-none"
				>
					<option value={20}>20건씩 보기</option>
					<option value={50}>50건씩 보기</option>
					<option value={100}>100건씩 보기</option>
					<option value={0}>전체 보기</option>
				</select>
			</div>
		</div>
	</div>

	<!-- 게시판 리스트 테이블 -->
	<div class="overflow-x-auto print:overflow-visible">
		<table class="table w-full print:text-xs">
			<!-- 화면용 반응형 헤더 (2줄 1셀 압축: 모바일 4열 / 데스크톱 5열) -->
			<thead
				class="border-b border-slate-200 bg-slate-50 text-xs font-bold tracking-wider text-slate-600 print:hidden"
			>
				<tr>
					<th class="hidden w-14 px-4 py-3.5 text-center md:table-cell">번호</th>
					<th class="px-4 py-3.5">신청자 / 직군·부서</th>
					<th class="px-3 py-3.5 sm:px-4">결근일·유형 / 사유</th>
					<th class="px-3 py-3.5 sm:px-4">상태 / 신청일시</th>
					<th class="px-4 py-3.5 text-right">상태 관리</th>
				</tr>
			</thead>
			<!-- 인쇄용 공식 대장 헤더 -->
			<thead
				class="hidden border-b border-slate-300 bg-slate-100 text-xs font-bold tracking-wider text-slate-700 print:table-header-group"
			>
				<tr>
					<th class="w-12 px-2 py-2.5 text-center">번호</th>
					<th class="px-2 py-2.5">성명 / 부서</th>
					<th class="px-2 py-2.5">운영 방식</th>
					<th class="px-2 py-2.5">결근·휴무일</th>
					<th class="px-2 py-2.5">유형</th>
					<th class="px-2 py-2.5">상태</th>
					<th class="px-2 py-2.5">사유 (메모)</th>
					<th class="px-2 py-2.5">신청 일시</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100 print:hidden">
				{#if loading}
					<tr>
						<td colspan="5" class="py-16 text-center">
							<span class="loading loading-lg loading-bars text-blue-600"></span>
						</td>
					</tr>
				{:else if pagedRecordList.length === 0}
					<tr>
						<td colspan="5" class="py-16 text-center">
							<Icon
								icon="solar:document-text-bold-duotone"
								class="mx-auto mb-2 text-4xl text-slate-200"
							/>
							<p class="text-sm font-black text-slate-400">조건에 해당하는 결근 내역이 없습니다.</p>
						</td>
					</tr>
				{:else}
					{#each pagedRecordList as d, idx (d.id)}
						{@const rowNum =
							filteredRecordList.length -
							((recordPageSize > 0
								? (Math.min(recordPage, recordTotalPages) - 1) * recordPageSize
								: 0) +
								idx)}
						<tr class="transition-colors hover:bg-slate-50">
							<td
								class="hidden px-4 py-3.5 text-center font-mono text-xs font-bold text-slate-400 md:table-cell"
							>
								{rowNum}
							</td>
							<td class="px-4 py-3.5">
								<div class="space-y-0.5">
									<div class="flex flex-wrap items-center gap-1.5">
										<span class="font-black text-slate-900">{d.real_name || d.username}</span>
										<span
											class="rounded-full border px-2 py-0.5 text-[9px] font-black {d.work_type ===
											'FCFS'
												? 'border-emerald-200 bg-emerald-50 text-emerald-700'
												: 'border-blue-200 bg-blue-50 text-blue-700'}"
										>
											{getDayoffWorkTypeLabel(d.work_type)}
										</span>
									</div>
									<div class="text-[11px] font-bold text-slate-400">
										{d.primary_group || '미지정'} · Lv.{d.rank_level ?? 0}
									</div>
								</div>
							</td>
							<td class="px-3 py-3.5 sm:px-4">
								<div class="space-y-0.5">
									<div class="flex flex-wrap items-center gap-1.5">
										<span class="font-mono text-xs font-black text-slate-800">{d.date}</span>
										<span
											class="rounded-md border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-black text-slate-700"
										>
											{getDayoffTypeLabel(d.type)}
										</span>
									</div>
									<div
										class="max-w-[160px] truncate text-[11px] text-slate-500 sm:max-w-[240px]"
										title={d.memo || ''}
									>
										{d.memo || '사유 없음'}
									</div>
								</div>
							</td>
							<td class="px-3 py-3.5 sm:px-4">
								<div class="space-y-1">
									<div>
										<span
											class="rounded-md border px-2 py-0.5 text-[10px] font-black {getDayoffBadgeClass(
												d.status
											)}"
										>
											{getDayoffStatusLabel(d.status)}
										</span>
									</div>
									<div class="font-mono text-[10px] text-slate-400">
										{formatDateTime(d.create_date)}
									</div>
								</div>
							</td>
							<td class="px-4 py-3.5 text-right">
								<div class="flex flex-wrap justify-end gap-1.5">
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

			<tbody class="hidden divide-y divide-slate-200 print:table-row-group">
				{#each filteredRecordList as d, idx (d.id)}
					<tr class="break-inside-avoid">
						<td class="px-2 py-2 text-center font-mono text-[11px] text-slate-600">
							{filteredRecordList.length - idx}
						</td>
						<td class="px-2 py-2">
							<div class="font-bold text-slate-900">{d.real_name || d.username}</div>
							<div class="text-[10px] text-slate-500">{d.primary_group || '미지정'}</div>
						</td>
						<td class="px-2 py-2 text-[11px] text-slate-700">
							{getDayoffWorkTypeLabel(d.work_type)}
						</td>
						<td class="px-2 py-2 font-mono text-[11px] font-bold text-slate-900">{d.date}</td>
						<td class="px-2 py-2 text-[11px] text-slate-800">{getDayoffTypeLabel(d.type)}</td>
						<td class="px-2 py-2 text-[11px] font-bold text-slate-800">
							{getDayoffStatusLabel(d.status)}
						</td>
						<td class="px-2 py-2 text-[11px] text-slate-700">{d.memo || '-'}</td>
						<td class="px-2 py-2 font-mono text-[10px] text-slate-500">
							{formatDateTime(d.create_date)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if recordPageSize > 0 && recordTotalPages > 1}
		<div
			class="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-6 py-4 print:hidden"
		>
			<span class="text-xs font-bold text-slate-500">
				총 {filteredRecordList.length}건 중 {Math.min(recordPage, recordTotalPages)} / {recordTotalPages}
				페이지
			</span>
			<div class="flex items-center gap-1.5">
				<button
					type="button"
					onclick={() => (recordPage = 1)}
					disabled={recordPage <= 1}
					class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
				>
					처음
				</button>
				<button
					type="button"
					onclick={() => (recordPage = Math.max(1, recordPage - 1))}
					disabled={recordPage <= 1}
					class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
				>
					이전
				</button>
				<span class="px-2 text-xs font-black text-blue-600">
					{Math.min(recordPage, recordTotalPages)} / {recordTotalPages}
				</span>
				<button
					type="button"
					onclick={() => (recordPage = Math.min(recordTotalPages, recordPage + 1))}
					disabled={recordPage >= recordTotalPages}
					class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
				>
					다음
				</button>
				<button
					type="button"
					onclick={() => (recordPage = recordTotalPages)}
					disabled={recordPage >= recordTotalPages}
					class="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-black text-slate-600 transition hover:bg-slate-100 disabled:opacity-40"
				>
					마지막
				</button>
			</div>
		</div>
	{/if}
</div>
