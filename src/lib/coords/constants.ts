/**
 * 무대 상수. 값은 `~/repo/blog-screens/*.dc.html` 정본에서 그대로 읽어온 것.
 * 여기 숫자를 바꾸면 이미 박힌 좌표의 의미가 달라진다 = 전량 재측량 이벤트.
 */

/** 원장 알고리즘 버전. 배치 규칙이 바뀌면 올린다. */
export const COORDS_VERSION = 'coords-v1';

/** 빛구멍 중심 (Main.dc.html: `var CX = 350, CY = 235`). */
export const CENTER = { x: 350, y: 235 } as const;

/** 빛구멍 반지름 (Main.dc.html: `<circle ... r="95">`). */
export const LIGHT_HOLE_RADIUS = 95;

/** 나이테 반지름 범위. 안쪽 = 옛날, 바깥쪽 = 최근. */
export const RADIUS_MIN = 140;
export const RADIUS_MAX = 195;

/** 반지름 밴드 하나가 덮는 기간(년). epoch + BAND_YEARS = RADIUS_MAX. */
export const BAND_YEARS = 5;

/** 1년(ms). 그레고리력 평균 연장 365.2425일 고정 — 결정론 유지용. */
export const YEAR_MS = 365.2425 * 24 * 60 * 60 * 1000;

/**
 * 화면 거리를 %로 바꿀 때 쓰는 분모. 두 글이 벌어질 수 있는 최대 거리
 * (안쪽 테두리를 사이에 두고 정반대) = 지름.
 */
export const D_MAX = 2 * RADIUS_MAX;

/** 글 하나에서 "가까운 글"을 몇 편까지 실을지. */
export const NEIGHBOR_LIMIT = 8;

/** 같은 시리즈 보너스. 유사도에 더한 뒤 1.0에서 자른다. */
export const SERIES_BONUS = 0.3;

/** 슬러그 해시 지터 폭(±도). 같은 태그 셋을 가진 두 글을 떼어놓는 장치. */
export const JITTER_DEG = 1;
