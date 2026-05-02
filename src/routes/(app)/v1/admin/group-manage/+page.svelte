<script>
	import { onMount } from 'svelte';
	import { fade, slide } from 'svelte/transition';
	import Icon from '@iconify/svelte';
	import { 
		adminGetGroups, 
		adminRefreshDynamicGroups, 
		adminCreateManualGroup, 
		adminCombineGroups, 
		adminDeleteGroup,
		adminGetUsers 
	} from '$lib/api/admin';

	let groups = $state([]);
	let users = $state([]);
	let loading = $state(true);
	let activeTab = $state('list'); // 'list', 'manual', 'combine'

	// 수동 그룹 생성용
	let manualGroupName = $state('');
	let selectedUserIds = $state([]);
	let userSearchQuery = $state('');

	// 집합 연산용
	let combineResultName = $state('');
	let combineOp = $state('INTERSECT');
	let baseGroup = $state('');
	let targetGroups = $state([]);

	const fetchGroups = async () => {
		try {
			groups = await adminGetGroups();
		} catch (e) {
			alert('그룹 목록 로드 실패: ' + e.message);
		}
	};

	const fetchUsers = async () => {
		try {
			users = await adminGetUsers();
		} catch (e) {
			console.error(e);
		}
	};

	onMount(async () => {
		await Promise.all([fetchGroups(), fetchUsers()]);
		loading = false;
	});

	const handleRefreshDynamic = async () => {
		if (!confirm('직급 및 아이디 길이별 다이나믹 그룹을 갱신하시겠습니까?')) return;
		try {
			await adminRefreshDynamicGroups();
			await fetchGroups();
			alert('다이나믹 그룹이 갱신되었습니다.');
		} catch (e) {
			alert('갱신 실패: ' + e.message);
		}
	};

	const handleCreateManual = async () => {
		if (!manualGroupName || selectedUserIds.length === 0) {
			alert('그룹 이름과 멤버를 선택해주세요.');
			return;
		}
		try {
			await adminCreateManualGroup({ name: manualGroupName, user_ids: selectedUserIds });
			manualGroupName = '';
			selectedUserIds = [];
			activeTab = 'list';
			await fetchGroups();
		} catch (e) {
			alert('생성 실패: ' + e.message);
		}
	};

	const handleCombine = async () => {
		if (!combineResultName || !baseGroup || targetGroups.length === 0) {
			alert('정보를 모두 입력해주세요.');
			return;
		}
		try {
			await adminCombineGroups({
				new_name: combineResultName,
				op: combineOp,
				base_group: baseGroup,
				target_groups: targetGroups
			});
			combineResultName = '';
			activeTab = 'list';
			await fetchGroups();
		} catch (e) {
			alert('연산 실패: ' + e.message);
		}
	};

	const handleDelete = async (name) => {
		if (!confirm(`'${name}' 그룹을 삭제하시겠습니까?`)) return;
		try {
			await adminDeleteGroup(name);
			await fetchGroups();
		} catch (e) {
			alert('삭제 실패: ' + e.message);
		}
	};

	const filteredUsers = $derived(
		users.filter(u => 
			u.username.includes(userSearchQuery) || 
			(u.real_name && u.real_name.includes(userSearchQuery))
		)
	);

	const getGroupColor = (type) => {
		switch(type) {
			case 'manual': return 'bg-blue-50 text-blue-700 border-blue-200';
			case 'dynamic': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
			case 'combined': return 'bg-purple-50 text-purple-700 border-purple-200';
			default: return 'bg-slate-50 text-slate-700 border-slate-200';
		}
	};
</script>

