-- ==============================================================================
-- MIGRATION: RECRIAÇÃO COMPLETA DO BANCO NO SCHEMA 'controle'
-- ==============================================================================
-- Compatível com: PostgreSQL Local (Docker), Hostinger VPS e NeonDB (Cloud).
-- Schema alvo: controle
-- Data de geração: 2026-09-03
-- ==============================================================================

-- 0. Gerenciamento e Isolamento do Schema 'controle'
-- Dropar schema 'controle' anterior (não toca no schema public)
DROP SCHEMA IF EXISTS controle CASCADE;

-- Criar novo schema 'controle'
CREATE SCHEMA controle;

-- Configurar search_path para que todos os comandos desta sessão usem o schema 'controle'
SET search_path TO controle;

-- Conceder permissões no schema
GRANT ALL ON SCHEMA controle TO CURRENT_USER;
GRANT ALL ON SCHEMA controle TO public;

-- ==============================================================================
-- 1. ESTRUTURA DAS TABELAS (SCHEMA: controle)
-- ==============================================================================
SET search_path TO controle;

-- 1.1 Unidades de Medida
CREATE TABLE controle.unidade_medida (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    sigla VARCHAR(20) UNIQUE NOT NULL
);

-- 1.2 Fornecedores
CREATE TABLE controle.fornecedor (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    nome_fantasia VARCHAR(255),
    cnpj_cpf VARCHAR(20) UNIQUE NOT NULL,
    mnemonico VARCHAR(50),
    endereco_completo VARCHAR(255),
    cep VARCHAR(10),
    uf VARCHAR(2),
    email VARCHAR(100),
    telefones VARCHAR(100),
    banco VARCHAR(100),
    agencia VARCHAR(20),
    conta_corrente VARCHAR(30),
    chave_pix VARCHAR(100),
    categoria VARCHAR(50),
    prazo_pagamento_padrao VARCHAR(50),
    historico_atendimento TEXT,
    nome_empresa VARCHAR(200)
);

-- 1.3 Clientes
CREATE TABLE controle.cliente (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    email VARCHAR(100),
    endereco VARCHAR(255)
);

-- 1.4 Insumos
CREATE TABLE controle.insumo (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    unidade_medida_id INTEGER NOT NULL REFERENCES controle.unidade_medida(id),
    quantidade_por_embalagem DOUBLE PRECISION,
    unidade_embalagem_id INTEGER REFERENCES controle.unidade_medida(id),
    fornecedor_id INTEGER REFERENCES controle.fornecedor(id),
    preco DOUBLE PRECISION NOT NULL,
    is_embalagem BOOLEAN NOT NULL DEFAULT FALSE,
    estoque DOUBLE PRECISION DEFAULT 0.0,
    estoque_minimo DOUBLE PRECISION DEFAULT 0.0
);

-- 1.5 Tabelas Auxiliares de Estoque
CREATE TABLE controle.estoque_minimo_insumo_aux (
    insumo_id INTEGER PRIMARY KEY,
    estoque_minimo DOUBLE PRECISION DEFAULT 0.0
);

CREATE TABLE controle.estoque_variacao_aux (
    variacao_id INTEGER PRIMARY KEY,
    estoque DOUBLE PRECISION DEFAULT 0.0
);

