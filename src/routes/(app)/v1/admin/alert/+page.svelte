<script>
    /**
     * /v1/admin/alert/+page.svelte
     * @description 알림 및 업무 지시 관리 페이지 (DaisyUI 스타일 적용)
     */
    import { enhance } from "$app/forms";
    import Error from "$lib/components/Error.svelte";

    /** @type {import('./$types').PageData} */
    let { data, form } = $props();

    // --- [폼 상태] ---
    let message      = $state("");
    let level        = $state(1);
    let style        = $state("info");
    let position     = $state("top");
    let route        = $state("");
    let start_date   = $state("");
    let end_date     = $state("");
    let redirect_url = $state("");
    let reset_sec    = $state(5);
    let selectedUsers = $state([]);
    let isSubmitting = $state(false);

    // 폼 전송 성공 시 초기화
    $effect(() => {
        if (form?.success) {
            message = ""; level = 1; style = "info"; position = "top";
            route = ""; start_date = ""; end_date = ""; redirect_url = "";
            reset_sec = 5; selectedUsers = [];
            alert("알림이 성공적으로 송출되었습니다!");
        }
    });

    /**
     * 날짜 포맷팅 (화면 표시용)
     * @param {string|null} iso
     * @returns {string}
     */
    function formatDate(iso) {
        if (!iso) return "-";
        return new Date(iso).toLocaleString("ko-KR", {
            year: "2-digit", month: "2-digit", day: "2-digit",
            hour: "2-digit", minute: "2-digit",
        });
    }

    /**
     * 수신 대상 사용자 토글
     * @param {string} username
     */
    function toggleUser(username) {
        if (selectedUsers.includes(username)) {
            selectedUsers = selectedUsers.filter((u) => u !== username);
        } else {
            selectedUsers = [...selectedUsers, username];
        }
    }

    // 알림 등급별 뱃지 색상 매핑
    const levelBadge = { 1: "badge-info", 2: "badge-success", 3: "badge-warning", 4: "badge-error", 5: "badge-error" };
    const styleBadge = { info: "badge-info", success: "badge-success", warning: "badge-warning", danger: "badge-error" };
</script>

<svelte:head>
    <title>알림 관리 | Admin</title>
</svelte:head>

