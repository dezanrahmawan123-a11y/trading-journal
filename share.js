// ============================================================
// SHARE.JS - halaman publik buat lihat 1 trade yang di-share.
// Gak perlu login. Baca dari collection "shared_trades" yang
// memang public-readable (lihat firestore.rules).
// ============================================================

import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore, doc, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str || "";
  return div.innerHTML;
}

function formatMoney(n) {
  if (n === null || n === undefined || isNaN(n)) return "$0.00";
  const sign = n < 0 ? "-" : "";
  return sign + "$" + Math.abs(n).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

async function loadSharedTrade() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");

  const loadingEl = document.getElementById("share-loading");
  const notFoundEl = document.getElementById("share-not-found");
  const cardWrapEl = document.getElementById("share-card-wrap");
  const contentEl = document.getElementById("share-content");

  if (!id) {
    loadingEl.classList.add("hidden");
    notFoundEl.classList.remove("hidden");
    return;
  }

  try {
    const snap = await getDoc(doc(db, "shared_trades", id));
    if (!snap.exists()) {
      loadingEl.classList.add("hidden");
      notFoundEl.classList.remove("hidden");
      return;
    }

    const trade = snap.data();
    renderSharedTrade(trade, contentEl);

    loadingEl.classList.add("hidden");
    cardWrapEl.classList.remove("hidden");

    document.title = `${trade.pair || "Trade"} - Shared Trade | Jurnal Trading`;
  } catch (err) {
    console.error(err);
    loadingEl.classList.add("hidden");
    notFoundEl.classList.remove("hidden");
  }
}

function renderSharedTrade(trade, contentEl) {
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
  (trade.htfLinks || []).forEach((url, i) => {
    links.push(`<a class="detail-link-btn" href="${escapeHtml(url)}" target="_blank" rel="noopener">🔗 HTF Chart${trade.htfLinks.length > 1 ? ` ${i + 1}` : ""}</a>`);
  });
  if (trade.ltfLink) links.push(`<a class="detail-link-btn" href="${escapeHtml(trade.ltfLink)}" target="_blank" rel="noopener">🔗 LTF Chart</a>`);
  const linksHtml = links.length
    ? `<div class="detail-links">${links.join("")}</div>`
    : `<div class="detail-empty-note">Gak ada link chart.</div>`;

  const screenshotHtml = trade.screenshotData
    ? `<img class="detail-screenshot" src="${trade.screenshotData}" alt="Screenshot trade" id="share-screenshot-img" style="cursor:zoom-in;" /><div class="detail-screenshot-hint">Klik gambar buat lihat ukuran penuh</div>`
    : `<div class="detail-empty-note">Gak ada screenshot.</div>`;

  contentEl.innerHTML = `
    <div class="detail-header">
      <div class="detail-header-left">
        <span class="detail-pair">${escapeHtml(trade.pair || "-")}</span>
        <span class="detail-date">${trade.date || "-"}</span>
        <div class="detail-badges">
          <span class="dir-badge ${dirClass}">${escapeHtml(trade.position || "-")}</span>
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

    ${trade.mood ? `
    <div class="detail-section">
      <div class="detail-section-title">Mood Saat Trading</div>
      <div class="detail-tags"><span class="detail-tag">${escapeHtml(trade.mood)}</span></div>
    </div>` : ""}

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
  `;

  if (trade.screenshotData) {
    document.getElementById("share-screenshot-img").addEventListener("click", () => {
      const w = window.open();
      w.document.write(`<title>Screenshot</title><body style="margin:0;background:#111;display:flex;align-items:center;justify-content:center;min-height:100vh;"><img src="${trade.screenshotData}" style="max-width:100%;max-height:100vh;" /></body>`);
    });
  }
}

loadSharedTrade();
