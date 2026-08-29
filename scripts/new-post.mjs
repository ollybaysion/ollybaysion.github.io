#!/usr/bin/env node
/**
 * 새 글 초안 — `npm run new "제목"`.
 *
 * 날짜와 frontmatter가 채워진 마크다운 한 장을 `src/content/blog/`에 만든다.
 * 슬러그는 `날짜-제목`이고, 파일 이름을 짓는 함수가 Astro 로더·좌표 원장이 쓰는
 * 바로 그 함수라 세 곳의 이름이 언제나 같다.
 *
 * **좌표는 여기서 안 매긴다.** 각도는 카테고리 호와 태그 유사도에서 나오는데,
 * 좌표는 한 번 박히면 다시 계산하지 않으므로(불변식 1) 초안 단계에서 매기면
 * 아직 정하지도 않은 태그로 자리가 굳어버린다. 좌표는 첫 `npm run dev`·`npm run build`
 * 때 박힌다 — 그 전에 카테고리와 태그를 정해둘 것.
 *
 *   npm run new "예가체페를 처음 만난 날"
 *   npm run new "탬핑을 다시 배웠다" -- -c 커피 -t 에스프레소,탬핑
 *   npm run new "V60 레시피 정착기" -- -s "예가체페 연대기" --episode 3
 *
 * npm이 `-`로 시작하는 인자를 먹으므로 옵션 앞에는 `--`를 둔다.
 */
import { mkdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { parseArgs } from 'node:util';
import { CATEGORY_NAMES } from '../src/config/categories.ts';
import { CONTENT_DIR, PROJECT_ROOT, readLedger, slugOf } from './lib/content.mjs';
import { DATE_PATTERN, draftSlug, localDate, renderDraft } from './lib/draft.mjs';

const USAGE = `
  npm run new "제목"

  옵션 (npm이 먹지 않게 앞에 -- 를 둔다):
    -c, --category <이름>    ${CATEGORY_NAMES.join(' · ')} (기본: ${CATEGORY_NAMES[0]})
    -t, --tags <a,b,c>       쉼표로 나눈 태그
    -s, --series <이름>      연재물이면 시리즈 이름
        --episode <번호>     생략하면 시리즈 안에서 날짜순으로 매겨진다
        --date <YYYY-MM-DD>  기본: 오늘
    -d, --description <한 줄>  목록·글 화면의 소개

  예)
    npm run new "예가체페를 처음 만난 날"
    npm run new "탬핑을 다시 배웠다" -- -c 커피 -t 에스프레소,탬핑
`;

function die(message) {
	console.error(`[new] ${message}\n${USAGE}`);
	process.exit(1);
}

let parsed;
try {
	parsed = parseArgs({
		allowPositionals: true,
		options: {
			category: { type: 'string', short: 'c' },
			tags: { type: 'string', short: 't' },
			series: { type: 'string', short: 's' },
			episode: { type: 'string' },
			date: { type: 'string' },
			description: { type: 'string', short: 'd' },
		},
	});
} catch (error) {
	die(error.message);
}

const { values, positionals } = parsed;

if (positionals.length === 0) die('제목이 없다.');
if (positionals.length > 1) {
	die(`제목은 하나여야 한다 — 따옴표로 묶었는지 볼 것: ${positionals.map((p) => `"${p}"`).join(' ')}`);
}

const title = positionals[0].trim();
if (title === '') die('제목이 비어 있다.');

const date = values.date ?? localDate(new Date());
if (!DATE_PATTERN.test(date)) die(`날짜는 YYYY-MM-DD여야 한다: "${date}"`);

const category = values.category ?? CATEGORY_NAMES[0];
if (!CATEGORY_NAMES.includes(category)) {
	die(
		`등록되지 않은 카테고리: "${category}"\n` +
			`  지금 등록된 카테고리: ${CATEGORY_NAMES.join(', ')}\n` +
			`  새 카테고리는 src/config/categories.json에 호와 색을 먼저 등록할 것.`,
	);
}

const tags = (values.tags ?? '')
	.split(',')
	.map((tag) => tag.trim())
	.filter((tag) => tag !== '');

if (values.episode !== undefined && values.series === undefined) {
	die('--episode는 --series와 함께 쓴다.');
}
let episode;
if (values.episode !== undefined) {
	episode = Number(values.episode);
	if (!Number.isInteger(episode) || episode < 1) {
		die(`--episode는 1 이상의 정수여야 한다: "${values.episode}"`);
	}
}

let slug;
try {
	slug = draftSlug(title, date);
} catch (error) {
	die(error.message);
}

const filePath = path.join(CONTENT_DIR, `${slug}.md`);
const where = path.relative(PROJECT_ROOT, filePath);

// 이름이 겹치면 덮어쓰지 않는다 — 쓰던 글을 날리는 것보다 멈추는 게 낫다.
if (await stat(filePath).catch(() => null)) die(`이미 있는 파일이다: ${where}`);

// 슬러그를 다시 접어본다. 파일 이름과 Astro가 읽을 id가 어긋나면 원장 키가 갈린다.
const roundTrip = slugOf(filePath);
if (roundTrip !== slug) {
	die(`슬러그가 파일 이름과 어긋난다: "${slug}" → "${roundTrip}". 제목의 기호를 줄여볼 것.`);
}

// 슬러그를 바꿔 다시 쓰는 경우 — 원장은 append-only라 옛 좌표가 그대로 남아 있다.
const { ledger } = await readLedger();
const known = slug in ledger.entries;

await mkdir(CONTENT_DIR, { recursive: true });
await writeFile(
	filePath,
	renderDraft({
		title,
		date,
		category,
		tags,
		series: values.series,
		episode,
		description: values.description,
	}),
	'utf8',
);

console.log(`[new] ${where}`);
console.log(`[new] 슬러그 ${slug} · ${category}${tags.length > 0 ? ` · ${tags.join(', ')}` : ''}`);

if (known) {
	console.warn(
		`[new] 경고: 이 슬러그는 이미 원장에 있다 — 좌표가 새로 매겨지지 않고 옛 자리를 그대로 쓴다.`,
	);
}
if (tags.length === 0) {
	console.log(
		`[new] 태그가 없다. 태그가 없으면 각도는 슬러그 해시로만 정해진다 —\n` +
			`      비슷한 글 옆에 앉히려면 좌표가 박히기 전에 태그를 채울 것.`,
	);
}
console.log(
	`[new] 좌표는 첫 \`npm run dev\`·\`npm run build\` 때 박히고 다시 계산되지 않는다.\n` +
		`      그 전에 카테고리와 태그를 정해두고, 박힌 뒤에는 src/data/coordinates.json 변경분을\n` +
		`      이 글 커밋에 함께 넣을 것.`,
);
