/* ChurnSight dashboard: loads Spark results from /api/data and renders the page. */

const charts = {};
let DATA = null;

// ── Helpers ──────────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const num = (n, d = 0) => Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n, d = 1) => `${num(n, d)}%`;
const money = (n) => n >= 1e6 ? `$${num(n / 1e6, 1)}M` : n >= 1e3 ? `$${num(n / 1e3, 0)}K` : `$${num(n, 0)}`;
const maxBy = (arr, k) => arr.reduce((a, b) => (b[k] > a[k] ? b : a));
const minBy = (arr, k) => arr.reduce((a, b) => (b[k] < a[k] ? b : a));
const ratio = (a, b) => (b ? a / b : 0);
const times = (r) => `${num(r, r >= 10 ? 0 : 1)}×`;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const NICE = {
  'Month-to-month': 'Month-to-month', 'One year': 'One-year', 'Two year': 'Two-year',
  '0-1 Year': 'First year', '1-2 Years': '1–2 years', '2-4 Years': '2–4 years', '4+ Years': '4+ years',
  OnlineSecurity: 'Online security', TechSupport: 'Tech support',
  OnlineBackup: 'Online backup', DeviceProtection: 'Device protection',
  'Fiber optic': 'Fiber optic', DSL: 'DSL', No: 'No internet',
  'Electronic check': 'Electronic check', 'Mailed check': 'Mailed check',
  'Bank transfer (automatic)': 'Bank transfer (auto)', 'Credit card (automatic)': 'Credit card (auto)',
};
const nice = (s) => NICE[s] ?? s;

// ── Chart.js plugins ─────────────────────────────────────────────────────
// Dashed reference line, e.g. the overall churn rate.
const refLine = {
  id: 'refLine',
  beforeDatasetsDraw(chart, _args, opts) {
    if (opts.value == null) return;
    const { ctx, chartArea: a } = chart;
    const horizontal = chart.options.indexAxis === 'y';
    const scale = horizontal ? chart.scales.x : chart.scales.y;
    const p = scale.getPixelForValue(opts.value);
    ctx.save();
    ctx.strokeStyle = css('--ink-2');
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (horizontal) { ctx.moveTo(p, a.top); ctx.lineTo(p, a.bottom); }
    else { ctx.moveTo(a.left, p); ctx.lineTo(a.right, p); }
    ctx.stroke();
    // Key in the top-left corner so it never collides with bar labels or the legend
    const ky = a.top - 16;
    ctx.beginPath(); ctx.moveTo(a.left, ky); ctx.lineTo(a.left + 22, ky); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = css('--ink-2');
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(opts.label, a.left + 28, ky);
    ctx.restore();
  },
};

// Value printed at the end of each bar.
const barValues = {
  id: 'barValues',
  afterDatasetsDraw(chart, _args, opts) {
    if (!opts.format) return;
    const { ctx } = chart;
    const horizontal = chart.options.indexAxis === 'y';
    ctx.save();
    ctx.fillStyle = css('--ink');
    ctx.font = '600 12px system-ui, sans-serif';
    chart.data.datasets.forEach((ds, i) => {
      const meta = chart.getDatasetMeta(i);
      if (meta.hidden || meta.type !== 'bar') return;
      meta.data.forEach((bar, j) => {
        const text = opts.format(ds.data[j]);
        if (horizontal) { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(text, bar.x + 6, bar.y); }
        else { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(text, bar.x, bar.y - 4); }
      });
    });
    ctx.restore();
  },
};

Chart.register(refLine, barValues);

