#!/usr/bin/env python3
"""Runner de migrações idempotente para o NoiseGuard.

- Mantém a tabela `schema_migrations` com o registro de tudo que já foi aplicado.
- Aplica, em ordem, apenas os arquivos .sql ainda não registrados.
- Cada migração roda numa transação; em erro, faz rollback e aborta.
- Reexecutar não aplica nada (idempotente). Subir o container do zero aplica
  todas as migrações na ordem correta.

Uso:
    DATABASE_URL=postgres://user:pass@host:5432/db python migrate.py
"""
import os
import sys
import time
import glob

import psycopg2

MIGRATIONS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "migrations")


def get_dsn():
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        print("ERRO: variável DATABASE_URL não definida.", file=sys.stderr)
        sys.exit(1)
    return dsn


def connect_with_retry(dsn, attempts=30, delay=2):
    """Aguarda o banco aceitar conexões (útil quando sobe junto no Compose)."""
    last_err = None
    for i in range(1, attempts + 1):
        try:
            return psycopg2.connect(dsn)
        except psycopg2.OperationalError as err:
            last_err = err
            print(f"Aguardando o banco de dados... ({i}/{attempts})")
            time.sleep(delay)
    raise last_err


def ensure_migrations_table(conn):
    with conn.cursor() as cur:
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS schema_migrations (
                version    text PRIMARY KEY,
                name       text NOT NULL,
                applied_at timestamptz NOT NULL DEFAULT now()
            );
            """
        )
    conn.commit()


def applied_versions(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT version FROM schema_migrations")
        return {row[0] for row in cur.fetchall()}


def discover_migrations():
    """Lista (version, name, path) ordenado pelo nome do arquivo.

    Convenção: arquivos `NNNN_descricao.sql`; a versão é o prefixo antes do `_`.
    """
    files = sorted(glob.glob(os.path.join(MIGRATIONS_DIR, "*.sql")))
    migrations = []
    for path in files:
        name = os.path.basename(path)
        version = name.split("_", 1)[0]
        migrations.append((version, name, path))
    return migrations


def apply_migration(conn, version, name, path):
    with open(path, "r", encoding="utf-8") as fh:
        sql = fh.read()
    print(f"Aplicando {name} ...")
    with conn.cursor() as cur:
        cur.execute(sql)
        cur.execute(
            "INSERT INTO schema_migrations (version, name) VALUES (%s, %s)",
            (version, name),
        )
    conn.commit()
    print(f"  OK  {name}")


def main():
    conn = connect_with_retry(get_dsn())
    conn.autocommit = False
    try:
        ensure_migrations_table(conn)
        done = applied_versions(conn)
        pending = [m for m in discover_migrations() if m[0] not in done]

        if not pending:
            print("Nenhuma migração pendente. Banco já está atualizado.")
            return

        for version, name, path in pending:
            apply_migration(conn, version, name, path)

        print(f"{len(pending)} migração(ões) aplicada(s) com sucesso.")
    except Exception as err:  # noqa: BLE001
        conn.rollback()
        print(f"ERRO na migração: {err}", file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
