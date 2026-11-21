/**
 * ============================================================================
 * [전역 사용자 권한 랭크 표준 상수 (SSOT: src/lib/config/rank.ts)]
 * ============================================================================
 * - 0~5, 8~9: 사용자에게 부여 가능한 직급/권한 레벨
 * - 6~7: 부그룹(allow_groups) 전용 앱 잠금 구간 (사용자 직접 부여 비권장)
 */

export interface RankMeta {
	val: number;
	role: string;
	shortLabel: string;
	label: string;
	color: string;
	badgeClass: string;
	desc: string;
	assignableToUser: boolean;
}

export const RANK_LEVELS: RankMeta[] = [
	{
		val: 0,
		role: 'ROLE_GUEST',
		shortLabel: 'Lv.0',
		label: 'Lv.0',
		color: 'badge-ghost',
		badgeClass: 'bg-slate-200 text-slate-700',
		desc: '비로그인 / 미승인 (공개 데이터만 접근)',
		assignableToUser: true
	},
	{
		val: 1,
		role: 'ROLE_USER',
		shortLabel: 'Lv.1',
		label: 'Lv.1',
		color: 'badge-info',
		badgeClass: 'bg-sky-500 text-white',
		desc: '일반 정회원 (본인 소유 리소스 CRUD)',
		assignableToUser: true
	},
	{
		val: 2,
		role: 'ROLE_DRIVER',
		shortLabel: 'Lv.2',
		label: 'Lv.2',
		color: 'badge-success',
		badgeClass: 'bg-emerald-600 text-white',
		desc: '승무직 운전원 (배차표/휴무/사내 기본 열람)',
		assignableToUser: true
	},
	{
		val: 3,
		role: 'ROLE_STAFF',
		shortLabel: 'Lv.3',
		label: 'Lv.3',
		color: 'badge-accent',
		badgeClass: 'bg-teal-600 text-white',
		desc: '현장직 및 사무 내근직 (주임·대리 실무)',
		assignableToUser: true
	},
	{
		val: 4,
		role: 'ROLE_MANAGER',
		shortLabel: 'Lv.4',
		label: 'Lv.4',
		color: 'badge-warning',
		badgeClass: 'bg-amber-600 text-white',
		desc: '사무 내근직 중간관리자 (일반 운영 앱 기본 진입선)',
		assignableToUser: true
	},
	{
		val: 5,
		role: 'ROLE_EXECUTIVE',
		shortLabel: 'Lv.5',
		label: 'Lv.5',
		color: 'badge-primary',
		badgeClass: 'bg-indigo-600 text-white',
		desc: '사무 내근직 임원 (상위 결재 및 경영 관제)',
		assignableToUser: true
	},
	{
		val: 6,
		role: 'ROLE_GROUP_ONLY_L1',
		shortLabel: 'Lv.6',
		label: 'Lv.6',
		color: 'badge-neutral',
		badgeClass: 'bg-slate-700 text-white',
		desc: '앱 잠금 전용 — allow_groups 소속자 및 Lv.8~9만 접근',
		assignableToUser: false
	},
	{
		val: 7,
		role: 'ROLE_GROUP_ONLY_L2',
		shortLabel: 'Lv.7',
		label: 'Lv.7',
		color: 'badge-neutral',
		badgeClass: 'bg-slate-800 text-white',
		desc: '민감 앱 잠금 전용 — allow_groups 소속자 및 Lv.8~9만 접근',
		assignableToUser: false
	},
	{
		val: 8,
		role: 'ROLE_CORE',
		shortLabel: 'Lv.8',
		label: 'Lv.8',
		color: 'badge-secondary',
		badgeClass: 'bg-purple-600 text-white',
		desc: '시스템 관리자 (감사로그/사용자/작업/설정/메뉴 관제)',
		assignableToUser: true
	},
	{
		val: 9,
		role: 'ROLE_ROOT',
		shortLabel: 'Lv.9',
		label: 'Lv.9',
		color: 'badge-error',
		badgeClass: 'bg-red-600 text-white',
		desc: '시스템 절대 권한 (Master Key, 그룹·앱·서비스 독점)',
		assignableToUser: true
	}
];

/** 사용자 계정에 직접 부여하는 표준 랭크 목록 (Lv.6~7 잠금 구간 제외) */
export const USER_ASSIGNABLE_RANK_LEVELS: RankMeta[] = RANK_LEVELS.filter(
	(r) => r.assignableToUser
);

/** 숫자 랭크에 대응하는 메타데이터 반환 */
export function getRankMeta(level: number | null | undefined): RankMeta {
	const num = Number(level ?? 0);
	return (
		RANK_LEVELS.find((r) => r.val === num) ?? {
			val: num,
			role: 'CUSTOM',
			shortLabel: `Lv.${num}`,
			label: `Lv.${num}`,
			color: 'badge-neutral',
			badgeClass: 'bg-slate-600 text-white',
			desc: '사용자 정의 등급',
			assignableToUser: false
		}
	);
}
