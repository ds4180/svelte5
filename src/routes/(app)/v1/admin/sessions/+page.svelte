<script>
	import { onMount } from 'svelte';
	import * as api from '$lib/api/admin.js';
	import Icon from '@iconify/svelte';

	let sessions = $state([]);
	let loading = $state(true);

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

	function formatDateTime(dateString) {
		if (!dateString) return '-';
		return new Date(dateString).toLocaleString('ko-KR', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		});
	}
</script>

<div
	class="animate-fade-in mx-auto max-w-7xl space-y-6 px-4 pb-20 font-['Noto_Sans_KR','Outfit'] md:space-y-10 md:px-6 md:pb-40 lg:px-8"
>
	<div
		class="flex flex-col items-start justify-between gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:gap-6 md:border-b-4 md:pb-8"
	>
		<div>
			<span
				class="mb-1 block text-[8px] font-black tracking-[0.2em] text-slate-400 uppercase md:mb-2 md:text-[10px] md:tracking-[0.4em]"
				>System Infrastructure</span
			>
			<h1 class="text-3xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
				세션 <span class="NOT-ITALIC text-blue-600"
					>모니터링 <Icon
						icon="mdi:monitor-lock-outline"
						class="ml-1 inline-block align-text-bottom text-blue-600"
					/></span
				>
			</h1>
			<p class="mt-2 text-xs font-bold text-slate-500 md:mt-3 md:text-sm">
				현재 활성화된 모든 사용자 세션을 실시간으로 확인하고 제어합니다.
			</p>
		</div>
		<div class="flex gap-2 md:gap-4">
			<a
				href="/v1/admin"
				class="btn rounded-lg border-none bg-slate-200 px-4 font-black text-slate-700 shadow-md transition-all btn-sm hover:bg-slate-300 md:rounded-2xl md:px-8 md:shadow-xl md:btn-lg"
			>
				<Icon icon="mdi:home-outline" class="h-4 w-4 md:h-6 md:w-6" />
				홈으로
			</a>
			<button
				class="btn rounded-lg border-none bg-slate-900 px-4 font-black text-white shadow-md transition-all btn-sm hover:bg-slate-800 md:rounded-2xl md:px-8 md:shadow-xl md:btn-lg"
				onclick={loadSessions}
				disabled={loading}
			>
				{#if loading}
					<span class="loading loading-spinner"></span>
				{:else}
					<Icon icon="mdi:refresh" class="h-4 w-4 md:h-6 md:w-6" />
					목록 새로고침
				{/if}
			</button>
		</div>
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
