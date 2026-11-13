<script>
	import Icon from '@iconify/svelte';
	import * as api from '$lib/api/admin';
	import { toast } from '$lib/runes/toast.svelte';
	import { formatApiError } from '$lib/utils/error';

	let {
		isOpen = $bindable(false),
		alertItem = null
	} = $props();

	let ackStats = $state(null);
	let ackLoading = $state(false);
	let ackTab = $state('pending'); // 'pending' | 'confirmed'

	async function loadAckStats() {
		if (!alertItem) return;
		ackLoading = true;
		ackStats = null;
		ackTab = 'pending';
		try {
			ackStats = await api.adminGetAlertAcknowledgements(alertItem.id);
		} catch (e) {
			toast.error('수신 현황 조회 실패: ' + formatApiError(e));
		} finally {
			ackLoading = false;
		}
	}

	$effect(() => {
		if (isOpen && alertItem) {
			loadAckStats();
		}
	});

	function handleClose() {
		isOpen = false;
	}
</script>

{#if isOpen}
	<div 
		class="fixed inset-0 z-[9999] grid place-items-center p-4 bg-slate-900/15 backdrop-blur-xs overflow-y-auto"
		onclick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
		role="dialog"
		aria-modal="true"
	>
		<div class="relative w-full max-w-2xl my-auto overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200">
			<!-- 모달 헤더 -->
			<div class="bg-slate-50 border-b border-slate-200 p-5 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
						<Icon icon="mdi:account-check" class="h-5 w-5" />
					</div>
					<div>
						<h3 class="text-lg font-black text-slate-800">지시사항 수신 확인 현황</h3>
						<p class="text-xs text-slate-500">
							알림 ID: <span class="font-bold text-slate-700">#{alertItem?.id}</span>
							{#if alertItem?.target_group}
								· 대상: <span class="badge badge-sm badge-outline text-blue-600 font-bold">{alertItem.target_group}</span>
							{/if}
						</p>
					</div>
				</div>
				<button
					onclick={handleClose}
					class="btn btn-sm btn-ghost btn-circle text-slate-400 hover:text-slate-600"
				>
					✕
				</button>
			</div>

			<!-- 모달 본문 -->
			<div class="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
				<!-- 지시 내용 요약 -->
				<div class="p-3 bg-purple-50/60 border border-purple-100 rounded-xl text-xs text-purple-900 font-medium">
					<span class="font-bold">지시 내용:</span> {alertItem?.message}
				</div>

				{#if ackLoading}
					<div class="py-12 text-center">
						<span class="loading loading-spinner loading-md text-purple-600"></span>
						<p class="text-xs text-slate-400 mt-2">수신 확인 현황을 집계 중입니다...</p>
					</div>
				{:else if ackStats}
					<!-- 통계 지표 카드 -->
					<div class="grid grid-cols-3 gap-3">
						<div class="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
							<span class="text-[11px] font-bold text-slate-500">총 대상 인원</span>
							<div class="text-2xl font-black text-slate-800 mt-1">{ackStats.total_count}명</div>
						</div>
						<div class="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
							<span class="text-[11px] font-bold text-emerald-700">확인 완료</span>
							<div class="text-2xl font-black text-emerald-700 mt-1">{ackStats.confirmed_count}명</div>
						</div>
						<div class="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
							<span class="text-[11px] font-bold text-amber-700">미확인 대기</span>
							<div class="text-2xl font-black text-amber-700 mt-1">{ackStats.pending_count}명</div>
						</div>
					</div>

					<!-- 진행률 바 -->
					<div class="space-y-1">
						<div class="flex justify-between text-xs font-bold">
							<span class="text-slate-600">수신 인지 완료율</span>
							<span class="text-emerald-600">{ackStats.confirm_rate}%</span>
						</div>
						<progress class="progress progress-success w-full h-2.5" value={ackStats.confirm_rate} max="100"></progress>
					</div>

					<!-- 탭 메뉴 (미확인 / 확인완료) -->
					<div class="tabs tabs-boxed bg-slate-100 p-1 rounded-xl">
						<button
							class="tab flex-1 font-bold text-xs {ackTab === 'pending' ? 'tab-active bg-white text-amber-700 shadow-sm' : ''}"
							onclick={() => (ackTab = 'pending')}
						>
							미확인 기사 ({ackStats.pending_count}명)
						</button>
						<button
							class="tab flex-1 font-bold text-xs {ackTab === 'confirmed' ? 'tab-active bg-white text-emerald-700 shadow-sm' : ''}"
							onclick={() => (ackTab = 'confirmed')}
						>
							확인 완료 기사 ({ackStats.confirmed_count}명)
						</button>
					</div>

					<!-- 사원 명단 리스트 -->
					<div class="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto">
						{#if ackTab === 'pending'}
							{#if ackStats.pending_users.length === 0}
								<div class="py-8 text-center text-xs text-slate-400 font-bold">
									🎉 모든 대상 기사님이 지시사항을 확인 완료했습니다!
								</div>
							{:else}
								<table class="table table-xs w-full">
									<thead class="bg-slate-50 sticky top-0">
										<tr>
											<th>이름</th>
											<th>아이디</th>
											<th>연락처</th>
											<th class="text-right">상태</th>
										</tr>
									</thead>
									<tbody>
										{#each ackStats.pending_users as u}
											<tr class="hover:bg-slate-50">
												<td class="font-bold text-slate-800">{u.real_name}</td>
												<td class="text-slate-500 font-mono text-[11px]">{u.username}</td>
												<td class="text-slate-500 font-mono text-[11px]">{u.phone || '-'}</td>
												<td class="text-right">
													<span class="badge badge-warning badge-xs">미확인</span>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							{/if}
						{:else}
							{#if ackStats.confirmed_users.length === 0}
								<div class="py-8 text-center text-xs text-slate-400 font-bold">
									아직 확인을 완료한 기사님이 없습니다.
								</div>
							{:else}
								<table class="table table-xs w-full">
									<thead class="bg-slate-50 sticky top-0">
										<tr>
											<th>이름</th>
											<th>아이디</th>
											<th>확인 시각</th>
											<th class="text-right">상태</th>
										</tr>
									</thead>
									<tbody>
										{#each ackStats.confirmed_users as u}
											<tr class="hover:bg-slate-50">
												<td class="font-bold text-slate-800">{u.real_name}</td>
												<td class="text-slate-500 font-mono text-[11px]">{u.username}</td>
												<td class="text-slate-500 font-mono text-[11px]">
													{u.confirmed_at ? u.confirmed_at.substring(0, 19).replace('T', ' ') : '-'}
												</td>
												<td class="text-right">
													<span class="badge badge-success badge-xs text-white">확인 완료</span>
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							{/if}
						{/if}
					</div>
				{/if}
			</div>

			<!-- 모달 풋터 -->
			<div class="bg-slate-50 border-t border-slate-200 p-4 flex justify-between items-center">
				<button
					onclick={loadAckStats}
					class="btn btn-sm btn-ghost gap-1 text-slate-600 text-xs"
					disabled={ackLoading}
				>
					<Icon icon="mdi:refresh" class="h-4 w-4" /> 새로고침
				</button>
				<button
					onclick={handleClose}
					class="btn btn-sm btn-neutral px-6 rounded-lg text-xs"
				>
					닫기
				</button>
			</div>
		</div>
	</div>
{/if}
