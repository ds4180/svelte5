<script>
  import { fade } from 'svelte/transition';
  import Icon from '@iconify/svelte';

  let {
    primaryGroups = [],
    secondaryGroups = [],
    onEdit,
    onDelete
  } = $props();

  // 그룹 뷰 내 서브 탭: 'primary' (주그룹 관리) | 'secondary' (부그룹 관리)
  let activeGroupSubTab = $state('primary');
</script>

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
      {#each primaryGroups as group (group.id || group.code)}
        <div class="card bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all rounded-2xl">
          <div class="card-body p-5">
            <div class="flex items-start justify-between">
              <span class="rounded bg-cyan-700 px-2 py-0.5 text-[10px] font-black font-mono text-white">
                {group.code}
              </span>
              <div class="flex items-center gap-1">
                <button 
                  class="btn btn-ghost btn-xs btn-square text-slate-400 hover:text-cyan-600 hover:bg-cyan-50"
                  onclick={() => onEdit?.(group)}
                  title="주그룹 수정"
                >
                  <Icon icon="mdi:pencil-outline" class="text-base" />
                </button>
                <button 
                  class="btn btn-ghost btn-xs btn-square text-slate-400 hover:text-red-600 hover:bg-red-50"
                  onclick={() => onDelete?.(group)}
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
      {#each secondaryGroups as group (group.id || group.code)}
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
                  onclick={() => onEdit?.(group)}
                  title="부그룹 수정"
                >
                  <Icon icon="mdi:pencil-outline" class="text-base" />
                </button>
                <button 
                  class="btn btn-ghost btn-xs btn-square text-slate-400 hover:text-red-600 hover:bg-red-50"
                  onclick={() => onDelete?.(group)}
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
