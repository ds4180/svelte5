<script>
	import Icon from '@iconify/svelte';
	import { toLocalISOString } from '$lib/utils';
	import { notifyAlert } from '$lib/utils/sound';

	let {
		isOpen = $bindable(false),
		alertItem = null,
		groups = [],
		onUpdate
	} = $props();

	let editingAlert = $state(null);

	$effect(() => {
		if (isOpen && alertItem) {
			editingAlert = { ...alertItem };
			editingAlert.level = String(editingAlert.level);
			editingAlert.category = editingAlert.category || 'NOTIFICATION';
			editingAlert.target_group = editingAlert.target_group || '';
			editingAlert.position = editingAlert.position || 'top';
			editingAlert.start_date = toLocalISOString(editingAlert.start_date);
			editingAlert.end_date = toLocalISOString(editingAlert.end_date);
		}
	});

	// 🎯 Level 변경 시 position 및 5초 정독 시간 자동 동기화 규칙
	$effect(() => {
		if (editingAlert) {
			const lvl = parseInt(String(editingAlert.level));
			if (lvl >= 3) {
				editingAlert.position = 'modal';
				editingAlert.reset_sec = (lvl >= 4) ? 5 : 0;
			} else {
				if (editingAlert.position === 'center' || editingAlert.position === 'modal') {
					editingAlert.position = 'top';
				}
				editingAlert.reset_sec = 0;
			}
		}
	});

	function handleSubmit() {
		if (!editingAlert) return;
		onUpdate?.({
			...editingAlert,
			start_date: new Date(editingAlert.start_date),
			end_date: new Date(editingAlert.end_date),
			level: parseInt(String(editingAlert.level))
		});
	}

	function handleClose() {
		isOpen = false;
	}
</script>

