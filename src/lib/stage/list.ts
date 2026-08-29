/**
 * 목록 화면의 자(尺) — 픽셀 정본 = `~/repo/blog-screens/ListA.dc.html`.
 *
 * 정본은 글 8편짜리 한 장을 손으로 박아뒀다. 여기서는 그 한 장에서 규칙만 뽑아
 * 편수가 몇이든 같은 리듬으로 흐르게 한다(정본 재현은 `test/stage/list.test.ts`).
 *
 * 세로는 흐른다: 최근 → 주요 → 전체. 각 단은 앞 단이 끝난 자리에서 정해진 간격만큼
 * 내려앉고, 단이 비면(글이 적으면) 통째로 빠지고 뒤가 당겨 올라온다.
 */

export interface Rect {
	x: number;
	y: number;
	w: number;
	h: number;
}

/** 정본 좌표계. 가로는 이 700을 기준으로 화면 비율만큼 벌어진다(메인과 같은 규칙). */
export const LIST_W = 700;
export const EDGE_L = 52;
export const EDGE_R = 648;
/** 화면 위쪽에 반쯤 박힌 빛구멍. 모든 화면에 나오는 그 원이다. */
export const HOLE = { cx: 350, cy: 20, r: 95 };
/** 필름 프레임 세로선 — 정본의 폭 대비 위치(17% · 87%). */
export const BAND = [118, 606];
export const BACK_LINK = { x: 24, y: 34 };
export const SUBTITLE_Y = 144;
/** 첫 단(최근) 머리말 자리. */
export const FIRST_SECTION_Y = 182;
/** 마지막 구분선에서 페이지 끝까지. */
export const PAGE_TAIL = 62;

/**
 * 원 안 카테고리명 — 3자까지 한 줄 38px, 4자부터 두 줄 26px.
 * 두 줄일 때의 기준선(48 · 80)과 크기는 정본 값이고, 한 줄일 때의 기준선은
 * 두 줄 덩어리와 시각 중심이 같아지는 자리로 거기서 끌어낸다.
 */
const TITLE_TOP_BASELINE = 48;
const TITLE_LINE_GAP = 32;
const TITLE_ASCENT = 0.73;
const TITLE_ONE_LINE = 38;
const TITLE_TWO_LINE = 26;
const TITLE_BREAK_AT = 4;

/** 두 줄 덩어리의 잉크 중심 — 한 줄짜리가 맞춰 앉는 자리. */
const TITLE_INK_CENTER =
	(TITLE_TOP_BASELINE - TITLE_TWO_LINE * TITLE_ASCENT + TITLE_TOP_BASELINE + TITLE_LINE_GAP) / 2;

export interface CircleTitle {
	lines: string[];
	size: number;
	baselines: number[];
}

/**
 * 이름을 원 안에 앉힌다. 두 줄이 되면 띄어쓰기 중 한가운데에 가장 가까운 데서 끊고,
 * 띄어쓰기가 없으면 글자 수 절반에서 끊는다. 어느 쪽이든 글자 덩어리의 시각 중심은
 * 정본의 두 줄 블록과 같은 자리(y≈54.5)에 온다.
 */
export function circleTitle(name: string): CircleTitle {
	const chars = [...name.trim()];

	if (chars.length <= TITLE_BREAK_AT - 1) {
		const size = TITLE_ONE_LINE;
		return {
			lines: [chars.join('')],
			size,
			baselines: [TITLE_INK_CENTER + (size * TITLE_ASCENT) / 2],
		};
	}

	return {
		lines: splitInTwo(chars.join('')),
		size: TITLE_TWO_LINE,
		baselines: [TITLE_TOP_BASELINE, TITLE_TOP_BASELINE + TITLE_LINE_GAP],
	};
}

