<script>
    /**
     * @file (app)/v1/admin/tasks/+page.svelte
     * @description 시스템 비동기 태스크 엔진 모니터링, 예약 스케줄러 및 수동 등록 페이지
     */
    import { onMount } from 'svelte';
    import { fastApi } from '$lib/api';
    import { fade } from 'svelte/transition';
    import Icon from '@iconify/svelte';

    // --- States ---
    let activeTab = $state('monitor'); // monitor, schedule, register
    let tasks = $state([]);
    let taskTypes = $state([]); // 동적 로드용
    let total = $state(0);
    let isLoading = $state(true);
    let selectedStatus = $state('');

    // --- Registration Form State ---
    let scheduleType = $state('none'); // none, cron, interval
    let newTask = $state({
        task_type: '',
        payload_str: '{}',
        priority: 5,
        unique_key: '',
        scheduled_at: '',
        cron_expression: '',
        repeat_interval: null,
        max_retries: 3,
        timeout_sec: 300,
        tags_str: ''
    });

    // 선택된 태스크 유형에 따라 예시 페이로드 자동 반영
    function updatePayloadExample(type) {
        const found = taskTypes.find(t => t.type === type);
        if (found) {
            newTask.payload_str = JSON.stringify(found.example, null, 4);
        }
    }

    // --- Functions ---
    async function loadTaskTypes() {
        try {
            taskTypes = await fastApi('GET', '/api/v1/admin/tasks/types');
        } catch (err) {
            console.error('태스크 유형 조회 실패:', err);
        }
    }

    async function loadTasks() {
        isLoading = true;
        try {
            // 필터링 기준: 
            // 1. monitor: 반복/예약 설정이 없는 일반 작업 + 과거/진행중인 작업
            // 2. schedule: 반복 작업(Cron/Interval) 또는 미래 시점으로 예약된 작업
            let url = `/api/v1/admin/tasks?limit=50&is_scheduler=${activeTab === 'schedule'}`;
            if (selectedStatus) url += `&status=${selectedStatus}`;
            
            const res = await fastApi('GET', url);
            tasks = res.tasks;
            total = res.total;
        } catch (err) {
            console.error('태스크 목록 조회 실패:', err);
        } finally {
            isLoading = false;
        }
    }

    // ... (기존 registerTask, retryTask, cancelTask 함수는 그대로 유지)

    // 탭 변경 시 데이터 로드
    $effect(() => {
        if (activeTab !== 'register') {
            loadTasks();
        }
    });

    onMount(() => {
        loadTasks();
        loadTaskTypes();
    });

    async function registerTask() {
        try {
            const payload = JSON.parse(newTask.payload_str);
            const tags = newTask.tags_str.split(',').map(t => t.trim()).filter(t => t);
            
            // 선택된 스케줄 타입에 따라 값 조정
            const finalCron = scheduleType === 'cron' ? newTask.cron_expression : null;
            const finalInterval = scheduleType === 'interval' ? newTask.repeat_interval : null;

            const body = {
                ...newTask,
                payload,
                tags,
                scheduled_at: newTask.scheduled_at || null,
                repeat_interval: finalInterval,
                cron_expression: finalCron,
                unique_key: newTask.unique_key || null
            };
            delete body.payload_str;
            delete body.tags_str;

            await fastApi('POST', '/api/v1/admin/tasks', body);
            alert('태스크가 성공적으로 등록되었습니다.');
            activeTab = body.cron_expression || body.repeat_interval ? 'schedule' : 'monitor';
            loadTasks();
            
            // Reset form
            scheduleType = 'none';
            newTask = {
                task_type: '',
                payload_str: '{}',
                priority: 5,
                unique_key: '',
                scheduled_at: '',
                cron_expression: '',
                repeat_interval: null,
                max_retries: 3,
                timeout_sec: 300,
                tags_str: ''
            };
        } catch (err) {
            alert('등록 실패: ' + err.message);
        }
    }

    async function retryTask(id) {
        if (!confirm('정말 이 작업을 다시 실행하시겠습니까?')) return;
        try {
            await fastApi('POST', `/api/v1/admin/tasks/${id}/retry`);
            await loadTasks();
        } catch (err) {
            alert('재시도 실패: ' + err.message);
        }
    }

    async function cancelTask(id) {
        if (!confirm('이 작업을 취소하시겠습니까?')) return;
        try {
            await fastApi('DELETE', `/api/v1/admin/tasks/${id}`);
            await loadTasks();
        } catch (err) {
            alert('취소 실패: ' + err.message);
        }
    }

    // 탭 변경 시 데이터 로드
    $effect(() => {
        if (activeTab !== 'register') {
            loadTasks();
        }
    });

    onMount(loadTasks);