CREATE TABLE controle.unidade_compra_insumo (
    id SERIAL PRIMARY KEY,
    insumo_id INTEGER NOT NULL REFERENCES controle.insumo(id) ON DELETE CASCADE,
    nome_embalagem VARCHAR(100) NOT NULL,
    fator_conversao DOUBLE PRECISION NOT NULL,
    preco_embalagem DOUBLE PRECISION,
    codigo_barras VARCHAR(50),
    criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_unidade_compra_insumo ON controle.unidade_compra_insumo(insumo_id);

CREATE TABLE controle.funcionario (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    salario_bruto DOUBLE PRECISION NOT NULL
);

CREATE TABLE controle.movimento_estoque_insumo (
    id SERIAL PRIMARY KEY,
    insumo_id INTEGER NOT NULL REFERENCES controle.insumo(id) ON DELETE RESTRICT,
    tipo VARCHAR(30) NOT NULL,
    quantidade DOUBLE PRECISION NOT NULL,
    saldo_anterior DOUBLE PRECISION NOT NULL,
    saldo_posterior DOUBLE PRECISION NOT NULL,
    origem_referencia VARCHAR(50),
    referencia_id INTEGER,
    motivo TEXT,
    criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    criado_por INTEGER REFERENCES controle.funcionario(id) ON DELETE SET NULL
);

CREATE INDEX idx_mov_estoque_insumo ON controle.movimento_estoque_insumo(insumo_id);
CREATE INDEX idx_mov_estoque_tipo ON controle.movimento_estoque_insumo(tipo);
CREATE INDEX idx_mov_estoque_data ON controle.movimento_estoque_insumo(criado_em);

-- 1.6 Despesas Fixas e Configurações Globais
CREATE TABLE controle.despesa_fixa (
    id SERIAL PRIMARY KEY,
    descricao VARCHAR(200) NOT NULL,
    valor_mensal DOUBLE PRECISION NOT NULL
);

CREATE TABLE controle.configuracao_global (
    id INTEGER PRIMARY KEY DEFAULT 1,
    horas_trabalhadas_por_semana DOUBLE PRECISION NOT NULL DEFAULT 44.0,
    total_salarios DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    total_despesas_fixas DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    custo_minuto_trabalho DOUBLE PRECISION NOT NULL DEFAULT 0.0
);

CREATE TABLE controle.log_auditoria (
    id SERIAL PRIMARY KEY,
    usuario_id INTEGER NOT NULL,
    data_hora TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    operacao VARCHAR(50) NOT NULL,
    tabela VARCHAR(100) NOT NULL,
    registro_id INTEGER NOT NULL,
    dados_antigos TEXT,
    dados_novos TEXT
);

-- 1.7 Produtos Finais, Variações e Fichas Técnicas
CREATE TABLE controle.produto_final (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(200) NOT NULL,
    descricao TEXT NOT NULL,
    rendimento_receita_base DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    rotulo TEXT
);

CREATE TABLE controle.produto_variacao (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER NOT NULL REFERENCES controle.produto_final(id) ON DELETE CASCADE,
    nome_tamanho VARCHAR(100) NOT NULL,
    tamanho_medida DOUBLE PRECISION NOT NULL,
    unidade_medida_tamanho_id INTEGER NOT NULL REFERENCES controle.unidade_medida(id),
    embalagem_insumo_id INTEGER REFERENCES controle.insumo(id),
    tempo_producao_minutos DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    margem_lucro DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    preco_venda DOUBLE PRECISION NOT NULL,
    custo_unitario_calculado DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    estoque DOUBLE PRECISION NOT NULL DEFAULT 0.0
);

CREATE TABLE controle.variacao_material (
    id SERIAL PRIMARY KEY,
    variacao_id INTEGER NOT NULL REFERENCES controle.produto_variacao(id) ON DELETE CASCADE,
    insumo_id INTEGER NOT NULL REFERENCES controle.insumo(id) ON DELETE RESTRICT,
    quantidade DOUBLE PRECISION NOT NULL DEFAULT 1.0
);

CREATE INDEX idx_variacao_material_var ON controle.variacao_material(variacao_id);

CREATE TABLE controle.receita_insumo (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER NOT NULL REFERENCES controle.produto_final(id) ON DELETE CASCADE,
    insumo_id INTEGER NOT NULL REFERENCES controle.insumo(id) ON DELETE RESTRICT,
    quantidade_usada DOUBLE PRECISION NOT NULL
);

-- 1.8 Kits de Produtos
CREATE TABLE controle.kits (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    margem_lucro DOUBLE PRECISION NOT NULL,
    custo_total_calculado DOUBLE PRECISION NOT NULL,
    preco_venda DOUBLE PRECISION NOT NULL
);

CREATE TABLE controle.kit_itens (
    id SERIAL PRIMARY KEY,
    kit_id INTEGER NOT NULL REFERENCES controle.kits(id) ON DELETE CASCADE,
    produto_variacao_id INTEGER NOT NULL REFERENCES controle.produto_variacao(id) ON DELETE RESTRICT,
    quantidade INTEGER NOT NULL
);

-- 1.9 Orçamentos e Cotações de Compra
CREATE TABLE controle.orcamento_compra (
    id SERIAL PRIMARY KEY,
    titulo VARCHAR(200) NOT NULL,
    data_criacao TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL,
    observacoes TEXT,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    frete DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    desconto DOUBLE PRECISION NOT NULL DEFAULT 0.0
);

CREATE TABLE controle.item_orcamento (
    id SERIAL PRIMARY KEY,
    orcamento_id INTEGER NOT NULL REFERENCES controle.orcamento_compra(id) ON DELETE CASCADE,
    insumo_id INTEGER NOT NULL REFERENCES controle.insumo(id),
    quantidade DOUBLE PRECISION NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    quantidade_recebida DOUBLE PRECISION,
    preco_unitario_recebido DOUBLE PRECISION,
    valor_final_item DOUBLE PRECISION
);

CREATE TABLE controle.cotacao_fornecedor (
    id SERIAL PRIMARY KEY,
    item_orcamento_id INTEGER NOT NULL REFERENCES controle.item_orcamento(id) ON DELETE CASCADE,
    fornecedor_id INTEGER NOT NULL REFERENCES controle.fornecedor(id),
    preco_unitario DOUBLE PRECISION DEFAULT 0.0,
    preco_cotado DOUBLE PRECISION DEFAULT 0.0
);

-- 1.10 Pedidos de Compra
CREATE TABLE controle.pedido_compra (
    id SERIAL PRIMARY KEY,
    orcamento_id INTEGER NOT NULL REFERENCES controle.orcamento_compra(id),
    fornecedor_id INTEGER NOT NULL REFERENCES controle.fornecedor(id),
    data_confirmacao TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valor_total_itens DOUBLE PRECISION NOT NULL,
    valor_frete DOUBLE PRECISION NOT NULL,
    valor_final_confirmado DOUBLE PRECISION NOT NULL,
    forma_pagamento VARCHAR(20) NOT NULL
);

CREATE TABLE controle.pedido_compra_item (
    id SERIAL PRIMARY KEY,
    pedido_compra_id INTEGER NOT NULL REFERENCES controle.pedido_compra(id) ON DELETE CASCADE,
    item_orcamento_id INTEGER NOT NULL REFERENCES controle.item_orcamento(id),
    insumo_id INTEGER REFERENCES controle.insumo(id),
    quantidade DOUBLE PRECISION NOT NULL,
    preco_unitario DOUBLE PRECISION NOT NULL
);

-- 1.11 Compras
CREATE TABLE controle.compra (
    id SERIAL PRIMARY KEY,
    orcamento_id INTEGER REFERENCES controle.orcamento_compra(id),
    fornecedor_id INTEGER REFERENCES controle.fornecedor(id),
    justificativa VARCHAR(500),
    data_prevista TIMESTAMP WITHOUT TIME ZONE,
    data_criacao TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL,
    valor_total DOUBLE PRECISION NOT NULL DEFAULT 0.0
);

CREATE TABLE controle.item_compra (
    id SERIAL PRIMARY KEY,
    compra_id INTEGER NOT NULL REFERENCES controle.compra(id) ON DELETE CASCADE,
    item_orcamento_id INTEGER,
    insumo_id INTEGER NOT NULL REFERENCES controle.insumo(id),
    quantidade_solicitada DOUBLE PRECISION NOT NULL,
    quantidade_comprada DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    quantidade_recebida DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    preco_unitario DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    fornecedor_sugerido_id INTEGER REFERENCES controle.fornecedor(id),
    ativo BOOLEAN NOT NULL DEFAULT TRUE
);

-- 1.12 Pedidos Operacionais (Vendas)
CREATE TABLE controle.pedido (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES controle.cliente(id),
    valor DOUBLE PRECISION,
    forma_pagamento VARCHAR(50) NOT NULL,
    data_pagamento VARCHAR(20),
    entregue BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE controle.pedido_item (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES controle.pedido(id) ON DELETE CASCADE,
    nome_produto VARCHAR(255) NOT NULL,
    quantidade INTEGER NOT NULL,
    preco_unitario DOUBLE PRECISION NOT NULL
);

-- 1.13 Domínio Financeiro
CREATE TABLE controle.pedidos_financeiro (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES controle.cliente(id),
    data_pedido TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valor_total DOUBLE PRECISION NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDENTE'
);

CREATE TABLE controle.transacoes_financeiras (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER REFERENCES controle.pedidos_financeiro(id) ON DELETE CASCADE,
    tipo VARCHAR(20) NOT NULL,
    valor DOUBLE PRECISION NOT NULL,
    data_transacao TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    forma_pagamento VARCHAR(50),
    taxas DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    valor_liquido DOUBLE PRECISION NOT NULL,
    descricao TEXT
);

CREATE TABLE controle.historico_cobranca (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES controle.pedidos_financeiro(id) ON DELETE CASCADE,
    data_cobranca TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    mensagem TEXT NOT NULL,
    status VARCHAR(50) NOT NULL
);

-- 1.14 Domínio de Operações de Estoque
CREATE TABLE controle.itens_estoque (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    tipo VARCHAR(50) NOT NULL,
    unidade_medida VARCHAR(20) NOT NULL,
    quantidade DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    custo_unitario DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    estoque_minimo DOUBLE PRECISION NOT NULL DEFAULT 0.0
);

CREATE TABLE controle.movimentacoes_estoque (
    id SERIAL PRIMARY KEY,
    item_id INTEGER NOT NULL REFERENCES controle.itens_estoque(id) ON DELETE CASCADE,
    tipo VARCHAR(50) NOT NULL,
    quantidade DOUBLE PRECISION NOT NULL,
    data_movimentacao TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    custo_unitario_na_movimentacao DOUBLE PRECISION NOT NULL,
    observacao TEXT
);

CREATE TABLE controle.ordens_producao (
    id SERIAL PRIMARY KEY,
    produto_acabado_id INTEGER NOT NULL REFERENCES controle.itens_estoque(id),
    quantidade_produzida DOUBLE PRECISION NOT NULL,
    data_ordem TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDENTE',
    custo_total_calculado DOUBLE PRECISION
);

-- ==============================================================================
-- 2. CARGA DE DADOS INICIAIS NO SCHEMA 'controle'
-- ==============================================================================
SET search_path TO controle;

-- 2.1 Unidades de Medida
INSERT INTO controle.unidade_medida (id, nome, sigla) VALUES
(1, 'Litro', 'L'),
(2, 'Unidade', 'un'),
(3, 'Mililitro', 'ml'),
(4, 'Quilograma', 'kg'),
(5, 'Grama', 'g'),
(6, 'Peça', 'pc'),
(7, 'Pacote', 'pct'),
(8, 'Metro', 'm'),
(9, 'Centímetro', 'cm'),
(10, 'Milímetro', 'mm'),
(11, 'Miligrama', 'mg'),
(12, 'Metro cúbico', 'm³'),
(13, 'Caixa', 'cx'),
(14, 'Rolo', 'rl');

-- 2.2 Fornecedores (fornecedores.txt)
INSERT INTO controle.fornecedor (id, nome, nome_fantasia, cnpj_cpf, uf, email, telefones) VALUES
(2, 'IMPERIO DAS ESSENCIAS LTDA', NULL, '03.706.592/0002-30', 'SP', NULL, '(11) 2896-7030'),
(3, 'Vanessa Gonçalves Coutinho', NULL, '38.308.074/0001-62', 'SP', 'casavidro.shop@gmail.com', '(11) 97631-7568'),
(4, 'Lin Pei Yu', NULL, '46.119.943/0001-39', 'SP', NULL, NULL),
(5, 'Destilaria Bauru Eireli', NULL, '11.143.171/0001-96', 'SP', NULL, '(17) 3524-6284'),
(6, 'Fonte dos Frascos Ltda', NULL, '45.063.126/0001-43', 'SP', 'fontesdosfrascos@yahoo.com', '(11) 95404-2618'),
(7, 'Central de Art Comercio de Embalagens e Produtos Alimenticios', NULL, '13.924.118/0001-58', NULL, NULL, NULL),
(8, 'Martha Ferreira de Almeida', NULL, '46.461.882/0001-93', 'SP', NULL, '(11) 91475-9163'),
(9, 'Flower', NULL, '48.901.776/0001-09', 'SP', 'flowerprodutos@gmail.com', '(11) 94887-2186'),
(16, 'Piter Paiva', NULL, '32.952.310/0001-00', 'SP', NULL, '(11) 5594-8335'),
(17, 'Essencia da Ceci', NULL, '371.768.036-68', 'SP', NULL, NULL),
(18, 'Godinho Ramiro', NULL, '47.911.734/0001-96', 'SP', NULL, '(11) 99241-6270'),
(19, 'Alecrim Essencia e Limpeza', NULL, '48.983.774/0001-06', 'SP', NULL, NULL),
(20, '21 Quimica Distribuidora de produtos', NULL, '38.307.394/0001-06', NULL, NULL, '(11) 98504-6472'),
(21, 'Terumã Agropecuaria Comercial Eireli', NULL, '57.283.327/0001-35', NULL, NULL, '(11) 3645-1065'),
(22, 'Open Festas Comercia de Produtos', NULL, '50.020.591/0001-37', 'DF', NULL, '(61)3339-176'),
(23, 'Colibri Papelaria e Armarinho', NULL, '08.369.238/0001-09', 'DF', NULL, '(61) 3335-2438'),
(24, 'Big Essencia e Decorações LTDA', NULL, '45.757.589/0001-05', 'MG', 'logisticasbigessencias01@gmail.com', '(31) 7319-9636'),
(25, 'Sueli Guilherme Cosme Dos Santos ME', NULL, '02.364.916/0001-00', 'DF', NULL, '(61) 3335-5449'),
(74, 'Quimisulsc', 'Quimisulsc', '24.788.909/0001-14', NULL, 'vendas@quimisulsc.com.br', '(47) 9762-0757'),
(75, 'Olfativestore Comercio de Embalagem', NULL, '09.558.710/0001-06', 'SP', NULL, NULL),
(76, 'Thessencia LTDA', NULL, '41.562.790/0001-86', 'SP', NULL, NULL),
(77, 'CANTINHO DAS ESSENCIAS LTDA', NULL, '57.186.456/0001-05', 'SP', 'vendas@cantinhodasessencias.com.br', '(15) 99109-2070');

-- 2.3 Insumos (insumos.json)
INSERT INTO controle.insumo (id, nome, unidade_medida_id, quantidade_por_embalagem, fornecedor_id, preco, is_embalagem, estoque) VALUES
(1, 'Frasco Pet Cilíndrico 60ml Rosca 20/410mm', 3, 60, 6, 1.45, TRUE, 38),
(2, 'Frasco  Pet  Borrifador  Spray  Mini Gatilho', 3, 200, 76, 3.93, TRUE, 3),
(3, 'Álcool de Cereais perfumaria 5 L', 3, 5000, 20, 73.79, FALSE, 1),
(4, 'Cocoamidopropril betaina 5 L', 3, 5000, 74, 129.48, FALSE, 4000),
(5, 'Essencias Diversas 500 ml', 3, 500, 16, 129.5, FALSE, 0),
(6, 'Vidro Topazio G28 300 ML Tampa prata', 3, 300, 16, 7.15, TRUE, 7),
(7, 'Renex 95', 3, 1000, NULL, 40, FALSE, 1000),
(8, 'Frasco Topazio 300ML transparente', 3, 300, 3, 9.2, TRUE, 4),
(9, 'Frasco  Vidro Esmeralda 350ml Rosca 28/410', 3, 350, 3, 11.78, TRUE, 4),
(10, 'Frasco Rubi Transparente 300ml', 3, 300, 3, 7.91, TRUE, 4),
(11, 'Tampa Luxo Dourada Rosca 28 com furo', 3, NULL, 3, 2.68, TRUE, 10),
(12, 'Válvula Saboneteira Prime Dourada', 6, NULL, 3, 6.89, TRUE, 2),
(13, 'Frasco Topazio 300ML Degrade Preto com Azul do Mar', 3, 300, 3, 15.1, TRUE, 2),
(14, 'Frasco  vidro Brilhante 350ml rosca 28/410', 6, 350, 3, 12.5, TRUE, 4),
(15, 'Essencia Bamboo  MM 100ml', 3, 100, 2, 24.21, FALSE, 5),
(16, 'Frasco  Pet Premium Ambar 250ml Rosca 24/415', 3, NULL, 2, 2.5, TRUE, 25),
(17, 'Frasco  Pet Cristal Premium 250ml rosca 28/410', 3, 250, 75, 2.63, TRUE, 38),
(18, 'Tampa de Metal  ouro com furo 28/410', 6, NULL, 2, 0.85, TRUE, 25),
(19, 'Tampa Metal Prata com furo 28/410', 6, NULL, 2, 0.85, TRUE, 25),
(20, 'Válvula Preta Spray Lisa 24/415', 6, NULL, 2, 1.5, TRUE, 25),
(21, 'Lauril  Líquido', 3, 1000, 4, 130, FALSE, 2000),
(22, 'Vidro aromatizador de carrro 10ml', 3, NULL, 7, 82, TRUE, 80),
(23, 'Glicerina Bi - distilada USP 5L', 3, 1000, 8, 85, FALSE, 0),
(24, 'Saco Adesivado Numero 6 com furo 10x15', 7, 100, 22, 10.59, TRUE, 0),
(25, 'Pérola para decoração Amarela', 2, NULL, 23, 4.99, TRUE, 63),
(26, 'Fita de Cetim Champangne', 8, 10, 23, 3.9, TRUE, 1),
(27, 'Fita Cetim Azul Bebe', 8, 10, 23, 3.9, TRUE, 0),
(28, 'Fita Cetim Verde', 8, 10, 23, 3.9, TRUE, 0),
(29, 'Fita Cetim Rosa Velho', 8, 10, 23, 3.9, TRUE, 0),
(30, 'Fita Cetim Lilas Lavanda', 8, 10, 23, 3.9, TRUE, 1),
(31, 'Fita Cetim Laranja', 8, 10, 23, 3.9, TRUE, 1),
(32, 'Pérola N8 Lilás Lavanda', 5, NULL, 25, 7.99, TRUE, 50),
(33, 'Pérola N10 Branca', 5, 50, 25, 7.99, TRUE, 50),
(34, 'Pérola N8 Rosa', 5, NULL, 25, 7.99, TRUE, 50),
(35, 'Pérola N8 Verde Bebê', 5, NULL, 25, 7.99, TRUE, 50),
(36, 'Pérola N10 Perolada', 5, NULL, 25, 7.99, TRUE, 50),
(37, 'Pérola N16 decoração gota branca', 2, 1, 25, 8.99, TRUE, 50),
(38, 'Pérola N16 decoração gota perolada', 5, NULL, 25, 8.99, TRUE, 50),
(39, 'Ácido Esteárico - Estearina Tripla Pressão', 5, 1000, 5, 49.9, FALSE, 0),
(40, 'Óleo Vegetal Mamona(Ricino) Prensado a Frio Extra Virgem', 3, 500000, 5, 25.1, FALSE, 0),
(41, 'Dioxido de Titanio', 5, 100, 5, 24.75, FALSE, 0),
(42, 'Oleo Vegetal Semente de Uva Refinado', 3, 500000, 5, 47.9, FALSE, 0),
(43, 'Base Sabonete Líquido 0% Lauril', 3, 1000, 5, 36.95, FALSE, 1),
(44, 'Base Para Sabonete/Shampoo Líquido Perolado', 3, 1000, 5, 22.9, FALSE, 0),
(45, 'Oléo Essencial Bergamota Italia Reggio', 3, 10, 5, 22.9, FALSE, 0),
(46, 'Oléo Essencial Laranja Pera Doce', 3, 10, 5, 19.9, FALSE, 0),
(47, 'Essencia de Mel Aromatizadores/Cosmeticos', 3, 100, 5, 24.32, FALSE, 0),
(48, 'Oléo Vegetal  Palma Prensado Frio Extra Virgem', 3, 1000, 5, 45.9, FALSE, 0),
(49, 'Oléo Vegetal de Coco Prensado Frio Extra Virgem', 3, 1000, 5, 71.9, FALSE, 0),
(50, 'Oléo Resina de Alecrim', 3, 10, 5, 18.9, FALSE, 0),
(51, 'Soda Cáustica Escama 99%', 5, 1000, 5, 25, FALSE, 0),
(52, 'Oléo Essencial de Alecrim Rosmarinus', 3, 20, 5, 21.1, FALSE, 0),
(53, 'Oléo Essencial de Lavandim Grosso', 3, 20, 5, 14.8, FALSE, 0),
(54, 'Estearina de Palma', 5, 1000, 5, 44.9, FALSE, 0),
(56, 'Uréia', 5, 1000, 5, 24.9, FALSE, 0),
(57, 'Ninpaguard SCE Conservante', 5, 100, 5, 55.9, FALSE, 0),
(58, 'Água Destilada', 3, 5000, NULL, 15.99, FALSE, 1),
(59, 'Frasco Vidro Octogonal  200ml', 3, 200, NULL, 12, TRUE, 1),
(60, 'Essência Hidrossolúvel Cascas E Folhas 500g', 3, 500, 77, 72.9, FALSE, 1),
(61, 'Essência Hidrossolúvel Alecrim 500g', 5, 500, 77, 69.9, FALSE, 1),
(62, 'Essência Hidrossolúvel Chá Branco 500g', 5, 500, 77, 59.9, FALSE, 1),
(63, 'Essência Hidrossoluvel  Lavanda 500g', 5, 500, 77, 69.9, FALSE, 1),
(64, 'Essência Hidrossolúvel Flor De Cerejeira 500g', 5, 500, 77, 59.9, FALSE, 1),
(65, 'Essência Hidrossolúvel Capim Limão 500g', 5, 500, 77, 59.9, FALSE, 1),
(66, 'Tampa Lacre Branca Rosca 28/410mm', 6, NULL, 77, 0.2, TRUE, 50),
(67, 'Frasco Pet Cilíndrico 60ml Rosca 20/410mm Spray', 3, 60, 77, 0.85, TRUE, 33),
(68, 'Essência Citronela 100g', 5, 100, 77, 22.9, FALSE, 1),
(69, 'Essência Hidrossolúvel Cheirinho De Bebê 500g', 5, 500, 77, 63.9, FALSE, 1),
(70, 'Essência Hidrossolúvel Flor De Laranjeira 500g', 5, NULL, 77, 66.9, FALSE, 1),
(71, 'Essência Hidrossolúvel Limão Siciliano 500g', 5, 500, 77, 60.2, FALSE, 1),
(72, 'Essência Hidrossolúvel Bambu 500g', 5, 500, 77, 66.9, FALSE, 1),
(73, 'Essência Hidrossolúvel Flor De Algodão 500g', 5, 500, 77, 59.9, FALSE, 1),
(74, 'Tampa Flip Top Branca Rosca 18/410mm', 6, NULL, 77, 0.25, TRUE, 25),
(75, 'Tampa Furada Alumínio Prata Rosca 28/410mm', 6, NULL, NULL, 0.6, FALSE, 15),
(76, 'Válvula Spray Branca Rosca 20/410mm', 6, NULL, 77, 1.2, TRUE, 35),
(77, 'Essência Hidrossolúvel Verbena 500g', 5, 500, 77, 61.9, FALSE, 1);

-- 2.4 Configuração Global Inicial
INSERT INTO controle.configuracao_global (id, horas_trabalhadas_por_semana) VALUES (1, 44.0)
ON CONFLICT (id) DO NOTHING;

-- ==============================================================================
-- 3. ATUALIZAÇÃO DAS SEQUENCES NO SCHEMA 'controle'
-- ==============================================================================
SET search_path TO controle;
SELECT setval('controle.unidade_medida_id_seq', (SELECT COALESCE(MAX(id), 1) FROM controle.unidade_medida));
SELECT setval('controle.fornecedor_id_seq', (SELECT COALESCE(MAX(id), 1) FROM controle.fornecedor));
SELECT setval('controle.insumo_id_seq', (SELECT COALESCE(MAX(id), 1) FROM controle.insumo));
SELECT setval('controle.cliente_id_seq', 1, false);
SELECT setval('controle.produto_final_id_seq', 1, false);
SELECT setval('controle.produto_variacao_id_seq', 1, false);
SELECT setval('controle.variacao_material_id_seq', 1, false);
SELECT setval('controle.receita_insumo_id_seq', 1, false);
SELECT setval('controle.kits_id_seq', 1, false);
SELECT setval('controle.kit_itens_id_seq', 1, false);
SELECT setval('controle.orcamento_compra_id_seq', 1, false);
SELECT setval('controle.item_orcamento_id_seq', 1, false);
SELECT setval('controle.cotacao_fornecedor_id_seq', 1, false);
SELECT setval('controle.pedido_compra_id_seq', 1, false);
SELECT setval('controle.pedido_compra_item_id_seq', 1, false);
SELECT setval('controle.compra_id_seq', 1, false);
SELECT setval('controle.item_compra_id_seq', 1, false);
SELECT setval('controle.pedido_id_seq', 1, false);
SELECT setval('controle.pedido_item_id_seq', 1, false);
SELECT setval('controle.funcionario_id_seq', 1, false);
SELECT setval('controle.despesa_fixa_id_seq', 1, false);
SELECT setval('controle.log_auditoria_id_seq', 1, false);
SELECT setval('controle.pedidos_financeiro_id_seq', 1, false);
SELECT setval('controle.transacoes_financeiras_id_seq', 1, false);
SELECT setval('controle.historico_cobranca_id_seq', 1, false);
SELECT setval('controle.itens_estoque_id_seq', 1, false);
SELECT setval('controle.movimentacoes_estoque_id_seq', 1, false);
SELECT setval('controle.ordens_producao_id_seq', 1, false);
SELECT setval('controle.unidade_compra_insumo_id_seq', 1, false);
SELECT setval('controle.movimento_estoque_insumo_id_seq', 1, false);

-- ==============================================================================
-- FIM DA MIGRATION NO SCHEMA 'controle'
-- ==============================================================================
