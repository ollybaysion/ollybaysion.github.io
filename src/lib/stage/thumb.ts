/**
 * 목록 썸네일 — 그 글을 쓴 날 밤의 달과 먹선 바다.
 *
 * 처음엔 빛구멍을 그대로 줄여 넣었다(정본 `ListA.dc.html`). 그랬더니 상자마다 같은 보름달에
 * 같은 색 띠 바다라 글끼리 구별이 안 되고, 원이 상자를 짓눌렀다. 그래서 둘을 바꿨다.
 *
 *   - 달은 작게, **글 날짜의 위상**으로 뜬다. 차는 달은 오른쪽이, 이지러지는 달은 왼쪽이
 *     밝다. 삭 무렵엔 테두리만 남고 그만큼 별이 밝아진다.
 *   - 바다는 무대와 같은 먹선이다. 앞으로 올수록 벌어지고 짙어지며, 가장 앞 물결 하나만
 *     글의 색을 입는다. 달길(금)은 달이 밝을수록 짙다.
 *
 * 전부 상자 크기의 비율이라 최근(280×170)·주요(286×118) 어느 상자에도 같은 그림이 앉는다.
 * 모양은 태그와 속성 목록으로만 돌려준다 — 서버(Astro)와 클라이언트(주요 카드를 다시 채울 때)가
 * 같은 목록을 각자 그린다.
 */
import type { Rect } from './list.ts';
import { noise1, rng } from './noise.ts';

export interface Shape {
	tag: 'circle' | 'path' | 'rect';
	attrs: Record<string, string | number>;
}

/** 썸네일이 그리는 글 한 편에서 필요한 것. */
export interface ThumbPost {
	slug: string;
	date: string;
	color: string;
}

/** 달무리 그라디언트 — 목록 화면의 `<defs>`에 이 id로 한 벌 있다. */
export const THUMB_HALO_ID = 'th-halo';

/** 기준 삭(朔) 2000-01-06 18:14 UTC와 평균 삭망월. 날짜 하나만 보니 반나절 오차면 된다. */
const NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const SYNODIC = 29.530588853;
const DAY = 86_400_000;

/** 글 날짜의 달 위상 — 0 삭 · 0.25 상현 · 0.5 망 · 0.75 하현. 한국 밤 9시(12:00 UTC)에 잰다. */
export function moonPhase(date: string): number {
	const at = Date.parse(`${date.slice(0, 10)}T12:00:00Z`);
	const cycles = (at - NEW_MOON) / DAY / SYNODIC;
	return cycles - Math.floor(cycles);
}

/** 위상 → 밝은 면의 비율(0~1). */
export function moonLit(phase: number): number {
	return (1 - Math.cos(2 * Math.PI * phase)) / 2;
}

/** 이보다 어두우면 밝은 면을 그리지 않는다 — 테두리만 남는다. */
const LIT_MIN = 0.01;

/**
 * 밝은 면의 윤곽 — 밝은 쪽 가장자리 반원 + 명암 경계 반타원.
 * 경계의 가로 반지름은 r·|cos 2πp|라, 초승·그믐이면 밝은 쪽으로, 볼록달이면 어두운 쪽으로 부푼다.
 */
export function moonLitPath(cx: number, cy: number, r: number, phase: number): string | null {
	if (moonLit(phase) < LIT_MIN) return null;
	const k = Math.cos(2 * Math.PI * phase);
	const waxing = phase < 0.5;
	// SVG sweep 1 = 화면에서 시계 방향. 위에서 시계 방향이면 오른쪽 가장자리를 돈다.
	const outer = waxing ? 1 : 0;
	const inner = waxing === (k > 0) ? 0 : 1;
	return (
		`M${f(cx)},${f(cy - r)} A${f(r)},${f(r)} 0 0 ${outer} ${f(cx)},${f(cy + r)} ` +
		`A${f(Math.abs(k) * r)},${f(r)} 0 0 ${inner} ${f(cx)},${f(cy - r)} Z`
	);
}

