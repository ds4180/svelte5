<script>
  import { fade, scale, slide } from 'svelte/transition';
  import Icon from '@iconify/svelte';
  import { toast } from '$lib/runes/toast.svelte.ts';

  let {
    isOpen = $bindable(false),
    onCreate
  } = $props();

  let newGroupType = $state('primary'); // 'primary' | 'secondary'
  let newGroupCategory = $state('PRIVILEGE'); // 'PRIVILEGE' | 'RESTRICTION'
  let newGroupCode = $state('');
  let newGroupName = $state('');
  let newGroupDesc = $state('');

  function handleSubmit() {
    if (!newGroupCode.trim() || !newGroupName.trim()) {
      toast.warning('그룹 식별 코드와 그룹 이름을 모두 입력해주세요.');
      return;
    }

    onCreate?.({
      code: newGroupCode.trim(),
      name: newGroupName.trim(),
      group_type: newGroupType === 'primary' ? 'PRIMARY' : 'SECONDARY',
      category: newGroupType === 'primary' ? 'GENERAL' : newGroupCategory,
      description: newGroupDesc.trim() || null
    });

    newGroupCode = '';
    newGroupName = '';
    newGroupDesc = '';
  }

  function handleClose() {
    isOpen = false;
  }
</script>

{#if isOpen}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" in:fade={{ duration: 100 }}>
    <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-5 border border-slate-100" in:scale={{ start: 0.95, duration: 150 }}>
      
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 class="text-lg font-black text-slate-900 flex items-center gap-2">
          <Icon icon="mdi:folder-plus-outline" class="text-cyan-600" />
          신규 공식 그룹 등록
        </h3>
        <button class="btn btn-xs btn-ghost btn-square text-slate-400" onclick={handleClose}>
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
        <button class="btn btn-sm btn-ghost rounded-xl font-bold text-slate-500" onclick={handleClose}>
          취소
        </button>
        <button class="btn btn-sm rounded-xl bg-slate-900 text-white hover:bg-slate-800 font-black px-5 shadow" onclick={handleSubmit}>
          그룹 등록
        </button>
      </div>
    </div>
  </div>
{/if}
