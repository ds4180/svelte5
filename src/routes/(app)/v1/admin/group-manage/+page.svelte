<script>
  /**
   * @file (app)/v1/admin/group-manage/+page.svelte
   * @description [코어 조직·권한 관제탑] 4대 뷰 (그룹 뷰 / 사용자 뷰 / 인스턴스 뷰 / 시스템 앱 뷰) 통합 관리 오케스트레이터
   */
  import { onMount } from 'svelte';
  import Icon from '@iconify/svelte';
  import { toast } from '$lib/runes/toast.svelte.ts';
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

  import GroupViewTab from './components/GroupViewTab.svelte';
  import UserViewTab from './components/UserViewTab.svelte';
  import InstanceViewTab from './components/InstanceViewTab.svelte';
  import SystemAppViewTab from './components/SystemAppViewTab.svelte';
  import GroupCreateModal from './components/GroupCreateModal.svelte';
  import GroupEditModal from './components/GroupEditModal.svelte';

  // 1. 상태 관리
  let loading = $state(true);
  let activeMainTab = $state('group'); // 'group' | 'user' | 'instance' | 'system-app'

  let groups = $state([]);
  let users = $state([]);
  let instances = $state([]);

  // 모달 상태
  let isCreateModalOpen = $state(false);
  let isEditModalOpen = $state(false);
  let editingGroup = $state(null);

  // 2. 파생 데이터 (🏛️ 3대 앱 분류 체계 및 접두사 제거 헌법 표준 동기화)
  let adminApps = $derived(
    instances.filter(i => i.app_type === 'SYSTEM' || (i.target_id && String(i.target_id).startsWith('admin')))
  );
  let businessInstances = $derived(
    instances.filter(i => i.app_type !== 'SYSTEM' && (!i.target_id || !String(i.target_id).startsWith('admin')))
  );
  let primaryGroups = $derived(
    groups.filter(g => g.group_type === 'PRIMARY')
  );
  let secondaryGroups = $derived(
    groups.filter(g => g.group_type === 'SECONDARY')
  );
  let allGroupCodes = $derived([
    ...primaryGroups.map(g => ({ code: g.code, name: g.name, type: '주그룹' })),
    ...secondaryGroups.map(g => ({ code: g.code, name: g.name, type: '부그룹' }))
  ]);

  // 3. 데이터 로딩
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
      toast.error('데이터 로드 실패: ' + e.message);
    } finally {
      loading = false;
    }
  }

  onMount(loadAllData);

  // 4. 액션 핸들러
  async function handleCreateGroup(data) {
    try {
      await adminCreateAuthGroupMaster(data);
      toast.success(`새 그룹 [${data.name}]이(가) 등록되었습니다.`);
      isCreateModalOpen = false;
      await loadAllData();
    } catch (e) {
      toast.error('그룹 생성 실패: ' + e.message);
    }
  }

  function openEditModal(group) {
    editingGroup = group;
    isEditModalOpen = true;
  }

  async function handleUpdateGroup(data) {
    if (!editingGroup) return;
    try {
      await adminUpdateAuthGroupMaster(editingGroup.id, data);
      toast.success(`그룹 [${data.name}] 정보가 수정되었습니다.`);
      isEditModalOpen = false;
      await loadAllData();
    } catch (e) {
      toast.error('그룹 수정 실패: ' + e.message);
    }
  }

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
      toast.info(`그룹 [${group.name}]이(가) 삭제되었습니다.`);
      await loadAllData();
    } catch (e) {
      toast.error('그룹 삭제 실패: ' + e.message);
    }
  }

  async function handleUserPrimaryChange(userId, newCode) {
    try {
      await adminUpdateUserPrimaryGroup(userId, newCode || null);
      users = users.map(u => u.id === userId ? { ...u, primary_group: newCode || null } : u);
      toast.success('주그룹이 성공적으로 변경되었습니다.');
      const groupsRes = await adminGetAuthGroupsMaster();
      groups = groupsRes || [];
    } catch (e) {
      toast.error('주그룹 변경 실패: ' + e.message);
    }
  }

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
      toast.success(`부그룹 [${code}]이(가) 추가되었습니다.`);
      const groupsRes = await adminGetAuthGroupsMaster();
      groups = groupsRes || [];
    } catch (e) {
      toast.error('부그룹 추가 실패: ' + e.message);
    }
  }

  async function handleUserRemoveSecondary(userId, code) {
    try {
      await adminRemoveUserSecondaryGroup(userId, code);
      users = users.map(u => {
        if (u.id === userId) {
          return { ...u, secondary_groups: (u.secondary_groups || []).filter(c => c !== code) };
        }
        return u;
      });
      toast.info(`부그룹 [${code}]이(가) 해제되었습니다.`);
      const groupsRes = await adminGetAuthGroupsMaster();
      groups = groupsRes || [];
    } catch (e) {
      toast.error('부그룹 해제 실패: ' + e.message);
    }
  }

  async function handleSaveInstancePermissions(inst) {
    try {
      await adminUpdateInstancePermissions(inst.instance_type, inst.target_id, {
        min_read_rank: inst.min_read_rank,
        min_write_rank: inst.min_write_rank,
        allow_groups: inst.allow_groups,
        deny_groups: inst.deny_groups
      });
      toast.success(`[${inst.title}] 인스턴스 권한이 저장되었습니다.`);
      const groupsRes = await adminGetAuthGroupsMaster();
      groups = groupsRes || [];
    } catch (e) {
      toast.error('인스턴스 권한 저장 실패: ' + e.message);
    }
  }
</script>

<svelte:head>
  <title>그룹·권한 관리 | jeju.live Core</title>
</svelte:head>

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
        그룹·<span class="not-italic text-cyan-600">권한 관리</span>
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

    <!-- 탭 4: 시스템 앱 뷰 -->
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
    {#if activeMainTab === 'group'}
      <GroupViewTab 
        {primaryGroups} 
        {secondaryGroups} 
        onEdit={openEditModal} 
        onDelete={handleDeleteGroup} 
      />
    {:else if activeMainTab === 'user'}
      <UserViewTab 
        {users} 
        {primaryGroups} 
        {secondaryGroups} 
        onPrimaryChange={handleUserPrimaryChange} 
        onAddSecondary={handleUserAddSecondary} 
        onRemoveSecondary={handleUserRemoveSecondary} 
      />
    {:else if activeMainTab === 'instance'}
      <InstanceViewTab 
        instances={businessInstances} 
        {allGroupCodes} 
        onSavePermissions={handleSaveInstancePermissions} 
      />
    {:else if activeMainTab === 'system-app'}
      <SystemAppViewTab 
        {adminApps} 
        {allGroupCodes} 
        onSavePermissions={handleSaveInstancePermissions} 
      />
    {/if}
  {/if}

</div>

<!-- 모달 레이어 -->
<GroupCreateModal 
  bind:isOpen={isCreateModalOpen} 
  onCreate={handleCreateGroup} 
/>

<GroupEditModal 
  bind:isOpen={isEditModalOpen} 
  group={editingGroup} 
  onUpdate={handleUpdateGroup} 
/>
