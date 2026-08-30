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
import type { CategoryDef } from "../../config/categories.ts";
import { categories, colorOf } from "../../config/categories.ts";
import {
  angularDistance,
  arcSpan,
  norm360,
  toAbsolute,
  toLocal,
} from "../coords/arc.ts";
import type { Arc } from "../coords/types.ts";

/**
 * 무대 먹선 — `#e8e6e1`의 채널만. `rgba(INK,a)`로 끼워 쓴다.
 *
 * 색이 아니라 잉크다. 각도에서 나오는 빛(아래 `angleColor`)과 달리 이건 무엇을 그리든
 * 같다 — 파도도 배롱나무도 같은 붓을 든다.
 */
export const INK = '232,230,225';

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

/** 색 정거장 하나 — 호 중심과 그 자리의 색. */
export interface ColorStop {
  angle: number;
  color: Rgb;
}

const CATEGORY_ORDER = Object.keys(categories);

/** 등록부 → 각도순 색 정거장. */
export function colorStops(defs: Record<string, CategoryDef>): ColorStop[] {
  return Object.values(defs)
    .map((def) => ({
      angle: centerAngle(def.arc),
      color: parseHex(def.color.base),
    }))
    .sort((a, b) => a.angle - b.angle);
}

/**
 * 정거장 사이를 각도 비율로 섞는다. 정거장이 하나뿐이면 어디서나 그 색이다.
 *
 * 등록부가 아니라 정거장을 받는다 — **섞는 방식**과 **지금 등록된 카테고리**는 다른
 * 문제라서다. 앞은 정본이 손으로 적어둔 그대로 고정이고, 뒤는 카테고리를 들일 때마다
 * 늘어난다. 갈라 놓아야 정본 대조가 등록부 변경에 휘둘리지 않는다.
 */
export function rgbAt(stops: readonly ColorStop[], angle: number): Rgb {
  if (stops.length === 0) throw new Error("색 정거장이 하나도 없다");
  if (stops.length === 1) return stops[0]!.color;

  const a = norm360(angle);
  for (let i = 0; i < stops.length; i += 1) {
    const lo = stops[i]!;
    const hi = stops[(i + 1) % stops.length]!;
    const span = norm360(hi.angle - lo.angle) || 360;
    const offset = norm360(a - lo.angle);
    if (offset <= span) return mixRgb(lo.color, hi.color, offset / span);
  }
  // 위 순회는 반드시 한 구간에 걸린다. 부동소수 끝자락 대비 폴백.
  return stops[0]!.color;
}

/** 지금 등록된 카테고리로 만든 정거장. 모듈 로드 때 한 번만 만든다. */
const STOPS = colorStops(categories);

/** 각도에 놓인 색. 이웃한 두 호 중심 사이를 각도 비율로 섞는다. */
export function angleRgb(angle: number): Rgb {
  return rgbAt(STOPS, angle);
}

export function angleColor(angle: number): string {
  return toRgbString(angleRgb(angle));
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 };

/**
 * 각도의 색을 흰빛 쪽으로 바래게 한 것 — `t`가 1이면 흰색.
 *
 * 광원 **안쪽**은 밝아서 색이 씻긴다. 한가운데일수록 희고 가장자리로 갈수록 색이
 * 배어나는데, 정본의 빛구멍이 정확히 그렇게 칠해져 있다: 중심 `#fffdf4`와 가장자리
 * `#eeddb8`이 커피 호박(#d9a154)을 각각 0.95 · 0.59만큼 흰빛에 섞은 값이다.
 * 그 비율을 그대로 쓰면 쉬는 색은 정본 그대로면서 광원 색을 따라간다.
 */
export function angleColorWashed(angle: number, t: number): string {
  return toRgbString(mixRgb(angleRgb(angle), WHITE, t));
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
