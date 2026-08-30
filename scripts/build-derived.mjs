#!/usr/bin/env node
/**
 * 파생 데이터 생성 — 원장 + 콘텐츠 → 화면이 그대로 먹는 JSON.
 *
 * 전부 원장에서 파생되므로 커밋하지 않는다(`src/data/generated/`는 gitignore).
 * 좌표 배정이 끝난 뒤에 돌아야 한다.
 */
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { arcOf, colorOf } from '../src/config/categories.ts';
import {
	COORDS_VERSION,
	DISCOVERY_FLOOR,
	DISCOVERY_LIMIT,
	D_MAX,
	EMBED_VERSION,
	NEIGHBOR_LIMIT,
} from '../src/lib/coords/constants.ts';
import { constellations, discoveryMap, groupByCategory, neighborMap } from '../src/lib/coords/derive.ts';
import { toPoint } from '../src/lib/coords/position.ts';
import {
	GENERATED_DIR,
	PROJECT_ROOT,
	readLedger,
	readPosts,
	readVectors,
	vectorLookup,
	writeJson,
} from './lib/content.mjs';

const posts = await readPosts();
const { ledger } = await readLedger();
const { vectors } = await readVectors();
const vectorOf = vectorLookup(vectors);

const missing = posts.filter((post) => !(post.slug in ledger.entries));
if (missing.length > 0) {
	console.error(
		`[derived] 좌표가 없는 글이 ${missing.length}편 있다:\n` +
			missing.map((post) => `  · ${post.slug}`).join('\n') +
			`\n\n  먼저 \`npm run coords\`를 돌릴 것.`,
	);
	process.exit(1);
}

/** 화면이 쓰는 글 하나의 전체 모습. 메인은 이 배열 하나만 받으면 된다. */
const placed = posts.map((post) => {
	const entry = ledger.entries[post.slug];
	const point = toPoint(entry);
	return {
		slug: post.slug,
		title: post.title,
		description: post.description,
		category: post.category,
		date: post.date,
		tags: post.tags,
		readingMinutes: post.readingMinutes,
		series: post.series,
		episode: post.episode,
		angle: entry.angle,
		radius: entry.radius,
		x: point.x,
		y: point.y,
	};
});

const constellationsByName = constellations(placed);
// 별자리가 매긴 확정 회차를 글에 되돌려준다(frontmatter에 episode가 없으면 날짜순).
const resolvedEpisode = new Map();
for (const members of Object.values(constellationsByName)) {
	for (const member of members) resolvedEpisode.set(member.slug, member.episode);
}
for (const post of placed) {
	if (post.series) post.episode = resolvedEpisode.get(post.slug);
}

const byCategory = groupByCategory(placed);
const categories = {};
for (const [name, slugs] of Object.entries(byCategory)) {
	categories[name] = { arc: arcOf(name), color: colorOf(name), count: slugs.length, slugs };
}

const meta = { version: COORDS_VERSION, epoch: ledger.epoch, dMax: D_MAX, neighborLimit: NEIGHBOR_LIMIT };

/**
 * 발견 레이어 — 다른 카테고리에서 닮은 글.
 *
 * 벡터는 여기서만 쓰고 화면으로 내보내지 않는다. 한 편에 1024개짜리 배열이라
 * `posts.json`에 실으면 메인 화면이 글 한 편당 9KB를 더 받게 된다.
 */
const withVectors = placed.map((post) => ({ ...post, vector: vectorOf.get(post.slug) }));
const discoveries = discoveryMap(withVectors, DISCOVERY_LIMIT, DISCOVERY_FLOOR);
const linked = Object.values(discoveries).filter((found) => found.length > 0).length;

await mkdir(GENERATED_DIR, { recursive: true });
await Promise.all([
	// 메인 화면 클라이언트가 통째로 받는 전 글 좌표.
	writeJson(path.join(GENERATED_DIR, 'posts.json'), { ...meta, posts: placed }),
	// 글 화면 "가까운 글" — 빌드 시 고정, 클릭마다 재계산하지 않는다.
	writeJson(path.join(GENERATED_DIR, 'neighbors.json'), {
		...meta,
		neighbors: neighborMap(placed, NEIGHBOR_LIMIT),
	}),
	// 글 화면 "다른 자리에서 닮은 글" — 화면 거리가 아니라 임베딩이 잇는다.
	writeJson(path.join(GENERATED_DIR, 'discoveries.json'), {
		...meta,
		embedVersion: EMBED_VERSION,
		discoveryFloor: DISCOVERY_FLOOR,
		discoveries,
	}),
	// 시리즈 별자리 좌표.
	writeJson(path.join(GENERATED_DIR, 'series.json'), { ...meta, series: constellationsByName }),
	// 카테고리별 목록(최신순) + 호·색.
	writeJson(path.join(GENERATED_DIR, 'categories.json'), { ...meta, categories }),
]);

const seriesCount = Object.keys(constellationsByName).length;
console.log(
	`[derived] ${placed.length}편 · 카테고리 ${Object.keys(categories).length}종 · 시리즈 ${seriesCount}개 · ` +
		`발견 ${linked}편 → ${path.relative(PROJECT_ROOT, GENERATED_DIR)}/`,
);
