"""
Runner para a Suíte de Testes Automatizados E2E do Precific
Executa todos os testes, coleta resultados, screenshots e gera relatório executivo em HTML.
"""

import os
import sys
import time
import base64
import unittest
from datetime import datetime

# Configura UTF-8 no console Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Importa os testes
from test_sistema_completo import PrecificSistemaCompletoTest, SCREENSHOTS_DIR

REPORT_HTML_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "relatorio_testes.html")

TEST_DESCRIPTIONS = {
    "test_01_dashboard": ("01 - Dashboard Executivo", "Métricas gerais de vendas, orçamentos, estoque e compras em tempo real", "01_dashboard.png"),
    "test_02_company_switcher": ("02 - Company Switcher Corporativo", "Dropdown de seleção rápida de empresas e filiais na Sidebar", "02_company_switcher.png"),
    "test_03_gestao_global_empresas": ("03 - Gestão Global: Empresas & Filiais", "Hierarquia corporativa completa com schemas de banco dedicados", "03_gestao_global_empresas.png"),
    "test_04_gestao_global_modal_filial": ("04 - Gestão Global: Modal Nova Filial", "Formulário de cadastro e provisionamento automático de novo tenant", "04_gestao_global_modal_filial.png"),
    "test_05_gestao_global_usuarios": ("05 - Gestão Global: Usuários Centrais", "Gestão de acessos corporativos, papéis e permissões globais", "05_gestao_global_usuarios.png"),
    "test_06_gestao_global_perfis": ("06 - Gestão Global: Perfis & RBAC", "Matriz de perfis corporativos (Administrador, Gerente, Operador)", "06_gestao_global_perfis.png"),
    "test_07_fornecedores_listagem": ("07 - Gestão de Fornecedores", "Listagem cadastral de parceiros, CNPJ, contatos e filtros", "07_fornecedores_listagem.png"),
    "test_08_fornecedores_modal_cadastro": ("08 - Fornecedores: Cadastro Completo", "Modal de inclusão de fornecedor com dados bancários e fiscais", "08_fornecedores_modal.png"),
    "test_09_estoque_insumos": ("09 - Estoque de Insumos & Matérias-Primas", "Controle de saldo, custos unitários e estoque mínimo", "09_estoque_insumos.png"),
    "test_10_insumos_interativo": ("10 - Insumos: Pesquisa & Filtros Dinâmicos", "Mecanismo interativo de busca e atualização da tabela", "10_insumos_interativo.png"),
    "test_11_estoque_produtos": ("11 - Estoque de Produtos Acabados", "Acompanhamento de inventário e valor total em estoque", "11_estoque_produtos.png"),
    "test_12_unidades_medida": ("12 - Unidades de Medida", "Catálogo de unidades (KG, UN, M, L) e fatores de conversão", "12_unidades_medida.png"),
    "test_13_produtos_finais": ("13 - Produtos Finais & Ficha Técnica", "Precificação dinâmica, custos operacionais e margem de lucro", "13_produtos_finais.png"),
    "test_14_kits_produtos": ("14 - Gestão de Kits & Combos", "Composição de kits com cálculo automático de custos e markup", "14_kits_produtos.png"),
    "test_15_orcamentos": ("15 - Painel de Orçamentos", "Cotações com clientes, status de aprovação e valores", "15_orcamentos.png"),
    "test_16_pedidos_clientes": ("16 - Pedidos de Venda / Clientes", "Emissão e processamento de pedidos finais de clientes", "16_pedidos_clientes.png"),
    "test_17_pedidos_compra": ("17 - Pedidos de Compra a Fornecedores", "Geração de ordens de compra e acompanhamento de entrega", "17_pedidos_compra.png"),
    "test_18_compras_realizadas": ("18 - Registro de Compras Realizadas", "Lançamento de notas fiscais e alimentação do estoque de insumos", "18_compras_realizadas.png"),
    "test_19_configuracoes_globais": ("19 - Configurações & Parâmetros de Custo", "Ajuste fino de custos fixos, comissões, taxas e impostos", "19_configuracoes_globais.png"),
    "test_20_copilot_ia_spotlight": ("20 - Copilot IA Operacional (Text-to-SQL)", "Assistente inteligente com suporte a consultas em linguagem natural", "20_copilot_ia_spotlight.png"),
    "test_21_dark_mode_interface": ("21 - Modo Escuro (Dark Mode)", "Suporte completo a tema escuro com contraste e legibilidade impecáveis", "21_dark_mode_interface.png"),
    "test_22_filial_isolada_multi_tenant": ("22 - Isolamento Multi-Tenant Real", "Comprovação de schema dedicado da filial sem vazamento de dados da matriz", "22_filial_isolada_multi_tenant.png"),
}


