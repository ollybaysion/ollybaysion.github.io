/**
 * 감나무 — 오른쪽 하늘의 초상.
 *
 * 가을 시안(「가을 네 폭」)의 감나무 판을 무대로 옮긴 것이다. 벽에서 두 번 꺾이며 드는
 * 늙은 가지와 겹획·태점, 꺾이며 가늘어지는 잔가지 셋, 거의 다 지고 남은 잎 셋, 그리고
 * 가지 아래 추처럼 매달린 감 한 알 — 잎 진 가지 끝에 새의 몫으로 남겨 두는 까치밥이다.
 * 떨어지는 것은 꽃잎이 아니라 잎이다.
 *
 * 파일 이름이 `flower`인 것은 이 자리가 제철 초상의 자리이기 때문이다. 8월에는 배롱나무가
 * 앉았다. 달이 바뀌면 여기 기하만 갈아 끼운다.
 *
 * 여기에는 **자리와 모양만** 있다. DOM으로 세우고 흔드는 일은 `flower-scene.ts`가 한다.
 * 나뉜 이유는 난수 때문이다 — 태점의 크기와 마디의 흔들림 위상은 시드 하나가 정하고,
 * 그 소비 순서가 곧 그루의 생김새다. 순서를 지켜야 하는 코드를 한곳에 모아 두면 손대다 어긋난다.
 */
import { CENTER, LIGHT_HOLE_RADIUS } from '../coords/constants.ts';
import { INK } from './palette.ts';

/** 초상의 가운데 열 — 감이 매달린 x. 표찰이 이 x에 가운데 맞춰 감 아래 선다. */
export const FX = 601;
/**
 * 가지가 나오는 벽.
 *
 * 정본 폭(700) 바로 밖이다. 화면이 넓어져도 가지를 늘이지 않고 이 점을 화면 끝에 대
 * **그루째 오른쪽으로 옮긴다** — 벽이 곧 화면 끝이라 가지는 늘 화면 밖에서 들어오고,
 * 감은 어느 폭에서든 오른쪽 끝에서 같은 거리에 매달린다.
 */
export const WALL = 706;
/** 벽을 화면 끝에서 이만큼 더 밖에 둔다 — 가지의 잘린 끝이 화면에 보이지 않게. */
export const WALL_GAP = 6;

/**
 * 그루가 차지하는 하늘 — 가장 왼쪽 잎 끝(466), 가장 높은 잎(158), 감의 밑(306).
 * 오른쪽은 늘 벽 너머라 재지 않는다. 그루가 설 자리가 있는지 재는 자다.
 */
export const CROWN = { left: 466, top: 158, bottom: 306 } as const;
/** 그루와 빛구멍·화면 끝 사이에 두는 한 뼘. */
const SKY_GAP = 12;

/** 그루가 옮겨 앉는 자리. 이름표도 같은 값으로 따라 옮긴다. */
export interface TreePlace {
	dx: number;
	dy: number;
}

/**
 * 화면이 `right`에서 끝나고 `top`에서 시작할 때 그루가 옮겨 앉는 자리.
 *
 * 가로는 늘 벽을 화면 끝에 댄다 — 넓은 화면에서는 오른쪽으로 밀고, 잘라 확대한 좁은
 * 무대에서는 왼쪽으로 당긴다. 어느 폭에서든 감은 오른쪽 끝에서 같은 거리다.
 *
 * 세로는 좁은 무대에서만 움직인다. 폭이 좁아져 빛구멍(지름 190) 옆에 그루가 설 자리가
 * 없으면 물러나는 대신 **빛구멍 위 하늘로 올라간다**. 가지는 그대로 화면 밖 벽에서
 * 들어오고, 폰에서도 무대에 감이 달린다.
 */
export function treePlace(right: number, top: number): TreePlace {
	const dx = right + WALL_GAP - WALL;
	// 빛구멍 오른쪽에 그루가 통째로 들어가면 정본 그대로다(넓은 화면).
	if (CROWN.left + dx >= CENTER.x + LIGHT_HOLE_RADIUS + SKY_GAP) return { dx, dy: 0 };
	// 빛구멍 정수리 위로 올린다 — 다만 그루가 화면 위로 넘어가지 않는 선까지만.
	const over = CENTER.y - LIGHT_HOLE_RADIUS - SKY_GAP - CROWN.bottom;
	const ceiling = top + SKY_GAP - CROWN.top;
	return { dx, dy: Math.min(0, Math.max(over, ceiling)) };
}

