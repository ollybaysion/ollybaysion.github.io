import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { CATEGORY_NAMES } from './config/categories.ts';

const blog = defineCollection({
	// Load Markdown and MDX files in the `src/content/blog/` directory.
	loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
	// Type-check frontmatter using a schema
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			// Transform string to Date object
			date: z.coerce.date(),
			// 등록부에 없는 카테고리를 쓰면 빌드가 여기서 죽는다.
			// (새 카테고리는 src/config/categories.json에 호와 색을 먼저 등록할 것)
			category: z.enum(CATEGORY_NAMES),
			tags: z.array(z.string()).default([]),
			series: z.string().optional(),
			// 생략하면 시리즈 안에서 날짜순으로 매긴다.
			episode: z.number().int().positive().optional(),
			description: z.string().optional(),
			// 커피 글의 레시피 — `/coffee`가 이것만 모아 편다. 좌표는 제목·태그·소개·본문만
			// 보므로(`embedInput`) 여기 숫자는 점 자리에 들어가지 않는다.
			recipe: z
				.object({
					/** 원두 이름 — 목록 한 줄의 제목이 된다. */
					bean: z.string(),
					roaster: z.string().optional(),
					/** 원두 g. */
					dose: z.number().positive(),
					/** 그라인더와 단계를 한 줄로("코만단테 25클릭"). */
					grind: z.string().optional(),
					/** 물 ℃. */
					temp: z.number().positive().optional(),
					/** 붓는 물 g — 뜸부터 차례로. 합이 총 물이 된다. */
					pours: z.array(z.number().positive()).default([]),
					/** 향미 — 느낀 것만. */
					notes: z.array(z.string()).default([]),
				})
				.optional(),
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
		}),
});

export const collections = { blog };
