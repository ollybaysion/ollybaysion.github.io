/**
 * 쓰기 화면의 손 — `src/pages/write.astro`가 그린 판을 움직인다.
 *
 * **계산은 하나도 새로 짓지 않는다.** 슬러그와 frontmatter는 `npm run new`가 쓰는
 * `draft.mjs`, 읽는 시간은 목록이 쓰는 `reading.ts`, 모델이 읽는 글과 지문은
 * `embed.ts`·`hash.ts`가 낸다. 화면이 말하는 값과 파이프라인이 박는 값이 갈리면
 * 이 화면은 거짓말이 되므로, 빌려 쓸 수 있는 건 전부 빌려 쓴다.
 *
 * 정적 사이트라 파일은 못 쓴다. 여기서 나가는 길은 셋이다 —
 * 내려받기 · 클립보드 · GitHub의 새 파일 화면(주소에 본문을 실어 보낸다).
 */
import { marked } from 'marked';
import { draftSlug, localDate, renderDraft } from '../../scripts/lib/draft.mjs';
import { embedInput } from '../lib/coords/embed.ts';
import { fingerprint, normalizeTags } from '../lib/coords/hash.ts';
import { readingMinutes } from '../lib/stage/reading.ts';

interface PostSeed {
	slug: string;
	title: string;
	date: string;
	category: string;
	tags: string[];
	series: string;
	episode: number | null;
	description: string;
	body: string;
}

interface WriteData {
	repo: string;
	branch: string;
	posts: PostSeed[];
	/** 좌표가 박힌 슬러그 → 각도. 여기 있으면 자리는 이미 정해진 글이다. */
	placed: Record<string, number>;
	/** 벡터를 뜬 시점의 지문. 지금 지문과 다르면 글이 그 뒤에 바뀐 것이다. */
	fingerprints: Record<string, string>;
	categories: Record<string, { arc: [number, number]; base: string; deep: string }>;
}

interface Doc {
	title: string;
	date: string;
	category: string;
	tags: string[];
	series: string;
	episode: number | undefined;
	description: string;
	body: string;
}

/** 초안 보관 자리. 글 하나에 한 칸씩 쓴다 — 새 글은 `_new`. */
const DRAFT_KEY = 'write:draft:';
const THEME_KEY = 'write:theme';
const TAB_KEY = 'write:tab';
const OPEN_KEY = 'write:open';

/**
 * GitHub 새 파일 화면은 본문을 주소에 실어 보낸다. 주소가 길면 서버가 끊으므로
 * 이 길이를 넘으면 본문 없이 파일 이름만 보내고 "복사해서 붙여라"로 안내한다.
 */
const URL_BUDGET = 6000;

const CONTENT_DIR = 'src/content/blog';

const root = document.querySelector<HTMLElement>('[data-write]');
if (root) start(root);

