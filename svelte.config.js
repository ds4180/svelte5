import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(), // 전처리기 추가 (안전빵)
	kit: {
		adapter: adapter(),
		serviceWorker: {
			// 자동 등록 대신 $lib/pwa/serviceWorker.js 의 registerServiceWorker() 로 직접 등록
			// (운영 빌드에서만 등록, dev 서버에서는 HMR 충돌 방지를 위해 미등록)
			register: false
		},
		version: {
			// 새 배포 감지 주기(ms): $app/state 의 updated.current 가 true 로 바뀌어
			// +layout.svelte 의 beforeNavigate 에서 전체 새로고침으로 최신 버전을 로드
			pollInterval: 60000
		}
	},
	compilerOptions: {
		// 내 코드(src)는 룬 모드 강제, node_modules는 알아서 판단하게 둡니다.
		runes: true
	}
};

export default config;
