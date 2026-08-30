/**
 * 배롱나무 — 오른쪽 하늘의 초상.
 *
 * 제철 꽃 시안(`bae-crepe`)의 배롱 판을 무대로 옮긴 것이다. 우측 벽에서 사선으로 든
 * 가지, 그 접선을 이어받은 꽃자루, 8° 눕힌 크레이프 원반 여섯 잎, 금 꽃밥 심장,
 * 활처럼 흘러내리는 긴 수술 여섯, 그리고 낙화와 파문.
 *
 * 여기에는 **자리와 모양만** 있다. DOM으로 세우고 흔드는 일은 `flower-scene.ts`가 한다.
 * 나뉜 이유는 난수 때문이다 — 구김과 흩어짐은 시드 하나가 정하고, 그 소비 순서가
 * 곧 꽃의 생김새다. 순서를 지켜야 하는 코드를 한곳에 모아 두면 손대다 어긋난다.
 */
import { INK } from './palette.ts';

/** 꽃머리 자리 — 정본 700 열 안, 빛구멍 오른쪽 하늘. */
export const FX = 565;
export const FY = 272;
/**
 * 가지가 나오는 벽.
 *
 * 정본 폭(700) 바로 밖이다. 화면이 넓어져도 가지를 늘이지 않고 이 점을 화면 끝에 대
 * **그루째 오른쪽으로 옮긴다** — 벽이 곧 화면 끝이라 가지는 늘 화면 밖에서 들어오고,
 * 꽃머리는 어느 폭에서든 오른쪽 끝에서 같은 거리에 선다.
 */
export const WALL = 706;
/**
 * 시드 65 — 네 폭 시안에서 배롱 판이 받은 수(31 + 2×17).
 * 원반의 구김도 수술의 흩어짐도 이 수가 정한다. 바꾸면 다른 꽃이 된다.
 */
export const SEED = 65;

/** 꽃머리 중심 — 꽃받침 잔이 앉는 자리. */
export const HEAD_Y = FY + 26;
/** 꽃머리를 이만큼 뒤로 눕혀 가지의 흐름을 이어받는다. */
export const HEAD_TILT = -8;

/** 가지가 벽에 박히는 높이. */
export const BRANCH_WALL_Y = FY + 88;
/** 가지가 꽃자루로 드는 끝점. */
export const BRANCH_TIP_X = FX + 22;
export const BRANCH_TIP_Y = FY + 53;
/** 굽이점 — 꽃자루로 드는 접선(≈21°)을 정하는 못. */
const BEND_X = BRANCH_TIP_X + 73.5;
const BEND_Y = BRANCH_TIP_Y + 27.5;
/** 벽에서 끝점까지 — 어느 화면에서든 이 길이다. */
const RUN = WALL - BRANCH_TIP_X;

/**
 * 가지 — 3차 곡선. 끝 굽이점이 접선을 정하고, 벽 쪽 굽이점이 활을 준다.
 * 직선으로 이으면 자로 그은 줄이 되어 늙은 가지로 읽히지 않는다.
 */
export function branchPath(): string {
	const c1x = WALL - RUN * 0.42;
	const c1y = BRANCH_WALL_Y - RUN * 0.03;
	return `M${WALL},${BRANCH_WALL_Y} C${c1x.toFixed(1)},${c1y.toFixed(1)} ${BEND_X.toFixed(1)},${BEND_Y.toFixed(1)} ${BRANCH_TIP_X},${BRANCH_TIP_Y}`;
}

/** 겹획 — 늙은 가지의 두 번째 붓길. 벽 쪽 절반만 따라가 무게를 준다. */
export function barkPath(): string {
	const c1x = WALL - RUN * 0.42;
	const c1y = BRANCH_WALL_Y - RUN * 0.03 + 3.2;
	const mx = WALL - RUN * 0.52;
	const my = BRANCH_WALL_Y - RUN * 0.115 + 3.4;
	return `M${WALL},${(BRANCH_WALL_Y + 3.4).toFixed(1)} Q${c1x.toFixed(1)},${c1y.toFixed(1)} ${mx.toFixed(1)},${my.toFixed(1)}`;
}

