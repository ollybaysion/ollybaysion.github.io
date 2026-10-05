/**
 * 시리즈 등록부.
 *
 * 시리즈는 글의 frontmatter(`series:`)가 만든다. 등록부는 이름만 먼저 잡아 둔다 —
 * 글이 한 편도 없는 시리즈는 무대 점도 `/series/…/` 길도 없다. 1화가 들어오면 그때 선다.
 *
 * 미등록 시리즈를 frontmatter에 쓰면 빌드가 죽는다(`src/content.config.ts`) —
 * 이름 한 글자가 틀려 시리즈가 둘로 갈라지는 것을 막는다.
 */
import registry from './series.json' with { type: 'json' };

/** 등록된 시리즈 이름. zod `z.enum`에 그대로 넘길 수 있게 튜플로 좁힌다. */
export const SERIES_NAMES = registry as [string, ...string[]];
