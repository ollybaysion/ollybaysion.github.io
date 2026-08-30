/**
 * 벡터 유사도 — v2의 자.
 *
 * 모델이 뱉는 원시 코사인은 [0,1]로 쓸 수 없다. 한국어 산문끼리는 아무 상관이 없어도
 * 0.7 언저리에서 시작하기 때문이다(`VECTOR_FLOOR` 주석의 측정 참고). 그래서 바닥과
 * 천장 사이를 [0,1]로 다시 편다 — 안 닮은 글은 0, 사실상 같은 글은 1.
 */
import { VECTOR_CEIL, VECTOR_FLOOR } from './constants.ts';

/**
 * 두 벡터의 코사인.
 *
 * 모델이 정규화해서 뱉으므로 내적이 곧 코사인이다. 그래도 길이를 나눠 준다 —
 * 원장에 저장할 때 자릿수를 줄이면 노름이 1에서 아주 조금 어긋나기 때문이다.
 * 길이가 다르거나 영벡터면 0(모름 = 안 닮음).
 */
export function cosine(a: readonly number[], b: readonly number[]): number {
	if (a.length === 0 || a.length !== b.length) return 0;

	let dot = 0;
	let na = 0;
	let nb = 0;
	for (let i = 0; i < a.length; i += 1) {
		dot += a[i]! * b[i]!;
		na += a[i]! * a[i]!;
		nb += b[i]! * b[i]!;
	}
	if (na === 0 || nb === 0) return 0;
	return dot / Math.sqrt(na * nb);
}

/** 원시 코사인 → 유사도 [0,1]. 바닥 아래는 0, 천장 위는 1. */
export function rescale(cos: number): number {
	const t = (cos - VECTOR_FLOOR) / (VECTOR_CEIL - VECTOR_FLOOR);
	return Math.min(1, Math.max(0, t));
}

/** 두 글의 벡터 유사도. `tagJaccard`와 같은 눈금([0,1])으로 나온다. */
export function vectorSimilarity(a: readonly number[], b: readonly number[]): number {
	return rescale(cosine(a, b));
}