<div class="p-6 max-w-6xl mx-auto space-y-6">
	<!-- 헤더 -->
	<div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
		<div>
			<h1 class="text-2xl font-black text-slate-800 flex items-center gap-2">
				<Icon icon="mdi:account-group" class="text-indigo-500" />
				사용자 그룹 관리 (Redis)
			</h1>
			<p class="text-sm text-slate-500">알림 전송을 위한 다이나믹 및 수동 그룹을 구성합니다.</p>
		</div>
		<div class="flex gap-2">
			<button class="btn btn-sm btn-outline border-slate-200" onclick={handleRefreshDynamic}>
				<Icon icon="mdi:refresh" /> 다이나믹 갱신
			</button>
		</div>
	</div>

	<!-- 탭 메뉴 -->
	<div class="tabs tabs-boxed bg-slate-100 p-1 rounded-xl">
		<button class="tab flex-1 font-bold {activeTab === 'list' ? 'tab-active bg-white shadow-sm text-indigo-600' : ''}" onclick={() => activeTab = 'list'}>
			그룹 목록
		</button>
		<button class="tab flex-1 font-bold {activeTab === 'manual' ? 'tab-active bg-white shadow-sm text-indigo-600' : ''}" onclick={() => activeTab = 'manual'}>
			수동 그룹 생성
		</button>
		<button class="tab flex-1 font-bold {activeTab === 'combine' ? 'tab-active bg-white shadow-sm text-indigo-600' : ''}" onclick={() => activeTab = 'combine'}>
			그룹 연산 (집합)
		</button>
	</div>

	{#if loading}
		<div class="flex justify-center py-20">
			<span class="loading loading-spinner loading-lg text-indigo-500"></span>
		</div>
	{:else}
		{#if activeTab === 'list'}
			<!-- 그룹 리스트 뷰 -->
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" in:fade>
				{#each groups as group}
					<div class="card bg-white border {getGroupColor(group.type)} shadow-sm hover:shadow-md transition-all">
						<div class="card-body p-5">
							<div class="flex justify-between items-start">
								<span class="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-white/50 border border-current opacity-70">
									{group.type}
								</span>
								<button class="btn btn-ghost btn-xs text-slate-400 hover:text-red-500" onclick={() => handleDelete(group.name)}>
									<Icon icon="mdi:trash-can-outline" />
								</button>
							</div>
							<h3 class="text-lg font-black mt-2">{group.name}</h3>
							<p class="text-xs opacity-80 mb-4">{group.desc || '설명 없음'}</p>
							<div class="flex items-center justify-between mt-auto pt-4 border-t border-current/10">
								<div class="flex items-center gap-1 font-bold">
									<Icon icon="mdi:account-multiple" />
									{group.count}명
								</div>
								<div class="text-[10px] opacity-60">
									{group.created_at || '-'}
								</div>
							</div>
						</div>
					</div>
				{/each}
			</div>

		{:else if activeTab === 'manual'}
			<!-- 수동 그룹 생성 뷰 -->
			<div class="card bg-white border border-slate-200 shadow-sm" in:slide>
				<div class="card-body p-6 space-y-4">
					<div class="form-control">
						<label class="label"><span class="label-text font-bold">그룹 이름</span></label>
						<input type="text" bind:value={manualGroupName} placeholder="예: 프로젝트_A팀" class="input input-bordered w-full" />
					</div>
					
					<div class="form-control">
						<label class="label"><span class="label-text font-bold">멤버 선택 ({selectedUserIds.length}명 선택됨)</span></label>
						<div class="flex gap-2 mb-2">
							<input type="text" bind:value={userSearchQuery} placeholder="이름 또는 아이디 검색" class="input input-sm input-bordered flex-1" />
						</div>
						<div class="h-64 overflow-y-auto border border-slate-100 rounded-lg p-2 space-y-1 bg-slate-50">
							{#each filteredUsers as user}
								<label class="flex items-center gap-3 p-2 hover:bg-white rounded-md cursor-pointer transition-colors border border-transparent hover:border-slate-200">
									<input type="checkbox" class="checkbox checkbox-sm checkbox-primary" 
										bind:group={selectedUserIds} value={user.id} />
									<span class="text-sm">
										<span class="font-bold">{user.real_name || '미지정'}</span>
										<span class="text-xs text-slate-400">@{user.username}</span>
									</span>
								</label>
							{/each}
						</div>
					</div>
					
					<div class="card-actions justify-end mt-4">
						<button class="btn btn-primary px-8" onclick={handleCreateManual}>그룹 저장</button>
					</div>
				</div>
			</div>

		{:else if activeTab === 'combine'}
			<!-- 집합 연산 뷰 -->
			<div class="card bg-white border border-slate-200 shadow-sm" in:slide>
				<div class="card-body p-6 space-y-6">
					<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
						<div class="space-y-4">
							<div class="form-control">
								<label class="label"><span class="label-text font-bold">새 그룹 이름</span></label>
								<input type="text" bind:value={combineResultName} placeholder="예: 출근한_관리자" class="input input-bordered w-full" />
							</div>

							<div class="form-control">
								<label class="label"><span class="label-text font-bold">연산 방식</span></label>
								<div class="join w-full">
									<button class="btn join-item flex-1 {combineOp === 'INTERSECT' ? 'btn-primary' : 'btn-outline'}" onclick={() => combineOp = 'INTERSECT'}>교집합 (∩)</button>
									<button class="btn join-item flex-1 {combineOp === 'DIFF' ? 'btn-primary' : 'btn-outline'}" onclick={() => combineOp = 'DIFF'}>차집합 (-)</button>
									<button class="btn join-item flex-1 {combineOp === 'UNION' ? 'btn-primary' : 'btn-outline'}" onclick={() => combineOp = 'UNION'}>합집합 (∪)</button>
								</div>
							</div>
						</div>

						<div class="space-y-4">
							<div class="form-control">
								<label class="label"><span class="label-text font-bold">기준 그룹 (A)</span></label>
								<select bind:value={baseGroup} class="select select-bordered w-full">
									<option value="" disabled selected>선택하세요</option>
									{#each groups as g}
										<option value={g.name}>{g.name} ({g.count}명)</option>
									{/each}
								</select>
							</div>

							<div class="form-control">
								<label class="label"><span class="label-text font-bold">대상 그룹들 (B)</span></label>
								<div class="h-40 overflow-y-auto border border-slate-100 rounded-lg p-2 space-y-1 bg-slate-50">
									{#each groups.filter(g => g.name !== baseGroup) as g}
										<label class="flex items-center gap-3 p-1.5 hover:bg-white rounded cursor-pointer text-sm">
											<input type="checkbox" class="checkbox checkbox-xs" bind:group={targetGroups} value={g.name} />
											{g.name}
										</label>
									{/each}
								</div>
							</div>
						</div>
					</div>

					<div class="bg-indigo-50 p-4 rounded-xl text-xs text-indigo-700 leading-relaxed border border-indigo-100">
						<Icon icon="mdi:information-outline" class="inline mb-0.5" /> 
						{#if combineOp === 'INTERSECT'}
							<strong>교집합:</strong> 기준 그룹과 선택된 그룹들 모두에 공통적으로 포함된 사용자만 추출합니다.
						{:else if combineOp === 'DIFF'}
							<strong>차집합:</strong> 기준 그룹에서 선택된 그룹들에 포함된 사용자들을 제외합니다.
						{:else}
							<strong>합집합:</strong> 모든 선택된 그룹의 사용자들을 하나로 합칩니다 (중복 제거).
						{/if}
					</div>

					<div class="card-actions justify-end mt-4">
						<button class="btn btn-primary px-8" onclick={handleCombine}>연산 실행 및 생성</button>
					</div>
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	/* DaisyUI Customization */
	.tab-active {
		border-color: transparent !important;
	}
</style>
