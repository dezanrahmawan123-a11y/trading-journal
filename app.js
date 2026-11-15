// ============================================================
// JURNAL TRADING - app.js
// Semua logic aplikasi ada di sini. Tidak perlu diedit,
// kecuali lo mau nambah fitur.
// ============================================================

import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, collection, addDoc, updateDoc, deleteDoc,
  doc, setDoc, onSnapshot, query, orderBy, serverTimestamp, deleteField, writeBatch
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
let unsubscribeNews = null;
let allNews = [];
let isAdminUser = false;
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
const authSuccess = document.getElementById("auth-success");
const forgotPasswordBtn = document.getElementById("forgot-password-btn");
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
const goalModalOverlay = document.getElementById("goal-modal-overlay");
const goalModalTitle = document.getElementById("goal-modal-title");
const goalModalError = document.getElementById("goal-modal-error");
const goalForm = document.getElementById("goal-form");
const goalTargetInput = document.getElementById("goal-target-input");
const goalCancelBtn = document.getElementById("goal-cancel-btn");
const goalClearBtn = document.getElementById("goal-clear-btn");
let goalEditingPeriod = null;

// ============================================================
// AUTH
// ============================================================

authToggleBtn.addEventListener("click", () => {
  isRegisterMode = !isRegisterMode;
  authError.classList.add("hidden");
  authSuccess.classList.add("hidden");
  if (isRegisterMode) {
    authTitle.textContent = "Buat akun baru";
    authSub.textContent = "Gratis, data lo tersimpan aman per akun.";
    authSubmitBtn.textContent = "Daftar";
    authToggleText.textContent = "Sudah punya akun?";
    authToggleBtn.textContent = "Masuk";
    document.getElementById("forgot-password-row").classList.add("hidden");
  } else {
    authTitle.textContent = "Masuk ke akun";
    authSub.textContent = "Catat & analisa trade lo di satu tempat.";
    authSubmitBtn.textContent = "Masuk";
    authToggleText.textContent = "Belum punya akun?";
    authToggleBtn.textContent = "Daftar sekarang";
    document.getElementById("forgot-password-row").classList.remove("hidden");
  }
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.classList.add("hidden");
  authSuccess.classList.add("hidden");
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

forgotPasswordBtn.addEventListener("click", async () => {
  authError.classList.add("hidden");
  authSuccess.classList.add("hidden");

  const email = document.getElementById("auth-email").value.trim();
  if (!email) {
    authError.textContent = "Isi dulu email lo di kolom atas, baru klik 'Lupa password?'.";
    authError.classList.remove("hidden");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    authSuccess.textContent = `Link reset password udah dikirim ke ${email}. Cek inbox (atau folder spam) email itu.`;
    authSuccess.classList.remove("hidden");
  } catch (err) {
    authError.textContent = translateFirebaseError(err.code);
    authError.classList.remove("hidden");
  }
});

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
  adminRequestsList.innerHTML = `<div class="admin-request-empty">Lagi ngambil data...</div>`;
  unsubscribeAdminRequests = onSnapshot(
    collection(db, "access_requests"),
    (snapshot) => {
      const allReq = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const ts = (r) => (r.requestedAt?.toMillis ? r.requestedAt.toMillis() : 0);
      allReq.sort((a, b) => ts(b) - ts(a));
      renderAdminRequests(allReq);
    },
    (err) => {
      console.error(err);
      adminRequestsList.innerHTML = `<div class="admin-request-empty">Gagal ambil daftar user (${escapeHtml(err.code || "error")}). Cek Firestore Rules: collection <b>access_requests</b> harus boleh dibaca oleh akun admin.</div>`;
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
      : (r.rejected
        ? `<span class="result-badge result-loss">Ditolak</span>`
        : `<span class="result-badge result-breakeven">Pending</span>`);
    return `
      <div class="admin-request-item">
        <div>
          <div class="admin-request-email">${escapeHtml(r.email || r.id)}</div>
          <div class="admin-request-date">${dateStr}</div>
        </div>
        <div class="admin-request-actions">
          ${statusBadge}
          ${!r.approved ? `<button class="btn-edit" data-action="approve" data-id="${r.id}">Approve</button>` : ""}
          ${!r.rejected ? `<button class="btn-danger" data-action="reject" data-id="${r.id}">Tolak</button>` : ""}
        </div>
      </div>
    `;
  }).join("");

  adminRequestsList.querySelectorAll("[data-action='approve']").forEach(btn => {
    btn.addEventListener("click", async () => {
      await updateDoc(doc(db, "access_requests", btn.dataset.id), { approved: true, rejected: false });
    });
  });
  adminRequestsList.querySelectorAll("[data-action='reject']").forEach(btn => {
    btn.addEventListener("click", async () => {
      if (confirm("Tolak user ini? Mereka gak akan bisa masuk lagi (akun login-nya tetap ada tapi terkunci).")) {
        await updateDoc(doc(db, "access_requests", btn.dataset.id), { approved: false, rejected: true });
      }
    });
  });
}

onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (user) {
    authShell.classList.add("hidden");
    userEmailEl.textContent = user.email;

    isAdminUser = user.uid === ADMIN_UID;

    if (user.uid === ADMIN_UID) {
      pendingShell.classList.add("hidden");
      appShell.classList.remove("hidden");
      adminApprovalBtn.classList.remove("hidden");
      subscribeToAccounts(user.uid);
      subscribeToTrades(user.uid);
      subscribeToNews(user.uid);
    } else {
      adminApprovalBtn.classList.add("hidden");
      unsubscribeAccessRequest = onSnapshot(doc(db, "access_requests", user.uid), (snap) => {
        const approved = snap.exists() && snap.data().approved === true;
        if (!snap.exists()) {
          // Pendaftaran sebelumnya gagal nulis ke Firestore -> bikin ulang biar muncul di daftar admin
          setDoc(doc(db, "access_requests", user.uid), {
            email: user.email,
            approved: false,
            requestedAt: serverTimestamp(),
          }).catch((e) => console.error("Gagal bikin access request:", e));
        }
        if (approved) {
          pendingShell.classList.add("hidden");
          appShell.classList.remove("hidden");
          subscribeToAccounts(user.uid);
          subscribeToTrades(user.uid);
          subscribeToNews(user.uid);
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
    if (unsubscribeNews) unsubscribeNews();
    allTrades = [];
    allAccounts = [];
    currentAccountId = null;
    isAdminUser = false;
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

function switchTab(tab) {
  tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === tab));
  Object.entries(tabContents).forEach(([key, el]) => {
    if (el) el.classList.toggle("hidden", key !== tab);
  });
}

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});

const dashGotoAnalyticsBtn = document.getElementById("dash-goto-analytics-btn");
if (dashGotoAnalyticsBtn) dashGotoAnalyticsBtn.addEventListener("click", () => switchTab("analytics"));

// ============================================================
// HIDE / BLUR P&L
// ============================================================

const PNL_HIDDEN_KEY = "jt_pnl_hidden";

function isPnlHidden() {
  try { return localStorage.getItem(PNL_HIDDEN_KEY) === "1"; } catch { return false; }
}

function applyPnlHiddenState() {
  const hidden = isPnlHidden();
  document.body.classList.toggle("pnl-hidden", hidden);
  document.querySelectorAll(".pnl-toggle-btn").forEach(b => {
    b.textContent = hidden ? "👁 Show P&L" : "🙈 Hide P&L";
  });
}

document.querySelectorAll(".pnl-toggle-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    try { localStorage.setItem(PNL_HIDDEN_KEY, isPnlHidden() ? "0" : "1"); } catch {}
    applyPnlHiddenState();
  });
});

applyPnlHiddenState();

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
    const icon = acc.type === "backtest" ? "🧪 " : "💰 ";
    opt.textContent = icon + acc.name;
    if (acc.id === currentAccountId) opt.selected = true;
    accountSwitcher.appendChild(opt);
  });
  const addOpt = document.createElement("option");
  addOpt.value = "__add__";
  addOpt.textContent = "+ Tambah Akun Baru";
  accountSwitcher.appendChild(addOpt);
  refreshCustomSelect(accountSwitcher);
  updateProfileFab();
  const editBtn = document.getElementById("account-edit-btn");
  if (editBtn) editBtn.classList.toggle("hidden", !getCurrentAccount());
}

function updateProfileFab() {
  const acc = getCurrentAccount();
  if (acc && acc.photo) {
    profileFabBtn.textContent = "";
    profileFabBtn.style.backgroundImage = `url(${acc.photo})`;
    profileFabBtn.classList.add("has-photo");
  } else {
    profileFabBtn.style.backgroundImage = "";
    profileFabBtn.classList.remove("has-photo");
    profileFabBtn.textContent = "👤";
  }
}

// --- foto akun (disimpan sebagai data URL kecil di dokumen akun) ---
let accountEditId = null;     // null = tambah baru, id = edit
let accountPhotoDraft;        // undefined = tidak berubah, null = hapus, string = foto baru

function setAccountPhotoPreview(src) {
  const prev = document.getElementById("account-photo-preview");
  prev.style.backgroundImage = src ? `url(${src})` : "";
  prev.classList.toggle("has-photo", !!src);
  prev.textContent = src ? "" : "👤";
  document.getElementById("account-photo-remove").classList.toggle("hidden", !src);
}

function resizeImageToDataUrl(file, size = 256) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = size;
      const cx = c.getContext("2d");
      const side = Math.min(img.width, img.height);
      cx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    img.src = url;
  });
}

document.getElementById("account-photo-btn").addEventListener("click", () =>
  document.getElementById("account-photo-input").click());
document.getElementById("account-photo-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file) return;
  try {
    accountPhotoDraft = await resizeImageToDataUrl(file);
    setAccountPhotoPreview(accountPhotoDraft);
  } catch {
    accountModalError.textContent = "Gagal baca gambar. Coba file lain.";
    accountModalError.classList.remove("hidden");
  }
});
document.getElementById("account-photo-remove").addEventListener("click", () => {
  accountPhotoDraft = null;
  setAccountPhotoPreview(null);
});

document.getElementById("account-edit-btn").addEventListener("click", () => {
  const acc = getCurrentAccount();
  if (!acc) return;
  document.getElementById("profile-menu").classList.add("hidden");
  openAccountModal(false, acc);
});

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

function openAccountModal(isFirst, editAcc = null) {
  accountForm.reset();
  accountModalError.classList.add("hidden");
  accountCancelBtn.classList.toggle("hidden", isFirst);
  accountEditId = editAcc ? editAcc.id : null;
  accountPhotoDraft = undefined;
  setAccountPhotoPreview(editAcc ? editAcc.photo : null);
  document.getElementById("account-modal-title").textContent = editAcc ? "Edit Akun Trading" : "Tambah Akun Trading";
  accountModalDesc.textContent = editAcc
    ? "Ubah nama, foto, atau modal awal akun ini."
    : isFirst
      ? "Bikin akun trading pertama lo. Bisa nambah akun lain lagi nanti (misal Akun Real & Akun Demo)."
      : "Tambah akun trading baru. Trade akan dicatat terpisah per akun.";

  const type = editAcc ? editAcc.type : "live";
  document.querySelectorAll("#account-type-group .pill").forEach(p => p.classList.remove("active"));
  document.querySelector(`#account-type-group .pill[data-value="${type === "backtest" ? "backtest" : "live"}"]`).classList.add("active");
  const isBt = type === "backtest";
  document.getElementById("account-balance-field").classList.toggle("hidden", isBt);
  document.getElementById("account-balance").required = !isBt;
  if (editAcc) {
    document.getElementById("account-name").value = editAcc.name || "";
    document.getElementById("account-balance").value = isBt ? "" : (editAcc.startingBalance ?? "");
  }
  const delBtn = document.getElementById("account-delete-btn");
  delBtn.classList.toggle("hidden", !editAcc || allAccounts.length <= 1);
  delBtn.textContent = "🗑 Hapus Akun";
  delBtn.dataset.confirm = "";

  accountModalOverlay.classList.remove("hidden");
}

document.querySelectorAll("#account-type-group .pill").forEach(pill => {
  pill.addEventListener("click", () => {
    const isBacktest = pill.dataset.value === "backtest";
    const balanceField = document.getElementById("account-balance-field");
    const balanceInput = document.getElementById("account-balance");
    balanceField.classList.toggle("hidden", isBacktest);
    balanceInput.required = !isBacktest;
    if (isBacktest) balanceInput.value = "";
  });
});

function closeAccountModal() {
  if (isFirstAccountFlow) return;
  accountModalOverlay.classList.add("hidden");
}

accountCancelBtn.addEventListener("click", () => accountModalOverlay.classList.add("hidden"));

accountForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  accountModalError.classList.add("hidden");

  const name = document.getElementById("account-name").value.trim();
  const typePill = document.querySelector("#account-type-group .pill.active");
  const type = typePill ? typePill.dataset.value : "live";
  const balanceRaw = document.getElementById("account-balance").value;
  const balance = type === "backtest" ? 0 : parseFloat(balanceRaw);

  if (!name || (type === "live" && isNaN(balance))) {
    accountModalError.textContent = "Isi nama akun dan modal awal dengan benar.";
    accountModalError.classList.remove("hidden");
    return;
  }

  try {
    if (accountEditId) {
      const upd = { name, type, startingBalance: balance || 0 };
      if (accountPhotoDraft === null) upd.photo = deleteField();
      else if (typeof accountPhotoDraft === "string") upd.photo = accountPhotoDraft;
      await updateDoc(doc(db, "users", currentUser.uid, "accounts", accountEditId), upd);
    } else {
      const data = { name, type, startingBalance: balance || 0, createdAt: serverTimestamp() };
      if (typeof accountPhotoDraft === "string") data.photo = accountPhotoDraft;
      const ref = await addDoc(accountsCollection(currentUser.uid), data);
      currentAccountId = ref.id;
      localStorage.setItem(`journal_account_${currentUser.uid}`, currentAccountId);
    }
    accountModalOverlay.classList.add("hidden");
  } catch (err) {
    accountModalError.textContent = "Gagal menyimpan akun. Coba lagi.";
    accountModalError.classList.remove("hidden");
    console.error(err);
  }
});

