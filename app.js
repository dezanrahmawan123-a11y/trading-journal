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
  doc, setDoc, onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ============================================================
// GANTI INI dengan User UID akun lo sendiri (lihat panduan di chat).
// Akun dengan UID ini otomatis jadi admin & gak perlu approval.
// ============================================================
const ADMIN_UID = "igxAKYsyzqMZOUs3xTl8J42ya333";

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
let unsubscribeAccessRequest = null;
let unsubscribeAdminRequests = null;
let calendarViewDate = new Date();
let isFirstAccountFlow = false;

// ---------- DOM refs: auth ----------
const authShell = document.getElementById("auth-shell");
const pendingShell = document.getElementById("pending-shell");
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
const adminApprovalBtn = document.getElementById("admin-approval-btn");
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

// ---------- DOM refs: trade detail modal ----------
const tradeDetailOverlay = document.getElementById("trade-detail-overlay");
const tradeDetailContent = document.getElementById("trade-detail-content");

// ---------- DOM refs: day detail modal ----------
const dayDetailOverlay = document.getElementById("day-detail-overlay");
const dayDetailContent = document.getElementById("day-detail-content");

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
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await setDoc(doc(db, "access_requests", cred.user.uid), {
        email: cred.user.email,
        approved: cred.user.uid === ADMIN_UID,
        requestedAt: serverTimestamp(),
      });
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

// ---------- Profile shortcut menu ----------
const profileFabBtn = document.getElementById("profile-fab-btn");
const profileMenu = document.getElementById("profile-menu");

profileFabBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  profileMenu.classList.toggle("hidden");
});
document.addEventListener("click", (e) => {
  if (!profileMenu.classList.contains("hidden") && !profileMenu.contains(e.target) && e.target !== profileFabBtn) {
    profileMenu.classList.add("hidden");
  }
});

// ---------- Admin: kelola persetujuan user baru ----------
const adminModalOverlay = document.getElementById("admin-modal-overlay");
const adminRequestsList = document.getElementById("admin-requests-list");
const adminModalCloseBtn = document.getElementById("admin-modal-close-btn");

adminApprovalBtn.addEventListener("click", () => {
  profileMenu.classList.add("hidden");
  adminModalOverlay.classList.remove("hidden");

  if (unsubscribeAdminRequests) unsubscribeAdminRequests();
  unsubscribeAdminRequests = onSnapshot(
    query(collection(db, "access_requests"), orderBy("requestedAt", "desc")),
    (snapshot) => {
      const allReq = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      renderAdminRequests(allReq);
    }
  );
});

adminModalCloseBtn.addEventListener("click", () => {
  adminModalOverlay.classList.add("hidden");
  if (unsubscribeAdminRequests) unsubscribeAdminRequests();
});
adminModalOverlay.addEventListener("click", (e) => {
  if (e.target === adminModalOverlay) adminModalCloseBtn.click();
});

