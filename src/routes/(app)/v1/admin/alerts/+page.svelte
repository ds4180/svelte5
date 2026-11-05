<script>
	/**
	 * ============================================================================
	 * [사내 전역 공지 및 업무 지시 알림 통합 관제탑 (+page.svelte)]
	 * ============================================================================
	 * 
	 * 💡 이 페이지의 역할:
	 * 1. 상단 공지 배너, 모바일 긴급 팝업, L5 Web Push 등 전사 알림 총괄
	 * 2. 승무원/직원 양방향 수신 확인(MiniappRead) 지시사항 발행 및 미확인자 관제
	 * 3. Redis 타겟 그룹(특정 노선/휴무 기사)별 타겟팅 알림 발행
	 */

	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import * as api from '$lib/api/admin.js';
	import { toast } from '$lib/runes/toast.svelte.js';
	import Icon from '@iconify/svelte';

	import AlertList from './components/AlertList.svelte';
	import AlertCreateModal from './components/AlertCreateModal.svelte';
	import AlertEditModal from './components/AlertEditModal.svelte';
	import AlertAckModal from './components/AlertAckModal.svelte';

	let alerts = $state(/** @type {any[]} */ ([]));
	let groups = $state(/** @type {any[]} */ ([])); // Redis 타겟 그룹 목록
	let loading = $state(true);
	let selectedCategory = $state('ALL'); // 'ALL' | 'NOTICE' | 'URGENT_NOTICE' | 'INSTRUCTION'

	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let showAckModal = $state(false);

	let selectedAckAlert = $state(null);
	let editingAlert = $state(null);
	let initialTargetGroup = $state('');

	// 📊 상단 4대 관제 지표 요약 (반응형 유도)
	const countTotal = $derived(alerts.length);
	const countActive = $derived(alerts.filter((a) => a.is_active).length);
	const countInstruction = $derived(alerts.filter((a) => a.category === 'INSTRUCTION').length);
	const countUrgent = $derived(alerts.filter((a) => a.category === 'URGENT_NOTICE' || a.level >= 4).length);

	/**
	 * 🔄 알림 목록 로드
	 */
	async function loadAlerts() {
		loading = true;
		try {
			alerts = await api.adminGetAlerts();
		} catch (/** @type {any} */ e) {
			toast.error('알림 목록 조회 실패: ' + (e.message || '서버 오류'));
		} finally {
			loading = false;
		}
	}

	/**
	 * 👥 타겟 그룹 목록 로드
	 */
	async function loadGroups() {
		try {
			groups = await api.adminGetGroups();
		} catch (e) {
			console.error('❌ [Alerts] 타겟 그룹 로드 오류:', e);
		}
	}

	/**
	 * ➕ 새 알림 등록
	 * @param {any} alertData
	 */
	async function handleCreateAlert(alertData) {
		try {
			await api.adminCreateAlert(alertData);
			toast.success('새 알림/지시사항이 성공적으로 등록되었습니다.');
			showCreateModal = false;
			await loadAlerts();
		} catch (/** @type {any} */ e) {
			toast.error('알림 등록 실패: ' + (e.message || '서버 오류'));
		}
	}

	/**
	 * ✏️ 알림 수정 모달 열기
	 * @param {any} alert
	 */
	function openEditModal(alert) {
		editingAlert = alert;
		showEditModal = true;
	}

	/**
	 * 💾 알림 수정 저장
	 * @param {any} alertData
	 */
	async function handleUpdateAlert(alertData) {
		try {
			await api.adminUpdateAlert(alertData.id, alertData);
			toast.success('알림이 성공적으로 수정되었습니다.');
			showEditModal = false;
			await loadAlerts();
		} catch (/** @type {any} */ e) {
			toast.error('알림 수정 실패: ' + (e.message || '서버 오류'));
		}
	}

	/**
	 * 🔄 알림 활성/비활성 스위치 토글
	 * @param {number} alertId
	 */
	async function handleToggleStatus(alertId) {
		try {
			await api.adminToggleAlert(alertId);
			toast.info('알림 활성 상태가 변경되었습니다.');
			await loadAlerts();
		} catch (/** @type {any} */ e) {
			toast.error('상태 변경 실패: ' + (e.message || '서버 오류'));
		}
	}

	/**
	 * 🗑️ 알림 영구 삭제
	 * @param {number} alertId
	 */
	async function handleDeleteAlert(alertId) {
		if (!confirm('정말 이 알림을 영구 삭제하시겠습니까?\n삭제 내역은 보안 감사로그에 안전하게 기록됩니다.')) return;
		try {
			await api.adminDeleteAlert(alertId);
			toast.success('알림이 성공적으로 삭제되었습니다.');
			await loadAlerts();
		} catch (/** @type {any} */ e) {
			toast.error('알림 삭제 실패: ' + (e.message || '서버 오류'));
		}
	}

	/**
	 * 📋 수신 확인 모달 열기
	 * @param {any} alertItem
	 */
	function openAckModal(alertItem) {
		selectedAckAlert = alertItem;
		showAckModal = true;
	}

	onMount(async () => {
		await Promise.all([loadAlerts(), loadGroups()]);

		const queryGroup = page.url.searchParams.get('target_group');
		if (queryGroup) {
			initialTargetGroup = queryGroup;
			showCreateModal = true;
		}
	});
