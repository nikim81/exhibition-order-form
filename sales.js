const $ = (id) => document.getElementById(id);
let orders = [];

async function loadOrders() {
  const { data, error } = await sb.from("orders").select("*").order("created_at", { ascending: false });
  if (error) { console.error(error); return; }
  orders = data;
  fillExpoSelect();
  render();
}

function fillExpoSelect() {
  const sel = $("expo-select");
  const prev = sel.value;
  const expos = [...new Set(orders.map(o => o.판매처).filter(Boolean))];
  sel.innerHTML = expos.map(e => `<option value="${e}">${e}</option>`).join("");
  sel.value = expos.includes(prev) ? prev : (expos[0] || "");
}

function render() {
  const expo = $("expo-select").value;
  const rows = orders.filter(o => o.판매처 === expo);

  $("stat-count").textContent = `${rows.length}건`;
  $("stat-qty").textContent = `${rows.reduce((s, o) => s + (o.수량 || 0), 0)}개`;
  const totalAmount = rows.reduce((s, o) => s + (Number(o.주문금액) || 0), 0);
  $("stat-amount").textContent = `${totalAmount.toLocaleString()}원`;

  const isMain = (o) => (o.상품명 || "").includes("시그니처2플러스");
  const isAcc = (o) => o.상품명 === "ACC";
  renderGroup("main-tbody", "main-qty-badge", rows.filter(isMain));
  renderGroup("acc-tbody", "acc-qty-badge", rows.filter(isAcc));
}

function renderGroup(tbodyId, badgeId, rows) {
  const byColor = {};
  rows.forEach(o => {
    const key = `${o.상품명}|||${o.옵션명}`;
    if (!byColor[key]) byColor[key] = { 상품명: o.상품명, 옵션명: o.옵션명, count: 0, qty: 0 };
    byColor[key].count += 1;
    byColor[key].qty += o.수량 || 0;
  });
  const list = Object.values(byColor).sort((a, b) => b.qty - a.qty);

  $(badgeId).textContent = `(총 ${rows.reduce((s, o) => s + (o.수량 || 0), 0)}개)`;
  $(tbodyId).innerHTML = list.map(c => `
    <tr><td>${c.상품명 ?? ""}</td><td>${c.옵션명 ?? ""}</td><td>${c.count}</td><td>${c.qty}</td></tr>
  `).join("") || `<tr><td colspan="4" style="color:#999;">데이터 없음</td></tr>`;
}

$("expo-select").addEventListener("change", render);
$("refresh-btn").addEventListener("click", loadOrders);
$("logout-btn").addEventListener("click", () => sb.auth.signOut());

sb.channel("orders-changes-sales")
  .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadOrders)
  .subscribe();

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = "index.html"; return; }
  $("app").classList.remove("hidden");
  loadOrders();
})();
