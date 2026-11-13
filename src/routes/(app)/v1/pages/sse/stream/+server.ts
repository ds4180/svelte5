import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';

/**
 * SSE (Server-Sent Events) 스트리밍 엔드포인트
 * GET /v1/pages/sse/stream?count=10
 */
export const GET: RequestHandler = async ({ locals, url, request }) => {
	if (!locals.user) {
		throw error(401, '로그인이 필요합니다.');
	}

	const rawCount = Number(url.searchParams.get('count') ?? 10);
	const maxCount = Number.isFinite(rawCount) ? Math.min(Math.max(Math.trunc(rawCount), 1), 30) : 10;

	const encoder = new TextEncoder();
	let timer: ReturnType<typeof setInterval> | null = null;
	let closed = false;

	const cleanup = () => {
		closed = true;
		if (timer) {
			clearInterval(timer);
			timer = null;
		}
	};

	const stream = new ReadableStream({
		start(controller) {
			const sendEvent = (eventName: string, data: unknown, id?: number | string) => {
				if (closed) return;
				let chunk = '';
				if (id !== undefined) chunk += `id: ${id}\n`;
				if (eventName) chunk += `event: ${eventName}\n`;
				chunk += `data: ${JSON.stringify(data)}\n\n`;
				controller.enqueue(encoder.encode(chunk));
			};

			// 재연결 간격(ms) 지시
			controller.enqueue(encoder.encode('retry: 3000\n\n'));

			// 1. 초기 연결 이벤트
			sendEvent(
				'connected',
				{
					message: 'SSE 스트림이 연결되었습니다.',
					user: locals.user?.username ?? 'unknown',
					maxCount,
					serverTime: new Date().toISOString()
				},
				0
			);

			let seq = 0;
			timer = setInterval(() => {
				if (closed) return;
				seq += 1;

				sendEvent(
					'tick',
					{
						seq,
						maxCount,
						progress: Math.round((seq / maxCount) * 100),
						value: Math.floor(Math.random() * 100),
						serverTime: new Date().toISOString()
					},
					seq
				);

				if (seq >= maxCount) {
					sendEvent(
						'done',
						{
							message: `총 ${maxCount}건의 이벤트 전송이 완료되었습니다.`,
							serverTime: new Date().toISOString()
						},
						seq + 1
					);
					cleanup();
					controller.close();
				}
			}, 1000);

			request.signal.addEventListener('abort', cleanup, { once: true });
		},
		cancel() {
			cleanup();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream; charset=utf-8',
			'Cache-Control': 'no-cache, no-transform',
			Connection: 'keep-alive',
			// Nginx 리버스 프록시 환경에서 응답 버퍼링 비활성화
			'X-Accel-Buffering': 'no'
		}
	});
};
