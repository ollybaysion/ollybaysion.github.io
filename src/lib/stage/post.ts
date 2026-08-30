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
import { type Edition, NARROW, WIDE } from './page.ts';

/** 머리·미니맵·꼬리의 자 — 판마다 한 벌이다(`page.ts`). */
export interface PostMetrics {
	head: {
		height: number;
		/** ← 목록 */
		back: { x: number; y: number };
		/** 빛구멍 안 카테고리명. 목록 화면과 달리 언제나 한 줄이다. */
		category: { x: number; y: number; size: number };
		/**
		 * 제목은 아래에서 쌓는다 — 마지막 줄이 언제나 `last`에 앉아야
		 * 그 아래 메타가 줄 수와 상관없이 제자리를 지킨다.
		 */
		title: { last: number; gap: number; size: number; maxLines: number };
		meta: number;
	};
	/**
	 * 우상단 "이 글의 좌표" 미니맵.
	 * 윤곽 원이 가장 바깥 나이테(RADIUS_MAX), 안쪽 끝이 가장 안쪽 나이테(RADIUS_MIN)다.
	 */
	minimap: {
		cx: number;
		cy: number;
		r: number;
		inner: number;
		dot: number;
		captionY: number;
		captionSize: number;
	};
	/** 꼬리 — 글 목록 덩어리들, 수평선, 그 아래 바다. */
	tail: {
		label: number;
		stride: number;
		dotX: number;
		dotR: number;
		textX: number;
		titleDy: number;
		/** 덩어리 제목에서 그 아래 첫 줄까지. 정본의 24 → 54. */
		labelDy: number;
		/** 앞 덩어리의 마지막 줄에서 다음 덩어리 제목까지. */
		blockGap: number;
		/** 마지막 줄에서 수평선까지. 정본의 122 → 200. */
		rowToHorizon: number;
		/** 실을 글이 하나도 없을 때의 수평선 자리. */
		bareHorizon: number;
		/**
		 * 수평선 아래 바다가 차지하는 높이.
		 *
		 * 무대의 바다는 272(수평선 518 → 바닥 790)다. 꼬리는 그 바다를 이 높이에 눌러 담는다 —
		 * 얕은 바다가 아니라 **같은 바다를 멀리서 본 것**이라야 두 화면이 한 세계로 읽힌다.
		 */
		sea: number;
	};
}

/** 정본 — `Post.dc.html`이 손으로 박아둔 자리. `inner`는 정본의 점(262° · r163)에서 역산했다. */
const WIDE_POST: PostMetrics = {
	head: {
		height: 300,
		back: WIDE.back,
		category: { x: WIDE.hole.cx, y: 62, size: 20 },
		title: { last: 226, gap: 34, size: 25, maxLines: 3 },
		meta: 258,
	},
	minimap: { cx: 640, cy: 62, r: 38, inner: 24, dot: 3, captionY: 116, captionSize: 9.5 },
	tail: {
		label: 24,
		stride: 34,
		dotX: 56,
		dotR: 3,
		textX: 76,
		titleDy: 4,
		labelDy: 30,
		blockGap: 52,
		rowToHorizon: 78,
		bareHorizon: 40,
		sea: 200,
	},
};

/**
 * 좁은 판.
 *
 * 세로 자리(제목이 앉는 226 · 메타 258 · 꼬리 간격)는 그대로다 — 한 화면 안의 리듬이라
 * 판이 좁아진다고 흔들 이유가 없다. 옮겨 앉는 것은 가로뿐이다: 미니맵이 오른쪽 끝으로,
 * 점과 글줄이 좁은 여백으로. 미니맵은 빛구멍과 부딪지 않게 한 치수 작다.
 */
