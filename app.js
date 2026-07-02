// ============================================================
// JURNAL TRADING - app.js
// Semua logic aplikasi ada di sini. Tidak perlu diedit,
// kecuali lo mau nambah fitur.
// ============================================================

import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc,
  doc, onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const MONTH_NAMES_ID = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Ags","Sep","Okt","Nov","Des"];
const WEEKDAY_START_MONDAY = true;

// ---------- State ----------
let currentUser = null;
let allTrades = [];
let allAccounts = [];
let currentAccountId = null;
let isRegisterMode = false;
let unsubscribeTrades = null;
let unsubscribeAccounts = null;
let calendarViewDate = new Date();
let isFirstAccountFlow = false;

// ---------- DOM refs: auth ----------
const authShell = document.getElementById("auth-shell");
const appShell = document.getElementById("app-shell");
const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authSub = document.getElementById("auth-sub");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authToggleText = document.getElementById("auth-toggle-text");
const authToggleBtn = document.getElementById("auth-toggle-btn");
const authError = document.getElementById("auth-error");
const userEmailEl = document.getElementById("user-email");
const logoutBtn = document.getElementById("logout-btn");
const accountSwitcher = document.getElementById("account-switcher");

// ---------- DOM refs: tabs ----------
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = {
  dashboard: document.getElementById("tab-dashboard"),
  tradelog: document.getElementById("tab-tradelog"),
  analytics: document.getElementById("tab-analytics"),
};

// ---------- DOM refs: trade log ----------
const tradesTbody = document.getElementById("trades-tbody");
const emptyState = document.getElementById("empty-state");
const filterPair = document.getElementById("filter-pair");
const filterDir = document.getElementById("filter-dir");
const filterResult = document.getElementById("filter-result");

// ---------- DOM refs: inline trade form ----------
const toggleFormBtn = document.getElementById("toggle-form-btn");
const tradeFormPanel = document.getElementById("trade-form-panel");
const tradeFormTitleText = document.getElementById("trade-form-title-text");
const tradeFormError = document.getElementById("trade-form-error");
const tradeForm = document.getElementById("trade-form");
const tradeFormCancelBtn = document.getElementById("trade-form-cancel-btn");
const pairSelect = document.getElementById("trade-pair-select");
const pairCustom = document.getElementById("trade-pair-custom");
const positionHidden = document.getElementById("trade-dir");
const pnlInput = document.getElementById("trade-pnl");
const riskInput = document.getElementById("trade-risk");
const rrDisplay = document.getElementById("trade-rr-display");
const screenshotFileInput = document.getElementById("trade-screenshot-file");
const screenshotTriggerBtn = document.getElementById("trade-screenshot-trigger");
const screenshotPreviewWrap = document.getElementById("screenshot-preview-wrap");
const screenshotPreviewImg = document.getElementById("screenshot-preview-img");
const screenshotRemoveBtn = document.getElementById("screenshot-remove-btn");
const screenshotError = document.getElementById("screenshot-error");
let currentScreenshotData = null;

// ---------- DOM refs: account modal ----------
const accountModalOverlay = document.getElementById("account-modal-overlay");
const accountModalError = document.getElementById("account-modal-error");
const accountModalDesc = document.getElementById("account-modal-desc");
const accountForm = document.getElementById("account-form");
const accountCancelBtn = document.getElementById("account-cancel-btn");

// ---------- DOM refs: dashboard ----------
const calSubtitle = document.getElementById("cal-subtitle");
const calMonthLabel = document.getElementById("cal-month-label");
const calendarGrid = document.getElementById("calendar-grid");
const calPrevBtn = document.getElementById("cal-prev");
const calNextBtn = document.getElementById("cal-next");
const recentTradesList = document.getElementById("recent-trades-list");

// ============================================================
// AUTH
// ============================================================

