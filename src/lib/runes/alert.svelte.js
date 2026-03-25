import { browser } from '$app/environment';

/**
 * 프로젝트 전역 알림 상태를 관리하는 Rune 클래스 (에러 방어 강화 버전)
 */
class AlertState {
    all = $state([]);
    // 📌 [하이드레이션 방어] 서버와 클라이언트의 초기 상태를 동일하게 빈 객체로 설정
    dismissedIds = $state({}); 
    sessionHiddenIds = $state(new Set());
    isQuietMode = $state(false);

    constructor() {
        // ⚠️ 생성자에서는 더 이상 localStorage에 접근하지 않습니다. (서버 정합성 확보)
    }

    /**
     * @function init
     * @description 하이드레이션 완료 후 클라이언트 사이드에서 상태를 복구합니다.
     */
    init() {
        if (browser) {
            try {
                const stored = localStorage.getItem("dismissed_alerts");
                this.dismissedIds = stored ? JSON.parse(stored) : {};
                this.isQuietMode = localStorage.getItem("is_quiet_mode") === "true";
                console.log("🔔 [AlertState] Storage Sync Completed (Client-side)");
            } catch (e) {
                console.warn("⚠️ [AlertState] Storage Recovery Failed, resetting...", e.message);
                this.dismissedIds = {};
            }
        }
    }

    send(msg, options = {}) {
        const id = options.id || Math.random().toString(36).substring(2, 9);
        const newAlert = {
            id,
            message: msg,
            level: options.level || 1,
            style: options.style || 'info',
            route: options.route || null,
            redirect_url: options.redirect_url || null,
            reset_sec: options.reset_sec || 0,
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
        if (!this.dismissedIds) this.dismissedIds = {};
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
