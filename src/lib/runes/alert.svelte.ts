/**
 * ============================================================================
 * [사내 전역 공지 및 업무 지시 알림 상태 엔진 (lib/runes/alert.svelte.ts)]
 * ============================================================================
 * 
 * 💡 이 파일의 역할:
 * 사내 임직원 간의 업무 지시 및 공지사항(L1 Toast, L2 Banner, L3~L5 Modal/Lock)을
 * 클라이언트 화면에서 반응형으로 필터링하고 제어하는 Svelte 5 Rune 상태 엔진입니다.
 * 
 * 🌟 주요 기능:
 * 1. [L1~L5 계층형 등급]: 토스트, 상단 쉬머 배너, 중앙 집중 모달, 시스템 락 등급별 분배
 * 2. [L4 징벌적 타이머]: 성급하게 확인 버튼을 누르면 대기 시간을 초기화하여 정독 유도
 * 3. [24시간 지능형 만료]: '하루 동안 보지 않기' 클릭 시 LocalStorage 기반 24시간 정확한 차단
 * 4. [경로/시간 지능형 필터링]: 특정 URL 경로 또는 기간에만 알림 노출
 */

import { browser } from '$app/environment';
import { isExpired } from '$lib/utils.js';

export interface AlertData {
	id: string | number;
	message: string;
	level: number;
	style: string;
	position?: string | null;
	route?: string | null;
	redirect_url?: string | null;
	confirm_text?: string;
	reset_sec?: number;
	start_date?: string | Date | null;
	end_date?: string | Date | null;
	target_users?: string | null;
	createdAt?: number;
	timerStarted?: boolean;
}

export interface AlertSendOptions {
	id?: string | number;
	level?: number;
	style?: string;
	position?: string;
	route?: string | null;
	redirect_url?: string | null;
	confirm_text?: string;
	reset_sec?: number;
}

export class AlertState {
	// 📌 서버/클라이언트 전체 알림 큐
	all = $state<AlertData[]>([]);

	// 📌 LocalStorage 기반 '하루 동안 보지 않기' 만료 맵 { [alertId]: ISO_Date_String }
	dismissedIds = $state<Record<string, string>>({});

	// 📌 현재 브라우저 세션에서 닫은 알림 ID 집합
	sessionHiddenIds = $state<Set<string | number>>(new Set());

	// 📌 방해 금지 모드 (활성화 시 L4 미만 알림 숨김)
	isQuietMode = $state<boolean>(false);

	// 📌 L4/L5 전용 카운트다운 타이머 상태 { [alertId]: 남은초 }
	countdowns = $state<Record<string | number, number>>({});

	constructor() {}

	/**
	 * 브라우저 런타임 초기화 (LocalStorage 복구)
	 */
	init() {
		if (browser) {
			try {
				const stored = localStorage.getItem('dismissed_alerts');
				this.dismissedIds = stored ? JSON.parse(stored) : {};
				this.isQuietMode = localStorage.getItem('is_quiet_mode') === 'true';
				console.log('🔔 [AlertState] 사내 알림 엔진 초기화 완료');
			} catch (e) {
				this.dismissedIds = {};
			}
		}
	}

	/**
	 * 클라이언트 로컬 알림 발행 (최대 큐 50개 유지)
	 */
	send(msg: string, options: AlertSendOptions = {}) {
		const lastAlert = this.all[this.all.length - 1];
		if (lastAlert && lastAlert.message === msg && Date.now() - (lastAlert.createdAt || 0) < 500) {
			return;
		}

		const id = options.id || Math.random().toString(36).substring(2, 9);
		const newAlert: AlertData = {
			id,
			message: msg,
			level: options.level || 1,
			style: options.style || 'info',
			position: options.position || 'top',
			route: options.route || null,
			redirect_url: options.redirect_url || null,
			confirm_text: options.confirm_text || '확인하였습니다',
			reset_sec: options.reset_sec || 5, // L4 기본 대기 시간 (5초)
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
	dismiss(id: string | number) {
		this.sessionHiddenIds.add(id);
		this.all = this.all.filter((a) => a.id !== id);
		if (this.countdowns[id]) {
			delete this.countdowns[id];
		}
	}

	/**
	 * 하루 동안 보지 않기 (24시간 만료)
	 */
	neverShowAgain(id: string | number) {
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 1);
		this.dismissedIds[String(id)] = expiresAt.toISOString();
		if (browser) {
			localStorage.setItem('dismissed_alerts', JSON.stringify(this.dismissedIds));
		}
		this.dismiss(id);
	}

	/**
	 * 24시간 만료 여부 판별
	 */
	isDismissed(id: string | number): boolean {
		const expiresAt = this.dismissedIds[String(id)];
		if (!expiresAt) return false;
		if (isExpired(expiresAt)) {
			delete this.dismissedIds[String(id)];
			if (browser) {
				localStorage.setItem('dismissed_alerts', JSON.stringify(this.dismissedIds));
			}
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
			localStorage.setItem('is_quiet_mode', String(this.isQuietMode));
		}
	}

	/**
	 * 레벨 4, 5 전용 카운트다운 시작
	 */
	startCountdown(id: string | number, seconds: number) {
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
	resetTimer(id: string | number, seconds?: number) {
		console.log(`⚠️ [Alert] Punitive Reset! ID: ${id}`);
		this.countdowns[id] = seconds || 5;
	}

	/**
	 * 통합 필터링 로직 (컴포넌트 렌더링 시 호출)
	 */
	getVisibleAlerts(positionFilter: 'top' | 'bottom' | 'modal', currentPath: string): AlertData[] {
		const now = new Date();
		return this.all.filter((a) => {
			if (!a) return false;

			// 1. 기간 체크
			if (a.start_date && new Date(a.start_date) > now) return false;
			if (a.end_date && new Date(a.end_date) < now) return false;

			// 2. 차단 체크 (24시간 만료 및 세션 차단)
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

			// 5. 위치 및 레벨 분류
			if (positionFilter === 'modal') return a.level >= 3;
			const pos = a.position || 'top';
			return a.level < 3 && pos === positionFilter;
		}).slice(-5);
	}
}

export const alertState = new AlertState();
export default alertState;