authToggleBtn.addEventListener("click", () => {
  isRegisterMode = !isRegisterMode;
  authError.classList.add("hidden");
  if (isRegisterMode) {
    authTitle.textContent = "Buat akun baru";
    authSub.textContent = "Gratis, data lo tersimpan aman per akun.";
    authSubmitBtn.textContent = "Daftar";
    authToggleText.textContent = "Sudah punya akun?";
    authToggleBtn.textContent = "Masuk";
  } else {
    authTitle.textContent = "Masuk ke akun";
    authSub.textContent = "Catat & analisa trade lo di satu tempat.";
    authSubmitBtn.textContent = "Masuk";
    authToggleText.textContent = "Belum punya akun?";
    authToggleBtn.textContent = "Daftar sekarang";
  }
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.classList.add("hidden");
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-password").value;

  authSubmitBtn.disabled = true;
  try {
    if (isRegisterMode) {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (err) {
    authError.textContent = translateFirebaseError(err.code);
    authError.classList.remove("hidden");
  } finally {
    authSubmitBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    authShell.classList.add("hidden");
    appShell.classList.remove("hidden");
    userEmailEl.textContent = user.email;
    subscribeToAccounts(user.uid);
    subscribeToTrades(user.uid);
  } else {
    appShell.classList.add("hidden");
    authShell.classList.remove("hidden");
    if (unsubscribeTrades) unsubscribeTrades();
    if (unsubscribeAccounts) unsubscribeAccounts();
    allTrades = [];
    allAccounts = [];
    currentAccountId = null;
  }
});

function translateFirebaseError(code) {
  const map = {
    "auth/invalid-email": "Format email tidak valid.",
    "auth/user-not-found": "Email belum terdaftar.",
    "auth/wrong-password": "Password salah.",
    "auth/invalid-credential": "Email atau password salah.",
    "auth/email-already-in-use": "Email sudah terdaftar. Coba masuk.",
    "auth/weak-password": "Password minimal 6 karakter.",
  };
  return map[code] || "Terjadi kesalahan. Coba lagi.";
}

// ============================================================
// TABS
// ============================================================

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    tabButtons.forEach(b => b.classList.toggle("active", b === btn));
    Object.entries(tabContents).forEach(([key, el]) => {
      el.classList.toggle("hidden", key !== tab);
    });
  });
});

// ============================================================
// FIRESTORE: ACCOUNTS
// ============================================================

function accountsCollection(uid) {
  return collection(db, "users", uid, "accounts");
}

function subscribeToAccounts(uid) {
  unsubscribeAccounts = onSnapshot(query(accountsCollection(uid), orderBy("createdAt", "asc")), (snapshot) => {
    allAccounts = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));

    if (allAccounts.length === 0) {
      isFirstAccountFlow = true;
      openAccountModal(true);
      renderAccountSwitcher();
      return;
    }

    isFirstAccountFlow = false;
    closeAccountModal();

    const savedId = localStorage.getItem(`journal_account_${uid}`);
    const stillExists = allAccounts.some(a => a.id === savedId);
    if (!currentAccountId || !allAccounts.some(a => a.id === currentAccountId)) {
      currentAccountId = stillExists ? savedId : allAccounts[0].id;
    }

    renderAccountSwitcher();
    renderAll();
  }, (err) => console.error(err));
}

function renderAccountSwitcher() {
  accountSwitcher.innerHTML = "";
  allAccounts.forEach(acc => {
    const opt = document.createElement("option");
    opt.value = acc.id;
    opt.textContent = acc.name;
    if (acc.id === currentAccountId) opt.selected = true;
    accountSwitcher.appendChild(opt);
  });
  const addOpt = document.createElement("option");
  addOpt.value = "__add__";
  addOpt.textContent = "+ Tambah Akun Baru";
  accountSwitcher.appendChild(addOpt);
}

accountSwitcher.addEventListener("change", () => {
  if (accountSwitcher.value === "__add__") {
    openAccountModal(false);
    renderAccountSwitcher();
    return;
  }
  currentAccountId = accountSwitcher.value;
  if (currentUser) localStorage.setItem(`journal_account_${currentUser.uid}`, currentAccountId);
  calendarViewDate = new Date();
  renderAll();
});

function openAccountModal(isFirst) {
  accountForm.reset();
  accountModalError.classList.add("hidden");
  accountCancelBtn.classList.toggle("hidden", isFirst);
  accountModalDesc.textContent = isFirst
    ? "Bikin akun trading pertama lo. Bisa nambah akun lain lagi nanti (misal Akun Real & Akun Demo)."
    : "Tambah akun trading baru. Trade akan dicatat terpisah per akun.";
  accountModalOverlay.classList.remove("hidden");
}

function closeAccountModal() {
  if (isFirstAccountFlow) return;
  accountModalOverlay.classList.add("hidden");
}

