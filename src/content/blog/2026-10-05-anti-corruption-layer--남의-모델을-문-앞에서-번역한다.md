---
title: "Anti-Corruption Layer — 남의 모델을 문 앞에서 번역한다"
date: 2026-10-05
category: 개발
tags: ["Spring", "DDD", "아키텍처", "Anti-Corruption-Layer"]
series: "Java Spring"
episode: 1
description: "고칠 수 없는 외부 시스템과 연동하면 그 시스템의 용어와 코드값이 내 도메인으로 번진다. 상류·하류부터 시작해 ACL 이 무엇을 막고 Spring 에서 어떻게 세우는지 정리한다."
---

외부 API 하나를 붙이는 일은 보통 하루면 끝난다. 문제는 몇 달 뒤에 온다. 외부 응답의
필드 이름과 코드값이 서비스 · 화면 · 테스트 곳곳에 박혀 있다. 상대가 필드 하나를
바꾸면 고칠 곳이 수십 군데다.

Anti-Corruption Layer(ACL)는 이 상황을 막는 패턴이다. Eric Evans 가 *Domain-Driven
Design*(2003) 14장에서 이름을 붙였다. 이 글은 ACL 을 이해하는 데 필요한 말부터 정리한다.
그다음 ACL 이 막는 문제를 보고, Spring 에서 세우는 방법으로 넘어간다.

## 먼저 상류와 하류

ACL 설명은 상류(upstream)와 하류(downstream)라는 말로 시작한다. 이 두 말은 **누구의
변경이 누구에게 번지는지**를 나타낸다.

강을 떠올리면 쉽다. 상류에서 물을 더럽히면 하류가 피해를 본다. 하류에서 무엇을 해도
상류는 영향을 받지 않는다. 시스템도 같다.

- **상류**: 모델과 인터페이스를 정해서 내주는 쪽이다. 상류가 바뀌면 하류가 따라 고친다.
- **하류**: 그것을 가져다 쓰는 쪽이다. 하류가 바뀌어도 상류는 그대로다.

판별법은 질문 하나다. "A 가 인터페이스를 바꾸면 B 가 고쳐야 하나?" 답이 "그렇다"면
A 가 상류고 B 가 하류다.

| 관계 | 인터페이스를 정하는 쪽 | 상류 | 하류 |
| --- | --- | --- | --- |
| 프런트엔드 ↔ 내 백엔드 | 백엔드(API 계약) | 백엔드 | 프런트엔드 |
| 내 백엔드 ↔ 택배사 API | 택배사(응답 모양) | 택배사 | 백엔드 |

헷갈리기 쉬운 점이 셋 있다.

1. **호출 방향과 다르다.** 프런트엔드가 백엔드를 먼저 부르지만 프런트엔드가 하류다.
2. **데이터 방향과 다르다.** 데이터는 양쪽으로 흐른다. 계약을 정하는 쪽은 하나다.
3. **계층의 안팎과 다르다.** 상류 · 하류는 시스템이나 팀 사이의 관계다. 한 애플리케이션
   안의 층 구분이 아니다.

ACL 은 **하류가 만드는 장치**다. 이 글의 예에서는 택배사 API 를 쓰는 내 백엔드가 하류다.

## 문제: 남의 모델이 내 모델로 번진다

출발점은 흔한 상황이다.

- 내 시스템이 남의 시스템과 연동해야 한다.
- 남의 시스템은 내가 고칠 수 없다.
- 남의 개념 · 이름 · 구조가 내 것과 다르다.

이때 연동 코드를 아무 대비 없이 짜면 파생 문제가 생긴다. Evans 는 이것을 "오염
(corruption)"이라고 부른다.

1. 연동 코드가 상대 타입과 용어를 그대로 쓴다.
2. 처음에는 연동 코드에만 있다. 시간이 지나면 서비스 · 도메인 코드까지 퍼진다.
3. 결국 내 모델이 상대 모델을 닮아 간다.

Evans 가 직접 정리한 *DDD Reference*(2015)는 이렇게 적는다.

> A large interface with an upstream system can eventually overwhelm the intent of
> the downstream model altogether, causing it to be modified to resemble the other
> system's model in an ad hoc fashion.

상류의 큰 인터페이스가 하류 모델의 의도를 덮어쓴다는 말이다. 하류 모델은 그때그때
상류 모델을 닮도록 고쳐진다.

택배사 응답이 아래와 같다고 해 보자.

