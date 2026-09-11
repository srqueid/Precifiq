cGLUkdd1cYj6/vX1

p2QL+2Svy&3cQUaM

📋 Requisitos do Sistema
Sistema de Controle de Orçamento, Compras e Estoque
🎯 Objetivo
Desenvolver um sistema para gerenciar:
    testes


Compras de insumos
Formação de preço de venda
Controle de estoque (insumos e produtos acabados)
Cálculo de revenda individual e em pacotes


✅ Requisitos Funcionais
1. Cadastro de Dados Básicos

RF01 – O sistema deve permitir o cadastro de insumos (ex.: essência hidrossolúvel, álcool de cereais, frascos).
RF02 – O sistema deve permitir o cadastro de produtos finais.
RF03 – O sistema deve permitir o cadastro de fornecedores.
RF04 – O sistema deve permitir o cadastro de unidades de medida (ml, litro, unidade, etc.).


2. Controle de Compras

RF05 – O sistema deve permitir o registro de pedidos de compra de insumos.
RF06 – O sistema deve permitir informar:

quantidade
valor unitário
fornecedor
data da compra


RF07 – O sistema deve atualizar automaticamente o estoque de insumos após a confirmação da compra.


3. Controle de Estoque

RF08 – O sistema deve manter o controle de estoque de insumos.
RF09 – O sistema deve manter o controle de estoque de produtos prontos.
RF10 – O sistema deve permitir:

entrada manual de estoque
saída de estoque


RF11 – O sistema deve alertar quando o estoque estiver abaixo de um limite mínimo.


4. Produção / Transformação

RF12 – O sistema deve permitir registrar a produção de produtos, consumindo insumos.
RF13 – Ao produzir, o sistema deve:

baixar os insumos do estoque
adicionar os produtos finais ao estoque




5. Cálculo de Custo e Formação de Preço

RF14 – O sistema deve calcular o custo de produção de cada produto com base nos insumos utilizados.
RF15 – O sistema deve permitir definir:

margem de lucro (%)


RF16 – O sistema deve calcular automaticamente o preço de venda.


6. Venda e Revenda

RF17 – O sistema deve permitir calcular o preço de revenda de produtos individuais.
RF18 – O sistema deve permitir criar e calcular pacotes de produtos (kits).
RF19 – O sistema deve calcular automaticamente o preço do pacote com base:

nos produtos incluídos
na margem aplicada




7. Relatórios e Consultas

RF20 – O sistema deve exibir relatórios de:

estoque atual
histórico de compras
custo de produção
margem de lucro


RF21 – O sistema deve permitir consultar:

produtos
insumos
movimentações




⚙️ Regras de Negócio

RN01 – O custo do produto deve ser baseado na soma proporcional dos insumos utilizados.
RN02 – Nenhum produto pode ser produzido sem estoque suficiente de insumos.
RN03 – O preço de venda deve considerar obrigatoriamente:

custo
margem de lucro


RN04 – O estoque deve ser atualizado automaticamente em todas as movimentações.
RN05 – Pacotes de produtos devem ser tratados como um conjunto de itens com cálculo próprio.
RN06 – O sistema deve impedir estoque negativo.


🚀 Requisitos Não Funcionais

RNF01 – O sistema deve ter interface simples e intuitiva.
RNF02 – O sistema deve permitir acesso via navegador (web).
RNF03 – O sistema deve garantir integridade dos dados.
RNF04 – O sistema deve registrar histórico de alterações (auditoria básica).
RNF05 – O sistema deve responder às operações em até 2 segundos.


🧾 Exemplo de Fluxo

Cadastro de insumos
Registro de compra
Atualização do estoque
Produção de produtos
Cálculo automático de custo
Definição de preço de venda
Controle de estoque final


💡 Extras (Implementados)
Evoluções concluídas no sistema:

- [x] **Controle de validade de insumos**: Rastreamento de `data_validade` e `lote` em insumos e no livro razão (`movimento_estoque_insumo`). Alertas visuais preventivos (vencidos, a vencer em ≤ 30 dias, válidos), filtros e prevenção de uso de insumos vencidos na produção.
- [x] **Código de barras**: Mapeamento de `codigo_barras` em insumos, variações de produtos finais e kits montados. Endpoint unificado `/api/codigo-barras/{codigo}` e campo de bipagem/leitor óptico integrado.
- [x] **Integração com vendas**: Registro automático de saída de estoque para produtos finais e componentes de kits (`SAIDA_VENDA`, `SAIDA_VENDA_KIT`), rastreabilidade no razão `movimentacoes_estoque`, cálculo snapshot de CMV/Custo Total e Lucro Bruto por pedido, com baixa e integração ao faturamento.
- [x] **Dashboard com indicadores**: Indicadores em tempo real de faturamento do mês, lucro bruto realizado (R$ e margem %), giro de estoque (giro mensal e ciclo de renovação em dias), alerta de insumos com validade crítica e ranking dos produtos mais vendidos e mais lucrativos.