accountCancelBtn.addEventListener("click", () => accountModalOverlay.classList.add("hidden"));

accountForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  accountModalError.classList.add("hidden");

  const name = document.getElementById("account-name").value.trim();
  const balance = parseFloat(document.getElementById("account-balance").value);
  if (!name || isNaN(balance)) {
    accountModalError.textContent = "Isi nama akun dan modal awal dengan benar.";
    accountModalError.classList.remove("hidden");
    return;
  }

  try {
    const ref = await addDoc(accountsCollection(currentUser.uid), {
      name, startingBalance: balance, createdAt: serverTimestamp()
    });
    currentAccountId = ref.id;
    localStorage.setItem(`journal_account_${currentUser.uid}`, currentAccountId);
    accountModalOverlay.classList.add("hidden");
  } catch (err) {
    accountModalError.textContent = "Gagal menyimpan akun. Coba lagi.";
    accountModalError.classList.remove("hidden");
    console.error(err);
  }
});

// ============================================================
// FIRESTORE: TRADES
// ============================================================

function tradesCollection(uid) {
  return collection(db, "users", uid, "trades");
}

function subscribeToTrades(uid) {
  const q = query(tradesCollection(uid), orderBy("date", "desc"));
  unsubscribeTrades = onSnapshot(q, (snapshot) => {
    allTrades = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  }, (err) => console.error(err));
}

async function saveTrade(tradeData, tradeId) {
  if (tradeId) {
    await updateDoc(doc(db, "users", currentUser.uid, "trades", tradeId), tradeData);
  } else {
    await addDoc(tradesCollection(currentUser.uid), {
      ...tradeData,
      createdAt: serverTimestamp()
    });
  }
}

async function removeTrade(tradeId) {
  await deleteDoc(doc(db, "users", currentUser.uid, "trades", tradeId));
}

// ============================================================
// INLINE TRADE FORM: toggle open/close
// ============================================================

toggleFormBtn.addEventListener("click", () => {
  if (tradeFormPanel.classList.contains("hidden")) {
    openTradeForm();
  } else {
    closeTradeForm();
  }
});
tradeFormCancelBtn.addEventListener("click", closeTradeForm);

function setToggleBtnState(isOpen) {
  toggleFormBtn.textContent = isOpen ? "✕ Cancel" : "+ New Trade";
  toggleFormBtn.classList.toggle("is-cancel", isOpen);
}

// ---------- Position toggle (Buy/Sell) ----------
document.querySelectorAll(".toggle-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".toggle-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    positionHidden.value = btn.dataset.value;
  });
});

// ---------- Pair select custom ----------
pairSelect.addEventListener("change", () => {
  pairCustom.classList.toggle("hidden", pairSelect.value !== "__custom__");
});

// ---------- RR auto-calc ----------
function updateRRDisplay() {
  const pnl = parseFloat(pnlInput.value);
  const risk = parseFloat(riskInput.value);
  if (!isNaN(risk) && risk > 0 && !isNaN(pnl)) {
    const rr = Math.abs(pnl) / risk;
    rrDisplay.value = `1 : ${rr.toFixed(2)}`;
  } else {
    rrDisplay.value = "";
  }
}
pnlInput.addEventListener("input", updateRRDisplay);
riskInput.addEventListener("input", updateRRDisplay);

// ---------- Screenshot upload (dikompres, disimpan sebagai base64 di Firestore) ----------
screenshotTriggerBtn.addEventListener("click", () => screenshotFileInput.click());

screenshotFileInput.addEventListener("change", async () => {
  const file = screenshotFileInput.files[0];
  if (!file) return;
  screenshotError.classList.add("hidden");

  try {
    const compressed = await resizeAndCompressImage(file, 900, 0.6);
    if (compressed.length > 900000) {
      screenshotError.textContent = "Gambar masih terlalu besar walau sudah dikompres. Coba screenshot area yang lebih kecil.";
      screenshotError.classList.remove("hidden");
      screenshotFileInput.value = "";
      return;
    }
    currentScreenshotData = compressed;
    showScreenshotPreview(compressed);
  } catch (err) {
    console.error(err);
    screenshotError.textContent = "Gagal memproses gambar. Coba file lain.";
    screenshotError.classList.remove("hidden");
  }
});

