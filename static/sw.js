// 서비스 워커: 백그라운드 푸시 알림 및 API 캐싱 제어
const CACHE_NAME = 'board-cache-v1';

// 푸시 알림 수신 (JSON 자동 파서 적용)
self.addEventListener('push', function (event) {
	let title = '📢 jeju.live';
	let options = {
		body: '새로운 알림이 도착했습니다.',
		icon: '/favicon.png',
		badge: '/favicon.png',
		data: { url: '/' }, // 클릭 시 이동 기본값
		vibrate: [200, 100, 200]
	};

	try {
		if (event.data) {
			const payload = event.data.json();
			// 💡 JSON 데이터인 경우 필드별로 매핑
			title = payload.title || title;
			options.body = payload.body || options.body;
			options.icon = payload.icon || options.icon;
			options.badge = payload.badge || options.badge;
			// 클릭 시 이동할 URL 정보를 data 객체에 담아 전달
			if (payload.url) options.data.url = payload.url;
		}
	} catch (e) {
		// 💡 단순 문자열로 온 경우 (레거시 대응)
		options.body = event.data ? event.data.text() : options.body;
	}

	event.waitUntil(self.registration.showNotification(title, options));
});

// 알림 클릭 시 특정 페이지로 이동 리팩토링
self.addEventListener('notificationclick', function (event) {
	const clickedNotification = event.notification;
	clickedNotification.close();

	// 알림 데이터에 포함된 URL로 이동 시도
	const targetUrl = clickedNotification.data && clickedNotification.data.url ? clickedNotification.data.url : '/';

	event.waitUntil(
		clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
			// 이미 열려 있는 창이 있으면 해당 창을 포커스하고 이동
			for (const client of clientList) {
				if (client.url === targetUrl && 'focus' in client) {
					return client.focus();
				}
			}
			// 열려 있는 창이 없거나 다른 페이지면 새 창/이동
			if (clients.openWindow) {
				return clients.openWindow(targetUrl);
			}
		})
	);
});

// fetch 이벤트 핸들러: API 요청은 가로채지 않고 브라우저에 맡김 (Mixed Content 및 캐시 에러 방지)
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // ⛔ API 요청은 서비스 워커가 간섭하지 않도록 제외 처리
    if (url.pathname.startsWith('/api')) {
        return; // 브라우저 기본 fetch가 작동하게 함
    }

    // 💡 향후 정적 자산(CSS, JS, 이미지) 캐싱이 필요할 때 아래에 구현
});
