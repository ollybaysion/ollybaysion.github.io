/**
 * 부채꼴 기하. 호 안에서는 "호 시작점부터 몇 도" 라는 로컬 좌표로 다룬다.
 * 등록된 호는 ≤120°라 로컬 좌표에서는 랩이 없고, 선형 평균이 원형 평균과 같아진다.
 */
import type { Arc } from './types.ts';

/** 각도를 [0, 360)으로 접는다. */
export function norm360(angle: number): number {
	return ((angle % 360) + 360) % 360;
}

/** 호의 폭(도). 시작 == 끝이면 한 바퀴(360)로 본다. */
export function arcSpan(arc: Arc): number {
	const span = norm360(arc[1] - arc[0]);
	return span === 0 ? 360 : span;
}

/** 절대 각도 → 호 로컬 각도(호 시작점 기준 0..360). */
export function toLocal(arc: Arc, angle: number): number {
	return norm360(angle - arc[0]);
}

/** 호 로컬 각도 → 절대 각도. */
export function toAbsolute(arc: Arc, local: number): number {
	return norm360(arc[0] + local);
}

/** 호 위의 비율 t ∈ [0,1] 지점의 절대 각도. */
export function arcAngleAt(arc: Arc, t: number): number {
	return toAbsolute(arc, arcSpan(arc) * t);
}

/**
 * 로컬 각도를 [inset, span - inset]에 가둔다.
 * 호 밖으로 나간 값은 가까운 쪽 끝으로 접는다(불변식 4).
 */
export function clampLocal(arc: Arc, local: number, inset = 0): number {
	const span = arcSpan(arc);
	const lo = Math.min(inset, span / 2);
	const hi = Math.max(span - inset, span / 2);
	const wrapped = norm360(local);
	// 호 밖(span..360)이면 어느 쪽 끝이 더 가까운지로 결정한다.
	if (wrapped > span) return wrapped - span < 360 - wrapped ? hi : lo;
	return Math.min(hi, Math.max(lo, wrapped));
}

/** 절대 각도를 호 안으로 가둔다. */
export function clampToArc(arc: Arc, angle: number, inset = 0): number {
	return toAbsolute(arc, clampLocal(arc, toLocal(arc, angle), inset));
}

/**
 * 각도 무리의 원형 평균 — 무리가 호 경계(0°)를 넘어가도 반대편으로 튀지 않는다.
 * 정확히 마주 보는 두 각처럼 중심이랄 게 없는 무리는 첫 각을 준다.
 */
export function meanAngle(angles: readonly number[]): number {
	let x = 0;
	let y = 0;
	for (const angle of angles) {
		const a = (angle * Math.PI) / 180;
		x += Math.cos(a);
		y += Math.sin(a);
	}
	if (Math.hypot(x, y) < 1e-9) return norm360(angles[0] ?? 0);
	return norm360((Math.atan2(y, x) * 180) / Math.PI);
}

/** 두 각도 사이의 최단 각거리(0..180). */
export function angularDistance(a: number, b: number): number {
	const d = Math.abs(norm360(a) - norm360(b));
	return d > 180 ? 360 - d : d;
}
