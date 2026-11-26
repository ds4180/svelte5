<script lang="ts">
	/**
	 * ============================================================================
	 * [통합 관제 — 실시간 세션 & 과거 접속 이력 탭 (ObservabilitySessionsTab.svelte)]
	 * ============================================================================
	 * - 모바일 카드 리스트(< md) + 데스크톱 테이블(md 이상) 반응형 레이아웃 지원
	 * - 설정된 ui_session_history_limit를 동적 표기하며, canWrite 권한 보유 시에만 추방 버튼 노출
	 */
	import Icon from '@iconify/svelte';
	import {
		getDeviceBadge,
		getSessionStatusBadge,
		type LiveSessionItem
	} from '$lib/services/observabilityAdminService';
	import { formatDateTime, timeAgo } from '$lib/utils';

	interface Props {
		sessions: LiveSessionItem[];
		activeSessionsCount: number;
		includeHistory: boolean;
		historyLimit: number;
		isLoading: boolean;
		canWrite: boolean;
		onToggleHistory: (nextInclude: boolean) => void;
		onRequestKick: (session: LiveSessionItem) => void;
	}

	let {
		sessions = [],
		activeSessionsCount = 0,
		includeHistory = false,
		historyLimit = 100,
		isLoading = false,
		canWrite = false,
		onToggleHistory,
		onRequestKick
	}: Props = $props();
</script>

