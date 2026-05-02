<script>
	/**
	 * @file (app)/v1/admin/user-manage/+page.svelte
	 * @description [v2.5] 사용자 관리 및 등급 제어 시스템
	 */
	import { onMount } from 'svelte';
	import { fade, fly } from 'svelte/transition';
	import * as api from '$lib/api/admin.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import Icon from '@iconify/svelte';

	let users = $state([]);
	let loading = $state(true);
	let searchQuery = $state('');

	// 🔍 검색 필터링된 유저 목록
	let filteredUsers = $derived(
		users.filter(u => 
			u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(u.real_name && u.real_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
			u.email.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	async function loadUsers() {
		loading = true;
		try {
			users = await api.adminGetUsers();
		} catch (e) {
			alertState.send(e.message, { level: 3, style: 'error' });
		} finally {
			loading = false;
		}
	}

	async function changeRank(userId, newRank) {
		try {
			const res = await api.adminUpdateUserRank(userId, newRank);
			if (res.message === 'success') {
				// 로컬 상태 즉시 업데이트
				users = users.map(u => {
					if (u.id === userId) {
						return { ...u, profile: { ...u.profile, rank_level: newRank } };
					}
					return u;
				});
				alertState.send(`${res.username}님의 등급이 ${newRank}(으)로 변경되었습니다.`, { level: 1, style: 'success' });
			}
		} catch (e) {
			alertState.send(e.message, { level: 3, style: 'error' });
		}
	}

	onMount(loadUsers);

	const rankLevels = [
		{ val: 0, label: '0: 신규/제한', color: 'badge-ghost' },
		{ val: 1, label: '1: 정회원', color: 'badge-info' },
		{ val: 2, label: '2: 우수회원', color: 'badge-success' },
		{ val: 3, label: '3: 부관리자', color: 'badge-warning' },
		{ val: 4, label: '4: 총관리자', color: 'badge-error' }
	];

	function getRankInfo(level) {
		return rankLevels.find(r => r.val === level) || { val: level, label: `Lv.${level}`, color: 'badge-ghost' };
	}
</script>

<div class="animate-fade-in mx-auto max-w-7xl space-y-8 px-4 pb-20 font-['Outfit','Noto_Sans_KR']">
	<!-- 📄 헤더 -->
	<div class="flex flex-col items-start justify-between gap-4 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end">
		<div>
			<span class="mb-2 block text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase">User Protocol</span>
			<h1 class="text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-6xl">
				사용자 <span class="NOT-ITALIC text-emerald-600">관리</span>
			</h1>
			<p class="mt-3 text-sm font-bold text-slate-500">
				회원들의 시스템 접근 권한 및 랭크를 실시간으로 조정합니다.
			</p>
		</div>
		<div class="flex w-full gap-2 md:w-auto">
			<div class="relative flex-1 md:w-64">
				<Icon icon="mdi:magnify" class="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="유저명, 아이디, 이메일 검색..."
					class="input input-bordered w-full rounded-xl pl-10 font-bold focus:border-emerald-500"
				/>
			</div>
			<button class="btn btn-square rounded-xl bg-slate-900 text-white hover:bg-slate-800" onclick={loadUsers}>
				<Icon icon="mdi:refresh" class={loading ? 'animate-spin' : ''} />
			</button>
		</div>
	</div>

	<!-- 📊 유저 리스트 테이블 -->
	<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
		<table class="table table-zebra w-full font-bold">
			<thead class="bg-slate-50 text-[10px] font-black tracking-widest text-slate-400 uppercase">
				<tr>
					<th class="w-20 text-center">ID</th>
					<th>사용자 정보</th>
					<th>이메일</th>
					<th class="text-center">현재 등급</th>
					<th class="text-center">권한 변경</th>
				</tr>
			</thead>
			<tbody>
				{#if loading}
					<tr>
						<td colspan="5" class="py-20 text-center">
							<span class="loading loading-spinner loading-lg text-emerald-500"></span>
							<p class="mt-4 text-xs font-black text-slate-400 uppercase italic">Loading database...</p>
						</td>
					</tr>
				{:else if filteredUsers.length === 0}
					<tr>
						<td colspan="5" class="py-20 text-center text-slate-400 italic">
							검색 결과가 없습니다.
						</td>
					</tr>
				{:else}
					{#each filteredUsers as user (user.id)}
						{@const rank = getRankInfo(user.profile?.rank_level || 0)}
						<tr in:fade={{ duration: 200 }} class="hover:bg-slate-50/50">
							<td class="text-center text-xs font-black text-slate-400">{user.id}</td>
							<td>
								<div class="flex items-center gap-3">
									<div class="avatar placeholder">
										<div class="w-10 rounded-xl bg-slate-100 text-slate-400">
											<Icon icon="mdi:account" class="text-xl" />
										</div>
									</div>
									<div>
										<div class="text-sm font-black text-slate-900">{user.real_name || '미지정'}</div>
										<div class="text-[10px] text-slate-400">@{user.username}</div>
									</div>
								</div>
							</td>
							<td class="text-xs text-slate-500">{user.email}</td>
							<td class="text-center">
								<div class="badge {rank.color} h-7 rounded-lg border-none px-3 text-[10px] font-black shadow-sm">
									{rank.label}
								</div>
							</td>
							<td class="text-center">
								<div class="dropdown dropdown-end dropdown-hover">
									<div tabindex="0" role="button" class="btn btn-ghost btn-sm rounded-lg border border-slate-200 text-xs">
										변경 <Icon icon="mdi:chevron-down" />
									</div>
									<ul tabindex="0" class="dropdown-content z-[1] menu w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
										{#each rankLevels as r}
											<li>
												<button 
													onclick={() => changeRank(user.id, r.val)}
													class="flex items-center justify-between text-xs font-bold {user.profile?.rank_level === r.val ? 'bg-emerald-50 text-emerald-600' : ''}"
												>
													{r.label}
													{#if user.profile?.rank_level === r.val}
														<Icon icon="mdi:check" />
													{/if}
												</button>
											</li>
										{/each}
									</ul>
								</div>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<!-- 💡 하단 도움말 -->
	<div class="rounded-2xl border border-blue-100 bg-blue-50/50 p-6">
		<h4 class="mb-2 flex items-center gap-2 text-sm font-black text-blue-900">
			<Icon icon="mdi:information-outline" class="text-lg" />
			랭크 가이드 (Standard v2.0)
		</h4>
		<ul class="space-y-1 text-xs font-bold leading-relaxed text-blue-800/70">
			<li>• <span class="text-blue-900">Rank 0</span>: 가입 대기 또는 활동이 일시적으로 제한된 계정입니다.</li>
			<li>• <span class="text-blue-900">Rank 1~2</span>: 일반 서비스 이용이 가능한 정회원/우수회원 등급입니다.</li>
			<li>• <span class="text-blue-900">Rank 3~4</span>: 게시판 관리 및 시스템 전반에 대한 설정 권한을 가집니다.</li>
		</ul>
	</div>
</div>

<style>
	:global(body) {
		background-color: #f8fafc;
	}
	.animate-fade-in {
		animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
