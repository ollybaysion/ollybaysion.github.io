/**
 * 계약 테스트 — 이 블로그가 독자에게 하는 유일한 약속:
 * **화면상 거리가 가까우면 유사한 글이다.**
 *
 * 무작위 글 셋을 발행 순서대로 배치한 뒤, 모든 글 쌍에 대해
 * 유사도 순위 vs 화면 근접도(-거리) 순위의 스피어만 상관을 잰다. 기준선 0.5.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { placeAngle } from '../../src/lib/coords/angle.ts';
import { BAND_YEARS, YEAR_MS } from '../../src/lib/coords/constants.ts';
import { screenDistance } from '../../src/lib/coords/position.ts';
import { placeRadius } from '../../src/lib/coords/radius.ts';
import { similarity } from '../../src/lib/coords/similarity.ts';
import type { Arc, PlacedPost } from '../../src/lib/coords/types.ts';

const SPEARMAN_FLOOR = 0.5;
const EPOCH = new Date('2026-01-01T00:00:00Z');

interface Topic {
	arc: Arc;
	tags: string[];
}

/** 카테고리 두 개, 각 카테고리 안에 주제 뭉치 세 개. 실제 블로그의 태그 분포를 흉내낸다. */
const TOPICS: Topic[] = [
	{ arc: [210, 330], tags: ['v60', '핸드드립', '드리퍼', '분쇄도'] },
	{ arc: [210, 330], tags: ['에스프레소', '머신', '탬핑', '추출압'] },
	{ arc: [210, 330], tags: ['로스팅', '생두', '프로파일', '디개싱'] },
	{ arc: [30, 150], tags: ['에이전트', 'llm', '프롬프트', '컨텍스트'] },
	{ arc: [30, 150], tags: ['astro', '정적사이트', '빌드', '배포'] },
	{ arc: [30, 150], tags: ['타입스크립트', '테스트', '리팩터링', '린트'] },
];

/** 결정론을 지키려고 Math.random 대신 시드 LCG를 쓴다(불변식 2). */
function lcg(seed: number): () => number {
	let state = seed >>> 0;
	return () => {
		state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
		return state / 0x1_0000_0000;
	};
}

interface GeneratedPost extends PlacedPost {
	radius: number;
}

function generateCorpus(seed: number, count: number): GeneratedPost[] {
	const rand = lcg(seed);
	const byArc = new Map<string, PlacedPost[]>();
	const posts: GeneratedPost[] = [];

	for (let i = 0; i < count; i += 1) {
		const topic = TOPICS[Math.floor(rand() * TOPICS.length)]!;
		// 주제 태그 2~3개 + 가끔 다른 주제 태그 하나(현실의 번짐).
		const pool = [...topic.tags];
		const tags: string[] = [];
		const take = 2 + Math.floor(rand() * 2);
		for (let t = 0; t < take && pool.length > 0; t += 1) {
			tags.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]!);
		}
		if (rand() < 0.15) {
			const other = TOPICS[Math.floor(rand() * TOPICS.length)]!;
			tags.push(other.tags[Math.floor(rand() * other.tags.length)]!);
		}

		const key = topic.arc.join(',');
		const ledger = byArc.get(key) ?? [];
		const slug = `글-${seed}-${i}`;
		const input = { slug, tags };
		const angle = placeAngle(input, ledger, topic.arc);
		// 발행일은 밴드 안에서 순서대로 흩어진다.
		const date = new Date(EPOCH.getTime() + (i / count) * BAND_YEARS * YEAR_MS);
		const radius = placeRadius(date, EPOCH);

		const placedPost: GeneratedPost = { ...input, angle, radius };
		ledger.push(placedPost);
		byArc.set(key, ledger);
		posts.push(placedPost);
	}
	return posts;
}

/** 동점은 평균 순위로 처리한다. */
function rank(values: number[]): number[] {
	const order = values.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
	const ranks = new Array<number>(values.length);
	let i = 0;
	while (i < order.length) {
		let j = i;
		while (j + 1 < order.length && order[j + 1]!.v === order[i]!.v) j += 1;
		const averageRank = (i + j) / 2 + 1;
		for (let k = i; k <= j; k += 1) ranks[order[k]!.i] = averageRank;
		i = j + 1;
	}
	return ranks;
}

function spearman(xs: number[], ys: number[]): number {
	const rx = rank(xs);
	const ry = rank(ys);
	const n = xs.length;
	const mean = (n + 1) / 2;
	let num = 0;
	let dx = 0;
	let dy = 0;
	for (let i = 0; i < n; i += 1) {
		const a = rx[i]! - mean;
		const b = ry[i]! - mean;
		num += a * b;
		dx += a * a;
		dy += b * b;
	}
	return num / Math.sqrt(dx * dy);
}

/** 모든 글 쌍의 (유사도, 화면 근접도). 근접도 = -거리라서 상관은 양수여야 한다. */
function pairs(posts: GeneratedPost[]): { sims: number[]; proximities: number[] } {
	const sims: number[] = [];
	const proximities: number[] = [];
	for (let i = 0; i < posts.length; i += 1) {
		for (let j = i + 1; j < posts.length; j += 1) {
			sims.push(similarity(posts[i]!, posts[j]!));
			proximities.push(-screenDistance(posts[i]!, posts[j]!));
		}
	}
	return { sims, proximities };
}

describe('계약: 가까우면 닮았다', () => {
	for (const seed of [1, 7, 42, 1234, 20260829]) {
		it(`seed ${seed} — 유사도와 화면 근접도의 스피어만 상관 ≥ ${SPEARMAN_FLOOR}`, () => {
			const posts = generateCorpus(seed, 60);
			const { sims, proximities } = pairs(posts);
			const rho = spearman(sims, proximities);
			assert.ok(rho >= SPEARMAN_FLOOR, `스피어만 상관 ${rho.toFixed(3)} < ${SPEARMAN_FLOOR}`);
		});
	}

	it('같은 카테고리 안에서만 봐도 계약이 선다', () => {
		const posts = generateCorpus(99, 60).filter((p) => p.angle >= 210 && p.angle <= 330);
		const { sims, proximities } = pairs(posts);
		const rho = spearman(sims, proximities);
		assert.ok(rho >= SPEARMAN_FLOOR, `카테고리 내부 상관 ${rho.toFixed(3)} < ${SPEARMAN_FLOOR}`);
	});
});
