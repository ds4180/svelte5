<script>
  /**
   * @file (app)/v1/admin/group-manage/+page.svelte
   * @description [코어 조직·권한 관제탑] 3대 뷰 (그룹 뷰 / 사용자 뷰 / 인스턴스 뷰) 실 API 연동 통합 관리 화면
   */
  import { onMount } from 'svelte';
  import { fade, slide, scale } from 'svelte/transition';
  import Icon from '@iconify/svelte';
  import { alertState } from '$lib/runes/alert.svelte.js';
  import {
    adminGetAuthGroupsMaster,
    adminCreateAuthGroupMaster,
    adminUpdateAuthGroupMaster,
    adminDeleteAuthGroupMaster,
    adminGetAuthGroupUsers,
    adminUpdateUserPrimaryGroup,
    adminAddUserSecondaryGroup,
    adminRemoveUserSecondaryGroup,
    adminGetAuthGroupInstances,
    adminUpdateInstancePermissions
  } from '$lib/api/admin';

  // =========================================================================
  // 📌 1. 상태 관리 (Svelte 5 Runes)
  // =========================================================================

  let loading = $state(true);

  // 메인 3대 뷰 탭: 'group' (그룹 뷰) | 'user' (사용자 뷰) | 'instance' (인스턴스 뷰)
  let activeMainTab = $state('group');

  // 그룹 뷰 내 서브 탭: 'primary' (주그룹 관리) | 'secondary' (부그룹 관리)
  let activeGroupSubTab = $state('primary');

  // 검색어 상태
  let groupSearchQuery = $state('');
  let userSearchQuery = $state('');

  // -------------------------------------------------------------------------
  // 📂 2. 마스터 데이터 (DB 실데이터 상태)
  // -------------------------------------------------------------------------

  let groups = $state([]);
  let users = $state([]);
  let instances = $state([]);
  let instanceFilter = $state('ALL'); // 'ALL' | 'BOARD' | 'PAGE' | 'APP'
  let instanceSearchQuery = $state('');

  // 🏛️ 시스템 앱(admin_*)과 일반 업무 인스턴스 파생 분리
  let adminApps = $derived(
    instances.filter(i => i.target_id && String(i.target_id).startsWith('admin'))
  );
  let businessInstances = $derived(
    instances.filter(i => !i.target_id || !String(i.target_id).startsWith('admin'))
  );

  // 3번 탭: 일반 업무 인스턴스 필터링 목록
  let filteredInstances = $derived(
    businessInstances.filter(i => {
      const matchesType = instanceFilter === 'ALL' || i.instance_type === instanceFilter;
      const q = instanceSearchQuery.trim().toLowerCase();
      const matchesSearch = !q ||
        (i.title && i.title.toLowerCase().includes(q)) ||
        (i.slug && i.slug.toLowerCase().includes(q)) ||
        (i.target_id && String(i.target_id).toLowerCase().includes(q)) ||
        (i.parent_engine && i.parent_engine.toLowerCase().includes(q));
      return matchesType && matchesSearch;
    })
  );

  // 4번 탭: 시스템 앱 검색 및 필터링 목록
  let systemAppSearchQuery = $state('');
  let filteredSystemApps = $derived(
    adminApps.filter(i => {
      const q = systemAppSearchQuery.trim().toLowerCase();
      return !q ||
        (i.title && i.title.toLowerCase().includes(q)) ||
        (i.slug && i.slug.toLowerCase().includes(q)) ||
        (i.target_id && String(i.target_id).toLowerCase().includes(q)) ||
        (i.parent_engine && i.parent_engine.toLowerCase().includes(q));
    })
  );

  // 주그룹(Primary)과 부그룹(Secondary) 파생 분류
  let primaryGroups = $derived(
    groups.filter(g => g.group_type === 'PRIMARY')
  );
  let secondaryGroups = $derived(
    groups.filter(g => g.group_type === 'SECONDARY')
  );

  // 전체 그룹 코드 리스트 (유효성 검사 및 드롭다운용)
  let allGroupCodes = $derived([
    ...primaryGroups.map(g => ({ code: g.code, name: g.name, type: '주그룹' })),
    ...secondaryGroups.map(g => ({ code: g.code, name: g.name, type: '부그룹' }))
  ]);

  // -------------------------------------------------------------------------
  // 🆕 3. 그룹 생성 및 수정 모달 관련 상태
  // -------------------------------------------------------------------------
  let isCreateModalOpen = $state(false);
  let newGroupType = $state('primary'); // 'primary' | 'secondary'
  let newGroupCategory = $state('PRIVILEGE'); // 'PRIVILEGE' | 'RESTRICTION'
  let newGroupCode = $state('');
  let newGroupName = $state('');
  let newGroupDesc = $state('');

  // 그룹 수정 모달 상태
  let isEditModalOpen = $state(false);
  let editingGroup = $state(null);
  let editGroupName = $state('');
  let editGroupCategory = $state('GENERAL');
  let editGroupDesc = $state('');

  // -------------------------------------------------------------------------
  // 🔄 4. 데이터 로딩
  // -------------------------------------------------------------------------

  async function loadAllData() {
    loading = true;
    try {
      const [groupsRes, usersRes, instancesRes] = await Promise.all([
        adminGetAuthGroupsMaster(),
        adminGetAuthGroupUsers(),
        adminGetAuthGroupInstances()
      ]);
      groups = groupsRes || [];
      users = usersRes || [];
      instances = instancesRes || [];
    } catch (e) {
      alertState.send('데이터 로드 실패: ' + e.message, { level: 3, style: 'error' });
    } finally {
      loading = false;
    }
  }

  onMount(loadAllData);

  // 등급 라벨 헬퍼
  function getRankBadge(rank) {
    if (rank === 9) return { label: 'ROOT (Lv.9)', class: 'bg-red-600 text-white' };
    if (rank >= 4) return { label: `ADMIN (Lv.${rank})`, class: 'bg-indigo-600 text-white' };
    if (rank >= 2) return { label: `STAFF (Lv.${rank})`, class: 'bg-emerald-600 text-white' };
    if (rank === 1) return { label: `MEMBER (Lv.1)`, class: 'bg-blue-600 text-white' };
    return { label: `GUEST (Lv.0)`, class: 'bg-slate-200 text-slate-700' };
  }

  // 인스턴스 타입 배지 헬퍼
  function getInstanceTypeMeta(type) {
    if (type === 'BOARD') {
      return { label: '게시판', color: 'bg-sky-100 text-sky-800 border-sky-300', icon: 'mdi:bulletin-board' };
    }
    if (type === 'PAGE') {
      return { label: '페이지', color: 'bg-purple-100 text-purple-800 border-purple-300', icon: 'mdi:file-document-outline' };
    }
    return { label: '단일 앱', color: 'bg-amber-100 text-amber-900 border-amber-300', icon: 'mdi:application-brackets-outline' };
  }

  // -------------------------------------------------------------------------
  // ⚙️ 5. 액션 핸들러 (실 API 연동)
  // -------------------------------------------------------------------------

  // 1) 신규 그룹 생성 (root 전용)
  async function handleCreateGroup() {
    if (!newGroupCode.trim() || !newGroupName.trim()) {
      alertState.send('그룹 식별 코드와 그룹 이름을 모두 입력해주세요.', { level: 2, style: 'warning' });
      return;
    }

    try {
      await adminCreateAuthGroupMaster({
        code: newGroupCode.trim(),
        name: newGroupName.trim(),
        group_type: newGroupType === 'primary' ? 'PRIMARY' : 'SECONDARY',
        category: newGroupType === 'primary' ? 'GENERAL' : newGroupCategory,
        description: newGroupDesc.trim() || null
      });

      alertState.send(`새 그룹 [${newGroupName}]이(가) 등록되었습니다.`, { level: 1, style: 'success' });
      newGroupCode = '';
      newGroupName = '';
      newGroupDesc = '';
      isCreateModalOpen = false;
      await loadAllData();
    } catch (e) {
      alertState.send('그룹 생성 실패: ' + e.message, { level: 3, style: 'error' });
    }
  }

  // 1-2) 그룹 수정 모달 열기
  function openEditModal(group) {
    editingGroup = group;
    editGroupName = group.name;
    editGroupCategory = group.category || 'GENERAL';
    editGroupDesc = group.description || '';
    isEditModalOpen = true;
  }

  // 1-3) 그룹 정보 수정 제출 (root 전용)
  async function handleUpdateGroup() {
    if (!editGroupName.trim()) {
      alertState.send('그룹 이름을 입력해주세요.', { level: 2, style: 'warning' });
      return;
    }

    try {
      await adminUpdateAuthGroupMaster(editingGroup.id, {
        name: editGroupName.trim(),
        category: editingGroup.group_type === 'SECONDARY' ? editGroupCategory : 'GENERAL',
        description: editGroupDesc.trim() || null
      });

      alertState.send(`그룹 [${editGroupName}] 정보가 수정되었습니다.`, { level: 1, style: 'success' });
      isEditModalOpen = false;
      await loadAllData();
    } catch (e) {
      alertState.send('그룹 수정 실패: ' + e.message, { level: 3, style: 'error' });
    }
  }

  // 2) 그룹 삭제 (root 전용)
  async function handleDeleteGroup(group) {
    const totalCount = (group.primary_count || 0) + (group.secondary_count || 0);
    const appCount = (group.allow_apps?.length || 0) + (group.deny_apps?.length || 0);

    let msg = `'${group.name}' 그룹을 삭제하시겠습니까?`;
    if (totalCount > 0 || appCount > 0) {
      msg = `⚠️ [${group.name}] 그룹이 회원 ${totalCount}명 및 인스턴스 ${appCount}곳에 설정되어 있습니다.\n삭제 시 모든 회원 및 권한 설정에서 자동 해제(Cascade)됩니다. 정말 삭제하시겠습니까?`;
    }

    if (!confirm(msg)) return;

    try {
      await adminDeleteAuthGroupMaster(group.id);
      alertState.send(`그룹 [${group.name}]이(가) 삭제되었습니다.`, { level: 1, style: 'info' });
      await loadAllData();
    } catch (e) {
      alertState.send('그룹 삭제 실패: ' + e.message, { level: 3, style: 'error' });
    }
  }

  // 3) 사용자 주그룹 변경
  async function handleUserPrimaryChange(userId, newCode) {
    try {
      await adminUpdateUserPrimaryGroup(userId, newCode || null);
      users = users.map(u => u.id === userId ? { ...u, primary_group: newCode || null } : u);
      alertState.send('주그룹이 성공적으로 변경되었습니다.', { level: 1, style: 'success' });
      const groupsRes = await adminGetAuthGroupsMaster();
      groups = groupsRes;
    } catch (e) {
      alertState.send('주그룹 변경 실패: ' + e.message, { level: 3, style: 'error' });
    }
  }

  // 4) 사용자 부그룹 추가
  async function handleUserAddSecondary(userId, code) {
    try {
      await adminAddUserSecondaryGroup(userId, code);
      users = users.map(u => {
        if (u.id === userId) {
          const curr = u.secondary_groups || [];
          if (!curr.includes(code)) {
            return { ...u, secondary_groups: [...curr, code] };
          }
        }
        return u;
      });
      alertState.send(`부그룹 [${code}]이(가) 추가되었습니다.`, { level: 1, style: 'success' });
      const groupsRes = await adminGetAuthGroupsMaster();
      groups = groupsRes;
    } catch (e) {
      alertState.send('부그룹 추가 실패: ' + e.message, { level: 3, style: 'error' });
    }
  }

  // 5) 사용자 부그룹 제거
  async function handleUserRemoveSecondary(userId, code) {
    try {
      await adminRemoveUserSecondaryGroup(userId, code);
      users = users.map(u => {
        if (u.id === userId) {
          return { ...u, secondary_groups: (u.secondary_groups || []).filter(c => c !== code) };
        }
        return u;
      });
      alertState.send(`부그룹 [${code}]이(가) 해제되었습니다.`, { level: 1, style: 'info' });
      const groupsRes = await adminGetAuthGroupsMaster();
      groups = groupsRes;
    } catch (e) {
      alertState.send('부그룹 해제 실패: ' + e.message, { level: 3, style: 'error' });
    }
  }

  // 6) 인스턴스 권한 설정 저장 (root 전용)
  async function handleSaveInstancePermissions(inst) {
    try {
      await adminUpdateInstancePermissions(inst.instance_type, inst.target_id, {
        min_read_rank: inst.min_read_rank,
        min_write_rank: inst.min_write_rank,
        allow_groups: inst.allow_groups,
        deny_groups: inst.deny_groups
      });
      alertState.send(`[${inst.title}] 인스턴스 권한이 저장되었습니다.`, { level: 1, style: 'success' });
      const groupsRes = await adminGetAuthGroupsMaster();
      groups = groupsRes;
    } catch (e) {
      alertState.send('인스턴스 권한 저장 실패: ' + e.message, { level: 3, style: 'error' });
    }
  }

  // -------------------------------------------------------------------------
  // 🏷️ JSONB 듀얼 모드 (배열 / 세분화 객체) 뷰 & 변환 헬퍼
  // -------------------------------------------------------------------------

  /**
   * allow_groups 또는 deny_groups 데이터를 화면에 표시하기 위한 뱃지 리스트로 정규화 변환
   * @param {any} groupData
   * @returns {Array<{ code: string, action: 'all' | 'read' | 'write', label: string }>}
   */
  function getGroupBadges(groupData) {
    if (!groupData) return [];
    if (Array.isArray(groupData)) {
      return groupData.filter(Boolean).map(code => ({
        code: String(code),
        action: 'all',
        label: '전체'
      }));
    }
    if (typeof groupData === 'object' && groupData !== null) {
      const badges = [];
      if (Array.isArray(groupData.all)) {
        groupData.all.forEach(code => {
          if (code) badges.push({ code: String(code), action: 'all', label: '전체' });
        });
      }
      if (Array.isArray(groupData.read)) {
        groupData.read.forEach(code => {
          if (code) badges.push({ code: String(code), action: 'read', label: '읽기' });
        });
      }
      if (Array.isArray(groupData.write)) {
        groupData.write.forEach(code => {
          if (code) badges.push({ code: String(code), action: 'write', label: '쓰기' });
        });
      }
      return badges;
    }
    return [];
  }

  /**
   * 그룹 목록에 특정 action('all' | 'read' | 'write')으로 그룹 코드를 추가
   */
  function addGroupToAction(groupData, code, action = 'all') {
    const spec = { read: [], write: [], all: [] };
    if (Array.isArray(groupData)) {
      spec.all = [...groupData.filter(Boolean)];
    } else if (typeof groupData === 'object' && groupData !== null) {
      if (Array.isArray(groupData.all)) spec.all = [...groupData.all.filter(Boolean)];
      if (Array.isArray(groupData.read)) spec.read = [...groupData.read.filter(Boolean)];
      if (Array.isArray(groupData.write)) spec.write = [...groupData.write.filter(Boolean)];
    }

    if (action === 'all') {
      spec.read = spec.read.filter(c => c !== code);
      spec.write = spec.write.filter(c => c !== code);
      if (!spec.all.includes(code)) spec.all.push(code);
    } else if (action === 'read') {
      if (!spec.all.includes(code) && !spec.read.includes(code)) {
        spec.read.push(code);
      }
    } else if (action === 'write') {
      if (!spec.all.includes(code) && !spec.write.includes(code)) {
        spec.write.push(code);
      }
    }

    if (spec.read.length === 0 && spec.write.length === 0) {
      return spec.all;
    }
    return spec;
  }

  /**
   * 특정 그룹과 액션을 그룹 목록에서 제거
   */
  function removeGroupFromAction(groupData, code, action = 'all') {
    if (Array.isArray(groupData)) {
      return groupData.filter(c => c !== code);
    }
    if (typeof groupData === 'object' && groupData !== null) {
      const updated = {
        all: (groupData.all || []).filter(c => !(c === code && (action === 'all' || !action))),
        read: (groupData.read || []).filter(c => !(c === code && (action === 'read' || !action))),
        write: (groupData.write || []).filter(c => !(c === code && (action === 'write' || !action))),
      };
      if (updated.read.length === 0 && updated.write.length === 0) {
        return updated.all;
      }
      return updated;
    }
    return [];
  }

  // 7) 인스턴스 allow 그룹 추가 (전체 / 읽기 / 쓰기)
  function handleInstanceAddAllow(inst, code, action = 'all') {
    inst.allow_groups = addGroupToAction(inst.allow_groups, code, action);
    handleSaveInstancePermissions(inst);
  }

  // 7-1) 인스턴스 allow 그룹 제거
  function handleInstanceRemoveAllow(inst, code, action) {
    inst.allow_groups = removeGroupFromAction(inst.allow_groups, code, action);
    handleSaveInstancePermissions(inst);
  }

  // 8) 인스턴스 deny 그룹 추가 (전체 / 쓰기 🚨 Deny-Wins)
  function handleInstanceAddDeny(inst, code, action = 'all') {
    inst.deny_groups = addGroupToAction(inst.deny_groups, code, action);
    handleSaveInstancePermissions(inst);
  }

  // 8-1) 인스턴스 deny 그룹 제거
  function handleInstanceRemoveDeny(inst, code, action) {
    inst.deny_groups = removeGroupFromAction(inst.deny_groups, code, action);
    handleSaveInstancePermissions(inst);
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
        <strong class="text-slate-800">그룹 뷰</strong>(주/부그룹 정의), <strong class="text-slate-800">사용자 뷰</strong>(회원 매칭), <strong class="text-slate-800">인스턴스 뷰</strong>(게시판·페이지·단일앱 4단계 권한 통제)의 일체형 시스템
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

  <!-- 🎛️ 2. 메인 4대 뷰 내비게이션 탭 바 -->
  <div class="tabs tabs-boxed bg-slate-200/80 p-1.5 rounded-2xl flex flex-wrap md:flex-nowrap border border-slate-300 shadow-inner gap-1">
    <!-- 탭 1: 그룹 뷰 -->
    <button 
      class="tab flex-1 h-12 rounded-xl font-black text-xs md:text-sm transition-all flex items-center justify-center gap-2 {activeMainTab === 'group' ? 'bg-white shadow-md text-cyan-700' : 'text-slate-600 hover:text-slate-900'}"
      onclick={() => activeMainTab = 'group'}
    >
      <Icon icon="mdi:folder-account-outline" class="text-xl" />
      <span>1. 그룹 뷰</span>
      <span class="rounded-full bg-cyan-100 text-cyan-800 px-2 py-0.5 text-[10px] font-bold">
        {groups.length}개
      </span>
    </button>

    <!-- 탭 2: 사용자 뷰 -->
    <button 
      class="tab flex-1 h-12 rounded-xl font-black text-xs md:text-sm transition-all flex items-center justify-center gap-2 {activeMainTab === 'user' ? 'bg-white shadow-md text-emerald-700' : 'text-slate-600 hover:text-slate-900'}"
      onclick={() => activeMainTab = 'user'}
    >
      <Icon icon="mdi:account-details-outline" class="text-xl" />
      <span>2. 사용자 뷰</span>
      <span class="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-[10px] font-bold">
        {users.length}명 매칭
      </span>
    </button>

    <!-- 탭 3: 업무 인스턴스 뷰 -->
    <button 
      class="tab flex-1 h-12 rounded-xl font-black text-xs md:text-sm transition-all flex items-center justify-center gap-2 {activeMainTab === 'instance' ? 'bg-white shadow-md text-indigo-700' : 'text-slate-600 hover:text-slate-900'}"
      onclick={() => activeMainTab = 'instance'}
    >
      <Icon icon="mdi:shield-lock-outline" class="text-xl" />
      <span>3. 인스턴스 뷰</span>
      <span class="rounded-full bg-indigo-100 text-indigo-800 px-2 py-0.5 text-[10px] font-bold">
        {businessInstances.length}개
      </span>
    </button>

    <!-- 탭 4: 시스템 앱 뷰 (신설!) -->
    <button 
      class="tab flex-1 h-12 rounded-xl font-black text-xs md:text-sm transition-all flex items-center justify-center gap-2 {activeMainTab === 'system-app' ? 'bg-white shadow-md text-purple-700' : 'text-slate-600 hover:text-slate-900'}"
      onclick={() => activeMainTab = 'system-app'}
    >
      <Icon icon="mdi:shield-account-outline" class="text-xl text-purple-600" />
      <span>4. 시스템 앱 뷰</span>
      <span class="rounded-full bg-purple-100 text-purple-800 px-2 py-0.5 text-[10px] font-bold">
        {adminApps.length}개 시스템 앱
      </span>
    </button>
  </div>

  {#if loading}
    <div class="flex justify-center py-20">
      <span class="loading loading-spinner loading-lg text-cyan-600"></span>
    </div>
  {:else}

    <!-- ========================================================================= -->
    <!-- 📂 3-A. [그룹 뷰]: 주그룹과 부그룹을 명확히 분류하여 생성·수정·삭제·관리 -->
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
              <div class="card bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all rounded-2xl">
                <div class="card-body p-5">
                  <div class="flex items-start justify-between">
                    <span class="rounded bg-cyan-700 px-2 py-0.5 text-[10px] font-black font-mono text-white">
                      {group.code}
                    </span>
                    <div class="flex items-center gap-1">
                      <button 
                        class="btn btn-ghost btn-xs btn-square text-slate-400 hover:text-cyan-600 hover:bg-cyan-50"
                        onclick={() => openEditModal(group)}
                        title="주그룹 수정"
                      >
                        <Icon icon="mdi:pencil-outline" class="text-base" />
                      </button>
                      <button 
                        class="btn btn-ghost btn-xs btn-square text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onclick={() => handleDeleteGroup(group)}
                        title="주그룹 삭제"
                      >
                        <Icon icon="mdi:trash-can-outline" class="text-base" />
                      </button>
                    </div>
                  </div>

                  <h3 class="text-lg font-black text-slate-900 mt-2">{group.name}</h3>
                  <p class="text-xs text-slate-500 line-clamp-2 min-h-[32px]">{group.description || '설명 없음'}</p>

                  <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div class="flex items-center gap-1 font-bold text-emerald-700">
                      <Icon icon="mdi:account" /> 본소속 인원: {group.primary_count || 0}명
                    </div>
                    <span class="text-[10px] font-bold text-slate-400">등록일: {group.created_at ? new Date(group.created_at).toLocaleDateString() : '-'}</span>
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
                    <div class="flex items-center gap-1">
                      <button 
                        class="btn btn-ghost btn-xs btn-square text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                        onclick={() => openEditModal(group)}
                        title="부그룹 수정"
                      >
                        <Icon icon="mdi:pencil-outline" class="text-base" />
                      </button>
                      <button 
                        class="btn btn-ghost btn-xs btn-square text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onclick={() => handleDeleteGroup(group)}
                        title="부그룹 삭제"
                      >
                        <Icon icon="mdi:trash-can-outline" class="text-base" />
                      </button>
                    </div>
                  </div>

                  <h3 class="text-lg font-black text-slate-900 mt-2">{group.name}</h3>
                  <p class="text-xs text-slate-500 line-clamp-2 min-h-[32px]">{group.description || '설명 없음'}</p>

                  <!-- 부그룹의 인스턴스 적용 현황 배지 -->
                  <div class="mt-3 p-2 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-[11px]">
                    <div class="flex items-center gap-1 text-slate-600 font-bold">
                      <span class="text-[10px] text-emerald-700 font-black">ALLOW 적용:</span>
                      {#if group.allow_apps && group.allow_apps.length > 0}
                        <span class="text-slate-800 font-bold">{group.allow_apps.join(', ')}</span>
                      {:else}
                        <span class="text-slate-400">지정 없음</span>
                      {/if}
                    </div>
                    <div class="flex items-center gap-1 text-slate-600 font-bold">
                      <span class="text-[10px] text-rose-600 font-black">DENY 적용:</span>
                      {#if group.deny_apps && group.deny_apps.length > 0}
                        <span class="text-rose-700 font-extrabold">{group.deny_apps.join(', ')}</span>
                      {:else}
                        <span class="text-slate-400">지정 없음</span>
                      {/if}
                    </div>
                  </div>

                  <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div class="flex items-center gap-1 font-bold text-indigo-700">
                      <Icon icon="mdi:shield-account" /> 보유 인원: {group.secondary_count || 0}명
                    </div>
                    <span class="text-[10px] font-bold text-slate-400">등록일: {group.created_at ? new Date(group.created_at).toLocaleDateString() : '-'}</span>
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
            <p class="text-xs text-slate-500 font-bold">각 회원의 본소속(주그룹 1개)과 직무·특권·차단(부그룹 N개)을 선택하여 즉시 매칭합니다.</p>
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
              {#each users.filter(u => !userSearchQuery || (u.real_name && u.real_name.includes(userSearchQuery)) || u.username.includes(userSearchQuery)) as u}
                {@const rankBadge = getRankBadge(u.rank_level)}
                <tr class="hover:bg-emerald-50/30 transition-colors">
                  
                  <!-- 회원 기본 정보 -->
                  <td class="py-3.5 px-4">
                    <div class="flex items-center gap-2.5">
                      <div class="h-9 w-9 rounded-full bg-slate-100 text-slate-700 font-black flex items-center justify-center border text-xs uppercase">
                        {(u.real_name || u.username)[0]}
                      </div>
                      <div>
                        <div class="font-black text-sm text-slate-900 flex items-center gap-1.5">
                          {u.real_name || u.username}
                          {#if !u.real_name}
                            <span class="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                              이름 미등록
                            </span>
                          {/if}
                        </div>
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
                      {#each (u.secondary_groups || []) as sec}
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
                          {#each secondaryGroups.filter(g => !(u.secondary_groups || []).includes(g.code)) as g}
                            <li>
                              <button onclick={() => handleUserAddSecondary(u.id, g.code)}>
                                <span class="font-bold">{g.name}</span>
                                <span class="text-[10px] font-mono text-slate-400">({g.code})</span>
                              </button>
                            </li>
                          {/each}
                          {#if secondaryGroups.filter(g => !(u.secondary_groups || []).includes(g.code)).length === 0}
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
    <!-- 🧩 3-C. [인스턴스 뷰]: 개별 인스턴스(게시판·페이지·단일앱) 4단계 권한 관제 -->
    <!-- ========================================================================= -->
    {#if activeMainTab === 'instance'}
      <div class="space-y-4" in:fade={{ duration: 150 }}>
        
        <!-- 상단 4단계 권한 정책 요약 배너 -->
        <div class="rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-50/70 via-white to-indigo-50/40 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 class="text-sm font-black text-indigo-950 flex items-center gap-1.5">
              <Icon icon="mdi:shield-check" class="text-indigo-600 text-lg" />
              인스턴스 권한 검증 4단계 실행 정책
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
            🚨 Deny-Wins: 차단 그룹에 포함된 회원은 상위 랭킹이라도 무조건 접근이 차단됩니다.
          </div>
        </div>

        <!-- 인스턴스 서브 필터 및 검색 바 -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div class="join border border-slate-200 bg-slate-100 p-1 rounded-xl shadow-xs">
            <button 
              class="btn btn-xs join-item font-bold border-none {instanceFilter === 'ALL' ? 'bg-indigo-600 text-white shadow' : 'bg-transparent text-slate-600'}"
              onclick={() => instanceFilter = 'ALL'}
            >
              전체 인스턴스 ({businessInstances.length})
            </button>
            <button 
              class="btn btn-xs join-item font-bold border-none {instanceFilter === 'BOARD' ? 'bg-indigo-600 text-white shadow' : 'bg-transparent text-slate-600'}"
              onclick={() => instanceFilter = 'BOARD'}
            >
              📋 게시판 ({businessInstances.filter(i => i.instance_type === 'BOARD').length})
            </button>
            <button 
              class="btn btn-xs join-item font-bold border-none {instanceFilter === 'PAGE' ? 'bg-indigo-600 text-white shadow' : 'bg-transparent text-slate-600'}"
              onclick={() => instanceFilter = 'PAGE'}
            >
              📄 페이지 ({businessInstances.filter(i => i.instance_type === 'PAGE').length})
            </button>
            <button 
              class="btn btn-xs join-item font-bold border-none {instanceFilter === 'APP' ? 'bg-indigo-600 text-white shadow' : 'bg-transparent text-slate-600'}"
              onclick={() => instanceFilter = 'APP'}
            >
              🚐 업무 앱 ({businessInstances.filter(i => i.instance_type === 'APP').length})
            </button>
          </div>

          <div class="w-full md:w-64 relative">
            <Icon icon="mdi:magnify" class="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              bind:value={instanceSearchQuery} 
              placeholder="인스턴스명, 슬러그 검색..." 
              class="input input-sm input-bordered w-full rounded-xl pl-9 font-bold bg-white focus:border-indigo-500"
            />
          </div>
        </div>

        <!-- 인스턴스 목록 카드 그리드 -->
        <div class="grid grid-cols-1 gap-4">
          {#each filteredInstances as inst (inst.instance_type + '_' + inst.target_id)}
            {@const typeMeta = getInstanceTypeMeta(inst.instance_type)}
            <div class="card bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <div class="card-body p-6">
                
                <!-- 인스턴스 헤더 영역 -->
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div class="flex items-center gap-3">
                    <div class="h-11 w-11 rounded-2xl bg-slate-100 flex items-center justify-center text-2xl text-indigo-600">
                      <Icon icon={typeMeta.icon} />
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="rounded px-2 py-0.5 text-[10px] font-black border {typeMeta.color}">
                          {typeMeta.label}
                        </span>
                        <h3 class="text-lg font-black text-slate-900">{inst.title}</h3>
                        {#if inst.slug}
                          <span class="rounded bg-slate-100 font-mono text-slate-600 px-2 py-0.5 text-[10px] font-bold">
                            /{inst.slug}
                          </span>
                        {/if}
                      </div>
                      <p class="text-xs text-slate-400 font-bold mt-0.5">
                        엔진: <span class="text-slate-600">{inst.parent_engine}</span> | 식별키: <span class="font-mono text-slate-500">{inst.target_id}</span>
                      </p>
                    </div>
                  </div>

                  <!-- 4단계: 랭킹 설정 슬롯 -->
                  <div class="flex items-center gap-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-black text-slate-600">읽기 최소 랭킹:</span>
                      <select 
                        class="select select-bordered select-xs w-20 font-bold bg-white"
                        bind:value={inst.min_read_rank}
                        onchange={() => handleSaveInstancePermissions(inst)}
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
                        bind:value={inst.min_write_rank}
                        onchange={() => handleSaveInstancePermissions(inst)}
                      >
                        {#each Array(10) as _, i}
                          <option value={i}>Lv.{i}</option>
                        {/each}
                      </select>
                    </div>
                  </div>
                </div>

                <!-- 그룹 Allow & Deny 설정 영역 (2분할 - JSONB 듀얼 모드 완벽 지원) -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  
                  <!-- 3단계: ALLOW 그룹 (허용) -->
                  <div class="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-2.5">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                        <Icon icon="mdi:check-circle-outline" class="text-base text-emerald-600" />
                        허용 그룹 (allow_groups)
                      </span>
                      <span class="text-[10px] font-bold text-emerald-700">전체 / 읽기 / 쓰기 세분화 허용</span>
                    </div>

                    <div class="flex flex-wrap items-center gap-1.5 min-h-[36px]">
                      {#each getGroupBadges(inst.allow_groups) as badge}
                        <span class="inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-bold
                          {badge.action === 'all' ? 'bg-emerald-100 text-emerald-950 border-emerald-300' : ''}
                          {badge.action === 'read' ? 'bg-sky-100 text-sky-950 border-sky-300' : ''}
                          {badge.action === 'write' ? 'bg-amber-100 text-amber-950 border-amber-300' : ''}"
                        >
                          <span class="text-[9px] font-black px-1 py-0.2 rounded
                            {badge.action === 'all' ? 'bg-emerald-200 text-emerald-800' : ''}
                            {badge.action === 'read' ? 'bg-sky-200 text-sky-800' : ''}
                            {badge.action === 'write' ? 'bg-amber-200 text-amber-800' : ''}"
                          >
                            {badge.label}
                          </span>
                          <span>{badge.code}</span>
                          <button 
                            class="hover:text-red-600 ml-0.5 font-black text-xs leading-none"
                            onclick={() => handleInstanceRemoveAllow(inst, badge.code, badge.action)}
                            title="허용 그룹에서 제외"
                          >
                            ×
                          </button>
                        </span>
                      {/each}

                      <!-- 허용 그룹 추가 드롭다운 (원클릭 전체/읽기/쓰기 선택) -->
                      <div class="dropdown dropdown-bottom">
                        <div tabindex="0" role="button" class="btn btn-xs bg-white border border-emerald-300 text-emerald-800 rounded-lg font-bold hover:bg-emerald-50">
                          + 허용 추가
                        </div>
                        <div tabindex="-1" class="dropdown-content z-20 p-2 shadow-2xl bg-white rounded-2xl w-72 border border-emerald-200 text-xs space-y-1 max-h-64 overflow-y-auto">
                          <div class="px-2 py-1 text-[11px] font-black text-slate-400 border-b border-slate-100 flex justify-between">
                            <span>대상 그룹</span>
                            <span>허용 범위 선택</span>
                          </div>
                          {#each allGroupCodes as g}
                            <div class="flex items-center justify-between p-1.5 hover:bg-emerald-50/60 rounded-xl transition-colors">
                              <div class="flex flex-col min-w-0 pr-1">
                                <span class="font-bold text-slate-800 truncate">{g.name}</span>
                                <span class="text-[10px] font-mono text-slate-400 truncate">({g.code})</span>
                              </div>
                              <div class="flex items-center gap-1 shrink-0">
                                <button 
                                  class="btn btn-2xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700 font-bold px-1.5"
                                  onclick={() => handleInstanceAddAllow(inst, g.code, 'all')}
                                  title="읽기·쓰기 모두 허용"
                                >
                                  전체
                                </button>
                                <button 
                                  class="btn btn-2xs rounded-md bg-sky-600 text-white hover:bg-sky-700 font-bold px-1.5"
                                  onclick={() => handleInstanceAddAllow(inst, g.code, 'read')}
                                  title="읽기(열람)만 허용"
                                >
                                  읽기
                                </button>
                                <button 
                                  class="btn btn-2xs rounded-md bg-amber-600 text-white hover:bg-amber-700 font-bold px-1.5"
                                  onclick={() => handleInstanceAddAllow(inst, g.code, 'write')}
                                  title="쓰기(등록/수정)만 허용"
                                >
                                  쓰기
                                </button>
                              </div>
                            </div>
                          {/each}
                        </div>
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
                      <span class="text-[10px] font-extrabold text-rose-700">🚨 소속 시 랭킹 무관 즉시 차단</span>
                    </div>

                    <div class="flex flex-wrap items-center gap-1.5 min-h-[36px]">
                      {#each getGroupBadges(inst.deny_groups) as badge}
                        <span class="inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-bold
                          {badge.action === 'all' ? 'bg-rose-100 text-rose-950 border-rose-300' : ''}
                          {badge.action === 'write' ? 'bg-orange-100 text-orange-950 border-orange-300' : ''}
                          {badge.action === 'read' ? 'bg-purple-100 text-purple-950 border-purple-300' : ''}"
                        >
                          <span class="text-[9px] font-black px-1 py-0.2 rounded
                            {badge.action === 'all' ? 'bg-rose-200 text-rose-800' : ''}
                            {badge.action === 'write' ? 'bg-orange-200 text-orange-800' : ''}
                            {badge.action === 'read' ? 'bg-purple-200 text-purple-800' : ''}"
                          >
                            {badge.label}차단
                          </span>
                          <span>{badge.code}</span>
                          <button 
                            class="hover:text-red-700 ml-0.5 font-black text-xs leading-none"
                            onclick={() => handleInstanceRemoveDeny(inst, badge.code, badge.action)}
                            title="차단 그룹에서 제외"
                          >
                            ×
                          </button>
                        </span>
                      {/each}

                      <!-- 차단 그룹 추가 드롭다운 (원클릭 전체/쓰기차단 선택) -->
                      <div class="dropdown dropdown-bottom">
                        <div tabindex="0" role="button" class="btn btn-xs bg-white border border-rose-300 text-rose-800 rounded-lg font-bold hover:bg-rose-50">
                          + 차단 추가
                        </div>
                        <div tabindex="-1" class="dropdown-content z-20 p-2 shadow-2xl bg-white rounded-2xl w-72 border border-rose-200 text-xs space-y-1 max-h-64 overflow-y-auto">
                          <div class="px-2 py-1 text-[11px] font-black text-slate-400 border-b border-slate-100 flex justify-between">
                            <span>차단 대상 그룹</span>
                            <span>차단 범위 선택</span>
                          </div>
                          {#each allGroupCodes as g}
                            <div class="flex items-center justify-between p-1.5 hover:bg-rose-50/60 rounded-xl transition-colors">
                              <div class="flex flex-col min-w-0 pr-1">
                                <span class="font-bold text-rose-900 truncate">{g.name}</span>
                                <span class="text-[10px] font-mono text-slate-400 truncate">({g.code})</span>
                              </div>
                              <div class="flex items-center gap-1 shrink-0">
                                <button 
                                  class="btn btn-2xs rounded-md bg-rose-600 text-white hover:bg-rose-700 font-bold px-1.5"
                                  onclick={() => handleInstanceAddDeny(inst, g.code, 'all')}
                                  title="읽기·쓰기 모두 차단 (Deny-Wins)"
                                >
                                  전체차단
                                </button>
                                <button 
                                  class="btn btn-2xs rounded-md bg-orange-600 text-white hover:bg-orange-700 font-bold px-1.5"
                                  onclick={() => handleInstanceAddDeny(inst, g.code, 'write')}
                                  title="쓰기만 차단 (열람은 허용)"
                                >
                                  쓰기차단
                                </button>
                              </div>
                            </div>
                          {/each}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          {/each}

          {#if filteredInstances.length === 0}
            <div class="card bg-white border border-slate-200 p-12 text-center text-slate-400 rounded-2xl">
              <Icon icon="mdi:database-search-outline" class="mx-auto text-4xl mb-2 text-slate-300" />
              <p class="font-bold text-sm">조건에 맞는 인스턴스가 존재하지 않습니다.</p>
            </div>
          {/if}
        </div>

      </div>
    {/if}

    <!-- ========================================================================= -->
    <!-- ⚙️ 3-D. [4. 시스템 앱 뷰]: admin_* 시스템 앱별 원자적 권한 배분 및 허용 그룹 관리 -->
    <!-- ========================================================================= -->
    {#if activeMainTab === 'system-app'}
      <div class="space-y-4" in:fade={{ duration: 150 }}>
        
        <!-- 상단 정책 요약 배너 -->
        <div class="rounded-2xl border border-purple-200 bg-gradient-to-r from-purple-50/80 via-white to-purple-50/40 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h3 class="text-sm font-black text-purple-950 flex items-center gap-1.5">
              <Icon icon="mdi:shield-account" class="text-purple-600 text-lg" />
              시스템 관리자 앱(`admin_*`) 독립 권한 배분 통제소
            </h3>
            <p class="text-xs font-bold text-slate-600 mt-1">
              티어 구분 없이 각 시스템 앱별로 <strong>허용 그룹(`allow_groups`)</strong>과 <strong>최소 권한 랭크(`min_read_rank`)</strong>를 원자적으로 배분합니다.
            </p>
            <div class="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-slate-600">
              <span class="rounded bg-slate-900 text-white px-2 py-0.5 text-[10px]">1단계</span> root(Lv.9) 무조건 통과
              <span>➔</span>
              <span class="rounded bg-rose-600 text-white px-2 py-0.5 text-[10px]">2단계</span> deny 그룹 즉시 차단
              <span>➔</span>
              <span class="rounded bg-emerald-600 text-white px-2 py-0.5 text-[10px]">3단계</span> allow 그룹 즉시 통과 (Allow-Wins)
              <span>➔</span>
              <span class="rounded bg-blue-600 text-white px-2 py-0.5 text-[10px]">4단계</span> 최소 랭크 대소비교
            </div>
          </div>
          <div class="text-[11px] font-extrabold text-purple-900 bg-purple-100/70 px-3 py-2 rounded-xl border border-purple-200 text-right">
            <span>✨ 등록된 시스템 앱: <strong>{adminApps.length}개</strong></span><br/>
            <span class="text-[10px] text-purple-700 font-bold">운영팀, 총무팀 등에 자유롭게 권한 위임 가능</span>
          </div>
        </div>

        <!-- 검색 바 -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div class="flex items-center gap-2">
            <span class="text-xs font-black text-slate-600">시스템 앱 필터링:</span>
            <span class="badge badge-sm badge-purple font-mono font-bold">{filteredSystemApps.length} / {adminApps.length}개</span>
          </div>

          <div class="w-full md:w-72 relative">
            <Icon icon="mdi:magnify" class="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              bind:value={systemAppSearchQuery} 
              placeholder="시스템 앱 명칭, ID, 경로 검색..." 
              class="input input-sm input-bordered w-full rounded-xl pl-9 font-bold bg-white focus:border-purple-500"
            />
          </div>
        </div>

        <!-- 시스템 앱 목록 카드 그리드 -->
        <div class="grid grid-cols-1 gap-4">
          {#each filteredSystemApps as inst (inst.instance_type + '_' + inst.target_id)}
            <div class="card bg-white border border-slate-200 hover:border-purple-300 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <div class="card-body p-6">
                
                <!-- 헤더 영역 -->
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                  <div class="flex items-center gap-3">
                    <div class="h-11 w-11 rounded-2xl bg-purple-50 border border-purple-200 flex items-center justify-center text-2xl text-purple-600">
                      <Icon icon={inst.icon || 'mdi:cog-box'} />
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <span class="rounded px-2 py-0.5 text-[10px] font-black border bg-purple-50 text-purple-700 border-purple-200">
                          ⚙️ 시스템 앱
                        </span>
                        <h3 class="text-lg font-black text-slate-900">{inst.title}</h3>
                        <span class="rounded bg-slate-100 font-mono text-slate-600 px-2 py-0.5 text-[10px] font-bold">
                          {inst.target_id}
                        </span>
                      </div>
                      <p class="text-xs text-slate-400 font-bold mt-0.5">
                        진입 경로: <span class="font-mono text-purple-700 font-black">/v1/admin/{String(inst.target_id).replace('admin_', '')}</span>
                      </p>
                    </div>
                  </div>

                  <!-- 4단계: 랭킹 설정 슬롯 -->
                  <div class="flex items-center gap-4 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-black text-slate-600">열람(진입) 최소 랭크:</span>
                      <select 
                        class="select select-bordered select-xs w-20 font-bold bg-white focus:border-purple-500"
                        bind:value={inst.min_read_rank}
                        onchange={() => handleSaveInstancePermissions(inst)}
                      >
                        {#each Array(10) as _, i}
                          <option value={i}>Lv.{i}</option>
                        {/each}
                      </select>
                    </div>
                    <div class="flex items-center gap-2 border-l border-slate-200 pl-4">
                      <span class="text-xs font-black text-slate-600">실행(쓰기) 최소 랭크:</span>
                      <select 
                        class="select select-bordered select-xs w-20 font-bold bg-white focus:border-purple-500"
                        bind:value={inst.min_write_rank}
                        onchange={() => handleSaveInstancePermissions(inst)}
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
                      <span class="text-[10px] font-bold text-emerald-700">지정 시 랭크 무관 즉시 허가 (Allow-Wins)</span>
                    </div>

                    <div class="flex flex-wrap items-center gap-1.5 min-h-[36px]">
                      {#each getGroupBadges(inst.allow_groups) as badge}
                        <span class="inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-bold
                          {badge.action === 'all' ? 'bg-emerald-100 text-emerald-950 border-emerald-300' : ''}
                          {badge.action === 'read' ? 'bg-sky-100 text-sky-950 border-sky-300' : ''}
                          {badge.action === 'write' ? 'bg-amber-100 text-amber-950 border-amber-300' : ''}"
                        >
                          <span class="text-[9px] font-black px-1 py-0.2 rounded
                            {badge.action === 'all' ? 'bg-emerald-200 text-emerald-800' : ''}
                            {badge.action === 'read' ? 'bg-sky-200 text-sky-800' : ''}
                            {badge.action === 'write' ? 'bg-amber-200 text-amber-800' : ''}"
                          >
                            {badge.label}
                          </span>
                          <span>{badge.code}</span>
                          <button 
                            class="hover:text-red-600 ml-0.5 font-black text-xs leading-none"
                            onclick={() => handleInstanceRemoveAllow(inst, badge.code, badge.action)}
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
                        <div tabindex="-1" class="dropdown-content z-20 p-2 shadow-2xl bg-white rounded-2xl w-72 border border-emerald-200 text-xs space-y-1 max-h-64 overflow-y-auto">
                          <div class="px-2 py-1 text-[11px] font-black text-slate-400 border-b border-slate-100 flex justify-between">
                            <span>대상 그룹</span>
                            <span>허용 범위 선택</span>
                          </div>
                          {#each allGroupCodes as g}
                            <div class="flex items-center justify-between p-1.5 hover:bg-emerald-50/60 rounded-xl transition-colors">
                              <div class="flex flex-col min-w-0 pr-1">
                                <span class="font-bold text-slate-800 truncate">{g.name}</span>
                                <span class="text-[10px] font-mono text-slate-400 truncate">({g.code})</span>
                              </div>
                              <div class="flex items-center gap-1 shrink-0">
                                <button 
                                  class="btn btn-2xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700 font-bold px-1.5"
                                  onclick={() => handleInstanceAddAllow(inst, g.code, 'all')}
                                  title="읽기·쓰기 모두 허용"
                                >
                                  전체
                                </button>
                                <button 
                                  class="btn btn-2xs rounded-md bg-sky-600 text-white hover:bg-sky-700 font-bold px-1.5"
                                  onclick={() => handleInstanceAddAllow(inst, g.code, 'read')}
                                  title="열람만 허용"
                                >
                                  열람
                                </button>
                              </div>
                            </div>
                          {/each}
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- 2단계: DENY 그룹 (차단) -->
                  <div class="rounded-xl border border-rose-200 bg-rose-50/40 p-4 space-y-2.5">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-black text-rose-900 flex items-center gap-1.5">
                        <Icon icon="mdi:close-circle-outline" class="text-base text-rose-600" />
                        차단 그룹 (deny_groups)
                      </span>
                      <span class="text-[10px] font-bold text-rose-700">소속 시 무조건 차단 (Deny-Wins)</span>
                    </div>

                    <div class="flex flex-wrap items-center gap-1.5 min-h-[36px]">
                      {#each getGroupBadges(inst.deny_groups) as badge}
                        <span class="inline-flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-xs font-bold
                          {badge.action === 'all' ? 'bg-rose-100 text-rose-950 border-rose-300' : ''}
                          {badge.action === 'write' ? 'bg-orange-100 text-orange-950 border-orange-300' : ''}
                          {badge.action === 'read' ? 'bg-purple-100 text-purple-950 border-purple-300' : ''}"
                        >
                          <span class="text-[9px] font-black px-1 py-0.2 rounded
                            {badge.action === 'all' ? 'bg-rose-200 text-rose-800' : ''}
                            {badge.action === 'write' ? 'bg-orange-200 text-orange-800' : ''}
                            {badge.action === 'read' ? 'bg-purple-200 text-purple-800' : ''}"
                          >
                            {badge.label}차단
                          </span>
                          <span>{badge.code}</span>
                          <button 
                            class="hover:text-red-700 ml-0.5 font-black text-xs leading-none"
                            onclick={() => handleInstanceRemoveDeny(inst, badge.code, badge.action)}
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
                        <div tabindex="-1" class="dropdown-content z-20 p-2 shadow-2xl bg-white rounded-2xl w-72 border border-rose-200 text-xs space-y-1 max-h-64 overflow-y-auto">
                          <div class="px-2 py-1 text-[11px] font-black text-slate-400 border-b border-slate-100 flex justify-between">
                            <span>차단 대상 그룹</span>
                            <span>차단 범위 선택</span>
                          </div>
                          {#each allGroupCodes as g}
                            <div class="flex items-center justify-between p-1.5 hover:bg-rose-50/60 rounded-xl transition-colors">
                              <div class="flex flex-col min-w-0 pr-1">
                                <span class="font-bold text-rose-900 truncate">{g.name}</span>
                                <span class="text-[10px] font-mono text-slate-400 truncate">({g.code})</span>
                              </div>
                              <div class="flex items-center gap-1 shrink-0">
                                <button 
                                  class="btn btn-2xs rounded-md bg-rose-600 text-white hover:bg-rose-700 font-bold px-1.5"
                                  onclick={() => handleInstanceAddDeny(inst, g.code, 'all')}
                                  title="읽기·쓰기 모두 차단 (Deny-Wins)"
                                >
                                  전체차단
                                </button>
                                <button 
                                  class="btn btn-2xs rounded-md bg-orange-600 text-white hover:bg-orange-700 font-bold px-1.5"
                                  onclick={() => handleInstanceAddDeny(inst, g.code, 'write')}
                                  title="쓰기만 차단 (열람은 허용)"
                                >
                                  쓰기차단
                                </button>
                              </div>
                            </div>
                          {/each}
                        </div>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            </div>
          {/each}

          {#if filteredSystemApps.length === 0}
            <div class="card bg-white border border-slate-200 p-12 text-center text-slate-400 rounded-2xl">
              <Icon icon="mdi:shield-search" class="mx-auto text-4xl mb-2 text-purple-300" />
              <p class="font-bold text-sm">조건에 맞는 시스템 앱이 존재하지 않습니다.</p>
            </div>
          {/if}
        </div>

      </div>
    {/if}

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
          <div class="label pb-1"><span class="label-text font-black text-xs text-slate-700">그룹 분류 (주그룹 / 부그룹)</span></div>
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
            <div class="label pb-1"><span class="label-text font-black text-xs text-slate-700">부그룹 성격</span></div>
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
          <div class="label pb-1"><span class="label-text font-black text-xs text-slate-700">그룹 고유 식별 코드 (코드값)</span></div>
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
          <div class="label pb-1"><span class="label-text font-black text-xs text-slate-700">그룹 명칭 (UI 표시용)</span></div>
          <input 
            type="text" 
            bind:value={newGroupName} 
            placeholder="예: 운수 3팀 (심야간선), 임시 배차담당" 
            class="input input-sm input-bordered rounded-xl font-bold focus:border-cyan-500"
          />
        </div>

        <!-- 그룹 설명 -->
        <div class="form-control">
          <div class="label pb-1"><span class="label-text font-black text-xs text-slate-700">그룹 설명 및 운영 목적</span></div>
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

<!-- ========================================================================= -->
<!-- ✏️ 5. 그룹 정보 수정 모달 (root 전용) -->
<!-- ========================================================================= -->
{#if isEditModalOpen && editingGroup}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" in:fade={{ duration: 100 }}>
    <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-5 border border-slate-100" in:scale={{ start: 0.95, duration: 150 }}>
      
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 class="text-lg font-black text-slate-900 flex items-center gap-2">
          <Icon icon="mdi:folder-edit-outline" class="text-cyan-600" />
          그룹 정보 수정
        </h3>
        <button class="btn btn-xs btn-ghost btn-square text-slate-400" onclick={() => isEditModalOpen = false}>
          <Icon icon="mdi:close" class="text-base" />
        </button>
      </div>

      <div class="space-y-4">
        
        <!-- 그룹 식별 코드 (읽기 전용) -->
        <div class="form-control">
          <div class="label pb-1"><span class="label-text font-black text-xs text-slate-700">그룹 고유 식별 코드 (변경 불가)</span></div>
          <div class="input input-sm input-bordered rounded-xl font-mono font-bold bg-slate-100 flex items-center text-slate-600">
            {editingGroup.code}
          </div>
          <span class="text-[10px] text-slate-400 mt-1">※ 무결성 유지를 위해 식별 코드는 변경할 수 없습니다.</span>
        </div>

        <!-- 부그룹일 경우 성격 변경 -->
        {#if editingGroup.group_type === 'SECONDARY'}
          <div class="form-control">
            <div class="label pb-1"><span class="label-text font-black text-xs text-slate-700">부그룹 성격</span></div>
            <div class="grid grid-cols-2 gap-2">
              <button 
                type="button"
                class="btn btn-xs rounded-lg font-bold {editGroupCategory === 'PRIVILEGE' ? 'bg-emerald-600 text-white' : 'btn-outline border-slate-200'}"
                onclick={() => editGroupCategory = 'PRIVILEGE'}
              >
                직무·특권형 (Allow)
              </button>
              <button 
                type="button"
                class="btn btn-xs rounded-lg font-bold {editGroupCategory === 'RESTRICTION' ? 'bg-rose-600 text-white' : 'btn-outline border-slate-200'}"
                onclick={() => editGroupCategory = 'RESTRICTION'}
              >
                제재·블랙리스트 (Deny)
              </button>
            </div>
          </div>
        {/if}

        <!-- 그룹 표시 명칭 -->
        <div class="form-control">
          <div class="label pb-1"><span class="label-text font-black text-xs text-slate-700">그룹 명칭 (UI 표시용)</span></div>
          <input 
            type="text" 
            bind:value={editGroupName} 
            placeholder="예: 운수 1팀 (시내간선)" 
            class="input input-sm input-bordered rounded-xl font-bold focus:border-cyan-500"
          />
        </div>

        <!-- 그룹 설명 -->
        <div class="form-control">
          <div class="label pb-1"><span class="label-text font-black text-xs text-slate-700">그룹 설명 및 운영 목적</span></div>
          <textarea 
            bind:value={editGroupDesc} 
            placeholder="그룹의 조직상 역할 또는 접근 통제 목적을 입력하세요." 
            rows="3"
            class="textarea textarea-bordered rounded-xl font-bold text-xs focus:border-cyan-500"
          ></textarea>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
        <button class="btn btn-sm btn-ghost rounded-xl font-bold text-slate-500" onclick={() => isEditModalOpen = false}>
          취소
        </button>
        <button class="btn btn-sm rounded-xl bg-cyan-700 text-white hover:bg-cyan-800 font-black px-5 shadow" onclick={handleUpdateGroup}>
          수정 저장
        </button>
      </div>
    </div>
  </div>
{/if}
