/**
 * 배롱나무를 세우고 흔든다.
 *
 * 붙일 자리는 `[data-flower]`(그루)와 `[data-petals]`(낙화·파문) 둘이다.
 * 바다처럼 id가 아니라 `data-` 표시로 찾는다.
 *
 * **꽃은 바다와 같은 바람 하나를 받는다** — 세기도 방향도 `sea.draw`가 돌려주는
 * 그 프레임의 값이다. 제 바람을 따로 지어내면 한 하늘에서 두 리듬이 분다.
 *
 * 그루는 벽에 박힌 뿌리 마디를 축으로 통째로 휘고, 잎은 그 위에 잔떨림을 얹는다.
 * 다 그려진 뒤부터 낙화가 시작되고, 꽃잎이 물에 닿는 자리에서 사라지며 파문만 남는다.
 *
 * 꽃잎은 그루와 함께 옮기지 않는다 — 떨어진 뒤엔 제 좌표로 살아야
 * 화면 밖 판정과 파문 자리가 전폭 좌표 그대로다. 대신 지는 순간에만 이동량을 더한다.
 */
import {
  barkPath,
  BLADE_DEGS,
  branchPath,
  BRANCH_TIP_X,
  BRANCH_TIP_Y,
  BRANCH_WALL_Y,
  BUD_SPLIT,
  BUDS,
  crepeBlade,
  CUP_BELL,
  CUP_HORNS,
  CUP_STEM,
  FX,
  FY,
  HEAD_TILT,
  HEAD_Y,
  ink,
  LAND_SPAN,
  LAND_TOP,
  PEDICELS,
  PETAL,
  PETAL_POOL,
  RIPPLE_POOL,
  SEED,
  treeShift,
  WALL,
} from "../lib/stage/flower.ts";
import { clamp01, noise1, rng } from "../lib/stage/noise.ts";
import { HORIZON_Y, SEA_DEPTH } from "../lib/stage/sea.ts";

const NS = "http://www.w3.org/2000/svg";

/** 꽃밥의 금 — 제 색이다. 수면에 비친 빛과 달리 광원을 따라가지 않는다. */
const GOLD = "#d9a154";

export interface FlowerScene {
  /** 모션 줄이기 화면인가 — 매 프레임 부를 필요가 없다는 뜻이다. */
  readonly reduceMotion: boolean;
  /** 자리가 바뀌었다. 벽이 화면 끝에 오도록 그루째 옮긴다. */
  resize(box: { left: number; width: number }): void;
  /** 한 프레임. 바람은 바다에서 받은 그대로 넘긴다. */
  render(clock: number, dt: number, wind: number, dir: number): void;
}

/** 바람 휨을 받는 마디. `w`는 뿌리 0 → 끝 1의 무게, `wf`>0이면 잔떨림도 받는다. */
interface Joint {
  g: SVGGElement;
  x: number;
  y: number;
  w: number;
  wf: number;
  ph: number;
}

/** 자서 획 — `ord` 순서대로 그려진다. */
interface Stroke {
  node: SVGPathElement;
  ord: number;
  len: number;
  start: number;
  dur: number;
}

/** 자서 때 순서대로 펴지는 덩어리(투명도 + 크기). */
interface Bloom {
  g: SVGGElement;
  x: number;
  y: number;
  ord: number;
  start: number;
  dur: number;
}

interface Petal {
  node: SVGPathElement;
  alive: boolean;
  x: number;
  y: number;
  vy: number;
  ph: number;
  rot: number;
  land: number;
}

interface Ripple {
  g: SVGGElement;
  rings: SVGEllipseElement[];
  alive: boolean;
  x: number;
  y: number;
  born: number;
}

