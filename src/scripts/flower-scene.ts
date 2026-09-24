/**
 * 감나무를 세우고 흔든다.
 *
 * 붙일 자리는 `[data-flower]`(그루)와 `[data-falls]`(지는 잎·파문) 둘이다.
 * 바다처럼 id가 아니라 `data-` 표시로 찾는다.
 *
 * **그루는 바다와 같은 바람 하나를 받는다** — 세기도 방향도 `sea.draw`가 돌려주는
 * 그 프레임의 값이다. 제 바람을 따로 지어내면 한 하늘에서 두 리듬이 분다.
 *
 * 그루는 벽에 박힌 뿌리 마디를 축으로 통째로 휘고, 꺾인 마디와 잔가지가 그 위에 제 휨을
 * 더 얹는다. 감은 꼭지를 축으로 추처럼 흔들린다. 다 그려진 뒤부터 잎이 지기 시작하고,
 * 잎이 물에 닿는 자리에서 사라지며 파문만 남는다.
 *
 * 지는 잎은 그루와 함께 옮기지 않는다 — 떨어진 뒤엔 제 좌표로 살아야
 * 화면 밖 판정과 파문 자리가 전폭 좌표 그대로다. 대신 지는 순간에만 이동량을 더한다.
 */
import {
  CALYX,
  ELBOW,
  FALL,
  FALL_LEAF,
  FRUIT,
  FRUIT_FILL,
  FRUIT_GLOSS,
  FRUIT_GROOVES,
  FRUIT_X,
  FRUIT_Y,
  ink,
  LAND_SPAN,
  LAND_TOP,
  LEAF_POOL,
  leafDrop,
  leafPath,
  LEAVES,
  leafVeins,
  LIMB,
  LIMB_BARK,
  MOSS_LIMB,
  MOSS_TRUNK,
  RIPPLE_POOL,
  SEED,
  STALK,
  STALK_PATH,
  SWAY,
  treePlace,
  TRUNK,
  TRUNK_BARK,
  TWIGS,
  WALL,
  WALL_Y,
} from "../lib/stage/flower.ts";
import { clamp01, noise1, rng } from "../lib/stage/noise.ts";
import { HORIZON_Y, SEA_DEPTH } from "../lib/stage/sea.ts";

const NS = "http://www.w3.org/2000/svg";

export interface FlowerScene {
  /** 모션 줄이기 화면인가 — 매 프레임 부를 필요가 없다는 뜻이다. */
  readonly reduceMotion: boolean;
  /** 자리가 바뀌었다. 벽이 화면 끝에 오도록(좁으면 빛구멍 위로) 그루째 옮긴다. */
  resize(box: { left: number; width: number; top: number }): void;
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

/** 지는 잎 한 장. */
interface Falling {
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
  const fallLayer = scope.querySelector<SVGGElement>("[data-falls]");
  if (!tree || !fallLayer) return null;

  const rand = rng(SEED);
  const joints: Joint[] = [];
  const strokes: Stroke[] = [];
  const blooms: Bloom[] = [];
  /** 잎이 떨어져 나오는 자리 — 남은 잎 셋의 잎몸. */
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

  /** 태점 — 이끼 점 몇 개가 한 덩어리로 찍힌다. 크기는 시드가 정한다. */
  function moss(parent: SVGGElement, pts: [number, number][], ord: number): void {
    const [x0, y0] = pts[0]!;
    const g = bloom(parent, x0, y0, ord);
    for (const [x, y] of pts) {
      g.appendChild(el("circle", { cx: x, cy: y, r: (0.9 + rand() * 0.8).toFixed(1), fill: ink(0.4) }));
    }
  }

  /*
   * 난수는 시안과 같은 차례로 쓴다 — 마디 둘, 태점 여섯, 잔가지 마디 셋, 감 마디.
   * 차례가 바뀌면 같은 시드로도 다른 그루가 된다.
   */

  /* 벽에 박힌 뿌리 마디 — 그루 전체가 이 점을 축으로 흔들린다. */
  const trunk = joint(tree, WALL, WALL_Y, 0.12, 0.03);
  stroke(trunk, TRUNK, 4.6, 0.82, 0);
  stroke(trunk, TRUNK_BARK, 1.4, 0.3, 0.4);
  /* 꺾이는 마디 — 바깥 가지가 따로 휜다. */
  const limb = joint(trunk, ELBOW.x, ELBOW.y, 0.3, 0.05);
  stroke(limb, LIMB, 3.2, 0.8, 1);
  stroke(limb, LIMB_BARK, 1, 0.28, 1.4);
  moss(trunk, MOSS_TRUNK, 1);
  moss(limb, MOSS_LIMB, 2);

  /* 잔가지 셋 — 꺾이며 가늘어진다. */
  const twigs = TWIGS.map((t) => {
    const g = joint(t.onLimb ? limb : trunk, t.x, t.y, t.w, t.wf);
    stroke(g, t.d, t.lw, t.op, t.ord);
    return g;
  });

  /* 남은 잎 셋 — 아래는 하늘을 가리는 판, 위는 먹선 윤곽과 잎맥. */
  for (const leaf of LEAVES) {
    const g = bloom(leaf.twig === null ? trunk : twigs[leaf.twig]!, leaf.x, leaf.y, leaf.ord);
    const transform = `translate(${leaf.x},${leaf.y}) rotate(${leaf.deg}) scale(${leaf.curl},1)`;
    const d = leafPath(leaf.len, leaf.half);
    g.appendChild(el("path", { d, fill: "#131316", transform }));
    g.appendChild(
      el("path", { d, fill: "rgba(232,230,225,0.07)", stroke: ink(0.75), "stroke-width": 0.9, transform }),
    );
    g.appendChild(
      el("path", {
        d: leafVeins(leaf.len, leaf.half),
        fill: "none",
        stroke: ink(0.28),
        "stroke-width": 0.6,
        transform,
      }),
    );
    anchors.push(leafDrop(leaf));
  }

