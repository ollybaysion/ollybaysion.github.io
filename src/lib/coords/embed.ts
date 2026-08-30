/**
 * 모델에 넣을 글 한 편의 텍스트를 만든다. I/O 없는 순수 함수.
 *
 * 모델이 읽는 건 사람이 읽는 것과 같아야 한다 — 마크다운 문법(코드 울타리·링크
 * 주소·강조 기호)은 뜻이 없는데 벡터를 흔들기만 하므로 걷어낸다. 제목과 태그는
 * 본문 앞에 붙인다. 짧은 글에서 주제를 잡아 주는 게 결국 그 둘이다.
 */

/** 마크다운 → 사람이 읽는 줄글. `readingMinutes`와 같은 규칙에 링크 주소 제거를 더했다. */
export function plainText(markdown: string): string {
	return markdown
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`([^`]*)`/g, '$1')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/<[^>]+>/g, ' ')
		.replace(/^\s{0,3}[#>]+\s*/gm, '')
		.replace(/^\s{0,3}([-*+]|\d+\.)\s+/gm, '')
		.replace(/[*_~|]/g, '')
		.replace(/[ \t]+/g, ' ')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/** 임베딩할 글. `readPosts`가 주는 모양의 일부다. */
export interface EmbedSource {
	title: string;
	tags: readonly string[];
	description?: string | undefined;
	body: string;
}

/**
 * 모델에 넣는 최종 문자열. 이 함수가 바뀌면 같은 글이 다른 벡터가 된다 =
 * `EMBED_VERSION`을 올려야 하는 일이다.
 */
export function embedInput(post: EmbedSource): string {
	const head = [post.title, post.tags.join(', '), post.description ?? '']
		.map((line) => line.trim())
		.filter((line) => line !== '');
	return [...head, plainText(post.body)].join('\n\n').trim();
}
