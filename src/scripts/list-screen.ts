/**
 * 목록 화면의 움직임.
 *
 * 두 가지 일만 한다.
 *   1. 화면 채우기 — 정본 700 좌표계를 메인과 같은 배율로 키우고, 남는 가로는 무대로 준다.
 *   2. 메인에서 들고 온 자리(`?x=&y=`) 반영 — 주요 2편을 그 자리에서 가까운 순으로 다시 뽑고,
 *      전체 목록에 "가까운 순" 정렬을 열어준다.
 *
 * 서버가 이미 최신순 한 장을 다 그려놨다. 여기서는 채워진 자리의 내용만 갈아끼운다 —
 * 자리(y)는 서버가 잡은 그대로다.
 */
import {
  byNearest,
  byNewest,
  selectSections,
  type Selectable,
} from "../lib/stage/list.ts";
import { truncateText, wrapText } from "../lib/stage/text.ts";

/** 정본 좌표계. 메인과 같은 배율을 쓰려고 메인의 세로(790)도 들고 있는다. */
const VIEW_W = 700;
const MAIN_H = 790;

interface Entry extends Selectable {
  title: string;
  description: string;
  tags: string[];
  minutes: number;
  color: string;
}

const svg = document.querySelector<SVGSVGElement>("#listscene");
const payload = document.querySelector<HTMLScriptElement>("#list-data");

if (svg && payload) {
  const posts: Entry[] = JSON.parse(payload.textContent ?? "[]");
  const height = Number(svg.dataset.height);
  const covers = svg.querySelectorAll<SVGRectElement>(".bleed-cover");
  const bands = svg.querySelectorAll<SVGLineElement>(".bleed-band");

  /**
   * 정본 700 상자가 화면에 꼭 들어가는 배율(메인과 같은 식)로 키우고,
   * viewBox를 그만큼 좌우로 벌린다. 글줄이 앉는 자리(52~648)는 언제나 가운데다.
   */
  function layout(): void {
    const width = svg!.getBoundingClientRect().width;
    if (width === 0) return;

    const k = Math.min(width / VIEW_W, window.innerHeight / MAIN_H);
    const w = width / k;
    const left = VIEW_W / 2 - w / 2;
    // 글이 적어 한 화면도 못 채우면 무대를 화면 끝까지 늘인다 — 아래가 잘려 보이지 않게.
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

  /** 여러 줄을 tspan으로 다시 앉힌다. 자리(y)는 서버가 잡아둔 값 그대로. */
  function setLines(text: SVGTextElement, lines: string[]): void {
    const x = text.getAttribute("x")!;
    const ys = (text.dataset.lines ?? "").split(" ").filter(Boolean);
    text.textContent = "";
    lines.slice(0, ys.length).forEach((line, i) => {
      const tspan = document.createElementNS("http://www.w3.org/2000/svg", "tspan");
      tspan.setAttribute("x", x);
      tspan.setAttribute("y", ys[i]!);
      tspan.textContent = line;
      text.append(tspan);
    });
  }

  const metaOf = (post: Entry) => [post.date, ...post.tags].join(" · ");

  const cards = [...svg.querySelectorAll<SVGAElement>(".lcard")];
  const rows = [...svg.querySelectorAll<SVGGElement>(".lrow")];

  function fillCards(chosen: Entry[]): void {
    cards.forEach((card, i) => {
      const post = chosen[i];
      if (!post) return;
      card.setAttribute("href", `/blog/${post.slug}/`);
      for (const wave of card.querySelectorAll<SVGPathElement>(".thumb-wave")) {
        wave.setAttribute("fill", post.color);
      }
      const title = card.querySelector<SVGTextElement>("text.serif")!;
      setLines(title, wrapText(post.title, 14, 286, 2));
      card.querySelector<SVGTextElement>("text.mono")!.textContent = post.date;
    });
  }

  function fillRows(ordered: Entry[]): void {
    rows.forEach((row, i) => {
      const post = ordered[i];
      if (!post) return;
      const link = row.querySelector<SVGAElement>("a")!;
      link.setAttribute("href", `/blog/${post.slug}/`);
      for (const dot of link.querySelectorAll<SVGCircleElement>("circle")) {
        dot.setAttribute("fill", post.color);
      }
      const texts = link.querySelectorAll<SVGTextElement>("text");
      texts[0]!.textContent = truncateText(post.title, 15, 522);
      texts[1]!.textContent = metaOf(post);
      texts[2]!.textContent = `${post.minutes}분`;
    });
  }

  // ?x=&y= — 메인에서 고른 자리. 둘 다 숫자로 읽혀야 자리로 친다.
  const params = new URLSearchParams(window.location.search);
  const fx = Number(params.get("x"));
  const fy = Number(params.get("y"));
  const focus =
    params.has("x") &&
    params.has("y") &&
    Number.isFinite(fx) &&
    Number.isFinite(fy) &&
    params.get("x") !== "" &&
    params.get("y") !== ""
      ? { x: fx, y: fy }
      : null;

  let rowPool: Entry[] = [];

  if (focus) {
    const sections = selectSections(posts, focus);
    fillCards(sections.featured);
    rowPool = sections.rows;
    fillRows(rowPool);

    const subtitle = svg.querySelector<SVGTextElement>("#l-subtitle");
    if (subtitle) subtitle.textContent = `메인에서 고른 자리 기준 · ${posts.length}편`;
  } else {
    rowPool = selectSections(posts).rows;
  }

  const sortNewest = svg.querySelector<SVGTSpanElement>("#sort-newest");
  const sortNear = svg.querySelector<SVGTSpanElement>("#sort-near");

  if (sortNewest && sortNear) {
    // 자리를 안 들고 왔으면 가까운 순을 잴 기준이 없다 — 글자만 남기고 재운다.
    if (!focus) {
      sortNear.classList.add("inert");
    } else {
      const select = (near: boolean) => {
        sortNewest.classList.toggle("is-on", !near);
        sortNear.classList.toggle("is-on", near);
        sortNewest.textContent = near ? " 최신순" : " 최신순 ⌄";
        sortNear.textContent = near ? " 가까운 순 ⌄" : " 가까운 순";
        fillRows(
          near ? [...rowPool].sort(byNearest(focus)) : [...rowPool].sort(byNewest),
        );
      };
      sortNewest.addEventListener("click", () => select(false));
      sortNear.addEventListener("click", () => select(true));
    }
  }
}
