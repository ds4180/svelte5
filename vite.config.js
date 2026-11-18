import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';
import fs from 'node:fs';
import path from 'node:path';

/**
 * 개발 서버(vite dev)에서도 Nginx(default.conf)와 동일하게 /api/uploads/PUBLIC/* 정적 파일을 서빙합니다.
 */
function servePublicUploadsDev() {
	const publicRoot = path.resolve(process.env.UPLOAD_DIR || '/app/uploads', 'PUBLIC');
	const MIME_BY_EXT = {
		'.pdf': 'application/pdf',
		'.html': 'text/html; charset=utf-8',
		'.htm': 'text/html; charset=utf-8',
		'.txt': 'text/plain; charset=utf-8',
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.gif': 'image/gif',
		'.webp': 'image/webp',
		'.svg': 'image/svg+xml',
		'.doc': 'application/msword',
		'.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		'.xls': 'application/vnd.ms-excel',
		'.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
		'.ppt': 'application/vnd.ms-powerpoint',
		'.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		'.zip': 'application/zip'
	};

	return {
		name: 'serve-public-uploads-dev',
		configureServer(server) {
			server.middlewares.use('/api/uploads/PUBLIC', (req, res, next) => {
				if (req.method !== 'GET' && req.method !== 'HEAD') return next();
				const rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
				const relPath = rawPath.replace(/^\/+/, '');
				const fullPath = path.resolve(publicRoot, relPath);
				if (!fullPath.startsWith(publicRoot + path.sep) || !fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
					return next();
				}
				const ext = path.extname(fullPath).toLowerCase();
				res.setHeader('Content-Type', MIME_BY_EXT[ext] || 'application/octet-stream');
				fs.createReadStream(fullPath).pipe(res);
			});
		}
	};
}

export default defineConfig({
	plugins: [servePublicUploadsDev(), tailwindcss(), sveltekit()],
	server: {
		host: true,
		allowedHosts: ['.jeju.live', 'localhost'],
		proxy: {
			// 📌 [v1.1 표준] 모든 백엔드 API 통신은 /api로 단일화 (Nginx와 동일 규격)
			'/api': {
				target: 'http://fastapi:8000',
				changeOrigin: true,
				rewrite: (path) => path.replace(/^\/api/, '')
			},
			// 📌 [v1.1 표준] 실시간 웹소켓 통로
			'/ws': {
				target: 'http://fastapi:8000',
				changeOrigin: true,
				ws: true
			}
			// 🚀 [v2.0 정석] UI 경로(/v1/admin, /v1/board 등)와 충돌하던 프록시를 모두 제거하여
			// SvelteKit의 표준 라우팅 및 데이터 페칭(__data.json) 주권을 완벽히 회복합니다.
		}
	},

	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.js',
				test: {
					name: 'client',
					browser: {
						enabled: true,
						provider: playwright(),
						instances: [{ browser: 'chromium', headless: true }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**']
				}
			},

			{
				extends: './vite.config.js',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
