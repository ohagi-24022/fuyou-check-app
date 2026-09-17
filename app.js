const STORAGE_KEY = "fuyo-meter-v2";
const LEGACY_STORAGE_KEY = "fuyo-meter-v1";
const MAX_MONTHLY_ESTIMATE = 300000;
const MAX_MONTH_AMOUNT = 500000;
const MAX_DIAG_AMOUNT = 3000000;
const MONTHS = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);
const STATUS_LABELS = {
  unentered: "未入力",
  actual: "実績",
  scheduled: "予定",
  predicted: "予測",
  none: "収入なし"
};
const DEFAULT_PROFILE = {
  ageAtYearEnd: 20,
  studentType: "day",
  incomeType: "salaryOnly",
  jobCount: "one",
  healthDependent: "yes",
  yearEndAdjustment: "yes"
};
const DEFAULT_DIAGNOSIS = {
  unadjustedSalary: 0,
  otherIncome: 0,
  withheldTax: 0,
  claimedStudentDeduction: false
};
const RULES = {
  personalIncomeTaxSalaryOnly: 1600000,
  parentTaxGeneral: 1230000,
  parentTaxAge19To22Full: 1500000,
  parentTaxAge19To22Max: 1880000,
  healthGeneral: 1300000,
  healthAge19To22: 1500000,
  residentTaxReference: 1000000
};

const elements = {
  alertArea: document.querySelector("#alertArea"),
  storageAlert: document.querySelector("#storageAlert"),
  forecastTotal: document.querySelector("#forecastTotal"),
  safeMonthlyAmount: document.querySelector("#safeMonthlyAmount"),
  overallStatusCard: document.querySelector("#overallStatusCard"),
  overallStatus: document.querySelector("#overallStatus"),
  targetYearLabel: document.querySelector("#targetYearLabel"),
  currentYearButton: document.querySelector("#currentYearButton"),
  prevYearButton: document.querySelector("#prevYearButton"),
  nextYearButton: document.querySelector("#nextYearButton"),
  rulesYearLabel: document.querySelector("#rulesYearLabel"),
  judgementGrid: document.querySelector("#judgementGrid"),
  chartSummary: document.querySelector("#chartSummary"),
  monthlyChart: document.querySelector("#monthlyChart"),
  limitChart: document.querySelector("#limitChart"),
  safeLimitLabel: document.querySelector("#safeLimitLabel"),
  remainingLimitAmount: document.querySelector("#remainingLimitAmount"),
  remainingMonths: document.querySelector("#remainingMonths"),
  adjustmentMessage: document.querySelector("#adjustmentMessage"),
  monthlyRange: document.querySelector("#monthlyRange"),
  monthlyInput: document.querySelector("#monthlyInput"),
  monthlyOutput: document.querySelector("#monthlyOutput"),
  monthList: document.querySelector("#monthList"),
  actualCount: document.querySelector("#actualCount"),
  diagnosisResult: document.querySelector("#diagnosisResult"),
  resetButton: document.querySelector("#resetButton"),
  resetDialog: document.querySelector("#resetDialog"),
  cancelResetButton: document.querySelector("#cancelResetButton"),
  confirmResetButton: document.querySelector("#confirmResetButton"),
  exportJsonButton: document.querySelector("#exportJsonButton"),
  exportCsvButton: document.querySelector("#exportCsvButton"),
  importJsonInput: document.querySelector("#importJsonInput"),
  ageInput: document.querySelector("#ageInput"),
  studentTypeSelect: document.querySelector("#studentTypeSelect"),
  incomeTypeSelect: document.querySelector("#incomeTypeSelect"),
  jobCountSelect: document.querySelector("#jobCountSelect"),
  healthDependentSelect: document.querySelector("#healthDependentSelect"),
  yearEndAdjustmentSelect: document.querySelector("#yearEndAdjustmentSelect"),
  unadjustedSalaryInput: document.querySelector("#unadjustedSalaryInput"),
  otherIncomeInput: document.querySelector("#otherIncomeInput"),
  withheldTaxInput: document.querySelector("#withheldTaxInput"),
  claimedStudentDeduction: document.querySelector("#claimedStudentDeduction")
};