```json
{ "inv_no": "6012345678", "stat_cd": "05", "dlv_dt": "20261005" }
```

오염된 코드에서는 `"05".equals(r.getStatCd())` 같은 비교가 주문 서비스 · 알림 서비스 ·
관리자 화면에 흩어진다. "05 는 배송 완료"라는 택배사의 약속이 내 도메인 규칙이 된다.
택배사가 코드 체계를 바꾸면 그 비교를 전부 찾아 고쳐야 한다.

### 레거시만의 문제가 아니다

원문은 두 경우를 함께 든다.

1. 레거시 시스템의 모델은 대개 약하거나 엉켜 있다.
2. 잘 설계된 상대라도 지금 내 프로젝트의 필요에 맞지 않을 수 있다.

그래서 상대가 깔끔하고 최신이어도 모델이 다르면 ACL 을 둘 이유가 있다.

### interface 로는 왜 안 막히나

Java 개발자라면 "interface 를 두면 되지 않나" 하고 묻게 된다. interface 와 ACL 은
막는 대상이 다르다.

- **interface 와 구현**은 호출 모양을 맞춘다. 어떤 메서드를 어떤 인자로 부르는지 정한다.
- **ACL** 은 뜻을 맞춘다. 상대의 이 개념이 내 모델에서 무엇인지 정한다.

interface 가 아무리 깔끔해도 그 인자와 반환 타입이 상대의 타입이면 오염은 그대로 일어난다.
`CarrierResponse getDelivery(String invNo)` 라는 interface 는 택배사 모델을 내 코드
전체에 퍼뜨리는 통로일 뿐이다.

## 접근: 후보 셋과 추천

후보는 셋이다.

| 후보 | 하는 일 | 비용 | 판단 |
| --- | --- | --- | --- |
| 상대 타입을 그대로 쓴다 (Conformist) | 택배사 응답 타입을 서비스까지 넘긴다 | 변환 코드 없음 | 버린다. 코드값 비교가 도메인 곳곳에 박힌다 |
| 도메인 타입에 Jackson 애너테이션을 붙여 바로 받는다 | `@JsonProperty("stat_cd")` 를 도메인 record 에 붙인다 | 타입 한 벌 | 버린다. 도메인이 상대의 JSON 모양을 안다. `"05"` → 상태 변환은 여전히 할 곳이 없다 |
| **ACL 을 둔다** | 경계에서 상대 모델을 내 모델로 번역한다 | 타입 두 벌 + 번역 코드 | **추천.** 상대가 바뀌면 이 층만 고친다 |

Conformist 도 Evans 가 정리한 정식 선택지다. 상대 모델이 잘 설계되어 있고 내 모델과
거의 같다면 변환 비용을 아끼는 편이 낫다. 연동 범위가 작을 때도 그렇다.

## ACL 의 처방

*DDD Reference* 의 처방은 네 줄이다.

1. 하류가 상류와 자기 사이에 격리 층을 둔다.
2. 이 층은 상류의 기능을 하류 자기 도메인 모델의 말로 내준다.
3. 이 층은 상류의 기존 인터페이스로 말한다. 상류는 거의 고치지 않는다.
4. 층 안에서 두 모델 사이를 한쪽 또는 양쪽으로 번역한다.

책 14장은 층 안을 세 역할로 나눠 설명한다.

| 역할 | 하는 일 |
| --- | --- |
| Facade | 상대의 크고 복잡한 API 를 내가 쓰는 부분만 단순하게 감싼다 |
| Translator | 상대 개념을 내 개념으로 바꾼다. 상태가 없는 순수 변환이다 |
| Adapter | 내 포트를 구현한다. Facade 로 데이터를 받고 Translator 로 바꿔 돌려준다 |

역할 구분이 핵심이다. 클래스 개수는 핵심이 아니다. 작은 연동이면 세 역할을 클래스
하나에 넣어도 된다.

## Spring 으로 세우기

택배사 배송 조회를 예로 든다. Spring Framework 6.1 이상(Spring Boot 3.2 이상)의
`RestClient` 를 쓴다.

### 순서

1. 내 도메인에 필요한 것을 내 말로 정한다. 이것이 포트 interface 다.
2. ACL 패키지를 따로 만든다.
3. ACL 패키지 안에 상대 응답 모양을 그대로 옮긴 타입을 둔다.
4. Facade · Translator · Adapter 를 만든다.
5. 포트 interface 말고는 전부 package-private 으로 둔다.
6. 의존 방향을 테스트로 고정한다.