function renderAdminRequests(allReq) {
  if (allReq.length === 0) {
    adminRequestsList.innerHTML = `<div class="admin-request-empty">Belum ada yang daftar.</div>`;
    return;
  }

  adminRequestsList.innerHTML = allReq.map(r => {
    const dateStr = r.requestedAt?.toDate ? r.requestedAt.toDate().toLocaleString("id-ID") : "-";
    const statusBadge = r.approved
      ? `<span class="result-badge result-profit">Approved</span>`
      : `<span class="result-badge result-breakeven">Pending</span>`;
    return `
      <div class="admin-request-item">
        <div>
          <div class="admin-request-email">${escapeHtml(r.email || r.id)}</div>
          <div class="admin-request-date">${dateStr}</div>
        </div>
        <div class="admin-request-actions">
          ${statusBadge}
          ${!r.approved ? `<button class="btn-edit" data-action="approve" data-id="${r.id}">Approve</button>` : ""}
          <button class="btn-danger" data-action="reject" data-id="${r.id}">Tolak</button>
        </div>
      </div>
    `;
  }).join("");

  adminRequestsList.querySelectorAll("[data-action='approve']").forEach(btn => {
    btn.addEventListener("click", async () => {
      await updateDoc(doc(db, "access_requests", btn.dataset.id), { approved: true });
    });
  });
  adminRequestsList.querySelectorAll("[data-action='reject']").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (confirm("Tolak user ini? Mereka gak akan bisa masuk lagi (akun login-nya tetap ada tapi terkunci).")) {
        await deleteDoc(doc(db, "access_requests", btn.dataset.id));
      }
    });
  });
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    authShell.classList.add("hidden");
    userEmailEl.textContent = user.email;

    if (user.uid === ADMIN_UID) {
      pendingShell.classList.add("hidden");
      appShell.classList.remove("hidden");
      adminApprovalBtn.classList.remove("hidden");
      subscribeToAccounts(user.uid);
      subscribeToTrades(user.uid);
    } else {
      adminApprovalBtn.classList.add("hidden");
      unsubscribeAccessRequest = onSnapshot(doc(db, "access_requests", user.uid), (snap) => {
        const approved = snap.exists() && snap.data().approved === true;
        if (approved) {
          pendingShell.classList.add("hidden");
          appShell.classList.remove("hidden");
          subscribeToAccounts(user.uid);
          subscribeToTrades(user.uid);
        } else {
          appShell.classList.add("hidden");
          pendingShell.classList.remove("hidden");
        }
      });
    }
  } else {
    appShell.classList.add("hidden");
    pendingShell.classList.add("hidden");
    authShell.classList.remove("hidden");
    if (unsubscribeTrades) unsubscribeTrades();
    if (unsubscribeAccounts) unsubscribeAccounts();
    if (unsubscribeAccessRequest) unsubscribeAccessRequest();
    if (unsubscribeAdminRequests) unsubscribeAdminRequests();
    allTrades = [];
    allAccounts = [];
    currentAccountId = null;
  }
});

document.getElementById("pending-logout-btn").addEventListener("click", () => signOut(auth));

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
  refreshCustomSelect(accountSwitcher);
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