{#if isOpen && editingAlert}
	<div 
		class="fixed inset-0 z-[9999] grid place-items-center p-4 bg-slate-900/15 backdrop-blur-xs overflow-y-auto"
		onclick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
		role="dialog"
		aria-modal="true"
	>
		<div
			class="relative w-full max-w-2xl my-auto rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 md:p-8"
		>
			<!-- 모달 헤더 -->
			<div class="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
				<h3 class="text-2xl font-black text-slate-900 flex items-center gap-2">
					<Icon icon="mdi:pencil-box-outline" class="text-blue-600" />
					알림 수정 (ID: #{editingAlert.id})
				</h3>
				<button 
					type="button"
					class="btn btn-sm btn-ghost btn-circle text-slate-400 hover:text-slate-700" 
					onclick={handleClose}
				>
					<Icon icon="mdi:close" class="text-xl" />
				</button>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
				class="space-y-4"
			>
				<!-- 메시지 본문 -->
				<div>
					<label class="label pb-1"><span class="label-text font-bold text-xs">알림 메시지</span></label>
					<textarea
						placeholder="알림 메시지"
						class="textarea textarea-bordered w-full rounded-xl bg-white text-slate-900 font-bold"
						rows="3"
						bind:value={editingAlert.message}
						required
					></textarea>
				</div>

				<!-- 피드 분류 & 수신 대상 그룹 -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2 p-3 bg-slate-50 rounded-2xl border border-slate-200">
					<div>
						<label class="label py-1"><span class="label-text font-bold text-xs flex items-center gap-1">
							<Icon icon="mdi:shape-outline" class="text-blue-600" />
							미니앱 피드 분류 (Category)
						</span></label>
						<select
							class="select select-bordered select-sm w-full rounded-xl bg-white text-slate-900 font-bold"
							bind:value={editingAlert.category}
						>
							<option value="NOTICE">📢 공지 (일반 업무 안내)</option>
							<option value="URGENT_NOTICE">🚨 중요 공지 (비상/긴급 - 시인성 특화)</option>
							<option value="INSTRUCTION">📋 지시사항 (수신확인 필수)</option>
						</select>
						<span class="text-[10px] text-slate-400 mt-1 block">
							{#if editingAlert.category === 'URGENT_NOTICE'}
								<span class="text-rose-600 font-bold">🚨 중요 공지는 사원 피드에서 강렬한 펄스 뱃지와 강조 테두리로 최우선 노출됩니다.</span>
							{:else if editingAlert.category === 'INSTRUCTION'}
								<span class="text-purple-600 font-bold">📋 지시사항은 사원의 [확인 완료] 액션 및 관리자 수신 집계가 제공됩니다.</span>
							{:else}
								사원 미니앱 피드의 [알림] 탭에 일반 공지로 적재됩니다.
							{/if}
						</span>
					</div>
					<div>
						<div class="flex items-center justify-between">
							<label class="label py-1"><span class="label-text font-bold text-xs flex items-center gap-1">
								<Icon icon="mdi:target" class="text-amber-600" />
								수신 대상 그룹 (Target Group)
							</span></label>
							<a href="/v1/admin/target-groups" class="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5">
								타겟그룹 관리 <Icon icon="ph:arrow-right-bold" class="text-xs" />
							</a>
						</div>
						<select
							class="select select-bordered select-sm w-full rounded-xl bg-white text-slate-900 font-bold"
							bind:value={editingAlert.target_group}
						>
							<option value="">📢 전사 전체 공지 (모든 사용자 수신)</option>
							{#each groups as g}
								<option value={g.name}>
									🎯 [{g.type}] {g.name} ({g.count}명)
								</option>
							{/each}
						</select>
						<span class="text-[10px] text-slate-400 mt-1 block">
							{#if editingAlert.target_group}
								{@const selectedG = groups.find(g => g.name === editingAlert.target_group)}
								{selectedG ? `설명: ${selectedG.desc || '설명 없음'} (현재 대상 ${selectedG.count}명)` : '선택된 그룹의 사원에게만 알림/지시가 도달합니다.'}
							{:else}
								로그인한 사내 전체 임직원에게 발송 및 노출됩니다.
							{/if}
						</span>
					</div>
				</div>

				<!-- 🎛️ 레벨(1~5), 스타일, 노출 위치 (3열 배치) -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-3">
					<!-- 1. 레벨 선택 -->
					<div>
						<label class="label pb-1"><span class="label-text font-bold text-xs">레벨 (1-5)</span></label>
						<select
							class="select select-bordered select-sm w-full rounded-xl bg-white text-slate-900 font-bold"
							bind:value={editingAlert.level}
						>
							<option value="1">L1 (일반 알림 - Toast)</option>
							<option value="2">L2 (상태 배너 - Banner)</option>
							<option value="3">L3 (업무 지시 - Modal 챠임벨)</option>
							<option value="4">L4 (강제 지시 - 5초 정독)</option>
							<option value="5">L5 (시스템 락 - 5초 정독)</option>
						</select>
					</div>

					<!-- 2. 스타일 선택 -->
					<div>
						<label class="label pb-1"><span class="label-text font-bold text-xs">스타일</span></label>
						<select
							class="select select-bordered select-sm w-full rounded-xl bg-white text-slate-900 font-bold"
							bind:value={editingAlert.style}
						>
							<option value="info">Info (정보)</option>
							<option value="success">Success (성공)</option>
							<option value="warning">Warning (경고)</option>
							<option value="error">Error (에러)</option>
							<option value="danger">Danger (긴급)</option>
						</select>
					</div>

					<!-- 3. 노출 위치 (L1, L2는 상단/하단 선택, L3~L5는 중앙 고정) -->
					<div>
						<label class="label pb-1"><span class="label-text font-bold text-xs">노출 위치 (Position)</span></label>
						{#if parseInt(String(editingAlert.level)) <= 2}
							<select
								class="select select-bordered select-sm w-full rounded-xl bg-white text-slate-900 font-bold"
								bind:value={editingAlert.position}
							>
								<option value="top">상단 (Top)</option>
								<option value="bottom">하단 (Bottom)</option>
							</select>
						{:else}
							<div class="input input-bordered input-sm w-full rounded-xl bg-slate-100 text-slate-600 font-bold flex items-center justify-between">
								<span>중앙 (Center 고정)</span>
								<span class="badge badge-xs badge-neutral">L3~L5 고정</span>
							</div>
						{/if}
					</div>
				</div>

				<!-- 🎵 L3 업무 지시 오디오 챠임벨 및 진동 모터 연동 알림 배너 -->
				{#if parseInt(String(editingAlert.level)) === 3}
					<div class="flex items-center justify-between rounded-2xl bg-purple-50 p-3 border-2 border-purple-200">
						<div class="flex items-center gap-2.5">
							<div class="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-200 text-purple-700">
								<Icon icon="mdi:volume-high" class="text-lg" />
							</div>
							<div>
								<h5 class="text-xs font-black text-purple-950 flex items-center gap-1">
									<span>L3 업무 지시 사운드 & 햅틱 진동 탑재</span>
									<span class="badge badge-xs bg-purple-700 text-white font-bold">Web Audio + Vibration</span>
								</h5>
								<p class="text-[11px] text-purple-700 mt-0.5">사원 화면에 모달이 열릴 때 맑은 2단 챠임벨("딩~동~")과 모바일 진동이 울립니다.</p>
							</div>
						</div>
						<button
							type="button"
							class="btn btn-xs rounded-xl bg-purple-700 text-white font-black hover:bg-purple-800 active:scale-95 shadow-sm px-3 py-1.5 flex items-center gap-1 shrink-0"
							onclick={() => notifyAlert(3)}
						>
							<Icon icon="mdi:play-circle-outline" class="text-sm" />
							<span>미리듣기</span>
						</button>
					</div>
				{/if}

				<!-- 시작일시 / 종료일시 -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<label class="label pb-1"><span class="label-text font-bold text-xs">시작일시</span></label>
						<input
							type="datetime-local"
							class="input input-bordered input-sm w-full rounded-xl bg-white text-slate-900 font-bold"
							bind:value={editingAlert.start_date}
						/>
					</div>
					<div>
						<label class="label pb-1"><span class="label-text font-bold text-xs">종료일시</span></label>
						<input
							type="datetime-local"
							class="input input-bordered input-sm w-full rounded-xl bg-white text-slate-900 font-bold"
							bind:value={editingAlert.end_date}
						/>
					</div>
				</div>

				<!-- 적용 경로 & 리다이렉트 URL -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<label class="label pb-1"><span class="label-text font-bold text-xs">적용 경로 (공백 시 전역)</span></label>
						<input
							type="text"
							placeholder="예: /v1/admin, /users/*"
							class="input input-bordered input-sm w-full rounded-xl bg-white text-slate-900 font-bold"
							bind:value={editingAlert.route}
						/>
					</div>
					<div>
						<label class="label pb-1"><span class="label-text font-bold text-xs">리다이렉트 URL (선택)</span></label>
						<input
							type="url"
							placeholder="확인 후 이동할 링크 URL"
							class="input input-bordered input-sm w-full rounded-xl bg-white text-slate-900 font-bold"
							bind:value={editingAlert.redirect_url}
						/>
					</div>
				</div>

				<!-- 하단 옵션: 활성 상태 토글 & 정독 대기시간 안내 -->
				<div class="flex items-center justify-between pt-2 border-t border-slate-100">
					<label class="label cursor-pointer gap-2">
						<span class="label-text font-bold text-xs text-slate-700">활성 상태 (즉시 노출)</span>
						<input
							type="checkbox"
							class="toggle toggle-primary toggle-sm"
							bind:checked={editingAlert.is_active}
						/>
					</label>

					{#if parseInt(String(editingAlert.level)) >= 4}
						<div class="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold">
							<Icon icon="mdi:timer-outline" class="text-base text-amber-600" />
							<span>의무 정독 <strong>5초</strong> 후 확인 버튼 활성화</span>
						</div>
					{/if}
				</div>

				<div class="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
					<button
						type="button"
						class="btn btn-sm btn-ghost rounded-xl font-bold text-slate-500"
						onclick={handleClose}
					>
						취소
					</button>
					<button type="submit" class="btn btn-sm btn-primary rounded-xl font-black px-6">
						수정 완료
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
