const $ = (id) => document.getElementById(id);
const key = (p) => `${p.code}|||${p.option}`;

let exhibitions = [];
let currentId = null; // null = 새 박람회 작성 중
let state = { 박람회명: "", 시작일: "", 종료일: "", 판매제품: [], 사은품: [], 묶음구성: [], is_active: false };
let bundleParts = []; // temp component list while building/editing a bundle

const productLabel = (p) => `${p.name} - ${p.option} (${p.code})`;

function fillProductSelects() {
  const optionsHtml = PRODUCTS.map(p => `<option value="${key(p)}">${productLabel(p)}</option>`).join("");
  $("gift-product").innerHTML = optionsHtml;
  $("bundle-base").innerHTML = optionsHtml;
  $("bundle-part-product").innerHTML = optionsHtml;
}

// ---- 박람회 목록 ----
async function loadExhibitionList() {
  const { data, error } = await sb.from("exhibitions").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return; }
  exhibitions = data;
  renderExpoList();
}

function renderExpoList() {
  $("expo-list").innerHTML = exhibitions.map(e => `
    <div class="expo-card ${e.is_active ? "active" : ""}">
      <span>${e.박람회명}${e.is_active ? '<span class="badge">● 활성</span>' : ""}
        <span style="color:#999;"> · ${e.시작일 || "?"} ~ ${e.종료일 || "?"}</span>
      </span>
      <span class="actions">
        <button data-edit="${e.id}">수정</button>
        ${e.is_active ? "" : `<button data-activate="${e.id}">활성화</button>`}
        <button data-del="${e.id}">삭제</button>
      </span>
    </div>`).join("") || `<div style="color:#999;font-size:13px;">등록된 박람회 없음. "+ 새 박람회"로 추가하세요.</div>`;

  $("expo-list").querySelectorAll("[data-edit]").forEach(b =>
    b.addEventListener("click", () => selectExpo(b.dataset.edit)));
  $("expo-list").querySelectorAll("[data-activate]").forEach(b =>
    b.addEventListener("click", () => activateExpo(b.dataset.activate)));
  $("expo-list").querySelectorAll("[data-del]").forEach(b =>
    b.addEventListener("click", () => deleteExpo(b.dataset.del)));
}

function selectExpo(id) {
  const e = exhibitions.find(x => x.id === id);
  if (!e) return;
  currentId = e.id;
  state = {
    박람회명: e.박람회명 || "",
    시작일: e.시작일 || "",
    종료일: e.종료일 || "",
    판매제품: e.판매제품 || [],
    사은품: e.사은품 || [],
    묶음구성: e.묶음구성 || [],
    is_active: e.is_active,
  };
  fillFormFromState();
  window.scrollTo({ top: $("editing-label").getBoundingClientRect().top + window.scrollY - 80, behavior: "smooth" });
}

$("new-expo-btn").addEventListener("click", () => {
  currentId = null;
  state = { 박람회명: "", 시작일: "", 종료일: "", 판매제품: [], 사은품: [], 묶음구성: [], is_active: exhibitions.length === 0 };
  fillFormFromState();
});

function fillFormFromState() {
  $("editing-label").textContent = currentId ? "(수정 중)" : "(새 박람회)";
  $("s-박람회명").value = state.박람회명;
  $("s-시작일").value = state.시작일 || "";
  $("s-종료일").value = state.종료일 || "";
  $("s-활성").checked = state.is_active;
  renderProductGroups();
  renderGiftList();
  renderBundleList();
}

async function activateExpo(id) {
  await sb.from("exhibitions").update({ is_active: false }).neq("id", id);
  await sb.from("exhibitions").update({ is_active: true }).eq("id", id);
  await loadExhibitionList();
  if (currentId === id) state.is_active = true, $("s-활성").checked = true;
}

async function deleteExpo(id) {
  if (!confirm("이 박람회 세팅을 삭제할까요? (해당 박람회로 접수된 주문 데이터는 지워지지 않습니다)")) return;
  await sb.from("exhibitions").delete().eq("id", id);
  if (currentId === id) { currentId = null; state = { 박람회명: "", 시작일: "", 종료일: "", 판매제품: [], 사은품: [], 묶음구성: [], is_active: false }; fillFormFromState(); }
  await loadExhibitionList();
}

// ---- 판매 제품 체크박스 + 가격 ----
let touchedPriceKeys = new Set(); // 수기로 직접 수정한 항목(자동 동기화 대상에서 제외)

function formatPrice(n) { return (n === null || n === undefined || n === "") ? "" : Number(n).toLocaleString("ko-KR"); }
function parsePrice(s) { const digits = String(s).replace(/[^0-9]/g, ""); return digits ? Number(digits) : null; }

