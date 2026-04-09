import adapter from '@sveltejs/adapter-node';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(), // 전처리기 추가 (안전빵)
	kit: {
		adapter: adapter()
	},
	compilerOptions: {
		// 내 코드(src)는 룬 모드 강제, node_modules는 알아서 판단하게 둡니다.
		runes: true
	}
};

export default config;