function start(root: HTMLElement): void {
	const seed = root.querySelector('[data-write-data]')?.textContent;
	if (!seed) return;
	const data = JSON.parse(seed) as WriteData;

	const q = <T extends Element>(selector: string): T => {
		const found = root.querySelector<T>(selector);
		if (!found) throw new Error(`쓰기 화면에 ${selector}가 없다.`);
		return found;
	};

	const fields = {
		title: q<HTMLInputElement>('[data-f="title"]'),
		date: q<HTMLInputElement>('[data-f="date"]'),
		category: q<HTMLInputElement>('[data-f="category"]'),
		description: q<HTMLInputElement>('[data-f="description"]'),
		tags: q<HTMLInputElement>('[data-f="tags"]'),
		series: q<HTMLInputElement>('[data-f="series"]'),
		episode: q<HTMLInputElement>('[data-f="episode"]'),
		body: q<HTMLTextAreaElement>('[data-f="body"]'),
	};

	const tabs = [...root.querySelectorAll<HTMLButtonElement>('[data-tab]')];
	const panes = [...root.querySelectorAll<HTMLElement>('[data-pane]')];

	const openSelect = q<HTMLSelectElement>('[data-open]');
	const preview = q<HTMLElement>('[data-preview]');
	const sourceOut = q<HTMLElement>('[data-source]');
	const embedOut = q<HTMLElement>('[data-embed]');
	const tagPreview = q<HTMLElement>('[data-tag-preview]');
	const warnBox = q<HTMLElement>('[data-warn]');
	const savedOut = q<HTMLElement>('[data-saved]');
	const githubLink = q<HTMLAnchorElement>('[data-act="github"]');

	const stat = {
		slug: q<HTMLElement>('[data-stat-slug]'),
		chars: q<HTMLElement>('[data-stat-chars]'),
		minutes: q<HTMLElement>('[data-stat-min]'),
		fingerprint: q<HTMLElement>('[data-stat-fp]'),
	};

	const names = Object.keys(data.categories);
	const bySlug = new Map(data.posts.map((post) => [post.slug, post]));

	/** 지금 편집 중인 글의 원래 슬러그. 새 글이면 null. */
	let opened: string | null = null;
	/** 마지막으로 그린 마크다운 — 내려받기·복사가 다시 만들지 않게 들고 있는다. */
	let markdown = '';
	let slug = '';
	let saveTimer = 0;

	marked.setOptions({ gfm: true, breaks: false });

	// ── 읽기 ────────────────────────────────────────────────

	function read(): Doc {
		const episode = fields.episode.value.trim();
		return {
			title: fields.title.value.trim(),
			date: fields.date.value || localDate(new Date()),
			category: fields.category.value.trim(),
			tags: fields.tags.value
				.split(',')
				.map((tag) => tag.trim())
				.filter((tag) => tag !== ''),
			series: fields.series.value.trim(),
			episode: episode === '' ? undefined : Number(episode),
			description: fields.description.value.trim(),
			body: fields.body.value,
		};
	}

	/** `npm run new`가 놓는 frontmatter + 본문. 두 곳의 글자가 같아야 한다. */
	function toMarkdown(doc: Doc): string {
		const series = doc.series === '' ? undefined : doc.series;
		return (
			renderDraft({
				title: doc.title,
				date: doc.date,
				category: doc.category,
				tags: doc.tags,
				series,
				episode: series !== undefined ? doc.episode : undefined,
				description: doc.description === '' ? undefined : doc.description,
			}) + doc.body
		);
	}

	/** 모델에 들어가는 글. `readPosts`가 빈 소개를 undefined로 접는 것까지 맞춘다. */
	function toEmbedInput(doc: Doc): string {
		return embedInput({
			title: doc.title,
			tags: doc.tags,
			description: doc.description === '' ? undefined : doc.description,
			body: doc.body,
		});
	}

	function slugFor(doc: Doc): string {
		try {
			return draftSlug(doc.title, doc.date);
		} catch {
			return '';
		}
	}

	// ── 그리기 ──────────────────────────────────────────────

	function render(): void {
		const doc = read();
		slug = slugFor(doc);
		markdown = toMarkdown(doc);
		const model = toEmbedInput(doc);
		const source = fingerprint(model);

		preview.innerHTML =
			doc.body.trim() === ''
				? '<p class="w-prose-empty">본문이 비어 있다.</p>'
				: (marked.parse(doc.body, { async: false }) as string);
		sourceOut.textContent = markdown;
		embedOut.textContent = model;

		stat.slug.textContent = slug === '' ? '—' : slug;
		stat.chars.textContent = doc.body.length.toLocaleString('ko-KR');
		stat.minutes.textContent = String(readingMinutes(doc.body));
		stat.fingerprint.textContent = source;

		const normalized = normalizeTags(doc.tags);
		tagPreview.innerHTML = '';
		for (const tag of normalized) {
			const chip = document.createElement('span');
			chip.textContent = tag;
			tagPreview.append(chip);
		}

		fields.episode.disabled = doc.series === '';

		// 강조색은 카테고리를 따라간다 — 이 글이 앉을 호의 색이다.
		const chosen = data.categories[doc.category];
		if (chosen) document.documentElement.style.setProperty('--w-accent', chosen.base);

		paintWarnings(doc, source);
		paintGithub();
		queueSave();
	}

	/**
	 * 되돌릴 수 없는 일만 경고한다 — 좌표가 이미 박혔거나, 박히는 규칙 때문에
	 * 지금 고쳐도 반영되지 않는 경우다.
	 */
	function paintWarnings(doc: Doc, source: string): void {
		const lines: [string, string][] = [];

		if (doc.title === '') {
			lines.push(['제목', '제목이 없으면 슬러그가 안 나온다 — 파일 이름을 못 짓는다.']);
		} else if (slug === '') {
			lines.push(['슬러그', `"${doc.title}"에서 슬러그로 남는 글자가 없다. 기호를 줄여볼 것.`]);
		}

		if (doc.category === '') {
			lines.push(['카테고리', '카테고리가 없으면 각도를 못 정한다 — 빌드가 죽는다.']);
		} else if (!(doc.category in data.categories)) {
			lines.push([
				'등록 안 된 카테고리',
				`"${doc.category}"는 등록부에 없다. src/config/categories.json에 호와 색을 먼저 등록하지 않으면 빌드가 죽는다. 원은 이미 ${names.join('·')} 네 호로 다 차 있어서, 새 카테고리는 기존 호를 쪼개는 일이다 — 이미 박힌 글의 각도가 가리키는 주제가 달라진다.`,
			]);
		}

		if (opened !== null && slug !== '' && slug !== opened) {
			lines.push([
				'슬러그 바뀜',
				`${opened} → ${slug}. 슬러그가 바뀌면 새 글이다 — 옛 좌표는 원장에 남고 이 글은 자리를 새로 받는다.`,
			]);
		}

		if (slug !== '' && slug !== opened && slug in data.placed) {
			lines.push([
				'원장에 있음',
				`${slug}는 이미 좌표가 박힌 슬러그다(${data.placed[slug]?.toFixed(1)}°). 좌표는 다시 계산되지 않아 옛 자리를 그대로 쓴다.`,
			]);
		}

		if (opened !== null && data.fingerprints[opened] !== undefined) {
			const baked = data.fingerprints[opened];
			if (baked !== source) {
				lines.push([
					'벡터 안 뜸',
					`벡터를 뜬 뒤로 글이 바뀌었다(${baked} → ${source}). 벡터는 그대로 두므로 이 글의 자리는 옛 글이 정한 자리다. 다시 받으려면 vectors.json에서 그 줄을 지우고 npm run embed.`,
				]);
			}
		}

		if (opened === null && slug !== '') {
			lines.push([
				'아직 자리 없음',
				'새 글이다. 좌표는 로컬에서 npm run dev(또는 build)를 한 번 돌려야 박힌다 — 그때의 본문이 그 글의 벡터가 된다.',
			]);
		}

		warnBox.innerHTML = '';
		for (const [tag, text] of lines) {
			const row = document.createElement('div');
			const label = document.createElement('b');
			label.textContent = `${tag} · `;
			row.append(label, document.createTextNode(text));
			warnBox.append(row);
		}
		warnBox.hidden = lines.length === 0;
	}

	/**
	 * GitHub로 넘기는 길. 새 글은 새 파일 화면에 본문까지 실어 보내고,
	 * 이미 있는 글은 그 파일의 편집 화면으로 보낸다(본문은 거기 이미 있다).
	 */
	function paintGithub(): void {
		if (slug === '') {
			githubLink.setAttribute('aria-disabled', 'true');
			githubLink.href = '#';
			githubLink.textContent = 'GitHub에서 커밋';
			return;
		}
		githubLink.removeAttribute('aria-disabled');

		const path = `${CONTENT_DIR}/${slug}.md`;
		if (opened !== null && slug === opened) {
			githubLink.href = `https://github.com/${data.repo}/edit/${data.branch}/${path}`;
			githubLink.textContent = 'GitHub에서 이 파일 열기';
			return;
		}

		const value = encodeURIComponent(markdown);
		const base = `https://github.com/${data.repo}/new/${data.branch}?filename=${encodeURIComponent(path)}`;
		if (value.length <= URL_BUDGET) {
			githubLink.href = `${base}&value=${value}`;
			githubLink.textContent = 'GitHub에 새 파일로';
		} else {
			githubLink.href = base;
			githubLink.textContent = 'GitHub에 새 파일로 (본문은 붙여넣기)';
		}
	}

	// ── 담기 ────────────────────────────────────────────────

	function docKey(): string {
		return DRAFT_KEY + (opened ?? '_new');
	}

	function queueSave(): void {
		window.clearTimeout(saveTimer);
		saveTimer = window.setTimeout(save, 400);
	}

	function save(): void {
		try {
			localStorage.setItem(docKey(), JSON.stringify(read()));
			localStorage.setItem(OPEN_KEY, opened ?? '');
			const now = new Date();
			savedOut.textContent = `저장됨 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
		} catch {
			savedOut.textContent = '이 브라우저는 초안을 못 담는다';
		}
	}

	function stored(key: string): Doc | null {
		try {
			const raw = localStorage.getItem(DRAFT_KEY + key);
			return raw === null ? null : (JSON.parse(raw) as Doc);
		} catch {
			return null;
		}
	}

	// ── 불러오기 ────────────────────────────────────────────

	function fill(doc: Doc): void {
		fields.title.value = doc.title ?? '';
		fields.date.value = doc.date ?? localDate(new Date());
		fields.description.value = doc.description ?? '';
		fields.tags.value = (doc.tags ?? []).join(', ');
		fields.series.value = doc.series ?? '';
		fields.episode.value = doc.episode === undefined || doc.episode === null ? '' : String(doc.episode);
		fields.body.value = doc.body ?? '';
		// 등록 안 된 이름이라도 지운 채로 되돌리지 않는다 — 새 카테고리를 벼르는 중일 수 있다.
		fields.category.value = doc.category?.trim() || (names[0] ?? '');
	}

	function blank(): Doc {
		return {
			title: '',
			date: localDate(new Date()),
			category: names[0] ?? '개발',
			tags: [],
			series: '',
			episode: undefined,
			description: '',
			body: '',
		};
	}

	function fromPost(post: PostSeed): Doc {
		return {
			title: post.title,
			date: post.date,
			category: post.category,
			tags: post.tags,
			series: post.series,
			episode: post.episode ?? undefined,
			description: post.description,
			body: post.body,
		};
	}

	/** 담아둔 초안이 있으면 그걸 쓰고, 없으면 박혀 있는 글(또는 빈 장)을 편다. */
	function open(key: string, keepDraft = true): void {
		if (saveTimer) {
			window.clearTimeout(saveTimer);
			save();
		}
		opened = key === '' ? null : key;
		const draft = keepDraft ? stored(opened ?? '_new') : null;
		const post = opened === null ? null : bySlug.get(opened);
		fill(draft ?? (post ? fromPost(post) : blank()));
		openSelect.value = key;
		render();
	}

	// ── 내보내기 ────────────────────────────────────────────

	function download(): void {
		if (slug === '') return;
		const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `${slug}.md`;
		link.click();
		URL.revokeObjectURL(url);
	}

	async function copy(text: string, done: string): Promise<void> {
		try {
			await navigator.clipboard.writeText(text);
			savedOut.textContent = done;
		} catch {
			savedOut.textContent = '복사가 막혔다 — 원문 탭에서 골라서 복사할 것';
		}
	}

	/** `npm run new`를 그대로 칠 수 있게 만든 한 줄. 옵션 앞의 `--`까지 붙인다. */
	function command(doc: Doc): string {
		const parts = [`npm run new ${JSON.stringify(doc.title)}`, '--', `-c ${doc.category}`];
		if (doc.tags.length > 0) parts.push(`-t ${JSON.stringify(doc.tags.join(','))}`);
		if (doc.series !== '') {
			parts.push(`-s ${JSON.stringify(doc.series)}`);
			if (doc.episode !== undefined) parts.push(`--episode ${doc.episode}`);
		}
		if (doc.description !== '') parts.push(`-d ${JSON.stringify(doc.description)}`);
		if (doc.date !== localDate(new Date())) parts.push(`--date ${doc.date}`);
		return parts.join(' ');
	}

	// ── 판 바꾸기 ───────────────────────────────────────────

	function showTab(name: string): void {
		for (const tab of tabs) {
			tab.setAttribute('aria-selected', String(tab.dataset.tab === name));
		}
		for (const pane of panes) {
			pane.hidden = pane.dataset.pane !== name;
		}
		try {
			localStorage.setItem(TAB_KEY, name);
		} catch {
			/* 담을 데가 없으면 이번 화면에서만 산다. */
		}
	}

	function setTheme(theme: 'dark' | 'light'): void {
		document.documentElement.dataset.writeTheme = theme;
		const icon = root.querySelector('[data-theme-icon]');
		if (icon) icon.textContent = theme === 'light' ? '☀' : '☾';
		try {
			localStorage.setItem(THEME_KEY, theme);
		} catch {
			/* 밝기를 못 담아도 화면은 돈다. */
		}
	}

	// ── 손잡이 ──────────────────────────────────────────────

	for (const input of Object.values(fields)) {
		input.addEventListener('input', render);
	}

	for (const tab of tabs) {
		tab.addEventListener('click', () => showTab(tab.dataset.tab ?? 'preview'));
	}

	openSelect.addEventListener('change', () => open(openSelect.value));

	root.querySelector('[data-theme-toggle]')?.addEventListener('click', () => {
		setTheme(document.documentElement.dataset.writeTheme === 'light' ? 'dark' : 'light');
	});

	root.querySelector('[data-view-toggle]')?.addEventListener('click', () => {
		root.dataset.view = root.dataset.view === 'side' ? 'edit' : 'side';
	});

	q<HTMLElement>('[data-act="download"]').addEventListener('click', download);
	q<HTMLElement>('[data-act="copy"]').addEventListener('click', () => {
		void copy(markdown, '마크다운을 복사했다');
	});
	q<HTMLElement>('[data-act="command"]').addEventListener('click', () => {
		void copy(command(read()), '명령을 복사했다');
	});
	q<HTMLElement>('[data-act="reset"]').addEventListener('click', () => {
		if (!window.confirm('이 초안을 비운다. 되돌릴 수 없다.')) return;
		try {
			localStorage.removeItem(docKey());
		} catch {
			/* 못 지워도 화면은 비운다. */
		}
		open(opened ?? '', false);
	});

	githubLink.addEventListener('click', () => {
		// 주소에 못 실은 긴 글은 클립보드로 들려 보낸다 — 가서 붙이기만 하면 되게.
		if (githubLink.textContent?.includes('붙여넣기')) void copy(markdown, '길어서 클립보드에 담았다');
	});

	document.addEventListener('keydown', (event) => {
		if (!(event.metaKey || event.ctrlKey) || event.key !== 's') return;
		event.preventDefault();
		save();
		download();
	});

	// ── 첫 화면 ─────────────────────────────────────────────

	let theme: 'dark' | 'light' = 'dark';
	let tab = 'preview';
	let last = '';
	try {
		theme = localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
		tab = localStorage.getItem(TAB_KEY) ?? 'preview';
		last = localStorage.getItem(OPEN_KEY) ?? '';
	} catch {
		/* 담아둔 게 없으면 기본값으로 연다. */
	}

	setTheme(theme);
	showTab(tabs.some((node) => node.dataset.tab === tab) ? tab : 'preview');
	open(last !== '' && bySlug.has(last) ? last : '');
}
