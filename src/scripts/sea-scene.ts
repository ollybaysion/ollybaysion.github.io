/**
 * 바다 장면 — 먹선 파도 캔버스와 그 위의 윤슬을 한 덩어리로 붙인다.
 *
 * 메인 무대와 글 화면 꼬리가 같은 바다를 본다. 두 화면이 다른 건 두 가지뿐이다:
 * **깊이**(무대는 수평선에서 화면 바닥까지, 꼬리는 그 깊이를 200단위 띠에 눌러 담는다)와
 * **광원 색**. 나머지 — 파도 일생 · 달길 기둥 · 그림자 띠 · 물비늘 — 는 한 곳에서 나온다.
 *
 * 붙일 자리는 id가 아니라 `data-` 표시로 찾는다. 두 화면이 id 규칙이 달라서
 * (`#glade-col` vs `#gladeP-col`) 이름으로 묶으면 한쪽이 반드시 어긋난다.
 */
import {
  createSea,
  flashAt,
  GLADE_GLINTS,
  gladeColumnPath,
  gladeHalfWidth,
} from "../lib/stage/sea.ts";

/** 캔버스가 차지할 자리 — 전부 무대 단위, `px`만 화면 배율이다. */
export interface SeaBox {
  /** 캔버스 왼쪽 끝(무대 x). */
  left: number;
  /** 캔버스 폭. */
  width: number;
  /** 파도가 수평선에서 물가까지 내려가는 깊이. 윤슬 좌표계의 기준이다. */
  depth: number;
  /** 화면에서 그 깊이가 차지하는 높이. `depth`보다 작으면 바다가 눌린다. */
  height: number;
  /** 무대 한 단위가 화면 몇 px인가. */
  px: number;
}

export interface SeaScene {
  /** 모션 줄이기 화면인가 — 매 프레임 부를 필요가 없다는 뜻이다. */
  readonly reduceMotion: boolean;
  /** 자리가 바뀌었다. 캔버스 픽셀을 다시 잡고 한 장 그린다. */
  resize(box: SeaBox): void;
  /** 한 프레임. */
  render(t: number): void;
  /** 광원 색이 바뀌었다 — 수면에 비친 빛도 그 빛이다. */
  tint(color: string): void;
}

/** 백업 픽셀 상한 — 4K에서 캔버스가 두 배로 커지면 파도가 프레임을 놓친다. */
const DPR_MAX = 1.7;

/**
 * `scope` 안의 `[data-sea]`(캔버스를 품은 foreignObject)와 `[data-glade]`(윤슬)을 붙인다.
 * 둘 중 하나라도 없으면 그 화면에는 바다가 없다는 뜻이니 조용히 물러난다.
 */
