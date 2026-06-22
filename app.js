const STORAGE_KEY = "fuyo-meter-v1";
const TAX_WALL = 1030000;
const SOCIAL_WALL = 1300000;
const MAX_BAR = SOCIAL_WALL;
const MAX_MONTHLY_ESTIMATE = 300000;
const MAX_MONTH_AMOUNT = 500000;
const MONTHS = Array.from({ length: 12 }, (_, index) => `${index + 1}月`);
const DEFAULT_CHECKS = {
  hasMultipleJobs: false,
  taxWithheld: false,
  isStudent: true,
  hasOtherIncome: false
};

const state = loadState();
const elements = {
  alertArea: document.querySelector("#alertArea"),
  forecastTotal: document.querySelector("#forecastTotal"),
  remaining103: document.querySelector("#remaining103"),
  remaining130: document.querySelector("#remaining130"),
  actualTotal: document.querySelector("#actualTotal"),
  predictedTotal: document.querySelector("#predictedTotal"),
  actualBar: document.querySelector("#actualBar"),
  predictedBar: document.querySelector("#predictedBar"),
  progressTrack: document.querySelector("#progressTrack"),
  monthlyRange: document.querySelector("#monthlyRange"),
  monthlyInput: document.querySelector("#monthlyInput"),
  monthlyOutput: document.querySelector("#monthlyOutput"),
  monthList: document.querySelector("#monthList"),
  actualCount: document.querySelector("#actualCount"),
  targetYearLabel: document.querySelector("#targetYearLabel"),
  diagnosisResult: document.querySelector("#diagnosisResult"),
  resetButton: document.querySelector("#resetButton"),
  resetDialog: document.querySelector("#resetDialog"),
  cancelResetButton: document.querySelector("#cancelResetButton"),
  confirmResetButton: document.querySelector("#confirmResetButton"),
  hasMultipleJobs: document.querySelector("#hasMultipleJobs"),
  taxWithheld: document.querySelector("#taxWithheld"),
  isStudent: document.querySelector("#isStudent"),
  hasOtherIncome: document.querySelector("#hasOtherIncome")
};

function createInitialMonths() {
  return MONTHS.map(() => ({ amount: 0, isActual: false }));
}

function getCurrentYear() {
  return new Date().getFullYear();
}

function hasSavedProgress(saved) {
  const hasMonthData = Array.isArray(saved.months) && saved.months.some((month) => Boolean(month.isActual) || Number(month.amount) > 0);
  const hasCustomEstimate = Number(saved.monthlyEstimate) && Number(saved.monthlyEstimate) !== 80000;
  const hasCustomChecks = saved.checks && JSON.stringify({ ...DEFAULT_CHECKS, ...saved.checks }) !== JSON.stringify(DEFAULT_CHECKS);
  return hasMonthData || hasCustomEstimate || hasCustomChecks;
}

function createDefaultState(targetYear = getCurrentYear()) {
  return {
    targetYear,
    monthlyEstimate: 80000,
    months: createInitialMonths(),
    checks: { ...DEFAULT_CHECKS }
  };
}

