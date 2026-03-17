"""
migrate.py — one-time migration to add new columns to existing tables.
Run inside the Docker container: python migrate.py
"""
import sys
import os
sys.path.insert(0, '/app')

from database import engine
from sqlalchemy import text, inspect

insp = inspect(engine)

with engine.connect() as conn:

    # ── labs: add hero_image_url ───────────────────────────
    lab_cols = [c['name'] for c in insp.get_columns('labs')]
    if 'hero_image_url' not in lab_cols:
        conn.execute(text('ALTER TABLE labs ADD COLUMN hero_image_url VARCHAR(512) NULL'))
        print('[OK] Added hero_image_url to labs')
    else:
        print('[SKIP] hero_image_url already exists in labs')

    # ── modules: add unique_id + slug ──────────────────────
    mod_cols = [c['name'] for c in insp.get_columns('modules')]
    if 'unique_id' not in mod_cols:
        conn.execute(text('ALTER TABLE modules ADD COLUMN unique_id VARCHAR(8) NULL'))
        print('[OK] Added unique_id to modules')
    else:
        print('[SKIP] unique_id already exists in modules')

    if 'slug' not in mod_cols:
        conn.execute(text('ALTER TABLE modules ADD COLUMN slug VARCHAR(300) NULL'))
        print('[OK] Added slug to modules')
    else:
        print('[SKIP] slug already exists in modules')

    if 'banner_image_path' not in mod_cols:
        conn.execute(text('ALTER TABLE modules ADD COLUMN banner_image_path VARCHAR(512) NULL'))
        print('[OK] Added banner_image_path to modules')
    else:
        print('[SKIP] banner_image_path already exists in modules')

    conn.commit()
    print('\nMigration complete.')

# Backfill unique_id + slug for existing modules
import random, string
with engine.connect() as conn:
    rows = conn.execute(text('SELECT id, title FROM modules WHERE unique_id IS NULL')).fetchall()
    for mid, title in rows:
        uid = ''.join(random.choices(string.ascii_lowercase + string.digits, k=4))
        import re
        base_slug = re.sub(r'[^a-z0-9-]+', '-', (title or 'module').lower()).strip('-')
        slug = f'{base_slug}-{uid}'
        conn.execute(text(f"UPDATE modules SET unique_id=:uid, slug=:slug WHERE id=:id"),
                     {'uid': uid, 'slug': slug, 'id': mid})
        print(f'[OK] Backfilled module id={mid}: uid={uid}, slug={slug}')
    conn.commit()
    print(f'Backfilled {len(rows)} modules.')
