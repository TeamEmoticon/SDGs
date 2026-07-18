import assert from "node:assert/strict";
import test from "node:test";
import { assessDomain, isPublicUrl } from "../src/lib/domain.ts";

test("www.gov.kr 은 정확히 일치하는 공식 호스트", () => {
  const domain = assessDomain("https://www.gov.kr/portal");
  assert.ok(domain);
  assert.equal(domain.isExactOfficialHost, true);
});

test("gov.kr.fake-site.com 은 공식 호스트가 아니다", () => {
  const domain = assessDomain("https://gov.kr.fake-site.com/login");
  assert.ok(domain);
  assert.equal(domain.isExactOfficialHost, false);
});

test("localhost 는 로컬/사설로 차단된다", () => {
  const domain = assessDomain("http://localhost:3000/x");
  assert.ok(domain);
  assert.equal(domain.isLocalOrPrivate, true);
  assert.equal(isPublicUrl("http://localhost:3000/x"), false);
});

test("127.0.0.1 은 차단된다", () => {
  const domain = assessDomain("http://127.0.0.1/x");
  assert.ok(domain);
  assert.equal(domain.isLocalOrPrivate, true);
});

test("사설 IP(10.x)는 차단된다", () => {
  const domain = assessDomain("http://10.0.0.5/x");
  assert.ok(domain);
  assert.equal(domain.isLocalOrPrivate, true);
});

test("IPv6 루프백은 차단된다", () => {
  const domain = assessDomain("http://[::1]/x");
  assert.ok(domain);
  assert.equal(domain.isLocalOrPrivate, true);
});

test("punycode 호스트는 경고한다", () => {
  // 유니코드 도메인은 URL 파서가 punycode(xn--)로 변환한다.
  const domain = assessDomain("https://한국.kr");
  assert.ok(domain);
  assert.equal(domain.isPunycode, true);
  assert.ok(domain.warnings.includes("punycode"));
});

test("URL 사용자 정보 포함은 경고한다", () => {
  const domain = assessDomain("https://user:pass@example.com");
  assert.ok(domain);
  assert.equal(domain.hasCredentials, true);
  assert.ok(domain.warnings.includes("embedded_credentials"));
});

test("http 주소는 경고한다", () => {
  const domain = assessDomain("http://example.com");
  assert.ok(domain);
  assert.equal(domain.usesHttps, false);
  assert.ok(domain.warnings.includes("insecure_http"));
});

test("IP 주소 직접 사용은 경고한다", () => {
  const domain = assessDomain("http://93.184.216.34/x");
  assert.ok(domain);
  assert.equal(domain.isIpAddress, true);
  assert.ok(domain.warnings.includes("ip_address"));
});

test("알려진 단축 URL은 표시한다", () => {
  const domain = assessDomain("https://bit.ly/abcd");
  assert.ok(domain);
  assert.equal(domain.isKnownShortener, true);
  assert.ok(domain.warnings.includes("known_shortener"));
});

test("파싱 불가한 주소는 null", () => {
  assert.equal(assessDomain("그냥 문장"), null);
});
