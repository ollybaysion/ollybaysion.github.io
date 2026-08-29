/**
 * 시리즈 목록 화면의 움직임 — 화면 채우기 하나뿐이다.
 *
 * 목록·글 화면과 같은 규칙이다: 정본 700 좌표계를 메인과 같은 배율로 키우고,
 * 남는 가로는 무대(비네트·그레인·프레임선)에 준다. 읽는 열(52~648)은 언제나 가운데다.
 *
 * 회차 순서는 빌드 때 이미 박혔으니 여기서 다시 만질 게 없다 —
 * 자바스크립트가 죽어도 한 장은 그대로 읽힌다.
 */

/** 정본 좌표계. 메인과 같은 배율을 쓰려고 메인의 세로(790)도 들고 있는다. */
const VIEW_W = 700;
const MAIN_H = 790;

const svg = document.querySelector<SVGSVGElement>("#seriesscene");

if (svg) {
  const height = Number(svg.dataset.height);
  const covers = svg.querySelectorAll<SVGRectElement>(".bleed-cover");
  const bands = svg.querySelectorAll<SVGLineElement>(".bleed-band");

  function layout(): void {
    const width = svg!.getBoundingClientRect().width;
    if (width === 0) return;

    const k = Math.min(width / VIEW_W, window.innerHeight / MAIN_H);
    const w = width / k;
    const left = VIEW_W / 2 - w / 2;
    // 회차가 적어 한 화면도 못 채우면 무대를 화면 끝까지 늘인다 — 아래가 잘려 보이지 않게.
    const h = Math.max(height, window.innerHeight / k);

    svg!.setAttribute("viewBox", `${left} 0 ${w} ${h}`);
    svg!.style.height = `${h * k}px`;

    for (const cover of covers) {
      cover.setAttribute("x", String(left));
      cover.setAttribute("width", String(w));
      cover.setAttribute("height", String(h));
    }
    // 필름 프레임 세로선 — 정본의 폭 대비 위치(17% · 87%)를 유지한다.
    for (const band of bands) {
      const x = left + (w * Number(band.dataset.at)) / VIEW_W;
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
