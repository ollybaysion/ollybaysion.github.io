/**
 * 정본 대조 — `Post.dc.html`이 손으로 박아둔 자리가
 * `titleBaselines` · `minimapDot` · `postTail` · `stripPoints` 규칙에서 나오는지.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  HEAD,
  MINIMAP,
  STRIP,
  minimapDot,
  postTail,
  stripPoints,
  titleBaselines,
} from "../../src/lib/stage/post.ts";

const fx = (n: number) => Number(n.toFixed(1));

describe("titleBaselines", () => {
  it("두 줄이면 정본의 192 · 226", () => {
    assert.deepEqual(titleBaselines(2), [192, 226]);
  });

  it("줄이 몇이든 마지막 줄은 226에 앉는다 — 그 아래 메타가 안 흔들린다", () => {
    for (const n of [1, 2, 3]) {
      const lines = titleBaselines(n);
      assert.equal(lines[lines.length - 1], HEAD.title.last);
      assert.equal(lines.length, n);
    }
    assert.deepEqual(titleBaselines(3), [158, 192, 226]);
  });

  it("제목 마지막 줄과 메타 사이는 언제나 32", () => {
    assert.equal(HEAD.meta - HEAD.title.last, 32);
  });
});

describe("minimapDot", () => {
  /**
   * 정본이 찍어둔 점 하나 — `Main.dc.html`의 262° · r163짜리 글이
   * (635.8, 32.3)에 앉아 있다. 손으로 찍은 자리라 규칙과 0.2px쯤 어긋난다.
   */
  it("정본의 점을 0.5px 안에서 재현한다", () => {
    const dot = minimapDot({ angle: 262, radius: 163 });
    assert.ok(Math.abs(dot.x - 635.8) < 0.5, `x=${dot.x}`);
    assert.ok(Math.abs(dot.y - 32.3) < 0.5, `y=${dot.y}`);
  });

  it("각도는 정확히 무대의 그 각도다", () => {
    for (const angle of [0, 45, 137.5, 262, 300]) {
      const dot = minimapDot({ angle, radius: 170 });
      const back =
        (Math.atan2(dot.y - MINIMAP.cy, dot.x - MINIMAP.cx) * 180) / Math.PI;
      assert.equal(fx((back + 360) % 360), fx(angle % 360));
    }
  });

  it("가장 바깥 나이테는 윤곽에 닿고, 가장 안쪽은 안쪽 끝에 앉는다", () => {
    const outer = minimapDot({ angle: 0, radius: 195 });
    const inner = minimapDot({ angle: 0, radius: 140 });
    assert.equal(fx(outer.x - MINIMAP.cx), fx(MINIMAP.r));
    assert.equal(fx(inner.x - MINIMAP.cx), fx(MINIMAP.inner));
  });

  it("나이테 밖 반지름은 윤곽 안에서 잘린다", () => {
    const far = minimapDot({ angle: 0, radius: 400 });
    assert.equal(fx(far.x - MINIMAP.cx), fx(MINIMAP.r));
  });
});

describe("postTail", () => {
  it("정본 세 편이 54 · 88 · 122에 앉고 수평선이 200이다", () => {
    const tail = postTail(3);
    assert.deepEqual(
      tail.rows.map((row) => row.dot),
      [54, 88, 122],
    );
    assert.deepEqual(
      tail.rows.map((row) => row.title),
      [58, 92, 126],
    );
    assert.equal(tail.horizon, 200);
    assert.equal(tail.height, 400);
  });

  it("가까운 글이 없으면 목록 없이 수평선부터 시작한다", () => {
    const tail = postTail(0);
    assert.deepEqual(tail.rows, []);
    assert.equal(tail.horizon, 40);
    assert.equal(tail.height, 240);
  });

  it("가까운 글이 하나여도 자리는 첫 줄 그대로다", () => {
    assert.deepEqual(postTail(1).rows, [{ dot: 54, title: 58 }]);
  });
});

describe("stripPoints", () => {
  const box = (points: { x: number; y: number }[]) => ({
    x0: Math.min(...points.map((p) => p.x)),
    x1: Math.max(...points.map((p) => p.x)),
    y0: Math.min(...points.map((p) => p.y)),
    y1: Math.max(...points.map((p) => p.y)),
  });

  it("별자리가 정본 상자의 여백 안을 꽉 채운다", () => {
    const points = stripPoints([
      { x: 200, y: 400 },
      { x: 260, y: 120 },
      { x: 340, y: 200 },
      { x: 430, y: 150 },
    ]);
    const b = box(points);
    assert.deepEqual(
      [fx(b.x0), fx(b.x1)],
      [STRIP.padX, STRIP.w - STRIP.padX],
    );
    assert.deepEqual(
      [fx(b.y0), fx(b.y1)],
      [STRIP.padY, STRIP.h - STRIP.padY],
    );
  });

  it("회차 순서를 그대로 지킨다", () => {
    const points = stripPoints([
      { x: 400, y: 100 },
      { x: 200, y: 300 },
    ]);
    assert.ok(points[0]!.x > points[1]!.x);
    assert.ok(points[0]!.y < points[1]!.y);
  });

  it("멤버가 하나면 상자 한가운데 점 하나다", () => {
    assert.deepEqual(stripPoints([{ x: 300, y: 200 }]), [
      { x: STRIP.w / 2, y: STRIP.h / 2 },
    ]);
  });

  it("한 축이 납작한 별자리는 그 축의 한가운데에 눕는다", () => {
    const points = stripPoints([
      { x: 200, y: 235 },
      { x: 400, y: 235 },
    ]);
    assert.deepEqual(
      points.map((p) => p.y),
      [STRIP.h / 2, STRIP.h / 2],
    );
    assert.deepEqual(
      points.map((p) => fx(p.x)),
      [STRIP.padX, STRIP.w - STRIP.padX],
    );
  });

  it("빈 별자리는 빈 배열", () => {
    assert.deepEqual(stripPoints([]), []);
  });
});
