<script>
    /**
     * @file Alert.svelte
     * @description daisyUI 기반의 프로젝트 전역 알림 컴포넌트 (Svelte 5)
     * 이 컴포넌트는 전역 알림(Toast, Modal 등)을 담당하며, daisyUI 클래스를 적극 활용합니다.
     */
    import { alertState } from "$lib/runes/alert.svelte.js";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation";
    import { fly, fade, slide } from "svelte/transition";
    import { onMount, onDestroy, untrack } from "svelte";

    /** @type {{ positionFilter: 'top' | 'bottom' | 'modal' }} */
    let { positionFilter } = $props();
    let interval;

    /**
     * 서버 기반 실시간 알림 로드 (레거시 코드 계승)
     * 주기적으로 백엔드에 활성화된 시스템 공지사항이 있는지 체크합니다.
     */
    async function fetchActiveAlerts() {
        try {
            const response = await fetch("/api/alert/active");
            if (response.ok) {
                const json = await response.json();
                // Rune 상태 직접 업데이트 (untrack을 통해 불필요한 반응성 루프 방지)
                untrack(() => {
                    alertState.all = json;
                });
            }
        } catch (e) {
            console.warn("[Alert] 실시간 갱신 실패", e);
        }
    }

    onMount(() => {
        if (positionFilter === "modal") {
            fetchActiveAlerts();
            interval = setInterval(fetchActiveAlerts, 30000); // 30초 주기
        }
    });

    onDestroy(() => {
        if (interval) clearInterval(interval);
    });

    /**
     * 현재 화면에 표시해야 할 대상들을 필터링 ($derived)
     * ⚠️ [하이드레이션 방어] 서버와 클라이언트의 시간 차이를 극복하기 위해 now를 외부에서 제어하거나 안정화합니다.
     */
    let displayAlerts = $derived.by(() => {
        const alerts = alertState?.all || [];
        if (alerts.length === 0) return [];

        // 서버 사이드 렌더링 시에는 시간 필터링을 최소화하거나 고정된 시간을 사용합니다.
        const now = new Date();

        return alerts.filter((a) => {
            if (!a) return false;
            
            // 1. 기간 체크 (서버/클라이언트 정합성을 위해 유효성 검사 강화)
            if (a.start_date && new Date(a.start_date) > now) return false;
            if (a.end_date && new Date(a.end_date) < now) return false;
            
            // 2. 차단 체크
            if (alertState.dismissedIds && alertState.dismissedIds[a.id]) return false;
            if (alertState.sessionHiddenIds && alertState.sessionHiddenIds.has(a.id)) return false;
            
            // 3. 방해 금지 모드 필터링
            if (alertState.isQuietMode && a.level < 4) return false;

            // 4. 경로 체크 (안전한 옵셔널 체이닝 및 기본값 적용)
            const currentPath = $page?.url?.pathname || "/";
            const pathMatch = !a.route || a.route.trim() === "" || a.route === "*" || 
                             a.route.split(",").some(r => r.trim() === currentPath);
            if (!pathMatch) return false;

            // 5. 위치 분류
            if (positionFilter === "modal") return a.level >= 3;
            const pos = a.position || "top";
            return a.level < 3 && pos === positionFilter;
        });
    });

    // Lv.1 알림 자동 소멸 로직 (안전한 체킹)
    $effect(() => {
        if (!displayAlerts) return;
        displayAlerts.forEach((alert) => {
            if (alert && alert.level === 1 && !alert.timerStarted) {
                alert.timerStarted = true;
                setTimeout(() => alertState.dismiss(alert.id), 10000);
            }
        });
    });

    let penaltyMsg = $state({}); // 강제 정독 미준수 시 메시지

    /**
     * 확인 버튼 클릭 핸들러
     * @param {Object} alert - 알림 객체
     */
    function handleConfirm(alert) {
        // Lv.4/5는 정독 타이머 체크 예정 (추후 타이머 기능 복원 시 추가)
        alertState.dismiss(alert.id);
        if (alert.redirect_url) goto(alert.redirect_url);
    }
    
    // 🛡️ [하이드레이션 방어] 서버/클라이언트 마크업 불일치 방지
    let isMounted = $state(false);
    onMount(() => {
        isMounted = true;
    });
</script>

{#if isMounted} <!-- 🛡️ 브라우저 탑재 완료 후에만 렌더링 (하이드레이션 불일치 방지) -->
    <!-- daisyUI Toast (Lv.1, Lv.2) : 상단/하단 부유형 알림 -->
    {#if positionFilter !== 'modal' && displayAlerts.length > 0}
        <div class="toast toast-{positionFilter} toast-center z-[1000] p-4 gap-2">
            {#each displayAlerts as alert (alert.id)}
                <div 
                    class="alert alert-{alert.style === 'danger' ? 'error' : alert.style} shadow-xl py-3 px-5 rounded-3xl border-none min-w-[280px]"
                    transition:fly={{ y: positionFilter === 'top' ? -50 : 50, duration: 600 }}
                >
                    <div class="flex items-center gap-3">
                        <span class="text-sm font-semibold">{alert.message}</span>
                    </div>
                    <div class="flex-none">
                        <button class="btn btn-ghost btn-xs btn-circle" onclick={() => alertState.neverShowAgain(alert.id)}>✕</button>
                    </div>
                </div>
            {/each}
        </div>
    {/if}

    <!-- daisyUI Modal (Lv.3, Lv.4, Lv.5) : 전체화면 및 중앙 팝업 -->
    {#if positionFilter === 'modal'}
        {#each displayAlerts as alert (alert.id)}
            <dialog class="modal modal-open backdrop-blur-md" transition:fade>
                <div class="modal-box max-w-lg p-12 rounded-[2rem] border border-white/20 shadow-2xl {alert.level === 5 ? 'bg-gradient-to-br from-red-600 via-red-800 to-black text-white' : 'bg-base-100'}">
                    <div class="text-center">
                        <div class="text-[10px] opacity-40 mb-2 tracking-widest uppercase">Important Notification</div>
                        <div class="py-8">
                            <h3 class="text-3xl font-black leading-tight whitespace-pre-wrap tracking-tighter">
                                {alert.level === 5 ? "🚨 " : ""}{alert.message}
                            </h3>
                        </div>
                        
                        <div class="modal-action flex flex-col gap-4 mt-8">
                            <button 
                                class="btn btn-lg rounded-2xl h-16 text-lg font-black shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98] {alert.level === 5 ? 'bg-white text-red-700 border-none hover:bg-gray-100' : 'btn-' + (alert.style === 'danger' ? 'error' : alert.style)}"
                                onclick={() => handleConfirm(alert)}
                            >
                                {penaltyMsg[alert.id] || alert.confirm_text || "확인하였습니다"}
                            </button>
                            
                            <button 
                                class="btn btn-ghost btn-sm text-xs opacity-40 hover:opacity-100 transition-opacity"
                                onclick={() => alertState.neverShowAgain(alert.id)}
                            >
                                다시 보이지 않음
                            </button>
                        </div>
                    </div>
                </div>
            </dialog>
        {/each}
    {/if}
{/if}

<style>
    /* daisyUI 기반이므로 인라인 스타일을 최소화합니다. */
    :global(.modal-open) {
        pointer-events: auto;
    }
</style>
