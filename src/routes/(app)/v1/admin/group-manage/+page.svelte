<script>
	/**
	 * @file (app)/v1/admin/group-manage/+page.svelte
	 * @description [코어 조직·권한 관제] 3대 뷰 (그룹 뷰 / 사용자 뷰 / 앱 뷰) 통합 관리 화면
	 */
	import { onMount } from 'svelte';
	import { fade, slide, scale } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import { alertState } from '$lib/runes/alert.svelte.js';

	// =========================================================================
	// 📌 1. 상태 관리 (Svelte 5 Runes)
	// =========================================================================

	// 메인 3대 뷰 탭: 'group' (그룹 뷰) | 'user' (사용자 뷰) | 'app' (앱 뷰)
	let activeMainTab = $state('group');

	// 그룹 뷰 내 서브 탭: 'primary' (주그룹 관리) | 'secondary' (부그룹 관리)
	let activeGroupSubTab = $state('primary');

	// 검색어 상태
	let groupSearchQuery = $state('');
	let userSearchQuery = $state('');
	let appSearchQuery = $state('');

	// -------------------------------------------------------------------------
	// 📂 2. 마스터 데이터 (DB 연동 대비 목업 상태)
	// -------------------------------------------------------------------------

	// A. 주그룹(Primary Groups) - 리눅스 gid 개념, 1인당 최대 1개, 본소속 부서/팀
	let primaryGroups = $state([
		{
			id: 1,
			code: '운수1팀',
			name: '운수 1팀 (시내간선)',
			description: '제주시 도심 간선 및 순환 노선 운행 승무원 소속 본부',
			created_at: '2026-10-20'
		},
		{
			id: 2,
			code: '운수2팀',
			name: '운수 2팀 (지선/순환)',
			description: '읍면 지선 및 마을버스 운행 승무원 소속 본부',
			created_at: '2026-10-21'
		},
		{
			id: 3,
			code: '정비팀',
			name: '차량 정비/검사팀',
			description: '차량 예방 점검 및 긴급 고장 수리 지원 기술 부서',
			created_at: '2026-10-22'
		},
		{
			id: 4,
			code: '인사총무',
			name: '인사총무팀',
			description: '인사 고과, 결근계/휴무 승인 및 급여 관리 본사 조직',
			created_at: '2026-10-23'
		}
	]);

	// B. 부그룹(Secondary Groups) - 리눅스 보조 groups 개념, 복수 가능, 직무·특권 또는 제재/블랙리스트
	let secondaryGroups = $state([
		{
			id: 11,
			code: '배차담당',
			name: '배차운영담당',
			description: '일일 차량 배차 편성 및 실시간 시간표 조정 특권 직무 (Allow용)',
			category: 'PRIVILEGE', // 'PRIVILEGE'(특권) | 'RESTRICTION'(제재/차단) | 'GENERAL'(일반)
			created_at: '2026-10-22'
		},
		{
			id: 12,
			code: '안전위원',
			name: '안전보건 점검위원',
			description: '노선 및 차량 안전 수칙 불시 점검 및 사고 조사 권한 (Allow용)',
			category: 'PRIVILEGE',
			created_at: '2026-10-25'
		},
		{
			id: 13,
			code: '휴직자',
			name: '휴직/운행정지 대상자',
			description: '병가, 정직, 면허정지 등 업무 앱 접근을 원천 차단하는 블랙리스트 (Deny용)',
			category: 'RESTRICTION',
			created_at: '2026-10-26'
		},
		{
			id: 14,
			code: '외주점검',
			name: '외주 협력업체 요원',
			description: '외부 용역 인력으로 핵심 비즈니스 앱 접근 제한 그룹 (Deny용)',
			category: 'RESTRICTION',
			created_at: '2026-10-26'
		}
	]);

	// C. 사용자 목록 (Users)
	let users = $state([
		{
			id: 101,
			username: 'driver_kim',
			real_name: '김제주',
			rank_level: 1,
			primary_group: '운수1팀',
			secondary_groups: ['안전위원']
		},
		{
			id: 102,
			username: 'driver_park',
			real_name: '박서귀',
			rank_level: 1,
			primary_group: '운수1팀',
			secondary_groups: ['휴직자']
		},
		{
			id: 103,
			username: 'disp_lee',
			real_name: '이배차',
			rank_level: 2,
			primary_group: '운수1팀',
			secondary_groups: ['배차담당']
		},
		{
			id: 104,
			username: 'mech_choi',
			real_name: '최정비',
			rank_level: 2,
			primary_group: '정비팀',
			secondary_groups: []
		},
		{
			id: 105,
			username: 'hr_jung',
			real_name: '정총무',
			rank_level: 3,
			primary_group: '인사총무',
			secondary_groups: ['배차담당']
		},
		{
			id: 106,
			username: 'driver_kang',
			real_name: '강한라',
			rank_level: 1,
			primary_group: '운수2팀',
			secondary_groups: []
		},
		{
			id: 107,
			username: 'contract_oh',
			real_name: '오외주',
			rank_level: 1,
			primary_group: null,
			secondary_groups: ['외주점검']
		}
	]);

	// D. 앱 목록 (AppRegistry)
	let apps = $state([
		{
			app_id: 'dispatch',
			name: '차량 배차 관리',
			description: '실시간 노선별 차량 투입, 기사 배정 및 운행 시간표 조율',
			icon: 'mdi:bus-multiple',
			color: 'text-blue-600',
			min_read_rank: 1,
			min_write_rank: 4,
			allow_groups: ['배차담당'],
			deny_groups: ['휴직자', '외주점검']
		},
		{
			app_id: 'route_master',
			name: '노선 마스터 관리',
			description: '정규 및 임시 노선의 기준 버전 도면 및 회차 시간표 통합 관리',
			icon: 'mdi:bus-clock',
			color: 'text-indigo-600',
			min_read_rank: 1,
			min_write_rank: 4,
			allow_groups: ['배차담당'],
			deny_groups: ['외주점검']
		},
		{
			app_id: 'dayoff',
			name: '휴무(결근계) 관리',
			description: '직원 및 승무원의 연차/휴무 신청 내역 승인 및 관제',
			icon: 'mdi:calendar-check-outline',
			color: 'text-amber-600',
			min_read_rank: 1,
			min_write_rank: 3,
			allow_groups: ['인사총무'],
			deny_groups: ['휴직자']
		},
		{
			app_id: 'board',
			name: '사내 공지/게시판',
			description: '전사 공지사항 및 부서별 업무 게시판',
			icon: 'mdi:clipboard-text-outline',
			color: 'text-orange-600',
			min_read_rank: 1,
			min_write_rank: 2,
			allow_groups: [],
			deny_groups: []
		},
		{
			app_id: 'safety_check',
			name: '안전 점검 관제탑',
			description: '차량 점검일지 및 현장 불시 안전 점검 기록 관리',
			icon: 'mdi:shield-alert-outline',
			color: 'text-rose-600',
			min_read_rank: 1,
			min_write_rank: 4,
			allow_groups: ['안전위원', '정비팀'],
			deny_groups: ['휴직자']
		}
	]);

	// -------------------------------------------------------------------------
	// 🆕 3. 그룹 생성 모달 관련 상태
	// -------------------------------------------------------------------------
	let isCreateModalOpen = $state(false);
	let newGroupType = $state('primary'); // 'primary' | 'secondary'
	let newGroupCategory = $state('PRIVILEGE'); // 'PRIVILEGE' | 'RESTRICTION'
	let newGroupCode = $state('');
	let newGroupName = $state('');
	let newGroupDesc = $state('');

	// -------------------------------------------------------------------------
	// 📊 4. 파생 통계 및 헬퍼 ($derived)
	// -------------------------------------------------------------------------

	// 전체 그룹 코드 리스트 (유효성 검사 및 드롭다운용)
	let allGroupCodes = $derived([
		...primaryGroups.map(g => ({ code: g.code, name: g.name, type: '주그룹' })),
		...secondaryGroups.map(g => ({ code: g.code, name: g.name, type: '부그룹' }))
	]);

	// 주그룹별 배정된 회원 수 계산
	function getPrimaryGroupMemberCount(code) {
		return users.filter(u => u.primary_group === code).length;
	}

	// 부그룹별 보유한 회원 수 계산
	function getSecondaryGroupMemberCount(code) {
		return users.filter(u => u.secondary_groups.includes(code)).length;
	}

	// 특정 부그룹이 어느 앱에 allow/deny로 적용되어 있는지 검색
	function getGroupAppUsage(code) {
		const allowApps = apps.filter(a => a.allow_groups.includes(code)).map(a => a.name);
		const denyApps = apps.filter(a => a.deny_groups.includes(code)).map(a => a.name);
		return { allowApps, denyApps };
	}

	// 등급 라벨 헬퍼
	function getRankBadge(rank) {
		if (rank === 9) return { label: 'ROOT (Lv.9)', class: 'bg-red-600 text-white' };
		if (rank >= 4) return { label: `ADMIN (Lv.${rank})`, class: 'bg-indigo-600 text-white' };
		if (rank >= 2) return { label: `STAFF (Lv.${rank})`, class: 'bg-emerald-600 text-white' };
		if (rank === 1) return { label: `MEMBER (Lv.1)`, class: 'bg-blue-600 text-white' };
		return { label: `GUEST (Lv.0)`, class: 'bg-slate-200 text-slate-700' };
	}

	// -------------------------------------------------------------------------
	// ⚙️ 5. 액션 핸들러
	// -------------------------------------------------------------------------

	// 그룹 생성
	function handleCreateGroup() {
		if (!newGroupCode.trim() || !newGroupName.trim()) {
			alertState.send('그룹 식별 코드와 그룹 이름을 모두 입력해주세요.', { level: 2, style: 'warning' });
			return;
		}

		// 전체 코드 중복 검사
		const exists = allGroupCodes.some(g => g.code.toLowerCase() === newGroupCode.trim().toLowerCase());
		if (exists) {
			alertState.send('이미 존재하는 그룹 식별 코드입니다.', { level: 3, style: 'error' });
			return;
		}

		const newGroup = {
			id: Date.now(),
			code: newGroupCode.trim(),
			name: newGroupName.trim(),
			description: newGroupDesc.trim() || '설명 없음',
			created_at: new Date().toISOString().split('T')[0]
		};

		if (newGroupType === 'primary') {
			primaryGroups = [...primaryGroups, newGroup];
			activeGroupSubTab = 'primary';
			alertState.send(`새 주그룹 [${newGroup.name}]이(가) 등록되었습니다.`, { level: 1, style: 'success' });
		} else {
			newGroup.category = newGroupCategory;
			secondaryGroups = [...secondaryGroups, newGroup];
			activeGroupSubTab = 'secondary';
			alertState.send(`새 부그룹 [${newGroup.name}]이(가) 등록되었습니다.`, { level: 1, style: 'success' });
		}

		// 초기화
		newGroupCode = '';
		newGroupName = '';
		newGroupDesc = '';
		isCreateModalOpen = false;
	}

	// 주그룹 삭제
	function handleDeletePrimaryGroup(group) {
		const count = getPrimaryGroupMemberCount(group.code);
		if (count > 0) {
			if (!confirm(`⚠️ [${group.name}] 주그룹을 본소속으로 둔 회원이 ${count}명 있습니다.\n삭제 시 해당 회원들의 주그룹은 '미지정' 처리됩니다. 계속하시겠습니까?`)) {
				return;
			}
			users = users.map(u => u.primary_group === group.code ? { ...u, primary_group: null } : u);
		} else {
			if (!confirm(`'${group.name}' 주그룹을 삭제하시겠습니까?`)) return;
		}

		primaryGroups = primaryGroups.filter(g => g.id !== group.id);
		alertState.send(`주그룹 [${group.name}]이(가) 삭제되었습니다.`, { level: 1, style: 'info' });
	}

	// 부그룹 삭제
	function handleDeleteSecondaryGroup(group) {
		const count = getSecondaryGroupMemberCount(group.code);
		const usage = getGroupAppUsage(group.code);
		const appCount = usage.allowApps.length + usage.denyApps.length;

		let msg = `'${group.name}' 부그룹을 삭제하시겠습니까?`;
		if (count > 0 || appCount > 0) {
			msg = `⚠️ [${group.name}] 부그룹이 회원 ${count}명 및 앱 ${appCount}곳(허용:${usage.allowApps.length}, 차단:${usage.denyApps.length})에 설정되어 있습니다.\n삭제 시 모든 회원 및 앱 설정에서 자동 해제됩니다. 계속하시겠습니까?`;
			if (!confirm(msg)) return;
		} else {
			if (!confirm(msg)) return;
		}

		// 1. 회원들의 부그룹 목록에서 제거
		users = users.map(u => ({
			...u,
			secondary_groups: u.secondary_groups.filter(c => c !== group.code)
		}));

		// 2. 앱들의 allow/deny 목록에서 제거
		apps = apps.map(a => ({
			...a,
			allow_groups: a.allow_groups.filter(c => c !== group.code),
			deny_groups: a.deny_groups.filter(c => c !== group.code)
		}));

		secondaryGroups = secondaryGroups.filter(g => g.id !== group.id);
		alertState.send(`부그룹 [${group.name}]이(가) 삭제되었습니다.`, { level: 1, style: 'info' });
	}

	// 사용자 주그룹 변경
	function handleUserPrimaryChange(userId, newCode) {
		users = users.map(u => u.id === userId ? { ...u, primary_group: newCode || null } : u);
		alertState.send('사용자의 주그룹이 변경되었습니다.', { level: 1, style: 'success' });
	}

	// 사용자 부그룹 추가
	function handleUserAddSecondary(userId, code) {
		users = users.map(u => {
			if (u.id === userId) {
				if (!u.secondary_groups.includes(code)) {
					return { ...u, secondary_groups: [...u.secondary_groups, code] };
				}
			}
			return u;
		});
		alertState.send('부그룹이 추가되었습니다.', { level: 1, style: 'success' });
	}

	// 사용자 부그룹 제거
	function handleUserRemoveSecondary(userId, code) {
		users = users.map(u => {
			if (u.id === userId) {
				return { ...u, secondary_groups: u.secondary_groups.filter(c => c !== code) };
			}
			return u;
		});
		alertState.send('부그룹이 제거되었습니다.', { level: 1, style: 'info' });
	}

	// 앱 allow 그룹 추가
	function handleAppAddAllow(appId, code) {
		apps = apps.map(a => {
			if (a.app_id === appId) {
				// 이미 deny에 있다면 충돌 안내
				if (a.deny_groups.includes(code)) {
					alertState.send(`[${code}]는 이미 이 앱의 차단(deny) 목록에 있습니다. 차단을 먼저 해제해주세요.`, { level: 2, style: 'warning' });
					return a;
				}
				if (!a.allow_groups.includes(code)) {
					return { ...a, allow_groups: [...a.allow_groups, code] };
				}
			}
			return a;
		});
	}

	// 앱 allow 그룹 제거
	function handleAppRemoveAllow(appId, code) {
		apps = apps.map(a => a.app_id === appId ? { ...a, allow_groups: a.allow_groups.filter(c => c !== code) } : a);
	}

	// 앱 deny 그룹 추가 (🚨 Deny-Wins)
	function handleAppAddDeny(appId, code) {
		apps = apps.map(a => {
			if (a.app_id === appId) {
				// 이미 allow에 있다면 안내 후 교체 지원
				if (a.allow_groups.includes(code)) {
					alertState.send(`[${code}]가 허용(allow)에 등록되어 있었으나 차단(deny)이 우선 적용됩니다.`, { level: 2, style: 'warning' });
				}
				if (!a.deny_groups.includes(code)) {
					return { ...a, deny_groups: [...a.deny_groups, code] };
				}
			}
			return a;
		});
		alertState.send(`[${code}] 그룹이 차단(deny) 목록에 등록되었습니다.`, { level: 1, style: 'info' });
	}

	// 앱 deny 그룹 제거
	function handleAppRemoveDeny(appId, code) {
		apps = apps.map(a => a.app_id === appId ? { ...a, deny_groups: a.deny_groups.filter(c => c !== code) } : a);
	}
