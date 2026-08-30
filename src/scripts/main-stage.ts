/**
 * 메인 무대의 움직임 — 참조 구현 = `~/repo/blog-screens/Main.dc.html`의
 * `<script data-dc-script>`. 기하(메타볼 goo·파도 능선·감쇠 진동)는 그대로 옮겼고,
 * 정본이 지어낸 앵커 목록만 카테고리 등록부로 갈아끼웠다.
 *
 * 호버 = 빛구멍과 커서를 잇는 막, 막 범위 안 글 점등.
 * 클릭 = 점 위면 그 글로, 빈 자리면 유사도 파도 목록(거리순).
 *        다른 지점 클릭 = 리로드, 내리기 = 닫기.
 * CLI = 데모. 명령 체계가 미확정이라 입력 확인 모달까지만 간다.
 */
import { treeShift } from "../lib/stage/flower.ts";
import {
  angleColor,
  angleColorWashed,
  nearestCategory,
} from "../lib/stage/palette.ts";
import { HORIZON_Y } from "../lib/stage/sea.ts";
import { mountFlower } from "./flower-scene.ts";
import { mountSea } from "./sea-scene.ts";

/** 정본 좌표계. 세로는 이 값을 그대로 쓰고, 가로만 화면 비율에 맞춰 벌어진다. */
const VIEW_W = 700;
const VIEW_H = 790;
/** 정본의 좌우 여백. 파도 패널 글자가 이만큼 띄고 앉는다. */
const EDGE = 52;
/** 빛구멍 중심. 좌표 엔진의 CENTER와 같은 값이다. */
const CX = 350;
const CY = 235;

/** 아이콘 줄 — 이름 블록(minY 기준) 안에서의 자리. */
const SOCIAL_Y = 116;
/**
 * 좌측 명함이 시작하는 자리(무대 절대 좌표).
 *
 * 이름 블록과 달리 화면 위쪽에 매달리지 않는다 — 명함은 빛구멍 옆 하늘에 앉는 덩어리라
 * 무대에 고정이다. 이름 블록과 한 덩어리로 붙으면 좌측 열이 한 문단처럼 읽혀서 떼어 놨다.
 */
const CARD_Y = 226;

/** 이 선 아래는 원 구역이 아니다 — CLI·바다·패널의 영역. */
const CLI_TOP = 470;
const CLI_BOTTOM = 514;
/** 패널이 다 올라왔을 때의 위쪽 기준선. */
const PANEL_TOP = 524;
/** 파도 능선이 앉는 y. */
const WAVE_Y = 536;
/**
 * 파도 목록의 발치 — "목록 자세히"(762) 아래 한 뼘.
 *
 * 낮은 창에서는 이 발치가 화면 밖으로 나간다. 그럴 때 목록은 제자리를 고집하지 않고
 * 통째로 위로 올라앉는다(`panelLift`). 올라앉는 폭은 화면 높이가 정하는데,
 * SCENE_MIN_H·KEEP_TOP이 h≥500 · minY≤125을 보장하니 능선이 379보다 위로는 못 온다 —
 * 빛구멍 아래(330)다. 목록이 올라와도 빛구멍은 가리지 않는다.
 */
const PANEL_FOOT = 782;

/** 메타볼 상수 — 확정값이라 건드리지 않는다. */
const R1 = 95;
const R2 = 4;
const GOO_V = 0.66;
const GOO_H = 2.4;

/** 점이 커서 쪽으로 끌려오는 거리와 그 감쇠 폭. */
const PULL_MAX = 10;
const PULL_SIGMA = 75;
/**
 * 점을 눌렀다고 볼 반경 — **그려진 자리** 기준이다.
 *
 * 점은 커서 쪽으로 끌려와서 원래 좌표와 화면에 보이는 자리가 다르다. 사람은 보이는 걸
 * 겨냥하니 판정도 보이는 자리에서 해야 한다. 손가락은 커서보다 굵어 넉넉히 잡는다.
 */
const HIT_R = 8;
const HIT_R_TOUCH = 16;

/**
 * 빔이 프레임선 안쪽에서 잦아드는 폭.
 *
 * 선에서 딱 끊으면 막이 잘린 자국을 남긴다. CLI 줄 위에서 잦아드는 것과 같은 값이다.
 */
const BEAM_FADE = 40;

/**
 * 무대 한 단위가 화면에서 가져야 할 최소 픽셀.
 *
 * 좁은 화면에서 정본 폭(700)을 통째로 담으면 한 단위가 0.56px까지 줄어 12단위 제사가
 * 6.7px이 된다 — 장면이 아니라 축소판이다. 그래서 폰에서는 **벌리는 대신 잘라 확대한다**.
 * 0.92는 제사가 11px, 파도 목록 제목이 12px쯤 서는 자리다.
 */