/**
 * 시드 82 — 가을 네 폭 시안에서 감나무 판이 받은 수(31 + 3×17).
 * 태점의 크기도 마디의 흔들림 위상도 이 수가 정한다. 바꾸면 다른 그루가 된다.
 */
export const SEED = 82;

/** 바람을 받는 정도 — 늙은 가지는 무겁다. 배롱(1.0)보다 덜 휜다. */
export const SWAY = 0.6;

/** 벽에 박힌 뿌리 마디. 그루 전체가 이 점을 축으로 흔들린다. */
export const WALL_Y = 262;
/** 가지가 꺾이는 마디 — 여기서부터 바깥 가지가 따로 휜다. */
export const ELBOW = { x: 628, y: 247 } as const;

/** 밑가지 — 벽에서 꺾이는 마디까지. 굵은 붓길과 반 뼘 아래의 겹획. */
export const TRUNK = 'M706,262 C680,259 652,250 628,247';
export const TRUNK_BARK = 'M706,265 C682,262 656,253 634,250';
/** 바깥 가지 — 한 번 더 꺾이며 왼쪽 위로 가늘어진다. */
export const LIMB = 'M628,247 C608,246 594,236 574,226 C558,218 542,216 528,207';
export const LIMB_BARK = 'M626,250 C606,248 590,238 572,229';

/** 태점(苔點) — 늙은 가지의 이끼 점. 밑가지 셋, 바깥 가지 셋. */
export const MOSS_TRUNK: [number, number][] = [
	[688, 258],
	[664, 252],
	[640, 246],
];
export const MOSS_LIMB: [number, number][] = [
	[606, 243],
	[584, 229],
	[548, 214],
];

/**
 * 잔가지 — 마디(x, y)에서 갈라지고, `w`만큼 바람에 더 휜다. `onLimb`면 바깥 가지에 붙는다.
 * `ord`는 붓이 닿는 차례다 — 밑가지(0) → 바깥 가지(1) → 잔가지(2~).
 */
export interface Twig {
	x: number;
	y: number;
	w: number;
	wf: number;
	d: string;
	lw: number;
	op: number;
	onLimb: boolean;
	ord: number;
}
export const TWIGS: Twig[] = [
	{ x: 574, y: 226, w: 0.6, wf: 0.1, d: 'M574,226 Q568,206 556,194 Q549,186 547,170', lw: 1.6, op: 0.74, onLimb: true, ord: 2 },
	{ x: 528, y: 207, w: 0.7, wf: 0.15, d: 'M528,207 Q516,202 508,192 Q502,185 494,182', lw: 1.3, op: 0.72, onLimb: true, ord: 2.4 },
	{ x: 640, y: 248, w: 0.5, wf: 0.2, d: 'M640,248 Q646,228 642,214 Q640,206 646,198', lw: 1.2, op: 0.7, onLimb: false, ord: 2 },
];

/**
 * 남은 잎 셋 — 밑동(x, y)에서 `deg` 쪽으로 길이 `len`, 반폭 `half`.
 * `twig`는 달린 잔가지(없으면 밑가지), `curl`<1이면 말라 오그라든 잎이다. `ord`는 펴지는 차례.
 */
export interface Leaf {
	x: number;
	y: number;
	deg: number;
	len: number;
	half: number;
	twig: number | null;
	curl: number;
	ord: number;
}
export const LEAVES: Leaf[] = [
	{ x: 668, y: 255, deg: 204, len: 40, half: 15, twig: null, curl: 1, ord: 3 },
	{ x: 494, y: 182, deg: -58, len: 30, half: 11, twig: 1, curl: 1, ord: 4 },
	{ x: 646, y: 198, deg: 18, len: 24, half: 10, twig: 2, curl: 0.55, ord: 4 },
];

/** 잎 윤곽 — 달걀꼴. 원점이 잎자루, 잎끝은 −y 방향이다. */
export function leafPath(len: number, half: number): string {
	const f = (v: number) => v.toFixed(1);
	return `M0,0 C${-half},${f(-len * 0.18)} ${f(-half * 1.05)},${f(-len * 0.72)} 0,${-len} C${f(half * 1.05)},${f(-len * 0.72)} ${half},${f(-len * 0.18)} 0,0 Z`;
}

