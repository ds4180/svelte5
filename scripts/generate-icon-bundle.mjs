import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { getIcons } from '@iconify/utils';

const require = createRequire(import.meta.url);
const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const OUT_FILE = path.join(SRC_DIR, 'lib', 'icons', 'collections.json');

const SUPPORTED_PREFIXES = ['ph', 'mdi', 'solar', 'lucide', 'bi'];
const ICON_REGEX = new RegExp(`\\b(${SUPPORTED_PREFIXES.join('|')}):([a-z0-9-]+)\\b`, 'g');
const LEGACY_REGEX = /\b(ph|mdi|lucide|bi)-([a-z0-9-]+)\b/g;
const SOURCE_EXTS = new Set(['.svelte', '.ts', '.js']);

function collectSourceFiles(dir, out = []) {
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			collectSourceFiles(fullPath, out);
		} else if (SOURCE_EXTS.has(path.extname(entry.name)) && !entry.name.includes('.spec.') && !entry.name.includes('.test.')) {
			out.push(fullPath);
		}
	}
	return out;
}

const byPrefix = new Map(SUPPORTED_PREFIXES.map((p) => [p, new Set()]));
byPrefix.get('ph').add('rocket-fill'); // SmartIcon default fallback

for (const filePath of collectSourceFiles(SRC_DIR)) {
	const content = fs.readFileSync(filePath, 'utf8');
	for (const match of content.matchAll(ICON_REGEX)) {
		byPrefix.get(match[1])?.add(match[2]);
	}
	for (const match of content.matchAll(LEGACY_REGEX)) {
		byPrefix.get(match[1])?.add(match[2]);
	}
}

const collections = [];
let totalIcons = 0;

for (const prefix of SUPPORTED_PREFIXES) {
	const names = Array.from(byPrefix.get(prefix)).sort();
	if (names.length === 0) continue;

	const jsonPath = require.resolve(`@iconify-json/${prefix}/icons.json`);
	const rawSet = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
	const subset = getIcons(rawSet, names, true);
	if (subset && subset.icons && Object.keys(subset.icons).length > 0) {
		collections.push(subset);
		totalIcons += Object.keys(subset.icons).length;
	}
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(collections));

const bytes = fs.statSync(OUT_FILE).size;
console.log(`Generated ${OUT_FILE}: ${collections.length} sets, ${totalIcons} icons (${(bytes / 1024).toFixed(1)} KB)`);
