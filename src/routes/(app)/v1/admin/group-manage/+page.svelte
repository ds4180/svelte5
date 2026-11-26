<script lang="ts">
  /**
   * @file (app)/v1/admin/group-manage/+page.svelte
   * @description [코어 조직·권한 관제탑] 4대 뷰 (그룹 / 사용자 / 인스턴스 / 시스템 앱) + 우측 끝 [설정] 탭 오케스트레이터
   */
  import { onMount } from 'svelte';
  import Icon from '@iconify/svelte';
  import {
    adminAddUserSecondaryGroup,
    adminCreateAuthGroupMaster,
    adminDeleteAuthGroupMaster,
    adminGetAuthGroupInstances,
    adminGetAuthGroupSettings,
    adminGetAuthGroupsMaster,
    adminGetAuthGroupUsers,
    adminRemoveUserSecondaryGroup,
    adminUpdateAuthGroupMaster,
    adminUpdateInstancePermissions,
    adminUpdateUserPrimaryGroup
  } from '$lib/api/admin';
  import { getSiteTitle } from '$lib/config/site';
  import { getAuthContext } from '$lib/runes/auth.svelte';
  import { toast } from '$lib/runes/toast.svelte';
  import {
    DEFAULT_GROUP_MANAGE_SETTINGS,
    normalizeGroupManageSettings,
    type GroupItem,
    type GroupMainTab,
    type GroupManageSettings,
    type InstancePermissionItem,
    type UserGroupItem
  } from '$lib/services/groupAdminService';
  import { formatApiError } from '$lib/utils/error';

  import GroupCreateModal from './components/GroupCreateModal.svelte';
  import GroupDeleteConfirmModal from './components/GroupDeleteConfirmModal.svelte';
  import GroupEditModal from './components/GroupEditModal.svelte';
  import GroupSettingsTab from './components/GroupSettingsTab.svelte';
  import GroupViewTab from './components/GroupViewTab.svelte';
  import InstanceViewTab from './components/InstanceViewTab.svelte';
  import SystemAppViewTab from './components/SystemAppViewTab.svelte';
  import UserViewTab from './components/UserViewTab.svelte';

  const auth = getAuthContext();
  const userRank = $derived(Number(auth.user?.rank_level ?? 0));

  // 1. 정책 및 권한 상태
  let groupSettings = $state<GroupManageSettings>(
    normalizeGroupManageSettings(DEFAULT_GROUP_MANAGE_SETTINGS)
  );
  let serverCanWrite = $state<boolean | null>(null);
  const canWrite = $derived(serverCanWrite !== null ? serverCanWrite : userRank >= 8);

  // 2. 데이터 및 탭 상태
  let loading = $state(true);
  let activeMainTab = $state<GroupMainTab>('group');
  let initialTabApplied = false;

  let groups = $state<GroupItem[]>([]);
  let users = $state<UserGroupItem[]>([]);
  let instances = $state<InstancePermissionItem[]>([]);

  // 3. 모달 상태
  let isCreateModalOpen = $state(false);
  let isEditModalOpen = $state(false);
  let editingGroup = $state<GroupItem | null>(null);
  let deletingGroup = $state<GroupItem | null>(null);
  let isDeleting = $state(false);

  // 4. 파생 데이터
  let adminApps = $derived(
    instances.filter(
      (i) => i.app_type === 'SYSTEM' || (i.target_id && String(i.target_id).startsWith('admin'))
    )
  );
  let businessInstances = $derived(
    instances.filter(
      (i) => i.app_type !== 'SYSTEM' && (!i.target_id || !String(i.target_id).startsWith('admin'))
    )
  );
  let primaryGroups = $derived(groups.filter((g) => g.group_type === 'PRIMARY'));
  let secondaryGroups = $derived(groups.filter((g) => g.group_type === 'SECONDARY'));
  let allGroupCodes = $derived([
    ...primaryGroups.map((g) => ({ code: g.code, name: g.name, type: '주그룹' })),
    ...secondaryGroups.map((g) => ({ code: g.code, name: g.name, type: '부그룹' }))
  ]);

  // 5. 데이터 로딩
  async function loadAllData() {
    loading = true;
    try {
      const [cfgRes, groupsRes, usersRes, instancesRes] = await Promise.all([
        adminGetAuthGroupSettings<{
          settings: GroupManageSettings;
          permissions?: { can_write?: boolean };
        }>().catch(() => null),
        adminGetAuthGroupsMaster<GroupItem[]>(),
        adminGetAuthGroupUsers<UserGroupItem[]>(),
        adminGetAuthGroupInstances<InstancePermissionItem[]>()
      ]);

      if (cfgRes?.settings) {
        groupSettings = normalizeGroupManageSettings(cfgRes.settings);
        if (!initialTabApplied && groupSettings.ui_default_main_tab) {
          activeMainTab = groupSettings.ui_default_main_tab;
          initialTabApplied = true;
        }
      }
      if (typeof cfgRes?.permissions?.can_write === 'boolean') {
        serverCanWrite = cfgRes.permissions.can_write;
      }

      groups = groupsRes || [];
      users = usersRes || [];
      instances = instancesRes || [];
    } catch (e) {
      toast.error(formatApiError(e, '그룹·권한 데이터를 불러오지 못했습니다.'));
    } finally {
      loading = false;
    }
  }

  onMount(loadAllData);

  // 6. 액션 핸들러
  async function handleCreateGroup(data: Record<string, any>) {
    try {
      await adminCreateAuthGroupMaster(data);
      toast.success(`새 그룹 [${data.name}]이(가) 등록되었습니다.`);
      isCreateModalOpen = false;
      await loadAllData();
    } catch (e) {
      toast.error(formatApiError(e, '그룹 생성에 실패했습니다.'));
    }
  }

  function openEditModal(group: GroupItem) {
    editingGroup = group;
    isEditModalOpen = true;
  }

  async function handleUpdateGroup(data: Record<string, any>) {
    if (!editingGroup) return;
    try {
      await adminUpdateAuthGroupMaster(editingGroup.id, data);
      toast.success(`그룹 [${data.name}] 정보가 수정되었습니다.`);
      isEditModalOpen = false;
      await loadAllData();
    } catch (e) {
      toast.error(formatApiError(e, '그룹 수정에 실패했습니다.'));
    }
  }

  async function handleConfirmDeleteGroup(group: GroupItem) {
    isDeleting = true;
    try {
      await adminDeleteAuthGroupMaster(group.id);
      toast.info(`그룹 [${group.name}]이(가) 삭제되었습니다.`);
      deletingGroup = null;
      await loadAllData();
    } catch (e) {
      toast.error(formatApiError(e, '그룹 삭제에 실패했습니다.'));
    } finally {
      isDeleting = false;
    }
  }

  async function handleUserPrimaryChange(userId: number, newCode: string) {
    try {
      await adminUpdateUserPrimaryGroup(userId, newCode || null);
      users = users.map((u) => (u.id === userId ? { ...u, primary_group: newCode || null } : u));
      toast.success('주그룹이 성공적으로 변경되었습니다.');
      const groupsRes = await adminGetAuthGroupsMaster<GroupItem[]>();
      groups = groupsRes || [];
    } catch (e) {
      toast.error(formatApiError(e, '주그룹 변경에 실패했습니다.'));
    }
  }

  async function handleUserAddSecondary(userId: number, code: string) {
    try {
      await adminAddUserSecondaryGroup(userId, code);
      users = users.map((u) => {
        if (u.id === userId) {
          const curr = u.secondary_groups || [];
          if (!curr.includes(code)) {
            return { ...u, secondary_groups: [...curr, code] };
          }
        }
        return u;
      });
      toast.success(`부그룹 [${code}]이(가) 추가되었습니다.`);
      const groupsRes = await adminGetAuthGroupsMaster<GroupItem[]>();
      groups = groupsRes || [];
    } catch (e) {
      toast.error(formatApiError(e, '부그룹 추가에 실패했습니다.'));
    }
  }

  async function handleUserRemoveSecondary(userId: number, code: string) {
    try {
      await adminRemoveUserSecondaryGroup(userId, code);
      users = users.map((u) => {
        if (u.id === userId) {
          return { ...u, secondary_groups: (u.secondary_groups || []).filter((c) => c !== code) };
        }
        return u;
      });
      toast.info(`부그룹 [${code}]이(가) 해제되었습니다.`);
      const groupsRes = await adminGetAuthGroupsMaster<GroupItem[]>();
      groups = groupsRes || [];
    } catch (e) {
      toast.error(formatApiError(e, '부그룹 해제에 실패했습니다.'));
    }
  }

  async function handleSaveInstancePermissions(inst: InstancePermissionItem) {
    try {
      await adminUpdateInstancePermissions(inst.instance_type, inst.target_id, {
        min_read_rank: inst.min_read_rank,
        min_write_rank: inst.min_write_rank,
        allow_groups: inst.allow_groups,
        deny_groups: inst.deny_groups
      });
      toast.success(`[${inst.title}] 인스턴스 권한이 저장되었습니다.`);
      const groupsRes = await adminGetAuthGroupsMaster<GroupItem[]>();
      groups = groupsRes || [];
    } catch (e) {
      toast.error(formatApiError(e, '인스턴스 권한 저장에 실패했습니다.'));
    }
  }

  function handleSettingsSaved(updated: GroupManageSettings) {
    groupSettings = updated;
  }
