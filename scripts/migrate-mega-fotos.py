#!/usr/bin/env python3
"""
Migra fotos salvas como links MEGA no banco de dados para base64 data URIs.

O MEGA não permite embedding direto em <img> tags (requer JS decryption).
Este script:
  1. Lê todos os registros de fotos_vis onde Loc_Foto é um link MEGA
  2. Baixa cada arquivo usando a biblioteca mega.py
  3. Converte para base64 data URI
  4. Atualiza o registro no banco (Supabase ou SQLite)

Uso:
  python3 scripts/migrate-mega-fotos.py [--dry-run]

Requisitos:
  pip install mega.py supabase
  (ou rode no ambiente que já tem as dependências do projeto)
"""

import os
import sys
import re
import base64
import time
import argparse
from pathlib import Path

# ---------------------------------------------------------------------------
# MEGA download
# ---------------------------------------------------------------------------

def convert_mega_url(url: str) -> str:
    """Converte URL novo do MEGA para formato antigo que o mega.py entende."""
    m = re.match(r'https?://mega\.nz/file/([a-zA-Z0-9_-]+)#([a-zA-Z0-9_-]+)', url)
    if m:
        return f"https://mega.nz/#!{m.group(1)}!{m.group(2)}"
    return url


def download_mega_file(url: str, dest: str) -> bool:
    """Baixa arquivo do MEGA. Retorna True se sucesso."""
    try:
        from mega import Mega
        m = Mega()
        converted = convert_mega_url(url)
        m.download_url(converted, dest_filename=dest)
        return os.path.exists(dest) and os.path.getsize(dest) > 0
    except Exception as e:
        print(f"  ❌ Erro ao baixar: {e}")
        return False


def file_to_data_uri(filepath: str) -> str | None:
    """Converte arquivo para base64 data URI."""
    try:
        with open(filepath, 'rb') as f:
            data = f.read()
        # Detectar MIME type
        if data[:2] == b'\xff\xd8':
            mime = 'image/jpeg'
        elif data[:4] == b'\x89PNG':
            mime = 'image/png'
        elif data[8:12] == b'WEBP':
            mime = 'image/webp'
        elif data[:4] == b'GIF8':
            mime = 'image/gif'
        else:
            mime = 'image/jpeg'  # fallback
        b64 = base64.b64encode(data).decode('ascii')
        return f"data:{mime};base64,{b64}"
    except Exception as e:
        print(f"  ❌ Erro ao converter: {e}")
        return None


# ---------------------------------------------------------------------------
# Database backends
# ---------------------------------------------------------------------------

def is_mega_url(url: str | None) -> bool:
    """Verifica se a URL é do MEGA."""
    return bool(url and re.search(r'mega\.nz/', url, re.IGNORECASE))


def get_supabase_client():
    """Retorna cliente Supabase admin se configurado."""
    supabase_url = os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    if supabase_url and supabase_key:
        from supabase import create_client
        return create_client(supabase_url, supabase_key)
    return None


def get_sqlite_db():
    """Retorna conexão SQLite se Supabase não configurado."""
    db_path = Path(__file__).parent.parent / 'prisma' / 'db' / 'custom.db'
    if db_path.exists():
        import sqlite3
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        return conn
    return None


# ---------------------------------------------------------------------------
# Main migration
# ---------------------------------------------------------------------------

