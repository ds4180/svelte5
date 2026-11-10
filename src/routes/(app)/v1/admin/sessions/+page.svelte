<script>
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin.js';
	import { formatDateTime } from '$lib/utils';
	import { getSiteTitle } from '$lib/config/site';
	import Icon from '@iconify/svelte';

	let sessions = $state([]);
	let loading = $state(true);

	const activeCount = $derived(sessions.filter((s) => s.status === 'ACTIVE').length);
	const mobileCount = $derived(sessions.filter((s) => s.device_category === 'MOBILE').length);
	const kickedCount = $derived(sessions.filter((s) => s.status === 'KICKED_OUT').length);

	async function loadSessions() {
		loading = true;
		try {
			sessions = await api.adminGetSessions();
		} catch (e) {
			alert('세션 목록을 불러오지 못했습니다: ' + e.message);
		} finally {
			loading = false;
		}
	}

	async function kickSession(sessionId) {
		if (!confirm(`정말 이 세션(ID: ${sessionId})을 강제로 종료하시겠습니까?`)) return;
		try {
			await api.adminKickSession(sessionId);
			alert('세션이 강제로 종료되었습니다.');
			await loadSessions();
		} catch (e) {
			alert('세션 종료 실패: ' + e.message);
		}
	}

	onMount(loadSessions);
</script>

