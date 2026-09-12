package org.example.services

import jakarta.mail.Authenticator
import jakarta.mail.Message
import jakarta.mail.PasswordAuthentication
import jakarta.mail.Session
import jakarta.mail.Transport
import jakarta.mail.internet.InternetAddress
import jakarta.mail.internet.MimeMessage
import org.example.DatabaseConfig
import java.util.Properties
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import java.util.concurrent.Executors

object EmailService {

    private val executor = Executors.newFixedThreadPool(2)

    fun isSmtpConfigured(): Boolean {
        val host = DatabaseConfig.env("SMTP_HOST")
        val user = DatabaseConfig.env("SMTP_USER")
        val pass = DatabaseConfig.env("SMTP_PASSWORD")
        return !host.isNullOrBlank() && !user.isNullOrBlank() && !pass.isNullOrBlank()
    }

    fun enviarEmailAsync(
        destinatario: String,
        assunto: String,
        corpoHtml: String,
        corpoTextoPlano: String? = null
    ) {
        executor.submit {
            try {
                enviarEmail(destinatario, assunto, corpoHtml, corpoTextoPlano)
            } catch (e: Exception) {
                System.err.println("WARN: Falha ao enviar e-mail assíncrono para $destinatario: ${e.message}")
            }
        }
    }

    fun enviarEmail(
        destinatario: String,
        assunto: String,
        corpoHtml: String,
        corpoTextoPlano: String? = null
    ): Boolean {
        val host = DatabaseConfig.env("SMTP_HOST")
        val port = DatabaseConfig.env("SMTP_PORT") ?: "587"
        val user = DatabaseConfig.env("SMTP_USER")
        val pass = DatabaseConfig.env("SMTP_PASSWORD")
        val from = DatabaseConfig.env("SMTP_FROM") ?: (user ?: "no-reply@precifiq.com.br")
        val auth = DatabaseConfig.env("SMTP_AUTH") ?: "true"
        val starttls = DatabaseConfig.env("SMTP_STARTTLS") ?: "true"

        // Se não houver configuração SMTP completa, simula o envio seguro em modo DEV/Demo
        if (host.isNullOrBlank() || user.isNullOrBlank() || pass.isNullOrBlank()) {
            println("================================================================================")
            println("[SIMULAÇÃO DE E-MAIL - PRECIFIQ ERP]")
            println("Destinatário: $destinatario")
            println("Assunto: $assunto")
            println("--------------------------------------------------------------------------------")
            println(corpoTextoPlano ?: corpoHtml.replace(Regex("<[^>]*>"), " ").replace(Regex("\\s+"), " ").trim())
            println("================================================================================")
            return true
        }

        return try {
            val props = Properties().apply {
                put("mail.smtp.host", host)
                put("mail.smtp.port", port)
                put("mail.smtp.auth", auth)
                put("mail.smtp.starttls.enable", starttls)
                put("mail.smtp.connectiontimeout", "5000")
                put("mail.smtp.timeout", "5000")
            }

            val session = Session.getInstance(props, object : Authenticator() {
                override fun getPasswordAuthentication(): PasswordAuthentication {
                    return PasswordAuthentication(user, pass)
                }
            })

            val message = MimeMessage(session).apply {
                setFrom(InternetAddress(from, "Precifiq ERP"))
                setRecipients(Message.RecipientType.TO, InternetAddress.parse(destinatario))
                setSubject(assunto, "UTF-8")
                setContent(corpoHtml, "text/html; charset=UTF-8")
            }

            Transport.send(message)
            println("INFO: E-mail enviado com sucesso via SMTP para $destinatario ($assunto)")
            true
        } catch (e: Exception) {
            System.err.println("ERROR: Falha ao enviar e-mail via SMTP para $destinatario: ${e.message}")
            false
        }
    }