function el<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export function mountFlower(scope: ParentNode): FlowerScene | null {
  const tree = scope.querySelector<SVGGElement>("[data-flower]");
  const petalLayer = scope.querySelector<SVGGElement>("[data-petals]");
  if (!tree || !petalLayer) return null;

  const rand = rng(SEED);
  const joints: Joint[] = [];
  const strokes: Stroke[] = [];
  const blooms: Bloom[] = [];
  /** 꽃잎이 떨어져 나오는 자리 — 원반 여섯 잎의 밑동. */
  const anchors: { x: number; y: number }[] = [];

  function joint(parent: SVGGElement, x: number, y: number, w: number, wf = 0): SVGGElement {
    const g = el("g");
    parent.appendChild(g);
    joints.push({ g, x, y, w, wf, ph: rand() * 6.28 });
    return g;
  }

  function stroke(parent: SVGGElement, d: string, lw: number, op: number, ord: number): Stroke {
    const node = el("path", {
      d,
      fill: "none",
      stroke: ink(op),
      "stroke-width": lw,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });
    parent.appendChild(node);
    const rec: Stroke = { node, ord, len: 0, start: 0, dur: 0 };
    strokes.push(rec);
    return rec;
  }

  function bloom(parent: SVGGElement, x: number, y: number, ord: number): SVGGElement {
    const g = el("g", { opacity: 0 });
    parent.appendChild(g);
    blooms.push({ g, x, y, ord, start: 0, dur: 0 });
    return g;
  }

  /* 벽에 박힌 뿌리 마디 — 그루 전체가 이 점을 축으로 흔들린다. */
  const wallJoint = joint(tree, WALL, BRANCH_WALL_Y, 0.14, 0.05);
  stroke(wallJoint, branchPath(), 2.6, 0.62, 0);
  stroke(wallJoint, barkPath(), 1.35, 0.3, 0.3);
  for (const d of PEDICELS) stroke(wallJoint, d, 1.43, 0.5, 0.6);
  const root = joint(wallJoint, FX, FY, 0.2, 0.3);

  /* 꽃머리를 8° 뒤로 눕혀 가지의 흐름을 이어받는다. */
  const head = el("g", { transform: `rotate(${HEAD_TILT} ${FX} ${HEAD_Y})` });
  root.appendChild(head);

  /* 원반 여섯 잎 — 발톱(가는 자루) 끝에 달려 부챗살로 벌어진다. */
  BLADE_DEGS.forEach((deg0, i) => {
    const deg = deg0 + (rand() - 0.5) * 9;
    const rad = (deg * Math.PI) / 180;
    const dist = 41 + rand() * 9;
    const rr = (25 + rand() * 6) * (1 - (0.16 * Math.abs(deg0)) / 85);
    const bx = FX + dist * Math.sin(rad);
    const by = HEAD_Y - dist * Math.cos(rad) - 5;
    const j = joint(head, bx, by, 0.02, 0.8);
    const g = bloom(j, bx, by, i % 3);
    const nx = FX + 9 * Math.sin(rad);
    const ny = HEAD_Y - 9 * Math.cos(rad) - 2;
    g.appendChild(
      el("path", {
        d: `M${nx.toFixed(1)},${ny.toFixed(1)} Q${((nx + bx) / 2 + 4).toFixed(1)},${((ny + by) / 2).toFixed(1)} ${bx.toFixed(1)},${by.toFixed(1)}`,
        fill: "none",
        stroke: ink(0.55),
        "stroke-width": 1.15,
      }),
    );
    const c = el("g", {
      transform: `translate(${bx.toFixed(1)},${by.toFixed(1)}) rotate(${(deg + (rand() - 0.5) * 30).toFixed(0)})`,
    });
    g.appendChild(c);
    const blade = crepeBlade(rr, rand);
    // 두 장을 겹친다 — 아래는 하늘을 가리는 판, 위는 먹선 윤곽.
    c.appendChild(el("path", { d: blade, fill: "#131316" }));
    c.appendChild(
      el("path", { d: blade, fill: "rgba(232,230,225,0.09)", stroke: ink(0.85), "stroke-width": 1 }),
    );
    for (let f = 0; f < 3; f += 1) {
      // 속주름
      const fa = rand() * 6.2832;
      const fr = rr * (0.55 + rand() * 0.35);
      c.appendChild(
        el("path", {
          d: `M${(Math.cos(fa) * fr).toFixed(1)},${(Math.sin(fa) * fr).toFixed(1)} Q${(Math.cos(fa + 1.2) * fr * 0.5).toFixed(1)},${(Math.sin(fa + 1.2) * fr * 0.5).toFixed(1)} ${(Math.cos(fa + 2.1) * fr * 0.75).toFixed(1)},${(Math.sin(fa + 2.1) * fr * 0.75).toFixed(1)}`,
          fill: "none",
          stroke: ink(0.26),
          "stroke-width": 0.65,
        }),
      );
    }
    anchors.push({ x: bx, y: by });
  });

  /* 꽃받침 잔 — 뿔 달린 종. 잎 밑동을 앞에서 감싸고 꼭지가 아래로 흐른다. */
  const cup = el("g", { transform: `translate(${FX},${HEAD_Y})` });
  bloom(head, FX, HEAD_Y, 1).appendChild(cup);
  cup.appendChild(
    el("path", {
      d: CUP_BELL,
      fill: "rgba(232,230,225,0.07)",
      stroke: ink(0.8),
      "stroke-width": 1.1,
    }),
  );
  cup.appendChild(el("path", { d: CUP_HORNS, fill: "none", stroke: ink(0.6), "stroke-width": 1 }));
  cup.appendChild(el("path", { d: CUP_STEM, fill: "none", stroke: ink(0.6), "stroke-width": 2 }));

  /* 심장 — 짧은 수술 뭉치의 굵은 금 꽃밥. */
  const heart = el("g", { transform: `translate(${FX},${HEAD_Y - 6})` });
  bloom(head, FX, HEAD_Y, 4).appendChild(heart);
  for (let s = 0; s < 20; s += 1) {
    const a = -1.5708 + (rand() - 0.5) * 2.8;
    const len = 8 + rand() * 13;
    const back = (rand() - 0.5) * 8;
    const x = len * Math.cos(a) - back * Math.sin(a);
    const y = len * Math.sin(a) + back * Math.cos(a);
    heart.appendChild(
      el("path", {
        d: `M0,2 Q${(x * 0.45).toFixed(1)},${(y * 0.45).toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`,
        fill: "none",
        stroke: ink(0.5),
        "stroke-width": 0.7,
      }),
    );
    heart.appendChild(
      el("circle", {
        cx: x.toFixed(1),
        cy: y.toFixed(1),
        r: (2 + rand() * 0.7).toFixed(1),
        fill: GOLD,
        opacity: (0.8 + rand() * 0.2).toFixed(2),
      }),
    );
  }
  /* 긴 수술 여섯 — 꽃잎보다 길게 활처럼 아래로 흘러내린다. */
  for (let l = 0; l < 6; l += 1) {
    const a = 1.5708 + (l / 5 - 0.5) * 2.0;
    const len = 48 + rand() * 28;
    const back = (rand() > 0.5 ? 1 : -1) * (16 + rand() * 14);
    const mx = len * 0.5 * Math.cos(a) - back * Math.sin(a);
    const my = len * 0.5 * Math.sin(a) + back * Math.cos(a);
    const x = len * Math.cos(a);
    const y = len * Math.sin(a);
    heart.appendChild(
      el("path", {
        d: `M0,0 Q${mx.toFixed(1)},${my.toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`,
        fill: "none",
        stroke: ink(0.72),
        "stroke-width": 1.05,
      }),
    );
    heart.appendChild(
      el("circle", { cx: x.toFixed(1), cy: y.toFixed(1), r: 1.5, fill: GOLD, opacity: 0.85 }),
    );
  }

  /* 갈라진 봉오리 구슬 둘. */
  BUDS.forEach(([bx, by, scale], i) => {
    const g = el("g", { transform: `translate(${bx},${by}) scale(${scale})` });
    bloom(root, bx, by, 5 + i).appendChild(g);
    g.appendChild(
      el("circle", {
        cx: 0,
        cy: 0,
        r: 7.5,
        fill: "rgba(232,230,225,0.08)",
        stroke: ink(0.75),
        "stroke-width": 1,
      }),
    );
    g.appendChild(el("path", { d: BUD_SPLIT, fill: "none", stroke: ink(0.4), "stroke-width": 0.7 }));
  });

  /* 낙화 못자리 — 꽃잎 여덟 장을 미리 파 두고 돌려 쓴다. */
  const petals: Petal[] = [];
  for (let i = 0; i < PETAL_POOL; i += 1) {
    const node = el("path", {
      d: PETAL,
      fill: "rgba(232,230,225,0.12)",
      stroke: ink(0.6),
      "stroke-width": 0.8,
      opacity: 0,
    });
    petalLayer.appendChild(node);
    petals.push({ node, alive: false, x: 0, y: 0, vy: 0, ph: 0, rot: 0, land: LAND_TOP });
  }
  /* 파문 못자리 — 착수 지점의 동심원 세 겹, 원근으로 눕는다. */
  const ripples: Ripple[] = [];
  for (let i = 0; i < RIPPLE_POOL; i += 1) {
    const g = el("g", { opacity: 0 });
    const rings: SVGEllipseElement[] = [];
    for (let q = 0; q < 3; q += 1) {
      const ring = el("ellipse", {
        cx: 0,
        cy: 0,
        rx: 0,
        ry: 0,
        fill: "none",
        stroke: ink(0.6),
        "stroke-width": 1,
      });
      g.appendChild(ring);
      rings.push(ring);
    }
    petalLayer.appendChild(g);
    ripples.push({ g, rings, alive: false, x: 0, y: 0, born: 0 });
  }

  /* 자서 시간표 — DOM에 붙은 뒤 길이를 잰다. */
  for (const rec of strokes) {
    rec.len = rec.node.getTotalLength();
    rec.node.style.strokeDasharray = String(rec.len);
    rec.node.style.strokeDashoffset = String(rec.len);
    rec.dur = Math.min(1.4, Math.max(0.22, rec.len / 160));
    rec.start = 0.4 + rec.ord * 0.3;
  }
  for (const b of blooms) {
    b.start = 0.55 + b.ord * 0.3;
    b.dur = 0.5;
  }
  const spring = { b: 0, v: 0 };
  let born = 0;
  /** 그루가 오른쪽으로 밀린 양. */
  let dx = 0;
  /** 꽃잎이 화면 밖으로 나갔는지 보는 기준 — layout()이 벌린 폭 그대로다. */
  const bounds = { left: 0, right: 700 };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function tick(clock: number, dt: number, wind: number, dir: number, still: boolean): void {
    if (!born) born = clock + 0.3;
    const age = still ? 99 : clock - born;

    if (dt > 0) {
      // 돌풍이 겹친 목표 각도로 끌려가는 감쇠 스프링 — 바람이 멎어도 한동안 흔들린다.
      const gust = noise1(clock * 0.7) - 0.5;
      const target = dir * (2 + 9 * wind) + gust * (1.5 + 6 * wind);
      spring.v += ((target - spring.b) * 4.0 - spring.v * 1.6) * dt;
      spring.b += spring.v * dt;
    }
    const bend = still ? 0 : spring.b;

    for (const j of joints) {
      let th = bend * j.w;
      if (j.wf > 0 && !still) {
        th += (noise1(clock * (2.2 + 3.5 * wind) + j.ph * 9) - 0.5) * (0.7 + 2.8 * wind) * j.wf * 3;
      }
      j.g.setAttribute("transform", `rotate(${th.toFixed(2)},${j.x},${j.y})`);
    }
    for (const rec of strokes) {
      const p = clamp01((age - rec.start) / rec.dur);
      rec.node.style.strokeDashoffset = (rec.len * (1 - p)).toFixed(1);
    }
    for (const b of blooms) {
      const p = clamp01((age - b.start) / b.dur);
      const e = p * p * (3 - 2 * p);
      b.g.setAttribute("opacity", e.toFixed(3));
      b.g.setAttribute(
        "transform",
        `translate(${b.x},${b.y}) scale(${(0.55 + 0.45 * e).toFixed(3)}) translate(${-b.x},${-b.y})`,
      );
    }

    /* 낙화 — 다 그려진 뒤부터. 빈도는 바람·돌풍에 비례한다. */
    if (!still && age > 2.5) {
      const gust = noise1(clock * 0.5);
      if (Math.random() < dt * 0.8 * (0.05 + 1.0 * wind * gust)) {
        const free = petals.find((p) => !p.alive);
        const from = anchors[Math.floor(Math.random() * anchors.length)];
        if (free && from) {
          free.alive = true;
          // 그루는 옮겨 갔어도 꽃잎은 전폭 좌표로 산다 — 지는 순간에만 이동량을 더한다.
          free.x = from.x + dx;
          free.y = from.y;
          free.vy = 6;
          free.ph = Math.random() * 6.28;
          free.rot = Math.random() * 360;
          free.land = LAND_TOP + Math.random() * LAND_SPAN;
        }
      }
    }
    for (const p of petals) {
      if (!p.alive) {
        p.node.setAttribute("opacity", "0");
        continue;
      }
      p.vy = Math.min(p.vy + 26 * dt, 24 + 20 * wind);
      p.x += (dir * (16 + 55 * wind) + Math.sin(clock * 2.6 + p.ph) * 20) * dt;
      p.y += p.vy * dt;
      p.rot += 90 * dt * Math.sin(clock * 1.7 + p.ph);
      if (p.x < bounds.left - 20 || p.x > bounds.right + 20) {
        p.alive = false;
        p.node.setAttribute("opacity", "0");
        continue;
      }
      if (p.y >= p.land) {
        /* 착수 — 꽃잎은 사라지고 그 자리에서 파문이 퍼진다. */
        const free = ripples.find((r) => !r.alive);
        if (free) {
          free.alive = true;
          free.x = p.x;
          free.y = p.land;
          free.born = clock;
        }
        p.alive = false;
        p.node.setAttribute("opacity", "0");
        continue;
      }
      const op =
        p.y < HORIZON_Y ? 0.7 : 0.7 * Math.min(1, 0.25 + (p.land - p.y) / 12);
      p.node.setAttribute(
        "transform",
        `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${p.rot.toFixed(1)}) scale(1.3)`,
      );
      p.node.setAttribute("opacity", op.toFixed(3));
    }

    /* 파문 — 동심원 세 겹이 시차를 두고 퍼지며 잦아든다. 깊이(가까움)만큼 크게. */
    for (const r of ripples) {
      if (!r.alive) {
        r.g.setAttribute("opacity", "0");
        continue;
      }
      const age2 = clock - r.born;
      if (still || age2 > 2.6) {
        r.alive = false;
        r.g.setAttribute("opacity", "0");
        continue;
      }
      const depth = 0.5 + ((r.y - HORIZON_Y) / SEA_DEPTH) * 1.8;
      r.g.setAttribute("opacity", "1");
      r.rings.forEach((ring, q) => {
        const ra = age2 - q * 0.34;
        if (ra <= 0 || ra > 1.9) {
          ring.setAttribute("opacity", "0");
          return;
        }
        const pr = ra / 1.9;
        const eased = 1 - (1 - pr) * (1 - pr);
        const rx = (2.5 + 30 * eased) * depth;
        ring.setAttribute("cx", r.x.toFixed(1));
        ring.setAttribute("cy", r.y.toFixed(1));
        ring.setAttribute("rx", rx.toFixed(1));
        ring.setAttribute("ry", (rx * 0.24).toFixed(1));
        ring.setAttribute("opacity", (0.55 * (1 - pr) * (1 - 0.28 * q)).toFixed(3));
      });
    }
  }

  if (reduceMotion) tick(performance.now() / 1000, 0, 0, 0, true);

  return {
    reduceMotion,

    resize(box) {
      bounds.left = box.left;
      bounds.right = box.left + box.width;
      // 벽을 화면 끝 바로 밖에 댄다 — 잘린 끝이 화면 밖에 숨는다.
      dx = treeShift(bounds.right);
      tree.setAttribute("transform", `translate(${dx.toFixed(1)},0)`);
    },

    render(clock, dt, wind, dir) {
      tick(clock, dt, wind, dir, false);
    },
  };
}
