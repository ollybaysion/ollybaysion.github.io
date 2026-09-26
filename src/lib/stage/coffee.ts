/**
 * 커피 레시피 카드의 규칙 — `/coffee` 목록과 카드 한 장(`RecipeCard.astro`)이 쓴다.
 *
 * 정본이 없는 화면이다. 머리는 다른 목록처럼 빛구멍 · 부제이고, 그 아래로 레시피 한 장이
 * 카드 한 장이다: 로스터리 · 날짜 → 원두 이름 → 숫자 칸(원두 · 물 · 비율 · 온도)
 * → 분쇄 → 붓기 막대(뜸부터 차례로) → 향미.
 *
 * 붓기 막대는 화면 안의 모든 카드가 **같은 자**를 쓴다 — 240g과 300g이 눈으로 비교되게.
 */

export interface Recipe {
	bean: string;
	roaster?: string | undefined;
	dose: number;
	grind?: string | undefined;
	temp?: number | undefined;
	pours: readonly number[];
	notes: readonly string[];
}

/** 머리 SVG의 높이 — 부제(144) 아래로 한 숨. */
export const COFFEE_HEAD_H = 176;

/** 자의 최소 길이 — 카드가 한 장뿐이어도 막대가 폭을 다 먹지 않게. */
const MIN_FULL_WATER = 300;

/** 총 물 g. 붓기를 안 적었으면 0. */
export function totalWater(recipe: Pick<Recipe, 'pours'>): number {
	return recipe.pours.reduce((sum, g) => sum + g, 0);
}

/** "1:15.5" — 물을 안 적었으면 null. */
export function brewRatio(recipe: Pick<Recipe, 'dose' | 'pours'>): string | null {
	const water = totalWater(recipe);
	if (water === 0) return null;
	return `1:${trim(water / recipe.dose)}`;
}

export interface SpecCell {
	label: string;
	value: string;
}

/** 숫자 칸 — 적은 것만, 원두 · 물 · 비율 · 온도 순. */
export function specCells(recipe: Recipe): SpecCell[] {
	const water = totalWater(recipe);
	const ratio = brewRatio(recipe);
	const cells: SpecCell[] = [{ label: '원두', value: `${trim(recipe.dose)}g` }];
	if (water > 0) cells.push({ label: '물', value: `${trim(water)}g` });
	if (ratio !== null) cells.push({ label: '비율', value: ratio });
	if (recipe.temp !== undefined) cells.push({ label: '온도', value: `${trim(recipe.temp)}℃` });
	return cells;
}

/** 화면 공통 자 — 가장 많이 부은 레시피가 폭을 다 쓰되, 300g보다 짧은 자는 쓰지 않는다. */
export function pourScale(recipes: readonly Pick<Recipe, 'pours'>[]): number {
	return Math.max(MIN_FULL_WATER, ...recipes.map(totalWater));
}

/** 붓기 막대 전체가 카드 폭에서 차지하는 몫(0~1). 토막끼리는 부은 물만큼 나눠 갖는다. */
export function pourTrack(recipe: Pick<Recipe, 'pours'>, fullWater: number): number {
	return Math.min(1, totalWater(recipe) / fullWater);
}

export function coffeeSubtitle(count: number): string {
	return `최근순 · ${count}장 · 원두 · 물 · 붓기`;
}

/** 소수 한 자리까지, 끝의 .0은 뗀다(15.5 → "15.5", 95 → "95"). */
function trim(value: number): string {
	return String(Math.round(value * 10) / 10);
}
