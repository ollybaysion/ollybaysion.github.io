/**
 * 시리즈 목록 화면의 자(尺) — 픽셀 정본 = `~/repo/blog-screens/SeriesList.dc.html`.
 *
 * 메인의 별자리는 좌표가 만든 모양이라 회차끼리 멀고 가깝고가 다 다르지만,
 * 시리즈 목록은 **읽는 순서**만 보여주는 화면이다. 그래서 여기서는 모양을 버리고
 * 회차를 관통하는 일직선 하나에 점을 같은 간격으로 꿴다(별자리 모양은 메인에서만).
 *
 * 정본 재현은 `test/stage/series.test.ts`가 지킨다.
 */

/** 목록을 관통하는 선과 그 위의 회차 점. 가로 자리는 정본 값. */
const NODE = {
	x: 84,
	r: 4,
	/** 회차 번호 — 선 왼쪽에 오른쪽 정렬로 붙는다. */
	episodeX: 68,
	/** 제목·날짜가 시작하는 자리. */
	textX: 108,
	titleDy: 5,
	dateDy: 24,
} as const;

/** 첫 회차 점. 부제(144) 아래로 한 숨 떨어뜨린 자리다. */
export const FIRST_NODE_Y = 231;
/** 회차 사이 간격. */
export const NODE_STRIDE = 66;
/** 마지막 회차의 날짜 기준선에서 페이지 끝까지. */
export const PAGE_TAIL = 67;

export interface SeriesNode {
	/** 점의 중심 = 그 회차의 기준 y. */
	dot: number;
	title: number;
	date: number;
}

export interface SeriesLayout {
	nodes: SeriesNode[];
	/** 회차를 관통하는 일직선. 회차가 하나뿐이면 관통할 게 없어 null이다. */
	line: string | null;
	height: number;
}

/** 회차 수 → 한 장의 세로 배치. */
export function seriesLayout(count: number): SeriesLayout {
	const nodes = Array.from({ length: Math.max(0, count) }, (_, i) => {
		const dot = FIRST_NODE_Y + i * NODE_STRIDE;
		return { dot, title: dot + NODE.titleDy, date: dot + NODE.dateDy };
	});

	const last = nodes[nodes.length - 1];
	return {
		nodes,
		line:
			nodes.length > 1
				? `M${nodes.map((node) => `${NODE.x.toFixed(1)},${node.dot.toFixed(1)}`).join(' L')}`
				: null,
		height: (last ? last.date : FIRST_NODE_Y) + PAGE_TAIL,
	};
}

/** 정본이 부제에 적어두는 한 줄. 편수만 갈아끼운다. */
export function seriesSubtitle(count: number): string {
	return `연재순 · ${count}화 · 사전에 정해진 목록`;
}

export const NODE_METRICS = NODE;
