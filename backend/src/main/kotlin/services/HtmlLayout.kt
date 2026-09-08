package org.example.services

import io.ktor.server.html.*
import kotlinx.html.*

fun HTML.layout(title: String, block: DIV.() -> Unit) {
    body {
        div {
            h1 { text(title) }
            block()
        }
    }
}
