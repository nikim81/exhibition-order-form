const $ = (id) => document.getElementById(id);
let editingId = null;
let settings = { 박람회명: "박람회", 판매제품: [] };
let activeProducts = PRODUCTS;

// ---- product dropdowns ----
function fillProductSelect() {
  const names = [...new Set(activeProducts.map(p => p.name))];
  $("f-상품명").innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join("");
  fillOptionSelect();
}
function fillOptionSelect() {
  const name = $("f-상품명").value;
  const opts = activeProducts.filter(p => p.name === name);
  $("f-옵션").innerHTML = opts.map(o => `<option value="${o.code}|||${o.option}">${o.option} (${o.code})</option>`).join("");
}
$("f-상품명").addEventListener("change", fillOptionSelect);
fillProductSelect();

async function loadSettings() {
  const { data, error } = await sb.from("settings").select("*").eq("id", 1).single();
  if (error || !data) return;
  settings = data;
  activeProducts = (data.판매제품 && data.판매제품.length) ? data.판매제품 : PRODUCTS;
}

// ---- default field values ----
function today() { return new Date().toISOString().slice(0, 10); }
function resetForm() {
  editingId = null;
  $("form-title").textContent = "주문 입력";
  $("submit-btn").textContent = "주문 저장";
  $("cancel-edit-btn").classList.add("hidden");
  $("f-판매처").value = settings.박람회명 || "박람회";
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
    판매처: settings.박람회명 || "박람회",
    주문일: today(),
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
  $("err").textContent = "";
  if (editingId) {
    const { error } = await sb.from("orders").update(data).eq("id", editingId);
    if (error) return $("err").textContent = error.message;
    history.replaceState(null, "", "index.html");
  } else {
    data.주문번호 = genOrderNo();
    const { data: { user } } = await sb.auth.getUser();
    data.created_by = user.id;
    const { error } = await sb.from("orders").insert(data);
    if (error) return $("err").textContent = error.message;
  }
  resetForm();
});

$("cancel-edit-btn").addEventListener("click", () => {
  resetForm();
  history.replaceState(null, "", "index.html");
});

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

async function loadEditFromUrl() {
  const id = new URLSearchParams(location.search).get("edit");
  if (!id) return;
  const { data, error } = await sb.from("orders").select("*").eq("id", id).single();
  if (!error && data) startEdit(data);
}

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

sb.auth.onAuthStateChange(async (_event, session) => {
  if (session) {
    $("login-card").classList.add("hidden");
    $("app").classList.remove("hidden");
    $("whoami").textContent = session.user.email;
    await loadSettings();
    resetForm();
    loadEditFromUrl();
  } else {
    $("app").classList.add("hidden");
    $("login-card").classList.remove("hidden");
  }
});
