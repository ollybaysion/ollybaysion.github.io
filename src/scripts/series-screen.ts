/**
 * 시리즈 목록 화면의 움직임 — 화면 채우기 하나뿐이다.
 *
 * 목록·글 화면과 같은 규칙이다: 판(`page.ts`)의 좌표계를 화면 폭에 맞춰 키우고,
 * 남는 가로는 무대(비네트·그레인·프레임선)에 준다. 읽는 열은 언제나 가운데다.
 *
 * 한 장이 두 판으로 찍혀 있다(넓은 판 · 좁은 판). 보이는 건 CSS가 고르고,
 * 여기서는 둘 다 재운다 — 화면을 돌려 판이 바뀌어도 바로 서 있게.
 *
 * 회차 순서는 빌드 때 이미 박혔으니 여기서 다시 만질 게 없다 —
 * 자바스크립트가 죽어도 한 장은 그대로 읽힌다.
 */
import { NARROW, WIDE } from "../lib/stage/page.ts";

/**
 * 배율 상한 — 읽는 화면은 화면 따라 글씨가 커지면 안 된다(목록·글 화면과 같은 값).
 *
 * 아래로는 판이 지킨다: 화면이 좁아지면 CSS가 좁은 판(390)으로 갈아끼운다.
 * 화면 **높이**는 배율을 깎지 않는다 — 세로로 흐르는 화면에서 창이 낮은 건
 * 스크롤이지 축소가 아니다.
 */
const K_MAX = 1.1;

for (const svg of document.querySelectorAll<SVGSVGElement>(".seriesscene")) {
  const edition = svg.dataset.edition === "narrow" ? NARROW : WIDE;
  const height = Number(svg.dataset.height);
  const covers = svg.querySelectorAll<SVGRectElement>(".bleed-cover");
  const bands = svg.querySelectorAll<SVGLineElement>(".bleed-band");

  function layout(): void {
    const width = svg.getBoundingClientRect().width;
    // 지금 서지 않은 판(display:none)은 폭이 0이다 — 계산할 것이 없다.
    if (width === 0) return;

    const k = Math.min(width / edition.w, K_MAX);
    const w = width / k;
    const left = edition.w / 2 - w / 2;
    // 회차가 적어 한 화면도 못 채우면 무대를 화면 끝까지 늘인다 — 아래가 잘려 보이지 않게.
    const h = Math.max(height, window.innerHeight / k);

    svg.setAttribute("viewBox", `${left} 0 ${w} ${h}`);
    svg.style.height = `${h * k}px`;

    for (const cover of covers) {
      cover.setAttribute("x", String(left));
      cover.setAttribute("width", String(w));
      cover.setAttribute("height", String(h));
    }
    // 필름 프레임 세로선 — 판의 폭 대비 위치(17% · 87%)를 유지한다.
    for (const band of bands) {
      const x = left + (w * Number(band.dataset.at)) / edition.w;
      band.setAttribute("x1", String(x));
      band.setAttribute("x2", String(x));
      band.setAttribute("y2", String(h));
    }
  }

  layout();
  if (typeof ResizeObserver === "function") {
    new ResizeObserver(layout).observe(svg);
  }
  window.addEventListener("resize", layout);
}