    // Template para Recuperação de Senha
    fun enviarRecuperacaoSenha(email: String, nome: String, codigoSeguranca: String): Boolean {
        val assunto = "Código de Recuperação de Senha - Precifiq ERP"
        val html = """
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
                    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
                    .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 28px 24px; text-align: center; color: #ffffff; }
                    .header h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
                    .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
                    .content { padding: 32px 28px; }
                    .code-box { background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0; }
                    .code { font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #4f46e5; font-family: monospace; }
                    .alert-info { background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; font-size: 13px; color: #1e40af; border-radius: 0 6px 6px 0; margin-top: 20px; }
                    .footer { padding: 20px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <h1>Precifiq ERP</h1>
                        <p>Recuperação de Acesso à Conta</p>
                    </div>
                    <div class="content">
                        <p style="font-size: 15px; margin-top: 0;">Olá, <strong>$nome</strong>,</p>
                        <p style="font-size: 14px; line-height: 1.5; color: #475569;">
                            Recebemos uma solicitação para redefinir a senha da sua conta no <strong>Precifiq ERP</strong>.
                            Utilize o código de segurança abaixo para cadastrar uma nova senha:
                        </p>
                        <div class="code-box">
                            <div style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 6px;">Seu Código de Redefinição</div>
                            <div class="code">$codigoSeguranca</div>
                            <div style="font-size: 12px; color: #94a3b8; margin-top: 6px;">Válido por 15 minutos</div>
                        </div>
                        <div class="alert-info">
                            <strong>Importante:</strong> Se você não solicitou a redefinição de senha, ignore este e-mail com segurança. Sua senha atual permanecerá inalterada.
                        </div>
                    </div>
                    <div class="footer">
                        DcSys Tecnologia • Precifiq ERP - Plataforma de Gestão e Governança Multiempresas
                    </div>
                </div>
            </body>
            </html>
        """.trimIndent()

        val texto = "Olá, $nome. Seu código de segurança para recuperação de senha no Precifiq ERP é: $codigoSeguranca (válido por 15 minutos)."
        return enviarEmail(email, assunto, html, texto)
    }

    // Template para Alerta de Senha Alterada
    fun enviarAlertaSenhaAlterada(email: String, nome: String, ipOrigem: String?): Boolean {
        val assunto = "Alerta de Segurança: Senha Alterada - Precifiq ERP"
        val dataHora = LocalDateTime.now().format(DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss"))
        val ip = ipOrigem ?: "Endereço IP não identificado"

        val html = """
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
                    .card { max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
                    .header { background: linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%); padding: 24px; text-align: center; color: #ffffff; }
                    .header h1 { margin: 0; font-size: 20px; font-weight: 800; }
                    .content { padding: 28px; }
                    .details { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; font-size: 13px; margin: 20px 0; }
                    .details div { margin-bottom: 6px; }
                    .footer { padding: 18px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <h1>Precifiq ERP</h1>
                        <p style="margin: 4px 0 0; font-size: 13px;">Alerta de Segurança da Conta</p>
                    </div>
                    <div class="content">
                        <p style="font-size: 15px; margin-top: 0;">Olá, <strong>$nome</strong>,</p>
                        <p style="font-size: 14px; line-height: 1.5; color: #475569;">
                            Confirmamos que a senha de acesso à sua conta no <strong>Precifiq ERP</strong> foi alterada com sucesso.
                        </p>
                        <div class="details">
                            <div><strong>Data e Hora:</strong> $dataHora</div>
                            <div><strong>Origem da Requisição (IP):</strong> $ip</div>
                        </div>
                        <p style="font-size: 13px; color: #64748b; line-height: 1.5;">
                            Se você mesmo realizou essa alteração, nenhuma ação adicional é necessária.<br>
                            <strong>Caso não reconheça esta atividade</strong>, entre em contato imediatamente com o administrador do sistema.
                        </p>
                    </div>
                    <div class="footer">
                        DcSys Tecnologia • Precifiq ERP
                    </div>
                </div>
            </body>
            </html>
        """.trimIndent()

        val texto = "Olá, $nome. A senha da sua conta no Precifiq ERP foi alterada com sucesso em $dataHora a partir do IP $ip. Se não foi você, contate o administrador imediatamente."
        return enviarEmail(email, assunto, html, texto)
    }

    // Template para Testes e Alertas do Sistema
    fun enviarAlertaSistema(emailDestino: String, titulo: String, conteudoHtml: String): Boolean {
        val assunto = "[Precifiq Alerta] $titulo"
        val html = """
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
                    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
                    .header { background: #1e293b; padding: 20px; text-align: center; color: #ffffff; }
                    .content { padding: 24px; font-size: 14px; line-height: 1.6; }
                    .footer { padding: 16px; background: #f8fafc; border-top: 1px solid #e2e8f0; font-size: 11px; color: #64748b; text-align: center; }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="header">
                        <h2 style="margin: 0; font-size: 18px;">Precifiq ERP • Central de Notificações</h2>
                    </div>
                    <div class="content">
                        $conteudoHtml
                    </div>
                    <div class="footer">
                        DcSys Tecnologia • Sistema Precifiq
                    </div>
                </div>
            </body>
            </html>
        """.trimIndent()

        return enviarEmail(emailDestino, assunto, html)
    }
}
