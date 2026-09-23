// 원본: 사방넷 품번코드 리스트.xlsx > 상품코드 시트 (E열 = 사방넷 업로드용 실제 코드)
const PRODUCTS = [
  { name: "시그니처2플러스", code: "100167", option: "밀크화이트", image: "images/920039-milkwhite.png" },
  { name: "시그니처2플러스", code: "100168", option: "바닐라크림", image: "images/920031-vanillacream.png" },
  { name: "시그니처2플러스", code: "100169", option: "라이트그레이", image: "images/920030-lightgray.png" },
  { name: "시그니처2플러스", code: "100170", option: "베이비핑크", image: "images/920032-babypink.png" },
  { name: "시그니처2플러스", code: "100171", option: "베이비블루", image: "images/920033-babyblue.png" },
  { name: "시그니처2플러스", code: "100235", option: "매트블랙", image: "images/920034-black.png" },
  { name: "시그니처2플러스+ACC3종(세로,수납,다용도)", code: "100167", option: "밀크화이트+ACC3종" },
  { name: "시그니처2플러스+ACC3종(세로,수납,다용도)", code: "100168", option: "바닐라크림+ACC3종" },
  { name: "시그니처2플러스+ACC3종(세로,수납,다용도)", code: "100169", option: "라이트그레이+ACC3종" },
  { name: "시그니처2플러스+ACC3종(세로,수납,다용도)", code: "100170", option: "베이비핑크+ACC3종" },
  { name: "시그니처2플러스+ACC3종(세로,수납,다용도)", code: "100171", option: "베이비블루+ACC3종" },
  { name: "시그니처2플러스+ACC3종(세로,수납,다용도)", code: "100235", option: "매트블랙+ACC3종" },
  { name: "시그니처2플러스+ACC4종(세로,수납,다용도,멀티트레이)", code: "100167", option: "밀크화이트+ACC4종" }, // TODO: ACC4종은 사방넷 리스트에 없는 조합, 본품 코드로 대체(구성품은 개별 코드로 분리 전송)
  { name: "시그니처2플러스+ACC4종(세로,수납,다용도,멀티트레이)", code: "100168", option: "바닐라크림+ACC4종" },
  { name: "시그니처2플러스+ACC4종(세로,수납,다용도,멀티트레이)", code: "100169", option: "라이트그레이+ACC4종" },
  { name: "시그니처2플러스+ACC4종(세로,수납,다용도,멀티트레이)", code: "100170", option: "베이비핑크+ACC4종" },
  { name: "시그니처2플러스+ACC4종(세로,수납,다용도,멀티트레이)", code: "100171", option: "베이비블루+ACC4종" },
  { name: "시그니처2플러스+ACC4종(세로,수납,다용도,멀티트레이)", code: "100235", option: "매트블랙+ACC4종" },
  { name: "ACC", code: "100001", option: "세로형거치대", image: "images/세로형거치대.png" },
  { name: "ACC", code: "100000", option: "수납형거치대", image: "images/수납현거치대.png" },
  { name: "ACC", code: "100003", option: "멀티거치대 2종세트" },
  { name: "ACC", code: "100002", option: "다용도걸이", image: "images/다용도걸이.png" },
  { name: "ACC", code: "100162", option: "멀티선반", image: "images/멀티선반.png" },
  { name: "[사은품] 헤이홈 스마트 홈카메라", code: "100205", option: "[증정]홈카메라", image: "images/헤이홈.png" },
  { name: "[사은품] 보아르 쑥쑥 분유쉐이커", code: "100206", option: "[증정]분유쉐이커" },
  { name: "[사은품] 닌자 초퍼 블랜더", code: "100207", option: "[증정]초퍼블랜더" }, // TODO: 임의 코드, 사방넷 실제 코드로 교체 필요
];
