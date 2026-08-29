import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { SERIES_BONUS } from '../../src/lib/coords/constants.ts';
import { similarity, tagJaccard } from '../../src/lib/coords/similarity.ts';

const post = (slug: string, tags: string[], series?: string) => ({ slug, tags, series });

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
