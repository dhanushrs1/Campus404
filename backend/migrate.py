"""
migrate.py — one-time migration to add new columns to existing tables.
Run inside the Docker container: python migrate.py
"""
import sys
import os
sys.path.insert(0, '/app')

from database import Base, engine
from sqlalchemy import text, inspect
import guide.models as guide_models
import curriculum.models as curriculum_models

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

    # ── challenges: add challenge_type + expected_output ─────────────
    ch_cols = [c['name'] for c in insp.get_columns('challenges')]
    if 'challenge_type' not in ch_cols:
        conn.execute(text("ALTER TABLE challenges ADD COLUMN challenge_type VARCHAR(20) NOT NULL DEFAULT 'level'"))
        print('[OK] Added challenge_type to challenges')
    else:
        print('[SKIP] challenge_type already exists in challenges')

    if 'expected_output' not in ch_cols:
        conn.execute(text('ALTER TABLE challenges ADD COLUMN expected_output TEXT NULL'))
        print('[OK] Added expected_output to challenges')
    else:
        print('[SKIP] expected_output already exists in challenges')

    conn.execute(text("UPDATE challenges SET challenge_type='level' WHERE challenge_type IS NULL OR challenge_type = ''"))
    print('[OK] Backfilled null challenge_type values to level')

    # ── site_settings: add Guide display columns ───────────────────
    table_names = insp.get_table_names()
    if 'site_settings' in table_names:
        setting_cols = [c['name'] for c in insp.get_columns('site_settings')]

        if 'guide_default_author' not in setting_cols:
            conn.execute(text("ALTER TABLE site_settings ADD COLUMN guide_default_author VARCHAR(120) NOT NULL DEFAULT 'Campus404 Guide Team'"))
            print('[OK] Added guide_default_author to site_settings')
        else:
            print('[SKIP] guide_default_author already exists in site_settings')

        if 'guide_show_toc' not in setting_cols:
            conn.execute(text('ALTER TABLE site_settings ADD COLUMN guide_show_toc BOOLEAN NOT NULL DEFAULT 1'))
            print('[OK] Added guide_show_toc to site_settings')
        else:
            print('[SKIP] guide_show_toc already exists in site_settings')

        if 'guide_toc_depth' not in setting_cols:
            conn.execute(text('ALTER TABLE site_settings ADD COLUMN guide_toc_depth INTEGER NOT NULL DEFAULT 3'))
            print('[OK] Added guide_toc_depth to site_settings')
        else:
            print('[SKIP] guide_toc_depth already exists in site_settings')

        if 'guide_show_social_share' not in setting_cols:
            conn.execute(text('ALTER TABLE site_settings ADD COLUMN guide_show_social_share BOOLEAN NOT NULL DEFAULT 1'))
            print('[OK] Added guide_show_social_share to site_settings')
        else:
            print('[SKIP] guide_show_social_share already exists in site_settings')
    else:
        print('[SKIP] site_settings table does not exist yet; Guide settings columns not applied')

    # ── learn_posts: add one-to-one module_id linkage ────────────────
    if 'learn_posts' in table_names:
        post_cols = [c['name'] for c in insp.get_columns('learn_posts')]
        if 'module_id' not in post_cols:
            conn.execute(text('ALTER TABLE learn_posts ADD COLUMN module_id INTEGER NULL'))
            print('[OK] Added module_id to learn_posts')
        else:
            print('[SKIP] module_id already exists in learn_posts')

        post_indexes = [i.get('name') for i in insp.get_indexes('learn_posts')]
        if 'uq_learn_posts_module_id' not in post_indexes:
            conn.execute(text('CREATE UNIQUE INDEX uq_learn_posts_module_id ON learn_posts (module_id)'))
            print('[OK] Added unique index uq_learn_posts_module_id on learn_posts.module_id')
        else:
            print('[SKIP] uq_learn_posts_module_id already exists')
    else:
        print('[SKIP] learn_posts table does not exist yet; module linkage column not applied')

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

# Ensure Guide page tables exist
Base.metadata.create_all(
    bind=engine,
    tables=[
        guide_models.GuidePage.__table__,
        guide_models.guide_post_modules,
        curriculum_models.ChallengeAttempt.__table__,
    ],
)
print('[OK] Ensured Guide and progression tables exist (learn_posts, learn_post_modules, challenge_attempts).')
