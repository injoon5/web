import { writable, get } from 'svelte/store';

export const clientIpHash = writable('');
export const hashReal = writable(false);
export const hashAttempted = writable(false);

let resolving = false;

export async function resolveIpHash() {
	if (get(hashAttempted) || resolving) return;
	resolving = true;
	try {
		const res = await fetch('/api/ip-hash');
		if (res.ok) {
			const data = await res.json();
			if (data.ipHash) {
				clientIpHash.set(data.ipHash);
				hashReal.set(true);
			}
		}
	} catch {
		// leave defaults; voted/liked state stays unknown
	} finally {
		hashAttempted.set(true);
		resolving = false;
	}
}
