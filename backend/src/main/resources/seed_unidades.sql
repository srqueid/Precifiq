UPDATE unidade_medida SET nome = 'Litro', sigla = 'l' WHERE id = 1;
UPDATE unidade_medida SET nome = 'Unidade', sigla = 'un' WHERE id = 2;
UPDATE unidade_medida SET nome = 'Mililitro', sigla = 'ml' WHERE id = 3;
UPDATE unidade_medida SET nome = 'Kilograma', sigla = 'kg' WHERE id = 4;
UPDATE unidade_medida SET nome = 'Grama', sigla = 'g' WHERE id = 5;
UPDATE unidade_medida SET nome = 'Milímetro', sigla = 'mm' WHERE id = 6;
UPDATE unidade_medida SET nome = 'Centímetro', sigla = 'cm' WHERE id = 7;
UPDATE unidade_medida SET nome = 'Metro', sigla = 'm' WHERE id = 8;
INSERT INTO unidade_medida (id, nome, sigla) VALUES
(9, 'Quilômetro', 'km'),
(10, 'Polegada', 'in'),
(11, 'Pé', 'ft'),
(12, 'Milha', 'mi'),
(13, 'Miligrama', 'mg'),
(14, 'Quilograma BR', 'kg_br'),
(15, 'Tonelada', 't'),
(16, 'Metro cúbico', 'm³')
ON CONFLICT (id) DO UPDATE SET nome = EXCLUDED.nome, sigla = EXCLUDED.sigla;
