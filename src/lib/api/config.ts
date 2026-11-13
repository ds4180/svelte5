/**
 * ============================================================================
 * [프로젝트 전역 설정 정보 (src/lib/api/config.ts)]
 * ============================================================================
 * 💡 역할:
 * 사이트 기본 메타데이터, 테마 색상, 기본 네비게이션 라우트 매핑을 정의합니다.
 */

export interface NavRouteItem {
	name: string;
	path: string;
}

export interface AppConfig {
	siteName: string;
	siteDescription: string;
	version: string;
	apiBaseUrl: string;
	theme: {
		primaryColor: string;
		secondaryColor: string;
	};
	navigation: NavRouteItem[];
}

export const config: AppConfig = {
	siteName: 'jeju.live Core',
	siteDescription: '스마트 현장 관제 및 업무 포털 플랫폼',
	version: '1.1.0',

	// 환경 변수 통합 관리 (VITE_ prefix 권장)
	apiBaseUrl: import.meta.env.VITE_API_SERVER || 'http://127.0.0.1:8000',

	theme: {
		primaryColor: '#6366f1',
		secondaryColor: '#a855f7'
	},

	/**
	 * 표준 라우팅(v2.0) 규격에 따른 네비게이션 경로 매핑
	 */
	navigation: [
		{ name: '일정', path: '/v1/pages/schedule' },
		{ name: '파일', path: '/v1/pages/files' },
		{ name: '휴무신청', path: '/v1/custom/dayoff' },
		{ name: '미니앱', path: '/v1/pages/miniapps' },
		{ name: '배차', path: '/v1/custom/dispatch' },
		{ name: '노선', path: '/v1/admin/route_master' }
	]
};

export default config;