function sanitizeMoney(value, max) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) {
    return 0;
  }
  return Math.min(max, Math.max(0, Math.round(amount)));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved || !Array.isArray(saved.months) || saved.months.length !== 12) {
      throw new Error("Invalid saved data");
    }

    const currentYear = getCurrentYear();
    const savedYear = Number(saved.targetYear) || currentYear;
    if (savedYear !== currentYear && hasSavedProgress(saved)) {
      const startNewYear = window.confirm(`${savedYear}年のデータが残っています。${currentYear}年の新しい記録を始めますか？`);
      if (startNewYear) {
        const nextState = createDefaultState(currentYear);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
        return nextState;
      }
    } else if (savedYear !== currentYear) {
      const nextState = createDefaultState(currentYear);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
      return nextState;
    }

    return {
      targetYear: savedYear,
      monthlyEstimate: sanitizeMoney(saved.monthlyEstimate || 80000, MAX_MONTHLY_ESTIMATE),
      months: saved.months.map((month) => ({
        amount: sanitizeMoney(month.amount || 0, MAX_MONTH_AMOUNT),
        isActual: Boolean(month.isActual)
      })),
      checks: { ...DEFAULT_CHECKS, ...(saved.checks || {}) }
    };
  } catch {
    return createDefaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function yen(value) {
  return `${Math.round(value).toLocaleString("ja-JP")}円`;
}

function signedRemaining(limit, total) {
  const diff = limit - total;
  return diff >= 0 ? yen(diff) : `${yen(Math.abs(diff))}超過`;
}

function getMonthValue(month) {
  return month.isActual ? month.amount : state.monthlyEstimate;
}

function getTotals() {
  const actual = state.months.reduce((sum, month) => sum + (month.isActual ? month.amount : 0), 0);
  const predicted = state.months.reduce((sum, month) => sum + (month.isActual ? 0 : state.monthlyEstimate), 0);
  return { actual, predicted, total: actual + predicted };
}

function crossingMonth(limit) {
  let running = 0;
  for (let index = 0; index < state.months.length; index += 1) {
    running += getMonthValue(state.months[index]);
    if (running > limit) {
      return index + 1;
    }
  }
  return null;
}

function updateAlerts(total) {
  const alerts = [];
  const month103 = crossingMonth(TAX_WALL);
  const month130 = crossingMonth(SOCIAL_WALL);

  if (total > SOCIAL_WALL) {
    alerts.push({ type: "danger", text: `このペースだと${month130}月に130万円を超過します。社会保険の扶養条件を確認して、早めにシフト調整しましょう。` });
  } else if (total > TAX_WALL) {
    alerts.push({ type: "warning", text: `このペースだと${month103}月に103万円を超過します。親の扶養や年末調整への影響を確認しましょう。` });
  } else {
    alerts.push({ type: "ok", text: "現在の見込みでは103万円以内です。入力済みの実績が増えると予測精度が上がります。" });
  }

  elements.alertArea.innerHTML = alerts
    .map((alert) => `<div class="alert ${alert.type}">${alert.text}</div>`)
    .join("");
}

function updateSummary() {
  const totals = getTotals();
  const progressState = totals.total > SOCIAL_WALL ? "danger" : totals.total > TAX_WALL ? "warning" : "ok";
  elements.forecastTotal.textContent = yen(totals.total);
  elements.remaining103.textContent = signedRemaining(TAX_WALL, totals.total);
  elements.remaining130.textContent = signedRemaining(SOCIAL_WALL, totals.total);
  elements.actualTotal.textContent = `実績 ${yen(totals.actual)}`;
  elements.predictedTotal.textContent = `予測 ${yen(totals.predicted)}`;

  const actualWidth = Math.min(100, (totals.actual / MAX_BAR) * 100);
  const totalWidth = Math.min(100, (totals.total / MAX_BAR) * 100);
  elements.actualBar.style.width = `${actualWidth}%`;
  elements.predictedBar.style.width = `${totalWidth}%`;
  elements.progressTrack.dataset.state = progressState;

  elements.monthlyOutput.textContent = yen(state.monthlyEstimate);
  elements.monthlyRange.value = Math.min(Number(elements.monthlyRange.max), state.monthlyEstimate);
  elements.monthlyInput.value = state.monthlyEstimate;
  elements.actualCount.textContent = `${state.months.filter((month) => month.isActual).length}か月入力済み`;
  elements.targetYearLabel.textContent = `${state.targetYear}年の記録`;

  updateAlerts(totals.total);
  updateDiagnosis(totals.total);
}

function renderMonths() {
  const currentMonth = new Date().getMonth();
  const isActiveYear = state.targetYear === getCurrentYear();
  elements.monthList.innerHTML = "";

  state.months.forEach((month, index) => {
    const row = document.createElement("label");
    row.className = `month-row ${month.isActual ? "is-actual" : "is-predicted"} ${isActiveYear && index === currentMonth ? "is-current" : ""}`;

    const name = document.createElement("span");
    name.className = "month-name";
    name.textContent = MONTHS[index];
    if (isActiveYear && index === currentMonth) {
      const badge = document.createElement("span");
      badge.className = "current-badge";
      badge.textContent = "今月";
      name.append(badge);
    }

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1000";
    input.inputMode = "numeric";
    input.max = String(MAX_MONTH_AMOUNT);
    input.placeholder = yen(state.monthlyEstimate);
    input.value = month.isActual ? month.amount : "";
    input.ariaLabel = `${MONTHS[index]}の実績金額`;

    const stateLabel = document.createElement("span");
    stateLabel.className = "month-state";
    stateLabel.textContent = month.isActual ? "実績" : yen(state.monthlyEstimate);

    input.addEventListener("input", () => {
      const value = input.value === "" ? 0 : sanitizeMoney(input.value, MAX_MONTH_AMOUNT);
      if (input.value !== "" && Number(input.value) !== value) {
        input.value = value;
      }
      month.amount = value;
      month.isActual = input.value !== "";
      row.classList.toggle("is-actual", month.isActual);
      row.classList.toggle("is-predicted", !month.isActual);
      stateLabel.textContent = month.isActual ? "実績" : yen(state.monthlyEstimate);
      saveState();
      updateSummary();
    });

    row.append(name, input, stateLabel);
    elements.monthList.append(row);
  });
}

function setMonthlyEstimate(value) {
  state.monthlyEstimate = sanitizeMoney(value, MAX_MONTHLY_ESTIMATE);
  saveState();
  renderMonths();
  updateSummary();
}

function updateDiagnosis(total) {
  const checks = state.checks;
  const notes = [];

  if (checks.hasMultipleJobs || checks.taxWithheld) {
    notes.push("確定申告をすると源泉徴収された所得税が戻る可能性があります。");
  } else {
    notes.push("勤務先が1か所で年末調整済みなら、確定申告が不要なケースが多いです。");
  }

  if (checks.isStudent && !checks.hasOtherIncome && total <= 1300000) {
    notes.push("勤労学生控除の対象になり得ます。学校要件と所得要件を確認してください。");
  }

  if (checks.hasOtherIncome) {
    notes.push("給与以外の所得がある場合は、10万円以下など別条件の確認が必要です。");
  }

  elements.diagnosisResult.textContent = notes.join(" ");
}

function resetAllData() {
  state.monthlyEstimate = 80000;
  state.targetYear = getCurrentYear();
  state.months = createInitialMonths();
  state.checks = { ...DEFAULT_CHECKS };
  syncChecksToDom();
  saveState();
  renderMonths();
  updateSummary();
}

function bindEvents() {
  elements.monthlyRange.addEventListener("input", (event) => setMonthlyEstimate(event.target.value));
  elements.monthlyInput.addEventListener("input", (event) => setMonthlyEstimate(event.target.value));

  document.querySelectorAll("[data-preset]").forEach((button) => {
    button.addEventListener("click", () => setMonthlyEstimate(button.dataset.preset));
  });

  elements.resetButton.addEventListener("click", () => {
    if (typeof elements.resetDialog.showModal === "function") {
      elements.resetDialog.showModal();
    } else if (window.confirm("すべてのデータをリセットしますか？入力済みの実績も削除されます。")) {
      resetAllData();
    }
  });

  elements.cancelResetButton.addEventListener("click", () => {
    elements.resetDialog.close("cancel");
  });

  elements.confirmResetButton.addEventListener("click", () => {
    elements.resetDialog.close("reset");
    resetAllData();
  });

  ["hasMultipleJobs", "taxWithheld", "isStudent", "hasOtherIncome"].forEach((key) => {
    elements[key].addEventListener("change", () => {
      state.checks[key] = elements[key].checked;
      saveState();
      updateSummary();
    });
  });
}

function syncChecksToDom() {
  ["hasMultipleJobs", "taxWithheld", "isStudent", "hasOtherIncome"].forEach((key) => {
    elements[key].checked = Boolean(state.checks[key]);
  });
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  });
}

syncChecksToDom();
bindEvents();
renderMonths();
updateSummary();
