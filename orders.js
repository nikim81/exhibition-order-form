const $ = (id) => document.getElementById(id);
let orders = [];

function today() { return new Date().toISOString().slice(0, 10); }

async function loadOrders() {
  const { data, error } = await sb.from("orders").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return; }
  orders = data;
  fillExpoFilter();
  renderTable();
}

function fillExpoFilter() {
  const sel = $("expo-filter");
  const prev = sel.value;
  const expos = [...new Set(orders.map(o => o.판매처).filter(Boolean))];
  sel.innerHTML = `<option value="">전체 박람회</option>` + expos.map(e => `<option value="${e}">${e}</option>`).join("");
  sel.value = expos.includes(prev) ? prev : (expos[0] || "");
}

function expoFiltered() {
  const expo = $("expo-filter").value;
  return expo ? orders.filter(o => o.판매처 === expo) : orders;
}

function renderTable() {
  const q = $("search").value.trim().toLowerCase();
  const base = expoFiltered();
  const rows = q
    ? base.filter(o => (o.수취인 || "").toLowerCase().includes(q) || (o.연락처 || "").toLowerCase().includes(q))
    : base;

  $("count-badge").textContent = `(${rows.length}/${orders.length}건)`;
  $("tbody").innerHTML = rows.map(o => `
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
    b.addEventListener("click", () => location.href = `index.html?edit=${b.dataset.edit}`));
  $("tbody").querySelectorAll("[data-del]").forEach(b =>
    b.addEventListener("click", () => deleteOrder(b.dataset.del)));
}

async function deleteOrder(id) {
  if (!confirm("이 주문을 삭제할까요?")) return;
  const { error } = await sb.from("orders").delete().eq("id", id);
  if (error) alert(error.message);
  await loadOrders();
}

$("search").addEventListener("input", renderTable);
$("expo-filter").addEventListener("change", renderTable);
$("refresh-btn").addEventListener("click", loadOrders);

function isOnSiteGift(o) {
  // 현장수령 사은품은 창고 출고 없이 그 자리에서 전달하므로 사방넷 집계에서 제외 (배송 선택 시에만 상품명에 "(배송)"이 붙음)
  return (o.상품명 || "").startsWith("[사은품]") && !o.상품명.endsWith("(배송)");
}

function explodeOrder(o, bundleMap) {
  const bundle = bundleMap[`${o.상품코드}|||${o.옵션명}`];
  if (!bundle) return [o];
  return bundle.구성품.map((part, i) => ({
    ...o,
    상품명: part.상품명,
    상품코드: part.상품코드,
    옵션명: part.옵션명,
    수량: part.수량 * (o.수량 || 1),
    주문금액: i === 0 ? o.주문금액 : "", // 금액 중복 계상 방지: 첫 줄에만 표시
  }));
}

$("export-btn").addEventListener("click", async () => {
  const expoName = $("expo-filter").value;
  const bundleMap = {};
  if (expoName) {
    const { data: rows } = await sb.from("exhibitions").select("묶음구성")
      .eq("박람회명", expoName).order("created_at", { ascending: false }).limit(1);
    (rows?.[0]?.묶음구성 || []).forEach(b => { bundleMap[b.코드옵션] = b; });
  }

  const exploded = expoFiltered().filter(o => !isOnSiteGift(o)).flatMap(o => explodeOrder(o, bundleMap));
  const rows = exploded.map(o => COLUMNS.map(c => o[c] ?? ""));
  const ws = XLSX.utils.aoa_to_sheet([COLUMNS, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const expoLabel = $("expo-filter").value || "전체";
  XLSX.writeFile(wb, `사방넷_출고요청서_${expoLabel}_${today()}.xlsx`);
});

$("logout-btn").addEventListener("click", () => sb.auth.signOut());

// realtime: pick up orders entered from other devices
sb.channel("orders-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadOrders)
  .subscribe();

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = "index.html"; return; }

  $("app").classList.remove("hidden");
  loadOrders();
})();
