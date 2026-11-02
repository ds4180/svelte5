<script>
	/**
	 * @file (app)/v1/admin/alerts/+page.svelte
	 * @description 시스템 알림/공지/지시사항 통합 관제 오케스트레이터
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

	let alerts = $state([]);
	let groups = $state([]); // Redis 타겟 그룹 목록
	let loading = $state(true);
	let showCreateModal = $state(false);
	let showEditModal = $state(false);
	let showAckModal = $state(false);

	let selectedAckAlert = $state(null);
	let editingAlert = $state(null);
	let initialTargetGroup = $state('');

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

	async function handleCreateAlert(alertData) {
		try {
			await api.adminCreateAlert(alertData);
			toast.success('새 알림이 성공적으로 등록되었습니다.');
			showCreateModal = false;
			await loadAlerts();
		} catch (e) {
			toast.error(e.message || '알림 등록 실패');
		}
	}

	function openEditModal(alert) {
		editingAlert = alert;
		showEditModal = true;
	}

	async function handleUpdateAlert(alertData) {
		try {
			await api.adminUpdateAlert(alertData.id, alertData);
			toast.success('알림이 수정되었습니다.');
			showEditModal = false;
			await loadAlerts();
		} catch (e) {
			toast.error(e.message || '알림 수정 실패');
		}
	}

	async function handleToggleStatus(alertId) {
		try {
			await api.adminToggleAlert(alertId);
			toast.info('알림 활성 상태가 변경되었습니다.');
			await loadAlerts();
		} catch (e) {
			toast.error(e.message || '상태 변경 실패');
		}
	}

	async function handleDeleteAlert(alertId) {
		if (!confirm('정말 이 알림을 삭제하시겠습니까?')) return;
		try {
			await api.adminDeleteAlert(alertId);
			toast.success('알림이 삭제되었습니다.');
			await loadAlerts();
		} catch (e) {
			toast.error(e.message || '알림 삭제 실패');
		}
	}

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
				알림·<span class="NOT-ITALIC text-blue-600"
					>지시 관리 <Icon
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

	<!-- 📊 알림 목록 뷰 (데스크톱 테이블 & 모바일 카드) -->
	<AlertList
		{alerts}
		{loading}
		onToggle={handleToggleStatus}
		onEdit={openEditModal}
		onDelete={handleDeleteAlert}
		onOpenAck={openAckModal}
	/>

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
