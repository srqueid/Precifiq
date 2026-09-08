package org.example.repository

import org.example.Fornecedor
import org.example.FornecedoresTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction

class FornecedorRepository {
    fun lerTodos(): List<Fornecedor> = transaction {
        FornecedoresTable.selectAll().map {
            Fornecedor(
                id = it[FornecedoresTable.id],
                nome = it[FornecedoresTable.nome],
                nomeEmpresa = it[FornecedoresTable.nomeEmpresa],
                nomeFantasia = it[FornecedoresTable.nomeFantasia],
                cnpjCpf = it[FornecedoresTable.cnpjCpf],
                mnemonico = it[FornecedoresTable.mnemonico],
                enderecoCompleto = it[FornecedoresTable.enderecoCompleto],
                cep = it[FornecedoresTable.cep],
                uf = it[FornecedoresTable.uf],
                email = it[FornecedoresTable.email],
                telefones = it[FornecedoresTable.telefones],
                banco = it[FornecedoresTable.banco],
                agencia = it[FornecedoresTable.agencia],
                contaCorrente = it[FornecedoresTable.contaCorrente],
                chavePix = it[FornecedoresTable.chavePix],
                categoria = it[FornecedoresTable.categoria],
                prazoPagamentoPadrao = it[FornecedoresTable.prazoPagamentoPadrao],
                historicoAtendimento = it[FornecedoresTable.historicoAtendimento]
            )
        }
    }

    fun lerPorId(id: Int): Fornecedor? = transaction {
        FornecedoresTable.select { FornecedoresTable.id eq id }.singleOrNull()?.let {
            Fornecedor(
                id = it[FornecedoresTable.id],
                nome = it[FornecedoresTable.nome],
                nomeEmpresa = it[FornecedoresTable.nomeEmpresa],
                nomeFantasia = it[FornecedoresTable.nomeFantasia],
                cnpjCpf = it[FornecedoresTable.cnpjCpf],
                mnemonico = it[FornecedoresTable.mnemonico],
                enderecoCompleto = it[FornecedoresTable.enderecoCompleto],
                cep = it[FornecedoresTable.cep],
                uf = it[FornecedoresTable.uf],
                email = it[FornecedoresTable.email],
                telefones = it[FornecedoresTable.telefones],
                banco = it[FornecedoresTable.banco],
                agencia = it[FornecedoresTable.agencia],
                contaCorrente = it[FornecedoresTable.contaCorrente],
                chavePix = it[FornecedoresTable.chavePix],
                categoria = it[FornecedoresTable.categoria],
                prazoPagamentoPadrao = it[FornecedoresTable.prazoPagamentoPadrao],
                historicoAtendimento = it[FornecedoresTable.historicoAtendimento]
            )
        }
    }

    fun criar(f: Fornecedor) = transaction {
        FornecedoresTable.insert {
            it[nome] = f.nome
            it[nomeEmpresa] = f.nomeEmpresa
            it[nomeFantasia] = f.nomeFantasia
            it[cnpjCpf] = f.cnpjCpf
            it[mnemonico] = f.mnemonico
            it[enderecoCompleto] = f.enderecoCompleto
            it[cep] = f.cep
            it[uf] = f.uf
            it[email] = f.email
            it[telefones] = f.telefones
            it[banco] = f.banco
            it[agencia] = f.agencia
            it[contaCorrente] = f.contaCorrente
            it[chavePix] = f.chavePix
            it[categoria] = f.categoria
            it[prazoPagamentoPadrao] = f.prazoPagamentoPadrao
            it[historicoAtendimento] = f.historicoAtendimento
        }
    }

    fun atualizar(id: Int, f: Fornecedor) = transaction {
        FornecedoresTable.update({ FornecedoresTable.id eq id }) {
            it[nome] = f.nome
            it[nomeEmpresa] = f.nomeEmpresa
            it[nomeFantasia] = f.nomeFantasia
            it[cnpjCpf] = f.cnpjCpf
            it[mnemonico] = f.mnemonico
            it[enderecoCompleto] = f.enderecoCompleto
            it[cep] = f.cep
            it[uf] = f.uf
            it[email] = f.email
            it[telefones] = f.telefones
            it[banco] = f.banco
            it[agencia] = f.agencia
            it[contaCorrente] = f.contaCorrente
            it[chavePix] = f.chavePix
            it[categoria] = f.categoria
            it[prazoPagamentoPadrao] = f.prazoPagamentoPadrao
            it[historicoAtendimento] = f.historicoAtendimento
        }
    }

    fun deletar(id: Int) = transaction {
        FornecedoresTable.deleteWhere { Op.build { FornecedoresTable.id eq id } }
    }
}
