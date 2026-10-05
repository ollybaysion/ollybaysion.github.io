import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { placeAngle } from '../../src/lib/coords/angle.ts';
import { angularDistance, arcSpan, toLocal } from '../../src/lib/coords/arc.ts';
import { JITTER_DEG } from '../../src/lib/coords/constants.ts';
import type { Arc, PlacedPost, PostInput } from '../../src/lib/coords/types.ts';

const COFFEE: Arc = [210, 330];
const DEV: Arc = [30, 150];

const post = (slug: string, tags: string[] = [], series?: string): PostInput => ({ slug, tags, series });
const placed = (slug: string, tags: string[], angle: number, series?: string): PlacedPost => ({
	slug,
	tags,
	series,
	angle,
});

/** 각도가 호 안(경계 포함)에 있는지. */
function assertInArc(arc: Arc, angle: number, label = '') {
	const local = toLocal(arc, angle);
	assert.ok(local >= -1e-9 && local <= arcSpan(arc) + 1e-9, `${label} ${angle}° 가 호 ${arc[0]}~${arc[1]} 밖`);
}

describe('placeAngle — 닻이 없을 때', () => {
	it('첫 글은 호 가운데(±지터)에 앉는다', () => {
		const angle = placeAngle(post('첫-글', ['v60']), [], COFFEE);
		assert.ok(angularDistance(angle, 270) <= JITTER_DEG + 1e-9);
	});

	it('결정론이고, 슬러그가 다르면 지터로 갈린다', () => {
		const a = placeAngle(post('태그없는-글'), [], COFFEE);
		assert.equal(a, placeAngle(post('태그없는-글'), [], COFFEE));
		assert.notEqual(a, placeAngle(post('다른-글'), [], COFFEE));
	});
});

describe('placeAngle — 목표 간격', () => {
	it('똑같이 닮은 글이 하나면 그 옆(±지터)에 앉는다', () => {
		const ledger = [placed('닻', ['v60', '핸드드립'], 250)];
		const angle = placeAngle(post('새-글', ['v60', '핸드드립']), ledger, COFFEE);
		assert.ok(angularDistance(angle, 250) <= JITTER_DEG + 1e-9);
	});

	it('안 닮은 글에서는 멀리 떨어진다', () => {
		const ledger = [placed('닻', ['에스프레소'], 270)];
		const angle = placeAngle(post('새-글', ['v60']), ledger, COFFEE);
		assert.ok(angularDistance(angle, 270) >= 50, `${angle}°`);
		assertInArc(COFFEE, angle);
	});

	it('더 닮은 쪽으로 끌린다', () => {
		const ledger = [
			placed('가까운-글', ['v60', '핸드드립'], 240), // sim 2/3
			placed('먼-글', ['에스프레소', '머신'], 320), // sim 0
			placed('덜-가까운-글', ['핸드드립', '로스팅'], 300), // sim 1/3
		];
		const angle = placeAngle(post('새-글', ['v60', '핸드드립', '로스팅']), ledger, COFFEE);
		assert.ok(angularDistance(angle, 240) < angularDistance(angle, 300));
		assertInArc(COFFEE, angle);
	});

	it('같은 시리즈면 태그가 안 겹쳐도 더 가깝게 앉는다', () => {
		const series = placeAngle(post('2화', ['원두'], '홈카페 구축기'), [placed('1화', ['머신'], 240, '홈카페 구축기')], COFFEE);
		const stranger = placeAngle(post('2화', ['원두']), [placed('1화', ['머신'], 240)], COFFEE);
		assert.ok(angularDistance(series, 240) < angularDistance(stranger, 240));
	});

	it('주제가 셋이면 한 점으로 뭉치지 않고 호에 퍼진다', () => {
		const topics = [['v60', '핸드드립'], ['에스프레소', '머신'], ['로스팅', '생두']];
		const ledger: PlacedPost[] = [];
		for (let i = 0; i < 6; i += 1) {
			const tags = topics[i % 3]!;
			const angle = placeAngle(post(`글-${i}`, tags), ledger, COFFEE);
			ledger.push({ ...post(`글-${i}`, tags), angle });
		}
		const locals = ledger.map((entry) => toLocal(COFFEE, entry.angle));
		assert.ok(Math.max(...locals) - Math.min(...locals) >= 60, locals.join(', '));
	});

	it('닻 순서를 바꿔도 같은 각도가 나온다', () => {
		const ledger = [
			placed('a', ['v60'], 230),
			placed('b', ['v60', '로스팅'], 300),
			placed('c', ['로스팅'], 280),
		];
		const target = post('새-글', ['v60', '로스팅']);
		const forward = placeAngle(target, ledger, COFFEE);
		const backward = placeAngle(target, [...ledger].reverse(), COFFEE);
		assert.ok(Math.abs(forward - backward) < 1e-9);
	});

	it('자기 자신은 닻으로 세지 않는다(재계산해도 같은 자리)', () => {
		const target = post('새-글', ['v60']);
		const angle = placeAngle(target, [placed('닻', ['v60'], 250)], COFFEE);
		const again = placeAngle(target, [placed('닻', ['v60'], 250), placed('새-글', ['v60'], angle)], COFFEE);
		assert.equal(again, angle);
	});
});

