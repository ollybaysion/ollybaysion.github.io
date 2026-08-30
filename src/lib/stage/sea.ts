/**
 * 바다 — 바람이 모는 먹선 파도. 시안 `무대 좌측 시안`의 파도 엔진을 그대로 옮겼다.
 *
 * 밴드 그림(`sea-bands.ts`)이 멈춰 선 한 장이라면 이쪽은 살아 있다. 파도 하나가
 * 11.2초 동안 수평선에서 물가로 내려오며 태어나고, 너울지고, 일어서고, 부서진다.
 *
 * 무엇이 그 파도를 정하느냐 — **바람 값 하나다.** 바람은 실제 시각에서 나온다:
 * 기압 배치(≈3.2일) · 해풍 하루 주기 · 돌풍(≈20분)을 겹친 0~1. 그 값이 모드
 * 사다리(곧게 → 굽이 → 너울 → 쪼개짐 → 맺힘)와 발생 간격 · 골 · 세기를 한꺼번에 몬다.
 * 새벽에 열어 본 바다와 한낮에 열어 본 바다가 다르다.
 *
 * 좌표 원장의 결정론 규칙과는 무관하다 — 여기서 나오는 건 화면의 움직임뿐이고,
 * 글의 좌표는 이 파일을 보지 않는다.
 */

import { clamp01, hash, noise1, rng } from './noise.ts';
import { INK } from './palette.ts';

/** 수평선 — CLI 아래 선. 바다는 여기서 시작해 화면 바닥까지 간다. */
export const HORIZON_Y = 518;

/**
 * 정본 바다의 깊이 — 수평선에서 무대 바닥(790)까지.
 *
 * 아래 윤슬 좌표(545~782)가 이 깊이를 기준으로 잡혀 있다. 더 얕은 자리에 바다를
 * 앉히려면 깊이는 이 값으로 두고 화면 쪽을 눌러라(`sea-scene.ts`의 squash) —
 * 깊이를 줄이면 파도만 얕아지고 윤슬은 제자리에 남아 둘이 어긋난다.
 */
export const SEA_DEPTH = 272;

/** 파도 하나가 수평선에서 물가까지 사는 시간(초). */
const TRAVEL = 11.2;
/** 세트 주기 — 큰 놈과 작은 놈이 번갈아 오는 리듬. */
const SET = 19;
function sstep(a: number, b: number, p: number): number {
	const t = clamp01((p - a) / (b - a));
	return t * t * (3 - 2 * t);
}

function bump(a: number, b: number, p: number): number {
	return Math.sin(Math.PI * clamp01((p - a) / (b - a)));
}

function vn(x: number, sd: number): number {
	const i = Math.floor(x);
	const f = x - i;
	const u = f * f * (3 - 2 * f);
	return hash(i + sd) + (hash(i + 1 + sd) - hash(i + sd)) * u;
}

function fbm(x: number, sd: number): number {
	return 0.55 * vn(x, sd) + 0.3 * vn(x * 2.1, sd + 7) + 0.15 * vn(x * 4.3, sd + 19);
}

function env(t: number): number {
	return 0.42 + 0.58 * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / SET));
}

/*
  바람 — 세 겹을 겹친다. 기압 배치는 며칠에 걸쳐 굼뜨게 돌고, 해풍은 하루를 돌고,
  돌풍은 20분마다 널뛴다. 셋을 더해 0~1로 눌러 놓은 값 하나가 바다 전체를 몬다.
*/

/** 지역시 보정 — 해풍은 보는 사람 자리의 시계를 따른다. 처음 물을 때 한 번 잰다. */
let tz: number | null = null;
function localHours(h: number): number {
	tz ??= -new Date().getTimezoneOffset() / 60;
	return h + tz;
}

function synoptic(h: number): number {
	return fbm(h / 76, 3);
}

function diurnal(h: number): number {
	return 0.5 + 0.5 * Math.sin((2 * Math.PI * (h - 9)) / 24);
}

function gust(h: number): number {
	return fbm(h * 3, 41);
}

function windAt(sec: number): number {
	const h = sec / 3600;
	return clamp01(
		(0.52 * synoptic(h) + 0.34 * diurnal(localHours(h)) + 0.14 * gust(h) - 0.12) / 0.76,
	);
}

/** 모드용 바람 — 돌풍을 뺀다. 안 그러면 파도 모양이 깜빡인다. */
function windSlow(sec: number): number {
	const h = sec / 3600;
	return clamp01((0.6 * synoptic(h) + 0.4 * diurnal(localHours(h)) - 0.12) / 0.76);
}

function windDir(sec: number): number {
	return fbm(sec / 3600 / 58, 11);
}