/** 원추꽃차례 — 가지에서 봉오리로 오르는 작은 꽃자루 둘. 벽과 무관하니 고정이다. */
export const PEDICELS = [
	`M${FX + 88},${FY + 75} Q${FX + 99},${FY + 36} ${FX + 82},${FY - 2}`,
	`M${FX + 92},${FY + 36} Q${FX + 80},${FY + 32} ${FX + 69},${FY + 26}`,
];

/** 원반 여섯 잎이 부챗살로 벌어지는 각. */
export const BLADE_DEGS = [-85, -52, -20, 12, 46, 80];

/** 갈라진 봉오리 구슬 둘 — [x, y, 배율]. */
export const BUDS: [number, number, number][] = [
	[FX + 82, FY - 6, 1],
	[FX + 68, FY + 22, 0.8],
];

/**
 * 크레이프 원반 — 원 윤곽을 무작위로 구긴 닫힌 물결. 배롱꽃의 종이 뭉치 질감이다.
 * `rand`를 12번 쓴다 — 부르는 자리가 바뀌면 뒤따르는 모든 난수가 밀린다.
 */
export function crepeBlade(rr: number, rand: () => number): string {
	const n = 12;
	const pts: [number, number][] = [];
	for (let k = 0; k < n; k += 1) {
		const a = (k / n) * 6.2832;
		const r = rr * (0.74 + rand() * 0.4) * (k % 2 ? 0.84 : 1.1);
		pts.push([Math.cos(a) * r, Math.sin(a) * r]);
	}
	const first = pts[0]!;
	const last = pts[n - 1]!;
	let d = `M${((last[0] + first[0]) / 2).toFixed(1)},${((last[1] + first[1]) / 2).toFixed(1)}`;
	for (let k = 0; k < n; k += 1) {
		const p = pts[k]!;
		const q = pts[(k + 1) % n]!;
		d += ` Q${p[0].toFixed(1)},${p[1].toFixed(1)} ${((p[0] + q[0]) / 2).toFixed(1)},${((p[1] + q[1]) / 2).toFixed(1)}`;
	}
	return `${d} Z`;
}

/** 꽃받침 잔 — 뿔 달린 종. 잎 밑동을 앞에서 감싸고 꼭지가 아래로 흐른다. */
export const CUP_BELL =
	'M-16,-4 C-17,8 -10,16 0,17 C10,16 17,8 16,-4 L11,-1 L5.5,-4 L0,-1 L-5.5,-4 L-11,-1 Z';
export const CUP_HORNS = 'M-16,-4 L-23,-12 M16,-4 L23,-12';
export const CUP_STEM = 'M0,17 Q7,24 18,30';

/** 봉오리 구슬의 갈라진 금. */
export const BUD_SPLIT = 'M-7.5,0 Q0,-3.4 7.5,0 M-5.2,-5.2 Q0,1.4 5.2,-5.2 M-5.2,5.2 Q0,1.8 5.2,5.2';

/** 떨어지는 꽃잎 한 장 — 배롱꽃 모양. */
export const PETAL = 'M0,-2.4 C-3.2,-2.8 -4.8,-5.2 -4.2,-7.8 Q-3.2,-9.4 -1.7,-8.6 Q-0.5,-10.2 0.7,-8.7 Q2.2,-9.8 3.2,-8.4 C4.6,-5.8 3.2,-3 0,-2.4 Z';

/** 한 번에 떠 있을 수 있는 꽃잎과 파문의 수. 못자리를 미리 파 두고 돌려 쓴다. */
export const PETAL_POOL = 8;
export const RIPPLE_POOL = 6;

/** 착수선 — 가깝고 먼 물. 꽃잎은 이 사이 어딘가에 닿는다. */
export const LAND_TOP = 524;
export const LAND_SPAN = 42;

/** 먹선 색을 그대로 쓴다 — 파도와 같은 붓이다. */
export function ink(alpha: number): string {
	return `rgba(${INK},${alpha})`;
}
