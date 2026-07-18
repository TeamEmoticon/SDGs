// domain.ts
// URL/도메인 검사. 진위를 확정하지 않고, 위험 점수 보조 신호와 분석 라우팅 보조로만 쓴다.
// 공식 호스트는 "정확히 일치"할 때만 인정한다(부분 문자열 비교 금지).

export type DomainWarningCode =
  | "insecure_http"
  | "ip_address"
  | "local_or_private"
  | "punycode"
  | "embedded_credentials"
  | "known_shortener"
  | "overlong_hostname"
  | "unusual_port";

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

  const warnings: DomainWarningCode[] = [];
  if (!usesHttps) warnings.push("insecure_http");
  if (ipAddress) warnings.push("ip_address");
  if (localOrPrivate) warnings.push("local_or_private");
  if (punycode) warnings.push("punycode");
  if (hasCredentials) warnings.push("embedded_credentials");
  if (knownShortener) warnings.push("known_shortener");
  if (hostname.length > MAX_HOSTNAME_LENGTH) warnings.push("overlong_hostname");
  if (unusualPort) warnings.push("unusual_port");

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

/** 공개적으로 접근 가능한(로컬/사설이 아닌) 유효한 http(s) URL인지. */
export function isPublicUrl(rawUrl: string): boolean {
  const assessment = assessDomain(rawUrl);
  return assessment !== null && !assessment.isLocalOrPrivate;
}
