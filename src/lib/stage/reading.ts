/**
 * 읽는 시간 — 목록·시리즈 행 오른쪽 끝에 앉는 "N분".
 *
 * 정본(`ListA.dc.html` · `SeriesList.dc.html`)엔 숫자만 있고 규칙이 없어서 여기서 정한다.
 * 한글 산문 기준 분당 500자, 최소 1분. 마크다운 문법과 코드 블록은 세지 않는다.
 */
export const CHARS_PER_MINUTE = 500;

export function readingMinutes(body: string): number {
	const text = body
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/`[^`]*`/g, ' ')
		.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/^\s{0,3}[#>]+\s*/gm, ' ')
		.replace(/[*_~|]/g, '')
		.replace(/\s+/g, '');
	return Math.max(1, Math.round(text.length / CHARS_PER_MINUTE));
}
