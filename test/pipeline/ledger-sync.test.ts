/**
 * 원장과 콘텐츠가 어긋나지 않았는지. CI의 `--check`와 같은 계약을 테스트로도 건다.
 * 여기가 깨지면 `npm run coords`를 돌리고 원장 변경분을 글 커밋에 함께 넣으면 된다.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { arcOf } from '../../src/config/categories.ts';
import { toLocal, arcSpan } from '../../src/lib/coords/arc.ts';
import { RADIUS_MAX, RADIUS_MIN } from '../../src/lib/coords/constants.ts';
import { readLedger, readPosts } from '../../scripts/lib/content.mjs';

const posts = await readPosts();
const { ledger } = await readLedger();

describe('원장 ↔ 콘텐츠', () => {
	it('모든 글에 좌표가 있다', () => {
		const missing = posts.filter((post) => !(post.slug in ledger.entries)).map((post) => post.slug);
		assert.deepEqual(missing, [], `좌표 없는 글: ${missing.join(', ')} — npm run coords`);
	});

	it('글이 있으면 epoch가 잡혀 있다', () => {
		if (posts.length > 0) {
			assert.notEqual(ledger.epoch, null);
			assert.equal(ledger.epoch, posts[0].date, 'epoch는 가장 이른 글의 발행일이어야 한다');
		}
	});

	it('각 글의 각도가 제 카테고리 호 안에 있다', () => {
		for (const post of posts) {
			const entry = ledger.entries[post.slug];
			if (!entry) continue;
			const arc = arcOf(post.category);
			const local = toLocal(arc, entry.angle);
			assert.ok(
				local >= -1e-9 && local <= arcSpan(arc) + 1e-9,
				`${post.slug} (${post.category}) ${entry.angle}° 가 호 ${arc[0]}~${arc[1]} 밖`,
			);
		}
	});

	it('각 글의 반지름이 나이테 범위 안에 있다', () => {
		for (const post of posts) {
			const entry = ledger.entries[post.slug];
			if (!entry) continue;
			assert.ok(entry.radius >= RADIUS_MIN && entry.radius <= RADIUS_MAX, `${post.slug} r${entry.radius}`);
		}
	});
});