document.getElementById("account-delete-btn").addEventListener("click", async (e) => {
  const btn = e.currentTarget;
  if (!accountEditId || allAccounts.length <= 1) return;
  if (btn.dataset.confirm !== "1") {
    const n = allTrades.filter(t => t.accountId === accountEditId).length;
    btn.dataset.confirm = "1";
    btn.textContent = `Yakin? ${n} trade ikut kehapus — klik lagi`;
    return;
  }
  btn.disabled = true;
  try {
    const uid = currentUser.uid;
    const id = accountEditId;
    const trades = allTrades.filter(t => t.accountId === id);
    const refs = [];
    trades.forEach(t => {
      refs.push(doc(db, "users", uid, "trades", t.id));
      if (t.shareId) refs.push(doc(db, "shared_trades", t.shareId));
    });
    refs.push(doc(db, "users", uid, "accounts", id));
    for (let i = 0; i < refs.length; i += 400) {
      const batch = writeBatch(db);
      refs.slice(i, i + 400).forEach(r => batch.delete(r));
      await batch.commit();
    }
    if (currentAccountId === id) {
      currentAccountId = null;
      try { localStorage.removeItem(`journal_account_${uid}`); } catch {}
    }
    accountModalOverlay.classList.add("hidden");
  } catch (err) {
    accountModalError.textContent = "Gagal hapus akun. Coba lagi.";
    accountModalError.classList.remove("hidden");
    console.error(err);
  } finally {
    btn.disabled = false;
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

// ============================================================
// FIRESTORE: NEWS
// ============================================================

function newsCollection(uid) {
  return collection(db, "users", uid, "news");
}

function subscribeToNews(uid) {
  const q = query(newsCollection(uid), orderBy("date", "asc"));
  unsubscribeNews = onSnapshot(q, (snapshot) => {
    allNews = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAll();
  }, (err) => console.error(err));
}

async function saveNews(newsData, newsId) {
  if (newsId) {
    await updateDoc(doc(db, "users", currentUser.uid, "news", newsId), newsData);
  } else {
    await addDoc(newsCollection(currentUser.uid), { ...newsData, createdAt: serverTimestamp() });
  }
}

async function removeNews(newsId) {
  await deleteDoc(doc(db, "users", currentUser.uid, "news", newsId));
}

const newsModalOverlay = document.getElementById("news-modal-overlay");
const newsModalError = document.getElementById("news-modal-error");
const newsForm = document.getElementById("news-form");
const newsCancelBtn = document.getElementById("news-cancel-btn");
const newsDeleteBtn = document.getElementById("news-delete-btn");
const newsAddBtn = document.getElementById("news-add-btn");
const newsFilter = document.getElementById("news-filter");

function openNewsModal(news = null, presetDate = null) {
  newsForm.reset();
  newsModalError.classList.add("hidden");
  document.getElementById("news-id").value = news?.id || "";
  document.getElementById("news-title").value = news?.title || "";
  document.getElementById("news-date").value = news?.date || presetDate || new Date().toISOString().slice(0, 10);
  document.querySelectorAll("#news-impact-group .pill").forEach(p => p.classList.remove("active"));
  const impactPill = document.querySelector(`#news-impact-group .pill[data-value="${news?.impact || "medium"}"]`);
  if (impactPill) impactPill.classList.add("active");
  newsDeleteBtn.classList.toggle("hidden", !news);
  newsModalOverlay.classList.remove("hidden");
}

function closeNewsModal() {
  newsModalOverlay.classList.add("hidden");
}

newsAddBtn.addEventListener("click", () => openNewsModal());
newsCancelBtn.addEventListener("click", closeNewsModal);
newsModalOverlay.addEventListener("click", (e) => { if (e.target === newsModalOverlay) closeNewsModal(); });

newsForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  newsModalError.classList.add("hidden");

  const newsId = document.getElementById("news-id").value || null;
  const title = document.getElementById("news-title").value.trim();
  const date = document.getElementById("news-date").value;
  const impactPill = document.querySelector("#news-impact-group .pill.active");
  const impact = impactPill ? impactPill.dataset.value : "medium";

  if (!title || !date) {
    newsModalError.textContent = "Isi nama event dan tanggalnya.";
    newsModalError.classList.remove("hidden");
    return;
  }

  try {
    await saveNews({ title, date, impact }, newsId);
    closeNewsModal();
  } catch (err) {
    newsModalError.textContent = "Gagal menyimpan. Coba lagi.";
    newsModalError.classList.remove("hidden");
    console.error(err);
  }
});

newsDeleteBtn.addEventListener("click", async () => {
  const newsId = document.getElementById("news-id").value;
  if (newsId && confirm("Hapus news ini?")) {
    await removeNews(newsId);
    closeNewsModal();
  }
});

newsFilter.addEventListener("change", () => renderDashboard(getAccountTrades()));

function getFilteredNews() {
  const level = newsFilter.value;
  if (level === "none") return [];
  if (level === "high") return allNews.filter(n => n.impact === "high");
  if (level === "medium") return allNews.filter(n => n.impact === "medium" || n.impact === "high");
  return allNews;
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
  document.querySelectorAll("#trade-form .pill-group").forEach(group => {
    group.querySelectorAll(".pill").forEach(p => {
      if (!p.dataset.original) p.remove();
      else p.classList.remove("active");
    });
  });
  document.querySelectorAll("#trade-form .pill-add-input").forEach(inp => {
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

  const account = getCurrentAccount();
  const isBacktest = account?.type === "backtest";
  document.getElementById("live-pnl-fields").classList.toggle("hidden", isBacktest);
  document.getElementById("backtest-pnl-fields").classList.toggle("hidden", !isBacktest);
  pnlInput.required = !isBacktest;
  document.getElementById("trade-pnl-r").required = isBacktest;

  if (isBacktest) {
    document.getElementById("trade-pnl-r").value = trade?.pnl ?? "";
  } else {
    pnlInput.value = trade?.pnl ?? "";
    riskInput.value = trade?.risk ?? "";
    updateRRDisplay();
  }

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
  setActivePills("mood-group", trade?.mood ? [trade.mood] : []);

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
  const account = getCurrentAccount();
  const isBacktest = account?.type === "backtest";

  let pnlVal, riskVal, riskRewardStr;

  if (isBacktest) {
    pnlVal = parseFloat(document.getElementById("trade-pnl-r").value);
    if (isNaN(pnlVal)) {
      tradeFormError.textContent = "Isi hasil trade dalam satuan R (contoh: 2 atau -1).";
      tradeFormError.classList.remove("hidden");
      return;
    }
    riskVal = 1;
    riskRewardStr = pnlVal >= 0 ? `1:${pnlVal.toFixed(2)}` : `${pnlVal.toFixed(2)}R`;
  } else {
    pnlVal = parseFloat(pnlInput.value);
    if (isNaN(pnlVal)) {
      tradeFormError.textContent = "Net P/L harus berupa angka.";
      tradeFormError.classList.remove("hidden");
      return;
    }
    riskVal = parseOptionalFloat(riskInput.value);
    riskRewardStr = "";
    if (riskVal && riskVal > 0) {
      riskRewardStr = `1:${(Math.abs(pnlVal) / riskVal).toFixed(2)}`;
    }
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

  const resultValues = getActivePillValues("result-group");
  const moodValues = getActivePillValues("mood-group");

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
    mood: moodValues[0] || "",
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

// ============================================================
// SHARE TRADE (link publik, gak perlu login buat lihat)
// ============================================================

async function handleShareTrade(trade) {
  const btn = document.getElementById("detail-share-btn");
  if (trade.shareId) {
    showShareLinkPanel(trade.shareId);
    return;
  }

  btn.disabled = true;
  btn.textContent = "Membuat link...";

  try {
    const publicData = {
      ownerUid: currentUser.uid,
      pair: trade.pair || "",
      position: trade.position || "",
      date: trade.date || "",
      htfBias: trade.htfBias || [],
      confluence: trade.confluence || [],
      narrative: trade.narrative || "",
      mood: trade.mood || "",
      risk: trade.risk ?? null,
      riskReward: trade.riskReward || "",
      result: trade.result || "",
      pnl: trade.pnl ?? 0,
      htfLinks: trade.htfLinks || (trade.htfLink ? [trade.htfLink] : []),
      ltfLink: trade.ltfLink || "",
      screenshotData: trade.screenshotData || null,
      sharedAt: serverTimestamp(),
    };

    const ref = await addDoc(collection(db, "shared_trades"), publicData);
    await updateDoc(doc(db, "users", currentUser.uid, "trades", trade.id), { shareId: ref.id });
    trade.shareId = ref.id;
    showShareLinkPanel(ref.id);
  } catch (err) {
    alert("Gagal bikin link share. Coba lagi.");
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = "🔗 Share";
  }
}

function showShareLinkPanel(shareId) {
  const panel = document.getElementById("share-link-panel");
  const input = document.getElementById("share-link-input");
  const url = `${window.location.origin}/share.html?id=${shareId}`;
  input.value = url;
  panel.classList.remove("hidden");

  document.getElementById("share-copy-btn").onclick = () => {
    navigator.clipboard.writeText(url).then(() => {
      const copyBtn = document.getElementById("share-copy-btn");
      copyBtn.textContent = "Ke-copy!";
      setTimeout(() => { copyBtn.textContent = "Copy"; }, 1500);
    });
  };

  document.getElementById("share-stop-btn").onclick = async () => {
    if (!confirm("Hentikan share? Link ini bakal berhenti berfungsi.")) return;
    try {
      await deleteDoc(doc(db, "shared_trades", shareId));
      const trade = allTrades.find(t => t.shareId === shareId);
      if (trade) await updateDoc(doc(db, "users", currentUser.uid, "trades", trade.id), { shareId: null });
      panel.classList.add("hidden");
    } catch (err) {
      alert("Gagal hentikan share.");
      console.error(err);
    }
  };
}

// ============================================================
// SHARE CARD (foto/video/gif estetik buat posting ke sosmed)
// ============================================================

const scModalOverlay = document.getElementById("sc-modal-overlay");
const scCloseBtn = document.getElementById("sc-close-btn");
const scCanvas = document.getElementById("sc-canvas");
const scBgFileInput = document.getElementById("sc-bg-file-input");
const scBgUploadBtn = document.getElementById("sc-bg-upload-btn");
const scBgRemoveBtn = document.getElementById("sc-bg-remove-btn");
const scTrimField = document.getElementById("sc-trim-field");
const scTrimStartSlider = document.getElementById("sc-trim-start");
const scTrimEndSlider = document.getElementById("sc-trim-end");
const scTrimLabel = document.getElementById("sc-trim-label");
const scDimSlider = document.getElementById("sc-dim-slider");
const scZoomField = document.getElementById("sc-zoom-field");
const scZoomSlider = document.getElementById("sc-zoom-slider");
const scCenterBtn = document.getElementById("sc-center-btn");
const scSoundField = document.getElementById("sc-sound-field");
const scSoundSlider = document.getElementById("sc-sound-slider");
const scSaveDefaultBtn = document.getElementById("sc-save-default-btn");
const scExportPhotoBtn = document.getElementById("sc-export-photo");
const scExportVideoBtn = document.getElementById("sc-export-video");
const scExportGifBtn = document.getElementById("sc-export-gif");
const scFooterHint = document.getElementById("sc-footer-hint");

const SC_SIZE_PRESETS = {
  landscape: { w: 1000, h: 650 },
  portrait: { w: 700, h: 1000 },
  "16:9": { w: 1000, h: 562 },
  square: { w: 800, h: 800 },
  "4:5": { w: 800, h: 1000 },
};

let scTrade = null;
let scPeriod = "trade";
let scBgType = null; // "image" | "video" | null
let scBgEl = null;
let scBgObjectUrl = null;
let scPos = { x: 0, y: 0 };
let scZoom = 1;
let scDim = 35;
let scTrimStart = 0;
let scTrimEnd = 0;
let scSound = 70;
let scFormat = {
  show: "amount", style: "plain", stats: "plain",
  pnlBorder: "border", corners: "rounded", size: "square", quality: "standard",
};
let scRafId = null;
let scDragging = false;
let scDragStart = null;
let scGifJsLoaded = false;

function loadScFormatDefaults() {
  try {
    const raw = localStorage.getItem("jt_share_card_format");
    if (raw) scFormat = { ...scFormat, ...JSON.parse(raw) };
  } catch (e) { /* ignore */ }
}
loadScFormatDefaults();

function syncScFormatUI() {
  document.querySelectorAll("#sc-panel-format .sc-pill-group").forEach(group => {
    const key = group.dataset.key;
    group.querySelectorAll(".sc-pill").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.value === scFormat[key]);
    });
  });
}

function getScDims() {
  const preset = SC_SIZE_PRESETS[scFormat.size] || SC_SIZE_PRESETS.square;
  const scale = scFormat.quality === "high" ? 2 : 1;
  return { w: preset.w * scale, h: preset.h * scale };
}

function scRoundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function scDrawBackground(ctx, w, h) {
  if (scBgEl && scBgType) {
    const mediaW = scBgType === "image" ? scBgEl.naturalWidth : scBgEl.videoWidth;
    const mediaH = scBgType === "image" ? scBgEl.naturalHeight : scBgEl.videoHeight;
    const ready = scBgType === "image" ? scBgEl.complete : scBgEl.readyState >= 2;
    if (ready && mediaW && mediaH) {
      const scale = Math.max(w / mediaW, h / mediaH) * scZoom;
      const dw = mediaW * scale, dh = mediaH * scale;
      const minX = w - dw, minY = h - dh;
      const dx = Math.min(0, Math.max(minX, (w - dw) / 2 + scPos.x));
      const dy = Math.min(0, Math.max(minY, (h - dh) / 2 + scPos.y));
      ctx.drawImage(scBgEl, dx, dy, dw, dh);
      return;
    }
  }
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, "#1a1a1d");
  grad.addColorStop(1, "#000000");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

function getScSparkSeries(accountTrades) {
  if (scPeriod === "trade" && scTrade) {
    const idx = accountTrades.findIndex(x => x.id === scTrade.id);
    const end = idx >= 0 ? idx + 1 : accountTrades.length;
    const start = Math.max(0, end - 20);
    return accountTrades.slice(start, end).map(x => x.pnl || 0);
  }
  return filterTradesByPeriod(accountTrades, scPeriod).map(x => x.pnl || 0);
}

function getScCardData() {
  const account = getCurrentAccount();
  const isBacktest = account?.type === "backtest";
  const accountTrades = getAccountTrades().slice().sort((a, b) => (a.date < b.date ? -1 : 1));

  if (scPeriod === "trade" && scTrade) {
    const t = scTrade;
    const dirWord = t.position === "Buy" ? "LONG" : (t.position === "Sell" ? "SHORT" : "");
    return {
      isBacktest,
      title: t.pair || "-",
      tag: [dirWord, scFmtDateTag(t.date)].filter(Boolean).join(" · "),
      direction: t.position === "Sell" ? -1 : 1,
      accountName: account?.name || "",
      r: scTradeR(t, isBacktest),
      pnl: t.pnl || 0,
      pct: account?.startingBalance ? ((t.pnl || 0) / account.startingBalance) * 100 : null,
      stats: [
        { label: "Risk", value: isBacktest ? "1R" : (t.risk ? formatMoney(t.risk) : "-") },
        { label: "R:R", value: t.riskReward || "-" },
        { label: "Result", value: t.result || "-" },
      ],
      sparkSeries: getScSparkSeries(accountTrades),
    };
  }

  const periodTrades = filterTradesByPeriod(accountTrades, scPeriod);
  const pnl = periodTrades.reduce((s2, x) => s2 + (x.pnl || 0), 0);
  const wins = periodTrades.filter(x => x.pnl > 0).length;
  const winrate = periodTrades.length ? Math.round((wins / periodTrades.length) * 100) : 0;
  const periodLabel = { day: "Today", week: "This Week", month: "This Month" }[scPeriod] || "";

  return {
    isBacktest,
    title: account?.name || "Jurnal Trading",
    tag: periodLabel.toUpperCase(),
    direction: pnl >= 0 ? 1 : -1,
    accountName: "",
    r: (() => { const rs = periodTrades.map(x => scTradeR(x, isBacktest)).filter(v => v !== null); return rs.length ? rs.reduce((a, b) => a + b, 0) : null; })(),
    pnl,
    pct: account?.startingBalance ? (pnl / account.startingBalance) * 100 : null,
    stats: [
      { label: "Trades", value: String(periodTrades.length) },
      { label: "Win rate", value: `${winrate}%` },
      { label: "Period", value: periodLabel },
    ],
    sparkSeries: periodTrades.map(x => x.pnl || 0),
  };
}

function scFormatValue(data) {
  if (data.isBacktest) return formatPnl(data.pnl, true);
  if (scFormat.show === "r" && data.r !== null && data.r !== undefined) return scFmtUnit(data.r, "r");
  if (scFormat.show === "percent" && data.pct !== null && data.pct !== undefined) {
    const sign = data.pct > 0 ? "+" : "";
    return `${sign}${data.pct.toFixed(2)}%`;
  }
  return formatPnl(data.pnl, false);
}

function scDrawSparkline(ctx, x, y, w, h, series, s) {
  const pts = (!series || series.length < 2) ? [0, 0] : (() => {
    let cum = 0;
    return series.map(v => (cum += v));
  })();
  const min = Math.min(0, ...pts);
  const max = Math.max(0, ...pts);
  const range = (max - min) || 1;
  const stepX = w / (pts.length - 1 || 1);
  const pathPoints = pts.map((v, i) => ({ x: x + i * stepX, y: y + h - ((v - min) / range) * h }));

  ctx.beginPath();
  pathPoints.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x, y + h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, "rgba(255,255,255,0.22)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  pathPoints.forEach((p, i) => { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 2.4 * s;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();
}

function scDrawStatsRow(ctx, x, y, w, h, stats, s) {
  const n = stats.length || 1;
  const itemW = w / n;
  stats.forEach((item, i) => {
    const cx = x + itemW * i + itemW / 2;
    if (scFormat.stats === "boxed") {
      const boxW = itemW - 10 * s;
      const boxX = cx - boxW / 2;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      scRoundRectPath(ctx, boxX, y, boxW, h, 9 * s);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.14)";
      ctx.lineWidth = 1 * s;
      scRoundRectPath(ctx, boxX, y, boxW, h, 9 * s);
      ctx.stroke();
    }
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `700 ${9 * s}px Inter, sans-serif`;
    ctx.fillText(String(item.label).toUpperCase(), cx, y + h * 0.4);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${13 * s}px 'JetBrains Mono', monospace`;
    ctx.fillText(String(item.value), cx, y + h * 0.8);
  });
  ctx.textAlign = "left";
}

// ---- Layout per ukuran: tiap size punya komposisi sendiri ----
// align "left"  : ticker, P&L, stats rata kiri, chart (kalau aktif) di kanan
// align "center": semua rata tengah, posisi vertikal beda tiap ukuran
const SC_LAYOUTS = {
  landscape: { align: "left",   tickerY: 0.15, pnlY: 0.42, statsY: 0.53, footY: 0.89, pnlFrac: 0.36 },
  "16:9":    { align: "left",   tickerY: 0.18, pnlY: 0.42, statsY: 0.52, footY: 0.87, pnlFrac: 0.34 },
  portrait:  { align: "center", tickerY: 0.12, pnlY: 0.63, statsY: 0.69, footY: 0.92, pnlFrac: 0.66 },
  square:    { align: "center", tickerY: 0.15, pnlY: 0.69, statsY: 0.75, footY: 0.93, pnlFrac: 0.50 },
  "4:5":     { align: "center", tickerY: 0.30, pnlY: 0.66, statsY: 0.72, footY: 0.92, pnlFrac: 0.54 },
};

const SC_MONTHS = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];

function scFmtDateTag(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d.getTime())) return "";
  return `${SC_MONTHS[d.getMonth()]} ${d.getDate()}`;
}

function scTruncate(ctx, text, maxW) {
  let t = String(text);
  if (ctx.measureText(t).width <= maxW) return t;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

function scFitPnlFont(ctx, text, targetW, maxW) {
  ctx.font = `800 100px Manrope, sans-serif`;
  const wAt100 = ctx.measureText(text).width || 1;
  const byTarget = (targetW / wAt100) * 100;
  const byMax = (maxW / wAt100) * 100;
  return Math.min(byTarget, byMax);
}

function scDrawTicker(ctx, data, s, x, cy, align, maxW) {
  ctx.textBaseline = "middle";
  const tagText = data.tag || "";
  ctx.font = `700 ${12 * s}px Inter, sans-serif`;
  const tagW = tagText ? ctx.measureText(tagText).width : 0;
  const gap = tagText ? 10 * s : 0;
  ctx.font = `800 ${26 * s}px Manrope, sans-serif`;
  const title = scTruncate(ctx, data.title, Math.max(60 * s, maxW - gap - tagW));
  const titleW = ctx.measureText(title).width;

  const total = titleW + gap + tagW;
  const startX = align === "center" ? x - total / 2 : x;

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.fillText(title, startX, cy);
  if (tagText) {
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `700 ${12 * s}px Inter, sans-serif`;
    ctx.fillText(tagText, startX + titleW + gap, cy + 1 * s);
  }
}

function scDrawPnlText(ctx, text, x, y, px, align) {
  const qs = scFormat.quality === "high" ? 2 : 1;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.font = `800 ${px}px Manrope, sans-serif`;
  ctx.fillStyle = "#ffffff";
  if (scFormat.pnlBorder === "border") {
    ctx.save();
    ctx.shadowColor = "rgba(255,255,255,0.7)";
    ctx.shadowBlur = px * 0.3 * qs;
    ctx.fillText(text, x, y);
    ctx.restore();
    ctx.save();
    ctx.shadowColor = "rgba(255,255,255,0.35)";
    ctx.shadowBlur = px * 0.1 * qs;
    ctx.fillText(text, x, y);
    ctx.restore();
  } else {
    ctx.fillText(text, x, y);
  }
  ctx.textAlign = "left";
}

function scDrawStatsRows(ctx, anchorX, topY, stats, s, align) {
  const rowH = 31 * s;
  const labelX = align === "center" ? anchorX - 96 * s : anchorX;
  const valueX = align === "center" ? anchorX + 44 * s : anchorX + 96 * s;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  stats.forEach((item, i) => {
    const y = topY + 16 * s + i * rowH;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `600 ${14 * s}px Inter, sans-serif`;
    ctx.fillText(String(item.label), labelX, y);
    ctx.fillStyle = "#ffffff";
    ctx.font = `700 ${15 * s}px Inter, sans-serif`;
    ctx.fillText(scTruncate(ctx, item.value, 110 * s), valueX, y);
  });
}

function scDrawFooter(ctx, data, w, h, s, L, padX) {
  const y = L.footY * h;
  const left = L.align === "left";
  const label = { trade: "Trade Recap", day: "Daily Recap", week: "Weekly Recap", month: "Monthly Recap", year: "Yearly Recap" }[scPeriod] || "Trade Recap";
  ctx.textBaseline = "middle";
  ctx.textAlign = left ? "left" : "center";
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.font = `700 ${14.5 * s}px Manrope, sans-serif`;
  ctx.fillText(label, left ? padX : w / 2, y);
  ctx.textAlign = "left";
}

// ---- Weekly recap (layout khusus tab Weekly) ----
const SC_DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

function scMonthName(m) {
  const n = SC_MONTHS[m] || "";
  return n.charAt(0) + n.slice(1).toLowerCase();
}

function scLocalDateStr(d) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// R per trade: akun backtest -> pnl sudah dalam R; akun live -> pnl dibagi risk ($) kalau risk diisi
function scTradeR(t, isBacktest) {
  if (isBacktest) return t.pnl || 0;
  const risk = Number(t.risk);
  return risk > 0 ? (t.pnl || 0) / risk : null;
}

function scFmtUnit(v, unit) {
  const sign = v > 0 ? "+" : "";
  if (unit === "r") return `${sign}${v.toFixed(2)}R`;
  if (unit === "pct") return `${sign}${v.toFixed(2)}%`;
  return `${sign}${formatMoney(v)}`;
}

const SC_PERIOD_META = {
  week:  { word: "day",   title: "DAILY RESULT",   net: "NET THIS WEEK",  sub: "Weekly recap" },
  month: { word: "week",  title: "WEEKLY RESULT",  net: "NET THIS MONTH", sub: "Monthly recap" },
  year:  { word: "month", title: "MONTHLY RESULT", net: "NET THIS YEAR",  sub: "Yearly recap" },
};
const scOffsets = { week: 0, month: 0, year: 0 };
function scIsRecap() { return scPeriod === "week" || scPeriod === "month" || scPeriod === "year"; }

function getScWeekData() {
  const period = scIsRecap() ? scPeriod : "week";
  const meta = SC_PERIOD_META[period];
  const offset = scOffsets[period];
  const account = getCurrentAccount();
  const isBacktest = account?.type === "backtest";
  const startBal = account?.startingBalance || 0;
  const unit = (isBacktest || scFormat.show === "r") ? "r"
    : (scFormat.show === "percent" && startBal > 0 ? "pct" : "usd");
  const trades = getAccountTrades();
  const now = new Date();
  const p2 = (n) => String(n).padStart(2, "0");

  let buckets = [];
  let range = "";
  let matchBucket;

  if (period === "week") {
    const base = new Date();
    base.setDate(base.getDate() + offset * 7);
    const { monday } = getCurrentWeekRange(base);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      buckets.push({ key: scLocalDateStr(d), pnl: 0, r: 0, count: 0, label: SC_DAY_LABELS[i],
        dateLabel: `${scMonthName(d.getMonth())} ${d.getDate()}`, date: d });
    }
    matchBucket = (t) => buckets.find(x => x.key === t.date);
  } else if (period === "month") {
    const ref = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const y = ref.getFullYear(), m = ref.getMonth();
    const last = new Date(y, m + 1, 0).getDate();
    const edges = [[1, 7], [8, 14], [15, 21], [22, last]];
    edges.forEach(([a1, b1], i) => {
      buckets.push({ from: a1, to: b1, pnl: 0, r: 0, count: 0, label: `WEEK ${i + 1}`,
        dateLabel: `${scMonthName(m)} ${a1}–${b1}` });
    });
    const prefix = `${y}-${p2(m + 1)}-`;
    matchBucket = (t) => {
      if (!t.date || !t.date.startsWith(prefix)) return null;
      const day = Number(t.date.slice(8, 10));
      return buckets.find(x => day >= x.from && day <= x.to);
    };
    range = `${scMonthName(m)} ${y}`;
  } else {
    const y = now.getFullYear() + offset;
    for (let i = 0; i < 12; i++) {
      buckets.push({ month: i, pnl: 0, r: 0, count: 0, label: SC_MONTHS[i], dateLabel: "" });
    }
    matchBucket = (t) => {
      if (!t.date || !t.date.startsWith(`${y}-`)) return null;
      return buckets[Number(t.date.slice(5, 7)) - 1];
    };
    range = String(y);
  }

  trades.forEach(t => {
    const b = matchBucket(t);
    if (!b) return;
    b.count++;
    b.pnl += t.pnl || 0;
    const r = scTradeR(t, isBacktest);
    if (r !== null) b.r += r;
  });

  if (period === "week") {
    const hasWeekend = buckets[5].count > 0 || buckets[6].count > 0;
    buckets = buckets.slice(0, hasWeekend ? 7 : 5);
  }
  const days = buckets.map(b => ({
    ...b,
    value: unit === "r" ? b.r : (unit === "pct" ? (b.pnl / startBal) * 100 : b.pnl),
  }));

  const traded = days.filter(x => x.count > 0);
  const total = days.reduce((s2, x) => s2 + x.value, 0);
  const green = traded.filter(x => x.value > 0).length;
  const avg = traded.length ? total / traded.length : 0;
  const best = traded.length ? Math.max(...traded.map(x => x.value)) : 0;
  const tradeCount = days.reduce((s2, x) => s2 + x.count, 0);
  let cum = 0;
  const cumSeries = [0];
  days.forEach(x => { if (x.count > 0) { cum += x.value; cumSeries.push(cum); } });

  if (period === "week") {
    const first = days[0].date, last = days[days.length - 1].date;
    range = first.getMonth() === last.getMonth()
      ? `${scMonthName(first.getMonth())} ${first.getDate()}–${last.getDate()}`
      : `${scMonthName(first.getMonth())} ${first.getDate()} – ${scMonthName(last.getMonth())} ${last.getDate()}`;
  }

  return {
    unit, period, meta, name: account?.name || "Jurnal Trading", days, sessions: traded.length,
    tradeCount, green, total, avg, best, cumSeries, range,
  };
}

function scPanel(ctx, x, y, w, h, r) {
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  scRoundRectPath(ctx, x, y, w, h, r);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1.5;
  scRoundRectPath(ctx, x, y, w, h, r);
  ctx.stroke();
}

let scPhotoCache = { src: null, img: null };
function scAccountPhoto() {
  const src = getCurrentAccount()?.photo || null;
  if (!src) return null;
  if (scPhotoCache.src !== src) {
    const img = new Image();
    img.onload = () => { if (scPhotoCache.img === img) drawScCard(); };
    img.src = src;
    scPhotoCache = { src, img };
  }
  return scPhotoCache.img.complete && scPhotoCache.img.naturalWidth ? scPhotoCache.img : null;
}

function scWkHeader(ctx, d, x, y, w) {
  ctx.textBaseline = "alphabetic";
  ctx.beginPath();
  ctx.arc(x + 30, y + 30, 30, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();
  const photo = scAccountPhoto();
  if (photo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + 30, y + 30, 30, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(photo, x, y, 60, 60);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(x + 30, y + 30, 30, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = `800 26px Manrope, sans-serif`;
    ctx.fillText((d.name.trim().charAt(0) || "J").toUpperCase(), x + 30, y + 39);
  }

  ctx.textAlign = "center";
  ctx.font = `700 17px Inter, sans-serif`;
  const pillText = d.range.toUpperCase();
  const pillW = ctx.measureText(pillText).width + 44;
  const pillX = x + w - pillW;
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  scRoundRectPath(ctx, pillX, y + 8, pillW, 44, 22);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(pillText, pillX + pillW / 2, y + 36);

  ctx.textAlign = "left";
  ctx.font = `800 30px Manrope, sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(scTruncate(ctx, d.name, w - 76 - pillW - 16), x + 76, y + 30);
  ctx.font = `600 20px Inter, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.fillText(d.meta.sub, x + 76, y + 58);
}

function scWkSegments(ctx, d, x, y, w) {
  const n = d.days.length;
  const gap = 14;
  const segW = (w - gap * (n - 1)) / n;
  d.days.forEach((day, i) => {
    ctx.fillStyle = day.count > 0 ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.22)";
    scRoundRectPath(ctx, x + i * (segW + gap), y, segW, 7, 3.5);
    ctx.fill();
  });
}

function scWkNet(ctx, d, x, y, w, maxPx) {
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.beginPath();
  ctx.moveTo(x + 7, y + 4); ctx.lineTo(x + 14, y + 11); ctx.lineTo(x + 7, y + 18); ctx.lineTo(x, y + 11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = `800 20px Inter, sans-serif`;
  ctx.fillText(d.meta.net, x + 28, y + 19);

  const text = scFmtUnit(d.total, d.unit);
  const px = Math.min(scFitPnlFont(ctx, text, w * 0.92, w), maxPx);
  const baseline = y + 40 + px * 0.82;
  scDrawPnlText(ctx, text, x, baseline, px, "left");
  return baseline;
}

function scWkChips(ctx, d, x, y) {
  const chips = [
    { text: `${d.green} green ${d.meta.word}${d.green === 1 ? "" : "s"}`, strong: true },
    d.period === "week"
      ? { text: `${d.sessions} session${d.sessions === 1 ? "" : "s"}`, strong: false }
      : { text: `${d.tradeCount} trade${d.tradeCount === 1 ? "" : "s"}`, strong: false },
  ];
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "left";
  let cx = x;
  chips.forEach(c => {
    ctx.font = `700 18px Inter, sans-serif`;
    const cw = ctx.measureText(c.text).width + 36;
    ctx.fillStyle = c.strong ? "rgba(255,255,255,0.22)" : "rgba(255,255,255,0.11)";
    scRoundRectPath(ctx, cx, y, cw, 38, 19);
    ctx.fill();
    ctx.fillStyle = c.strong ? "#ffffff" : "rgba(255,255,255,0.7)";
    ctx.fillText(c.text, cx + 18, y + 25);
    cx += cw + 12;
  });
}

function scWkStatBoxes(ctx, d, x, y, w, h) {
  const items = [
    { value: `${d.green} / ${d.sessions}`, label: `green ${d.meta.word}s` },
    { value: d.sessions ? scFmtUnit(d.avg, d.unit) : "–", label: `avg per ${d.meta.word}` },
    { value: d.sessions ? scFmtUnit(d.best, d.unit) : "–", label: `best ${d.meta.word}` },
  ];
  const gap = 14;
  const bw = (w - gap * 2) / 3;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  items.forEach((it, i) => {
    const bx = x + i * (bw + gap);
    scPanel(ctx, bx, y, bw, h, 18);
    let px = 30;
    ctx.font = `800 ${px}px Manrope, sans-serif`;
    while (ctx.measureText(it.value).width > bw - 20 && px > 14) {
      px -= 1;
      ctx.font = `800 ${px}px Manrope, sans-serif`;
    }
    ctx.fillStyle = "#ffffff";
    ctx.fillText(it.value, bx + bw / 2, y + h * 0.48);
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.font = `600 17px Inter, sans-serif`;
    ctx.fillText(it.label, bx + bw / 2, y + h * 0.78);
  });
  ctx.textAlign = "left";
}

function scWkDaily(ctx, d, x, y, w, rowH) {
  const f = Math.max(0.45, Math.min(1, rowH / 62));
  const headH = 56 * (f < 1 ? 1 : 1.1);
  const panelH = headH + d.days.length * rowH + 14;
  scPanel(ctx, x, y, w, panelH, 24);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `800 17px Inter, sans-serif`;
  ctx.fillText(d.meta.title, x + 32, y + 36);

  const maxAbs = Math.max(1e-9, ...d.days.map(day => Math.abs(day.value)));
  const labelCol = d.period === "week" ? 150 : (d.period === "month" ? 190 : 110);
  const trackX = x + labelCol * f + 10;
  const trackW = w - (labelCol * f + 10) - 130 * f - 28;
  const barH = 26 * f;

  d.days.forEach((day, i) => {
    const ry = y + headH + i * rowH;
    const midY = ry + rowH / 2;
    ctx.textAlign = "left";
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${24 * f}px Manrope, sans-serif`;
    if (day.dateLabel) {
      ctx.fillText(day.label, x + 32, midY - 2 * f);
      ctx.fillStyle = "rgba(255,255,255,0.55)";
      ctx.font = `600 ${16 * f}px Inter, sans-serif`;
      ctx.fillText(day.dateLabel, x + 32, midY + 18 * f);
    } else {
      ctx.fillText(day.label, x + 32, midY + 8 * f);
    }

    if (day.count > 0) {
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      scRoundRectPath(ctx, trackX, midY - barH / 2, trackW, barH, barH / 2);
      ctx.fill();
      const len = Math.max(barH, (Math.abs(day.value) / maxAbs) * trackW);
      if (day.value >= 0) {
        const g = ctx.createLinearGradient(trackX, 0, trackX + len, 0);
        g.addColorStop(0, "rgba(255,255,255,0.55)");
        g.addColorStop(1, "rgba(255,255,255,0.98)");
        ctx.fillStyle = g;
      } else {
        ctx.fillStyle = "rgba(255,255,255,0.32)";
      }
      scRoundRectPath(ctx, trackX, midY - barH / 2, len, barH, barH / 2);
      ctx.fill();
    } else {
      ctx.setLineDash([8, 7]);
      ctx.strokeStyle = "rgba(255,255,255,0.28)";
      ctx.lineWidth = 1.6;
      scRoundRectPath(ctx, trackX, midY - barH / 2, trackW, barH, barH / 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.textAlign = "right";
    ctx.fillStyle = day.count > 0 ? "#ffffff" : "rgba(255,255,255,0.4)";
    ctx.font = `800 ${21 * f}px Manrope, sans-serif`;
    ctx.fillText(day.count > 0 ? scFmtUnit(day.value, d.unit) : "–", x + w - 32, midY + 7 * f);
  });
  ctx.textAlign = "left";
  return panelH;
}

function scWkCumulative(ctx, d, x, y, w, h) {
  scPanel(ctx, x, y, w, h, 24);
  const title = d.unit === "r" ? "CUMULATIVE R" : (d.unit === "pct" ? "CUMULATIVE %" : "CUMULATIVE P&L");
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `800 17px Inter, sans-serif`;
  ctx.fillText(title, x + 32, y + 36);

  const cx0 = x + 44, cx1 = x + w - 44;
  const cy0 = y + 70, cy1 = y + h - 34;
  const series = d.cumSeries;
  const min = Math.min(0, ...series), max = Math.max(0, ...series);
  const range = (max - min) || 1;
  const pts = series.map((v, i) => ({
    x: series.length === 1 ? cx0 : cx0 + (i * (cx1 - cx0)) / (series.length - 1),
    y: series.length === 1 || max === min ? (cy0 + cy1) / 2 : cy1 - ((v - min) / range) * (cy1 - cy0),
  }));
  if (pts.length === 1) pts.push({ x: cx1, y: pts[0].y });

  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.lineTo(pts[pts.length - 1].x, cy1);
  ctx.lineTo(pts[0].x, cy1);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, cy0, 0, cy1);
  g.addColorStop(0, "rgba(255,255,255,0.26)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fill();

  ctx.beginPath();
  pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  [pts[0], pts[pts.length - 1]].forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 3.5;
    ctx.stroke();
  });
}

function scDrawWeekRecap(ctx, w, h) {
  const d = getScWeekData();
  const n = d.days.length;
  const tall = h / w >= 1.15;
  ctx.textAlign = "left";

  if (tall) {
    const W = 800, pad = 44, cw = W - pad * 2;
    const segY = 130, netY = 171, chipsY = 343, boxesY = 405, dailyY = 525;
    const rowT = n > 7 ? 44 : 62;
    const dailyH = 62 + n * rowT + 18;
    const cumY = dailyY + dailyH + 22, cumH = n > 7 ? 200 : 230;
    const footY = cumY + cumH + 44;
    const Hc = footY + 36;
    const k = Math.min(w / W, h / Hc);
    ctx.save();
    ctx.translate((w - W * k) / 2, (h - Hc * k) / 2);
    ctx.scale(k, k);
    scWkHeader(ctx, d, pad, 44, cw);
    scWkSegments(ctx, d, pad, segY, cw);
    scWkNet(ctx, d, pad, netY, cw, 124);
    scWkChips(ctx, d, pad, chipsY);
    scWkStatBoxes(ctx, d, pad, boxesY, cw, 96);
    scWkDaily(ctx, d, pad, dailyY, cw, rowT);
    scWkCumulative(ctx, d, pad, cumY, cw, cumH);
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.font = `700 20px Inter, sans-serif`;
    ctx.fillText(d.range, pad + 6, footY);
    ctx.restore();
    return;
  }

  const W = 1000, lx = 44, lw = 430, rx = 506, rw = 450;
  const rowH = n > 7 ? 30 : (n <= 5 ? 48 : 40);
  const dailyH = 56 + n * rowH + 14;
  const cumY = 44 + dailyH + 18, cumH = n > 7 ? 170 : 200;
  const rightBottom = cumY + cumH;
  const footY = Math.max(527, rightBottom - 10);
  const Hc = footY + 44;
  const k = Math.min(w / W, h / Hc);
  ctx.save();
  ctx.translate((w - W * k) / 2, (h - Hc * k) / 2);
  ctx.scale(k, k);
  scWkHeader(ctx, d, lx, 44, lw);
  scWkSegments(ctx, d, lx, 130, lw);
  scWkNet(ctx, d, lx, 171, lw, 96);
  scWkChips(ctx, d, lx, 323);
  scWkStatBoxes(ctx, d, lx, 385, lw, 92);
  scWkDaily(ctx, d, rx, 44, rw, rowH);
  scWkCumulative(ctx, d, rx, cumY, rw, cumH);
  ctx.textAlign = "left";
  ctx.fillStyle = "rgba(255,255,255,0.6)";
  ctx.font = `700 20px Inter, sans-serif`;
  ctx.fillText(d.range, lx + 6, footY);
  ctx.restore();
}

function scDrawCardContent(ctx, w, h, s) {
  if (scIsRecap()) { scDrawWeekRecap(ctx, w, h); return; }
  const data = getScCardData();
  const L = SC_LAYOUTS[scFormat.size] || SC_LAYOUTS.square;
  const left = L.align === "left";
  const padX = (left ? 0.075 : 0.07) * w;
  const anchorX = left ? padX : w / 2;
  const sparkOn = scFormat.style === "line";

  // ---- ticker ----
  scDrawTicker(ctx, data, s, anchorX, L.tickerY * h, left ? "left" : "center", w - padX * 2);

  // ---- P&L (ukuran font nyesuaiin lebar target tiap layout) ----
  const pnlText = scFormatValue(data);
  const maxPnlW = left && sparkOn ? w * 0.5 - padX : w - padX * 2;
  const pnlPx = Math.min(scFitPnlFont(ctx, pnlText, L.pnlFrac * w, maxPnlW), 120 * s);
  const baseline = L.pnlY * h;
  scDrawPnlText(ctx, pnlText, anchorX, baseline, pnlPx, left ? "left" : "center");

  // ---- sparkline (opsional: Style = Line on top) ----
  if (sparkOn) {
    if (left) {
      const sx = w * 0.56;
      scDrawSparkline(ctx, sx, h * 0.27, w - padX - sx, h * 0.32, data.sparkSeries, s);
    } else {
      const pnlTop = baseline - pnlPx * 0.74;
      const minTop = L.tickerY * h + 36 * s;
      const sparkH = Math.min(90 * s, pnlTop - 22 * s - minTop);
      if (sparkH > 28 * s) {
        scDrawSparkline(ctx, padX, pnlTop - 22 * s - sparkH, w - padX * 2, sparkH, data.sparkSeries, s);
      }
    }
  }

  // ---- stats ----
  const statsTop = L.statsY * h;
  if (scFormat.stats === "boxed") {
    const boxH = 52 * s;
    const bw = left ? Math.min(w - padX * 2, sparkOn ? w * 0.5 - padX : 420 * s) : Math.min(w - padX * 2, 520 * s);
    const bx = left ? padX : w / 2 - bw / 2;
    scDrawStatsRow(ctx, bx, statsTop, bw, boxH, data.stats, s);
  } else {
    scDrawStatsRows(ctx, anchorX, statsTop, data.stats, s, left ? "left" : "center");
  }

  // ---- footer ----
  scDrawFooter(ctx, data, w, h, s, L, padX);
}

function drawScCard() {
  if (!scCanvas) return;
  const dims = getScDims();
  if (scCanvas.width !== dims.w) scCanvas.width = dims.w;
  if (scCanvas.height !== dims.h) scCanvas.height = dims.h;

  const qualityScale = scFormat.quality === "high" ? 2 : 1;
  const w = dims.w / qualityScale;
  const h = dims.h / qualityScale;
  const s = w / 800;

  const ctx = scCanvas.getContext("2d");
  ctx.clearRect(0, 0, dims.w, dims.h);
  ctx.save();
  ctx.scale(qualityScale, qualityScale);

  const radius = scFormat.corners === "rounded" ? Math.round(Math.min(w, h) * 0.045) : 0;
  scRoundRectPath(ctx, 0, 0, w, h, radius);
  ctx.clip();

  scDrawBackground(ctx, w, h);
  ctx.fillStyle = `rgba(0,0,0,${scDim / 100})`;
  ctx.fillRect(0, 0, w, h);

  scDrawCardContent(ctx, w, h, s);

  ctx.restore();
}

function applyScSoundToVideo() {
  if (scBgEl && scBgType === "video") {
    scBgEl.volume = scSound / 100;
    scBgEl.muted = scSound === 0;
  }
}

function updateScTrimLabel() {
  scTrimLabel.textContent = `${scTrimStart.toFixed(1)}s – ${scTrimEnd.toFixed(1)}s`;
}

function updateScTrimUI() {
  scTrimStartSlider.value = 0;
  scTrimEndSlider.value = 1000;
  updateScTrimLabel();
}

function updateScAdjustFieldsVisibility() {
  const isVideo = scBgType === "video";
  scTrimField.classList.toggle("hidden", !isVideo);
  scSoundField.classList.toggle("hidden", !isVideo);
  scZoomField.classList.toggle("hidden", !scBgType);
}

function updateScExportAvailability() {
  const isVideo = scBgType === "video";
  const canMedia = typeof scCanvas.captureStream === "function";
  scExportVideoBtn.disabled = !(isVideo && canMedia);
  scExportGifBtn.disabled = !isVideo;
  scExportVideoBtn.title = isVideo ? "" : "Perlu background video buat export video";
  scExportGifBtn.title = isVideo ? "" : "Perlu background video buat export GIF";
}

function stopScVideoLoop() {
  if (scRafId) { cancelAnimationFrame(scRafId); scRafId = null; }
  if (scBgEl && scBgType === "video") { try { scBgEl.pause(); } catch (e) {} }
}

function startScVideoPreviewLoop() {
  if (!scBgEl || scBgType !== "video") return;
  scBgEl.play().catch(() => {});
  const loop = () => {
    if (scBgType !== "video" || !scBgEl) return;
    if (scBgEl.currentTime >= scTrimEnd || scBgEl.currentTime < scTrimStart) {
      scBgEl.currentTime = scTrimStart;
    }
    drawScCard();
    scRafId = requestAnimationFrame(loop);
  };
  scRafId = requestAnimationFrame(loop);
}

function loadScBackground(file) {
  stopScVideoLoop();
  if (scBgObjectUrl) { URL.revokeObjectURL(scBgObjectUrl); scBgObjectUrl = null; }
  scPos = { x: 0, y: 0 };
  scZoom = 1;
  if (scZoomSlider) scZoomSlider.value = 100;
  const url = URL.createObjectURL(file);
  scBgObjectUrl = url;

  if (file.type.startsWith("video/")) {
    scBgType = "video";
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.playsInline = true;
    video.loop = true;
    scBgEl = video;
    video.addEventListener("loadedmetadata", () => {
      scTrimStart = 0;
      scTrimEnd = video.duration || 0;
      updateScTrimUI();
      applyScSoundToVideo();
      video.currentTime = scTrimStart;
      startScVideoPreviewLoop();
      updateScAdjustFieldsVisibility();
      updateScExportAvailability();
    }, { once: true });
  } else {
    scBgType = "image";
    const img = new Image();
    img.onload = () => {
      scBgEl = img;
      updateScAdjustFieldsVisibility();
      updateScExportAvailability();
      drawScCard();
    };
    img.src = url;
  }

  scBgRemoveBtn.classList.remove("hidden");
}

function removeScBackground() {
  stopScVideoLoop();
  scBgType = null;
  scBgEl = null;
  if (scBgObjectUrl) { URL.revokeObjectURL(scBgObjectUrl); scBgObjectUrl = null; }
  scPos = { x: 0, y: 0 };
  scZoom = 1;
  if (scZoomSlider) scZoomSlider.value = 100;
  scBgRemoveBtn.classList.add("hidden");
  updateScAdjustFieldsVisibility();
  updateScExportAvailability();
  drawScCard();
}

function scGetPointerXY(e) {
  const rect = scCanvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;
  const scaleX = scCanvas.width / rect.width;
  const scaleY = scCanvas.height / rect.height;
  return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

scCanvas.addEventListener("mousedown", (e) => {
  scDragging = true;
  const p = scGetPointerXY(e);
  scDragStart = { x: p.x, y: p.y, origX: scPos.x, origY: scPos.y };
});
window.addEventListener("mousemove", (e) => {
  if (!scDragging) return;
  const p = scGetPointerXY(e);
  scPos.x = scDragStart.origX + (p.x - scDragStart.x);
  scPos.y = scDragStart.origY + (p.y - scDragStart.y);
  if (scBgType !== "video") drawScCard();
});
window.addEventListener("mouseup", () => { scDragging = false; });
scCanvas.addEventListener("touchstart", (e) => {
  if (e.touches.length > 1) return;
  scDragging = true;
  const p = scGetPointerXY(e);
  scDragStart = { x: p.x, y: p.y, origX: scPos.x, origY: scPos.y };
}, { passive: true });
scCanvas.addEventListener("touchmove", (e) => {
  if (!scDragging || e.touches.length > 1) return;
  const p = scGetPointerXY(e);
  scPos.x = scDragStart.origX + (p.x - scDragStart.x);
  scPos.y = scDragStart.origY + (p.y - scDragStart.y);
  if (scBgType !== "video") drawScCard();
}, { passive: true });
scCanvas.addEventListener("touchend", () => { scDragging = false; });

function setScZoom(z) {
  scZoom = Math.min(4, Math.max(1, z));
  scZoomSlider.value = Math.round(scZoom * 100);
  if (scBgType !== "video") drawScCard();
}

scZoomSlider.addEventListener("input", () => setScZoom(Number(scZoomSlider.value) / 100));
scCenterBtn.addEventListener("click", () => {
  scPos = { x: 0, y: 0 };
  setScZoom(1);
});

scCanvas.addEventListener("wheel", (e) => {
  if (!scBgType) return;
  e.preventDefault();
  setScZoom(scZoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08));
}, { passive: false });

let scPinch = null;
function scTouchDist(e) {
  const a = e.touches[0], b = e.touches[1];
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}
scCanvas.addEventListener("touchstart", (e) => {
  if (e.touches.length === 2 && scBgType) {
    scDragging = false;
    scPinch = { dist: scTouchDist(e), zoom: scZoom };
  }
}, { passive: true });
scCanvas.addEventListener("touchmove", (e) => {
  if (scPinch && e.touches.length === 2) {
    setScZoom(scPinch.zoom * (scTouchDist(e) / scPinch.dist));
  }
}, { passive: true });
scCanvas.addEventListener("touchend", (e) => {
  if (e.touches.length < 2) scPinch = null;
  if (e.touches.length === 0) scDragging = false;
});

scBgUploadBtn.addEventListener("click", () => scBgFileInput.click());
scBgFileInput.addEventListener("change", () => {
  const file = scBgFileInput.files[0];
  if (file) loadScBackground(file);
});
scBgRemoveBtn.addEventListener("click", removeScBackground);

document.querySelectorAll("#sc-tabs .sc-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#sc-tabs .sc-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    ["background", "adjust", "format"].forEach(name => {
      document.getElementById(`sc-panel-${name}`).classList.toggle("hidden", name !== tab.dataset.tab);
    });
  });
});