screenshotRemoveBtn.addEventListener("click", () => {
  currentScreenshotData = null;
  screenshotFileInput.value = "";
  screenshotPreviewWrap.classList.add("hidden");
});

function showScreenshotPreview(dataUrl) {
  screenshotPreviewImg.src = dataUrl;
  screenshotPreviewWrap.classList.remove("hidden");
}

function resizeAndCompressImage(file, maxDim, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > height && width > maxDim) {
          height = Math.round(height * (maxDim / width));
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round(width * (maxDim / height));
          height = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ---------- Pill groups (HTF / Confluence / Result) + custom add ----------
document.querySelectorAll(".pill-group").forEach(group => {
  group.addEventListener("click", (e) => {
    const btn = e.target.closest(".pill");
    if (!btn) return;
    const mode = group.dataset.mode;
    if (mode === "single") {
      group.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
      btn.classList.add("active");
    } else {
      btn.classList.toggle("active");
    }
  });
});

document.querySelectorAll(".pill-add-btn").forEach(addBtn => {
  const row = addBtn.closest(".pill-add-row");
  const input = row.querySelector(".pill-add-input");
  const group = row.previousElementSibling; // .pill-group tepat sebelum .pill-add-row

  addBtn.addEventListener("click", () => {
    if (input.classList.contains("hidden")) {
      input.classList.remove("hidden");
      input.focus();
    } else {
      commitCustomPill(group, input);
    }
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitCustomPill(group, input);
    }
  });
  input.addEventListener("blur", () => {
    if (input.value.trim()) commitCustomPill(group, input);
    else input.classList.add("hidden");
  });
});

function commitCustomPill(group, input) {
  const val = input.value.trim();
  if (!val) { input.classList.add("hidden"); return; }

  const existing = Array.from(group.querySelectorAll(".pill"))
    .find(p => p.dataset.value.toLowerCase() === val.toLowerCase());

  if (existing) {
    if (group.dataset.mode === "single") {
      group.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
    }
    existing.classList.add("active");
  } else {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "pill active";
    pill.dataset.value = val;
    pill.textContent = val;
    if (group.dataset.mode === "single") {
      group.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
    }
    group.appendChild(pill);
  }

  input.value = "";
  input.classList.add("hidden");
}

function resetPillGroups() {
  document.querySelectorAll(".pill-group").forEach(group => {
    group.querySelectorAll(".pill").forEach(p => {
      if (!p.dataset.original) p.remove();
      else p.classList.remove("active");
    });
  });
  document.querySelectorAll(".pill-add-input").forEach(inp => {
    inp.value = "";
    inp.classList.add("hidden");
  });
}

// tandai pill preset asli supaya tidak ikut terhapus saat reset
document.querySelectorAll(".pill-group .pill").forEach(p => p.dataset.original = "1");

function setActivePills(groupId, values) {
  const group = document.getElementById(groupId);
  (values || []).forEach(val => {
    let pill = Array.from(group.querySelectorAll(".pill"))
      .find(p => p.dataset.value === val);
    if (!pill) {
      pill = document.createElement("button");
      pill.type = "button";
      pill.className = "pill";
      pill.dataset.value = val;
      pill.textContent = val;
      group.appendChild(pill);
    }
    pill.classList.add("active");
  });
}

function getActivePillValues(groupId) {
  return Array.from(document.querySelectorAll(`#${groupId} .pill.active`)).map(p => p.dataset.value);
}

// ============================================================
// OPEN / CLOSE / SUBMIT TRADE FORM
// ============================================================

