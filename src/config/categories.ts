/**
 * 카테고리 등록부.
 *
 * 각도 = 주제. 카테고리 하나가 부채꼴(호) 하나를 소유한다.
 *   - 커피  210~330° (무대 위쪽, 빛구멍 기준 y-up 방향)
 *   - 개발   30~150° (무대 아래쪽)
 *   - 빈 호 150~210° · 330~30° 는 새 카테고리 자리. 기존 호를 재분할하지 않는다.
 *
 * 색은 `Main.dc.html` 정본의 각도→색 보간에서 가져왔다.
 * base = 호 중심에서의 빔/점등 색(커피 270° = #d9a154, 개발 90° = #5b8def),
 * deep = 목록 화면 원 안 카테고리명에 쓰는 진한 색(`ListA.dc.html`의 #8f5a1e 계열).
 *
 * 미등록 카테고리를 frontmatter에 쓰면 빌드가 죽는다(`src/content.config.ts`).
 */
import type { Arc } from '../lib/coords/types.ts';
import registry from './categories.json' with { type: 'json' };

export interface CategoryColor {
	/** 호 중심 각도의 빛 색. 빔·점등·반사에 쓰는 기준색. */
	base: string;
	/** 목록 화면 원 안 카테고리명처럼 진하게 앉히는 색. */
	deep: string;
}

export interface CategoryDef {
	arc: Arc;
	color: CategoryColor;
}

const categories = registry as Record<string, CategoryDef>;

/** 등록된 카테고리 이름. zod `z.enum`에 그대로 넘길 수 있게 튜플로 좁힌다. */
export const CATEGORY_NAMES = Object.keys(categories) as [string, ...string[]];

export function isCategory(name: string): boolean {
	return Object.hasOwn(categories, name);
}

export function categoryOf(name: string): CategoryDef {
	const found = categories[name];
	if (!found) {
		throw new Error(
			`등록되지 않은 카테고리: "${name}". src/config/categories.json에 먼저 호와 색을 등록할 것 (등록된 카테고리: ${CATEGORY_NAMES.join(', ')})`,
		);
	}
	return found;
}

export function arcOf(name: string): Arc {
	return categoryOf(name).arc;
}

export function colorOf(name: string): CategoryColor {
	return categoryOf(name).color;
}

export { categories };