export function mountSea(scope: ParentNode): SeaScene | null {
  const fo = scope.querySelector<SVGForeignObjectElement>("[data-sea]");
  const glade = scope.querySelector<SVGGElement>("[data-glade]");
  const cv = fo?.querySelector("canvas");
  const g = cv?.getContext("2d");
  if (!fo || !glade || !cv || !g) return null;

  const gladeCol = glade.querySelector<SVGPathElement>("[data-glade-col]")!;
  const gladeCore = glade.querySelector<SVGEllipseElement>("[data-glade-core]")!;
  const bands = [
    ...glade.querySelectorAll<SVGEllipseElement>("[data-glade-band]"),
  ];
  const glintsG = glade.querySelector<SVGGElement>("[data-glade-glints]")!;
  const glints = [...glintsG.querySelectorAll<SVGRectElement>("rect")];
  const stops = [...scope.querySelectorAll<SVGStopElement>("[data-glade-stop]")];

  const sea = createSea();
  const view = { w: 700, depth: 272, h: 272, scale: 1 };

  /**
   * 모션 줄이기 — 파도는 흐르지 않는다. 세 장을 일생의 서로 다른 지점에 세워 두고
   * 윤슬 시각을 0에 고정해 정지화 한 장만 그린다.
   */
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  const stillClock = performance.now() / 1000;
  if (reduceMotion) sea.freeze(stillClock);

  /**
   * 윤슬 — 달길 기둥 · 수면에 닿은 중심 · 그림자 띠 · 물비늘.
   *
   * 띠와 낱알이 물리는 건 능선 위상이 아니라 `sea.draw`가 돌려주는 이번 프레임의
   * 파도 목록이다 — 화면에 그려진 먹선이 그 깊이를 지날 때 띠가 지고 낱알이 켜진다.
   * 위상으로 물리면 빛이 파도보다 먼저 켜지거나 늦게 켜져서 둘이 남남이 된다.
   */
  function renderGlade(
    t: number,
    wind: number,
    waves: readonly { y: number; a: number; cr: number }[],
  ): void {
    // 기둥은 바람이 셀수록 넓게 퍼진다.
    const spread = 0.75 + 0.6 * wind;
    gladeCol.setAttribute("d", gladeColumnPath(t, spread));
    gladeCore.setAttribute(
      "opacity",
      (0.35 + 0.12 * Math.sin(t * 1.1)).toFixed(2),
    );

    // 그림자 띠 — 파도의 등이 빛을 가린 자국. 가장자리 없이 번져야 물 위의 그림자로
    // 읽힌다. 모서리가 서면 검은 판자를 얹은 것처럼 보인다.
    bands.forEach((node, i) => {
      const wave = waves[i];
      if (!wave || wave.y < 548) {
        node.setAttribute("opacity", "0");
        return;
      }
      const bu = (wave.y - 545) / 237;
      const bhw = gladeHalfWidth(wave.y, spread) + 8;
      const bh = 2 + 9 * bu + 8 * wave.cr;
      node.setAttribute("cy", (wave.y + bh / 2).toFixed(1));
      node.setAttribute("rx", (bhw * 1.2).toFixed(1));
      node.setAttribute("ry", (bh * 0.8).toFixed(1));
      node.setAttribute("opacity", Math.min(0.7, wave.a * 1.1).toFixed(2));
    });

    // 물비늘 — 파도가 제 깊이를 지나는 낱알만 밝아진다. 나머지는 잔물결로 숨만 쉰다.
    const gspread = 0.7 + 0.7 * wind;
    glints.forEach((node, i) => {
      const glint = GLADE_GLINTS[i]!;
      const reach = (14 + 96 * glint.u ** 1.4) * gspread;
      const flash = flashAt(glint.y, waves, 8 + 10 * glint.u);
      const amb = 0.5 + 0.5 * Math.sin(t * glint.v + glint.ph);
      const w = glint.len * (0.85 + 0.6 * flash);
      node.setAttribute("x", (350 + glint.gx * reach - w / 2).toFixed(1));
      node.setAttribute("width", w.toFixed(1));
      node.setAttribute(
        "opacity",
        Math.min(1, glint.envl * (0.05 + 0.13 * amb + 0.9 * flash)).toFixed(3),
      );
    });
  }

  function render(t: number): void {
    const clock = reduceMotion ? stillClock : t;
    // 깊이를 화면 높이에 눌러 담는다 — 세로 배율만 다르고 그리는 좌표는 무대 그대로다.
    const squash = view.h / view.depth;
    g.setTransform(view.scale, 0, 0, view.scale * squash, 0, 0);
    g.clearRect(0, 0, view.w, view.depth);
    const frame = sea.draw(g, view.w, view.depth, clock, Date.now() / 1000);
    renderGlade(reduceMotion ? 0 : t, frame.wind, frame.waves);
  }

  return {
    reduceMotion,

    resize(box) {
      view.w = box.width;
      view.depth = box.depth;
      view.h = box.height;
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_MAX);
      view.scale = box.px * dpr;
      fo.setAttribute("x", String(box.left));
      fo.setAttribute("width", String(box.width));
      fo.setAttribute("height", String(box.height));
      cv.width = Math.max(1, Math.round(box.width * box.px * dpr));
      cv.height = Math.max(1, Math.round(box.height * box.px * dpr));
      // 캔버스가 새로 잡혔으니 한 장 다시 그린다.
      // 모션을 줄인 화면에서는 이게 유일한 한 장이다.
      render(performance.now() / 1000);
    },

    render,

    tint(color) {
      for (const stop of stops) stop.setAttribute("stop-color", color);
      glintsG.setAttribute("fill", color);
    },
  };
}
