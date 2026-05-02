import { browser } from '$app/environment';
import { isExpired } from '$lib/utils.js';

/**
 * @file alert.svelte.js (고도화 버전)
 * @description [v4.0] 필터링 로직 중앙화 및 레벨 4 징벌적 타이머(Punitive Timer) 시스템 도입
 */
class AlertState {
	all = $state([]); // 서버/클라이언트 전체 알림 큐
	dismissedIds = $state({}); // LocalStorage (24시간 차단)
	sessionHiddenIds = $state(new Set()); // 현재 세션 차단
	isQuietMode = $state(false); // 방해 금지 모드 (MUTE)
	countdowns = $state({}); // 레벨 4 전용 타이머 상태 { id: seconds }

	constructor() {}

	init() {
		if (browser) {
			try {
				const stored = localStorage.getItem('dismissed_alerts');
				this.dismissedIds = stored ? JSON.parse(stored) : {};
				this.isQuietMode = localStorage.getItem('is_quiet_mode') === 'true';
				console.log('🔔 [AlertState] Runtime Initialized.');
			} catch (e) {
				this.dismissedIds = {};
			}
		}
	}

	/**
	 * 알림 전송 (Max Queue: 50)
	 */
	send(msg, options = {}) {
		const lastAlert = this.all[this.all.length - 1];
		if (lastAlert && lastAlert.message === msg && Date.now() - lastAlert.createdAt < 500) return;

		const id = options.id || Math.random().toString(36).substring(2, 9);
		const newAlert = {
			id,
			message: msg,
			level: options.level || 1,
			style: options.style || 'info',
			route: options.route || null,
			redirect_url: options.redirect_url || null,
			confirm_text: options.confirm_text || '확인하였습니다',
			reset_sec: options.reset_sec || 5, // L4 기본 대기 시간
			createdAt: Date.now(),
			timerStarted: false
		};

		let currentAll = [...this.all, newAlert];
		if (currentAll.length > 50) currentAll = currentAll.slice(-50);
		this.all = currentAll;

		// 🚀 [Auto-Dismiss] 레벨 1(Toast)인 경우 10초 뒤 자동 소멸 예약
		if (newAlert.level < 3) {
			setTimeout(() => this.dismiss(id), 10000);
		}
	}

	/**
	 * 알림 해제 (현재 세션에서 숨김)
	 */
	dismiss(id) {
		this.sessionHiddenIds.add(id);
		this.all = this.all.filter((a) => a.id !== id);
		if (this.countdowns[id]) delete this.countdowns[id];
	}

	/**
	 * 하루 동안 보지 않기 (24시간 만료)
	 */
	neverShowAgain(id) {
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 1);
		this.dismissedIds[id] = expiresAt.toISOString();
		if (browser) {
			localStorage.setItem('dismissed_alerts', JSON.stringify(this.dismissedIds));
		}
		this.dismiss(id);
	}

	/**
	 * 만료 여부 체크
	 */
	isDismissed(id) {
		const expiresAt = this.dismissedIds[id];
		if (!expiresAt) return false;
		if (isExpired(expiresAt)) {
			delete this.dismissedIds[id];
			if (browser) localStorage.setItem('dismissed_alerts', JSON.stringify(this.dismissedIds));
			return false;
		}
		return true;
	}

	/**
	 * 방해 금지 모드 토글
	 */
	toggleQuietMode() {
		this.isQuietMode = !this.isQuietMode;
		if (browser) {
			localStorage.setItem('is_quiet_mode', this.isQuietMode);
		}
	}

	/**
	 * 레벨 4, 5 전용 카운트다운 시작
	 */
	startCountdown(id, seconds) {
		if (this.countdowns[id] !== undefined) return; // 이미 실행 중이면 무시
		
		this.countdowns[id] = seconds;
		const timer = setInterval(() => {
			if (this.countdowns[id] > 0) {
				this.countdowns[id] -= 1;
			} else {
				clearInterval(timer);
			}
		}, 1000);
	}

	/**
	 * 레벨 4 징벌적 타이머 리셋 (인과응보 로직)
	 */
	resetTimer(id, seconds) {
		console.log(`⚠️ [Alert] Punitive Reset! ID: ${id}`);
		this.countdowns[id] = seconds || 5;
		// setInterval은 이미 돌고 있으므로 값만 바꿔주면 됩니다.
	}

	/**
	 * 통합 필터링 로직 (컴포넌트에서 호출)
	 */
	getVisibleAlerts(positionFilter, currentPath) {
		const now = new Date();
		return this.all.filter((a) => {
			if (!a) return false;

			// 1. 기간 체크
			if (a.start_date && new Date(a.start_date) > now) return false;
			if (a.end_date && new Date(a.end_date) < now) return false;

			// 2. 차단 체크
			if (this.isDismissed(a.id)) return false;
			if (this.sessionHiddenIds.has(a.id)) return false;

			// 3. 방해 금지 모드 (L4 이상은 무시 불가)
			if (this.isQuietMode && a.level < 4) return false;

			// 4. 경로 체크
			const routeConfig = a.route;
			let pathMatch = !routeConfig || routeConfig.trim() === '' || routeConfig === '*';
			if (!pathMatch && routeConfig) {
				pathMatch = routeConfig.split(',').some((r) => r.trim() === currentPath);
			}
			if (!pathMatch) return false;

			// 5. 위치 분류
			if (positionFilter === 'modal') return a.level >= 3;
			const pos = a.position || 'top';
			return a.level < 3 && pos === positionFilter;
		}).slice(-5);
	}
}

export const alertState = new AlertState();
