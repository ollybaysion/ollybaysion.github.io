import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	DISCOVERY_FLOOR,
	VECTOR_CEIL,
	VECTOR_FLOOR,
} from '../../src/lib/coords/constants.ts';
import { cosine, rescale, vectorSimilarity } from '../../src/lib/coords/vector.ts';

describe('cosine', () => {
	it('같은 벡터는 1', () => {
		assert.equal(cosine([1, 0, 0], [1, 0, 0]), 1);
		assert.equal(cosine([0.6, 0.8], [0.6, 0.8]), 1);
	});

	it('직각은 0, 반대는 -1', () => {
		assert.equal(cosine([1, 0], [0, 1]), 0);
		assert.equal(cosine([1, 0], [-1, 0]), -1);
	});

	it('길이는 무시한다 — 방향만 본다', () => {
		assert.equal(cosine([3, 0], [7, 0]), 1);
	});

	it('길이가 다르거나 비었거나 영벡터면 0 (NaN 금지)', () => {
		assert.equal(cosine([1, 0], [1, 0, 0]), 0);
		assert.equal(cosine([], []), 0);
		assert.equal(cosine([0, 0], [1, 0]), 0);
	});
});

describe('rescale', () => {
	it('바닥 아래는 0, 천장 위는 1', () => {
		assert.equal(rescale(VECTOR_FLOOR), 0);
		assert.equal(rescale(VECTOR_FLOOR - 0.2), 0);
		assert.equal(rescale(VECTOR_CEIL), 1);
		assert.equal(rescale(1), 1);
	});

	it('가운데는 절반', () => {
		assert.ok(Math.abs(rescale((VECTOR_FLOOR + VECTOR_CEIL) / 2) - 0.5) < 1e-12);
	});

	it('바닥 < 천장이어야 눈금이 성립한다', () => {
		assert.ok(VECTOR_FLOOR < VECTOR_CEIL);
	});
});

/**
 * 눈금 계약 — 상수를 고른 근거를 코드 안에 붙잡아 둔다.
 *
 * 2026-08-30에 한국어 글 아홉 편을 bge-m3(cls·q8)에 넣고 잰 원시 코사인이다.
 * "닮음/안 닮음"은 사람이 미리 표시한 것. 모델을 부르지 않으므로 CI에서도 돈다 —
 * 여기서 지키는 건 모델의 출력이 아니라 **바닥·천장이 이 표를 가르느냐**다.
 */
const MEASURED: readonly [string, string, '닮음' | '안 닮음', number][] = [
	['coffee-yirga', 'coffee-tamping', '닮음', 0.48],
	['coffee-tamping', 'coffee-grinder', '닮음', 0.523],
	['coffee-yirga', 'coffee-grinder', '닮음', 0.51],
	['dev-coords', 'dev-astro', '닮음', 0.484],
	['dev-coords', 'dev-canvas', '닮음', 0.481],
	['dev-astro', 'dev-canvas', '닮음', 0.462],
	['bridge-auto', 'coffee-tamping', '닮음', 0.669],
	['coffee-yirga', 'dev-astro', '안 닮음', 0.31],
	['coffee-grinder', 'dev-canvas', '안 닮음', 0.431],
	['coffee-yirga', 'far-movie', '안 닮음', 0.405],
	['dev-astro', 'far-travel', '안 닮음', 0.35],
	['far-movie', 'far-travel', '안 닮음', 0.43],
	['coffee-tamping', 'far-travel', '안 닮음', 0.381],
	['dev-canvas', 'far-movie', '안 닮음', 0.421],
	['coffee-grinder', 'dev-coords', '안 닮음', 0.405],
];

describe('눈금 계약 (2026-08-30 측정)', () => {
	it('안 닮은 쌍은 전부 0으로 눌린다', () => {
		for (const [a, b, label, cos] of MEASURED) {
			if (label !== '안 닮음') continue;
			assert.equal(rescale(cos), 0, `${a} ↔ ${b} (${cos})`);
		}
	});

	it('닮은 쌍은 전부 0보다 크다', () => {
		for (const [a, b, label, cos] of MEASURED) {
			if (label !== '닮음') continue;
			assert.ok(rescale(cos) > 0, `${a} ↔ ${b} (${cos})`);
		}
	});

	it('바닥이 두 무리 사이의 빈 구간에 있다', () => {
		const near = MEASURED.filter(([, , label]) => label === '닮음').map(([, , , cos]) => cos);
		const far = MEASURED.filter(([, , label]) => label === '안 닮음').map(([, , , cos]) => cos);
		assert.ok(Math.max(...far) < VECTOR_FLOOR, `안 닮은 쌍 최고 ${Math.max(...far)}`);
		assert.ok(VECTOR_FLOOR < Math.min(...near), `닮은 쌍 최저 ${Math.min(...near)}`);
	});

	it('발견 문턱은 카테고리를 넘나드는 글 하나만 통과시킨다', () => {
		const crossing = MEASURED.filter(([, , , cos]) => rescale(cos) >= DISCOVERY_FLOOR);
		assert.deepEqual(
			crossing.map(([a, b]) => `${a}↔${b}`),
			['bridge-auto↔coffee-tamping'],
		);
	});
});

describe('vectorSimilarity', () => {
	it('코사인을 재고 눈금에 맞춰 편다', () => {
		const mid = (VECTOR_FLOOR + VECTOR_CEIL) / 2;
		assert.equal(vectorSimilarity([1, 0], [1, 0]), 1);
		assert.equal(vectorSimilarity([1, 0], [0, 1]), 0);
		assert.ok(Math.abs(vectorSimilarity([1, 0], [mid, Math.sqrt(1 - mid * mid)]) - 0.5) < 1e-12);
	});

	it('반대 방향도 0에서 멈춘다 (음수 금지)', () => {
		assert.equal(vectorSimilarity([1, 0], [-1, 0]), 0);
	});

	it('자릿수를 줄여 저장해도 값이 흔들리지 않는다', () => {
		const round = (v: number[]) => v.map((x) => Math.round(x * 1e6) / 1e6);
		const a = Array.from({ length: 64 }, (_, i) => Math.cos(i));
		const b = Array.from({ length: 64 }, (_, i) => Math.cos(i + 0.7));
		const norm = (v: number[]) => {
			const len = Math.hypot(...v);
			return v.map((x) => x / len);
		};
		const exact = vectorSimilarity(norm(a), norm(b));
		const stored = vectorSimilarity(round(norm(a)), round(norm(b)));
		assert.ok(Math.abs(exact - stored) < 1e-5, `${exact} vs ${stored}`);
	});
});