const store = loadStore();

function getCurrentYear() {
  return new Date().getFullYear();
}

function getCurrentMonthIndex() {
  return new Date().getMonth();
}

function createInitialMonths(year = getCurrentYear()) {
  const currentYear = getCurrentYear();
  const currentMonth = getCurrentMonthIndex();
  return MONTHS.map((_, index) => ({
    amount: 0,
    status: year === currentYear && index >= currentMonth ? "predicted" : "unentered"
  }));
}

function createYearData(year = getCurrentYear()) {
  return {
    monthlyEstimate: 80000,
    months: createInitialMonths(year),
    diagnosis: { ...DEFAULT_DIAGNOSIS }
  };
}

function createStore(year = getCurrentYear()) {
  return {
    version: 2,
    selectedYear: year,
    profile: { ...DEFAULT_PROFILE },
    years: {
      [year]: createYearData(year)
    }
  };
}

function sanitizeMoney(value, max) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return Math.min(max, Math.max(0, Math.round(amount)));
}

function sanitizeYear(value) {
  const year = Number(value);
  return Number.isInteger(year) && year >= 2000 && year <= 2100 ? year : getCurrentYear();
}

function normalizeStatus(status) {
  return Object.prototype.hasOwnProperty.call(STATUS_LABELS, status) ? status : "unentered";
}

function normalizeMonths(months, year) {
  const initial = createInitialMonths(year);
  return initial.map((fallback, index) => {
    const month = Array.isArray(months) ? months[index] : null;
    if (!month) {
      return fallback;
    }

    if (typeof month.isActual === "boolean") {
      return {
        amount: sanitizeMoney(month.amount || 0, MAX_MONTH_AMOUNT),
        status: month.isActual ? "actual" : fallback.status
      };
    }

    return {
      amount: sanitizeMoney(month.amount || 0, MAX_MONTH_AMOUNT),
      status: normalizeStatus(month.status)
    };
  });
}

function normalizeYearData(year, data = {}) {
  return {
    monthlyEstimate: sanitizeMoney(data.monthlyEstimate || 80000, MAX_MONTHLY_ESTIMATE),
    months: normalizeMonths(data.months, Number(year)),
    diagnosis: { ...DEFAULT_DIAGNOSIS, ...(data.diagnosis || {}) }
  };
}

function migrateLegacyStore() {
  try {
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    if (!legacy || !Array.isArray(legacy.months)) {
      return null;
    }
    const year = sanitizeYear(legacy.targetYear || getCurrentYear());
    return {
      version: 2,
      selectedYear: year,
      profile: { ...DEFAULT_PROFILE, ...(legacy.profile || {}) },
      years: {
        [year]: normalizeYearData(year, legacy)
      }
    };
  } catch {
    return null;
  }
}

function loadStore() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || saved.version !== 2 || !saved.years) {
      throw new Error("Invalid saved data");
    }
    const selectedYear = sanitizeYear(saved.selectedYear);
    const years = {};
    Object.entries(saved.years).forEach(([year, data]) => {
      years[year] = normalizeYearData(year, data);
    });
    if (!years[selectedYear]) {
      years[selectedYear] = createYearData(selectedYear);
    }
    return {
      version: 2,
      selectedYear,
      profile: { ...DEFAULT_PROFILE, ...(saved.profile || {}) },
      years
    };
  } catch {
    const migrated = migrateLegacyStore();
    return migrated || createStore();
  }
}

function selectedYearData() {
  const year = String(store.selectedYear);
  if (!store.years[year]) {
    store.years[year] = createYearData(store.selectedYear);
  }
  return store.years[year];
}

function showStorageMessage(message, type = "warning") {
  elements.storageAlert.innerHTML = message ? `<div class="alert ${type}">${message}</div>` : "";
}

function saveStore() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
    showStorageMessage("");
    return true;
  } catch {
    showStorageMessage("データを保存できませんでした。ブラウザの空き容量やプライベートモードを確認してください。", "danger");
    return false;
  }
}

