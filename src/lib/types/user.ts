/**
 * ============================================================================
 * [전사 통합 사용자 프로필 및 권한 타입 정의 (src/lib/types/user.ts)]
 * ============================================================================
 * 💡 역할:
 * 프론트엔드와 백엔드 간 사용자 정보의 단일 기준점(Single Source of Truth)을 제공합니다.
 * App.Locals.user 및 AuthState.user에 동일하게 적용됩니다.
 */

export interface UserProfile {
	id: number | string;
	username: string;
	email?: string;
	rank_level: number;
	is_superuser: boolean;
	primary_group?: string;
	secondary_groups: string[];
	created_at?: string;
	updated_at?: string;
	[key: string]: any;
}

export type AccessAction = 'read' | 'write';

export interface CanAccessOptions {
	action?: AccessAction;
	minReadRank?: number;
	minWriteRank?: number;
	allowGroups?: string[] | Record<string, string[]> | any;
	denyGroups?: string[] | Record<string, string[]> | any;
	op?: '>=' | '>' | '<' | '<=' | '==';
}
