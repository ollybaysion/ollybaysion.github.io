/** 해시는 FNV-1a 하나로 고정. 다른 해시를 섞지 않는다(불변식 2). */

const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const encoder = new TextEncoder();

/**
 * 태그 정규화: NFC + trim + lowercase. 해시 전에 반드시 통과시킨다(불변식 3).
 */
export function normalizeTag(tag: string): string {
	return tag.normalize('NFC').trim().toLowerCase();
}

/** 태그 배열 정규화 + 빈 문자열 제거 + 중복 제거. 순서는 입력 순서를 지킨다. */
export function normalizeTags(tags: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const tag of tags) {
		const normalized = normalizeTag(tag);
		if (normalized === '' || seen.has(normalized)) continue;
		seen.add(normalized);
		out.push(normalized);
	}
	return out;
}

/**
 * FNV-1a(32bit) → [0, 1).
 * UTF-8 바이트 기준이라 한글도 환경과 무관하게 같은 값이 나온다.
 */
export function hash01(str: string): number {
	let hash = FNV_OFFSET_BASIS;
	for (const byte of encoder.encode(str)) {
		hash ^= byte;
		hash = Math.imul(hash, FNV_PRIME) >>> 0;
	}
	return hash / 0x1_0000_0000;
}
