import { beforeEach, describe, expect, it, vi } from 'vitest';

const { applyActionMock, gotoMock, clearSwUserCacheMock, unsubscribePushOnLogoutMock } = vi.hoisted(
	() => ({
		applyActionMock: vi.fn(),
		gotoMock: vi.fn(),
		clearSwUserCacheMock: vi.fn(),
		unsubscribePushOnLogoutMock: vi.fn()
	})
);

vi.mock('$app/forms', () => ({
	applyAction: applyActionMock
}));

vi.mock('$app/navigation', () => ({
	goto: gotoMock
}));

vi.mock('$lib/pwa/serviceWorker', () => ({
	clearSwUserCache: clearSwUserCacheMock,
	unsubscribePushOnLogout: unsubscribePushOnLogoutMock
}));

import { createLogoutSubmitHandler } from './logout';

describe('createLogoutSubmitHandler', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		applyActionMock.mockResolvedValue(undefined);
		gotoMock.mockResolvedValue(undefined);
		clearSwUserCacheMock.mockResolvedValue(undefined);
		unsubscribePushOnLogoutMock.mockResolvedValue(undefined);
	});

	it('does not clear auth before server redirect result, then clears auth/SW cache and navigates with invalidateAll', async () => {
		const auth = { clear: vi.fn() } as any;
		const onSubmittingChange = vi.fn();
		const onSuccess = vi.fn();
		const cancel = vi.fn();

		const submitFn = createLogoutSubmitHandler({ auth, onSubmittingChange, onSuccess });
		const afterSubmit = submitFn({ cancel } as any) as any;

		expect(cancel).not.toHaveBeenCalled();
		expect(onSubmittingChange).toHaveBeenCalledWith(true);
		expect(unsubscribePushOnLogoutMock).toHaveBeenCalledTimes(1);
		expect(auth.clear).not.toHaveBeenCalled();

		await afterSubmit({ result: { type: 'redirect', status: 303, location: '/' } });

		expect(auth.clear).toHaveBeenCalledTimes(1);
		expect(clearSwUserCacheMock).toHaveBeenCalledTimes(1);
		expect(onSuccess).toHaveBeenCalledTimes(1);
		expect(gotoMock).toHaveBeenCalledWith('/', { invalidateAll: true, replaceState: true });
		expect(applyActionMock).not.toHaveBeenCalled();
	});

	it('cancels duplicate in-flight submissions and resets state when server returns error', async () => {
		const auth = { clear: vi.fn() } as any;
		const onSubmittingChange = vi.fn();
		const cancelFirst = vi.fn();
		const cancelSecond = vi.fn();

		const submitFn = createLogoutSubmitHandler({ auth, onSubmittingChange });
		const afterFirst = submitFn({ cancel: cancelFirst } as any) as any;
		submitFn({ cancel: cancelSecond } as any);

		expect(cancelFirst).not.toHaveBeenCalled();
		expect(cancelSecond).toHaveBeenCalledTimes(1);

		const errorResult = { type: 'error', status: 500, error: new Error('fail') };
		await afterFirst({ result: errorResult });

		expect(auth.clear).not.toHaveBeenCalled();
		expect(clearSwUserCacheMock).not.toHaveBeenCalled();
		expect(onSubmittingChange).toHaveBeenLastCalledWith(false);
		expect(applyActionMock).toHaveBeenCalledWith(errorResult);
	});
});
