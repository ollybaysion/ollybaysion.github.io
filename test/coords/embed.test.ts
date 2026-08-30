import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { embedInput, plainText } from '../../src/lib/coords/embed.ts';
import { fingerprint } from '../../src/lib/coords/hash.ts';

describe('plainText', () => {
	it('코드 블록과 인라인 코드를 걷어낸다', () => {
		assert.equal(plainText('앞\n\n```js\nconst x = 1;\n```\n\n뒤'), '앞\n\n \n\n뒤');
		assert.equal(plainText('`npm run dev`로 띄운다'), 'npm run dev로 띄운다');
	});

	it('링크는 글자만 남기고 주소를 버린다', () => {
		assert.equal(plainText('[아스트로](https://astro.build) 문서'), '아스트로 문서');
		assert.equal(plainText('![사진](/a.png) 뒤'), '뒤');
	});

	it('제목·인용·목록 기호와 강조를 벗긴다', () => {
		assert.equal(plainText('## 제목'), '제목');
		assert.equal(plainText('> 인용'), '인용');
		assert.equal(plainText('- 하나\n- 둘'), '하나\n둘');
		assert.equal(plainText('1. 하나'), '하나');
		assert.equal(plainText('**진하게** _기울임_'), '진하게 기울임');
	});

	it('HTML 태그를 지운다', () => {
		assert.equal(plainText('<div class="x">안</div>'), '안');
	});

	it('빈 줄이 세 줄 넘게 이어지지 않는다', () => {
		assert.equal(plainText('앞\n\n\n\n\n뒤'), '앞\n\n뒤');
	});
});

describe('embedInput', () => {
	const post = {
		title: '탬핑을 다시 배웠다',
		tags: ['커피', '에스프레소'],
		description: '수평이 문제였다',
		body: '## 본문\n\n에스프레소가 흘러내렸다.',
	};

	it('제목 · 태그 · 소개 · 본문을 차례로 붙인다', () => {
		assert.equal(
			embedInput(post),
			'탬핑을 다시 배웠다\n\n커피, 에스프레소\n\n수평이 문제였다\n\n본문\n\n에스프레소가 흘러내렸다.',
		);
	});

	it('없는 조각은 빈 줄을 남기지 않는다', () => {
		assert.equal(
			embedInput({ title: '제목', tags: [], body: '본문' }),
			'제목\n\n본문',
		);
	});

	it('같은 글은 같은 문자열 — 지문이 흔들리지 않는다', () => {
		assert.equal(fingerprint(embedInput(post)), fingerprint(embedInput({ ...post })));
	});

	it('본문을 고치면 지문이 바뀐다', () => {
		const changed = { ...post, body: post.body + '\n\n한 줄 더.' };
		assert.notEqual(fingerprint(embedInput(post)), fingerprint(embedInput(changed)));
	});

	it('마크다운 문법만 바뀐 건 지문도 그대로다', () => {
		const restyled = { ...post, body: '## 본문\n\n**에스프레소**가 흘러내렸다.' };
		assert.equal(fingerprint(embedInput(post)), fingerprint(embedInput(restyled)));
	});
});

describe('fingerprint', () => {
	it('8자리 16진수', () => {
		assert.match(fingerprint('아무 글'), /^[0-9a-f]{8}$/);
	});

	it('같은 입력은 같은 지문, 다른 입력은 다른 지문', () => {
		assert.equal(fingerprint('가'), fingerprint('가'));
		assert.notEqual(fingerprint('가'), fingerprint('나'));
	});
});
