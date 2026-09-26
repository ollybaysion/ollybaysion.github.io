---
title: "Claude Code에 질문 하나를 던지면 실제로 벌어지는 일"
date: 2026-09-26
category: 개발
tags: ["Claude Code", "프롬프트캐시", "llm", "토큰"]
description: "질문할 때마다 그동안의 대화가 통째로 서버로 간다. 요청 하나의 구조부터 프롬프트 캐싱의 조건·TTL·무효화까지, 토큰 비용이 어디서 오는지 해부한다."
---

<!-- markdownlint-disable MD033 -->
<!-- 이 글은 본문이 HTML이다. this-is-claude-code 문서 docs/anatomy-of-a-question.html 을 옮긴 것 — 스타일은 public/cc-doc/ 에 있고, 여기엔 마크업만 둔다. -->

<link rel="stylesheet" href="/cc-doc/anatomy-of-a-question.css">
<div id="cc-doc" class="cc-doc">
<p class="standfirst">
    <strong>프롬프트 캐싱이 왜 필요할까?</strong><br>
    클로드 코드에서 매번 질문을 할 때마다 <strong>그동안의 대화 내역이 모두 서버로 간다.</strong><br>
    대부분의 토큰 비용은 바로 여기서 온다. 프롬프트 캐싱이 무엇인지 살펴본다.
  </p>
<p class="topics">
    <b>다루는 것</b> — 요청 하나의 구조 · 왜 캐싱인가 · 배수와 손익분기 ·
    TTL과 웜/콜드 · 캐시가 깨지는 조건
  </p>
<div class="credits">
  <span>작성 · 2026-08-09</span>
