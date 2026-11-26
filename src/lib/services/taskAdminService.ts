/**
 * ============================================================================
 * [태스크·자율신경계 관제 프론트엔드 서비스 (src/lib/services/taskAdminService.ts)]
 * ============================================================================
 * - /v1/admin/tasks의 동적 설정 정규화, 상태 뱃지 매핑, 작업 유형 메타 해석,
 *   스케줄 포맷팅 및 JSON Payload 파싱 로직을 UI 컴포넌트로부터 분리합니다.
 */

export interface CoreScheduleItem {
	task_type: string;
	unique_key: string;
	label: string;
	enabled: boolean;
	mode: 'cron' | 'interval';
	cron_expression: string | null;
	repeat_interval: number | null;
	priority: number;
	payload?: Record<string, any>;
	tags?: string[];
}

export interface CronPresetItem {
	label: string;
	cron: string;
	desc: string;
}

export interface TaskSettings {
	worker_enabled: boolean;
	worker_poll_interval_sec: number;
	reclaim_check_interval_sec: number;
	bootstrap_heal_stuck_sec: number;

	default_priority: number;
	default_max_retries: number;
	default_timeout_sec: number;
	retry_backoff_base_sec: number;
	retry_backoff_max_sec: number;

	completed_retention_days: number;
	watchdog_fail_alert_enabled: boolean;
	watchdog_fail_threshold: number;

	core_schedules: CoreScheduleItem[];

	ui_auto_refresh_default: boolean;
	ui_auto_refresh_sec: number;
	ui_page_limit: number;
	cron_presets: CronPresetItem[];
}

export interface TaskSummary {
	worker_status: 'ONLINE' | 'PAUSED' | string;
	worker_enabled?: boolean;
	poll_interval_sec?: number;
	pending_count: number;
	running_count: number;
	failed_count: number;
	scheduler_count: number;
	completed_24h_count?: number;
}

export interface TaskTypeMeta {
	type: string;
	label: string;
	description: string;
	category?: string;
	icon: string;
	example?: Record<string, any>;
}

export const DEFAULT_CRON_PRESETS: CronPresetItem[] = [
	{ label: '매일 새벽 3시 (야간 청소)', cron: '0 3 * * *', desc: '이용자가 적은 새벽에 시스템 정리' },
	{ label: '매일 새벽 4시 (미디어 GC)', cron: '0 4 * * *', desc: '스토리지 미아/만료 파일 정리' },
	{ label: '매일 아침 7시 (출근 전 준비)', cron: '0 7 * * *', desc: '오늘 운행 기사님 단체방 준비' },
	{ label: '매 시간 정각마다', cron: '0 * * * *', desc: '1시간 주기 정기 상태 점검' },
	{ label: '10분마다 주기적 반복', cron: '*/10 * * * *', desc: '실시간에 준하는 고빈도 동기화' }
];

export const DEFAULT_CORE_SCHEDULES: CoreScheduleItem[] = [
	{
		task_type: 'DYNAMIC_GROUP_REFRESH',
		unique_key: 'cron:dynamic_group_refresh',
		label: '오늘 운행·휴무 기사 그룹 동기화',
		enabled: true,
		mode: 'cron',
		cron_expression: '0 7 * * *',
		repeat_interval: null,
		priority: 3
	},
	{
		task_type: 'SYSTEM_WATCHDOG_INSPECTION',
		unique_key: 'cron:system_watchdog_inspection',
		label: '시스템 이상징후 자율 감시 (Watchdog)',
		enabled: true,
		mode: 'interval',
		cron_expression: null,
		repeat_interval: 300,
		priority: 2
	},
	{
		task_type: 'DATA_RETENTION_GC',
		unique_key: 'cron:data_retention_gc',
		label: '전사 만료 이력·Redis 메모리 청소',
		enabled: true,
		mode: 'cron',
		cron_expression: '0 3 * * *',
		repeat_interval: null,
		priority: 8
	},
	{
		task_type: 'MEDIA_GC',
		unique_key: 'cron:media_gc',
		label: '미디어 스토리지 가비지 컬렉션',
		enabled: true,
		mode: 'cron',
		cron_expression: '0 4 * * *',
		repeat_interval: null,
		priority: 8
	},
	{
		task_type: 'CHECK_MINIAPP_ALARMS',
		unique_key: 'cron:check_miniapp_alarms',
		label: '미니앱 리마인더 알람 감시·발송',
		enabled: true,
		mode: 'interval',
		cron_expression: null,
		repeat_interval: 60,
		priority: 1
	},
	{
		task_type: 'DISPATCH_AUTO_ANNOUNCE',
		unique_key: 'cron:dispatch_auto_announce',
		label: '명일 배차 자동 확정·고지 감시',
		enabled: true,
		mode: 'interval',
		cron_expression: null,
		repeat_interval: 60,
		priority: 2
	}
];

