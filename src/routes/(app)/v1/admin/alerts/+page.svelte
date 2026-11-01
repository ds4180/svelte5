<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import * as api from '$lib/api/admin.js';
	import { alertState } from '$lib/runes/alert.svelte.js';
	import { toast } from '$lib/runes/toast.svelte.js';
	import Icon from '@iconify/svelte';

	let alerts = $state([]);
	let groups = $state([]); // Redis 타겟 그룹 목록 (target-group 앱의 출력물)
	let loading = $state(true);
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let newAlert = $state({
		message: '',
		level: 1,
		style: 'info',
		position: 'top',
		category: 'NOTIFICATION', // 'NOTIFICATION' (알림) | 'INSTRUCTION' (지시사항) | 'NOTICE' (공지사항)
		target_group: '', // Redis 타겟 그룹명 (target-group 앱 연계)
		start_date: new Date().toISOString().slice(0, 16),
		end_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1))
			.toISOString()
			.slice(0, 16),
		reset_sec: 0,
		confirm_text: '',
		redirect_url: '',
		route: '',
		is_active: true
	});
	let editingAlert = $state(null);

	async function loadAlerts() {
		loading = true;
		try {
			alerts = await api.adminGetAlerts();
		} catch (e) {
			toast.error(e.message || '알림 목록 조회 실패');
		} finally {
			loading = false;
		}
	}

	async function loadGroups() {
		try {
			groups = await api.adminGetGroups();
		} catch (e) {
			console.error('타겟 그룹 로드 오류:', e);
		}
	}

	async function createAlert() {
		try {
			// 날짜 형식 변환 (ISO string -> Date 객체)
			const alertData = {
				...newAlert,
				start_date: new Date(newAlert.start_date),
				end_date: new Date(newAlert.end_date),
				level: parseInt(newAlert.level) // 문자열로 넘어올 수 있으므로 정수 변환
			};
			await api.adminCreateAlert(alertData);
			toast.success('새 알림이 성공적으로 등록되었습니다.');
			showCreateModal = false;
			await loadAlerts();
		} catch (e) {
			toast.error(e.message || '알림 등록 실패');
		}
	}

	function openEditModal(alert) {
		editingAlert = { ...alert }; // 원본 객체 변경 방지를 위해 복사
		editingAlert.level = String(editingAlert.level); // select box가 string 값을 기대할 수 있으므로 변환
		editingAlert.category = editingAlert.category || 'NOTIFICATION';
		editingAlert.target_group = editingAlert.target_group || '';
		// 날짜를 input[type="datetime-local"]에 맞게 포맷
		editingAlert.start_date = formatDateForInput(editingAlert.start_date);
		editingAlert.end_date = formatDateForInput(editingAlert.end_date);
		showEditModal = true;
	}

	async function updateAlert() {
		try {
			const alertData = {
				...editingAlert,
				start_date: new Date(editingAlert.start_date),
				end_date: new Date(editingAlert.end_date),
				level: parseInt(editingAlert.level) // 문자열로 넘어올 수 있으므로 정수 변환
			};
			await api.adminUpdateAlert(editingAlert.id, alertData);
			toast.success('알림이 수정되었습니다.');
			showEditModal = false;
			await loadAlerts();
		} catch (e) {
			toast.error(e.message || '알림 수정 실패');
		}
	}

	async function toggleAlertStatus(alertId) {
		try {
			await api.adminToggleAlert(alertId);
			toast.info('알림 활성 상태가 변경되었습니다.');
			await loadAlerts();
		} catch (e) {
			toast.error(e.message || '상태 변경 실패');
		}
	}

	async function deleteAlert(alertId) {
		if (!confirm('정말 이 알림을 삭제하시겠습니까?')) return;
		try {
			await api.adminDeleteAlert(alertId);
			toast.success('알림이 삭제되었습니다.');
			await loadAlerts();
		} catch (e) {
			toast.error(e.message || '알림 삭제 실패');
		}
	}

	onMount(async () => {
		await Promise.all([loadAlerts(), loadGroups()]);

		// target-group 관리 화면에서 ?target_group=... 파라미터로 넘어왔을 경우 자동 오픈
		const queryGroup = page.url.searchParams.get('target_group');
		if (queryGroup) {
			newAlert.target_group = queryGroup;
			showCreateModal = true;
		}
	});

	// 시간 포맷터
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

	// 날짜 input용 포맷터 (ISO 8601 형식: YYYY-MM-DDTHH:mm)
	function formatDateForInput(dateString) {
		if (!dateString) return '';
		const date = new Date(dateString);
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, '0');
		const day = date.getDate().toString().padStart(2, '0');
		const hours = date.getHours().toString().padStart(2, '0');
		const minutes = date.getMinutes().toString().padStart(2, '0');
		return `${year}-${month}-${day}T${hours}:${minutes}`;
	}
