#!/usr/bin/env python3
"""Run inside the existing GitHub repository root. Does not deploy anything."""
from pathlib import Path
from datetime import datetime
import shutil
root=Path.cwd(); server=root/'server.js'; front=root/'public'/'index.html'
if not server.is_file() or not front.is_file():
    raise SystemExit('錯誤：請在包含 server.js 和 public/index.html 的 GitHub 專案資料夾執行')
package=Path(__file__).resolve().parent
if not (package/'temple-sync.js').exists() or not (package/'index-synced.html').exists():
    raise SystemExit('錯誤：缺少同一壓縮包內的 temple-sync.js 或 index-synced.html')
s=server.read_text()
if 'installTempleSync(' in s:
    raise SystemExit('已發現同步模組，請勿重複執行')
checks=["import express from 'express';","app.use('/api',sameOrigin);","app.get('/api/me',auth,","init().then(()=>app.listen(","express.json({limit:'32kb'})"]
for c in checks:
    if c not in s:raise SystemExit('server.js 版本與預期不同，停止修改：'+c)
stamp=datetime.now().strftime('%Y%m%d-%H%M%S')
for p in [server,front]:shutil.copy2(p,p.with_name(p.name+'.backup-'+stamp))
s=s.replace("import express from 'express';","import express from 'express';\nimport { installTempleSync, initTempleSync } from './temple-sync.js';",1)
s=s.replace("express.json({limit:'32kb'})","express.json({limit:'8mb'})",1)
s=s.replace("app.get('/api/me',auth,", "installTempleSync(app,pool,auth,MODULES);\napp.get('/api/me',auth,",1)
s=s.replace("init().then(()=>app.listen(","init().then(()=>initTempleSync(pool)).then(()=>app.listen(",1)
server.write_text(s)
shutil.copy2(package/'temple-sync.js',root/'temple-sync.js')
shutil.copy2(package/'index-synced.html',front)
print('修改完成：server.js、temple-sync.js、public/index.html')
print('原版已建立 .backup-'+stamp+' 備份。尚未部署，也尚未匯入業務資料。')