export const DEFAULT_TASK_SETTINGS: TaskSettings = {
	worker_enabled: true,
	worker_poll_interval_sec: 2,
	reclaim_check_interval_sec: 60,
	bootstrap_heal_stuck_sec: 600,

	default_priority: 5,
	default_max_retries: 3,
	default_timeout_sec: 300,
	retry_backoff_base_sec: 10,
	retry_backoff_max_sec: 300,

	completed_retention_days: 30,
	watchdog_fail_alert_enabled: true,
	watchdog_fail_threshold: 3,

	core_schedules: DEFAULT_CORE_SCHEDULES.map((i) => ({ ...i })),

	ui_auto_refresh_default: true,
	ui_auto_refresh_sec: 10,
	ui_page_limit: 50,
	cron_presets: DEFAULT_CRON_PRESETS.map((i) => ({ ...i }))
};

export function normalizeTaskSettings(raw?: Partial<TaskSettings> | null): TaskSettings {
	const src = raw || {};
	return {
		...DEFAULT_TASK_SETTINGS,
		...src,
		core_schedules:
			Array.isArray(src.core_schedules) && src.core_schedules.length > 0
				? src.core_schedules.map((i) => ({ ...i }))
				: DEFAULT_CORE_SCHEDULES.map((i) => ({ ...i })),
		cron_presets:
			Array.isArray(src.cron_presets) && src.cron_presets.length > 0
				? src.cron_presets.map((i) => ({ ...i }))
				: DEFAULT_CRON_PRESETS.map((i) => ({ ...i }))
	};
}

export function getTaskStatusBadge(status: string): { label: string; color: string } {
	switch (status) {
		case 'SUCCESS':
			return { label: '성공', color: 'bg-emerald-50 text-emerald-700 border-emerald-300' };
		case 'RUNNING':
			return {
				label: '실행 중',
				color: 'bg-blue-50 text-blue-700 border-blue-300 animate-pulse font-bold'
			};
		case 'FAILED':
			return {
				label: '실패 (확인 필요)',
				color: 'bg-rose-50 text-rose-700 border-rose-300 font-bold'
			};
		case 'CANCELLED':
			return { label: '취소됨', color: 'bg-slate-100 text-slate-500 border-slate-300' };
		default:
			return { label: '실행 대기', color: 'bg-amber-50 text-amber-700 border-amber-300' };
	}
}

export function resolveTaskTypeInfo(taskTypes: TaskTypeMeta[], typeName: string): TaskTypeMeta {
	const found = (taskTypes || []).find((t) => t.type === typeName);
	if (found) return found;
	return {
		type: typeName,
		label: typeName,
		description: '시스템 백그라운드 작업',
		icon: 'solar:cpu-bolt-bold-duotone'
	};
}

export function formatIntervalReadable(seconds?: number | null): string {
	if (!seconds || seconds <= 0) return '-';
	if (seconds % 3600 === 0) return `매 ${seconds / 3600}시간마다`;
	if (seconds % 60 === 0) return `매 ${seconds / 60}분마다 (${seconds}초)`;
	return `매 ${seconds}초마다`;
}

export function parseJsonPayloadSafe(
	rawStr: string
): { ok: true; data: Record<string, any> } | { ok: false; error: string } {
	try {
		const parsed = JSON.parse(rawStr || '{}');
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return { ok: false, error: 'Payload는 JSON 객체({ ... }) 형식이어야 합니다.' };
		}
		return { ok: true, data: parsed };
	} catch {
		return { ok: false, error: '입력값(Payload)이 올바른 JSON 형식이 아닙니다.' };
	}
}
