# renoir.log

## Development

When starting the dev server, use background mode:

```bash
npm run dev -- --background
```

`npm run dev`로 띄워야 `predev`가 좌표 파이프라인을 먼저 돌린다. `astro dev`를 직접
부르면 파이프라인을 건너뛰어 새 글의 좌표와 파생 데이터가 없는 채로 뜬다.
Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## 좌표 파이프라인

빌드는 `좌표 배정 → 파생 데이터 생성 → astro build` 순서다(`prebuild`로 체인).

| 명령 | 하는 일 |
| --- | --- |
| `npm run coords` | 콘텐츠를 훑어 원장(`src/data/coordinates.json`)에 없는 슬러그만 배정한다 |
| `npm run coords:check` | 배정이 필요하면 에러로 죽는다. CI(`CI=true`)에서는 자동으로 이 모드다 |
| `npm run derived` | 원장 + 콘텐츠 → `src/data/generated/*.json` (커밋하지 않는다) |
| `npm test` | 좌표 엔진과 원장 계약 테스트 |

**원장은 append-only다.** 이미 박힌 좌표는 어떤 이유로도 다시 계산하지 않는다.
새 글을 쓰면 `src/data/coordinates.json` 변경분을 그 글 커밋에 함께 넣는다.

## Documentation

Full documentation: <https://docs.astro.build>

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
