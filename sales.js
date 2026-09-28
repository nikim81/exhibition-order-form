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
  sel.innerHTML = `<option value="">전체 박람회</option>` + expos.map(e => `<option value="${e}">${e}</option>`).join("");
  sel.value = expos.includes(prev) ? prev : "";
}

function render() {
  const expo = $("expo-select").value;
  const rows = expo ? orders.filter(o => o.판매처 === expo) : orders;

  $("stat-count").textContent = `${rows.length}건`;
  $("stat-qty").textContent = `${rows.reduce((s, o) => s + (o.수량 || 0), 0)}개`;
  const totalAmount = rows.reduce((s, o) => s + (Number(o.주문금액) || 0), 0);
  $("stat-amount").textContent = `${totalAmount.toLocaleString()}원`;

  const isMain = (o) => (o.상품명 || "").includes("시그니처2플러스");
  const isAcc = (o) => o.상품명 === "ACC";
  renderGroup("main-tbody", "main-qty-badge", rows.filter(isMain));
  renderGroup("acc-tbody", "acc-qty-badge", rows.filter(isAcc));
  renderExpoSummary();
}

function renderExpoSummary() {
  const byExpo = {};
  orders.forEach(o => {
    const name = o.판매처 || "(미지정)";
    if (!byExpo[name]) byExpo[name] = { count: 0, qty: 0, amount: 0 };
    byExpo[name].count += 1;
    byExpo[name].qty += o.수량 || 0;
    byExpo[name].amount += Number(o.주문금액) || 0;
  });
  const list = Object.entries(byExpo).sort((a, b) => b[1].amount - a[1].amount);
  const totals = list.reduce((s, [, v]) => ({ count: s.count + v.count, qty: s.qty + v.qty, amount: s.amount + v.amount }), { count: 0, qty: 0, amount: 0 });

  $("expo-summary-tbody").innerHTML = list.length ? list.map(([name, v]) => `
    <tr class="expo-summary-row" data-expo="${name}"><td>${name}</td><td>${v.count}건</td><td>${v.qty}개</td><td>${v.amount.toLocaleString()}원</td></tr>
  `).join("") + `<tr style="font-weight:700;background:#f9fafb;"><td>전체 합계</td><td>${totals.count}건</td><td>${totals.qty}개</td><td>${totals.amount.toLocaleString()}원</td></tr>`
    : `<tr><td colspan="4" style="color:#999;">데이터 없음</td></tr>`;

  $("expo-summary-tbody").querySelectorAll("[data-expo]").forEach(tr =>
    tr.addEventListener("click", () => { $("expo-select").value = tr.dataset.expo; render(); }));
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
$("logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut();
  location.href = "index.html";
});

sb.channel("orders-changes-sales")
  .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadOrders)
  .subscribe();

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = "index.html"; return; }
  $("app").classList.remove("hidden");
  loadOrders();
})();
