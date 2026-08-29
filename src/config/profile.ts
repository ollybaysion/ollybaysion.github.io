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
	tagline: string;
	social: { github: string; instagram: string };
	alumni: CreditEntry[];
	certificates: CreditEntry[];
}

export const PROFILE = profile as Profile;
