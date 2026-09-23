const $ = (id) => document.getElementById(id);
const key = (p) => `${p.code}|||${p.option}`;

let state = { 박람회명: "", 시작일: "", 종료일: "", 판매제품: [], 사은품: [], 묶음구성: [] };
let bundleParts = []; // temp component list while building/editing a bundle
let editingBundleKey = null;

const productLabel = (p) => `${p.name} - ${p.option} (${p.code})`;

function fillProductSelects() {
  const optionsHtml = PRODUCTS.map(p => `<option value="${key(p)}">${productLabel(p)}</option>`).join("");
  $("gift-product").innerHTML = optionsHtml;
  $("bundle-base").innerHTML = optionsHtml;
  $("bundle-part-product").innerHTML = optionsHtml;
}

// ---- 판매 제품 체크박스 ----
function renderProductGroups() {
  const names = [...new Set(PRODUCTS.map(p => p.name))];
  $("product-groups").innerHTML = names.map(name => {
    const opts = PRODUCTS.filter(p => p.name === name);
    const allChecked = opts.every(o => state.판매제품.some(sp => sp.code === o.code && sp.option === o.option));
    return `
      <div class="group" data-name="${name}">
        <div class="group-title">
          <input type="checkbox" class="group-all" ${allChecked ? "checked" : ""}>
          ${name}
        </div>
        ${opts.map(o => `
          <div class="opt-row">
            <input type="checkbox" class="opt-check" data-code="${o.code}" data-option="${o.option}"
              ${state.판매제품.some(sp => sp.code === o.code && sp.option === o.option) ? "checked" : ""}>
            ${o.option} (${o.code})
          </div>`).join("")}
      </div>`;
  }).join("");

  $("product-groups").querySelectorAll(".opt-check").forEach(cb => {
    cb.addEventListener("change", () => {
      const p = PRODUCTS.find(x => x.code === cb.dataset.code && x.option === cb.dataset.option);
      if (cb.checked) {
        if (!state.판매제품.some(sp => sp.code === p.code && sp.option === p.option)) state.판매제품.push(p);
      } else {
        state.판매제품 = state.판매제품.filter(sp => !(sp.code === p.code && sp.option === p.option));
      }
      renderProductGroups();
    });
  });
  $("product-groups").querySelectorAll(".group-all").forEach(cb => {
    cb.addEventListener("change", () => {
      const name = cb.closest(".group").dataset.name;
      const opts = PRODUCTS.filter(p => p.name === name);
      if (cb.checked) {
        opts.forEach(o => { if (!state.판매제품.some(sp => sp.code === o.code && sp.option === o.option)) state.판매제품.push(o); });
      } else {
        state.판매제품 = state.판매제품.filter(sp => !opts.some(o => o.code === sp.code && o.option === sp.option));
      }
      renderProductGroups();
    });
  });
}

// ---- 사은품 ----
function renderGiftList() {
  $("gift-list").innerHTML = state.사은품.map((g, i) => `
    <div class="pill">
      <span>${g.name} - ${g.option} (${g.code}) · ${g.전달방식}</span>
      <button data-i="${i}">삭제</button>
    </div>`).join("") || `<div style="color:#999;font-size:13px;">등록된 사은품 없음</div>`;
  $("gift-list").querySelectorAll("button").forEach(b =>
    b.addEventListener("click", () => { state.사은품.splice(Number(b.dataset.i), 1); renderGiftList(); }));
}

$("gift-add-btn").addEventListener("click", () => {
  const [code, option] = $("gift-product").value.split("|||");
  const p = PRODUCTS.find(x => x.code === code && x.option === option);
  state.사은품.push({ ...p, 전달방식: $("gift-type").value });
  renderGiftList();
});

// ---- 묶음 구성 ----
function renderBundleParts() {
  $("bundle-parts").innerHTML = bundleParts.map((c, i) => `
    <div class="pill">
      <span>${c.상품명} - ${c.옵션명} (${c.상품코드}) × ${c.수량}</span>
      <button data-i="${i}">삭제</button>
    </div>`).join("");
  $("bundle-parts").querySelectorAll("button").forEach(b =>
    b.addEventListener("click", () => { bundleParts.splice(Number(b.dataset.i), 1); renderBundleParts(); }));
}

