import type { LayoutServerLoad } from './$types';
import { getKstTimeSnapshot } from '$lib/utils/serverTime';

/**
 * ============================================================================
 * [최상위 서버 로드 함수 (Root Server Load)]
 * ============================================================================
 * 
 * 💡 이 파일의 역할:
 * 브라우저가 어떤 페이지를 요청하든 간에, 서버(Node.js)에서 가장 먼저 실행되는 함수입니다.
 * 
 * 1. 사용자가 보낸 쿠키/세션을 바탕으로 src/hooks.server.js 에서 인증을 수행합니다.
 * 2. 인증이 완료되면 locals.user 에 로그인한 사용자 정보가 저장됩니다.
 * 3. 이 파일은 그 locals.user 를 꺼내서, 시스템 전체의 모든 페이지와 레이아웃으로
 *    안전하게 하향 전달(물려주기)하는 '최상위 젖줄(척추)' 역할을 합니다.
 * 
 * 📌 이렇게 하면 하위의 모든 페이지(+page.svelte, (app)/+layout.svelte 등)에서
 *    별도의 복잡한 API 호출 없이 `data.user`로 로그인 유저 정보를 즉시 조회할 수 있습니다.
 */
export const load: LayoutServerLoad = async ({ locals, url }) => {
	// 서버 훅(hooks.server.js)에서 이미 검증해둔 로그인 사용자 정보를 꺼냅니다.
	// 비로그인 상태라면 null이 전달되어 하위 화면에서 손쉽게 로그인 여부를 판단할 수 있습니다.
	const currentUser = locals.user || null;

	// 도메인(Host) 기반 개발/운영 환경 자동 감지 (PWA 아이콘 및 테마 분리)
	const host = url.hostname.toLowerCase();
	const isDev = host.includes('dev') || host === 'localhost' || host === '127.0.0.1';

	return {
		user: currentUser,
		isDev,
		serverTime: getKstTimeSnapshot(),
		metaTheme: {
			themeColor: isDev ? '#d97706' : '#0f172a',
			favicon: isDev ? '/favicon-dev.png' : '/favicon.png',
			appleTouchIcon: isDev ? '/icons/icon-dev-192.png' : '/icons/icon-192.png',
			appName: isDev ? '[DEV] jeju.live' : 'jeju.live 통합운송관제'
		}
	};
};