</div>
      <div class="say me lead">
        <span class="say-who">시작</span>
        <div class="bubble">“이 에러 왜 나는지 찾아줘”</div>
        <p class="say-note">화면에 친 것 <b>14자</b> · 서버로 간 것 <b>그때까지의 대화 전부</b><br>
          실측한 세션에서는 가장 큰 요청 하나가 <b>59만 토큰</b>까지 갔다 — 03절에서 확인한다</p>
      </div>
      <section id="s1">
        <div class="sec-head"><span class="num">01</span><h2>한 요청의 구조 — 무엇이 오가는가</h2></div>
        <p class="lede">
          방금 그 질문에서 <strong>"이 에러"가 무엇인지는 문장 어디에도 없다</strong> — 앞선 대화에 있다.
          그런데 <strong>API는 대화를 기억하지 않는다.</strong>
          그 맥락을 전달하기 위해서는 <strong>1턴부터 모든 것을 다시 보내는 수밖에 없다.</strong>
        </p>
        <div class="figure">
          <svg class="chart" viewBox="0 0 660 118" role="img"
               aria-label="요청 1의 구조. tools, system, messages에 이번 입력인 첫 질문 1이 붙어 요청 1이 된다.">
            <text class="blabel" x="599.7" y="22" text-anchor="end">이번 입력 ① — “이 에러 왜 나는지 찾아줘”</text>
            <line class="leader" x1="592.7" y1="28" x2="592.7" y2="50"/>
            <text class="blabel" x="112.3" y="44" text-anchor="middle">tools</text>
            <text class="blabel" x="164.9" y="44" text-anchor="middle">system</text>
            <text class="blabel" x="390.5" y="44" text-anchor="middle">messages — 지금까지의 대화 전부</text>
            <text class="dlabel big" x="30" y="84">요청 1</text>
            <rect class="band-a" x="92" y="52" width="40.5" height="52" rx="3"/>
            <rect class="band-a" x="134.5" y="52" width="60.8" height="52" rx="3"/>
            <rect class="band-b" x="197.3" y="52" width="386.4" height="52" rx="3"/>
            <rect class="band-c" x="585.7" y="52" width="14" height="52" rx="3"/>
            <text class="onfill" x="592.7" y="82" text-anchor="middle">1</text>
          </svg>
        </div>
        <h3>모델의 답변 과정</h3>
        <p>
          요청 1을 받은 모델은 곧장 답하지 않는다. <strong>답변을 위해 어떤 사고 과정을 거쳐야 하는지
          추론하고 행동한다(ReAct).</strong> 에러 로그를 분석하고, 그 에러가 발생한 위치의 코드를
          파일시스템에서 찾고, 실제 코드를 읽어 에러가 난 원인을 분석한다.
          <strong>모든 추론 과정은 Context로 남아 그 다음 API 호출에 다시 누적된다.</strong>
        </p>
        <div class="figure">
          <svg class="chart" viewBox="0 0 660 214" role="img"
               aria-label="실측한 한 턴의 세 스텝. 스텝마다 앞에 회색 프리픽스가 다시 붙고, 그 뒤에 이번에 새로 들어가는 것만 추가된다. 스텝 1은 사용자 질문 235토큰, 스텝 2는 추론 과정 2747토큰과 rg 출력 427토큰, 스텝 3은 추론 과정 125토큰과 파일 50줄 916토큰이다. 회색은 스텝이 갈수록 길어진다.">
            <rect class="band-b" x="98" y="8" width="11" height="11" rx="2"/>
            <text class="blabel" x="115" y="18">질문</text>
            <rect class="band-b g" x="152" y="8" width="11" height="11" rx="2"/>
            <text class="blabel" x="169" y="18">추론 과정</text>
            <rect class="band-c g" x="248" y="8" width="11" height="11" rx="2"/>
            <text class="blabel" x="265" y="18">도구 결과 — 파일 내용 · 명령 출력</text>
            <text class="dlabel big" x="30" y="50">스텝 1</text>
            <rect class="band-a" x="98" y="32" width="230" height="26" rx="3"/>
            <text class="blabel" x="213" y="50" text-anchor="middle">tools + system + 대화 전부</text>
            <rect class="band-b" x="330" y="32" width="14.1" height="26" rx="3"/>
            <text class="blabel" x="352" y="50">사용자가 친 질문 130자 = 235토큰</text>
            <text class="blabel" x="98" y="78">↓ 모델이 <tspan class="em">Bash</tspan> 실행 — rg -n "findUser" src/main/java → 출력 928바이트 = <tspan class="em">427토큰</tspan></text>
            <text class="dlabel big" x="30" y="106">스텝 2</text>
            <rect class="band-a" x="98" y="88" width="246.1" height="26" rx="3"/>
            <rect class="band-b g" x="346.1" y="88" width="164.8" height="26" rx="3"/>
            <text class="onband" x="428.5" y="106" text-anchor="middle">2,747</text>
            <rect class="band-c g" x="512.9" y="88" width="25.6" height="26" rx="3"/>
            <text class="onfill" x="525.7" y="106" text-anchor="middle">427</text>
            <text class="blabel" x="98" y="134">↓ 모델이 <tspan class="em">Read</tspan> 실행 — OrderService.java 20–69줄 → 2,326바이트 = <tspan class="em">916토큰</tspan></text>
            <text class="dlabel big" x="30" y="162">스텝 3</text>
            <rect class="band-a" x="98" y="144" width="440.5" height="26" rx="3"/>
            <rect class="band-b g" x="540.5" y="144" width="7.5" height="26" rx="3"/>
            <rect class="band-c g" x="550" y="144" width="55" height="26" rx="3"/>
            <text class="onfill" x="577.5" y="162" text-anchor="middle">916</text>
            <line class="leader" x1="544.2" y1="172" x2="544.2" y2="182"/>
            <text class="blabel" x="98" y="190">↓ 답변 1,938토큰 — 턴 끝</text>
            <text class="blabel" x="544.2" y="190" text-anchor="middle">↑ 추론 과정 125</text>
            <text class="blabel" x="98" y="208">붙은 도구 결과 <tspan class="em">427 + 916 = 1,343토큰</tspan>은 이후 <tspan class="em">모든</tspan> 스텝의 프리픽스에 그대로 남는다</text>
          </svg>
          <p class="caption">파일명·명령은 NPE 예시 이야기에 맞춘 각색이다</p>
        </div>
        <p>
          숫자 두 개만 보면 된다. 사용자가 만든 토큰은 <strong>235</strong>,
          모델과 도구가 만든 토큰은 <strong>6,382</strong>이다
          — 추론 2,747 + 427 + 125 + 916 + 답변 1,938에 메시지 구조가 더해진 실측값이다.
          스물일곱 배다.
          그리고 235는 한 번 실렸지만 6,382는 <strong>이 세션이 끝날 때까지 매 요청에</strong> 실린다.
        </p>
        <p>이 왕복이 끝나야 비로소 답변이 나온다.</p>
        <div class="say">
          <span class="say-who">모델 답변</span>
          <div class="bubble">“<span class="k">findUser()</span>가 못 찾으면 <span class="k">null</span>을 돌려주는데,
            <span class="k">OrderService:42</span>에 널 체크가 없어서 NPE가 납니다”</div>
          <p class="say-note">화면에 뜬 답변은 <b>1,938토큰</b>. 그런데 다음 요청에 다시 실리는 건
            이것만이 아니다 — 도구 호출과 그 결과까지 이 턴이 대화에 더한 것은 <b>6,382토큰</b>이다.</p>
        </div>
        <div class="figure">
          <svg class="chart" viewBox="0 0 660 96" role="img"
               aria-label="이 턴이 대화에 더한 것은 6382토큰이고, 그중 화면에 뜬 답변은 1938토큰이다. 나머지는 도구 호출과 그 결과다.">
            <text class="blabel" x="360" y="26" text-anchor="middle">이 턴이 messages에 더한 것 — 다음 요청부터 이만큼이 더 실린다</text>
            <text class="dlabel big" x="30" y="66">이 턴 ⓐ</text>
            <line class="grid" x1="92" y1="60" x2="559.7" y2="60"/>
            <rect class="band-b" x="561.7" y="46" width="50" height="28" rx="3"/>
            <text class="blabel" x="557" y="86" text-anchor="end">6,382토큰 — 그중 화면에 뜬 답변은 1,938</text>
          </svg>
        </div>
        <div class="say me">
          <span class="say-who">후속 질문</span>
          <div class="bubble">“그럼 어떻게 고쳐?”</div>
          <p class="say-note">답변을 받고 이어서 묻는다 — 앞의 질문 ①과 답변 ⓐ는 <b>지워지지 않는다</b>.</p>
        </div>
        <div class="figure">
          <svg class="chart" viewBox="0 0 660 196" role="img"
               aria-label="요청 2의 구조. 앞의 질문 1과 답변 a가 messages 뒤에 그대로 쌓이고, 그 뒤에 후속 질문 2가 이번 입력으로 붙는다. 앞부분은 요청 1에서 보낸 것과 완전히 같고, 요청은 매번 더 길어진다.">
            <text class="blabel" x="645.7" y="22" text-anchor="end">이번 입력 ② — “그럼 어떻게 고쳐?”</text>
            <line class="leader" x1="638.7" y1="28" x2="638.7" y2="50"/>
            <text class="blabel" x="112.3" y="44" text-anchor="middle">tools</text>
            <text class="blabel" x="164.9" y="44" text-anchor="middle">system</text>
            <text class="blabel" x="390.5" y="44" text-anchor="middle">messages — ①과 ⓐ가 뒤에 쌓였다</text>
            <text class="dlabel big" x="30" y="84">요청 2</text>
            <rect class="band-a" x="92" y="52" width="40.5" height="52" rx="3"/>
            <rect class="band-a" x="134.5" y="52" width="60.8" height="52" rx="3"/>
            <rect class="band-b" x="197.3" y="52" width="386.4" height="52" rx="3"/>
            <rect class="band-c" x="585.7" y="52" width="14" height="52" rx="3"/>
            <text class="onfill" x="592.7" y="82" text-anchor="middle">1</text>
            <rect class="band-b" x="601.7" y="52" width="28" height="52" rx="3"/>
            <text class="onband" x="615.7" y="82" text-anchor="middle">ⓐ</text>
            <rect class="band-c" x="631.7" y="52" width="14" height="52" rx="3"/>
            <text class="onfill" x="638.7" y="82" text-anchor="middle">2</text>
            <path class="leader" d="M92,116 L92,122 L645.7,122 L645.7,116"/>
            <text class="blabel" x="360" y="142" text-anchor="middle">프롬프트 = 이 전부가 매 요청마다 다시 전송된다</text>
            <text class="blabel" x="360" y="174" text-anchor="middle">앞의 긴 구간은 요청 1에서 보낸 것과 글자 하나까지 같다 — 캐시가 걸리는 자리가 여기다</text>
          </svg>
        </div>
        <p>
          앞 그림의 <span class="k">tools</span>와 <span class="k">system</span>에 실제로 무엇이
          들어가는지는 펼쳐서 볼 수 있다.
        </p>
        <details class="fold">
          <summary>tools — 도구 정의 (실제 JSON)</summary>
        <p>
          이름·설명문·입력 스키마가 <strong>그대로 텍스트로</strong> 들어간다. Claude Code는
          20개 가까운 도구를 매 요청에 싣는다. 거의 안 바뀌므로 프리픽스의 맨 앞을 차지하고,
          <strong>도구 하나를 추가하면 그 뒤 전부가 다시 계산된다.</strong>
        </p>
        <pre class="code">"tools": [
  {
    "name": "Read",
    "description": "Reads a file from the local filesystem. …",
    "input_schema": {
      "type": "object",
      "properties": {
        "file_path": { "type": "string", "description": "절대 경로" },
        "limit":     { "type": "integer" }
      },
      "required": ["file_path"]
    }
  },
  { "name": "Bash",  "description": "Executes a bash command. …", … },
  { "name": "Edit",  "description": "Performs exact string replacement. …", … },
  …  (Claude Code 기준 15~20개)
]</pre>
        </details>
        <details class="fold">
          <summary>system — 시스템 프롬프트 (실제 JSON)</summary>
        <p>
          문자열 하나가 아니라 <strong>블록 배열</strong>이다. 어느 블록에
          <span class="k">cache_control</span>을 달면 <strong>거기까지가 캐시 경계</strong>가 된다 —
          06절의 브레이크포인트가 바로 이것이다.
        </p>
        <pre class="code">"system": [
  { "type": "text",
    "text": "You are Claude Code, Anthropic's official CLI for Claude." },
  { "type": "text",
    "text": "# Environment\n - Primary working directory: /home/renoir/repo\n - Platform: linux …",
    "cache_control": { "type": "ephemeral", "ttl": "1h" } }
]</pre>
        </details>
        <p>
          그래서 코딩 에이전트에서 캐싱은 선택이 아니다. 도구를 쓸수록 컨텍스트가 커지고,
          커진 컨텍스트가 <strong>매 스텝 다시 나간다.</strong> 캐싱이 붙으면 그 재전송분이
          <strong>0.1배</strong>가 되고, 붙지 않으면 정가 그대로 매 스텝에 곱해진다.
        </p>
      </section>
      <section id="s2">
        <div class="sec-head"><span class="num">02</span><h2>모델별 단가</h2></div>
        <p class="lede">
          읽기 <strong>0.1×</strong>,
          1시간 쓰기 <strong>2×</strong>, 5분 쓰기 <strong>1.25×</strong>.
          모델마다 다른 건 <strong>거기에 곱해지는 기준 단가</strong>뿐이다.
        </p>
        <div class="table-scroll wide">
          <table class="picker">
            <thead><tr><th>모델</th><th>입력 1×</th><th>캐시 읽기 0.1×</th><th>캐시 쓰기 2× (1시간)</th><th>출력</th></tr></thead>
            <tbody>
              <tr><td>Claude Fable 5</td><td>$10.00</td><td>$1.00</td><td>$20.00</td><td>$50.00</td></tr>
              <tr class="on"><td>Claude Opus 5</td><td>$5.00</td><td>$0.50</td><td>$10.00</td><td>$25.00</td></tr>
              <tr><td>Claude Opus 4.8</td><td>$5.00</td><td>$0.50</td><td>$10.00</td><td>$25.00</td></tr>
              <tr class="hl"><td>Claude Sonnet 5</td><td>$2.00</td><td>$0.20</td><td>$4.00</td><td>$10.00</td></tr>
              <tr><td>Claude Sonnet 4.6</td><td>$3.00</td><td>$0.30</td><td>$6.00</td><td>$15.00</td></tr>
              <tr><td>Claude Haiku 4.5</td><td>$1.00</td><td>$0.10</td><td>$2.00</td><td>$5.00</td></tr>
            </tbody>
          </table>
        </div>
        <div class="note warn">
          <div class="n-label">Sonnet 5의 $2.00 — 토크나이저 교체를 상쇄하는 한시 단가</div>
          정가는 4.6과 같은 $3.00 / $15.00이고, 지금 값은 <b>2026-08-31에 끝나는 한시 도입 단가</b>다.
          할인의 이유는 <b>토크나이저 교체</b> — Sonnet 5는 같은 텍스트가 약 <b>1.0~1.35배 더 많은
          토큰</b>으로 잘리기 때문에, 단가를 낮춰 요청당 실비용을 4.6과 비슷하게 맞춘 것이다.
        </div>
        <p class="fine">
          100만 토큰당 달러. 컨텍스트 창은 Haiku 4.5만 200K이고 나머지는 1M.
          5분 TTL 쓰기는 1.25×(Opus 5 기준 $6.25)지만, Claude Code는 실측상 1시간 TTL만 쓴다.
          이 문서의 계산은 <b>Opus 5</b>(강조한 줄) 기준이다 — 예외는 07절의 압축 실측 하나로,
          그쪽은 <b>Fable 5 단가</b>로 잰 값이다(해당 절에 명시).
        </p>
      </section>
      <section id="s3">
        <div class="sec-head"><span class="num">03</span><h2>실제 트랜스크립트 비용 분석</h2></div>
        <div class="note">
          <div class="n-label">읽기 전에 — 헷갈리기 쉬운 네 단어</div>
          <ul class="deflist">
            <li><b>트랜스크립트</b> — 디스크의 파일. 대화의 전체 역사, 압축해도 안 지워짐</li>
            <li><b>컨텍스트</b> — 이번 턴에 모델이 본 것. 압축하면 줄어듦</li>
            <li><b>프롬프트</b> — 그 컨텍스트를 만들어 낸 요청 본문</li>
            <li><b>프리픽스</b> — 프롬프트의 앞부분. 캐시는 "앞에서부터 어디까지 지난번과
              똑같은가"로만 걸리므로, 그 걸린 앞부분을 가리킴</li>
          </ul>
        </div>
        <p class="lede">
          실제 세션의 트랜스크립트를 열어
          <strong>토큰 수로 역산하여 실제 비용을 산출한다.</strong>
        </p>
        <h3>캐싱이 없다면 — 요청 하나의 비용은 이렇게 나온다</h3>
        <div class="figure">
          <svg class="chart" viewBox="0 0 660 252" role="img"
               aria-label="캐싱이 없을 때 요청 하나의 비용 계산. 같은 막대를 두 부분으로 나눠, 이미 보낸 프리픽스 593,328토큰은 100만 토큰당 5달러로 2.96664달러, 이번에 새로 들어간 138토큰은 0.00069달러이고, 합계 593,466토큰은 2.967달러다. 캐싱이 없으면 두 부분 모두 정가 1배다.">
            <text class="blabel" x="30" y="22">이미 보낸 부분 — 593,328토큰 · 99.98%</text>
            <text class="blabel" x="630" y="22" text-anchor="end">이번에 새로 — 138토큰 · 0.02%</text>
            <line class="leader" x1="627" y1="28" x2="627" y2="104"/>
            <rect class="band-b" x="30" y="46" width="592" height="52" rx="3"/>
            <text class="blabel" x="326" y="76" text-anchor="middle">tools + system + messages(지금까지의 대화 전부)</text>
            <rect class="band-c" x="624" y="46" width="6" height="52" rx="2"/>
            <path class="leader" d="M30,110 L30,116 L630,116 L630,110"/>
            <text class="blabel" x="330" y="136" text-anchor="middle">요청 한 번 = 593,466 토큰 — 캐싱이 없으면 이 전부가 정가 1×다</text>
            <text class="blabel" x="30" y="176">이미 보낸 부분</text>
            <text class="blabel" x="330" y="176" text-anchor="end">593,328 토큰</text>
            <text class="blabel" x="345" y="176">× $5 / 1M ×  1  =</text>
            <text class="dlabel end" x="630" y="176" text-anchor="end">$2.96664</text>
            <text class="blabel" x="30" y="200">이번에 새로</text>
            <text class="blabel" x="330" y="200" text-anchor="end">138 토큰</text>
            <text class="blabel" x="345" y="200">× $5 / 1M ×  1  =</text>
            <text class="dlabel end" x="630" y="200" text-anchor="end">$0.00069</text>
            <line class="grid" x1="30" y1="214" x2="630" y2="214"/>
            <text class="blabel" x="30" y="240">합계</text>
            <text class="blabel" x="330" y="240" text-anchor="end">593,466 토큰</text>
            <text class="blabel" x="345" y="240">× $5 / 1M ×  1  =</text>
            <text class="dlabel big" x="630" y="242" text-anchor="end">$2.967</text>
          </svg>
          <p class="caption">두 부분 모두 배수가 <b>1×</b>다 — 캐싱이 없으면 "이미 보냈던 것"에도 할인이 없다.
            그리고 이 값이 매 요청마다 그대로 나간다 (816요청이면 $1,296)</p>
        </div>
        <h3>프롬프트 캐싱 시 한 요청당 비용</h3>
        <div class="figure">
          <svg class="chart" viewBox="0 0 660 300" role="img"
               aria-label="캐싱이 걸렸을 때 같은 요청의 비용 계산. 프리픽스 593,328토큰은 읽기 0.1배로 0.29666달러, 이번에 새로 들어간 138토큰은 쓰기 2배로 0.00138달러, 합계 0.298달러다. 아래 두 막대는 캐싱이 없을 때의 2.967달러와 나란히 놓은 것으로, 실제로 낸 값은 그 10.0%이고 차액 2.669달러를 캐시가 깎아줬다.">
            <text class="blabel" x="30" y="26">이미 캐시된 프리픽스</text>
            <text class="blabel" x="330" y="26" text-anchor="end">593,328 토큰</text>
            <text class="blabel" x="345" y="26">× $5 / 1M × 0.1 =</text>
            <text class="dlabel end" x="630" y="26" text-anchor="end">$0.29666</text>
            <text class="blabel" x="30" y="50">이번에 새로</text>
            <text class="blabel" x="330" y="50" text-anchor="end">138 토큰</text>
            <text class="blabel" x="345" y="50">× $5 / 1M ×  2  =</text>
            <text class="dlabel end" x="630" y="50" text-anchor="end">$0.00138</text>
            <line class="grid" x1="30" y1="64" x2="630" y2="64"/>
            <text class="blabel" x="30" y="90">합계</text>
            <text class="blabel" x="330" y="90" text-anchor="end">593,466 토큰</text>
            <text class="dlabel big" x="630" y="92" text-anchor="end">$0.298</text>
            <text class="blabel" x="330" y="128" text-anchor="middle">캐싱이 없을 때와 나란히 놓으면</text>
            <text class="blabel" x="30" y="158">캐싱이 없다면</text>
            <rect class="band-a" x="30" y="166" width="600" height="40" rx="3"/>
            <text class="dlabel end" x="618" y="191" text-anchor="end">$2.967</text>
            <text class="blabel" x="30" y="232">실제로 낸 값</text>
            <rect class="band-c" x="30" y="240" width="60.3" height="40" rx="3"/>
            <text class="dlabel end" x="100" y="265">$0.298 · 10.0%</text>
            <text class="blabel" x="630" y="265" text-anchor="end">차액 $2.669 — 캐시가 깎아준 값</text>
          </svg>
        </div>
        <h3>세션 전체로 합치면</h3>
        <p>
          이 세션은 <strong>4시간 동안 816번</strong>의 API 요청이 이루어졌다.
          매 요청 당 평균 <strong>$0.18</strong>, 최대 <strong>$0.298</strong>의 비용이 청구되었다.
          만약 프롬프트 캐싱이 적용되지 않았다면 매 요청 당 평균 <strong>$1.59</strong>,
          최대 <strong>$2.967</strong>의 비용이 청구되었을 것이다.
        </p>
        <div class="table-scroll wide prose-last">
          <table class="picker usage">
            <thead><tr><th>usage 필드 · 816요청 합계</th><th>토큰</th><th>비용</th><th>캐싱 없다면</th><th>정체</th></tr></thead>
            <tbody>
              <tr><td>cache_read_input_tokens</td><td>257,591,796</td><td>$128.80</td><td>$1,287.96</td><td>캐시로부터 읽은 토큰 양</td></tr>
              <tr><td>cache_creation_input_tokens</td><td>1,607,897</td><td>$16.08</td><td>$8.04</td><td>새로 캐시에 추가한 토큰 양</td></tr>
              <tr><td>input_tokens</td><td>1,542</td><td>$0.01</td><td>$0.01</td><td>캐시를 사용하지 않고 계산된 토큰 양</td></tr>
              <tr class="on"><td>합계</td><td>259,201,235</td><td>$144.88</td><td>$1,296.01</td><td>세션 전체 — <b>8.9배</b> 차이</td></tr>
            </tbody>
          </table>
        </div>
        <div class="triptych">
          <div>
            <p class="zone">세션 규모</p>
            <h4 class="num">816요청</h4>
            <p>4시간 동안 오간 요청 수. 입력 토큰 누적 <b>259M</b>,
              그중 <b>99.4%</b>가 캐시 읽기였다.</p>
          </div>
          <div>
            <p class="zone">캐싱이 없다면</p>
            <h4 class="num">$1,296</h4>
            <p>같은 토큰을 전부 정가(1×)로 계산한 값.</p>
          </div>
          <div class="pick">
            <p class="zone">실제</p>
            <h4 class="num">$145</h4>
            <p>요청당 평균 <b>$0.18</b>. <b>89% 절감</b>.</p>
          </div>
        </div>
        <p class="fine">
          산정식 — (read × 0.1 + write<sub>1h</sub> × 2 + input × 1) × 단가.
          단가는 Opus 5 입력 $5/1M, 토큰은 트랜스크립트 <span class="k">usage</span> 실측.
          쓰기 배수 2×는 가정이 아니라 측정값이다 —
          <span class="k">usage.cache_creation</span>을 열어보면 이 세션의 캐시 쓰기
          1,607,897토큰이 <b>전량 <span class="k">ephemeral_1h</span></b>였다(5분 캐시는 0).
          표본은 Opus 5 단일 모델로 4시간 동안 816요청이 오간 세션이다.
          예로 든 요청은 <b>사용자가 직접 친 질문 바로 다음 요청 121개 중 컨텍스트가 가장 큰 것</b>
          (593,466토큰)이다 — 가장 큰 값을 골랐으므로 평균은 이보다 작다(요청당 $0.18, 아래 타일).
          도구 왕복 중간 스텝은 사용자 질문이 없어 예시에서 제외했다. 집계는 메인 체인 assistant 엔트리만,
          <span class="k">message.id</span> 중복 제거, 서브에이전트
          (<span class="k">isSidechain</span>) 제외, 출력 토큰 미포함. 2026-08-09 측정.
        </p>
      </section>
      <section id="s4">
        <div class="sec-head"><span class="num">04</span><h2>왜 캐싱인가 — 재전송이 대부분이다</h2></div>
        <p class="lede">
          매 요청이 전부를 다시 보낸다면, 대화가 길어질수록 요청 하나가 커진다.
          그리고 그 커진 부분은 <strong>거의 전부 이미 보냈던 것</strong>이다.
        </p>
        <p>
          아래는 간단한 모델이다 — 시스템+툴 고정 20k에, 턴마다 사용자 입력과 응답으로
          5k씩 쌓인다고 두었다. 막대 하나가 <strong>그 턴 요청 하나의 입력 토큰</strong>이고,
          진한 부분이 <strong>이전에 이미 보낸 내용</strong>이다.
        </p>
        <div class="figure">
          <svg class="chart" viewBox="0 0 660 366" role="img"
                 aria-label="턴이 쌓일수록 요청 하나의 입력 토큰이 커진다. 12턴째에는 75k 중 70k가 이전에 이미 보낸 내용이다.">
              <line class="grid" x1="54" y1="288" x2="640" y2="288"/>
              <text class="tick" x="44" y="292" text-anchor="end">0k</text>
              <line class="grid" x1="54" y1="223" x2="640" y2="223"/>
              <text class="tick" x="44" y="227" text-anchor="end">20k</text>
              <line class="grid" x1="54" y1="158" x2="640" y2="158"/>
              <text class="tick" x="44" y="162" text-anchor="end">40k</text>
              <line class="grid" x1="54" y1="93" x2="640" y2="93"/>
              <text class="tick" x="44" y="97" text-anchor="end">60k</text>
              <line class="grid" x1="54" y1="28" x2="640" y2="28"/>
              <text class="tick" x="44" y="32" text-anchor="end">80k</text>
              <path class="s-mute" d="M64.4,288 L64.4,227 Q64.4,223 68.4,223 L88.4,223 Q92.4,223 92.4,227 L92.4,288 Z"/>
              <text class="tick" x="78.4" y="306" text-anchor="middle">1</text>
              <rect class="s1" x="113.3" y="223" width="28" height="65"/>
              <path class="s-mute" d="M113.3,221 L113.3,208.8 Q113.3,204.8 117.3,204.8 L137.3,204.8 Q141.3,204.8 141.3,208.8 L141.3,221 Z"/>
              <text class="tick" x="127.3" y="306" text-anchor="middle">2</text>
              <rect class="s1" x="162.1" y="206.8" width="28" height="81.3"/>
              <path class="s-mute" d="M162.1,204.8 L162.1,192.6 Q162.1,188.6 166.1,188.6 L186.1,188.6 Q190.1,188.6 190.1,192.6 L190.1,204.8 Z"/>
              <text class="tick" x="176.1" y="306" text-anchor="middle">3</text>
              <rect class="s1" x="210.9" y="190.5" width="28" height="97.5"/>
              <path class="s-mute" d="M210.9,188.5 L210.9,176.3 Q210.9,172.3 214.9,172.3 L234.9,172.3 Q238.9,172.3 238.9,176.3 L238.9,188.5 Z"/>
              <text class="tick" x="224.9" y="306" text-anchor="middle">4</text>
              <rect class="s1" x="259.8" y="174.3" width="28" height="113.8"/>
              <path class="s-mute" d="M259.8,172.3 L259.8,160.1 Q259.8,156.1 263.8,156.1 L283.8,156.1 Q287.8,156.1 287.8,160.1 L287.8,172.3 Z"/>
              <text class="tick" x="273.8" y="306" text-anchor="middle">5</text>
              <rect class="s1" x="308.6" y="158" width="28" height="130"/>
              <path class="s-mute" d="M308.6,156 L308.6,143.8 Q308.6,139.8 312.6,139.8 L332.6,139.8 Q336.6,139.8 336.6,143.8 L336.6,156 Z"/>
              <text class="tick" x="322.6" y="306" text-anchor="middle">6</text>
              <rect class="s1" x="357.4" y="141.8" width="28" height="146.3"/>
              <path class="s-mute" d="M357.4,139.8 L357.4,127.6 Q357.4,123.6 361.4,123.6 L381.4,123.6 Q385.4,123.6 385.4,127.6 L385.4,139.8 Z"/>
              <text class="tick" x="371.4" y="306" text-anchor="middle">7</text>
              <rect class="s1" x="406.3" y="125.5" width="28" height="162.5"/>
              <path class="s-mute" d="M406.3,123.5 L406.3,111.3 Q406.3,107.3 410.3,107.3 L430.3,107.3 Q434.3,107.3 434.3,111.3 L434.3,123.5 Z"/>
              <text class="tick" x="420.3" y="306" text-anchor="middle">8</text>
              <rect class="s1" x="455.1" y="109.3" width="28" height="178.8"/>
              <path class="s-mute" d="M455.1,107.3 L455.1,95.1 Q455.1,91.1 459.1,91.1 L479.1,91.1 Q483.1,91.1 483.1,95.1 L483.1,107.3 Z"/>
              <text class="tick" x="469.1" y="306" text-anchor="middle">9</text>
              <rect class="s1" x="503.9" y="93" width="28" height="195"/>
              <path class="s-mute" d="M503.9,91 L503.9,78.8 Q503.9,74.8 507.9,74.8 L527.9,74.8 Q531.9,74.8 531.9,78.8 L531.9,91 Z"/>
              <text class="tick" x="517.9" y="306" text-anchor="middle">10</text>
              <rect class="s1" x="552.8" y="76.8" width="28" height="211.3"/>
              <path class="s-mute" d="M552.8,74.8 L552.8,62.6 Q552.8,58.6 556.8,58.6 L576.8,58.6 Q580.8,58.6 580.8,62.6 L580.8,74.8 Z"/>
              <text class="tick" x="566.8" y="306" text-anchor="middle">11</text>
              <rect class="s1" x="601.6" y="60.5" width="28" height="227.5"/>
              <path class="s-mute" d="M601.6,58.5 L601.6,46.3 Q601.6,42.3 605.6,42.3 L625.6,42.3 Q629.6,42.3 629.6,46.3 L629.6,58.5 Z"/>
              <text class="tick" x="615.6" y="306" text-anchor="middle">12</text>
              <text class="dlabel big" x="66" y="58">12턴째 요청 75k 중</text>
              <text class="dlabel big" x="66" y="82">70k(93%)가 이미 보낸 내용</text>
              <line class="axis" x1="54" y1="288" x2="640" y2="288"/>
              <text class="tick" x="54" y="328">턴 →</text>
            </svg>
          <p class="legend">
            <span><span class="key k1"></span>재전송 — 이전 턴에서 이미 보낸 분</span>
            <span><span class="key k2"></span>신규 — 이번 턴에 처음 보내는 분</span>
          </p>
        </div>
        <p>
          여기서 캐싱의 아이디어가 나온다. <strong>매번 똑같이 보내는 앞부분을 서버가 기억해 두면,
          같은 내용을 다시 계산하지 않아도 된다.</strong> 다시 보내긴 하지만
          <strong>값을 10분의 1만 받는다</strong>(0.1×). 대신 처음 등록할 때
          웃돈을 낸다(1시간 TTL 기준 2×).
        </p>
        <p>
          같은 12턴 대화의 <strong>누적 비용</strong>을 캐싱 없이 계산한 것과
          캐싱을 적용한 것으로 나란히 그리면 이렇게 벌어진다.
        </p>
        <div class="figure">
          <svg class="chart" viewBox="0 0 660 366" role="img"
                 aria-label="12턴 대화의 누적 입력 비용. 캐싱 없음은 2.85달러까지 오르고 캐싱 적용은 1.00달러에 머문다. 두 선은 3턴째에 교차한다.">
              <line class="grid" x1="54" y1="288" x2="600" y2="288"/>
              <text class="tick" x="44" y="292" text-anchor="end">$0</text>
              <line class="grid" x1="54" y1="201.3" x2="600" y2="201.3"/>
              <text class="tick" x="44" y="205.3" text-anchor="end">$1</text>
              <line class="grid" x1="54" y1="114.7" x2="600" y2="114.7"/>
              <text class="tick" x="44" y="118.7" text-anchor="end">$2</text>
              <line class="grid" x1="54" y1="28" x2="600" y2="28"/>
              <text class="tick" x="44" y="32" text-anchor="end">$3</text>
              <text class="tick" x="54" y="306" text-anchor="middle">1</text>
              <text class="tick" x="103.6" y="306" text-anchor="middle">2</text>
              <text class="tick" x="153.3" y="306" text-anchor="middle">3</text>
              <text class="tick" x="202.9" y="306" text-anchor="middle">4</text>
              <text class="tick" x="252.5" y="306" text-anchor="middle">5</text>
              <text class="tick" x="302.2" y="306" text-anchor="middle">6</text>
              <text class="tick" x="351.8" y="306" text-anchor="middle">7</text>
              <text class="tick" x="401.5" y="306" text-anchor="middle">8</text>
              <text class="tick" x="451.1" y="306" text-anchor="middle">9</text>
              <text class="tick" x="500.7" y="306" text-anchor="middle">10</text>
              <text class="tick" x="550.4" y="306" text-anchor="middle">11</text>
              <text class="tick" x="600" y="306" text-anchor="middle">12</text>
              <path class="line s1" d="M54,279.3 L103.6,268.5 L153.3,255.5 L202.9,240.3 L252.5,223 L302.2,203.5 L351.8,181.8 L401.5,158 L451.1,132 L500.7,103.8 L550.4,73.5 L600,41"/>
              <path class="line s2" d="M54,270.7 L103.6,265.5 L153.3,260.1 L202.9,254.4 L252.5,248.6 L302.2,242.5 L351.8,236.2 L401.5,229.7 L451.1,223 L500.7,216.1 L550.4,208.9 L600,201.6"/>
              <circle class="dot s2f" cx="153.3" cy="260.1" r="5"/>
              <line class="leader" x1="153.3" y1="226.1" x2="153.3" y2="250.1"/>
              <text class="dlabel" x="153.3" y="218.1" text-anchor="middle">3턴째 역전</text>
              <circle class="dot s1f" cx="600" cy="41" r="4"/>
              <text class="dlabel end" x="610" y="45">$2.85</text>
              <circle class="dot s2f" cx="600" cy="201.6" r="4"/>
              <text class="dlabel end" x="610" y="205.6">$1.00</text>
              <line class="axis" x1="54" y1="288" x2="600" y2="288"/>
              <text class="tick" x="54" y="328">턴 →</text>
            </svg>
          <p class="legend">
            <span><span class="key k1"></span>캐싱 없음 — 매 턴 정가 재계산</span>
            <span><span class="key k3"></span>캐싱 적용 — 프리픽스는 0.1×</span>
          </p>
          <p class="caption">Opus 5 입력 단가 기준 모델 계산 · 12턴 누적 $2.85 → $1.00 (65% 절감)</p>
        </div>
        <p>
          이 그림에서 두 가지를 짚고 넘어가면 나머지 절이 쉬워진다.
        </p>
        <ul class="rules">
          <li><span class="mark">◆</span><div>
            <b>1~2턴에서는 캐싱이 오히려 비싸다</b>
            <span>등록 비용(2×)을 먼저 내기 때문이다. <strong>3턴째에 역전</strong>되는데,
              1시간 TTL은 등록에 2×를 먼저 내고 읽기에 0.1×를 내므로
              2 + 0.2 = 2.2 &lt; 3 — 손익분기가 정확히 거기다.</span></div></li>
          <li><span class="mark">◆</span><div>
            <b>격차는 턴이 쌓일수록 벌어진다</b>
            <span>캐싱 없음 곡선은 위로 휘고(재전송이 누적되므로), 캐싱 곡선은 거의 직선이다.
              긴 세션일수록 캐싱의 값어치가 커지고, 동시에
              <strong>캐시가 깨졌을 때의 손해도 커진다</strong>.</span></div></li>
        </ul>
        <details class="revlog">
          <summary>차트 데이터 (표로 보기)</summary>
          <div class="table-scroll">
            <table class="picker">
              <thead><tr><th>턴</th><th>요청 입력</th><th>그중 재전송</th><th>누적 · 캐싱 없음</th><th>누적 · 캐싱 적용</th></tr></thead>
              <tbody>
              <tr><td>1</td><td>20k</td><td>0k</td><td>$0.10</td><td>$0.20</td></tr>
              <tr><td>2</td><td>25k</td><td>20k</td><td>$0.23</td><td>$0.26</td></tr>
              <tr><td>3</td><td>30k</td><td>25k</td><td>$0.38</td><td>$0.32</td></tr>
              <tr><td>4</td><td>35k</td><td>30k</td><td>$0.55</td><td>$0.39</td></tr>
              <tr><td>5</td><td>40k</td><td>35k</td><td>$0.75</td><td>$0.46</td></tr>
              <tr><td>6</td><td>45k</td><td>40k</td><td>$0.97</td><td>$0.53</td></tr>
              <tr><td>7</td><td>50k</td><td>45k</td><td>$1.23</td><td>$0.60</td></tr>
              <tr><td>8</td><td>55k</td><td>50k</td><td>$1.50</td><td>$0.67</td></tr>
              <tr><td>9</td><td>60k</td><td>55k</td><td>$1.80</td><td>$0.75</td></tr>
              <tr><td>10</td><td>65k</td><td>60k</td><td>$2.13</td><td>$0.83</td></tr>
              <tr><td>11</td><td>70k</td><td>65k</td><td>$2.48</td><td>$0.91</td></tr>
              <tr><td>12</td><td>75k</td><td>70k</td><td>$2.85</td><td>$1.00</td></tr>
              </tbody>
            </table>
          </div>
        </details>
        <div class="decision">
          <div class="d-label">그래서 캐싱은 옵션이 아니다</div>
          Claude Code는 이미 캐싱을 쓰고 있다. 우리가 할 일은 <strong>켜는 것이 아니라
          깨뜨리지 않는 것</strong>이다. 나머지 절은 전부 "무엇이 캐시를 깨는가"에 대한 답이다.
        </div>
      </section>
      <section id="s5">
        <div class="sec-head"><span class="num">05</span><h2>프롬프트 캐싱 조건</h2></div>
        <blockquote>
          <p>프롬프트 캐싱은 접두사 일치다. 프리픽스 안에서 1바이트만 바뀌어도 그 뒤 전부가 무효다.</p>
          <cite>Anthropic 공식 문서 · Prompt caching — 출처는 문서 맨 아래</cite>
        </blockquote>
        <p>
          캐시 키는 <strong>렌더된 프롬프트의 정확한 바이트열</strong>에서 나온다.
          "조금 바뀌었으니 조금만 무효"는 없다. 그리고 렌더 순서는 고정이다.
        </p>
        <div class="figure">
          <svg class="chart" viewBox="0 0 660 150" role="img"
               aria-label="한 요청은 tools, system, messages 순서로 이어 붙는다. cache_control을 붙인 지점이 경계이고, 그 앞은 캐시에서 0.1배로 읽고 그 뒤는 매번 새로 1배 또는 2배로 보낸다. 폭은 개념도다.">
            <text class="blabel" x="250" y="20" text-anchor="middle">프리픽스 — 캐시에서 읽는다 (0.1×)</text>
            <text class="blabel" x="552" y="20" text-anchor="middle">매번 새로 (1× 또는 2×)</text>
            <text class="blabel" x="52.5" y="42" text-anchor="middle">tools</text>
            <text class="blabel" x="109.5" y="42" text-anchor="middle">system</text>
            <text class="blabel" x="307" y="42" text-anchor="middle">messages — 지금까지의 대화</text>
            <text class="blabel" x="552" y="42" text-anchor="middle">이번 입력</text>
            <rect class="band-a" x="30" y="50" width="45" height="52" rx="3"/>
            <rect class="band-a" x="77" y="50" width="65" height="52" rx="3"/>
            <rect class="band-b" x="144" y="50" width="326" height="52" rx="3"/>
            <rect class="band-c" x="474" y="50" width="156" height="52" rx="3"/>
            <line class="leader" x1="472" y1="30" x2="472" y2="118"/>
            <text class="blabel" x="472" y="136" text-anchor="middle">이 자리에 <tspan class="em">cache_control</tspan> 을 붙인다</text>
          </svg>
          <p class="caption">렌더 순서는 고정이고, 경계만 우리가 정한다. 경계 앞은 재사용, 뒤는 매번 정가 —
            <b>변하는 것을 뒤로 미는 게 설계의 전부다</b>. 폭은 개념도다</p>
        </div>
        <p>
          그래서 프롬프트를 조립하는 코드의 규칙은 하나로 줄어든다 —
          <strong>안정적인 것을 앞에, 변하는 것을 뒤에.</strong>
          이 순서가 맞으면 캐싱은 대체로 공짜로 동작하고, 틀리면
          <span class="k">cache_control</span>을 아무리 붙여도 소용없다.
        </p>
      </section>
      <section id="s6">
        <div class="sec-head"><span class="num">06</span><h2>브레이크포인트 — 어디에 찍는가</h2></div>
        <p class="lede">입력을 안정성으로 4등분한 뒤, 등급이 바뀌는 자리에 찍는다.</p>
        <p>
          브레이크포인트란 <span class="k">cache_control</span>을 붙인 그 지점이다 —
          프롬프트를 여기서 끊어 <strong>앞부분을 캐시로 저장</strong>하고,
          다음 요청은 그 지점까지를 그대로 재사용한다.
        </p>
        <p class="fine">
          <b>요청당 최대 4개</b>다. 요청 최상위에 <span class="k">cache_control</span>을 하나 두면
          마지막 캐시 가능 블록에 자동 배치되는데, 이것도 슬롯 하나를 쓴다 —
          명시 브레이크포인트가 이미 4개면 400이 난다. <b>최소 캐시 길이</b>도 있다:
          Opus 5는 <b>512토큰</b>, Sonnet 5·Opus 4.8은 1,024토큰. 미달이면 마커를 붙여도
          캐싱 없이 처리되고 <b>에러는 나지 않는다</b>.
        </p>
        <ol class="plain">
          <li><strong>절대 안 변함</strong> → 맨 앞, 첫 브레이크포인트 앞</li>
          <li><strong>세션마다 변함</strong> → 전역 프리픽스 뒤</li>
          <li><strong>턴마다 변함</strong> → 마지막 브레이크포인트 뒤</li>
          <li><strong>요청마다 변함</strong>(타임스탬프·UUID) → 제거하거나 맨 끝으로</li>
        </ol>
        <div class="table-scroll">
          <table class="picker">
            <thead><tr><th>상황</th><th>어디에 찍나</th><th>이유</th></tr></thead>
            <tbody>
              <tr><td>큰 공용 시스템 프롬프트</td><td>system 마지막 텍스트 블록</td>
                <td>tools + system이 한 번에 캐시된다</td></tr>
              <tr><td>멀티턴 대화</td><td>최근 추가된 턴의 마지막 블록</td>
                <td>앞선 브레이크포인트도 유효한 read 지점으로 남아 히트가 누적된다</td></tr>
              <tr><td>공용 프리픽스 + 매번 다른 질문</td><td><strong>공용 부분이 끝나는 지점</strong></td>
                <td>전체 끝에 찍으면 요청마다 서로 다른 캐시를 쓰기만 하고 아무도 못 읽는다</td></tr>
              <tr><td>앞부분부터 매번 다른 프롬프트</td><td>찍지 않는다</td>
                <td>재사용할 프리픽스가 없다 — 마커는 등록 프리미엄만 물린다</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          브레이크포인트는 <strong>요청당 최대 4개</strong>이고 어느 콘텐츠 블록에나 붙는다.
          세밀한 배치가 필요 없으면 최상위 <span class="k">cache_control</span>로
          마지막 캐시 가능 블록에 자동 배치하면 된다.
        </p>
        <ul class="rules">
          <li><span class="mark">B1</span><div>
            <b>시스템 프롬프트를 얼린다</b>
            <span>"현재 날짜"·"모드"·"사용자 이름"을 여기 끼워 넣지 않는다.
              프리픽스 맨 앞이라 뒤 전부를 무효화한다.</span></div></li>
          <li><span class="mark">B2</span><div>
            <b>툴 목록을 결정적으로 직렬화한다</b>
            <span>툴은 위치 0에 렌더된다. 추가·삭제뿐 아니라 <strong>순서 변경</strong>만으로도 전체가 깨진다.</span></div></li>
          <li><span class="mark">B3</span><div>
            <b>포크 호출은 부모 프리픽스를 그대로 복사한다</b>
            <span>요약·압축·서브에이전트가 <span class="k">system</span>·<span class="k">tools</span>·<span class="k">model</span>을
              다시 조립하면 부모 캐시를 통째로 놓친다.</span></div></li>
        </ul>
      </section>
      <section id="s7">
        <div class="sec-head"><span class="num">07</span><h2>TTL과 웜/콜드 — 시간이 곧 돈</h2></div>
        <p class="lede">
          같은 작업이 캐시 온도에 따라 <strong>3.5배</strong> 갈리는 지점이 실무에 있다.
          압축(<span class="k">/compact</span>)이 대표적이다.
        </p>
        <div class="versus">
          <div>
            <span class="tag">warm — 마지막 응답 직후</span>
            <h4>≈ $1.3</h4>
            <p>37만 토큰 입력이 <span class="who">0.1× read</span>로 들어간다.</p>
            <dl>
              <dt>입력</dt><dd>$0.37</dd>
              <dt>요약 출력</dt><dd>$0.28</dd>
              <dt>재캐시</dt><dd>$0.63</dd>
              <dt>합계</dt><dd><b>$1.3</b></dd>
            </dl>
          </div>
          <div>
            <span class="tag">cold — TTL 경과 후</span>
            <h4>≈ $4.6</h4>
            <p>같은 37만 토큰이 <span class="who">정가 1×</span>로 다시 계산된다. 결과물은 동일하다.</p>
            <dl>
              <dt>입력</dt><dd>$3.74</dd>
              <dt>요약 출력</dt><dd>$0.28</dd>
              <dt>재캐시</dt><dd>$0.63</dd>
              <dt>합계</dt><dd><b>$4.6</b></dd>
            </dl>
          </div>
        </div>
        <p>
          실측 기준값(수동 compact 10건): 압축 전 컨텍스트 중앙값 <strong>약 37만 토큰</strong>,
          압축 후 평균 <strong>약 1.5만</strong>, 압축 직후 첫 요청은 3.2만~5.8만 토큰이
          <strong>전량 write</strong>로 나간다. 이 재작성비가 압축 1회의 고정비다.
        </p>
        <p class="fine">
          이 절의 금액은 문서에서 유일하게 <b>Fable 5 단가 기준 실측</b>이다
          (입력 $10 / 1M — 02절 표의 Opus 5의 정확히 2배).
          Opus 5 단가로 환산하면 모든 항목이 절반(웜 ≈ $0.65 / 콜드 ≈ $2.3)이고,
          <b>웜/콜드 3.5배 구조는 그대로</b>다.
        </p>
        <div class="note">
          <div class="n-label">TTL 갱신</div>
          캐시는 읽힐 때 수명이 갱신된다. 실사용 요청이 TTL보다 촘촘하면 알아서 살아 있다는 뜻이라,
          위험한 구간은 <strong>자리를 비우는 순간</strong> 하나뿐이다.
          자리를 비울 거면 <strong>비우기 전에</strong> 압축하고 나간다.
        </div>
      </section>
      <section id="s8">
        <div class="sec-head"><span class="num">08</span><h2>무효화 — 무엇이 캐시를 깨는가</h2></div>
        <p class="lede">
          모든 변경이 전체를 깨진 않는다. 캐시는 3계층이고, 변경은
          <strong>자기 계층과 그 아래</strong>만 무효화한다.
        </p>
        <div class="table-scroll wide status">
          <table class="picker">
            <thead><tr><th>변경</th><th>tools</th><th>system</th><th>messages</th></tr></thead>
            <tbody>
              <tr><td>툴 정의 추가·삭제·순서 변경</td><td><b>깨짐</b></td><td><b>깨짐</b></td><td><b>깨짐</b></td></tr>
              <tr><td>모델 전환</td><td><b>깨짐</b></td><td><b>깨짐</b></td><td><b>깨짐</b></td></tr>
              <tr><td>speed(fast 모드) · 웹서치 · citations 토글</td><td>유지</td><td><b>깨짐</b></td><td><b>깨짐</b></td></tr>
              <tr><td>system 프롬프트 내용</td><td>유지</td><td><b>깨짐</b></td><td><b>깨짐</b></td></tr>
              <tr><td>tool_choice · 이미지</td><td>유지</td><td>유지</td><td><b>깨짐</b></td></tr>
              <tr><td>thinking 설정 변경</td><td>모델별</td><td>모델별</td><td><b>깨짐</b></td></tr>
              <tr><td>effort 설정 변경</td><td>모델별</td><td>모델별</td><td><b>깨짐</b></td></tr>
              <tr><td>메시지 내용(정상 대화)</td><td>유지</td><td>유지</td><td><b>깨짐</b></td></tr>
            </tbody>
          </table>
        </div>
        <p>
          읽는 법: <strong>전체 재작성을 부르는 건 툴 정의 변경과 모델 전환 둘뿐</strong>이다.
          나머지는 자기 계층 아래만 깨진다.
        </p>
        <p>
          <span class="k">모델별</span> 두 행만 부연이 필요하다.
          <span class="k">effort</span>는 모델이 얼마나 깊이 생각할지의 단계
          (<span class="k">low · medium · high · xhigh · max</span>)이고, thinking은 그 사고를
          켜고 끄는 설정이다. 둘 다 <strong>프롬프트 안에 렌더된다</strong> — 그래서 값을 바꾸면
          새 캐시 프리픽스가 시작된다. messages 브레이크포인트는 <strong>항상</strong> 빗나가고,
          tools·system은 <strong>모델이 그 설정을 어디에 렌더하느냐</strong>에 따라 빗나갈 수도 있다.
          공식 문서는 모델 목록을 주는 대신 이렇게 못박는다 —
          <strong>"thinking이나 effort를 바꾸면 캐시를 처음부터 다시 시작한다고 보라."</strong>
          세션 도중에 effort를 올렸다 내렸다 하는 것이 여기 해당한다.
        </p>
        <p class="fine">
          원문 — "The thinking configuration and the resolved effort level are
          rendered into the prompt itself, so changing any of them starts a new cache prefix …
          Treat any thinking or effort change as starting the cache over."
          같은 절에 <b>도구 왕복 중의 사고 과정은 도구 결과와 함께 캐시되고, 캐시에서 읽힐 때 입력 토큰으로
          잡힌다</b>고도 적혀 있다 — 01절에서 실측한 2,747토큰이 다음 스텝 입력으로 되돌아온 것이 이것이다.
        </p>
        <div class="decision">
          <div class="d-label">세션 중간 모델 전환 금지</div>
          캐시는 <strong>모델 스코프</strong>다. 모델을 바꾸는 순간 그때까지의 컨텍스트 전부가
          새 모델 캐시로 <strong>다시 등록(2×)</strong>된다. 값은 컨텍스트 크기에 그대로 비례한다 —
          아래 그림. 전환은 세션 경계나 압축 직후처럼 <strong>컨텍스트가 작은 시점</strong>에서.
        </div>
        <div class="figure">
          <svg class="chart" viewBox="0 0 660 430" role="img"
               aria-label="Opus 세션에서 모델을 전환할 때 전환 직후 한 요청의 비용. x축은 전환 시점의 컨텍스트(1M 창 대비), y축은 비용. 전환하지 않으면 60%에서 0.30달러, Haiku로 전환하면 1.20달러, Sonnet으로 전환하면 2.40달러다. Sonnet 선 위 네 지점은 전환하지 않았을 때와 전환했을 때를 함께 보여준다. 5%는 0.025달러 대 0.200달러로 추가 0.175달러, 25%는 0.125 대 1.000으로 추가 0.875, 40%는 0.200 대 1.600으로 추가 1.400, 60%는 0.300 대 2.400으로 추가 2.100이다.">
            <line class="grid" x1="70" y1="350" x2="620" y2="350"/>
            <text class="tick" x="60" y="354" text-anchor="end">$0</text>
            <line class="grid" x1="70" y1="254" x2="620" y2="254"/>
            <text class="tick" x="60" y="258" text-anchor="end">$1</text>
            <line class="grid" x1="70" y1="158" x2="620" y2="158"/>
            <text class="tick" x="60" y="162" text-anchor="end">$2</text>
            <path class="gap" d="M70,350 L620,119.6 L620,321.2 Z"/>
            <path class="line s1" d="M70,350 L620,119.6"/>
            <path class="line s2" d="M70,350 L620,234.8"/>
            <path class="line s4" d="M70,350 L620,321.2"/>
            <line class="leader" x1="140" y1="276" x2="115.8" y2="330.8"/>
            <line class="leader" x1="294" y1="212" x2="299.2" y2="254"/>
            <line class="leader" x1="432" y1="156" x2="436.7" y2="196.4"/>
            <line class="leader" x1="570" y1="94" x2="620" y2="119.6"/>
            <circle class="dot s1f" cx="115.8" cy="330.8" r="4"/>
            <circle class="dot s1f" cx="299.2" cy="254" r="4"/>
            <circle class="dot s1f" cx="436.7" cy="196.4" r="4"/>
            <circle class="dot s1f" cx="620" cy="119.6" r="4"/>
            <rect class="callout" x="80" y="216" width="120" height="60" rx="4"/>
            <text class="cnote" x="90" y="231"><tspan class="em">5% · 5만 토큰</tspan></text>
            <text class="cnote" x="90" y="245">전환 X</text>
            <text class="cnote" x="190" y="245" text-anchor="end">$0.025</text>
            <text class="cnote" x="90" y="258">전환</text>
            <text class="cnote" x="190" y="258" text-anchor="end">$0.200</text>
            <text class="cnote" x="90" y="271">추가</text>
            <text class="cnote" x="190" y="271" text-anchor="end"><tspan class="em">+$0.175</tspan></text>
            <rect class="callout" x="234" y="152" width="120" height="60" rx="4"/>
            <text class="cnote" x="244" y="167"><tspan class="em">25% · 25만 토큰</tspan></text>
            <text class="cnote" x="244" y="181">전환 X</text>
            <text class="cnote" x="344" y="181" text-anchor="end">$0.125</text>
            <text class="cnote" x="244" y="194">전환</text>
            <text class="cnote" x="344" y="194" text-anchor="end">$1.000</text>
            <text class="cnote" x="244" y="207">추가</text>
            <text class="cnote" x="344" y="207" text-anchor="end"><tspan class="em">+$0.875</tspan></text>
            <rect class="callout" x="372" y="96" width="120" height="60" rx="4"/>
            <text class="cnote" x="382" y="111"><tspan class="em">40% · 40만 토큰</tspan></text>
            <text class="cnote" x="382" y="125">전환 X</text>
            <text class="cnote" x="482" y="125" text-anchor="end">$0.200</text>
            <text class="cnote" x="382" y="138">전환</text>
            <text class="cnote" x="482" y="138" text-anchor="end">$1.600</text>
            <text class="cnote" x="382" y="151">추가</text>
            <text class="cnote" x="482" y="151" text-anchor="end"><tspan class="em">+$1.400</tspan></text>
            <rect class="callout" x="510" y="34" width="120" height="60" rx="4"/>
            <text class="cnote" x="520" y="49"><tspan class="em">60% · 60만 토큰</tspan></text>
            <text class="cnote" x="520" y="63">전환 X</text>
            <text class="cnote" x="620" y="63" text-anchor="end">$0.300</text>
            <text class="cnote" x="520" y="76">전환</text>
            <text class="cnote" x="620" y="76" text-anchor="end">$2.400</text>
            <text class="cnote" x="520" y="89">추가</text>
            <text class="cnote" x="620" y="89" text-anchor="end"><tspan class="em">+$2.100</tspan></text>
            <line class="axis" x1="70" y1="350" x2="620" y2="350"/>
            <text class="tick" x="70" y="370" text-anchor="middle">0</text>
            <text class="tick" x="253.3" y="370" text-anchor="middle">20%</text>
            <text class="tick" x="436.7" y="370" text-anchor="middle">40%</text>
            <text class="tick" x="620" y="370" text-anchor="middle">60%</text>
            <text class="tick" x="70" y="392">전환 시점의 컨텍스트 (1M 창 대비) →</text>
            <line class="line s1" x1="70" y1="416" x2="88" y2="416"/>
            <text class="blabel" x="94" y="420">Sonnet 전환</text>
            <line class="line s2" x1="210" y1="416" x2="228" y2="416"/>
            <text class="blabel" x="234" y="420">Haiku 전환</text>
            <line class="line s4" x1="330" y1="416" x2="348" y2="416"/>
            <text class="blabel" x="354" y="420">전환 X — Opus 캐시 그대로 읽기</text>
          </svg>
        </div>
        <p class="fine">
          전환 직후 <b>한 요청</b>의 값이다. 컨텍스트 전부가 새 모델 캐시로 다시 등록되므로
          <b>새 모델의 쓰기 단가(2×)</b>가 붙는다 — Sonnet 5 $4.00 / 1M, Haiku 4.5 $2 / 1M.
          전환하지 않으면 Opus 5의 캐시 읽기 0.1× = $0.50 / 1M이다.
          Sonnet 5의 $4.00은 <b>도입 단가($2.00) 기준</b>이라 9월부터는 $6.00 / 1M이 된다(02절).
          세 선이 전부 직선인 이유는 값이 <b>컨텍스트 크기에 정비례</b>하기 때문이다.
          전환한 뒤에는 그 모델의 싼 단가로 계속 읽으므로 긴 세션에서는 회수된다 —
          <b>비싼 건 Opus로 되돌아오는 전환</b>이고, 그 선은 여기 Sonnet 선보다 <b>2.5배 가파르다</b>
          (쓰기 $10 / 1M).
        </p>
      </section>
      <section id="s9">
        <div class="sec-head"><span class="num">09</span><h2>캐시를 살린 채 바꾸기 · 한 장 정리</h2></div>
        <p class="lede">
          "대화 중간에 시스템 지시를 추가해야 한다", "툴을 더 줘야 한다" —
          예전엔 캐시를 포기해야 했던 요구들에 이제 우회로가 있다.
        </p>
        <div class="table-scroll">
          <table class="picker">
            <thead><tr><th>바꾸고 싶은 것</th><th>캐시를 살리는 방법</th><th>가용 범위</th></tr></thead>
            <tbody>
              <tr><td>시스템 지시 추가</td>
                <td><span class="k">messages[]</span>에 <span class="k">{"role":"system"}</span> append</td>
                <td>Opus 5 · 4.8 · Fable 5 · Mythos 5 — <strong>베타 헤더 불필요</strong></td></tr>
              <tr><td>툴 추가·제거</td>
                <td><span class="k">tool_addition</span> / <span class="k">tool_removal</span> 블록</td>
                <td>Opus 5 이상, 베타 <span class="k">mid-conversation-tool-changes-2026-07-01</span></td></tr>
              <tr><td>툴이 많아 다 못 실음</td>
                <td>tool search — 교체가 아니라 <strong>추가</strong>로 붙는다</td>
                <td>프리픽스 보존</td></tr>
              <tr><td>싼 모델을 쓰고 싶음</td>
                <td>서브에이전트로 분리, 메인 루프는 한 모델</td>
                <td>모델 전환에는 우회로 없음</td></tr>
            </tbody>
          </table>
        </div>
        <p>
          최상위 <span class="k">system</span>을 고치면 대화 전체의 앞이 바뀌어
          캐시된 모든 턴이 재계산된다. 반면 <span class="k">role: "system"</span> 메시지는
          히스토리 <strong>뒤에</strong> 붙어 프리픽스가 그대로 산다.
        </p>
        <pre class="code">system: [{ type: "text", text: STABLE_CORE, cache_control: {...} }]   // 안 건드림