/** 잎맥 — 주맥 하나와 곁맥 다섯 쌍. 곁맥 끝은 잎 가장자리 안쪽에서 멎는다. */
export function leafVeins(len: number, half: number): string {
	const f = (v: number) => v.toFixed(1);
	let d = `M0,-2 L0,${f(-len + 3)}`;
	for (let i = 1; i <= 5; i += 1) {
		const t = i / 6.5;
		const y = -len * t;
		const end = y - len * 0.12;
		const reach = half * 0.6 * Math.sin(Math.PI * Math.min(0.95, t + 0.12));
		d += ` M0,${f(y)} Q${f(reach * 0.5)},${f(y - len * 0.05)} ${f(reach)},${f(end)}`;
		d += ` M0,${f(y)} Q${f(-reach * 0.5)},${f(y - len * 0.05)} ${f(-reach)},${f(end)}`;
	}
	return d;
}

/** 잎이 떨어져 나오는 자리 — 잎 길이의 6할쯤, 잎몸 한가운데. */
export function leafDrop(leaf: Leaf): { x: number; y: number } {
	const a = ((leaf.deg - 90) * Math.PI) / 180;
	return { x: leaf.x + leaf.len * 0.6 * Math.cos(a), y: leaf.y + leaf.len * 0.6 * Math.sin(a) };
}

/** 감꼭지가 가지에 붙은 자리 — 감은 이 점을 축으로 추처럼 흔들린다. */
export const STALK = { x: 600, y: 241 } as const;
export const STALK_PATH = 'M600,241 Q603,247 601,252';
/** 감의 가운데 — 초상의 가운데 열(`FX`) 그대로다. */
export const FRUIT_X = FX;
export const FRUIT_Y = 279;
/** 감 — 어깨가 네모진 단감. 원점이 감의 가운데다. */
export const FRUIT = 'M0,-25 C14,-26 30,-20 31,-3 C32,14 18,26 0,26 C-18,26 -32,14 -31,-3 C-30,-20 -14,-26 0,-25 Z';
/** 감빛 — 꽃밥의 금을 반쯤 비친 것. 무대에서 빛구멍 말고 금이 차는 것은 이 한 알뿐이다. */
export const FRUIT_FILL = 'rgba(217,161,84,0.52)';
/** 단감의 골 두 줄. */
export const FRUIT_GROOVES = 'M-12,-22 Q-19,0 -11,23 M12,-22 Q19,0 11,23';
/** 윤기 한 획. */
export const FRUIT_GLOSS = 'M-20,-10 Q-22,-2 -19,6';
/** 꽃받침 — 넓은 네 조각이 어깨에 엎드린다. 옆 둘과 앞 하나가 보인다. */
export const CALYX =
	'M0,-26 C-6,-29 -15,-29 -20,-24 C-14,-21 -6,-22 0,-24 C6,-22 14,-21 20,-24 C15,-29 6,-29 0,-26 Z M0,-25 C-4,-22 -4,-17 0,-15 C4,-17 4,-22 0,-25 Z';

/** 떨어지는 잎 한 장 — 남은 잎과 같은 달걀꼴, 주맥 한 줄. */
export const FALL_LEAF = 'M0,0 C-5.4,-2.4 -6.2,-11.6 0,-16 C6.2,-11.6 5.4,-2.4 0,0 Z M0,-1 L0,-14.6';
/**
 * 지는 잎의 성질 — `rate`는 초당 빈도의 바탕, `sink`는 꽃잎보다 느리게 가라앉는 정도,
 * `drift`는 바람에 더 밀리는 정도다. 넓은 잎은 꽃잎보다 바람을 많이 받고 천천히 내린다.
 */
export const FALL = { rate: 0.45, sink: 0.7, drift: 1.2, scale: 1.3 } as const;

/** 한 번에 떠 있을 수 있는 잎과 파문의 수. 못자리를 미리 파 두고 돌려 쓴다. */
export const LEAF_POOL = 8;
export const RIPPLE_POOL = 6;

/** 착수선 — 가깝고 먼 물. 잎은 이 사이 어딘가에 닿는다. */
export const LAND_TOP = 524;
export const LAND_SPAN = 42;

/** 먹선 색을 그대로 쓴다 — 파도와 같은 붓이다. */
export function ink(alpha: number): string {
	return `rgba(${INK},${alpha})`;
}
