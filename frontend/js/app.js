// Page logic: tax calculation (reads TAX_YEARS) and rendering.
const $ = (id) => document.getElementById(id),
  R = (n) => "R" + Math.round(n).toLocaleString("en-ZA");
const Y = TAX_YEARS[CURRENT_YEAR],
  B = Y.brackets;
const s = { gross: 480000, age: 0, ret: 24000, med: 2 };

function calc() {
  const ded = Math.min(
      s.ret,
      Y.retirement.rate * s.gross,
      Y.retirement.annualCap,
    ),
    ti = Math.max(0, s.gross - ded);
  const i = B.findIndex((b) => ti <= b[0]),
    lo = i ? B[i - 1][0] : 0,
    gt = B[i][1] + (ti - lo) * B[i][2];
  const reb =
    Y.rebates.primary +
    (s.age >= 1 ? Y.rebates.secondary : 0) +
    (s.age >= 2 ? Y.rebates.tertiary : 0);
  const m = Y.medicalCredit;
  const mc =
    12 *
    (m.main * Math.min(s.med, 1) +
      m.firstDependant * Math.max(0, Math.min(s.med - 1, 1)) +
      m.additional * Math.max(0, s.med - 2));
  const net = Math.max(0, gt - reb - mc),
    uif = Math.min((s.gross / 12) * Y.uifRate, Y.uifMonthlyCap) * 12;
  return {
    ded,
    ti,
    gt,
    reb,
    mc,
    net,
    uif,
    i,
    rate: B[i][2],
    take: s.gross - net - uif,
    eff: s.gross ? net / s.gross : 0,
  };
}
function render() {
  const c = calc();
  $("oG").textContent = R(s.gross);
  $("kTax").textContent = R(c.net);
  $("kTaxS").textContent = R(c.net / 12) + " a month";
  $("kEff").textContent = (c.eff * 100).toFixed(1) + "%";
  $("kEffS").textContent = "Top rate " + Math.round(c.rate * 100) + "%";
  $("tTax").textContent = R(c.net);
  $("tMonth").textContent =
    R(c.net / 12) + " a month, " + R(c.take / 12) + " take-home";
  $("ladder").innerHTML = B.map(
    (b, i) =>
      `<i class="${i === c.i ? "on" : ""}" title="Up to ${b[0] === Infinity ? "no limit" : R(b[0])}">${Math.round(b[2] * 100)}%</i>`,
  ).join("");
  $("tRate").textContent =
    "Your next rand is taxed at " + Math.round(c.rate * 100) + "%.";
  const L = (a, b) => `<div class="dl"><span>${a}</span><b>${b}</b></div>`;
  $("brk").innerHTML =
    L("Retirement deduction", "−" + R(c.ded)) +
    L("Taxable income", R(c.ti)) +
    L("Tax before credits", R(c.gt)) +
    L("Age rebate", "−" + R(c.reb)) +
    L("Medical credit", "−" + R(c.mc)) +
    L("UIF (1%, capped)", R(c.uif));
}
function renderLists() {
  $("tx").innerHTML = TX.map(
    (t) =>
      `<div class="row"><span class="dt">${t.d}</span><div>${t.n}<small>${t.c}${t.x ? ", deductible" : ""}</small></div><b class="${t.a > 0 ? "pos" : ""}">${t.a > 0 ? "+" : "−"}${R(Math.abs(t.a))}</b><i class="dot ${t.r === 1 ? "" : t.r === 0 ? "m" : "n"}" title="${t.r === 1 ? "Receipt attached" : t.r === 0 ? "Receipt missing" : "No receipt needed"}"></i></div>`,
  ).join("");
  $("kDed").textContent = R(
    TX.filter((t) => t.x).reduce((a, t) => a + Math.abs(t.a), 0),
  );
  $("flags").innerHTML = FL.length
    ? FL.map(
        (f) =>
          `<div class="flag ${f.c}"><div><b>${f.t}</b><span>${f.d}</span></div><button class="ghost" data-id="${f.id}">Dismiss</button></div>`,
      ).join("")
    : `<div class="empty">All clear. Nothing needs your attention.</div>`;
  $("kFlag").textContent = FL.length;
  const days = Math.max(
    0,
    Math.ceil((new Date(2027, 1, 28) - new Date()) / 864e5),
  );
  $("dl").innerHTML = [
    ["Second provisional payment", "End Feb 2027"],
    ["Tax year ends", "28 Feb 2027, " + days + " days"],
    ["Top-up payment", "30 Sep 2027"],
  ]
    .map((r) => `<div class="dl"><span>${r[0]}</span><b>${r[1]}</b></div>`)
    .join("");
  const mx = CT[0][1];
  $("cats").innerHTML = CT.map(
    (c) =>
      `<div class="bar"><span>${c[0]}</span><i><u style="width:${(c[1] / mx) * 100}%"></u></i><em>${R(c[1])}</em></div>`,
  ).join("");
}
$("flags").addEventListener("click", (e) => {
  const b = e.target.closest("[data-id]");
  if (!b) return;
  FL = FL.filter((f) => f.id != b.dataset.id);
  renderLists();
});
document.querySelectorAll(".nav").forEach((b) =>
  b.addEventListener("click", () => {
    document
      .querySelectorAll(".nav")
      .forEach((n) => n.removeAttribute("aria-current"));
    b.setAttribute("aria-current", "page");
    document
      .querySelectorAll(".view")
      .forEach((v) => (v.hidden = v.id !== b.dataset.v));
  }),
);
[
  ["gross", "gross"],
  ["age", "age"],
  ["ret", "ret"],
  ["med", "med"],
].forEach(([id, k]) => {
  const el = $(id);
  el.value = s[k];
  el.addEventListener("input", () => {
    s[k] = Math.max(0, +el.value || 0);
    render();
  });
});
renderLists();
render();
