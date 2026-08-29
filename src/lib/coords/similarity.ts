/**
 * 유사도 v1 = 태그 자카드 + 같은 시리즈 보너스.
 * v2에서 코사인으로 갈아끼울 때도 이 시그니처는 그대로 둔다.
 */
import { SERIES_BONUS } from './constants.ts';
import { normalizeTags } from './hash.ts';
import type { PostInput } from './types.ts';

/** 정규화된 태그 집합의 자카드 계수. 한쪽이라도 태그가 없으면 0. */
export function tagJaccard(a: readonly string[], b: readonly string[]): number {
	const setA = new Set(normalizeTags(a));
	const setB = new Set(normalizeTags(b));
	if (setA.size === 0 || setB.size === 0) return 0;

	let intersection = 0;
	for (const tag of setA) {
		if (setB.has(tag)) intersection += 1;
	}
	const union = setA.size + setB.size - intersection;
	return intersection / union;
}

/** 같은 시리즈면 보너스를 더하고 1.0에서 자른다. */
export function similarity(a: PostInput, b: PostInput): number {
	let score = tagJaccard(a.tags, b.tags);
	if (a.series && b.series && a.series === b.series) {
		score += SERIES_BONUS;
	}
	return Math.min(1, score);
}
