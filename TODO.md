# TODO - Revisão de Código

## Backend (Kotlin)

- [ ] **WebApp.kt**: Corrigir rota catch-all para não interceptar `/api/*`; limpar imports não usados.
- [ ] **KitsRoutes.kt**: Mover `call.receive` para dentro do try/catch; adicionar validações (itens vazios, quantidade > 0, nome não vazio); tornar a validação de margem configurável.
- [ ] **FinanceiroRoutes.kt**: Substituir casts inseguros por parsing com validação; implementar a baixa de pedido (RF02/RF05/RF06) atualizando status e criando transação; validar cliente existente.

## Frontend (React)

- [ ] **FinanceiroPage.tsx**: Remover comentários de lixo; atualizar para a API moderna do React Query; remover imports não usados.

## Infraestrutura

- [ ] **docker-compose.yml / Dockerfile**: Adicionar `curl` no Dockerfile do backend ou usar healthcheck alternativo.

## Testes

- [ ] Testar build do backend (`mvn package`)
- [ ] Testar build do frontend (`npm run build`)

testes implementados condform,ewa