const MIN_UNIT_PX = 0.92;
/**
 * 아무리 확대해도 이보다 좁히지 않는다 — 글 점이 사는 원이 통째로 들어와야 무대다.
 * 지름 390(RADIUS_MAX 195)에 좌우 여백 20씩.
 */
const SCENE_MIN_W = 430;
/** 세로도 같다 — 빛구멍·CLI 줄·물가 한 자락이 한 화면에 남을 최소 높이. */
const SCENE_MIN_H = 500;
/**
 * 창이 정본(790)보다 낮을 때 화면에서 밀려나면 안 되는 띠.
 *
 * 위는 빛구멍 꼭대기(235−95) 위 한 뼘, 아래는 파도 능선 조금 아래다. 가운데를 맞추면
 * 가로로 누운 화면에서 빛구멍 정수리가 잘린다 — 장면의 한가운데가 아니라 이 띠를 맞춘다.
 */
const KEEP_TOP = 125;
const KEEP_BOTTOM = 560;

/**
 * 손가락만 있는 화면인가.
 *
 * 커서가 없으면 호버로 켜지는 것이 영영 켜지지 않는다 — 글 점이 하나도 안 보이는 무대가
 * 폰에서 벌어진 일이다. 점은 늘 켜 두고, 이름표는 접는다(잘라 확대한 무대에서는 화면
 * 밖으로 나간다). 제목은 눌러서 올라오는 파도 목록이 읽어 준다.
 */
const TOUCH = window.matchMedia("(hover: none)").matches;
/** 손가락 화면에서 점이 늘 지니는 밝기 — 별처럼 켜 둔 자리. */
const DOT_REST = 0.5;

interface Post {
  angle: number;
  slug: string;
  category: string;
  x: number;
  y: number;
  dot: SVGCircleElement;
  label: SVGTextElement;
}

interface Row {
  link: SVGAElement;
  /** 행 전체를 받는 판 — 글자만으로는 손가락이 겨냥할 자리가 없다. */
  hit: SVGRectElement;
  dot: SVGCircleElement;
  title: SVGTextElement;
  distance: SVGTextElement;
}

function clamp1(n: number): number {
  return Math.max(-1, Math.min(1, n));
}

/**
 * 커서에 끌려온 점의 자리와 원래 자리에서 잰 거리.
 *
 * 그리기와 클릭 판정이 같은 식을 봐야 한다 — 갈라지면 보이는 점과 눌리는 점이 어긋난다.
 */
function pulled(
  post: Post,
  cx: number,
  cy: number,
  op: number,
): { x: number; y: number; dist: number } {
  const dx = cx - post.x;
  const dy = cy - post.y;
  const dist = Math.max(1, Math.hypot(dx, dy));
  const pull = Math.exp(-((dist / PULL_SIGMA) ** 2)) * PULL_MAX * op;
  return {
    x: post.x + (dx / dist) * pull,
    y: post.y + (dy / dist) * pull,
    dist,
  };
}