/**
 * 달 자리. 해 진 뒤 남쪽 하늘에서 달은 날마다 동쪽(왼쪽)으로 물러난다 —
 * 초승달은 서쪽(오른쪽), 보름달은 한가운데, 그믐 무렵은 동쪽.
 */
const MOON = { x0: 0.78, dx: 0.56, cy: 0.3, r: 0.075, halo: 3.4 };
const HORIZON = 0.6;

/**
 * 먹선 물결 — 수평선(0)에서 상자 바닥(1) 사이의 자리. 앞으로 올수록 벌어지고 굵고 짙다.
 * 먼 물결은 잘게 끊기고(`gaps`) 거의 곧다 — 무대 바다가 멀리서 그렇게 보인다.
 */
const LINES = [
	{ t: 0.1, amp: 0.004, alpha: 0.2, width: 0.6, gaps: 3 },
	{ t: 0.26, amp: 0.007, alpha: 0.28, width: 0.75, gaps: 2 },
	{ t: 0.46, amp: 0.011, alpha: 0.4, width: 0.9, gaps: 1 },
	{ t: 0.72, amp: 0.016, alpha: 0.9, width: 1.2, gaps: 1 },
];
/** 한 토막을 몇 단위마다 찍나(상자 폭 비율). */
const LINE_STEP = 0.02;

/** 별 — 보름엔 이만큼, 삭이면 여기에 `STARS_DARK`가 더 뜬다. */
const STARS_FULL = 6;
const STARS_DARK = 10;
const INK = '232,230,225';
const MOON_LIGHT = '#f5e9c8';
const GOLD = '#d9a154';

const f = (v: number) => Number(v.toFixed(2));