describe('placeAngle — 클램프와 지터', () => {
	it('닻이 호 밖에 있어도 결과는 호 안', () => {
		const ledger = [placed('삐뚤어진-닻', ['v60'], 20), placed('또다른-닻', ['v60'], 190)];
		assertInArc(COFFEE, placeAngle(post('새-글', ['v60']), ledger, COFFEE));
	});

	it('부채꼴 경계에 몰려도 호 밖으로 새지 않는다', () => {
		const ledger = [placed('경계-닻', ['v60'], 210), placed('경계-닻2', ['v60'], 210)];
		const angle = placeAngle(post('새-글', ['v60']), ledger, COFFEE);
		assertInArc(COFFEE, angle);
		const far = placeAngle(post('새-글2', ['v60']), [placed('끝-닻', ['v60'], 330)], COFFEE);
		assertInArc(COFFEE, far);
	});

	it('같은 태그 셋 두 글은 지터로 갈린다', () => {
		const ledger = [placed('원조', ['v60', '핸드드립'], 260)];
		const a = placeAngle(post('쌍둥이-a', ['v60', '핸드드립']), ledger, COFFEE);
		const b = placeAngle(post('쌍둥이-b', ['v60', '핸드드립']), ledger, COFFEE);
		assert.notEqual(a, b);
		assert.ok(angularDistance(a, b) <= 2 * JITTER_DEG + 1e-9);
	});

	it('지터 폭은 ±JITTER_DEG를 넘지 않는다', () => {
		const ledger = [placed('닻', ['v60'], 270)];
		for (let i = 0; i < 200; i += 1) {
			const angle = placeAngle(post(`글-${i}`, ['v60']), ledger, COFFEE);
			assert.ok(angularDistance(angle, 270) <= JITTER_DEG + 1e-9, `글-${i} → ${angle}`);
		}
	});
});

describe('placeAngle — 불변식', () => {
	it('결정론 — 같은 입력이면 같은 각도', () => {
		const ledger = [placed('a', ['v60'], 230), placed('b', ['로스팅'], 300)];
		const target = post('새-글', ['v60', '로스팅']);
		assert.equal(placeAngle(target, ledger, COFFEE), placeAngle(target, ledger, COFFEE));
	});

	it('입력을 건드리지 않는다', () => {
		const ledger = Object.freeze([Object.freeze(placed('a', Object.freeze(['v60']) as string[], 230))]);
		const target = Object.freeze(post('새-글', Object.freeze(['v60']) as string[]));
		assert.doesNotThrow(() => placeAngle(target, ledger, COFFEE));
	});

	it('append-only — 글을 더 얹어도 앞선 글의 각도는 그대로', () => {
		const inputs = [
			post('글1', ['v60']),
			post('글2', ['v60', '로스팅']),
			post('글3', ['에스프레소']),
			post('글4', ['로스팅', '원두']),
			post('글5', ['v60', '원두']),
		];
		const ledger: PlacedPost[] = [];
		const firstPass: number[] = [];
		for (const p of inputs) {
			const angle = placeAngle(p, ledger, COFFEE);
			firstPass.push(angle);
			ledger.push({ ...p, angle });
		}
		// 같은 순서로 다시 돌려도 한 글도 자리가 바뀌지 않는다.
		const replayLedger: PlacedPost[] = [];
		inputs.forEach((p, i) => {
			const angle = placeAngle(p, replayLedger, COFFEE);
			assert.equal(angle, firstPass[i]);
			replayLedger.push({ ...p, angle });
		});
	});
});
