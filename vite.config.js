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