<svelte:head>
	<title>{getSiteTitle('세션 모니터링')}</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 lg:px-8">
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 액션 바 (기본값: 새로고침 + 관리자 홈) -->
	<!-- ===================================================================== -->
	<div class="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between md:border-b-4 md:pb-8">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-widest text-emerald-400 uppercase">
					<span class="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
					System Infrastructure
				</span>
				<span class="text-xs font-bold text-slate-400">v1/admin/sessions</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 uppercase italic md:text-4xl">
				세션 <span class="not-italic text-blue-600">모니터링</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				현재 활성화된 모든 사용자 세션을 실시간으로 확인하고 비정상 세션을 즉시 제어합니다.
			</p>
		</div>

		<!-- 상단 버튼 그룹 (새로고침과 관리자 홈은 필수 기본값) -->
		<div class="flex flex-wrap items-center gap-3">
			<button
				onclick={loadSessions}
				disabled={loading}
				class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
			>
				<Icon icon="solar:restart-bold" class="text-base {loading ? 'animate-spin' : ''}" />
				<span>새로고침</span>
			</button>

			<a
				href="/v1/admin"
				class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
			>
				<Icon icon="solar:home-smile-angle-bold-duotone" class="text-base text-slate-500" />
				<span>관리자 홈</span>
			</a>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 2. 상단 핵심 지표 요약 카드 (Status Cards: 1~4개) -->
	<!-- ===================================================================== -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-3 md:gap-5">
		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Active Sessions</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
					<Icon icon="solar:users-group-rounded-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900">{loading ? '...' : activeCount.toLocaleString()} <span class="text-xs font-normal text-slate-500">명</span></div>
				<div class="mt-1 text-xs font-bold text-emerald-600">접속 활성 중</div>
			</div>
		</div>

		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Mobile Devices</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
					<Icon icon="solar:smartphone-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900">{loading ? '...' : mobileCount.toLocaleString()} <span class="text-xs font-normal text-slate-500">명</span></div>
				<div class="mt-1 text-xs font-bold text-amber-600">모바일 접속 기기</div>
			</div>
		</div>

		<div class="flex flex-col justify-between rounded-[1.75rem] border-2 border-slate-200 bg-white p-5 shadow-sm col-span-2 md:col-span-1">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Kicked Out</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
					<Icon icon="solar:shield-warning-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-3xl font-black text-slate-900">{loading ? '...' : kickedCount.toLocaleString()} <span class="text-xs font-normal text-slate-500">건</span></div>
				<div class="mt-1 text-xs font-bold text-rose-600">강제 추방 이력</div>
			</div>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 3. 전사 공통 탭 바 (최소 1개 일관성 및 확장성) -->
	<!-- ===================================================================== -->
	<div class="flex items-center border-b-2 border-slate-200">
		<button
			type="button"
			class="flex items-center gap-2 border-b-4 border-blue-600 bg-blue-50/50 px-6 py-3 text-xs font-black text-blue-600 rounded-t-2xl transition"
		>
			<Icon icon="solar:user-id-bold-duotone" class="text-base" />
			<span>실시간 활성 세션 목록</span>
		</button>
	</div>

	<!-- 🏛️ [통합 관제 센터 이전 안내 배너] -->
	<div class="flex flex-col md:flex-row items-center justify-between gap-4 rounded-2xl border-2 border-blue-600 bg-blue-50/70 p-4 md:p-5 shadow-sm">
		<div class="flex items-center gap-3">
			<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-md">
				<Icon icon="solar:shield-warning-bold-duotone" class="text-2xl" />
			</div>
			<div>
				<h4 class="text-sm font-black text-slate-900">
					신규 시스템 통합 관제 & 4대 감사로그 센터가 개설되었습니다!
				</h4>
				<p class="text-xs text-slate-600 mt-0.5">
					실시간 세션 강제 추방, 접근 이력, 도메인 Diff-Patch 및 장애·보안 관제를 하나의 통합 관제 센터에서 제공합니다.
				</p>
			</div>
		</div>
		<a
			href="/v1/admin/observability?tab=SESSIONS"
			class="inline-flex shrink-0 items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-black text-white shadow-md transition hover:bg-slate-900 active:scale-95"
		>
			<span>통합 관제 센터로 이동</span>
			<Icon icon="solar:arrow-right-bold" class="text-sm" />
		</a>
	</div>

	<div
		class="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:block md:rounded-[2rem] md:shadow-2xl"
	>
		<table class="table w-full">
			<thead
				class="border-b border-slate-100 bg-slate-50 text-[8px] font-bold tracking-widest text-slate-500 uppercase md:text-[10px]"
			>
				<tr>
					<th class="px-4 py-4 md:px-8 md:py-6">ID (JTI)</th>
					<th>사용자</th>
					<th>디바이스</th>
					<th>상태</th>
					<th>로그인 일시</th>
					<th>마지막 활동</th>
					<th class="px-4 text-right md:px-8">작업</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-50">
				{#if loading}
					<tr
						><td colspan="7" class="py-16 text-center md:py-32"
							><span class="loading loading-lg loading-bars text-blue-600"></span></td
						></tr
					>
				{:else if sessions.length === 0}
					<tr
						><td
							colspan="7"
							class="py-16 text-center text-xl font-bold text-slate-300 italic md:py-32"
							>활성화된 세션이 없습니다.</td
						></tr
					>
				{:else}
					<!-- ✅ {#else} -> {:else} 로 수정 완료 -->
					{#each sessions as session (session.id)}
						<tr class="group transition-colors hover:bg-slate-50/50">
							<td class="px-4 py-3 md:px-8 md:py-5">
								<span
									class="rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-[8px] text-slate-400 transition-colors group-hover:bg-white md:rounded-md md:text-[10px]"
								>
									{session.session_key?.substring(0, 12) || session.id}...
								</span>
							</td>
							<td>
								<div class="flex flex-col">
									<span class="text-sm font-black text-slate-900 md:text-base"
										>{session.username || 'Unknown'}</span
									>
									<span class="text-[8px] font-bold text-slate-400 md:text-[10px]"
										>UID: {session.user_id}</span
									>
								</div>
							</td>
							<td>
								<span
									class="flex items-center gap-1 rounded-md px-2 py-0.5 text-[8px] font-black tracking-tighter md:text-[10px] {session.device_category ===
									'MOBILE'
										? 'bg-amber-100 text-amber-700'
										: 'bg-blue-100 text-blue-700'}"
								>
									<Icon
										icon={session.device_category === 'MOBILE'
											? 'mdi:cellphone'
											: 'mdi:desktop-mac-dashboard'}
										class="h-2 w-2 md:h-3 md:w-3"
									/>
									{session.device_category}
								</span>
							</td>
							<td>
								{#if session.status === 'ACTIVE'}
									<div class="flex items-center gap-1 md:gap-2">
										<span class="relative flex h-1.5 w-1.5 md:h-2 md:w-2">
											<span
												class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
											></span>
											<span
												class="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500 md:h-2 md:w-2"
											></span>
										</span>
										<span class="text-[8px] font-black text-green-600 uppercase md:text-xs"
											>Active</span
										>
									</div>
								{:else if session.status === 'KICKED_OUT'}
									<div class="flex items-center gap-1 md:gap-2">
										<Icon icon="mdi:logout" class="h-3 w-3 text-red-500" />
										<span class="text-[8px] font-bold text-red-500 uppercase md:text-xs"
											>Kicked</span
										>
									</div>
								{:else}
									<span class="text-[8px] font-bold text-slate-300 uppercase italic md:text-xs"
										>{session.status}</span
									>
								{/if}
							</td>
							<td class="text-[8px] font-medium text-slate-500 md:text-xs">
								{formatDateTime(session.login_at)}
							</td>
							<td class="text-[8px] font-medium text-slate-500 md:text-xs">
								{session.logout_at ? formatDateTime(session.logout_at) : '현재 접속 중'}
							</td>
							<td class="px-4 text-right md:px-8">
								{#if session.status === 'ACTIVE'}
									<button
										class="btn rounded-lg px-2 font-black text-red-500 btn-ghost btn-xs hover:bg-red-50 hover:text-red-700 md:rounded-xl md:px-4 md:btn-sm"
										onclick={() => kickSession(session.id)}
									>
										<Icon icon="mdi:power-plug-off-outline" class="h-3 w-3" />
										KICK
									</button>
								{/if}
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<div class="space-y-4 sm:hidden">
		{#if loading}
			<div class="py-16 text-center">
				<span class="loading loading-lg loading-bars text-blue-600"></span>
			</div>
		{:else if sessions.length === 0}
			<div class="py-16 text-center text-xl font-bold text-slate-300 italic">
				활성화된 세션이 없습니다.
			</div>
		{:else}
			{#each sessions as session (session.id)}
				<div class="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-2">
							<span class="text-base font-black text-slate-900"
								>{session.username || 'Unknown'}</span
							>
							<span class="text-[10px] font-bold text-slate-400">UID: {session.user_id}</span>
						</div>
						<span
							class="rounded-md px-2 py-0.5 text-[8px] font-black tracking-tighter {session.device_category ===
							'MOBILE'
								? 'bg-amber-100 text-amber-700'
								: 'bg-blue-100 text-blue-700'}"
						>
							<Icon
								icon={session.device_category === 'MOBILE'
									? 'mdi:cellphone'
									: 'mdi:desktop-mac-dashboard'}
								class="mr-1 inline-block h-3 w-3 align-middle"
							/>
							{session.device_category}
						</span>
					</div>

					<div class="flex justify-between text-xs text-slate-500">
						<span
							><span class="font-semibold">로그인:</span> {formatDateTime(session.login_at)}</span
						>
						<span>
							{#if session.status === 'ACTIVE'}
								<span class="flex items-center gap-1 font-black text-green-600 uppercase">
									<span class="relative flex h-2 w-2">
										<span
											class="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"
										></span>
										<span class="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
									</span>
									Active
								</span>
							{:else if session.status === 'KICKED_OUT'}
								<span class="flex items-center gap-1 font-bold text-red-500 uppercase">
									<Icon icon="mdi:logout" class="h-3 w-3" />
									Kicked
								</span>
							{:else}
								<span class="font-bold text-slate-300 uppercase italic">{session.status}</span>
							{/if}
						</span>
					</div>
					<div class="flex justify-between text-xs text-slate-500">
						<span
							><span class="font-semibold">종료:</span>
							{session.logout_at ? formatDateTime(session.logout_at) : '현재 접속 중'}</span
						>
						<div class="text-right">
							{#if session.status === 'ACTIVE'}
								<button
									class="btn rounded-lg px-2 font-black text-red-500 btn-ghost btn-xs hover:bg-red-50 hover:text-red-700"
									onclick={() => kickSession(session.id)}
								>
									<Icon icon="mdi:power-plug-off-outline" class="h-3 w-3" />
									KICK
								</button>
							{/if}
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.animate-fade-in {
		animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}
</style>
