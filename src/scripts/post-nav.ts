/**
 * 글 화면의 길잡이 — 목차와 관련 글.
 *
 * 본문 기둥 오른쪽에 여백이 넉넉하면 거기 서서 따라 내려오고(`rail`), 모자라면
 * 오른쪽 아래 알약 하나로 접혔다가 누르면 판이 올라온다(`sheet`). 같은 요소가 자리만 바꾼다.
 *
 * 목차는 본문 제목(h2·h3)에서 만든다. 글이 HTML로 쓰였으면 제목에 id가 없어서 여기서 붙인다.
 * 기둥은 zoom을 먹은 채라 자리는 전부 getBoundingClientRect(화면 px)로 잰다.
 */

/** 기둥 오른쪽 여백이 이만큼은 돼야 옆에 선다. 모자라면 알약으로 접힌다. */
const RAIL_MIN = 180;
const RAIL_MAX = 248;
/** 기둥 가장자리에서 띄우는 거리 — 글줄은 기둥 안쪽으로 52단위 더 들어가 있다. */
const RAIL_GAP = 16;
/** 화면 오른쪽 끝에 남기는 여백. */
const RAIL_MARGIN = 24;
/** 머리가 걷히면 여기서 멈춰 선다. 처음에는 머리 바로 아래, 본문과 같은 높이에서 시작한다. */
const RAIL_TOP = 88;
const RAIL_BELOW_HEAD = 12;
/** 지금 읽는 제목 — 화면 위에서 이 비율 선을 넘어간 마지막 제목이다. */
const READ_LINE = 0.3;
/** 관련 글을 펼쳐 뒀는지 — 다음 글에서도 그대로 연다. */
const STORE_KEY = "renoir.post-nav.related";

type Mode = "rail" | "sheet";

const nav = document.querySelector<HTMLElement>("[data-post-nav]");
const body = document.querySelector<HTMLElement>(".post .body");
const head = document.querySelector<SVGSVGElement>(".post .head");

if (nav && body && head) mount(nav, body, head);

function remembered(): boolean {
  try {
    return localStorage.getItem(STORE_KEY) === "1";
  } catch {
    return false;
  }
}

function remember(open: boolean): void {
  try {
    localStorage.setItem(STORE_KEY, open ? "1" : "0");
  } catch {
    // 저장이 막힌 창이면 이번 글에서만 연다.
  }
}

