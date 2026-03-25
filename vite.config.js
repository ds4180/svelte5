import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit()],
	server: {
		host: true,
		allowedHosts:['jeju.live','localhost'],
		proxy: {
			// 📌 [v1.0] Legacy API Proxy
			'/api': { target: 'http://fastapi:8000', changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, '') },
			'/users': { target: 'http://fastapi:8000', changeOrigin: true },
			'/fileupload': { target: 'http://fastapi:8000', changeOrigin: true },
			'/ws': { target: 'http://fastapi:8000', changeOrigin: true, ws: true },
			
			// 📌 [v2.0] Modern Architecture Proxy (UI 경로와 API 경로의 평화로운 공존)
			'/v1/admin': { 
				target: 'http://fastapi:8000', 
				changeOrigin: true,
				bypass: (req) => {
					// 🚀 브라우저가 화면을 그리려고(HTML/Accept 기반) 호출하는 경우 프록시를 타지 않습니다.
					if (req.headers.accept?.indexOf('text/html') !== -1) return req.url;
				}
			},
			'/v1/board': { target: 'http://fastapi:8000', changeOrigin: true },
			'/v1/pages': { target: 'http://fastapi:8000', changeOrigin: true },
			'/v1/alert': { target: 'http://fastapi:8000', changeOrigin: true },
			'/v1/dayoff': { target: 'http://fastapi:8000', changeOrigin: true }
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
