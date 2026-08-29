/**
 * 초안의 순수 규칙 — 이름 짓기와 frontmatter 한 장.
 *
 * 여기서 지은 파일 이름이 Astro 로더·좌표 원장이 쓰는 슬러그와 같은 글자여야 한다.
 * `slugOf`를 같이 태워서 실제로 왕복하는지도 본다.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { slugOf } from "../../scripts/lib/content.mjs";
import {
  DATE_PATTERN,
  draftSlug,
  localDate,
  renderDraft,
} from "../../scripts/lib/draft.mjs";

describe("localDate", () => {
  it("로컬 시각 기준으로 접는다 — 밤에 쓴 글이 어제가 되지 않는다", () => {
    // 로컬 자정 직후. UTC로 접으면 하루 밀리는 자리다.
    const midnight = new Date(2026, 7, 30, 0, 30);
    assert.equal(localDate(midnight), "2026-08-30");
  });

  it("한 자리 달·일도 0을 채운다", () => {
    assert.equal(localDate(new Date(2026, 0, 5, 12)), "2026-01-05");
  });
});

describe("draftSlug", () => {
  it("슬러그 = 날짜-제목", () => {
    assert.equal(
      draftSlug("예가체페를 처음 만난 날", "2026-06-14"),
      "2026-06-14-예가체페를-처음-만난-날",
    );
  });

  it("지은 이름이 파일 이름으로 왕복한다 — 원장 키와 갈리지 않는다", () => {
    for (const title of [
      "예가체페를 처음 만난 날",
      "V60 레시피 정착기",
      "Astro 빌드 파이프라인",
      "탬핑, 다시 배웠다",
      "에스프레소: 머신을 들이고",
    ]) {
      const slug = draftSlug(title, "2026-08-30");
      assert.equal(
        slugOf(`src/content/blog/${slug}.md`),
        slug,
        `왕복 실패: "${title}"`,
      );
    }
  });

  it("앞뒤 공백은 이름에 남지 않는다", () => {
    assert.equal(draftSlug("  탬핑  ", "2026-04-20"), "2026-04-20-탬핑");
  });

  it("슬러그로 남는 글자가 없는 제목은 거절한다", () => {
    assert.throws(() => draftSlug("!!!", "2026-08-30"), /슬러그로 남는 글자/);
  });

  it("날짜 모양이 아니면 거절한다", () => {
    assert.throws(() => draftSlug("제목", "2026-8-30"), /YYYY-MM-DD/);
    assert.ok(DATE_PATTERN.test("2026-08-30"));
  });
});

describe("renderDraft", () => {
  const base = { title: "탬핑을 다시 배웠다", date: "2026-04-20", category: "커피" };

  it("frontmatter로 열고 닫고, 본문 자리를 비워둔다", () => {
    const draft = renderDraft({ ...base, tags: ["에스프레소", "탬핑"] });
    assert.equal(
      draft,
      [
        "---",
        'title: "탬핑을 다시 배웠다"',
        "date: 2026-04-20",
        "category: 커피",
        'tags: ["에스프레소", "탬핑"]',
        "---",
        "",
        "",
      ].join("\n"),
    );
  });

  it("콜론·따옴표가 든 제목도 YAML을 깨지 않는다", () => {
    const draft = renderDraft({ ...base, title: '에스프레소: "탬핑" 다시' });
    assert.match(draft, /^title: "에스프레소: \\"탬핑\\" 다시"$/m);
  });

  it("태그가 없으면 빈 배열로 자리만 남긴다 — 채우라는 자리다", () => {
    assert.match(renderDraft(base), /^tags: \[\]$/m);
  });

  it("시리즈를 줬을 때만 series가 나오고, 회차는 줬을 때만 박힌다", () => {
    assert.doesNotMatch(renderDraft(base), /^series:/m);

    const loose = renderDraft({ ...base, series: "예가체페 연대기" });
    assert.match(loose, /^series: "예가체페 연대기"$/m);
    assert.doesNotMatch(loose, /^episode:/m);

    const numbered = renderDraft({ ...base, series: "예가체페 연대기", episode: 3 });
    assert.match(numbered, /^episode: 3$/m);
  });

  it("회차만 있고 시리즈가 없으면 회차는 버려진다", () => {
    assert.doesNotMatch(renderDraft({ ...base, episode: 3 }), /^episode:/m);
  });

  it("소개는 줬을 때만 나온다", () => {
    assert.doesNotMatch(renderDraft(base), /^description:/m);
    assert.match(
      renderDraft({ ...base, description: "열두 번 내리고 하나로 굳혔다." }),
      /^description: "열두 번 내리고 하나로 굳혔다."$/m,
    );
  });
});
