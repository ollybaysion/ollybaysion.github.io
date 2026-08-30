/**
 * 좌표 엔진. I/O 없는 순수 함수만 모인다.
 * 파일을 읽고 쓰는 쪽(빌드 스크립트)은 `scripts/`에 산다.
 *
 * 배치 규칙은 v1(`COORDS_VERSION`), 닮은 정도를 재는 자는 v2(`EMBED_VERSION` — 임베딩 코사인)다.
 */
export { angularDistance, arcAngleAt, arcSpan, clampToArc, norm360, toAbsolute, toLocal } from './arc.ts';
export { placeAngle, tagAngle } from './angle.ts';
export {
	BAND_YEARS,
	CENTER,
	COORDS_VERSION,
	DISCOVERY_FLOOR,
	DISCOVERY_LIMIT,
	D_MAX,
	EMBED_DTYPE,
	EMBED_MODEL,
	EMBED_POOLING,
	EMBED_VERSION,
	JITTER_DEG,
	LIGHT_HOLE_RADIUS,
	NEIGHBOR_LIMIT,
	RADIUS_MAX,
	RADIUS_MIN,
	SERIES_BONUS,
	VECTOR_CEIL,
	VECTOR_DIMS,
	VECTOR_FLOOR,
	VECTOR_PRECISION,
	YEAR_MS,
} from './constants.ts';
export {
	byDateThenSlug,
	constellations,
	discoveriesOf,
	discoveryMap,
	groupByCategory,
	neighborMap,
	neighborsOf,
	orderSeries,
} from './derive.ts';
export type { ConstellationMember, Discovery, Neighbor, PlacedEntry } from './derive.ts';
export { embedInput, plainText } from './embed.ts';
export type { EmbedSource } from './embed.ts';
export { fingerprint, hash01, normalizeTag, normalizeTags } from './hash.ts';
export { proximity, screenDistance, toPoint } from './position.ts';
export type { Placement } from './position.ts';
export { confusableTags, editDistance } from './tags.ts';
export { placeRadius } from './radius.ts';
export { contentSimilarity, similarity, tagJaccard } from './similarity.ts';
export type {
	Arc,
	Ledger,
	LedgerEntry,
	PlacedPost,
	Point,
	PostInput,
	VectorEntry,
	VectorStore,
} from './types.ts';
export { cosine, rescale, vectorSimilarity } from './vector.ts';