</script>

<svelte:head>
  <title>{getSiteTitle('그룹·권한 관리')}</title>
</svelte:head>

<div class="animate-fade-in mx-auto max-w-7xl space-y-6 sm:space-y-8 px-4 py-6 sm:py-8 pb-24 font-['Noto_Sans_KR','Outfit'] md:px-8">
  <!-- 🏛️ 1. 모던 엔터프라이즈 통합 헤더 -->
  <header class="flex flex-col items-start justify-between gap-5 border-b-4 border-slate-900 pb-6 md:flex-row md:items-end">
    <div>
      <div class="flex flex-wrap items-center gap-2 mb-2">
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-cyan-50 text-cyan-700 border border-cyan-200">
          <Icon icon="ph:shield-check-bold" class="text-sm" />
          SYSTEM GOVERNANCE • GROUP & PERMISSION
        </span>
        <span class="text-xs font-bold text-slate-400">
          보호 잠금 {groupSettings.protected_group_codes.length}개 · 부그룹 상한 {groupSettings.max_secondary_groups_per_user}개
        </span>
      </div>
      <h1 class="text-2xl sm:text-4xl font-black tracking-tighter text-slate-900 uppercase italic">
        그룹·<span class="not-italic text-cyan-600">권한 관리</span>
      </h1>
      <p class="mt-1.5 text-xs sm:text-sm font-bold text-slate-500">
        주/부그룹 정의, 사용자 회원 매칭 및 인스턴스/시스템 앱 독립 권한 통제 시스템
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
      {#if canWrite}
        <button
          type="button"
          class="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border-2 border-cyan-600 bg-cyan-600 text-white font-black text-xs uppercase tracking-wider hover:bg-cyan-700 transition shadow-sm"
          onclick={() => (isCreateModalOpen = true)}
        >
          <Icon icon="ph:plus-circle-bold" class="text-base" />
          <span>새 그룹 생성</span>
        </button>
      {/if}

      <button
        type="button"
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

  <!-- 📊 2. 요약 지표 카드 4종 -->
  <section class="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 md:gap-5">
    <button
      type="button"
      onclick={() => (activeMainTab = 'group')}
      class="w-full text-left relative overflow-hidden rounded-2xl sm:rounded-[1.75rem] border-2 bg-white p-4 sm:p-5 shadow-sm transition group {activeMainTab === 'group' ? 'border-cyan-500 bg-cyan-50/20 ring-2 ring-cyan-500/20' : 'border-slate-100 hover:border-cyan-300'}"
    >
      <div class="flex w-full items-center justify-between gap-2 mb-2.5">
        <span class="min-w-0 truncate text-[11px] font-black uppercase tracking-wider text-slate-400 group-hover:text-cyan-600">Primary Groups</span>
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
          <Icon icon="ph:folder-user-bold" class="text-xl" />
        </div>
      </div>
      <div class="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
        {primaryGroups.length}<span class="text-xs sm:text-sm font-bold text-slate-400 ml-1">개 주그룹</span>
      </div>
    </button>

    <button
      type="button"
      onclick={() => (activeMainTab = 'group')}
      class="w-full text-left relative overflow-hidden rounded-2xl sm:rounded-[1.75rem] border-2 bg-white p-4 sm:p-5 shadow-sm transition group border-slate-100 hover:border-purple-300"
    >
      <div class="flex w-full items-center justify-between gap-2 mb-2.5">
        <span class="min-w-0 truncate text-[11px] font-black uppercase tracking-wider text-purple-600">Secondary Groups</span>
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-purple-50 text-purple-600">
          <Icon icon="ph:folders-bold" class="text-xl" />
        </div>
      </div>
      <div class="text-2xl sm:text-3xl font-black text-purple-700 tracking-tight">
        {secondaryGroups.length}<span class="text-xs sm:text-sm font-bold text-slate-400 ml-1">개 부그룹</span>
      </div>
    </button>

    <button
      type="button"
      onclick={() => (activeMainTab = 'user')}
      class="w-full text-left relative overflow-hidden rounded-2xl sm:rounded-[1.75rem] border-2 bg-white p-4 sm:p-5 shadow-sm transition group {activeMainTab === 'user' ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/20' : 'border-slate-100 hover:border-emerald-300'}"
    >
      <div class="flex w-full items-center justify-between gap-2 mb-2.5">
        <span class="min-w-0 truncate text-[11px] font-black uppercase tracking-wider text-emerald-600">User Mappings</span>
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
          <Icon icon="ph:users-bold" class="text-xl" />
        </div>
      </div>
      <div class="text-2xl sm:text-3xl font-black text-emerald-600 tracking-tight">
        {users.length}<span class="text-xs sm:text-sm font-bold text-slate-400 ml-1">명 매칭</span>
      </div>
    </button>

    <button
      type="button"
      onclick={() => (activeMainTab = 'instance')}
      class="w-full text-left relative overflow-hidden rounded-2xl sm:rounded-[1.75rem] border-2 bg-white p-4 sm:p-5 shadow-sm transition group {activeMainTab === 'instance' ? 'border-indigo-500 bg-indigo-50/20 ring-2 ring-indigo-500/20' : 'border-slate-100 hover:border-indigo-300'}"
    >
      <div class="flex w-full items-center justify-between gap-2 mb-2.5">
        <span class="min-w-0 truncate text-[11px] font-black uppercase tracking-wider text-indigo-600">Controlled Apps</span>
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
          <Icon icon="ph:shield-lock-bold" class="text-xl" />
        </div>
      </div>
      <div class="text-2xl sm:text-3xl font-black text-indigo-700 tracking-tight">
        {instances.length}<span class="text-xs sm:text-sm font-bold text-slate-400 ml-1">개 대상</span>
      </div>
    </button>
  </section>

  <!-- 🎛️ 3. 메인 내비게이션 탭 바 (우측 끝 '설정' 탭 배치) -->
  <nav class="flex items-center gap-1.5 border-b-2 border-slate-200 overflow-x-auto no-scrollbar">
    <button
      type="button"
      class="px-4 sm:px-5 py-3 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap {activeMainTab === 'group' ? 'border-b-4 border-cyan-600 text-cyan-700 bg-cyan-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
      onclick={() => (activeMainTab = 'group')}
    >
      1. 그룹 마스터 ({groups.length})
    </button>
    <button
      type="button"
      class="px-4 sm:px-5 py-3 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap {activeMainTab === 'user' ? 'border-b-4 border-cyan-600 text-cyan-700 bg-cyan-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
      onclick={() => (activeMainTab = 'user')}
    >
      2. 사용자 권한 ({users.length})
    </button>
    <button
      type="button"
      class="px-4 sm:px-5 py-3 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap {activeMainTab === 'instance' ? 'border-b-4 border-cyan-600 text-cyan-700 bg-cyan-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
      onclick={() => (activeMainTab = 'instance')}
    >
      3. 업무 인스턴스 ({businessInstances.length})
    </button>
    <button
      type="button"
      class="px-4 sm:px-5 py-3 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap {activeMainTab === 'system-app' ? 'border-b-4 border-cyan-600 text-cyan-700 bg-cyan-50/60 rounded-t-2xl' : 'text-slate-400 hover:text-slate-700'}"
      onclick={() => (activeMainTab = 'system-app')}
    >
      4. 시스템 앱 ({adminApps.length})
    </button>

    {#if canWrite}
      <button
        type="button"
        class="ml-auto flex items-center gap-1.5 px-4 sm:px-5 py-3 text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap {activeMainTab === 'settings' ? 'border-b-4 border-indigo-600 text-indigo-700 bg-indigo-50/60 rounded-t-2xl' : 'text-slate-500 hover:text-indigo-700'}"
        onclick={() => (activeMainTab = 'settings')}
      >
        <Icon icon="solar:settings-bold-duotone" class="text-base" />
        <span>설정</span>
      </button>
    {/if}
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
        protectedCodes={groupSettings.protected_group_codes}
        {canWrite}
        onEdit={openEditModal}
        onDelete={(g) => (deletingGroup = g)}
      />
    {:else if activeMainTab === 'user'}
      <UserViewTab
        {users}
        {primaryGroups}
        {secondaryGroups}
        maxSecondaryGroups={groupSettings.max_secondary_groups_per_user}
        {canWrite}
        onPrimaryChange={handleUserPrimaryChange}
        onAddSecondary={handleUserAddSecondary}
        onRemoveSecondary={handleUserRemoveSecondary}
      />
    {:else if activeMainTab === 'instance'}
      <InstanceViewTab
        instances={businessInstances}
        {allGroupCodes}
        {canWrite}
        onSavePermissions={handleSaveInstancePermissions}
      />
    {:else if activeMainTab === 'system-app'}
      <SystemAppViewTab
        {adminApps}
        {allGroupCodes}
        {canWrite}
        onSavePermissions={handleSaveInstancePermissions}
      />
    {:else if activeMainTab === 'settings'}
      <GroupSettingsTab
        settings={groupSettings}
        allGroups={groups}
        {canWrite}
        onSaved={handleSettingsSaved}
      />
    {/if}
  {/if}
</div>

<!-- 모달 레이어 -->
<GroupCreateModal
  bind:isOpen={isCreateModalOpen}
  settings={groupSettings}
  onCreate={handleCreateGroup}
/>

<GroupEditModal
  bind:isOpen={isEditModalOpen}
  group={editingGroup}
  onUpdate={handleUpdateGroup}
/>

<GroupDeleteConfirmModal
  targetGroup={deletingGroup}
  settings={groupSettings}
  {isDeleting}
  onClose={() => (deletingGroup = null)}
  onConfirmDelete={handleConfirmDeleteGroup}
/>