/** 슬러그 → 시드(FNV-1a). 같은 글은 어느 상자에서든 같은 별과 같은 물결이다. */
function seedOf(slug: string): number {
	let h = 0x811c9dc5;
	for (const ch of slug) {
		h ^= ch.codePointAt(0)!;
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

export function thumbScene(rect: Rect, post: ThumbPost): Shape[] {
	const rand = rng(seedOf(post.slug));
	const phase = moonPhase(post.date);
	const lit = moonLit(phase);

	const bottom = rect.y + rect.h;
	const horizon = rect.y + rect.h * HORIZON;
	const r = rect.h * MOON.r;
	const cx = rect.x + rect.w * (MOON.x0 - MOON.dx * phase);
	const cy = rect.y + rect.h * MOON.cy;
	const shapes: Shape[] = [];

	// 별 — 달이 어두울수록 밝다. 달 곁(달무리 안)에는 두지 않는다.
	const stars = Math.round(STARS_FULL + STARS_DARK * (1 - lit));
	for (let i = 0; i < stars; i += 1) {
		const sx = rect.x + rect.w * (0.04 + rand() * 0.92);
		const sy = rect.y + rect.h * (0.06 + rand() * 0.44);
		const size = 0.4 + rand() * 0.5;
		const alpha = (0.2 + rand() * 0.35) * (1.15 - lit * 0.7);
		if (Math.hypot(sx - cx, sy - cy) < r * MOON.halo) continue;
		shapes.push({
			tag: 'circle',
			attrs: { cx: f(sx), cy: f(sy), r: f(size), fill: `rgba(${INK},${f(alpha)})` },
		});
	}

	// 달 — 무리, 어두운 면과 테두리, 밝은 면.
	shapes.push({
		tag: 'circle',
		attrs: {
			cx: f(cx),
			cy: f(cy),
			r: f(r * MOON.halo),
			fill: `url(#${THUMB_HALO_ID})`,
			opacity: f(0.2 + 0.6 * lit),
		},
	});
	shapes.push({
		tag: 'circle',
		attrs: {
			cx: f(cx),
			cy: f(cy),
			r: f(r),
			fill: '#1b1b20',
			stroke: MOON_LIGHT,
			'stroke-opacity': 0.45,
			'stroke-width': 0.8,
		},
	});
	const litPath = moonLitPath(cx, cy, r, phase);
	if (litPath) shapes.push({ tag: 'path', attrs: { d: litPath, fill: MOON_LIGHT } });

	// 수평선
	shapes.push({
		tag: 'path',
		attrs: {
			d: `M${f(rect.x)},${f(horizon)} L${f(rect.x + rect.w)},${f(horizon)}`,
			stroke: `rgba(${INK},0.3)`,
			'stroke-width': 0.7,
			fill: 'none',
		},
	});

	// 물결과 달길. 달길은 물결마다 한 토막 — 앞으로 올수록 넓고 옅다.
	LINES.forEach((line, i) => {
		const y = horizon + (bottom - horizon) * line.t;
		const amp = rect.h * line.amp;
		const shift = rand();
		const freq = 0.8 + rand() * 0.8;
		const accent = i === LINES.length - 1;

		if (lit >= LIT_MIN * 5) {
			const half = (rect.w * (0.012 + 0.05 * line.t) * (0.35 + 0.65 * lit)) / 2;
			shapes.push({
				tag: 'rect',
				attrs: {
					x: f(cx - half),
					y: f(y - amp - 1.6),
					width: f(half * 2),
					height: 1.2,
					rx: 0.6,
					fill: GOLD,
					opacity: f(lit * (0.9 - 0.45 * line.t)),
				},
			});
		}

		// 굽이(느린 사인) 위에 붓 떨림(잡음). 사인만 쓰면 그래프처럼 보인다.
		const yAt = (u: number) =>
			y +
			amp *
				(0.7 * Math.sin(2 * Math.PI * (u * freq + shift)) +
					1.2 * (noise1(u * 9 + shift * 50) - 0.5));
		const strokes = cutLine(line.gaps, rand).map(([u0, u1]) => {
			const points: string[] = [];
			for (let u = u0; u < u1; u += LINE_STEP) points.push(`${f(rect.x + rect.w * u)},${f(yAt(u))}`);
			points.push(`${f(rect.x + rect.w * u1)},${f(yAt(u1))}`);
			return `M${points.join(' L')}`;
		});
		shapes.push({
			tag: 'path',
			attrs: {
				d: strokes.join(' '),
				fill: 'none',
				stroke: accent ? post.color : `rgba(${INK},${line.alpha})`,
				'stroke-opacity': accent ? line.alpha : 1,
				'stroke-width': line.width,
				'stroke-linecap': 'round',
				'stroke-linejoin': 'round',
			},
		});
	});

	return shapes;
}

/**
 * 한 줄을 `gaps`군데 끊는다. 틈은 폭의 3~7%, 자리는 고르게 나눈 칸 안에서 흔든다.
 * 양 끝도 조금 안으로 들여 — 상자 끝까지 꽉 찬 선은 자로 그은 것처럼 보인다.
 */
function cutLine(gaps: number, rand: () => number): [number, number][] {
	const out: [number, number][] = [];
	let from = rand() * 0.06;
	for (let i = 1; i <= gaps; i += 1) {
		const at = (i + (rand() - 0.5) * 0.6) / (gaps + 1);
		const half = 0.015 + rand() * 0.02;
		out.push([from, at - half]);
		from = at + half;
	}
	out.push([from, 1 - rand() * 0.06]);
	return out;
}

/** 상자 네 귀의 재단 표시 — 필름 프레임선과 같은 말투다. 클립 밖에 그린다. */
const MARK = { gap: 4, len: 7 };

export function thumbMarks(rect: Rect): string {
	const { gap, len } = MARK;
	const l = rect.x - gap;
	const t = rect.y - gap;
	const rr = rect.x + rect.w + gap;
	const b = rect.y + rect.h + gap;
	return [
		`M${l},${t + len} L${l},${t} L${l + len},${t}`,
		`M${rr - len},${t} L${rr},${t} L${rr},${t + len}`,
		`M${rr},${b - len} L${rr},${b} L${rr - len},${b}`,
		`M${l + len},${b} L${l},${b} L${l},${b - len}`,
	].join(' ');
}
