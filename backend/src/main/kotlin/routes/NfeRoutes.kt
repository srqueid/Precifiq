package org.example.routes

import io.ktor.http.*
import io.ktor.http.content.*
import io.ktor.server.application.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import org.example.*
import org.example.services.NfeService
import java.util.*

data class NfeUploadBase64Request(
    val base64: String,
    val fileName: String = "documento.xml",
    val mimeType: String = "application/xml"
)

fun Route.nfeRoutes(nfeService: NfeService) {
    // Configura rotas tanto com /api/ai/nfe quanto /ai/nfe (para suportar Vite proxy com ou sem rewrite)
    listOf("/api/ai/nfe", "/ai/nfe").forEach { prefix ->
        route(prefix) {

            // 1. Upload e Análise da Nota Fiscal (Multipart ou Base64 JSON)
            post("/upload") {
                try {
                    val contentType = call.request.contentType()
                    var fileBytes: ByteArray? = null
                    var fileName = "documento.xml"
                    var mimeType = "application/xml"

                    if (contentType.match(ContentType.MultiPart.FormData)) {
                        val multipart = call.receiveMultipart()
                        multipart.forEachPart { part ->
                            if (part is PartData.FileItem) {
                                fileName = part.originalFileName ?: "documento"
                                mimeType = part.contentType?.toString() ?: when {
                                    fileName.endsWith(".xml", ignoreCase = true) -> "application/xml"
                                    fileName.endsWith(".pdf", ignoreCase = true) -> "application/pdf"
                                    fileName.endsWith(".png", ignoreCase = true) -> "image/png"
                                    fileName.endsWith(".jpg", ignoreCase = true) || fileName.endsWith(".jpeg", ignoreCase = true) -> "image/jpeg"
                                    else -> "application/octet-stream"
                                }
                                fileBytes = part.streamProvider().readBytes()
                            }
                            part.dispose()
                        }
                    } else {
                        val body = call.receive<NfeUploadBase64Request>()
                        val cleanBase64 = body.base64.substringAfter("base64,")
                        fileBytes = Base64.getDecoder().decode(cleanBase64)
                        fileName = body.fileName
                        mimeType = body.mimeType
                    }

                    if (fileBytes == null || fileBytes!!.isEmpty()) {
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Nenhum arquivo ou conteúdo enviado."))
                        return@post
                    }

                    val resultado = nfeService.processarDocumento(fileBytes!!, fileName, mimeType)
                    call.respond(HttpStatusCode.OK, resultado)
                } catch (e: Exception) {
                    e.printStackTrace()
                    call.respond(
                        HttpStatusCode.InternalServerError,
                        mapOf(
                            "error" to "Falha ao processar nota fiscal",
                            "detalhe" to (e.message ?: "Erro desconhecido")
                        )
                    )
                }
            }

            // 2. Confirmação e Efetivação da Entrada da NF-e no Estoque
            post("/confirmar") {
                try {
                    val request = call.receive<ConfirmarEntradaNfeRequest>()
                    if (request.itens.isEmpty()) {
                        call.respond(HttpStatusCode.BadRequest, mapOf("error" to "Nenhum item informado para entrada."))
                        return@post
                    }

                    val resultado = nfeService.confirmarEntradaNfe(request)
                    call.respond(HttpStatusCode.OK, resultado)
                } catch (e: Exception) {
                    e.printStackTrace()
                    call.respond(
                        HttpStatusCode.InternalServerError,
                        mapOf(
                            "error" to "Erro ao confirmar entrada da nota fiscal",
                            "detalhe" to (e.message ?: "Erro desconhecido")
                        )
                    )
                }
            }
        }
    }
}
