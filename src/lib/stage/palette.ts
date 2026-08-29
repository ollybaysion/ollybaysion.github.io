/**
 * 각도 → 색.
 *
 * 무대의 모든 색(빔·점등·글 점·반사 막대·별자리)은 커서나 글이 놓인 각도 하나에서
 * 나온다. 등록부의 카테고리 base 색을 호 중심에 박고, 그 사이를 각도로 보간한다.
 *
 * 정본(`Main.dc.html`)은 이 보간을 `mix(217, 91, t)` 처럼 손으로 적어뒀는데,
 * 그 숫자가 그대로 등록부의 커피(#d9a154, 중심 270°)·개발(#5b8def, 중심 90°)이다.
 * 그래서 색을 베끼지 않고 등록부에서 다시 만든다 — 카테고리를 추가하면 색도 따라온다.
 */
import { categories, colorOf } from "../../config/categories.ts";
import {
  angularDistance,
  arcSpan,
  norm360,
  toAbsolute,
  toLocal,
} from "../coords/arc.ts";
import type { Arc } from "../coords/types.ts";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/** `#rrggbb` → 채널. 등록부 색은 전부 이 형식이다. */
export function parseHex(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{6}$/.test(value)) {
    throw new Error(`색은 #rrggbb 형식이어야 한다: "${hex}"`);
  }
  const n = Number.parseInt(value, 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}

/** SVG·CSS에 그대로 넣는 문자열. 정본과 같이 채널마다 반올림한다. */
export function toRgbString({ r, g, b }: Rgb): string {
  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.max(0, Math.min(1, t));
  return {
    r: Math.round(a.r + (b.r - a.r) * k),
    g: Math.round(a.g + (b.g - a.g) * k),
    b: Math.round(a.b + (b.b - a.b) * k),
  };
}

/** 호의 한가운데 각도. 그 카테고리의 색이 가장 진하게 나오는 자리다. */
export function centerAngle(arc: Arc): number {
  return toAbsolute(arc, arcSpan(arc) / 2);
}

interface Stop {
  angle: number;
  color: Rgb;
}

const CATEGORY_ORDER = Object.keys(categories);

/** 등록부 → 각도순 색 정거장. 모듈 로드 때 한 번만 만든다. */
const STOPS: Stop[] = Object.entries(categories)
  .map(([, def]) => ({
    angle: centerAngle(def.arc),
    color: parseHex(def.color.base),
  }))
  .sort((a, b) => a.angle - b.angle);

/**
 * 각도에 놓인 색. 이웃한 두 호 중심 사이를 각도 비율로 섞는다.
 * 카테고리가 하나뿐이면 어디서나 그 색이다.
 */
export function angleColor(angle: number): string {
  if (STOPS.length === 1) return toRgbString(STOPS[0]!.color);

  const a = norm360(angle);
  for (let i = 0; i < STOPS.length; i += 1) {
    const lo = STOPS[i]!;
    const hi = STOPS[(i + 1) % STOPS.length]!;
    const span = norm360(hi.angle - lo.angle) || 360;
    const offset = norm360(a - lo.angle);
    if (offset <= span)
      return toRgbString(mixRgb(lo.color, hi.color, offset / span));
  }
  // 위 순회는 반드시 한 구간에 걸린다. 부동소수 끝자락 대비 폴백.
  return toRgbString(STOPS[0]!.color);
}

/** 각도가 호 안이면 0, 밖이면 가까운 쪽 끝까지의 각거리. */
export function arcDistance(arc: Arc, angle: number): number {
  const local = toLocal(arc, angle);
  const span = arcSpan(arc);
  if (local <= span) return 0;
  return Math.min(
    angularDistance(angle, arc[0]),
    angularDistance(angle, arc[1]),
  );
}

/**
 * 이 각도의 주인 카테고리. 빈 호(150~210° · 330~30°)를 가리키면 가장 가까운 호를 준다 —
 * 무대가 이름 없는 상태로 비는 것보다 낫다. 정확히 같은 거리면 등록 순서가 이긴다.
 */
export function nearestCategory(angle: number): string {
  let best = CATEGORY_ORDER[0]!;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const name of CATEGORY_ORDER) {
    const d = arcDistance(categories[name]!.arc, angle);
    if (d < bestDistance) {
      bestDistance = d;
      best = name;
    }
  }
  return best;
}

/** 카테고리를 대표하는 색 — 호 중심의 색이다. */
export function categoryColor(name: string): string {
  return toRgbString(parseHex(colorOf(name).base));
}

/** 목록·글 화면에서 원 안 이름을 앉히는 진한 색. */
export function categoryDeepColor(name: string): string {
  return toRgbString(parseHex(colorOf(name).deep));
}
