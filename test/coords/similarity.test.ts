import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SERIES_BONUS, VECTOR_CEIL, VECTOR_FLOOR } from '../../src/lib/coords/constants.ts';
import { contentSimilarity, similarity, tagJaccard } from '../../src/lib/coords/similarity.ts';

const post = (slug: string, tags: string[], series?: string) => ({ slug, tags, series });

/** 코사인이 정확히 `cos`가 되는 2차원 짝. 눈금을 확인할 때 쓴다. */
const pair = (cos: number) => [
	[1, 0] as number[],
	[cos, Math.sqrt(1 - cos * cos)] as number[],
];
const [UNIT, AT_CEIL] = pair(VECTOR_CEIL);
/** 바닥보다 확실히 아래 — 부동소수점 끝자리에 걸리지 않게 여유를 둔다. */
const [, BELOW_FLOOR] = pair(VECTOR_FLOOR - 0.05);

describe('tagJaccard', () => {
	it('교집합/합집합', () => {
		assert.equal(tagJaccard(['a', 'b'], ['a', 'b']), 1);
		assert.equal(tagJaccard(['a', 'b'], ['b', 'c']), 1 / 3);
		assert.equal(tagJaccard(['a'], ['b']), 0);
	});

	it('정규화 후 비교한다', () => {
		assert.equal(tagJaccard([' Astro '], ['astro']), 1);
		assert.equal(tagJaccard(['커피'.normalize('NFD')], ['커피']), 1);
	});

	it('태그 0개면 0 (NaN 금지)', () => {
		assert.equal(tagJaccard([], []), 0);
		assert.equal(tagJaccard([], ['a']), 0);
	});
});

describe('similarity', () => {
	it('같은 시리즈면 보너스를 더한다', () => {
		const a = post('a', ['x'], '나의 연재');
		const b = post('b', ['y'], '나의 연재');
		assert.equal(similarity(a, b), SERIES_BONUS);
	});

	it('보너스를 더해도 1.0을 넘지 않는다', () => {
		const a = post('a', ['x', 'y'], '연재');
		const b = post('b', ['x', 'y'], '연재');
		assert.equal(similarity(a, b), 1);
	});

	it('시리즈가 다르면 보너스 없음', () => {
		const a = post('a', ['x'], '연재 A');
		const b = post('b', ['x'], '연재 B');
		assert.equal(similarity(a, b), 1);
		const c = post('c', ['x', 'z'], '연재 A');
		const d = post('d', ['x', 'w'], '연재 B');
		assert.equal(similarity(c, d), 1 / 3);
	});

	it('대칭이다', () => {
		const a = post('a', ['x', 'y'], '연재');
		const b = post('b', ['y', 'z']);
		assert.equal(similarity(a, b), similarity(b, a));
	});
});

describe('similarity v2 — 벡터가 있으면 코사인으로 잰다', () => {
	it('벡터가 둘 다 있으면 태그를 보지 않는다', () => {
		const a = { slug: 'a', tags: ['커피'], vector: UNIT };
		const b = { slug: 'b', tags: ['개발'], vector: AT_CEIL };
		// 태그 자카드였다면 0이다.
		assert.equal(similarity(a, b), 1);
	});

	it('태그가 하나도 없어도 벡터로는 재진다 (v1이 0을 주던 자리)', () => {
		const a = { slug: 'a', tags: [], vector: UNIT };
		const b = { slug: 'b', tags: [], vector: AT_CEIL };
		assert.equal(tagJaccard(a.tags, b.tags), 0);
		assert.equal(similarity(a, b), 1);
	});

	it('한쪽에 벡터가 없으면 태그 자카드로 물러선다', () => {
		const a = { slug: 'a', tags: ['커피', '추출'], vector: UNIT };
		const b = { slug: 'b', tags: ['커피', '추출'] };
		assert.equal(similarity(a, b), 1);
		assert.equal(similarity({ ...a, tags: ['커피'] }, { ...b, tags: ['개발'] }), 0);
	});

	it('바닥 아래 코사인은 0 — 아무거나 다 닮은 셈이 되지 않는다', () => {
		const a = { slug: 'a', tags: ['커피'], vector: UNIT };
		const b = { slug: 'b', tags: ['개발'], vector: BELOW_FLOOR };
		assert.equal(similarity(a, b), 0);
	});

	it('시리즈 보너스는 벡터 위에도 그대로 얹힌다', () => {
		const a = { slug: 'a', tags: [], series: '연재', vector: UNIT };
		const b = { slug: 'b', tags: [], series: '연재', vector: BELOW_FLOOR };
		assert.equal(similarity(a, b), SERIES_BONUS);
	});

	it('시그니처는 v1 그대로 — 벡터 없는 호출이 옛 결과를 낸다', () => {
		const a = post('a', ['x', 'y']);
		const b = post('b', ['y', 'z']);
		assert.equal(similarity(a, b), 1 / 3);
	});
});

describe('contentSimilarity', () => {
	it('시리즈 보너스를 빼고 내용만 본다', () => {
		const a = { slug: 'a', tags: ['x'], series: '연재' };
		const b = { slug: 'b', tags: ['y'], series: '연재' };
		assert.equal(contentSimilarity(a, b), 0);
		assert.equal(similarity(a, b), SERIES_BONUS);
	});
});
