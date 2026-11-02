#!/usr/bin/env python3
"""Run this in the cloned 三巡府 repo (same directory as server.js)."""
from pathlib import Path
import shutil
from datetime import datetime
root=Path.cwd(); target=root/'public'/'index.html'; src=Path(__file__).resolve().with_name('sanxun-admin-tools.js')
if not target.is_file() or not src.is_file():
    raise SystemExit('請把本程式與 sanxun-admin-tools.js 放在專案根目錄，且確認 public/index.html 存在。')
s=target.read_text(encoding='utf-8'); tag='<script src="/sanxun-admin-tools.js" defer></script>'
if tag in s:
    print('系統設定腳本已安裝，無須再次修改。')
else:
    if '</body>' not in s:raise SystemExit('找不到 </body>，已停止，不會修改原檔。')
    back=target.with_name('index.html.backup-'+datetime.now().strftime('%Y%m%d-%H%M%S'))
    shutil.copy2(target,back)
    target.write_text(s.replace('</body>',tag+'\n</body>',1),encoding='utf-8')
    print('已備份原始 index：',back)
shutil.copy2(src,root/'public'/'sanxun-admin-tools.js')
print('完成：public/index.html / public/sanxun-admin-tools.js')
print('僅調整備份及同步工具介面，不更改 Railway 資料庫。')