  /* 감 — 꼭지를 축으로 추처럼 흔들린다. 금은 이 한 알에만 쓴다. */
  const stalk = joint(limb, STALK.x, STALK.y, 0.9, 0);
  stroke(stalk, STALK_PATH, 2.4, 0.8, 2);
  const fruit = el("g", { transform: `translate(${FRUIT_X},${FRUIT_Y})` });
  bloom(stalk, FRUIT_X, FRUIT_Y - 2, 4).appendChild(fruit);
  fruit.appendChild(el("path", { d: FRUIT, fill: "#131316" }));
  fruit.appendChild(el("path", { d: FRUIT, fill: FRUIT_FILL, stroke: ink(0.85), "stroke-width": 1.2 }));
  fruit.appendChild(el("path", { d: FRUIT_GROOVES, fill: "none", stroke: ink(0.2), "stroke-width": 0.8 }));
  fruit.appendChild(
    el("path", {
      d: FRUIT_GLOSS,
      fill: "none",
      stroke: ink(0.45),
      "stroke-width": 1.6,
      "stroke-linecap": "round",
    }),
  );
  fruit.appendChild(
    el("path", { d: CALYX, fill: "rgba(232,230,225,0.1)", stroke: ink(0.8), "stroke-width": 1 }),
  );

  /* 지는 잎 못자리 — 여덟 장을 미리 파 두고 돌려 쓴다. */
  const falls: Falling[] = [];
  for (let i = 0; i < LEAF_POOL; i += 1) {
    const node = el("path", {
      d: FALL_LEAF,
      fill: "rgba(232,230,225,0.12)",
      stroke: ink(0.6),
      "stroke-width": 0.8,
      opacity: 0,
    });
    fallLayer.appendChild(node);
    falls.push({ node, alive: false, x: 0, y: 0, vy: 0, ph: 0, rot: 0, land: LAND_TOP });
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
    fallLayer.appendChild(g);
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
  /** 그루가 옮겨 앉은 양 — 좁은 무대에서는 가로만이 아니라 세로로도 움직인다. */
  let dx = 0;
  let dy = 0;
  /** 지는 잎이 화면 밖으로 나갔는지 보는 기준 — layout()이 벌린 폭 그대로다. */
  const bounds = { left: 0, right: 700 };

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function tick(clock: number, dt: number, wind: number, dir: number, still: boolean): void {
    if (!born) born = clock + 0.3;
    const age = still ? 99 : clock - born;

    if (dt > 0) {
      // 돌풍이 겹친 목표 각도로 끌려가는 감쇠 스프링 — 바람이 멎어도 한동안 흔들린다.
      const gust = noise1(clock * 0.7) - 0.5;
      const target = (dir * (2 + 9 * wind) + gust * (1.5 + 6 * wind)) * SWAY;
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

    /* 지는 잎 — 다 그려진 뒤부터. 빈도는 바람·돌풍에 비례한다. */
    if (!still && age > 2.5) {
      const gust = noise1(clock * 0.5);
      if (Math.random() < dt * FALL.rate * (0.05 + 1.0 * wind * gust)) {
        const free = falls.find((p) => !p.alive);
        const from = anchors[Math.floor(Math.random() * anchors.length)];
        if (free && from) {
          free.alive = true;
          // 그루는 옮겨 갔어도 지는 잎은 전폭 좌표로 산다 — 지는 순간에만 이동량을 더한다.
          free.x = from.x + dx;
          free.y = from.y + dy;
          free.vy = 6 * FALL.sink;
          free.ph = Math.random() * 6.28;
          free.rot = Math.random() * 360;
          free.land = LAND_TOP + Math.random() * LAND_SPAN;
        }
      }
    }
    for (const p of falls) {
      if (!p.alive) {
        p.node.setAttribute("opacity", "0");
        continue;
      }
      // 넓은 잎은 꽃잎보다 천천히 가라앉고 바람에 더 밀린다.
      p.vy = Math.min(p.vy + 26 * dt * FALL.sink, (24 + 20 * wind) * FALL.sink);
      p.x += (dir * (16 + 55 * wind) * FALL.drift + Math.sin(clock * 2.6 + p.ph) * 20) * dt;
      p.y += p.vy * dt;
      p.rot += 90 * dt * Math.sin(clock * 1.7 + p.ph);
      if (p.x < bounds.left - 20 || p.x > bounds.right + 20) {
        p.alive = false;
        p.node.setAttribute("opacity", "0");
        continue;
      }
      if (p.y >= p.land) {
        /* 착수 — 잎은 사라지고 그 자리에서 파문이 퍼진다. */
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
        `translate(${p.x.toFixed(1)},${p.y.toFixed(1)}) rotate(${p.rot.toFixed(1)}) scale(${FALL.scale})`,
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
      const place = treePlace(bounds.right, box.top);
      dx = place.dx;
      dy = place.dy;
      tree.setAttribute(
        "transform",
        `translate(${dx.toFixed(1)},${dy.toFixed(1)})`,
      );
    },

    render(clock, dt, wind, dir) {
      tick(clock, dt, wind, dir, false);
    },
  };
}
