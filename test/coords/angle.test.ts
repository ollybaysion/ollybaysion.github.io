import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { placeAngle, tagAngle } from '../../src/lib/coords/angle.ts';
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

describe('tagAngle', () => {
	it('항상 호 안에 떨어진다', () => {
		for (const tag of ['v60', '에스프레소', 'astro', 'mdx', '에이전트', '', '  ']) {
			assertInArc(COFFEE, tagAngle(tag, COFFEE), tag);
			assertInArc(DEV, tagAngle(tag, DEV), tag);
		}
	});

	it('정규화 차이는 같은 각도로 접힌다', () => {
		assert.equal(tagAngle(' Astro ', DEV), tagAngle('astro', DEV));
		assert.equal(tagAngle('커피'.normalize('NFD'), COFFEE), tagAngle('커피', COFFEE));
	});

	it('결정론', () => {
		assert.equal(tagAngle('v60', COFFEE), tagAngle('v60', COFFEE));
	});
});

describe('placeAngle — 폴백 경로', () => {
	it('첫 글(원장이 비었을 때)도 호 안에 앉는다', () => {
		const angle = placeAngle(post('첫-글', ['v60']), [], COFFEE);
		assertInArc(COFFEE, angle);
	});

	it('태그가 0개면 슬러그 해시로 앉는다', () => {
		const a = placeAngle(post('태그없는-글'), [], COFFEE);
		const b = placeAngle(post('태그없는-글'), [], COFFEE);
		assertInArc(COFFEE, a);
		assert.equal(a, b);
		assert.notEqual(a, placeAngle(post('다른-글'), [], COFFEE));
	});

	it('유사 글이 0개면 닻이 있어도 태그 해시 폴백을 탄다', () => {
		const ledger = [placed('전혀-다른-글', ['에스프레소'], 240)];
		const alone = placeAngle(post('새-글', ['v60']), [], COFFEE);
		assert.equal(placeAngle(post('새-글', ['v60']), ledger, COFFEE), alone);
	});

	it('폴백 각도는 태그 각도들의 평균 근처(±지터)에 앉는다', () => {
		const tags = ['v60', '에스프레소'];
		const mean = (toLocal(COFFEE, tagAngle(tags[0]!, COFFEE)) + toLocal(COFFEE, tagAngle(tags[1]!, COFFEE))) / 2;
		const angle = placeAngle(post('평균-글', tags), [], COFFEE);
		assert.ok(Math.abs(toLocal(COFFEE, angle) - mean) <= JITTER_DEG + 1e-9);
	});
});

describe('placeAngle — 유사도 가중 평균', () => {
	it('유사한 글이 하나면 그 옆(±지터)에 앉는다', () => {
		const ledger = [placed('닻', ['v60', '핸드드립'], 250)];
		const angle = placeAngle(post('새-글', ['v60', '핸드드립']), ledger, COFFEE);
		assert.ok(angularDistance(angle, 250) <= JITTER_DEG + 1e-9);
	});

	it('더 닮은 쪽으로 끌린다', () => {
		const ledger = [
			placed('가까운-글', ['v60', '핸드드립'], 240), // sim 2/3
			placed('먼-글', ['에스프레소', '머신'], 320), // sim 0 → 무시
			placed('덜-가까운-글', ['핸드드립', '로스팅'], 300), // sim 1/3
		];
		const angle = placeAngle(post('새-글', ['v60', '핸드드립', '로스팅']), ledger, COFFEE);
		assert.ok(angularDistance(angle, 240) < angularDistance(angle, 300));
		assertInArc(COFFEE, angle);
	});

	it('같은 시리즈면 태그가 안 겹쳐도 끌어온다', () => {
		const ledger = [placed('1화', ['머신'], 260, '홈카페 구축기')];
		const angle = placeAngle(post('2화', ['원두'], '홈카페 구축기'), ledger, COFFEE);
		assert.ok(angularDistance(angle, 260) <= JITTER_DEG + 1e-9);
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
