export const sobreMarkdown = `# Sobre o Precifiq

**Precifiq — Sistema de Gestão e Precificação**  
*Versão 0.1.1*

O Precifiq é um sistema de gestão desenvolvido para empresas que compram insumos, transformam esses insumos em produtos e precisam saber, com precisão, quanto cada item realmente custa antes de definir o preço de venda.

Em vez de trabalhar com estimativas, o Precifiq calcula o custo real de cada produto a partir do preço efetivamente pago nos insumos — fracionado pelo tamanho de cada embalagem — somado ao custo de mão de obra e das despesas fixas rateado por minuto de produção. O resultado é uma precificação que sustenta a margem e mostra, item por item, onde o lucro está sendo perdido.

---

### O que o sistema cobre

O Precifiq acompanha a operação de ponta a ponta, em quatro frentes integradas:

* **Suprimentos** — cadastro de fornecedores, orçamentos, pedidos de compra, recebimento e controle de estoque de insumos, com alertas de estoque mínimo e de validade.
* **Produção e precificação** — fichas técnicas e formulações, custos fixos, produtos finais, variações e kits promocionais, com cálculo automático de preço e margem.
* **Comercial** — pedidos de clientes, controle de pagamento e entrega, estoque de produtos acabados e relatórios de resultado.
* **Governança** — arquitetura multiempresas com matriz e filiais, cada uma com base de dados isolada, e controle de permissões por perfil de acesso.

---

### Tecnologia

O Precifiq é uma aplicação web construída sobre PostgreSQL 16, com isolamento total de dados por empresa: cada matriz e cada filial opera em schema dedicado, provisionado automaticamente. A autenticação e a governança corporativa permanecem centralizadas, o que permite gerenciar múltiplas unidades a partir de um único acesso.

O sistema conta também com o **Copilot IA**, um assistente que responde perguntas em linguagem natural sobre estoque, custos, produtos e compras, consultando os dados ao vivo em modo estritamente de leitura. E com a **importação de NF-e por IA**, que lê a nota fiscal eletrônica e preenche automaticamente os dados da compra.

---

### Segurança e privacidade dos dados

A proteção das informações do seu negócio é parte da arquitetura do Precifiq, não um recurso adicional.

* **Criptografia em trânsito e em repouso** — todo o tráfego entre o navegador e o servidor é protegido por conexão criptografada (HTTPS/TLS), e os dados armazenados no banco, assim como os backups, são mantidos criptografados.
* **Senhas protegidas** — credenciais de acesso não são armazenadas em texto legível. Ao atualizar sua senha, as sessões anteriores permanecem protegidas e um alerta de segurança é emitido.
* **Isolamento por empresa** — cada matriz e cada filial possui schema próprio no PostgreSQL, o que impede o cruzamento de dados entre unidades e entre clientes distintos.
* **Acesso mínimo necessário** — o controle de permissões por perfil (RBAC) garante que cada usuário veja e altere apenas o que o seu papel autoriza. O Copilot IA opera exclusivamente em modo de leitura.
* **Conformidade com a LGPD** — o tratamento de dados no Precifiq segue a Lei Geral de Proteção de Dados (Lei nº 13.709/2018). Coletamos apenas os dados necessários à finalidade do sistema, registramos os acessos e não compartilhamos informações dos nossos clientes com terceiros para fins alheios à prestação do serviço.
* **Direitos do titular** — você pode solicitar a qualquer momento o acesso, a correção, a portabilidade ou a eliminação dos seus dados pessoais, pelos canais de suporte abaixo.

---

### Quem desenvolve

O Precifiq é desenvolvido e mantido pela **DcSys**, responsável pela infraestrutura, pela manutenção preventiva e pelo suporte à plataforma.

---

### Suporte

Nossa equipe está à disposição para dúvidas, treinamento, atendimento técnico e solicitações relacionadas à privacidade de dados.

* **E-mail:** contato@dcsys.com.br
* **WhatsApp:** [https://wa.me/5561992159605](https://wa.me/5561992159605)
`;
