/**
 * 프로젝트 전역 설정 정보 (표준 주소 체계 반영)
 */
export const config = {
    siteName: 'Pybo',
    siteDescription: 'A premium community platform for developers and enthusiasts.',
    version: '1.1.0', // Svelte 5 마이그레이션 버전
    
    // 환경 변수 통합 관리 (VITE_ prefix 권장)
    apiBaseUrl: import.meta.env.VITE_API_SERVER || 'http://127.0.0.1:8000',

    theme: {
        primaryColor: '#6366f1',
        secondaryColor: '#a855f7',
    },

    /**
     * 표준 라우팅(v2.0) 규격에 따른 네비게이션 경로 매핑
     * { version: v1, layer: app, instance: ..., action: ... }
     */
    navigation: [
        { name: '질문목록', path: '/v1/app/question/list' },
        { name: '질문 작성', path: '/v1/app/question/create' },
        { name: '달력', path: '/v1/app/calendar' },
        { name: '파일', path: '/v1/app/files' },
        { name: '결근계', path: '/v1/app/day-off' },
        { name: '차트', path: '/v1/app/chart' },
        { name: '배차', path: '/v1/app/dnd' },
        { name: '노선', path: '/v1/app/bus-line' },
    ]
};

// 기본 내보내기
export default config;
