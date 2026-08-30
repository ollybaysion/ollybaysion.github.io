/**
 * 무대가 함께 쓰는 잡음 — 바다도 배롱나무도 여기서 흔들린다.
 *
 * 원래 `sea.ts` 안에 있던 것을 꺼냈다. 바람에 흔들리는 것이 둘이 되면서
 * 각자 제 잡음을 들면 같은 하늘에서 다른 리듬이 나온다.
 */

export function clamp01(v: number): number {
	return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function hash(n: number): number {
	const x = Math.sin(n * 127.1) * 43758.5453;
	return x - Math.floor(x);
}

export function noise1(x: number): number {
	const i = Math.floor(x);
	const f = x - i;
	const u = f * f * (3 - 2 * f);
	return hash(i) + (hash(i + 1) - hash(i)) * u;
}

/** 결정적 난수 — 새로고침마다 배치가 흔들리면 다른 그림이 된다. */
export function rng(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 4294967296;
	};
}
