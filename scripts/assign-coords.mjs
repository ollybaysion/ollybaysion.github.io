#!/usr/bin/env node
/**
 * 좌표 배정 — 원장에 없는 슬러그만 계산해서 append 한다.
 *
 * 이미 박힌 좌표는 어떤 이유로도 다시 계산하지 않는다(불변식 1).
 * 원장이 바뀌면 그 변경분은 글 커밋에 함께 태워야 한다. CI에서는 쓰지 않고
 * "원장이 더럽다"고 죽는다 — 배포가 조용히 좌표를 새로 매기는 일을 막는다.
 *
 *   node scripts/assign-coords.mjs           원장을 갱신한다
 *   node scripts/assign-coords.mjs --check   갱신이 필요하면 에러로 죽는다 (CI에서 자동)
 */
import process from 'node:process';
import { arcOf } from '../src/config/categories.ts';
import { placeAngle } from '../src/lib/coords/angle.ts';
import { placeRadius } from '../src/lib/coords/radius.ts';
import { confusableTags } from '../src/lib/coords/tags.ts';
import { normalizeTags } from '../src/lib/coords/hash.ts';
import { readLedger, readPosts, serializeJson, writeLedger } from './lib/content.mjs';

const checkOnly = process.argv.includes('--check') || process.env.CI === 'true';
const warnings = [];

function warn(message) {
	warnings.push(message);
}

const posts = await readPosts();
const { ledger, raw: before } = await readLedger();

if (posts.length === 0) {
	console.log('[coords] 글이 없다. 원장을 그대로 둔다.');
	process.exit(0);
}

// epoch는 첫 글에서 한 번 정해지고 다시는 움직이지 않는다.
// epoch가 바뀌면 이미 박힌 모든 반지름의 의미가 달라진다.
const epoch = ledger.epoch ?? posts[0].date;
if (ledger.epoch === null) {
	ledger.epoch = epoch;
	console.log(`[coords] epoch를 "${posts[0].slug}"의 발행일로 고정한다: ${epoch}`);
}
for (const post of posts) {
	if (Date.parse(post.date) < Date.parse(epoch)) {
		warn(`"${post.slug}"의 발행일이 epoch보다 이르다 — 가장 안쪽 나이테로 클램프된다 (${post.date} < ${epoch})`);
	}
}

// 원장에 있지만 콘텐츠가 사라진 슬러그: 지우지 않고 경고만 한다(불변식 1).
const liveSlugs = new Set(posts.map((post) => post.slug));
for (const slug of Object.keys(ledger.entries)) {
	if (!liveSlugs.has(slug)) {
		warn(`원장에 있는 "${slug}"에 해당하는 글이 없다 — 슬러그를 바꿨다면 새 글로 잡힌다. 원장은 그대로 둔다.`);
	}
}

// 이미 배치된 글을 카테고리별 닻으로 세운다. 닻의 태그는 지금 콘텐츠에서 읽는다.
const anchorsByCategory = new Map();
const postBySlug = new Map(posts.map((post) => [post.slug, post]));
for (const [slug, entry] of Object.entries(ledger.entries)) {
	const post = postBySlug.get(slug);
	if (!post) continue;
	const anchors = anchorsByCategory.get(post.category) ?? [];
	anchors.push({ slug, tags: post.tags, series: post.series, angle: entry.angle });
	anchorsByCategory.set(post.category, anchors);
}

// 태그 감시 — 이미 쓰인 적 있는 태그 목록.
const knownTags = new Set();
for (const post of posts) {
	if (!(post.slug in ledger.entries)) continue;
	for (const tag of normalizeTags(post.tags)) knownTags.add(tag);
}

const placedAt = new Date().toISOString();
const added = [];

for (const post of posts) {
	if (post.slug in ledger.entries) continue;

	for (const tag of normalizeTags(post.tags)) {
		const confusable = confusableTags(tag, knownTags);
		if (confusable.length > 0) {
			warn(`"${post.slug}"의 태그 "${tag}"가 기존 태그 ${confusable.map((t) => `"${t}"`).join(', ')}와 거의 같다 — 오타인지 확인할 것.`);
		}
		knownTags.add(tag);
	}

	const arc = arcOf(post.category);
	const anchors = anchorsByCategory.get(post.category) ?? [];
	const angle = placeAngle({ slug: post.slug, tags: post.tags, series: post.series }, anchors, arc);
	const radius = placeRadius(post.date, epoch);

	ledger.entries[post.slug] = { angle, radius, placedAt };
	anchors.push({ slug: post.slug, tags: post.tags, series: post.series, angle });
	anchorsByCategory.set(post.category, anchors);
	added.push({ slug: post.slug, category: post.category, angle, radius });
}

for (const message of warnings) {
	console.warn(`[coords] 경고: ${message}`);
}

const after = serializeJson(ledger);
if (after === before) {
	console.log(`[coords] 새 글 없음. 원장 ${Object.keys(ledger.entries).length}편 그대로.`);
	process.exit(0);
}

if (checkOnly) {
	console.error(
		`[coords] 원장이 더럽다 — 좌표가 배정되지 않은 글이 ${added.length}편 있다:\n` +
			added.map((entry) => `  · ${entry.slug}`).join('\n') +
			`\n\n  로컬에서 \`npm run coords\`를 돌리고 src/data/coordinates.json 변경분을 글 커밋에 함께 넣을 것.`,
	);
	process.exit(1);
}

await writeLedger(ledger);
for (const entry of added) {
	console.log(
		`[coords] + ${entry.slug} (${entry.category}) ${entry.angle.toFixed(1)}° r${entry.radius.toFixed(1)}`,
	);
}
console.log(`[coords] ${added.length}편 배정. 원장 총 ${Object.keys(ledger.entries).length}편.`);
