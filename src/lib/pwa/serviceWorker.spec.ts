import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('serviceWorker helpers', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.clearAllMocks();
	});

	it('unregisters existing service workers, clears caches, and skips registration in dev mode', async () => {
		const unregisterMock = vi.fn().mockResolvedValue(true);
		const registerMock = vi.fn();
		const cacheDeleteMock = vi.fn().mockResolvedValue(true);
		const cachesMock = {
			keys: vi.fn().mockResolvedValue(['uv-static-v1', 'uv-runtime-v1']),
			delete: cacheDeleteMock
		};

		vi.stubGlobal('caches', cachesMock);
		vi.stubGlobal('window', { caches: cachesMock });
		vi.stubGlobal('navigator', {
			serviceWorker: {
				getRegistrations: vi.fn().mockResolvedValue([{ unregister: unregisterMock }]),
				getRegistration: vi.fn().mockResolvedValue({ unregister: unregisterMock }),
				register: registerMock
			}
		});

		vi.doMock('$app/environment', () => ({
			browser: true,
			dev: true,
			building: false,
			version: 'dev-version'
		}));

		const { registerServiceWorker, getActiveRegistration } = await import('./serviceWorker');

		const reg = await registerServiceWorker();
		expect(reg).toBeUndefined();
		expect(registerMock).not.toHaveBeenCalled();
		expect(unregisterMock).toHaveBeenCalledTimes(1);
		expect(cacheDeleteMock).toHaveBeenCalledWith('uv-static-v1');
		expect(cacheDeleteMock).toHaveBeenCalledWith('uv-runtime-v1');

		const active = await getActiveRegistration();
		expect(active).toBeNull();
	});

	it('registers classic service worker in production browser mode and resolves active ready registration', async () => {
		const fakeReg = {
			waiting: null,
			installing: null,
			active: null,
			addEventListener: vi.fn()
		};
		const registerMock = vi.fn().mockResolvedValue(fakeReg);

		vi.stubGlobal('window', {});
		vi.stubGlobal('navigator', {
			serviceWorker: {
				controller: null,
				getRegistrations: vi.fn().mockResolvedValue([]),
				getRegistration: vi.fn().mockResolvedValue(fakeReg),
				register: registerMock,
				ready: Promise.resolve(fakeReg),
				addEventListener: vi.fn()
			}
		});

		vi.doMock('$app/environment', () => ({
			browser: true,
			dev: false,
			building: false,
			version: 'prod-version'
		}));

		const { registerServiceWorker, getActiveRegistration, SW_URL } = await import(
			'./serviceWorker'
		);

		const reg = await registerServiceWorker();
		expect(reg).toBe(fakeReg);
		expect(registerMock).toHaveBeenCalledTimes(1);
		expect(registerMock).toHaveBeenCalledWith(SW_URL, { type: 'classic' });

		const active = await getActiveRegistration();
		expect(active).toBe(fakeReg);
	});
});
