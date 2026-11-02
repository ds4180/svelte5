<script>
  import { fade } from 'svelte/transition';
  import Icon from '@iconify/svelte';

  let {
    adminApps = [],
    allGroupCodes = [],
    onSavePermissions
  } = $props();

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

  function handleInstanceAddAllow(inst, code, action = 'all') {
    inst.allow_groups = addGroupToAction(inst.allow_groups, code, action);
    onSavePermissions?.(inst);
  }

  function handleInstanceRemoveAllow(inst, code, action) {
    inst.allow_groups = removeGroupFromAction(inst.allow_groups, code, action);
    onSavePermissions?.(inst);
  }

  function handleInstanceAddDeny(inst, code, action = 'all') {
    inst.deny_groups = addGroupToAction(inst.deny_groups, code, action);
    onSavePermissions?.(inst);
  }

  function handleInstanceRemoveDeny(inst, code, action) {
    inst.deny_groups = removeGroupFromAction(inst.deny_groups, code, action);
    onSavePermissions?.(inst);
  }
</script>

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
                  onchange={() => onSavePermissions?.(inst)}
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
                  onchange={() => onSavePermissions?.(inst)}
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
                    {#each allGroupCodes as g (g.code + g.type)}
                      <div class="flex items-center justify-between p-1.5 hover:bg-emerald-50/60 rounded-xl transition-colors">
                        <div class="flex flex-col min-w-0 pr-1">
                          <span class="font-bold text-slate-800 truncate">{g.name}</span>
                          <span class="text-[10px] font-mono text-slate-400 truncate">({g.code})</span>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          <button 
                            class="btn btn-2xs rounded-md bg-emerald-600 text-white hover:bg-emerald-700 font-bold px-1.5"
                            onclick={() => handleInstanceAddAllow(inst, g.code, 'all')}
                            title="전체 권한 허용 (열람 및 실행)"
                          >
                            전체
                          </button>
                          <button 
                            class="btn btn-2xs rounded-md bg-sky-600 text-white hover:bg-sky-700 font-bold px-1.5"
                            onclick={() => handleInstanceAddAllow(inst, g.code, 'read')}
                            title="열람(진입)만 허용"
                          >
                            열람
                          </button>
                          <button 
                            class="btn btn-2xs rounded-md bg-amber-600 text-white hover:bg-amber-700 font-bold px-1.5"
                            onclick={() => handleInstanceAddAllow(inst, g.code, 'write')}
                            title="실행(쓰기)만 허용"
                          >
                            실행
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
                <span class="text-[10px] font-extrabold text-rose-700">🚨 소속 시 랭크 무관 즉시 차단</span>
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
                    {#each allGroupCodes as g (g.code + g.type)}
                      <div class="flex items-center justify-between p-1.5 hover:bg-rose-50/60 rounded-xl transition-colors">
                        <div class="flex flex-col min-w-0 pr-1">
                          <span class="font-bold text-rose-900 truncate">{g.name}</span>
                          <span class="text-[10px] font-mono text-slate-400 truncate">({g.code})</span>
                        </div>
                        <div class="flex items-center gap-1 shrink-0">
                          <button 
                            class="btn btn-2xs rounded-md bg-rose-600 text-white hover:bg-rose-700 font-bold px-1.5"
                            onclick={() => handleInstanceAddDeny(inst, g.code, 'all')}
                            title="전체 차단 (진입 불가)"
                          >
                            전체차단
                          </button>
                          <button 
                            class="btn btn-2xs rounded-md bg-orange-600 text-white hover:bg-orange-700 font-bold px-1.5"
                            onclick={() => handleInstanceAddDeny(inst, g.code, 'write')}
                            title="실행(쓰기)만 차단"
                          >
                            실행차단
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