function openTradeForm(trade = null) {
  tradeForm.reset();
  tradeFormError.classList.add("hidden");
  pairCustom.classList.add("hidden");
  resetPillGroups();

  document.getElementById("trade-id").value = trade?.id || "";
  tradeFormTitleText.textContent = trade ? "Edit Trade" : "New Trade Entry";
  document.getElementById("trade-date").value = trade?.date || new Date().toISOString().slice(0, 10);

  const presetValues = Array.from(pairSelect.options).map(o => o.value);
  if (trade?.pair && presetValues.includes(trade.pair)) {
    pairSelect.value = trade.pair;
  } else if (trade?.pair) {
    pairSelect.value = "__custom__";
    pairCustom.value = trade.pair;
    pairCustom.classList.remove("hidden");
  } else {
    pairSelect.value = "EURUSD";
  }

  const pos = trade?.position || "Buy";
  positionHidden.value = pos;
  document.querySelectorAll(".toggle-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.value === pos);
  });

  pnlInput.value = trade?.pnl ?? "";
  riskInput.value = trade?.risk ?? "";
  updateRRDisplay();

  document.getElementById("trade-htf-link").value = trade?.htfLink || "";
  document.getElementById("trade-ltf-link").value = trade?.ltfLink || "";
  document.getElementById("trade-narrative").value = trade?.narrative || "";

  screenshotFileInput.value = "";
  screenshotError.classList.add("hidden");
  if (trade?.screenshotData) {
    currentScreenshotData = trade.screenshotData;
    showScreenshotPreview(trade.screenshotData);
  } else {
    currentScreenshotData = null;
    screenshotPreviewWrap.classList.add("hidden");
  }

  setActivePills("htf-group", trade?.htfBias);
  setActivePills("confluence-group", trade?.confluence);
  setActivePills("result-group", trade?.result ? [trade.result] : []);

  tradeFormPanel.classList.remove("hidden");
  setToggleBtnState(true);
  tradeFormPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeTradeForm() {
  tradeFormPanel.classList.add("hidden");
  setToggleBtnState(false);
  tradeForm.reset();
  resetPillGroups();
  currentScreenshotData = null;
  screenshotFileInput.value = "";
  screenshotPreviewWrap.classList.add("hidden");
  screenshotError.classList.add("hidden");
}

tradeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  tradeFormError.classList.add("hidden");

  if (!currentAccountId) {
    tradeFormError.textContent = "Belum ada akun aktif. Buat akun dulu.";
    tradeFormError.classList.remove("hidden");
    return;
  }

  const tradeId = document.getElementById("trade-id").value || null;
  const pnlVal = parseFloat(pnlInput.value);
  if (isNaN(pnlVal)) {
    tradeFormError.textContent = "Net P/L harus berupa angka.";
    tradeFormError.classList.remove("hidden");
    return;
  }

  let pairValue = pairSelect.value;
  if (pairValue === "__custom__") {
    pairValue = pairCustom.value.trim().toUpperCase();
    if (!pairValue) {
      tradeFormError.textContent = "Isi nama pair/instrumen-nya.";
      tradeFormError.classList.remove("hidden");
      return;
    }
  }

  const riskVal = parseOptionalFloat(riskInput.value);
  let riskRewardStr = "";
  if (riskVal && riskVal > 0) {
    riskRewardStr = `1:${(Math.abs(pnlVal) / riskVal).toFixed(2)}`;
  }

  const resultValues = getActivePillValues("result-group");

  const data = {
    accountId: currentAccountId,
    date: document.getElementById("trade-date").value,
    pair: pairValue,
    position: positionHidden.value,
    htfBias: getActivePillValues("htf-group"),
    confluence: getActivePillValues("confluence-group"),
    narrative: document.getElementById("trade-narrative").value.trim(),
    risk: riskVal,
    riskReward: riskRewardStr,
    result: resultValues[0] || "",
    pnl: pnlVal,
    htfLink: document.getElementById("trade-htf-link").value.trim(),
    ltfLink: document.getElementById("trade-ltf-link").value.trim(),
    screenshotData: currentScreenshotData || null,
  };

  try {
    await saveTrade(data, tradeId);
    closeTradeForm();
  } catch (err) {
    tradeFormError.textContent = "Gagal menyimpan. Coba lagi.";
    tradeFormError.classList.remove("hidden");
    console.error(err);
  }
});

function parseOptionalFloat(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

// ============================================================
// HELPERS
// ============================================================

function getAccountTrades() {
  if (!currentAccountId) return [];
  return allTrades.filter(t => t.accountId === currentAccountId);
}

function getCurrentAccount() {
  return allAccounts.find(a => a.id === currentAccountId) || null;
}

function parseRR(rrStr) {
  if (!rrStr) return null;
  const parts = rrStr.split(":").map(s => parseFloat(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1]) && parts[0] !== 0) {
    return parts[1] / parts[0];
  }
  return null;
}

