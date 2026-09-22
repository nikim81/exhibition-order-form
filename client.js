const SUPABASE_URL = "https://vprrojsdepyejacawqew.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_kyKuvP9RRYKJaCH7mg_bGQ_skGfgjpB";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const COLUMNS = ["판매처","주문번호","주문일","상품명","상품코드","옵션명","수량","주문금액","업체명","수취인","연락처","우편번호","주소","배송희망일자","배송메세지"];
