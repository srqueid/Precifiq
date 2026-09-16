package org.example

import java.io.PrintWriter
import java.sql.Connection
import java.sql.SQLException
import java.sql.SQLFeatureNotSupportedException
import java.util.logging.Logger
import javax.sql.DataSource

/**
 * DataSource Multi-Tenant transparente para PostgreSQL.
 * 
 * Intercepta todas as conexões entregues ao Exposed e define dinamicamente:
 *   SET search_path TO "$tenantSchema", global, public;
 * 
 * Isso garante que todas as consultas a tabelas operacionais (cliente, insumo, produto_final, etc.)
 * sejam automaticamente roteadas para o schema da empresa ativa, enquanto tabelas de governança
 * (empresa, perfil, usuario) sejam resolvidas no schema 'global'.
 */
class MultiTenantDataSource(private val delegate: DataSource) : DataSource {

    // Cacheia o último schema configurado na conexão física para evitar round-trips desnecessários
    private val connectionSchemaCache = java.util.Collections.synchronizedMap(java.util.WeakHashMap<Connection, String>())

    private fun configureConnection(conn: Connection): Connection {
        try {
            val schema = TenantContext.getCurrentSchema()
            val physicalConn = try { conn.unwrap(Connection::class.java) } catch (_: Exception) { conn }
            val lastSchema = connectionSchemaCache[physicalConn]

            if (lastSchema != schema) {
                conn.createStatement().use { stmt ->
                    stmt.execute("SET search_path TO \"$schema\", global;")
                }
                connectionSchemaCache[physicalConn] = schema
            }
        } catch (e: SQLException) {
            System.err.println("WARN: Falha ao definir search_path para conexão: ${e.message}")
        }
        return conn
    }

    @Throws(SQLException::class)
    override fun getConnection(): Connection {
        val conn = delegate.connection
        return configureConnection(conn)
    }

    @Throws(SQLException::class)
    override fun getConnection(username: String?, password: String?): Connection {
        val conn = delegate.getConnection(username, password)
        return configureConnection(conn)
    }

    @Throws(SQLException::class)
    override fun getLogWriter(): PrintWriter = delegate.logWriter

    @Throws(SQLException::class)
    override fun setLogWriter(out: PrintWriter?) {
        delegate.logWriter = out
    }

    @Throws(SQLException::class)
    override fun setLoginTimeout(seconds: Int) {
        delegate.loginTimeout = seconds
    }

    @Throws(SQLException::class)
    override fun getLoginTimeout(): Int = delegate.loginTimeout

    @Throws(SQLFeatureNotSupportedException::class)
    override fun getParentLogger(): Logger = delegate.parentLogger

    @Throws(SQLException::class)
    override fun <T : Any?> unwrap(iface: Class<T>?): T = delegate.unwrap(iface)

    @Throws(SQLException::class)
    override fun isWrapperFor(iface: Class<*>?): Boolean = delegate.isWrapperFor(iface)
}
