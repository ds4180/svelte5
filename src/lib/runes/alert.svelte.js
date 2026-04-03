import { browser } from '$app/environment';

/**
 * @file alert.svelte.js (런타임 방어 및 메모리 최적화 버전)
 * @description [v3.0] 무한 루프 폭주 방지 및 메모리 누수 방지를 위한 큐(Queue) 관리 시스템 도입
 */
class AlertState {
    all = $state([]);
    dismissedIds = $state({});
    sessionHiddenIds = $state(new Set());
    isQuietMode = $state(false);

    constructor() { }

    init() {
        if (browser) {
            try {
                const stored = localStorage.getItem("dismissed_alerts");
                this.dismissedIds = stored ? JSON.parse(stored) : {};
                this.isQuietMode = localStorage.getItem("is_quiet_mode") === "true";
                console.log("🔔 [AlertState] Runtime Initialized.");
            } catch (e) {
                this.dismissedIds = {};
            }
        }
    }

    /**
     * 알림 전송 (Max Queue: 50)
     * @param {string} msg 
     * @param {any} options 
     */
    send(msg, options = {}) {
        // 🛡️ [방어 로직] 짧은 시간 내 완벽히 동일한 메시지 중복 전송 차단 (Throttling 효과)
        const lastAlert = this.all[this.all.length - 1];
        if (lastAlert && lastAlert.message === msg && (Date.now() - lastAlert.createdAt < 500)) {
            return;
        }

        const id = options.id || Math.random().toString(36).substring(2, 9);
        const newAlert = {
            id, message: msg,
            level: options.level || 1,
            style: options.style || 'info',
            route: options.route || null,
            redirect_url: options.redirect_url || null,
            confirm_text: options.confirm_text || '확인하였습니다',
            createdAt: Date.now(),
            timerStarted: false
        };

        // 🛡️ [메모리 관리] 알림이 50개 이상 쌓이면 오래된 것부터 삭제하여 브라우저 부하 방지
        let currentAll = [...this.all, newAlert];
        if (currentAll.length > 50) {
            currentAll = currentAll.slice(-50);
        }
        this.all = currentAll;
    }

    dismiss(id) {
        this.sessionHiddenIds.add(id);
        this.all = this.all.filter(a => a.id !== id);
    }

    neverShowAgain(id) {
        this.dismissedIds[id] = true;
        if (browser) {
            localStorage.setItem("dismissed_alerts", JSON.stringify(this.dismissedIds));
        }
        this.dismiss(id);
    }

    toggleQuietMode() {
        this.isQuietMode = !this.isQuietMode;
        if (browser) {
            localStorage.setItem("is_quiet_mode", this.isQuietMode);
        }
    }
}

export const alertState = new AlertState();
