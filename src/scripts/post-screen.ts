/**
 * 글 화면의 배치.
 *
 * 메인·목록과 같은 배율 `min(폭/700, 높이/790)`로 키운다. 다만 글 화면은 본문이
 * SVG가 아니라 그냥 글이라 viewBox 하나로는 안 된다 — article 통째로 zoom을 먹이고,
 * 그 안의 머리·꼬리 SVG만 viewBox를 벌려 화면 끝까지 보낸다.
 *
 * zoom을 모르는 브라우저에서는 정본 크기(700px 기둥) 그대로 보인다.
 */
import { TAIL_METRICS } from "../lib/stage/post.ts";
import { SEA_DEPTH } from "../lib/stage/sea.ts";
import { mountSea } from "./sea-scene.ts";

/** 정본 좌표계. 메인의 세로(790)를 같이 봐야 배율이 세 화면에서 같아진다. */
const VIEW_W = 700;
const MAIN_H = 790;
/**
 * 배율 상한. 무대는 화면을 채워야 하지만 **본문은 읽는 글이라 화면 따라 커지면 안 된다** —
 * 상한이 없으면 큰 화면에서 15px 본문이 20px까지 부풀고 글줄 폭도 950px을 넘는다.
 * 상한에 걸린 뒤에도 풍경(비네트·프레임선·수평선·바다)은 viewBox가 벌어져 화면 끝까지 간다.
 */
const K_MAX = 1.1;

const article = document.querySelector<HTMLElement>(".post");

if (article) {
  const scenes = [...article.querySelectorAll<SVGSVGElement>(".bleed-svg")];
  const seaGroup = article.querySelector<SVGGElement>("#seaP");
  const sea = mountSea(article);

  function layout(): void {
    const width = document.documentElement.clientWidth;
    if (width === 0) return;

    const k = Math.min(width / VIEW_W, window.innerHeight / MAIN_H, K_MAX);
    const w = width / k;
    const left = VIEW_W / 2 - w / 2;

    // 기둥은 700 그대로 두고 article만 넓힌다 — 본문은 안에서 가운데 정렬로 남는다.
    article!.style.width = `${w}px`;
    article!.style.zoom = String(k);

    for (const svg of scenes) {
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
      // 필름 프레임 세로선 — 정본의 폭 대비 위치(17% · 87%)를 유지한다.
      for (const band of svg.querySelectorAll<SVGLineElement>(".bleed-band")) {
        const x = left + (w * Number(band.dataset.at)) / VIEW_W;
        band.setAttribute("x1", String(x));
        band.setAttribute("x2", String(x));
      }
    }

    // 바다는 전폭으로 늘어난다. 깊이는 정본(272) 그대로 두고 화면 쪽만 꼬리 높이로 누른다 —
    // 얕은 바다가 아니라 같은 바다를 멀리서 본 것이다. 무대 한 단위는 화면 k px이다.
    sea?.resize({
      left,
      width: w,
      depth: SEA_DEPTH,
      height: TAIL_METRICS.sea,
      px: k,
    });
  }

  layout();
  window.addEventListener("resize", layout);

  /**
   * 파도는 꼬리가 화면에 걸쳐 있을 때만 돈다.
   *
   * 긴 글에서는 꼬리가 몇 화면 아래에 있다 — 아무도 안 보는 바다에 매 프레임을 쓰지 않는다.
   * 관찰자를 모르는 브라우저에서는 그냥 계속 돈다(무대와 같은 부담이니 나쁠 게 없다).
   */
  if (sea && !sea.reduceMotion && seaGroup) {
    let raf = 0;
    let onScreen = true;

    function tick(now: number): void {
      sea!.render(now / 1000);
      raf = requestAnimationFrame(tick);
    }

    /** 볼 사람이 있을 때만 돈다 — 꼬리가 화면에 걸쳐 있고 탭이 앞에 있을 때. */
    function sync(): void {
      const on = onScreen && !document.hidden;
      if (on && !raf) raf = requestAnimationFrame(tick);
      if (!on && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    }

    if (typeof IntersectionObserver === "function") {
      new IntersectionObserver((entries) => {
        onScreen = entries.some((entry) => entry.isIntersecting);
        sync();
      }).observe(seaGroup);
    }
    document.addEventListener("visibilitychange", sync);
    sync();
  }
}
