// @ts-check

import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { defineConfig, fontProviders } from 'astro/config';

// https://astro.build/config
export default defineConfig({
	site: 'https://ollybaysion.github.io',
	// /write는 글을 짓는 도구 화면이다 — 읽을 것이 없으니 사이트맵에 올리지 않는다.
	integrations: [mdx(), sitemap({ filter: (page) => !page.includes('/write') })],
	// 코드 블록 색을 무대 팔레트에 맞춘다 — 토큰 색은 stage.css의 --astro-code-* 가 정한다.
	markdown: { shikiConfig: { theme: 'css-variables' } },
	fonts: [
		{
			provider: fontProviders.local(),
			name: 'Atkinson',
			cssVariable: '--font-atkinson',
			fallbacks: ['sans-serif'],
			options: {
				variants: [
					{
						src: ['./src/assets/fonts/atkinson-regular.woff'],
						weight: 400,
						style: 'normal',
						display: 'swap',
					},
					{
						src: ['./src/assets/fonts/atkinson-bold.woff'],
						weight: 700,
						style: 'normal',
						display: 'swap',
					},
				],
			},
		},
	],
});