function openTradeForm(trade = null, presetDate = null) {
  tradeForm.reset();
  tradeFormError.classList.add("hidden");
  pairCustom.classList.add("hidden");
  resetPillGroups();

  document.getElementById("trade-id").value = trade?.id || "";
  tradeFormTitleText.textContent = trade ? "Edit Trade" : "New Trade Entry";
  document.getElementById("trade-date").value = trade?.date || presetDate || new Date().toISOString().slice(0, 10);

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

  renderHtfLinksList(trade?.htfLinks || (trade?.htfLink ? [trade.htfLink] : []));
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

// ---------- HTF multi-link list ----------
const htfLinksList = document.getElementById("htf-links-list");
const htfLinkAddBtn = document.getElementById("htf-link-add-btn");

function renderHtfLinksList(links) {
  htfLinksList.innerHTML = "";
  const values = links.length ? links : [""];
  values.forEach(val => addHtfLinkRow(val));
}

function addHtfLinkRow(value = "") {
  const row = document.createElement("div");
  row.className = "link-list-row";
  row.innerHTML = `
    <input type="text" class="htf-link-input" placeholder="TradingView link..." value="${escapeHtml(value)}" />
    <button type="button" class="link-remove-btn" title="Hapus link">✕</button>
  `;
  row.querySelector(".link-remove-btn").addEventListener("click", () => {
    row.remove();
    if (htfLinksList.children.length === 0) addHtfLinkRow();
  });
  htfLinksList.appendChild(row);
}

htfLinkAddBtn.addEventListener("click", () => addHtfLinkRow());

function getHtfLinksValues() {
  return Array.from(htfLinksList.querySelectorAll(".htf-link-input"))
    .map(inp => inp.value.trim())
    .filter(v => v);
}

function goToTradeLogAndAddTrade(dateStr) {
  const tabBtn = document.querySelector('.tab-btn[data-tab="tradelog"]');
  if (tabBtn) tabBtn.click();
  openTradeForm(null, dateStr);
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
    htfLinks: getHtfLinksValues(),
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
// TRADE DETAIL / RECAP MODAL
// ============================================================

tradeDetailOverlay.addEventListener("click", (e) => {
  if (e.target === tradeDetailOverlay) closeTradeDetail();
});

function closeTradeDetail() {
  tradeDetailOverlay.classList.add("hidden");
  tradeDetailContent.innerHTML = "";
}

function openTradeDetail(trade) {
  const pnlClass = trade.pnl > 0 ? "pos" : (trade.pnl < 0 ? "neg" : "neu");
  const dirClass = trade.position === "Buy" ? "dir-buy" : "dir-sell";
  const resultClass = trade.pnl > 0 ? "result-profit" : (trade.pnl < 0 ? "result-loss" : "result-breakeven");

  const htfTags = (trade.htfBias || []).length
    ? `<div class="detail-tags">${trade.htfBias.map(v => `<span class="detail-tag">${escapeHtml(v)}</span>`).join("")}</div>`
    : `<div class="detail-empty-note">Gak ada data HTF opportunity.</div>`;

  const confluenceTags = (trade.confluence || []).length
    ? `<div class="detail-tags">${trade.confluence.map(v => `<span class="detail-tag">${escapeHtml(v)}</span>`).join("")}</div>`
    : `<div class="detail-empty-note">Gak ada confluence yang dicatat.</div>`;

  const narrativeHtml = trade.narrative
    ? `<div class="detail-narrative">${escapeHtml(trade.narrative)}</div>`
    : `<div class="detail-empty-note">Belum ada naratif untuk trade ini.</div>`;

  const links = [];
  const htfLinksArr = trade.htfLinks || (trade.htfLink ? [trade.htfLink] : []);
  htfLinksArr.forEach((url, i) => {
    links.push(`<a class="detail-link-btn" href="${escapeHtml(url)}" target="_blank" rel="noopener">🔗 HTF Chart${htfLinksArr.length > 1 ? ` ${i + 1}` : ""}</a>`);
  });
  if (trade.ltfLink) links.push(`<a class="detail-link-btn" href="${escapeHtml(trade.ltfLink)}" target="_blank" rel="noopener">🔗 LTF Chart</a>`);
  const linksHtml = links.length
    ? `<div class="detail-links">${links.join("")}</div>`
    : `<div class="detail-empty-note">Gak ada link chart.</div>`;

  const screenshotHtml = trade.screenshotData
    ? `<img class="detail-screenshot" src="${trade.screenshotData}" alt="Screenshot trade" id="detail-screenshot-img" /><div class="detail-screenshot-hint">Klik gambar buat lihat ukuran penuh</div>`
    : `<div class="detail-empty-note">Gak ada screenshot.</div>`;

  tradeDetailContent.innerHTML = `
    <div class="detail-header">
      <div class="detail-header-left">
        <span class="detail-pair">${escapeHtml(trade.pair || "-")}</span>
        <span class="detail-date">${trade.date || "-"}</span>
        <div class="detail-badges">
          <span class="dir-badge ${dirClass}">${trade.position || "-"}</span>
          <span class="result-badge ${resultClass}">${escapeHtml(trade.result || "-")}</span>
        </div>
      </div>
      <div class="detail-pnl-block">
        <div class="detail-pnl-label">Net P/L</div>
        <div class="detail-pnl-value ${pnlClass}">${formatMoney(trade.pnl)}</div>
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-stat">
        <div class="detail-stat-label">Risk</div>
        <div class="detail-stat-value">${trade.risk ? formatMoney(trade.risk) : "-"}</div>
      </div>
      <div class="detail-stat">
        <div class="detail-stat-label">Risk : Reward</div>
        <div class="detail-stat-value">${escapeHtml(trade.riskReward || "-")}</div>
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-section-title">HTF Opportunity</div>
      ${htfTags}
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Confluence</div>
      ${confluenceTags}
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Naratif Setup</div>
      ${narrativeHtml}
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Chart Links</div>
      ${linksHtml}
    </div>

    <div class="detail-section">
      <div class="detail-section-title">Screenshot</div>
      ${screenshotHtml}
    </div>

    <div class="detail-actions">
      <button type="button" class="btn btn-danger" id="detail-delete-btn" style="flex:0;">Hapus</button>
      <button type="button" class="btn btn-ghost" id="detail-close-btn">Tutup</button>
      <button type="button" class="btn btn-primary" id="detail-edit-btn">Edit Trade</button>
    </div>
  `;

  document.getElementById("detail-close-btn").addEventListener("click", closeTradeDetail);
  document.getElementById("detail-edit-btn").addEventListener("click", () => {
    closeTradeDetail();
    openTradeForm(trade);
  });
  document.getElementById("detail-delete-btn").addEventListener("click", async () => {
    if (confirm("Hapus trade ini?")) {
      await removeTrade(trade.id);
      closeTradeDetail();
    }
  });
  if (trade.screenshotData) {
    document.getElementById("detail-screenshot-img").addEventListener("click", () => {
      const w = window.open();
      w.document.write(`<title>Screenshot</title><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${trade.screenshotData}" style="max-width:100%;max-height:100vh;" /></body>`);
    });
  }

  tradeDetailOverlay.classList.remove("hidden");
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

function formatNumCompact(n) {
  if (n === null || n === undefined || isNaN(n)) return "-";
  const sign = n > 0 ? "+" : (n < 0 ? "-" : "");
  const abs = Math.abs(n);
  if (abs >= 1000) {
    const k = (abs / 1000).toFixed(1).replace(/\.0$/, "");
    return `${sign}${k}k`;
  }
  return `${sign}${Math.round(abs)}`;
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
  renderAnalytics(getAnalyticsFilteredTrades(accountTrades));
  renderDashboard(accountTrades);
}

function getAnalyticsFilteredTrades(accountTrades) {
  const periodSelect = document.getElementById("analytics-period");
  const period = periodSelect ? periodSelect.value : "all";
  if (period === "all") return accountTrades;

  const now = new Date();
  return accountTrades.filter(t => {
    if (!t.date) return false;
    const d = new Date(t.date + "T00:00:00");
    if (period === "week") {
      const dayIdx = (now.getDay() + 6) % 7; // Senin = 0
      const monday = new Date(now);
      monday.setDate(now.getDate() - dayIdx);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      return d >= monday && d <= sunday;
    }
    if (period === "month") {
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
    if (period === "year") {
      return d.getFullYear() === now.getFullYear();
    }
    return true;
  });
}

document.getElementById("analytics-period").addEventListener("change", renderAll);

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
    tr.className = "trades-tbody-row";
    tr.dataset.id = t.id;
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

  tradesTbody.querySelectorAll(".trades-tbody-row").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".btn-edit, .btn-danger, .screenshot-icon")) return;
      const trade = allTrades.find(t => t.id === row.dataset.id);
      if (trade) openTradeDetail(trade);
    });
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

  renderGrowthChart(trades);
  renderSymbolDonut(trades);
  renderWinLossDonut(trades);
  renderWeekdayBar(trades);
  renderResultBar(trades);
}