function mount(nav: HTMLElement, body: HTMLElement, head: SVGSVGElement): void {
  const panel = nav.querySelector<HTMLElement>("[data-panel]")!;
  const toc = nav.querySelector<HTMLElement>("[data-toc]")!;
  const list = nav.querySelector<HTMLOListElement>("[data-toc-list]")!;
  const bar = nav.querySelector<HTMLElement>("[data-progress]")!;
  const pct = nav.querySelector<HTMLElement>("[data-progress-text]")!;
  const pill = nav.querySelector<HTMLButtonElement>("[data-pill]")!;
  const pillLabel = nav.querySelector<HTMLElement>("[data-pill-label]")!;
  const pillNow = nav.querySelector<HTMLElement>("[data-pill-now]")!;
  const pillCount = nav.querySelector<HTMLElement>("[data-pill-count]")!;
  const toggle = nav.querySelector<HTMLButtonElement>("[data-rel-toggle]");
  const rel = nav.querySelector<HTMLElement>("#pnav-rel");

  const headings = [...body.querySelectorAll<HTMLHeadingElement>("h2, h3")].filter(
    (h) => (h.textContent ?? "").trim() !== "",
  );
  // 목차도 관련 글도 없으면 길잡이가 할 일이 없다.
  if (headings.length === 0 && !toggle) return;

  const titles = headings.map((h) => (h.textContent ?? "").trim());
  const items = headings.map((h, i) => {
    if (!h.id) h.id = `sec-${i + 1}`;
    const li = document.createElement("li");
    li.className = h.tagName === "H3" ? "lvl-3" : "lvl-2";
    const a = document.createElement("a");
    a.href = `#${h.id}`;
    a.dataset.at = String(i);
    a.textContent = titles[i]!;
    li.append(a);
    return li;
  });
  list.append(...items);
  toc.hidden = headings.length === 0;
  nav.hidden = false;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let mode: Mode = "rail";

  /* 알약·판 — 좁은 화면에서만 쓴다. */
  function setOpen(open: boolean): void {
    nav.toggleAttribute("data-open", open);
    pill.setAttribute("aria-expanded", String(open));
  }
  pill.addEventListener("click", () => setOpen(!nav.hasAttribute("data-open")));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && nav.hasAttribute("data-open")) {
      setOpen(false);
      pill.focus();
    }
  });
  document.addEventListener("click", (event) => {
    if (nav.hasAttribute("data-open") && !nav.contains(event.target as Node)) setOpen(false);
  });

  /* 목차 — 부드럽게 내려가고, 판이었다면 닫는다. 주소의 #도 따라 바꾼다. */
  list.addEventListener("click", (event) => {
    const link = (event.target as Element).closest("a");
    // 한글 id는 hash에서 퍼센트로 인코딩돼 나온다 — 주소 대신 순번으로 찾는다.
    const target = link ? headings[Number(link.dataset.at)] : undefined;
    if (!link || !target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    history.replaceState(null, "", link.hash);
    if (mode === "sheet") setOpen(false);
  });

  /* 관련 글 — 접었다 편다. 펼친 채로 두면 다음 글에서도 펼쳐져 있다. */
  if (toggle && rel) {
    const show = (open: boolean) => {
      toggle.setAttribute("aria-expanded", String(open));
      rel.hidden = !open;
    };
    show(remembered());
    toggle.addEventListener("click", () => {
      const open = rel.hidden;
      show(open);
      remember(open);
    });
  }

  /** 여백을 재서 모습을 정하고, 옆에 선다면 가로 자리를 잡는다. */
  function place(): void {
    const view = document.documentElement.clientWidth;
    const left = body.getBoundingClientRect().right + RAIL_GAP;
    const room = view - left - RAIL_MARGIN;
    const next: Mode = room >= RAIL_MIN ? "rail" : "sheet";
    if (next !== mode) setOpen(false);
    mode = next;
    nav.dataset.mode = mode;
    if (mode === "rail") {
      nav.style.setProperty("--pnav-left", `${left}px`);
      nav.style.setProperty("--pnav-width", `${Math.min(RAIL_MAX, room)}px`);
    }
    follow();
  }

  let active = -2;

  /** 스크롤마다 — 세로 자리, 지금 읽는 제목, 읽은 만큼. */
  function follow(): void {
    if (mode === "rail") {
      const top = Math.max(RAIL_TOP, head.getBoundingClientRect().bottom + RAIL_BELOW_HEAD);
      nav.style.setProperty("--pnav-top", `${top}px`);
    }

    const line = window.innerHeight * READ_LINE;
    let now = -1;
    for (let i = 0; i < headings.length; i += 1) {
      if (headings[i]!.getBoundingClientRect().top > line) break;
      now = i;
    }
    if (now !== active) {
      active = now;
      items.forEach((li, i) => {
        li.classList.toggle("is-on", i === now);
        if (i === now) li.firstElementChild!.setAttribute("aria-current", "location");
        else li.firstElementChild!.removeAttribute("aria-current");
      });
      if (now >= 0 && mode === "rail") keepInView(items[now]!);
      renderPill(now);
    }

    const box = body.getBoundingClientRect();
    const read = Math.min(1, Math.max(0, (line - box.top) / box.height));
    const percent = `${Math.round(read * 100)}%`;
    bar.style.width = percent;
    pct.textContent = percent;
    pill.style.setProperty("--read", percent);
  }

  /** 목차가 판보다 길면 지금 제목이 판 안에 보이게 판만 굴린다(창은 건드리지 않는다). */
  function keepInView(li: HTMLElement): void {
    if (panel.scrollHeight <= panel.clientHeight) return;
    const top = li.offsetTop;
    if (top < panel.scrollTop) panel.scrollTop = top - 8;
    else if (top + li.offsetHeight > panel.scrollTop + panel.clientHeight) {
      panel.scrollTop = top + li.offsetHeight - panel.clientHeight + 8;
    }
  }

  function renderPill(now: number): void {
    if (headings.length === 0) {
      pillLabel.textContent = "관련 글";
      pillNow.textContent = "";
      pillCount.textContent = pill.dataset.related ?? "";
      return;
    }
    pillNow.textContent = now >= 0 ? titles[now]! : "";
    pillCount.textContent = `${now + 1}/${headings.length}`;
  }

  let queued = false;
  function schedule(): void {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      follow();
    });
  }

  place();
  window.addEventListener("scroll", schedule, { passive: true });
  // post-screen.ts가 resize에서 zoom을 다시 먹인 다음에 재야 기둥 자리가 맞는다.
  window.addEventListener("resize", () => requestAnimationFrame(place));
}
