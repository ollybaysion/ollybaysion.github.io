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
	 * `lead`는 낱말, `gloss`는 그 옆에 붙는 어원(한자·원어)이다. 둘은 같은 크기 같은 색으로
	 * 한 줄에 서고, 좁은 화면에서는 `gloss`가 물러난다.
	 *
	 * `note`는 그 낱말이 무슨 말인지 풀어 쓴 글, `source`는 그 글의 출처다. 제사에 손을
	 * 올렸을 때만 아래에 나타난다 — 늘 떠 있으면 이름 아래가 문단이 된다. 화면에서
	 * 폭에 맞춰 줄이 나뉘니 줄바꿈을 넣지 말고 한 문장으로 쓴다.
	 */
	tagline: { lead: string; gloss: string; note: string; source: string };
	/** 탭·검색 결과·RSS에 나가는 설명. 제사와 하는 일이 달라 따로 둔다. */
	description: string;
	social: { github: string; instagram: string };
	alumni: CreditEntry[];
	certificates: CreditEntry[];
}

export const PROFILE = profile as Profile;
