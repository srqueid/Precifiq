#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script utilitário para executar a migration de recriação do banco e carga de dados no schema 'controle'.
Lê as credenciais do .env local por padrão, permitindo override via linha de comando.
Exemplo de uso:
    python run_migration.py
    python run_migration.py --host ep-xyz.neon.tech --dbname neondb --user neondb_owner --password sua_senha --sslmode require --schema controle
"""

import os
import sys
import argparse
import psycopg2
from pathlib import Path

def load_env(env_path):
    env_vars = {}
    if os.path.exists(env_path):
        with open(env_path, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#') or '=' not in line:
                    continue
                k, v = line.split('=', 1)
                env_vars[k.strip()] = v.strip().strip("'\"")
    return env_vars

def main():
    root_dir = Path(__file__).resolve().parent
    env_file = root_dir / '.env'
    migration_file = root_dir / 'migration_recreate_and_seed.sql'

    if not migration_file.exists():
        print(f"❌ Erro: Arquivo de migration não encontrado em: {migration_file}")
        sys.exit(1)

    env = load_env(env_file)

    parser = argparse.ArgumentParser(description="Executar migration de recriação do banco no PostgreSQL / NeonDB no schema 'controle'")
    parser.add_argument("--host", default=os.getenv('DB_HOST', env.get('DB_HOST', 'localhost')), help="Host do banco de dados")
    parser.add_argument("--port", default=os.getenv('DB_PORT', env.get('DB_PORT', '5444')), help="Porta do banco de dados")
    parser.add_argument("--dbname", default=os.getenv('DB_NAME', env.get('DB_NAME', 'precifiq_db')), help="Nome do banco de dados")
    parser.add_argument("--user", default=os.getenv('DB_USER', env.get('DB_USER', 'precifiq_user')), help="Usuário do banco de dados")
    parser.add_argument("--password", default=os.getenv('DB_PASSWORD', env.get('DB_PASSWORD', '')), help="Senha do banco de dados")
    parser.add_argument("--sslmode", default=os.getenv('DB_SSLMODE', env.get('DB_SSLMODE', 'disable')), help="Modo SSL (require, disable, etc.)")
    parser.add_argument("--schema", default=os.getenv('DB_SCHEMA', env.get('DB_SCHEMA', 'controle')), help="Schema alvo do PostgreSQL")

    args = parser.parse_args()

    print("=" * 65)
    print("🚀 EXECUTOR DE MIGRATION - ERP CONTROLE")
    print("=" * 65)
    print(f"📍 Host:     {args.host}:{args.port}")
    print(f"📦 Database: {args.dbname}")
    print(f"📁 Schema:   {args.schema}")
    print(f"👤 Usuário:  {args.user}")
    print(f"🔒 SSL Mode: {args.sslmode}")
    print(f"📄 Arquivo:  {migration_file.name}")
    print("=" * 65)

    try:
        print("\n⏳ Conectando ao PostgreSQL...")
        conn = psycopg2.connect(
            host=args.host,
            port=args.port,
            dbname=args.dbname,
            user=args.user,
            password=args.password,
            sslmode=args.sslmode,
            options=f"-c search_path={args.schema},public",
            connect_timeout=15
        )
        conn.autocommit = True
        cursor = conn.cursor()
        print("✅ Conexão estabelecida com sucesso!")

        print(f"\n⏳ Lendo script SQL da migration (Schema: '{args.schema}')...")
        with open(migration_file, 'r', encoding='utf-8') as f:
            sql = f.read()

        print(f"🚀 Executando migration no schema '{args.schema}'...")
        cursor.execute(sql)
        print(f"✅ Migration executada com sucesso no schema '{args.schema}'!")

        print(f"\n🔍 Validando contagem de registros no schema '{args.schema}':")
        cursor.execute(f"SELECT COUNT(*) FROM {args.schema}.unidade_medida;")
        qtd_um = cursor.fetchone()[0]
        print(f"  • Unidades de Medida: {qtd_um} (Esperado: 14)")

        cursor.execute(f"SELECT COUNT(*) FROM {args.schema}.fornecedor;")
        qtd_forn = cursor.fetchone()[0]
        print(f"  • Fornecedores:       {qtd_forn} (Esperado: 22)")

        cursor.execute(f"SELECT COUNT(*) FROM {args.schema}.insumo;")
        qtd_ins = cursor.fetchone()[0]
        print(f"  • Insumos:            {qtd_ins} (Esperado: 76)")

        cursor.execute(f"SELECT COUNT(*) FROM {args.schema}.configuracao_global;")
        qtd_cfg = cursor.fetchone()[0]
        print(f"  • Config Global:      {qtd_cfg} (Esperado: 1)")

        cursor.close()
        conn.close()

        print(f"\n🎉 BANCO DE DADOS RECRIADO NO SCHEMA '{args.schema}' E POPULADO COM SUCESSO!")
        print("=" * 65)

    except psycopg2.OperationalError as e:
        print(f"\n❌ Erro de Conexão com o Banco de Dados:")
        print(f"   {e}")
        print("\n💡 Dica: Verifique se o host está acessível e se usuário e senha estão corretos.")
        print("   Para especificar dados manualmente, utilize:")
        print(f"   python run_migration.py --host <host> --dbname <db> --user <user> --password <pass> --sslmode require --schema {args.schema}")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Erro durante a execução da migration:")
        print(f"   {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()
