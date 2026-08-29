/**
 * 무대 좌측 열에 앉는 명함 — 이름, 포인트 문장, 아이콘 링크, ALUMNI.
 *
 * 이름과 문장은 시안에서 확정됐고, 아이콘 URL과 ALUMNI 줄은 사용자가 채울 자리다.
 * 비어 있으면 그 부분은 아예 그려지지 않는다 — 자리표시자를 화면에 내보내지 않는다.
 */
import profile from './profile.json' with { type: 'json' };

export interface AlumniEntry {
	/** 모노 폰트로 열 맞춰 서는 기간. 예: `2020–2023`. */
	years: string;
	/** 학교·회사와 하는 일. */
	what: string;
	/**
	 * 이 줄이 무대의 어느 호에 속하나 — 연도 옆 점 색이 여기서 나온다.
	 * 등록부에 없는 이름을 쓰면 빌드가 죽는다(`src/config/categories.json`).
	 * 생략하면 점 없이 회색 한 줄로만 앉는다.
	 */
	category?: string;
}

export interface Profile {
	name: string;
	tagline: string;
	social: { github: string; instagram: string };
	alumni: AlumniEntry[];
}

export const PROFILE = profile as Profile;