</script>

<div class="p-6">
    <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold flex items-center gap-2">
            <Icon icon="mdi:cogs" class="text-primary" /> 시스템 태스크 관리
        </h1>
        <button onclick={loadTasks} class="btn btn-sm btn-outline" disabled={activeTab === 'register'}>
            <Icon icon="mdi:refresh" /> 새로고침
        </button>
    </div>

    <!-- 탭 메뉴 -->
    <div class="tabs tabs-boxed mb-6 bg-slate-100 p-1 w-fit">
        <button class="tab {activeTab === 'monitor' ? 'tab-active bg-white' : ''}" onclick={() => activeTab = 'monitor'}>
            <Icon icon="mdi:monitor-dashboard" class="mr-2"/> 작업 관제탑
        </button>
        <button class="tab {activeTab === 'schedule' ? 'tab-active bg-white' : ''}" onclick={() => activeTab = 'schedule'}>
            <Icon icon="mdi:calendar-clock" class="mr-2"/> 예약 스케줄러
        </button>
        <button class="tab {activeTab === 'register' ? 'tab-active bg-white' : ''}" onclick={() => activeTab = 'register'}>
            <Icon icon="mdi:plus-circle" class="mr-2"/> 태스크 등록
        </button>
    </div>

    {#if activeTab === 'monitor' || activeTab === 'schedule'}
        <div transition:fade>
            <!-- 필터 영역 -->
            <div class="flex gap-4 mb-6 bg-base-200 p-4 rounded-lg">
                <select bind:value={selectedStatus} onchange={loadTasks} class="select select-sm">
                    <option value="">모든 상태</option>
                    <option value="PENDING">대기중</option>
                    <option value="RUNNING">실행중</option>
                    <option value="SUCCESS">성공</option>
                    <option value="FAILED">실패</option>
                    <option value="CANCELLED">취소됨</option>
                </select>
                <span class="text-sm self-center">전체 {total}개 {activeTab === 'monitor' ? '실행' : '예약'}</span>
            </div>

            <!-- 테이블 영역 -->
            <div class="overflow-x-auto bg-base-100 rounded-box shadow">
                <table class="table w-full">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>유형</th>
                            <th>상태</th>
                            {#if activeTab === 'schedule'}
                                <th>스케줄</th>
                            {:else}
                                <th>진행률</th>
                            {/if}
                            <th>재시도</th>
                            <th>{activeTab === 'schedule' ? '예약시각' : '생성일'}</th>
                            <th>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each tasks as task}
                            <tr>
                                <td>{task.id}</td>
                                <td class="font-mono text-xs">
                                    <div class="font-bold">{task.task_type}</div>
                                    <div class="text-[10px] opacity-50">{task.unique_key || ''}</div>
                                </td>
                                <td>
                                    <span class="badge badge-sm {task.status === 'SUCCESS' ? 'badge-success' : task.status === 'FAILED' ? 'badge-error' : task.status === 'RUNNING' ? 'badge-info' : 'badge-warning'}">
                                        {task.status}
                                    </span>
                                </td>
                                <td>
                                    {#if activeTab === 'schedule'}
                                        <div class="text-xs">
                                            {#if task.cron_expression}
                                                <div class="badge badge-outline badge-xs">Cron: {task.cron_expression}</div>
                                            {/if}
                                            {#if task.repeat_interval}
                                                <div class="badge badge-outline badge-xs">Interval: {task.repeat_interval}s</div>
                                            {/if}
                                        </div>
                                    {:else}
                                        <div class="flex items-center gap-2">
                                            <progress class="progress progress-primary w-16" value={task.progress_pct} max="100"></progress>
                                            <span class="text-[10px]">{task.progress_pct}%</span>
                                        </div>
                                    {/if}
                                </td>
                                <td>{task.retry_count}/{task.max_retries}</td>
                                <td class="text-xs">
                                    {#if activeTab === 'schedule'}
                                        {task.scheduled_at ? task.scheduled_at.substring(0, 19).replace('T', ' ') : '-'}
                                    {:else}
                                        {task.created_at.substring(0, 19).replace('T', ' ')}
                                    {/if}
                                </td>
                                <td>
                                    <div class="flex gap-1">
                                        {#if task.status === 'FAILED'}
                                            <button onclick={() => retryTask(task.id)} class="btn btn-xs btn-primary">재시도</button>
                                        {/if}
                                        {#if task.status === 'PENDING' || task.status === 'RUNNING'}
                                            <button onclick={() => cancelTask(task.id)} class="btn btn-xs btn-ghost text-error" disabled={task.status === 'RUNNING'}>취소</button>
                                        {/if}
                                    </div>
                                </td>
                            </tr>
                        {:else}
                            <tr><td colspan="7" class="text-center py-10 text-slate-400">조회된 데이터가 없습니다.</td></tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>
    {:else if activeTab === 'register'}
        <div transition:fade class="bg-base-100 p-8 rounded-box shadow border border-base-200 max-w-4xl">
            <h2 class="text-xl font-bold mb-6 flex items-center gap-2">
                <Icon icon="mdi:plus-circle" class="text-primary" /> 신규 태스크 수동 등록
            </h2>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <!-- 필수 정보 -->
                <div class="space-y-4">
                    <div class="form-control">
                        <label class="label"><span class="label-text font-semibold">태스크 유형 (Task Type) *</span></label>
                        <select 
                            bind:value={newTask.task_type} 
                            onchange={() => updatePayloadExample(newTask.task_type)}
                            class="select select-bordered w-full"
                        >
                            <option value="" disabled selected>작업 유형을 선택하세요</option>
                            {#each taskTypes as item}
                                <option value={item.type}>{item.type}</option>
                            {/each}
                        </select>
                    </div>
                    
                    <div class="form-control">
                        <label class="label"><span class="label-text font-semibold">고유 키 (Unique Key)</span></label>
                        <input type="text" bind:value={newTask.unique_key} placeholder="중복 생성 방지용 (선택사항)" class="input input-bordered w-full" />
                    </div>

                    <div class="grid grid-cols-2 gap-4">
                        <div class="form-control">
                            <label class="label"><span class="label-text font-semibold">우선순위 (1~10)</span></label>
                            <input type="number" bind:value={newTask.priority} class="input input-bordered w-full" />
                        </div>
                        <div class="form-control">
                            <label class="label"><span class="label-text font-semibold">최대 재시도</span></label>
                            <input type="number" bind:value={newTask.max_retries} class="input input-bordered w-full" />
                        </div>
                    </div>

                    <div class="form-control">
                        <label class="label"><span class="label-text font-semibold">태그 (Tags)</span></label>
                        <input type="text" bind:value={newTask.tags_str} placeholder="쉼표로 구분" class="input input-bordered w-full" />
                    </div>
                </div>

                <!-- 스케줄 및 상세 설정 -->
                <div class="space-y-4">
                    <div class="form-control">
                        <label class="label"><span class="label-text font-semibold">예약 실행 시각</span></label>
                        <input type="datetime-local" bind:value={newTask.scheduled_at} class="input input-bordered w-full" />
                    </div>

                    <div class="bg-base-200 p-4 rounded-lg space-y-4">
                        <label class="label-text font-bold block mb-2">반복 실행 설정</label>
                        
                        <div class="flex gap-4 mb-4">
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="scheduleType" value="none" bind:group={scheduleType} class="radio radio-primary radio-sm" />
                                <span class="text-sm">사용 안함</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="scheduleType" value="cron" bind:group={scheduleType} class="radio radio-primary radio-sm" />
                                <span class="text-sm">Cron 표현식</span>
                            </label>
                            <label class="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="scheduleType" value="interval" bind:group={scheduleType} class="radio radio-primary radio-sm" />
                                <span class="text-sm">반복 간격</span>
                            </label>
                        </div>

                        {#if scheduleType === 'cron'}
                            <div class="form-control" transition:fade>
                                <label class="label"><span class="label-text font-semibold">Cron 표현식</span></label>
                                <input type="text" bind:value={newTask.cron_expression} placeholder="0 3 * * *" class="input input-bordered w-full" />
                                <label class="label"><span class="label-text-alt text-slate-500">예: 0 3 * * * (매일 새벽 3시)</span></label>
                            </div>
                        {:else if scheduleType === 'interval'}
                            <div class="form-control" transition:fade>
                                <label class="label"><span class="label-text font-semibold">반복 간격 (초)</span></label>
                                <input type="number" bind:value={newTask.repeat_interval} placeholder="60" class="input input-bordered w-full" />
                                <label class="label"><span class="label-text-alt text-slate-500">예: 3600 (1시간 마다)</span></label>
                            </div>
                        {/if}
                    </div>

                    <div class="form-control">
                        <label class="label"><span class="label-text font-semibold">제한 시간 (초)</span></label>
                        <input type="number" bind:value={newTask.timeout_sec} class="input input-bordered w-full" />
                    </div>

                    <div class="form-control">
                        <label class="label"><span class="label-text font-semibold">Payload (JSON)</span></label>
                        <textarea bind:value={newTask.payload_str} class="textarea textarea-bordered h-24 font-mono text-xs"></textarea>
                    </div>
                </div>
            </div>

            <div class="mt-8 flex justify-end gap-3">
                <button onclick={() => activeTab = 'monitor'} class="btn btn-ghost">취소</button>
                <button onclick={registerTask} class="btn btn-primary px-8">
                    <Icon icon="mdi:check" /> 태스크 등록하기
                </button>
            </div>
            </div>
            {/if}

            <!-- 필드 상세 가이드 (하단 도움말) -->
            <div class="mt-12 bg-slate-50 border border-slate-200 rounded-2xl p-8">
            <h3 class="text-lg font-bold mb-6 flex items-center gap-2 text-slate-700">
            <Icon icon="mdi:information-outline" class="text-info" /> 시스템 태스크 필드 상세 가이드
            </h3>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 text-sm">
            <div>
                <h4 class="font-bold text-primary mb-3 border-b border-primary/20 pb-1">기본 제어 정보</h4>
                <ul class="space-y-4">
                    <li>
                        <span class="badge badge-sm badge-outline font-mono">task_type</span>
                        <p class="mt-1 text-slate-600">작업의 성격을 정의하는 식별자입니다. 워커(Worker)는 이 이름을 보고 어떤 함수를 실행할지 결정합니다. <br/><span class="text-[11px] text-slate-400">(예: MEDIA_GC, PUSH_SEND, BACKUP_DB)</span></p>
                    </li>
                    <li>
                        <span class="badge badge-sm badge-outline font-mono">payload (JSON)</span>
                        <p class="mt-1 text-slate-600">작업에 필요한 구체적인 매개변수입니다. JSON 형식으로 입력해야 하며, 파일 ID나 유저 ID 등을 포함합니다. <br/><span class="text-[11px] text-slate-400">(예: &#123;"file_id": 123, "target": "admin"&#125;)</span></p>
                    </li>
                    <li>
                        <span class="badge badge-sm badge-outline font-mono">unique_key</span>
                        <p class="mt-1 text-slate-600">작업의 중복 방지를 위한 고유값입니다. 동일한 키를 가진 작업이 이미 대기 중이면 새로 등록되지 않습니다.</p>
                    </li>
                    <li>
                        <span class="badge badge-sm badge-outline font-mono">priority</span>
                        <p class="mt-1 text-slate-600">작업 우선순위입니다. 숫자가 **낮을수록(1)** 더 먼저 실행됩니다. 기본값은 5입니다.</p>
                    </li>
                </ul>
            </div>

            <div>
                <h4 class="font-bold text-secondary mb-3 border-b border-secondary/20 pb-1">스케줄 및 실행 정책</h4>
                <ul class="space-y-4">
                    <li>
                        <span class="badge badge-sm badge-outline font-mono">scheduled_at</span>
                        <p class="mt-1 text-slate-600">작업이 실행될 특정 미래 시점입니다. 비워두면 워커가 확인하는 즉시 실행됩니다.</p>
                    </li>
                    <li>
                        <span class="badge badge-sm badge-outline font-mono">cron_expression</span>
                        <p class="mt-1 text-slate-600">Linux Cron 표현식을 사용하여 주기적 반복 작업을 설정합니다. <br/><span class="text-[11px] text-slate-400">(예: '0 3 * * *' -> 매일 새벽 3시 실행)</span></p>
                    </li>
                    <li>
                        <span class="badge badge-sm badge-outline font-mono">repeat_interval (초)</span>
                        <p class="mt-1 text-slate-600">작업 종료 후 다음 실행까지의 간격을 초 단위로 설정합니다. Cron보다 단순한 반복에 사용됩니다.</p>
                    </li>
                    <li>
                        <span class="badge badge-sm badge-outline font-mono">max_retries / timeout</span>
                        <p class="mt-1 text-slate-600">실패 시 최대 재시도 횟수와 작업 강제 종료 시간(초)을 설정하여 무한 루프나 자원 독점을 방지합니다.</p>
                    </li>
                </ul>
            </div>
            </div>

            <div class="mt-8 p-4 bg-blue-50 border border-blue-100 rounded-lg text-[13px] text-blue-800">
            <p class="flex items-center gap-2">
                <Icon icon="mdi:lightbulb-on" />
                <strong>Tip:</strong> 등록된 작업이 '예약 스케줄러' 탭에 나타나게 하려면 <strong>Cron 표현식</strong>이나 <strong>반복 간격</strong> 중 하나를 반드시 입력해야 합니다.
            </p>
            </div>
            </div>
            </div>

