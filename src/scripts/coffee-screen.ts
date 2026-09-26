/**
 * 커피 레시피 목록의 배치 — 글 화면(`post-screen.ts`)과 같은 규칙이다.
 *
 * 메인·목록과 같은 배율 `min(폭/700, 높이/790)`로 article 통째로 zoom을 먹이고,
 * 머리 SVG만 viewBox를 벌려 화면 끝까지 보낸다. 카드는 700 기둥 안에 남는다.
 * zoom을 모르는 브라우저에서는 정본 크기(700px 기둥) 그대로 보인다.
 */

/** 정본 좌표계. 메인의 세로(790)를 같이 봐야 배율이 화면끼리 같아진다. */
const VIEW_W = 700;
const MAIN_H = 790;
/** 배율 상한 — 읽는 화면은 화면 따라 글씨가 커지면 안 된다(글 화면과 같은 값). */
const K_MAX = 1.1;

const article = document.querySelector<HTMLElement>(".coffee");

if (article) {
  const head = article.querySelector<SVGSVGElement>(".head");

  function layout(): void {
    const width = document.documentElement.clientWidth;
    if (width === 0) return;

    const k = Math.min(width / VIEW_W, window.innerHeight / MAIN_H, K_MAX);
    const w = width / k;
    const left = VIEW_W / 2 - w / 2;

    article!.style.width = `${w}px`;
    article!.style.zoom = String(k);

    if (!head) return;
    head.setAttribute("viewBox", `${left} 0 ${w} ${head.dataset.h}`);
    for (const cover of head.querySelectorAll<SVGRectElement>(".bleed-cover")) {
      cover.setAttribute("x", String(left));
      cover.setAttribute("width", String(w));
    }
    // 필름 프레임 세로선 — 정본의 폭 대비 위치(17% · 87%)를 유지한다.
    for (const band of head.querySelectorAll<SVGLineElement>(".bleed-band")) {
      const x = left + (w * Number(band.dataset.at)) / VIEW_W;
      band.setAttribute("x1", String(x));
      band.setAttribute("x2", String(x));
    }
  }

  layout();
  window.addEventListener("resize", layout);
}