class CustomTestResult(unittest.TextTestResult):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.test_details = []
        self._start_time = None

    def startTest(self, test):
        super().startTest(test)
        self._start_time = time.time()
        test_method = test._testMethodName
        title, _, _ = TEST_DESCRIPTIONS.get(test_method, (test_method, "", ""))
        print(f"\n[RUN] Executando: {title} ...", flush=True)

    def addSuccess(self, test):
        super().addSuccess(test)
        duration = time.time() - self._start_time
        test_method = test._testMethodName
        title, desc, shot = TEST_DESCRIPTIONS.get(test_method, (test_method, "", ""))
        self.test_details.append({
            "method": test_method,
            "title": title,
            "description": desc,
            "screenshot": shot,
            "status": "PASS",
            "duration": f"{duration:.2f}s",
            "error": None
        })
        print(f"  [OK - PASS] Concluido em {duration:.2f}s", flush=True)

    def addFailure(self, test, err):
        super().addFailure(test, err)
        duration = time.time() - self._start_time
        test_method = test._testMethodName
        title, desc, shot = TEST_DESCRIPTIONS.get(test_method, (test_method, "", ""))
        self.test_details.append({
            "method": test_method,
            "title": title,
            "description": desc,
            "screenshot": shot,
            "status": "FAIL",
            "duration": f"{duration:.2f}s",
            "error": str(err[1])
        })
        print(f"  [X - FAIL] Falhou em {duration:.2f}s: {err[1]}", flush=True)

    def addError(self, test, err):
        super().addError(test, err)
        duration = time.time() - self._start_time
        test_method = test._testMethodName
        title, desc, shot = TEST_DESCRIPTIONS.get(test_method, (test_method, "", ""))
        self.test_details.append({
            "method": test_method,
            "title": title,
            "description": desc,
            "screenshot": shot,
            "status": "ERROR",
            "duration": f"{duration:.2f}s",
            "error": str(err[1])
        })
        print(f"  [! - ERROR] Erro em {duration:.2f}s: {err[1]}", flush=True)