const NARROW_POST: PostMetrics = {
	head: {
		height: 300,
		back: NARROW.back,
		category: { x: NARROW.hole.cx, y: 62, size: 20 },
		title: { last: 226, gap: 34, size: 25, maxLines: 3 },
		meta: 258,
	},
	minimap: { cx: 338, cy: 62, r: 30, inner: 19, dot: 3, captionY: 106, captionSize: 9.5 },
	tail: {
		label: 24,
		stride: 34,
		dotX: 28,
		dotR: 3,
		textX: 48,
		titleDy: 4,
		labelDy: 30,
		blockGap: 52,
		rowToHorizon: 78,
		bareHorizon: 40,
		sea: 200,
	},
};

export function postMetrics(edition: Edition): PostMetrics {
	return edition.name === 'narrow' ? NARROW_POST : WIDE_POST;
}

/** 정본(넓은 판)의 자 — 이름을 쓰던 자리들이 그대로 쓴다. */
export const HEAD = WIDE_POST.head;
export const MINIMAP = WIDE_POST.minimap;

/** 제목 줄 수 → 기준선. 두 줄이면 정본의 [192, 226]. */
export function titleBaselines(lines: number, title = WIDE_POST.head.title): number[] {
	return Array.from(
		{ length: Math.max(1, lines) },
		(_, i) => title.last - (Math.max(1, lines) - 1 - i) * title.gap,
	);
}

export function minimapDot(
	placement: { angle: number; radius: number },
	map = WIDE_POST.minimap,
): Point {
	const a = (placement.angle * Math.PI) / 180;
	const t = (placement.radius - RADIUS_MIN) / (RADIUS_MAX - RADIUS_MIN);
	const r = map.inner + (map.r - map.inner) * Math.max(0, Math.min(1, t));
	return { x: map.cx + r * Math.cos(a), y: map.cy + r * Math.sin(a) };
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

export interface NeighborRow {
	dot: number;
	title: number;
}

/** 제목 하나와 그 아래 줄들. 꼬리는 이런 덩어리를 위에서부터 쌓는다. */
export interface TailBlock {
	label: number;
	rows: NeighborRow[];
}

export interface PostTail {
	label: number;
	rows: NeighborRow[];
	/** "다른 자리에서 닮은 글". 없으면 null이고 수평선이 그만큼 올라온다. */
	discovery: TailBlock | null;
	horizon: number;
	height: number;
}

/** 제목 자리에서 시작하는 덩어리 하나. */
function block(label: number, count: number, tail: PostMetrics['tail']): TailBlock {
	return {
		label,
		rows: Array.from({ length: count }, (_, i) => {
			const dot = label + tail.labelDy + i * tail.stride;
			return { dot, title: dot + tail.titleDy };
		}),
	};
}

/**
 * 실을 글 편수 → 꼬리 배치. 덩어리를 위에서부터 쌓고 마지막 줄 아래에 수평선을 놓는다.
 * 실을 글이 하나도 없으면 목록 없이 수평선부터 시작한다.
 *
 * 세로 자리는 두 판이 같다 — 판이 가르는 건 가로뿐이라 여기 값은 흔들리지 않는다.
 */
export function postTail(
	count: number,
	discoveryCount = 0,
	edition: Edition = WIDE,
): PostTail {
	const TAIL = postMetrics(edition).tail;
	const near = block(TAIL.label, count, TAIL);
	let last = near.rows.at(-1)?.dot ?? null;

	let discovery: TailBlock | null = null;
	if (discoveryCount > 0) {
		discovery = block(
			last === null ? TAIL.label : last + TAIL.blockGap,
			discoveryCount,
			TAIL,
		);
		last = discovery.rows.at(-1)!.dot;
	}

	const horizon = last === null ? TAIL.bareHorizon : last + TAIL.rowToHorizon;
	return {
		label: near.label,
		rows: near.rows,
		discovery,
		horizon,
		height: horizon + TAIL.sea,
	};
}

/** 꼬리에 몇 편까지 실을지. 정본이 세 줄이고, 그 아래가 바로 수평선이다. */
export const NEIGHBORS_SHOWN = 3;

export const TAIL_METRICS = WIDE_POST.tail;
