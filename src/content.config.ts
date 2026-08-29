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
			updatedDate: z.coerce.date().optional(),
			heroImage: z.optional(image()),
		}),
});

export const collections = { blog };