function start(svg: SVGSVGElement): void {
  const dMax = Number(svg.dataset.dMax) || 390;

  const posts: Post[] = [...svg.querySelectorAll<SVGGElement>(".post")].map(
    (g) => {
      const angle = Number(g.dataset.a);
      const radius = Number(g.dataset.r);
      const a = (angle * Math.PI) / 180;
      return {
        angle,
        slug: g.dataset.slug ?? "",
        category: g.dataset.category ?? "",
        x: CX + radius * Math.cos(a),
        y: CY + radius * Math.sin(a),
        dot: g.querySelector("circle")!,
        label: g.querySelector("text")!,
      };
    },
  );

  const beam = svg.querySelector<SVGPathElement>("#beam")!;
  const beamStops = [...svg.querySelectorAll<SVGStopElement>("#beamgrad stop")];
  const haloStops = [
    ...svg.querySelectorAll<SVGStopElement>("#hoverhalo stop"),
  ];
  const bloomStops = [
    ...svg.querySelectorAll<SVGStopElement>("#hap-bloom stop"),
  ];
  /** 광원 안쪽 — 색이 씻긴 자리들. 얼마나 바랠지는 각자 data-wash에 적혀 있다. */
  const washed = [...svg.querySelectorAll<SVGElement>("[data-wash]")];
  const cliLine = svg.querySelector<SVGGElement>("#cli-line")!;
  const sitename = svg.querySelector<SVGGElement>("#sitename")!;
  const social = svg.querySelector<SVGGElement>("#social")!;
  const alumniCol = svg.querySelector<SVGGElement>("#alumni-col");
  /** 배롱나무 표찰 — 그루를 따라 옮겨 앉는다. */
  const treeLabel = svg.querySelector<SVGGElement>("#tree-label");
  /** 좁아지면 물러나는 조각들 — 제사의 뜻풀이·풀이, 명함, 배롱나무 표찰. */
  const retreating = [...svg.querySelectorAll<SVGElement>("[data-min-w]")];
  const panel = svg.querySelector<SVGGElement>("#panel")!;
  const waveFill = svg.querySelector<SVGPathElement>("#p-wavefill")!;
  const waveLine = svg.querySelector<SVGPathElement>("#p-waveline")!;
  const pName = svg.querySelector<SVGTextElement>("#p-name")!;
  const pClose = svg.querySelector<SVGTextElement>("#p-close")!;
  const pMore = svg.querySelector<SVGAElement>("#p-more")!;
  const pMoreText = pMore.querySelector<SVGTextElement>("text")!;
  /** 목록 화면이 있는 카테고리(MainStage가 적어 둔다). */
  const listed = new Set(
    (svg.dataset.listed ?? "").split(",").filter((name) => name !== ""),
  );
  const cliText = svg.querySelector<SVGTextElement>("#cli-text")!;
  const cliCaret = svg.querySelector<SVGRectElement>("#cli-caret")!;
  const modal = svg.querySelector<SVGGElement>("#modal")!;
  const modalCmd = svg.querySelector<SVGTextElement>("#m-cmd")!;

  const rows: Row[] = [...svg.querySelectorAll<SVGAElement>(".prow")].map(
    (link) => ({
      link,
      hit: link.querySelector<SVGRectElement>(".prow-hit")!,
      dot: link.querySelector("circle")!,
      title: link.querySelector<SVGTextElement>(".pt")!,
      distance: link.querySelector<SVGTextElement>(".pd")!,
    }),
  );

  // 화면 비율만큼 좌우로 벌어진 무대. layout()이 갱신한다.
  // bandL·bandR = 화면에 그어진 프레임 세로선, 곧 좌·가운데·우 영역의 경계다.
  // colL·colR = 파도 목록이 서는 열의 좌우 끝. 좁은 화면에서는 화면 안으로 당겨진다.
  const view = {
    minX: 0,
    minY: 0,
    w: VIEW_W,
    h: VIEW_H,
    bandL: 0,
    bandR: VIEW_W,
    colL: EDGE,
    colR: VIEW_W - EDGE,
  };
  /** 초상이 물러난 화면인가 — 물러났으면 매 프레임 흔들 것도 없다. */
  let flowerOff = false;
  /** 낮은 창에서 파도 목록이 올라앉는 폭(음수). 정본 높이가 나오는 화면에서는 0이다. */
  let panelLift = 0;

  const flowerG = svg.querySelector<SVGGElement>("#flower");
  const bleeds = [...svg.querySelectorAll<SVGLineElement>(".bleed")];
  const covers = [...svg.querySelectorAll<SVGRectElement>(".cover")];
  const bands = [...svg.querySelectorAll<SVGLineElement>(".band")];
  // 바다와 그 위의 윤슬 — 글 화면 꼬리와 같은 장면이다(sea-scene.ts).
  const seaScene = mountSea(svg);
  const flower = mountFlower(svg);

  /**
   * 무대를 뷰포트에 맞춘다.
   * 가로가 넉넉하면 좌우로 벌리고(세로 좌표계는 정본 그대로), 세로로 긴 화면에서는
   * 폭을 700에 묶고 위아래로 벌려 장면을 가운데 놓는다. 어느 쪽이든 원은 원으로 남는다.
   *
   * 작은 화면에서는 한 단계가 더 있다. 담을 수 있는 만큼 다 담으면 한 단위가 0.5px로
   * 줄어 무대가 축소판이 된다 — 그래서 **읽히는 자보다 작아지지 않는 선에서 잘라낸다**
   * (`MIN_UNIT_PX`). 잘라낸 자리에서는 좌측 명함도 초상도 물러나고(data-min-w),
   * 빛구멍과 글 점, CLI 줄, 물가만 남는다. 큰 화면에서는 이 항이 걸리지 않는다.
   */
  function layout(): void {
    const box = svg.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) return;
    const aspect = box.width / box.height;
    const spread = Math.max(VIEW_W, VIEW_H * aspect);
    const w = Math.min(
      spread,
      Math.max(box.width / MIN_UNIT_PX, SCENE_MIN_W, SCENE_MIN_H * aspect),
    );
    const h = w / aspect;
    view.w = w;
    view.h = h;
    view.minX = VIEW_W / 2 - w / 2;
    // 가운데 맞춤이 기본이고, 낮은 창에서만 지켜야 할 띠 쪽으로 밀린다.
    view.minY = Math.max(
      KEEP_BOTTOM - h,
      Math.min(KEEP_TOP, (VIEW_H - h) / 2),
    );
    svg.setAttribute("viewBox", `${view.minX} ${view.minY} ${w} ${h}`);

    const left = view.minX;
    const right = view.minX + w;
    for (const line of bleeds) {
      line.setAttribute("x1", String(left));
      line.setAttribute("x2", String(right));
    }
    for (const rect of covers) {
      rect.setAttribute("x", String(left));
      rect.setAttribute("y", String(view.minY));
      rect.setAttribute("width", String(w));
      rect.setAttribute("height", String(h));
    }
    // 필름 프레임 세로선 — 정본의 폭 대비 위치(17% · 87%)를 유지한다.
    // 그어진 자리를 그대로 영역 경계로 쓴다 — 빔이 그 안에서만 산다(frame).
    const bandXs = bands.map(
      (band) => left + (w * Number(band.dataset.at)) / VIEW_W,
    );
    bands.forEach((band, i) => {
      const x = bandXs[i]!;
      band.setAttribute("x1", String(x));
      band.setAttribute("x2", String(x));
      band.setAttribute("y1", String(view.minY));
      band.setAttribute("y2", String(view.minY + h));
    });
    view.bandL = bandXs.length > 0 ? Math.min(...bandXs) : left;
    view.bandR = bandXs.length > 0 ? Math.max(...bandXs) : right;
    // 바다 — 수평선부터 화면 바닥까지 전폭. 무대에서는 깊이가 곧 화면 높이라
    // 눌리지 않는다(px = 무대 단위 → 화면 px. 비율을 지키는 매핑이라 가로세로가 같다).
    const seaH = Math.max(120, view.minY + h - HORIZON_Y);
    seaScene?.resize({
      left,
      width: w,
      depth: seaH,
      height: seaH,
      px: box.height / h,
    });

    // 배롱나무 — 가지 길이는 정본 그대로 두고, 벽이 화면 끝에 오도록 그루째 옮긴다.
    flower?.resize({ left, width: w });
    // 표찰은 제 나무를 따라간다 — 그루와 같은 거리다.
    treeLabel?.setAttribute(
      "transform",
      `translate(${treeShift(right).toFixed(1)},0)`,
    );

    // CLI ❯와 입력은 화면 왼쪽 끝에 붙는다. 파도 목록 행은 가운데 열에 그대로 남는다.
    // 정본 x가 이미 52(EDGE)라 화면 왼쪽 끝만큼만 밀면 된다.
    cliLine.setAttribute("transform", `translate(${left},0)`);

    // 좌측 열 = 명함. 이름·아이콘은 화면 위에서부터, ALUMNI는 빛구멍 옆 하늘에 앉는다.
    sitename.setAttribute(
      "transform",
      `translate(${left + EDGE},${view.minY + 70})`,
    );
    // 아이콘은 제사에 붙는다(시안 116) — 이름·제사·아이콘이 한 덩어리로 읽히게.
    // 뜻이 뜨는 자리를 비워 둘 필요는 없다. 뜻이 뜨는 동안은 아이콘이 물러난다(CSS).
    social.setAttribute(
      "transform",
      `translate(${left + EDGE},${view.minY + SOCIAL_Y})`,
    );
    if (alumniCol) {
      alumniCol.setAttribute("transform", `translate(${left + EDGE},${CARD_Y})`);
    }
    // 물러나는 기준은 실제 글자 길이에서 나온다(MainStage의 needW).
    for (const el of retreating) {
      el.classList.toggle("is-hidden", w < Number(el.dataset.minW));
    }
    flowerOff = flowerG?.classList.contains("is-hidden") ?? false;

    /*
      파도 목록의 열 — 화면 안쪽으로 당긴다.
      정본 x(52 · 648)는 700 폭 안의 자리다. 잘라 확대한 무대에서는 그 자리가 화면
      밖이라 목록이 통째로 사라진다. 넓은 화면에서는 정본 자리가 이미 안쪽이라
      아무 일도 일어나지 않는다.
    */
    view.colL = Math.max(EDGE, left + EDGE);
    view.colR = Math.min(VIEW_W - EDGE, right - EDGE);
    // 발치가 화면 밖이면 목록 전체가 그만큼 올라앉는다.
    panelLift = Math.min(0, view.minY + h - PANEL_FOOT);
    pName.setAttribute("x", view.colL.toFixed(1));
    pClose.setAttribute("x", view.colR.toFixed(1));
    pMoreText.setAttribute("x", view.colL.toFixed(1));
    for (const row of rows) {
      row.hit.setAttribute("x", (view.colL - 12).toFixed(1));
      row.hit.setAttribute("width", (view.colR - view.colL + 24).toFixed(1));
      row.dot.setAttribute("cx", (view.colL + 4).toFixed(1));
      row.title.setAttribute("x", (view.colL + 24).toFixed(1));
      row.distance.setAttribute("x", view.colR.toFixed(1));
    }
  }

  const press = { x: 350, y: 115, op: 0 };
  const target = { x: 350, y: 115, over: false };
  const panelState = { y: 290, op: 0, open: false, t: 0, pulse: 0 };
  const modalState = { open: false, op: 0 };
  let phase = 0;
  let lastT = 0;
  let command = "";
  let raf = 0;

  /** 화면 좌표 → 무대 좌표. 무대가 벌어져도 정본 좌표계 위에서 계산한다. */
  function toStage(e: {
    clientX: number;
    clientY: number;
  }): { x: number; y: number } | null {
    const b = svg.getBoundingClientRect();
    if (b.width === 0 || b.height === 0) return null;
    const inside =
      e.clientX >= b.left &&
      e.clientX <= b.right &&
      e.clientY >= b.top &&
      e.clientY <= b.bottom;
    if (!inside) return null;
    return {
      x: view.minX + ((e.clientX - b.left) * view.w) / b.width,
      y: view.minY + ((e.clientY - b.top) * view.h) / b.height,
    };
  }

  function openPanel(x: number, y: number): void {
    const sorted = posts
      .map((post) => {
        const d = Math.hypot(x - post.x, y - post.y);
        return { post, d, proximity: Math.max(0, 1 - d / dMax) };
      })
      .sort((a, b) => a.d - b.d || a.post.slug.localeCompare(b.post.slug));

    let angle = (Math.atan2(y - CY, x - CX) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    const category = nearestCategory(angle);

    pName.textContent = category;
    // 글이 없는 카테고리는 목록 화면이 없다 — 없는 길로 보내는 대신 그렇다고 적는다.
    if (listed.has(category)) {
      pMoreText.textContent = "목록 자세히 →";
      pMore.setAttribute(
        "href",
        `/list/${encodeURIComponent(category)}/?x=${x.toFixed(1)}&y=${y.toFixed(1)}`,
      );
    } else {
      pMoreText.textContent = "아직 글이 없다";
      pMore.removeAttribute("href");
    }

    rows.forEach((row, i) => {
      const entry = sorted[i];
      if (!entry) {
        row.link.removeAttribute("href");
        row.dot.setAttribute("opacity", "0");
        row.title.setAttribute("opacity", "0");
        row.distance.setAttribute("opacity", "0");
        return;
      }
      row.link.setAttribute("href", `/blog/${entry.post.slug}/`);
      row.dot.setAttribute(
        "fill",
        entry.post.dot.getAttribute("fill") ?? "#8f8c85",
      );
      row.dot.setAttribute("opacity", "1");
      row.title.textContent = entry.post.label.textContent;
      row.title.setAttribute("opacity", "1");
      row.distance.textContent = `${Math.round(entry.proximity * 100)}%`;
      row.distance.setAttribute("opacity", "0.8");
    });
  }

  /**
   * 실제로 어딘가로 데려가는 명령. 앞의 `/`는 있어도 없어도 같다.
   * 나머지 명령 체계는 아직 미확정이라 확인 모달까지만 간다.
   */
  const ROUTES: Record<string, string> = {
    write: "/write/",
    post: "/write/",
  };

  function execCommand(): void {
    const typed = command.trim();
    if (!typed) return;
    command = "";

    const route = ROUTES[typed.replace(/^\//, "").toLowerCase()];
    if (route) {
      window.location.href = route;
      return;
    }

    modalCmd.textContent = `❯ ${typed}`;
    modalState.open = true;
  }

  function onMove(e: PointerEvent): void {
    const point = toStage(e);
    target.over = point !== null;
    if (point) {
      target.x = point.x;
      target.y = point.y;
    }
  }

  function onLeave(): void {
    target.over = false;
  }

  function onDown(e: PointerEvent): void {
    const point = toStage(e);
    if (!point) return;
    // 터치는 pointermove 없이 바로 눌린다 — 커서를 손가락 자리로 옮겨준다.
    target.over = true;
    target.x = point.x;
    target.y = point.y;

    if (modalState.open) {
      modalState.open = false;
      return;
    }

    // 명함과 표찰은 읽는 것이지 누르는 것이 아니다 — 눌러도 아무 일도 없다.
    if (
      (e.target as Element | null)?.closest?.(
        "#sitename, #social, #alumni-col, #tree-label",
      )
    ) {
      return;
    }

    if (panelState.open) {
      const panelTop = PANEL_TOP + panelState.y + panelLift;
      if (point.y > panelTop) {
        // 패널 안 — "내리기 ↓"는 목록 열 오른쪽 끝에 있고, 나머지 행은 링크가 직접 받는다.
        if (
          point.x > view.colR - 96 &&
          point.x < view.colR + 12 &&
          point.y < panelTop + 62
        )
          panelState.open = false;
        return;
      }
    }

    /*
      목록을 부르는 건 가운데 열의 원 구역뿐이다 — 거기가 좌표가 사는 자리라
      "이 지점에서 가까운 글"이 뜻을 갖는다. 양 옆 여백·CLI·그 아래는 무대 밖이라
      누르면 목록이 내려간다.
    */
    const onStage =
      point.x >= EDGE && point.x <= VIEW_W - EDGE && point.y < CLI_TOP;
    if (!onStage) {
      panelState.open = false;
      return;
    }

    // 점을 누르면 그 글로 바로 간다. 빈 자리를 눌렀을 때만 목록이 올라온다.
    const reach = e.pointerType === "touch" ? HIT_R_TOUCH : HIT_R;
    const hit = posts
      .map((post) => {
        const at = pulled(post, press.x, press.y, press.op);
        return { post, d: Math.hypot(point.x - at.x, point.y - at.y) };
      })
      .sort((a, b) => a.d - b.d || a.post.slug.localeCompare(b.post.slug))[0];
    if (hit && hit.d <= reach) {
      location.href = `/blog/${hit.post.slug}/`;
      return;
    }

    openPanel(point.x, point.y);
    if (panelState.open) {
      // 이미 올라와 있으면 그 지점 기준으로 내용만 갈아끼운다.
      panelState.pulse = 1;
    } else {
      panelState.open = true;
      panelState.t = 0;
    }
  }

  function onKey(e: KeyboardEvent): void {
    const node = e.target as HTMLElement | null;
    // 진짜 입력칸에 타이핑 중이면 무대가 가로채지 않는다.
    if (
      node?.isContentEditable ||
      /^(INPUT|TEXTAREA|SELECT)$/.test(node?.tagName ?? "")
    )
      return;
    if (modalState.open) {
      modalState.open = false;
      e.preventDefault();
      return;
    }
    // 마우스가 보드 위에 있을 때만 CLI가 입력을 받는다 (= 포커스).
    if (!target.over) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === "Enter") {
      execCommand();
      e.preventDefault();
      return;
    }
    if (e.key === "Backspace") {
      command = command.slice(0, -1);
      e.preventDefault();
      return;
    }
    if (e.key === "Escape") {
      command = "";
      return;
    }
    if (e.key.length === 1 && command.length < 40) {
      command += e.key;
      e.preventDefault();
    }
  }

  function drawBeam(distance: number, theta: number): number {
    function cl(n: number) {
      return Math.acos(clamp1(n));
    }
    let u1 = 0;
    let u2 = 0;
    if (distance < R1 + R2) {
      u1 = cl((R1 * R1 + distance * distance - R2 * R2) / (2 * R1 * distance));
      u2 = cl((R2 * R2 + distance * distance - R1 * R1) / (2 * R2 * distance));
    }
    const spread = cl((R1 - R2) / distance);
    const g1 = theta + u1 + (spread - u1) * GOO_V;
    const g2 = theta - u1 - (spread - u1) * GOO_V;
    const g3 = theta + Math.PI - u2 - (Math.PI - u2 - spread) * GOO_V;
    const g4 = theta - Math.PI + u2 + (Math.PI - u2 - spread) * GOO_V;
    const p1x = CX + R1 * Math.cos(g1);
    const p1y = CY + R1 * Math.sin(g1);
    const p2x = CX + R1 * Math.cos(g2);
    const p2y = CY + R1 * Math.sin(g2);
    const p3x = press.x + R2 * Math.cos(g3);
    const p3y = press.y + R2 * Math.sin(g3);
    const p4x = press.x + R2 * Math.cos(g4);
    const p4y = press.y + R2 * Math.sin(g4);
    const d13 = Math.hypot(p1x - p3x, p1y - p3y);
    const hs =
      Math.min(GOO_V * GOO_H, d13 / (R1 + R2)) *
      Math.min(1, (distance * 2) / (R1 + R2));
    const HP = Math.PI / 2;
    const h1x = p1x + R1 * hs * Math.cos(g1 - HP);
    const h1y = p1y + R1 * hs * Math.sin(g1 - HP);
    const h2x = p2x + R1 * hs * Math.cos(g2 + HP);
    const h2y = p2y + R1 * hs * Math.sin(g2 + HP);
    const h3x = p3x + R2 * hs * Math.cos(g3 + HP);
    const h3y = p3y + R2 * hs * Math.sin(g3 + HP);
    const h4x = p4x + R2 * hs * Math.cos(g4 - HP);
    const h4y = p4y + R2 * hs * Math.sin(g4 - HP);
    const f = (n: number) => n.toFixed(1);
    beam.setAttribute(
      "d",
      `M${f(p1x)},${f(p1y)} C${f(h1x)},${f(h1y)} ${f(h3x)},${f(h3y)} ${f(p3x)},${f(p3y)}` +
        ` A${R2},${R2} 0 1 0 ${f(p4x)},${f(p4y)}` +
        ` C${f(h4x)},${f(h4y)} ${f(h2x)},${f(h2y)} ${f(p2x)},${f(p2y)} Z`,
    );
    return spread * 0.8;
  }

  function frame(): void {
    press.x += (target.x - press.x) * 0.16;
    press.y += (target.y - press.y) * 0.16;
    press.op += ((target.over ? 1 : 0) - press.op) * 0.08;

    let angle = (Math.atan2(press.y - CY, press.x - CX) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    const color = angleColor(angle);

    // 빔: 빛구멍과 커서가 한 장의 막으로 이어지는 구(goo) — 커서가 천을 뚫어 당기는 느낌.
    const bdx = press.x - CX;
    const bdy = press.y - CY;
    const distance = Math.hypot(bdx, bdy);
    const theta = Math.atan2(bdy, bdx);
    /*
      막은 가운데 영역에서만 산다. 프레임선 밖은 좌측 명함과 배롱나무 표찰의 자리라
      거기까지 따라가면 읽는 글자 위로 빛이 덮인다. 선 앞에서 잦아든다 — CLI 줄 위에서
      잦아드는 것과 같은 문법이다.
    */
    const inColumn = Math.max(
      0,
      Math.min(
        1,
        Math.min(press.x - view.bandL, view.bandR - press.x) / BEAM_FADE,
      ),
    );
    const beamOn = distance > R1 - R2 + 8 && press.y < CLI_TOP && inColumn > 0;
    const width = beamOn ? drawBeam(distance, theta) : 0;
    const beamOpacity = beamOn
      ? 0.9 *
        press.op *
        inColumn *
        Math.min(1, (distance - (R1 - R2 + 8)) / 45) *
        Math.max(0, Math.min(1, (CLI_TOP - press.y) / 40))
      : 0;
    beam.setAttribute("opacity", beamOpacity.toFixed(3));
    for (const stop of beamStops) stop.setAttribute("stop-color", color);

    // 눌리는 점이 커서 밑에 있으면 손 모양으로 알려준다 — 판정은 onDown과 같은 자리에서 잰다.
    let onPost = false;
    for (const post of posts) {
      const at = pulled(post, press.x, press.y, press.op);
      const dist = at.dist;
      if (target.over && Math.hypot(target.x - at.x, target.y - at.y) <= HIT_R) {
        onPost = true;
      }
      // 손가락 화면에서는 켜 줄 커서가 없다 — 점이 늘 이만큼은 켜져 있다.
      let glow = Math.max(
        TOUCH ? DOT_REST : 0,
        Math.exp(-((dist / 90) ** 2)) * press.op,
      );
      if (beamOn) {
        // 빔 범위 안에 든 글도 함께 점등.
        let da = Math.abs(Math.atan2(post.y - CY, post.x - CX) - theta);
        if (da > Math.PI) da = 2 * Math.PI - da;
        const pr = Math.hypot(post.x - CX, post.y - CY);
        if (da < width * 1.2 && pr < distance + 45) {
          glow = Math.max(
            glow,
            Math.exp(-((da / (width * 0.75)) ** 2)) * press.op * 0.8,
          );
        }
      }
      post.dot.setAttribute("cx", at.x.toFixed(1));
      post.dot.setAttribute("cy", at.y.toFixed(1));
      post.dot.setAttribute("r", (1.6 + 3.4 * glow).toFixed(2));
      post.dot.setAttribute("opacity", Math.min(1, glow * 1.15).toFixed(2));
      post.label.setAttribute(
        "opacity",
        TOUCH ? "0" : Math.max(0, (glow - 0.4) * 1.9).toFixed(2),
      );
    }
    svg.classList.toggle("on-post", onPost);

    for (const stop of haloStops) stop.setAttribute("stop-color", color);
    for (const stop of bloomStops) stop.setAttribute("stop-color", color);
    // 수면에 비친 빛도 그 빛이다 — 달길과 물비늘이 광원 색을 따라간다.
    seaScene?.tint(color);
    // 빛구멍 속과 수면에 닿은 중심 알 — 밝아서 색이 씻긴 만큼만 배어난다.
    for (const node of washed) {
      const pale = angleColorWashed(angle, Number(node.dataset.wash));
      node.setAttribute(
        node.tagName === "stop" ? "stop-color" : "fill",
        pale,
      );
    }

    const now = performance.now() / 1000;
    const dt = lastT ? Math.min(0.05, now - lastT) : 0.016;
    lastT = now;
    phase += dt * 0.9;

    // 모션을 줄인 화면에서는 layout()이 그린 정지화 한 장을 그대로 둔다.
    if (seaScene && !seaScene.reduceMotion) {
      const frame = seaScene.render(now);
      // 꽃은 바다와 같은 바람 하나를 받는다 — 세기도 방향도 한 하늘에서 나온다.
      if (!flowerOff) flower?.render(now, dt, frame.wind, frame.dir);
    }

    const ps = panelState;
    if (ps.open) {
      // 파도가 밀려오듯: 빠르게 밀려와 살짝 넘치고(오버슈트) 가라앉는 감쇠 진동.
      ps.t += dt;
      const eased = 1 - Math.exp(-4.2 * ps.t) * Math.cos(3.4 * ps.t);
      ps.y = 290 * (1 - eased);
      ps.op += (1 - ps.op) * Math.min(1, dt * 9);
    } else {
      ps.y += (290 - ps.y) * Math.min(1, dt * 6);
      ps.op += (0 - ps.op) * Math.min(1, dt * 6);
    }
    ps.pulse += (0 - ps.pulse) * Math.min(1, dt * 4);
    const py =
      ps.y - 16 * Math.sin(Math.PI * Math.min(1, 1 - ps.pulse)) * ps.pulse;

    // 패널 상단 = 실제 파도 능선 (위상이 흘러가며 일렁임).
    const A = 12;
    const L = 260;
    const pts: string[] = [];
    const waveFrom = Math.floor(view.minX / 14) * 14;
    const waveTo = view.minX + view.w + 14;
    for (let wx = waveFrom; wx <= waveTo; wx += 14) {
      const drift =
        0.5 * Math.sin((2 * Math.PI * wx) / (L * 2.7) + phase * 1.7);
      const th = (2 * Math.PI * wx) / L + phase + drift;
      const skew = th + 0.45 * Math.sin(th);
      const crest = ((1 + Math.cos(skew)) / 2) ** 2.2;
      const chop =
        0.1 * Math.sin((2 * Math.PI * wx) / (L * 0.23) + phase * 3.1);
      pts.push(`${wx},${(WAVE_Y - A * (crest + chop)).toFixed(1)}`);
    }
    const edge = `M${pts.join(" L")}`;
    // 물은 화면 바닥까지 찬다 — 패널이 얼마나 올라앉았든(py·panelLift) 그만큼 되민다.
    const floor = view.minY + view.h - py - panelLift;
    waveFill.setAttribute(
      "d",
      `${edge} L${waveTo},${floor.toFixed(1)} L${waveFrom},${floor.toFixed(1)} Z`,
    );
    waveLine.setAttribute("d", edge);
    panel.setAttribute("transform", `translate(0,${(py + panelLift).toFixed(1)})`);
    panel.setAttribute("opacity", ps.op.toFixed(3));
    panel.classList.toggle("is-open", ps.op > 0.5);

    // CLI: 캐럿은 줄에 마우스를 갖다 댔을 때만 (입력 중이면 유지).
    cliText.textContent = command;
    let width2 = 0;
    try {
      width2 = cliText.getComputedTextLength();
    } catch {
      width2 = command.length * 8;
    }
    cliCaret.setAttribute("x", (EDGE + 24 + width2 + 2).toFixed(1));
    const nearCli =
      target.over && target.y > CLI_TOP - 14 && target.y < CLI_BOTTOM + 14;
    cliCaret.setAttribute(
      "opacity",
      ((nearCli || command) && Math.sin(now * 5.2) > -0.2 ? 0.7 : 0).toFixed(2),
    );

    modalState.op +=
      ((modalState.open ? 1 : 0) - modalState.op) * Math.min(1, dt * 10);
    modal.setAttribute("opacity", modalState.op.toFixed(3));
  }

  function tick(): void {
    frame();
    raf = requestAnimationFrame(tick);
  }

  function onVisibility(): void {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
      return;
    }
    if (!raf) {
      lastT = 0;
      tick();
    }
  }

  layout();
  if (typeof ResizeObserver === "function")
    new ResizeObserver(layout).observe(svg);
  window.addEventListener("resize", layout);
  document.addEventListener("pointermove", onMove);
  document.addEventListener("pointerleave", onLeave);
  document.addEventListener("pointerdown", onDown);
  document.addEventListener("keydown", onKey);
  document.addEventListener("visibilitychange", onVisibility);
  tick();
}

const scene = document.getElementById("hoverscene");
if (scene) start(scene as unknown as SVGSVGElement);
