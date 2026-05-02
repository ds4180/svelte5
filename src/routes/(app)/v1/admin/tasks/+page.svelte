<script>
    /**
     * @file (app)/v1/admin/tasks/+page.svelte
     * @description 시스템 비동기 태스크 엔진 모니터링 및 예약 스케줄러 통합 페이지
     */
    import { onMount } from 'svelte';
    import { fastApi } from '$lib/api';
    import { fade } from 'svelte/transition';
    import Icon from '@iconify/svelte';

    // --- States ---
    let activeTab = $state('monitor');
    let tasks = $state([]);
    let total = $state(0);
    let isLoading = $state(true);
    let selectedStatus = $state('');

    // --- Functions ---
    async function loadTasks() {
        isLoading = true;
        try {
            let url = '/api/v1/admin/tasks?limit=50';
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

    onMount(loadTasks);
</script>

<div class="p-6">
    <div class="flex justify-between items-center mb-6">
        <h1 class="text-2xl font-bold flex items-center gap-2">
            <Icon icon="mdi:cogs" class="text-primary" /> 시스템 태스크 관제탑
        </h1>
        <button onclick={loadTasks} class="btn btn-sm btn-outline">
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
    </div>

    {#if activeTab === 'monitor'}
        <div transition:fade>
            <!-- 필터 영역 -->
            <div class="flex gap-4 mb-6 bg-base-200 p-4 rounded-lg">
                <select bind:value={selectedStatus} onchange={loadTasks} class="select select-sm">
                    <option value="">모든 상태</option>
                    <option value="PENDING">대기중</option>
                    <option value="RUNNING">실행중</option>
                    <option value="SUCCESS">성공</option>
                    <option value="FAILED">실패</option>
                </select>
                <span class="text-sm self-center">전체 {total}개 작업</span>
            </div>

            <!-- 테이블 영역 -->
            <div class="overflow-x-auto bg-base-100 rounded-box shadow">
                <table class="table w-full">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>유형</th>
                            <th>상태</th>
                            <th>진행률</th>
                            <th>재시도</th>
                            <th>생성일</th>
                            <th>관리</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each tasks as task}
                            <tr>
                                <td>{task.id}</td>
                                <td class="font-mono text-xs">{task.task_type}</td>
                                <td>
                                    <span class="badge {task.status === 'SUCCESS' ? 'badge-success' : task.status === 'FAILED' ? 'badge-error' : 'badge-warning'}">
                                        {task.status}
                                    </span>
                                </td>
                                <td>
                                    <progress class="progress progress-primary w-20" value={task.progress_pct} max="100"></progress>
                                    <span class="text-xs">{task.progress_pct}%</span>
                                </td>
                                <td>{task.retry_count}회</td>
                                <td class="text-xs">{task.created_at.substring(0, 19)}</td>
                                <td>
                                    {#if task.status === 'FAILED'}
                                        <button onclick={() => retryTask(task.id)} class="btn btn-xs btn-primary mr-1">재시도</button>
                                    {/if}
                                    {#if task.status === 'PENDING'}
                                        <button onclick={() => cancelTask(task.id)} class="btn btn-xs btn-ghost text-error">취소</button>
                                    {/if}
                                </td>
                            </tr>
                        {:else}
                            <tr><td colspan="7" class="text-center py-10">데이터가 없습니다.</td></tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        </div>
    {:else}
        <div transition:fade class="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
            <h2 class="text-lg font-black mb-4">예약된 태스크 목록</h2>
            <p class="text-sm text-slate-500">예약된 작업들을 여기서 확인하고 관리합니다.</p>
        </div>
    {/if}
</div>
