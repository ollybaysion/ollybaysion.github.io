/**
 * 극좌표(각도·반지름) → 무대 위 점, 그리고 두 글 사이의 화면 거리.
 * 핵심 계약("화면상 거리가 가까우면 유사한 글이다")을 재는 자 역할.
 *
 * 변환식은 Main.dc.html 정본과 동일하다:
 *   x = CX + r·cos(a), y = CY + r·sin(a)  (SVG 좌표계라 y는 아래로 증가)
 */
import { CENTER, D_MAX } from './constants.ts';
import type { Point } from './types.ts';

export interface Placement {
	angle: number;
	radius: number;
}

export function toPoint(placement: Placement): Point {
	const a = (placement.angle * Math.PI) / 180;
	return {
		x: CENTER.x + placement.radius * Math.cos(a),
		y: CENTER.y + placement.radius * Math.sin(a),
	};
}

/** 두 좌표 사이의 화면 거리(px). */
export function screenDistance(a: Placement, b: Placement): number {
	const pa = toPoint(a);
	const pb = toPoint(b);
	return Math.hypot(pa.x - pb.x, pa.y - pb.y);
}

/**
 * 화면 거리 → 화면에 띄우는 근접도 [0, 1].
 * 유사도를 직접 보여주지 않는다 — 독자가 보는 숫자는 언제나 거리에서 파생된다.
 */
export function proximity(a: Placement, b: Placement): number {
	return Math.max(0, 1 - screenDistance(a, b) / D_MAX);
}
