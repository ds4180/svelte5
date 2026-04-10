<script>
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import * as api from '$lib/api/admin.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import Icon from '@iconify/svelte';

	let subscriptions = $state([]);
	let loading = $state(true);
	let showSendModal = $state(false);
	
	let pushData = $state({
		title: '📢 jeju.live 공지',
		body: '',
		url: '/'
	});

	async function loadSubscriptions() {
		loading = true;
		try {
			subscriptions = await api.adminGetPushSubscriptions();
		} catch (e) {
			alertState.send('구독 목록 로드 실패: ' + e.message, { level: 3, style: 'error' });
		} finally {
			loading = false;
		}
	}

	async function sendPush() {
		if (!pushData.body) {
			alert('메시지 본문을 입력해주세요.');
			return;
		}

		try {
			const result = await api.adminSendPush(pushData);
			alertState.send(`${result.sent_count}개의 기기에 푸시를 발송했습니다.`, { level: 2, style: 'success' });
			showSendModal = false;
			pushData.body = '';
		} catch (e) {
			alertState.send(e.message, { level: 3, style: 'error' });
		}
	}

	async function deleteSubscription(id) {
		if (!confirm('정말 이 구독 정보를 삭제하시겠습니까? (더 이상 알림이 가지 않습니다)')) return;
		try {
			await api.adminDeletePushSubscription(id);
			alertState.send('구독 정보가 삭제되었습니다.', { level: 2, style: 'info' });
			await loadSubscriptions();
		} catch (e) {
			alertState.send(e.message, { level: 3, style: 'error' });
		}
	}

	onMount(loadSubscriptions);
</script>

<div class="flex min-h-screen flex-col bg-slate-50 p-6 md:p-12">
	<!-- 헤더 영역 -->
	<header class="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
		<div>
			<h1 class="text-5xl font-black tracking-tighter text-slate-900 uppercase italic">
				Push <span class="text-blue-600">Admin</span>
			</h1>
			<p class="mt-2 text-sm font-bold text-slate-400 uppercase tracking-widest">
				Management of Web Push Subscriptions & Broadcast
			</p>
		</div>

		<div class="flex gap-2">
			<button
				class="btn btn-primary btn-lg rounded-2xl shadow-xl shadow-blue-100 px-8"
				onclick={() => (showSendModal = true)}
			>
				<Icon icon="mdi:send" class="h-6 w-6 mr-2" />
				전체 푸시 발송
			</button>
			<button class="btn btn-circle btn-ghost" onclick={loadSubscriptions}>
				<Icon icon="mdi:refresh" class="h-6 w-6" />
			</button>
		</div>
	</header>

	<!-- 통계 섹션 -->
	<div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
		<div class="stats shadow-xl bg-white rounded-3xl p-4">
			<div class="stat">
				<div class="stat-title text-[10px] font-black uppercase opacity-40">Active Subscribers</div>
				<div class="stat-value text-blue-600">{subscriptions.length}</div>
				<div class="stat-desc mt-1 font-bold">Total registered devices</div>
			</div>
		</div>
	</div>

	<!-- 구독 목록 테이블 -->
	<div class="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
		<table class="table table-lg w-full">
			<thead class="bg-slate-900 text-[10px] font-black uppercase tracking-widest text-white">
				<tr>
					<th class="py-6 pl-8">Subscriber</th>
					<th>Device Endpoint (Preview)</th>
					<th class="text-right pr-8">Actions</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-100">
				{#each subscriptions as sub}
					<tr class="hover:bg-slate-50 transition-colors group">
						<td class="py-6 pl-8">
							<div class="flex items-center gap-4">
								<div class="avatar placeholder">
									<div class="bg-slate-200 text-slate-600 rounded-xl w-10">
										<span class="text-xs font-black">{sub.username[0].toUpperCase()}</span>
									</div>
								</div>
								<div>
									<div class="font-black text-slate-900">{sub.real_name || sub.username}</div>
									<div class="text-[10px] opacity-40 font-bold uppercase">{sub.username} (ID: {sub.user_id})</div>
								</div>
							</div>
						</td>
						<td class="text-xs font-mono text-slate-400">
							{sub.endpoint}
						</td>
						<td class="text-right pr-8">
							<button
								class="btn btn-ghost btn-sm btn-circle text-rose-300 hover:text-rose-600 hover:bg-rose-50"
								onclick={() => deleteSubscription(sub.id)}
							>
								<Icon icon="mdi:trash-can-outline" class="h-5 w-5" />
							</button>
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="3" class="py-20 text-center opacity-30 font-black">
							<Icon icon="mdi:bell-off-outline" class="mx-auto h-12 w-12 mb-4" />
							구독 중인 사용자가 없습니다.
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<!-- 🚀 발송 모달 -->
{#if showSendModal}
	<dialog class="modal modal-open backdrop-blur-md" transition:fade>
		<div class="modal-box max-w-lg rounded-[2.5rem] p-12 bg-white shadow-2xl border border-slate-100">
			<h3 class="text-3xl font-black tracking-tighter text-slate-900 italic mb-8">
				Broadcast <span class="text-blue-600">Push</span>
			</h3>

			<div class="form-control gap-6">
				<div class="group">
					<label class="label text-[10px] font-black uppercase opacity-40 ml-1">Push Title</label>
					<input
						type="text"
						class="input input-lg w-full bg-slate-50 border-none rounded-2xl font-bold"
						bind:value={pushData.title}
					/>
				</div>

				<div class="group">
					<label class="label text-[10px] font-black uppercase opacity-40 ml-1">Message Body</label>
					<textarea
						class="textarea textarea-lg w-full bg-slate-50 border-none rounded-2xl font-bold h-32 leading-relaxed"
						placeholder="발송할 내용을 입력하세요..."
						bind:value={pushData.body}
					></textarea>
				</div>

				<div class="group">
					<label class="label text-[10px] font-black uppercase opacity-40 ml-1">Redirect URL (Optional)</label>
					<input
						type="text"
						class="input input-lg w-full bg-slate-50 border-none rounded-2xl font-bold"
						placeholder="예: /v1/app/board/notice"
						bind:value={pushData.url}
					/>
				</div>
			</div>

			<div class="modal-action mt-10 grid grid-cols-2 gap-4">
				<button class="btn btn-ghost btn-lg rounded-2xl font-black text-slate-400" onclick={() => (showSendModal = false)}>
					취소
				</button>
				<button class="btn btn-primary btn-lg rounded-2xl font-black shadow-xl shadow-blue-100" onclick={sendPush}>
					즉시 발송
				</button>
			</div>
		</div>
	</dialog>
{/if}

<style>
	/* daisyUI 기반이므로 별도 스타일 최소화 */
</style>
