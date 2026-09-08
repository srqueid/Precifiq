cGLUkdd1cYj6/vX1

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


💡 Extras (opcional, mas valioso)
Você pode evoluir o sistema com:

Controle de validade de insumos
Código de barras
Integração com vendas
Dashboard com indicadores (lucro, giro de estoque)