/**
 * ============================================================================
 * [조직·권한 그룹 관제 프론트엔드 서비스 (src/lib/services/groupAdminService.ts)]
 * ============================================================================
 * - /v1/admin/group-manage의 동적 정책 정규화, JSONB 듀얼 모드 권한 스펙 조작
 *   (addGroupToAction / removeGroupFromAction), 인스턴스 유형 메타를 단일 진실원으로 분리합니다.
 */

export type GroupMainTab = 'group' | 'user' | 'instance' | 'system-app' | 'settings';

export interface GroupManageSettings {
	protected_group_codes: string[];
	block_delete_in_use_group: boolean;
	max_secondary_groups_per_user: number;
	prevent_duplicate_primary_secondary: boolean;
	enforce_group_type_on_assign: boolean;
	default_group_type: 'PRIMARY' | 'SECONDARY';
	default_group_category: 'GENERAL' | 'PRIVILEGE' | 'RESTRICTION';
	require_group_description: boolean;
	default_page_write_rank: number;
	audit_group_changes: boolean;
	ui_default_main_tab: 'group' | 'user' | 'instance' | 'system-app';
}

export interface GroupItem {
	id: number;
	code: string;
	name: string;
	group_type: 'PRIMARY' | 'SECONDARY' | string;
	category: 'GENERAL' | 'PRIVILEGE' | 'RESTRICTION' | string;
	description?: string | null;
	created_at: string;
	primary_count: number;
	secondary_count: number;
	allow_apps: string[];
	deny_apps: string[];
}

export interface UserGroupItem {
	id: number;
	username: string;
	real_name?: string | null;
	email: string;
	rank_level: number;
	primary_group?: string | null;
	secondary_groups: string[];
}

export type GroupSpec =
	| string[]
	| {
			all?: string[];
			read?: string[];
			write?: string[];
	  };

export interface InstancePermissionItem {
	target_id: string;
	instance_type: 'BOARD' | 'PAGE' | 'APP' | string;
	app_type?: string | null;
	title: string;
	slug?: string | null;
	frontend_route?: string | null;
	parent_engine: string;
	icon?: string | null;
	min_read_rank: number;
	min_write_rank: number;
	allow_groups: GroupSpec;
	deny_groups: GroupSpec;
}

export interface GroupCodeOption {
	code: string;
	name: string;
	type: string;
}

export const DEFAULT_GROUP_MANAGE_SETTINGS: GroupManageSettings = {
	protected_group_codes: ['admin'],
	block_delete_in_use_group: false,
	max_secondary_groups_per_user: 10,
	prevent_duplicate_primary_secondary: true,
	enforce_group_type_on_assign: false,
	default_group_type: 'PRIMARY',
	default_group_category: 'GENERAL',
	require_group_description: false,
	default_page_write_rank: 9,
	audit_group_changes: true,
	ui_default_main_tab: 'group'
};

export function normalizeGroupManageSettings(
	raw?: Partial<GroupManageSettings> | null
): GroupManageSettings {
	const src = raw || {};
	return {
		...DEFAULT_GROUP_MANAGE_SETTINGS,
		...src,
		protected_group_codes: Array.isArray(src.protected_group_codes)
			? [...src.protected_group_codes]
			: [...DEFAULT_GROUP_MANAGE_SETTINGS.protected_group_codes]
	};
}

/**
 * JSONB 듀얼 모드 권한 스펙(단순 배열 또는 {all, read, write} 객체)에
 * 특정 그룹 코드와 액션 권한을 원자적으로 추가합니다.
 */
export function addGroupToAction(
	groupData: any,
	code: string,
	action: 'all' | 'read' | 'write' = 'all'
): GroupSpec {
	const spec: { read: string[]; write: string[]; all: string[] } = {
		read: [],
		write: [],
		all: []
	};
	if (Array.isArray(groupData)) {
		spec.all = [...groupData.filter(Boolean)];
	} else if (typeof groupData === 'object' && groupData !== null) {
		if (Array.isArray(groupData.all)) spec.all = [...groupData.all.filter(Boolean)];
		if (Array.isArray(groupData.read)) spec.read = [...groupData.read.filter(Boolean)];
		if (Array.isArray(groupData.write)) spec.write = [...groupData.write.filter(Boolean)];
	}

	if (action === 'all') {
		spec.read = spec.read.filter((c) => c !== code);
		spec.write = spec.write.filter((c) => c !== code);
		if (!spec.all.includes(code)) spec.all.push(code);
	} else if (action === 'read') {
		if (!spec.all.includes(code) && !spec.read.includes(code)) {
			spec.read.push(code);
		}
	} else if (action === 'write') {
		if (!spec.all.includes(code) && !spec.write.includes(code)) {
			spec.write.push(code);
		}
	}

	if (spec.read.length === 0 && spec.write.length === 0) {
		return spec.all;
	}
	return spec;
}

/**
 * JSONB 듀얼 모드 권한 스펙에서 특정 그룹 코드와 액션 권한을 제거합니다.
 */
export function removeGroupFromAction(
	groupData: any,
	code: string,
	action: 'all' | 'read' | 'write' | string = 'all'
): GroupSpec {
	if (Array.isArray(groupData)) {
		return groupData.filter((c) => c !== code);
	}
	if (typeof groupData === 'object' && groupData !== null) {
		const updated = {
			all: (groupData.all || []).filter(
				(c: string) => !(c === code && (action === 'all' || !action))
			),
			read: (groupData.read || []).filter(
				(c: string) => !(c === code && (action === 'read' || !action))
			),
			write: (groupData.write || []).filter(
				(c: string) => !(c === code && (action === 'write' || !action))
			)
		};
		if (updated.read.length === 0 && updated.write.length === 0) {
			return updated.all;
		}
		return updated;
	}
	return [];
}

export function getInstanceTypeMeta(type: string): {
	label: string;
	color: string;
	icon: string;
} {
	if (type === 'BOARD') {
		return {
			label: '게시판',
			color: 'bg-sky-100 text-sky-800 border-sky-300',
			icon: 'mdi:bulletin-board'
		};
	}
	if (type === 'PAGE') {
		return {
			label: '페이지',
			color: 'bg-purple-100 text-purple-800 border-purple-300',
			icon: 'mdi:file-document-outline'
		};
	}
	return {
		label: '단일 앱',
		color: 'bg-amber-100 text-amber-900 border-amber-300',
		icon: 'mdi:application-brackets-outline'
	};
}
