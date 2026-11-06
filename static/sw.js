// 레거시 수동 서비스 워커(/sw.js) 자동 해지 스크립트
// (SvelteKit 공식 표준인 src/service-worker.js -> /service-worker.js 로 정식 전환됨)
self.addEventListener('install', () => {
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		self.registration.unregister().then(() => {
			return self.clients.matchAll();
		})
	);
});
