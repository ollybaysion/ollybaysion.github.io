/**
 * 각도 = 주제.
 * 부채꼴은 카테고리가 소유하고, 그 안 세부 각도는 발행 시점에 기존 글들과의
 * 유사도로 정해진 뒤 영구 고정된다(불변식 1).
 *
 * v1은 유사도 가중 평균이었다. 평균은 기존 각도 범위 밖으로 못 나가서 카테고리 글이
 * 첫 글 자리 한 점으로 뭉쳤다(개발 글 10편이 120° 호의 1.6° 안). v2는 닮은 글엔 가깝게,
 * 안 닮은 글엔 멀게 — 글마다 "이만큼 떨어져야 한다"는 목표 간격을 두고 가장 잘 맞는 자리를 찾는다.
 */
import { arcSpan, clampLocal, toAbsolute, toLocal } from './arc.ts';
import { ANGLE_SPREAD, ANGLE_STEP, JITTER_DEG } from './constants.ts';
import { hash01 } from './hash.ts';
import { similarity } from './similarity.ts';
import type { Arc, PlacedPost, PostInput } from './types.ts';

/**
 * 새 글의 각도를 정한다.
 *
 * 1. 닻(같은 카테고리의 이미 배치된 글)마다 목표 간격 = 호 폭 × ANGLE_SPREAD × (1 − sim).
 * 2. 호 안을 ANGLE_STEP 간격으로 훑어 Σ(실제 간격 − 목표 간격)² 가 가장 작은 자리를 고른다.
 *    값이 같으면 호 가운데에 더 가까운 자리 — 양쪽에 다음 글이 앉을 자리가 남는다.
 * 3. 닻이 없으면 호 가운데.
 * 4. 슬러그 해시 지터 ±JITTER_DEG를 얹는다. 훑는 구간을 지터 폭만큼 안쪽으로 잡아 호 밖으로 새지 않는다.
 *
 * @param ledger 같은 카테고리의 이미 배치된 글들. 순서는 결과에 영향을 주지 않는다.
 */
export function placeAngle(post: PostInput, ledger: readonly PlacedPost[], arc: Arc): number {
	const span = arcSpan(arc);
	const lo = Math.min(JITTER_DEG, span / 2);
	const hi = Math.max(span - JITTER_DEG, span / 2);
	const center = span / 2;

	const targets = ledger
		.filter((anchor) => anchor.slug !== post.slug)
		.map((anchor) => ({
			at: clampLocal(arc, toLocal(arc, anchor.angle), JITTER_DEG),
			gap: span * ANGLE_SPREAD * (1 - similarity(post, anchor)),
		}));

	let base = center;
	if (targets.length > 0) {
		let best = Infinity;
		const steps = Math.round((hi - lo) / ANGLE_STEP);
		for (let i = 0; i <= steps; i += 1) {
			const at = lo + (i * (hi - lo)) / steps;
			let cost = 0;
			for (const target of targets) {
				const miss = Math.abs(at - target.at) - target.gap;
				cost += miss * miss;
			}
			const tie = Math.abs(cost - best) <= 1e-9;
			if (cost < best - 1e-9 || (tie && Math.abs(at - center) < Math.abs(base - center))) {
				best = Math.min(best, cost);
				base = at;
			}
		}
	}

	const jitter = (hash01(post.slug) * 2 - 1) * JITTER_DEG;
	return toAbsolute(arc, base + jitter);
}
