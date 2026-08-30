# renoir.log

## Development

When starting the dev server, use background mode:

```bash
npm run dev -- --background
```

`npm run dev`로 띄워야 `predev`가 좌표 파이프라인을 먼저 돌린다. `astro dev`를 직접
부르면 파이프라인을 건너뛰어 새 글의 좌표와 파생 데이터가 없는 채로 뜬다.
Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## 새 글

```bash
npm run new "예가체페를 처음 만난 날"
npm run new "탬핑을 다시 배웠다" -- -c 커피 -t 에스프레소,탬핑
```

`src/content/blog/{날짜-제목}.md`를 만든다. 옵션은 `-c` 카테고리 · `-t` 태그 ·
`-s` 시리즈 · `--episode` · `--date` · `-d` 소개(npm이 먹지 않게 `--`를 앞에 둘 것).

**카테고리는 좌표가 박히기 전에 정한다.** 각도가 카테고리 호와 글 유사도에서 나오는데,
좌표는 첫 `npm run dev`·`npm run build` 때 박히고 다시 계산되지 않는다. **글도 그때
완성돼 있어야 한다** — 유사도를 글 전체 임베딩으로 재기 때문이다(태그만 보던 v1과 다르다).

## 좌표 파이프라인

빌드는 `임베딩 → 좌표 배정 → 파생 데이터 생성 → astro build` 순서다(`prebuild`로 체인).

| 명령 | 하는 일 |
| --- | --- |
| `npm run new "제목"` | 날짜·frontmatter가 채워진 초안 한 장. 좌표는 안 매긴다 |
| `npm run embed` | 벡터 원장(`src/data/vectors.json`)에 없는 슬러그만 임베딩한다 |
| `npm run embed:check` | 임베딩이 필요하면 에러로 죽는다. CI(`CI=true`)에서는 자동으로 이 모드다 |
| `npm run coords` | 콘텐츠를 훑어 원장(`src/data/coordinates.json`)에 없는 슬러그만 배정한다 |
| `npm run coords:check` | 배정이 필요하면 에러로 죽는다. CI에서는 자동으로 이 모드다 |
| `npm run derived` | 원장 + 콘텐츠 → `src/data/generated/*.json` (커밋하지 않는다) |
| `npm test` | 좌표 엔진 · 원장 · "가까우면 닮았다" 계약 테스트 |

**원장 둘 다 append-only다.** 이미 박힌 좌표와 벡터는 어떤 이유로도 다시 계산하지 않는다.
새 글을 쓰면 `src/data/coordinates.json`과 `src/data/vectors.json` 변경분을 그 글 커밋에
함께 넣는다. 글을 고쳐서 벡터를 뜬 뒤와 내용이 달라지면 경고만 뜨고 벡터는 그대로 둔다.

## 임베딩

유사도 v2는 `Xenova/bge-m3`(cls·q8) 코사인이다. 모델은 선택 의존성이라 따로 받는다:

```bash
npm i --include=optional   # 처음 한 번. 모델 자체는 npm run embed이 내려받는다(수백 MB)
```

벡터가 커밋되어 오므로 **배포는 모델 없이 돈다**(`deploy.yml`이 `NPM_CONFIG_OMIT: optional`).
CI에서 도는 `embed:check`도 모델을 부르지 않는다 — 빠진 벡터가 있는지만 본다.

원시 코사인은 0에서 시작하지 않는다(상관없는 한국어 산문끼리 0.3~0.43). 그래서
`VECTOR_FLOOR`/`VECTOR_CEIL`로 [0,1]에 다시 편다. **두 값과 모델은 측정해서 고른 것이다** —
근거는 `src/lib/coords/constants.ts` 주석에, 계약은 `test/coords/vector.test.ts`에 있다.
바꾸려면 `EMBED_VERSION`을 올리고 벡터를 전량 다시 떠야 한다.

## Documentation

Full documentation: <https://docs.astro.build>

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
