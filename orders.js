const $ = (id) => document.getElementById(id);
let orders = [];
let showTrash = false;

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

function activeOrders() { return orders.filter(o => !o.deleted_at); }
function trashedOrders() { return orders.filter(o => o.deleted_at); }

function expoFiltered() {
  const expo = $("expo-filter").value;
  const base = showTrash ? trashedOrders() : activeOrders();
  return expo ? base.filter(o => o.판매처 === expo) : base;
}

function renderTable() {
  const q = $("search").value.trim().toLowerCase();
  const base = expoFiltered();
  const rows = q
    ? base.filter(o => (o.수취인 || "").toLowerCase().includes(q) || (o.연락처 || "").toLowerCase().includes(q))
    : base;

  $("list-title").textContent = showTrash ? "휴지통" : "주문 목록";
  $("count-badge").textContent = `(${rows.length}/${(showTrash ? trashedOrders() : activeOrders()).length}건)`;
  $("trash-toggle-btn").textContent = showTrash ? "← 주문 목록으로" : "🗑 휴지통";
  $("export-btn").classList.toggle("hidden", showTrash);

  $("tbody").innerHTML = rows.map(o => `
    <tr>
      <td>${esc(o.판매처)}</td><td>${esc(o.주문번호)}</td><td>${esc(o.주문일)}</td>
      <td>${esc(o.상품명)}</td><td>${esc(o.상품코드)}</td><td>${esc(o.옵션명)}</td>
      <td>${o.수량 ?? ""}</td><td>${o.주문금액 ?? ""}</td><td>${esc(o.업체명)}</td>
      <td>${esc(o.수취인)}</td><td>${esc(o.연락처)}</td><td>${esc(o.우편번호)}</td>
      <td>${esc(o.주소)}</td><td>${esc(o.배송희망일자)}</td><td>${esc(o.배송메세지)}</td>
      <td class="actions">
        ${showTrash
          ? `<button data-restore="${o.id}">복원</button><button data-purge="${o.id}">영구삭제</button>`
          : `<button data-edit="${o.id}">수정</button><button data-del="${o.id}">삭제</button>`}
      </td>
    </tr>`).join("");
  $("tbody").querySelectorAll("[data-edit]").forEach(b =>
    b.addEventListener("click", () => location.href = `index.html?edit=${b.dataset.edit}`));
  $("tbody").querySelectorAll("[data-del]").forEach(b =>
    b.addEventListener("click", () => deleteOrder(b.dataset.del)));
  $("tbody").querySelectorAll("[data-restore]").forEach(b =>
    b.addEventListener("click", () => restoreOrder(b.dataset.restore)));
  $("tbody").querySelectorAll("[data-purge]").forEach(b =>
    b.addEventListener("click", () => purgeOrder(b.dataset.purge)));
}

async function deleteOrder(id) {
  if (!confirm("정말 삭제하시겠습니까?")) return;
  const { error } = await sb.from("orders").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) alert(error.message);
  await loadOrders();
}

async function restoreOrder(id) {
  const { error } = await sb.from("orders").update({ deleted_at: null }).eq("id", id);
  if (error) alert(error.message);
  await loadOrders();
}

async function purgeOrder(id) {
  if (!confirm("영구 삭제하면 복구할 수 없습니다. 계속할까요?")) return;
  const { error } = await sb.from("orders").delete().eq("id", id);
  if (error) alert(error.message);
  await loadOrders();
}

$("trash-toggle-btn").addEventListener("click", () => {
  showTrash = !showTrash;
  renderTable();
});

$("search").addEventListener("input", renderTable);
$("search-btn").addEventListener("click", renderTable);
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

  const exploded = expoFiltered().filter(o => !o.deleted_at && !isOnSiteGift(o)).flatMap(o => explodeOrder(o, bundleMap));
  const rows = exploded.map(o => COLUMNS.map(c => o[c] ?? ""));
  const ws = XLSX.utils.aoa_to_sheet([COLUMNS, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const expoLabel = $("expo-filter").value || "전체";
  XLSX.writeFile(wb, `사방넷_출고요청서_${expoLabel}_${today()}.xlsx`);
});

$("logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut();
  location.href = "index.html";
});

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
