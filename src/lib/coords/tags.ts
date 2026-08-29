/**
 * 태그 오타 감시(불변식 3).
 * 정규화로 접히지 않는 미세한 차이 — `에이전트` vs `에이전트들`, `llm` vs `llms` —
 * 는 서로 다른 태그가 되어 유사도를 조용히 갉아먹는다. 빌드가 경고만 하고 막지는 않는다.
 */
import { normalizeTag } from './hash.ts';

/**
 * 둘 중 긴 쪽이 이 길이 미만이면 넘긴다.
 * `v60` vs `v40`처럼 짧은 태그는 한 글자가 통째로 다른 말이라 오타로 볼 수 없다.
 * 반대로 `llm` vs `llms`, `로스팅` vs `로스팅기`는 여기 걸린다.
 */
const MIN_LENGTH = 4;

/** 레벤슈타인 거리. 태그는 짧아서 O(n·m)으로 충분하다. */
export function editDistance(a: string, b: string): number {
	if (a === b) return 0;
	const rowA = [...a];
	const rowB = [...b];
	let prev = Array.from({ length: rowB.length + 1 }, (_, i) => i);

	for (let i = 1; i <= rowA.length; i += 1) {
		const row = [i];
		for (let j = 1; j <= rowB.length; j += 1) {
			const cost = rowA[i - 1] === rowB[j - 1] ? 0 : 1;
			row[j] = Math.min(row[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
		}
		prev = row;
	}
	return prev[rowB.length]!;
}

/**
 * 새 태그와 헷갈릴 만한 기존 태그들. 편집거리 1 이내면 경고 대상.
 * 정규화 후 완전히 같은 태그는 애초에 같은 태그라 결과에 넣지 않는다.
 */
export function confusableTags(tag: string, known: Iterable<string>): string[] {
	const target = normalizeTag(tag);
	const targetLength = [...target].length;

	const hits: string[] = [];
	for (const candidate of known) {
		const other = normalizeTag(candidate);
		if (other === target) continue;
		if (Math.max(targetLength, [...other].length) < MIN_LENGTH) continue;
		if (editDistance(target, other) <= 1) hits.push(other);
	}
	return [...new Set(hits)].sort();
}
