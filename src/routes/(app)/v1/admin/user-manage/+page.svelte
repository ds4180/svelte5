<script>
	/**
	 * @file (app)/v1/admin/user-manage/+page.svelte
	 * @description [v4.5] 중소기업 오피스 전용 사원 관리 관제탑
	 *              - fastApi 기반 안정적 클라이언트 인증 데이터 로드 (onMount)
	 *              - 전체 사원 / 가입 승인 대기 / 퇴사(비활성) 3대 탭
	 *              - 신규 사원 직접 등록 모달
	 *              - 🛡️ 소프트 삭제(is_active=False) & 원클릭 복구
	 *              - 사내 가입 정책(ADMIN_ONLY / APPROVAL / OPEN) 실시간 스위치
	 *              - 헌법 표준(Lv.0~9) 동기화
	 */
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import * as api from '$lib/api/admin';
	import { toast } from '$lib/runes/toast.svelte';
	import { getSiteTitle } from '$lib/config/site';
	import Icon from '@iconify/svelte';

	let users = $state([]);
	let registerMode = $state('ADMIN_ONLY');
	let loading = $state(true);
	let searchQuery = $state('');
	let activeTab = $state('ALL'); // 'ALL' | 'PENDING' | 'INACTIVE'

	// 신규 사원 등록 모달 상태
	let showCreateModal = $state(false);
	let isSubmitting = $state(false);
	let newEmployee = $state({
		username: '',
		password: '',
		real_name: '',
		email: '',
		employee_no: '',
		primary_group: '',
		rank_level: 1
	});

	// 🔍 검색 및 탭 필터링
	let tabUsers = $derived(
		users.filter(u => {
			const isActive = u.profile?.is_active !== false;
			const rank = u.profile?.rank_level ?? 0;
			if (activeTab === 'ALL') return isActive;
			if (activeTab === 'PENDING') return isActive && rank === 0;
			if (activeTab === 'INACTIVE') return !isActive;
			return true;
		})
	);

	let filteredUsers = $derived(
		tabUsers.filter(u => {
			const q = searchQuery.toLowerCase();
			const uname = (u.username || '').toLowerCase();
			const rname = (u.real_name || '').toLowerCase();
			const email = (u.email || '').toLowerCase();
			const pgroup = (u.profile?.primary_group || '').toLowerCase();
			const empNo = (u.profile?.employee_no || '').toLowerCase();
			return uname.includes(q) || rname.includes(q) || email.includes(q) || pgroup.includes(q) || empNo.includes(q);
		})
	);

	// 📊 상태 통계
	let stats = $derived({
		total: users.length,
		active: users.filter(u => u.profile?.is_active !== false).length,
		pending: users.filter(u => u.profile?.is_active !== false && (u.profile?.rank_level ?? 0) === 0).length,
		inactive: users.filter(u => u.profile?.is_active === false).length,
	});

	async function loadUsers() {
		loading = true;
		try {
			const [userList, modeData] = await Promise.all([
				api.adminGetUsers(),
				api.adminGetRegisterMode().catch(() => ({ register_mode: 'ADMIN_ONLY' }))
			]);
			users = Array.isArray(userList) ? userList : [];
			registerMode = modeData?.register_mode || 'ADMIN_ONLY';
		} catch (e) {
			console.error('[UserManage] Load failed:', e);
			toast.error(e.message || '사원 목록 조회에 실패했습니다.');
		} finally {
			loading = false;
		}
	}

	onMount(loadUsers);

	async function changeRank(userId, newRank) {
		try {
			const res = await api.adminUpdateUserRank(userId, newRank);
			if (res.message === 'success') {
				users = users.map(u => {
					if (u.id === userId) {
						return { ...u, profile: { ...u.profile, rank_level: newRank } };
					}
					return u;
				});
				toast.success(`${res.username}님의 등급이 Lv.${newRank}(으)로 안전하게 변경되었습니다.`);
			}
		} catch (e) {
			toast.error(e.message);
		}
	}

	async function setRegisterMode(mode) {
		try {
			const res = await api.adminUpdateRegisterMode(mode);
			registerMode = res.register_mode;
			toast.success(`가입 정책이 [${getModeLabel(mode)}] 모드로 변경되었습니다.`);
		} catch (e) {
			toast.error(e.message);
		}
	}

	async function handleCreateEmployee() {
		if (!newEmployee.username.trim() || !newEmployee.password.trim() || !newEmployee.email.trim()) {
			toast.error('아이디, 비밀번호, 이메일은 필수 입력 항목입니다.');
			return;
		}

		isSubmitting = true;
		try {
			const created = await api.adminCreateUser(newEmployee);
			users = [created, ...users];
			toast.success(`신규 사원 '${created.username}' 계정이 안전하게 등록되었습니다.`);
			showCreateModal = false;
			newEmployee = {
				username: '',
				password: '',
				real_name: '',
				email: '',
				employee_no: '',
				primary_group: '',
				rank_level: 1
			};
		} catch (e) {
			toast.error(e.message);
		} finally {
			isSubmitting = false;
		}
	}

	// 🛡️ 소프트 삭제 (비활성화)
	async function handleDeleteUser(user) {
		if (!confirm(`'${user.username}' (${user.real_name || '미지정'}) 계정을 소프트 삭제(비활성화)하시겠습니까?\n사원 데이터는 보존되며 즉시 로그인 및 권한이 차단됩니다.`)) {
			return;
		}

		try {
			await api.adminDeleteUser(user.id);
			users = users.map(u => {
				if (u.id === user.id) {
					return { ...u, profile: { ...u.profile, is_active: false, rank_level: 0 } };
				}
				return u;
			});
			toast.success(`'${user.username}' 계정이 안전하게 소프트 삭제(비활성화)되었습니다.`);
		} catch (e) {
			toast.error(e.message);
		}
	}

	// 🔄 계정 복구 (재활성화)
	async function handleRestoreUser(user) {
		if (!confirm(`'${user.username}' 계정을 재활성화(Lv.1 정회원 복귀)하시겠습니까?`)) {
			return;
		}

		try {
			await api.adminRestoreUser(user.id);
			users = users.map(u => {
				if (u.id === user.id) {
					return { ...u, profile: { ...u.profile, is_active: true, rank_level: 1 } };
				}
				return u;
			});
			toast.success(`'${user.username}' 계정이 정회원(Lv.1)으로 안전하게 복구되었습니다.`);
		} catch (e) {
			toast.error(e.message);
		}
	}

	const rankLevels = [
		{ val: 0, role: 'ROLE_GUEST', label: 'Lv.0 손님/미승인', color: 'badge-ghost', desc: '공개 데이터만 접근 가능' },
		{ val: 1, role: 'ROLE_USER', label: 'Lv.1 정회원', color: 'badge-info', desc: '일반 사원 CRUD' },
		{ val: 2, role: 'ROLE_STAFF', label: 'Lv.2 실무자', color: 'badge-success', desc: '배차/승무/현장 실무' },
		{ val: 3, role: 'ROLE_MANAGER', label: 'Lv.3 부서장', color: 'badge-warning', desc: '부서 관리 및 비공개 결재' },
		{ val: 4, role: 'ROLE_ADMIN', label: 'Lv.4 운영관리자', color: 'badge-primary', desc: '시스템 전반 운영' },
		{ val: 8, role: 'ROLE_CORE', label: 'Lv.8 코어마스터', color: 'badge-secondary', desc: '감사로그/인프라 관제' },
		{ val: 9, role: 'ROLE_ROOT', label: 'Lv.9 최고관리자', color: 'badge-error', desc: '시스템 절대 권한 (Master Key)' }
	];

	function getRankInfo(level, isActive = true) {
		if (!isActive) {
			return { val: 0, role: 'INACTIVE', label: '퇴사/비활성', color: 'badge-ghost', desc: '계정 비활성화' };
		}
		return rankLevels.find(r => r.val === level) || {
			val: level,
			role: 'CUSTOM',
			label: `Lv.${level} 특수`,
			color: 'badge-neutral',
			desc: '예비 확장 등급'
		};
	}

	function getModeLabel(mode) {
		if (mode === 'ADMIN_ONLY') return '관리자 직접 등록만 허용 (폐쇄형 오피스)';
		if (mode === 'APPROVAL') return '가입 신청 후 관리자 승인제 (권장)';
		if (mode === 'OPEN') return '자유 가입 (공개형)';
		return mode;
	}
