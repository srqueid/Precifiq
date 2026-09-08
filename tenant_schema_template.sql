-- ==============================================================================
-- TEMPLATE DDL PARA PROVISIONAMENTO DE SCHEMA DE TENANT ISOLADO
-- ==============================================================================
-- Este template utiliza o placeholder %SCHEMA% que é substituído pelo nome do
-- schema da empresa (ex: emp_filial_shopping) durante o provisionamento.
-- ==============================================================================

CREATE SCHEMA IF NOT EXISTS %SCHEMA%;

GRANT ALL ON SCHEMA %SCHEMA% TO CURRENT_USER;

SET search_path TO %SCHEMA%, public;

-- 1. Unidades de Medida
CREATE TABLE IF NOT EXISTS %SCHEMA%.unidade_medida (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(100) UNIQUE NOT NULL,
    sigla VARCHAR(20) UNIQUE NOT NULL
);

-- 2. Fornecedores
CREATE TABLE IF NOT EXISTS %SCHEMA%.fornecedor (
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

-- 3. Clientes
CREATE TABLE IF NOT EXISTS %SCHEMA%.cliente (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    telefone VARCHAR(20),
    email VARCHAR(100),
    endereco VARCHAR(255)
);

-- 4. Insumos
CREATE TABLE IF NOT EXISTS %SCHEMA%.insumo (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    unidade_medida_id INTEGER NOT NULL REFERENCES %SCHEMA%.unidade_medida(id),
    quantidade_por_embalagem DOUBLE PRECISION,
    unidade_embalagem_id INTEGER REFERENCES %SCHEMA%.unidade_medida(id),
    fornecedor_id INTEGER REFERENCES %SCHEMA%.fornecedor(id),
    preco DOUBLE PRECISION NOT NULL,
    is_embalagem BOOLEAN NOT NULL DEFAULT FALSE,
    estoque DOUBLE PRECISION DEFAULT 0.0,
    estoque_minimo DOUBLE PRECISION DEFAULT 0.0
);

-- 5. Tabelas Auxiliares e Movimentações de Insumo
CREATE TABLE IF NOT EXISTS %SCHEMA%.estoque_minimo_insumo_aux (
    insumo_id INTEGER PRIMARY KEY,
    estoque_minimo DOUBLE PRECISION DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.estoque_variacao_aux (
    variacao_id INTEGER PRIMARY KEY,
    estoque DOUBLE PRECISION DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.unidade_compra_insumo (
    id SERIAL PRIMARY KEY,
    insumo_id INTEGER NOT NULL REFERENCES %SCHEMA%.insumo(id) ON DELETE CASCADE,
    nome_embalagem VARCHAR(100) NOT NULL,
    fator_conversao DOUBLE PRECISION NOT NULL,
    preco_embalagem DOUBLE PRECISION,
    codigo_barras VARCHAR(50),
    criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.movimento_estoque_insumo (
    id SERIAL PRIMARY KEY,
    insumo_id INTEGER NOT NULL REFERENCES %SCHEMA%.insumo(id) ON DELETE RESTRICT,
    tipo VARCHAR(30) NOT NULL,
    quantidade DOUBLE PRECISION NOT NULL,
    saldo_anterior DOUBLE PRECISION NOT NULL,
    saldo_posterior DOUBLE PRECISION NOT NULL,
    origem_referencia VARCHAR(50),
    referencia_id INTEGER,
    motivo TEXT,
    criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    criado_por INTEGER
);

-- 6. Produtos Finais e Variações
CREATE TABLE IF NOT EXISTS %SCHEMA%.produto_final (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    descricao TEXT,
    rendimento DOUBLE PRECISION NOT NULL,
    rotulo VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.produto_variacao (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER NOT NULL REFERENCES %SCHEMA%.produto_final(id) ON DELETE CASCADE,
    nome_tamanho VARCHAR(255) NOT NULL,
    multiplicador_receita DOUBLE PRECISION NOT NULL,
    margem_lucro DOUBLE PRECISION NOT NULL,
    tempo_producao_segundos DOUBLE PRECISION NOT NULL,
    custo_fixo_rateado DOUBLE PRECISION NOT NULL,
    peso_g DOUBLE PRECISION,
    preco_venda_manual DOUBLE PRECISION,
    descricao_visual TEXT
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.variacao_material (
    id SERIAL PRIMARY KEY,
    variacao_id INTEGER NOT NULL REFERENCES %SCHEMA%.produto_variacao(id) ON DELETE CASCADE,
    insumo_id INTEGER NOT NULL REFERENCES %SCHEMA%.insumo(id) ON DELETE RESTRICT,
    quantidade DOUBLE PRECISION NOT NULL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.receita_insumo (
    id SERIAL PRIMARY KEY,
    produto_id INTEGER NOT NULL REFERENCES %SCHEMA%.produto_final(id) ON DELETE CASCADE,
    insumo_id INTEGER NOT NULL REFERENCES %SCHEMA%.insumo(id),
    quantidade_usada DOUBLE PRECISION NOT NULL
);

-- 7. Gestão Operacional
CREATE TABLE IF NOT EXISTS %SCHEMA%.funcionario (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    salario_base DOUBLE PRECISION NOT NULL,
    dias_trabalhados_mes INTEGER NOT NULL,
    horas_trabalhadas_dia DOUBLE PRECISION NOT NULL,
    produtividade_estimada DOUBLE PRECISION NOT NULL,
    custo_hora DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.despesa_fixa (
    id SERIAL PRIMARY KEY,
    descricao VARCHAR(255) NOT NULL,
    valor_mensal DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.configuracao_global (
    id SERIAL PRIMARY KEY,
    horas_totais_trabalhadas_mes DOUBLE PRECISION NOT NULL,
    custo_hora_fabrica DOUBLE PRECISION NOT NULL,
    custo_fixo_minuto DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    custo_operacional_total_mes DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    markup_padrao DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    ultima_atualizacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.log_auditoria (
    id SERIAL PRIMARY KEY,
    entidade VARCHAR(50) NOT NULL,
    entidade_id INTEGER,
    acao VARCHAR(20) NOT NULL,
    detalhes TEXT,
    usuario VARCHAR(100),
    data_hora TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. Orçamentos e Cotações
CREATE TABLE IF NOT EXISTS %SCHEMA%.orcamento_compra (
    id SERIAL PRIMARY KEY,
    data_criacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL,
    solicitante VARCHAR(100),
    observacao TEXT
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.item_orcamento (
    id SERIAL PRIMARY KEY,
    orcamento_id INTEGER NOT NULL REFERENCES %SCHEMA%.orcamento_compra(id) ON DELETE CASCADE,
    insumo_id INTEGER NOT NULL REFERENCES %SCHEMA%.insumo(id),
    quantidade_solicitada DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.cotacao_fornecedor (
    id SERIAL PRIMARY KEY,
    item_orcamento_id INTEGER NOT NULL REFERENCES %SCHEMA%.item_orcamento(id) ON DELETE CASCADE,
    fornecedor_id INTEGER NOT NULL REFERENCES %SCHEMA%.fornecedor(id),
    preco_cotado DOUBLE PRECISION NOT NULL,
    prazo_entrega_dias INTEGER,
    condicoes_pagamento VARCHAR(100),
    selecionada BOOLEAN DEFAULT FALSE,
    observacao TEXT
);

-- 9. Pedidos de Compra e Compras
CREATE TABLE IF NOT EXISTS %SCHEMA%.pedido_compra (
    id SERIAL PRIMARY KEY,
    data_criacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fornecedor_id INTEGER NOT NULL REFERENCES %SCHEMA%.fornecedor(id),
    orcamento_id INTEGER REFERENCES %SCHEMA%.orcamento_compra(id),
    status VARCHAR(50) NOT NULL,
    valor_total DOUBLE PRECISION NOT NULL,
    prazo_entrega_acordado TIMESTAMP WITHOUT TIME ZONE,
    forma_pagamento VARCHAR(100),
    observacao TEXT
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.pedido_compra_item (
    id SERIAL PRIMARY KEY,
    pedido_compra_id INTEGER NOT NULL REFERENCES %SCHEMA%.pedido_compra(id) ON DELETE CASCADE,
    insumo_id INTEGER NOT NULL REFERENCES %SCHEMA%.insumo(id),
    quantidade DOUBLE PRECISION NOT NULL,
    preco_unitario DOUBLE PRECISION NOT NULL,
    valor_total DOUBLE PRECISION NOT NULL
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.compra (
    id SERIAL PRIMARY KEY,
    data_criacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    fornecedor_id INTEGER NOT NULL REFERENCES %SCHEMA%.fornecedor(id),
    valor_total DOUBLE PRECISION NOT NULL,
    status VARCHAR(50) NOT NULL,
    data_entrega TIMESTAMP WITHOUT TIME ZONE,
    nota_fiscal VARCHAR(100),
    observacao TEXT
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.item_compra (
    id SERIAL PRIMARY KEY,
    compra_id INTEGER NOT NULL REFERENCES %SCHEMA%.compra(id) ON DELETE CASCADE,
    insumo_id INTEGER NOT NULL REFERENCES %SCHEMA%.insumo(id),
    quantidade DOUBLE PRECISION NOT NULL,
    preco_unitario DOUBLE PRECISION NOT NULL,
    valor_total DOUBLE PRECISION NOT NULL
);

-- 10. Pedidos de Venda
CREATE TABLE IF NOT EXISTS %SCHEMA%.pedido (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES %SCHEMA%.cliente(id),
    data_pedido TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL,
    valor_total DOUBLE PRECISION NOT NULL,
    canal_venda VARCHAR(50),
    observacoes TEXT
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.pedido_item (
    id SERIAL PRIMARY KEY,
    pedido_id INTEGER NOT NULL REFERENCES %SCHEMA%.pedido(id) ON DELETE CASCADE,
    variacao_id INTEGER REFERENCES %SCHEMA%.produto_variacao(id),
    produto_nome VARCHAR(255),
    tamanho VARCHAR(255),
    quantidade INTEGER NOT NULL,
    preco_unitario DOUBLE PRECISION NOT NULL,
    valor_total DOUBLE PRECISION NOT NULL
);

-- 11. Controle Operacional e Ordens de Produção
CREATE TABLE IF NOT EXISTS %SCHEMA%.itens_estoque (
    id SERIAL PRIMARY KEY,
    variacao_id INTEGER NOT NULL REFERENCES %SCHEMA%.produto_variacao(id) ON DELETE CASCADE,
    localizacao VARCHAR(100) NOT NULL DEFAULT 'Geral',
    quantidade_atual DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    quantidade_minima DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    lote VARCHAR(50),
    data_validade DATE,
    atualizado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.movimentacoes_estoque (
    id SERIAL PRIMARY KEY,
    variacao_id INTEGER NOT NULL REFERENCES %SCHEMA%.produto_variacao(id) ON DELETE CASCADE,
    tipo VARCHAR(30) NOT NULL,
    quantidade DOUBLE PRECISION NOT NULL,
    motivo VARCHAR(255),
    origem VARCHAR(100),
    data_movimentacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    usuario_id INTEGER
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.ordens_producao (
    id SERIAL PRIMARY KEY,
    variacao_id INTEGER NOT NULL REFERENCES %SCHEMA%.produto_variacao(id) ON DELETE RESTRICT,
    quantidade_planejada DOUBLE PRECISION NOT NULL,
    quantidade_produzida DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    status VARCHAR(50) NOT NULL DEFAULT 'PLANEJADA',
    data_criacao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data_conclusao TIMESTAMP WITHOUT TIME ZONE,
    responsavel VARCHAR(100),
    observacoes TEXT
);

-- 12. Kits de Produtos
CREATE TABLE IF NOT EXISTS %SCHEMA%.kits (
    id SERIAL PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    codigo VARCHAR(100) UNIQUE,
    descricao TEXT,
    preco_venda DOUBLE PRECISION NOT NULL,
    ativo BOOLEAN NOT NULL DEFAULT TRUE,
    criado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    atualizado_em TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.kit_itens (
    id SERIAL PRIMARY KEY,
    kit_id INTEGER NOT NULL REFERENCES %SCHEMA%.kits(id) ON DELETE CASCADE,
    variacao_id INTEGER NOT NULL REFERENCES %SCHEMA%.produto_variacao(id) ON DELETE RESTRICT,
    quantidade INTEGER NOT NULL DEFAULT 1,
    desconto_percentual DOUBLE PRECISION NOT NULL DEFAULT 0.0
);

-- 13. Módulo Financeiro
CREATE TABLE IF NOT EXISTS %SCHEMA%.pedidos_financeiro (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER NOT NULL REFERENCES %SCHEMA%.cliente(id),
    data_emissao TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data_vencimento TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    valor_total DOUBLE PRECISION NOT NULL,
    status_financeiro VARCHAR(30) NOT NULL DEFAULT 'PENDENTE',
    forma_pagamento VARCHAR(50) NOT NULL,
    observacoes TEXT
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.transacoes_financeiras (
    id SERIAL PRIMARY KEY,
    pedido_financeiro_id INTEGER NOT NULL REFERENCES %SCHEMA%.pedidos_financeiro(id) ON DELETE CASCADE,
    valor_pago DOUBLE PRECISION NOT NULL,
    data_pagamento TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    forma_pagamento VARCHAR(50) NOT NULL,
    comprovante_identificador VARCHAR(100),
    usuario_responsavel VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS %SCHEMA%.historico_cobranca (
    id SERIAL PRIMARY KEY,
    pedido_financeiro_id INTEGER NOT NULL REFERENCES %SCHEMA%.pedidos_financeiro(id) ON DELETE CASCADE,
    data_contato TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    tipo_contato VARCHAR(50) NOT NULL,
    mensagem TEXT,
    resposta_cliente TEXT,
    usuario VARCHAR(100)
);

-- 14. Índices de Desempenho
CREATE INDEX IF NOT EXISTS idx_%SCHEMA%_insumo_fornecedor ON %SCHEMA%.insumo(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_%SCHEMA%_insumo_unidade ON %SCHEMA%.insumo(unidade_medida_id);
CREATE INDEX IF NOT EXISTS idx_%SCHEMA%_mov_insumo_id ON %SCHEMA%.movimento_estoque_insumo(insumo_id);
CREATE INDEX IF NOT EXISTS idx_%SCHEMA%_prod_var_prod ON %SCHEMA%.produto_variacao(produto_id);
CREATE INDEX IF NOT EXISTS idx_%SCHEMA%_var_mat_var ON %SCHEMA%.variacao_material(variacao_id);
CREATE INDEX IF NOT EXISTS idx_%SCHEMA%_var_mat_ins ON %SCHEMA%.variacao_material(insumo_id);
CREATE INDEX IF NOT EXISTS idx_%SCHEMA%_rec_ins_prod ON %SCHEMA%.receita_insumo(produto_id);
CREATE INDEX IF NOT EXISTS idx_%SCHEMA%_item_orc_orc ON %SCHEMA%.item_orcamento(orcamento_id);
CREATE INDEX IF NOT EXISTS idx_%SCHEMA%_cot_forn_item ON %SCHEMA%.cotacao_fornecedor(item_orcamento_id);
CREATE INDEX IF NOT EXISTS idx_%SCHEMA%_ped_comp_forn ON %SCHEMA%.pedido_compra(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_%SCHEMA%_ped_comp_item ON %SCHEMA%.pedido_compra_item(pedido_compra_id);
CREATE INDEX IF NOT EXISTS idx_%SCHEMA%_comp_forn ON %SCHEMA%.compra(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_%SCHEMA%_item_comp_comp ON %SCHEMA%.item_compra(compra_id);
CREATE INDEX IF NOT EXISTS idx_%SCHEMA%_ped_cliente ON %SCHEMA%.pedido(cliente_id);
CREATE INDEX IF NOT EXISTS idx_%SCHEMA%_ped_item_ped ON %SCHEMA%.pedido_item(pedido_id);
CREATE INDEX IF NOT EXISTS idx_%SCHEMA%_kit_itens_kit ON %SCHEMA%.kit_itens(kit_id);
CREATE INDEX IF NOT EXISTS idx_%SCHEMA%_ped_fin_cliente ON %SCHEMA%.pedidos_financeiro(cliente_id);

-- 15. Unidades de Medida Básicas Iniciais
INSERT INTO %SCHEMA%.unidade_medida (nome, sigla) VALUES
    ('Unidade', 'un'),
    ('Quilograma', 'kg'),
    ('Grama', 'g'),
    ('Litro', 'l'),
    ('Mililitro', 'ml'),
    ('Metro', 'm'),
    ('Centímetro', 'cm'),
    ('Caixa', 'cx')
ON CONFLICT (sigla) DO NOTHING;

-- 16. Configuração Global Padrão
INSERT INTO %SCHEMA%.configuracao_global (horas_totais_trabalhadas_mes, custo_hora_fabrica, custo_fixo_minuto, custo_operacional_total_mes, markup_padrao)
VALUES (160.0, 25.0, 0.26, 2500.0, 2.0)
ON CONFLICT DO NOTHING;
