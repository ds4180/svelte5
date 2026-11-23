/**
 * ============================================================================
 * [차량 배차(Dispatch) API 및 타입 통합 모듈 (src/lib/api/dispatch.ts)]
 * ============================================================================
 */

import { fastApi } from '$lib/api';
import {
	adminGetActiveRouteMasters,
	adminGetDailyDispatch,
	adminSaveDailyDispatch
} from '$lib/api/admin';

export { adminGetActiveRouteMasters, adminGetDailyDispatch, adminSaveDailyDispatch };

export interface RouteFleetRule {
	keywords: string[];
	fleet_key: string;
}

export interface DriverAssignColorStyle {
	enabled: boolean;
	bg_color: string;
	text_color: string;
}

export interface DriverAssignColorsConfig {
	reserve: DriverAssignColorStyle;
	cross: DriverAssignColorStyle;
}

export interface DispatchSettings {
	preview_enabled: boolean;
	preview_force_open: boolean;
	preview_start_offset: number;
	preview_days: number;
	preview_open_time: string;
	preview_pause_message: string;
	auto_announce_enabled: boolean;
	auto_announce_time: string;
	auto_announce_push: boolean;
	auto_announce_skip_if_confirmed: boolean;
	route_fleet_rules: RouteFleetRule[];
	show_substitute_columns: boolean;
	driver_assign_colors?: DriverAssignColorsConfig;
	max_weekly_work_days?: number;
	weekly_basis?: 'calendar_week' | 'rolling_7d';
	min_rest_hours?: number;
	night_metric_mode?: 'turn_count' | 'time_range';
	night_turn_seqs?: number[];
	night_include_last_turn?: boolean;
	night_morning_end?: string;
	night_evening_start?: string;
	stats_include_draft?: boolean;
	enable_validation_blink?: boolean;
	warn_prev_day_work?: boolean;
	disciplined_drivers?: string[];
}

export interface DriverWorkStat {
	name: string;
	month_work_days: number;
	week_work_days: number;
	month_work_minutes: number;
	month_night_count: number;
	month_night_minutes: number;
	prev_end_time: string | null;
	worked_yesterday?: boolean;
	earliest_today_min: number | null;
	earliest_available_time: string | null;
	dayoff_type: string | null;
	dayoff_status: string | null;
	is_disciplined: boolean;
}

export interface DispatchPreviewWindow {
	is_paused: boolean;
	is_force_open: boolean;
	open_time: string;
	min_offset: number | null;
	max_offset: number | null;
	offsets: number[];
	allowed_dates: string[];
	reason: string;
}

export interface DriverResource {
	name: string;
	vehicle_no?: string;
	role?: 'MAIN' | 'SUB' | string;
}

export interface RouteMasterItem {
	id: number | 'ALL';
	route_name: string;
}

export interface DispatchRow {
	timetable_id: number;
	seq: number;
	start_time: string;
	end_time?: string;
	start_location?: string;
	end_location?: string;
	vehicle_no: string;
	driver_name?: string | null;
	tomorrow_driver_name?: string | null;
	yesterday_driver_name?: string | null;
	is_inherited?: boolean;
	is_tomorrow_inherited?: boolean;
	is_regular_duty?: boolean;
	is_yesterday_regular_duty?: boolean;
	status?: 'DRAFT' | 'CONFIRMED' | 'ANNOUNCED' | string;
	memo?: string | null;
	route_id?: number;
	route_name?: string;
}

export const adminGetDispatchSettings = () =>
	fastApi<{ settings: DispatchSettings; preview_window: DispatchPreviewWindow }>(
		'GET',
		'/api/v1/admin/dispatch/settings'
	);

export const adminUpdateDispatchSettings = (payload: DispatchSettings) =>
	fastApi<{ message: string; settings: DispatchSettings; preview_window: DispatchPreviewWindow }>(
		'PUT',
		'/api/v1/admin/dispatch/settings',
		payload
	);

export const adminGetDispatchResources = () =>
	fastApi<{
		vehicles_by_group: Record<string, string[]>;
		drivers: DriverResource[];
		settings: DispatchSettings;
	}>('GET', '/api/v1/admin/dispatch/resources');

export const adminGetDriverWorkStats = (targetDate: string) =>
	fastApi<{ target_date: string; stats: Record<string, DriverWorkStat> }>(
		'GET',
		`/api/v1/admin/dispatch/driver-stats?target_date=${encodeURIComponent(targetDate)}`
	);

export const adminAnnounceDispatchNow = () =>
	fastApi<{
		message: string;
		status: string;
		target_date: string;
		updated_count: number;
		push_sent: boolean;
	}>('POST', '/api/v1/admin/dispatch/announce-now');

export const customGetDispatchSettings = () =>
	fastApi<{
		preview_window: DispatchPreviewWindow;
		show_substitute_columns: boolean;
		route_fleet_rules: RouteFleetRule[];
		vehicles_by_group: Record<string, string[]>;
	}>('GET', '/api/v1/custom/dispatch/settings');