/** 모드 사다리 — 바람이 세질수록 파도가 복잡해진다. */
const LADDER = [
	{ kind: 'straight', from: 0 },
	{ kind: 'bend', from: 0.22 },
	{ kind: 'swell', from: 0.38 },
	{ kind: 'split', from: 0.6 },
	{ kind: 'merge', from: 0.8 },
] as const;

type Kind = (typeof LADDER)[number]['kind'];

function modeAt(sec: number): Kind {
	const w = windSlow(sec);
	let mode: Kind = LADDER[0].kind;
	for (const step of LADDER) if (w >= step.from) mode = step.kind;
	return mode;
}

/** 다음 파도까지의 간격 배수 — 바람이 세면 촘촘해진다. */
function spawnFrom(w: number, sec: number): number {
	return clamp01(0.78 - 0.44 * w + 0.16 * (fbm(sec / 3600 / 5.5, 61) - 0.5));
}

/** 골 깊이 — 파도 사이가 얼마나 파이는가. */
function troughFrom(w: number, sec: number): number {
	return clamp01(0.16 + 0.64 * w + 0.2 * (fbm(sec / 3600 / 4.1, 83) - 0.5));
}

function strengthFrom(w: number): number {
	return 7 + 15 * w;
}

/** 일생 — 탄생 · 너울 · 일어섬 · 부서짐. p는 0(수평선)에서 1(물가). */
function life(p: number): number {
	if (p < 0 || p > 1.06) return 0;
	return (
		sstep(0, 0.13, p) * (1 - sstep(0.28, 0.52, p)) * 0.3 +
		bump(0.13, 0.33, p) * 0.34 +
		sstep(0.58, 0.87, p) * 0.52 +
		bump(0.85, 1.04, p) * 1
	);
}

function life2(p: number, trough: number): number {
	return life(p) + trough * 0.3 * bump(0.28, 0.82, p);
}

function crashAmt(p: number): number {
	return bump(0.85, 1.04, p);
}

interface Shape {
	rows: number;
	seg: 'solid' | 'split' | 'merge';
	curve: number;
}

const KINDS: Record<Kind, Shape> = {
	straight: { rows: 1, seg: 'solid', curve: 0 },
	bend: { rows: 1, seg: 'solid', curve: 19 },
	swell: { rows: 3, seg: 'solid', curve: 23 },
	split: { rows: 1, seg: 'split', curve: 9 },
	merge: { rows: 1, seg: 'merge', curve: 9 },
};

/** 한 줄을 토막으로 끊는다. 쪼개짐은 물가에서 갈라지고, 맺힘은 오다가 붙는다. */
function segments(mode: Shape['seg'], p: number, seed: number): [number, number][] {
	if (mode === 'solid') return [[0, 1]];
	const gap =
		mode === 'split'
			? 0.075 * sstep(0.7, 1, p)
			: 0.07 * (1 - sstep(0.06, 0.52, p)) + 0.085 * sstep(0.84, 1.02, p);
	if (gap < 0.004) return [[0, 1]];

	const cuts: number[] = [];
	for (let i = 1; i < 4; i += 1) cuts.push(i / 4 + (hash(seed + i * 4.1) - 0.5) * 0.13);
	cuts.sort((a, b) => a - b);

	const out: [number, number][] = [];
	let prev = 0;
	for (const c of cuts) {
		out.push([prev, Math.max(prev, c - gap / 2)]);
		prev = Math.min(1, c + gap / 2);
	}
	out.push([prev, 1]);
	return out.filter((s) => s[1] - s[0] > 0.012);
}

/**
 * 파도 한 장. `w`와 `depth`는 무대 좌표 — 폭은 화면 끝까지, 깊이는 수평선에서 바닥까지다.
 * 캔버스는 이미 무대 단위로 늘려 놨으니 여기서는 정본 좌표 그대로 그린다.
 */
