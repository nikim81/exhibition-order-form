const $ = (id) => document.getElementById(id);
let orders = [];
let expoStart = {}; // 박람회명 → 시작일

async function loadOrders() {
  const { data, error } = await fetchAll("orders", q => q.is("deleted_at", null).order("created_at", { ascending: false }).order("id"));
  if (error) { console.error(error); return; }
  orders = data;
  const { data: exps } = await sb.from("exhibitions").select("박람회명, 시작일");
  expoStart = Object.fromEntries((exps || []).map(e => [e.박람회명, e.시작일 || ""]));
  fillExpoSelect();
  render();
}

function fillExpoSelect() {
  const sel = $("expo-select");
  const prev = sel.value;
  // 박람회 시작일 최신순 (시작일 없으면 뒤로, 동률은 최근 주문순 유지)
  const expos = [...new Set(orders.map(o => o.판매처).filter(Boolean))]
    .sort((a, b) => (expoStart[b] || "").localeCompare(expoStart[a] || ""));
  sel.innerHTML = `<option value="">전체 박람회</option>` + expos.map(e => `<option value="${esc(e)}">${esc(e)}</option>`).join("");
  // 첫 로드엔 시작일이 가장 최근인 박람회를 기본 선택
  sel.value = expoPicked ? (expos.includes(prev) ? prev : "") : (expos[0] || "");
}
let expoPicked = false; // 사용자가 직접 고른 뒤엔 새로고침/실시간 갱신 시 선택 유지

const isGift = (o) => (o.상품명 || "").startsWith("[사은품]");
const isMain = (o) => (o.상품명 || "").includes("시그니처2플러스") || o.상품명 === "분유포트";
const isAcc = (o) => o.상품명 === "ACC";
const isSteril = (o) => (o.상품명 || "").includes("시그니처2플러스");
const isPot = (o) => o.상품명 === "분유포트";
const isEarlyBird = (o) => (o.옵션명 || "").includes("슈퍼얼리버드");
const sterilTier = (o) => o.상품명.includes("ACC4종") ? "4종" : o.상품명.includes("ACC3종") ? "3종" : "단품";

// 매출 비중: 구분별 색은 고정 (필터로 0원 구분이 빠져도 나머지 색이 바뀌지 않게)
const SHARE_GROUPS = [
  { label: "소독기 단품", color: "#2a78d6", match: o => isSteril(o) && sterilTier(o) === "단품" },
  { label: "소독기 3종", color: "#eb6834", match: o => isSteril(o) && sterilTier(o) === "3종" },
  { label: "소독기 4종", color: "#1baf7a", match: o => isSteril(o) && sterilTier(o) === "4종" },
  { label: "분유포트", color: "#eda100", match: isPot },
  { label: "액세서리(ACC)", color: "#e87ba4", match: isAcc },
  { label: "사은품 배송비", color: "#008300", match: isGift },
];

// 타일 숫자가 길면(큰 금액) 넘치지 않을 때까지 글자 크기를 24px → 12px 사이에서 줄임
function fitStatValues() {
  document.querySelectorAll(".stat-tile .value").forEach(el => {
    let size = 24;
    el.style.fontSize = `${size}px`;
    while (el.scrollWidth > el.clientWidth && size > 12) el.style.fontSize = `${--size}px`;
  });
}
window.addEventListener("resize", fitStatValues);

