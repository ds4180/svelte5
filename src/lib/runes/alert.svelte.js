import { browser } from '$app/environment';

/**
 * @file alert.svelte.js (런타임 방어 및 스토리지 연동 버전)
 */
class AlertState {
    all = $state([]);
    dismissedIds = $state({});
    sessionHiddenIds = $state(new Set());
    isQuietMode = $state(false);

    constructor() { }

    // ✅ [복구] 최상위 레이아웃에서 호출하는 초기화 함수
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

    send(msg, options = {}) {
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
        this.all = [...this.all, newAlert];
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
