import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { confusableTags, editDistance } from '../../src/lib/coords/tags.ts';

describe('editDistance', () => {
	it('같으면 0', () => {
		assert.equal(editDistance('에이전트', '에이전트'), 0);
	});

	it('한 글자 삽입·삭제·치환은 1', () => {
		assert.equal(editDistance('llm', 'llms'), 1);
		assert.equal(editDistance('에이전트들', '에이전트'), 1);
		assert.equal(editDistance('커피콩', '커피통'), 1);
	});

	it('한글은 글자 단위로 센다(코드 유닛이 아니라)', () => {
		assert.equal(editDistance('핸드드립', '핸드드립기'), 1);
	});

	it('완전히 다른 말은 멀다', () => {
		assert.ok(editDistance('에스프레소', '핸드드립') > 1);
	});
});

describe('confusableTags', () => {
	it('한 글자 차이 나는 기존 태그를 집어낸다', () => {
		assert.deepEqual(confusableTags('에이전트들', ['에이전트', '핸드드립']), ['에이전트']);
	});

	it('정규화하면 같아지는 태그는 오타가 아니라 같은 태그다', () => {
		assert.deepEqual(confusableTags(' Astro ', ['astro']), []);
	});

	it('짧은 태그는 원래 다른 말이라 보고 넘긴다', () => {
		assert.deepEqual(confusableTags('v60', ['v40']), []);
		assert.deepEqual(confusableTags('ai', ['ui']), []);
		assert.deepEqual(confusableTags('커피콩', ['커피통']), []);
	});

	it('짧은 태그라도 긴 쪽이 4글자 이상이면 잡는다', () => {
		assert.deepEqual(confusableTags('llm', ['llms']), ['llms']);
		assert.deepEqual(confusableTags('로스팅', ['로스팅기']), ['로스팅기']);
	});

	it('두 글자 이상 차이는 경고하지 않는다', () => {
		assert.deepEqual(confusableTags('에스프레소', ['핸드드립', '로스팅']), []);
	});

	it('여러 개 걸리면 정렬해서 준다', () => {
		assert.deepEqual(confusableTags('로스팅', ['로스팅기', '로스팅s', '핸드드립']), ['로스팅s', '로스팅기']);
	});

	it('알려진 태그가 없으면 빈 배열', () => {
		assert.deepEqual(confusableTags('에이전트', []), []);
	});
});
