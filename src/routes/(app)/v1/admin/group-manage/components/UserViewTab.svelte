<script lang="ts">
  import { fade } from 'svelte/transition';
  import Icon from '@iconify/svelte';
  import { getRankMeta } from '$lib/config/rank';
  import type { GroupItem, UserGroupItem } from '$lib/services/groupAdminService';

  interface Props {
    users: UserGroupItem[];
    primaryGroups: GroupItem[];
    secondaryGroups: GroupItem[];
    maxSecondaryGroups?: number;
    canWrite?: boolean;
    onPrimaryChange?: (userId: number, newCode: string) => void;
    onAddSecondary?: (userId: number, code: string) => void;
    onRemoveSecondary?: (userId: number, code: string) => void;
  }

  let {
    users = [],
    primaryGroups = [],
    secondaryGroups = [],
    maxSecondaryGroups = 10,
    canWrite = true,
    onPrimaryChange,
    onAddSecondary,
    onRemoveSecondary
  }: Props = $props();

  let userSearchQuery = $state('');

  function getRankBadge(rank: number) {
    const meta = getRankMeta(rank);
    return { label: meta.label, class: meta.badgeClass };
  }

  let filteredUsers = $derived(
    users.filter(u =>
      !userSearchQuery.trim() ||
      (u.real_name && u.real_name.toLowerCase().includes(userSearchQuery.trim().toLowerCase())) ||
      (u.username && u.username.toLowerCase().includes(userSearchQuery.trim().toLowerCase()))
    )
  );
</script>