messages: [
  ...history,                                    // 캐시 유지
  { role: "user",   content: "..." },
  { role: "system", content: "간결 모드 — 40단어 이내로." }   // 프리픽스 뒤
]</pre>
        <h3>효과 순 레버</h3>
        <ol class="steps">
          <li><div><b>컨텍스트 임대 기간을 줄인다</b>
            <span>세션을 단계 경계에서 끊고, 압축은 캐시가 따뜻할 때. 최대 레버.</span></div></li>
          <li><div><b>모델 전환은 세션 경계에서만</b>
            <span>중간 전환 = 전체 재작성. 우회로 없음.</span></div></li>
          <li><div><b>무거운 참조 자료는 늦게 읽는다</b>
            <span>재청구가 시작되는 시점을 미룬다. 통읽기 대신 범위 지정.</span></div></li>
          <li><div><b>대형 툴 출력의 유입을 막는다</b>
            <span>유입 후에는 매 턴 재청구 — 유입 전 차단이 유일한 하드 레버.</span></div></li>
          <li><div><b>툴 정의·시스템 프롬프트를 얼린다</b>
            <span>동적 콘텐츠는 마지막 브레이크포인트 뒤로.</span></div></li>
        </ol>
      </section>
      <p class="fine">
        <b>출처</b><br>
        · 프롬프트 캐싱 규칙 — 05 인용문, 06 브레이크포인트 최대 4개·최소 캐시 길이, 08 무효화 표:
          Anthropic 공식 문서 <a href="https://platform.claude.com/docs/en/build-with-claude/prompt-caching">Prompt caching</a>.
          08 표의 "모델 전환" 행은 공식 표에 없는 이 문서의 추가다(캐시가 모델 스코프라는 규칙에서 나온다)<br>
        · thinking · effort의 캐시 무효화 — 08 인용문: Anthropic 공식 문서
          <a href="https://platform.claude.com/docs/en/build-with-claude/thinking">Thinking</a> § Thinking and prompt caching<br>
        · 모델 단가 — 02: Anthropic 공식 가격표. Sonnet 5 도입 단가 종료일(2026-08-31)과
          토크나이저 배수(1.0~1.35×)는 Anthropic의 Sonnet 5 소개 문서와 가격 분석 기사(SitePoint · Finout)<br>
        · 실측값 — 01 · 03: Opus 5 단일 모델 4시간 세션(816요청)의 트랜스크립트
          <span class="k">usage</span>, 2026-08-09 측정 · 07: 수동 compact 10건 실측(Fable 5 단가 기준)
      </p>
      <footer>
        <span>질문 하나를 던지면 벌어지는 일 · 발표용 v1.34 · 2026-08-09</span>
        <span>심화 · claude-prompt-caching-deep-dive.html</span>
      </footer>
</div>
