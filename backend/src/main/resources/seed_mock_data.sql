-- ==========================================================
-- SCRIPT DE SEED / MOCK DE DADOS REAIS - ERP CONTROLE
-- ==========================================================

-- 1. Unidades de Medida
INSERT INTO unidade_medida (id, nome, sigla) VALUES
(1, 'Litro', 'L'),
(2, 'Unidade', 'un'),
(3, 'Mililitro', 'ml'),
(4, 'Quilograma', 'kg'),
(5, 'Grama', 'g'),
(6, 'Peça', 'pc'),
(7, 'Pacote', 'pct'),
(8, 'Metro', 'm')
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, sigla = EXCLUDED.sigla;

-- 2. Fornecedores
INSERT INTO fornecedor (id, nome, nome_fantasia, cnpj_cpf, uf, email, telefones) VALUES
(74, 'Quimisulsc', 'Quimisulsc', '24.788.909/0001-14', 'SC', 'vendas@quimisulsc.com.br', '(47) 9762-0757'),
(75, 'Olfativestore Comercio de Embalagem', 'Olfativestore', '09.558.710/0001-06', 'SP', NULL, NULL),
(9, 'Flower', 'Flower', '48.901.776/0001-09', 'SP', 'flowerprodutos@gmail.com', '(11) 94887-2186'),
(8, 'Martha Ferreira de Almeida', 'Martha Ferreira', '46.461.882/0001-93', 'SP', NULL, '(11) 91475-9163'),
(7, 'Central de Art Comercio de Embalagens e Produtos Alimenticios', 'Central de Art', '13.924.118/0001-58', 'SP', NULL, NULL),
(5, 'Destilaria Bauru Eireli', 'Destilaria Bauru', '11.143.171/0001-96', 'SP', NULL, '(17) 3524-6284'),
(6, 'Fonte dos Frascos Ltda', 'Fonte dos Frascos', '45.063.126/0001-43', 'SP', 'fontesdosfrascos@yahoo.com', '(11) 95404-2618'),
(4, 'Lin Pei Yu', 'Lin Pei Yu', '46.119.943/0001-39', 'SP', NULL, NULL),
(2, 'IMPERIO DAS ESSENCIAS LTDA', 'Império das Essências', '03.706.592/0002-30', 'SP', NULL, '(11) 2896-7030'),
(76, 'Thessencia LTDA', 'Thessencia', '41.562.790/0001-86', 'SP', NULL, NULL),
(77, 'CANTINHO DAS ESSENCIAS LTDA', 'Cantinho das Essências', '57.186.456/0001-05', 'SP', 'vendas@cantinhodasessencias.com.br', '(15) 99109-2070'),
(3, 'Vanessa Gonçalves Coutinho', 'Casa Vidro', '38.308.074/0001-62', 'SP', 'casavidro.shop@gmail.com', '(11) 97631-7568'),
(16, 'Piter Paiva', 'Piter Paiva', '32.952.310/0001-00', 'SP', NULL, '(11) 5594-8335'),
(17, 'Essencia da Ceci', 'Essência da Ceci', '371.768.036-68', 'SP', NULL, NULL),
(18, 'Godinho Ramiro', 'Godinho Ramiro', '47.911.734/0001-96', 'SP', NULL, '(11) 99241-6270'),
(19, 'Alecrim Essencia e Limpeza', 'Alecrim Essência', '48.983.774/0001-06', 'SP', NULL, NULL),
(20, '21 Quimica Distribuidora de produtos', '21 Química', '38.307.394/0001-06', 'SP', NULL, '(11) 98504-6472'),
(21, 'Terumã Agropecuaria Comercial Eireli', 'Terumã', '57.283.327/0001-35', 'SP', NULL, '(11) 3645-1065'),
(22, 'Open Festas Comercia de Produtos', 'Open Festas', '50.020.591/0001-37', 'DF', NULL, '(61) 3339-176'),
(23, 'Colibri Papelaria e Armarinho', 'Colibri', '08.369.238/0001-09', 'DF', NULL, '(61) 3335-2438'),
(24, 'Big Essencia e Decorações LTDA', 'Big Essência', '45.757.589/0001-05', 'MG', 'logisticasbigessencias01@gmail.com', '(31) 7319-9636'),
(25, 'Sueli Guilherme Cosme Dos Santos ME', 'Sueli Guilherme', '23.649.160/0001-00', 'DF', NULL, '(61) 3335-5449')
ON CONFLICT (id) DO UPDATE SET 
    nome = EXCLUDED.nome, 
    nome_fantasia = EXCLUDED.nome_fantasia, 
    cnpj_cpf = EXCLUDED.cnpj_cpf, 
    uf = EXCLUDED.uf, 
    email = EXCLUDED.email, 
    telefones = EXCLUDED.telefones;

