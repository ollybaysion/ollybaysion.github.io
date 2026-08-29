/**
 * 사이트 전역 문구 — 브라우저 탭·RSS·검색 결과에 나가는 이름.
 *
 * 이름은 화면 좌측 명함과 **같은 값**을 쓴다 — 탭에 적힌 이름과 화면에 적힌 이름이
 * 다르면 안 되니 출처는 `profile.json` 하나로 둔다. 설명은 명함의 제사(tagline)가
 * 아니라 따로 둔 `description`이다. 제사는 읽는 맛이고, 설명은 검색 결과에 나가는 글이라
 * 하는 일이 다르다.
 */
import { PROFILE } from './config/profile.ts';

export const SITE_TITLE = PROFILE.name;
export const SITE_DESCRIPTION = PROFILE.description;
