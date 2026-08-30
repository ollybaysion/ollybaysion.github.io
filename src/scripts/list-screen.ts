/**
 * 목록 화면의 움직임.
 *
 * 두 가지 일만 한다.
 *   1. 화면 채우기 — 판의 좌표계를 화면 폭에 맞춰 키우고, 남는 가로는 무대로 준다.
 *   2. 메인에서 들고 온 자리(`?x=&y=`) 반영 — 주요 2편을 그 자리에서 가까운 순으로 다시 뽑고,
 *      전체 목록에 "가까운 순" 정렬을 열어준다.
 *
 * 서버가 이미 최신순 한 장을 다 그려놨다. 여기서는 채워진 자리의 내용만 갈아끼운다 —
 * 자리(y)는 서버가 잡은 그대로다.
 *
 * 한 장이 **두 판**으로 찍혀 있다(넓은 판 · 좁은 판). 보이는 건 CSS가 고르고, 여기서는
 * 둘 다 채운다 — 화면을 돌려 판이 바뀌어도 고른 순서가 그대로 남게.
 */
import {
  byNearest,
  byNewest,
  listWraps,
  selectSections,
  type Selectable,
} from "../lib/stage/list.ts";
import { NARROW, WIDE } from "../lib/stage/page.ts";
import { wrapText } from "../lib/stage/text.ts";

/**
 * 배율 상한 — 읽는 화면은 화면 따라 글씨가 커지면 안 된다(글 화면과 같은 값).
 *
 * 아래로는 판이 지킨다: 화면이 좁아지면 CSS가 좁은 판(390)으로 갈아끼우니
 * 한 단위가 0.9px 아래로 내려가지 않는다. 화면 **높이**는 배율을 깎지 않는다 —
 * 세로로 흐르는 화면에서 창이 낮은 건 스크롤이지 축소가 아니다.
 */
const K_MAX = 1.1;

interface Entry extends Selectable {
  title: string;
  description: string;
  tags: string[];
  minutes: number;
  color: string;
}

interface Sheet {
  fillCards(chosen: Entry[]): void;
  fillRows(ordered: Entry[]): void;
  setSubtitle(text: string): void;
  sortNewest: SVGTSpanElement | null;
  sortNear: SVGTSpanElement | null;
}

const payload = document.querySelector<HTMLScriptElement>("#list-data");
const sheetNodes = [
  ...document.querySelectorAll<SVGSVGElement>(".listscene"),
];