function splitInTwo(name: string): [string, string] {
	const middle = [...name].length / 2;
	let at = -1;
	for (let i = 0; i < name.length; i += 1) {
		if (name[i] !== ' ') continue;
		if (at === -1 || Math.abs(i - middle) < Math.abs(at - middle)) at = i;
	}
	if (at !== -1) return [name.slice(0, at).trim(), name.slice(at + 1).trim()];

	const chars = [...name];
	const cut = Math.ceil(chars.length / 2);
	return [chars.slice(0, cut).join(''), chars.slice(cut).join('')];
}

/** 썸네일 안의 미니 무대 — 빛구멍 하나와 밴드 바다 두 겹. 전부 상자 크기의 비율이다. */
const THUMB_HOLE = { cx: 0.3, cy: 0.34, r: 0.16 };
const THUMB_WAVES = [
	{ y0: 0.66, c1x: 0.3, c1y: 0.58, c2x: 0.55, c2y: 0.74, y1: 0.62, opacity: 0.16 },
	{ y0: 0.82, c1x: 0.35, c1y: 0.74, c2x: 0.6, c2y: 0.9, y1: 0.78, opacity: 0.26 },
];

export interface ThumbScene {
	hole: { cx: number; cy: number; r: number };
	waves: { d: string; opacity: number }[];
}

export function thumbScene(rect: Rect): ThumbScene {
	const right = rect.x + rect.w;
	const bottom = rect.y + rect.h;
	const at = (t: number) => rect.y + rect.h * t;

	return {
		hole: {
			cx: rect.x + rect.w * THUMB_HOLE.cx,
			cy: at(THUMB_HOLE.cy),
			r: rect.h * THUMB_HOLE.r,
		},
		waves: THUMB_WAVES.map((wave) => ({
			opacity: wave.opacity,
			d:
				`M${rect.x},${at(wave.y0)} ` +
				`C${rect.x + rect.w * wave.c1x},${at(wave.c1y)} ` +
				`${rect.x + rect.w * wave.c2x},${at(wave.c2y)} ` +
				`${right},${at(wave.y1)} ` +
				`L${right},${bottom} L${rect.x},${bottom} Z`,
		})),
	};
}

/** 최근 1편 — 큰 썸네일 왼쪽, 제목·메타·소개 오른쪽. */
const LATEST = {
	labelToThumb: 17,
	thumb: { w: 280, h: 170 },
	textX: 356,
	titleDy: [30, 54],
	metaDy: 80,
	descDy: [104, 123, 142],
};
/** 최근 다음 단까지의 간격(썸네일 아래에서 잰다). */
const AFTER_LATEST = 56;

/** 주요 2편 — 나란한 썸네일 둘, 각각 아래에 제목 두 줄과 날짜. */
const FEATURED = {
	labelToThumb: 18,
	thumb: { w: 286, h: 118 },
	xs: [52, 362],
	titleDy: [142, 161],
	dateDy: 182,
};
/** 주요 다음 단까지의 간격(날짜 기준선에서 잰다). */
const AFTER_FEATURED = 52;

/** 전체 — 점 하나에 제목·메타 한 줄씩, 아래 구분선. */
const ROW = { labelToFirst: 39, stride: 56, dotX: 56, textX: 80, titleDy: 5, metaDy: 24, ruleDy: 38 };

export interface LatestBlock {
	label: number;
	thumb: Rect;
	textX: number;
	title: number[];
	meta: number;
	desc: number[];
}

export interface FeaturedCard {
	thumb: Rect;
	title: number[];
	date: number;
}

export interface FeaturedBlock {
	label: number;
	cards: FeaturedCard[];
}

export interface ListRow {
	dot: number;
	title: number;
	meta: number;
	rule: number;
}

export interface RowsBlock {
	label: number;
	rows: ListRow[];
}

export interface ListLayout {
	latest?: LatestBlock;
	featured?: FeaturedBlock;
	rows?: RowsBlock;
	height: number;
}

/**
 * 편수 → 한 장의 세로 배치.
 * `featured`는 최대 2, `rows`는 나머지 전부. 0이면 그 단은 없다.
 */