<!-- 세션 관제 모드 컨트롤 바 -->
<div class="flex flex-col gap-3 border-b border-slate-100 bg-white p-4 md:flex-row md:items-center md:justify-between">
	<div class="flex flex-wrap items-center gap-3">
		<span class="text-xs font-bold text-slate-500">세션 관제 모드:</span>
		<div class="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
			<button
				type="button"
				onclick={() => onToggleHistory(false)}
				class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition {!includeHistory ? 'bg-white text-emerald-700 shadow-2xs border border-emerald-200' : 'text-slate-500 hover:text-slate-800'}"
			>
				<span class="h-2 w-2 rounded-full bg-emerald-500 {!includeHistory ? 'animate-pulse' : ''}"></span>
				실시간 활성 세션 ({activeSessionsCount})
			</button>
			<button
				type="button"
				onclick={() => onToggleHistory(true)}
				class="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition {includeHistory ? 'bg-white text-blue-700 shadow-2xs border border-blue-200' : 'text-slate-500 hover:text-slate-800'}"
			>
				<Icon icon="solar:history-bold-duotone" class="text-sm text-blue-600" />
				과거 접속 기록 포함 (최대 {historyLimit}건)
			</button>
		</div>
	</div>

	<div class="text-xs font-bold text-slate-400">
		{#if includeHistory}
			과거 만료·추방 세션 포함 <span class="font-black text-blue-600">{sessions.length}</span>건 표시 중
		{:else}
			현재 실시간 접속 중인 <span class="font-black text-emerald-600">{sessions.length}</span>개 세션 관제 중
		{/if}
	</div>
</div>

{#if isLoading}
	<div class="flex flex-col items-center justify-center py-20 text-slate-400">
		<Icon icon="solar:refresh-circle-bold-duotone" class="h-10 w-10 animate-spin text-blue-600" />
		<span class="mt-3 text-xs font-bold">실시간 세션 데이터를 동기화하는 중입니다...</span>
	</div>
{:else if sessions.length === 0}
	<div class="py-20 text-center text-slate-400 px-4">
		<Icon icon="solar:ghost-bold" class="mx-auto h-12 w-12 text-slate-300" />
		<p class="mt-2 text-sm font-bold">
			{includeHistory ? '보존된 접속 기록이 없습니다.' : '현재 활성화된 접속 세션이 없습니다.'}
		</p>
	</div>
{:else}
	<!-- 📱 모바일 카드 리스트 (< md) -->
	<div class="md:hidden divide-y divide-slate-100">
		{#each sessions as s (s.id)}
			{@const devBadge = getDeviceBadge(s.device_category)}
			{@const statusBadge = getSessionStatusBadge(s.status)}
			<div class="p-4 space-y-3 bg-white">
				<div class="flex items-start justify-between gap-2">
					<div class="flex items-center gap-2.5 min-w-0">
						<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-black text-slate-700">
							{(s.real_name || s.user_name || s.username || '?')[0]}
						</div>
						<div class="min-w-0">
							<div class="flex items-center gap-1.5 text-xs font-black text-slate-900">
								<span class="truncate">{s.real_name || s.user_name || '이름 없음'}</span>
								<span class="font-normal text-slate-400">(@{s.username})</span>
							</div>
							<div class="text-[11px] text-slate-500 truncate">
								{s.primary_group || s.department || '소속 미정'} · <span class="font-mono">{s.ip_address || '-'}</span>
							</div>
						</div>
					</div>
					<span class="shrink-0 inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-black {statusBadge.color}">
						<span class="h-1.5 w-1.5 rounded-full {statusBadge.dot}"></span>
						{statusBadge.text}
					</span>
				</div>

				<div class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2 text-[11px] border border-slate-100">
					<div class="flex items-center gap-1.5">
						<span class="inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-bold {devBadge.color}">
							<Icon icon={devBadge.icon} class="text-xs" />
							{devBadge.text}
						</span>
						{#if s.device_name}
							<span class="text-[10px] font-semibold text-slate-600">{s.device_name}</span>
						{/if}
					</div>
					<div class="text-[10px] text-slate-500 font-mono">
						{s.status === 'ACTIVE'
							? `활동 ${timeAgo(s.last_activity)}`
							: `종료 ${timeAgo(s.logout_at || s.last_activity)}`}
					</div>
				</div>

				{#if s.status === 'ACTIVE' && canWrite}
					<div class="flex justify-end">
						<button
							type="button"
							onclick={() => onRequestKick(s)}
							class="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-600 hover:text-white transition"
						>
							<Icon icon="solar:shield-cross-bold" class="text-sm" />
							강제 추방
						</button>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- 🖥️ 데스크톱 테이블 (md 이상) -->
	<div class="hidden md:block overflow-x-auto">
		<table class="w-full text-left text-xs">
			<thead class="border-b border-slate-200 bg-slate-50/80 font-black text-slate-500 uppercase tracking-wider">
				<tr>
					<th class="px-5 py-3.5">사용자 / 소속</th>
					<th class="px-4 py-3.5">세션 상태</th>
					<th class="px-4 py-3.5">접속 기기 / 브라우저</th>
					<th class="px-4 py-3.5">접속 IP</th>
					<th class="px-4 py-3.5">최근 활동 / 종료</th>
					<th class="px-4 py-3.5">로그인 시각</th>
					<th class="px-5 py-3.5 text-right">세션 제어</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100 font-medium text-slate-700">
				{#each sessions as s (s.id)}
					{@const devBadge = getDeviceBadge(s.device_category)}
					{@const statusBadge = getSessionStatusBadge(s.status)}
					<tr class="hover:bg-slate-50/80 transition">
						<td class="px-5 py-4">
							<div class="flex items-center gap-3">
								<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-black text-slate-700">
									{(s.real_name || s.user_name || s.username || '?')[0]}
								</div>
								<div>
									<div class="flex items-center gap-1.5 font-black text-slate-900 text-sm">
										{s.real_name || s.user_name || '이름 없음'}
										<span class="text-xs font-normal text-slate-400">(@{s.username})</span>
										{#if s.status === 'ACTIVE'}
											<span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
										{/if}
									</div>
									<div class="text-[11px] text-slate-500 font-normal mt-0.5">
										{s.primary_group || s.department || '소속 미정'}
									</div>
								</div>
							</div>
						</td>
						<td class="px-4 py-4 whitespace-nowrap">
							<span class="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-black {statusBadge.color}">
								<span class="h-1.5 w-1.5 rounded-full {statusBadge.dot}"></span>
								{statusBadge.text}
							</span>
						</td>
						<td class="px-4 py-4">
							<div class="flex items-center gap-2">
								<span class="inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-bold {devBadge.color}">
									<Icon icon={devBadge.icon} class="text-xs" />
									{devBadge.text}
								</span>
								{#if s.device_name}
									<span class="text-[10px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
										{s.device_name}
									</span>
								{/if}
							</div>
							{#if s.user_agent}
								<div class="text-[10px] text-slate-400 truncate max-w-[200px] mt-1" title={s.user_agent}>
									{s.user_agent}
								</div>
							{/if}
						</td>
						<td class="px-4 py-4 font-mono font-bold text-slate-600">
							{s.ip_address || '-'}
						</td>
						<td class="px-4 py-4 whitespace-nowrap">
							{#if s.status === 'ACTIVE'}
								<span class="font-bold text-slate-900">{timeAgo(s.last_activity)}</span>
								<div class="text-[10px] text-slate-400">{formatDateTime(s.last_activity)}</div>
							{:else}
								<div class="font-bold text-slate-500">종료: {timeAgo(s.logout_at || s.last_activity)}</div>
								<div class="text-[10px] text-slate-400">{formatDateTime(s.logout_at || s.last_activity)}</div>
							{/if}
						</td>
						<td class="px-4 py-4 text-slate-500 whitespace-nowrap">
							{formatDateTime(s.login_at)}
						</td>
						<td class="px-5 py-4 text-right whitespace-nowrap">
							{#if s.status === 'ACTIVE'}
								{#if canWrite}
									<button
										type="button"
										onclick={() => onRequestKick(s)}
										class="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 shadow-2xs transition hover:bg-rose-600 hover:text-white active:scale-95"
									>
										<Icon icon="solar:shield-cross-bold" class="text-sm" />
										강제 추방
									</button>
								{:else}
									<span class="text-xs font-medium text-slate-400">읽기 전용</span>
								{/if}
							{:else}
								<span class="text-xs font-medium text-slate-400 px-2 py-1">종료됨</span>
							{/if}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