### 패키지 모양

```text
com.example.shop
├── order/                          ← 내 도메인. carrier 를 모른다
│   ├── OrderService.java
│   ├── Shipment.java
│   ├── ShipmentStatus.java
│   ├── TrackingNumber.java
│   ├── TrackingUnavailableException.java
│   └── ShipmentTracker.java        ← 포트 (public)
└── carrier/                        ← ACL. 전부 package-private
    ├── CarrierResponse.java        ← 상대 응답 모양
    ├── CarrierClient.java          ← Facade
    ├── CarrierTranslator.java      ← Translator
    └── CarrierShipmentTracker.java ← Adapter
```

의존은 `carrier → order` 한 방향이다. `order` 는 `carrier` 의 이름을 하나도 모른다.

### 포트: 내 말로 정한다

포트는 택배사 API 를 보고 만들지 않는다. 주문 도메인이 무엇을 알고 싶은지를 보고 만든다.

```java
package com.example.shop.order;

public interface ShipmentTracker {
    Optional<Shipment> find(TrackingNumber number);
}

public record Shipment(TrackingNumber number, ShipmentStatus status, LocalDate deliveredOn) {}

public enum ShipmentStatus { ACCEPTED, IN_TRANSIT, DELIVERED, UNKNOWN }
```

주문 서비스는 이 포트만 안다.

```java
@Service
public class OrderService {
    private final ShipmentTracker tracker;

    public OrderService(ShipmentTracker tracker) {
        this.tracker = tracker;
    }

    public boolean isDelivered(TrackingNumber number) {
        return tracker.find(number)
                .map(s -> s.status() == ShipmentStatus.DELIVERED)
                .orElse(false);
    }
}
```

`"05"` 도 `stat_cd` 도 여기에는 없다.

### 상대 응답 모양: ACL 안에 가둔다

```java
package com.example.shop.carrier;

record CarrierResponse(
        @JsonProperty("inv_no") String invNo,
        @JsonProperty("stat_cd") String statCd,
        @JsonProperty("dlv_dt") String dlvDt) {}
```

Jackson 애너테이션은 이 record 에만 붙는다. 도메인 타입은 JSON 모양을 모른다.

### Facade: 상대 API 를 감싼다

```java
@Component
class CarrierClient {
    private final RestClient http;

    CarrierClient(RestClient.Builder builder, @Value("${carrier.base-url}") String baseUrl) {
        this.http = builder.baseUrl(baseUrl).build();
    }

    CarrierResponse delivery(String invoiceNo) {
        return http.get()
                .uri("/v1/dlv?inv_no={no}", invoiceNo)
                .retrieve()
                .body(CarrierResponse.class);
    }
}
```

택배사 API 에 엔드포인트가 스무 개 있어도 Facade 는 내가 쓰는 하나만 드러낸다.

### Translator: 뜻을 바꾼다

```java
final class CarrierTranslator {
    private CarrierTranslator() {}

    static Shipment toShipment(CarrierResponse r) {
        return new Shipment(new TrackingNumber(r.invNo()), status(r.statCd()), date(r.dlvDt()));
    }

    static ShipmentStatus status(String code) {
        if (code == null) return ShipmentStatus.UNKNOWN;
        return switch (code) {
            case "01", "02" -> ShipmentStatus.ACCEPTED;
            case "03", "04" -> ShipmentStatus.IN_TRANSIT;
            case "05" -> ShipmentStatus.DELIVERED;
            default -> ShipmentStatus.UNKNOWN;
        };
    }

    static LocalDate date(String yyyymmdd) {
        if (yyyymmdd == null || yyyymmdd.isBlank()) return null;
        return LocalDate.parse(yyyymmdd, DateTimeFormatter.BASIC_ISO_DATE);
    }
}
```

"05 는 배송 완료"라는 지식이 이 파일 한 곳에만 있다. 번역할 때 정할 것은 대개 넷이다.

1. 상대에만 있는 필드는 버리거나 내 개념으로 묶는다.
2. 상대의 코드값과 문자열은 내 enum 이나 sealed 타입으로 바꾼다.
3. 상대의 null · 빈 문자열 · 날짜 표기는 내 규칙으로 바꾼다.
4. 모르는 값이 오면 어떻게 할지 정한다. 위 예는 `UNKNOWN` 으로 받는다.

Translator 는 상태가 없는 static 함수라서 Spring 없이 단위 테스트를 할 수 있다.

