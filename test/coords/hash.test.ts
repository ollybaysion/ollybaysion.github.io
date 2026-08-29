import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { hash01, normalizeTag, normalizeTags } from '../../src/lib/coords/hash.ts';

describe('normalizeTag', () => {
	it('NFC + trim + lowercase 를 통과시킨다', () => {
		assert.equal(normalizeTag('  Astro  '), 'astro');
		assert.equal(normalizeTag('COFFEE'), 'coffee');
	});

	it('자모 분리(NFD) 한글을 NFC로 합쳐 같은 태그로 본다', () => {
		const nfd = '커피'.normalize('NFD');
		assert.notEqual(nfd, '커피');
		assert.equal(normalizeTag(nfd), '커피');
		assert.equal(hash01(normalizeTag(nfd)), hash01(normalizeTag('커피')));
	});
});

describe('normalizeTags', () => {
	it('빈 태그를 버리고 중복을 입력 순서대로 접는다', () => {
		assert.deepEqual(normalizeTags([' Astro', 'astro', '', '   ', 'MDX']), ['astro', 'mdx']);
	});
});

describe('hash01', () => {
	it('[0, 1) 안에 떨어진다', () => {
		for (const s of ['', 'a', '커피', 'astro', '2026-08-29-어떤-글', '🙂']) {
			const h = hash01(s);
			assert.ok(h >= 0 && h < 1, `${s} → ${h}`);
		}
	});

	it('결정론 — 같은 입력이면 같은 값', () => {
		assert.equal(hash01('커피 그라인더'), hash01('커피 그라인더'));
	});

	it('FNV-1a 알려진 값과 맞는다', () => {
		// FNV-1a 32bit: "" → 0x811c9dc5, "a" → 0xe40c292c
		assert.equal(hash01(''), 0x811c9dc5 / 0x1_0000_0000);
		assert.equal(hash01('a'), 0xe40c292c / 0x1_0000_0000);
	});

	it('다른 입력은 다른 값으로 흩어진다', () => {
		const inputs = ['astro', 'mdx', '커피', '개발', 'v60', '에스프레소', '에이전트'];
		const values = new Set(inputs.map(hash01));
		assert.equal(values.size, inputs.length);
	});
});
