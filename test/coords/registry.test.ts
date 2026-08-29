/** 카테고리 등록부가 설계 계약을 지키는지. 호가 겹치면 각도의 의미가 무너진다. */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CATEGORY_NAMES, arcOf, categories, categoryOf, colorOf, isCategory } from '../../src/config/categories.ts';
import { arcSpan, norm360 } from '../../src/lib/coords/arc.ts';

const HEX = /^#[0-9a-f]{6}$/;

describe('categories.json', () => {
	it('커피·개발 두 종이 등록돼 있다', () => {
		assert.deepEqual(CATEGORY_NAMES, ['커피', '개발']);
		assert.deepEqual(arcOf('커피'), [210, 330]);
		assert.deepEqual(arcOf('개발'), [30, 150]);
	});

	it('모든 호가 [0, 360) 안의 유효한 부채꼴이다', () => {
		for (const name of CATEGORY_NAMES) {
			const [start, end] = arcOf(name);
			assert.equal(norm360(start), start, `${name} 시작각`);
			assert.equal(norm360(end), end, `${name} 끝각`);
			const span = arcSpan(arcOf(name));
			assert.ok(span > 0 && span <= 120, `${name} 폭 ${span}° — 호는 120°를 넘지 않는다`);
		}
	});

	it('호끼리 겹치지 않는다', () => {
		const occupied = new Set<number>();
		for (const name of CATEGORY_NAMES) {
			const [start] = arcOf(name);
			const span = arcSpan(arcOf(name));
			for (let d = 0; d < span; d += 1) {
				const deg = norm360(start + d);
				assert.ok(!occupied.has(deg), `${deg}° 가 두 카테고리에 걸쳐 있다`);
				occupied.add(deg);
			}
		}
	});

	it('빈 호 150~210° · 330~30° 는 새 카테고리용으로 비어 있다', () => {
		const claimed = new Set<number>();
		for (const name of CATEGORY_NAMES) {
			const [start] = arcOf(name);
			for (let d = 0; d < arcSpan(arcOf(name)); d += 1) claimed.add(norm360(start + d));
		}
		for (const deg of [150, 180, 209, 330, 0, 29]) {
			assert.ok(!claimed.has(deg), `${deg}° 는 비어 있어야 한다`);
		}
	});

	it('색은 base·deep 두 벌이 hex로 들어 있다', () => {
		for (const name of CATEGORY_NAMES) {
			const color = colorOf(name);
			assert.match(color.base, HEX, `${name} base`);
			assert.match(color.deep, HEX, `${name} deep`);
		}
	});

	it('정본 색을 그대로 쓴다', () => {
		// Main.dc.html 의 각도→색 보간: 270°(커피) rgb(217,161,84), 90°(개발) rgb(91,141,239)
		assert.equal(colorOf('커피').base, '#d9a154');
		assert.equal(colorOf('개발').base, '#5b8def');
	});

	it('미등록 카테고리는 죽는다', () => {
		assert.equal(isCategory('커피'), true);
		assert.equal(isCategory('요리'), false);
		assert.throws(() => categoryOf('요리'), /등록되지 않은 카테고리/);
	});

	it('프로토타입 오염된 이름을 카테고리로 인정하지 않는다', () => {
		assert.equal(isCategory('constructor'), false);
		assert.equal(isCategory('toString'), false);
	});

	it('등록부 키와 CATEGORY_NAMES가 같다', () => {
		assert.deepEqual(Object.keys(categories), CATEGORY_NAMES);
	});
});