function formatNum(n) {
  if (n === null || n === undefined || isNaN(n)) return "-";
  const sign = n > 0 ? "+" : "";
  return sign + Number(n).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

function formatMoney(n) {
  if (n === null || n === undefined || isNaN(n)) return "$0.00";
  const sign = n < 0 ? "-" : "";
  return sign + "$" + Math.abs(n).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

// ============================================================
// RENDER: MASTER
// ============================================================

filterPair.addEventListener("input", renderAll);
filterDir.addEventListener("change", renderAll);
filterResult.addEventListener("change", renderAll);

function getFilteredTradeLog(accountTrades) {
  const pairQ = filterPair.value.trim().toUpperCase();
  const dirQ = filterDir.value;
  const resultQ = filterResult.value;

  return accountTrades.filter(t => {
    if (pairQ && !t.pair?.toUpperCase().includes(pairQ)) return false;
    if (dirQ && t.position !== dirQ) return false;
    if (resultQ === "win" && t.pnl <= 0) return false;
    if (resultQ === "loss" && t.pnl > 0) return false;
    return true;
  });
}

function renderAll() {
  const accountTrades = getAccountTrades();
  renderTable(getFilteredTradeLog(accountTrades));
  renderTradeLogStats(accountTrades);
  renderAnalytics(accountTrades);
  renderDashboard(accountTrades);
}

// ============================================================
// RENDER: TRADE LOG STATS + TABLE
// ============================================================

function renderTradeLogStats(accountTrades) {
  const total = accountTrades.length;
  const wins = accountTrades.filter(t => t.pnl > 0).length;
  const winRate = total ? (wins / total) * 100 : 0;
  const totalPnl = accountTrades.reduce((s, t) => s + t.pnl, 0);
  const account = getCurrentAccount();
  const balance = (account?.startingBalance || 0) + totalPnl;

  const pnlEl = document.getElementById("tl-total-pnl");
  pnlEl.textContent = formatMoney(totalPnl);
  pnlEl.className = "stat-value " + (totalPnl > 0 ? "pos" : totalPnl < 0 ? "neg" : "neu");

  document.getElementById("tl-winrate").textContent = winRate.toFixed(0) + "%";
  document.getElementById("tl-trades").textContent = total;
  document.getElementById("tl-balance").textContent = formatMoney(balance);
}

function renderTable(trades) {
  tradesTbody.innerHTML = "";
  emptyState.classList.toggle("hidden", trades.length > 0);

  trades.forEach(t => {
    const tr = document.createElement("tr");
    const pnlClass = t.pnl > 0 ? "pos" : (t.pnl < 0 ? "neg" : "neu");
    const dirClass = t.position === "Buy" ? "dir-buy" : "dir-sell";
    const resultClass = t.pnl > 0 ? "result-profit" : (t.pnl < 0 ? "result-loss" : "result-breakeven");
    const confluenceText = (t.confluence || []).join(", ") || "-";
    const htfText = (t.htfBias || []).join(", ") || "-";
    const screenshotIcon = t.screenshotData ? `<span class="screenshot-icon" data-id="${t.id}" title="Lihat screenshot">📷</span>` : "";

    tr.innerHTML = `
      <td class="mono">${t.date || "-"}</td>
      <td>${escapeHtml(t.pair || "-")}${screenshotIcon}</td>
      <td><span class="dir-badge ${dirClass}">${t.position || "-"}</span></td>
      <td>${escapeHtml(htfText)}</td>
      <td class="mono">${escapeHtml(t.riskReward || "-")}</td>
      <td class="mono ${pnlClass}">${formatNum(t.pnl)}</td>
      <td><span class="result-badge ${resultClass}">${escapeHtml(t.result || "-")}</span></td>
      <td>${escapeHtml(confluenceText)}</td>
      <td>
        <button class="btn-edit" data-id="${t.id}">Edit</button>
        <button class="btn-danger" data-id="${t.id}">Hapus</button>
      </td>
    `;
    tradesTbody.appendChild(tr);
  });

  tradesTbody.querySelectorAll(".screenshot-icon").forEach(icon => {
    icon.addEventListener("click", () => {
      const trade = allTrades.find(t => t.id === icon.dataset.id);
      if (trade?.screenshotData) {
        const w = window.open();
        w.document.write(`<title>Screenshot</title><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${trade.screenshotData}" style="max-width:100%;max-height:100vh;" /></body>`);
      }
    });
  });

  tradesTbody.querySelectorAll(".btn-edit").forEach(btn => {
    btn.addEventListener("click", () => {
      const trade = allTrades.find(t => t.id === btn.dataset.id);
      if (trade) openTradeForm(trade);
    });
  });
  tradesTbody.querySelectorAll(".btn-danger").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (confirm("Hapus trade ini?")) await removeTrade(btn.dataset.id);
    });
  });
}

