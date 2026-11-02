<script>
	import Icon from '@iconify/svelte';

	let {
		isOpen = $bindable(false),
		groups = [],
		initialTargetGroup = '',
		onCreate
	} = $props();

	let newAlert = $state({
		message: '',
		level: '1',
		style: 'info',
		position: 'top',
		category: 'NOTIFICATION', // 'NOTIFICATION' | 'INSTRUCTION' | 'NOTICE'
		target_group: '',
		start_date: new Date().toISOString().slice(0, 16),
		end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
			.toISOString()
			.slice(0, 16),
		reset_sec: 0,
		redirect_url: '',
		route: '',
		is_active: true
	});

	// 🎯 Level 변경 시 position 및 5초 정독 시간 자동 동기화 규칙
	// - L1, L2: 상단/하단 선택 가능, 정독시간 0
	// - L3: 중앙 고정, 정독시간 0
	// - L4, L5: 중앙 고정, 정독시간 5초 강제 고정
	$effect(() => {
		const lvl = parseInt(String(newAlert.level));
		if (lvl >= 3) {
			newAlert.position = 'center';
			newAlert.reset_sec = (lvl >= 4) ? 5 : 0;
		} else {
			if (newAlert.position === 'center') {
				newAlert.position = 'top';
			}
			newAlert.reset_sec = 0;
		}
	});

	$effect(() => {
		if (isOpen) {
			if (initialTargetGroup) {
				newAlert.target_group = initialTargetGroup;
			}
		}
	});

	function handleSubmit() {
		onCreate?.({
			...newAlert,
			start_date: new Date(newAlert.start_date),
			end_date: new Date(newAlert.end_date),
			level: parseInt(String(newAlert.level))
		});
	}

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
		<div
			class="relative w-full max-w-2xl my-auto rounded-3xl bg-white p-6 shadow-2xl border border-slate-200 md:p-8"
		>
			<!-- 모달 헤더 -->
			<div class="flex items-center justify-between mb-4 border-b border-slate-100 pb-3">
				<h3 class="text-2xl font-black text-slate-900 flex items-center gap-2">
					<Icon icon="mdi:bell-plus-outline" class="text-blue-600" />
					새 알림 생성
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
						placeholder="사용자에게 전달할 알림 또는 지시 내용을 입력하세요."
						class="textarea textarea-bordered w-full rounded-xl bg-white text-slate-900 font-bold"
						rows="3"
						bind:value={newAlert.message}
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
							bind:value={newAlert.category}
						>
							<option value="NOTIFICATION">🔔 일반 알림 (NOTIFICATION)</option>
							<option value="INSTRUCTION">📋 업무 지시사항 (INSTRUCTION - 수신확인형)</option>
							<option value="NOTICE">📢 전사/그룹 공지사항 (NOTICE)</option>
						</select>
						<span class="text-[10px] text-slate-400 mt-1 block">미니앱 피드 허브의 해당 탭으로 자동 분류 적재됩니다.</span>
					</div>
					<div>
						<div class="flex items-center justify-between">
							<label class="label py-1"><span class="label-text font-bold text-xs flex items-center gap-1">
								<Icon icon="mdi:target" class="text-amber-600" />
								수신 대상 그룹 (Target Group)
							</span></label>
							<a href="/v1/admin/target-groups" target="_blank" class="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5">
								타겟그룹 관리 <Icon icon="mdi:open-in-new" class="text-xs" />
							</a>
						</div>
						<select
							class="select select-bordered select-sm w-full rounded-xl bg-white text-slate-900 font-bold"
							bind:value={newAlert.target_group}
						>
							<option value="">📢 전사 전체 공지 (모든 사용자 수신)</option>
							{#each groups as g}
								<option value={g.name}>
									🎯 [{g.type}] {g.name} ({g.count}명)
								</option>
							{/each}
						</select>
						<span class="text-[10px] text-slate-400 mt-1 block">
							{#if newAlert.target_group}
								{@const selectedG = groups.find(g => g.name === newAlert.target_group)}
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
							bind:value={newAlert.level}
						>
							<option value="1">L1 (일반 알림 - Toast)</option>
							<option value="2">L2 (상태 배너 - Banner)</option>
							<option value="3">L3 (일반 확인 - Modal)</option>
							<option value="4">L4 (강제 지시 - 5초 정독)</option>
							<option value="5">L5 (시스템 락 - 5초 정독)</option>
						</select>
					</div>

					<!-- 2. 스타일 선택 -->
					<div>
						<label class="label pb-1"><span class="label-text font-bold text-xs">스타일</span></label>
						<select
							class="select select-bordered select-sm w-full rounded-xl bg-white text-slate-900 font-bold"
							bind:value={newAlert.style}
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
						{#if parseInt(String(newAlert.level)) <= 2}
							<select
								class="select select-bordered select-sm w-full rounded-xl bg-white text-slate-900 font-bold"
								bind:value={newAlert.position}
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

				<!-- 시작일시 / 종료일시 -->
				<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
					<div>
						<label class="label pb-1"><span class="label-text font-bold text-xs">시작일시</span></label>
						<input
							type="datetime-local"
							class="input input-bordered input-sm w-full rounded-xl bg-white text-slate-900 font-bold"
							bind:value={newAlert.start_date}
						/>
					</div>
					<div>
						<label class="label pb-1"><span class="label-text font-bold text-xs">종료일시</span></label>
						<input
							type="datetime-local"
							class="input input-bordered input-sm w-full rounded-xl bg-white text-slate-900 font-bold"
							bind:value={newAlert.end_date}
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
							bind:value={newAlert.route}
						/>
					</div>
					<div>
						<label class="label pb-1"><span class="label-text font-bold text-xs">리다이렉트 URL (선택)</span></label>
						<input
							type="url"
							placeholder="확인 후 이동할 링크 URL"
							class="input input-bordered input-sm w-full rounded-xl bg-white text-slate-900 font-bold"
							bind:value={newAlert.redirect_url}
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
							bind:checked={newAlert.is_active}
						/>
					</label>

					{#if parseInt(String(newAlert.level)) >= 4}
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
						새 알림 생성
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
