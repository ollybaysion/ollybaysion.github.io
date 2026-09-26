/**
 * 읽는 시간 — 사람이 읽는 글자만 센다. 본문이 HTML인 글도 마크업 무게로 늘어나면 안 된다.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CHARS_PER_MINUTE, readingMinutes } from "../../src/lib/stage/reading.ts";

const prose = (n: number) => "가".repeat(n);

describe("readingMinutes", () => {
  it("분당 500자, 최소 1분", () => {
    assert.equal(readingMinutes(""), 1);
    assert.equal(readingMinutes(prose(CHARS_PER_MINUTE * 3)), 3);
  });

  it("마크다운 코드 블록은 세지 않는다", () => {
    const code = "```ts\n" + "x".repeat(CHARS_PER_MINUTE * 10) + "\n```";
    assert.equal(readingMinutes(`${prose(CHARS_PER_MINUTE)}\n\n${code}`), 1);
  });

  it("HTML 본문은 태그·속성을 세지 않는다", () => {
    const attrs = ` class="${"x".repeat(CHARS_PER_MINUTE * 4)}"`;
    const html = `<div${attrs}><p${attrs}>${prose(CHARS_PER_MINUTE * 2)}</p></div>`;
    assert.equal(readingMinutes(html), 2);
  });

  it("SVG 그림·style·주석은 통째로 세지 않는다", () => {
    const svg = `<svg viewBox="0 0 10 10"><text>${prose(CHARS_PER_MINUTE * 5)}</text></svg>`;
    const style = `<style>${"a{color:red}".repeat(CHARS_PER_MINUTE)}</style>`;
    const comment = `<!-- ${prose(CHARS_PER_MINUTE * 5)} -->`;
    assert.equal(readingMinutes(`${comment}${style}<p>${prose(CHARS_PER_MINUTE)}</p>${svg}`), 1);
  });

  it("엔티티는 한 글자다", () => {
    const entities = "&amp;".repeat(CHARS_PER_MINUTE * 2);
    assert.equal(readingMinutes(entities), 2);
  });
});
