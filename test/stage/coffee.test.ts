/**
 * 커피 레시피 카드의 규칙 — 숫자 칸 · 비율 · 붓기 자.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  brewRatio,
  pourScale,
  pourTrack,
  specCells,
  totalWater,
} from "../../src/lib/stage/coffee.ts";

const haewol = {
  bean: "온두라스 산타 루시아 카소나 게이샤 워시드",
  roaster: "해월 커피",
  dose: 15.5,
  grind: "코만단테 25클릭",
  temp: 95,
  pours: [30, 80, 90, 40],
  notes: ["흰 꽃", "청사과"],
};

describe("레시피 숫자", () => {
  it("붓기의 합이 총 물이고, 비율은 소수 한 자리다", () => {
    assert.equal(totalWater(haewol), 240);
    assert.equal(brewRatio(haewol), "1:15.5");
  });

  it("숫자 칸은 원두 · 물 · 비율 · 온도 순이다", () => {
    assert.deepEqual(specCells(haewol), [
      { label: "원두", value: "15.5g" },
      { label: "물", value: "240g" },
      { label: "비율", value: "1:15.5" },
      { label: "온도", value: "95℃" },
    ]);
  });

  it("적지 않은 칸은 빠진다 — 원두만 적으면 원두 칸 하나", () => {
    assert.deepEqual(specCells({ bean: "x", dose: 18, pours: [], notes: [] }), [
      { label: "원두", value: "18g" },
    ]);
    assert.equal(brewRatio({ dose: 18, pours: [] }), null);
  });
});

describe("붓기 자", () => {
  it("자는 300g보다 짧아지지 않고, 가장 많이 부은 장이 넘으면 그 장을 따른다", () => {
    assert.equal(pourScale([haewol]), 300);
    assert.equal(pourScale([haewol, { pours: [60, 200, 240] }]), 500);
    assert.equal(pourScale([]), 300);
  });

  it("막대 몫은 총 물 / 자이고, 1을 넘지 않는다", () => {
    assert.equal(pourTrack(haewol, 300), 0.8);
    assert.equal(pourTrack(haewol, 200), 1);
    assert.equal(pourTrack({ pours: [] }, 300), 0);
  });
});
