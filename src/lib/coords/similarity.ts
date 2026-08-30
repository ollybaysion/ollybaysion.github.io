/**
 * 유사도 v2 = 임베딩 코사인 + 같은 시리즈 보너스.
 *
 * v1은 태그 자카드였다. 시그니처는 그대로 두고 재는 자만 갈았다 — 벡터가 있으면
 * 코사인, 없으면 자카드로 물러선다. 벡터가 아직 안 박힌 글도 좌표는 받아야 하고,
 * 태그가 없는 글도 벡터로는 재진다(v1이 0을 주던 자리다).
 */
import { SERIES_BONUS } from './constants.ts';
import { normalizeTags } from './hash.ts';
import type { PostInput } from './types.ts';
import { vectorSimilarity } from './vector.ts';

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

/**
 * 글 내용만 본 닮은 정도 [0,1]. 시리즈 보너스는 빠져 있다 —
 * 발견 레이어는 "같은 시리즈니까"가 아니라 "글이 닮아서" 잇는 자리라 이쪽을 본다.
 */
export function contentSimilarity(a: PostInput, b: PostInput): number {
	return a.vector && b.vector ? vectorSimilarity(a.vector, b.vector) : tagJaccard(a.tags, b.tags);
}

/** 같은 시리즈면 보너스를 더하고 1.0에서 자른다. */
export function similarity(a: PostInput, b: PostInput): number {
	let score = contentSimilarity(a, b);
	if (a.series && b.series && a.series === b.series) {
		score += SERIES_BONUS;
	}
	return Math.min(1, score);
}
