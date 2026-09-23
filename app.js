const $ = (id) => document.getElementById(id);
let editingId = null;
let editMode = false;
let settings = { 박람회명: "박람회", 판매제품: [] };
let activeProducts = PRODUCTS;
let cart = new Map(); // key = `${code}|||${option}` -> {name, code, option, price, qty}

const TIER_NAME = {
  "단품": "시그니처2플러스",
  "3종": "시그니처2플러스+ACC3종(세로,수납,다용도)",
  "4종": "시그니처2플러스+ACC4종(세로,수납,다용도,멀티트레이)",
};
let currentTier = "단품";
let currentColorKey = null;

function tierProducts() { return activeProducts.filter(p => p.name === TIER_NAME[currentTier]); }
function accProducts() { return activeProducts.filter(p => p.name === "ACC"); }

function priceFor(code, option) {
  const p = activeProducts.find(x => x.code === code && x.option === option);
  return p && p.price != null ? Number(p.price) : null;
}

// ---- 1단: 소독기 (단품/3종/4종 탭 + 단일 컬러 선택 후 "담기") ----
function renderTierTabs() {
  $("tier-tabs").querySelectorAll(".tier-btn").forEach(b => b.classList.toggle("active", b.dataset.tier === currentTier));
}
$("tier-tabs").querySelectorAll(".tier-btn").forEach(b => {
  b.addEventListener("click", () => {
    currentTier = b.dataset.tier;
    currentColorKey = null;
    renderTierTabs();
    renderSterilizerGrid();
    renderAccAvailability();
  });
});

function renderSterilizerGrid() {
  const grid = $("sterilizer-grid");
  const products = tierProducts();
  grid.innerHTML = products.map(p => {
    const key = `${p.code}|||${p.option}`;
    const master = PRODUCTS.find(x => x.code === p.code && x.option === p.option) || p;
    const img = master.image
      ? `<img src="${master.image}" alt="${p.option}">`
      : `<div style="aspect-ratio:4/5;border-radius:6px;background:#ddd;"></div>`;
    return `<div class="swatch${key === currentColorKey ? " selected" : ""}" data-key="${key}">${img}<span>${p.option}</span></div>`;
  }).join("");
  grid.querySelectorAll(".swatch").forEach(el => {
    el.addEventListener("click", () => {
      currentColorKey = currentColorKey === el.dataset.key ? null : el.dataset.key;
      renderSterilizerGrid();
    });
  });
}

function renderAccAvailability() {
  const enabled = currentTier === "단품";
  $("acc-grid").classList.toggle("disabled", !enabled);
  $("acc-label").textContent = enabled
    ? "2단. 액세서리 (선택 안 해도 됨)"
    : "2단. 액세서리 (3종/4종에 이미 포함되어 있어요)";
}

$("steril-add-btn").addEventListener("click", () => {
  if (!currentColorKey) { $("err").textContent = "소독기 컬러를 선택하세요."; return; }
  $("err").textContent = "";
  const [code, option] = currentColorKey.split("|||");
  const p = tierProducts().find(x => x.code === code && x.option === option);
  const qty = Number($("steril-qty").value) || 1;
  if (editMode) cart.clear();
  const existing = cart.get(currentColorKey);
  if (existing) existing.qty += qty;
  else cart.set(currentColorKey, { name: p.name, code, option, price: priceFor(code, option), qty });
  currentColorKey = null;
  $("steril-qty").value = 1;
  renderSterilizerGrid();
  renderCart();
});

