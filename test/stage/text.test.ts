/**
 * 줄바꿈 자 — SVG가 해주지 않는 일을 대신한다.
 * 폰트 메트릭 없는 어림이라 값이 아니라 성질을 지킨다: 넘치지 않고, 순서가 보존되고,
 * 잘릴 땐 …으로 끝난다.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  charRatio,
  textWidth,
  truncateText,
  wrapText,
} from "../../src/lib/stage/text.ts";

describe("charRatio", () => {
  it("한글은 정폭, 라틴은 절반쯤", () => {
    assert.equal(charRatio("가"), 1);
    assert.equal(charRatio("好"), 1);
    assert.ok(charRatio("a") < charRatio("A"));
    assert.ok(charRatio("A") < charRatio("가"));
    assert.ok(charRatio(" ") < charRatio("a"));
  });

  it("한글 n자의 폭은 n em이다", () => {
    assert.equal(textWidth("커피", 17), 34);
  });
});

describe("wrapText", () => {
  it("들어가면 한 줄", () => {
    assert.deepEqual(wrapText("커피 이야기", 12, 300, 3), ["커피 이야기"]);
  });

  it("어느 줄도 폭을 넘지 않는다", () => {
    const text = "분쇄도를 한 클릭 곱게 갈 때마다 홍차 쪽으로 기울던 컵";
    const lines = wrapText(text, 12, 140, 5);
    assert.ok(lines.length > 1);
    for (const line of lines) assert.ok(textWidth(line, 12) <= 140, line);
  });

  it("낱말 순서를 그대로 지킨다", () => {
    const text = "예가체페 워시드, 무화과와 홍차 사이";
    const lines = wrapText(text, 12, 100, 5);
    assert.equal(lines.join(" ").replace(/…$/, ""), text);
  });

  it("줄 수를 넘기면 마지막 줄을 …으로 마감한다", () => {
    const text = "분쇄도를 한 클릭 곱게 갈 때마다 홍차 쪽으로 기울던 컵";
    const lines = wrapText(text, 12, 100, 2);
    assert.equal(lines.length, 2);
    assert.ok(lines[1]!.endsWith("…"));
    assert.ok(textWidth(lines[1]!, 12) <= 100);
  });

  it("한 낱말이 한 줄보다 길면 글자 단위로 끊는다", () => {
    const lines = wrapText("가나다라마바사아자차", 10, 40, 5);
    assert.deepEqual(lines, ["가나다라", "마바사아", "자차"]);
  });

  it("빈 문자열은 줄이 없다", () => {
    assert.deepEqual(wrapText("   ", 12, 100, 3), []);
  });
});

describe("truncateText", () => {
  it("들어가면 그대로", () => {
    assert.equal(truncateText("커피", 15, 100), "커피");
  });

  it("넘치면 …을 붙이고 폭 안에 든다", () => {
    const out = truncateText("드리퍼 3종: V60·칼리타·오리가미", 15, 90);
    assert.ok(out.endsWith("…"));
    assert.ok(textWidth(out, 15) <= 90);
  });
});
