/**
 * ============================================================================
 * [알림·지시 관리 비즈니스 로직 & 추상화 서비스 (alertAdminService.ts)]
 * ============================================================================
 * - 하드코딩된 레벨 색상/위치, 카테고리 메타, 기본 폼 값을 단일 진실 공급원(SSOT)으로 관리합니다.
 */

import { toLocalISOString } from '$lib/utils';

export type AlertCategory = 'NOTICE' | 'URGENT_NOTICE' | 'INSTRUCTION';
export type AlertStyle = 'info' | 'warning' | 'error' | 'success';

export interface AlertSettings {
	default_duration_days: number;
	default_level: number;
	default_style: AlertStyle;
	default_confirm_text: string;
	mandatory_read_seconds: number;
	urgent_min_level: number;
	urgent_default_style: AlertStyle;
	default_save_to_inbox: boolean;
	default_send_web_push: boolean;
	enable_sound: boolean;
	enable_vibration: boolean;
	title_max_length: number;
	category_labels: Record<AlertCategory, string>;
}

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
	default_duration_days: 3,
	default_level: 1,
	default_style: 'info',
	default_confirm_text: '확인하였습니다',
	mandatory_read_seconds: 5,
	urgent_min_level: 3,
	urgent_default_style: 'error',
	default_save_to_inbox: true,
	default_send_web_push: false,
	enable_sound: true,
	enable_vibration: true,
	title_max_length: 25,
	category_labels: {
		NOTICE: '📢 사내 공지',
		URGENT_NOTICE: '🚨 중요 공지',
		INSTRUCTION: '📋 지시사항'
	}
};

export interface AlertLevelMeta {
	badgeClass: string;
	label: string;
}

const ALERT_LEVEL_META: Record<number, AlertLevelMeta> = {
	5: { badgeClass: 'bg-rose-600 text-white animate-pulse', label: 'L5 · 시스템 락' },
	4: { badgeClass: 'bg-red-500 text-white', label: 'L4 · 강제 정독' },
	3: { badgeClass: 'bg-amber-500 text-white', label: 'L3 · 모달 지시' },
	2: { badgeClass: 'bg-blue-500 text-white', label: 'L2 · 배너' },
	1: { badgeClass: 'bg-slate-200 text-slate-600', label: 'L1 · 토스트' }
};

export function getAlertLevelBadgeClass(level: number): string {
	return (ALERT_LEVEL_META[Number(level)] ?? ALERT_LEVEL_META[1]).badgeClass;
}

export function getAlertPositionLabel(level: number, position?: string | null): {
	text: string;
	badgeClass: string;
} {
	if (Number(level) >= 3) {
		return { text: '중앙', badgeClass: 'bg-purple-100 text-purple-800' };
	}
	if (position === 'bottom') {
		return { text: '하단', badgeClass: 'bg-amber-100 text-amber-800' };
	}
	return { text: '상단', badgeClass: 'bg-slate-100 text-slate-700' };
}

export const ALERT_CATEGORY_META: Record<
	string,
	{ label: string; shortLabel: string; badgeClass: string }
> = {
	URGENT_NOTICE: {
		label: '🚨 중요 공지',
		shortLabel: '🚨 중요',
		badgeClass: 'bg-rose-600 text-white animate-pulse'
	},
	INSTRUCTION: {
		label: '📋 지시사항',
		shortLabel: '📋 지시사항',
		badgeClass: 'bg-purple-100 text-purple-800 border border-purple-200'
	},
	NOTICE: {
		label: '📢 사내 공지',
		shortLabel: '📢 공지',
		badgeClass: 'bg-slate-100 text-slate-600'
	},
	NOTIFICATION: {
		label: '📢 사내 공지',
		shortLabel: '📢 공지',
		badgeClass: 'bg-slate-100 text-slate-600'
	}
};

export function getAlertCategoryMeta(category?: string | null) {
	return ALERT_CATEGORY_META[category || 'NOTICE'] ?? ALERT_CATEGORY_META.NOTICE;
}

export function computeAlertStats(alerts: any[]) {
	return {
		total: alerts.length,
		active: alerts.filter((a) => a.is_active).length,
		instruction: alerts.filter((a) => a.category === 'INSTRUCTION').length,
		urgent: alerts.filter((a) => a.category === 'URGENT_NOTICE' || Number(a.level) >= 4).length,
		notice: alerts.filter((a) => a.category === 'NOTICE' || a.category === 'NOTIFICATION').length
	};
}

export function filterAlertsByCategory(alerts: any[], category: string) {
	if (category === 'ALL') return alerts;
	if (category === 'NOTICE') {
		return alerts.filter((a) => a.category === 'NOTICE' || a.category === 'NOTIFICATION');
	}
	return alerts.filter((a) => a.category === category);
}

export function buildDefaultAlertForm(
	settings: AlertSettings = DEFAULT_ALERT_SETTINGS,
	initialTargetGroup: string = ''
) {
	const now = new Date();
	const end = new Date(now);
	end.setDate(end.getDate() + Math.max(1, Number(settings.default_duration_days || 3)));
	const defaultLevel = Number(settings.default_level || 1);

	return {
		message: '',
		level: String(defaultLevel),
		style: settings.default_style || 'info',
		position: defaultLevel >= 3 ? 'modal' : 'top',
		category: 'NOTICE' as AlertCategory,
		target_group: initialTargetGroup || '',
		start_date: toLocalISOString(now),
		end_date: toLocalISOString(end),
		send_web_push: Boolean(settings.default_send_web_push),
		save_to_inbox: Boolean(settings.default_save_to_inbox),
		confirm_text: settings.default_confirm_text || '확인하였습니다',
		reset_sec: defaultLevel >= 4 ? Number(settings.mandatory_read_seconds ?? 5) : 0,
		redirect_url: '',
		route: '',
		is_active: true
	};
}
