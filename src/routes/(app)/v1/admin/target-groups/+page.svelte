<script>
	/**
	 * @file (app)/v1/admin/target-groups/+page.svelte
	 * @description 메시징·알림 타겟팅용 임시/동적 그룹 관리 (Redis 기반 초고속 집합 연산)
	 *              - 전사 표준 모던 엔터프라이즈 헤더 & 4대 핵심 관제 지표 요약 카드
	 *              - 3대 그룹 유형(자동 연산, 수동 지정, 복합 연산) 명확한 구분 표시
	 *              - 매일 아침 07:00 배차 기준 정기 자동 연산 및 생성/갱신 일시 표기
	 *              - 소속 사원 명단 확인 모달 (블라인드 해소)
	 *              - toast.svelte.ts 100% 전환 (구식 alert/confirm 완전 퇴출)
	 */
	import { onMount } from 'svelte';
	import { fade, slide, fly } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import { toast } from '$lib/runes/toast.svelte.ts';
	import { getSiteTitle } from '$lib/config/site';
	import { formatDateTime } from '$lib/utils';
	import { 
		adminGetGroups, 
		adminRefreshDynamicGroups, 
		adminCreateManualGroup, 
		adminCombineGroups, 
		adminDeleteGroup, 
		adminGetTargetGroupUsers,
		adminGetGroupMembers
	} from '$lib/api/admin';

	// 1. 핵심 상태 관리
	let groups = $state([]);
	let users = $state([]);
	let loading = $state(true);
	let isRefreshing = $state(false);
	let activeTab = $state('list'); // 'list' | 'manual' | 'combine'

	// 타겟 그룹 명부 서브 카테고리 필터 ('all' | 'dynamic' | 'manual' | 'combined')
	let listFilterCategory = $state('all');

	// 수동 그룹 생성용
	let manualGroupName = $state('');
	let selectedUserIds = $state([]);
	let userSearchQuery = $state('');
	let isCreatingManual = $state(false);

	// 집합 연산용
	let combineResultName = $state('');
	let combineOp = $state('INTERSECT'); // 'INTERSECT' | 'DIFF' | 'UNION'
	let baseGroup = $state('');
	let targetGroups = $state([]);
	let isCombining = $state(false);

	// 멤버 확인 모달 상태
	let isMembersModalOpen = $state(false);
	let activeGroupForMembers = $state(null);
	let groupMembers = $state([]);
	let isLoadingMembers = $state(false);
	let memberSearchQuery = $state('');

	// 삭제 확인 모달 상태
	let isDeleteModalOpen = $state(false);
	let groupToDelete = $state(null);
	let isDeleting = $state(false);

	// 2. 파생 통계 (4대 핵심 관제 지표 및 분류)
	let dynamicGroups = $derived(groups.filter(g => g.type === 'dynamic'));
	let manualGroups = $derived(groups.filter(g => g.type === 'manual'));
	let combinedGroups = $derived(groups.filter(g => g.type === 'combined'));
	let totalTargetsCount = $derived(groups.reduce((acc, cur) => acc + (cur.count || 0), 0));

	const fetchGroups = async () => {
		try {
			groups = await adminGetGroups();
		} catch (e) {
			toast.error('그룹 목록 로드 실패: ' + (e.message || '오류가 발생했습니다.'));
		}
	};

	const fetchUsers = async () => {
		try {
			users = await adminGetTargetGroupUsers();
		} catch (e) {
			console.error('사원 목록 로드 실패', e);
		}
	};

	onMount(async () => {
		await Promise.all([fetchGroups(), fetchUsers()]);
		loading = false;
	});

	// 실시간 동적 그룹 강제 연산
	const handleRefreshDynamic = async () => {
		isRefreshing = true;
		try {
			const res = await adminRefreshDynamicGroups();
			await fetchGroups();
			toast.success('오늘 출근자, 휴무자, 노선별 배차 동적 그룹이 실시간 갱신되었습니다.');
		} catch (e) {
			toast.error('동적 그룹 갱신 실패: ' + (e.detail || e.message || '오류'));
		} finally {
			isRefreshing = false;
		}
	};

	// 수동 그룹 생성
	const handleCreateManual = async () => {
		const name = manualGroupName.trim();
		if (!name) {
			toast.warning('그룹 이름을 입력해 주세요.');
			return;
		}
		if (selectedUserIds.length === 0) {
			toast.warning('최소 1명 이상의 사원을 선택해 주세요.');
			return;
		}

		isCreatingManual = true;
		try {
			await adminCreateManualGroup({ name, user_ids: selectedUserIds });
			toast.success(`'${name}' 수동 타겟 그룹이 성공적으로 생성되었습니다.`);
			manualGroupName = '';
			selectedUserIds = [];
			activeTab = 'list';
			listFilterCategory = 'manual';
			await fetchGroups();
		} catch (e) {
			toast.error('생성 실패: ' + (e.detail || e.message || '오류가 발생했습니다.'));
		} finally {
			isCreatingManual = false;
		}
	};

	// 집합 연산 그룹 생성
	const handleCombine = async () => {
		const name = combineResultName.trim();
		if (!name || !baseGroup || targetGroups.length === 0) {
			toast.warning('결과 그룹명, 기준 그룹, 대상 그룹을 모두 지정해 주세요.');
			return;
		}

		isCombining = true;
		try {
			const res = await adminCombineGroups({
				new_name: name,
				op: combineOp,
				base_group: baseGroup,
				target_groups: targetGroups
			});
			toast.success(`'${name}' 집합 연산 그룹이 성공적으로 생성되었습니다. (총 ${res.count ?? 0}명)`);
			combineResultName = '';
			targetGroups = [];
			activeTab = 'list';
			listFilterCategory = 'combined';
			await fetchGroups();
		} catch (e) {
			toast.error('연산 실패: ' + (e.detail || e.message || '오류가 발생했습니다.'));
		} finally {
			isCombining = false;
		}
	};

	// 그룹 삭제 확인 및 실행
	function openDeleteModal(group) {
		groupToDelete = group;
		isDeleteModalOpen = true;
	}

	const handleDelete = async () => {
		if (!groupToDelete) return;
		isDeleting = true;
		try {
			await adminDeleteGroup(groupToDelete.name);
			toast.success(`'${groupToDelete.name}' 그룹이 삭제되었습니다.`);
			isDeleteModalOpen = false;
			groupToDelete = null;
			await fetchGroups();
		} catch (e) {
			toast.error('삭제 실패: ' + (e.detail || e.message || '오류가 발생했습니다.'));
		} finally {
			isDeleting = false;
		}
	};

	// 소속 사원 명단 모달 오픈
	async function openMembersModal(group) {
		activeGroupForMembers = group;
		isMembersModalOpen = true;
		isLoadingMembers = true;
		memberSearchQuery = '';
		try {
			groupMembers = await adminGetGroupMembers(group.name);
		} catch (e) {
			toast.error('멤버 목록을 불러오지 못했습니다.');
			groupMembers = [];
		} finally {
			isLoadingMembers = false;
		}
	}

	const filteredUsers = $derived(
		users.filter(u => 
			u.username.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
			(u.real_name && u.real_name.toLowerCase().includes(userSearchQuery.toLowerCase())) ||
			(u.primary_group && u.primary_group.toLowerCase().includes(userSearchQuery.toLowerCase()))
		)
	);

	const filteredGroupMembers = $derived(
		groupMembers.filter(m =>
			m.username.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
			(m.real_name && m.real_name.toLowerCase().includes(memberSearchQuery.toLowerCase())) ||
			(m.primary_group && m.primary_group.toLowerCase().includes(memberSearchQuery.toLowerCase()))
		)
	);

	function getGroupBadge(type) {
		switch(type) {
			case 'dynamic':
				return { label: '자동 연산 (Dynamic)', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'ph:lightning-bold' };
			case 'manual':
				return { label: '수동 타겟 (Manual)', bg: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'ph:pencil-simple-line-bold' };
			case 'combined':
				return { label: '연산된 그룹 (Combined)', bg: 'bg-purple-50 text-purple-700 border-purple-200', icon: 'ph:intersect-bold' };
			default:
				return { label: '일반', bg: 'bg-slate-50 text-slate-700 border-slate-200', icon: 'ph:users-bold' };
		}
	}