$("bundle-part-add-btn").addEventListener("click", () => {
  const [code, option] = $("bundle-part-product").value.split("|||");
  const p = PRODUCTS.find(x => x.code === code && x.option === option);
  const qty = Number($("bundle-part-qty").value) || 1;
  bundleParts.push({ 상품명: p.name, 상품코드: p.code, 옵션명: p.option, 수량: qty });
  renderBundleParts();
});

function renderBundleList() {
  $("bundle-list").innerHTML = state.묶음구성.map(b => `
    <div class="bundle-card" data-key="${b.코드옵션}">
      <div class="head">
        <span>${b.상품명} (${b.코드옵션.replace("|||", " / ")})</span>
        <span><button data-edit="${b.코드옵션}">수정</button> <button data-del="${b.코드옵션}">삭제</button></span>
      </div>
      <ul>${b.구성품.map(c => `<li>${c.상품명} - ${c.옵션명} (${c.상품코드}) × ${c.수량}</li>`).join("")}</ul>
    </div>`).join("");
  $("bundle-list").querySelectorAll("[data-edit]").forEach(b =>
    b.addEventListener("click", () => startEditBundle(b.dataset.edit)));
  $("bundle-list").querySelectorAll("[data-del]").forEach(b =>
    b.addEventListener("click", () => {
      state.묶음구성 = state.묶음구성.filter(x => x.코드옵션 !== b.dataset.del);
      renderBundleList();
    }));
}

function startEditBundle(k) {
  const b = state.묶음구성.find(x => x.코드옵션 === k);
  if (!b) return;
  editingBundleKey = k;
  $("bundle-base").value = k;
  bundleParts = b.구성품.map(c => ({ ...c }));
  renderBundleParts();
  $("bundle-cancel-btn").classList.remove("hidden");
  window.scrollTo({ top: $("bundle-base").getBoundingClientRect().top + window.scrollY - 100, behavior: "smooth" });
}

$("bundle-cancel-btn").addEventListener("click", () => {
  editingBundleKey = null;
  bundleParts = [];
  renderBundleParts();
  $("bundle-cancel-btn").classList.add("hidden");
});

$("bundle-save-btn").addEventListener("click", () => {
  const baseKey = $("bundle-base").value;
  const [code, option] = baseKey.split("|||");
  const base = PRODUCTS.find(x => x.code === code && x.option === option);
  if (bundleParts.length === 0) { alert("구성품을 1개 이상 추가하세요."); return; }
  const entry = { 코드옵션: baseKey, 상품명: `${base.name} - ${base.option}`, 구성품: bundleParts };
  state.묶음구성 = state.묶음구성.filter(x => x.코드옵션 !== baseKey);
  state.묶음구성.push(entry);
  editingBundleKey = null;
  bundleParts = [];
  renderBundleParts();
  $("bundle-cancel-btn").classList.add("hidden");
  renderBundleList();
});

// ---- 저장/불러오기 ----
async function loadSettings() {
  const { data, error } = await sb.from("settings").select("*").eq("id", 1).single();
  if (error) { console.error(error); return; }
  state.박람회명 = data.박람회명 || "";
  state.시작일 = data.시작일 || "";
  state.종료일 = data.종료일 || "";
  state.판매제품 = data.판매제품 || [];
  state.사은품 = data.사은품 || [];
  state.묶음구성 = data.묶음구성 || [];
  $("s-박람회명").value = state.박람회명;
  $("s-시작일").value = state.시작일 || "";
  $("s-종료일").value = state.종료일 || "";
  renderProductGroups();
  renderGiftList();
  renderBundleList();
}

$("save-btn").addEventListener("click", async () => {
  state.박람회명 = $("s-박람회명").value.trim();
  state.시작일 = $("s-시작일").value || null;
  state.종료일 = $("s-종료일").value || null;
  const { error } = await sb.from("settings").update({
    박람회명: state.박람회명,
    시작일: state.시작일,
    종료일: state.종료일,
    판매제품: state.판매제품,
    사은품: state.사은품,
    묶음구성: state.묶음구성,
    updated_at: new Date().toISOString(),
  }).eq("id", 1);
  $("save-msg").textContent = error ? error.message : "저장 완료";
  if (!error) setTimeout(() => $("save-msg").textContent = "", 2000);
});

$("logout-btn").addEventListener("click", () => sb.auth.signOut());

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = "index.html"; return; }
  $("app").classList.remove("hidden");
  fillProductSelects();
  await loadSettings();
})();
