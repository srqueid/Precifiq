"""
Suíte de Testes Automatizados E2E do Precifiq - Sistema de Gestão e Precificação
Cobre todas as funções, módulos e telas do sistema, capturando screenshots de alta resolução.
"""

import os
import time
import unittest
from selenium import webdriver
from selenium.webdriver.edge.options import Options as EdgeOptions
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC

BASE_URL = os.getenv("PRECIFIC_URL", "http://localhost:5173")
SCREENSHOTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)


class PrecificSistemaCompletoTest(unittest.TestCase):
    driver: webdriver.Edge = None

    @classmethod
    def setUpClass(cls):
        options = EdgeOptions()
        options.add_argument("--headless=new")
        options.add_argument("--disable-gpu")
        options.add_argument("--no-sandbox")
        options.add_argument("--window-size=1440,900")
        options.add_argument("--disable-dev-shm-usage")
        options.add_argument("--force-device-scale-factor=1")
        
        cls.driver = webdriver.Edge(options=options)
        cls.driver.implicitly_wait(4)
        cls.wait = WebDriverWait(cls.driver, 10)

        # Login inicial automatizado como superusuário (admin@dcsys.com)
        cls.driver.get(BASE_URL)
        time.sleep(1.0)
        try:
            email_inputs = cls.driver.find_elements(By.CSS_SELECTOR, "input[type='email']")
            if email_inputs:
                email_inputs[0].clear()
                email_inputs[0].send_keys("admin@dcsys.com")
                pass_input = cls.driver.find_element(By.CSS_SELECTOR, "input[type='password']")
                pass_input.clear()
                pass_input.send_keys("admin123")
                btn_submit = cls.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
                btn_submit.click()
                WebDriverWait(cls.driver, 10).until(
                    EC.visibility_of_element_located((By.CSS_SELECTOR, ".app-main"))
                )
                time.sleep(1.0)
        except Exception as e:
            print("  [INFO SETUP] Sessão já autenticada ou bypass de login:", e)

    @classmethod
    def tearDownClass(cls):
        if cls.driver:
            cls.driver.quit()

    def capture_screen(self, filename: str, title: str = ""):
        """Salva a captura de tela na pasta screenshots."""
        time.sleep(0.8)  # Pequena pausa para garantir renderização de animações/CSS
        filepath = os.path.join(SCREENSHOTS_DIR, filename)
        self.driver.save_screenshot(filepath)
        print(f"  [SCREENSHOT] {filename} -> {title or filename}")
        return filepath

    def wait_for_visible(self, by: By, selector: str, timeout: int = 10):
        return WebDriverWait(self.driver, timeout).until(
            EC.visibility_of_element_located((by, selector))
        )

    def wait_for_clickable(self, by: By, selector: str, timeout: int = 10):
        return WebDriverWait(self.driver, timeout).until(
            EC.element_to_be_clickable((by, selector))
        )

    def test_01_dashboard(self):
        """01 - Dashboard Executivo: KPIs, gráficos e resumo geral"""
        self.driver.get(f"{BASE_URL}/")
        self.wait_for_visible(By.CSS_SELECTOR, ".app-main")
        time.sleep(1.2)  # aguarda requisições de KPIs
        self.capture_screen("01_dashboard.png", "Dashboard Executivo e Métricas")
        self.assertIn("localhost", self.driver.current_url)

    def test_02_company_switcher(self):
        """02 - Company Switcher: Hierarquia Corporativa e Seletor de Empresas"""
        # Botão do Company Switcher no topo da barra lateral
        switcher_btn = self.wait_for_clickable(By.CSS_SELECTOR, "button[title*='Alternar']")
        switcher_btn.click()
        time.sleep(0.5)
        self.capture_screen("02_company_switcher.png", "Company Switcher - Dropdown de Empresas")
        # Fecha dropdown
        switcher_btn.click()
        time.sleep(0.3)

    def test_03_gestao_global_empresas(self):
        """03 - Gestão Global: Árvore Corporativa (Matrizes e Filiais)"""
        self.driver.get(f"{BASE_URL}/gestao-global")
        self.wait_for_visible(By.XPATH, "//*[contains(text(), 'Estrutura Corporativa')]")
        time.sleep(0.8)
        self.capture_screen("03_gestao_global_empresas.png", "Gestão Global - Estrutura Corporativa")

    def test_04_gestao_global_modal_filial(self):
        """04 - Gestão Global: Modal de Criação de Nova Filial com provisionamento de schema"""
        btn_nova_filial = self.wait_for_clickable(By.XPATH, "//button[contains(., 'Nova Filial')]")
        btn_nova_filial.click()
        time.sleep(0.6)
        self.capture_screen("04_gestao_global_modal_filial.png", "Gestão Global - Modal de Nova Filial")
        
        # Fecha modal clicando em Cancelar ou botão Fechar
        try:
            btn_cancelar = self.driver.find_element(By.XPATH, "//button[contains(text(), 'Cancelar')]")
            btn_cancelar.click()
        except Exception:
            self.driver.find_element(By.CSS_SELECTOR, "body").send_keys(Keys.ESCAPE)
        time.sleep(0.4)

    def test_05_gestao_global_usuarios(self):
        """05 - Gestão Global: Usuários & Acessos Globais"""
        tab_usuarios = self.wait_for_clickable(By.XPATH, "//button[contains(., 'Usuários & Acessos')]")
        tab_usuarios.click()
        time.sleep(0.8)
        self.capture_screen("05_gestao_global_usuarios.png", "Gestão Global - Usuários Centrais")

    def test_06_gestao_global_perfis(self):
        """06 - Gestão Global: Perfis de Acesso & RBAC"""
        tab_perfis = self.wait_for_clickable(By.XPATH, "//button[contains(., 'Perfis de Acesso')]")
        tab_perfis.click()
        time.sleep(0.8)
        self.capture_screen("06_gestao_global_perfis.png", "Gestão Global - Perfis e Permissões")

    def test_07_fornecedores_listagem(self):
        """07 - Gestão de Fornecedores: Listagem e Pesquisa"""
        self.driver.get(f"{BASE_URL}/fornecedores")
        self.wait_for_visible(By.CSS_SELECTOR, "#fornecedorSearch, .fornecedores-page")
        time.sleep(0.8)
        self.capture_screen("07_fornecedores_listagem.png", "Gestão de Fornecedores - Tabela de Fornecedores")

    def test_08_fornecedores_modal_cadastro(self):
        """08 - Fornecedores: Modal de Cadastro de Novo Fornecedor"""
        btn_novo = self.wait_for_clickable(By.XPATH, "//button[contains(., 'Novo Fornecedor')]")
        btn_novo.click()
        time.sleep(0.6)
        self.capture_screen("08_fornecedores_modal.png", "Fornecedores - Modal de Cadastro")
        
        # Fecha modal
        try:
            btn_fechar = self.driver.find_element(By.XPATH, "//button[contains(., 'Cancelar')]")
            btn_fechar.click()
        except Exception:
            self.driver.find_element(By.CSS_SELECTOR, "body").send_keys(Keys.ESCAPE)
        time.sleep(0.4)

    def test_09_estoque_insumos(self):
        """09 - Estoque de Insumos: Matérias-primas e Custos"""
        self.driver.get(f"{BASE_URL}/insumos")
        self.wait_for_visible(By.CSS_SELECTOR, ".app-main")
        time.sleep(1.0)
        self.capture_screen("09_estoque_insumos.png", "Estoque de Insumos e Matérias-Primas")

    def test_10_insumos_interativo(self):
        """10 - Insumos: Busca e Filtros Dinâmicos"""
        try:
            input_search = self.driver.find_element(By.CSS_SELECTOR, "input[type='text'], input[placeholder*='Buscar' i]")
            input_search.clear()
            input_search.send_keys("Tecido")
            time.sleep(0.5)
        except Exception:
            pass
        self.capture_screen("10_insumos_interativo.png", "Insumos - Filtros e Busca Dinâmica")

    def test_11_estoque_produtos(self):
        """11 - Estoque de Produtos: Saldo de Produtos Acabados"""
        self.driver.get(f"{BASE_URL}/estoque")
        self.wait_for_visible(By.CSS_SELECTOR, ".app-main")
        time.sleep(0.8)
        self.capture_screen("11_estoque_produtos.png", "Estoque de Produtos Acabados")

    def test_12_unidades_medida(self):
        """12 - Unidades de Medida: Cadastro e Fatores de Conversão"""
        self.driver.get(f"{BASE_URL}/unidades")
        self.wait_for_visible(By.CSS_SELECTOR, ".app-main")
        time.sleep(0.8)
        self.capture_screen("12_unidades_medida.png", "Unidades de Medida")

    def test_13_produtos_finais(self):
        """13 - Produtos Finais: Catálogo, Variações e Precificação"""
        self.driver.get(f"{BASE_URL}/produtos")
        self.wait_for_visible(By.CSS_SELECTOR, ".app-main")
        time.sleep(1.0)
        self.capture_screen("13_produtos_finais.png", "Produtos Finais e Variações")

    def test_14_kits_produtos(self):
        """14 - Kits de Produtos: Gestão de Combos e Margens"""
        self.driver.get(f"{BASE_URL}/kits")
        self.wait_for_visible(By.CSS_SELECTOR, ".app-main")
        time.sleep(0.8)
        self.capture_screen("14_kits_produtos.png", "Kits de Produtos e Combos")

    def test_15_orcamentos(self):
        """15 - Orçamentos: Propostas Comerciais e Cotações"""
        self.driver.get(f"{BASE_URL}/orcamentos")
        self.wait_for_visible(By.CSS_SELECTOR, ".app-main")
        time.sleep(0.8)
        self.capture_screen("15_orcamentos.png", "Painel de Orçamentos")

    def test_16_pedidos_clientes(self):
        """16 - Pedidos de Clientes: Emissão e Gestão de Vendas"""
        self.driver.get(f"{BASE_URL}/pedido")
        self.wait_for_visible(By.CSS_SELECTOR, ".app-main")
        time.sleep(0.8)
        self.capture_screen("16_pedidos_clientes.png", "Pedidos de Clientes e Vendas")

    def test_17_pedidos_compra(self):
        """17 - Pedidos de Compra: Histórico e Pedidos a Fornecedores"""
        self.driver.get(f"{BASE_URL}/pedidos")
        self.wait_for_visible(By.CSS_SELECTOR, ".app-main")
        time.sleep(0.8)
        self.capture_screen("17_pedidos_compra.png", "Pedidos de Compra a Fornecedores")

    def test_18_compras_realizadas(self):
        """18 - Compras Realizadas: Registro de Entradas e Notas"""
        self.driver.get(f"{BASE_URL}/compras")
        self.wait_for_visible(By.CSS_SELECTOR, ".app-main")
        time.sleep(0.8)
        self.capture_screen("18_compras_realizadas.png", "Registro de Compras Realizadas")

    def test_19_configuracoes_globais(self):
        """19 - Configurações: Custos Operacionais, Impostos e Markup"""
        self.driver.get(f"{BASE_URL}/configuracoes")
        self.wait_for_visible(By.CSS_SELECTOR, ".app-main")
        time.sleep(0.8)
        self.capture_screen("19_configuracoes_globais.png", "Configurações Operacionais e Markup")

    def test_20_copilot_ia_spotlight(self):
        """20 - Copilot IA: Assistente Operacional Inteligente Text-to-SQL"""
        btn_copilot = self.wait_for_clickable(By.CSS_SELECTOR, ".sidebar-copilot-btn")
        btn_copilot.click()
        time.sleep(0.8)
        self.capture_screen("20_copilot_ia_spotlight.png", "Copilot IA - Assistente Operacional Text-to-SQL")
        
        # Fecha modal do Copilot
        try:
            btn_close = self.driver.find_element(By.CSS_SELECTOR, "button[title='Fechar (Esc)'], .modal-overlay button")
            btn_close.click()
        except Exception:
            self.driver.find_element(By.CSS_SELECTOR, "body").send_keys(Keys.ESCAPE)
        time.sleep(0.6)

    def test_21_dark_mode_interface(self):
        """21 - Modo Escuro (Dark Mode): Alternância Visual da Interface"""
        try:
            btn_dark = self.wait_for_clickable(By.CSS_SELECTOR, "button[title='Modo Escuro'], button[title*='Escuro' i]")
        except Exception:
            btn_dark = self.wait_for_clickable(By.CSS_SELECTOR, ".theme-buttons-wrapper button:nth-child(2)")
        btn_dark.click()
        time.sleep(0.8)
        self.capture_screen("21_dark_mode_interface.png", "Interface no Modo Escuro (Dark Mode)")
        
        # Retorna para o tema claro
        try:
            btn_light = self.wait_for_clickable(By.CSS_SELECTOR, "button[title='Modo Claro'], button[title*='Claro' i]")
        except Exception:
            btn_light = self.wait_for_clickable(By.CSS_SELECTOR, ".theme-buttons-wrapper button:nth-child(1)")
        btn_light.click()
        time.sleep(0.4)

    def test_22_filial_isolada_multi_tenant(self):
        """22 - Isolamento Multi-Tenant: Chaveamento para Empresa/Tenant com Schema Isolado"""
        # Abre o Company Switcher
        switcher_btn = self.wait_for_clickable(By.CSS_SELECTOR, "button[title*='Alternar']")
        switcher_btn.click()
        time.sleep(0.5)
        
        # Clica em Demonstração ou Filial no dropdown
        try:
            target_btn = self.wait_for_clickable(By.XPATH, "//button[contains(., 'Demonstração') or contains(., 'Filial') or contains(., 'DEMO')]")
            target_btn.click()
            time.sleep(0.8)
        except Exception:
            pass
            
        # Navega para /fornecedores na base do tenant isolado
        self.driver.get(f"{BASE_URL}/fornecedores")
        time.sleep(1.0)
        self.capture_screen("22_filial_isolada_multi_tenant.png", "Tenant Isolado - Base Própria no PostgreSQL")
        
        # Restaura para a Matriz (Produção) para manter estado limpo
        try:
            switcher_btn = self.wait_for_clickable(By.CSS_SELECTOR, "button[title*='Alternar']")
            switcher_btn.click()
            time.sleep(0.4)
            matriz_btn = self.wait_for_clickable(By.XPATH, "//button[contains(., 'Controle Silvia')]")
            matriz_btn.click()
            time.sleep(0.5)
        except Exception:
            pass


if __name__ == "__main__":
    unittest.main(verbosity=2)
