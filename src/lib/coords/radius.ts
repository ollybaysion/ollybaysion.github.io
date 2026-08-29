/**
 * 반지름 = 나이테. 발행일 절대 매핑.
 * 안쪽(RADIUS_MIN) = epoch, 바깥쪽(RADIUS_MAX) = epoch + BAND_YEARS.
 * 범위 밖 날짜는 클램프한다 — 밴드를 넘긴 미래 글은 전부 바깥 테두리에 앉는다.
 */
import { BAND_YEARS, RADIUS_MAX, RADIUS_MIN, YEAR_MS } from './constants.ts';

const BAND_MS = BAND_YEARS * YEAR_MS;

/** 날짜 입력을 ms로 정규화한다. Date · ISO 문자열 · epoch ms 전부 받는다. */
function toMs(date: Date | string | number): number {
	const ms = date instanceof Date ? date.getTime() : new Date(date).getTime();
	if (Number.isNaN(ms)) {
		throw new Error(`좌표를 매길 수 없는 날짜: ${String(date)}`);
	}
	return ms;
}

export function placeRadius(date: Date | string | number, epoch: Date | string | number): number {
	const t = (toMs(date) - toMs(epoch)) / BAND_MS;
	const radius = RADIUS_MIN + (RADIUS_MAX - RADIUS_MIN) * t;
	return Math.min(RADIUS_MAX, Math.max(RADIUS_MIN, radius));
}
