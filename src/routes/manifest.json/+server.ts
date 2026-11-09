import type { RequestHandler } from './$types';
import { json } from '@sveltejs/kit';

/**
 * ============================================================================
 * [동적 PWA 매니페스트 라우트 (Dynamic PWA Manifest)]
 * ============================================================================
 * 
 * 💡 역할:
 * 요청 도메인(Host)에 따라 개발(`dev.jeju.live`)과 운영(`jeju.live`)의
 * PWA 앱 이름, 테마 색상, 앱 아이콘 세트를 자동으로 분기하여 제공합니다.
 * 
 * 📌 특징:
 * 1. 도메인 기반 자동 판별: 별도의 환경설정 교체 없이 단일 코드베이스로 두 환경 완벽 격리.
 * 2. 개발 환경: 주황색(#d97706) 테마 + [DEV] 배지가 합성된 icon-dev-*.png 제공.
 * 3. 운영 환경: 네이비(#0f172a) 테마 + 정식 심볼 icon-*.png 제공.
 */
export const GET: RequestHandler = async ({ url }) => {
	const host = url.hostname.toLowerCase();
	const isDev = host.includes('dev') || host === 'localhost' || host === '127.0.0.1';

	const manifest = isDev
		? {
				id: 'https://dev.jeju.live/',
				name: '[DEV] jeju.live 개발서버',
				short_name: 'DEV-제주',
				description: '[개발용] jeju.live 사내 업무 시스템',
				lang: 'ko',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				background_color: '#ffffff',
				theme_color: '#d97706',
				icons: [
					{
						src: '/icons/icon-dev-192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: '/icons/icon-dev-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: '/icons/icon-dev-maskable-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			}
		: {
				id: 'https://jeju.live/',
				name: 'jeju.live 통합운송관제',
				short_name: 'jeju.live',
				description: 'jeju.live 사내 업무 시스템',
				lang: 'ko',
				start_url: '/',
				scope: '/',
				display: 'standalone',
				background_color: '#ffffff',
				theme_color: '#0f172a',
				icons: [
					{
						src: '/icons/icon-192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: '/icons/icon-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any'
					},
					{
						src: '/icons/icon-maskable-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'maskable'
					}
				]
			};

	return json(manifest, {
		headers: {
			'Content-Type': 'application/manifest+json; charset=utf-8',
			'Cache-Control': 'no-cache, no-store, must-revalidate'
		}
	});
};