function renderShare(rows) {
  const groups = SHARE_GROUPS.map(g => {
    const list = rows.filter(g.match);
    return { ...g, qty: list.reduce((s, o) => s + (o.수량 || 0), 0), amount: list.reduce((s, o) => s + (Number(o.주문금액) || 0), 0) };
  }).filter(g => g.amount > 0);
  const total = groups.reduce((s, g) => s + g.amount, 0);
  const pct = (a) => `${(a / total * 100).toFixed(1)}%`;

  // 도넛: 조각 사이 2px 흰 간격, 한 조각뿐이면 원 전체
  let start = -Math.PI / 2;
  const pt = (r, a) => `${(100 + r * Math.cos(a)).toFixed(2)} ${(100 + r * Math.sin(a)).toFixed(2)}`;
  $("share-pie").innerHTML = !total
    ? `<circle cx="100" cy="100" r="72" fill="none" stroke="#e6e8ec" stroke-width="40"/><text x="100" y="105" text-anchor="middle" font-size="13" fill="#777">데이터 없음</text>`
    : groups.map(g => {
        const sweep = g.amount / total * Math.PI * 2;
        const end = start + sweep, large = sweep > Math.PI ? 1 : 0;
        const d = groups.length === 1
          ? `M ${pt(92, 0)} A 92 92 0 1 1 ${pt(92, Math.PI)} A 92 92 0 1 1 ${pt(92, 0)} M ${pt(52, 0)} A 52 52 0 1 0 ${pt(52, Math.PI)} A 52 52 0 1 0 ${pt(52, 0)} Z`
          : `M ${pt(92, start)} A 92 92 0 ${large} 1 ${pt(92, end)} L ${pt(52, end)} A 52 52 0 ${large} 0 ${pt(52, start)} Z`;
        start = end;
        return `<path d="${d}" fill="${g.color}" fill-rule="evenodd" stroke="#fff" stroke-width="2"><title>${g.label}: ${g.amount.toLocaleString()}원 (${pct(g.amount)})</title></path>`;
      }).join("") + `<text x="100" y="96" text-anchor="middle" font-size="11" fill="#52514e">${groups.some(g => g.match === isGift) ? "합계(배송비 포함)" : "합계"}</text><text x="100" y="114" text-anchor="middle" font-size="14" font-weight="700" fill="#0b0b0b">${total.toLocaleString()}원</text>`;

  $("share-tbody").innerHTML = groups.length
    ? groups.map(g => `<tr><td><span class="dot" style="background:${g.color}"></span>${g.label}</td><td>${g.qty}개</td><td>${g.amount.toLocaleString()}원</td><td>${pct(g.amount)}</td></tr>`).join("")
    : `<tr><td colspan="4" style="color:#999;">데이터 없음</td></tr>`;
}

function render() {
  const expo = $("expo-select").value;
  const rows = expo ? orders.filter(o => o.판매처 === expo) : orders;
  const saleRows = rows.filter(o => !isGift(o));
  const giftRows = rows.filter(isGift);

  $("stat-count").textContent = `${saleRows.length}건`;
  $("stat-qty").textContent = `${saleRows.reduce((s, o) => s + (o.수량 || 0), 0)}개`;
  const totalAmount = saleRows.reduce((s, o) => s + (Number(o.주문금액) || 0), 0);
  $("stat-amount").textContent = `${totalAmount.toLocaleString()}원`;
  $("stat-gift-count").textContent = `${giftRows.length}건`;
  const giftFeeTotal = giftRows.reduce((s, o) => s + (Number(o.주문금액) || 0), 0);
  $("stat-gift-fee").textContent = giftFeeTotal > 0 ? `배송비 ${giftFeeTotal.toLocaleString()}원 포함` : "";

  const qty = (list) => list.reduce((s, o) => s + (o.수량 || 0), 0);
  const steril = rows.filter(isSteril), pots = rows.filter(isPot);
  $("stat-steril-qty").textContent = `${qty(steril)}대`;
  $("stat-steril-sub").textContent = ["단품", "3종", "4종"].map(t => `${t} ${qty(steril.filter(o => sterilTier(o) === t))}`).join(" · ");
  $("stat-pot-qty").textContent = `${qty(pots)}개`;
  $("stat-pot-sub").textContent = `일반 ${qty(pots.filter(o => !isEarlyBird(o)))} · 슈퍼얼리버드 ${qty(pots.filter(isEarlyBird))}`;
  renderShare(rows);
  fitStatValues();

  renderGroup("main-tbody", "main-qty-badge", rows.filter(isMain));
  renderGroup("acc-tbody", "acc-qty-badge", rows.filter(isAcc));
  renderExpoSummary();
  renderDailySummary(saleRows);
}