</script>

<div
	class="animate-fade-in mx-auto max-w-7xl space-y-6 px-4 pb-20 font-['Noto_Sans_KR','Outfit'] md:space-y-10 md:px-6 md:pb-40 lg:px-8"
>
	<!-- 📄 상단 헤더 -->
	<div
		class="flex flex-col items-start justify-between gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:gap-6 md:border-b-4 md:pb-8"
	>
		<div>
			<span
				class="mb-1 block text-[8px] font-black tracking-[0.2em] text-slate-400 uppercase md:mb-2 md:text-[10px] md:tracking-[0.4em]"
				>System Notification</span
			>
			<h1 class="text-3xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
				알림 <span class="NOT-ITALIC text-blue-600"
					>관리자 <Icon
						icon="mdi:bell-cog-outline"
						class="ml-1 inline-block align-text-bottom text-blue-600"
					/></span
				>
			</h1>
			<p class="mt-2 text-xs font-bold text-slate-500 md:mt-3 md:text-sm">
				시스템 전역 알림을 생성, 조회, 수정, 삭제합니다.
			</p>
		</div>
		<div class="flex gap-2 md:gap-4">
			<button
				class="btn rounded-lg border-none bg-blue-600 px-4 font-black text-white shadow-md transition-all btn-sm hover:bg-blue-700 md:rounded-2xl md:px-8 md:shadow-xl md:btn-lg"
				onclick={() => (showCreateModal = true)}
			>
				<Icon icon="mdi:plus-circle-outline" class="h-4 w-4 md:h-6 md:w-6" />
				새 알림 생성
			</button>
			<a
				href="/v1/admin"
				class="btn rounded-lg border-none bg-slate-200 px-4 font-black text-slate-700 shadow-md transition-all btn-sm hover:bg-slate-300 md:rounded-2xl md:px-8 md:shadow-xl md:btn-lg"
			>
				<Icon icon="mdi:home-outline" class="h-4 w-4 md:h-6 md:w-6" />
				홈으로
			</a>
			<button
				class="btn rounded-lg border-none bg-slate-900 px-4 font-black text-white shadow-md transition-all btn-sm hover:bg-slate-800 md:rounded-2xl md:px-8 md:shadow-xl md:btn-lg"
				onclick={loadAlerts}
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

	<!-- 📊 알림 목록 테이블 (Desktop/Tablet) -->
	<div
		class="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg sm:block md:rounded-[2rem] md:shadow-2xl"
	>
		<table class="table w-full">
			<!-- 헤더 -->
			<thead
				class="border-b border-slate-100 bg-slate-50 text-[8px] font-bold tracking-widest text-slate-500 uppercase md:text-[10px]"
			>
				<tr>
					<th class="px-4 py-4 md:px-8 md:py-6">ID</th>
					<th>메시지</th>
					<th>분류</th>
					<th>수신 대상</th>
					<th>레벨</th>
					<th>유형</th>
					<th>기간</th>
					<th>활성</th>
					<th>생성일</th>
					<th class="px-4 text-right md:px-8">작업</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-50">
				{#if loading}
					<tr
						><td colspan="10" class="py-16 text-center md:py-32"
							><span class="loading loading-lg loading-bars text-blue-600"></span></td
						></tr
					>
				{:else if alerts.length === 0}
					<tr
						><td
							colspan="10"
							class="py-16 text-center text-xl font-bold text-slate-300 italic md:py-32"
							>생성된 알림이 없습니다.</td
						></tr
					>
				{:else}
					{#each alerts as alert (alert.id)}
						<tr class="group transition-colors hover:bg-slate-50/50">
							<td class="px-4 py-3 md:px-8 md:py-5">
								<span
									class="rounded-sm bg-slate-100 px-1.5 py-0.5 font-mono text-[8px] text-slate-400 transition-colors group-hover:bg-white md:rounded-md md:text-[10px]"
								>
									{alert.id}
								</span>
							</td>
							<td>
								<div class="flex items-center gap-2">
									<span class="max-w-[180px] truncate text-sm font-black text-slate-900 md:max-w-[320px] md:text-base">
										{alert.message}
									</span>
									<button
										class="btn btn-ghost btn-xs text-[9px] uppercase font-black"
										onclick={() => alertState.send(alert.message, { level: alert.level, style: alert.style, confirm_text: alert.confirm_text, redirect_url: alert.redirect_url })}
									>
										[미리보기]
									</button>
								</div>
							</td>
							<td>
								<span
									class="rounded-md px-2 py-0.5 text-[8px] font-black md:text-[10px] {alert.category === 'INSTRUCTION' ? 'bg-purple-100 text-purple-700' : alert.category === 'NOTICE' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}"
								>
									{alert.category === 'INSTRUCTION' ? '지시사항' : alert.category === 'NOTICE' ? '공지사항' : '알림'}
								</span>
							</td>
							<td>
								{#if alert.target_group}
									<span class="inline-flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[9px] font-bold text-blue-700">
										<Icon icon="mdi:target" class="text-blue-500" />
										{alert.target_group}
									</span>
								{:else if alert.target_users}
									<span class="rounded-md bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-600">
										사원 {alert.target_users.split(',').length}명
									</span>
								{:else}
									<span class="rounded-md bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
										전사 전체
									</span>
								{/if}
							</td>
							<td>
								<span
									class="rounded-md px-2 py-0.5 text-[8px] font-black tracking-tighter md:text-[10px] {alert.level ===
									5
										? 'bg-red-100 text-red-700'
										: alert.level === 4
											? 'bg-purple-100 text-purple-700'
											: alert.level === 3
												? 'bg-yellow-100 text-yellow-700'
												: alert.level === 2
													? 'bg-green-100 text-green-700'
													: 'bg-blue-100 text-blue-700'}"
								>
									L{alert.level}
								</span>
							</td>
							<td>
								<span
									class="rounded-md bg-slate-100 px-2 py-0.5 text-[8px] font-black tracking-tighter text-slate-700 capitalize md:text-[10px]"
								>
									{alert.style}
								</span>
							</td>
							<td class="text-[8px] font-medium text-slate-500 md:text-xs">
								{formatDateTime(alert.start_date)}<br />
								{formatDateTime(alert.end_date)}
							</td>
							<td>
								<button
									class="btn btn-ghost btn-xs {alert.is_active ? 'text-green-500' : 'text-red-500'}"
									onclick={() => toggleAlertStatus(alert.id)}
								>
									<Icon
										icon="mdi:toggle-{alert.is_active ? 'switch' : 'switch-off'}"
										class="h-4 w-4"
									/>
									{alert.is_active ? '활성' : '비활성'}
								</button>
							</td>
							<td class="text-[8px] font-medium text-slate-500 md:text-xs">
								{formatDateTime(alert.created_at)}
							</td>
							<td class="px-4 text-right md:px-8">
								<div class="flex justify-end gap-1">
									<button
										class="btn rounded-lg px-2 font-black text-blue-500 btn-ghost btn-xs hover:bg-blue-50 hover:text-blue-700"
										onclick={() => openEditModal(alert)}
									>
										<Icon icon="mdi:pencil-outline" class="h-3 w-3" />
										수정
									</button>
									<button
										class="btn rounded-lg px-2 font-black text-red-500 btn-ghost btn-xs hover:bg-red-50 hover:text-red-700"
										onclick={() => deleteAlert(alert.id)}
									>
										<Icon icon="mdi:delete-outline" class="h-3 w-3" />
										삭제
									</button>
								</div>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<!-- 📈 알림 목록 카드 (Mobile) -->
	<div class="space-y-4 sm:hidden">
		{#if loading}
			<div class="py-16 text-center">
				<span class="loading loading-lg loading-bars text-blue-600"></span>
			</div>
		{:else if alerts.length === 0}
			<div class="py-16 text-center text-xl font-bold text-slate-300 italic">
				생성된 알림이 없습니다.
			</div>
		{:else}
			{#each alerts as alert (alert.id)}
				<div class="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg">
					<div class="flex items-center justify-between">
						<div class="flex flex-col">
							<span class="text-base font-black text-slate-900">ID: {alert.id}</span>
							<span class="text-[10px] text-slate-500">메시지: {alert.message}</span>
						</div>
						<span
							class="rounded-md px-2 py-0.5 text-[8px] font-black tracking-tighter {alert.level ===
							5
								? 'bg-red-100 text-red-700'
								: alert.level === 4
									? 'bg-purple-100 text-purple-700'
									: alert.level === 3
										? 'bg-yellow-100 text-yellow-700'
										: alert.level === 2
											? 'bg-green-100 text-green-700'
											: 'bg-blue-100 text-blue-700'}"
						>
							L{alert.level}
						</span>
					</div>

					<div class="flex items-center justify-between text-xs">
						<div class="flex items-center gap-1.5">
							<span class="rounded-md px-1.5 py-0.5 text-[9px] font-black {alert.category === 'INSTRUCTION' ? 'bg-purple-100 text-purple-700' : alert.category === 'NOTICE' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-700'}">
								{alert.category === 'INSTRUCTION' ? '지시사항' : alert.category === 'NOTICE' ? '공지사항' : '알림'}
							</span>
							{#if alert.target_group}
								<span class="rounded-md bg-blue-50 border border-blue-200 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
									🎯 {alert.target_group}
								</span>
							{:else}
								<span class="rounded-md bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">
									전사 전체
								</span>
							{/if}
						</div>
						<span
							><span class="font-semibold text-slate-400">스타일:</span>
							<span class="capitalize text-slate-700 font-bold">{alert.style}</span></span
						>
					</div>

					<div class="flex justify-between text-xs text-slate-500">
						<span
							><span class="font-semibold">유형:</span>
							<span class="capitalize">{alert.style}</span>
							/ <span class="capitalize">{alert.position}</span></span
						>
						<span
							><span class="font-semibold">활성:</span>
							<button
								class="btn btn-ghost btn-xs {alert.is_active ? 'text-green-500' : 'text-red-500'}"
								onclick={() => toggleAlertStatus(alert.id)}
							>
								<Icon
									icon="mdi:toggle-{alert.is_active ? 'switch' : 'switch-off'}"
									class="h-4 w-4"
								/>
								{alert.is_active ? '활성' : '비활성'}
							</button>
						</span>
					</div>
					<div class="text-xs text-slate-500">
						<span class="font-semibold">기간:</span>
						{formatDateTime(alert.start_date)} ~ {formatDateTime(alert.end_date)}
					</div>
					<div class="flex items-center justify-between text-xs text-slate-500">
						<span><span class="font-semibold">생성:</span> {formatDateTime(alert.created_at)}</span>
						<div class="flex gap-1">
							<button
								class="btn rounded-lg px-2 font-black text-blue-500 btn-ghost btn-xs hover:bg-blue-50 hover:text-blue-700"
								onclick={() => openEditModal(alert)}
							>
								<Icon icon="mdi:pencil-outline" class="h-3 w-3" />
								수정
							</button>
							<button
								class="btn rounded-lg px-2 font-black text-red-500 btn-ghost btn-xs hover:bg-red-50 hover:text-red-700"
								onclick={() => deleteAlert(alert.id)}
							>
								<Icon icon="mdi:delete-outline" class="h-3 w-3" />
								삭제
							</button>
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>

	<!-- 🆕 새 알림 생성 모달 -->
	{#if showCreateModal}
		<div class="bg-opacity-50 fixed inset-0 z-[9999] bg-black">
			<div
				class="absolute top-1/2 left-1/2 max-h-[calc(100vh-theme(spacing.16))] w-11/12 max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl md:p-8"
			>
				<h3 class="mb-4 text-2xl font-bold text-slate-900">새 알림 생성</h3>

				<form
					onsubmit={(e) => {
						e.preventDefault();
						createAlert();
					}}
					class="space-y-4"
				>
					<div>
						<label class="label"><span class="label-text">메시지</span></label>
						<textarea
							placeholder="알림 메시지"
							class="textarea-bordered textarea w-full rounded-lg bg-white text-slate-900"
							bind:value={newAlert.message}
							required
						></textarea>
					</div>

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
						<div>
							<label class="label py-1"><span class="label-text font-bold text-xs flex items-center gap-1">
								<Icon icon="mdi:shape-outline" class="text-blue-600" />
								미니앱 피드 분류 (Category)
							</span></label>
							<select
								class="select-bordered select select-sm w-full rounded-lg bg-white text-slate-900 font-bold"
								bind:value={newAlert.category}
							>
								<option value="NOTIFICATION">🔔 일반 알림 (NOTIFICATION)</option>
								<option value="INSTRUCTION">📋 업무 지시사항 (INSTRUCTION - 완료처리형)</option>
								<option value="NOTICE">📢 전사/그룹 공지사항 (NOTICE)</option>
							</select>
							<span class="text-[10px] text-slate-400 mt-1 block">미니앱 피드 허브의 해당 탭으로 자동 분류 적재됩니다.</span>
						</div>
						<div>
							<div class="flex items-center justify-between">
								<label class="label py-1"><span class="label-text font-bold text-xs flex items-center gap-1">
									<Icon icon="mdi:target" class="text-amber-600" />
									수신 대상 그룹 (Redis Target Group)
								</span></label>
								<a href="/v1/admin/target-groups" target="_blank" class="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5">
									타겟그룹 관리 <Icon icon="mdi:open-in-new" class="text-xs" />
								</a>
							</div>
							<select
								class="select-bordered select select-sm w-full rounded-lg bg-white text-slate-900 font-bold"
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

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label class="label"><span class="label-text">레벨 (1-5)</span></label>
							<select
								class="select-bordered select w-full rounded-lg bg-white text-slate-900"
								bind:value={newAlert.level}
							>
								<option value="1">1 (일반 알림 - Toast)</option>
								<option value="2">2 (상태 배너)</option>
								<option value="3">3 (일반 확인 - Modal)</option>
								<option value="4">4 (강제 지시 - Timed Modal)</option>
								<option value="5">5 (시스템 락 - Full Screen)</option>
							</select>
						</div>
						<div>
							<label class="label"><span class="label-text">스타일</span></label>
							<select
								class="select-bordered select w-full rounded-lg bg-white text-slate-900"
								bind:value={newAlert.style}
							>
								<option value="info">Info (정보)</option>
								<option value="success">Success (성공)</option>
								<option value="warning">Warning (경고)</option>
								<option value="error">Error (에러)</option>
								<option value="danger">Danger (긴급)</option>
							</select>
						</div>
					</div>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label class="label"><span class="label-text">시작일시</span></label>
							<input
								type="datetime-local"
								class="input-bordered input w-full rounded-lg bg-white text-slate-900"
								bind:value={newAlert.start_date}
							/>
						</div>
						<div>
							<label class="label"><span class="label-text">종료일시</span></label>
							<input
								type="datetime-local"
								class="input-bordered input w-full rounded-lg bg-white text-slate-900"
								bind:value={newAlert.end_date}
							/>
						</div>
					</div>
					<div>
						<label class="label"
							><span class="label-text">경로 (콤마로 구분, 예: /v1/admin, /users/*)</span></label
						>
						<input
							type="text"
							placeholder="적용 경로"
							class="input-bordered input w-full rounded-lg bg-white text-slate-900"
							bind:value={newAlert.route}
						/>
					</div>
					<div>
						<label class="label"><span class="label-text">리다이렉트 URL</span></label>
						<input
							type="url"
							placeholder="확인 후 이동할 URL"
							class="input-bordered input w-full rounded-lg bg-white text-slate-900"
							bind:value={newAlert.redirect_url}
						/>
					</div>
					<div class="flex items-center gap-4">
						<label class="label cursor-pointer"
							><span class="label-text mr-2">활성 상태</span>
							<input
								type="checkbox"
								class="toggle toggle-primary"
								bind:checked={newAlert.is_active}
							/>
						</label>
						<label class="label cursor-pointer"
							><span class="label-text mr-2">정독 대기 시간 (L4 전용, 초)</span>
							<input
								type="number"
								class="input-bordered input w-20 rounded-lg bg-white text-slate-900"
								bind:value={newAlert.reset_sec}
								min="0"
								max="60"
							/>
						</label>
					</div>

					<div class="mt-6 flex justify-end gap-2">
						<button
							type="button"
							class="btn rounded-lg btn-ghost"
							onclick={() => (showCreateModal = false)}>취소</button
						>
						<button type="submit" class="btn rounded-lg btn-primary">생성</button>
					</div>
				</form>
			</div>
		</div>
	{/if}

	<!-- ✏️ 알림 수정 모달 -->
	{#if showEditModal && editingAlert}
		<div class="bg-opacity-50 fixed inset-0 z-[9999] bg-black">
			<div
				class="absolute top-1/2 left-1/2 max-h-[calc(100vh-theme(spacing.16))] w-11/12 max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl md:p-8"
			>
				<h3 class="mb-4 text-2xl font-bold text-slate-900">알림 수정 (ID: {editingAlert.id})</h3>

				<form
					onsubmit={(e) => {
						e.preventDefault();
						updateAlert();
					}}
					class="space-y-4"
				>
					<div>
						<label class="label"><span class="label-text">메시지</span></label>
						<textarea
							placeholder="알림 메시지"
							class="textarea-bordered textarea w-full rounded-lg bg-white text-slate-900"
							bind:value={editingAlert.message}
							required
						></textarea>
					</div>

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
						<div>
							<label class="label py-1"><span class="label-text font-bold text-xs flex items-center gap-1">
								<Icon icon="mdi:shape-outline" class="text-blue-600" />
								미니앱 피드 분류 (Category)
							</span></label>
							<select
								class="select-bordered select select-sm w-full rounded-lg bg-white text-slate-900 font-bold"
								bind:value={editingAlert.category}
							>
								<option value="NOTIFICATION">🔔 일반 알림 (NOTIFICATION)</option>
								<option value="INSTRUCTION">📋 업무 지시사항 (INSTRUCTION - 완료처리형)</option>
								<option value="NOTICE">📢 전사/그룹 공지사항 (NOTICE)</option>
							</select>
							<span class="text-[10px] text-slate-400 mt-1 block">미니앱 피드 허브의 해당 탭으로 자동 분류 적재됩니다.</span>
						</div>
						<div>
							<div class="flex items-center justify-between">
								<label class="label py-1"><span class="label-text font-bold text-xs flex items-center gap-1">
									<Icon icon="mdi:target" class="text-amber-600" />
									수신 대상 그룹 (Redis Target Group)
								</span></label>
								<a href="/v1/admin/target-groups" target="_blank" class="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5">
									타겟그룹 관리 <Icon icon="mdi:open-in-new" class="text-xs" />
								</a>
							</div>
							<select
								class="select-bordered select select-sm w-full rounded-lg bg-white text-slate-900 font-bold"
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

					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label class="label"><span class="label-text">레벨 (1-5)</span></label>
							<select
								class="select-bordered select w-full rounded-lg bg-white text-slate-900"
								bind:value={editingAlert.level}
							>
								<option value="1">1 (일반 알림 - Toast)</option>
								<option value="2">2 (상태 배너)</option>
								<option value="3">3 (일반 확인 - Modal)</option>
								<option value="4">4 (강제 지시 - Timed Modal)</option>
								<option value="5">5 (시스템 락 - Full Screen)</option>
							</select>
						</div>
						<div>
							<label class="label"><span class="label-text">스타일</span></label>
							<select
								class="select-bordered select w-full rounded-lg bg-white text-slate-900"
								bind:value={editingAlert.style}
							>
								<option value="info">Info (정보)</option>
								<option value="success">Success (성공)</option>
								<option value="warning">Warning (경고)</option>
								<option value="error">Error (에러)</option>
								<option value="danger">Danger (긴급)</option>
							</select>
						</div>
					</div>
					<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div>
							<label class="label"><span class="label-text">시작일시</span></label>
							<input
								type="datetime-local"
								class="input-bordered input w-full rounded-lg bg-white text-slate-900"
								bind:value={editingAlert.start_date}
							/>
						</div>
						<div>
							<label class="label"><span class="label-text">종료일시</span></label>
							<input
								type="datetime-local"
								class="input-bordered input w-full rounded-lg bg-white text-slate-900"
								bind:value={editingAlert.end_date}
							/>
						</div>
					</div>
					<div>
						<label class="label"
							><span class="label-text">경로 (콤마로 구분, 예: /v1/admin, /users/*)</span></label
						>
						<input
							type="text"
							placeholder="적용 경로"
							class="input-bordered input w-full rounded-lg bg-white text-slate-900"
							bind:value={editingAlert.route}
						/>
					</div>
					<div>
						<label class="label"><span class="label-text">리다이렉트 URL</span></label>
						<input
							type="url"
							placeholder="확인 후 이동할 URL"
							class="input-bordered input w-full rounded-lg bg-white text-slate-900"
							bind:value={editingAlert.redirect_url}
						/>
					</div>
					<div class="flex items-center gap-4">
						<label class="label cursor-pointer"
							><span class="label-text mr-2">활성 상태</span>
							<input
								type="checkbox"
								class="toggle toggle-primary"
								bind:checked={editingAlert.is_active}
							/>
						</label>
						<label class="label cursor-pointer"
							><span class="label-text mr-2">정독 대기 시간 (L4 전용, 초)</span>
							<input
								type="number"
								class="input-bordered input w-20 rounded-lg bg-white text-slate-900"
								bind:value={editingAlert.reset_sec}
								min="0"
								max="60"
							/>
						</label>
					</div>

					<div class="mt-6 flex justify-end gap-2">
						<button
							type="button"
							class="btn rounded-lg btn-ghost"
							onclick={() => (showEditModal = false)}>취소</button
						>
						<button type="submit" class="btn rounded-lg btn-primary">수정</button>
					</div>
				</form>
			</div>
		</div>
	{/if}
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
