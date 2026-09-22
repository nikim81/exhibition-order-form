const SUPABASE_URL = "https://vprrojsdepyejacawqew.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_kyKuvP9RRYKJaCH7mg_bGQ_skGfgjpB";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const COLUMNS = ["판매처","주문번호","주문일","상품명","상품코드","옵션명","수량","주문금액","업체명","수취인","연락처","우편번호","주소","배송희망일자","배송메세지"];

const $ = (id) => document.getElementById(id);
let editingId = null;
let orders = [];

// ---- product dropdowns ----
const productNames = [...new Set(PRODUCTS.map(p => p.name))];
function fillProductSelect() {
  const sel = $("f-상품명");
  sel.innerHTML = productNames.map(n => `<option value="${n}">${n}</option>`).join("");
  fillOptionSelect();
}
function fillOptionSelect() {
  const name = $("f-상품명").value;
  const opts = PRODUCTS.filter(p => p.name === name);
  $("f-옵션").innerHTML = opts.map(o => `<option value="${o.code}|||${o.option}">${o.option} (${o.code})</option>`).join("");
}
$("f-상품명").addEventListener("change", fillOptionSelect);
fillProductSelect();

// ---- default field values ----
function today() { return new Date().toISOString().slice(0, 10); }
function resetForm() {
  editingId = null;
  $("form-title").textContent = "주문 입력";
  $("submit-btn").textContent = "주문 저장";
  $("cancel-edit-btn").classList.add("hidden");
  $("f-판매처").value = localStorage.getItem("판매처_default") || "박람회";
  $("f-주문일").value = today();
  $("f-업체명").value = "";
  fillProductSelect();
  $("f-수량").value = 1;
  $("f-주문금액").value = "";
  $("f-수취인").value = "";
  $("f-연락처").value = "";
  $("f-우편번호").value = "";
  $("f-배송희망일자").value = "";
  $("f-주소").value = "";
  $("f-배송메세지").value = "";
  $("f-동의").checked = false;
  $("err").textContent = "";
}

function genOrderNo() {
  const d = new Date();
  const stamp = d.toISOString().slice(0,10).replace(/-/g,"");
  return `EXPO${stamp}${Math.floor(Math.random()*9000+1000)}`;
}

function readForm() {
  const [코드, 옵션] = $("f-옵션").value.split("|||");
  return {
    판매처: $("f-판매처").value.trim(),
    주문일: $("f-주문일").value,
    상품명: $("f-상품명").value,
    상품코드: 코드,
    옵션명: 옵션,
    수량: Number($("f-수량").value) || 1,
    주문금액: $("f-주문금액").value ? Number($("f-주문금액").value) : null,
    업체명: $("f-업체명").value.trim(),
    수취인: $("f-수취인").value.trim(),
    연락처: $("f-연락처").value.trim(),
    우편번호: $("f-우편번호").value.trim(),
    주소: $("f-주소").value.trim(),
    배송희망일자: $("f-배송희망일자").value,
    배송메세지: $("f-배송메세지").value.trim(),
    개인정보동의: $("f-동의").checked,
  };
}

$("submit-btn").addEventListener("click", async () => {
  const data = readForm();
  if (!data.수취인 || !data.연락처 || !data.주소) {
    $("err").textContent = "수취인, 연락처, 주소는 필수입니다.";
    return;
  }
  if (!data.개인정보동의) {
    $("err").textContent = "개인정보 수집·이용에 동의해야 주문을 저장할 수 있습니다.";
    return;
  }
  localStorage.setItem("판매처_default", data.판매처);
  $("err").textContent = "";
  if (editingId) {
    const { error } = await sb.from("orders").update(data).eq("id", editingId);
    if (error) return $("err").textContent = error.message;
  } else {
    data.주문번호 = genOrderNo();
    const { data: { user } } = await sb.auth.getUser();
    data.created_by = user.id;
    const { error } = await sb.from("orders").insert(data);
    if (error) return $("err").textContent = error.message;
  }
  resetForm();
  await loadOrders();
});