// ============================================================
// RENDER: ANALYTICS TAB
// ============================================================

function renderAnalytics(trades) {
  const total = trades.length;
  const wins = trades.filter(t => t.pnl > 0);
  const losses = trades.filter(t => t.pnl < 0);
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const winRate = total ? (wins.length / total) * 100 : 0;
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-winrate").textContent = winRate.toFixed(1) + "%";

  const pnlEl = document.getElementById("stat-pnl");
  pnlEl.textContent = formatNum(totalPnl);
  pnlEl.className = "stat-value " + (totalPnl > 0 ? "pos" : totalPnl < 0 ? "neg" : "neu");

  document.getElementById("stat-avgwin").textContent = formatNum(avgWin);
  document.getElementById("stat-avgloss").textContent = formatNum(avgLoss);

  renderEquityCurve(trades);
}

function renderEquityCurve(trades) {
  const svg = document.getElementById("equity-svg");
  const rangeLabel = document.getElementById("curve-range");
  svg.innerHTML = "";

  if (trades.length === 0) {
    rangeLabel.textContent = "-";
    return;
  }

  const chrono = [...trades].sort((a, b) => (a.date > b.date ? 1 : -1));
  let cum = 0;
  const points = chrono.map(t => (cum += t.pnl));

  const w = 1000, h = 120, pad = 8;
  const min = Math.min(0, ...points);
  const max = Math.max(0, ...points);
  const range = (max - min) || 1;

  const coords = points.map((val, i) => {
    const x = points.length === 1 ? w / 2 : (i / (points.length - 1)) * (w - pad * 2) + pad;
    const y = h - pad - ((val - min) / range) * (h - pad * 2);
    return [x, y];
  });

  const pathD = coords.map((c, i) => (i === 0 ? `M ${c[0]},${c[1]}` : `L ${c[0]},${c[1]}`)).join(" ");
  const lastVal = points[points.length - 1];
  const strokeColor = lastVal >= 0 ? "#2ee6a6" : "#ff5c7a";
  const zeroY = h - pad - ((0 - min) / range) * (h - pad * 2);

  svg.innerHTML = `
    <line x1="0" y1="${zeroY}" x2="${w}" y2="${zeroY}" stroke="#26262f" stroke-width="1" stroke-dasharray="4 4" />
    <path d="${pathD}" fill="none" stroke="${strokeColor}" stroke-width="2.5" />
  `;

  rangeLabel.textContent = `${chrono[0].date} → ${chrono[chrono.length - 1].date} · ${formatNum(lastVal)}`;
}

// ============================================================
// RENDER: DASHBOARD TAB
// ============================================================

calPrevBtn.addEventListener("click", () => {
  calendarViewDate.setMonth(calendarViewDate.getMonth() - 1);
  renderDashboard(getAccountTrades());
});
calNextBtn.addEventListener("click", () => {
  calendarViewDate.setMonth(calendarViewDate.getMonth() + 1);
  renderDashboard(getAccountTrades());
});

function renderDashboard(accountTrades) {
  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();

  const monthTrades = accountTrades.filter(t => {
    if (!t.date) return false;
    const d = new Date(t.date + "T00:00:00");
    return d.getFullYear() === year && d.getMonth() === month;
  });

  calMonthLabel.textContent = `${MONTH_NAMES_ID[month]} ${year}`;
  calSubtitle.textContent = `${monthTrades.length} trade · ${MONTH_NAMES_ID[month]} ${year}`;

  renderCalendarGrid(year, month, monthTrades);
  renderRecentTrades(accountTrades);
  renderDashboardStats(monthTrades, accountTrades);
}