function renderDailySummary(saleRows) {
  const byDay = {};
  saleRows.forEach(o => {
    const day = o.주문일 || "(미지정)";
    if (!byDay[day]) byDay[day] = { sterilCount: 0, sterilQty: 0, potCount: 0, potQty: 0, accCount: 0, accQty: 0, amount: 0 };
    const v = byDay[day];
    if (isSteril(o)) { v.sterilCount += 1; v.sterilQty += o.수량 || 0; }
    else if (isPot(o)) { v.potCount += 1; v.potQty += o.수량 || 0; }
    else if (isAcc(o)) { v.accCount += 1; v.accQty += o.수량 || 0; }
    v.amount += Number(o.주문금액) || 0;
  });
  const list = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]));
  const totals = list.reduce((s, [, v]) => ({
    sterilCount: s.sterilCount + v.sterilCount, sterilQty: s.sterilQty + v.sterilQty,
    potCount: s.potCount + v.potCount, potQty: s.potQty + v.potQty,
    accCount: s.accCount + v.accCount, accQty: s.accQty + v.accQty,
    amount: s.amount + v.amount,
  }), { sterilCount: 0, sterilQty: 0, potCount: 0, potQty: 0, accCount: 0, accQty: 0, amount: 0 });

  const row = (label, v, bold) => `
    <tr${bold ? ' style="font-weight:700;background:#f9fafb;"' : ""}>
      <td>${esc(label)}</td><td>${v.sterilCount}건</td><td>${v.sterilQty}대</td><td>${v.potCount}건</td><td>${v.potQty}개</td><td>${v.accCount}건</td><td>${v.accQty}개</td><td>${v.amount.toLocaleString()}원</td>
    </tr>`;

  $("daily-tbody").innerHTML = list.length
    ? list.map(([day, v]) => row(day, v, false)).join("") + row("합계", totals, true)
    : `<tr><td colspan="8" style="color:#999;">데이터 없음</td></tr>`;
}

function renderExpoSummary() {
  const byExpo = {};
  orders.filter(o => !isGift(o)).forEach(o => {
    const name = o.판매처 || "(미지정)";
    if (!byExpo[name]) byExpo[name] = { count: 0, qty: 0, amount: 0 };
    byExpo[name].count += 1;
    byExpo[name].qty += o.수량 || 0;
    byExpo[name].amount += Number(o.주문금액) || 0;
  });
  const list = Object.entries(byExpo).sort((a, b) => b[1].amount - a[1].amount);
  const totals = list.reduce((s, [, v]) => ({ count: s.count + v.count, qty: s.qty + v.qty, amount: s.amount + v.amount }), { count: 0, qty: 0, amount: 0 });

  $("expo-summary-tbody").innerHTML = list.length ? list.map(([name, v]) => `
    <tr class="expo-summary-row" data-expo="${esc(name)}"><td>${esc(name)}</td><td>${v.count}건</td><td>${v.qty}개</td><td>${v.amount.toLocaleString()}원</td></tr>
  `).join("") + `<tr style="font-weight:700;background:#f9fafb;"><td>전체 합계</td><td>${totals.count}건</td><td>${totals.qty}개</td><td>${totals.amount.toLocaleString()}원</td></tr>`
    : `<tr><td colspan="4" style="color:#999;">데이터 없음</td></tr>`;

  $("expo-summary-tbody").querySelectorAll("[data-expo]").forEach(tr =>
    tr.addEventListener("click", () => { $("expo-select").value = tr.dataset.expo; expoPicked = true; render(); }));
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
    <tr><td>${esc(c.상품명)}</td><td>${esc(c.옵션명)}</td><td>${c.count}</td><td>${c.qty}</td></tr>
  `).join("") || `<tr><td colspan="4" style="color:#999;">데이터 없음</td></tr>`;
}

$("expo-select").addEventListener("change", () => { expoPicked = true; render(); });
$("refresh-btn").addEventListener("click", loadOrders);
$("logout-btn").addEventListener("click", async () => {
  await sb.auth.signOut({ scope: "local" });
  location.href = "index.html";
});

// 주문 1건이 여러 줄이라 이벤트가 연달아 오므로, 몰아서 한 번만 다시 불러옴 (태블릿 부하 방지)
let reloadTimer;
function scheduleReload() { clearTimeout(reloadTimer); reloadTimer = setTimeout(loadOrders, 800); }
sb.channel("orders-changes-sales")
  .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleReload)
  .subscribe();

(async () => {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { location.href = "index.html"; return; }
  $("app").classList.remove("hidden");
  loadOrders();
})();
