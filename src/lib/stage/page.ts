/**
 * 읽는 화면의 판(版) — 넓은 판과 좁은 판.
 *
 * 목록·글·시리즈는 모두 세로로 흐르는 한 장이고, 그 장의 자는 폭 하나에서 나온다:
 * 정본은 700이고, 폰은 390이다.
 *
 * 왜 무대처럼 잘라 확대하지 않는가 — 무대는 그림이라 가장자리를 잘라도 되지만
 * 읽는 화면은 글줄이 여백 사이에 앉아 있어서 자르면 글자가 잘린다. 그래서 판을 바꾼다:
 * 같은 크기의 활자를 좁은 자에 다시 앉히면, 화면에 찍히는 글자는 그만큼 커진다
 * (390 판을 360px 폰에 놓으면 한 단위가 0.92px, 700 판이면 0.51px였다).
 *
 * 두 판은 **함께 그려져** CSS 미디어 쿼리가 하나를 고른다 — 자바스크립트가 죽어도
 * 폰에서는 좁은 판이 선다.
 */

/** 좁은 판으로 갈아타는 화면 폭(px). 이 아래는 700 판이 0.92px/단위를 못 지킨다. */
export const NARROW_AT = 720;

export interface Edition {
	/** 판 이름 — 마크업의 class·id 접두사로도 쓴다. */
	name: 'wide' | 'narrow';
	/** 이 판의 정본 폭. 화면이 넓으면 viewBox가 이 폭 좌우로 벌어진다. */
	w: number;
	/** 글줄이 앉는 좌우 끝. */
	edgeL: number;
	edgeR: number;
	/** 화면 위쪽에 반쯤 박힌 빛구멍 — 모든 화면에 나오는 그 원이다. */
	hole: { cx: number; cy: number; r: number };
	/** 빛구멍을 감싸는 천·번짐·속 — 정본 그대로다(판이 좁아도 빛은 같은 빛이다). */
	halo: { field: number; bloom: number; core: number };
	/** 필름 프레임 세로선 — 폭 대비 자리(17% · 87%)를 지킨다. */
	band: [number, number];
	/** ← 메인 · ← 목록이 앉는 자리. 글줄보다 한 단 밖이다. */
	back: { x: number; y: number };
}

/** 정본 — `~/repo/blog-screens/*.dc.html`이 박아둔 700 열. */
export const WIDE: Edition = {
	name: 'wide',
	w: 700,
	edgeL: 52,
	edgeR: 648,
	hole: { cx: 350, cy: 20, r: 95 },
	halo: { field: 150, bloom: 200, core: 48 },
	band: [118, 606],
	back: { x: 24, y: 34 },
};

/**
 * 좁은 판 — 폰 한 장.
 *
 * 390은 폰 한 대의 논리 폭이다(갤럭시 360 · 아이폰 390). 여백은 정본의 비율(7.4%)을
 * 그대로 줄인 6.2%, 프레임선도 같은 비율 자리다. 빛구멍만 정본 크기 그대로 둔다 —
 * 판이 좁아지면 원이 화면을 더 차지하는데, 그게 폰에서 메인 무대가 보이는 모습이다.
 */
export const NARROW: Edition = {
	name: 'narrow',
	w: 390,
	edgeL: 24,
	edgeR: 366,
	hole: { cx: 195, cy: 20, r: 95 },
	halo: { field: 150, bloom: 200, core: 48 },
	band: [66, 338],
	back: { x: 14, y: 34 },
};

/** 그려지는 순서대로. 마크업은 이 둘을 다 찍고 CSS가 하나를 고른다. */
export const EDITIONS: Edition[] = [WIDE, NARROW];

/** 글줄이 쓸 수 있는 폭. */
export function column(edition: Edition): number {
	return edition.edgeR - edition.edgeL;
}
