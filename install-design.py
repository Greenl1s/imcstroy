#!/usr/bin/env python3
"""Install the corporate theme without replacing application JS or current HTML."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import re
import shutil

VERSION = '20261020-1'
FILES = ['filemanager/web/index.html', 'filemanager/web/isu-corporate.css',
         'filemanager/web/brand/cstroy-mark.svg', 'filemanager/web/brand/favicon.png']

def update_html(html):
    # Validate before touching any server file; refuse incompatible application layouts.
    required = ['appScreen', 'profileBtn', 'profileName', 'profileInitials',
                'profileRole', 'columnsView', 'createSideBtn', 'registrySection', 'journalSection']
    for key in required:
        if not re.search(r'\bid=["\']' + re.escape(key) + r'["\']', html):
            raise ValueError('Incompatible ISU HTML: missing #' + key)
    if (f'/isu-corporate.css?v={VERSION}' in html and 'class="isu-brand"' in html
            and 'class="isu-workspace-heading"' in html and '/brand/favicon.png' in html):
        return html
    if '/isu-corporate.css' not in html:
        html = html.replace('</head>', f'<link rel="stylesheet" href="/isu-corporate.css?v={VERSION}">\n</head>', 1)
    html = re.sub(r'<link\b(?=[^>]*\brel=["\'](?:shortcut )?icon["\'])[^>]*>\s*', '', html, flags=re.I)
    html = html.replace('</head>', f'<link rel="icon" type="image/png" href="/brand/favicon.png?v={VERSION}">\n</head>', 1)
    html = re.sub(r'(<meta\s+name="theme-color"\s+content=")[^"]*(")', r'\g<1>#143d73\2', html)
    if 'class="isu-brand"' not in html:
        brand = '''<a class="isu-brand" href="/?section=files" aria-label="НИЦ Строительство — главная">
      <img src="/brand/cstroy-mark.svg" alt="Эмблема НИЦ Строительство" width="73" height="57">
      <span class="isu-brand-text"><b>НИЦ</b><strong>строительство</strong><small>научно-исследовательский центр</small></span>
    </a><div class="isu-system-label">ИНФОРМАЦИОННАЯ СИСТЕМА УПРАВЛЕНИЯ</div>'''
        html, count = re.subn(r'(<div\s+class="sidebar"\s*>)', lambda m:m[1]+'\n    '+brand, html, count=1)
        if count != 1:
            raise ValueError('Sidebar not found')
    profile = re.search(r'<button\b(?=[^>]*\bid="profileBtn")[\s\S]*?</button>', html)
    if not profile:
        raise ValueError('Profile button not found')
    html = html[:profile.start()] + html[profile.end():]
    html, count = re.subn(r'(<div\s+class="side-bottom"\s*>)', lambda m:m[1]+'\n    '+profile[0], html, count=1)
    if count != 1:
        raise ValueError('Sidebar footer not found')
    if 'class="isu-workspace-heading"' not in html:
        heading = '<header class="isu-workspace-heading"><h1>Рабочее пространство</h1><p>Материалы и проекты отдела — в единой системе</p></header>\n'
        html = html.replace('<div id="columnsView"', heading+'<div id="columnsView"', 1)
    # All existing IDs and scripts must survive exactly once/unchanged.
    return html

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--root', type=Path, required=True, help='Existing ISU repository, e.g. /home/admin/pribory')
    parser.add_argument('--rollback', action='store_true', help='Restore latest backup made by this installer')
    args = parser.parse_args()
    root = args.root.expanduser().resolve()
    if not (root/'filemanager/Dockerfile').is_file() or not (root/'docker-compose.yml').is_file():
        raise SystemExit('Not an ISU repository: ' + str(root))
    backup_root = root.parent/'isu-design-backups'/root.name
    if args.rollback:
        backups = sorted(backup_root.glob('*/manifest.json'))
        if not backups:
            raise SystemExit('No theme backup found')
        manifest_path = backups[-1]
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        if manifest['root'] != str(root):
            raise SystemExit('Backup belongs to another installation')
        for relative, info in manifest['files'].items():
            if relative not in FILES:
                raise SystemExit('Unexpected backup path')
            target = root/relative
            current_digest = digest(target) if target.is_file() else None
            if info['installed_sha256'] != current_digest:
                raise SystemExit('File changed since installation; manual restore needed: ' + relative)
        for relative, info in manifest['files'].items():
            target = root/relative
            if info['existed']:
                shutil.copy2(manifest_path.parent/relative, target)
            else:
                target.unlink(missing_ok=True)
        print('Restored backup:', manifest_path.parent)
        print('Rebuild filemanager: sudo docker compose up -d --build --no-deps filemanager')
        return
    index = root/FILES[0]
    before = index.read_text(encoding='utf-8')
    after = update_html(before)
    ids = lambda text: sorted(re.findall(r'\bid="([^"]+)"', text))
    if ids(before) != ids(after):
        raise SystemExit('HTML ID preservation check failed')
    scripts = lambda text: re.findall(r'<script\b[\s\S]*?</script>', text)
    if scripts(before) != scripts(after):
        raise SystemExit('Script preservation check failed')
    source = Path(__file__).resolve().parent
    for relative in FILES[1:]:
        if not (source/relative).is_file():
            raise SystemExit('Incomplete package: ' + relative)
    backup = backup_root/datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f')
    backup.mkdir(parents=True, exist_ok=False)
    manifest = {'root':str(root), 'version':VERSION, 'files':{}}
    for relative in FILES:
        target = root/relative
        existed = target.is_file()
        manifest['files'][relative] = {'existed':existed}
        if existed:
            saved = backup/relative
            saved.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(target, saved)
    try:
        for relative in FILES[1:]:
            target = root/relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source/relative, target)
        index.write_text(after, encoding='utf-8')
    except Exception:
        for relative, info in manifest['files'].items():
            target = root/relative
            if info['existed']:
                shutil.copy2(backup/relative, target)
            else:
                target.unlink(missing_ok=True)
        raise
    for relative in FILES:
        manifest['files'][relative]['installed_sha256'] = digest(root/relative)
    (backup/'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Corporate theme installed. Backup:', backup)
    print('Application scripts and IDs preserved. Rebuild only filemanager.')

if __name__ == '__main__':
    main()