if (payload && sheetNodes.length > 0) {
  const posts: Entry[] = JSON.parse(payload.textContent ?? "[]");

  /** 여러 줄을 tspan으로 다시 앉힌다. 자리(y)는 서버가 잡아둔 값 그대로. */
  function setLines(text: SVGTextElement, lines: string[]): void {
    const x = text.getAttribute("x")!;
    const ys = (text.dataset.lines ?? "").split(" ").filter(Boolean);
    text.textContent = "";
    lines.slice(0, ys.length).forEach((line, i) => {
      const tspan = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "tspan",
      );
      tspan.setAttribute("x", x);
      tspan.setAttribute("y", ys[i]!);
      tspan.textContent = line;
      text.append(tspan);
    });
  }

  const metaOf = (post: Entry) => [post.date, ...post.tags].join(" · ");

  function mountSheet(svg: SVGSVGElement): Sheet {
    const edition = svg.dataset.edition === "narrow" ? NARROW : WIDE;
    const wraps = listWraps(edition);
    const height = Number(svg.dataset.height);
    const covers = svg.querySelectorAll<SVGRectElement>(".bleed-cover");
    const bands = svg.querySelectorAll<SVGLineElement>(".bleed-band");

    /**
     * 판이 화면에 꼭 들어가는 배율로 키우고, viewBox를 그만큼 좌우로 벌린다.
     * 글줄이 앉는 열은 어느 폭에서든 가운데다.
     */
    function layout(): void {
      const width = svg.getBoundingClientRect().width;
      // 지금 서지 않은 판(display:none)은 폭이 0이다 — 계산할 것이 없다.
      if (width === 0) return;

      const k = Math.min(width / edition.w, K_MAX);
      const w = width / k;
      const left = edition.w / 2 - w / 2;
      // 글이 적어 한 화면도 못 채우면 무대를 화면 끝까지 늘인다 — 아래가 잘려 보이지 않게.
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

    const cards = [...svg.querySelectorAll<SVGAElement>(".lcard")];
    const rows = [...svg.querySelectorAll<SVGGElement>(".lrow")];

    return {
      fillCards(chosen) {
        cards.forEach((card, i) => {
          const post = chosen[i];
          if (!post) return;
          card.setAttribute("href", `/blog/${post.slug}/`);
          for (const wave of card.querySelectorAll<SVGPathElement>(
            ".thumb-wave",
          )) {
            wave.setAttribute("fill", post.color);
          }
          const title = card.querySelector<SVGTextElement>("text.serif")!;
          setLines(title, wrapText(post.title, 14, wraps.featuredText, 2));
          card.querySelector<SVGTextElement>("text.mono")!.textContent =
            post.date;
        });
      },

      fillRows(ordered) {
        rows.forEach((row, i) => {
          const post = ordered[i];
          if (!post) return;
          const link = row.querySelector<SVGAElement>("a")!;
          link.setAttribute("href", `/blog/${post.slug}/`);
          for (const dot of link.querySelectorAll<SVGCircleElement>("circle")) {
            dot.setAttribute("fill", post.color);
          }
          const texts = link.querySelectorAll<SVGTextElement>("text");
          setLines(
            texts[0]!,
            wrapText(post.title, 15, wraps.rowTitle, wraps.rowTitleLines),
          );
          texts[1]!.textContent = metaOf(post);
          texts[2]!.textContent = `${post.minutes}분`;
        });
      },

      setSubtitle(text) {
        const subtitle = svg.querySelector<SVGTextElement>(".l-subtitle");
        if (subtitle) subtitle.textContent = text;
      },

      sortNewest: svg.querySelector<SVGTSpanElement>(".sort-newest"),
      sortNear: svg.querySelector<SVGTSpanElement>(".sort-near"),
    };
  }

  const sheets = sheetNodes.map(mountSheet);

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
    rowPool = sections.rows;
    for (const sheet of sheets) {
      sheet.fillCards(sections.featured);
      sheet.fillRows(rowPool);
      sheet.setSubtitle(`메인에서 고른 자리 기준 · ${posts.length}편`);
    }
  } else {
    rowPool = selectSections(posts).rows;
  }

  /** 어느 판에서 눌러도 두 판이 함께 바뀐다 — 화면을 돌려도 고른 순서가 남게. */
  function select(near: boolean, at: { x: number; y: number }): void {
    const ordered = near
      ? [...rowPool].sort(byNearest(at))
      : [...rowPool].sort(byNewest);
    for (const sheet of sheets) {
      sheet.sortNewest?.classList.toggle("is-on", !near);
      sheet.sortNear?.classList.toggle("is-on", near);
      if (sheet.sortNewest) {
        sheet.sortNewest.textContent = near ? " 최신순" : " 최신순 ⌄";
      }
      if (sheet.sortNear) {
        sheet.sortNear.textContent = near ? " 가까운 순 ⌄" : " 가까운 순";
      }
      sheet.fillRows(ordered);
    }
  }

  for (const sheet of sheets) {
    if (!sheet.sortNewest || !sheet.sortNear) continue;
    // 자리를 안 들고 왔으면 가까운 순을 잴 기준이 없다 — 글자만 남기고 재운다.
    if (!focus) {
      sheet.sortNear.classList.add("inert");
      continue;
    }
    sheet.sortNewest.addEventListener("click", () => select(false, focus));
    sheet.sortNear.addEventListener("click", () => select(true, focus));
  }
}
