/** 좌표 엔진이 주고받는 값들. I/O 없음. */

/** 카테고리가 소유한 부채꼴. `[시작각, 끝각]`, 시계 방향으로 시작→끝. 랩(예: [330, 30]) 허용. */
export type Arc = readonly [number, number];

/** 좌표를 매길 글. 엔진은 이 세 가지만 본다. */
export interface PostInput {
	slug: string;
	tags: readonly string[];
	series?: string | undefined;
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
