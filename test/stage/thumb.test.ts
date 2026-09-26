/**
 * 목록 썸네일 — 글 날짜의 달과 먹선 바다(`src/lib/stage/thumb.ts`).
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  moonLit,
  moonLitPath,
  moonPhase,
  thumbScene,
} from "../../src/lib/stage/thumb.ts";

/** 위상 차이 — 0과 1은 같은 삭이다. */
const phaseGap = (a: number, b: number) => {
  const d = Math.abs(a - b) % 1;
  return Math.min(d, 1 - d);
};

describe("moonPhase", () => {
  it("2026년의 삭·망과 반나절 안으로 맞는다", () => {
    // 2026-08-12 개기일식(삭), 2026-08-28 부분월식(망), 2026-09-26 망.
    assert.ok(phaseGap(moonPhase("2026-08-12"), 0) < 0.035);
    assert.ok(phaseGap(moonPhase("2026-08-28"), 0.5) < 0.035);
    assert.ok(phaseGap(moonPhase("2026-09-26"), 0.5) < 0.035);
  });

  it("시각이 붙은 날짜도 날짜만 본다", () => {
    assert.equal(moonPhase("2026-08-31T00:00:00.000Z"), moonPhase("2026-08-31"));
  });
});

describe("moonLitPath", () => {
  it("삭 무렵엔 밝은 면이 없다 — 테두리만 남는다", () => {
    assert.equal(moonLitPath(0, 0, 10, 0.001), null);
    assert.ok(moonLit(0.001) < 0.01);
  });

  it("차는 달은 오른쪽, 이지러지는 달은 왼쪽 가장자리를 돈다", () => {
    const outerSweep = (d: string) => d.match(/A[\d.]+,[\d.]+ 0 0 (\d)/)![1];
    assert.equal(outerSweep(moonLitPath(0, 0, 10, 0.2)!), "1");
    assert.equal(outerSweep(moonLitPath(0, 0, 10, 0.8)!), "0");
  });

  it("상현·하현이면 명암 경계가 곧은 선이다", () => {
    const d = moonLitPath(0, 0, 10, 0.25)!;
    assert.match(d, / A0,10 /);
  });
});

describe("thumbScene", () => {
  const rect = { x: 52, y: 199, w: 280, h: 170 };
  const post = { slug: "2026-08-31-a", date: "2026-08-31", color: "rgb(91,141,239)" };

  it("같은 글은 언제나 같은 그림이다", () => {
    assert.deepEqual(thumbScene(rect, post), thumbScene(rect, post));
  });

  it("달은 상자를 짓누르지 않는다 — 반지름이 상자 높이의 8% 이하", () => {
    const moon = thumbScene(rect, post).find(
      (shape) => shape.tag === "circle" && shape.attrs.fill === "#1b1b20",
    )!;
    assert.ok(Number(moon.attrs.r) <= rect.h * 0.08);
  });

  it("가장 앞 물결 하나만 글의 색을 입는다", () => {
    const strokes = thumbScene(rect, post)
      .filter((shape) => shape.tag === "path" && shape.attrs.stroke !== undefined)
      .map((shape) => shape.attrs.stroke);
    assert.equal(strokes.filter((stroke) => stroke === post.color).length, 1);
    assert.equal(strokes.at(-1), post.color);
  });

  it("날짜가 다르면 달의 모양이 다르다", () => {
    const litOf = (date: string) =>
      thumbScene(rect, { ...post, date }).find(
        (shape) => shape.tag === "path" && shape.attrs.fill === "#f5e9c8",
      );
    assert.equal(litOf("2026-09-11"), undefined);
    assert.notEqual(litOf("2026-08-31"), undefined);
  });

  it("그림이 상자 가로를 넘지 않는다", () => {
    for (const shape of thumbScene(rect, post)) {
      if (shape.tag !== "path") continue;
      const xs = String(shape.attrs.d)
        .split(/[ML]/)
        .filter(Boolean)
        .map((pair) => Number(pair.split(",")[0]));
      for (const x of xs) {
        if (Number.isNaN(x)) continue;
        assert.ok(x >= rect.x - 0.01 && x <= rect.x + rect.w + 0.01, `x=${x}`);
      }
    }
  });
});
