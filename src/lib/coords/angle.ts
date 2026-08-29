/**
 * 각도 = 주제.
 * 부채꼴은 카테고리가 소유하고, 그 안 세부 각도는 발행 시점에 기존 글들과의
 * 유사도 가중 평균으로 정해진 뒤 영구 고정된다(불변식 1).
 */
import { arcAngleAt, arcSpan, clampLocal, toAbsolute, toLocal } from './arc.ts';
import { JITTER_DEG } from './constants.ts';
import { hash01, normalizeTag, normalizeTags } from './hash.ts';
import { similarity } from './similarity.ts';
import type { Arc, PlacedPost, PostInput } from './types.ts';

/** 태그 하나가 호 안에서 가리키는 각도. 정규화 → FNV-1a → 호 위 비율. */
export function tagAngle(tag: string, arc: Arc): number {
	return arcAngleAt(arc, hash01(normalizeTag(tag)));
}

/** 닻이 하나도 없을 때의 폴백: 태그 각도들의 평균, 태그가 없으면 슬러그 해시. */
function fallbackLocal(post: PostInput, arc: Arc): number {
	const tags = normalizeTags(post.tags);
	if (tags.length === 0) return arcSpan(arc) * hash01(post.slug);

	let sum = 0;
	for (const tag of tags) {
		sum += toLocal(arc, tagAngle(tag, arc));
	}
	return sum / tags.length;
}

/**
 * 새 글의 각도를 정한다.
 *
 * 1. 같은 카테고리의 이미 배치된 글들과 유사도를 재고, sim > 0인 글들의 각도를
 *    sim 가중 평균한다(호 ≤120°라 호 로컬 선형 평균으로 충분).
 * 2. 전부 sim 0이면 태그 해시 평균으로 폴백한다(태그 0개면 슬러그 해시).
 * 3. 호 안으로 클램프한 뒤 슬러그 해시 지터 ±JITTER_DEG를 얹는다.
 *    지터가 호 밖으로 새지 않도록 클램프 구간을 지터 폭만큼 안쪽으로 잡는다.
 *
 * @param ledger 같은 카테고리의 이미 배치된 글들. 순서는 결과에 영향을 주지 않는다.
 */
export function placeAngle(post: PostInput, ledger: readonly PlacedPost[], arc: Arc): number {
	let weightSum = 0;
	let weighted = 0;
	for (const anchor of ledger) {
		if (anchor.slug === post.slug) continue;
		const sim = similarity(post, anchor);
		if (sim <= 0) continue;
		weightSum += sim;
		weighted += sim * clampLocal(arc, toLocal(arc, anchor.angle));
	}

	const base = weightSum > 0 ? weighted / weightSum : fallbackLocal(post, arc);
	const clamped = clampLocal(arc, base, JITTER_DEG);
	const jitter = (hash01(post.slug) * 2 - 1) * JITTER_DEG;
	return toAbsolute(arc, clamped + jitter);
}