</script>

<svelte:head>
	<title>{getSiteTitle('사용자 랭크 관리')}</title>
</svelte:head>

<div class="animate-fade-in mx-auto max-w-7xl space-y-8 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:px-8">
	<!-- 🏛️ 모던 엔터프라이즈 통합 헤더 -->
	<header class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end">
		<div>
			<div class="flex items-center gap-2 mb-2">
				<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-emerald-50 text-emerald-700 border border-emerald-200">
					<Icon icon="ph:shield-check-bold" class="text-sm" />
					SYSTEM GOVERNANCE • USER RANK
				</span>
				<span class="text-xs font-bold text-slate-400 font-mono">v1/admin/user-manage</span>
			</div>
			<h1 class="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
				사용자 랭크 <span class="not-italic text-emerald-600">관리</span>
			</h1>
			<p class="mt-2 text-xs sm:text-sm font-bold text-slate-500">
				중소기업 오피스 보안 인트라넷: 사원 직접 발급, 가입 승인, 소프트 삭제(퇴사) 및 전역 랭크(Lv.0~9) 관제탑
			</p>
		</div>

		<div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
			<!-- 🔒 가입 정책 스위치 드롭다운 -->
			<div class="dropdown dropdown-end">
				<div tabindex="0" role="button" class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-slate-200 bg-white font-black text-xs uppercase tracking-wider text-slate-700 hover:border-slate-400 transition shadow-sm cursor-pointer">
					<Icon icon="mdi:shield-lock-outline" class="text-base text-emerald-600" />
					<span class="text-xs">
						{#if registerMode === 'ADMIN_ONLY'}🔒 관리자 직접등록
						{:else if registerMode === 'APPROVAL'}⚖️ 가입 승인제
						{:else}🌐 자유가입{/if}
					</span>
					<Icon icon="mdi:chevron-down" class="text-xs text-slate-400" />
				</div>
				<ul tabindex="0" class="dropdown-content z-[20] menu w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl mt-1">
					<li class="menu-title text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 py-1">
						사내 가입 정책 설정
					</li>
					<li>
						<button 
							onclick={() => setRegisterMode('ADMIN_ONLY')}
							class="flex flex-col items-start text-left py-2 rounded-xl {registerMode === 'ADMIN_ONLY' ? 'bg-emerald-50 text-emerald-700 font-black' : ''}"
						>
							<div class="flex items-center gap-1 text-xs">
								<span>🔒 관리자 직접 등록만 허용</span>
								{#if registerMode === 'ADMIN_ONLY'}<Icon icon="mdi:check" class="text-emerald-600" />{/if}
							</div>
							<span class="text-[10px] text-slate-400 font-normal">폐쇄형 인트라넷 (외부 가입 완전 차단)</span>
						</button>
					</li>
					<li>
						<button 
							onclick={() => setRegisterMode('APPROVAL')}
							class="flex flex-col items-start text-left py-2 rounded-xl {registerMode === 'APPROVAL' ? 'bg-emerald-50 text-emerald-700 font-black' : ''}"
						>
							<div class="flex items-center gap-1 text-xs">
								<span>⚖️ 가입 신청 후 관리자 승인제</span>
								{#if registerMode === 'APPROVAL'}<Icon icon="mdi:check" class="text-emerald-600" />{/if}
							</div>
							<span class="text-[10px] text-slate-400 font-normal">신청 시 Lv.0 격리 후 관리자가 승인 (권장)</span>
						</button>
					</li>
					<li>
						<button 
							onclick={() => setRegisterMode('OPEN')}
							class="flex flex-col items-start text-left py-2 rounded-xl {registerMode === 'OPEN' ? 'bg-emerald-50 text-emerald-700 font-black' : ''}"
						>
							<div class="flex items-center gap-1 text-xs">
								<span>🌐 자유 가입</span>
								{#if registerMode === 'OPEN'}<Icon icon="mdi:check" class="text-emerald-600" />{/if}
							</div>
							<span class="text-[10px] text-slate-400 font-normal">가입 즉시 Lv.1 활동 가능</span>
						</button>
					</li>
				</ul>
			</div>

			<!-- ➕ 신규 사원 직접 등록 버튼 -->
			<button 
				class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-emerald-600 bg-emerald-600 text-white font-black text-xs uppercase tracking-wider hover:bg-emerald-700 transition shadow-sm"
				onclick={() => (showCreateModal = true)}
			>
				<Icon icon="ph:user-plus-bold" class="text-base" />
				<span>신규 사원 등록</span>
			</button>

			<!-- 🔄 새로고침 -->
			<button 
				class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-slate-200 bg-white font-black text-xs uppercase tracking-wider text-slate-700 hover:border-slate-400 transition shadow-sm disabled:opacity-50"
				onclick={loadUsers} 
				title="새로고침"
			>
				<Icon icon="ph:arrows-clockwise-bold" class="text-base {loading ? 'animate-spin' : ''}" />
				<span>새로고침</span>
			</button>

			<!-- 🏠 관리자 홈 -->
			<a
				href="/v1/admin"
				class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-slate-200 bg-white font-black text-xs uppercase tracking-wider text-slate-700 hover:border-slate-400 transition shadow-sm"
			>
				<Icon icon="ph:house-bold" class="text-base text-slate-500" />
				<span>관리자 홈</span>
			</a>
		</div>
	</header>

	<!-- 📊 상태 요약 카드 4종 -->
	<section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
		<button
			onclick={() => (activeTab = 'ALL')}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {activeTab === 'ALL' ? 'border-slate-800 bg-slate-50/50 ring-2 ring-slate-800/10' : 'border-slate-100 hover:border-slate-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black uppercase tracking-wider text-slate-400 group-hover:text-slate-700">Total Users</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 group-hover:scale-110 transition-transform">
					<Icon icon="ph:users-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-900 tracking-tight">{stats.total}<span class="text-sm font-bold text-slate-400 ml-1">명 등록</span></div>
			<div class="mt-2 text-xs font-bold text-slate-500">
				<span class="rounded-lg bg-slate-100 px-2 py-0.5 font-mono">전체 계정</span>
			</div>
		</button>

		<button
			onclick={() => (activeTab = 'ALL')}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group border-slate-100 hover:border-emerald-300"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black uppercase tracking-wider text-emerald-600">Active Staff</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:user-check-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-emerald-600 tracking-tight">{stats.active}<span class="text-sm font-bold text-slate-400 ml-1">명 활동</span></div>
			<div class="mt-2 text-xs font-bold text-emerald-600">
				<span class="rounded-lg bg-emerald-50 px-2 py-0.5 font-mono">정규 승인</span>
			</div>
		</button>

		<button
			onclick={() => (activeTab = 'PENDING')}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {activeTab === 'PENDING' ? 'border-amber-500 bg-amber-50/20 ring-2 ring-amber-500/20' : 'border-slate-100 hover:border-amber-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black uppercase tracking-wider text-amber-700">Pending Approval</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 group-hover:scale-110 transition-transform">
					<Icon icon="ph:hourglass-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-amber-700 tracking-tight">{stats.pending}<span class="text-sm font-bold text-amber-600 ml-1">명 대기</span></div>
			<div class="mt-2 text-xs font-bold text-amber-600">
				<span class="rounded-lg bg-amber-50 px-2 py-0.5 font-mono">Lv.0 가입승인</span>
			</div>
		</button>

		<button
			onclick={() => (activeTab = 'INACTIVE')}
			class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {activeTab === 'INACTIVE' ? 'border-slate-500 bg-slate-50/50 ring-2 ring-slate-500/20' : 'border-slate-100 hover:border-slate-300'}"
		>
			<div class="flex items-center justify-between mb-3">
				<span class="text-xs font-black uppercase tracking-wider text-slate-400">Soft Deleted</span>
				<div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 group-hover:scale-110 transition-transform">
					<Icon icon="ph:user-minus-bold" class="text-2xl" />
				</div>
			</div>
			<div class="text-3xl font-black text-slate-500 tracking-tight">{stats.inactive}<span class="text-sm font-bold text-slate-400 ml-1">명 퇴사</span></div>
			<div class="mt-2 text-xs font-bold text-slate-500">
				<span class="rounded-lg bg-slate-100 px-2 py-0.5 font-mono">비활성 계정</span>
			</div>
		</button>
	</section>

	<!-- 🗂️ 탭 메뉴 & 검색 필터 -->
	<div class="flex flex-col sm:flex-row items-center justify-between gap-4">
		<nav class="flex gap-2 border-b-2 border-slate-200 overflow-x-auto no-scrollbar w-full sm:w-auto">
			<button 
				class="px-5 py-3 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeTab === 'ALL' ? 'border-b-4 border-emerald-600 text-emerald-700 bg-emerald-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
				onclick={() => (activeTab = 'ALL')}
			>
				전체 활동 사원 ({stats.active})
			</button>
			<button 
				class="px-5 py-3 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-1.5 {activeTab === 'PENDING' ? 'border-b-4 border-amber-600 text-amber-700 bg-amber-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
				onclick={() => (activeTab = 'PENDING')}
			>
				<span>승인 대기</span>
				{#if stats.pending > 0}
					<span class="bg-amber-100 text-amber-800 text-[10px] font-mono px-1.5 py-0.5 rounded-full">{stats.pending}</span>
				{/if}
			</button>
			<button 
				class="px-5 py-3 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeTab === 'INACTIVE' ? 'border-b-4 border-slate-800 text-slate-800 bg-slate-100 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
				onclick={() => (activeTab = 'INACTIVE')}
			>
				퇴사/비활성 ({stats.inactive})
			</button>
		</nav>

		<div class="relative w-full sm:w-72">
			<Icon icon="mdi:magnify" class="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
			<input
				type="text"
				bind:value={searchQuery}
				placeholder="이름, 사번, 아이디, 부서 검색..."
				class="input input-bordered input-sm w-full rounded-xl pl-9 font-bold focus:border-emerald-500"
			/>
		</div>
	</div>

	<!-- 📊 사원 리스트 테이블 -->
	<div class="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-xl min-h-[380px] pb-12">
		<table class="table table-zebra w-full font-bold">
			<thead class="bg-slate-50 text-[10px] font-black tracking-widest text-slate-400 uppercase rounded-t-2xl">
				<tr>
					<th class="w-16 text-center rounded-tl-2xl">사번/ID</th>
					<th>사원 정보</th>
					<th>이메일</th>
					<th>소속 부서 (주그룹)</th>
					<th class="text-center">현재 랭크</th>
					<th class="text-center w-36 rounded-tr-2xl">권한 제어 / 작업</th>
				</tr>
			</thead>
			<tbody>
				{#if loading && users.length === 0}
					<tr>
						<td colspan="6" class="py-20 text-center">
							<span class="loading loading-spinner loading-lg text-emerald-500"></span>
							<p class="mt-4 text-xs font-black text-slate-400 uppercase italic">사원 데이터 조회 중...</p>
						</td>
					</tr>
				{:else if filteredUsers.length === 0}
					<tr>
						<td colspan="6" class="py-20 text-center text-slate-400 italic">
							{#if activeTab === 'PENDING'}현재 가입 승인 대기 중인 사원이 없습니다.
							{:else if activeTab === 'INACTIVE'}소프트 삭제(퇴사)된 사원이 없습니다.
							{:else}검색 결과가 없습니다.{/if}
						</td>
					</tr>
				{:else}
					{#each filteredUsers as user, idx (user.id)}
						{@const isUserActive = user.profile?.is_active !== false}
						{@const rank = getRankInfo(user.profile?.rank_level ?? 0, isUserActive)}
						{@const isNearBottom = idx >= Math.max(0, filteredUsers.length - 2)}
						<tr in:fade={{ duration: 150 }} class="hover:bg-slate-50/70 transition-colors {!isUserActive ? 'opacity-60 bg-slate-50/50' : ''}">
							<td class="text-center text-xs font-black text-slate-400">
								{#if user.profile?.employee_no}
									<span class="badge badge-sm badge-ghost font-mono">{user.profile.employee_no}</span>
								{:else}
									#{user.id}
								{/if}
							</td>
							<td>
								<div class="flex items-center gap-3">
									<div class="avatar placeholder">
										<div class="w-10 rounded-xl {isUserActive ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-400'} font-black">
											{#if user.real_name}
												<span class="text-xs">{user.real_name.slice(0, 2)}</span>
											{:else}
												<Icon icon="mdi:account" class="text-xl" />
											{/if}
										</div>
									</div>
									<div>
										<div class="text-sm font-black {isUserActive ? 'text-slate-900' : 'text-slate-500 line-through'}">
											{user.real_name || '미지정'}
										</div>
										<div class="text-[10px] text-slate-400 font-mono">@{user.username}</div>
									</div>
								</div>
							</td>
							<td class="text-xs text-slate-500 font-normal">{user.email}</td>
							<td class="text-xs">
								<div class="flex flex-wrap items-center gap-1">
									{#if user.profile?.primary_group}
										<span class="badge badge-sm badge-neutral font-black">
											{user.profile.primary_group}
										</span>
									{:else}
										<span class="text-slate-400 italic text-[11px] font-normal">소속 없음</span>
									{/if}
								</div>
							</td>
							<td class="text-center">
								<div class="badge {rank.color} h-7 rounded-lg border-none px-3 text-[11px] font-black shadow-sm">
									{rank.label}
								</div>
							</td>
							<td class="text-center">
								{#if !isUserActive}
									<!-- 🔄 소프트 삭제된 사원 전용 복구 버튼 -->
									<button 
										onclick={() => handleRestoreUser(user)}
										class="btn btn-xs rounded-lg bg-slate-900 text-white hover:bg-slate-800 font-bold"
										title="사원 계정 복구(Lv.1)"
									>
										<Icon icon="mdi:restore" /> 계정 복구
									</button>
								{:else if (user.profile?.rank_level ?? 0) === 0}
									<!-- ⚖️ 대기자 전용 승인 및 소프트 삭제(반려) -->
									<div class="flex items-center justify-center gap-1">
										<button 
											onclick={() => changeRank(user.id, 1)}
											class="btn btn-xs rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 font-bold"
											title="정회원(Lv.1)으로 승인"
										>
											<Icon icon="mdi:check" /> 승인
										</button>
										<button 
											onclick={() => handleDeleteUser(user)}
											class="btn btn-xs btn-ghost text-rose-600 hover:bg-rose-50 rounded-lg"
											title="가입 신청 반려 (소프트 삭제)"
										>
											<Icon icon="mdi:close" /> 반려
										</button>
									</div>
								{:else}
									<!-- 🔄 일반 활동 사원 권한 조정 및 소프트 삭제 -->
									<div class="dropdown dropdown-end {isNearBottom ? 'dropdown-top' : 'dropdown-bottom'}">
										<div tabindex="0" role="button" class="btn btn-ghost btn-sm rounded-lg border border-slate-200 text-xs font-bold hover:bg-slate-100">
											조정 <Icon icon="mdi:chevron-down" />
										</div>
										<ul tabindex="0" class="dropdown-content z-[50] menu w-60 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl">
											<li class="menu-title text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 py-1">
												부여할 권한 랭크
											</li>
											{#each rankLevels as r}
												<li>
													<button 
														onclick={() => changeRank(user.id, r.val)}
														class="flex items-center justify-between text-xs font-bold py-2 {user.profile?.rank_level === r.val ? 'bg-emerald-50 text-emerald-600' : 'text-slate-700 hover:bg-slate-50'}"
													>
														<div class="flex flex-col items-start text-left">
															<span>{r.label}</span>
															<span class="text-[10px] text-slate-400 font-normal">{r.desc}</span>
														</div>
														{#if (user.profile?.rank_level ?? 0) === r.val}
															<Icon icon="mdi:check" class="text-emerald-600 text-base flex-shrink-0" />
														{/if}
													</button>
												</li>
											{/each}
											<div class="divider my-1"></div>
											<li>
												<button 
													onclick={() => handleDeleteUser(user)}
													class="text-rose-600 hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5 py-1.5"
												>
													<Icon icon="mdi:account-off-outline" /> 소프트 삭제 (퇴사)
												</button>
											</li>
										</ul>
									</div>
								{/if}
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<!-- 💡 하단 헌법 표준 가이드 -->
	<div class="rounded-2xl border border-blue-100 bg-blue-50/50 p-6">
		<h4 class="mb-3 flex items-center gap-2 text-sm font-black text-blue-900">
			<Icon icon="mdi:shield-check" class="text-lg text-blue-600" />
			사내 보안 권한 랭크 및 소프트 삭제 거버넌스 (Standard v2.0)
		</h4>
		<div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-bold leading-relaxed text-blue-900/80">
			<div class="space-y-1.5">
				<div>• <span class="font-black text-blue-950">Lv.0 (GUEST)</span>: 가입 신청 후 승인 대기자 (모든 사내 데이터 열람 차단)</div>
				<div>• <span class="font-black text-blue-950">Lv.1 (USER)</span>: 일반 정규 사원 (개인 본인 업무 리소스 CRUD)</div>
				<div>• <span class="font-black text-blue-950">Lv.2 (STAFF)</span>: 실무 담당자 (배차, 승무, 노선, 휴무 실무 권한)</div>
			</div>
			<div class="space-y-1.5">
				<div>• <span class="font-black text-blue-950">Lv.3~4 (MANAGER/ADMIN)</span>: 부서장 및 시스템 일반 운영 관리자</div>
				<div>• <span class="font-black text-blue-950">소프트 삭제 원칙</span>: 퇴사/삭제 시 데이터는 영구 보존되며, 로그인 및 권한만 안전 차단됩니다.</div>
				<div>• <span class="font-black text-blue-950">원클릭 복구</span>: 오발령 또는 복직 시 관리자가 '계정 복구'를 눌러 즉시 원상 복구 가능합니다.</div>
			</div>
		</div>
	</div>
</div>

<!-- ➕ [모달] 신규 사원 직접 등록 다이얼로그 -->
{#if showCreateModal}
	<div class="modal modal-open z-50">
		<div class="modal-box max-w-lg rounded-2xl bg-white p-6 shadow-2xl font-['Outfit','Noto_Sans_KR']">
			<div class="flex items-center justify-between border-b border-slate-100 pb-4 mb-4">
				<div class="flex items-center gap-2">
					<Icon icon="mdi:account-plus" class="text-2xl text-emerald-600" />
					<h3 class="text-lg font-black text-slate-900">신규 사원 계정 직접 등록</h3>
				</div>
				<button class="btn btn-ghost btn-sm btn-circle" onclick={() => (showCreateModal = false)}>
					<Icon icon="mdi:close" class="text-lg" />
				</button>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleCreateEmployee(); }} class="space-y-4">
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="new-username" class="block text-xs font-bold text-slate-600 mb-1">사원 아이디 *</label>
						<input 
							id="new-username"
							type="text" 
							bind:value={newEmployee.username} 
							placeholder="예: gildong" 
							class="input input-bordered input-sm w-full rounded-xl font-bold" 
							required 
						/>
					</div>
					<div>
						<label for="new-password" class="block text-xs font-bold text-slate-600 mb-1">초기 비밀번호 *</label>
						<input 
							id="new-password"
							type="password" 
							bind:value={newEmployee.password} 
							placeholder="초기 비번 입력" 
							class="input input-bordered input-sm w-full rounded-xl font-bold" 
							required 
						/>
					</div>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="new-realname" class="block text-xs font-bold text-slate-600 mb-1">성명 (실명)</label>
						<input 
							id="new-realname"
							type="text" 
							bind:value={newEmployee.real_name} 
							placeholder="예: 홍길동" 
							class="input input-bordered input-sm w-full rounded-xl font-bold" 
						/>
					</div>
					<div>
						<label for="new-empno" class="block text-xs font-bold text-slate-600 mb-1">사번</label>
						<input 
							id="new-empno"
							type="text" 
							bind:value={newEmployee.employee_no} 
							placeholder="예: 2026-001" 
							class="input input-bordered input-sm w-full rounded-xl font-bold" 
						/>
					</div>
				</div>

				<div>
					<label for="new-email" class="block text-xs font-bold text-slate-600 mb-1">회사/개인 이메일 *</label>
					<input 
						id="new-email"
						type="email" 
						bind:value={newEmployee.email} 
						placeholder="user@jeju.live" 
						class="input input-bordered input-sm w-full rounded-xl font-bold" 
						required 
					/>
				</div>

				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="new-group" class="block text-xs font-bold text-slate-600 mb-1">소속 부서 (주그룹)</label>
						<input 
							id="new-group"
							type="text" 
							bind:value={newEmployee.primary_group} 
							placeholder="예: 운수팀, 총무팀" 
							class="input input-bordered input-sm w-full rounded-xl font-bold" 
						/>
					</div>
					<div>
						<label for="new-rank" class="block text-xs font-bold text-slate-600 mb-1">초기 권한 랭크</label>
						<select id="new-rank" bind:value={newEmployee.rank_level} class="select select-bordered select-sm w-full rounded-xl font-bold">
							<option value={1}>Lv.1 정회원 (일반 사원)</option>
							<option value={2}>Lv.2 실무자 (승무/배차 등)</option>
							<option value={3}>Lv.3 부서장 (팀장급)</option>
							<option value={4}>Lv.4 운영 관리자</option>
						</select>
					</div>
				</div>

				<div class="modal-action border-t border-slate-100 pt-4 mt-6">
					<button type="button" class="btn btn-ghost btn-sm rounded-xl font-bold" onclick={() => (showCreateModal = false)}>
						취소
					</button>
					<button type="submit" class="btn btn-sm rounded-xl bg-emerald-600 text-white font-bold hover:bg-emerald-700" disabled={isSubmitting}>
						{#if isSubmitting}
							<span class="loading loading-spinner loading-xs"></span>
						{/if}
						사원 계정 생성
					</button>
				</div>
			</form>
		</div>
		<div class="modal-backdrop bg-black/40" onclick={() => (showCreateModal = false)}></div>
	</div>
{/if}

<style>
	:global(body) {
		background-color: #f8fafc;
	}
	.animate-fade-in {
		animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
	}
	@keyframes fadeIn {
		from { opacity: 0; transform: translateY(8px); }
		to { opacity: 1; transform: translateY(0); }
	}
</style>
