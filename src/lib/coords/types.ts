/** 좌표 엔진이 주고받는 값들. I/O 없음. */

/** 카테고리가 소유한 부채꼴. `[시작각, 끝각]`, 시계 방향으로 시작→끝. 랩(예: [330, 30]) 허용. */
export type Arc = readonly [number, number];

/** 좌표를 매길 글. 엔진은 이것만 본다. */
export interface PostInput {
	slug: string;
	tags: readonly string[];
	series?: string | undefined;
	/**
	 * 글 전체를 담은 임베딩(v2). 있으면 유사도가 코사인으로 재고, 없으면 태그 자카드로
	 * 물러선다 — 벡터가 아직 안 박힌 글도 좌표는 받아야 하기 때문이다.
	 */
	vector?: readonly number[] | undefined;
}

/** 이미 원장에 각도가 박힌 같은 카테고리의 글. `placeAngle`의 닻. */
export interface PlacedPost extends PostInput {
	angle: number;
}

/** 원장 한 줄. */
export interface LedgerEntry {
	angle: number;
	radius: number;
	/** 좌표가 박힌 시각(ISO). 기록용일 뿐 좌표 계산에는 절대 쓰지 않는다. */
	placedAt: string;
}

/** `src/data/vectors.json`. 원장과 같은 규율 — 슬러그가 한 번 들어가면 다시 재지 않는다. */
export interface VectorStore {
	/** 임베딩 버전. 바꾸면 = 벡터 전량 재측량이라는 의식적 이벤트. */
	version: string;
	/** 벡터를 뜬 모델. 모델이 바뀌면 코사인의 눈금이 통째로 달라진다. */
	model: string;
	dims: number;
	entries: Record<string, VectorEntry>;
}

/** 벡터 한 줄. */
export interface VectorEntry {
	vector: number[];
	/**
	 * 임베딩할 때 읽은 글의 해시. 좌표의 `placedAt`처럼 기록용이다 —
	 * 글을 고쳐 해시가 어긋나도 다시 재지 않고 경고만 한다.
	 */
	source: string;
	embeddedAt: string;
}

/** `src/data/coordinates.json`. append-only. */
export interface Ledger {
	/** 알고리즘 버전. 바꾸면 = 전량 재측량이라는 의식적 이벤트. */
	version: string;
	/** 첫 글의 발행일(ISO date). 글이 없으면 null. */
	epoch: string | null;
	entries: Record<string, LedgerEntry>;
}

/** 무대 위 한 점(SVG 좌표계, y는 아래로 증가). */
export interface Point {
	x: number;
	y: number;
}
