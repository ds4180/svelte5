<script lang="ts">
  import { fade } from 'svelte/transition';
  import Icon from '@iconify/svelte';
  import type { GroupItem } from '$lib/services/groupAdminService';
  import { formatDate } from '$lib/utils';

  interface Props {
    primaryGroups: GroupItem[];
    secondaryGroups: GroupItem[];
    protectedCodes?: string[];
    canWrite?: boolean;
    onEdit?: (group: GroupItem) => void;
    onDelete?: (group: GroupItem) => void;
  }

  let {
    primaryGroups = [],
    secondaryGroups = [],
    protectedCodes = [],
    canWrite = true,
    onEdit,
    onDelete
  }: Props = $props();

  let activeGroupSubTab = $state<'primary' | 'secondary'>('primary');

  function isProtected(code: string): boolean {
    return protectedCodes.includes(code);
  }
</script>

<div class="space-y-6" in:fade={{ duration: 150 }}>
  <!-- 상단 서브 탭 & 정책 안내 배너 -->
  <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-sm">
    <div class="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 w-full lg:w-auto shrink-0">
      <button
        type="button"
        class="btn btn-sm h-auto min-h-9 py-2 px-2.5 sm:px-3.5 rounded-xl font-black transition-all flex items-center justify-center gap-1 text-xs leading-tight whitespace-nowrap {activeGroupSubTab === 'primary' ? 'bg-cyan-600 text-white shadow hover:bg-cyan-700 border-cyan-600' : 'btn-ghost text-slate-600 bg-slate-50 sm:bg-transparent'}"
        onclick={() => (activeGroupSubTab = 'primary')}
      >
        <Icon icon="mdi:badge-account-outline" class="text-base shrink-0" />
        <span class="truncate">
          주그룹<span class="hidden sm:inline"> 관리 (소속 부서/팀)</span> ({primaryGroups.length})
        </span>
      </button>
      <button
        type="button"
        class="btn btn-sm h-auto min-h-9 py-2 px-2.5 sm:px-3.5 rounded-xl font-black transition-all flex items-center justify-center gap-1 text-xs leading-tight whitespace-nowrap {activeGroupSubTab === 'secondary' ? 'bg-indigo-600 text-white shadow hover:bg-indigo-700 border-indigo-600' : 'btn-ghost text-slate-600 bg-slate-50 sm:bg-transparent'}"
        onclick={() => (activeGroupSubTab = 'secondary')}
      >
        <Icon icon="mdi:shield-key-outline" class="text-base shrink-0" />
        <span class="truncate">
          부그룹<span class="hidden sm:inline"> 관리 (직무·특권·차단)</span> ({secondaryGroups.length})
        </span>
      </button>
    </div>

    <div class="text-xs font-bold text-slate-500 flex items-start gap-1.5 leading-relaxed">
      <Icon icon="mdi:information-outline" class="text-cyan-600 text-base shrink-0 mt-0.5" />
      <span>
        {#if activeGroupSubTab === 'primary'}
          <strong>주그룹</strong>은 회원의 공식 1순위 본소속 부서입니다 (1인당 1개만 선택 가능).
        {:else}
          <strong>부그룹</strong>은 직무 특권(Allow) 및 제재(Deny)를 위한 보조 그룹입니다 (복수 부여 가능).
        {/if}
      </span>
    </div>
  </div>

  <!-- ① 주그룹(Primary) 서브 리스트 -->
  {#if activeGroupSubTab === 'primary'}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" in:fade={{ duration: 100 }}>
      {#each primaryGroups as group (group.id || group.code)}
        {@const locked = isProtected(group.code)}
        <div class="card bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all rounded-2xl">
          <div class="card-body p-5">
            <div class="flex items-start justify-between gap-2">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="rounded bg-cyan-700 px-2 py-0.5 text-[10px] font-black font-mono text-white">
                  {group.code}
                </span>
                {#if locked}
                  <span class="rounded bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[9px] font-black">
                    🔒 보호 잠금
                  </span>
                {/if}
              </div>
              {#if canWrite}
                <div class="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs btn-square text-slate-400 hover:text-cyan-600 hover:bg-cyan-50"
                    onclick={() => onEdit?.(group)}
                    title="주그룹 수정"
                  >
                    <Icon icon="mdi:pencil-outline" class="text-base" />
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    class="btn btn-ghost btn-xs btn-square text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                    onclick={() => onDelete?.(group)}
                    title={locked ? '보호 잠금된 그룹은 삭제할 수 없습니다' : '주그룹 삭제'}
                  >
                    <Icon icon="mdi:trash-can-outline" class="text-base" />
                  </button>
                </div>
              {/if}
            </div>

            <h3 class="text-lg font-black text-slate-900 mt-2">{group.name}</h3>
            <p class="text-xs text-slate-500 line-clamp-2 min-h-[32px]">{group.description || '설명 없음'}</p>

            {#if (group.allow_apps?.length || 0) > 0 || (group.deny_apps?.length || 0) > 0}
              <div class="mt-2 p-2 rounded-xl bg-slate-50 border border-slate-100 space-y-1 text-[11px]">
                {#if group.allow_apps?.length > 0}
                  <div class="flex items-start gap-1.5 font-bold">
                    <span class="text-[10px] text-emerald-700 font-black shrink-0">ALLOW:</span>
                    <span class="text-slate-700 break-words min-w-0">{group.allow_apps.join(', ')}</span>
                  </div>
                {/if}
                {#if group.deny_apps?.length > 0}
                  <div class="flex items-start gap-1.5 font-bold">
                    <span class="text-[10px] text-rose-600 font-black shrink-0">DENY:</span>
                    <span class="text-rose-700 break-words min-w-0">{group.deny_apps.join(', ')}</span>
                  </div>
                {/if}
              </div>
            {/if}

            <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div class="flex items-center gap-1 font-bold text-emerald-700">
                <Icon icon="mdi:account" /> 본소속 인원: {group.primary_count || 0}명
              </div>
              <span class="text-[10px] font-bold text-slate-400">등록일: {formatDate(group.created_at)}</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- ② 부그룹(Secondary) 서브 리스트 -->
  {#if activeGroupSubTab === 'secondary'}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" in:fade={{ duration: 100 }}>
      {#each secondaryGroups as group (group.id || group.code)}
        {@const locked = isProtected(group.code)}
        <div class="card bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all rounded-2xl">
          <div class="card-body p-5">
            <div class="flex items-start justify-between gap-2">
              <div class="flex flex-wrap items-center gap-1.5">
                <span class="rounded bg-indigo-700 px-2 py-0.5 text-[10px] font-black font-mono text-white">
                  {group.code}
                </span>
                {#if group.category === 'RESTRICTION'}
                  <span class="rounded bg-rose-100 text-rose-800 border border-rose-200 px-1.5 py-0.5 text-[9px] font-extrabold">
                    차단·제재용
                  </span>
                {:else}
                  <span class="rounded bg-emerald-100 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 text-[9px] font-extrabold">
                    직무·특권용
                  </span>
                {/if}
                {#if locked}
                  <span class="rounded bg-amber-100 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[9px] font-black">
                    🔒 보호 잠금
                  </span>
                {/if}
              </div>
              {#if canWrite}
                <div class="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    class="btn btn-ghost btn-xs btn-square text-slate-400 hover:text-indigo-600 hover:bg-indigo-50"
                    onclick={() => onEdit?.(group)}
                    title="부그룹 수정"
                  >
                    <Icon icon="mdi:pencil-outline" class="text-base" />
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    class="btn btn-ghost btn-xs btn-square text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30"
                    onclick={() => onDelete?.(group)}
                    title={locked ? '보호 잠금된 그룹은 삭제할 수 없습니다' : '부그룹 삭제'}
                  >
                    <Icon icon="mdi:trash-can-outline" class="text-base" />
                  </button>
                </div>
              {/if}
            </div>

            <h3 class="text-lg font-black text-slate-900 mt-2">{group.name}</h3>
            <p class="text-xs text-slate-500 line-clamp-2 min-h-[32px]">{group.description || '설명 없음'}</p>

            <!-- 부그룹의 인스턴스·게시판·페이지 적용 현황 배지 -->
            <div class="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-[11px]">
              <div class="flex items-start gap-1.5 text-slate-600 font-bold">
                <span class="text-[10px] text-emerald-700 font-black shrink-0 mt-0.5">ALLOW 적용:</span>
                {#if group.allow_apps && group.allow_apps.length > 0}
                  <span class="text-slate-800 font-bold break-words min-w-0">{group.allow_apps.join(', ')}</span>
                {:else}
                  <span class="text-slate-400">지정 없음</span>
                {/if}
              </div>
              <div class="flex items-start gap-1.5 text-slate-600 font-bold">
                <span class="text-[10px] text-rose-600 font-black shrink-0 mt-0.5">DENY 적용:</span>
                {#if group.deny_apps && group.deny_apps.length > 0}
                  <span class="text-rose-700 font-extrabold break-words min-w-0">{group.deny_apps.join(', ')}</span>
                {:else}
                  <span class="text-slate-400">지정 없음</span>
                {/if}
              </div>
            </div>

            <div class="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <div class="flex items-center gap-1 font-bold text-indigo-700">
                <Icon icon="mdi:shield-account" /> 보유 인원: {group.secondary_count || 0}명
              </div>
              <span class="text-[10px] font-bold text-slate-400">등록일: {formatDate(group.created_at)}</span>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>