const CHART_PALETTE = ["#7c6cff", "#34d399", "#ffb648", "#f87171", "#4cc9f0", "#f72585", "#80ed99", "#e0aaff"];

function renderGrowthChart(trades) {
  const svg = document.getElementById("growth-svg");
  const changeEl = document.getElementById("growth-change");
  const startLabel = document.getElementById("growth-start-label");
  const endLabel = document.getElementById("growth-end-label");
  svg.innerHTML = "";

  const account = getCurrentAccount();
  const startingBalance = account?.startingBalance || 0;

  if (trades.length === 0) {
    changeEl.textContent = "-";
    changeEl.className = "growth-change neu";
    startLabel.textContent = "-";
    endLabel.textContent = "-";
    svg.innerHTML = `<text x="500" y="90" text-anchor="middle" fill="#8b8d97" font-size="13">Belum ada data trade</text>`;
    return;
  }

  const chrono = [...trades].sort((a, b) => (a.date > b.date ? 1 : -1));
  let cum = startingBalance;
  const points = [cum, ...chrono.map(t => (cum += t.pnl))];

  const w = 1000, h = 180, padL = 60, padR = 10, padT = 14, padB = 10;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = (max - min) || 1;

  const coords = points.map((val, i) => {
    const x = points.length === 1 ? padL : padL + (i / (points.length - 1)) * (w - padL - padR);
    const y = padT + (h - padT - padB) - ((val - min) / range) * (h - padT - padB);
    return [x, y];
  });

  const lineD = coords.map((c, i) => (i === 0 ? `M ${c[0]},${c[1]}` : `L ${c[0]},${c[1]}`)).join(" ");
  const areaD = `${lineD} L ${coords[coords.length - 1][0]},${h - padB} L ${coords[0][0]},${h - padB} Z`;

  const lastVal = points[points.length - 1];
  const changeAbs = lastVal - startingBalance;
  const changePct = startingBalance > 0 ? (changeAbs / startingBalance) * 100 : null;
  const isUp = changeAbs >= 0;
  const strokeColor = isUp ? "#34d399" : "#f87171";

  changeEl.textContent = changePct !== null
    ? `${formatMoney(changeAbs)} (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%)`
    : formatMoney(changeAbs);
  changeEl.className = "growth-change " + (isUp ? "pos" : "neg");

  startLabel.textContent = `Start · ${formatMoney(startingBalance)}`;
  endLabel.textContent = `${chrono[chrono.length - 1].date} · ${formatMoney(lastVal)}`;

  // 4 garis grid horizontal + label sumbu Y
  let gridLines = "";
  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    const val = min + (range * i / tickCount);
    const y = padT + (h - padT - padB) - (i / tickCount) * (h - padT - padB);
    gridLines += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#26272e" stroke-width="1" stroke-dasharray="3 4" />`;
    gridLines += `<text x="${padL - 8}" y="${y + 3}" text-anchor="end" font-size="10" fill="#8b8d97" font-family="monospace">${formatMoney(val).replace(".00", "")}</text>`;
  }

  svg.innerHTML = `
    <defs>
      <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.28" />
        <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0" />
      </linearGradient>
    </defs>
    ${gridLines}
    <path d="${areaD}" fill="url(#growthFill)" stroke="none" />
    <path d="${lineD}" fill="none" stroke="${strokeColor}" stroke-width="2.5" />
  `;
}

