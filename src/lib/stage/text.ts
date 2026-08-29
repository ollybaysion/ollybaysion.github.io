/**
 * 글자 폭 어림.
 *
 * SVG `<text>`는 줄을 바꿔주지 않는다. 어디서 자를지 우리가 정해야 하는데
 * 빌드 시점엔 브라우저 폰트 메트릭이 없으니 문자 종류별 배율로 어림한다.
 * 한글·가나·한자는 정폭(1em)에 가깝고 라틴·숫자는 절반쯤이다.
 *
 * 어림이라 픽셀 단위로 맞지 않는다 — 넘치지 않을 만큼만 보수적으로 잡는 용도다.
 */

const WIDE =
	/[ᄀ-ᇿ⺀-〿぀-ヿ㄰-㆏一-鿿가-힯！-｠]/;
const NARROW = /[ .,:;!?'"()[\]{}·…|/\\\-–—]/;
const DIGIT = /[0-9]/;
const UPPER = /[A-Z]/;

/** 글자 하나의 폭(em). */
export function charRatio(ch: string): number {
	if (WIDE.test(ch)) return 1;
	if (NARROW.test(ch)) return 0.3;
	if (DIGIT.test(ch)) return 0.55;
	if (UPPER.test(ch)) return 0.62;
	return 0.52;
}

export function textWidth(text: string, size: number): number {
	let sum = 0;
	for (const ch of text) sum += charRatio(ch);
	return sum * size;
}

/** 폭에 맞게 뒤를 잘라내고 …을 붙인다. 애초에 들어가면 그대로 돌려준다. */
export function truncateText(text: string, size: number, maxWidth: number): string {
	if (textWidth(text, size) <= maxWidth) return text;

	const chars = [...text];
	const room = maxWidth - textWidth('…', size);
	let width = 0;
	let kept = 0;
	while (kept < chars.length) {
		const next = width + charRatio(chars[kept]!) * size;
		if (next > room) break;
		width = next;
		kept += 1;
	}
	return `${chars.slice(0, kept).join('').trimEnd()}…`;
}

/**
 * 폭에 맞춰 줄을 나눈다. 띄어쓰기에서 끊고, 한 낱말이 통째로 넘치면 글자 단위로 끊는다.
 * 줄 수를 넘기면 마지막 줄을 …으로 마감한다.
 */
export function wrapText(
	text: string,
	size: number,
	maxWidth: number,
	maxLines: number,
): string[] {
	const words = text.trim().split(/\s+/).filter(Boolean);
	if (words.length === 0) return [];

	const lines: string[] = [];
	let line = '';

	const push = () => {
		if (line !== '') lines.push(line);
		line = '';
	};

	for (const word of words) {
		const candidate = line === '' ? word : `${line} ${word}`;
		if (textWidth(candidate, size) <= maxWidth) {
			line = candidate;
			continue;
		}
		push();
		// 낱말 하나가 한 줄보다 길면 (긴 URL·붙여쓴 제목) 글자 단위로 쪼갠다.
		let rest = word;
		while (textWidth(rest, size) > maxWidth) {
			const chars = [...rest];
			let width = 0;
			let kept = 0;
			while (kept < chars.length) {
				const next = width + charRatio(chars[kept]!) * size;
				if (next > maxWidth) break;
				width = next;
				kept += 1;
			}
			if (kept === 0) kept = 1;
			lines.push(chars.slice(0, kept).join(''));
			rest = chars.slice(kept).join('');
		}
		line = rest;
	}
	push();

	if (lines.length <= maxLines) return lines;
	const kept = lines.slice(0, maxLines);
	const overflow = lines.slice(maxLines - 1).join(' ');
	kept[maxLines - 1] = truncateText(overflow, size, maxWidth);
	return kept;
}
