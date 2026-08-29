import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { BAND_YEARS, RADIUS_MAX, RADIUS_MIN, YEAR_MS } from '../../src/lib/coords/constants.ts';
import { placeRadius } from '../../src/lib/coords/radius.ts';

const EPOCH = new Date('2026-01-01T00:00:00Z');
const yearsAfter = (n: number) => new Date(EPOCH.getTime() + n * YEAR_MS);

describe('placeRadius', () => {
	it('epoch 글은 가장 안쪽 나이테', () => {
		assert.equal(placeRadius(EPOCH, EPOCH), RADIUS_MIN);
	});

	it('밴드 끝(5년 뒤)은 가장 바깥 나이테', () => {
		assert.equal(placeRadius(yearsAfter(BAND_YEARS), EPOCH), RADIUS_MAX);
	});

	it('밴드 중간은 선형으로 나온다', () => {
		const mid = placeRadius(yearsAfter(BAND_YEARS / 2), EPOCH);
		assert.ok(Math.abs(mid - (RADIUS_MIN + RADIUS_MAX) / 2) < 1e-9);
	});

	it('나중 글일수록 바깥', () => {
		assert.ok(placeRadius(yearsAfter(1), EPOCH) < placeRadius(yearsAfter(2), EPOCH));
	});

	it('epoch 밖 날짜는 클램프한다', () => {
		assert.equal(placeRadius(yearsAfter(-3), EPOCH), RADIUS_MIN);
		assert.equal(placeRadius(yearsAfter(50), EPOCH), RADIUS_MAX);
	});

	it('Date · ISO 문자열 · epoch ms 를 모두 같은 값으로 받는다', () => {
		const d = yearsAfter(2);
		assert.equal(placeRadius(d, EPOCH), placeRadius(d.toISOString(), EPOCH.toISOString()));
		assert.equal(placeRadius(d, EPOCH), placeRadius(d.getTime(), EPOCH.getTime()));
	});

	it('결정론 — 같은 입력이면 같은 값', () => {
		assert.equal(placeRadius(yearsAfter(1.234), EPOCH), placeRadius(yearsAfter(1.234), EPOCH));
	});

	it('날짜가 아니면 죽는다', () => {
		assert.throws(() => placeRadius('언젠가', EPOCH), /좌표를 매길 수 없는 날짜/);
	});
});
