package org.example

import org.example.repository.AppDatabase

fun main() {
    println("=== Inserindo Unidades de Medida ===")
    
    DatabaseConfig.connect()
    val db = AppDatabase.default

    val unidadesParaInserir = listOf(
        // Comprimento e Distância
        UnidadeMedida(0, "Milímetro", "mm"),
        UnidadeMedida(0, "Centímetro", "cm"),
        UnidadeMedida(0, "Metro", "m"),
        UnidadeMedida(0, "Quilômetro", "km"),
        UnidadeMedida(0, "Polegada", "in"),
        UnidadeMedida(0, "Pé", "ft"),
        UnidadeMedida(0, "Milha", "mi"),
        
        // Massa (Peso)
        UnidadeMedida(0, "Miligrama", "mg"),
        UnidadeMedida(0, "Grama", "g"),
        UnidadeMedida(0, "Quilograma", "kg"),
        UnidadeMedida(0, "Tonelada", "t"),
        
        // Capacidade e Volume
        UnidadeMedida(0, "Mililitro", "ml"),
        UnidadeMedida(0, "Litro", "l"),
        UnidadeMedida(0, "Metro cúbico", "m³"),
        
        // Outros
        UnidadeMedida(0, "Unidade", "un")
    )

    val existentes = db.unidadesMedida.lerTodos().map { it.nome }

    var inseridas = 0
    for (unidade in unidadesParaInserir) {
        if (!existentes.contains(unidade.nome)) {
            db.unidadesMedida.criar(unidade)
            println("Inserida: ${unidade.nome} (${unidade.sigla})")
            inseridas++
        } else {
            println("Já existe: ${unidade.nome}")
        }
    }

    println("\nProcesso concluído. $inseridas novas unidades foram inseridas.")
}