function baseOptions({ horizontal = false, max, unit = '%', legend = false } = {}) {
  const grid = css('--grid'), muted = css('--muted');
  const valueAxis = {
    beginAtZero: true, max, grid: { color: grid }, border: { display: false },
    ticks: { color: muted, callback: (v) => unit === '%' ? `${v}%` : num(v) },
  };
  const catAxis = { grid: { display: false }, border: { color: css('--axis') }, ticks: { color: css('--ink-2'), font: { size: 12 } } };
  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    layout: { padding: horizontal ? { right: 48, top: 26 } : { top: 30 } },
    interaction: { mode: 'nearest', intersect: horizontal ? false : true, axis: horizontal ? 'y' : 'x' },
    scales: horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
    plugins: {
      legend: { display: legend, position: 'top', align: 'end', labels: { color: css('--ink-2'), boxWidth: 12, boxHeight: 12, usePointStyle: true, pointStyle: 'rectRounded' } },
      tooltip: {
        backgroundColor: css('--surface'), titleColor: css('--ink'), bodyColor: css('--ink-2'),
        borderColor: css('--border'), borderWidth: 1, padding: 10, cornerRadius: 8, displayColors: legend,
      },
    },
  };
}

function draw(id, config) {
  charts[id]?.destroy();
  charts[id] = new Chart($(id), config);
}

const barStyle = (color) => ({
  backgroundColor: color, borderRadius: 4, borderSkipped: 'start',
  maxBarThickness: 44, categoryPercentage: 0.7, barPercentage: 0.9,
});

// Single-series churn chart with the overall rate as a reference line.
function churnChart(id, rows, { horizontal = false, avg }) {
  const opts = baseOptions({ horizontal, max: Math.max(60, Math.ceil(maxBy(rows, 'churn_rate').churn_rate / 10) * 10 + 5) });
  opts.plugins.refLine = { value: avg, label: `Average ${pct(avg)}` };
  opts.plugins.barValues = { format: (v) => pct(v) };
  opts.plugins.tooltip.callbacks = {
    label: (c) => {
      const r = rows[c.dataIndex];
      return ` ${pct(r.churn_rate)} left — ${num(r.churned)} of ${num(r.customers)} customers`;
    },
  };
  draw(id, {
    type: 'bar',
    data: { labels: rows.map((r) => nice(r.label)), datasets: [{ label: 'Churn rate', data: rows.map((r) => r.churn_rate), ...barStyle(css('--series-1')) }] },
    options: opts,
  });
  addDataTable(id, ['Group', 'Customers', 'Left', 'Churn rate'],
    rows.map((r) => [nice(r.label), num(r.customers), num(r.churned), pct(r.churn_rate)]));
}