export function listLayout(counts: { latest: number; featured: number; rows: number }): ListLayout {
	const layout: ListLayout = { height: 0 };
	let y = FIRST_SECTION_Y;
	let bottom = FIRST_SECTION_Y;

	if (counts.latest > 0) {
		const thumb = { x: EDGE_L, y: y + LATEST.labelToThumb, ...LATEST.thumb };
		layout.latest = {
			label: y,
			thumb,
			textX: LATEST.textX,
			title: LATEST.titleDy.map((dy) => thumb.y + dy),
			meta: thumb.y + LATEST.metaDy,
			desc: LATEST.descDy.map((dy) => thumb.y + dy),
		};
		bottom = thumb.y + thumb.h;
		y = bottom + AFTER_LATEST;
	}

	if (counts.featured > 0) {
		const top = y + FEATURED.labelToThumb;
		layout.featured = {
			label: y,
			cards: FEATURED.xs.slice(0, counts.featured).map((x) => ({
				thumb: { x, y: top, ...FEATURED.thumb },
				title: FEATURED.titleDy.map((dy) => top + dy),
				date: top + FEATURED.dateDy,
			})),
		};
		bottom = top + FEATURED.dateDy;
		y = bottom + AFTER_FEATURED;
	}

	if (counts.rows > 0) {
		const first = y + ROW.labelToFirst;
		const rows = Array.from({ length: counts.rows }, (_, i) => {
			const dot = first + i * ROW.stride;
			return {
				dot,
				title: dot + ROW.titleDy,
				meta: dot + ROW.metaDy,
				rule: dot + ROW.ruleDy,
			};
		});
		layout.rows = { label: y, rows };
		bottom = rows[rows.length - 1]!.rule;
	}

	layout.height = bottom + PAGE_TAIL;
	return layout;
}

/** 한 카테고리의 글을 세 단으로 가른다. 서버(기본 상태)와 클라이언트(좌표 반영)가 같이 쓴다. */
export interface Selectable {
	slug: string;
	date: string;
	x: number;
	y: number;
}

export interface Sections<T> {
	latest: T | undefined;
	featured: T[];
	rows: T[];
}

/** 최신 → 슬러그 순. 날짜가 같아도 빌드마다 순서가 흔들리지 않게 슬러그로 묶는다. */
export function byNewest<T extends Selectable>(a: T, b: T): number {
	return Date.parse(b.date) - Date.parse(a.date) || a.slug.localeCompare(b.slug);
}

/** 기준점에서 가까운 순. 같은 거리면 슬러그가 가른다. */
export function byNearest<T extends Selectable>(focus: { x: number; y: number }) {
	return (a: T, b: T): number =>
		Math.hypot(a.x - focus.x, a.y - focus.y) - Math.hypot(b.x - focus.x, b.y - focus.y) ||
		a.slug.localeCompare(b.slug);
}

/**
 * 최근 1편은 언제나 최신 글이고, 주요 2편은 메인에서 고른 자리에서 가장 가까운 글이다.
 * 자리를 안 들고 왔으면(주소만 치고 들어왔으면) 주요도 최신순으로 고른다.
 * 세 단은 서로 겹치지 않는다 — 정본이 8편을 1·2·5로 나눠놓은 그대로다.
 */
export function selectSections<T extends Selectable>(
	posts: readonly T[],
	focus?: { x: number; y: number } | null,
): Sections<T> {
	const newest = [...posts].sort(byNewest);
	const latest = newest[0];
	const rest = newest.slice(1);
	const ranked = focus ? [...rest].sort(byNearest(focus)) : rest;
	const featured = ranked.slice(0, FEATURED.xs.length);
	const chosen = new Set(featured.map((post) => post.slug));
	return { latest, featured, rows: rest.filter((post) => !chosen.has(post.slug)) };
}

export const ROW_METRICS = ROW;