-- 3. Insumos
INSERT INTO insumo (id, nome, unidade_medida_id, quantidade_por_embalagem, fornecedor_id, preco, is_embalagem, estoque) VALUES
(6, 'Vidro Topazio G28 300 ML Tampa prata', 3, 300, 16, 7.15, true, 7),
(10, 'Frasco Rubi Transparente 300ml', 3, 300, 3, 7.91, true, 4),
(8, 'Frasco Topazio 300ML transparente', 3, 300, 3, 9.20, true, 4),
(13, 'Frasco Topazio 300ML Degrade Preto com Azul do Mar', 3, 300, 3, 15.10, true, 2),
(25, 'Pérola para decoração Amarela', 2, 1, 23, 4.99, true, 63),
(11, 'Tampa Luxo Dourada Rosca 28 com furo', 3, 1, 3, 2.68, true, 10),
(24, 'Saco Adesivado Numero 6 com furo 10x15', 7, 100, 22, 10.59, true, 0),
(20, 'Válvula Preta Spray Lisa 24/415', 6, 1, 2, 1.50, true, 25),
(15, 'Essência Bamboo MM 100ml', 3, 100, 2, 24.21, false, 5),
(27, 'Fita Cetim Azul Bebê', 8, 10, 23, 3.90, true, 0),
(28, 'Fita Cetim Verde', 8, 10, 23, 3.90, true, 0),
(29, 'Fita Cetim Rosa Velho', 8, 10, 23, 3.90, true, 0),
(41, 'Dióxido de Titânio', 5, 100, 5, 24.75, false, 0),
(45, 'Óleo Essencial Bergamota Itália Reggio', 3, 10, 5, 22.90, false, 0),
(46, 'Óleo Essencial Laranja Pera Doce', 3, 10, 5, 19.90, false, 0),
(47, 'Essência de Mel Aromatizadores/Cosméticos', 3, 100, 5, 24.32, false, 0),
(50, 'Óleo Resina de Alecrim', 3, 10, 5, 18.90, false, 0),
(53, 'Óleo Essencial de Lavandim Grosso', 3, 20, 5, 14.80, false, 0),
(52, 'Óleo Essencial de Alecrim Rosmarinus', 3, 20, 5, 21.10, false, 0),
(57, 'Ninpaguard SCE Conservante', 5, 100, 5, 55.90, false, 0),
(60, 'Essência Hidrossolúvel Cascas E Folhas 500g', 3, 500, 77, 72.90, false, 1),
(2, 'Frasco Pet Borrifador Spray Mini Gatilho', 3, 200, 76, 3.93, true, 3),
(26, 'Fita de Cetim Champangne', 8, 10, 23, 3.90, true, 1),
(14, 'Frasco vidro Brilhante 350ml rosca 28/410', 6, 350, 3, 12.50, true, 4),
(1, 'Frasco Pet Cilíndrico 60ml Rosca 20/410mm', 3, 60, 6, 1.45, true, 38),
(37, 'Pérola N16 decoração gota branca', 2, 1, 25, 8.99, true, 50),
(22, 'Vidro aromatizador de carrro 10ml', 3, 10, 7, 82.00, true, 80),
(33, 'Pérola N10 Branca', 5, 50, 25, 7.99, true, 50),
(32, 'Pérola N8 Lilás Lavanda', 5, 50, 25, 7.99, true, 50),
(35, 'Pérola N8 Verde Bebê', 5, 50, 25, 7.99, true, 50),
(36, 'Pérola N10 Perolada', 5, 50, 25, 7.99, true, 50),
(59, 'Frasco Vidro Octogonal 200ml', 3, 200, NULL, 12.00, true, 1),
(34, 'Pérola N8 Rosa', 5, 50, 25, 7.99, true, 50),
(38, 'Pérola N16 decoração gota perolada', 5, 50, 25, 8.99, true, 50),
(9, 'Frasco Vidro Esmeralda 350ml Rosca 28/410', 3, 350, 3, 11.78, true, 4),
(5, 'Essências Diversas 500 ml', 3, 500, 16, 129.50, false, 0),
(31, 'Fita Cetim Laranja', 8, 10, 23, 3.90, true, 1),
(30, 'Fita Cetim Lilás Lavanda', 8, 10, 23, 3.90, true, 1),
(17, 'Frasco Pet Cristal Premium 250ml rosca 28/410', 3, 250, 75, 2.63, true, 38),
(61, 'Essência Hidrossolúvel Alecrim 500g', 5, 500, 77, 69.90, false, 1),
(62, 'Essência Hidrossolúvel Chá Branco 500g', 5, 500, 77, 59.90, false, 1),
(63, 'Essência Hidrossolúvel Lavanda 500g', 5, 500, 77, 69.90, false, 1),
(64, 'Essência Hidrossolúvel Flor De Cerejeira 500g', 5, 500, 77, 59.90, false, 1),
(65, 'Essência Hidrossolúvel Capim Limão 500g', 5, 500, 77, 59.90, false, 1),
(66, 'Tampa Lacre Branca Rosca 28/410mm', 6, 1, 77, 0.20, true, 50),
(18, 'Tampa de Metal ouro com furo 28/410', 6, 1, 2, 0.85, true, 25),
(19, 'Tampa Metal Prata com furo 28/410', 6, 1, 2, 0.85, true, 25),
(16, 'Frasco Pet Premium Ambar 250ml Rosca 24/415', 3, 250, 2, 2.50, true, 25),
(12, 'Válvula Saboneteira Prime Dourada', 6, 1, 3, 6.89, true, 2),
(7, 'Renex 95', 3, 1000, NULL, 40.00, false, 1000),
(67, 'Frasco Pet Cilíndrico 60ml Rosca 20/410mm Spray', 3, 60, 77, 0.85, true, 33),
(68, 'Essência Citronela 100g', 5, 100, 77, 22.90, false, 1),
(69, 'Essência Hidrossolúvel Cheirinho De Bebê 500g', 5, 500, 77, 63.90, false, 1),
(70, 'Essência Hidrossolúvel Flor De Laranjeira 500g', 5, 500, 77, 66.90, false, 1),
(71, 'Essência Hidrossolúvel Limão Siciliano 500g', 5, 500, 77, 60.20, false, 1),
(72, 'Essência Hidrossolúvel Bambu 500g', 5, 500, 77, 66.90, false, 1),
(73, 'Essência Hidrossolúvel Flor De Algodão 500g', 5, 500, 77, 59.90, false, 1),
(74, 'Tampa Flip Top Branca Rosca 18/410mm', 6, 1, 77, 0.25, true, 25),
(75, 'Tampa Furada Alumínio Prata Rosca 28/410mm', 6, 1, NULL, 0.60, false, 15),
(76, 'Válvula Spray Branca Rosca 20/410mm', 6, 1, 77, 1.20, true, 35),
(77, 'Essência Hidrossolúvel Verbena 500g', 5, 500, 77, 61.90, false, 1),
(23, 'Glicerina Bi - distilada USP 5L', 3, 1000, 8, 85.00, false, 0),
(40, 'Óleo Vegetal Mamona(Ricino) Prensado a Frio Extra Virgem', 3, 500000, 5, 25.10, false, 0),
(42, 'Óleo Vegetal Semente de Uva Refinado', 3, 500000, 5, 47.90, false, 0),
(44, 'Base Para Sabonete/Shampoo Líquido Perolado', 3, 1000, 5, 22.90, false, 0),
(48, 'Óleo Vegetal Palma Prensado Frio Extra Virgem', 3, 1000, 5, 45.90, false, 0),
(49, 'Óleo Vegetal de Coco Prensado Frio Extra Virgem', 3, 1000, 5, 71.90, false, 0),
(21, 'Lauril Líquido', 3, 1000, 4, 130.00, false, 2000),
(39, 'Ácido Esteárico - Estearina Tripla Pressão', 5, 1000, 5, 49.90, false, 0),
(51, 'Soda Cáustica Escama 99%', 5, 1000, 5, 25.00, false, 0),
(54, 'Estearina de Palma', 5, 1000, 5, 44.90, false, 0),
(56, 'Uréia', 5, 1000, 5, 24.90, false, 0),
(58, 'Água Destilada', 3, 5000, NULL, 15.99, false, 1),
(3, 'Álcool de Cereais perfumaria 5 L', 3, 5000, 20, 73.79, false, 1),
(43, 'Base Sabonete Líquido 0% Lauril', 3, 1000, 5, 36.95, false, 1),
(4, 'Cocoamidopropril betaina 5 L', 3, 5000, 74, 129.48, false, 4000)
ON CONFLICT (id) DO UPDATE SET 
    nome = EXCLUDED.nome,
    unidade_medida_id = EXCLUDED.unidade_medida_id,
    quantidade_por_embalagem = EXCLUDED.quantidade_por_embalagem,
    fornecedor_id = EXCLUDED.fornecedor_id,
    preco = EXCLUDED.preco,
    is_embalagem = EXCLUDED.is_embalagem,
    estoque = EXCLUDED.estoque;