// ---- 2단: 액세서리 (다중 선택 가능, 토글식 장바구니) ----
function renderPicker(containerId, products) {
  const grid = $(containerId);
  grid.innerHTML = products.map(p => {
    const key = `${p.code}|||${p.option}`;
    const item = cart.get(key);
    const master = PRODUCTS.find(x => x.code === p.code && x.option === p.option) || p;
    const img = master.image
      ? `<img src="${master.image}" alt="${p.option}">`
      : `<div style="aspect-ratio:4/5;border-radius:6px;background:#ddd;"></div>`;
    const qtyRow = item
      ? `<div class="qty-row"><button type="button" data-act="dec" data-key="${key}">−</button><span>${item.qty}</span><button type="button" data-act="inc" data-key="${key}">+</button></div>`
      : "";
    return `<div class="swatch${item ? " selected" : ""}" data-key="${key}" data-code="${p.code}" data-option="${p.option}" data-name="${p.name}">${img}<span>${p.option}</span>${qtyRow}</div>`;
  }).join("");

  grid.querySelectorAll(".swatch").forEach(el => {
    el.addEventListener("click", (e) => {
      const key = el.dataset.key;
      const actBtn = e.target.closest("[data-act]");
      if (actBtn) {
        const item = cart.get(key);
        if (!item) return;
        if (actBtn.dataset.act === "inc") item.qty++;
        else { item.qty--; if (item.qty <= 0) cart.delete(key); }
      } else if (cart.has(key)) {
        cart.delete(key);
      } else {
        if (editMode) cart.clear();
        cart.set(key, {
          name: el.dataset.name, code: el.dataset.code, option: el.dataset.option,
          price: priceFor(el.dataset.code, el.dataset.option), qty: 1,
        });
      }
      renderAll();
    });
  });
}

function renderCart() {
  const items = [...cart.values()];
  $("cart-list").innerHTML = items.length ? items.map(it => `
    <div class="cart-row">
      <span>${it.name} - ${it.option} × ${it.qty}${it.price != null ? ` = ${(it.price * it.qty).toLocaleString()}원` : ""}</span>
      <button type="button" data-remove="${it.code}|||${it.option}">삭제</button>
    </div>`).join("") : `<div style="color:#999;font-size:13px;">선택된 상품이 없습니다</div>`;
  $("cart-list").querySelectorAll("[data-remove]").forEach(b =>
    b.addEventListener("click", () => { cart.delete(b.dataset.remove); renderAll(); }));
  const total = items.reduce((s, it) => s + (it.price || 0) * it.qty, 0);
  $("cart-total").textContent = items.length ? `합계: ${total.toLocaleString()}원` : "";
}

function renderAll() {
  renderTierTabs();
  renderSterilizerGrid();
  renderAccAvailability();
  renderPicker("acc-grid", accProducts());
  renderCart();
}
renderAll();

async function loadSettings() {
  const { data, error } = await sb.from("exhibitions").select("*").eq("is_active", true).limit(1).single();
  if (error || !data) return;
  settings = data;
  activeProducts = (data.판매제품 && data.판매제품.length) ? data.판매제품 : PRODUCTS;
}

function closeAddrModal() {
  $("addr-modal").classList.add("hidden");
  $("addr-embed").innerHTML = "";
}
$("addr-search-btn").addEventListener("click", () => {
  $("addr-modal").classList.remove("hidden");
  $("addr-embed").innerHTML = "";
  new daum.Postcode({
    oncomplete: (data) => {
      $("f-주소").value = data.roadAddress || data.jibunAddress;
      $("f-우편번호").value = data.zonecode;
      closeAddrModal();
      $("f-상세주소").focus();
    },
    width: "100%",
    height: "100%",
  }).embed($("addr-embed"));
});
$("addr-modal-close").addEventListener("click", closeAddrModal);

// ---- default field values ----
function today() { return new Date().toISOString().slice(0, 10); }
function resetForm() {
  editingId = null;
  editMode = false;
  $("form-title").textContent = "주문 입력";
  $("submit-btn").textContent = "주문 저장";
  $("cancel-edit-btn").classList.add("hidden");
  $("expo-name").textContent = settings.박람회명 || "박람회";
  $("f-주문일").value = today();
  cart.clear();
  currentTier = "단품";
  currentColorKey = null;
  renderAll();
  $("f-수취인").value = "";
  $("f-연락처").value = "";
  $("f-우편번호").value = "";
  $("f-주소").value = "";
  $("f-상세주소").value = "";
  $("f-배송메세지").value = "";
  $("f-동의").checked = false;
  $("err").textContent = "";
}