<div class="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-visible min-h-[380px] pb-12" in:fade={{ duration: 150 }}>
  <!-- 상단 필터 바 -->
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70">
    <div>
      <h3 class="text-base sm:text-lg font-black text-slate-900 flex items-center gap-2">
        <Icon icon="mdi:account-switch-outline" class="text-emerald-600 text-xl shrink-0" />
        사용자 주그룹 / 부그룹 매칭 ({filteredUsers.length}명)
      </h3>
      <p class="text-xs text-slate-500 font-bold mt-0.5">
        본소속(주그룹 1개)과 직무·특권·차단(부그룹 최대 {maxSecondaryGroups}개)을 즉시 매칭합니다.
      </p>
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

  <!-- 📱 모바일 전용 카드 뷰 (< md) -->
  <div class="md:hidden divide-y divide-slate-100">
    {#each filteredUsers as u (u.id)}
      {@const rankBadge = getRankBadge(u.rank_level)}
      {@const availableSecondary = secondaryGroups.filter(g => !(u.secondary_groups || []).includes(g.code))}
      <div class="p-4 space-y-3 bg-white">
        <div class="flex items-center justify-between gap-2">
          <div class="flex items-center gap-2.5 min-w-0">
            <div class="h-9 w-9 shrink-0 rounded-full bg-slate-100 text-slate-700 font-black flex items-center justify-center border text-xs uppercase">
              {(u.real_name || u.username || '?')[0]}
            </div>
            <div class="min-w-0">
              <div class="font-black text-sm text-slate-900 truncate">{u.real_name || u.username}</div>
              <div class="text-[11px] text-slate-400 font-mono truncate">@{u.username}</div>
            </div>
          </div>
          <span class="shrink-0 rounded px-2 py-0.5 text-[10px] font-black {rankBadge.class}">
            {rankBadge.label}
          </span>
        </div>

        <div class="space-y-1.5">
          <label for="m-primary-{u.id}" class="block text-[11px] font-black text-slate-500">주그룹 (본소속)</label>
          <select
            id="m-primary-{u.id}"
            disabled={!canWrite}
            class="select select-bordered select-sm w-full font-bold rounded-xl focus:border-cyan-500 bg-white"
            value={u.primary_group || ''}
            onchange={(e) => onPrimaryChange?.(u.id, e.currentTarget.value)}
          >
            <option value="">(미지정)</option>
            {#each primaryGroups as pg (pg.code)}
              <option value={pg.code}>{pg.name} ({pg.code})</option>
            {/each}
          </select>
        </div>

        <div class="space-y-1.5">
          <span class="block text-[11px] font-black text-slate-500">
            부그룹 ({(u.secondary_groups || []).length}/{maxSecondaryGroups})
          </span>
          <div class="flex flex-wrap items-center gap-1.5">
            {#each (u.secondary_groups || []) as sec (sec)}
              {@const secObj = secondaryGroups.find(g => g.code === sec)}
              {@const isRestriction = secObj?.category === 'RESTRICTION'}
              <span class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold border {isRestriction ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}">
                {sec}
                {#if canWrite}
                  <button
                    type="button"
                    class="hover:text-red-700 font-bold ml-0.5"
                    onclick={() => onRemoveSecondary?.(u.id, sec)}
                    title="부그룹 해제"
                  >
                    ×
                  </button>
                {/if}
              </span>
            {/each}

            {#if canWrite && availableSecondary.length > 0 && (u.secondary_groups || []).length < maxSecondaryGroups}
              <select
                aria-label="부그룹 추가"
                class="select select-bordered select-xs rounded-lg font-bold text-indigo-700 bg-indigo-50/50 border-indigo-200"
                value=""
                onchange={(e) => {
                  const val = e.currentTarget.value;
                  if (val) {
                    onAddSecondary?.(u.id, val);
                    e.currentTarget.value = '';
                  }
                }}
              >
                <option value="">+ 부그룹 추가</option>
                {#each availableSecondary as g (g.code)}
                  <option value={g.code}>{g.name} ({g.code})</option>
                {/each}
              </select>
            {/if}
          </div>
        </div>
      </div>
    {/each}
  </div>

  <!-- 🖥️ 데스크톱 테이블 (md 이상) -->
  <div class="hidden md:block overflow-x-auto">
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
        {#each filteredUsers as u, idx (u.id)}
          {@const rankBadge = getRankBadge(u.rank_level)}
          {@const isNearBottom = idx >= Math.max(0, filteredUsers.length - 2)}
          <tr class="hover:bg-emerald-50/30 transition-colors">
            <td class="py-3.5 px-4">
              <div class="flex items-center gap-2.5">
                <div class="h-9 w-9 rounded-full bg-slate-100 text-slate-700 font-black flex items-center justify-center border text-xs uppercase">
                  {(u.real_name || u.username || '?')[0]}
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

            <td>
              <span class="rounded px-2 py-0.5 text-[10px] font-black {rankBadge.class}">
                {rankBadge.label}
              </span>
            </td>

            <td>
              <select
                disabled={!canWrite}
                class="select select-bordered select-xs w-48 font-bold rounded-lg focus:border-cyan-500 bg-white"
                value={u.primary_group || ''}
                onchange={(e) => onPrimaryChange?.(u.id, e.currentTarget.value)}
              >
                <option value="">(미지정)</option>
                {#each primaryGroups as pg (pg.code)}
                  <option value={pg.code}>{pg.name} ({pg.code})</option>
                {/each}
              </select>
            </td>

            <td>
              <div class="flex flex-wrap items-center gap-1.5 max-w-lg">
                {#each (u.secondary_groups || []) as sec (sec)}
                  {@const secObj = secondaryGroups.find(g => g.code === sec)}
                  {@const isRestriction = secObj?.category === 'RESTRICTION'}
                  <span class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold border {isRestriction ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}">
                    {sec}
                    {#if canWrite}
                      <button
                        type="button"
                        class="hover:text-red-700 font-bold ml-0.5"
                        onclick={() => onRemoveSecondary?.(u.id, sec)}
                        title="부그룹 해제"
                      >
                        ×
                      </button>
                    {/if}
                  </span>
                {/each}

                {#if canWrite && (u.secondary_groups || []).length < maxSecondaryGroups}
                  <div class="dropdown {isNearBottom ? 'dropdown-top' : 'dropdown-bottom'}">
                    <div tabindex="0" role="button" class="btn btn-xs btn-ghost border border-dashed border-slate-300 rounded font-bold text-[10px] text-slate-500 hover:border-indigo-400 hover:text-indigo-600">
                      + 부그룹 추가
                    </div>
                    <ul tabindex="-1" class="dropdown-content z-[50] menu p-1 shadow-2xl bg-white rounded-box w-56 border border-slate-200 text-xs">
                      {#each secondaryGroups.filter(g => !(u.secondary_groups || []).includes(g.code)) as g (g.code)}
                        <li>
                          <button type="button" onclick={() => onAddSecondary?.(u.id, g.code)}>
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
                {/if}
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
