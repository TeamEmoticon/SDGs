// examples.ts
// "예시로 연습하기" 목록에 쓰이는 연습용 문자 원문 데이터
// (prize 예시 본문 속 이모지는 실제 사기 문자의 특징을 재현하기 위해 의도적으로 남겨둠)
/** Practice examples that fill the textarea so users can try the tool safely. */

export interface Example {
  id: string;
  title: string;
  subtitle: string;
  content: string;
}

export const EXAMPLES: Example[] = [
  {
    id: "phishing",
    title: "검찰 사칭 보이스피싱",
    subtitle: "매우 흔한 사기 문자",
    content: `[Web발신]
대검찰청 중앙지검 정보수사과 검사 김정훈입니다.
고객님 명의가 대포통장에 불법 사용되어 형사고소 위기에 처했습니다.
오늘 중 출석요구서 발부 전에 해명하셔야 합니다.
피해 금액 정산을 위해 아래 가상계좌로 즉시 입금해 주세요.
농협 356-1234-5678-99 예금주 홍길동
문의: 010-1234-5678`,
  },
  {
    id: "family",
    title: "가족인 척 지인 사칭",
    subtitle: "번호가 바뀌었다며 접근",
    content: `엄마 나야~ 폰이 바뀌었어 번호 좀 저장해둬.
지금 통화 못하는 상황이라 카톡으로 연락해.
내 계좌 이체 한도가 걸려서 급한데 돈 좀 보내줄 수 있어?
국민은행 123-456-789012 예금주 나야`,
  },
  {
    id: "prize",
    title: "당첨·경품 미끼",
    subtitle: "링크를 누르게 만드는 사기",
    content: `[Web발신]
고객님, 창사기념 이벤트에 당첨되셨습니다! 축하드립니다 🎉
경품 수령을 위해 아래 링크를 클릭해 인증번호를 입력해 주세요.
http://event-prize-winner.kr/claim?id=7782
24시간 안에 입력하지 않으면 당첨이 취소됩니다.`,
  },
  {
    id: "delivery",
    title: "택배 배송 사칭",
    subtitle: "주소 오류를 핑계로 링크 유도",
    content: `[Web발신]
[대한통운] 고객님의 택배가 주소 오류로 반송 예정입니다.
아래 주소에서 배송지를 다시 확인해 주세요.
http://cvs-delivery-kr.com/track?t=8842
확인하지 않으시면 오늘 중 반송됩니다.`,
  },
  {
    id: "gov",
    title: "정상적인 관공서 안내",
    subtitle: "위험 요소가 없는 안내문",
    content: `[시청 복지과] 어르신 스마트폰 보이스피싱 예방 교육을 안내합니다.
- 일시: 매주 수요일 오후 2시
- 장소: 시청 복지관 3층 교육실
- 참가비: 무료
참여를 원하시면 직접 방문 또는 대표전화로 신청해 주세요.`,
  },
  {
    id: "family-ok",
    title: "가족의 일상 연락",
    subtitle: "걱정할 내용이 없는 문자",
    content: `할머니 저예요~ 오늘 저녁에 늦을 것 같아요.
저녁 미리 챙겨 드시고 계세요. 늦게라도 전화할게요. 사랑해요!`,
  },
];