function drawOne(
	g: CanvasRenderingContext2D,
	w: number,
	depth: number,
	pIn: number,
	seed0: number,
	e: number,
	shape: Shape,
	strength: number,
	trough: number,
	clock: number,
	tilt: number,
): void {
	for (let r = 0; r < shape.rows; r += 1) {
		const p = pIn - r * 0.038;
		if (p < 0 || p > 1.06) continue;
		const seed = seed0 + r * 31.3;
		const a = life2(p, trough) * e * (0.55 + strength / 22) * (r === 0 ? 1 : 0.42 / r);
		if (a < 0.012) continue;

		const cr = crashAmt(p);
		const yb = p * depth;
		const lw = (1 + 1.7 * bump(0.13, 0.33, p) + 7.5 * cr) * (r === 0 ? 1 : 0.55);
		const jit = 0.7 + 1.4 * bump(0.13, 0.33, p) + 6.5 * cr;
		const camp = shape.curve * (1 - 0.62 * clamp01(p)) * (0.7 + 0.3 * Math.sin(seed));
		const cfrq = 0.75 + 0.55 * hash(seed + 2.2);
		const cphs = seed * 0.7 + clock * 0.11;
		const tl = tilt * (1 - 0.5 * clamp01(p));

		for (const [q, [s0, s1]] of segments(shape.seg, p, seed).entries()) {
			const xa = s0 * w;
			const xb = s1 * w;
			const yAt = (x: number): number => {
				const u = x / w;
				return (
					yb +
					tl * (u - 0.5) +
					camp * Math.sin(2 * Math.PI * (u * cfrq) + cphs) +
					(noise1(x * 0.021 + seed) - 0.5) * jit +
					(noise1(x * 0.115 + seed * 2.3) - 0.5) * jit * 0.5
				);
			};

			g.lineCap = 'round';
			g.lineJoin = 'round';
			g.lineWidth = lw;
			const al = Math.min(a, 1).toFixed(3);
			if (shape.seg === 'solid') {
				g.strokeStyle = `rgba(${INK},${al})`;
			} else {
				/*
				  토막 끝은 흐려서 사라진다 — 자른 자국이 보이면 종이를 오린 것처럼 된다.
				  흐리는 건 그라디언트지 토막이 아니다. 7단위씩 따로 그으면 둥근 끝이 이웃과
				  겹쳐 알파가 두 번 쌓인다 — 선에 알이 줄줄이 맺혀 점선이 된다.
				*/
				const fw = Math.min(26, (xb - xa) * 0.4);
				const edge = fw / Math.max(1e-6, xb - xa);
				const fade = g.createLinearGradient(xa, 0, xb, 0);
				fade.addColorStop(0, `rgba(${INK},0)`);
				fade.addColorStop(edge, `rgba(${INK},${al})`);
				fade.addColorStop(1 - edge, `rgba(${INK},${al})`);
				fade.addColorStop(1, `rgba(${INK},0)`);
				g.strokeStyle = fade;
			}
			// 한 획 — 이어 그어야 겹치는 자리가 생기지 않는다.
			g.beginPath();
			g.moveTo(xa, yAt(xa));
			for (let x = xa + 7; x < xb; x += 7) g.lineTo(x, yAt(x));
			g.lineTo(xb, yAt(xb));
			g.stroke();

			// 부서짐 물보라 — 알 갯수는 정본 700폭 기준을 실제 폭에 비례시켜 밀도를 지킨다.
			if (cr > 0.12 && r === 0) {
				const n = Math.round(58 * cr * (s1 - s0) * (w / 700));
				for (let i = 0; i < n; i += 1) {
					const hx = xa + hash(i * 1.7 + seed + q) * (xb - xa);
					const hy = yAt(hx) + (hash(i * 3.1 + seed) - 0.5) * 26 * cr;
					g.globalAlpha = Math.min(a, 1) * cr * (0.22 + hash(i * 5.3 + q) * 0.68);
					g.fillStyle = `rgb(${INK})`;
					g.beginPath();
					g.arc(hx, hy, 0.5 + hash(q * 7.9) * 1.6, 0, Math.PI * 2);
					g.fill();
				}
				g.globalAlpha = 1;
			}
		}
	}
}

/** 이번 프레임에 살아 있는 파도 하나 — 무대 y · 일생 밝기 · 부서짐. */
export interface SeaWave {
	/** 무대 좌표계의 y(수평선 + 진행). */
	y: number;
	/** 먹선(첫 줄)의 밝기 식과 같은 값. */
	a: number;
	/** 부서지는 정도 0~1. */
	cr: number;
}

export interface SeaFrame {
	wind: number;
	/** 바람 방향 −1(왼쪽) ~ +1(오른쪽). 파도의 기울기를 정하는 그 값이다. */
	dir: number;
	waves: SeaWave[];
}

export interface Sea {
	/** 한 프레임 그리고, 윤슬이 물릴 파도 목록을 돌려준다. */
	draw(
		g: CanvasRenderingContext2D,
		w: number,
		depth: number,
		clock: number,
		sec: number,
	): SeaFrame;
	/** 모션 줄이기 — 파도 세 장을 일생의 서로 다른 지점에 세워 둔다. */
	freeze(clock: number): void;
}

