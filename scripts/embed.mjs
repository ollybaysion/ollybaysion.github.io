#!/usr/bin/env node
/**
 * 임베딩 — 벡터 원장에 없는 슬러그만 재서 append 한다.
 *
 * 좌표 원장과 같은 규율이다: 한 번 박힌 벡터는 다시 재지 않는다. 글을 고쳐서 지문이
 * 어긋나도 경고만 하고 그대로 둔다 — 다시 재면 이미 박힌 좌표를 낳은 근거가 사후에
 * 바뀌고, 발견 레이어가 빌드마다 달라진다.
 *
 * 모델은 **여기서만** 부른다. `vectors.json`은 커밋되므로 CI는 모델을 내려받지 않는다.
 * 그래서 `--check`는 모델 없이 돈다 — 빠진 슬러그가 있는지만 본다.
 *
 *   node scripts/embed.mjs           벡터 원장을 갱신한다 (모델 필요, 첫 실행은 내려받는다)
 *   node scripts/embed.mjs --check   갱신이 필요하면 에러로 죽는다 (CI에서 자동, 모델 불필요)
 */
import process from 'node:process';
import {
	EMBED_DTYPE,
	EMBED_MODEL,
	EMBED_POOLING,
	EMBED_VERSION,
	VECTOR_DIMS,
	VECTOR_PRECISION,
} from '../src/lib/coords/constants.ts';
import { embedInput } from '../src/lib/coords/embed.ts';
import { fingerprint } from '../src/lib/coords/hash.ts';
import { readPosts, readVectors, serializeVectors, writeVectors } from './lib/content.mjs';

const checkOnly = process.argv.includes('--check') || process.env.CI === 'true';

const posts = await readPosts();
const { vectors, raw: before } = await readVectors();

if (posts.length === 0) {
	console.log('[embed] 글이 없다. 벡터 원장을 그대로 둔다.');
	process.exit(0);
}

const warnings = [];

// 원장에 있지만 콘텐츠가 사라진 슬러그: 좌표 원장과 같이 지우지 않고 경고만 한다.
const liveSlugs = new Set(posts.map((post) => post.slug));
for (const slug of Object.keys(vectors.entries)) {
	if (!liveSlugs.has(slug)) {
		warnings.push(`벡터 원장에 있는 "${slug}"에 해당하는 글이 없다 — 원장은 그대로 둔다.`);
	}
}

/** 아직 벡터가 없는 글, 그리고 벡터를 뜬 뒤 내용이 바뀐 글. */
const pending = [];
for (const post of posts) {
	const text = embedInput(post);
	const source = fingerprint(text);
	const entry = vectors.entries[post.slug];
	if (!entry) {
		pending.push({ slug: post.slug, text, source });
	} else if (entry.source !== source) {
		warnings.push(
			`"${post.slug}"의 글이 벡터를 뜬 뒤에 바뀌었다(${entry.source} → ${source}) — 벡터는 그대로 둔다. ` +
				`다시 재려면 vectors.json에서 그 줄을 지우고 \`npm run embed\`를 돌릴 것.`,
		);
	}
}

for (const message of warnings) {
	console.warn(`[embed] 경고: ${message}`);
}

if (pending.length === 0) {
	console.log(`[embed] 새 글 없음. 벡터 원장 ${Object.keys(vectors.entries).length}편 그대로.`);
	process.exit(0);
}

if (checkOnly) {
	console.error(
		`[embed] 벡터 원장이 더럽다 — 벡터가 없는 글이 ${pending.length}편 있다:\n` +
			pending.map((item) => `  · ${item.slug}`).join('\n') +
			`\n\n  로컬에서 \`npm run embed\`를 돌리고 src/data/vectors.json 변경분을 글 커밋에 함께 넣을 것.` +
			`\n  (${EMBED_MODEL}를 처음 한 번 내려받는다.)`,
	);
	process.exit(1);
}

// 모델은 여기서 처음 부른다 — --check 경로는 이 줄까지 오지 않는다.
let pipeline;
try {
	({ pipeline } = await import('@huggingface/transformers'));
} catch (err) {
	console.error(
		`[embed] @huggingface/transformers를 불러올 수 없다.\n` +
			`  선택 의존성이라 \`npm i --include=optional\`로 따로 받아야 한다(배포는 이 패키지 없이 돈다).\n` +
			`  ${err.message}`,
	);
	process.exit(1);
}

console.log(`[embed] ${EMBED_MODEL} (${EMBED_POOLING}·${EMBED_DTYPE}) 를 부른다 — 처음이면 내려받느라 한참 걸린다.`);
const extract = await pipeline('feature-extraction', EMBED_MODEL, { dtype: EMBED_DTYPE });

const embeddedAt = new Date().toISOString();
const round = 10 ** VECTOR_PRECISION;

for (const item of pending) {
	const out = await extract(item.text, { pooling: EMBED_POOLING, normalize: true });
	const vector = Array.from(out.data, (value) => Math.round(value * round) / round);
	if (vector.length !== VECTOR_DIMS) {
		throw new Error(`${EMBED_MODEL}가 ${vector.length}차원을 뱉었다 — 엔진은 ${VECTOR_DIMS}를 기대한다.`);
	}
	vectors.entries[item.slug] = { vector, source: item.source, embeddedAt };
	console.log(`[embed] + ${item.slug} (${item.text.length}자)`);
}

// 슬러그순으로 적어야 새 글이 끼어들어도 diff가 그 글 한 덩어리로 남는다.
vectors.version = EMBED_VERSION;
vectors.model = EMBED_MODEL;
vectors.dims = VECTOR_DIMS;
vectors.entries = Object.fromEntries(
	Object.entries(vectors.entries).sort(([a], [b]) => a.localeCompare(b)),
);

if (serializeVectors(vectors) === before) {
	console.log('[embed] 원장에 바뀐 게 없다.');
	process.exit(0);
}

await writeVectors(vectors);
console.log(`[embed] ${pending.length}편 임베딩. 벡터 원장 총 ${Object.keys(vectors.entries).length}편.`);