$("cancel-edit-btn").addEventListener("click", resetForm);

function startEdit(order) {
  editingId = order.id;
  $("form-title").textContent = "주문 수정";
  $("submit-btn").textContent = "수정 저장";
  $("cancel-edit-btn").classList.remove("hidden");
  $("f-판매처").value = order.판매처 || "";
  $("f-주문일").value = order.주문일 || "";
  $("f-상품명").value = order.상품명 || "";
  fillOptionSelect();
  $("f-옵션").value = `${order.상품코드}|||${order.옵션명}`;
  $("f-수량").value = order.수량 || 1;
  $("f-주문금액").value = order.주문금액 || "";
  $("f-업체명").value = order.업체명 || "";
  $("f-수취인").value = order.수취인 || "";
  $("f-연락처").value = order.연락처 || "";
  $("f-우편번호").value = order.우편번호 || "";
  $("f-배송희망일자").value = order.배송희망일자 || "";
  $("f-주소").value = order.주소 || "";
  $("f-배송메세지").value = order.배송메세지 || "";
  $("f-동의").checked = !!order.개인정보동의;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function deleteOrder(id) {
  if (!confirm("이 주문을 삭제할까요?")) return;
  const { error } = await sb.from("orders").delete().eq("id", id);
  if (error) alert(error.message);
  await loadOrders();
}

async function loadOrders() {
  const { data, error } = await sb.from("orders").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return; }
  orders = data;
  renderTable();
}

function renderTable() {
  $("count-badge").textContent = `(${orders.length}건)`;
  $("tbody").innerHTML = orders.map(o => `
    <tr>
      <td>${o.판매처 ?? ""}</td><td>${o.주문번호 ?? ""}</td><td>${o.주문일 ?? ""}</td>
      <td>${o.상품명 ?? ""}</td><td>${o.상품코드 ?? ""}</td><td>${o.옵션명 ?? ""}</td>
      <td>${o.수량 ?? ""}</td><td>${o.주문금액 ?? ""}</td><td>${o.업체명 ?? ""}</td>
      <td>${o.수취인 ?? ""}</td><td>${o.연락처 ?? ""}</td><td>${o.우편번호 ?? ""}</td>
      <td>${o.주소 ?? ""}</td><td>${o.배송희망일자 ?? ""}</td><td>${o.배송메세지 ?? ""}</td>
      <td class="actions">
        <button data-edit="${o.id}">수정</button>
        <button data-del="${o.id}">삭제</button>
      </td>
    </tr>`).join("");
  $("tbody").querySelectorAll("[data-edit]").forEach(b =>
    b.addEventListener("click", () => startEdit(orders.find(o => o.id === b.dataset.edit))));
  $("tbody").querySelectorAll("[data-del]").forEach(b =>
    b.addEventListener("click", () => deleteOrder(b.dataset.del)));
}

$("refresh-btn").addEventListener("click", loadOrders);

$("export-btn").addEventListener("click", () => {
  const rows = orders.map(o => COLUMNS.map(c => o[c] ?? ""));
  const ws = XLSX.utils.aoa_to_sheet([COLUMNS, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `사방넷_출고요청서_${today()}.xlsx`);
});

// realtime: pick up orders entered from other devices
sb.channel("orders-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadOrders)
  .subscribe();

// ---- auth ----
$("login-btn").addEventListener("click", async () => {
  $("login-err").textContent = "";
  const { error } = await sb.auth.signInWithPassword({
    email: $("login-email").value.trim(),
    password: $("login-pw").value,
  });
  if (error) $("login-err").textContent = error.message;
});

$("logout-btn").addEventListener("click", () => sb.auth.signOut());

sb.auth.onAuthStateChange((_event, session) => {
  if (session) {
    $("login-card").classList.add("hidden");
    $("app").classList.remove("hidden");
    $("whoami").textContent = session.user.email;
    resetForm();
    loadOrders();
  } else {
    $("app").classList.add("hidden");
    $("login-card").classList.remove("hidden");
  }
});