</script>

<svelte:head>
	<title>{getSiteTitle('임시·타겟 그룹 관리')}</title>
</svelte:head>

<div class="mx-auto max-w-7xl space-y-8 px-4 pb-24 font-['Outfit','Noto_Sans_KR'] md:px-8">
	<!-- 🏛️ 모던 엔터프라이즈 통합 헤더 규격 (새로고침과 관리자 홈은 필수 기본값) -->
	<header class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end">
		<div>
			<div class="flex items-center gap-2 mb-2">
				<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200">
					<Icon icon="ph:broadcast-bold" class="text-sm" />
					SYSTEM GOVERNANCE • MESSAGING TARGET
				</span>
				<span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 font-mono">
					🕒 DAILY 07:00 AUTO SYNC
				</span>
			</div>
			<h1 class="text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
				임시·<span class="text-amber-600">타겟 그룹 관리</span>
			</h1>
			<p class="mt-2 text-sm font-bold text-slate-500">
				매일 아침 07:00 배차·휴무 데이터 기반으로 자동 생성되며, 공지·지시 및 푸시 발송 시 대상을 핀포인트 타겟팅합니다.
			</p>
		</div>

		<!-- 상단 헤더 액션 버튼 모음 (새로고침과 관리자 홈은 필수 기본값) -->
		<div class="flex flex-wrap items-center gap-3">
			<button 
				onclick={handleRefreshDynamic}
				disabled={isRefreshing}
				class="flex items-center gap-2 px-5 py-2.5 rounded-2xl border-2 border-emerald-600 bg-emerald-50 text-emerald-700 font-black text-xs uppercase tracking-wider hover:bg-emerald-600 hover:text-white transition-all shadow-sm"
				title="배차가 긴급 변경되었거나 당일 재배정 시 즉시 동적 그룹을 재연산합니다."
			>
				<Icon icon="ph:lightning-bold" class="text-base {isRefreshing ? 'animate-spin' : ''}" />
				<span>{isRefreshing ? '긴급 연산 중...' : '긴급 수동 재연산'}</span>
			</button>

			<button 
				onclick={() => { fetchGroups(); fetchUsers(); toast.info('그룹 현황을 새로고침했습니다.'); }}
				class="flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 border-slate-200 bg-white font-black text-xs uppercase tracking-wider text-slate-700 hover:border-amber-500 hover:text-amber-600 transition-all shadow-sm"
			>
				<Icon icon="ph:arrows-clockwise-bold" class="text-base {loading ? 'animate-spin' : ''}" />
				<span>새로고침</span>
			</button>

			<a
				href="/v1/admin"
				class="flex items-center gap-2 px-4 py-2.5 rounded-2xl border-2 border-slate-200 bg-white font-black text-xs uppercase tracking-wider text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-all shadow-sm"
			>
				<Icon icon="solar:home-smile-angle-bold-duotone" class="text-base text-slate-500" />
				<span>관리자 홈</span>
			</a>
		</div>
	</header>

	<!-- 📊 전사 표준 4대 핵심 관제 지표 요약 카드 -->
	<section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
		<!-- 카드 1: 전체 타겟 그룹 -->
		<button 
			onclick={() => { activeTab = 'list'; listFilterCategory = 'all'; }}
			class="text-left relative overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white p-6 shadow-sm hover:border-indigo-300 transition-all group"
		>
			<div class="flex items-center justify-between mb-4">
				<span class="text-[11px] font-black tracking-widest uppercase text-slate-400 group-hover:text-indigo-600">Total Targets</span>
				<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:users-three-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : groups.length.toLocaleString()}
				<span class="text-sm font-bold text-slate-400 ml-1">개 그룹</span>
			</div>
			<div class="mt-3 flex items-center gap-2 text-xs font-bold text-indigo-600">
				<span class="rounded-lg bg-indigo-50 px-2 py-0.5 font-mono">{totalTargetsCount.toLocaleString()}명</span>
				<span class="text-slate-400">누적 타겟 대상</span>
			</div>
		</button>

		<!-- 카드 2: 실시간 자동 연산 그룹 (Dynamic) -->
		<button 
			onclick={() => { activeTab = 'list'; listFilterCategory = 'dynamic'; }}
			class="text-left relative overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white p-6 shadow-sm hover:border-emerald-300 transition-all group"
		>
			<div class="flex items-center justify-between mb-4">
				<span class="text-[11px] font-black tracking-widest uppercase text-slate-400 group-hover:text-emerald-600">자동 타겟 (Dynamic)</span>
				<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:lightning-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : dynamicGroups.length.toLocaleString()}
				<span class="text-sm font-bold text-slate-400 ml-1">개 그룹</span>
			</div>
			<div class="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-600">
				<span class="rounded-lg bg-emerald-50 px-2 py-0.5 font-mono">매일 07:00</span>
				<span class="text-slate-400">정기 자율 연산</span>
			</div>
		</button>

		<!-- 카드 3: 수동 지정 그룹 (Manual) -->
		<button 
			onclick={() => { activeTab = 'list'; listFilterCategory = 'manual'; }}
			class="text-left relative overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white p-6 shadow-sm hover:border-amber-300 transition-all group"
		>
			<div class="flex items-center justify-between mb-4">
				<span class="text-[11px] font-black tracking-widest uppercase text-slate-400 group-hover:text-amber-600">수동 타겟 (Manual)</span>
				<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:pencil-simple-line-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : manualGroups.length.toLocaleString()}
				<span class="text-sm font-bold text-slate-400 ml-1">개 그룹</span>
			</div>
			<div class="mt-3 flex items-center gap-2 text-xs font-bold text-amber-600">
				<span class="rounded-lg bg-amber-50 px-2 py-0.5 font-mono">관리자 지정</span>
				<span class="text-slate-400">수동 명부 보관</span>
			</div>
		</button>

		<!-- 카드 4: 연산된 그룹 (Combined) -->
		<button 
			onclick={() => { activeTab = 'list'; listFilterCategory = 'combined'; }}
			class="text-left relative overflow-hidden rounded-[2rem] border-2 border-slate-100 bg-white p-6 shadow-sm hover:border-purple-300 transition-all group"
		>
			<div class="flex items-center justify-between mb-4">
				<span class="text-[11px] font-black tracking-widest uppercase text-slate-400 group-hover:text-purple-600">연산된 그룹 (Combined)</span>
				<div class="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:intersect-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">
				{loading ? '...' : combinedGroups.length.toLocaleString()}
				<span class="text-sm font-bold text-slate-400 ml-1">개 그룹</span>
			</div>
			<div class="mt-3 flex items-center gap-2 text-xs font-bold text-purple-600">
				<span class="rounded-lg bg-purple-50 px-2 py-0.5 font-mono">집합 연산</span>
				<span class="text-slate-400">교·차·합집합</span>
			</div>
		</button>
	</section>

	<!-- 🗂️ 3대 핵심 모드 탭 -->
	<nav class="flex gap-2 border-b-2 border-slate-200 overflow-x-auto no-scrollbar">
		<button 
			onclick={() => activeTab = 'list'}
			class="px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeTab === 'list' ? 'border-b-4 border-amber-600 text-amber-700 bg-amber-50/50 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
		>
			타겟 그룹 명부 ({groups.length})
		</button>
		<button 
			onclick={() => activeTab = 'manual'}
			class="px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeTab === 'manual' ? 'border-b-4 border-amber-600 text-amber-700 bg-amber-50/50 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
		>
			수동 타겟 생성
		</button>
		<button 
			onclick={() => activeTab = 'combine'}
			class="px-6 py-4 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeTab === 'combine' ? 'border-b-4 border-amber-600 text-amber-700 bg-amber-50/50 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
		>
			그룹 집합 연산 (교·차·합집합)
		</button>
	</nav>

	{#if loading}
		<div class="flex justify-center py-20">
			<div class="flex flex-col items-center gap-3">
				<div class="h-10 w-10 animate-spin rounded-full border-4 border-amber-600 border-t-transparent"></div>
				<p class="text-xs font-bold text-slate-400 font-mono">Redis 그룹 데이터 동기화 중...</p>
			</div>
		</div>
	{:else}
		{#if activeTab === 'list'}
			<!-- 1. 타겟 그룹 명부 뷰 (구분된 섹션 및 서브 필터 지원) -->
			<div class="space-y-6" in:fade>
				<!-- 서브 카테고리 필터 바 -->
				<div class="flex flex-wrap items-center justify-between gap-3 bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
					<div class="flex items-center gap-2">
						<span class="text-xs font-black text-slate-500 uppercase tracking-wider mr-1">분류 필터:</span>
						<button 
							onclick={() => listFilterCategory = 'all'}
							class="px-3.5 py-1.5 rounded-xl text-xs font-black transition-all {listFilterCategory === 'all' ? 'bg-slate-900 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-200/60'}"
						>
							전체 보기 ({groups.length})
						</button>
						<button 
							onclick={() => listFilterCategory = 'dynamic'}
							class="px-3.5 py-1.5 rounded-xl text-xs font-black transition-all {listFilterCategory === 'dynamic' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50'}"
						>
							⚡ 자동 타겟 ({dynamicGroups.length})
						</button>
						<button 
							onclick={() => listFilterCategory = 'manual'}
							class="px-3.5 py-1.5 rounded-xl text-xs font-black transition-all {listFilterCategory === 'manual' ? 'bg-amber-600 text-white shadow-sm' : 'bg-white text-amber-700 border border-amber-200 hover:bg-amber-50'}"
						>
							✍️ 수동 타겟 ({manualGroups.length})
						</button>
						<button 
							onclick={() => listFilterCategory = 'combined'}
							class="px-3.5 py-1.5 rounded-xl text-xs font-black transition-all {listFilterCategory === 'combined' ? 'bg-purple-600 text-white shadow-sm' : 'bg-white text-purple-700 border border-purple-200 hover:bg-purple-50'}"
						>
							🧩 연산된 그룹 ({combinedGroups.length})
						</button>
					</div>

					<div class="text-[11px] font-bold text-slate-500 font-mono flex items-center gap-1.5">
						<Icon icon="ph:clock-clockwise-bold" class="text-emerald-600 text-sm" />
						<span>매일 아침 07:00 배차 기준 정기 자율 갱신</span>
					</div>
				</div>

				<!-- 섹션 1: 실시간 자동 연산 그룹 (Dynamic) -->
				{#if listFilterCategory === 'all' || listFilterCategory === 'dynamic'}
					<section class="space-y-3">
						<div class="flex items-center gap-2 px-1">
							<div class="h-3 w-3 rounded-full bg-emerald-500"></div>
							<h3 class="text-sm font-black text-slate-800 uppercase tracking-tight">
								⚡ 자동 타겟 그룹 (Dynamic Targets)
							</h3>
							<span class="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md font-mono">
								{dynamicGroups.length}건
							</span>
							<span class="text-[11px] text-slate-400 ml-auto font-mono">정기 갱신: 매일 아침 07:00</span>
						</div>

						<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{#each dynamicGroups as group}
								{@const badge = getGroupBadge(group.type)}
								<div class="relative overflow-hidden rounded-[2rem] border-2 border-emerald-100 bg-white p-6 shadow-sm hover:border-emerald-400 hover:shadow-lg transition-all flex flex-col justify-between">
									<div>
										<div class="flex items-center justify-between mb-3">
											<span class="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border {badge.bg}">
												<Icon icon={badge.icon} class="text-xs" />
												{badge.label}
											</span>
											<span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg font-mono">
												<Icon icon="ph:clock-bold" class="text-xs text-emerald-600" />
												{formatDateTime(group.updated_at || group.created_at)} 갱신
											</span>
										</div>

										<h3 class="text-lg font-black text-slate-900 tracking-tight break-all">
											{group.name}
										</h3>
										<p class="mt-1 text-xs font-bold text-slate-500 leading-relaxed min-h-[2.5rem]">
											{group.desc || '설명 없음'}
										</p>
									</div>

									<div class="mt-5 pt-4 border-t border-emerald-50 flex items-center justify-between">
										<button 
											onclick={() => openMembersModal(group)}
											class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 font-black text-xs transition-colors border border-slate-200 hover:border-emerald-300 group"
										>
											<Icon icon="ph:users-bold" class="text-base text-slate-400 group-hover:text-emerald-600" />
											<span>{group.count}명</span>
											<span class="text-[9px] text-slate-400 group-hover:text-emerald-600 underline ml-0.5">명단</span>
										</button>

										<a
											href="/v1/admin/alerts?target_group={encodeURIComponent(group.name)}"
											class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-emerald-600 transition-all shadow-sm"
										>
											<Icon icon="ph:paper-plane-tilt-bold" class="text-sm" />
											<span>알림 발송</span>
										</a>
									</div>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				<!-- 섹션 2: 수동 지정 타겟 그룹 (Manual) -->
				{#if listFilterCategory === 'all' || listFilterCategory === 'manual'}
					<section class="space-y-3 pt-2">
						<div class="flex items-center gap-2 px-1">
							<div class="h-3 w-3 rounded-full bg-amber-500"></div>
							<h3 class="text-sm font-black text-slate-800 uppercase tracking-tight">
								✍️ 수동 지정 타겟 그룹 (Manual Targets)
							</h3>
							<span class="text-xs font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md font-mono">
								{manualGroups.length}건
							</span>
							<span class="text-[11px] text-slate-400 ml-auto font-mono">관리자 지정 타겟 명부</span>
						</div>

						{#if manualGroups.length === 0}
							<div class="py-8 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-white">
								<p class="text-xs font-bold text-slate-400">등록된 수동 지정 그룹이 없습니다. 상단 '수동 타겟 생성' 탭에서 새 그룹을 만들어 보세요.</p>
							</div>
						{:else}
							<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{#each manualGroups as group}
									{@const badge = getGroupBadge(group.type)}
									<div class="relative overflow-hidden rounded-[2rem] border-2 border-amber-100 bg-white p-6 shadow-sm hover:border-amber-400 hover:shadow-lg transition-all flex flex-col justify-between">
										<div>
											<div class="flex items-center justify-between mb-3">
												<span class="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border {badge.bg}">
													<Icon icon={badge.icon} class="text-xs" />
													{badge.label}
												</span>
												<div class="flex items-center gap-1.5">
													<span class="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-lg font-mono">
														<Icon icon="ph:calendar-blank-bold" class="text-xs text-amber-600" />
														{formatDateTime(group.created_at || group.updated_at)} 생성
													</span>
													<button 
														class="h-7 w-7 rounded-full flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors" 
														onclick={() => openDeleteModal(group)}
														title="그룹 삭제"
													>
														<Icon icon="ph:trash-bold" class="text-sm" />
													</button>
												</div>
											</div>

											<h3 class="text-lg font-black text-slate-900 tracking-tight break-all">
												{group.name}
											</h3>
											<p class="mt-1 text-xs font-bold text-slate-500 leading-relaxed min-h-[2.5rem]">
												{group.desc || '설명 없음'}
											</p>
										</div>

										<div class="mt-5 pt-4 border-t border-amber-50 flex items-center justify-between">
											<button 
												onclick={() => openMembersModal(group)}
												class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-amber-50 text-slate-700 hover:text-amber-700 font-black text-xs transition-colors border border-slate-200 hover:border-amber-300 group"
											>
												<Icon icon="ph:users-bold" class="text-base text-slate-400 group-hover:text-amber-600" />
												<span>{group.count}명</span>
												<span class="text-[9px] text-slate-400 group-hover:text-amber-600 underline ml-0.5">명단</span>
											</button>

											<a
												href="/v1/admin/alerts?target_group={encodeURIComponent(group.name)}"
												class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-amber-600 transition-all shadow-sm"
											>
												<Icon icon="ph:paper-plane-tilt-bold" class="text-sm" />
												<span>알림 발송</span>
											</a>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</section>
				{/if}

				<!-- 섹션 3: 연산된 그룹 (Combined) -->
				{#if listFilterCategory === 'all' || listFilterCategory === 'combined'}
					<section class="space-y-3 pt-2">
						<div class="flex items-center gap-2 px-1">
							<div class="h-3 w-3 rounded-full bg-purple-500"></div>
							<h3 class="text-sm font-black text-slate-800 uppercase tracking-tight">
								🧩 연산된 그룹 (Combined Targets)
							</h3>
							<span class="text-xs font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md font-mono">
								{combinedGroups.length}건
							</span>
							<span class="text-[11px] text-slate-400 ml-auto font-mono">실시간 집합 연산 결과</span>
						</div>

						{#if combinedGroups.length === 0}
							<div class="py-8 text-center rounded-2xl border-2 border-dashed border-slate-200 bg-white">
								<p class="text-xs font-bold text-slate-400">등록된 집합 연산 그룹이 없습니다. 상단 '그룹 집합 연산' 탭에서 교·차·합집합 그룹을 생성해 보세요.</p>
							</div>
						{:else}
							<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
								{#each combinedGroups as group}
									{@const badge = getGroupBadge(group.type)}
									<div class="relative overflow-hidden rounded-[2rem] border-2 border-purple-100 bg-white p-6 shadow-sm hover:border-purple-400 hover:shadow-lg transition-all flex flex-col justify-between">
										<div>
											<div class="flex items-center justify-between mb-3">
												<span class="inline-flex items-center gap-1 text-[10px] font-black uppercase px-2.5 py-1 rounded-full border {badge.bg}">
													<Icon icon={badge.icon} class="text-xs" />
													{badge.label}
												</span>
												<div class="flex items-center gap-1.5">
													<span class="inline-flex items-center gap-1 text-[11px] font-bold text-purple-800 bg-purple-50 px-2.5 py-1 rounded-lg font-mono">
														<Icon icon="ph:calendar-blank-bold" class="text-xs text-purple-600" />
														{formatDateTime(group.created_at || group.updated_at)} 연산
													</span>
													<button 
														class="h-7 w-7 rounded-full flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition-colors" 
														onclick={() => openDeleteModal(group)}
														title="그룹 삭제"
													>
														<Icon icon="ph:trash-bold" class="text-sm" />
													</button>
												</div>
											</div>

											<h3 class="text-lg font-black text-slate-900 tracking-tight break-all">
												{group.name}
											</h3>
											<p class="mt-1 text-xs font-bold text-slate-500 leading-relaxed min-h-[2.5rem]">
												{group.desc || '설명 없음'}
											</p>
										</div>

										<div class="mt-5 pt-4 border-t border-purple-50 flex items-center justify-between">
											<button 
												onclick={() => openMembersModal(group)}
												class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purple-700 font-black text-xs transition-colors border border-slate-200 hover:border-purple-300 group"
											>
												<Icon icon="ph:users-bold" class="text-base text-slate-400 group-hover:text-purple-600" />
												<span>{group.count}명</span>
												<span class="text-[9px] text-slate-400 group-hover:text-purple-600 underline ml-0.5">명단</span>
											</button>

											<a
												href="/v1/admin/alerts?target_group={encodeURIComponent(group.name)}"
												class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 text-white font-black text-xs hover:bg-purple-600 transition-all shadow-sm"
											>
												<Icon icon="ph:paper-plane-tilt-bold" class="text-sm" />
												<span>알림 발송</span>
											</a>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</section>
				{/if}
			</div>

		{:else if activeTab === 'manual'}
			<!-- 2. 수동 그룹 생성 뷰 -->
			<div class="rounded-[2.5rem] border-2 border-slate-100 bg-white p-8 shadow-sm space-y-6" in:slide>
				<div>
					<h3 class="text-xl font-black text-slate-900 tracking-tight">수동 타겟 그룹 생성</h3>
					<p class="text-xs font-bold text-slate-400 mt-1">공지·지시를 수신할 특정 사원들을 직접 선택하여 고정 타겟 그룹으로 등록합니다.</p>
				</div>

				<div class="space-y-4">
					<div>
						<label for="manual-name" class="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">그룹 이름</label>
						<input 
							id="manual-name"
							type="text" 
							bind:value={manualGroupName} 
							placeholder="예: 202번_오전_운행기사, 야간_긴급정비반 등" 
							class="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-amber-500 outline-none transition-all font-bold text-slate-800 text-sm"
						/>
					</div>

					<div>
						<div class="flex items-center justify-between mb-2">
							<span class="text-xs font-black text-slate-600 uppercase tracking-wider">
								사원 선택 ({selectedUserIds.length}명 선택됨)
							</span>
							{#if selectedUserIds.length > 0}
								<button 
									onclick={() => selectedUserIds = []} 
									class="text-[11px] font-bold text-rose-600 hover:underline"
								>
									선택 초기화
								</button>
							{/if}
						</div>

						<div class="mb-3">
							<input 
								type="text" 
								bind:value={userSearchQuery} 
								placeholder="이름, 아이디, 소속 부서로 사원 검색..." 
								class="w-full px-4 py-2.5 bg-white border-2 border-slate-200 rounded-xl focus:border-amber-500 outline-none text-xs font-bold text-slate-700"
							/>
						</div>

						<div class="h-72 overflow-y-auto border-2 border-slate-100 rounded-2xl p-3 space-y-1.5 bg-slate-50/50">
							{#each filteredUsers as user}
								<label class="flex items-center justify-between p-2.5 hover:bg-white rounded-xl cursor-pointer transition-colors border border-transparent hover:border-slate-200">
									<div class="flex items-center gap-3">
										<input 
											type="checkbox" 
											class="checkbox checkbox-sm checkbox-warning rounded-lg" 
											bind:group={selectedUserIds} 
											value={user.id} 
										/>
										<div>
											<span class="font-black text-xs text-slate-800">{user.real_name || user.username}</span>
											<span class="text-[10px] text-slate-400 font-mono ml-1">@{user.username}</span>
										</div>
									</div>
									<span class="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
										{user.primary_group || '소속없음'}
									</span>
								</label>
							{/each}
						</div>
					</div>
				</div>

				<div class="flex justify-end pt-4 border-t border-slate-100">
					<button 
						onclick={handleCreateManual} 
						disabled={isCreatingManual}
						class="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-amber-600 text-white font-black hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 text-xs uppercase tracking-wider"
					>
						<Icon icon="ph:floppy-disk-bold" class="text-base" />
						<span>{isCreatingManual ? '저장 중...' : '수동 타겟 그룹 저장'}</span>
					</button>
				</div>
			</div>

		{:else if activeTab === 'combine'}
			<!-- 3. 집합 연산 뷰 -->
			<div class="rounded-[2.5rem] border-2 border-slate-100 bg-white p-8 shadow-sm space-y-6" in:slide>
				<div>
					<h3 class="text-xl font-black text-slate-900 tracking-tight">그룹 집합 연산 (Smart Combination)</h3>
					<p class="text-xs font-bold text-slate-400 mt-1">기존 타겟 그룹들을 교집합(∩), 차집합(-), 합집합(∪)으로 합성하여 정밀한 타겟을 생성합니다.</p>
				</div>

				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div class="space-y-5">
						<div>
							<label for="combine-name" class="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">새 결과 그룹 이름</label>
							<input 
								id="combine-name"
								type="text" 
								bind:value={combineResultName} 
								placeholder="예: 오늘출근_시내버스_기사, 휴무자제외_배차기사 등" 
								class="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-amber-500 outline-none text-sm font-bold text-slate-800"
							/>
						</div>

						<div>
							<span class="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">연산 방식 선택</span>
							<div class="grid grid-cols-3 gap-2">
								<button 
									onclick={() => combineOp = 'INTERSECT'}
									class="flex flex-col items-center p-3 rounded-2xl border-2 transition-all {combineOp === 'INTERSECT' ? 'border-amber-600 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}"
								>
									<Icon icon="ph:intersect-bold" class="text-xl mb-1" />
									<span class="text-xs font-black">교집합 (∩)</span>
									<span class="text-[9px] text-slate-400 mt-0.5">양쪽 공통 인원</span>
								</button>
								<button 
									onclick={() => combineOp = 'DIFF'}
									class="flex flex-col items-center p-3 rounded-2xl border-2 transition-all {combineOp === 'DIFF' ? 'border-amber-600 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}"
								>
									<Icon icon="ph:minus-circle-bold" class="text-xl mb-1" />
									<span class="text-xs font-black">차집합 (−)</span>
									<span class="text-[9px] text-slate-400 mt-0.5">기준에서 제외</span>
								</button>
								<button 
									onclick={() => combineOp = 'UNION'}
									class="flex flex-col items-center p-3 rounded-2xl border-2 transition-all {combineOp === 'UNION' ? 'border-amber-600 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}"
								>
									<Icon icon="ph:plus-circle-bold" class="text-xl mb-1" />
									<span class="text-xs font-black">합집합 (∪)</span>
									<span class="text-[9px] text-slate-400 mt-0.5">모두 합침</span>
								</button>
							</div>
						</div>
					</div>

					<div class="space-y-5">
						<div>
							<label for="base-group" class="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">기준 그룹 (A)</label>
							<select 
								id="base-group"
								bind:value={baseGroup} 
								class="w-full px-4 py-3 bg-slate-50 border-2 border-slate-200 rounded-2xl focus:border-amber-500 outline-none text-xs font-bold text-slate-800"
							>
								<option value="" disabled selected>기준이 될 그룹을 선택하세요</option>
								{#each groups as g}
									<option value={g.name}>{g.name} ({g.count}명) - [{g.type}]</option>
								{/each}
							</select>
						</div>

						<div>
							<span class="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
								대상 그룹들 (B) ({targetGroups.length}개 선택됨)
							</span>
							<div class="h-44 overflow-y-auto border-2 border-slate-100 rounded-2xl p-3 space-y-1 bg-slate-50/50">
								{#each groups.filter(g => g.name !== baseGroup) as g}
									<label class="flex items-center justify-between p-2 hover:bg-white rounded-xl cursor-pointer text-xs transition-colors border border-transparent hover:border-slate-200">
										<div class="flex items-center gap-2">
											<input 
												type="checkbox" 
												class="checkbox checkbox-xs checkbox-warning rounded" 
												bind:group={targetGroups} 
												value={g.name} 
											/>
											<span class="font-bold text-slate-800">{g.name}</span>
										</div>
										<span class="font-mono text-slate-400 text-[10px]">{g.count}명</span>
									</label>
								{/each}
							</div>
						</div>
					</div>
				</div>

				<div class="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 text-xs font-bold text-amber-900 leading-relaxed flex items-center gap-2">
					<Icon icon="ph:info-bold" class="text-lg text-amber-600 flex-shrink-0" />
					{#if combineOp === 'INTERSECT'}
						<span><strong>교집합(∩) 연산:</strong> 기준 그룹과 대상 그룹에 <strong>모두 포함된 사원만</strong> 추출합니다. (예: 오늘출근자 ∩ 202번기사 = 오늘 202번에 출근한 기사)</span>
					{:else if combineOp === 'DIFF'}
						<span><strong>차집합(−) 연산:</strong> 기준 그룹에서 대상 그룹에 속한 사원을 <strong>제외</strong>합니다. (예: 시내버스기사 − 오늘출근자 = 오늘 쉬는 시내버스 기사)</span>
					{:else}
						<span><strong>합집합(∪) 연산:</strong> 선택된 모든 그룹의 사원을 <strong>하나로 합칩니다</strong>. (중복 사원은 자동 1명으로 통합)</span>
					{/if}
				</div>

				<div class="flex justify-end pt-4 border-t border-slate-100">
					<button 
						onclick={handleCombine} 
						disabled={isCombining}
						class="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-amber-600 text-white font-black hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 text-xs uppercase tracking-wider"
					>
						<Icon icon="ph:function-bold" class="text-base" />
						<span>{isCombining ? '연산 중...' : '연산 실행 및 타겟 그룹 생성'}</span>
					</button>
				</div>
			</div>
		{/if}
	{/if}
</div>

<!-- 👥 소속 사원 명단 확인 모달 -->
{#if isMembersModalOpen && activeGroupForMembers}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" transition:fade>
		<div class="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 p-7" in:fly={{ y: 20 }}>
			<div class="flex items-center justify-between mb-5">
				<div class="flex items-center gap-3">
					<div class="p-3 bg-amber-50 rounded-2xl text-amber-600">
						<Icon icon="ph:users-bold" class="text-2xl" />
					</div>
					<div>
						<h3 class="text-lg font-black text-slate-900 tracking-tight break-all">
							{activeGroupForMembers.name}
						</h3>
						<p class="text-xs font-bold text-slate-400">
							총 {groupMembers.length}명의 소속 사원이 등록되어 있습니다.
						</p>
					</div>
				</div>
				<button 
					class="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-black hover:bg-slate-200 transition-colors"
					onclick={() => isMembersModalOpen = false}
				>
					<Icon icon="ph:x-bold" class="text-base" />
				</button>
			</div>

			<div class="mb-4">
				<input 
					type="text" 
					bind:value={memberSearchQuery} 
					placeholder="이름, 아이디, 소속 부서 검색..." 
					class="w-full px-4 py-2.5 bg-slate-50 border-2 border-slate-200 rounded-xl focus:border-amber-500 outline-none text-xs font-bold text-slate-700"
				/>
			</div>

			{#if isLoadingMembers}
				<div class="flex h-56 items-center justify-center">
					<div class="flex flex-col items-center gap-2">
						<div class="h-8 w-8 animate-spin rounded-full border-3 border-amber-600 border-t-transparent"></div>
						<span class="text-xs font-bold text-slate-400">명단 로딩 중...</span>
					</div>
				</div>
			{:else}
				<div class="h-72 overflow-y-auto divide-y divide-slate-100 border-2 border-slate-100 rounded-2xl p-2 bg-slate-50/50">
					{#if filteredGroupMembers.length === 0}
						<div class="flex h-full items-center justify-center text-xs font-bold text-slate-400">
							일치하는 사원이 없습니다.
						</div>
					{:else}
						{#each filteredGroupMembers as member}
							<div class="flex items-center justify-between p-3 hover:bg-white rounded-xl transition-colors">
								<div>
									<div class="flex items-center gap-2">
										<span class="font-black text-xs text-slate-900">{member.real_name}</span>
										<span class="text-[10px] text-slate-400 font-mono">@{member.username}</span>
									</div>
									<span class="text-[10px] font-bold text-slate-500">
										{member.primary_group}
									</span>
								</div>
								<span class="text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono">
									Lv.{member.rank_level}
								</span>
							</div>
						{/each}
					{/if}
				</div>
			{/if}

			<div class="mt-6 flex justify-end">
				<button 
					onclick={() => isMembersModalOpen = false}
					class="px-6 py-2.5 rounded-xl bg-slate-900 text-white font-black text-xs uppercase tracking-wider hover:bg-amber-600 transition-colors"
				>
					닫기
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- 🗑️ 그룹 삭제 확인 모달 -->
{#if isDeleteModalOpen && groupToDelete}
	<div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" transition:fade>
		<div class="bg-white rounded-[2rem] shadow-2xl w-full max-w-md overflow-hidden border border-slate-100 p-7" in:fly={{ y: 20 }}>
			<div class="flex items-center gap-3 mb-5">
				<div class="p-3 bg-rose-100 rounded-2xl text-rose-600">
					<Icon icon="ph:trash-bold" class="text-2xl" />
				</div>
				<div>
					<h3 class="text-lg font-black text-slate-900 uppercase">타겟 그룹 삭제</h3>
					<p class="text-xs font-bold text-slate-400">Redis 메모리에서 그룹 메타데이터와 명부를 제거합니다.</p>
				</div>
			</div>

			<div class="p-4 bg-rose-50/60 rounded-2xl border border-rose-100 text-xs font-bold text-slate-700 space-y-1">
				<p>삭제 대상 그룹: <span class="text-rose-600 font-black">'{groupToDelete.name}'</span></p>
				<p class="text-[11px] text-slate-500">
					• 이 그룹에 발송 예약된 알림이 있을 경우 발송에 영향을 줄 수 있습니다.<br>
					• 동적 그룹(Dynamic)은 다음 실시간 연산 시 다시 재생성될 수 있습니다.
				</p>
			</div>

			<div class="flex gap-3 mt-6">
				<button 
					onclick={() => isDeleteModalOpen = false} 
					class="flex-1 py-3 rounded-xl border-2 border-slate-200 font-black text-slate-500 hover:bg-slate-50 transition-all text-xs uppercase tracking-wider"
					disabled={isDeleting}
				>
					취소
				</button>
				<button 
					onclick={handleDelete} 
					class="flex-1 py-3 rounded-xl bg-rose-600 text-white font-black hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 text-xs uppercase tracking-wider"
					disabled={isDeleting}
				>
					{isDeleting ? '삭제 중...' : '그룹 영구 삭제'}
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	:global(body) { background-color: #fcfcfc; }
	.no-scrollbar::-webkit-scrollbar { display: none; }
	.no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
</style>
