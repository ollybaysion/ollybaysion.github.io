/**
 * 정본 대조 — `ListA.dc.html`이 글 8편짜리 한 장에 손으로 박아둔 좌표가
 * `listLayout` · `thumbScene` · `circleTitle` 규칙에서 그대로 나오는지.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  circleTitle,
  listLayout,
  listWraps,
  thumbScene,
} from "../../src/lib/stage/list.ts";
import { NARROW, WIDE } from "../../src/lib/stage/page.ts";

const fx = (n: number) => Number(n.toFixed(4));

/** 경로 문자열에서 숫자만 뽑는다 — 정본도 우리도 부동소수 꼬리를 그대로 찍는다. */
function pathNumbers(d: string): number[] {
  return (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map((n) => fx(Number(n)));
}

/** 정본 8편 = 최근 1 + 주요 2 + 전체 5. */
const CANON = listLayout({ latest: 1, featured: 2, rows: 5 });

describe("listLayout — 정본 재현", () => {
  it("최근 1편 단이 정본 자리에 앉는다", () => {
    const latest = CANON.latest!;
    assert.equal(latest.label, 182);
    assert.deepEqual(latest.thumb, { x: 52, y: 199, w: 280, h: 170 });
    assert.equal(latest.textX, 356);
    assert.deepEqual(latest.title, [229, 253]);
    assert.equal(latest.meta, 279);
    assert.deepEqual(latest.desc, [303, 322, 341]);
  });

  it("주요 2편 단이 정본 자리에 앉는다", () => {
    const featured = CANON.featured!;
    assert.equal(featured.label, 425);
    assert.deepEqual(
      featured.cards.map((card) => card.thumb),
      [
        { x: 52, y: 443, w: 286, h: 118 },
        { x: 362, y: 443, w: 286, h: 118 },
      ],
    );
    for (const card of featured.cards) {
      assert.deepEqual(card.title, [585, 604]);
      assert.equal(card.date, 625);
    }
  });

  it("전체 단의 행이 정본 자리에 앉는다", () => {
    const rows = CANON.rows!;
    assert.equal(rows.label, 677);
    assert.deepEqual(
      rows.rows.map((row) => row.dot),
      [716, 772, 828, 884, 940],
    );
    // 넓은 판의 제목은 한 줄이다.
    assert.deepEqual(
      rows.rows.map((row) => row.title),
      [[721], [777], [833], [889], [945]],
    );
    assert.deepEqual(
      rows.rows.map((row) => row.meta),
      [740, 796, 852, 908, 964],
    );
    assert.deepEqual(
      rows.rows.map((row) => row.rule),
      [754, 810, 866, 922, 978],
    );
  });

  it("정본 한 장의 높이가 1040이다", () => {
    assert.equal(CANON.height, 1040);
  });
});

describe("listLayout — 글이 적은 카테고리", () => {
  it("글이 하나면 최근 단만 남고 뒤가 없다", () => {
    const layout = listLayout({ latest: 1, featured: 0, rows: 0 });
    assert.ok(layout.latest);
    assert.equal(layout.featured, undefined);
    assert.equal(layout.rows, undefined);
    // 썸네일 아래(369)에서 꼬리만큼.
    assert.equal(layout.height, 369 + 62);
  });

  it("주요가 하나면 카드도 하나만 나온다", () => {
    const layout = listLayout({ latest: 1, featured: 1, rows: 0 });
    assert.equal(layout.featured!.cards.length, 1);
    assert.equal(layout.featured!.cards[0]!.thumb.x, 52);
    assert.equal(layout.height, 625 + 62);
  });

  it("주요 단이 비면 전체 단이 그 자리로 당겨 올라온다", () => {
    const layout = listLayout({ latest: 1, featured: 0, rows: 2 });
    // 주요가 있었으면 677이었을 자리 → 최근 바로 다음인 425.
    assert.equal(layout.rows!.label, 425);
    assert.deepEqual(
      layout.rows!.rows.map((row) => row.dot),
      [464, 520],
    );
  });
});

describe("listLayout — 좁은 판", () => {
  const NARROW_LAYOUT = listLayout({ latest: 1, featured: 2, rows: 5 }, NARROW);

  it("최근 1편은 썸네일 아래에 글이 쌓인다", () => {
    const latest = NARROW_LAYOUT.latest!;
    assert.deepEqual(latest.thumb, { x: 24, y: 199, w: 342, h: 208 });
    // 글은 썸네일 왼쪽 끝에서 시작해 아래로 내려간다.
    assert.equal(latest.textX, 24);
    assert.ok(latest.title[0]! > latest.thumb.y + latest.thumb.h);
    // 손이 닿는 자리는 썸네일과 글을 한 덩어리로 받는다.
    assert.equal(latest.hit.w, 342);
    assert.ok(latest.hit.y + latest.hit.h >= latest.desc.at(-1)!);
  });

  it("주요 2편이 한 열에 위아래로 쌓인다", () => {
    const cards = NARROW_LAYOUT.featured!.cards;
    assert.equal(cards.length, 2);
    assert.deepEqual(
      cards.map((card) => card.thumb.x),
      [24, 24],
    );
    assert.equal(cards[1]!.thumb.y - cards[0]!.thumb.y, 235);
    // 앞 카드의 날짜가 뒤 카드의 썸네일을 넘지 않는다.
    assert.ok(cards[0]!.date < cards[1]!.thumb.y);
  });

  it("전체 행의 제목이 두 줄까지 간다", () => {
    const rows = NARROW_LAYOUT.rows!;
    assert.equal(rows.rows[0]!.title.length, 2);
    // 줄이 늘어난 만큼 행 사이도 벌어진다 — 구분선이 제 행의 메타와 다음 행 제목 사이에 온다.
    assert.ok(rows.rows[0]!.meta > rows.rows[0]!.title.at(-1)!);
    assert.ok(rows.rows[0]!.rule > rows.rows[0]!.meta);
    assert.ok(rows.rows[0]!.rule < rows.rows[1]!.title[0]!);
    // 행끼리 손닿는 자리가 겹치지 않는다.
    assert.ok(rows.rows[0]!.hit.y + rows.rows[0]!.hit.h <= rows.rows[1]!.hit.y);
  });

  it("어느 단도 글줄 폭을 넘지 않는다", () => {
    const wraps = listWraps(NARROW);
    assert.ok(wraps.latestText <= NARROW.edgeR - NARROW.edgeL);
    assert.ok(wraps.featuredText <= NARROW.edgeR - NARROW.edgeL);
    assert.ok(wraps.rowTitle > 0);
    assert.equal(wraps.rowTitleLines, 2);
    for (const card of NARROW_LAYOUT.featured!.cards) {
      assert.ok(card.thumb.x + card.thumb.w <= NARROW.edgeR);
    }
  });

  it("넓은 판의 접는 폭은 정본 그대로다", () => {
    assert.deepEqual(listWraps(WIDE), {
      latestText: 292,
      featuredText: 286,
      rowTitle: 522,
      rowTitleLines: 1,
    });
  });
});

describe("thumbScene — 정본 재현", () => {
  it("최근 1편 썸네일의 빛구멍과 파도가 정본과 같다", () => {
    const scene = thumbScene({ x: 52, y: 199, w: 280, h: 170 });
    assert.deepEqual(
      [fx(scene.hole.cx), fx(scene.hole.cy), fx(scene.hole.r)],
      [136, 256.8, 27.2],
    );
    assert.deepEqual(pathNumbers(scene.waves[0]!.d), [
      52, 311.2, 136, 297.6, 206, 324.8, 332, 304.4, 332, 369, 52, 369,
    ]);
    assert.deepEqual(pathNumbers(scene.waves[1]!.d), [
      52, 338.4, 150, 324.8, 220, 352, 332, 331.6, 332, 369, 52, 369,
    ]);
    assert.deepEqual(
      scene.waves.map((wave) => wave.opacity),
      [0.16, 0.26],
    );
  });

  it("주요 2편 썸네일도 같은 비율에서 나온다", () => {
    const left = thumbScene({ x: 52, y: 443, w: 286, h: 118 });
    assert.deepEqual(
      [fx(left.hole.cx), fx(left.hole.cy), fx(left.hole.r)],
      [137.8, 483.12, 18.88],
    );
    assert.deepEqual(pathNumbers(left.waves[0]!.d), [
      52, 520.88, 137.8, 511.44, 209.3, 530.32, 338, 516.16, 338, 561, 52, 561,
    ]);
    assert.deepEqual(pathNumbers(left.waves[1]!.d), [
      52, 539.76, 152.1, 530.32, 223.6, 549.2, 338, 535.04, 338, 561, 52, 561,
    ]);

    const right = thumbScene({ x: 362, y: 443, w: 286, h: 118 });
    assert.deepEqual(
      [fx(right.hole.cx), fx(right.hole.cy), fx(right.hole.r)],
      [447.8, 483.12, 18.88],
    );
    assert.deepEqual(pathNumbers(right.waves[0]!.d), [
      362, 520.88, 447.8, 511.44, 519.3, 530.32, 648, 516.16, 648, 561, 362,
      561,
    ]);
  });
});

describe("circleTitle", () => {
  it("정본의 네 글자 두 단어가 두 줄 26px로 앉는다", () => {
    const title = circleTitle("인공지능 에이전트");
    assert.deepEqual(title.lines, ["인공지능", "에이전트"]);
    assert.equal(title.size, 26);
    assert.deepEqual(title.baselines.map(fx), [48, 80]);
  });

  it("세 글자까지는 한 줄 38px", () => {
    for (const name of ["커피", "개발", "글쓰기"]) {
      const title = circleTitle(name);
      assert.deepEqual(title.lines, [name]);
      assert.equal(title.size, 38);
      assert.equal(title.baselines.length, 1);
    }
  });

  it("한 줄과 두 줄의 시각 중심이 같다", () => {
    const one = circleTitle("커피");
    const two = circleTitle("인공지능 에이전트");
    const center = (title: typeof one) => {
      const ascent = title.size * 0.73;
      const top = title.baselines[0]! - ascent;
      return (top + title.baselines[title.baselines.length - 1]!) / 2;
    };
    assert.equal(fx(center(one)), fx(center(two)));
  });

  it("띄어쓰기 없는 긴 이름은 글자 수 절반에서 끊는다", () => {
    assert.deepEqual(circleTitle("인공지능에이전트").lines, [
      "인공지능",
      "에이전트",
    ]);
    assert.deepEqual(circleTitle("데이터베이스").lines, ["데이터", "베이스"]);
  });

  it("띄어쓰기가 여럿이면 한가운데에 가장 가까운 데서 끊는다", () => {
    assert.deepEqual(circleTitle("빛 구멍 이야기").lines, [
      "빛 구멍",
      "이야기",
    ]);
  });
});
