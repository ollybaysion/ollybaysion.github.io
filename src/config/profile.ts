/**
 * 무대 좌측 열에 앉는 명함 — 이름, 포인트 문장, 아이콘 링크, ALUMNI·CERTIFICATES.
 *
 * 이름과 문장은 시안에서 확정됐고, 아이콘 URL과 ALUMNI·CERTIFICATES 줄은 사용자가 채운다.
 * 비어 있으면 그 부분은 아예 그려지지 않는다 — 자리표시자를 화면에 내보내지 않는다.
 */
import profile from './profile.json' with { type: 'json' };

export interface CreditEntry {
	/** 모노 폰트로 열 맞춰 서는 기간. 예: `2020–2023`. */
	years: string;
	/** 학교·회사와 하는 일, 또는 자격증 이름. */
	what: string;
}

export interface Profile {
	name: string;
	/**
	 * 이름 아래 한 줄 — 화면에만 나가는 제사(題詞).
	 *
	 * 두 토막인 건 크기가 달라서다. `lead`는 크게 세우는 낱말이고
	 * `gloss`는 그 옆에 작게 붙는 주석이다. 한 줄로 쓰면 제사가 부제로 읽힌다.
	 */
	tagline: { lead: string; gloss: string };
	/** 탭·검색 결과·RSS에 나가는 설명. 제사와 하는 일이 달라 따로 둔다. */
	description: string;
	social: { github: string; instagram: string };
	alumni: CreditEntry[];
	certificates: CreditEntry[];
}

export const PROFILE = profile as Profile;