-- 4. Produtos Acabados & Fichas Técnicas de Demonstração
INSERT INTO produto_final (id, nome, descricao, rendimento_receita_base) VALUES
(1, 'Difusor de Ambientes Bamboo Premium 250ml', 'Aromatizador de varetas com notas verdes e florais suaves.', 1000.0),
(2, 'Home Spray Cascas & Folhas 200ml', 'Spray aromatizador de ambientes amadeirado e refrescante.', 1000.0)
ON CONFLICT (id) DO NOTHING;

-- Insumos das Fichas Técnicas
INSERT INTO receita_insumo (produto_id, insumo_id, quantidade_usada) VALUES
(1, 3, 700.0),   -- Álcool de Cereais 700ml
(1, 15, 200.0),  -- Essência Bamboo 200ml
(1, 58, 100.0),  -- Água Destilada 100ml
(2, 3, 800.0),   -- Álcool de Cereais 800ml
(2, 60, 150.0),  -- Essência Cascas e Folhas 150ml
(2, 58, 50.0)    -- Água Destilada 50ml
ON CONFLICT DO NOTHING;

-- Atualizar sequências após inserts com IDs explícitos
SELECT setval('unidade_medida_id_seq', (SELECT COALESCE(MAX(id), 1) FROM unidade_medida));
SELECT setval('fornecedor_id_seq', (SELECT COALESCE(MAX(id), 1) FROM fornecedor));
SELECT setval('insumo_id_seq', (SELECT COALESCE(MAX(id), 1) FROM insumo));
SELECT setval('produto_final_id_seq', (SELECT COALESCE(MAX(id), 1) FROM produto_final));
