/**
 * ============================================================================
 * [서비스앱 권한 유틸리티 및 정책 메타데이터 (src/lib/utils/servicePermission.ts)]
 * ============================================================================
 * 💡 역할:
 * - 백엔드 `evaluate_service_permission()`가 계산해 내려주는 `permissions` 객체를
 *   정규화하고, 레거시/직접 마운트 시 안전한 폴백 권한을 제공합니다.
 * - 관리자 화면(`/v1/admin/services`)에서 선택할 수 있는 정책 옵션을 단일 진실 공급원(SSOT)으로 정의합니다.
 */

export type ServiceReadPolicy = 'inherit' | 'authenticated' | 'custom';
export type ServiceWritePolicy = 'inherit_read' | 'inherit_write' | 'authenticated' | 'custom';

export interface ServicePermission {
	can_read: boolean;
	can_write: boolean;
	reason?: 'LOGIN_REQUIRED' | 'FORBIDDEN' | string | null;
	message?: string | null;
	read_policy?: ServiceReadPolicy | string;
	write_policy?: ServiceWritePolicy | string;
}

export interface ServicePermissionConfig {
	read_policy?: ServiceReadPolicy;
	write_policy?: ServiceWritePolicy;
	min_read_rank?: number;
	min_write_rank?: number;
	allow_groups?: string[];
	deny_groups?: string[];
}

export const SERVICE_READ_POLICY_OPTIONS: ReadonlyArray<{
	value: ServiceReadPolicy;
	label: string;
	description: string;
}> = [
	{
		value: 'inherit',
		label: '호스트 읽기 권한 승계 (기본)',
		description: '게시판 등 호스트 앱을 열람할 수 있으면 서비스 조회를 허용합니다.'
	},
	{
		value: 'authenticated',
		label: '로그인 사용자만 조회',
		description: '호스트가 공개되어 있더라도 로그인한 사용자에게만 서비스 내용을 노출합니다.'
	},
	{
		value: 'custom',
		label: '개별 랭크·그룹 지정',
		description: '서비스앱 자체 조회 최소 랭크 및 허용/차단 그룹을 지정합니다.'
	}
];

export const SERVICE_WRITE_POLICY_OPTIONS: ReadonlyArray<{
	value: ServiceWritePolicy;
	label: string;
	description: string;
}> = [
	{
		value: 'inherit_read',
		label: '호스트 읽기 + 정회원(1+) 이상 (기본)',
		description: '호스트 앱을 열람 가능한 정회원(rank 1 이상)에게 작성/실행을 허용합니다.'
	},
	{
		value: 'inherit_write',
		label: '호스트 쓰기 권한 승계',
		description: '게시글 작성 권한이 있는 사용자만 서비스 작성/실행을 허용합니다.'
	},
	{
		value: 'authenticated',
		label: '로그인 사용자 모두 허용',
		description: '호스트 열람이 가능한 모든 로그인 사용자(미승인 포함)에게 허용합니다.'
	},
	{
		value: 'custom',
		label: '개별 랭크·그룹 지정',
		description: '서비스앱 자체 쓰기 최소 랭크 및 허용/차단 그룹을 지정합니다.'
	}
];

/**
 * 백엔드에서 전달된 `permissions`가 있으면 그대로 정규화하고,
 * 없을 경우 현재 로그인 사용자 정보로 안전한 폴백 권한을 계산합니다.
 */
export function resolveServicePermission(
	permissions: ServicePermission | null | undefined,
	user: { id?: number | string; rank_level?: number; rank?: number } | null | undefined
): ServicePermission {
	if (permissions && typeof permissions === 'object') {
		return {
			can_read: permissions.can_read !== false,
			can_write: Boolean(permissions.can_write),
			reason: permissions.reason ?? null,
			message: permissions.message ?? null,
			read_policy: permissions.read_policy,
			write_policy: permissions.write_policy
		};
	}

	if (!user?.id) {
		return {
			can_read: true,
			can_write: false,
			reason: 'LOGIN_REQUIRED',
			message: '로그인 후 이용할 수 있습니다.'
		};
	}

	const rank = Number(user.rank_level ?? user.rank ?? 0);
	if (rank < 1) {
		return {
			can_read: true,
			can_write: false,
			reason: 'FORBIDDEN',
			message: '정회원 이상만 이용할 수 있습니다.'
		};
	}

	return {
		can_read: true,
		can_write: true,
		reason: null,
		message: null
	};
}
