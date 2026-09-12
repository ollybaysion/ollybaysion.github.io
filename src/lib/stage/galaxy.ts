/**
 * 은하수 — 눈이 못 가르는 별 무리.
 *
 * 글 점은 각도(주제)와 반지름(나이)으로 자리를 얻고, 닮은 글은 계약대로 붙는다. 붙은 점
 * 둘에 이름표를 따로 달면 겹치고, 누르면 가장 가까운 하나로만 가서 나머지는 영영 못 가는
 * 글이 된다. 그래서 점끼리 GALAXY_R 안에 붙으면 별 하나가 아니라 **은하수 하나**로 그린다:
 * 이름표는 하나, 누르면 그 안의 별 목록이 올라온다.
 *
 * 묶음은 **화면 거리**로 잰다. 은하수는 "눈이 못 가른다"는 보이는 사실이고, 계약("가까우면
 * 닮았다")이 그걸 뜻으로 번역해 준다. 좌표는 원장 그대로고 묶음은 그리는 시점의 사실이라,
 * 해가 지나 반지름이 벌어지면 은하수가 띠로 늘어나다 낱별로 풀릴 수 있다.
 *
 * 이름은 구성원 전부가 공유하는 태그다. 은하수는 비유라 frontmatter에 없다 — 글은 태그만
 * 단다. 공유 태그가 여럿이면 가장 새 글이 앞에 적은 것(저자가 앞에 둔 태그가 더 중요하다),
 * 하나도 없으면 "N편".
 */
import { meanAngle } from "../coords/arc.ts";
import { normalizeTag } from "../coords/hash.ts";

/**
 * 이 거리 안이면 한 은하수. 커서가 점을 눌렀다고 보는 반경(main-stage HIT_R)과 같다 —
 * 손이 못 가르는 거리면 눈도 못 가른다.
 */
export const GALAXY_R = 8;

export interface Star {
  slug: string;
  title: string;
  /** ISO 날짜. 이름을 고를 때 가장 새 글을 찾는다. */
  date: string;
  tags: readonly string[];
  angle: number;
  x: number;
  y: number;
}

export interface Galaxy<S extends Star = Star> {
  /** 새 글부터. */
  stars: S[];
  name: string;
  /** 구성원의 원형 평균 — 색과 이름표 방향은 이걸 본다. */
  angle: number;
  x: number;
  y: number;
}

/**
 * 거리 `reach` 안의 점들을 이어 묶는다(단일 연결). a–b, b–c가 닿으면 a–c가 멀어도 한 묶음 —
 * 띠처럼 늘어난 은하수도 은하수다. 결과 순서는 입력 순서를 따른다.
 */
export function clusterStars<S extends Star>(
  stars: readonly S[],
  reach = GALAXY_R,
): S[][] {
  const parent = stars.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  for (let i = 0; i < stars.length; i += 1) {
    for (let j = i + 1; j < stars.length; j += 1) {
      const a = stars[i]!;
      const b = stars[j]!;
      if (Math.hypot(a.x - b.x, a.y - b.y) <= reach) {
        parent[find(j)] = find(i);
      }
    }
  }
  const groups = new Map<number, S[]>();
  stars.forEach((star, i) => {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(star);
    else groups.set(root, [star]);
  });
  return [...groups.values()];
}

/** 새 글부터. 같은 날이면 슬러그 순 — 결정론. */
function newestFirst<S extends Star>(stars: readonly S[]): S[] {
  return [...stars].sort(
    (a, b) => Date.parse(b.date) - Date.parse(a.date) || a.slug.localeCompare(b.slug),
  );
}

/** 구성원 전부가 공유하는 태그 중 가장 새 글이 앞에 적은 것. 없으면 "N편". */
export function galaxyName(stars: readonly Star[]): string {
  const sorted = newestFirst(stars);
  const newest = sorted[0];
  if (!newest) return "0편";
  const rest = sorted.slice(1).map((star) => new Set(star.tags.map(normalizeTag)));
  for (const tag of newest.tags) {
    const key = normalizeTag(tag);
    if (key === "") continue;
    if (rest.every((set) => set.has(key))) return tag.trim();
  }
  return `${stars.length}편`;
}

/** 두 편 이상 붙은 묶음만 은하수다. 별 하나는 그냥 별. */
export function findGalaxies<S extends Star>(
  stars: readonly S[],
  reach = GALAXY_R,
): Galaxy<S>[] {
  return clusterStars(stars, reach)
    .filter((group) => group.length > 1)
    .map((group) => {
      const sorted = newestFirst(group);
      return {
        stars: sorted,
        name: galaxyName(sorted),
        angle: meanAngle(sorted.map((star) => star.angle)),
        x: sorted.reduce((sum, star) => sum + star.x, 0) / sorted.length,
        y: sorted.reduce((sum, star) => sum + star.y, 0) / sorted.length,
      };
    });
}