function addDataTable(canvasId, head, body) {
  const card = $(canvasId).closest('.card');
  card.querySelector('details.data')?.remove();
  const d = document.createElement('details');
  d.className = 'data';
  d.innerHTML = `<summary>Show the numbers</summary><table>
    <thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead>
    <tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  card.appendChild(d);
}

// ── Sections ─────────────────────────────────────────────────────────────
function kpi(label, value, note) {
  return `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div><div class="kpi-note">${note}</div></div>`;
}

function renderKPIs(t, r) {
  $('kpis-telco').innerHTML = [
    kpi('Customers analysed', num(t.total_customers), 'Telecom subscribers in the dataset'),
    kpi('Churn rate', pct(t.churn_rate), `${num(t.churned)} customers cancelled`),
    kpi('Revenue lost per month', money(t.monthly_revenue_lost), `${pct(ratio(t.monthly_revenue_lost, t.monthly_revenue) * 100)} of all monthly billing`),
    kpi('Average bill', `$${num(t.avg_monthly, 2)}`, `Per customer per month · avg. tenure ${num(t.avg_tenure_months / 12, 1)} yrs`),
  ].join('');
  $('kpis-risk').innerHTML = [
    kpi('Audits performed', num(r.total_engagements), `By 4 firms, ${r.first_year}–${r.last_year}`),
    kpi('High-risk share', pct(r.avg_risk_pct), `${num(r.total_high_risk)} audits flagged high-risk`),
    kpi('Fraud cases found', num(r.total_fraud), `${pct(ratio(r.total_fraud, r.total_engagements) * 100, 1)} of all audits`),
    kpi('Average quality score', `${num(r.avg_quality, 2)} / 10`, 'Effectiveness + client satisfaction'),
  ].join('');
}

function renderFindings(t, r) {
  const contract = Object.fromEntries(t.by_contract.map((x) => [x.label, x]));
  const m2m = contract['Month-to-month'], two = contract['Two year'];
  const firstYear = t.by_tenure.find((x) => x.label === '0-1 Year');
  const addon = maxBy(t.by_addon.map((a) => ({ ...a, r: ratio(a.without_rate, a.with_rate) })), 'r');
  const riskiest = r.by_industry[0];
  const ai = r.ai_vs_manual.find((x) => x.label === 'AI-assisted');
  const manual = r.ai_vs_manual.find((x) => x.label === 'Manual');
  const qDiff = ai.avg_quality - manual.avg_quality;

  const items = [
    { tag: 'Churn', big: `1 in ${Math.round(100 / t.churn_rate)}`,
      text: `customers left — <b>${num(t.churned)}</b> of ${num(t.total_customers)} (${pct(t.churn_rate)}).`,
      act: `That costs about <b>${money(t.monthly_revenue_lost)}</b> in billing every month.` },
    { tag: 'Contracts', big: times(ratio(m2m.churn_rate, two.churn_rate)),
      text: `Month-to-month customers leave this much more often than two-year customers (<b>${pct(m2m.churn_rate)}</b> vs ${pct(two.churn_rate)}).`,
      act: 'Encourage longer contracts with discounts or perks.' },
    { tag: 'Timing', big: pct(firstYear.churn_rate, 0),
      text: 'of customers in their <b>first year</b> leave — the riskiest period by far.',
      act: 'Invest in onboarding and early check-ins.' },
    { tag: 'Add-ons', big: times(addon.r),
      text: `Internet customers <b>without ${nice(addon.label).toLowerCase()}</b> leave this much more often than those who have it.`,
      act: 'Bundle security and support into plans.' },
    { tag: 'Audit risk', big: riskiest.label,
      text: `has the highest share of high-risk audits: <b>${pct(riskiest.risk_pct)}</b> vs ${pct(r.avg_risk_pct)} on average.`,
      act: 'Direct extra audit attention to this sector.' },
    { tag: 'AI in auditing', big: `${qDiff >= 0 ? '+' : ''}${num(qDiff, 2)}`,
      text: `quality points for AI-assisted audits (<b>${num(ai.avg_quality, 2)}</b> vs ${num(manual.avg_quality, 2)} manual).`,
      act: Math.abs(qDiff) < 0.3 ? 'A small edge: AI helps, but it is not a game-changer yet.' : 'A clear edge for AI-assisted audits.' },
  ];
  $('findings-list').innerHTML = items.map((f) => `
    <div class="finding"><span class="tag">${f.tag}</span><span class="big">${f.big}</span>
      <p>${f.text}</p><div class="act">${f.act}</div></div>`).join('');
}

function renderCustomers(t) {
  const avg = t.churn_rate;
  const order = ['Month-to-month', 'One year', 'Two year'];
  const contracts = [...t.by_contract].sort((a, b) => order.indexOf(a.label) - order.indexOf(b.label));
  churnChart('c-contract', contracts, { avg });
  const m2m = contracts[0], two = contracts[contracts.length - 1];
  $('i-contract').innerHTML = `<b>${pct(m2m.churn_rate)}</b> of month-to-month customers left, compared with only <b>${pct(two.churn_rate)}</b> on two-year contracts. Commitment strongly predicts loyalty.`;

  churnChart('c-tenure', t.by_tenure, { avg });
  const first = t.by_tenure[0], last = t.by_tenure[t.by_tenure.length - 1];
  $('i-tenure').innerHTML = `Churn falls steadily the longer someone stays: <b>${pct(first.churn_rate)}</b> in the first year down to <b>${pct(last.churn_rate)}</b> after four years. The first 12 months matter most.`;

  // Add-ons: grouped bars (without vs with)
  const opts = baseOptions({ horizontal: true, max: 60, legend: true });
  opts.plugins.refLine = { value: avg, label: `Average ${pct(avg)}` };
  opts.plugins.barValues = { format: (v) => pct(v, 0) };
  opts.plugins.tooltip.callbacks = { label: (c) => ` ${c.dataset.label}: ${pct(c.raw)} left` };
  draw('c-addon', {
    type: 'bar',
    data: {
      labels: t.by_addon.map((a) => nice(a.label)),
      datasets: [
        { label: 'Without it', data: t.by_addon.map((a) => a.without_rate), ...barStyle(css('--series-2')) },
        { label: 'With it', data: t.by_addon.map((a) => a.with_rate), ...barStyle(css('--series-1')) },
      ],
    },
    options: opts,
  });
  addDataTable('c-addon', ['Service', 'Churn without', 'Churn with'],
    t.by_addon.map((a) => [nice(a.label), pct(a.without_rate), pct(a.with_rate)]));
  const best = maxBy(t.by_addon.map((a) => ({ ...a, d: a.without_rate - a.with_rate })), 'd');
  $('i-addon').innerHTML = `Every add-on is linked to lower churn. The biggest gap is <b>${nice(best.label).toLowerCase()}</b>: ${pct(best.without_rate)} leave without it vs <b>${pct(best.with_rate)}</b> with it.`;

  churnChart('c-payment', t.by_payment, { horizontal: true, avg });
  const pw = t.by_payment[0], pb = minBy(t.by_payment, 'churn_rate');
  $('i-payment').innerHTML = `Customers paying by <b>${nice(pw.label).toLowerCase()}</b> leave most (${pct(pw.churn_rate)}). Automatic payments are the stickiest, e.g. ${nice(pb.label).toLowerCase()} at <b>${pct(pb.churn_rate)}</b>.`;

  churnChart('c-internet', t.by_internet, { avg });
  const iw = t.by_internet[0];
  $('i-internet').innerHTML = `<b>${nice(iw.label)}</b> customers leave most often (${pct(iw.churn_rate)}) despite paying the highest bills ($${num(iw.avg_monthly, 2)}/month). This suggests price or service-quality problems.`;

  churnChart('c-senior', t.by_senior, { avg });
  const s = t.by_senior.find((x) => x.label.startsWith('Senior')), y = t.by_senior.find((x) => !x.label.startsWith('Senior'));
  $('i-senior').innerHTML = `Senior customers leave <b>${times(ratio(s.churn_rate, y.churn_rate))}</b> as often (${pct(s.churn_rate)} vs ${pct(y.churn_rate)}). They make up ${pct(ratio(s.customers, s.customers + y.customers) * 100, 0)} of customers but deserve targeted care.`;
}

function renderAudit(r) {
  // Trend over years
  const yOpts = baseOptions({ unit: 'n', legend: true });
  yOpts.interaction = { mode: 'index', intersect: false };
  yOpts.plugins.tooltip.callbacks = { label: (c) => ` ${c.dataset.label}: ${num(c.raw)}` };
  const line = (label, key, color) => ({
    label, data: r.by_year.map((y) => y[key]), borderColor: color, backgroundColor: color,
    borderWidth: 2, pointRadius: 4, pointHoverRadius: 6, tension: 0.25,
    pointBorderColor: css('--surface'), pointBorderWidth: 2,
  });
  draw('c-year', {
    type: 'line',
    data: { labels: r.by_year.map((y) => y.label), datasets: [line('High-risk cases', 'high_risk', css('--series-1')), line('Fraud cases', 'fraud', css('--series-2'))] },
    options: yOpts,
  });
  addDataTable('c-year', ['Year', 'Audits', 'High-risk', 'Fraud', 'Revenue impact ($M)'],
    r.by_year.map((y) => [y.label, num(y.engagements), num(y.high_risk), num(y.fraud), num(y.revenue_impact, 0)]));
  const peak = maxBy(r.by_year, 'high_risk'), low = minBy(r.by_year, 'high_risk');
  const last = r.by_year[r.by_year.length - 1], prev = r.by_year[r.by_year.length - 2];
  $('i-year').innerHTML = `High-risk cases peaked in <b>${peak.label}</b> (${num(peak.high_risk)}) and bottomed out in <b>${low.label}</b> (${num(low.high_risk)}). In ${last.label} they ${last.high_risk < prev.high_risk ? 'fell' : 'rose'} to ${num(last.high_risk)}. Fraud has stayed between ${num(minBy(r.by_year, 'fraud').fraud)} and ${num(maxBy(r.by_year, 'fraud').fraud)} cases a year, with no clear downward trend.`;

  // Industries
  const iOpts = baseOptions({ max: 20 });
  iOpts.plugins.refLine = { value: r.avg_risk_pct, label: `Average ${pct(r.avg_risk_pct)}` };
  iOpts.plugins.barValues = { format: (v) => pct(v) };
  iOpts.plugins.tooltip.callbacks = { label: (c) => { const x = r.by_industry[c.dataIndex]; return ` ${pct(x.risk_pct)} high-risk · ${num(x.fraud)} fraud cases`; } };
  draw('c-industry', {
    type: 'bar',
    data: { labels: r.by_industry.map((x) => x.label), datasets: [{ label: 'High-risk share', data: r.by_industry.map((x) => x.risk_pct), ...barStyle(css('--series-1')) }] },
    options: iOpts,
  });
  addDataTable('c-industry', ['Industry', 'High-risk share', 'Fraud cases', 'Revenue impact ($M)'],
    r.by_industry.map((x) => [x.label, pct(x.risk_pct), num(x.fraud), num(x.revenue_impact, 0)]));
  const top = r.by_industry[0], bottom = r.by_industry[r.by_industry.length - 1];
  const mostFraud = maxBy(r.by_industry, 'fraud');
  $('i-industry').innerHTML = `<b>${top.label}</b> audits are flagged high-risk most often (${pct(top.risk_pct)}), ${bottom.label} least (${pct(bottom.risk_pct)}). ${mostFraud.label} had the most fraud cases (${num(mostFraud.fraud)}).`;

  // AI vs manual
  const ai = r.ai_vs_manual.find((x) => x.label === 'AI-assisted');
  const man = r.ai_vs_manual.find((x) => x.label === 'Manual');
  const metrics = [['Effectiveness', 'effectiveness'], ['Client satisfaction', 'satisfaction'], ['Overall quality', 'avg_quality']];
  const aOpts = baseOptions({ unit: 'n', max: 10, legend: true });
  aOpts.plugins.barValues = { format: (v) => num(v, 1) };
  aOpts.plugins.tooltip.callbacks = { label: (c) => ` ${c.dataset.label}: ${num(c.raw, 2)} / 10` };
  draw('c-ai', {
    type: 'bar',
    data: {
      labels: metrics.map((m) => m[0]),
      datasets: [
        { label: 'AI-assisted', data: metrics.map((m) => ai[m[1]]), ...barStyle(css('--series-1')) },
        { label: 'Manual', data: metrics.map((m) => man[m[1]]), ...barStyle(css('--series-2')) },
      ],
    },
    options: aOpts,
  });
  addDataTable('c-ai', ['Measure', 'AI-assisted', 'Manual'],
    [...metrics.map((m) => [m[0], num(ai[m[1]], 2), num(man[m[1]], 2)]),
     ['High-risk share', pct(ai.risk_pct), pct(man.risk_pct)], ['Records', ai.records, man.records]]);
  const aiWins = metrics.filter((m) => ai[m[1]] > man[m[1]]).length;
  $('i-ai').innerHTML = `AI-assisted audits score higher on ${aiWins === metrics.length ? 'every measure' : `${aiWins} of ${metrics.length} measures`} (quality <b>${num(ai.avg_quality, 2)}</b> vs ${num(man.avg_quality, 2)}) and have a slightly lower high-risk share (${pct(ai.risk_pct)} vs ${pct(man.risk_pct)}). The gap is small, so AI helps but is no silver bullet.`;

  // Firm scorecard
  const f = r.by_firm;
  const maxRev = maxBy(f, 'revenue_impact').revenue_impact;
  const bestQ = maxBy(f, 'avg_quality').label, lowRisk = minBy(f, 'risk_pct').label;
  $('t-firms').innerHTML = `
    <thead><tr><th>Firm</th><th>Audits</th><th>Fraud found</th><th>High-risk share</th><th>Quality / 10</th><th>Revenue impact ($M)</th></tr></thead>
    <tbody>${f.map((x) => `<tr>
      <td><b>${esc(x.label)}</b></td>
      <td>${num(x.engagements)}</td>
      <td>${num(x.fraud)}</td>
      <td class="${x.label === lowRisk ? 'best' : ''}">${pct(x.risk_pct)}</td>
      <td class="${x.label === bestQ ? 'best' : ''}">${num(x.avg_quality, 2)}</td>
      <td><span class="cell-bar"><i style="width:${Math.round(80 * x.revenue_impact / maxRev)}px"></i>${num(x.revenue_impact, 0)}</span></td>
    </tr>`).join('')}</tbody>`;
  const mostAudits = maxBy(f, 'engagements');
  $('i-firms').innerHTML = `<b>${bestQ}</b> has the best quality score, and <b>${lowRisk}</b> the lowest high-risk share despite ${lowRisk === mostAudits.label ? 'running the most audits' : 'a large workload'}. Green marks the best value in a column. Quality scores are close across all four firms.`;
}

function renderMeta(d) {
  $('meta').textContent = `Results computed with Apache Spark ${d.spark_version} on ${d.generated_at}.`;
  $('intro-customers').textContent = `${num(d.telco.total_customers)} telecom customers`;
  $('intro-audits').textContent = `${num(d.risk.records)} audit records`;
}

function renderAll() {
  if (!DATA) return;
  const { telco: t, risk: r } = DATA;
  renderMeta(DATA);
  renderKPIs(t, r);
  renderFindings(t, r);
  renderCustomers(t);
  renderAudit(r);
}

// ── Loading ──────────────────────────────────────────────────────────────
function setStatus(html, kind = '') {
  const el = $('status');
  if (!html) { el.hidden = true; return; }
  el.className = `wrap status ${kind}`;
  el.innerHTML = html;
  el.hidden = false;
}

async function load() {
  try {
    const res = await fetch('/api/data');
    const body = await res.json();
    if (res.status === 202) {
      setStatus('<span class="spinner"></span><span>Apache Spark is crunching the numbers. This takes about 30 seconds the first time…</span>');
      setTimeout(load, 2000);
      return;
    }
    if (!res.ok) throw new Error(body.message || `Server returned ${res.status}`);
    DATA = body;
    setStatus('');
    renderAll();
  } catch (e) {
    setStatus(`<span><b>Could not load the analytics.</b> ${esc(e.message)}. Check the terminal running the dashboard, then reload.</span>`, 'error');
  }
}

// ── Theme toggle ─────────────────────────────────────────────────────────
$('theme-btn').addEventListener('click', () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  root.dataset.theme = dark ? 'light' : 'dark';
  try { localStorage.setItem('theme', root.dataset.theme); } catch (e) {}
  renderAll();
});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderAll);

Chart.defaults.font.family = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
load();
