/**
 * ============================================================================
 * [통합 관제·감사로그 프론트엔드 서비스 (src/lib/services/observabilityAdminService.ts)]
 * ============================================================================
 * - /v1/admin/observability의 동적 정책 정규화, 앱 라벨 매핑, 심각도/기기/세션 뱃지,
 *   메타데이터 호환 해석 등 비즈니스·표시 로직을 UI 컴포넌트로부터 분리합니다.
 */

export type ObservabilityTabId = 'SESSIONS' | 'ACCESS' | 'CHANGE' | 'ERROR' | 'SECURITY' | 'SETTINGS';

export interface ObservabilitySettings {
	watchdog_enabled: boolean;
	watchdog_security_alert: boolean;
	watchdog_cooldown_minutes: number;
	watchdog_instruction_delay_minutes: number;
	watchdog_instruction_min_count: number;
	security_alert_ignore_actions: string[];

	audit_log_retention_days: number;
	session_history_retention_days: number;

	audit_mask_sensitive_fields: boolean;
	audit_extra_mask_fields: string[];

	allow_csv_export: boolean;
	csv_export_max_rows: number;
	allow_system_log_download: boolean;
	system_log_max_download_mb: number;

	ui_auto_refresh_default: boolean;
	ui_auto_refresh_sec: number;
	ui_log_page_size: number;
	ui_session_history_limit: number;
}

export interface ObservabilitySummary {
	active_sessions: number;
	today_access_count: number;
	today_change_count: number;
	today_error_alert_count: number;
	today_security_count: number;
	today_errors_count: number;
	app_options: Array<{ id: string; name?: string }>;
}

export interface LiveSessionItem {
	id: number;
	session_key: string;
	user_id: number;
	username: string;
	real_name?: string | null;
	user_name?: string | null;
	primary_group?: string | null;
	department?: string | null;
	device_category: string;
	status: string;
	device_name?: string | null;
	user_agent?: string | null;
	ip_address?: string | null;
	login_at?: string | null;
	logout_at?: string | null;
	last_activity?: string | null;
}

export interface AuditLogItem {
	id: number;
	app_id?: string | null;
	log_type: string;
	severity: string;
	action: string;
	user_id?: number | null;
	user_summary?: string | null;
	resource_type?: string | null;
	resource_id?: string | null;
	title: string;
	message?: string | null;
	diff_payload?: Array<{ field: string; from?: any; to?: any; value?: any }> | null;
	metadata_payload?: Record<string, any> | null;
	metadata?: Record<string, any> | null;
	ip_address?: string | null;
	created_at: string;
}

export const DEFAULT_OBSERVABILITY_SETTINGS: ObservabilitySettings = {
	watchdog_enabled: true,
	watchdog_security_alert: true,
	watchdog_cooldown_minutes: 15,
	watchdog_instruction_delay_minutes: 30,
	watchdog_instruction_min_count: 3,
	security_alert_ignore_actions: [
		'SESSION_KICKED',
		'SESSION_REVOKED',
		'ADMIN_KICK',
		'PERM_CHANGED',
		'LOGIN_SUCCESS',
		'LOGOUT',
		'LOG_EXPORT_CSV',
		'SYSTEM_LOG_DOWNLOAD'
	],

	audit_log_retention_days: 180,
	session_history_retention_days: 60,

	audit_mask_sensitive_fields: true,
	audit_extra_mask_fields: [],

	allow_csv_export: true,
	csv_export_max_rows: 5000,
	allow_system_log_download: true,
	system_log_max_download_mb: 10,

	ui_auto_refresh_default: true,
	ui_auto_refresh_sec: 10,
	ui_log_page_size: 20,
	ui_session_history_limit: 100
};

export function normalizeObservabilitySettings(
	raw?: Partial<ObservabilitySettings> | null
): ObservabilitySettings {
	const src = raw || {};
	return {
		...DEFAULT_OBSERVABILITY_SETTINGS,
		...src,
		security_alert_ignore_actions: Array.isArray(src.security_alert_ignore_actions)
			? [...src.security_alert_ignore_actions]
			: [...DEFAULT_OBSERVABILITY_SETTINGS.security_alert_ignore_actions],
		audit_extra_mask_fields: Array.isArray(src.audit_extra_mask_fields)
			? [...src.audit_extra_mask_fields]
			: []
	};
}

export const OBSERVABILITY_LOG_TABS: Array<{
	id: Exclude<ObservabilityTabId, 'SETTINGS'>;
	label: string;
	icon: string;
	badgeColor: string;
}> = [
	{
		id: 'SESSIONS',
		label: '실시간 세션',
		icon: 'solar:users-group-rounded-bold-duotone',
		badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
	},
	{
		id: 'ACCESS',
		label: '접근 및 인증',
		icon: 'solar:shield-keyhole-bold-duotone',
		badgeColor: 'bg-blue-50 text-blue-700 border-blue-200'
	},
	{
		id: 'CHANGE',
		label: '앱 데이터 변경',
		icon: 'solar:document-add-bold-duotone',
		badgeColor: 'bg-amber-50 text-amber-700 border-amber-200'
	},
	{
		id: 'ERROR',
		label: '서버 장애 및 오류',
		icon: 'solar:danger-triangle-bold-duotone',
		badgeColor: 'bg-rose-50 text-rose-700 border-rose-200'
	},
	{
		id: 'SECURITY',
		label: '보안 및 위협',
		icon: 'solar:shield-warning-bold-duotone',
		badgeColor: 'bg-purple-50 text-purple-700 border-purple-200'
	}
];

