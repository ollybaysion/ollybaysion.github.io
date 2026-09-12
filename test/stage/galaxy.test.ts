/**
 * 은하수 — 눈이 못 가르는 점들은 하나로 묶이고, 이름은 공유 태그에서 온다.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GALAXY_R,
  clusterStars,
  findGalaxies,
  galaxyName,
} from "../../src/lib/stage/galaxy.ts";
import type { Star } from "../../src/lib/stage/galaxy.ts";

function star(
  slug: string,
  x: number,
  y: number,
  tags: string[] = [],
  date = "2026-09-01",
): Star {
  return { slug, title: slug, date, tags, angle: 80, x, y };
}

describe("clusterStars — 화면 거리로 묶는다", () => {
  it("GALAXY_R 안이면 한 묶음, 밖이면 따로", () => {
    const near = clusterStars([star("a", 0, 0), star("b", 3, 0)]);
    assert.equal(near.length, 1);
    const far = clusterStars([star("a", 0, 0), star("b", 20, 0)]);
    assert.equal(far.length, 2);
  });

  it("경계값은 안쪽이다", () => {
    assert.equal(clusterStars([star("a", 0, 0), star("b", GALAXY_R, 0)]).length, 1);
    assert.equal(clusterStars([star("a", 0, 0), star("b", GALAXY_R + 0.01, 0)]).length, 2);
  });

  it("a–b, b–c가 닿으면 a–c가 멀어도 한 띠", () => {
    const groups = clusterStars([star("a", 0, 0), star("c", 12, 0), star("b", 6, 0)]);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0]!.map((s) => s.slug), ["a", "c", "b"]);
  });

  it("빈 입력은 빈 결과", () => {
    assert.deepEqual(clusterStars([]), []);
  });
});

describe("galaxyName — 공유 태그가 이름", () => {
  it("전원이 공유하는 태그, 가장 새 글이 앞에 적은 순", () => {
    const name = galaxyName([
      star("old", 0, 0, ["llm", "Claude Code"], "2026-08-31"),
      star("new", 1, 0, ["Claude Code", "llm", "skills"], "2026-09-12"),
    ]);
    assert.equal(name, "Claude Code");
  });

  it("표기는 가장 새 글 것, 비교는 대소문자를 안 가린다", () => {
    const name = galaxyName([
      star("old", 0, 0, ["claude code"], "2026-08-31"),
      star("new", 1, 0, ["Claude Code"], "2026-09-12"),
    ]);
    assert.equal(name, "Claude Code");
  });

  it("공유 태그가 없으면 편수", () => {
    assert.equal(
      galaxyName([star("a", 0, 0, ["astro"]), star("b", 1, 0, ["llm"]), star("c", 2, 0)]),
      "3편",
    );
  });

  it("한 편이 태그가 없으면 공유 태그도 없다", () => {
    assert.equal(galaxyName([star("a", 0, 0, ["llm"]), star("b", 1, 0)]), "2편");
  });
});

describe("findGalaxies — 두 편 이상만 은하수", () => {
  it("혼자인 별은 은하수가 아니다", () => {
    const galaxies = findGalaxies([
      star("a", 0, 0, ["x"]),
      star("b", 3, 0, ["x"]),
      star("lone", 100, 100, ["x"]),
    ]);
    assert.equal(galaxies.length, 1);
    assert.deepEqual(galaxies[0]!.stars.map((s) => s.slug), ["a", "b"]);
  });

  it("구성원은 새 글부터, 자리는 무게중심", () => {
    const [galaxy] = findGalaxies([
      star("old", 0, 0, ["x"], "2026-08-31"),
      star("new", 4, 2, ["x"], "2026-09-12"),
    ]);
    assert.deepEqual(galaxy!.stars.map((s) => s.slug), ["new", "old"]);
    assert.deepEqual([galaxy!.x, galaxy!.y], [2, 1]);
    assert.equal(galaxy!.name, "x");
  });

  it("각도는 원형 평균 — 0° 언저리에서 180°로 튀지 않는다", () => {
    const [galaxy] = findGalaxies([
      { ...star("a", 0, 0, ["x"]), angle: 359 },
      { ...star("b", 3, 0, ["x"]), angle: 1 },
    ]);
    assert.ok(galaxy!.angle < 1 || galaxy!.angle > 359, `angle ${galaxy!.angle}`);
  });
});
