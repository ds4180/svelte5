<script lang="ts">
	/**
	 * ============================================================================
	 * [통합 관제 — 전사 감사로그 필터·목록 탭 (ObservabilityLogsTab.svelte)]
	 * ============================================================================
	 * - 앱/심각도/키워드 필터, 정책 기반 CSV 내보내기 버튼,
	 *   모바일 카드 리스트(< md) + 데스크톱 테이블(md 이상) 및 페이지네이션을 제공합니다.
	 */
	import Icon from '@iconify/svelte';
	import {
		getSeverityBadge,
		type AuditLogItem,
		type ObservabilitySettings
	} from '$lib/services/observabilityAdminService';
	import { formatDateTime, timeAgo } from '$lib/utils';

	interface Props {
		logs: AuditLogItem[];
		totalCount: number;
		currentPage: number;
		pageSize: number;
		isLoading: boolean;
		appOptions: Array<{ id: string; label: string }>;
		appFilter: string;
		severityFilter: string;
		searchKeyword: string;
		settings: ObservabilitySettings;
		onAppFilterChange: (nextApp: string) => void;
		onSeverityFilterChange: (nextSeverity: string) => void;
		onSearchSubmit: (keyword: string) => void;
		onPageChange: (nextPage: number) => void;
		onExportCsv: () => void;
		onOpenDiff: (log: AuditLogItem) => void;
		onOpenDetail: (log: AuditLogItem) => void;
	}

	let {
		logs = [],
		totalCount = 0,
		currentPage = 1,
		pageSize = 20,
		isLoading = false,
		appOptions = [],
		appFilter = '',
		severityFilter = '',
		searchKeyword = '',
		settings,
		onAppFilterChange,
		onSeverityFilterChange,
		onSearchSubmit,
		onPageChange,
		onExportCsv,
		onOpenDiff,
		onOpenDetail
	}: Props = $props();

	let localKeyword = $state('');

	$effect(() => {
		localKeyword = searchKeyword;
	});

	const totalPages = $derived(Math.max(1, Math.ceil(totalCount / Math.max(1, pageSize))));
</script>

