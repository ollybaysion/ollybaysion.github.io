/**
 * 정본 대조 — `SeriesList.dc.html`이 손으로 박아둔 4화짜리 한 장이
 * `seriesLayout` 규칙에서 그대로 나오는지.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { meanAngle, norm360 } from "../../src/lib/coords/arc.ts";
import { circleTitle } from "../../src/lib/stage/list.ts";
import { NARROW, WIDE } from "../../src/lib/stage/page.ts";
import {
  FIRST_NODE_Y,
  NODE_METRICS,
  NODE_STRIDE,
  seriesLayout,
  seriesMetrics,
  seriesSubtitle,
} from "../../src/lib/stage/series.ts";

const fx = (n: number) => Number(n.toFixed(3));

describe("seriesLayout", () => {
  const canon = seriesLayout(4);

  it("정본의 네 회차가 231 · 297 · 363 · 429에 앉는다", () => {
    assert.deepEqual(
      canon.nodes.map((node) => node.dot),
      [231, 297, 363, 429],
    );
  });

  it("제목은 점보다 5 아래, 날짜는 24 아래", () => {
    assert.deepEqual(
      canon.nodes.map((node) => node.title),
      [236, 302, 368, 434],
    );
    assert.deepEqual(
      canon.nodes.map((node) => node.date),
      [255, 321, 387, 453],
    );
  });

  it("회차를 관통하는 선이 정본의 그 일직선이다", () => {
    assert.equal(canon.line, "M84.0,231.0 L84.0,297.0 L84.0,363.0 L84.0,429.0");
  });

  it("정본 한 장의 세로가 520이다", () => {
    assert.equal(canon.height, 520);
  });

  it("회차가 하나면 관통할 게 없다 — 점 하나만 남는다", () => {
    const one = seriesLayout(1);
    assert.deepEqual(
      one.nodes.map((node) => node.dot),
      [FIRST_NODE_Y],
    );
    assert.equal(one.line, null);
  });

  it("회차가 늘어도 간격은 그대로고 세로만 자란다", () => {
    const six = seriesLayout(6);
    assert.equal(six.nodes.length, 6);
    for (let i = 1; i < six.nodes.length; i += 1) {
      assert.equal(six.nodes[i]!.dot - six.nodes[i - 1]!.dot, NODE_STRIDE);
    }
    assert.equal(six.height, canon.height + 2 * NODE_STRIDE);
  });

  it("빈 시리즈는 그릴 게 없다", () => {
    const none = seriesLayout(0);
    assert.deepEqual(none.nodes, []);
    assert.equal(none.line, null);
  });

  it("가로 자리는 정본 값 그대로다", () => {
    assert.equal(NODE_METRICS.x, 84);
    assert.equal(NODE_METRICS.episodeX, 68);
    assert.equal(NODE_METRICS.textX, 108);
    assert.equal(NODE_METRICS.r, 4);
  });
});

describe("seriesLayout — 좁은 판", () => {
  const narrow = seriesLayout(4, NARROW);
  const node = seriesMetrics(NARROW);

  it("세로 리듬은 판이 달라도 정본 그대로다", () => {
    assert.deepEqual(narrow.nodes, seriesLayout(4, WIDE).nodes);
    assert.equal(narrow.height, 520);
  });

  it("선과 점이 좁은 판의 왼쪽 여백 곁으로 당겨진다", () => {
    assert.ok(node.x > NARROW.edgeL, `x=${node.x}`);
    assert.ok(node.x < seriesMetrics(WIDE).x, `x=${node.x}`);
    assert.equal(narrow.line, "M44.0,231.0 L44.0,297.0 L44.0,363.0 L44.0,429.0");
  });

  it("글줄은 선에서 정본과 같은 거리에 앉고 읽는 열 안에 남는다", () => {
    const wide = seriesMetrics(WIDE);
    assert.equal(node.textX - node.x, wide.textX - wide.x);
    assert.ok(node.textX < NARROW.edgeR, `textX=${node.textX}`);
    // 회차 번호는 선과 글줄 사이가 아니라 선 왼쪽에 있다.
    assert.ok(node.episodeX < node.x, `episodeX=${node.episodeX}`);
  });
});

describe("seriesSubtitle", () => {
  it("정본의 그 한 줄", () => {
    assert.equal(seriesSubtitle(4), "연재순 · 4화 · 사전에 정해진 목록");
  });
});

describe("시리즈 이름", () => {
  it("정본처럼 두 줄 26px로 앉는다", () => {
    const title = circleTitle("예가체페 연대기");
    assert.deepEqual(title.lines, ["예가체페", "연대기"]);
    assert.equal(title.size, 26);
    assert.deepEqual(title.baselines, [48, 80]);
  });
});

describe("meanAngle", () => {
  it("호 경계를 넘는 무리도 반대편으로 튀지 않는다", () => {
    assert.equal(fx(meanAngle([350, 10])), 0);
    assert.equal(fx(meanAngle([340, 20, 0])), 0);
  });

  it("한가운데 모인 무리는 그 한가운데다", () => {
    assert.equal(fx(meanAngle([250, 270, 290])), 270);
    assert.equal(fx(meanAngle([262])), 262);
  });

  it("정본 별자리의 색이 나오는 그 각도대다", () => {
    // `SeriesList.dc.html`의 선·점 색 #d3a05b = angleColor(262).
    const mean = meanAngle([250, 262, 274]);
    assert.ok(Math.abs(norm360(mean) - 262) < 0.5, `mean=${mean}`);
  });

  it("중심이랄 게 없는 무리는 첫 각을 준다", () => {
    assert.equal(meanAngle([0, 180]), 0);
    assert.equal(meanAngle([]), 0);
  });
});
