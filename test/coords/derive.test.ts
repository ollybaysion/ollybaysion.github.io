import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { D_MAX } from '../../src/lib/coords/constants.ts';
import { constellations, groupByCategory, neighborsOf, orderSeries } from '../../src/lib/coords/derive.ts';
import type { PlacedEntry } from '../../src/lib/coords/derive.ts';
import { screenDistance } from '../../src/lib/coords/position.ts';

const entry = (
	slug: string,
	angle: number,
	radius: number,
	extra: Partial<PlacedEntry> = {},
): PlacedEntry => ({
	slug,
	category: '커피',
	date: '2026-01-01T00:00:00.000Z',
	angle,
	radius,
	...extra,
});

describe('neighborsOf', () => {
	const all = [
		entry('가운데', 270, 170),
		entry('바로-옆', 272, 170),
		entry('조금-멀리', 290, 170),
		entry('반대편', 90, 170),
	];

	it('자기 자신은 빼고 거리순으로 준다', () => {
		const found = neighborsOf(all[0]!, all);
		assert.deepEqual(
			found.map((n) => n.slug),
			['바로-옆', '조금-멀리', '반대편'],
		);
	});

	it('근접도는 거리에서 파생된다 (max(0, 1 - d/D_MAX))', () => {
		const [nearest] = neighborsOf(all[0]!, all);
		const d = screenDistance(all[0]!, all[1]!);
		assert.equal(nearest!.distance, d);
		assert.equal(nearest!.proximity, Math.max(0, 1 - d / D_MAX));
		assert.ok(nearest!.proximity > 0.9);
	});

	it('limit 만큼만 자른다', () => {
		assert.equal(neighborsOf(all[0]!, all, 2).length, 2);
	});

	it('거리가 같으면 슬러그로 갈라 빌드마다 순서가 같다', () => {
		const tied = [entry('기준', 270, 170), entry('나중', 272, 170), entry('먼저', 268, 170)];
		assert.deepEqual(
			neighborsOf(tied[0]!, tied).map((n) => n.slug),
			['나중', '먼저'],
		);
	});

	it('근방이 0편이어도 죽지 않는다', () => {
		assert.deepEqual(neighborsOf(all[0]!, [all[0]!]), []);
	});
});

describe('orderSeries', () => {
	it('episode를 적었으면 그 번호를 지킨다', () => {
		const members = [
			entry('2화', 260, 170, { date: '2026-02-01T00:00:00.000Z', episode: 2 }),
			entry('1화', 262, 170, { date: '2026-03-01T00:00:00.000Z', episode: 1 }),
		];
		assert.deepEqual(
			orderSeries(members).map((m) => [m.episode, m.slug]),
			[
				[1, '1화'],
				[2, '2화'],
			],
		);
	});

	it('episode를 생략하면 날짜순으로 매긴다', () => {
		const members = [
			entry('나중글', 260, 170, { date: '2026-03-01T00:00:00.000Z' }),
			entry('먼저글', 262, 170, { date: '2026-01-01T00:00:00.000Z' }),
		];
		assert.deepEqual(
			orderSeries(members).map((m) => [m.episode, m.slug]),
			[
				[1, '먼저글'],
				[2, '나중글'],
			],
		);
	});

	it('번호를 적은 글과 안 적은 글이 섞여도 빈 번호로 채운다', () => {
		const members = [
			entry('명시2', 260, 170, { date: '2026-01-01T00:00:00.000Z', episode: 2 }),
			entry('무번호a', 262, 170, { date: '2026-02-01T00:00:00.000Z' }),
			entry('무번호b', 264, 170, { date: '2026-03-01T00:00:00.000Z' }),
		];
		assert.deepEqual(
			orderSeries(members).map((m) => [m.episode, m.slug]),
			[
				[1, '무번호a'],
				[2, '명시2'],
				[3, '무번호b'],
			],
		);
	});

	it('같은 번호를 둘이 주장하면 이른 글이 갖고 나머지는 밀린다', () => {
		const members = [
			entry('먼저', 260, 170, { date: '2026-01-01T00:00:00.000Z', episode: 1 }),
			entry('나중', 262, 170, { date: '2026-02-01T00:00:00.000Z', episode: 1 }),
		];
		assert.deepEqual(
			orderSeries(members).map((m) => [m.episode, m.slug]),
			[
				[1, '먼저'],
				[2, '나중'],
			],
		);
	});

	it('멤버가 하나면 점 하나짜리 별자리', () => {
		const only = orderSeries([entry('외톨이', 260, 170, { episode: 1 })]);
		assert.equal(only.length, 1);
		assert.equal(only[0]!.episode, 1);
	});
});

describe('constellations', () => {
	it('시리즈가 없는 글은 빠진다', () => {
		const all = [
			entry('연재1', 260, 170, { series: '홈카페', episode: 1 }),
			entry('연재2', 262, 170, { series: '홈카페', episode: 2 }),
			entry('단독글', 300, 170),
		];
		const found = constellations(all);
		assert.deepEqual(Object.keys(found), ['홈카페']);
		assert.equal(found['홈카페']!.length, 2);
	});
});

describe('groupByCategory', () => {
	it('카테고리별로 최신순 슬러그를 준다', () => {
		const all = [
			entry('옛날-커피', 260, 170, { date: '2026-01-01T00:00:00.000Z' }),
			entry('최근-커피', 262, 170, { date: '2026-06-01T00:00:00.000Z' }),
			entry('개발글', 90, 170, { category: '개발' }),
		];
		assert.deepEqual(groupByCategory(all), {
			개발: ['개발글'],
			커피: ['최근-커피', '옛날-커피'],
		});
	});
});
