package org.example.repository

import org.example.ConfiguracaoGlobal
import org.example.ConfiguracoesGlobaisTable
import org.example.DespesaFixa
import org.example.DespesasFixasTable
import org.example.Funcionario
import org.example.FuncionariosTable
import org.jetbrains.exposed.sql.*
import org.jetbrains.exposed.sql.transactions.transaction

class CustosOperacionaisRepository {
    fun getConfiguracoesGlobais(): ConfiguracaoGlobal = transaction {
        ConfiguracoesGlobaisTable.selectAll().singleOrNull()?.let {
            ConfiguracaoGlobal(
                id = it[ConfiguracoesGlobaisTable.id],
                horasTrabalhadasPorSemana = it[ConfiguracoesGlobaisTable.horasTrabalhadasPorSemana],
                totalSalarios = it[ConfiguracoesGlobaisTable.totalSalarios],
                totalDespesasFixas = it[ConfiguracoesGlobaisTable.totalDespesasFixas],
                custoMinutoTrabalho = it[ConfiguracoesGlobaisTable.custoMinutoTrabalho]
            )
        } ?: ConfiguracaoGlobal(1, 44.0, 0.0, 0.0, 0.0)
    }

    fun lerFuncionarios(): List<Funcionario> = transaction {
        FuncionariosTable.selectAll().map {
            Funcionario(
                id = it[FuncionariosTable.id],
                nome = it[FuncionariosTable.nome],
                salarioBruto = it[FuncionariosTable.salarioBruto]
            )
        }
    }

    fun lerDespesas(): List<DespesaFixa> = transaction {
        DespesasFixasTable.selectAll().map {
            DespesaFixa(
                id = it[DespesasFixasTable.id],
                descricao = it[DespesasFixasTable.descricao],
                valorMensal = it[DespesasFixasTable.valorMensal]
            )
        }
    }

    fun criarFuncionario(f: Funcionario) = transaction {
        FuncionariosTable.insert {
            it[nome] = f.nome
            it[salarioBruto] = f.salarioBruto
        }
    }

    fun deletarFuncionario(id: Int) = transaction {
        FuncionariosTable.deleteWhere { SqlExpressionBuilder.run { FuncionariosTable.id eq id } }
    }

    fun atualizarFuncionario(id: Int, nome: String, salario: Double) = transaction {
        FuncionariosTable.update({ FuncionariosTable.id eq id }) {
            it[FuncionariosTable.nome] = nome
            it[FuncionariosTable.salarioBruto] = salario
        }
    }

    fun criarDespesa(d: DespesaFixa) = transaction {
        DespesasFixasTable.insert {
            it[descricao] = d.descricao
            it[valorMensal] = d.valorMensal
        }
    }

    fun deletarDespesa(id: Int) = transaction {
        DespesasFixasTable.deleteWhere { SqlExpressionBuilder.run { DespesasFixasTable.id eq id } }
    }

    fun atualizarDespesa(id: Int, descricao: String, valor: Double) = transaction {
        DespesasFixasTable.update({ DespesasFixasTable.id eq id }) {
            it[DespesasFixasTable.descricao] = descricao
            it[DespesasFixasTable.valorMensal] = valor
        }
    }

    fun atualizarHorasSemanais(horas: Double) = transaction {
        ConfiguracoesGlobaisTable.update({ ConfiguracoesGlobaisTable.id eq 1 }) {
            it[ConfiguracoesGlobaisTable.horasTrabalhadasPorSemana] = horas
        }
    }
}