document.querySelectorAll("#sc-period-tabs .sc-ptab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll("#sc-period-tabs .sc-ptab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    scPeriod = tab.dataset.period;
    updateScWeekNav();
    drawScCard();
  });
});

document.querySelectorAll("#sc-panel-format .sc-pill-group").forEach(group => {
  const key = group.dataset.key;
  group.querySelectorAll(".sc-pill").forEach(btn => {
    btn.addEventListener("click", () => {
      group.querySelectorAll(".sc-pill").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      scFormat[key] = btn.dataset.value;
      updateScWeekNav();
      drawScCard();
    });
  });
});

scDimSlider.addEventListener("input", () => {
  scDim = Number(scDimSlider.value);
  if (scBgType !== "video") drawScCard();
});

scSoundSlider.addEventListener("input", () => {
  scSound = Number(scSoundSlider.value);
  applyScSoundToVideo();
});

scTrimStartSlider.addEventListener("input", () => {
  if (!scBgEl || scBgType !== "video") return;
  const duration = scBgEl.duration || 0;
  let startSec = (Number(scTrimStartSlider.value) / 1000) * duration;
  const endSec = (Number(scTrimEndSlider.value) / 1000) * duration;
  if (startSec > endSec - 0.2) startSec = Math.max(0, endSec - 0.2);
  scTrimStart = startSec;
  scBgEl.currentTime = scTrimStart;
  updateScTrimLabel();
});
scTrimEndSlider.addEventListener("input", () => {
  if (!scBgEl || scBgType !== "video") return;
  const duration = scBgEl.duration || 0;
  let endSec = (Number(scTrimEndSlider.value) / 1000) * duration;
  const startSec = (Number(scTrimStartSlider.value) / 1000) * duration;
  if (endSec < startSec + 0.2) endSec = Math.min(duration, startSec + 0.2);
  scTrimEnd = endSec;
  updateScTrimLabel();
});