def migrate_supabase(dry_run: bool = False):
    """Migra fotos MEGA no Supabase."""
    sb = get_supabase_client()
    if not sb:
        print("⚠️  Supabase não configurado, pulando...")
        return 0, 0

    # Buscar todas as fotos com Loc_Foto contendo mega.nz
    # Supabase não suporta LIKE diretamente via client, então buscamos todas
    # e filtramos no Python
    {data, error} = sb.table('fotos_vis').select('id_foto, Nome_Foto, Loc_Foto').execute()
    if error:
        print(f"❌ Erro ao buscar fotos: {error}")
        return 0, 0

    fotos = [f for f in (data or []) if is_mega_url(f.get('Loc_Foto'))]
    print(f"📸 Encontradas {len(fotos)} fotos com links MEGA no Supabase")

    if not fotos:
        return 0, 0

    success = 0
    failed = 0
    tmp_dir = Path('/tmp/mega_migration')
    tmp_dir.mkdir(exist_ok=True)

    for foto in fotos:
        id_foto = foto['id_foto']
        nome = foto.get('Nome_Foto', f'foto_{id_foto}')
        loc = foto['Loc_Foto']
        print(f"\n🔄 [{id_foto}] {nome}")
        print(f"   URL: {loc[:80]}...")

        if dry_run:
            print("   ⏭️  Dry run — pulando download")
            continue

        tmp_path = str(tmp_dir / f'{id_foto}.tmp')
        if download_mega_file(loc, tmp_path):
            data_uri = file_to_data_uri(tmp_path)
            if data_uri:
                # Atualizar no banco
                {error: upd_err} = sb.table('fotos_vis').update(
                    {'Loc_Foto': data_uri}
                ).eq('id_foto', id_foto).execute()
                if upd_err:
                    print(f"   ❌ Erro ao atualizar: {upd_err}")
                    failed += 1
                else:
                    size_kb = os.path.getsize(tmp_path) / 1024
                    print(f"   ✅ Convertido ({size_kb:.0f}KB → base64)")
                    success += 1
                os.remove(tmp_path)
            else:
                failed += 1
        else:
            failed += 1

        # Rate limiting para não sobrecarregar o MEGA
        time.sleep(1)

    return success, failed


def migrate_sqlite(dry_run: bool = False):
    """Migra fotos MEGA no SQLite."""
    conn = get_sqlite_db()
    if not conn:
        print("⚠️  SQLite não encontrado, pulando...")
        return 0, 0

    cursor = conn.cursor()
    cursor.execute(
        "SELECT id_foto, Nome_Foto, Loc_Foto FROM fotos_vis WHERE Loc_Foto LIKE '%mega.nz/%'"
    )
    fotos = cursor.fetchall()
    print(f"📸 Encontradas {len(fotos)} fotos com links MEGA no SQLite")

    if not fotos:
        conn.close()
        return 0, 0

    success = 0
    failed = 0
    tmp_dir = Path('/tmp/mega_migration')
    tmp_dir.mkdir(exist_ok=True)

    for foto in fotos:
        id_foto = foto['id_foto']
        nome = foto['Nome_Foto'] or f'foto_{id_foto}'
        loc = foto['Loc_Foto']
        print(f"\n🔄 [{id_foto}] {nome}")
        print(f"   URL: {loc[:80]}...")

        if dry_run:
            print("   ⏭️  Dry run — pulando download")
            continue

        tmp_path = str(tmp_dir / f'{id_foto}.tmp')
        if download_mega_file(loc, tmp_path):
            data_uri = file_to_data_uri(tmp_path)
            if data_uri:
                cursor.execute(
                    "UPDATE fotos_vis SET Loc_Foto = ? WHERE id_foto = ?",
                    (data_uri, id_foto)
                )
                conn.commit()
                size_kb = os.path.getsize(tmp_path) / 1024
                print(f"   ✅ Convertido ({size_kb:.0f}KB → base64)")
                success += 1
                os.remove(tmp_path)
            else:
                failed += 1
        else:
            failed += 1

        time.sleep(1)

    conn.close()
    return success, failed


def main():
    parser = argparse.ArgumentParser(description='Migra fotos MEGA para base64')
    parser.add_argument('--dry-run', action='store_true', help='Apenas lista, não baixa')
    args = parser.parse_args()

    print("=" * 60)
    print("🔄 Migração de fotos MEGA → base64 data URI")
    print("=" * 60)

    if args.dry_run:
        print("⚠️  MODO DRY RUN — nenhuma alteração será feita\n")

    # Detectar backend
    sb = get_supabase_client()
    if sb:
        print("🗄️  Backend: Supabase\n")
        success, failed = migrate_supabase(args.dry_run)
    else:
        print("🗄️  Backend: SQLite (local)\n")
        success, failed = migrate_sqlite(args.dry_run)

    print("\n" + "=" * 60)
    print(f"✅ Sucesso: {success}")
    print(f"❌ Falha:   {failed}")
    print("=" * 60)


if __name__ == '__main__':
    main()