</script>

<div class="animate-fade-in mx-auto max-w-7xl space-y-6 px-4 pb-20 font-['Outfit','Noto_Sans_KR']">

	<!-- 🧭 1. 상단 브레드크럼 & 헤더 -->
	<div class="flex flex-col items-start justify-between gap-4 border-b-4 border-slate-900 pb-6 md:flex-row md:items-end">
		<div>
			<div class="flex items-center gap-2 mb-2">
				<a href="/v1/admin" class="flex items-center gap-1 text-xs font-black tracking-wider text-slate-400 uppercase hover:text-slate-700">
					<Icon icon="mdi:view-dashboard" /> 관제탑
				</a>
				<span class="text-slate-300">/</span>
				<span class="rounded-full bg-cyan-100 px-2.5 py-0.5 text-[11px] font-black tracking-widest text-cyan-800 border border-cyan-300">
					ORGANIZATION & PERMISSION ENGINE
				</span>
			</div>
			<h1 class="text-3xl font-black tracking-tight text-slate-900 uppercase italic md:text-5xl">
				통합 그룹 및 <span class="not-italic text-cyan-600">권한 통제 관제탑</span>
			</h1>
			<p class="mt-2 text-sm font-bold text-slate-500">
				<strong class="text-slate-800">그룹 뷰</strong>(주/부그룹 정의), <strong class="text-slate-800">사용자 뷰</strong>(회원 매칭), <strong class="text-slate-800">앱 뷰</strong>(랭킹 및 allow/deny 통제)의 3단계 일체형 관리 시스템
			</p>
		</div>

		<!-- 신규 그룹 생성 버튼 -->
		<button 
			class="btn btn-sm rounded-xl bg-slate-900 text-white hover:bg-slate-800 shadow-md font-black gap-1.5"
			onclick={() => isCreateModalOpen = true}
		>
			<Icon icon="mdi:plus-circle-outline" class="text-base text-cyan-400" /> 신규 그룹 생성
		</button>
	</div>

	<!-- 🎛️ 2. 메인 3대 뷰 내비게이션 탭 바 -->
	<div class="tabs tabs-boxed bg-slate-200/80 p-1.5 rounded-2xl flex border border-slate-300 shadow-inner">
		<!-- 탭 1: 그룹 뷰 -->
		<button 
			class="tab flex-1 h-12 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 {activeMainTab === 'group' ? 'bg-white shadow-md text-cyan-700' : 'text-slate-600 hover:text-slate-900'}"
			onclick={() => activeMainTab = 'group'}
		>
			<Icon icon="mdi:folder-account-outline" class="text-xl" />
			<span>1. 그룹 뷰</span>
			<span class="rounded-full bg-cyan-100 text-cyan-800 px-2 py-0.5 text-[10px] font-bold">
				{primaryGroups.length + secondaryGroups.length}개
			</span>
		</button>

		<!-- 탭 2: 사용자 뷰 -->
		<button 
			class="tab flex-1 h-12 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 {activeMainTab === 'user' ? 'bg-white shadow-md text-emerald-700' : 'text-slate-600 hover:text-slate-900'}"
			onclick={() => activeMainTab = 'user'}
		>
			<Icon icon="mdi:account-details-outline" class="text-xl" />
			<span>2. 사용자 뷰</span>
			<span class="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
				{users.length}명 매칭
			</span>
		</button>

		<!-- 탭 3: 앱 뷰 -->
		<button 
			class="tab flex-1 h-12 rounded-xl font-black text-sm transition-all flex items-center justify-center gap-2 {activeMainTab === 'app' ? 'bg-white shadow-md text-indigo-700' : 'text-slate-600 hover:text-slate-900'}"
			onclick={() => activeMainTab = 'app'}
		>
			<Icon icon="mdi:shield-lock-outline" class="text-xl" />
			<span>3. 앱 뷰 (랭킹 & allow/deny)</span>
			<span class="rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-[10px] font-bold">
				{apps.length}개 앱
			</span>
		</button>
	</div>

	<!-- ========================================================================= -->
	<!-- 📂 3-A. [그룹 뷰]: 주그룹과 부그룹을 명확히 분류하여 생성·삭제·관리 -->
	<!-- ========================================================================= -->
	{#if activeMainTab === 'group'}
		<div class="space-y-6" in:fade={{ duration: 150 }}>
			
			<!-- 상단 서브 탭 & 정책 안내 배너 -->
			<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
				<div class="flex items-center gap-2">
					<button 
						class="btn btn-sm rounded-xl font-black transition-all {activeGroupSubTab === 'primary' ? 'bg-cyan-600 text-white shadow' : 'btn-ghost text-slate-600'}"
						onclick={() => activeGroupSubTab = 'primary'}
					>
						<Icon icon="mdi:badge-account-outline" class="text-base mr-1" />
						주그룹 관리 (소속 부서/팀) ({primaryGroups.length})
					</button>
					<button 
						class="btn btn-sm rounded-xl font-black transition-all {activeGroupSubTab === 'secondary' ? 'bg-indigo-600 text-white shadow' : 'btn-ghost text-slate-600'}"
						onclick={() => activeGroupSubTab = 'secondary'}
					>
						<Icon icon="mdi:shield-key-outline" class="text-base mr-1" />
						부그룹 관리 (직무·특권·차단) ({secondaryGroups.length})
					</button>
				</div>

				<div class="text-xs font-bold text-slate-500 flex items-center gap-1.5">
					<Icon icon="mdi:information-outline" class="text-cyan-600" />
					{#if activeGroupSubTab === 'primary'}
						<span><strong>주그룹</strong>은 회원의 공식 1순위 본소속 부서입니다 (1인당 1개만 선택 가능).</span>
					{:else}
						<span><strong>부그룹</strong>은 직무 특권(Allow) 및 제재(Deny)를 위한 보조 그룹입니다 (복수 부여 가능).</span>
					{/if}
				</div>
			</div>

			<!-- ① 주그룹(Primary) 서브 리스트 -->
			{#if activeGroupSubTab === 'primary'}
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" in:fade={{ duration: 100 }}>
					{#each primaryGroups as group}
						{@const memberCount = getPrimaryGroupMemberCount(group.code)}
						<div class="card bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all rounded-2xl">
							<div class="card-body p-5">
								<div class="flex items-start justify-between">
									<span class="rounded bg-cyan-700 px-2 py-0.5 text-[10px] font-black font-mono text-white">
										{group.code}
									</span>
									<button 
										class="btn btn-ghost btn-xs btn-square text-slate-400 hover:text-red-600 hover:bg-red-50"
										onclick={() => handleDeletePrimaryGroup(group)}
										title="주그룹 삭제"
									>
										<Icon icon="mdi:trash-can-outline" class="text-base" />
									</button>
								</div>

								<h3 class="text-lg font-black text-slate-900 mt-2">{group.name}</h3>
								<p class="text-xs text-slate-500 line-clamp-2 min-h-[32px]">{group.description}</p>

								<div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
									<div class="flex items-center gap-1 font-bold text-emerald-700">
										<Icon icon="mdi:account" /> 본소속 인원: {memberCount}명
									</div>
									<span class="text-[10px] font-bold text-slate-400">등록일: {group.created_at}</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

			<!-- ② 부그룹(Secondary) 서브 리스트 -->
			{#if activeGroupSubTab === 'secondary'}
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" in:fade={{ duration: 100 }}>
					{#each secondaryGroups as group}
						{@const memberCount = getSecondaryGroupMemberCount(group.code)}
						{@const usage = getGroupAppUsage(group.code)}
						<div class="card bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all rounded-2xl">
							<div class="card-body p-5">
								<div class="flex items-start justify-between">
									<div class="flex items-center gap-1.5">
										<span class="rounded bg-indigo-700 px-2 py-0.5 text-[10px] font-black font-mono text-white">
											{group.code}
										</span>
										{#if group.category === 'RESTRICTION'}
											<span class="rounded bg-rose-100 text-rose-800 border border-rose-200 px-1.5 py-0.2 text-[9px] font-extrabold">
												차단·제재용
											</span>
										{:else}
											<span class="rounded bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.2 text-[9px] font-extrabold">
												직무·특권용
											</span>
										{/if}
									</div>
									<button 
										class="btn btn-ghost btn-xs btn-square text-slate-400 hover:text-red-600 hover:bg-red-50"
										onclick={() => handleDeleteSecondaryGroup(group)}
										title="부그룹 삭제"
									>
										<Icon icon="mdi:trash-can-outline" class="text-base" />
									</button>
								</div>

								<h3 class="text-lg font-black text-slate-900 mt-2">{group.name}</h3>
								<p class="text-xs text-slate-500 line-clamp-2 min-h-[32px]">{group.description}</p>

								<!-- 부그룹의 앱 적용 현황 배지 -->
								<div class="mt-3 p-2 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-[11px]">
									<div class="flex items-center gap-1 text-slate-600 font-bold">
										<span class="text-[10px] text-emerald-700 font-black">ALLOW 앱:</span>
										{#if usage.allowApps.length > 0}
											<span class="text-slate-800 font-bold">{usage.allowApps.join(', ')}</span>
										{:else}
											<span class="text-slate-400">지정 없음</span>
										{/if}
									</div>
									<div class="flex items-center gap-1 text-slate-600 font-bold">
										<span class="text-[10px] text-rose-600 font-black">DENY 앱:</span>
										{#if usage.denyApps.length > 0}
											<span class="text-rose-700 font-extrabold">{usage.denyApps.join(', ')}</span>
										{:else}
											<span class="text-slate-400">지정 없음</span>
										{/if}
									</div>
								</div>

								<div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
									<div class="flex items-center gap-1 font-bold text-indigo-700">
										<Icon icon="mdi:shield-account" /> 보유 인원: {memberCount}명
									</div>
									<span class="text-[10px] font-bold text-slate-400">등록일: {group.created_at}</span>
								</div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

		</div>
	{/if}

	<!-- ========================================================================= -->
	<!-- 👤 3-B. [사용자 뷰]: 회원별 주그룹(1개) 및 부그룹(N개) 매칭 관제 -->
	<!-- ========================================================================= -->
	{#if activeMainTab === 'user'}
		<div class="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden" in:fade={{ duration: 150 }}>
			
			<!-- 상단 필터 바 -->
			<div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 border-b border-slate-100 bg-slate-50/70">
				<div>
					<h3 class="text-lg font-black text-slate-900 flex items-center gap-2">
						<Icon icon="mdi:account-switch-outline" class="text-emerald-600 text-xl" />
						사용자 주그룹 / 부그룹 매칭 테이블
					</h3>
					<p class="text-xs text-slate-500 font-bold">각 회원의 본소속(주그룹 1개)과 직무·특권·차단(부그룹 N개)을 선택하여 매칭합니다.</p>
				</div>
				<div class="w-full md:w-64 relative">
					<Icon icon="mdi:magnify" class="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
					<input 
						type="text" 
						bind:value={userSearchQuery} 
						placeholder="이름 또는 아이디로 검색..." 
						class="input input-sm input-bordered w-full rounded-xl pl-9 font-bold bg-white focus:border-emerald-500"
					/>
				</div>
			</div>

			<!-- 테이블 -->
			<div class="overflow-x-auto">
				<table class="table table-zebra w-full text-xs font-bold">
					<thead class="bg-slate-100/80 text-slate-500 text-[11px] font-black tracking-wider uppercase">
						<tr>
							<th class="py-3.5 px-4">회원 정보</th>
							<th>권한 등급</th>
							<th>주그룹 (1순위 본소속)</th>
							<th>부그룹 (직무·특권·차단 다중 매칭)</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-100">
						{#each users.filter(u => !userSearchQuery || u.real_name.includes(userSearchQuery) || u.username.includes(userSearchQuery)) as u}
							{@const rankBadge = getRankBadge(u.rank_level)}
							<tr class="hover:bg-emerald-50/30 transition-colors">
								
								<!-- 회원 기본 정보 -->
								<td class="py-3.5 px-4">
									<div class="flex items-center gap-2.5">
										<div class="h-9 w-9 rounded-full bg-slate-100 text-slate-700 font-black flex items-center justify-center border text-xs">
											{u.real_name[0]}
										</div>
										<div>
											<div class="font-black text-sm text-slate-900">{u.real_name}</div>
											<div class="text-[11px] text-slate-400 font-mono">@{u.username}</div>
										</div>
									</div>
								</td>

								<!-- 권한 등급 (0~9) -->
								<td>
									<span class="rounded px-2 py-0.5 text-[10px] font-black {rankBadge.class}">
										{rankBadge.label}
									</span>
								</td>

								<!-- 주그룹 (드롭다운 단일 선택) -->
								<td>
									<select 
										class="select select-bordered select-xs w-48 font-bold rounded-lg focus:border-cyan-500 bg-white"
										value={u.primary_group || ''}
										onchange={(e) => handleUserPrimaryChange(u.id, e.currentTarget.value)}
									>
										<option value="">(미지정)</option>
										{#each primaryGroups as pg}
											<option value={pg.code}>{pg.name} ({pg.code})</option>
										{/each}
									</select>
								</td>

								<!-- 부그룹 (태그 뱃지 리스트 & 추가 드롭다운) -->
								<td>
									<div class="flex flex-wrap items-center gap-1.5 max-w-lg">
										{#each u.secondary_groups as sec}
											{@const secObj = secondaryGroups.find(g => g.code === sec)}
											{@const isRestriction = secObj?.category === 'RESTRICTION'}
											
											<span class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold border {isRestriction ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}">
												{sec}
												<button 
													class="hover:text-red-700 font-bold ml-0.5" 
													onclick={() => handleUserRemoveSecondary(u.id, sec)}
													title="부그룹 해제"
												>
													×
												</button>
											</span>
										{/each}

										<!-- 부그룹 추가 드롭다운 -->
										<div class="dropdown dropdown-bottom">
											<div tabindex="0" role="button" class="btn btn-xs btn-ghost border border-dashed border-slate-300 rounded font-bold text-[10px] text-slate-500 hover:border-indigo-400 hover:text-indigo-600">
												+ 부그룹 추가
											</div>
											<ul tabindex="-1" class="dropdown-content z-[1] menu p-1 shadow-lg bg-white rounded-box w-56 border border-slate-100 text-xs">
												{#each secondaryGroups.filter(g => !u.secondary_groups.includes(g.code)) as g}
													<li>
														<button onclick={() => handleUserAddSecondary(u.id, g.code)}>
															<span class="font-bold">{g.name}</span>
															<span class="text-[10px] font-mono text-slate-400">({g.code})</span>
														</button>
													</li>
												{/each}
												{#if secondaryGroups.filter(g => !u.secondary_groups.includes(g.code)).length === 0}
													<li class="p-2 text-center text-[11px] text-slate-400 font-normal">
														추가 가능한 부그룹이 없습니다.
													</li>
												{/if}
											</ul>
										</div>
									</div>
								</td>

							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}

	<!-- ========================================================================= -->
	<!-- 📱 3-C. [앱 뷰]: 등록된 앱별 랭킹(min_read/write) 및 allow / deny 그룹 설정 -->
	<!-- ========================================================================= -->
	{#if activeMainTab === 'app'}
		<div class="space-y-4" in:fade={{ duration: 150 }}>
			
			<!-- 상단 4단계 권한 정책 요약 배너 -->
			<div class="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/70 via-white to-indigo-50/40 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div>
					<h3 class="text-sm font-black text-indigo-950 flex items-center gap-1.5">
						<Icon icon="mdi:shield-check" class="text-indigo-600 text-lg" />
						앱 권한 검증 4단계 실행 정책
					</h3>
					<div class="mt-1 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
						<span class="rounded bg-slate-900 text-white px-2 py-0.5 text-[10px]">1단계</span> root(Lv.9) 무조건 통과
						<span>➔</span>
						<span class="rounded bg-rose-600 text-white px-2 py-0.5 text-[10px]">2단계</span> deny 그룹 포함 시 즉시 차단
						<span>➔</span>
						<span class="rounded bg-emerald-600 text-white px-2 py-0.5 text-[10px]">3단계</span> allow 그룹 포함 시 즉시 통과
						<span>➔</span>
						<span class="rounded bg-blue-600 text-white px-2 py-0.5 text-[10px]">4단계</span> 최소 요구 랭킹 비교
					</div>
				</div>
				<div class="text-[11px] font-extrabold text-indigo-900 bg-indigo-100/60 px-3 py-1.5 rounded-xl border border-indigo-200">
					🚨 Deny 그룹은 모든 권한보다 우선하여 차단합니다.
				</div>
			</div>

			<!-- 앱 목록 카드 그리드 -->
			<div class="grid grid-cols-1 gap-4">
				{#each apps as app}
					<div class="card bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all">
						<div class="card-body p-6">
							
							<!-- 앱 헤더 영역 -->
							<div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
								<div class="flex items-center gap-3">
									<div class="h-11 w-11 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl {app.color}">
										<Icon icon={app.icon} />
									</div>
									<div>
										<div class="flex items-center gap-2">
											<h3 class="text-lg font-black text-slate-900">{app.name}</h3>
											<span class="rounded bg-slate-100 font-mono text-slate-600 px-2 py-0.5 text-[10px] font-bold">
												APP_ID: {app.app_id}
											</span>
										</div>
										<p class="text-xs text-slate-500 font-bold mt-0.5">{app.description}</p>
									</div>
								</div>

								<!-- 4단계: 랭킹 설정 슬롯 -->
								<div class="flex items-center gap-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
									<div class="flex items-center gap-2">
										<span class="text-xs font-black text-slate-600">읽기 최소 랭킹:</span>
										<select 
											class="select select-bordered select-xs w-20 font-bold bg-white"
											bind:value={app.min_read_rank}
										>
											{#each Array(10) as _, i}
												<option value={i}>Lv.{i}</option>
											{/each}
										</select>
									</div>
									<div class="flex items-center gap-2 border-l border-slate-200 pl-4">
										<span class="text-xs font-black text-slate-600">쓰기 최소 랭킹:</span>
										<select 
											class="select select-bordered select-xs w-20 font-bold bg-white"
											bind:value={app.min_write_rank}
										>
											{#each Array(10) as _, i}
												<option value={i}>Lv.{i}</option>
											{/each}
										</select>
									</div>
								</div>
							</div>

							<!-- 그룹 Allow & Deny 설정 영역 (2분할) -->
							<div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
								
								<!-- 3단계: ALLOW 그룹 (허용) -->
								<div class="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2.5">
									<div class="flex items-center justify-between">
										<span class="text-xs font-black text-emerald-900 flex items-center gap-1.5">
											<Icon icon="mdi:check-circle-outline" class="text-base text-emerald-600" />
											허용 그룹 (allow_groups)
										</span>
										<span class="text-[10px] font-bold text-emerald-700">랭킹 무관 즉시 읽기·쓰기 통과</span>
									</div>

									<div class="flex flex-wrap items-center gap-1.5 min-h-[36px]">
										{#each app.allow_groups as code}
											<span class="inline-flex items-center gap-1 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 px-2.5 py-1 text-xs font-black">
												{code}
												<button 
													class="hover:text-red-600 ml-1 font-bold text-xs"
													onclick={() => handleAppRemoveAllow(app.app_id, code)}
													title="허용 그룹에서 제외"
												>
													×
												</button>
											</span>
										{/each}

										<!-- 허용 그룹 추가 드롭다운 -->
										<div class="dropdown dropdown-bottom">
											<div tabindex="0" role="button" class="btn btn-xs bg-white border border-emerald-300 text-emerald-800 rounded-lg font-bold hover:bg-emerald-50">
												+ 허용 추가
											</div>
											<ul tabindex="-1" class="dropdown-content z-[1] menu p-1 shadow-lg bg-white rounded-box w-52 border border-emerald-100 text-xs">
												{#each allGroupCodes.filter(g => !app.allow_groups.includes(g.code)) as g}
													<li>
														<button onclick={() => handleAppAddAllow(app.app_id, g.code)}>
															<span class="font-bold">{g.name}</span>
															<span class="text-[10px] font-mono text-slate-400">({g.code})</span>
														</button>
													</li>
												{/each}
											</ul>
										</div>
									</div>
								</div>

								<!-- 2단계: DENY 그룹 (차단 🚨 Deny-Wins) -->
								<div class="rounded-xl border border-rose-200 bg-rose-50/40 p-4 space-y-2.5">
									<div class="flex items-center justify-between">
										<span class="text-xs font-black text-rose-900 flex items-center gap-1.5">
											<Icon icon="mdi:cancel" class="text-base text-rose-600" />
											차단 그룹 (deny_groups)
										</span>
										<span class="text-[10px] font-extrabold text-rose-700">🚨 소속 시 랭킹과 무관하게 즉시 차단</span>
									</div>

									<div class="flex flex-wrap items-center gap-1.5 min-h-[36px]">
										{#each app.deny_groups as code}
											<span class="inline-flex items-center gap-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-300 px-2.5 py-1 text-xs font-black">
												{code}
												<button 
													class="hover:text-red-700 ml-1 font-bold text-xs"
													onclick={() => handleAppRemoveDeny(app.app_id, code)}
													title="차단 그룹에서 제외"
												>
													×
												</button>
											</span>
										{/each}

										<!-- 차단 그룹 추가 드롭다운 -->
										<div class="dropdown dropdown-bottom">
											<div tabindex="0" role="button" class="btn btn-xs bg-white border border-rose-300 text-rose-800 rounded-lg font-bold hover:bg-rose-50">
												+ 차단 추가
											</div>
											<ul tabindex="-1" class="dropdown-content z-[1] menu p-1 shadow-lg bg-white rounded-box w-52 border border-rose-100 text-xs">
												{#each allGroupCodes.filter(g => !app.deny_groups.includes(g.code)) as g}
													<li>
														<button onclick={() => handleAppAddDeny(app.app_id, g.code)}>
															<span class="font-bold text-rose-900">{g.name}</span>
															<span class="text-[10px] font-mono text-slate-400">({g.code})</span>
														</button>
													</li>
												{/each}
											</ul>
										</div>
									</div>
								</div>

							</div>

						</div>
					</div>
				{/each}
			</div>

		</div>
	{/if}

</div>

<!-- ========================================================================= -->
<!-- 🆕 4. 신규 그룹 생성 모달 -->
<!-- ========================================================================= -->
{#if isCreateModalOpen}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" in:fade={{ duration: 100 }}>
		<div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-5 border border-slate-100" in:scale={{ start: 0.95, duration: 150 }}>
			
			<div class="flex items-center justify-between border-b border-slate-100 pb-3">
				<h3 class="text-lg font-black text-slate-900 flex items-center gap-2">
					<Icon icon="mdi:folder-plus-outline" class="text-cyan-600" />
					신규 공식 그룹 등록
				</h3>
				<button class="btn btn-xs btn-ghost btn-square text-slate-400" onclick={() => isCreateModalOpen = false}>
					<Icon icon="mdi:close" class="text-base" />
				</button>
			</div>

			<div class="space-y-4">
				
				<!-- 그룹 분류 선택 (주그룹 vs 부그룹) -->
				<div class="form-control">
					<label class="label pb-1"><span class="label-text font-black text-xs text-slate-700">그룹 분류 (주그룹 / 부그룹)</span></label>
					<div class="grid grid-cols-2 gap-2">
						<button 
							type="button"
							class="btn btn-sm rounded-xl font-bold {newGroupType === 'primary' ? 'bg-cyan-600 text-white' : 'btn-outline border-slate-300'}"
							onclick={() => newGroupType = 'primary'}
						>
							주그룹 (본소속 부서/팀)
						</button>
						<button 
							type="button"
							class="btn btn-sm rounded-xl font-bold {newGroupType === 'secondary' ? 'bg-indigo-600 text-white' : 'btn-outline border-slate-300'}"
							onclick={() => newGroupType = 'secondary'}
						>
							부그룹 (직무·특권·차단)
						</button>
					</div>
					<span class="text-[10px] text-slate-400 mt-1">
						{newGroupType === 'primary' ? '※ 주그룹은 회원이 단 1개만 소속될 수 있는 부서 단위입니다.' : '※ 부그룹은 여러 개를 동시에 보유할 수 있는 특권/제재 단위입니다.'}
					</span>
				</div>

				<!-- 부그룹 선택 시 성격 분류 (특권 vs 제재) -->
				{#if newGroupType === 'secondary'}
					<div class="form-control" in:slide>
						<label class="label pb-1"><span class="label-text font-black text-xs text-slate-700">부그룹 성격</span></label>
						<div class="grid grid-cols-2 gap-2">
							<button 
								type="button"
								class="btn btn-xs rounded-lg font-bold {newGroupCategory === 'PRIVILEGE' ? 'bg-emerald-600 text-white' : 'btn-outline border-slate-200'}"
								onclick={() => newGroupCategory = 'PRIVILEGE'}
							>
								직무·특권형 (Allow 목적)
							</button>
							<button 
								type="button"
								class="btn btn-xs rounded-lg font-bold {newGroupCategory === 'RESTRICTION' ? 'bg-rose-600 text-white' : 'btn-outline border-slate-200'}"
								onclick={() => newGroupCategory = 'RESTRICTION'}
							>
								제재·블랙리스트 (Deny 목적)
							</button>
						</div>
					</div>
				{/if}

				<!-- 그룹 식별 코드 -->
				<div class="form-control">
					<label class="label pb-1"><span class="label-text font-black text-xs text-slate-700">그룹 고유 식별 코드 (코드값)</span></label>
					<input 
						type="text" 
						bind:value={newGroupCode} 
						placeholder="예: 운수3팀, dispatch_sub, 휴직자" 
						class="input input-sm input-bordered rounded-xl font-bold font-mono focus:border-cyan-500"
					/>
					<span class="text-[10px] text-slate-400 mt-1">※ DB primary_group 및 secondary_groups 컬럼에 저장될 유일 식별값입니다.</span>
				</div>

				<!-- 그룹 표시 명칭 -->
				<div class="form-control">
					<label class="label pb-1"><span class="label-text font-black text-xs text-slate-700">그룹 명칭 (UI 표시용)</span></label>
					<input 
						type="text" 
						bind:value={newGroupName} 
						placeholder="예: 운수 3팀 (심야간선), 임시 배차담당" 
						class="input input-sm input-bordered rounded-xl font-bold focus:border-cyan-500"
					/>
				</div>

				<!-- 그룹 설명 -->
				<div class="form-control">
					<label class="label pb-1"><span class="label-text font-black text-xs text-slate-700">그룹 설명 및 운영 목적</span></label>
					<textarea 
						bind:value={newGroupDesc} 
						placeholder="그룹의 조직상 역할 또는 부여될 접근 권한(허용/차단)에 대해 상세히 기술하세요." 
						rows="3"
						class="textarea textarea-bordered rounded-xl font-bold text-xs focus:border-cyan-500"
					></textarea>
				</div>
			</div>

			<div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
				<button class="btn btn-sm btn-ghost rounded-xl font-bold text-slate-500" onclick={() => isCreateModalOpen = false}>
					취소
				</button>
				<button class="btn btn-sm rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-black px-5 shadow" onclick={handleCreateGroup}>
					그룹 등록
				</button>
			</div>
		</div>
	</div>
{/if}