function groupPrice(name) {
  const found = state.판매제품.find(sp => sp.name === name && sp.price != null);
  return found ? found.price : null;
}

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
        ${opts.map(o => {
          const sp = state.판매제품.find(x => x.code === o.code && x.option === o.option);
          const isGift = name.startsWith("[사은품]");
          return `
          <div class="opt-row">
            <input type="checkbox" class="opt-check" data-code="${o.code}" data-option="${o.option}" ${sp ? "checked" : ""}>
            <span>${o.option} (${o.code})</span>
            ${sp && !isGift ? `<input type="text" inputmode="numeric" class="price-input" placeholder="가격" data-code="${o.code}" data-option="${o.option}" data-name="${name}" value="${formatPrice(sp.price)}">` : ""}
          </div>`;
        }).join("")}
      </div>`;
  }).join("");

  $("product-groups").querySelectorAll(".opt-check").forEach(cb => {
    cb.addEventListener("change", () => {
      const p = PRODUCTS.find(x => x.code === cb.dataset.code && x.option === cb.dataset.option);
      if (cb.checked) {
        if (!state.판매제품.some(sp => sp.code === p.code && sp.option === p.option)) {
          state.판매제품.push({ ...p, price: groupPrice(p.name) });
        }
      } else {
        state.판매제품 = state.판매제품.filter(sp => !(sp.code === p.code && sp.option === p.option));
      }
      renderProductGroups();
    });
  });
  $("product-groups").querySelectorAll(".price-input").forEach(inp => {
    inp.addEventListener("input", () => {
      const key = `${inp.dataset.code}|||${inp.dataset.option}`;
      const value = parsePrice(inp.value);
      inp.value = formatPrice(value);
      touchedPriceKeys.add(key);

      const sp = state.판매제품.find(x => x.code === inp.dataset.code && x.option === inp.dataset.option);
      if (sp) sp.price = value;

      // 같은 상품군의, 아직 수기로 손대지 않은 항목들에 동일 가격 자동 반영
      state.판매제품
        .filter(x => x.name === inp.dataset.name && !(x.code === inp.dataset.code && x.option === inp.dataset.option))
        .filter(x => !touchedPriceKeys.has(`${x.code}|||${x.option}`))
        .forEach(x => {
          x.price = value;
          const sibling = $("product-groups").querySelector(`.price-input[data-code="${x.code}"][data-option="${x.option}"]`);
          if (sibling) sibling.value = formatPrice(value);
        });
    });
  });
  $("product-groups").querySelectorAll(".group-all").forEach(cb => {
    cb.addEventListener("change", () => {
      const name = cb.closest(".group").dataset.name;
      const opts = PRODUCTS.filter(p => p.name === name);
      if (cb.checked) {
        const price = groupPrice(name);
        opts.forEach(o => { if (!state.판매제품.some(sp => sp.code === o.code && sp.option === o.option)) state.판매제품.push({ ...o, price }); });
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
  $("bundle-base").value = k;
  bundleParts = b.구성품.map(c => ({ ...c }));
  renderBundleParts();
  $("bundle-cancel-btn").classList.remove("hidden");
  window.scrollTo({ top: $("bundle-base").getBoundingClientRect().top + window.scrollY - 100, behavior: "smooth" });
}

$("bundle-cancel-btn").addEventListener("click", () => {
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
  bundleParts = [];
  renderBundleParts();
  $("bundle-cancel-btn").classList.add("hidden");
  renderBundleList();
});

// ---- 저장 ----
$("save-btn").addEventListener("click", async () => {
  state.박람회명 = $("s-박람회명").value.trim();
  state.시작일 = $("s-시작일").value || null;
  state.종료일 = $("s-종료일").value || null;
  state.is_active = $("s-활성").checked;
  if (!state.박람회명) { $("save-msg").textContent = "박람회명을 입력하세요."; return; }

  const payload = {
    박람회명: state.박람회명,
    시작일: state.시작일,
    종료일: state.종료일,
    판매제품: state.판매제품,
    사은품: state.사은품,
    묶음구성: state.묶음구성,
    updated_at: new Date().toISOString(),
  };

  let error, newId;
  if (currentId) {
    ({ error } = await sb.from("exhibitions").update(payload).eq("id", currentId));
  } else {
    const res = await sb.from("exhibitions").insert(payload).select("id").single();
    error = res.error;
    newId = res.data?.id;
    if (newId) currentId = newId;
  }
  if (!error && state.is_active && currentId) {
    await sb.from("exhibitions").update({ is_active: false }).neq("id", currentId);
    await sb.from("exhibitions").update({ is_active: true }).eq("id", currentId);
  }
  $("save-msg").textContent = error ? error.message : "저장 완료";
  if (!error) setTimeout(() => $("save-msg").textContent = "", 2000);
  await loadExhibitionList();
});

$("logout-btn").addEventListener("click", () => sb.auth.signOut());

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = "index.html"; return; }
  $("app").classList.remove("hidden");
  fillProductSelects();
  await loadExhibitionList();
  const active = exhibitions.find(e => e.is_active);
  if (active) selectExpo(active.id);
  else fillFormFromState();
})();