</script>

<svelte:head>
	<title>알림·지시 관리 | jeju.live Core</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-6 px-4 py-8 font-['Noto_Sans_KR','Outfit'] md:space-y-8 md:px-6 lg:px-8">
	<!-- ===================================================================== -->
	<!-- 1. 페이지 헤더 & 실시간 컨트롤 바 -->
	<!-- ===================================================================== -->
	<div class="flex flex-col gap-4 border-b-2 border-slate-900 pb-6 md:flex-row md:items-end md:justify-between md:border-b-4">
		<div>
			<div class="flex items-center gap-2">
				<span class="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-3 py-1 text-[11px] font-black tracking-widest text-emerald-400 uppercase">
					<span class="h-2 w-2 rounded-full bg-emerald-400 animate-ping"></span>
					Enterprise Notification
				</span>
				<span class="text-xs font-bold text-slate-400">v1/admin/alerts</span>
			</div>
			<h1 class="mt-2 text-3xl font-black tracking-tight text-slate-900 uppercase italic md:text-4xl">
				알림·지시 관리 <span class="not-italic text-blue-600">통합 관제탑</span>
			</h1>
			<p class="mt-1 text-sm font-medium text-slate-500">
				사내 전역 공지 배너, 모바일 긴급 팝업, 승무원 양방향 수신 확인 지시사항 생성 및 배포
			</p>
		</div>

		<!-- 상단 액션 버튼 그룹 -->
		<div class="flex flex-wrap items-center gap-3">
			<button
				onclick={() => (showCreateModal = true)}
				class="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-xs font-black text-white shadow-md transition hover:bg-blue-700 active:scale-95"
			>
				<Icon icon="solar:add-circle-bold" class="text-base" />
				<span>새 알림/지시 생성</span>
			</button>

			<a
				href="/v1/admin"
				class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
			>
				<Icon icon="solar:home-smile-angle-bold-duotone" class="text-base text-slate-500" />
				<span>관리자 홈</span>
			</a>

			<button
				onclick={loadAlerts}
				disabled={loading}
				class="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-md transition hover:bg-blue-600 active:scale-95 disabled:opacity-50"
			>
				<Icon icon="solar:restart-bold" class="text-base {loading ? 'animate-spin' : ''}" />
				<span>새로고침</span>
			</button>
		</div>
	</div>

	<!-- ===================================================================== -->
	<!-- 2. 상단 4대 관제 지표 요약 카드 (Status Cards) -->
	<!-- ===================================================================== -->
	<div class="grid grid-cols-2 gap-4 md:grid-cols-4 md:gap-5">
		<!-- 카드 1: 전체 등록 공지 -->
		<button
			onclick={() => (selectedCategory = 'ALL')}
			class="group flex flex-col justify-between rounded-2xl border-2 p-5 text-left transition {selectedCategory === 'ALL' ? 'border-slate-900 bg-slate-50 shadow-md ring-2 ring-slate-900/20' : 'border-slate-200 bg-white hover:border-slate-300'}"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Total Alerts</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
					<Icon icon="solar:bell-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-2xl font-black text-slate-900 group-hover:text-blue-600 transition">
					{countTotal}
					<span class="text-xs font-normal text-slate-500">건 등록</span>
				</div>
				<div class="mt-1 text-xs font-semibold text-slate-400">
					누적 전사 공지 히스토리
				</div>
			</div>
		</button>

		<!-- 카드 2: 현재 실시간 노출 중 (활성) -->
		<div class="flex flex-col justify-between rounded-2xl border-2 border-emerald-200 bg-emerald-50/30 p-5 shadow-sm">
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-emerald-600 uppercase">Live Active</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
					<Icon icon="solar:check-circle-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-2xl font-black text-emerald-700">
					{countActive}
					<span class="text-xs font-normal text-slate-500">건 표출 중</span>
				</div>
				<div class="mt-1 flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
					<span class="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
					사원 화면에 실시간 노출
				</div>
			</div>
		</div>

		<!-- 카드 3: 현장 업무 지시 -->
		<button
			onclick={() => (selectedCategory = 'INSTRUCTION')}
			class="group flex flex-col justify-between rounded-2xl border-2 p-5 text-left transition {selectedCategory === 'INSTRUCTION' ? 'border-purple-600 bg-purple-50/50 shadow-md ring-2 ring-purple-500/20' : 'border-slate-200 bg-white hover:border-slate-300'}"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Instructions</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
					<Icon icon="solar:clipboard-check-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-2xl font-black text-slate-900 group-hover:text-purple-600 transition">
					{countInstruction}
					<span class="text-xs font-normal text-slate-500">건 발행</span>
				</div>
				<div class="mt-1 text-xs font-semibold text-purple-600">
					양방향 수신 확인 모니터링
				</div>
			</div>
		</button>

		<!-- 카드 4: 중요/비상 공지 (L4~L5) -->
		<button
			onclick={() => (selectedCategory = 'URGENT_NOTICE')}
			class="group flex flex-col justify-between rounded-2xl border-2 p-5 text-left transition {selectedCategory === 'URGENT_NOTICE' ? 'border-rose-600 bg-rose-50/50 shadow-md ring-2 ring-rose-500/20' : 'border-slate-200 bg-white hover:border-slate-300'}"
		>
			<div class="flex items-center justify-between">
				<span class="text-xs font-black tracking-wider text-slate-400 uppercase">Urgent Alerts</span>
				<div class="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
					<Icon icon="solar:danger-triangle-bold-duotone" class="text-xl" />
				</div>
			</div>
			<div class="mt-4">
				<div class="text-2xl font-black text-slate-900 group-hover:text-rose-600 transition">
					{countUrgent}
					<span class="text-xs font-normal text-slate-500">건 등록</span>
				</div>
				<div class="mt-1 text-xs font-semibold {countUrgent > 0 ? 'text-rose-600 font-black animate-pulse' : 'text-slate-400'}">
					{countUrgent > 0 ? '중앙 팝업 & Web Push 발송' : '긴급 비상 알림 없음'}
				</div>
			</div>
		</button>
	</div>

	<!-- ===================================================================== -->
	<!-- 3. 알림 목록 뷰 (데스크톱 테이블 & 모바일 카드) -->
	<!-- ===================================================================== -->
	<AlertList
		{alerts}
		{loading}
		bind:selectedCategory
		onToggle={handleToggleStatus}
		onEdit={openEditModal}
		onDelete={handleDeleteAlert}
		onOpenAck={openAckModal}
	/>

	<!-- ===================================================================== -->
	<!-- 4. 모달 계층 -->
	<!-- ===================================================================== -->
	<!-- 🆕 새 알림 생성 모달 -->
	<AlertCreateModal
		bind:isOpen={showCreateModal}
		{groups}
		{initialTargetGroup}
		onCreate={handleCreateAlert}
	/>

	<!-- ✏️ 알림 수정 모달 -->
	<AlertEditModal
		bind:isOpen={showEditModal}
		alertItem={editingAlert}
		{groups}
		onUpdate={handleUpdateAlert}
	/>

	<!-- 📋 지시사항 양방향 수신 확인 모달 -->
	<AlertAckModal
		bind:isOpen={showAckModal}
		alertItem={selectedAckAlert}
	/>
</div>
