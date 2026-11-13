// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { UserProfile } from '$lib/types/user';

declare global {
	namespace App {
		interface Error {
			message: string;
			status?: number;
			code?: string;
			detail?: string;
		}
		interface Locals {
			user?: UserProfile | null;
			sessionId?: string | null;
			[key: string]: any;
		}
		interface PageData {
			user?: UserProfile | null;
			isDev?: boolean;
			metaTheme?: {
				themeColor: string;
				favicon: string;
				appleTouchIcon: string;
				appName: string;
			};
		}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
