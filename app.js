const $ = (id) => document.getElementById(id);
sessionStorage.removeItem("adminUnlocked"); // 주문 입력 화면을 거치면 관리자 PIN을 다시 물어보게 함
let editingId = null;
let editMode = false;
let settings = { 박람회명: "박람회", 판매제품: [] };
let activeProducts = PRODUCTS;
let cart = new Map(); // key = `${code}|||${option}` -> {name, code, option, price, qty}

const TIER_NAME = {
  "3종": "시그니처2플러스+ACC3종(세로,수납,다용도)",
  "4종": "시그니처2플러스+ACC4종(세로,수납,다용도,멀티트레이)",
  "단품": "시그니처2플러스",
};
let currentTier = null; // 미선택 상태로 시작 (선택 전엔 ACC 단독 구매 가능)
let currentColorKey = null;
let currentGiftKey = null; // code|||option of the selected gift (no delivery suffix)
let currentGiftCartKey = null; // actual key this gift is stored under in `cart`
let giftDelivery = "현장"; // "현장" | "배송"

function tierProducts() { return activeProducts.filter(p => p.name === TIER_NAME[currentTier]); }
function accProducts() { return activeProducts.filter(p => p.name === "ACC"); }
function tierHasProducts(tier) { return activeProducts.some(p => p.name === TIER_NAME[tier]); }

function priceFor(code, option) {
  const p = activeProducts.find(x => x.code === code && x.option === option);
  return p && p.price != null ? Number(p.price) : null;
}

