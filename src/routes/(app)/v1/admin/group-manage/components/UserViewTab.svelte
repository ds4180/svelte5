<script>
  import { fade } from 'svelte/transition';
  import Icon from '@iconify/svelte';

  let {
    users = [],
    primaryGroups = [],
    secondaryGroups = [],
    onPrimaryChange,
    onAddSecondary,
    onRemoveSecondary
  } = $props();

  let userSearchQuery = $state('');

  function getRankBadge(rank) {
    if (rank === 9) return { label: 'ROOT (Lv.9)', class: 'bg-red-600 text-white' };
    if (rank >= 4) return { label: `ADMIN (Lv.${rank})`, class: 'bg-indigo-600 text-white' };
    if (rank >= 2) return { label: `STAFF (Lv.${rank})`, class: 'bg-emerald-600 text-white' };
    if (rank === 1) return { label: `MEMBER (Lv.1)`, class: 'bg-blue-600 text-white' };
    return { label: `GUEST (Lv.0)`, class: 'bg-slate-200 text-slate-700' };
  }

  let filteredUsers = $derived(
    users.filter(u => 
      !userSearchQuery.trim() || 
      (u.real_name && u.real_name.toLowerCase().includes(userSearchQuery.trim().toLowerCase())) || 
      (u.username && u.username.toLowerCase().includes(userSearchQuery.trim().toLowerCase()))
    )
  );
</script>

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
        {#each filteredUsers as u (u.id)}
          {@const rankBadge = getRankBadge(u.rank_level)}
          <tr class="hover:bg-emerald-50/30 transition-colors">
            
            <!-- 회원 기본 정보 -->
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
                onchange={(e) => onPrimaryChange?.(u.id, e.currentTarget.value)}
              >
                <option value="">(미지정)</option>
                {#each primaryGroups as pg (pg.code)}
                  <option value={pg.code}>{pg.name} ({pg.code})</option>
                {/each}
              </select>
            </td>

            <!-- 부그룹 (태그 뱃지 리스트 & 추가 드롭다운) -->
            <td>
              <div class="flex flex-wrap items-center gap-1.5 max-w-lg">
                {#each (u.secondary_groups || []) as sec (sec)}
                  {@const secObj = secondaryGroups.find(g => g.code === sec)}
                  {@const isRestriction = secObj?.category === 'RESTRICTION'}
                  
                  <span class="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-bold border {isRestriction ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'}">
                    {sec}
                    <button 
                      class="hover:text-red-700 font-bold ml-0.5" 
                      onclick={() => onRemoveSecondary?.(u.id, sec)}
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
                    {#each secondaryGroups.filter(g => !(u.secondary_groups || []).includes(g.code)) as g (g.code)}
                      <li>
                        <button onclick={() => onAddSecondary?.(u.id, g.code)}>
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