### Adapter: 포트를 구현하고 오류도 번역한다

```java
@Component
class CarrierShipmentTracker implements ShipmentTracker {
    private final CarrierClient carrier;

    CarrierShipmentTracker(CarrierClient carrier) {
        this.carrier = carrier;
    }

    @Override
    public Optional<Shipment> find(TrackingNumber number) {
        try {
            return Optional.ofNullable(carrier.delivery(number.value()))
                    .map(CarrierTranslator::toShipment);
        } catch (HttpClientErrorException.NotFound e) {
            return Optional.empty();
        } catch (RestClientException e) {
            throw new TrackingUnavailableException(number, e);
        }
    }
}
```

오류도 번역 대상이다. 404 는 "그런 송장 없음"이라는 내 말(`Optional.empty()`)로 바꾼다.
나머지 통신 오류는 `order` 패키지의 `TrackingUnavailableException` 으로 바꾼다.
`RestClientException` 이 주문 서비스까지 올라가면 그것도 오염이다.

Spring 은 package-private `@Component` 클래스도 스캔해서 빈으로 만든다. 그래서 ACL 의
구현 클래스를 밖에 드러낼 필요가 없다.

## 경계 지키기

Alistair Cockburn 은 Hexagonal Architecture 원문(2005)에서 이렇게 지적한다. "이번 층에는
로직을 넣지 않는다"는 약속은 위반을 잡는 장치가 없으면 몇 년 뒤 깨진다. ACL 도 같다.
누군가 급해서 `CarrierResponse` 를 public 으로 바꾸고 서비스로 넘기는 순간 경계가 무너진다.

장치는 두 겹이다.

1. **package-private.** 컴파일러가 `order` 에서 `carrier` 타입을 쓰는 코드를 막는다.
2. **ArchUnit 테스트.** 누가 접근 제한을 풀어도 빌드가 실패한다.

```java
@AnalyzeClasses(packages = "com.example.shop")
class BoundaryTest {
    @ArchTest
    static final ArchRule order_does_not_know_carrier =
            noClasses().that().resideInAPackage("..order..")
                    .should().dependOnClassesThat().resideInAPackage("..carrier..");
}
```

## Hexagonal 과의 관계

구조만 보면 ACL 은 Hexagonal Architecture 의 어댑터와 같은 모양이다. 안쪽이 자기 말로
포트를 정하고, 어댑터가 그 포트를 구현한다. 두 패턴은 강조하는 곳이 다르다.

- **Hexagonal** 은 기술을 갈아 끼우는 것을 강조한다. 진짜 DB 를 메모리 가짜로,
  SQL 을 파일로 바꾸는 식이다.
- **ACL** 은 개념을 번역하는 것을 강조한다. `"05"` 를 `DELIVERED` 로 바꾸는 일이다.

## 반대편: 내가 상류일 때

ACL 은 하류의 장치다. 내 백엔드가 API 를 내주는 상류라면 쓸 패턴이 따로 있다.
*DDD Reference* 의 Published Language 다.

> If one is used as a data interchange language, it essentially becomes frozen and
> cannot respond to new development needs.

도메인 모델을 그대로 교환 언어로 쓰면 그 모델이 굳는다는 말이다. 그래서 API 응답 타입을
도메인 타입과 따로 둔다. 하류의 ACL 과 상류의 Published Language 는 같은 생각을 양쪽에서
적용한 것이다. 모양이 같아도 경계 양쪽의 타입을 섞지 않는다.

## 얻는 것과 치르는 것

- **얻는 것**: 상대가 바뀌면 ACL 패키지만 고친다. 도메인 모델은 내 필요대로 바꿀 수 있다.
  번역 규칙이 한 파일에 모여 테스트하기 쉽다.
- **치르는 것**: 타입이 두 벌이다. 번역 코드가 늘어난다.
- **쓰지 않을 때**: 상대 모델이 내 모델과 거의 같고 연동 범위가 작다. 이때는 Conformist
  가 싸다.

## 출처

- Eric Evans, *Domain-Driven Design: Tackling Complexity in the Heart of Software*, 2003, 14장
- Eric Evans, [Domain-Driven Design Reference](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf), 2015 — Anticorruption Layer · Conformist · Published Language
- Alistair Cockburn, [Hexagonal architecture](https://alistair.cockburn.us/hexagonal-architecture/), 2005
- [ArchUnit User Guide](https://www.archunit.org/userguide/html/000_Index.html)