function renderCalendarGrid(year, month, monthTrades) {
  calendarGrid.innerHTML = "";

  const pnlByDay = {};
  monthTrades.forEach(t => {
    const day = parseInt(t.date.split("-")[2], 10);
    pnlByDay[day] = (pnlByDay[day] || 0) + t.pnl;
  });

  const firstDay = new Date(year, month, 1);
  let startOffset = firstDay.getDay();
  if (WEEKDAY_START_MONDAY) startOffset = (startOffset + 6) % 7;

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;

  for (let i = 0; i < startOffset; i++) {
    const empty = document.createElement("div");
    empty.className = "cal-cell empty";
    calendarGrid.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const cell = document.createElement("div");
    cell.className = "cal-cell";
    const pnl = pnlByDay[day];

    if (pnl !== undefined) cell.classList.add(pnl >= 0 ? "cal-win" : "cal-loss");
    if (isCurrentMonth && day === today.getDate()) cell.classList.add("cal-today");

    cell.innerHTML = `
      <span class="cal-day-num">${day}</span>
      ${pnl !== undefined ? `<span class="cal-day-pnl">${formatNum(pnl)}</span>` : ""}
    `;
    calendarGrid.appendChild(cell);
  }
}

function renderRecentTrades(accountTrades) {
  const recent = [...accountTrades].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);

  if (recent.length === 0) {
    recentTradesList.innerHTML = `<div class="recent-empty">Belum ada trade.</div>`;
    return;
  }

  recentTradesList.innerHTML = recent.map(t => {
    const pnlClass = t.pnl > 0 ? "pos" : (t.pnl < 0 ? "neg" : "neu");
    return `
      <div class="recent-item">
        <div class="recent-item-left">
          <span class="recent-item-pair">${escapeHtml(t.pair || "-")}</span>
          <span class="recent-item-date">${t.date || "-"} · ${escapeHtml(t.position || "-")}</span>
        </div>
        <span class="recent-item-pnl ${pnlClass}">${formatNum(t.pnl)}</span>
      </div>
    `;
  }).join("");
}

function renderDashboardStats(monthTrades, accountTrades) {
  const label = `${MONTH_NAMES_ID[calendarViewDate.getMonth()]} ${calendarViewDate.getFullYear()}`;
  const total = monthTrades.length;
  const wins = monthTrades.filter(t => t.pnl > 0);
  const losses = monthTrades.filter(t => t.pnl < 0);
  const bes = monthTrades.filter(t => t.pnl === 0);
  const winRate = total ? (wins.length / total) * 100 : 0;

  document.getElementById("dash-winrate-sub").textContent = `WIN RATE · ${label}`;
  document.getElementById("dash-winrate").textContent = winRate.toFixed(0) + "%";
  document.getElementById("dash-w-count").textContent = wins.length;
  document.getElementById("dash-l-count").textContent = losses.length;
  document.getElementById("dash-be-count").textContent = bes.length;

  const monthlyPnl = monthTrades.reduce((s, t) => s + t.pnl, 0);
  const profitSum = wins.reduce((s, t) => s + t.pnl, 0);
  const lossSum = losses.reduce((s, t) => s + t.pnl, 0);

  document.getElementById("dash-pnl-sub").textContent = `P&L BULAN INI · ${label}`;
  const pnlEl = document.getElementById("dash-pnl");
  pnlEl.textContent = formatMoney(monthlyPnl);
  pnlEl.className = "stat-value " + (monthlyPnl > 0 ? "pos" : monthlyPnl < 0 ? "neg" : "neu");
  document.getElementById("dash-profit").textContent = formatMoney(profitSum);
  document.getElementById("dash-loss").textContent = formatMoney(lossSum);

  const rrValues = monthTrades.map(t => parseRR(t.riskReward)).filter(v => v !== null);
  const avgRR = rrValues.length ? rrValues.reduce((s, v) => s + v, 0) / rrValues.length : null;
  document.getElementById("dash-rr-sub").textContent = `AVG RISK:REWARD · ${label}`;
  document.getElementById("dash-rr").textContent = avgRR !== null ? `1:${avgRR.toFixed(1)}` : "-";
  document.getElementById("dash-rr-footnote").textContent = `${total} trade bulan ini`;

  const account = getCurrentAccount();
  const startingBalance = account?.startingBalance || 0;
  const allTimePnl = accountTrades.reduce((s, t) => s + t.pnl, 0);
  const balance = startingBalance + allTimePnl;

  document.getElementById("dash-balance-sub").textContent = `SALDO · ${account?.name || "-"}`;
  document.getElementById("dash-balance").textContent = formatMoney(balance);
  document.getElementById("dash-balance-footnote").textContent = `Modal awal: ${formatMoney(startingBalance)}`;
}
