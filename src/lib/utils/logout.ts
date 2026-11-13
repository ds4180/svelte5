import { applyAction } from '$app/forms';
import { goto } from '$app/navigation';
import type { SubmitFunction } from '@sveltejs/kit';
import { clearSwUserCache, unsubscribePushOnLogout } from '$lib/pwa/serviceWorker';
import type { AuthState } from '$lib/runes/auth.svelte';

export interface LogoutSubmitOptions {
	auth: AuthState;
	onSubmittingChange?: (submitting: boolean) => void;
	onSuccess?: () => void;
}

/**
 * SvelteKit `<form method="POST" action="/logout">`용 공통 `use:enhance` 핸들러.
 *
 * 폼 제출 직전에 `auth.clear()`를 호출해 `{#if auth.user}` 블록 안의 폼 DOM이
 * 조기 언마운트되며 `415 (received null)`가 발생하는 문제를 막고,
 * 서버 로그아웃 액션(`/logout` -> `/users/logout`) 완료 후 클라이언트 상태·SW 캐시를 정리합니다.
 */
export function createLogoutSubmitHandler(options: LogoutSubmitOptions): SubmitFunction {
	let inFlight = false;

	return ({ cancel }) => {
		if (inFlight) {
			cancel();
			return;
		}

		inFlight = true;
		options.onSubmittingChange?.(true);

		const pushUnsubscribePromise = unsubscribePushOnLogout().catch(() => {});

		return async ({ result }) => {
			await pushUnsubscribePromise;

			if (result.type === 'failure' || result.type === 'error') {
				inFlight = false;
				options.onSubmittingChange?.(false);
				await applyAction(result);
				return;
			}

			options.auth.clear();
			await clearSwUserCache();
			options.onSuccess?.();

			const target = result.type === 'redirect' ? result.location : '/';
			await goto(target, { invalidateAll: true, replaceState: true });
		};
	};
}
