const SUPABASE_URL = "https://vprrojsdepyejacawqew.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_kyKuvP9RRYKJaCH7mg_bGQ_skGfgjpB";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const COLUMNS = ["판매처","주문번호","주문일","상품명","상품코드","옵션명","수량","주문금액","업체명","수취인","연락처","우편번호","주소","배송희망일자","배송메세지"];

// 고객이 직접 입력하는 값(수취인/주소/배송메세지 등)을 innerHTML로 그릴 때 이스케이프 처리 (저장형 XSS 방지)
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Supabase는 한 번에 최대 1000행만 돌려주므로, 주문이 많아져도 빠지지 않게 페이지 단위로 모두 읽어옴
async function fetchAll(table, build) {
  const size = 1000;
  let all = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await build(sb.from(table).select("*")).range(from, from + size - 1);
    if (error) return { data: null, error };
    all = all.concat(data);
    if (data.length < size) return { data: all, error: null };
  }
}
