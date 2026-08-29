/**
 * 글 화면의 자(尺) — 픽셀 정본 = `~/repo/blog-screens/Post.dc.html`.
 *
 * 세 덩어리로 나뉜다: 머리(빛구멍 · 제목 · 이 글의 좌표) → 본문 → 꼬리(가까운 글 · 수평선 · 바다).
 * 머리와 꼬리는 SVG라 좌표계가 있고, 본문은 그냥 글이라 CSS가 맡는다.
 *
 * 정본 재현은 `test/stage/post.test.ts`가 지킨다.
 */
import { RADIUS_MAX, RADIUS_MIN } from '../coords/constants.ts';
import type { Point } from '../coords/types.ts';

/** 머리 — 빛구멍은 목록 화면과 같은 자리(350, 20, r95)다. */
export const HEAD = {
	height: 300,
	/** ← 목록 */
	back: { x: 24, y: 34 },
	/** 빛구멍 안 카테고리명. 목록 화면과 달리 언제나 한 줄이다. */
	category: { x: 350, y: 62, size: 20 },
	/**
	 * 제목은 아래에서 쌓는다 — 마지막 줄이 언제나 226에 앉아야
	 * 그 아래 메타(258)가 줄 수와 상관없이 제자리를 지킨다.
	 */
	title: { last: 226, gap: 34, size: 25, maxLines: 3 },
	meta: 258,
} as const;

/** 제목 줄 수 → 기준선. 두 줄이면 정본의 [192, 226]. */
export function titleBaselines(lines: number): number[] {
	return Array.from(
		{ length: Math.max(1, lines) },
		(_, i) => HEAD.title.last - (Math.max(1, lines) - 1 - i) * HEAD.title.gap,
	);
}

/**
 * 우상단 "이 글의 좌표" 미니맵.
 * 윤곽 원이 가장 바깥 나이테(RADIUS_MAX), 안쪽 끝이 가장 안쪽 나이테(RADIUS_MIN)다.
 * `inner`는 정본이 손으로 찍어둔 점 하나(262° · r163 → 미니맵 반지름 30)에서 역산했다.
 */
export const MINIMAP = {
	cx: 640,
	cy: 62,
	r: 38,
	inner: 24,
	dot: 3,
	captionY: 116,
	captionSize: 9.5,
} as const;

export function minimapDot(placement: { angle: number; radius: number }): Point {
	const a = (placement.angle * Math.PI) / 180;
	const t = (placement.radius - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN);
	const r = MINIMAP.inner + (MINIMAP.r - MINIMAP.inner) * Math.max(0, Math.min(1, t));
	return { x: MINIMAP.cx + r * Math.cos(a), y: MINIMAP.cy + r * Math.sin(a) };
}

/** 시리즈 스트립의 별자리 미니맵 — 정본의 98×64 상자와 여백. */
export const STRIP = { w: 98, h: 64, padX: 16, padY: 10 } as const;

/**
 * 별자리를 스트립 상자에 눕힌다. 무대에서의 모양만 남기고 크기는 버린다 —
 * 축마다 따로 늘여 상자를 꽉 채우므로 회차 사이의 간격 비율만 보인다.
 * 한 점짜리 별자리(멤버 1명)나 일직선은 그 축의 한가운데에 놓는다.
 */
export function stripPoints(nodes: readonly Point[]): Point[] {
	if (nodes.length === 0) return [];

	const spread = (values: number[], pad: number, size: number) => {
		const min = Math.min(...values);
		const max = Math.max(...values);
		const span = max - min;
		if (span === 0) return values.map(() => size / 2);
		return values.map((v) => pad + ((v - min) / span) * (size - 2 * pad));
	};

	const xs = spread(
		nodes.map((node) => node.x),
		STRIP.padX,
		STRIP.w,
	);
	const ys = spread(
		nodes.map((node) => node.y),
		STRIP.padY,
		STRIP.h,
	);
	return nodes.map((_, i) => ({ x: xs[i]!, y: ys[i]! }));
}

/** 꼬리 — 가까운 글 목록, 수평선, 그 아래 밴드 바다. */
const TAIL = {
	label: 24,
	firstRow: 54,
	stride: 34,
	dotX: 56,
	dotR: 3,
	textX: 76,
	titleDy: 4,
	/** 가까운 글이 있을 때와 없을 때의 수평선 자리. */
	horizon: 200,
	bareHorizon: 40,
	/** 수평선 아래 바다가 차지하는 높이. */
	sea: 200,
	/** 정본 바다 그림에서 수평선에 해당하는 y. 여기를 수평선에 맞춰 끌어올린다. */
	seaBase: 590,
} as const;

export interface NeighborRow {
	dot: number;
	title: number;
}

export interface PostTail {
	label: number;
	rows: NeighborRow[];
	horizon: number;
	/** 바다 그림을 통째로 올리는 양(음수). */
	seaShift: number;
	height: number;
}

/** 가까운 글 편수 → 꼬리 배치. 없으면 목록 없이 수평선부터 시작한다. */
export function postTail(count: number): PostTail {
	const rows = Array.from({ length: count }, (_, i) => {
		const dot = TAIL.firstRow + i * TAIL.stride;
		return { dot, title: dot + TAIL.titleDy };
	});
	const horizon = count > 0 ? TAIL.horizon : TAIL.bareHorizon;
	return {
		label: TAIL.label,
		rows,
		horizon,
		seaShift: horizon - TAIL.seaBase,
		height: horizon + TAIL.sea,
	};
}

/** 꼬리에 몇 편까지 실을지. 정본이 세 줄이고, 그 아래가 바로 수평선이다. */
export const NEIGHBORS_SHOWN = 3;

export const TAIL_METRICS = TAIL;
