const $ = (id) => document.getElementById(id);
let orders = [];

function today() { return new Date().toISOString().slice(0, 10); }

async function loadOrders() {
  const { data, error } = await sb.from("orders").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return; }
  orders = data;
  renderTable();
}

function renderTable() {
  const q = $("search").value.trim().toLowerCase();
  const rows = q
    ? orders.filter(o => (o.수취인 || "").toLowerCase().includes(q) || (o.연락처 || "").toLowerCase().includes(q))
    : orders;

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
$("refresh-btn").addEventListener("click", loadOrders);

$("export-btn").addEventListener("click", () => {
  const rows = orders.map(o => COLUMNS.map(c => o[c] ?? ""));
  const ws = XLSX.utils.aoa_to_sheet([COLUMNS, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, `사방넷_출고요청서_${today()}.xlsx`);
});

$("logout-btn").addEventListener("click", () => sb.auth.signOut());

// realtime: pick up orders entered from other devices
sb.channel("orders-changes")
  .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadOrders)
  .subscribe();

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = "index.html"; return; }

  const pw = prompt("관리자 비밀번호를 입력하세요");
  if (pw !== "1114") {
    alert(pw === null ? "취소되었습니다." : "비밀번호가 틀렸습니다.");
    location.href = "index.html";
    return;
  }

  $("app").classList.remove("hidden");
  loadOrders();
})();