scSaveDefaultBtn.addEventListener("click", () => {
  try {
    localStorage.setItem("jt_share_card_format", JSON.stringify(scFormat));
    scSaveDefaultBtn.textContent = "Tersimpan!";
    setTimeout(() => { scSaveDefaultBtn.textContent = "Save as my default"; }, 1500);
  } catch (e) { /* ignore */ }
});

scExportPhotoBtn.addEventListener("click", () => {
  drawScCard();
  scCanvas.toBlob((blob) => {
    if (!blob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `jurnal-trading-${scPeriod}-${Date.now()}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }, "image/png");
});

async function scExportVideo() {
  if (scBgType !== "video" || typeof scCanvas.captureStream !== "function") return;
  scExportVideoBtn.disabled = true;
  scFooterHint.textContent = "Lagi render video...";
  try {
    const stream = scCanvas.captureStream(30);
    try {
      if (scBgEl.captureStream) {
        scBgEl.captureStream().getAudioTracks().forEach(t => stream.addTrack(t));
      }
    } catch (e) { /* no audio track, skip */ }

    const mimeCandidates = ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];
    const mimeType = mimeCandidates.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    const done = new Promise((resolve) => { recorder.onstop = resolve; });

    scBgEl.currentTime = scTrimStart;
    scBgEl.muted = scSound === 0;
    scBgEl.volume = scSound / 100;
    await scBgEl.play();
    recorder.start();

    const duration = Math.max(0.3, scTrimEnd - scTrimStart);
    await new Promise(r => setTimeout(r, duration * 1000));

    recorder.stop();
    await done;

    const blob = new Blob(chunks, { type: "video/webm" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `jurnal-trading-${scPeriod}-${Date.now()}.webm`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (err) {
    console.error(err);
    alert("Gagal export video. Browser lo mungkin gak support fitur ini.");
  } finally {
    scExportVideoBtn.disabled = false;
    scFooterHint.textContent = "";
    startScVideoPreviewLoop();
  }
}
scExportVideoBtn.addEventListener("click", scExportVideo);

function loadScGifJs() {
  if (scGifJsLoaded && window.GIF) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.js";
    script.onload = () => { scGifJsLoaded = true; resolve(); };
    script.onerror = () => reject(new Error("Gagal load GIF encoder."));
    document.head.appendChild(script);
  });
}

async function scExportGif() {
  if (scBgType !== "video") return;
  scExportGifBtn.disabled = true;
  scFooterHint.textContent = "Lagi render GIF...";
  let workerUrl = null;
  try {
    await loadScGifJs();
    const workerResp = await fetch("https://cdn.jsdelivr.net/npm/gif.js@0.2.0/dist/gif.worker.js");
    const workerBlob = await workerResp.blob();
    workerUrl = URL.createObjectURL(workerBlob);

    const gif = new window.GIF({
      workers: 2, quality: 10, workerScript: workerUrl,
      width: scCanvas.width, height: scCanvas.height,
    });

    scBgEl.currentTime = scTrimStart;
    scBgEl.muted = true;
    await scBgEl.play();

    const fps = 10;
    const duration = Math.max(0.3, scTrimEnd - scTrimStart);
    const frameCount = Math.round(duration * fps);
    const frameDelay = 1000 / fps;

    for (let i = 0; i < frameCount; i++) {
      drawScCard();
      gif.addFrame(scCanvas, { copy: true, delay: frameDelay });
      await new Promise(r => setTimeout(r, frameDelay));
    }

    const blob = await new Promise((resolve) => {
      gif.on("finished", (b) => resolve(b));
      gif.render();
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `jurnal-trading-${scPeriod}-${Date.now()}.gif`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (err) {
    console.error(err);
    alert("Gagal export GIF. Coba export Video sebagai gantinya.");
  } finally {
    if (workerUrl) URL.revokeObjectURL(workerUrl);
    scExportGifBtn.disabled = false;
    scFooterHint.textContent = "";
    startScVideoPreviewLoop();
  }
}
scExportGifBtn.addEventListener("click", scExportGif);

function updateScWeekNav() {
  const nav = document.getElementById("sc-week-nav");
  if (!nav) return;
  const on = scIsRecap();
  nav.classList.toggle("hidden", !on);
  if (!on) return;
  document.getElementById("sc-week-label").textContent = getScWeekData().range;
  document.getElementById("sc-week-next").disabled = scOffsets[scPeriod] >= 0;
}

document.getElementById("sc-week-prev").addEventListener("click", () => { if (scIsRecap()) { scOffsets[scPeriod] -= 1; updateScWeekNav(); drawScCard(); } });
document.getElementById("sc-week-next").addEventListener("click", () => { if (scIsRecap() && scOffsets[scPeriod] < 0) { scOffsets[scPeriod] += 1; updateScWeekNav(); drawScCard(); } });

function openShareCardModal(trade) {
  scTrade = trade;
  scPeriod = "trade";
  scOffsets.week = scOffsets.month = scOffsets.year = 0;
  updateScWeekNav();
  document.querySelectorAll("#sc-period-tabs .sc-ptab").forEach(t => t.classList.toggle("active", t.dataset.period === "trade"));
  document.querySelectorAll("#sc-tabs .sc-tab").forEach((t, i) => t.classList.toggle("active", i === 0));
  document.getElementById("sc-panel-background").classList.remove("hidden");
  document.getElementById("sc-panel-adjust").classList.add("hidden");
  document.getElementById("sc-panel-format").classList.add("hidden");
  removeScBackground();
  loadScFormatDefaults();
  syncScFormatUI();
  scModalOverlay.classList.remove("hidden");
  drawScCard();
}

function closeShareCardModal() {
  stopScVideoLoop();
  scModalOverlay.classList.add("hidden");
}

scCloseBtn.addEventListener("click", closeShareCardModal);
scModalOverlay.addEventListener("click", (e) => { if (e.target === scModalOverlay) closeShareCardModal(); });

function openTradeDetail(trade) {
  const pnlClass = trade.pnl > 0 ? "pos" : (trade.pnl < 0 ? "neg" : "neu");
  const dirClass = trade.position === "Buy" ? "dir-buy" : "dir-sell";
  const resultClass = trade.pnl > 0 ? "result-profit" : (trade.pnl < 0 ? "result-loss" : "result-breakeven");
  const isBacktest = isAccountBacktest(trade.accountId);

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
        <div class="detail-pnl-label">${isBacktest ? "Hasil (R)" : "Net P/L"}</div>
        <div class="detail-pnl-value pnl-value ${pnlClass}">${formatPnl(trade.pnl, isBacktest)}</div>
      </div>
    </div>

    <div class="detail-grid">
      <div class="detail-stat">
        <div class="detail-stat-label">Risk</div>
        <div class="detail-stat-value">${isBacktest ? "1R (standar)" : (trade.risk ? formatMoney(trade.risk) : "-")}</div>
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
      <div class="detail-section-title">Mood Saat Trading</div>
      ${trade.mood ? `<div class="detail-tags"><span class="detail-tag">${escapeHtml(trade.mood)}</span></div>` : `<div class="detail-empty-note">Gak dicatat.</div>`}
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

    <div id="share-link-panel" class="share-link-panel hidden">
      <div class="share-link-label">Link publik (siapa aja bisa buka tanpa login):</div>
      <div class="share-link-row">
        <input type="text" id="share-link-input" readonly />
        <button type="button" class="btn-copy-link" id="share-copy-btn">Copy</button>
      </div>
      <button type="button" class="share-stop-btn" id="share-stop-btn">Hentikan share</button>
    </div>

    <div class="detail-actions">
      <button type="button" class="btn btn-danger" id="detail-delete-btn" style="flex:0;">Hapus</button>
      <button type="button" class="btn btn-ghost" id="detail-sharecard-btn" style="flex:0;">🖼️ Share Card</button>
      <button type="button" class="btn btn-ghost" id="detail-share-btn" style="flex:0;">🔗 Link</button>
      <button type="button" class="btn btn-ghost" id="detail-close-btn">Tutup</button>
      <button type="button" class="btn btn-primary" id="detail-edit-btn">Edit Trade</button>
    </div>
  `;

  document.getElementById("detail-share-btn").addEventListener("click", () => handleShareTrade(trade));
  document.getElementById("detail-sharecard-btn").addEventListener("click", () => openShareCardModal(trade));
  if (trade.shareId) showShareLinkPanel(trade.shareId);

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

function formatPnl(n, isBacktest) {
  if (isBacktest) {
    if (n === null || n === undefined || isNaN(n)) return "0R";
    const sign = n > 0 ? "+" : "";
    return `${sign}${Number(n).toFixed(2)}R`;
  }
  return formatMoney(n);
}

function isAccountBacktest(accountId) {
  const acc = allAccounts.find(a => a.id === accountId);
  return acc?.type === "backtest";
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
  const losses = accountTrades.filter(t => t.pnl < 0).length;
  const winRate = total ? (wins / total) * 100 : 0;
  const totalPnl = accountTrades.reduce((s, t) => s + t.pnl, 0);
  const account = getCurrentAccount();
  const isBacktest = account?.type === "backtest";

  const pnlEl = document.getElementById("tl-total-pnl");
  pnlEl.textContent = formatPnl(totalPnl, isBacktest);
  pnlEl.className = "stat-value pnl-value " + (totalPnl > 0 ? "pos" : totalPnl < 0 ? "neg" : "neu");
  document.getElementById("tl-total-pnl-label").textContent = isBacktest ? "TOTAL R" : "TOTAL P&L";

  document.getElementById("tl-winrate").textContent = winRate.toFixed(0) + "%";
  document.getElementById("tl-trades").textContent = total;

  if (isBacktest) {
    document.getElementById("tl-balance-label").textContent = "WIN / LOSE";
    document.getElementById("tl-balance").innerHTML = `<span class="pos">${wins}W</span> / <span class="neg">${losses}L</span>`;
  } else {
    document.getElementById("tl-balance-label").textContent = "BALANCE";
    const balance = (account?.startingBalance || 0) + totalPnl;
    document.getElementById("tl-balance").textContent = formatMoney(balance);
  }
}

function renderTable(trades) {
  tradesTbody.innerHTML = "";
  emptyState.classList.toggle("hidden", trades.length > 0);
  const isBacktest = getCurrentAccount()?.type === "backtest";

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
      <td class="mono ${pnlClass} pnl-value">${formatNum(t.pnl)}${isBacktest ? "R" : ""}</td>
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
  const isBacktest = getCurrentAccount()?.type === "backtest";
  const unit = isBacktest ? "R" : "";

  document.getElementById("stat-total").textContent = total;
  document.getElementById("stat-winrate").textContent = winRate.toFixed(1) + "%";

  document.getElementById("stat-pnl-label").textContent = isBacktest ? "Total R" : "Total P&L";
  document.getElementById("stat-avgwin-label").textContent = isBacktest ? "Rata-rata R Win" : "Rata-rata Profit";
  document.getElementById("stat-avgloss-label").textContent = isBacktest ? "Rata-rata R Loss" : "Rata-rata Loss";

  const pnlEl = document.getElementById("stat-pnl");
  pnlEl.textContent = formatNum(totalPnl) + unit;
  pnlEl.className = "stat-value pnl-value " + (totalPnl > 0 ? "pos" : totalPnl < 0 ? "neg" : "neu");

  document.getElementById("stat-avgwin").textContent = formatNum(avgWin) + unit;
  document.getElementById("stat-avgloss").textContent = formatNum(avgLoss) + unit;

  renderGrowthChart(trades, { titleId: "growth-title", subtitleId: "growth-subtitle" });
  renderSymbolDonut(trades);
  renderWinLossDonut(trades);
  renderWeekdayBar(trades);
  renderResultBar(trades);
  renderSmartInsights(trades);
}

const CHART_PALETTE = ["#7c6cff", "#34d399", "#ffb648", "#f87171", "#4cc9f0", "#f72585", "#80ed99", "#e0aaff"];

function renderGrowthChart(trades, opts = {}) {
  const svg = document.getElementById(opts.svgId || "growth-svg");
  const changeEl = document.getElementById(opts.changeId || "growth-change");
  const startLabel = opts.startLabelId ? document.getElementById(opts.startLabelId) : document.getElementById("growth-start-label");
  const endLabel = opts.endLabelId ? document.getElementById(opts.endLabelId) : document.getElementById("growth-end-label");
  if (!svg || !changeEl) return;
  svg.innerHTML = "";

  const account = getCurrentAccount();
  const isBacktest = account?.type === "backtest";
  const startingBalance = opts.startingBalanceOverride !== undefined ? opts.startingBalanceOverride : (account?.startingBalance || 0);

  if (opts.titleId) {
    const titleEl = document.getElementById(opts.titleId);
    if (titleEl) titleEl.textContent = isBacktest ? "R GROWTH VIEW" : "TRADE GROWTH VIEW";
  }
  if (opts.subtitleId) {
    const subtitleEl = document.getElementById(opts.subtitleId);
    if (subtitleEl) subtitleEl.textContent = isBacktest ? "Cumulative R over time" : "Equity curve over time";
  }

  if (trades.length === 0) {
    changeEl.textContent = "-";
    changeEl.className = "growth-change pnl-value neu";
    if (startLabel) startLabel.textContent = "-";
    if (endLabel) endLabel.textContent = "-";
    svg.innerHTML = `<text x="500" y="90" text-anchor="middle" fill="#8a8a8e" font-size="13">Belum ada data trade</text>`;
    return;
  }

  const chrono = [...trades].sort((a, b) => (a.date > b.date ? 1 : -1));
  let cum = startingBalance;
  const points = [cum, ...chrono.map(t => (cum += t.pnl))];

  const w = 1000, h = opts.height || 180, padL = 60, padR = 10, padT = 14, padB = 10;
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
  const strokeColor = "#ffffff";

  changeEl.textContent = changePct !== null
    ? `${formatPnl(changeAbs, isBacktest)} (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%)`
    : formatPnl(changeAbs, isBacktest);
  changeEl.className = "growth-change pnl-value neu";

  if (startLabel) startLabel.textContent = `Start · ${formatPnl(startingBalance, isBacktest)}`;
  if (endLabel) endLabel.textContent = `${chrono[chrono.length - 1].date} · ${formatPnl(lastVal, isBacktest)}`;

  // 4 garis grid horizontal + label sumbu Y
  let gridLines = "";
  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    const val = min + (range * i / tickCount);
    const y = padT + (h - padT - padB) - (i / tickCount) * (h - padT - padB);
    gridLines += `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#262626" stroke-width="1" stroke-dasharray="3 4" />`;
    const label = isBacktest ? `${val.toFixed(1)}R` : formatMoney(val).replace(".00", "");
    gridLines += `<text x="${padL - 8}" y="${y + 3}" text-anchor="end" font-size="10" fill="#8a8a8e" font-family="monospace">${label}</text>`;
  }

  svg.innerHTML = `
    <defs>
      <linearGradient id="growthFill${opts.svgId || "growth-svg"}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${strokeColor}" stop-opacity="0.22" />
        <stop offset="100%" stop-color="${strokeColor}" stop-opacity="0" />
      </linearGradient>
    </defs>
    ${gridLines}
    <path d="${areaD}" fill="url(#growthFill${opts.svgId || "growth-svg"})" stroke="none" />
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
        <div class="donut-legend-value ${seg.pnl > 0 ? 'pos' : seg.pnl < 0 ? 'neg' : 'neu'}">${formatNum(seg.pnl)}${getCurrentAccount()?.type === "backtest" ? "R" : ""}</div>
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
// SMART INSIGHTS (analisa pola otomatis, bukan AI beneran)
// ============================================================

function winRateOf(trades) {
  if (trades.length === 0) return null;
  const wins = trades.filter(t => t.pnl > 0).length;
  return (wins / trades.length) * 100;
}

function groupBy(trades, keyFn) {
  const map = {};
  trades.forEach(t => {
    const keys = keyFn(t);
    (Array.isArray(keys) ? keys : [keys]).forEach(k => {
      if (!k) return;
      if (!map[k]) map[k] = [];
      map[k].push(t);
    });
  });
  return map;
}

function renderSmartInsights(trades) {
  const list = document.getElementById("insights-list");
  const insights = [];
  const MIN_SAMPLE = 3;
  const isBacktest = getCurrentAccount()?.type === "backtest";

  if (trades.length < MIN_SAMPLE) {
    list.innerHTML = `<div class="insight-empty">Minimal ${MIN_SAMPLE} trade dulu biar insight-nya akurat. Terus catat trade lo ya.</div>`;
    return;
  }

  const byPair = groupBy(trades, t => t.pair);
  const pairStats = Object.entries(byPair)
    .filter(([, arr]) => arr.length >= 2)
    .map(([pair, arr]) => ({ pair, wr: winRateOf(arr), count: arr.length, pnl: arr.reduce((s, t) => s + t.pnl, 0) }));
  if (pairStats.length >= 2) {
    const best = [...pairStats].sort((a, b) => b.wr - a.wr)[0];
    const worst = [...pairStats].sort((a, b) => a.wr - b.wr)[0];
    if (best.pair !== worst.pair) {
      insights.push({
        icon: "🎯",
        text: `Win rate lo di <b>${escapeHtml(best.pair)}</b> ${best.wr.toFixed(0)}% (${best.count} trade), tapi di <b>${escapeHtml(worst.pair)}</b> cuma ${worst.wr.toFixed(0)}% (${worst.count} trade). Mungkin worth dipikirin buat lebih fokus ke pair yang lo lebih jago.`
      });
    }
  }

  const buys = trades.filter(t => t.position === "Buy");
  const sells = trades.filter(t => t.position === "Sell");
  if (buys.length >= 2 && sells.length >= 2) {
    const wrBuy = winRateOf(buys), wrSell = winRateOf(sells);
    if (Math.abs(wrBuy - wrSell) >= 15) {
      const better = wrBuy > wrSell ? "Buy" : "Sell";
      const worse = wrBuy > wrSell ? "Sell" : "Buy";
      const betterWr = Math.max(wrBuy, wrSell), worseWr = Math.min(wrBuy, wrSell);
      insights.push({
        icon: "📈",
        text: `Trade <b>${better}</b> lo menang ${betterWr.toFixed(0)}% dari waktu, sedangkan <b>${worse}</b> cuma ${worseWr.toFixed(0)}%. Ada gap yang cukup jauh nih di antara dua arah ini.`
      });
    }
  }

  const byConfluence = groupBy(trades, t => t.confluence || []);
  const confStats = Object.entries(byConfluence)
    .filter(([, arr]) => arr.length >= 2)
    .map(([c, arr]) => ({ c, wr: winRateOf(arr), count: arr.length }));
  if (confStats.length >= 2) {
    const best = [...confStats].sort((a, b) => b.wr - a.wr)[0];
    if (best.wr >= 60) {
      insights.push({
        icon: "✅",
        text: `Setup dengan confluence <b>${escapeHtml(best.c)}</b> punya win rate ${best.wr.toFixed(0)}% dari ${best.count} trade — salah satu confluence paling konsisten buat lo sejauh ini.`
      });
    }
  }

  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const byWeekday = groupBy(trades, t => {
    if (!t.date) return null;
    return dayNames[new Date(t.date + "T00:00:00").getDay()];
  });
  const weekdayStats = Object.entries(byWeekday)
    .filter(([, arr]) => arr.length >= 2)
    .map(([day, arr]) => ({ day, pnl: arr.reduce((s, t) => s + t.pnl, 0), count: arr.length }));
  if (weekdayStats.length >= 2) {
    const best = [...weekdayStats].sort((a, b) => b.pnl - a.pnl)[0];
    const worst = [...weekdayStats].sort((a, b) => a.pnl - b.pnl)[0];
    if (worst.pnl < 0 && best.day !== worst.day) {
      insights.push({
        icon: "📅",
        text: `Hari <b>${worst.day}</b> cenderung jadi hari boncos buat lo (total ${formatPnl(worst.pnl, isBacktest)} dari ${worst.count} trade), sedangkan <b>${best.day}</b> paling cuan (${formatPnl(best.pnl, isBacktest)}). Coba lebih hati-hati atau kurangi frekuensi trading di ${worst.day}.`
      });
    }
  }

  const byMood = groupBy(trades, t => t.mood);
  const moodStats = Object.entries(byMood)
    .filter(([, arr]) => arr.length >= 2)
    .map(([mood, arr]) => ({ mood, wr: winRateOf(arr), count: arr.length }));
  if (moodStats.length >= 2) {
    const worst = [...moodStats].sort((a, b) => a.wr - b.wr)[0];
    const best = [...moodStats].sort((a, b) => b.wr - a.wr)[0];
    if (worst.mood !== best.mood && worst.wr <= 40) {
      insights.push({
        icon: "🧠",
        text: `Pas mood lo <b>${escapeHtml(worst.mood)}</b>, win rate cuma ${worst.wr.toFixed(0)}% (${worst.count} trade). Pertimbangin buat rehat dulu kalau lagi ngerasa gitu, sebelum entry.`
      });
    }
  }

  const fullTP = trades.filter(t => t.result === "Full TP").length;
  const partial = trades.filter(t => t.result === "Partial").length;
  const sl = trades.filter(t => t.result === "SL").length;
  if (partial + fullTP >= 4 && partial > fullTP) {
    insights.push({
      icon: "✂️",
      text: `Dari trade yang profit, lo lebih sering close <b>Partial</b> (${partial}x) dibanding <b>Full TP</b> (${fullTP}x). Kalau ini kebiasaan cut winner kepagian, coba evaluasi lagi target TP-nya.`
    });
  }

  const avgRRValues = trades.map(t => parseRR(t.riskReward)).filter(v => v !== null);
  if (avgRRValues.length >= 3) {
    const avgRR = avgRRValues.reduce((s, v) => s + v, 0) / avgRRValues.length;
    const overallWR = winRateOf(trades);
    const breakEvenWR = 100 / (1 + avgRR);
    if (overallWR < breakEvenWR - 5) {
      insights.push({
        icon: "⚠️",
        text: `Win rate lo ${overallWR.toFixed(0)}% dengan rata-rata R:R 1:${avgRR.toFixed(1)}. Secara matematis, buat balik modal aja butuh win rate minimal ~${breakEvenWR.toFixed(0)}%. Coba naikin target R:R atau perbaiki akurasi entry.`
      });
    } else if (overallWR >= breakEvenWR + 5) {
      insights.push({
        icon: "💪",
        text: `Win rate lo ${overallWR.toFixed(0)}% udah di atas titik impas (~${breakEvenWR.toFixed(0)}%) buat rata-rata R:R 1:${avgRR.toFixed(1)} lo. Sistem trading lo secara matematis profitable — tinggal jaga konsistensi.`
      });
    }
  }

  if (sl >= 3 && trades.length >= 6) {
    const slRate = (sl / trades.length) * 100;
    if (slRate >= 50) {
      insights.push({
        icon: "🛑",
        text: `${slRate.toFixed(0)}% trade lo berakhir kena <b>SL</b>. Ini sinyal buat evaluasi ulang kriteria entry lo — mungkin confluence-nya kurang kuat atau timing entry kurang pas.`
      });
    }
  }

  if (insights.length === 0) {
    list.innerHTML = `<div class="insight-empty">Belum ketemu pola yang cukup signifikan. Terus catat trade lo biar insight-nya makin akurat.</div>`;
    return;
  }

  list.innerHTML = insights.map(ins => `
    <div class="insight-item">
      <div class="insight-icon">${ins.icon}</div>
      <div class="insight-text">${ins.text}</div>
    </div>
  `).join("");
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

// ---------- Month/Year quick picker ----------
const calMonthPicker = document.getElementById("cal-month-picker");
const calPickerYearLabel = document.getElementById("cal-picker-year-label");
const calPickerMonthGrid = document.getElementById("cal-picker-month-grid");
let pickerYear = calendarViewDate.getFullYear();

function renderMonthPickerGrid() {
  calPickerYearLabel.textContent = pickerYear;
  calPickerMonthGrid.innerHTML = "";
  MONTH_NAMES_ID.forEach((name, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "cal-picker-month-btn";
    if (pickerYear === calendarViewDate.getFullYear() && i === calendarViewDate.getMonth()) {
      btn.classList.add("cal-picker-month-active");
    }
    btn.textContent = name;
    btn.addEventListener("click", () => {
      calendarViewDate = new Date(pickerYear, i, 1);
      calMonthPicker.classList.add("hidden");
      renderDashboard(getAccountTrades());
    });
    calPickerMonthGrid.appendChild(btn);
  });
}

calMonthLabel.addEventListener("click", (e) => {
  e.stopPropagation();
  pickerYear = calendarViewDate.getFullYear();
  renderMonthPickerGrid();
  calMonthPicker.classList.toggle("hidden");
});

document.getElementById("cal-picker-year-prev").addEventListener("click", () => {
  pickerYear -= 1;
  renderMonthPickerGrid();
});
document.getElementById("cal-picker-year-next").addEventListener("click", () => {
  pickerYear += 1;
  renderMonthPickerGrid();
});

document.addEventListener("click", (e) => {
  if (!calMonthPicker.classList.contains("hidden") && !calMonthPicker.contains(e.target) && e.target !== calMonthLabel) {
    calMonthPicker.classList.add("hidden");
  }
});

function getCalendarFilteredTrades(monthTrades) {
  const pairQ = document.getElementById("cal-filter-pair").value.trim().toUpperCase();
  const dirQ = document.getElementById("cal-filter-dir").value;
  const resultQ = document.getElementById("cal-filter-result").value;

  const resetBtn = document.getElementById("cal-filter-reset");
  const isActive = pairQ || dirQ || resultQ;
  resetBtn.classList.toggle("hidden", !isActive);

  if (!isActive) return monthTrades;

  return monthTrades.filter(t => {
    if (pairQ && !t.pair?.toUpperCase().includes(pairQ)) return false;
    if (dirQ && t.position !== dirQ) return false;
    if (resultQ === "win" && t.pnl <= 0) return false;
    if (resultQ === "loss" && t.pnl > 0) return false;
    return true;
  });
}

["cal-filter-pair", "cal-filter-dir", "cal-filter-result"].forEach(id => {
  const evt = id === "cal-filter-pair" ? "input" : "change";
  document.getElementById(id).addEventListener(evt, () => renderDashboard(getAccountTrades()));
});
document.getElementById("cal-filter-reset").addEventListener("click", () => {
  document.getElementById("cal-filter-pair").value = "";
  document.getElementById("cal-filter-dir").value = "";
  document.getElementById("cal-filter-result").value = "";
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
  const monthTradesForCalendar = getCalendarFilteredTrades(monthTrades);

  const visibleNews = getFilteredNews();
  const monthNews = visibleNews.filter(n => {
    if (!n.date) return false;
    const d = new Date(n.date + "T00:00:00");
    return d.getFullYear() === year && d.getMonth() === month;
  });

  calMonthLabel.textContent = `${MONTH_NAMES_ID[month]} ${year}`;
  calSubtitle.textContent = `${monthTradesForCalendar.length} trade · ${MONTH_NAMES_ID[month]} ${year}`;

  renderCalendarGrid(year, month, monthTradesForCalendar, monthNews);
  renderGoals(accountTrades);
  renderDashboardStats(monthTrades, accountTrades);
  renderDashboardHero(accountTrades);
}

function getCurrentWeekRange(now = new Date()) {
  const dayIdx = (now.getDay() + 6) % 7; // Senin = 0
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayIdx);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

function renderDashboardHero(accountTrades) {
  const account = getCurrentAccount();
  const isBacktest = account?.type === "backtest";
  const startingBalance = account?.startingBalance || 0;
  const totalPnl = accountTrades.reduce((s, t) => s + (t.pnl || 0), 0);

  const heroEl = document.getElementById("dash-total-pnl");
  const heroSub = document.getElementById("dash-hero-sub");
  if (heroEl) heroEl.textContent = formatPnl(totalPnl, isBacktest);

  // ---- This week ----
  const { monday, sunday } = getCurrentWeekRange();
  const weekTrades = accountTrades.filter(t => {
    if (!t.date) return false;
    const d = new Date(t.date + "T00:00:00");
    return d >= monday && d <= sunday;
  });
  const weekPnl = weekTrades.reduce((s, t) => s + (t.pnl || 0), 0);
  const weekWins = weekTrades.filter(t => t.pnl > 0).length;
  const weekWinrate = weekTrades.length ? Math.round((weekWins / weekTrades.length) * 100) : 0;

  const fmtShort = (d) => `${d.getDate()} ${MONTH_NAMES_ID[d.getMonth()]}`;

  if (heroSub) {
    heroSub.textContent = accountTrades.length === 0
      ? "Belum ada trade."
      : `${weekTrades.length > 0 ? formatPnl(weekPnl, isBacktest) : "$0.00"} dalam 7 hari terakhir · ${accountTrades.length} trade total`;
  }

  const weekRangeEl = document.getElementById("dash-week-range");
  if (weekRangeEl) weekRangeEl.textContent = `${fmtShort(monday)} – ${fmtShort(sunday)}`;
  const weekPnlEl = document.getElementById("dash-week-pnl");
  if (weekPnlEl) weekPnlEl.textContent = formatPnl(weekPnl, isBacktest);
  const weekTradesEl = document.getElementById("dash-week-trades");
  if (weekTradesEl) weekTradesEl.textContent = String(weekTrades.length);
  const weekWinrateEl = document.getElementById("dash-week-winrate");
  if (weekWinrateEl) weekWinrateEl.textContent = `${weekWinrate}%`;

  // ---- Cumulative P&L chart (filterable: day/week/month/year/all) ----
  lastDashAccountTrades = accountTrades;
  renderDashGrowthChart();
}

let lastDashAccountTrades = [];
let dashGrowthPeriod = "all";

const DASH_GROWTH_PERIOD_LABEL = {
  day: "Hari ini",
  week: "Minggu ini",
  month: "Bulan ini",
  year: "Tahun ini",
  all: "All time",
};

function filterTradesByPeriod(trades, period) {
  if (period === "all") return trades;
  const now = new Date();
  if (period === "day") {
    const todayStr = now.toISOString().slice(0, 10);
    return trades.filter(t => t.date === todayStr);
  }
  if (period === "week") {
    const { monday, sunday } = getCurrentWeekRange(now);
    return trades.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date + "T00:00:00");
      return d >= monday && d <= sunday;
    });
  }
  if (period === "month") {
    return trades.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date + "T00:00:00");
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }
  if (period === "year") {
    return trades.filter(t => {
      if (!t.date) return false;
      const d = new Date(t.date + "T00:00:00");
      return d.getFullYear() === now.getFullYear();
    });
  }
  return trades;
}

function renderDashGrowthChart() {
  const account = getCurrentAccount();
  const periodTrades = filterTradesByPeriod(lastDashAccountTrades, dashGrowthPeriod);
  const periodLabelEl = document.getElementById("dash-growth-period-label");
  if (periodLabelEl) periodLabelEl.textContent = DASH_GROWTH_PERIOD_LABEL[dashGrowthPeriod] || "All time";

  renderGrowthChart(periodTrades, {
    svgId: "dash-growth-svg",
    changeId: "dash-growth-change",
    height: 140,
    // "All time" starts the curve from the account's real starting balance;
    // per-period views start from 0 so they show cumulative P&L for that window only.
    startingBalanceOverride: dashGrowthPeriod === "all" ? (account?.startingBalance || 0) : 0,
  });
}

document.querySelectorAll("#dash-growth-period-toggle button").forEach(btn => {
  btn.addEventListener("click", () => {
    dashGrowthPeriod = btn.dataset.period;
    document.querySelectorAll("#dash-growth-period-toggle button").forEach(b => b.classList.toggle("active", b === btn));
    renderDashGrowthChart();
  });
});

function renderCalendarGrid(year, month, monthTrades, monthNews) {
  calendarGrid.innerHTML = "";
  const isBacktest = getCurrentAccount()?.type === "backtest";

  const tradesByDay = {};
  monthTrades.forEach(t => {
    const day = parseInt(t.date.split("-")[2], 10);
    if (!tradesByDay[day]) tradesByDay[day] = [];
    tradesByDay[day].push(t);
  });

  const newsByDay = {};
  (monthNews || []).forEach(n => {
    const day = parseInt(n.date.split("-")[2], 10);
    if (!newsByDay[day]) newsByDay[day] = [];
    newsByDay[day].push(n);
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
    const dayNews = newsByDay[day] || [];
    cell.className = "cal-cell";
    const cellDate = new Date(year, month, day);
    cellDate.setHours(0, 0, 0, 0);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const isFuture = cellDate > todayMidnight;
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const newsDotsHtml = dayNews.length
      ? `<div class="cal-news-dots">${dayNews.slice(0, 3).map(n => `<span class="cal-news-dot ${n.impact}"></span>`).join("")}</div>`
      : "";

    if (dayTrades && dayTrades.length) {
      const pnl = dayTrades.reduce((s, t) => s + t.pnl, 0);
      cell.classList.add(pnl >= 0 ? "cal-win" : "cal-loss", "cal-has-data");
      cell.dataset.day = day;
      cell.innerHTML = `
        ${newsDotsHtml}
        <span class="cal-day-num">${day}</span>
        <span class="cal-day-pnl pnl-value">${formatNumCompact(pnl)}${isBacktest ? "R" : ""}</span>
        <span class="cal-day-count">${dayTrades.length} trade${dayTrades.length > 1 ? "s" : ""}</span>
      `;
      cell.addEventListener("click", () => openDayDetail(year, month, day, dayTrades, dayNews));
    } else if (dayNews.length) {
      cell.classList.add("cal-empty-clickable");
      cell.innerHTML = `
        ${newsDotsHtml}
        <span class="cal-day-num">${day}</span>
      `;
      cell.title = `${dayNews.length} news di tanggal ini`;
      cell.addEventListener("click", () => openDayDetail(year, month, day, [], dayNews));
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

function openDayDetail(year, month, day, dayTrades, dayNews) {
  const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const dateLabel = `${day} ${MONTH_NAMES_ID[month]} ${year}`;
  const isBacktest = getCurrentAccount()?.type === "backtest";
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
        <span class="day-detail-item-pnl pnl-value ${pnlClass}">${formatNum(t.pnl)}${isBacktest ? "R" : ""}</span>
      </div>
    `;
  }).join("");

  const impactLabel = { low: "🟡 Low", medium: "🟠 Medium", high: "🔴 Red Folder" };
  const newsHtml = (dayNews || []).map(n => `
    <div class="day-detail-news-item impact-${n.impact}" data-id="${n.id}">
      <span class="day-detail-news-title">${escapeHtml(n.title)}</span>
      <span class="day-detail-news-badge">${impactLabel[n.impact] || n.impact}</span>
    </div>
  `).join("");

  const newsSection = (dayNews && dayNews.length)
    ? `<div class="detail-section-title" style="margin-top:16px;">📰 News</div>${newsHtml}`
    : "";

  const tradesSection = dayTrades.length
    ? `
      <div class="day-detail-header">
        <div>
          <div class="day-detail-date">${dateLabel}</div>
          <div class="day-detail-sub">${dayTrades.length} trade · ${wins} win / ${losses} loss</div>
        </div>
        <div class="day-detail-pnl">
          <div class="day-detail-pnl-label">${isBacktest ? "Total R" : "Total P&L"}</div>
          <div class="day-detail-pnl-value pnl-value ${totalPnl > 0 ? 'pos' : totalPnl < 0 ? 'neg' : 'neu'}">${formatPnl(totalPnl, isBacktest)}</div>
        </div>
      </div>
      <div class="day-detail-list">${itemsHtml}</div>
    `
    : `<div class="day-detail-header"><div><div class="day-detail-date">${dateLabel}</div><div class="day-detail-sub">Belum ada trade di tanggal ini</div></div></div>`;

  dayDetailContent.innerHTML = `
    ${tradesSection}
    ${newsSection}
    <button type="button" class="btn btn-ghost day-detail-add-btn" id="day-detail-add-btn">+ Tambah trade di hari ini</button>
    <button type="button" class="btn btn-ghost day-detail-add-btn" id="day-detail-news-add-btn">📰 + Tambah news di hari ini</button>
  `;

  document.getElementById("day-detail-add-btn").addEventListener("click", () => {
    closeDayDetail();
    goToTradeLogAndAddTrade(dateStr);
  });
  document.getElementById("day-detail-news-add-btn").addEventListener("click", () => {
    closeDayDetail();
    openNewsModal(null, dateStr);
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
  dayDetailContent.querySelectorAll(".day-detail-news-item").forEach(item => {
    item.addEventListener("click", () => {
      const news = allNews.find(n => n.id === item.dataset.id);
      if (news) {
        closeDayDetail();
        openNewsModal(news);
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

const GOAL_PERIODS = ["day", "week", "month"];
const GOAL_PERIOD_TITLE = { day: "Hari Ini", week: "Minggu Ini", month: "Bulan Ini" };

function renderGoals(accountTrades) {
  const account = getCurrentAccount();
  const isBacktest = account?.type === "backtest";
  const goals = account?.goals || {};

  GOAL_PERIODS.forEach(period => {
    const body = document.getElementById(`goal-body-${period}`);
    if (!body) return;
    const target = goals[period];
    const actual = filterTradesByPeriod(accountTrades, period).reduce((s, t) => s + (t.pnl || 0), 0);

    if (target === undefined || target === null || target === "") {
      body.innerHTML = `<button type="button" class="goal-set-cta" data-period="${period}">Set a target</button>`;
      body.querySelector(".goal-set-cta").addEventListener("click", () => openGoalModal(period));
      return;
    }

    const pct = target > 0
      ? Math.min(100, Math.max(0, (actual / target) * 100))
      : (actual >= target ? 100 : 0);

    body.innerHTML = `
      <div class="goal-progress-value pnl-value">${formatPnl(actual, isBacktest)} <span class="goal-target-amt">/ ${formatPnl(target, isBacktest)}</span></div>
      <div class="goal-progress-track"><div class="goal-progress-bar" style="width:${pct}%"></div></div>
      <div class="goal-progress-pct">${Math.round(pct)}%</div>
    `;
  });
}

function openGoalModal(period) {
  goalEditingPeriod = period;
  goalModalError.classList.add("hidden");
  const account = getCurrentAccount();
  const existing = account?.goals?.[period];
  goalTargetInput.value = (existing !== undefined && existing !== null) ? existing : "";
  goalModalTitle.textContent = `Set Target — ${GOAL_PERIOD_TITLE[period] || ""}`;
  goalClearBtn.classList.toggle("hidden", existing === undefined || existing === null);
  goalModalOverlay.classList.remove("hidden");
  goalTargetInput.focus();
}

function closeGoalModal() {
  goalModalOverlay.classList.add("hidden");
  goalEditingPeriod = null;
}

document.querySelectorAll(".goal-edit-btn").forEach(btn => {
  btn.addEventListener("click", () => openGoalModal(btn.dataset.period));
});

goalCancelBtn.addEventListener("click", closeGoalModal);
goalModalOverlay.addEventListener("click", (e) => { if (e.target === goalModalOverlay) closeGoalModal(); });

goalForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  goalModalError.classList.add("hidden");

  const val = parseFloat(goalTargetInput.value);
  if (isNaN(val) || val === 0) {
    goalModalError.textContent = "Isi target angkanya (gak boleh 0).";
    goalModalError.classList.remove("hidden");
    return;
  }

  try {
    await updateDoc(doc(db, "users", currentUser.uid, "accounts", currentAccountId), {
      [`goals.${goalEditingPeriod}`]: val,
    });
    closeGoalModal();
  } catch (err) {
    goalModalError.textContent = "Gagal menyimpan. Coba lagi.";
    goalModalError.classList.remove("hidden");
    console.error(err);
  }
});

goalClearBtn.addEventListener("click", async () => {
  if (!goalEditingPeriod) return;
  try {
    await updateDoc(doc(db, "users", currentUser.uid, "accounts", currentAccountId), {
      [`goals.${goalEditingPeriod}`]: deleteField(),
    });
    closeGoalModal();
  } catch (err) {
    goalModalError.textContent = "Gagal menghapus. Coba lagi.";
    goalModalError.classList.remove("hidden");
    console.error(err);
  }
});

function renderDashboardStats(monthTrades, accountTrades) {
  const account = getCurrentAccount();
  const isBacktest = account?.type === "backtest";
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

  document.getElementById("dash-pnl-sub").textContent = `${isBacktest ? "TOTAL R BULAN INI" : "P&L BULAN INI"} · ${label}`;
  const pnlEl = document.getElementById("dash-pnl");
  pnlEl.textContent = formatPnl(monthlyPnl, isBacktest);
  pnlEl.className = "stat-value pnl-value " + (monthlyPnl > 0 ? "pos" : monthlyPnl < 0 ? "neg" : "neu");
  document.getElementById("dash-profit").textContent = formatPnl(profitSum, isBacktest);
  document.getElementById("dash-loss").textContent = formatPnl(lossSum, isBacktest);

  const rrValues = monthTrades.map(t => parseRR(t.riskReward)).filter(v => v !== null);
  const avgRR = rrValues.length ? rrValues.reduce((s, v) => s + v, 0) / rrValues.length : null;
  document.getElementById("dash-rr-sub").textContent = `AVG RISK:REWARD · ${label}`;
  document.getElementById("dash-rr").textContent = avgRR !== null ? `1:${avgRR.toFixed(1)}` : "-";
  document.getElementById("dash-rr-footnote").textContent = `${total} trade bulan ini`;

  if (isBacktest) {
    const allWins = accountTrades.filter(t => t.pnl > 0).length;
    const allLosses = accountTrades.filter(t => t.pnl < 0).length;
    const allBes = accountTrades.filter(t => t.pnl === 0).length;
    const allTotal = accountTrades.length;
    const allWinRate = allTotal ? (allWins / allTotal) * 100 : 0;

    document.getElementById("dash-balance-sub").textContent = `WIN / LOSE · ${account?.name || "-"}`;
    document.getElementById("dash-balance").innerHTML = `<span class="pos">${allWins}W</span> / <span class="neg">${allLosses}L</span>`;
    document.getElementById("dash-balance-footnote").textContent = `${allTotal} total trade · Win rate ${allWinRate.toFixed(0)}% (${allBes} BE)`;
  } else {
    const startingBalance = account?.startingBalance || 0;
    const allTimePnl = accountTrades.reduce((s, t) => s + t.pnl, 0);
    const balance = startingBalance + allTimePnl;

    document.getElementById("dash-balance-sub").textContent = `SALDO · ${account?.name || "-"}`;
    document.getElementById("dash-balance").textContent = formatMoney(balance);
    document.getElementById("dash-balance-footnote").textContent = `Modal awal: ${formatMoney(startingBalance)}`;
  }
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

// ============================================================
// PWA: daftarin service worker biar bisa di-"Install" jadi app
// ============================================================
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/service-worker.js").catch((err) => {
      console.error("Service worker gagal register:", err);
    });
  });
}
