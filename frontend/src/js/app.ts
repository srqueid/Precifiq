/**
 * app.ts — Utilitários globais do frontend
 */

// ── Configuração da API ──────────────────────────────────────────────────────
const API_BASE = 'http://localhost:8080';

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, options);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

export async function apiPost<T = any>(path: string, body: any): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function apiPostForm<T = any>(path: string, params: Record<string, string>): Promise<T> {
  const body = new URLSearchParams(params);
  return apiFetch<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
}

// ── Formatação ───────────────────────────────────────────────────────────────
export interface FmtUtils {
  brl: (v?: number | string | null) => string;
  pct: (v?: number | string | null) => string;
  num: (v?: number | string | null, d?: number) => string;
}

export const fmt: FmtUtils = {
  brl: (v) => `R$ ${Number(v || 0).toFixed(2)}`,
  pct: (v) => `${(Number(v || 0) * 100).toFixed(0)}%`,
  num: (v, d = 2) => Number(v || 0).toFixed(d),
};

// ── Toast ────────────────────────────────────────────────────────────────────
export type ToastType = 'success' | 'error' | 'warning' | 'info';

if (typeof document !== 'undefined') {
  if (!document.getElementById('toast-style-tag')) {
    const style = document.createElement('style');
    style.id = 'toast-style-tag';
    style.textContent = `
      #toast-container { position:fixed; bottom:24px; right:24px; display:flex; flex-direction:column; gap:8px; z-index:9999; pointer-events:none; }
      .toast { padding:12px 18px; border-radius:10px; font-size:13px; font-weight:600; opacity:0; transform:translateY(8px);
        transition:all 0.25s; pointer-events:none; backdrop-filter:blur(8px); }
      .toast.show { opacity:1; transform:none; }
      .toast.success { background:rgba(34,197,94,0.18); color:#22c55e; border:1px solid rgba(34,197,94,0.3); }
      .toast.error   { background:rgba(239,68,68,0.18);  color:#ef4444; border:1px solid rgba(239,68,68,0.3); }
      .toast.warning { background:rgba(245,158,11,0.18); color:#f59e0b; border:1px solid rgba(245,158,11,0.3); }
      .toast.info    { background:rgba(59,130,246,0.18); color:#3b82f6; border:1px solid rgba(59,130,246,0.3); }
    `;
    document.head.appendChild(style);
  }
  if (!document.getElementById('toast-container')) {
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
}

export function toast(msg: string, type: ToastType = 'success') {
  if (typeof document === 'undefined') return;
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  requestAnimationFrame(() => { el.classList.add('show'); });
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

// ── Helpers de tabela ────────────────────────────────────────────────────────
export function clearTable(tbodyId: string): HTMLElement | null {
  const el = document.getElementById(tbodyId);
  if (el) el.innerHTML = '';
  return el;
}

export function appendRow(tbodyId: string, cells: string): HTMLTableRowElement | undefined {
  const tbody = document.getElementById(tbodyId);
  if (!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = cells;
  tbody.appendChild(tr);
  return tr;
}

// ── Disponibilização global ──────────────────────────────────────────────────
declare global {
  interface Window {
    fmt: FmtUtils;
    toast: typeof toast;
  }
}

if (typeof window !== 'undefined') {
  window.fmt = fmt;
  window.toast = toast;
}
