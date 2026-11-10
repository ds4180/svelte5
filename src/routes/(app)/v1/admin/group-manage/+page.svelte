<script>
  /**
   * @file (app)/v1/admin/group-manage/+page.svelte
   * @description [코어 조직·권한 관제탑] 4대 뷰 (그룹 뷰 / 사용자 뷰 / 인스턴스 뷰 / 시스템 앱 뷰) 통합 관리 오케스트레이터
   */
  import { onMount } from 'svelte';
  import Icon from '@iconify/svelte';
  import { toast } from '$lib/runes/toast.svelte.js';
  import { getSiteTitle } from '$lib/config/site';
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
  <title>{getSiteTitle('그룹·권한 관리')}</title>
</svelte:head>

<div class="animate-fade-in mx-auto max-w-7xl space-y-8 px-4 py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:px-8">

  <!-- 🏛️ 1. 모던 엔터프라이즈 통합 헤더 -->
  <header class="flex flex-col items-start justify-between gap-6 border-b-4 border-slate-900 pb-8 md:flex-row md:items-end">
    <div>
      <div class="flex items-center gap-2 mb-2">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-cyan-50 text-cyan-700 border border-cyan-200">
          <Icon icon="ph:shield-check-bold" class="text-sm" />
          SYSTEM GOVERNANCE • GROUP & PERMISSION
        </span>
        <span class="text-xs font-bold text-slate-400 font-mono">v1/admin/group-manage</span>
      </div>
      <h1 class="text-3xl sm:text-4xl font-black tracking-tighter text-slate-900 uppercase italic md:text-5xl">
        그룹·<span class="not-italic text-cyan-600">권한 관리</span>
      </h1>
      <p class="mt-2 text-xs sm:text-sm font-bold text-slate-500">
        주/부그룹 정의, 사용자 회원 매칭 및 인스턴스/시스템 앱 독립 권한 통제 시스템
      </p>
    </div>

    <!-- 우측 필수 기본 액션바 -->
    <div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
      <button 
        class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-cyan-600 bg-cyan-600 text-white font-black text-xs uppercase tracking-wider hover:bg-cyan-700 transition shadow-sm"
        onclick={() => isCreateModalOpen = true}
      >
        <Icon icon="ph:plus-circle-bold" class="text-base" />
        <span>새 그룹 생성</span>
      </button>

      <button 
        onclick={loadAllData} 
        disabled={loading}
        class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-slate-200 bg-white font-black text-xs uppercase tracking-wider text-slate-700 hover:border-slate-400 transition shadow-sm disabled:opacity-50"
      >
        <Icon icon="ph:arrows-clockwise-bold" class="text-base {loading ? 'animate-spin' : ''}" />
        <span>새로고침</span>
      </button>

      <a
        href="/v1/admin"
        class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-slate-200 bg-white font-black text-xs uppercase tracking-wider text-slate-700 hover:border-slate-400 transition shadow-sm"
      >
        <Icon icon="ph:house-bold" class="text-base text-slate-500" />
        <span>관리자 홈</span>
      </a>
    </div>
  </header>

  <!-- 📊 2. 알림/요약 지표 카드 4종 -->
  <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
    <button
      onclick={() => (activeMainTab = 'group')}
      class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {activeMainTab === 'group' ? 'border-cyan-500 bg-cyan-50/20 ring-2 ring-cyan-500/20' : 'border-slate-100 hover:border-cyan-300'}"
    >
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-black uppercase tracking-wider text-slate-400 group-hover:text-cyan-600">Primary Groups</span>
        <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600 group-hover:scale-110 transition-transform">
          <Icon icon="ph:folder-user-bold" class="text-2xl" />
        </div>
      </div>
      <div class="text-3xl font-black text-slate-900 tracking-tight">{primaryGroups.length}<span class="text-sm font-bold text-slate-400 ml-1">개 주그룹</span></div>
      <div class="mt-2 text-xs font-bold text-cyan-600">
        <span class="rounded-lg bg-cyan-50 px-2 py-0.5 font-mono">기본 소속</span>
      </div>
    </button>

    <button
      onclick={() => (activeMainTab = 'group')}
      class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group border-slate-100 hover:border-purple-300"
    >
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-black uppercase tracking-wider text-purple-600">Secondary Groups</span>
        <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 group-hover:scale-110 transition-transform">
          <Icon icon="ph:folders-bold" class="text-2xl" />
        </div>
      </div>
      <div class="text-3xl font-black text-purple-700 tracking-tight">{secondaryGroups.length}<span class="text-sm font-bold text-slate-400 ml-1">개 부그룹</span></div>
      <div class="mt-2 text-xs font-bold text-purple-600">
        <span class="rounded-lg bg-purple-50 px-2 py-0.5 font-mono">다중 배정</span>
      </div>
    </button>

    <button
      onclick={() => (activeMainTab = 'user')}
      class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {activeMainTab === 'user' ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/20' : 'border-slate-100 hover:border-emerald-300'}"
    >
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-black uppercase tracking-wider text-emerald-600">User Mappings</span>
        <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 group-hover:scale-110 transition-transform">
          <Icon icon="ph:users-bold" class="text-2xl" />
        </div>
      </div>
      <div class="text-3xl font-black text-emerald-600 tracking-tight">{users.length}<span class="text-sm font-bold text-slate-400 ml-1">명 매칭</span></div>
      <div class="mt-2 text-xs font-bold text-emerald-600">
        <span class="rounded-lg bg-emerald-50 px-2 py-0.5 font-mono">사원 권한</span>
      </div>
    </button>

    <button
      onclick={() => (activeMainTab = 'instance')}
      class="text-left relative overflow-hidden rounded-[1.75rem] border-2 bg-white p-5 shadow-sm transition group {activeMainTab === 'instance' ? 'border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-500/20' : 'border-slate-100 hover:border-indigo-300'}"
    >
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs font-black uppercase tracking-wider text-indigo-600">Controlled Apps</span>
        <div class="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 group-hover:scale-110 transition-transform">
          <Icon icon="ph:shield-lock-bold" class="text-2xl" />
        </div>
      </div>
      <div class="text-3xl font-black text-indigo-700 tracking-tight">{instances.length}<span class="text-sm font-bold text-slate-400 ml-1">개 대상</span></div>
      <div class="mt-2 text-xs font-bold text-indigo-600">
        <span class="rounded-lg bg-indigo-50 px-2 py-0.5 font-mono">인스턴스 통제</span>
      </div>
    </button>
  </section>

  <!-- 🎛️ 3. 메인 4대 뷰 내비게이션 탭 바 -->
  <nav class="flex gap-2 border-b-2 border-slate-200 overflow-x-auto no-scrollbar">
    <button 
      class="px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeMainTab === 'group' ? 'border-b-4 border-cyan-600 text-cyan-700 bg-cyan-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
      onclick={() => (activeMainTab = 'group')}
    >
      1. 그룹 마스터 ({groups.length})
    </button>
    <button 
      class="px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeMainTab === 'user' ? 'border-b-4 border-cyan-600 text-cyan-700 bg-cyan-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
      onclick={() => (activeMainTab = 'user')}
    >
      2. 사용자 권한 ({users.length})
    </button>
    <button 
      class="px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeMainTab === 'instance' ? 'border-b-4 border-cyan-600 text-cyan-700 bg-cyan-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
      onclick={() => (activeMainTab = 'instance')}
    >
      3. 업무 인스턴스 ({businessInstances.length})
    </button>
    <button 
      class="px-6 py-3.5 text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap {activeMainTab === 'system-app' ? 'border-b-4 border-cyan-600 text-cyan-700 bg-cyan-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
      onclick={() => (activeMainTab = 'system-app')}
    >
      4. 시스템 앱 ({adminApps.length})
    </button>
  </nav>

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