<!-- 필터 & 검색 컨트롤 바 -->
<div class="flex flex-col gap-3 border-b border-slate-100 bg-white p-4 lg:flex-row lg:items-center lg:justify-between">
	<div class="flex flex-wrap items-center gap-2.5">
		<div class="flex items-center gap-1.5">
			<span class="text-xs font-bold text-slate-500">앱:</span>
			<select
				value={appFilter}
				onchange={(e) => onAppFilterChange(e.currentTarget.value)}
				class="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
			>
				{#each appOptions as opt (opt.id)}
					<option value={opt.id}>{opt.label}</option>
				{/each}
			</select>
		</div>

		<div class="flex items-center gap-1.5">
			<span class="text-xs font-bold text-slate-500">심각도:</span>
			<select
				value={severityFilter}
				onchange={(e) => onSeverityFilterChange(e.currentTarget.value)}
				class="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-none"
			>
				<option value="">전체 등급</option>
				<option value="INFO">INFO (일반)</option>
				<option value="WARN">WARN (주의)</option>
				<option value="ERROR">ERROR (오류)</option>
				<option value="CRITICAL">CRITICAL (치명)</option>
			</select>
		</div>

		<div class="flex items-center gap-1.5 w-full sm:w-auto">
			<div class="relative flex-1 sm:flex-none">
				<Icon icon="solar:magnifer-linear" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400" />
				<input
					type="text"
					bind:value={localKeyword}
					onkeydown={(e) => e.key === 'Enter' && onSearchSubmit(localKeyword)}
					placeholder="제목, 내용, 행위, 사용자 검색..."
					class="w-full sm:w-56 rounded-xl border border-slate-300 bg-slate-50 py-1.5 pr-8 pl-8 text-xs font-medium text-slate-800 placeholder-slate-400 transition focus:border-blue-500 focus:bg-white focus:outline-none"
				/>
				{#if localKeyword}
					<button
						type="button"
						onclick={() => {
							localKeyword = '';
							onSearchSubmit('');
						}}
						class="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-slate-400 hover:text-slate-600"
						aria-label="검색어 지우기"
					>
						<Icon icon="solar:close-circle-bold" class="text-sm" />
					</button>
				{/if}
			</div>
			<button
				type="button"
				onclick={() => onSearchSubmit(localKeyword)}
				class="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-blue-600 active:scale-95"
			>
				검색
			</button>
		</div>
	</div>

	<div class="flex flex-wrap items-center justify-between lg:justify-end gap-3">
		<div class="text-xs font-bold text-slate-400">
			총 <span class="font-black text-blue-600">{totalCount.toLocaleString()}</span>건 보존 중
		</div>

		{#if settings.allow_csv_export}
			<button
				type="button"
				onclick={onExportCsv}
				class="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-1.5 text-xs font-black text-emerald-800 shadow-2xs transition hover:bg-emerald-600 hover:text-white active:scale-95"
				title="현재 필터 조건의 감사로그를 최대 {settings.csv_export_max_rows.toLocaleString()}건까지 CSV로 내보냅니다"
			>
				<Icon icon="solar:file-download-bold-duotone" class="text-base" />
				<span>CSV 내보내기</span>
			</button>
		{/if}
	</div>
</div>

{#if isLoading}
	<div class="flex flex-col items-center justify-center py-20 text-slate-400">
		<Icon icon="solar:refresh-circle-bold-duotone" class="h-10 w-10 animate-spin text-blue-600" />
		<span class="mt-3 text-xs font-bold">감사로그 데이터를 조회하는 중입니다...</span>
	</div>
{:else if logs.length === 0}
	<div class="py-20 text-center text-slate-400 px-4">
		<Icon icon="solar:clipboard-list-broken" class="mx-auto h-12 w-12 text-slate-300" />
		<p class="mt-2 text-sm font-bold">조건에 해당하는 감사로그 기록이 없습니다.</p>
	</div>
{:else}
	<!-- 📱 모바일 카드 리스트 (< md) -->
	<div class="md:hidden divide-y divide-slate-100">
		{#each logs as log (log.id)}
			<div class="p-4 space-y-2.5 bg-white">
				<div class="flex items-start justify-between gap-2">
					<div class="flex flex-wrap items-center gap-1.5">
						<span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-700 uppercase">
							{log.app_id || 'system'}
						</span>
						<span class="rounded-md border px-2 py-0.5 text-[10px] font-black {getSeverityBadge(log.severity)}">
							{log.severity}
						</span>
						<span class="font-mono text-[11px] font-bold text-blue-700">{log.action}</span>
					</div>
					<span class="shrink-0 text-[10px] text-slate-400">{timeAgo(log.created_at)}</span>
				</div>

				<div>
					<div class="text-xs font-black text-slate-900">{log.title}</div>
					{#if log.message}
						<div class="mt-0.5 text-[11px] text-slate-500 line-clamp-2">{log.message}</div>
					{/if}
				</div>

				<div class="flex items-center justify-between gap-2 pt-1">
					<div class="text-[11px] text-slate-500 truncate">
						{log.user_summary || (log.user_id ? `사용자 #${log.user_id}` : '시스템')}
						{#if log.ip_address}
							· <span class="font-mono text-[10px]">{log.ip_address}</span>
						{/if}
					</div>
					<div class="shrink-0">
						{#if log.diff_payload && log.diff_payload.length > 0}
							<button
								type="button"
								onclick={() => onOpenDiff(log)}
								class="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-[11px] font-bold text-amber-800"
							>
								<Icon icon="solar:git-commit-bold" class="text-xs" />
								Diff ({log.diff_payload.length})
							</button>
						{:else}
							<button
								type="button"
								onclick={() => onOpenDetail(log)}
								class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-700"
							>
								상세
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/each}
	</div>

	<!-- 🖥️ 데스크톱 테이블 (md 이상) -->
	<div class="hidden md:block overflow-x-auto">
		<table class="w-full text-left text-xs">
			<thead class="border-b border-slate-200 bg-slate-50/80 font-black text-slate-500 uppercase tracking-wider">
				<tr>
					<th class="px-5 py-3.5">발생 일시</th>
					<th class="px-4 py-3.5">앱 / 분류</th>
					<th class="px-4 py-3.5">심각도</th>
					<th class="px-4 py-3.5">행위 (Action)</th>
					<th class="px-4 py-3.5">작업 수행자</th>
					<th class="px-4 py-3.5">상세 내용</th>
					<th class="px-5 py-3.5 text-right">상세 보기</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100 font-medium text-slate-700">
				{#each logs as log (log.id)}
					<tr class="hover:bg-slate-50/80 transition">
						<td class="px-5 py-4 whitespace-nowrap">
							<div class="font-bold text-slate-900">{timeAgo(log.created_at)}</div>
							<div class="text-[10px] text-slate-400">{formatDateTime(log.created_at)}</div>
						</td>
						<td class="px-4 py-4 whitespace-nowrap">
							<span class="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-black text-slate-700 uppercase">
								{log.app_id || 'system'}
							</span>
						</td>
						<td class="px-4 py-4 whitespace-nowrap">
							<span class="inline-block rounded-md border px-2 py-0.5 text-[10px] font-black {getSeverityBadge(log.severity)}">
								{log.severity}
							</span>
						</td>
						<td class="px-4 py-4 whitespace-nowrap">
							<span class="font-mono font-bold text-blue-700">{log.action}</span>
						</td>
						<td class="px-4 py-4">
							{#if log.user_summary}
								<div class="font-bold text-slate-900">{log.user_summary}</div>
							{:else if log.user_id}
								<div class="font-bold text-slate-700">사용자 #{log.user_id}</div>
							{:else}
								<div class="text-slate-400 font-normal">시스템 (익명)</div>
							{/if}
							{#if log.ip_address}
								<div class="text-[10px] font-mono text-slate-400">{log.ip_address}</div>
							{/if}
						</td>
						<td class="px-4 py-4 max-w-md">
							<div class="font-bold text-slate-900 truncate" title={log.title}>
								{log.title}
							</div>
							{#if log.message}
								<div class="text-[11px] text-slate-500 line-clamp-1 mt-0.5 font-normal" title={log.message}>
									{log.message}
								</div>
							{/if}
						</td>
						<td class="px-5 py-4 text-right whitespace-nowrap">
							{#if log.diff_payload && log.diff_payload.length > 0}
								<button
									type="button"
									onclick={() => onOpenDiff(log)}
									class="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 transition hover:bg-amber-500 hover:text-white"
								>
									<Icon icon="solar:git-commit-bold" class="text-sm" />
									Diff ({log.diff_payload.length})
								</button>
							{:else if log.log_type === 'ERROR' || log.severity === 'ERROR' || log.severity === 'CRITICAL'}
								<button
									type="button"
									onclick={() => onOpenDetail(log)}
									class="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-800 transition hover:bg-rose-600 hover:text-white"
								>
									<Icon icon="solar:danger-bold" class="text-sm" />
									오류 상세
								</button>
							{:else}
								<button
									type="button"
									onclick={() => onOpenDetail(log)}
									class="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 transition hover:bg-slate-100"
								>
									상세보기
								</button>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- 페이지네이션 -->
	{#if totalCount > pageSize}
		<div class="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50 px-5 py-3">
			<div class="text-xs text-slate-500">
				총 {totalCount.toLocaleString()}건 중 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, totalCount)}건 표시
			</div>
			<div class="flex items-center gap-2">
				<button
					type="button"
					disabled={currentPage <= 1}
					onclick={() => onPageChange(currentPage - 1)}
					class="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
				>
					이전
				</button>
				<span class="text-xs font-black text-slate-700">
					{currentPage} / {totalPages}
				</span>
				<button
					type="button"
					disabled={currentPage >= totalPages}
					onclick={() => onPageChange(currentPage + 1)}
					class="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
				>
					다음
				</button>
			</div>
		</div>
	{/if}
{/if}
