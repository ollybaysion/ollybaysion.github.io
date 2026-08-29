/**
 * 빌드 스크립트가 쓰는 I/O 계층. 계산은 여기 없다 — 전부 src/lib/coords 에 있다.
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { slug as githubSlug } from 'github-slugger';
import { load as loadYaml } from 'js-yaml';
import { CATEGORY_NAMES, isCategory } from '../../src/config/categories.ts';
import { COORDS_VERSION } from '../../src/lib/coords/constants.ts';

export const PROJECT_ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const CONTENT_DIR = path.join(PROJECT_ROOT, 'src/content/blog');
export const LEDGER_PATH = path.join(PROJECT_ROOT, 'src/data/coordinates.json');
export const GENERATED_DIR = path.join(PROJECT_ROOT, 'src/data/generated');

const CONTENT_EXTENSIONS = new Set(['.md', '.mdx']);
const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/;

/** 사람이 읽고 커밋하는 JSON — 2칸 들여쓰기 + 끝 개행. */
export function serializeJson(value) {
	return `${JSON.stringify(value, null, 2)}\n`;
}

export async function writeJson(filePath, value) {
	await writeFile(filePath, serializeJson(value), 'utf8');
}

async function listContentFiles(dir) {
	// 글이 하나도 없으면 디렉토리 자체가 없을 수 있다(빈 블로그·첫 글 직전).
	const entries = await readdir(dir, { withFileTypes: true }).catch((err) => {
		if (err.code === 'ENOENT') return [];
		throw err;
	});
	const files = [];
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await listContentFiles(full)));
		} else if (CONTENT_EXTENSIONS.has(path.extname(entry.name))) {
			files.push(full);
		}
	}
	return files;
}

/**
 * 파일 경로 → Astro 콘텐츠 엔트리 id.
 * Astro glob 로더의 `generateIdDefault`와 같은 규칙(경로 조각마다 github-slugger,
 * `/index` 꼬리 제거)이라 원장 키와 `post.id`가 항상 일치한다.
 */
export function slugOf(filePath) {
	const relative = path.relative(CONTENT_DIR, filePath);
	const withoutExt = relative.slice(0, relative.length - path.extname(relative).length);
	return withoutExt.split(path.sep).map(githubSlug).join('/').replace(/\/index$/, '');
}

function parseFrontmatter(raw, filePath) {
	const match = FRONTMATTER.exec(raw);
	if (!match) {
		throw new Error(`frontmatter가 없다: ${path.relative(PROJECT_ROOT, filePath)}`);
	}
	const data = loadYaml(match[1]);
	if (data === null || typeof data !== 'object') {
		throw new Error(`frontmatter를 읽을 수 없다: ${path.relative(PROJECT_ROOT, filePath)}`);
	}
	return data;
}

function toIsoDate(value, filePath) {
	const date = value instanceof Date ? value : new Date(String(value));
	if (Number.isNaN(date.getTime())) {
		throw new Error(`date를 읽을 수 없다: ${path.relative(PROJECT_ROOT, filePath)} (date: ${String(value)})`);
	}
	return date.toISOString();
}

/**
 * 콘텐츠 전체를 읽어 발행일 → 슬러그 순으로 돌려준다.
 * 순서를 여기서 고정해야 좌표 배정이 파일시스템 순서에 흔들리지 않는다(불변식 2).
 */
export async function readPosts() {
	const files = (await listContentFiles(CONTENT_DIR)).sort();

	const parsed = await Promise.all(
		files.map(async (filePath) => {
			const raw = await readFile(filePath, 'utf8');
			const data = parseFrontmatter(raw, filePath);
			const where = path.relative(PROJECT_ROOT, filePath);

			if (typeof data.title !== 'string' || data.title.trim() === '') {
				throw new Error(`title이 없다: ${where}`);
			}
			if (data.date === undefined) {
				throw new Error(`date가 없다: ${where}`);
			}
			if (typeof data.category !== 'string' || !isCategory(data.category)) {
				throw new Error(
					`등록되지 않은 카테고리: ${JSON.stringify(data.category)} (${where})\n` +
						`  src/config/categories.json에 호와 색을 먼저 등록할 것. 지금 등록된 카테고리: ${CATEGORY_NAMES.join(', ')}`,
				);
			}
			const tags = data.tags ?? [];
			if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== 'string')) {
				throw new Error(`tags는 문자열 배열이어야 한다: ${where}`);
			}

			return {
				slug: slugOf(filePath),
				filePath: where,
				title: data.title,
				date: toIsoDate(data.date, filePath),
				category: data.category,
				tags,
				series: typeof data.series === 'string' ? data.series : undefined,
				episode: typeof data.episode === 'number' ? data.episode : undefined,
				description: typeof data.description === 'string' ? data.description : undefined,
			};
		}),
	);

	const bySlug = new Map();
	for (const post of parsed) {
		const clash = bySlug.get(post.slug);
		if (clash) {
			throw new Error(`슬러그가 겹친다: "${post.slug}" — ${clash.filePath} / ${post.filePath}`);
		}
		bySlug.set(post.slug, post);
	}

	return parsed.sort((a, b) => Date.parse(a.date) - Date.parse(b.date) || a.slug.localeCompare(b.slug));
}

export async function readLedger() {
	const raw = await readFile(LEDGER_PATH, 'utf8');
	const ledger = JSON.parse(raw);
	if (ledger.version !== COORDS_VERSION) {
		throw new Error(
			`원장 버전이 엔진과 다르다: 원장 ${ledger.version} vs 엔진 ${COORDS_VERSION}.\n` +
				`  버전을 올렸다면 전량 재측량이라는 뜻이다 — 의식적으로 처리할 것.`,
		);
	}
	return { ledger, raw };
}

export async function writeLedger(ledger) {
	await writeFile(LEDGER_PATH, serializeJson(ledger), 'utf8');
}