def generate_html_report(results, total_duration):
    total_tests = len(results)
    passed_tests = sum(1 for r in results if r["status"] == "PASS")
    failed_tests = sum(1 for r in results if r["status"] in ("FAIL", "ERROR"))
    pass_rate = (passed_tests / total_tests * 100) if total_tests > 0 else 0

    cards_html = ""
    for r in results:
        status_color = "#10b981" if r["status"] == "PASS" else "#ef4444"
        status_badge_bg = "rgba(16, 185, 129, 0.15)" if r["status"] == "PASS" else "rgba(239, 68, 68, 0.15)"
        
        shot_path = os.path.join(SCREENSHOTS_DIR, r["screenshot"])
        rel_shot_path = f"screenshots/{r['screenshot']}"
        
        has_screenshot = os.path.exists(shot_path)
        img_tag = f'<img src="{rel_shot_path}" alt="{r["title"]}" onclick="openModal(\'{rel_shot_path}\', \'{r["title"]}\')" />' if has_screenshot else '<div class="no-img">Sem captura</div>'

        error_html = f'<div class="error-box"><strong>Erro:</strong> {r["error"]}</div>' if r["error"] else ""

        cards_html += f"""
        <div class="test-card">
          <div class="test-header">
            <div class="test-title-group">
              <span class="status-badge" style="background: {status_badge_bg}; color: {status_color};">
                {r["status"]}
              </span>
              <h3 class="test-title">{r["title"]}</h3>
            </div>
            <span class="test-time">⏱ {r["duration"]}</span>
          </div>
          <p class="test-desc">{r["description"]}</p>
          <div class="screenshot-container">
            {img_tag}
          </div>
          {error_html}
        </div>
        """

    html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Relatório Executivo de Testes Automatizados E2E - Precific</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
  <style>
    :root {{
      --bg: #0b0f19;
      --surface: #131b2e;
      --surface-card: #182238;
      --border: #23314f;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-light: #60a5fa;
      --success: #10b981;
      --danger: #ef4444;
      --warning: #f59e0b;
    }}
    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}
    body {{
      background: var(--bg);
      color: var(--text);
      font-family: 'Inter', sans-serif;
      padding: 32px 24px;
      line-height: 1.5;
    }}
    .container {{
      max-width: 1360px;
      margin: 0 auto;
    }}
    header {{
      margin-bottom: 32px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      flex-wrap: wrap;
      gap: 16px;
    }}
    .brand-title {{
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #60a5fa 0%, #3b82f6 50%, #818cf8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }}
    .brand-subtitle {{
      color: var(--text-muted);
      font-size: 14px;
      margin-top: 4px;
    }}
    .timestamp-badge {{
      background: var(--surface);
      border: 1px solid var(--border);
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 12px;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
    }}
    .metrics-grid {{
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 36px;
    }}
    .metric-card {{
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      position: relative;
      overflow: hidden;
    }}
    .metric-card::before {{
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 3px;
      background: var(--card-accent, var(--primary));
    }}
    .metric-label {{
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }}
    .metric-value {{
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }}
    .grid-tests {{
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
      gap: 24px;
    }}
    .test-card {{
      background: var(--surface-card);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      transition: transform 0.2s ease, border-color 0.2s ease;
    }}
    .test-card:hover {{
      transform: translateY(-2px);
      border-color: var(--primary);
    }}
    .test-header {{
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
    }}
    .test-title-group {{
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }}
    .status-badge {{
      font-size: 11px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 6px;
      letter-spacing: 0.05em;
    }}
    .test-title {{
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
    }}
    .test-time {{
      font-size: 12px;
      color: var(--text-muted);
      font-family: 'JetBrains Mono', monospace;
      white-space: nowrap;
    }}
    .test-desc {{
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.4;
    }}
    .screenshot-container {{
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: #000;
      height: 220px;
      position: relative;
    }}
    .screenshot-container img {{
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: top;
      cursor: zoom-in;
      transition: transform 0.3s ease;
    }}
    .screenshot-container img:hover {{
      transform: scale(1.03);
    }}
    .error-box {{
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-family: 'JetBrains Mono', monospace;
      word-break: break-all;
    }}
    /* Modal Lightbox */
    .modal-backdrop {{
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.85);
      backdrop-filter: blur(8px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }}
    .modal-backdrop.active {{
      display: flex;
    }}
    .modal-content {{
      max-width: 90vw;
      max-height: 90vh;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }}
    .modal-header {{
      padding: 12px 18px;
      border-bottom: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }}
    .modal-title {{
      font-size: 14px;
      font-weight: 600;
    }}
    .modal-close {{
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 20px;
      cursor: pointer;
      line-height: 1;
    }}
    .modal-close:hover {{
      color: #fff;
    }}
    .modal-img-container {{
      overflow: auto;
      max-height: calc(90vh - 60px);
      background: #000;
      text-align: center;
    }}
    .modal-img-container img {{
      max-width: 100%;
      height: auto;
      display: block;
    }}
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <h1 class="brand-title">Suíte Completa de Testes Automatizados E2E</h1>
        <p class="brand-subtitle">Precifiq - Sistema de Gestão e Precificação • Cobertura Integral de Módulos, Telas e Multi-Tenant</p>
      </div>
      <div class="timestamp-badge">
        📅 {datetime.now().strftime('%d/%m/%Y %H:%M:%S')}
      </div>
    </header>

    <div class="metrics-grid">
      <div class="metric-card" style="--card-accent: #3b82f6;">
        <span class="metric-label">Total de Testes</span>
        <span class="metric-value">{total_tests}</span>
      </div>
      <div class="metric-card" style="--card-accent: #10b981;">
        <span class="metric-label">Aprovados (Pass)</span>
        <span class="metric-value" style="color: #10b981;">{passed_tests}</span>
      </div>
      <div class="metric-card" style="--card-accent: {('#ef4444' if failed_tests > 0 else '#64748b')};">
        <span class="metric-label">Falhas / Erros</span>
        <span class="metric-value" style="color: {('#ef4444' if failed_tests > 0 else '#64748b')};">{failed_tests}</span>
      </div>
      <div class="metric-card" style="--card-accent: #f59e0b;">
        <span class="metric-label">Taxa de Sucesso</span>
        <span class="metric-value" style="color: #f59e0b;">{pass_rate:.1f}%</span>
      </div>
      <div class="metric-card" style="--card-accent: #8b5cf6;">
        <span class="metric-label">Tempo Total</span>
        <span class="metric-value">{total_duration:.1f}s</span>
      </div>
    </div>

    <div class="grid-tests">
      {cards_html}
    </div>
  </div>

  <!-- Modal Lightbox -->
  <div id="imageModal" class="modal-backdrop" onclick="closeModal()">
    <div class="modal-content" onclick="event.stopPropagation()">
      <div class="modal-header">
        <span id="modalTitle" class="modal-title"></span>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div class="modal-img-container">
        <img id="modalImg" src="" alt="" />
      </div>
    </div>
  </div>

  <script>
    function openModal(src, title) {{
      document.getElementById('modalImg').src = src;
      document.getElementById('modalTitle').textContent = title;
      document.getElementById('imageModal').classList.add('active');
    }}
    function closeModal() {{
      document.getElementById('imageModal').classList.remove('active');
    }}
    document.addEventListener('keydown', (e) => {{
      if (e.key === 'Escape') closeModal();
    }});
  </script>
</body>
</html>
"""
    with open(REPORT_HTML_PATH, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"\n[SUCESSO] Relatorio executivo HTML gerado com sucesso em: {REPORT_HTML_PATH}")


def main():
    print("=" * 70)
    print("  INICIANDO SUÍTE DE TESTES AUTOMATIZADOS E2E COM CAPTURA DE TELAS")
    print("  Sistema: Precifiq - Sistema de Gestão e Precificação")
    print("  Ambiente: Headless Edge (1440x900)")
    print("=" * 70)

    suite = unittest.TestLoader().loadTestsFromTestCase(PrecificSistemaCompletoTest)
    runner = unittest.TextTestRunner(resultclass=CustomTestResult, verbosity=0)

    start_time = time.time()
    result = runner.run(suite)
    total_duration = time.time() - start_time

    # Gera o relatório HTML
    generate_html_report(result.test_details, total_duration)

    print("\n" + "=" * 70)
    print(f"  RESUMO FINAL: {len(result.test_details)} testes executados em {total_duration:.2f}s")
    passed = sum(1 for r in result.test_details if r["status"] == "PASS")
    failed = len(result.test_details) - passed
    print(f"  Aprovados: {passed} | Falhas: {failed}")
    print("=" * 70)

    if failed > 0:
        sys.exit(1)


if __name__ == "__main__":
    main()
