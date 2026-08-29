import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { angularDistance, arcAngleAt, arcSpan, clampToArc, norm360, toLocal } from '../../src/lib/coords/arc.ts';
import type { Arc } from '../../src/lib/coords/types.ts';

const COFFEE: Arc = [210, 330];
const WRAPPING: Arc = [330, 30];

describe('norm360', () => {
	it('[0, 360)으로 접는다', () => {
		assert.equal(norm360(0), 0);
		assert.equal(norm360(360), 0);
		assert.equal(norm360(-30), 330);
		assert.equal(norm360(725), 5);
	});
});

describe('arcSpan', () => {
	it('등록된 호는 120°', () => {
		assert.equal(arcSpan(COFFEE), 120);
		assert.equal(arcSpan([30, 150]), 120);
	});

	it('랩하는 빈 호도 폭이 나온다', () => {
		assert.equal(arcSpan(WRAPPING), 60);
		assert.equal(arcSpan([150, 210]), 60);
	});
});

describe('arcAngleAt', () => {
	it('t=0은 시작, t=1은 끝', () => {
		assert.equal(arcAngleAt(COFFEE, 0), 210);
		assert.equal(arcAngleAt(COFFEE, 1), 330);
		assert.equal(arcAngleAt(COFFEE, 0.5), 270);
	});

	it('랩하는 호에서도 호 안에 떨어진다', () => {
		assert.equal(arcAngleAt(WRAPPING, 0.5), 0);
		assert.equal(arcAngleAt(WRAPPING, 1), 30);
	});
});

describe('clampToArc', () => {
	it('호 안 각도는 그대로', () => {
		assert.equal(clampToArc(COFFEE, 250), 250);
	});

	it('호 밖은 가까운 끝으로 접는다', () => {
		assert.equal(clampToArc(COFFEE, 200), 210);
		assert.equal(clampToArc(COFFEE, 340), 330);
		assert.equal(clampToArc(COFFEE, 20), 330); // 20°는 끝(330)이 더 가깝다
		assert.equal(clampToArc(COFFEE, 120), 210); // 120°는 시작(210)이 더 가깝다
		assert.equal(clampToArc(COFFEE, 90), 210); // 정확히 반대편(양쪽 120°)은 시작으로 고정
	});

	it('inset을 주면 그만큼 안쪽으로 가둔다', () => {
		assert.equal(clampToArc(COFFEE, 200, 1), 211);
		assert.equal(clampToArc(COFFEE, 340, 1), 329);
	});

	it('랩하는 호도 가둔다', () => {
		assert.equal(toLocal(WRAPPING, clampToArc(WRAPPING, 200)) <= arcSpan(WRAPPING), true);
		assert.equal(clampToArc(WRAPPING, 10), 10);
	});
});

describe('angularDistance', () => {
	it('최단 각거리(0..180)', () => {
		assert.equal(angularDistance(10, 350), 20);
		assert.equal(angularDistance(0, 180), 180);
		assert.equal(angularDistance(90, 90), 0);
	});
});
