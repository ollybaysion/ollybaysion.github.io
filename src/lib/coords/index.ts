/**
 * 좌표 엔진 v1. I/O 없는 순수 함수만 모인다.
 * 파일을 읽고 쓰는 쪽(빌드 스크립트)은 `scripts/`에 산다.
 */
export { angularDistance, arcAngleAt, arcSpan, clampToArc, norm360, toAbsolute, toLocal } from './arc.ts';
export { placeAngle, tagAngle } from './angle.ts';
export {
	BAND_YEARS,
	CENTER,
	COORDS_VERSION,
	JITTER_DEG,
	LIGHT_HOLE_RADIUS,
	RADIUS_MAX,
	RADIUS_MIN,
	SERIES_BONUS,
	YEAR_MS,
} from './constants.ts';
export { hash01, normalizeTag, normalizeTags } from './hash.ts';
export { screenDistance, toPoint } from './position.ts';
export type { Placement } from './position.ts';
export { placeRadius } from './radius.ts';
export { similarity, tagJaccard } from './similarity.ts';
export type { Arc, Ledger, LedgerEntry, PlacedPost, Point, PostInput } from './types.ts';