function genOrderNo() {
  const d = new Date();
  const stamp = d.toISOString().slice(0,10).replace(/-/g,"");
  return `EXPO${stamp}${Math.floor(Math.random()*9000+1000)}`;
}

function commonFields() {
  return {
    판매처: settings.박람회명 || "박람회",
    주문일: today(),
    업체명: "",
    수취인: $("f-수취인").value.trim(),
    연락처: $("f-연락처").value.trim(),
    우편번호: $("f-우편번호").value.trim(),
    주소: `${$("f-주소").value.trim()} ${$("f-상세주소").value.trim()}`.trim(),
    배송희망일자: null,
    배송메세지: $("f-배송메세지").value.trim(),
    개인정보동의: $("f-동의").checked,
  };
}

$("submit-btn").addEventListener("click", async () => {
  if (!$("f-수취인").value.trim() || !$("f-연락처").value.trim() || !$("f-주소").value.trim()) {
    $("err").textContent = "수취인, 연락처, 주소는 필수입니다.";
    return;
  }
  if (!$("f-동의").checked) {
    $("err").textContent = "개인정보 수집·이용에 동의해야 주문을 저장할 수 있습니다.";
    return;
  }
  if (cart.size === 0) {
    $("err").textContent = "상품을 1개 이상 선택하세요.";
    return;
  }
  $("err").textContent = "";
  const common = commonFields();

  if (editingId) {
    const it = [...cart.values()][0];
    const row = {
      ...common,
      상품명: it.name, 상품코드: it.code, 옵션명: it.option, 수량: it.qty,
      주문금액: it.price != null ? it.price * it.qty : null,
    };
    const { error } = await sb.from("orders").update(row).eq("id", editingId);
    if (error) return $("err").textContent = error.message;
    history.replaceState(null, "", "index.html");
  } else {
    const 주문번호 = genOrderNo();
    const { data: { user } } = await sb.auth.getUser();
    const rows = [...cart.values()].map(it => ({
      ...common,
      주문번호,
      상품명: it.name, 상품코드: it.code, 옵션명: it.option, 수량: it.qty,
      주문금액: it.price != null ? it.price * it.qty : null,
      created_by: user.id,
    }));
    const { error } = await sb.from("orders").insert(rows);
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
  editMode = true;
  $("form-title").textContent = "주문 수정";
  $("submit-btn").textContent = "수정 저장";
  $("cancel-edit-btn").classList.remove("hidden");
  $("expo-name").textContent = order.판매처 || settings.박람회명 || "박람회";
  $("f-주문일").value = order.주문일 || "";

  cart.clear();
  const qty = order.수량 || 1;
  cart.set(`${order.상품코드}|||${order.옵션명}`, {
    name: order.상품명, code: order.상품코드, option: order.옵션명, qty,
    price: order.주문금액 != null ? order.주문금액 / qty : priceFor(order.상품코드, order.옵션명),
  });
  const matchedTier = Object.keys(TIER_NAME).find(t => TIER_NAME[t] === order.상품명);
  currentTier = matchedTier || "단품";
  currentColorKey = matchedTier ? `${order.상품코드}|||${order.옵션명}` : null;
  renderAll();

  $("f-수취인").value = order.수취인 || "";
  $("f-연락처").value = order.연락처 || "";
  $("f-우편번호").value = order.우편번호 || "";
  $("f-주소").value = order.주소 || "";
  $("f-상세주소").value = "";
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

sb.auth.onAuthStateChange(async (event, session) => {
  if (session) {
    if (event === "SIGNED_IN") { location.href = "admin.html"; return; }
    $("login-card").classList.add("hidden");
    $("app").classList.remove("hidden");
    await loadSettings();
    resetForm();
    loadEditFromUrl();
  } else {
    $("app").classList.add("hidden");
    $("login-card").classList.remove("hidden");
  }
});
