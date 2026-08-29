/**
 * 정본 대조 — `Main.dc.html`이 글마다 손으로 박아둔 점 색이
 * 등록부에서 그대로 다시 나오는지. 여기가 깨지면 무대 색이 정본과 어긋난 것이다.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { arcOf } from "../../src/config/categories.ts";
import {
  angleColor,
  arcDistance,
  categoryColor,
  centerAngle,
  mixRgb,
  nearestCategory,
  parseHex,
  toRgbString,
} from "../../src/lib/stage/palette.ts";

/** `Main.dc.html`의 `.post` 각도 → 그 글 점에 박힌 fill. */
const CANON: Array<[number, string]> = [
  [60, "#7090d5"],
  [85, "#5f8eeb"],
  [100, "#628ee6"],
  [120, "#7090d5"],
  [75, "#668fe2"],
  [135, "#7b92c8"],
  [50, "#7791cd"],
  [110, "#698fde"],
  [262, "#d3a05b"],
  [278, "#d3a05b"],
  [250, "#cb9f65"],
  [292, "#ca9f67"],
  [268, "#d8a156"],
  [180, "#9a97a2"],
  [200, "#a89990"],
  [340, "#a89990"],
  [320, "#b69b7f"],
];

function hexOf(rgb: string): string {
  const [r, g, b] = rgb
    .slice(4, -1)
    .split(",")
    .map((n) => Number(n));
  return "#" + [r, g, b].map((n) => n!.toString(16).padStart(2, "0")).join("");
}

describe("parseHex / toRgbString", () => {
  it("등록부 색을 채널로 쪼갠다", () => {
    assert.deepEqual(parseHex("#d9a154"), { r: 217, g: 161, b: 84 });
    assert.deepEqual(parseHex("#5b8def"), { r: 91, g: 141, b: 239 });
  });

  it("#을 빼도 읽는다", () => {
    assert.deepEqual(parseHex("5b8def"), parseHex("#5b8def"));
  });

  it("형식이 아니면 죽는다", () => {
    assert.throws(() => parseHex("#fff"), /#rrggbb/);
    assert.throws(() => parseHex("빨강"), /#rrggbb/);
  });

  it("채널마다 반올림해서 문자열로", () => {
    assert.equal(toRgbString({ r: 216.6, g: 161.4, b: 84 }), "rgb(217,161,84)");
  });
});

describe("mixRgb", () => {
  const a = { r: 0, g: 0, b: 0 };
  const b = { r: 200, g: 100, b: 50 };

  it("양 끝", () => {
    assert.deepEqual(mixRgb(a, b, 0), a);
    assert.deepEqual(mixRgb(a, b, 1), b);
  });

  it("범위 밖은 잘린다", () => {
    assert.deepEqual(mixRgb(a, b, -3), a);
    assert.deepEqual(mixRgb(a, b, 9), b);
  });

  it("가운데는 반올림된 중간값", () => {
    assert.deepEqual(mixRgb(a, b, 0.5), { r: 100, g: 50, b: 25 });
  });
});

describe("centerAngle", () => {
  it("등록된 호의 한가운데", () => {
    assert.equal(centerAngle(arcOf("커피")), 270);
    assert.equal(centerAngle(arcOf("개발")), 90);
  });

  it("0을 넘어 도는 호도 센다", () => {
    assert.equal(centerAngle([330, 30]), 0);
  });
});

describe("angleColor", () => {
  it("호 중심에서는 등록부 base 그대로", () => {
    assert.equal(hexOf(angleColor(270)), "#d9a154");
    assert.equal(hexOf(angleColor(90)), "#5b8def");
  });

  it("정본이 글마다 박아둔 색을 그대로 만든다", () => {
    for (const [angle, hex] of CANON) {
      assert.equal(hexOf(angleColor(angle)), hex, `${angle}°`);
    }
  });

  it("한 바퀴 돌아도 같은 색", () => {
    assert.equal(angleColor(-90), angleColor(270));
    assert.equal(angleColor(450), angleColor(90));
  });

  it("두 호의 한가운데(180°·0°)에서는 정확히 반반", () => {
    assert.equal(hexOf(angleColor(180)), "#9a97a2");
    assert.equal(angleColor(0), angleColor(180));
  });
});

describe("arcDistance", () => {
  const coffee = arcOf("커피");

  it("호 안이면 0", () => {
    assert.equal(arcDistance(coffee, 210), 0);
    assert.equal(arcDistance(coffee, 270), 0);
    assert.equal(arcDistance(coffee, 330), 0);
  });

  it("밖이면 가까운 쪽 끝까지", () => {
    assert.equal(arcDistance(coffee, 200), 10);
    assert.equal(arcDistance(coffee, 340), 10);
  });
});

describe("nearestCategory", () => {
  it("호 안이면 그 카테고리", () => {
    assert.equal(nearestCategory(270), "커피");
    assert.equal(nearestCategory(90), "개발");
    assert.equal(nearestCategory(211), "커피");
    assert.equal(nearestCategory(149), "개발");
  });

  it("빈 호에서는 가까운 쪽을 준다", () => {
    assert.equal(nearestCategory(170), "개발");
    assert.equal(nearestCategory(190), "커피");
    assert.equal(nearestCategory(350), "커피");
    assert.equal(nearestCategory(10), "개발");
  });

  it("정확히 반반이면 등록 순서가 이긴다", () => {
    assert.equal(nearestCategory(180), "커피");
  });
});

describe("categoryColor", () => {
  it("호 중심의 색과 같다", () => {
    assert.equal(categoryColor("커피"), angleColor(270));
    assert.equal(categoryColor("개발"), angleColor(90));
  });
});
