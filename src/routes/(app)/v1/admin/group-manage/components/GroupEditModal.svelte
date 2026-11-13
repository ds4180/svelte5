<script>
  import { fade, scale } from 'svelte/transition';
  import Icon from '@iconify/svelte';
  import { toast } from '$lib/runes/toast.svelte';

  let {
    isOpen = $bindable(false),
    group = null,
    onUpdate
  } = $props();

  let editGroupName = $state('');
  let editGroupCategory = $state('GENERAL');
  let editGroupDesc = $state('');

  // group prop이 변경될 때마다 로컬 편집 상태 동기화
  $effect(() => {
    if (group) {
      editGroupName = group.name || '';
      editGroupCategory = group.category || 'GENERAL';
      editGroupDesc = group.description || '';
    }
  });

  function handleSubmit() {
    if (!editGroupName.trim()) {
      toast.warning('그룹 이름을 입력해주세요.');
      return;
    }

    onUpdate?.({
      name: editGroupName.trim(),
      category: group?.group_type === 'SECONDARY' ? editGroupCategory : 'GENERAL',
      description: editGroupDesc.trim() || null
    });
  }

  function handleClose() {
    isOpen = false;
  }
</script>

{#if isOpen && group}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4" in:fade={{ duration: 100 }}>
    <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-5 border border-slate-100" in:scale={{ start: 0.95, duration: 150 }}>
      
      <div class="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 class="text-lg font-black text-slate-900 flex items-center gap-2">
          <Icon icon="mdi:folder-edit-outline" class="text-cyan-600" />
          그룹 정보 수정
        </h3>
        <button class="btn btn-xs btn-ghost btn-square text-slate-400" onclick={handleClose}>
          <Icon icon="mdi:close" class="text-base" />
        </button>
      </div>

      <div class="space-y-4">
        
        <!-- 그룹 식별 코드 (읽기 전용) -->
        <div class="form-control">
          <div class="label pb-1"><span class="label-text font-black text-xs text-slate-700">그룹 고유 식별 코드 (변경 불가)</span></div>
          <div class="input input-sm input-bordered rounded-xl font-mono font-bold bg-slate-100 flex items-center text-slate-600">
            {group.code}
          </div>
          <span class="text-[10px] text-slate-400 mt-1">※ 무결성 유지를 위해 식별 코드는 변경할 수 없습니다.</span>
        </div>

        <!-- 부그룹일 경우 성격 변경 -->
        {#if group.group_type === 'SECONDARY'}
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
        <button class="btn btn-sm btn-ghost rounded-xl font-bold text-slate-500" onclick={handleClose}>
          취소
        </button>
        <button class="btn btn-sm rounded-xl bg-cyan-700 text-white hover:bg-cyan-800 font-black px-5 shadow" onclick={handleSubmit}>
          수정 저장
        </button>
      </div>
    </div>
  </div>
{/if}