export function createSea(): Sea {
	const born: { born: number; mode: Kind; seed: number; e: number }[] = [];
	let last = -1e9;

	return {
		draw(g, w, depth, clock, sec) {
			const wind = windAt(sec);
			const spawn = spawnFrom(wind, sec);
			const trough = troughFrom(wind, sec);
			const strength = strengthFrom(wind);
			const tilt = (windDir(sec) - 0.5) * 26;

			const interval = Math.max(1.4, spawn * TRAVEL);
			if (clock - last >= interval) {
				last = clock;
				born.push({
					born: clock,
					mode: modeAt(sec),
					seed: hash(clock * 3.3) * 900,
					e: env(clock),
				});
				if (born.length > 14) born.shift();
			}

			const waves: SeaWave[] = [];
			for (const wave of born) {
				const p = (clock - wave.born) / TRAVEL;
				if (p > 1.06) continue;
				drawOne(g, w, depth, p, wave.seed, wave.e, KINDS[wave.mode], strength, trough, clock, tilt);
				waves.push({
					y: HORIZON_Y + p * depth,
					a: life2(p, trough) * wave.e * (0.55 + strength / 22),
					cr: crashAmt(p),
				});
			}
			while (born.length && (clock - born[0]!.born) / TRAVEL > 1.06) born.shift();

			return { wind, dir: (windDir(sec) - 0.5) * 2, waves };
		},

		freeze(clock) {
			for (const p of [0.82, 0.52, 0.22]) {
				born.push({ born: clock - p * TRAVEL, mode: 'swell', seed: hash(p * 97) * 900, e: 0.8 });
			}
			last = clock;
		},
	};
}

/*
  윤슬 — 달길 빛기둥 위의 물비늘. 기둥은 수평선 쪽이 좁고 관찰자 쪽으로 벌어지고,
  그림자 띠와 낱알 점등은 지나가는 먹선 파도가 정한다(능선 위상이 아니다).
*/

/** 달길이 사는 구간. 위가 수평선 쪽, 아래가 관찰자 쪽. */
const GLADE_TOP = 545;
const GLADE_BOTTOM = 782;
const GLADE_SPAN = GLADE_BOTTOM - GLADE_TOP;

/** 달길 반폭 — 기둥과 그림자 띠가 같은 식을 본다. */
export function gladeHalfWidth(y: number, spread: number): number {
	const u = Math.max(0, (y - GLADE_TOP) / GLADE_SPAN);
	return (9 + 58 * u ** 1.5) * spread;
}

/** 빛기둥 윤곽 — 가장자리가 느리게 일렁인다. */
export function gladeColumnPath(t: number, spread: number): string {
	const left: string[] = [];
	const right: string[] = [];
	for (let y = GLADE_TOP; y <= GLADE_BOTTOM; y += 8) {
		const u = (y - GLADE_TOP) / GLADE_SPAN;
		const hw =
			gladeHalfWidth(y, spread) *
			(1 + 0.16 * Math.sin((y * 2 * Math.PI) / (46 + 130 * u) - t * 1.4));
		left.push(`${(350 - hw).toFixed(1)},${y}`);
		right.unshift(`${(350 + hw).toFixed(1)},${y}`);
	}
	return `M${left.join(' L')} L${right.join(' L')} Z`;
}

/** 지나가는 파도들에게서 깊이 y가 받는 밝기. 제일 센 놈 하나가 이긴다. */
export function flashAt(y: number, waves: readonly SeaWave[], sigma: number): number {
	let f = 0;
	for (const wave of waves) {
		const d = (y - wave.y) / sigma;
		const v = Math.exp(-d * d) * Math.min(1, wave.a * 1.6);
		if (v > f) f = v;
	}
	return f;
}

/** 파도 하나가 기둥을 가로지를 때 생기는 그림자 띠의 수 — 화면에 미리 깔아 둔다. */
export const GLADE_BAND_COUNT = 14;

/** 물비늘 낱알 하나. 자리는 고정이고 밝기만 파도를 따라 켜진다. */
export interface GladeGlint {
	/** 무대 y. */
	y: number;
	/** 0(수평선) ~ 1(관찰자). */
	u: number;
	/** 가운데에서 좌우로 얼마나 벗어났나(퍼짐 폭의 배수). */
	gx: number;
	/** 기본 길이. */
	len: number;
	/** 두께. */
	h: number;
	/** 자리가 정하는 밝기 상한 — 가운데가 밝고 관찰자 쪽이 잦아든다. */
	envl: number;
	/** 파도가 없을 때의 잔물결 위상과 속도. */
	ph: number;
	v: number;
}

export const GLADE_GLINTS: GladeGlint[] = (() => {
	const rand = rng(7);
	const out: GladeGlint[] = [];
	for (let i = 0; i < 120; i += 1) {
		const u = rand() ** 0.9;
		const y = 560 + u * 218;
		// 가우시안 근사 — 낱알이 가운데로 몰린다.
		const gx = (rand() + rand() + rand()) / 1.5 - 1;
		out.push({
			y,
			u,
			gx,
			len: (3 + 24 * u ** 1.3) * (0.6 + 0.8 * rand()),
			h: 1 + 1.6 * u,
			envl: Math.exp(-(gx * gx) * 1.6) * (0.9 - 0.65 * u),
			ph: rand() * 6.28,
			v: 0.4 + rand() * 0.5,
		});
	}
	return out;
})();