function buildDonutSVG(svgEl, segments) {
  svgEl.innerHTML = "";
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total <= 0) {
    svgEl.innerHTML = `<circle cx="60" cy="60" r="44" fill="none" stroke="#26272e" stroke-width="16" />`;
    return;
  }
  const r = 44, cx = 60, cy = 60;
  const circumference = 2 * Math.PI * r;
  let cumulative = 0;
  let circles = "";
  segments.forEach(seg => {
    if (seg.value <= 0) return;
    const dash = (seg.value / total) * circumference;
    circles += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="16"
      stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-cumulative}"
      transform="rotate(-90 ${cx} ${cy})" stroke-linecap="butt" />`;
    cumulative += dash;
  });
  svgEl.innerHTML = circles;
}

function renderSymbolDonut(trades) {
  const svg = document.getElementById("symbol-donut-svg");
  const legend = document.getElementById("symbol-legend");

  if (trades.length === 0) {
    buildDonutSVG(svg, []);
    legend.innerHTML = `<div class="chart-empty-note">Belum ada data.</div>`;
    return;
  }

  const byPair = {};
  trades.forEach(t => {
    const key = t.pair || "-";
    if (!byPair[key]) byPair[key] = { count: 0, pnl: 0 };
    byPair[key].count += 1;
    byPair[key].pnl += t.pnl;
  });

  const entries = Object.entries(byPair).sort((a, b) => b[1].count - a[1].count);
  const segments = entries.map(([pair, data], i) => ({
    label: pair, value: data.count, pnl: data.pnl, count: data.count,
    color: CHART_PALETTE[i % CHART_PALETTE.length]
  }));

  buildDonutSVG(svg, segments);
  legend.innerHTML = segments.map(seg => `
    <div class="donut-legend-item">
      <div class="donut-legend-left">
        <span class="donut-dot" style="background:${seg.color}"></span>
        <span class="donut-legend-label">${escapeHtml(seg.label)}</span>
      </div>
      <div style="text-align:right;">
        <div class="donut-legend-value ${seg.pnl > 0 ? 'pos' : seg.pnl < 0 ? 'neg' : 'neu'}">${formatNum(seg.pnl)}</div>
        <div class="donut-legend-sub">${seg.count} trades</div>
      </div>
    </div>
  `).join("");
}

function renderWinLossDonut(trades) {
  const svg = document.getElementById("winloss-donut-svg");
  const legend = document.getElementById("winloss-legend");

  const wins = trades.filter(t => t.pnl > 0).length;
  const losses = trades.filter(t => t.pnl < 0).length;
  const bes = trades.filter(t => t.pnl === 0).length;
  const total = trades.length;

  if (total === 0) {
    buildDonutSVG(svg, []);
    legend.innerHTML = `<div class="chart-empty-note">Belum ada data.</div>`;
    return;
  }

  const segments = [
    { label: "Win", value: wins, color: "#34d399" },
    { label: "Loss", value: losses, color: "#f87171" },
    { label: "Breakeven", value: bes, color: "#ffb648" },
  ].filter(s => s.value > 0);

  buildDonutSVG(svg, segments);
  const winRate = ((wins / total) * 100).toFixed(0);

  legend.innerHTML = `
    <div class="donut-legend-item">
      <div class="donut-legend-left"><span class="donut-dot" style="background:#34d399"></span><span class="donut-legend-label">Win</span></div>
      <div class="donut-legend-value pos">${wins}</div>
    </div>
    <div class="donut-legend-item">
      <div class="donut-legend-left"><span class="donut-dot" style="background:#f87171"></span><span class="donut-legend-label">Loss</span></div>
      <div class="donut-legend-value neg">${losses}</div>
    </div>
    ${bes > 0 ? `
    <div class="donut-legend-item">
      <div class="donut-legend-left"><span class="donut-dot" style="background:#ffb648"></span><span class="donut-legend-label">Breakeven</span></div>
      <div class="donut-legend-value neu">${bes}</div>
    </div>` : ""}
    <div class="donut-legend-item" style="margin-top:4px; border-top:1px solid var(--border-soft); padding-top:8px;">
      <div class="donut-legend-left"><span class="donut-legend-label">Win Rate</span></div>
      <div class="donut-legend-value pos">${winRate}%</div>
    </div>
  `;
}

function buildBarChartSVG(svgEl, bars) {
  svgEl.innerHTML = "";
  const w = 400, h = 140, padL = 8, padR = 8, padT = 10, padB = 20;
  const values = bars.map(b => b.value);
  const maxAbs = Math.max(1, ...values.map(v => Math.abs(v)));
  const zeroY = padT + (h - padT - padB) / 2;
  const halfH = (h - padT - padB) / 2;

  const barW = (w - padL - padR) / bars.length;
  let content = `<line x1="${padL}" y1="${zeroY}" x2="${w - padR}" y2="${zeroY}" stroke="#26272e" stroke-width="1" />`;

  bars.forEach((bar, i) => {
    const x = padL + i * barW + barW * 0.2;
    const bw = barW * 0.6;
    const barH = Math.abs(bar.value) / maxAbs * halfH;
    const y = bar.value >= 0 ? zeroY - barH : zeroY;
    const color = bar.value > 0 ? "#34d399" : bar.value < 0 ? "#f87171" : "#3a3b44";
    content += `<rect x="${x}" y="${y}" width="${bw}" height="${Math.max(barH, bar.value === 0 ? 2 : 0)}" fill="${color}" rx="2" />`;
    content += `<text x="${x + bw / 2}" y="${h - 6}" text-anchor="middle" font-size="9.5" fill="#8b8d97">${escapeHtml(bar.label)}</text>`;
  });

  svgEl.innerHTML = content;
}

function renderWeekdayBar(trades) {
  const svg = document.getElementById("weekday-bar-svg");
  const titleEl = document.getElementById("weekday-bar-title");
  const period = document.getElementById("analytics-period")?.value || "all";

  if (period === "year") {
    titleEl.textContent = "PnL by Month";
    const sums = new Array(12).fill(0);
    trades.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date + "T00:00:00");
      sums[d.getMonth()] += t.pnl;
    });
    const bars = MONTH_NAMES_ID.map((name, i) => ({ label: name, value: sums[i] }));
    buildBarChartSVG(svg, bars);
    return;
  }

  titleEl.textContent = "PnL by Weekday";
  const dayNames = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
  const sums = [0, 0, 0, 0, 0, 0, 0];

  trades.forEach(t => {
    if (!t.date) return;
    const d = new Date(t.date + "T00:00:00");
    sums[d.getDay()] += t.pnl;
  });

  const bars = dayNames.map((name, i) => ({ label: name, value: sums[i] }));
  buildBarChartSVG(svg, bars);
}

function renderResultBar(trades) {
  const svg = document.getElementById("result-bar-svg");
  const byResult = {};
  trades.forEach(t => {
    const key = t.result || "No Result";
    byResult[key] = (byResult[key] || 0) + t.pnl;
  });

  const entries = Object.entries(byResult);
  if (entries.length === 0) {
    svg.innerHTML = `<text x="200" y="70" text-anchor="middle" fill="#8b8d97" font-size="12">Belum ada data</text>`;
    return;
  }

  const bars = entries.map(([label, value]) => ({ label, value }));
  buildBarChartSVG(svg, bars);
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

  const tradesByDay = {};
  monthTrades.forEach(t => {
    const day = parseInt(t.date.split("-")[2], 10);
    if (!tradesByDay[day]) tradesByDay[day] = [];
    tradesByDay[day].push(t);
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
    const dayTrades = tradesByDay[day];
    cell.className = "cal-cell";
    const cellDate = new Date(year, month, day);
    cellDate.setHours(0, 0, 0, 0);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const isFuture = cellDate > todayMidnight;
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    if (dayTrades && dayTrades.length) {
      const pnl = dayTrades.reduce((s, t) => s + t.pnl, 0);
      cell.classList.add(pnl >= 0 ? "cal-win" : "cal-loss", "cal-has-data");
      cell.dataset.day = day;
      cell.innerHTML = `
        <span class="cal-day-num">${day}</span>
        <span class="cal-day-pnl">${formatNumCompact(pnl)}</span>
        <span class="cal-day-count">${dayTrades.length} trade${dayTrades.length > 1 ? "s" : ""}</span>
      `;
      cell.addEventListener("click", () => openDayDetail(year, month, day, dayTrades));
    } else if (!isFuture) {
      cell.classList.add("cal-empty-clickable");
      cell.innerHTML = `
        <span class="cal-day-num">${day}</span>
        <span class="cal-day-add">+</span>
      `;
      cell.title = "Tambah trade di tanggal ini";
      cell.addEventListener("click", () => goToTradeLogAndAddTrade(dateStr));
    } else {
      cell.classList.add("cal-future");
      cell.innerHTML = `<span class="cal-day-num">${day}</span>`;
    }

    if (isCurrentMonth && day === today.getDate()) cell.classList.add("cal-today");
    calendarGrid.appendChild(cell);
  }
}

function openDayDetail(year, month, day, dayTrades) {
  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dateLabel = `${day} ${MONTH_NAMES_ID[month]} ${year}`;
  const totalPnl = dayTrades.reduce((s, t) => s + t.pnl, 0);
  const wins = dayTrades.filter(t => t.pnl > 0).length;
  const losses = dayTrades.filter(t => t.pnl < 0).length;

  const itemsHtml = dayTrades.map(t => {
    const pnlClass = t.pnl > 0 ? "pos" : (t.pnl < 0 ? "neg" : "neu");
    const dirClass = t.position === "Buy" ? "dir-buy" : "dir-sell";
    return `
      <div class="day-detail-item" data-id="${t.id}">
        <div class="day-detail-item-left">
          <span class="dir-badge ${dirClass}">${t.position || "-"}</span>
          <span class="day-detail-item-pair">${escapeHtml(t.pair || "-")}</span>
        </div>
        <span class="day-detail-item-pnl ${pnlClass}">${formatNum(t.pnl)}</span>
      </div>
    `;
  }).join("");

  dayDetailContent.innerHTML = `
    <div class="day-detail-header">
      <div>
        <div class="day-detail-date">${dateLabel}</div>
        <div class="day-detail-sub">${dayTrades.length} trade · ${wins} win / ${losses} loss</div>
      </div>
      <div class="day-detail-pnl">
        <div class="day-detail-pnl-label">Total P&L</div>
        <div class="day-detail-pnl-value ${totalPnl > 0 ? 'pos' : totalPnl < 0 ? 'neg' : 'neu'}">${formatMoney(totalPnl)}</div>
      </div>
    </div>
    <div class="day-detail-list">${itemsHtml}</div>
    <button type="button" class="btn btn-ghost day-detail-add-btn" id="day-detail-add-btn">+ Tambah trade lain di hari ini</button>
  `;

  document.getElementById("day-detail-add-btn").addEventListener("click", () => {
    closeDayDetail();
    goToTradeLogAndAddTrade(dateStr);
  });

  dayDetailContent.querySelectorAll(".day-detail-item").forEach(item => {
    item.addEventListener("click", () => {
      const trade = allTrades.find(t => t.id === item.dataset.id);
      if (trade) {
        closeDayDetail();
        openTradeDetail(trade);
      }
    });
  });

  dayDetailOverlay.classList.remove("hidden");
}

function closeDayDetail() {
  dayDetailOverlay.classList.add("hidden");
  dayDetailContent.innerHTML = "";
}

dayDetailOverlay.addEventListener("click", (e) => {
  if (e.target === dayDetailOverlay) closeDayDetail();
});

function renderRecentTrades(accountTrades) {
  const recent = [...accountTrades].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6);

  if (recent.length === 0) {
    recentTradesList.innerHTML = `<div class="recent-empty">Belum ada trade.</div>`;
    return;
  }

  recentTradesList.innerHTML = recent.map(t => {
    const pnlClass = t.pnl > 0 ? "pos" : (t.pnl < 0 ? "neg" : "neu");
    return `
      <div class="recent-item recent-item-clickable" data-id="${t.id}">
        <div class="recent-item-left">
          <span class="recent-item-pair">${escapeHtml(t.pair || "-")}</span>
          <span class="recent-item-date">${t.date || "-"} · ${escapeHtml(t.position || "-")}</span>
        </div>
        <span class="recent-item-pnl ${pnlClass}">${formatNum(t.pnl)}</span>
      </div>
    `;
  }).join("");

  recentTradesList.querySelectorAll(".recent-item-clickable").forEach(item => {
    item.addEventListener("click", () => {
      const trade = allTrades.find(t => t.id === item.dataset.id);
      if (trade) openTradeDetail(trade);
    });
  });
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

// ============================================================
// CUSTOM SMOOTH DROPDOWN (pengganti tampilan <select> bawaan browser)
// ============================================================

function enhanceSelect(select) {
  if (select.dataset.cselEnhanced) return;
  select.dataset.cselEnhanced = "1";

  const wrapper = document.createElement("div");
  wrapper.className = "csel";
  wrapper.dataset.for = select.id || "";

  select.parentNode.insertBefore(wrapper, select);
  wrapper.appendChild(select);
  select.classList.add("csel-native");

  const trigger = document.createElement("div");
  trigger.className = "csel-trigger";
  trigger.innerHTML = `<span class="csel-trigger-label"></span><span class="csel-trigger-arrow"></span>`;
  wrapper.appendChild(trigger);

  const panel = document.createElement("div");
  panel.className = "csel-panel";
  wrapper.appendChild(panel);

  function closePanel() { wrapper.classList.remove("csel-open"); }

  function rebuildPanel() {
    panel.innerHTML = "";
    Array.from(select.options).forEach(opt => {
      const optDiv = document.createElement("div");
      optDiv.className = "csel-option" + (opt.selected ? " csel-selected" : "");
      optDiv.textContent = opt.text;
      optDiv.dataset.value = opt.value;
      optDiv.addEventListener("click", () => {
        select.value = opt.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        closePanel();
        syncTrigger();
      });
      panel.appendChild(optDiv);
    });
  }

  function syncTrigger() {
    const sel = select.options[select.selectedIndex];
    trigger.querySelector(".csel-trigger-label").textContent = sel ? sel.text : "";
    panel.querySelectorAll(".csel-option").forEach(o => {
      o.classList.toggle("csel-selected", o.dataset.value === select.value);
    });
  }

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    document.querySelectorAll(".csel.csel-open").forEach(w => { if (w !== wrapper) w.classList.remove("csel-open"); });
    wrapper.classList.toggle("csel-open");
  });

  document.addEventListener("click", (e) => {
    if (!wrapper.contains(e.target)) closePanel();
  });

  rebuildPanel();
  syncTrigger();

  wrapper._cselRefresh = () => { rebuildPanel(); syncTrigger(); };
}

function refreshCustomSelect(select) {
  const wrapper = select.closest(".csel");
  if (wrapper && wrapper._cselRefresh) wrapper._cselRefresh();
}

document.querySelectorAll("select").forEach(enhanceSelect);
