/**
 * app.js — Utilitários globais do frontend
 * Importar este arquivo em todas as páginas.
 */

// ── Configuração da API ──────────────────────────────────────────────────────
const API_BASE = 'http://localhost:8080';

async function apiFetch(path, options = {}) {
  const res = await fetch(API_BASE + path, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function apiPost(path, body) {
  return apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function apiPostForm(path, params) {
  const body = new URLSearchParams(params);
  return apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

// ── Formatação ───────────────────────────────────────────────────────────────
const fmt = {
  brl: (v) => `R$ ${Number(v || 0).toFixed(2)}`,
  pct: (v) => `${(Number(v || 0) * 100).toFixed(0)}%`,
  num: (v, d = 2) => Number(v || 0).toFixed(d),
};

// ── Toast ────────────────────────────────────────────────────────────────────
(function initToast() {
  const style = document.createElement('style');
  style.textContent = `
    #toast-container { position:fixed; bottom:24px; right:24px; display:flex; flex-direction:column; gap:8px; z-index:9999; pointer-events:none; }
    .toast { padding:12px 18px; border-radius:10px; font-size:13px; font-weight:600; opacity:0; transform:translateY(8px);
      transition:all 0.25s; pointer-events:none; backdrop-filter:blur(8px); }
    .toast.show { opacity:1; transform:none; }
    .toast.success { background:rgba(34,197,94,0.18); color:#22c55e; border:1px solid rgba(34,197,94,0.3); }
    .toast.error   { background:rgba(239,68,68,0.18);  color:#ef4444; border:1px solid rgba(239,68,68,0.3); }
  `;
  document.head.appendChild(style);
  const container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);
})();

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  requestAnimationFrame(() => { el.classList.add('show'); });
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ── Navegação ativa ──────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const path = location.pathname.split('/')[1] || 'dashboard';
  document.querySelectorAll('.menu-link').forEach(a => {
    const href = a.getAttribute('href')?.split('/')[1] || '';
    if (href === path) a.classList.add('active');
  });
});

// ── Helpers de tabela ────────────────────────────────────────────────────────
function clearTable(tbodyId) {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = '';
  return el;
}

function appendRow(tbodyId, cells) {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = cells;
  tbody.appendChild(tr);
  return tr;
}