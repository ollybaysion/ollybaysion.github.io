/**
 * 새 글 초안의 순수 규칙 — 파일 이름 하나와 frontmatter 한 장.
 * I/O는 없다. 파일을 만드는 건 `scripts/new-post.mjs`다.
 */
import { slug as githubSlug } from 'github-slugger';

/**
 * 로컬 시각 기준 YYYY-MM-DD.
 * UTC로 접으면 밤에 쓴 글이 어제 날짜를 달고 나온다 — 반지름은 발행일이 정하므로
 * 하루 어긋나면 나이테가 어긋난다.
 */
export function localDate(now) {
	const pad = (n) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 슬러그 = 날짜-제목.
 *
 * 제목 쪽은 `github-slugger`로 접는다 — `scripts/lib/content.mjs`의 `slugOf`와
 * Astro glob 로더가 파일 이름에 쓰는 바로 그 함수다. 그래서 여기서 지은 이름이
 * 원장 키·`post.id`와 언제나 같은 글자가 된다.
 */
export function draftSlug(title, date) {
	if (!DATE_PATTERN.test(date)) {
		throw new Error(`날짜는 YYYY-MM-DD여야 한다: "${date}"`);
	}
	const body = githubSlug(String(title).trim());
	if (body === '') {
		throw new Error(`제목에서 슬러그로 남는 글자가 없다: "${title}"`);
	}
	return `${date}-${body}`;
}

/** YAML 큰따옴표 스칼라. 콜론·따옴표가 든 제목도 그대로 통과한다. */
function yamlString(value) {
	return JSON.stringify(String(value));
}

/**
 * 초안 한 장.
 *
 * `category`와 `tags`는 좌표를 정하는 입력이다 — 각도가 카테고리 호와 태그 유사도에서
 * 나오기 때문에, 이 둘은 좌표가 박히기 전(첫 `npm run dev`·`npm run build` 전)에
 * 정해져 있어야 한다. 그래서 템플릿에도 빈칸이 아니라 실제 값이 들어간다.
 */
export function renderDraft({ title, date, category, tags = [], series, episode, description }) {
	const lines = [
		'---',
		`title: ${yamlString(title)}`,
		`date: ${date}`,
		`category: ${category}`,
		`tags: [${tags.map(yamlString).join(', ')}]`,
	];
	if (series !== undefined) {
		lines.push(`series: ${yamlString(series)}`);
		// 생략하면 시리즈 안에서 날짜순으로 매겨진다 — 굳이 박을 때만 적는다.
		if (episode !== undefined) lines.push(`episode: ${episode}`);
	}
	if (description !== undefined) lines.push(`description: ${yamlString(description)}`);
	lines.push('---', '', '');

	return lines.join('\n');
}