<div class="container mx-auto max-w-5xl p-4 my-6">

    <!-- 페이지 헤더 -->
    <div class="flex justify-between items-center border-b border-base-300 pb-3 mb-6">
        <h2 class="text-2xl font-bold flex items-center gap-2">
            📢 알림 및 업무 지시 시스템
        </h2>
        <a href="/v1/admin" class="btn btn-outline btn-sm">← 관리자 홈</a>
    </div>

    <!-- 에러 표시 -->
    {#if form?.error}<Error error={form.error} />{/if}

    <!-- ============================================================ -->
    <!-- 새 알림 등록 카드 -->
    <!-- ============================================================ -->
    <div class="card bg-base-100 shadow-md border border-base-300 mb-8">
        <div class="card-header bg-neutral text-neutral-content px-5 py-3 rounded-t-xl">
            <h5 class="font-bold">새 업무 지시 등록</h5>
        </div>
        <div class="card-body bg-base-200 rounded-b-xl p-5">
            <form
                method="POST"
                action="?/create"
                use:enhance={() => {
                    isSubmitting = true;
                    return async ({ update }) => { await update(); isSubmitting = false; };
                }}
            >
                <!-- 수신자 목록을 hidden input으로 전송 -->
                <input type="hidden" name="target_users" value={selectedUsers.join(",")} />

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

                    <!-- 지시 내용 -->
                    <div class="col-span-full form-control">
                        <label class="label"><span class="label-text font-bold">지시 내용 (핵심 요약)</span></label>
                        <textarea
                            name="message"
                            class="textarea textarea-bordered w-full"
                            rows="3"
                            bind:value={message}
                            placeholder="기사님들에게 노출될 핵심 지시 내용을 입력하세요."
                        ></textarea>
                    </div>

                    <!-- 알림 등급 -->
                    <div class="form-control">
                        <label class="label"><span class="label-text font-bold">알림 등급</span></label>
                        <select name="level" class="select select-bordered" bind:value={level}>
                            <option value={1}>Lv.1 (토스트)</option>
                            <option value={2}>Lv.2 (공간 배너)</option>
                            <option value={3}>Lv.3 (일반 모달)</option>
                            <option value={4}>Lv.4 (정독 모달)</option>
                            <option value={5}>Lv.5 (🚨 비상 점유)</option>
                        </select>
                    </div>

                    <!-- 노출 위치 -->
                    <div class="form-control">
                        <label class="label"><span class="label-text font-bold">노출 위치</span></label>
                        <select name="position" class="select select-bordered" bind:value={position}>
                            <option value="top">상단 (Top)</option>
                            <option value="bottom">하단 (Bottom)</option>
                        </select>
                    </div>

                    <!-- 스타일 -->
                    <div class="form-control">
                        <label class="label"><span class="label-text font-bold">스타일</span></label>
                        <select name="style" class="select select-bordered" bind:value={style}>
                            <option value="info">Info (파랑)</option>
                            <option value="success">Success (초록)</option>
                            <option value="warning">Warning (노랑)</option>
                            <option value="danger">Danger (빨강)</option>
                        </select>
                    </div>

                    <!-- 강제 대기(초) -->
                    <div class="form-control">
                        <label class="label"><span class="label-text font-bold">강제 대기 (초)</span></label>
                        <input name="reset_sec" type="number" class="input input-bordered" bind:value={reset_sec} min="0" />
                    </div>

                    <!-- 수신 대상 선택 -->
                    <div class="col-span-full form-control">
                        <label class="label"><span class="label-text font-bold">수신 대상 (선택 안 하면 전체 송출)</span></label>
                        <div class="flex flex-wrap gap-2 p-3 bg-base-100 border border-base-300 rounded-lg">
                            {#each data.users as user}
                                <button
                                    type="button"
                                    class="btn btn-sm rounded-full {selectedUsers.includes(user.username) ? 'btn-primary' : 'btn-outline'}"
                                    onclick={() => toggleUser(user.username)}
                                >
                                    {user.username}
                                </button>
                            {/each}
                        </div>
                    </div>

                    <!-- 시작 일시 -->
                    <div class="form-control">
                        <label class="label"><span class="label-text font-bold text-primary">시작 일시 (예약)</span></label>
                        <input name="start_date" type="datetime-local" class="input input-bordered" bind:value={start_date} />
                    </div>

                    <!-- 종료 일시 -->
                    <div class="form-control">
                        <label class="label"><span class="label-text font-bold text-error">종료 일시 (자동 소멸)</span></label>
                        <input name="end_date" type="datetime-local" class="input input-bordered" bind:value={end_date} />
                    </div>

                    <!-- 노출 경로 -->
                    <div class="form-control">
                        <label class="label"><span class="label-text font-bold">노출 경로</span></label>
                        <input name="route" type="text" class="input input-bordered" bind:value={route} placeholder="비워두면 모든 페이지" />
                    </div>

                    <!-- 이동 URL -->
                    <div class="form-control">
                        <label class="label"><span class="label-text font-bold">이동 URL</span></label>
                        <input name="redirect_url" type="text" class="input input-bordered" bind:value={redirect_url} placeholder="확인 시 자동 이동" />
                    </div>

                    <!-- 제출 버튼 -->
                    <div class="col-span-full flex justify-end pt-2">
                        <button type="submit" class="btn btn-neutral btn-wide" disabled={isSubmitting}>
                            {#if isSubmitting}
                                <span class="loading loading-spinner loading-sm"></span> 전송 중...
                            {:else}
                                📣 지시 사항 송출하기
                            {/if}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    </div>

    <!-- ============================================================ -->
    <!-- 현재 송출 중인 알림 목록 -->
    <!-- ============================================================ -->
    <div class="flex items-center gap-2 mb-3">
        <h4 class="text-lg font-bold">📂 현재 송출 중인 지시 목록</h4>
        <span class="badge badge-neutral">{data.alerts?.length || 0}</span>
    </div>

    <div class="overflow-x-auto rounded-xl border border-base-300 shadow-sm">
        <table class="table table-zebra table-sm text-center bg-base-100">
            <thead class="bg-base-200">
                <tr>
                    <th>상태</th>
                    <th class="text-left">내용 / 대상</th>
                    <th>등급</th>
                    <th>위치</th>
                    <th>유효 기간</th>
                    <th>작업</th>
                </tr>
            </thead>
            <tbody>
                {#each data.alerts as alert (alert.id)}
                    <tr>
                        <!-- 활성/중지 토글 -->
                        <td>
                            <form method="POST" action="?/toggle" use:enhance>
                                <input type="hidden" name="id" value={alert.id} />
                                <button type="submit"
                                    class="btn btn-xs rounded-full {alert.is_active ? 'btn-success' : 'btn-outline'}">
                                    {alert.is_active ? "활성" : "중지"}
                                </button>
                            </form>
                        </td>

                        <!-- 내용 / 대상 -->
                        <td class="text-left p-3">
                            <div class="font-bold">{alert.message}</div>
                            <div class="flex flex-wrap gap-1 mt-1">
                                {#if alert.route}
                                    <span class="badge badge-outline badge-sm">📍 {alert.route}</span>
                                {/if}
                                {#if alert.target_users}
                                    <span class="badge badge-neutral badge-sm">👥 {alert.target_users}</span>
                                {:else}
                                    <span class="badge badge-info badge-sm">👥 전체</span>
                                {/if}
                            </div>
                        </td>

                        <!-- 등급 -->
                        <td>
                            <span class="badge {levelBadge[alert.level] || 'badge-ghost'}">Lv.{alert.level}</span>
                        </td>

                        <!-- 위치 -->
                        <td>{alert.position === "top" ? "상" : "하"}</td>

                        <!-- 유효 기간 -->
                        <td class="text-xs leading-relaxed">
                            {formatDate(alert.start_date)}<br/>
                            <span class="text-base-content/40">~</span><br/>
                            {formatDate(alert.end_date)}
                        </td>

                        <!-- 삭제 -->
                        <td>
                            <form method="POST" action="?/delete" use:enhance
                                onsubmit={(e) => !confirm("완전 삭제하시겠습니까?") && e.preventDefault()}>
                                <input type="hidden" name="id" value={alert.id} />
                                <button type="submit" class="btn btn-xs btn-error btn-outline">삭제</button>
                            </form>
                        </td>
                    </tr>
                {:else}
                    <tr>
                        <td colspan="6" class="py-8 text-base-content/40">송출 중인 알림이 없습니다.</td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
</div>
