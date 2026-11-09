// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { UserProfile } from '$lib/types/user';

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user?: UserProfile | null;
			sessionId?: string | null;
			[key: string]: any;
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
