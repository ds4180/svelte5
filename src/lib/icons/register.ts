import { addCollection } from '@iconify/svelte/dist/functions';
import type { IconifyJSON } from '@iconify/types';
import collections from './collections.json';

let registered = false;

/**
 * Registers statically used Iconify icon subsets in-memory so SSR and browser
 * hydration render without external `api.iconify.design` roundtrips.
 */
export function registerLocalIcons(): void {
	if (registered) return;
	registered = true;

	for (const collection of collections as unknown as IconifyJSON[]) {
		addCollection(collection);
	}
}

registerLocalIcons();
