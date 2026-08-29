/**
 * 무대 위 글 이름표의 자리.
 *
 * 정본(`Main.dc.html`)은 글 16편의 이름표 좌표를 하나씩 박아뒀지만, 그 값들은
 * 전부 한 규칙에서 나온다: 점에서 바깥으로 16px 밀고, 글자 기준선만큼 4px 내린다.
 * 좌우 정렬은 점이 중심의 어느 쪽에 있느냐로 갈린다.
 * (정본 16편 전부 이 식으로 소수점 첫째 자리까지 재현된다 — `test/stage/label.test.ts`)
 */
import type { Point } from "../coords/types.ts";

/** 점에서 이름표까지, 반지름 방향으로. */
export const LABEL_GAP = 16;
/** 글자 기준선 보정. 이름표가 점과 같은 높이로 보이게 한다. */
export const LABEL_BASELINE = 4;
/** |cos| 가 이 값을 넘으면 좌우로 붙이고, 아니면 가운데 정렬한다. */
export const LABEL_SIDE = 0.25;

export type TextAnchor = "start" | "middle" | "end";

export interface LabelPlacement extends Point {
  anchor: TextAnchor;
}

/** 각도 `angle`에 놓인 점 `point`의 이름표 자리. */
export function labelPlacement(angle: number, point: Point): LabelPlacement {
  const a = (angle * Math.PI) / 180;
  const cos = Math.cos(a);
  return {
    x: point.x + LABEL_GAP * cos,
    y: point.y + LABEL_GAP * Math.sin(a) + LABEL_BASELINE,
    anchor: cos > LABEL_SIDE ? "start" : cos < -LABEL_SIDE ? "end" : "middle",
  };
}
