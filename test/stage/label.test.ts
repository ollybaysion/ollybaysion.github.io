/**
 * 정본 대조 — `Main.dc.html`이 글 16편의 이름표를 하나씩 박아둔 좌표가
 * `labelPlacement` 한 식에서 소수점 첫째 자리까지 그대로 나오는지.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toPoint } from "../../src/lib/coords/position.ts";
import { labelPlacement } from "../../src/lib/stage/label.ts";
import type { TextAnchor } from "../../src/lib/stage/label.ts";

/** 정본의 `.post` 한 줄: [각도, 반지름, 점 x, 점 y, 이름표 x, 이름표 y, 정렬]. */
const CANON: Array<
  [number, number, number, number, number, number, TextAnchor]
> = [
  [60, 185, 442.5, 395.2, 450.5, 413.1, "start"],
  [85, 150, 363.1, 384.4, 364.5, 404.4, "middle"],
  [100, 176, 319.4, 408.3, 316.7, 428.1, "middle"],
  [120, 140, 280.0, 356.2, 272.0, 374.1, "end"],
  [75, 166, 393.0, 395.3, 397.1, 414.8, "start"],
  [135, 189, 216.4, 368.6, 205.0, 384.0, "end"],
  [50, 143, 441.9, 344.5, 452.2, 360.8, "start"],
  [110, 195, 283.3, 418.2, 277.8, 437.3, "end"],
  [262, 163, 327.3, 73.6, 325.1, 61.7, "middle"],
  [278, 182, 375.3, 54.8, 377.6, 42.9, "middle"],
  [250, 143, 301.1, 100.6, 295.6, 89.6, "end"],
  [292, 159, 409.6, 87.6, 415.6, 76.7, "start"],
  [268, 192, 343.3, 43.1, 342.7, 31.1, "middle"],
  [180, 169, 181.0, 235.0, 165.0, 239.0, "end"],
  [200, 153, 206.2, 182.7, 191.2, 181.2, "end"],
  [340, 172, 511.6, 176.2, 526.7, 174.7, "start"],
  [320, 195, 499.4, 109.7, 511.6, 103.4, "start"],
];

const fx = (n: number) => Number(n.toFixed(1));

describe("labelPlacement — 정본 재현", () => {
  it("정본 글 전편의 점 좌표가 좌표 엔진과 같다", () => {
    for (const [angle, radius, dx, dy] of CANON) {
      const point = toPoint({ angle, radius });
      assert.deepEqual(
        [fx(point.x), fx(point.y)],
        [dx, dy],
        `${angle}° r${radius}`,
      );
    }
  });

  it("정본 글 전편의 이름표 좌표·정렬이 한 식에서 나온다", () => {
    for (const [angle, radius, , , lx, ly, anchor] of CANON) {
      const label = labelPlacement(angle, toPoint({ angle, radius }));
      assert.deepEqual(
        [fx(label.x), fx(label.y), label.anchor],
        [lx, ly, anchor],
        `${angle}°`,
      );
    }
  });
});

describe("labelPlacement — 규칙", () => {
  const origin = { x: 0, y: 0 };

  it("오른쪽 점은 왼쪽 정렬로 바깥에 붙는다", () => {
    const label = labelPlacement(0, origin);
    assert.deepEqual(
      [fx(label.x), fx(label.y), label.anchor],
      [16, 4, "start"],
    );
  });

  it("왼쪽 점은 오른쪽 정렬", () => {
    const label = labelPlacement(180, origin);
    assert.deepEqual([fx(label.x), fx(label.y), label.anchor], [-16, 4, "end"]);
  });

  it("위아래 끝에서는 가운데 정렬", () => {
    assert.equal(labelPlacement(90, origin).anchor, "middle");
    assert.equal(labelPlacement(270, origin).anchor, "middle");
  });

  it("한 바퀴 돌아도 같은 자리", () => {
    assert.deepEqual(labelPlacement(-60, origin), labelPlacement(300, origin));
  });
});
