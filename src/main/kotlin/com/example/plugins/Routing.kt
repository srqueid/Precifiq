                    val precoDeVenda = custoTotalCalculado * (1 + (payload.margemLucro / 100.0))

                    val novoKitId = transaction {
                        if (KitsTable.select { KitsTable.nome eq payload.nome }.any()) {
                            throw IllegalStateException("Já existe um kit com o nome '${payload.nome}'.")
                        }

                        val resultRow = KitsTable.insert {
                            it[nome] = payload.nome
                            it[descricao] = payload.descricao
                            it[margemLucro] = payload.margemLucro
                            it[this.custoTotalCalculado] = custoTotalCalculado
                            it[precoVenda] = precoDeVenda
                        }

                        val generatedId = resultRow[KitsTable.id]

                        KitItensTable.batchInsert(payload.itens) { item ->
                            this[KitItensTable.kitId] = generatedId
                            this[KitItensTable.produtoVariacaoId] = item.produtoVariacaoId
                            this[KitItensTable.quantidade] = item.quantidade
                        }