export const APP_LABEL_MAP: Record<string, string> = {
	system: '⚙️ 시스템 코어 (system)',
	auth: '🔐 사용자 인증 (auth)',
	dashboard: '📊 매니저 대시보드 (dashboard)',
	apps: '🧩 앱 관리 (apps)',
	app: '📦 커스텀·미니앱 (app)',
	config: '🛠️ 환경설정 (config)',
	services: '🔌 서비스 마스터 (services)',
	menu: '🌐 메뉴 설정 (menu)',
	user_manage: '👤 사용자 랭크 관리 (user_manage)',
	group_manage: '🏛️ 그룹·권한 관리 (group_manage)',
	observability: '👁️ 접속 기록·감사 로그 (observability)',
	tasks: '⏱️ 예약 작업 관리 (tasks)',
	dispatch: '🚐 차량 배차 관리 (dispatch)',
	route_master: '🗺️ 노선 마스터 관리 (route_master)',
	dayoff: '🏖️ 휴무(결근계) 관리 (dayoff)',
	boards: '📝 게시판 인스턴스 관리 (boards)',
	page: '📄 페이지 엔진 관리 (page)',
	pushs: '🚀 푸시·구독 관리 (pushs)',
	alerts: '🔔 알림·지시 관리 (alerts)',
	target_groups: '🎯 임시 그룹 관리 (target_groups)',
	media: '🖼️ 파일·사진 관리 (media)'
};

export function buildAppFilterOptions(
	serverApps: Array<{ id: string; name?: string }> = [],
	currentFilter = ''
): Array<{ id: string; label: string }> {
	const map = new Map<string, { id: string; label: string }>([
		['', { id: '', label: '전체 앱 (All Apps)' }]
	]);
	for (const item of serverApps || []) {
		if (!item?.id || map.has(item.id)) continue;
		const label =
			APP_LABEL_MAP[item.id] ||
			(item.name && item.name !== item.id ? `${item.name} (${item.id})` : item.id);
		map.set(item.id, { id: item.id, label });
	}
	if (currentFilter && !map.has(currentFilter)) {
		map.set(currentFilter, {
			id: currentFilter,
			label: APP_LABEL_MAP[currentFilter] || currentFilter
		});
	}
	return Array.from(map.values());
}

export function getSeverityBadge(sev?: string | null): string {
	switch (sev) {
		case 'CRITICAL':
			return 'bg-rose-600 text-white border-rose-700 animate-pulse';
		case 'ERROR':
			return 'bg-red-100 text-red-800 border-red-300 font-bold';
		case 'WARN':
			return 'bg-amber-100 text-amber-800 border-amber-300';
		default:
			return 'bg-slate-100 text-slate-700 border-slate-300';
	}
}

export function getDeviceBadge(dev?: string | null): { icon: string; text: string; color: string } {
	switch (dev) {
		case 'MOBILE':
			return {
				icon: 'solar:smartphone-bold',
				text: '모바일',
				color: 'bg-emerald-50 text-emerald-700 border-emerald-200'
			};
		case 'TABLET':
			return {
				icon: 'solar:tablet-bold',
				text: '태블릿',
				color: 'bg-indigo-50 text-indigo-700 border-indigo-200'
			};
		default:
			return {
				icon: 'solar:laptop-minimalistic-bold',
				text: '데스크톱',
				color: 'bg-blue-50 text-blue-700 border-blue-200'
			};
	}
}

export function getSessionStatusBadge(status?: string | null): {
	text: string;
	color: string;
	dot: string;
} {
	switch (status) {
		case 'ACTIVE':
			return {
				text: '활동 중',
				color: 'bg-emerald-50 text-emerald-700 border-emerald-300',
				dot: 'bg-emerald-500'
			};
		case 'EXPIRED':
			return {
				text: '정상 종료',
				color: 'bg-slate-100 text-slate-500 border-slate-300',
				dot: 'bg-slate-400'
			};
		case 'KICKED_OUT':
			return {
				text: '강제 추방',
				color: 'bg-rose-50 text-rose-700 border-rose-300 font-bold',
				dot: 'bg-rose-500'
			};
		default:
			return {
				text: status || '-',
				color: 'bg-slate-100 text-slate-600 border-slate-200',
				dot: 'bg-slate-400'
			};
	}
}

export function getLogMetadata(log: AuditLogItem | null | undefined): Record<string, any> {
	if (!log) return {};
	if (log.metadata_payload && typeof log.metadata_payload === 'object') {
		return log.metadata_payload;
	}
	if (log.metadata && typeof log.metadata === 'object') {
		return log.metadata;
	}
	return {};
}
