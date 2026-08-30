/**
 * 계약 테스트 — 이 블로그가 독자에게 하는 유일한 약속:
 * **화면상 거리가 가까우면 유사한 글이다.**
 *
 * 무작위 글 셋을 발행 순서대로 배치한 뒤, 모든 글 쌍에 대해
 * 유사도 순위 vs 화면 근접도(-거리) 순위의 스피어만 상관을 잰다. 기준선 0.5.
 *
 * 재는 자가 v1(태그 자카드)에서 v2(임베딩 코사인)로 바뀌었으므로 **양쪽 다** 돌린다.
 * 유사도 함수를 갈아도 약속은 그대로여야 한다.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { placeAngle } from '../../src/lib/coords/angle.ts';
import { BAND_YEARS, VECTOR_DIMS, YEAR_MS } from '../../src/lib/coords/constants.ts';
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

/**
 * 가짜 임베딩 — 실제 모델이 뱉는 코사인 분포를 흉내낸다.
 *
 * 벡터를 세 조각으로 쌓는다: 모든 한국어 산문이 공유하는 바닥(g) · 주제(t) · 글 고유의 잡음(n).
 * 조각의 무게를 이렇게 잡으면 같은 주제끼리는 코사인 0.60, 다른 주제끼리는 0.38 언저리가
 * 나온다 — 2026-08-30에 bge-m3로 잰 실제 분포(닮음 0.46~0.67 · 안 닮음 0.31~0.43)와 같은 자리다.
 * 무작위 벡터를 그냥 쓰면 전부 바닥 아래라 유사도가 죄다 0이 되어 아무것도 재지 못한다.
 *
 * **차원은 실제 모델과 같아야 한다.** 잡음 항의 산포가 1/√차원이라, 64차원으로 흉내내면
 * 산포가 실제보다 네 배 넓어져 상관없는 쌍의 30%가 바닥을 넘어온다(측정: 그때 상관 0.37).
 * 1024차원에서는 넘어오는 쌍이 0%다.
 */
const VEC_DIMS = VECTOR_DIMS;
const W_COMMON = 0.616;
const W_TOPIC = 0.469;
const W_NOISE = 0.632;

function randomUnit(rand: () => number): number[] {
	// Box-Muller 없이도 충분하다 — 균등 잡음의 합도 고차원에서는 거의 등방이다.
	const v = Array.from({ length: VEC_DIMS }, () => rand() * 2 - 1);
	const len = Math.hypot(...v);
	return v.map((x) => x / len);
}

function mixVector(common: number[], topic: number[], noise: number[]): number[] {
	const v = common.map((c, i) => W_COMMON * c + W_TOPIC * topic[i]! + W_NOISE * noise[i]!);
	const len = Math.hypot(...v);
	return v.map((x) => x / len);
}

function generateCorpus(seed: number, count: number, withVectors = false): GeneratedPost[] {
	const rand = lcg(seed);
	const byArc = new Map<string, PlacedPost[]>();
	const posts: GeneratedPost[] = [];
	// 벡터는 **다른** 난수열에서 뽑는다 — 그래야 v1과 v2가 글자 그대로 같은 글 셋을 본다.
	const vrand = lcg(seed ^ 0x5eed);
	const common = randomUnit(vrand);
	const topicAxes = TOPICS.map(() => randomUnit(vrand));

	for (let i = 0; i < count; i += 1) {
		const topicIndex = Math.floor(rand() * TOPICS.length);
		const topic = TOPICS[topicIndex]!;
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
		const vector = withVectors
			? mixVector(common, topicAxes[topicIndex]!, randomUnit(vrand))
			: undefined;
		const input = { slug, tags, vector };
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

for (const [name, withVectors] of [
	['v1 — 태그 자카드', false],
	['v2 — 임베딩 코사인', true],
] as const) {
	describe(`계약: 가까우면 닮았다 (${name})`, () => {
		for (const seed of [1, 7, 42, 1234, 20260829]) {
			it(`seed ${seed} — 유사도와 화면 근접도의 스피어만 상관 ≥ ${SPEARMAN_FLOOR}`, () => {
				const posts = generateCorpus(seed, 60, withVectors);
				const { sims, proximities } = pairs(posts);
				const rho = spearman(sims, proximities);
				assert.ok(rho >= SPEARMAN_FLOOR, `스피어만 상관 ${rho.toFixed(3)} < ${SPEARMAN_FLOOR}`);
			});
		}

		it('같은 카테고리 안에서만 봐도 계약이 선다', () => {
			const posts = generateCorpus(99, 60, withVectors).filter((p) => p.angle >= 210 && p.angle <= 330);
			const { sims, proximities } = pairs(posts);
			const rho = spearman(sims, proximities);
			assert.ok(rho >= SPEARMAN_FLOOR, `카테고리 내부 상관 ${rho.toFixed(3)} < ${SPEARMAN_FLOOR}`);
		});
	});
}

describe('가짜 임베딩이 실제 분포를 흉내내는가', () => {
	it('같은 주제는 바닥 위, 다른 주제는 바닥 아래', () => {
		const posts = generateCorpus(7, 60, true);
		const sims: number[] = [];
		for (let i = 0; i < posts.length; i += 1) {
			for (let j = i + 1; j < posts.length; j += 1) sims.push(similarity(posts[i]!, posts[j]!));
		}
		// 전부 0(바닥 아래)이거나 전부 양수(바닥 위)면 아무것도 가르지 못한 것이다.
		const zero = sims.filter((v) => v === 0).length;
		assert.ok(zero > 0, '모든 쌍이 바닥 위 — 문턱이 놀고 있다');
		assert.ok(zero < sims.length, '모든 쌍이 바닥 아래 — 닮은 글이 하나도 없다');
	});
});
