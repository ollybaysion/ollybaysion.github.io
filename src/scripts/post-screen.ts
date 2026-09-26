/**
 * 글 화면의 배치.
 *
 * 판(`page.ts`)의 폭에 맞춰 키운다. 다만 글 화면은 본문이 SVG가 아니라 그냥 글이라
 * viewBox 하나로는 안 된다 — article 통째로 zoom을 먹이고, 그 안의 머리·꼬리 SVG만
 * viewBox를 벌려 화면 끝까지 보낸다.
 *
 * 머리·꼬리는 판마다 한 벌씩 찍혀 있고 CSS가 하나를 세운다. 여기서는 서 있는 판을
 * 골라 그 판의 자로 잰다. zoom을 모르는 브라우저에서는 판의 정본 크기 그대로 보인다.
 */
import { NARROW, NARROW_AT, WIDE } from "../lib/stage/page.ts";
import { TAIL_METRICS } from "../lib/stage/post.ts";
import { SEA_DEPTH } from "../lib/stage/sea.ts";
import { mountSea, type SeaScene } from "./sea-scene.ts";

/**
 * 배율 상한. 무대는 화면을 채워야 하지만 **본문은 읽는 글이라 화면 따라 커지면 안 된다** —
 * 상한이 없으면 큰 화면에서 15px 본문이 20px까지 부풀고 글줄 폭도 950px을 넘는다.
 * 상한에 걸린 뒤에도 풍경(비네트·프레임선·수평선·바다)은 viewBox가 벌어져 화면 끝까지 간다.
 *
 * 아래로는 판이 지킨다 — 좁은 화면에서는 CSS가 390 판으로 갈아끼운다.
 * 화면 **높이**는 배율을 깎지 않는다: 세로로 흐르는 글에서 낮은 창은 스크롤이지 축소가 아니다.
 */
const K_MAX = 1.1;

const article = document.querySelector<HTMLElement>(".post");

if (article) {
  const narrowQuery = window.matchMedia(`(max-width: ${NARROW_AT - 1}px)`);
  /** 지금 서 있는 판. CSS가 고르는 것과 같은 기준을 본다. */
  const edition = () => (narrowQuery.matches ? NARROW : WIDE);

  /** 판마다 한 벌 — 그 판의 머리·꼬리와 바다. */
  const sheets = [WIDE, NARROW].map((ed) => {
    const scenes = [
      ...article.querySelectorAll<SVGSVGElement>(`.bleed-svg.sheet-${ed.name}`),
    ];
    const tail = article.querySelector<SVGSVGElement>(
      `.tail.sheet-${ed.name}`,
    );
    return {
      ed,
      scenes,
      seaGroup: tail?.querySelector<SVGGElement>(".seaP") ?? null,
      sea: tail ? mountSea(tail) : null,
    };
  });

  const sheetFor = (ed: typeof WIDE) =>
    sheets.find((sheet) => sheet.ed.name === ed.name)!;

  function layout(): void {
    const width = document.documentElement.clientWidth;
    if (width === 0) return;

    const ed = edition();
    const sheet = sheetFor(ed);
    const k = Math.min(width / ed.w, K_MAX);
    const w = width / k;
    const left = ed.w / 2 - w / 2;

    // 기둥은 판의 폭 그대로 두고 article만 넓힌다 — 본문은 안에서 가운데 정렬로 남는다.
    article!.style.width = `${w}px`;
    article!.style.zoom = String(k);

    for (const svg of sheet.scenes) {
      const h = Number(svg.dataset.h);
      svg.setAttribute("viewBox", `${left} 0 ${w} ${h}`);

      for (const cover of svg.querySelectorAll<SVGRectElement>(".bleed-cover")) {
        cover.setAttribute("x", String(left));
        cover.setAttribute("width", String(w));
      }
      for (const line of svg.querySelectorAll<SVGLineElement>(".bleed")) {
        line.setAttribute("x1", String(left));
        line.setAttribute("x2", String(left + w));
      }
      // 필름 프레임 세로선 — 판의 폭 대비 위치(17% · 87%)를 유지한다.
      for (const band of svg.querySelectorAll<SVGLineElement>(".bleed-band")) {
        const x = left + (w * Number(band.dataset.at)) / ed.w;
        band.setAttribute("x1", String(x));
        band.setAttribute("x2", String(x));
      }
    }

    // 바다는 전폭으로 늘어난다. 깊이는 정본(272) 그대로 두고 화면 쪽만 꼬리 높이로 누른다 —
    // 얕은 바다가 아니라 같은 바다를 멀리서 본 것이다. 무대 한 단위는 화면 k px이다.
    sheet.sea?.resize({
      left,
      width: w,
      depth: SEA_DEPTH,
      height: TAIL_METRICS.sea,
      px: k,
    });
  }

  layout();
  window.addEventListener("resize", layout);
  // 판이 바뀌면 새 판의 자로 다시 잰다(화면을 돌렸을 때).
  narrowQuery.addEventListener?.("change", layout);

  /**
   * 파도는 꼬리가 화면에 걸쳐 있을 때만 돈다.
   *
   * 긴 글에서는 꼬리가 몇 화면 아래에 있다 — 아무도 안 보는 바다에 매 프레임을 쓰지 않는다.
   * 서 있지 않은 판의 바다도 돌지 않는다(화면에 없으니 관찰자가 잡아준다).
   * 관찰자를 모르는 브라우저에서는 서 있는 판만 계속 돈다(무대와 같은 부담이니 나쁠 게 없다).
   */
  const active = new Set<SeaScene>();
  let raf = 0;

  function tick(now: number): void {
    const sea = sheetFor(edition()).sea;
    if (sea) sea.render(now / 1000);
    raf = requestAnimationFrame(tick);
  }

  function sync(): void {
    const sea = sheetFor(edition()).sea;
    const on = !document.hidden && sea !== null && active.has(sea);
    if (on && !raf) raf = requestAnimationFrame(tick);
    if (!on && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  for (const sheet of sheets) {
    if (!sheet.sea || sheet.sea.reduceMotion || !sheet.seaGroup) continue;
    if (typeof IntersectionObserver !== "function") {
      active.add(sheet.sea);
      continue;
    }
    const sea = sheet.sea;
    new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) active.add(sea);
      else active.delete(sea);
      sync();
    }).observe(sheet.seaGroup);
  }
  document.addEventListener("visibilitychange", sync);
  narrowQuery.addEventListener?.("change", sync);
  sync();
}