function yen(value) {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function ageIs19To22() {
  return store.profile.ageAtYearEnd >= 19 && store.profile.ageAtYearEnd <= 22;
}

function isRegularStudent() {
  return store.profile.studentType === "day";
}

function monthValue(month, yearData) {
  if (month.status === "actual" || month.status === "scheduled") {
    return month.amount;
  }
  if (month.status === "predicted") {
    return yearData.monthlyEstimate;
  }
  return 0;
}

function getTotals() {
  const yearData = selectedYearData();
  return yearData.months.reduce((totals, month, index) => {
    const value = monthValue(month, yearData);
    totals.total += value;
    if (month.status === "actual") totals.actual += value;
    if (month.status === "scheduled") totals.scheduled += value;
    if (month.status === "predicted") totals.predicted += value;
    if (month.status === "unentered" && shouldWarnUnentered(index)) totals.unenteredPast += 1;
    return totals;
  }, { total: 0, actual: 0, scheduled: 0, predicted: 0, unenteredPast: 0 });
}

function shouldWarnUnentered(index) {
  if (store.selectedYear < getCurrentYear()) {
    return true;
  }
  if (store.selectedYear > getCurrentYear()) {
    return false;
  }
  return index <= getCurrentMonthIndex();
}

function getJudgements(total) {
  const salaryOnly = store.profile.incomeType === "salaryOnly";
  const personalLimit = salaryOnly ? RULES.personalIncomeTaxSalaryOnly : null;
  const parentFullLimit = ageIs19To22() ? RULES.parentTaxAge19To22Full : RULES.parentTaxGeneral;
  const parentMaxLimit = ageIs19To22() ? RULES.parentTaxAge19To22Max : RULES.parentTaxGeneral;
  const healthLimit = ageIs19To22() && store.selectedYear >= 2026 ? RULES.healthAge19To22 : RULES.healthGeneral;
  const healthActive = store.profile.healthDependent !== "no";
  const judgements = [];

  judgements.push({
    key: "personal",
    title: "本人の所得税",
    limit: personalLimit,
    total,
    state: !salaryOnly ? "unknown" : total <= personalLimit ? "ok" : "danger",
    status: !salaryOnly ? "個別確認" : total <= personalLimit ? "基準内" : "超過",
    reason: salaryOnly ? "給与のみでほかに所得がない場合の目安です。" : "給与以外の所得があるため、この画面だけでは判定できません。"
  });

  judgements.push({
    key: "parent",
    title: "親の税扶養",
    limit: parentFullLimit,
    total,
    state: total <= parentFullLimit ? "ok" : total <= parentMaxLimit && ageIs19To22() ? "warning" : "danger",
    status: total <= parentFullLimit ? "控除額への影響なし" : total <= parentMaxLimit && ageIs19To22() ? "段階的に影響" : "影響大",
    reason: ageIs19To22()
      ? "19歳以上23歳未満のため、150万円までを満額相当の目安、188万円までを段階的影響の目安にしています。"
      : "一般的な親族扶養の給与収入目安として123万円を使っています。"
  });

  judgements.push({
    key: "health",
    title: "健康保険の扶養",
    limit: healthLimit,
    total,
    state: !healthActive ? "unknown" : total < healthLimit ? "ok" : "danger",
    status: !healthActive ? "対象外または不明" : total < healthLimit ? "基準内" : "超過",
    reason: ageIs19To22() && store.selectedYear >= 2026
      ? "19歳以上23歳未満の被扶養者認定は150万円未満を目安にしています。"
      : "一般的な被扶養者認定の年間収入目安として130万円未満を使っています。"
  });

  judgements.push({
    key: "resident",
    title: "住民税",
    limit: RULES.residentTaxReference,
    total,
    state: total <= RULES.residentTaxReference ? "ok" : "warning",
    status: total <= RULES.residentTaxReference ? "発生しにくい目安" : "発生する可能性",
    reason: "住民税の非課税基準は自治体等で異なるため、100万円は参考目安です。"
  });

  return judgements;
}

function getPrimaryLimit(judgements) {
  const candidates = judgements.filter((item) => item.limit && item.key !== "resident" && item.state !== "unknown");
  return candidates.reduce((lowest, item) => (!lowest || item.limit < lowest.limit ? item : lowest), null);
}

function getSafeMonthly(primaryLimit) {
  const yearData = selectedYearData();
  const fixedTotal = yearData.months.reduce((sum, month) => {
    if (month.status === "actual" || month.status === "scheduled") {
      return sum + month.amount;
    }
    return sum;
  }, 0);
  const remainingMonthCount = yearData.months.filter((month, index) => {
    const canAdjust = month.status === "predicted" || month.status === "unentered";
    if (store.selectedYear < getCurrentYear()) return false;
    if (store.selectedYear > getCurrentYear()) return canAdjust;
    return canAdjust && index >= getCurrentMonthIndex();
  }).length;
  const remaining = primaryLimit ? primaryLimit.limit - fixedTotal : 0;
  const monthly = remainingMonthCount > 0 ? Math.max(0, Math.floor(remaining / remainingMonthCount)) : 0;
  return { fixedTotal, remaining, remainingMonthCount, monthly };
}

function getMonthlySeries() {
  const yearData = selectedYearData();
  let running = 0;
  return yearData.months.map((month, index) => {
    const value = monthValue(month, yearData);
    running += value;
    return {
      month: index + 1,
      status: month.status,
      value,
      cumulative: running,
      isEstimated: month.status === "predicted"
    };
  });
}

function renderAlerts(totals) {
  const alerts = [];
  if (totals.unenteredPast > 0) {
    alerts.push({ type: "warning", text: `過去または今月までに未入力の月が${totals.unenteredPast}か月あります。予測には含めていないため、実績か収入なしを選んでください。` });
  }
  if (store.profile.incomeType !== "salaryOnly") {
    alerts.push({ type: "warning", text: "給与以外の所得があるため、所得税や勤労学生控除は個別確認が必要です。" });
  }
  if (!isRegularStudent() && store.profile.studentType !== "none") {
    alerts.push({ type: "warning", text: "通信制・定時制・休学中などの場合、社会保険の扱いが通常の昼間学生と異なることがあります。" });
  }
  elements.alertArea.innerHTML = alerts.map((alert) => `<div class="alert ${alert.type}">${alert.text}</div>`).join("");
}

function renderJudgements(judgements) {
  elements.judgementGrid.innerHTML = judgements.map((item) => {
    const percent = item.limit ? Math.min(100, (item.total / item.limit) * 100) : 0;
    const amountLine = item.limit ? `${yen(item.total)} / ${yen(item.limit)}` : `${yen(item.total)} / 個別確認`;
    const remaining = item.limit ? item.limit - item.total : null;
    const remainingLine = remaining === null
      ? "追加情報が必要です"
      : remaining >= 0
        ? `あと ${yen(remaining)}`
        : `${yen(Math.abs(remaining))}超過`;
    return `
      <article class="judgement-card ${item.state}">
        <div class="card-title-row">
          <h3>${item.title}</h3>
          <span>${item.status}</span>
        </div>
        <strong>${amountLine}</strong>
        <div class="mini-progress" aria-hidden="true"><span style="width: ${percent}%"></span></div>
        <p>${remainingLine}</p>
        <small>${item.reason}</small>
      </article>
    `;
  }).join("");
}

function renderMonthlyChart(series, judgements) {
  const limitLines = judgements
    .filter((item) => item.limit && item.key !== "resident")
    .map((item) => ({ title: item.title, value: item.limit }));
  const maxValue = Math.max(1, ...series.map((point) => point.cumulative), ...limitLines.map((line) => line.value));
  const width = 640;
  const height = 260;
  const pad = { top: 28, right: 22, bottom: 34, left: 64 };
  const chartWidth = width - pad.left - pad.right;
  const chartHeight = height - pad.top - pad.bottom;
  const xFor = (index) => pad.left + (chartWidth * index) / 11;
  const yFor = (value) => pad.top + chartHeight - (chartHeight * value) / maxValue;
  const path = series
    .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(point.cumulative).toFixed(1)}`)
    .join(" ");
  const areaPath = `${path} L ${xFor(11).toFixed(1)} ${pad.top + chartHeight} L ${pad.left} ${pad.top + chartHeight} Z`;
  const actualPath = series
    .filter((point) => !point.isEstimated && point.status !== "unentered" && point.status !== "none")
    .map((point) => point.month - 1);
  const lastActualIndex = actualPath.length > 0 ? Math.max(...actualPath) : -1;
  const actualLine = lastActualIndex >= 0
    ? series.slice(0, lastActualIndex + 1)
      .map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(index).toFixed(1)} ${yFor(point.cumulative).toFixed(1)}`)
      .join(" ")
    : "";
  const ticks = [0, Math.round(maxValue / 2), maxValue];
  const lines = limitLines.map((line, index) => {
    const y = yFor(line.value);
    return `
      <g>
        <line class="limit-line limit-${index}" x1="${pad.left}" y1="${y.toFixed(1)}" x2="${width - pad.right}" y2="${y.toFixed(1)}"></line>
        <text class="limit-label" x="${width - pad.right}" y="${Math.max(12, y - 5).toFixed(1)}" text-anchor="end">${line.title} ${shortYen(line.value)}</text>
      </g>
    `;
  }).join("");
  const circles = series.map((point, index) => {
    const className = point.isEstimated ? "predicted-point" : point.status === "unentered" || point.status === "none" ? "empty-point" : "actual-point";
    return `<circle class="${className}" cx="${xFor(index).toFixed(1)}" cy="${yFor(point.cumulative).toFixed(1)}" r="4"><title>${point.month}月 ${yen(point.cumulative)}</title></circle>`;
  }).join("");
  const monthLabels = series.map((point, index) => (
    `<text class="month-tick" x="${xFor(index).toFixed(1)}" y="${height - 10}" text-anchor="middle">${point.month}</text>`
  )).join("");
  const yLabels = ticks.map((tick) => (
    `<text class="value-tick" x="${pad.left - 10}" y="${yFor(tick).toFixed(1)}" text-anchor="end">${shortYen(tick)}</text>`
  )).join("");

  elements.monthlyChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
      <rect class="chart-bg" x="0" y="0" width="${width}" height="${height}"></rect>
      ${ticks.map((tick) => `<line class="grid-line" x1="${pad.left}" y1="${yFor(tick).toFixed(1)}" x2="${width - pad.right}" y2="${yFor(tick).toFixed(1)}"></line>`).join("")}
      ${lines}
      <path class="income-area" d="${areaPath}"></path>
      <path class="income-line predicted-line" d="${path}"></path>
      ${actualLine ? `<path class="income-line actual-line" d="${actualLine}"></path>` : ""}
      ${circles}
      ${monthLabels}
      ${yLabels}
    </svg>
  `;
}

function renderLimitChart(judgements) {
  elements.limitChart.innerHTML = judgements.map((item) => {
    const percent = item.limit ? Math.round((item.total / item.limit) * 100) : 0;
    const capped = Math.min(100, Math.max(0, percent));
    const remaining = item.limit ? item.limit - item.total : null;
    const remainingText = remaining === null
      ? "追加情報が必要"
      : remaining >= 0
        ? `あと ${yen(remaining)}`
        : `${yen(Math.abs(remaining))}超過`;
    return `
      <div class="limit-bar-row ${item.state}">
        <div class="limit-bar-meta">
          <strong>${item.title}</strong>
          <span>${item.limit ? `${percent}%` : "個別確認"}</span>
        </div>
        <div class="limit-bar-track">
          <span style="width: ${capped}%"></span>
        </div>
        <p>${remainingText}</p>
      </div>
    `;
  }).join("");
}

function renderCharts(series, judgements, totals) {
  renderMonthlyChart(series, judgements);
  renderLimitChart(judgements);
  const actualLike = series.filter((point) => point.status === "actual" || point.status === "scheduled").length;
  const predicted = series.filter((point) => point.status === "predicted").length;
  elements.chartSummary.textContent = `入力済み ${actualLike}か月 / 予測 ${predicted}か月 / ${yen(totals.total)}`;
}

function shortYen(value) {
  if (value >= 10000) {
    const man = value / 10000;
    return `${Number.isInteger(man) ? man.toLocaleString("ja-JP") : man.toFixed(1)}万`;
  }
  return value.toLocaleString("ja-JP");
}

function renderSafeMonthly(primaryLimit, safe) {
  elements.safeLimitLabel.textContent = primaryLimit ? `${primaryLimit.title}を維持する目安` : "追加情報が必要";
  elements.remainingLimitAmount.textContent = primaryLimit ? yen(Math.max(0, safe.remaining)) : "判定不可";
  elements.remainingMonths.textContent = `${safe.remainingMonthCount}か月`;
  elements.safeMonthlyAmount.textContent = primaryLimit ? `月 ${yen(safe.monthly)}` : "判定不可";
  if (!primaryLimit) {
    elements.adjustmentMessage.textContent = "利用者設定を確認してください";
    return;
  }
  const diff = selectedYearData().monthlyEstimate - safe.monthly;
  elements.adjustmentMessage.textContent = diff > 0
    ? `毎月約${yen(diff)}の調整が必要`
    : "現在の予定で基準内";
}

function renderMonths() {
  const yearData = selectedYearData();
  const currentMonth = getCurrentMonthIndex();
  const activeYear = store.selectedYear === getCurrentYear();
  elements.monthList.innerHTML = "";

  yearData.months.forEach((month, index) => {
    const row = document.createElement("div");
    row.className = `month-row status-${month.status} ${activeYear && index === currentMonth ? "is-current" : ""}`;

    const name = document.createElement("div");
    name.className = "month-name";
    name.textContent = MONTHS[index];
    if (activeYear && index === currentMonth) {
      const badge = document.createElement("span");
      badge.className = "current-badge";
      badge.textContent = "今月";
      name.append(badge);
    }

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = String(MAX_MONTH_AMOUNT);
    input.step = "1000";
    input.inputMode = "numeric";
    input.value = month.status === "actual" || month.status === "scheduled" ? month.amount : "";
    input.placeholder = month.status === "predicted" ? yen(yearData.monthlyEstimate) : "0";
    input.disabled = month.status !== "actual" && month.status !== "scheduled";
    input.ariaLabel = `${MONTHS[index]}の金額`;

    const select = document.createElement("select");
    select.ariaLabel = `${MONTHS[index]}の状態`;
    Object.entries(STATUS_LABELS).forEach(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      option.selected = value === month.status;
      select.append(option);
    });

    const valueLabel = document.createElement("span");
    valueLabel.className = "month-state";
    valueLabel.textContent = month.status === "predicted" ? yen(yearData.monthlyEstimate) : STATUS_LABELS[month.status];

    input.addEventListener("input", () => {
      const value = sanitizeMoney(input.value, MAX_MONTH_AMOUNT);
      if (input.value !== "" && Number(input.value) !== value) {
        input.value = value;
      }
      month.amount = value;
      saveStore();
      updateUI();
    });

    select.addEventListener("change", () => {
      month.status = normalizeStatus(select.value);
      if (month.status === "predicted" || month.status === "none" || month.status === "unentered") {
        month.amount = 0;
      }
      saveStore();
      renderMonths();
      updateUI();
    });

    row.append(name, input, select, valueLabel);
    elements.monthList.append(row);
  });
}

function renderDiagnosis(totals) {
  const diagnosis = selectedYearData().diagnosis;
  const notes = [];
  if (store.profile.jobCount === "multiple" && diagnosis.unadjustedSalary + diagnosis.otherIncome > 200000) {
    notes.push("申告が必要な可能性が高い: 年末調整されていない給与等が20万円を超えています。");
  } else if (diagnosis.withheldTax > 0) {
    notes.push("還付申告を検討できます: 源泉徴収された所得税があるため、申告で戻る可能性があります。");
  } else {
    notes.push("現在の情報だけでは判断できません。勤務先の年末調整と源泉徴収票を確認してください。");
  }

  const studentDeductionSalaryLimit = 1500000;
  if (store.profile.studentType !== "none" && totals.total <= studentDeductionSalaryLimit && diagnosis.otherIncome <= 100000) {
    notes.push("勤労学生控除は対象になり得ます。給与以外の所得10万円以下などの条件を確認してください。");
  } else if (store.profile.studentType !== "none") {
    notes.push("勤労学生控除は収入・所得条件を超える可能性があります。");
  }

  elements.diagnosisResult.textContent = notes.join(" ");
}

function updateOverall(judgements) {
  const worst = judgements.some((item) => item.state === "danger")
    ? "danger"
    : judgements.some((item) => item.state === "warning" || item.state === "unknown")
      ? "warning"
      : "ok";
  elements.overallStatusCard.className = `hero-item status-hero ${worst}`;
  elements.overallStatus.textContent = worst === "ok" ? "扶養範囲内" : worst === "warning" ? "確認が必要" : "超過あり";
}

function updateUI() {
  const yearData = selectedYearData();
  const totals = getTotals();
  const judgements = getJudgements(totals.total);
  const primaryLimit = getPrimaryLimit(judgements);
  const safe = getSafeMonthly(primaryLimit);
  const series = getMonthlySeries();

  elements.targetYearLabel.textContent = `${store.selectedYear}年の記録`;
  elements.currentYearButton.textContent = `${store.selectedYear}年`;
  elements.rulesYearLabel.textContent = `${store.selectedYear}年基準`;
  elements.forecastTotal.textContent = yen(totals.total);
  elements.monthlyOutput.textContent = yen(yearData.monthlyEstimate);
  elements.monthlyRange.value = yearData.monthlyEstimate;
  elements.monthlyInput.value = yearData.monthlyEstimate;
  elements.actualCount.textContent = `${yearData.months.filter((month) => month.status === "actual" || month.status === "scheduled").length}か月入力済み`;

  renderAlerts(totals);
  renderJudgements(judgements);
  renderCharts(series, judgements, totals);
  renderSafeMonthly(primaryLimit, safe);
  renderDiagnosis(totals);
  updateOverall(judgements);
}

function syncInputsFromState() {
  const yearData = selectedYearData();
  elements.ageInput.value = store.profile.ageAtYearEnd;
  elements.studentTypeSelect.value = store.profile.studentType;
  elements.incomeTypeSelect.value = store.profile.incomeType;
  elements.jobCountSelect.value = store.profile.jobCount;
  elements.healthDependentSelect.value = store.profile.healthDependent;
  elements.yearEndAdjustmentSelect.value = store.profile.yearEndAdjustment;
  elements.unadjustedSalaryInput.value = yearData.diagnosis.unadjustedSalary;
  elements.otherIncomeInput.value = yearData.diagnosis.otherIncome;
  elements.withheldTaxInput.value = yearData.diagnosis.withheldTax;
  elements.claimedStudentDeduction.checked = yearData.diagnosis.claimedStudentDeduction;
}

function setMonthlyEstimate(value) {
  selectedYearData().monthlyEstimate = sanitizeMoney(value, MAX_MONTHLY_ESTIMATE);
  saveStore();
  renderMonths();
  updateUI();
}

function selectYear(year) {
  store.selectedYear = sanitizeYear(year);
  selectedYearData();
  saveStore();
  syncInputsFromState();
  renderMonths();
  updateUI();
}

function resetSelectedYear() {
  store.years[String(store.selectedYear)] = createYearData(store.selectedYear);
  saveStore();
  syncInputsFromState();
  renderMonths();
  updateUI();
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCsv() {
  const yearData = selectedYearData();
  const rows = [["year", "month", "status", "amount"]];
  yearData.months.forEach((month, index) => {
    rows.push([
      store.selectedYear,
      index + 1,
      month.status,
      month.status === "predicted" ? yearData.monthlyEstimate : month.amount
    ]);
  });
  downloadFile(`fuyo-meter-${store.selectedYear}.csv`, rows.map((row) => row.join(",")).join("\n"), "text/csv;charset=utf-8");
}

function bindEvents() {
  elements.prevYearButton.addEventListener("click", () => selectYear(store.selectedYear - 1));
  elements.nextYearButton.addEventListener("click", () => selectYear(store.selectedYear + 1));
  elements.currentYearButton.addEventListener("click", () => selectYear(getCurrentYear()));
  elements.monthlyRange.addEventListener("input", (event) => setMonthlyEstimate(event.target.value));
  elements.monthlyInput.addEventListener("input", (event) => setMonthlyEstimate(event.target.value));

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => setMonthlyEstimate(button.dataset.preset));
  });

  [
    ["ageInput", "ageAtYearEnd", (value) => Math.min(80, Math.max(15, Math.round(Number(value) || 20)))],
    ["studentTypeSelect", "studentType", (value) => value],
    ["incomeTypeSelect", "incomeType", (value) => value],
    ["jobCountSelect", "jobCount", (value) => value],
    ["healthDependentSelect", "healthDependent", (value) => value],
    ["yearEndAdjustmentSelect", "yearEndAdjustment", (value) => value]
  ].forEach(([elementKey, stateKey, normalize]) => {
    elements[elementKey].addEventListener("input", (event) => {
      store.profile[stateKey] = normalize(event.target.value);
      saveStore();
      updateUI();
    });
  });

  [
    ["unadjustedSalaryInput", "unadjustedSalary", MAX_DIAG_AMOUNT],
    ["otherIncomeInput", "otherIncome", MAX_DIAG_AMOUNT],
    ["withheldTaxInput", "withheldTax", 1000000]
  ].forEach(([elementKey, stateKey, max]) => {
    elements[elementKey].addEventListener("input", (event) => {
      const value = sanitizeMoney(event.target.value, max);
      selectedYearData().diagnosis[stateKey] = value;
      if (event.target.value !== "" && Number(event.target.value) !== value) {
        event.target.value = value;
      }
      saveStore();
      updateUI();
    });
  });

  elements.claimedStudentDeduction.addEventListener("change", () => {
    selectedYearData().diagnosis.claimedStudentDeduction = elements.claimedStudentDeduction.checked;
    saveStore();
    updateUI();
  });

  elements.resetButton.addEventListener("click", () => {
    if (typeof elements.resetDialog.showModal === "function") {
      elements.resetDialog.showModal();
    } else if (window.confirm("この年の入力データをリセットしますか？")) {
      resetSelectedYear();
    }
  });

  elements.cancelResetButton.addEventListener("click", () => elements.resetDialog.close("cancel"));
  elements.confirmResetButton.addEventListener("click", () => {
    elements.resetDialog.close("reset");
    resetSelectedYear();
  });

  elements.exportJsonButton.addEventListener("click", () => {
    downloadFile(`fuyo-meter-backup-${store.selectedYear}.json`, JSON.stringify(store, null, 2), "application/json;charset=utf-8");
  });

  elements.exportCsvButton.addEventListener("click", exportCsv);

  elements.importJsonInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const imported = JSON.parse(await file.text());
      if (!imported || imported.version !== 2 || !imported.years) {
        throw new Error("Invalid backup");
      }
      store.version = 2;
      store.selectedYear = sanitizeYear(imported.selectedYear);
      store.profile = { ...DEFAULT_PROFILE, ...(imported.profile || {}) };
      store.years = {};
      Object.entries(imported.years).forEach(([year, data]) => {
        store.years[year] = normalizeYearData(year, data);
      });
      saveStore();
      syncInputsFromState();
      renderMonths();
      updateUI();
      showStorageMessage("バックアップを読み込みました。", "ok");
    } catch {
      showStorageMessage("JSONを読み込めませんでした。バックアップファイルの内容を確認してください。", "danger");
    } finally {
      event.target.value = "";
    }
  });

}

saveStore();
syncInputsFromState();
bindEvents();
renderMonths();
updateUI();
