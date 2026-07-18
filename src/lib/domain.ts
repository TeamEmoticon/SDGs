// domain.ts
import { SEVERITY_WEIGHT } from "./ruleDefinitions.ts";
import type { Severity, Signal } from "./types.ts";

export type DomainWarningCode =
  | "insecure_http"
  | "ip_address"
  | "local_or_private"
  | "punycode"
  | "embedded_credentials"
  | "known_shortener"
  | "overlong_hostname"
  | "unusual_port"
  | "lookalike_official";

export interface DomainAssessment {
  readonly hostname: string;
  readonly isExactOfficialHost: boolean;
  readonly isIpAddress: boolean;
  readonly isLocalOrPrivate: boolean;
  readonly isPunycode: boolean;
  readonly hasCredentials: boolean;
  readonly usesHttps: boolean;
  readonly isKnownShortener: boolean;
  readonly warnings: readonly DomainWarningCode[];
}

/** 공식으로 인정할 호스트. 반드시 정확히 일치(has)할 때만 공식으로 본다. */
const OFFICIAL_HOSTS: ReadonlySet<string> = new Set([
  "gov.kr",
  "www.gov.kr",
  "korea.kr",
  "www.korea.kr",
  "kdca.go.kr",
  "www.kdca.go.kr",
  "fss.or.kr",
  "www.fss.or.kr",
  "police.go.kr",
  "www.police.go.kr",
  "kisa.or.kr",
  "www.kisa.or.kr",
]);

/** 알려진 URL 단축 서비스(호스트 정확 일치). rules.ts의 단축주소 목록과 맞춘다. */
const KNOWN_SHORTENERS: ReadonlySet<string> = new Set([
  "bit.ly",
  "tinyurl.com",
  "me2.kr",
  "ko.gl",
  "t.me",
  "goo.gl",
  "buly.kr",
  "han.gl",
  "url.kr",
]);

const MAX_HOSTNAME_LENGTH = 75;
const OFFICIAL_MARKERS: ReadonlySet<string> = new Set(["gov", "korea", "kdca", "fss", "police", "kisa"]);

const DOMAIN_WARNING_META: Readonly<
  Partial<Record<DomainWarningCode, { readonly label: string; readonly detail: string; readonly severity: Severity }>>
> = {
  insecure_http: { label: "암호화되지 않은 주소", detail: "https가 아닌 주소입니다. 개인정보를 입력하거나 파일을 내려받지 마세요.", severity: "low" },
  ip_address: { label: "IP 주소 링크", detail: "도메인 이름 대신 IP 주소를 쓰는 링크는 출처를 확인하기 어렵습니다.", severity: "high" },
  punycode: { label: "비슷한 글자 도메인", detail: "주소에 비슷한 글자를 섞어 공식 사이트처럼 보이게 할 수 있습니다.", severity: "high" },
  embedded_credentials: { label: "주소에 숨은 계정 정보", detail: "주소 안에 사용자 이름이나 비밀번호 형식이 들어 있어 특히 주의해야 합니다.", severity: "high" },
  known_shortener: { label: "단축 주소", detail: "실제 연결 주소가 숨겨진 단축 링크입니다. 문자에서 받은 링크는 열지 마세요.", severity: "high" },
  overlong_hostname: { label: "지나치게 긴 주소", detail: "주소가 지나치게 길어 공식 사이트와 다른 부분을 알아보기 어렵습니다.", severity: "medium" },
  unusual_port: { label: "낯선 접속 포트", detail: "일반 웹주소에서 드문 포트를 사용합니다. 공식 주소인지 다시 확인하세요.", severity: "medium" },
  lookalike_official: { label: "공식 기관을 흉내 낸 주소", detail: "공식 기관 이름과 비슷하지만 정확히 일치하지 않는 주소입니다.", severity: "high" },
};

function isIpv4(host: string): boolean {
  return /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(host);
}

function isIpAddress(host: string): boolean {
  // new URL()은 IPv6를 대괄호 없는 형태(예: "::1", "fc00::1")로 hostname에 담는다.
  return isIpv4(host) || host.includes(":");
}

function isLocalOrPrivate(host: string): boolean {
  if (host === "localhost" || host.endsWith(".local")) return true;
  if (host === "::1" || host === "0.0.0.0") return true;
  if (isIpv4(host)) {
    if (/^127\./.test(host)) return true;
    if (/^10\./.test(host)) return true;
    if (/^192\.168\./.test(host)) return true;
    if (/^169\.254\./.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  }
  // IPv6 ULA / link-local
  if (/^f[cd][0-9a-f]{0,2}:/.test(host) || host.startsWith("fe80:")) return true;
  return false;
}

function isPunycode(host: string): boolean {
  return host.split(".").some((label) => label.startsWith("xn--"));
}

function isOfficialLookalike(host: string): boolean {
  if (OFFICIAL_HOSTS.has(host)) return false;
  return host.split(/[.-]/).some((part) => OFFICIAL_MARKERS.has(part));
}

/** URL 문자열을 검사한다. 파싱 불가면 null(형식 오류). */
export function assessDomain(rawUrl: string): DomainAssessment | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  // IPv6 호스트는 URL.hostname이 대괄호를 포함해 준다([::1]) → 벗겨서 비교한다.
  const hostname = url.hostname.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (hostname.length === 0) return null;

  const ipAddress = isIpAddress(hostname);
  const localOrPrivate = isLocalOrPrivate(hostname);
  const punycode = isPunycode(hostname);
  const hasCredentials = url.username !== "" || url.password !== "";
  const usesHttps = url.protocol === "https:";
  const knownShortener = KNOWN_SHORTENERS.has(hostname);
  const unusualPort = url.port !== "" && url.port !== "80" && url.port !== "443";
  const officialLookalike = isOfficialLookalike(hostname);

  const warnings: DomainWarningCode[] = [];
  if (!usesHttps) warnings.push("insecure_http");
  if (ipAddress) warnings.push("ip_address");
  if (localOrPrivate) warnings.push("local_or_private");
  if (punycode) warnings.push("punycode");
  if (hasCredentials) warnings.push("embedded_credentials");
  if (knownShortener) warnings.push("known_shortener");
  if (hostname.length > MAX_HOSTNAME_LENGTH) warnings.push("overlong_hostname");
  if (unusualPort) warnings.push("unusual_port");
  if (officialLookalike) warnings.push("lookalike_official");

  return {
    hostname,
    isExactOfficialHost: OFFICIAL_HOSTS.has(hostname),
    isIpAddress: ipAddress,
    isLocalOrPrivate: localOrPrivate,
    isPunycode: punycode,
    hasCredentials,
    usesHttps,
    isKnownShortener: knownShortener,
    warnings,
  };
}

export function domainSignals(assessment: DomainAssessment): Signal[] {
  return assessment.warnings.flatMap((warning) => {
    const meta = DOMAIN_WARNING_META[warning];
    if (meta === undefined) return [];
    return [{
      id: `domain-${warning}`,
      category: "link",
      severity: meta.severity,
      label: meta.label,
      detail: meta.detail,
      matched: assessment.hostname,
      weight: SEVERITY_WEIGHT[meta.severity],
    }];
  });
}

/** 공개적으로 접근 가능한(로컬/사설이 아닌) 유효한 http(s) URL인지. */
export function isPublicUrl(rawUrl: string): boolean {
  const assessment = assessDomain(rawUrl);
  return assessment !== null && !assessment.isLocalOrPrivate;
}