// ---- 1단: 소독기 (단품/3종/4종 탭 + 단일 컬러 선택 후 "담기") ----
function renderTierTabs() {
  $("tier-tabs").querySelectorAll(".tier-btn").forEach(b => {
    b.classList.toggle("hidden", !tierHasProducts(b.dataset.tier));
    b.classList.toggle("active", b.dataset.tier === currentTier);
  });
}
$("tier-tabs").querySelectorAll(".tier-btn").forEach(b => {
  b.addEventListener("click", () => {
    currentTier = currentTier === b.dataset.tier ? null : b.dataset.tier;
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
    const master = PRODUCTS.find(x => x.code === p.code && x.image) || p;
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
  const enabled = currentTier !== "3종" && currentTier !== "4종";
  $("acc-grid").classList.toggle("disabled", !enabled);
  $("acc-label").textContent = enabled
    ? "선택2. 액세서리 (별도 구매 시)"
    : "선택2. 액세서리 (3종/4종에 이미 포함되어 있어요)";
}

function showErr(msg) {
  $("err").textContent = `⚠ ${msg}`;
  $("err").scrollIntoView({ behavior: "smooth", block: "center" });
}

$("steril-add-btn").addEventListener("click", () => {
  const stErr = msg => { $("steril-err").textContent = `⚠ ${msg}`; };
  if (!currentTier) { stErr("3종 / 4종 / 단품 중 하나를 먼저 선택하세요."); return; }
  if (!currentColorKey) { stErr("소독기 컬러를 선택하세요."); return; }
  $("err").textContent = "";
  const [code, option] = currentColorKey.split("|||");
  const p = tierProducts().find(x => x.code === code && x.option === option);
  // 선택1(소독기)은 주문당 1대만 (여러 대 구매 시 배송지별로 주문을 따로 입력)
  if (!editMode && hasSterilizerInCart()) { stErr("이미 선택된 소독기가 있습니다. 선택한 상품에서 삭제 후 다시 담아주세요."); return; }
  if (editMode) cart.clear();
  cart.set(currentColorKey, { name: p.name, code, option, price: priceFor(code, option), qty: 1 });
  currentColorKey = null;
  renderSterilizerGrid();
  renderGiftSection();
  renderCart();
});

// ---- 2단: 액세서리 (다중 선택 가능, 토글식 장바구니) ----
function renderPicker(containerId, products) {
  const grid = $(containerId);
  grid.innerHTML = products.map(p => {
    const key = `${p.code}|||${p.option}`;
    const item = cart.get(key);
    const master = PRODUCTS.find(x => x.code === p.code && x.image) || p;
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

// ---- 3단: 사은품 (박람회별 세팅된 제품만, 단일 선택 + 현장수령/배송) ----
function giftProducts() {
  return (settings.사은품 || []).map(g => PRODUCTS.find(x => x.code === g.code && x.option === g.option) || g);
}

// 사은품은 소독기 본품 구매 사은품이라, 선택1에서 담은 소독기가 있어야만 선택 가능
function hasSterilizerInCart() {
  const tierNames = Object.values(TIER_NAME);
  return [...cart.values()].some(it => tierNames.includes(it.name));
}

function addGiftToCart() {
  const [code, option] = currentGiftKey.split("|||");
  const p = giftProducts().find(x => x.code === code && x.option === option);
  if (!p) return;
  const isDelivery = giftDelivery === "배송";
  const cartKey = isDelivery ? `${currentGiftKey}|||배송` : currentGiftKey;
  if (currentGiftCartKey && currentGiftCartKey !== cartKey) cart.delete(currentGiftCartKey);
  cart.set(cartKey, {
    name: isDelivery ? `${p.name}(배송)` : p.name,
    code: p.code, // 사방넷 등록 코드는 그대로 유지 (배송 여부는 옵션명으로만 구분)
    option: isDelivery ? `${p.option}(배송)` : p.option,
    price: isDelivery ? 2500 : null,
    qty: 1,
  });
  currentGiftCartKey = cartKey;
}

function renderGiftSection() {
  const eligible = hasSterilizerInCart();
  if (!eligible && currentGiftCartKey) {
    cart.delete(currentGiftCartKey);
    currentGiftCartKey = null;
    currentGiftKey = null;
  }
  $("gift-grid").classList.toggle("disabled", !eligible);
  $("gift-label").textContent = eligible ? "선택3. 사은품" : "선택3. 사은품 (선택1 소독기를 먼저 담아주세요)";

  const grid = $("gift-grid");
  const products = giftProducts();
  grid.innerHTML = products.map(p => {
    const key = `${p.code}|||${p.option}`;
    return `<div class="swatch gift-swatch${key === currentGiftKey ? " selected" : ""}" data-key="${key}"><span>${p.option}</span></div>`;
  }).join("");
  grid.querySelectorAll(".swatch").forEach(el => {
    el.addEventListener("click", () => {
      const key = el.dataset.key;
      if (currentGiftCartKey) { cart.delete(currentGiftCartKey); currentGiftCartKey = null; }
      if (key === currentGiftKey) {
        currentGiftKey = null;
      } else {
        currentGiftKey = key;
        addGiftToCart();
      }
      renderAll();
    });
  });
  $("gift-delivery-row").classList.toggle("hidden", !currentGiftKey);
  $("gift-delivery").querySelectorAll("input[name=gift-delivery]").forEach(r => r.checked = r.value === giftDelivery);
  $("gift-warning").classList.toggle("hidden", !(currentGiftKey && giftDelivery === "배송"));
}

$("gift-delivery").addEventListener("change", (e) => {
  if (e.target.name !== "gift-delivery") return;
  giftDelivery = e.target.value;
  if (currentGiftKey) addGiftToCart();
  renderGiftSection();
  renderCart();
});

function renderCart() {
  $("steril-err").textContent = "";
  const items = [...cart.values()];
  $("cart-list").innerHTML = items.length ? items.map(it => `
    <div class="cart-row">
      <div class="cart-info">
        <div class="cart-name">${esc(it.name)}</div>
        <div class="cart-meta">${esc(it.option)} · ${it.qty}개</div>
      </div>
      <div class="cart-price">${it.price != null ? `${(it.price * it.qty).toLocaleString()}원` : ""}</div>
      <button type="button" class="cart-del" aria-label="삭제" data-remove="${esc(it.code)}|||${esc(it.option)}">✕</button>
    </div>`).join("") : `<div style="color:#999;font-size:13px;">선택된 상품이 없습니다</div>`;
  $("cart-list").querySelectorAll("[data-remove]").forEach(b =>
    b.addEventListener("click", () => { cart.delete(b.dataset.remove); renderAll(); }));
  const total = items.reduce((s, it) => s + (it.price || 0) * it.qty, 0);
  $("cart-total").innerHTML = items.length ? `<span>합계</span><strong>${total.toLocaleString()}원</strong>` : "";
}

function renderAll() {
  renderTierTabs();
  renderSterilizerGrid();
  renderAccAvailability();
  renderPicker("acc-grid", accProducts());
  renderGiftSection();
  renderCart();
}
renderAll();

let activeExhibitions = [];

function applyExhibition(exp) {
  settings = exp;
  activeProducts = (exp.판매제품 && exp.판매제품.length) ? exp.판매제품 : PRODUCTS;
}

// returns true once an exhibition is resolved and the order form can render;
// false while the picker is shown and waiting for the staff to choose.
async function loadSettings() {
  const { data, error } = await sb.from("exhibitions").select("*").eq("is_active", true);
  activeExhibitions = (!error && data) ? data : [];
  $("switch-expo-btn").classList.toggle("hidden", activeExhibitions.length <= 1);
  if (activeExhibitions.length === 0) return true;
  if (activeExhibitions.length === 1) { applyExhibition(activeExhibitions[0]); return true; }

  const savedId = localStorage.getItem("selectedExpoId");
  const saved = activeExhibitions.find(e => e.id === savedId);
  if (saved) { applyExhibition(saved); return true; }

  showExpoPicker();
  return false;
}

function showExpoPicker() {
  $("order-card").classList.add("hidden");
  $("expo-picker").classList.remove("hidden");
  $("expo-picker-list").innerHTML = activeExhibitions.map(e => `
    <button type="button" class="ghost expo-pick-btn" data-id="${esc(e.id)}" style="display:block;width:100%;margin-bottom:8px;">${esc(e.박람회명)}</button>
  `).join("");
  $("expo-picker-list").querySelectorAll("[data-id]").forEach(b => {
    b.addEventListener("click", () => {
      const exp = activeExhibitions.find(e => e.id === b.dataset.id);
      localStorage.setItem("selectedExpoId", exp.id);
      applyExhibition(exp);
      $("expo-picker").classList.add("hidden");
      $("order-card").classList.remove("hidden");
      resetForm();
      loadEditFromUrl();
    });
  });
}

$("switch-expo-btn").addEventListener("click", () => {
  localStorage.removeItem("selectedExpoId");
  showExpoPicker();
});

$("f-연락처").addEventListener("input", () => {
  const digits = $("f-연락처").value.replace(/\D/g, "").slice(0, 11);
  let formatted = digits;
  if (digits.length > 3 && digits.length <= 7) formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
  else if (digits.length > 7) formatted = `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  $("f-연락처").value = formatted;
});

$("f-계좌이체").addEventListener("change", () => { if ($("f-계좌이체").checked) $("f-카드결제").checked = false; });
$("f-카드결제").addEventListener("change", () => { if ($("f-카드결제").checked) $("f-계좌이체").checked = false; });

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
function today() { return new Date().toLocaleDateString("sv-SE"); }
function resetForm() {
  editingId = null;
  editMode = false;
  $("form-title").textContent = "주문 입력";
  $("submit-btn").textContent = "주문 저장";
  $("cancel-edit-btn").classList.add("hidden");
  $("expo-name").textContent = settings.박람회명 || "박람회";
  $("f-주문일").value = today();
  cart.clear();
  currentTier = null;
  currentColorKey = null;
  currentGiftKey = null;
  currentGiftCartKey = null;
  giftDelivery = "현장";
  renderAll();
  $("f-수취인").value = "";
  $("f-연락처").value = "";
  $("f-우편번호").value = "";
  $("f-주소").value = "";
  $("f-상세주소").value = "";
  $("f-배송메세지").value = "";
  $("f-계좌이체").checked = false;
  $("f-카드결제").checked = false;
  $("f-동의").checked = false;
  $("f-마케팅동의").checked = false;
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
    주문일: $("f-주문일").value || today(),
    업체명: "",
    수취인: $("f-수취인").value.trim(),
    연락처: $("f-연락처").value.trim(),
    우편번호: $("f-우편번호").value.trim(),
    주소: `${$("f-주소").value.trim()} ${$("f-상세주소").value.trim()}`.trim(),
    배송희망일자: null,
    배송메세지: $("f-배송메세지").value.trim(),
    결제방법: $("f-계좌이체").checked ? "계좌이체" : $("f-카드결제").checked ? "카드결제" : "",
    개인정보동의: $("f-동의").checked,
    마케팅동의: $("f-마케팅동의").checked,
  };
}

$("submit-btn").addEventListener("click", async () => {
  if (!$("f-수취인").value.trim() || !$("f-연락처").value.trim() || !$("f-주소").value.trim()) {
    showErr("수취인, 연락처, 주소는 필수입니다.");
    return;
  }
  if (!$("f-동의").checked) {
    showErr("개인정보 수집·이용 및 처리위탁에 동의해야 주문을 저장할 수 있습니다.");
    return;
  }
  if (cart.size === 0) {
    showErr("상품을 1개 이상 선택하세요.");
    return;
  }
  // 본품(소독기) 구매 시 박람회에 사은품이 세팅돼 있으면 선택 필수 (수정 모드는 한 줄 단위라 제외)
  if (!editMode && hasSterilizerInCart() && giftProducts().length && !currentGiftKey) {
    showErr("선택3. 사은품을 선택하세요.");
    $("gift-grid").scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (!$("f-계좌이체").checked && !$("f-카드결제").checked) {
    showErr("결제 방법(계좌이체 또는 카드결제)을 선택하세요.");
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
    alert("주문이 수정되었습니다.");
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
    alert("주문이 접수되었습니다!");
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
  currentTier = matchedTier || null;
  currentColorKey = matchedTier ? `${order.상품코드}|||${order.옵션명}` : null;
  currentGiftKey = null;
  currentGiftCartKey = null;
  giftDelivery = "현장";
  renderAll();

  $("f-수취인").value = order.수취인 || "";
  $("f-연락처").value = order.연락처 || "";
  $("f-우편번호").value = order.우편번호 || "";
  $("f-주소").value = order.주소 || "";
  $("f-상세주소").value = "";
  $("f-배송메세지").value = order.배송메세지 || "";
  $("f-계좌이체").checked = order.결제방법 === "계좌이체";
  $("f-카드결제").checked = order.결제방법 === "카드결제";
  $("f-동의").checked = !!order.개인정보동의;
  $("f-마케팅동의").checked = !!order.마케팅동의;
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
    $("login-card").classList.add("hidden");
    $("app").classList.remove("hidden");
    const ready = await loadSettings();
    if (ready) { resetForm(); loadEditFromUrl(); }
  } else {
    $("app").classList.add("hidden");
    $("login-card").classList.remove("hidden");
  }
});
