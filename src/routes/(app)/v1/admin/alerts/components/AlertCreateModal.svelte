<script>
	import Icon from '@iconify/svelte';
	import { toLocalISOString } from '$lib/utils';
	import { notifyAlert } from '$lib/utils/sound';

	let {
		isOpen = $bindable(false),
		groups = [],
		initialTargetGroup = '',
		onCreate
	} = $props();

	// D + 3일 후 만료일 계산 헬퍼 함수
	function getThreeDaysLater() {
		const d = new Date();
		d.setDate(d.getDate() + 3);
		return d;
	}

	let newAlert = $state({
		message: '',
		level: '1',
		style: 'info',
		position: 'top',
		category: 'NOTICE', // 'NOTICE' | 'URGENT_NOTICE' | 'INSTRUCTION'
		target_group: '',
		start_date: toLocalISOString(new Date()),
		end_date: toLocalISOString(getThreeDaysLater()),
		send_web_push: false, // 📱 전사 웹푸시 알림 발송 플래그
		reset_sec: 0,
		redirect_url: '',
		route: '',
		is_active: true
	});

	// 빠른 일자 프리셋 지정 (+1일, +3일, +7일)
	function setPresetDays(days) {
		const base = newAlert.start_date ? new Date(newAlert.start_date) : new Date();
		const target = new Date(base);
		target.setDate(target.getDate() + days);
		newAlert.end_date = toLocalISOString(target);
	}

	// 🚨 중요 공지(URGENT_NOTICE) 선택 시 시인성 극대화를 위한 기본값 자동 보조
	$effect(() => {
		if (newAlert.category === 'URGENT_NOTICE') {
			if (newAlert.style === 'info') {
				newAlert.style = 'error';
			}
			if (parseInt(String(newAlert.level)) < 3) {
				newAlert.level = '3';
			}
		}
	});

	// 🎯 Level 변경 시 position 및 5초 정독 시간 자동 동기화 규칙
	// - L1, L2: 상단/하단 선택 가능, 정독시간 0
	// - L3: 중앙 고정, 정독시간 0
	// - L4, L5: 중앙 고정, 정독시간 5초 강제 고정
	$effect(() => {
		const lvl = parseInt(String(newAlert.level));
		if (lvl >= 3) {
			newAlert.position = 'modal';
			newAlert.reset_sec = (lvl >= 4) ? 5 : 0;
		} else {
			if (newAlert.position === 'center' || newAlert.position === 'modal') {
				newAlert.position = 'top';
			}
			newAlert.reset_sec = 0;
		}
	});

	function resetForm() {
		newAlert = {
			message: '',
			level: '1',
			style: 'info',
			position: 'top',
			category: 'NOTICE',
			target_group: initialTargetGroup || '',
			start_date: toLocalISOString(new Date()),
			end_date: toLocalISOString(getThreeDaysLater()),
			send_web_push: false,
			reset_sec: 0,
			redirect_url: '',
			route: '',
			is_active: true
		};
	}

	$effect(() => {
		if (isOpen) {
			resetForm();
		}
	});

	function handleSubmit() {
		onCreate?.({
			...newAlert,
			start_date: new Date(newAlert.start_date),
			end_date: new Date(newAlert.end_date),
			level: parseInt(String(newAlert.level)),
			send_web_push: !newAlert.target_group && Boolean(newAlert.send_web_push)
		});
		resetForm();
	}

	function handleClose() {
		resetForm();
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
							<option value="NOTICE">📢 공지 (일반 업무 안내)</option>
							<option value="URGENT_NOTICE">🚨 중요 공지 (비상/긴급 - 시인성 특화)</option>
							<option value="INSTRUCTION">📋 지시사항 (수신확인 필수)</option>
						</select>
						<span class="text-[10px] text-slate-400 mt-1 block">
							{#if newAlert.category === 'URGENT_NOTICE'}
								<span class="text-rose-600 font-bold">🚨 중요 공지는 사원 피드에서 강렬한 펄스 뱃지와 강조 테두리로 최우선 노출됩니다.</span>
							{:else if newAlert.category === 'INSTRUCTION'}
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

						{#if !newAlert.target_group}
							<!-- 🔔 전사 전체 공지 시 브라우저 웹 푸시(Web Push) 알림 동시 발송 체크박스 -->
							<div class="mt-2.5 flex items-center justify-between p-2.5 rounded-xl bg-blue-50 border border-blue-200 transition-all">
								<label class="flex items-center gap-2 cursor-pointer select-none">
									<input
										type="checkbox"
										class="checkbox checkbox-primary checkbox-xs rounded"
										bind:checked={newAlert.send_web_push}
									/>
									<span class="text-xs font-black text-blue-900 flex items-center gap-1">
										<Icon icon="mdi:bell-ring-outline" class="text-blue-600 text-sm" />
										전사 브라우저 웹 푸시(Web Push) 알림 동시 발송
									</span>
								</label>
								<span class="badge badge-xs badge-info font-bold text-[9px]">Web Push</span>
							</div>
						{/if}

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

				<!-- 🎵 L3 업무 지시 오디오 챠임벨 및 진동 모터 연동 알림 배너 -->
				{#if parseInt(String(newAlert.level)) === 3}
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

				<!-- 시작일시 / 종료일시 (기본값 D+3일 및 닫기 버튼 바) -->
				<div class="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
					<div class="flex items-center justify-between">
						<label class="label py-0"><span class="label-text font-bold text-xs flex items-center gap-1">
							<Icon icon="mdi:calendar-clock" class="text-blue-600" />
							노출 기간 설정 (종료일시 기본: D+3일)
						</span></label>
						<div class="flex items-center gap-1">
							<button
								type="button"
								class="btn btn-ghost btn-xs text-[10px] font-bold rounded-lg px-2 py-0.5 bg-white border border-slate-200 hover:bg-slate-100"
								onclick={() => setPresetDays(1)}
							>+1일</button>
							<button
								type="button"
								class="btn btn-ghost btn-xs text-[10px] font-bold rounded-lg px-2 py-0.5 bg-blue-100 border border-blue-200 text-blue-800 hover:bg-blue-200"
								onclick={() => setPresetDays(3)}
							>+3일 (기본)</button>
							<button
								type="button"
								class="btn btn-ghost btn-xs text-[10px] font-bold rounded-lg px-2 py-0.5 bg-white border border-slate-200 hover:bg-slate-100"
								onclick={() => setPresetDays(7)}
							>+7일</button>
						</div>
					</div>

					<div class="grid grid-cols-1 gap-3 md:grid-cols-2">
						<div>
							<label class="label py-0.5"><span class="label-text font-bold text-[11px] text-slate-500">시작일시</span></label>
							<input
								type="datetime-local"
								class="input input-bordered input-sm w-full rounded-xl bg-white text-slate-900 font-bold"
								bind:value={newAlert.start_date}
							/>
						</div>
						<div>
							<label class="label py-0.5"><span class="label-text font-bold text-[11px] text-slate-500">종료일시 (D+3일 기본)</span></label>
							<input
								type="datetime-local"
								class="input input-bordered input-sm w-full rounded-xl bg-white text-slate-900 font-bold"
								bind:value={newAlert.end_date}
							/>
						</div>
					</div>

					<span class="text-[10px] text-slate-400 block pt-0.5">
						종료일시가 도래하면 사용자 화면에서 자동 비활성화 처리됩니다.
					</span>
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
						닫기
					</button>
					<button type="submit" class="btn btn-sm btn-primary rounded-xl font-black px-6">
						새 알림 생성
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}
