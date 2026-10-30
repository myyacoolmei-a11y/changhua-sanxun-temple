/* Cloud sync adapter: preserves browser copy until manually imported by system admin. */
(function(){
  const keys=['sanxun-demo-editable-v1','sanxun-activity-roster-v1','sanxun-public-submissions-v1'];
  let version=null, initialized=false, pending=false, busy=false, failed=false, booting=true;
  let lastSaved='';
  let granted=[];
  const $=()=>document.getElementById('temple-sync-box');
  const status=(message,warning=false)=>{
  const el=$();
  if(!el)return;
  el.textContent=message;
  el.style.background=warning?'#fff0d8':'#e0f2eb';
  el.style.color=warning?'#884600':'#075d53';

  // 正常時隱藏整個同步提示框，異常時顯示
  if(el.parentElement){
    el.parentElement.style.display=warning?'block':'none';
  }
};
  function localSnapshot(){return {db:structuredClone(db),rosters:structuredClone(rosters),publicSubmissions:structuredClone(publicSubmissions)}}
  function backup(){
    const data={exportedAt:new Date().toISOString(),url:location.origin,keys:{}};
    for(const k of keys)data.keys[k]=localStorage.getItem(k);
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='三巡府瀏覽器資料備份-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),15000);
  }
  function replaceSnapshot(p){
    if(!p?.db)return;
    for(const name of Object.keys(db))if(Array.isArray(p.db[name]))db[name]=p.db[name];
    if(p.rosters)rosters=p.rosters;
    if(Array.isArray(p.publicSubmissions))publicSubmissions=p.publicSubmissions;
    for(const k of keys){try{localStorage.setItem(k,JSON.stringify(k===keys[0]?db:k===keys[1]?rosters:publicSubmissions))}catch{}}
    try{go(current||'首頁總覽')}catch{try{home()}catch{}}
  }
  function warning(){failed=true;status('⚠️ 雲端儲存失敗或資料版本衝突。本機保留資料；請先下載備份，暫停其他修改。',true)}
  async function request(url,opt){const r=await fetch(url,{credentials:'same-origin',cache:'no-store',...opt});let j={};try{j=await r.json()}catch{}if(!r.ok)throw Error(j.error||'HTTP '+r.status);return j}
  async function save(){
    if(busy||booting||!initialized||failed)return;
    busy=true;
    while(pending&&!failed){pending=false;const snapshot=localSnapshot();snapshot.db=Object.fromEntries(Object.entries(snapshot.db).filter(([k])=>granted.includes(k)));if(!granted.includes('活動管理')&&!granted.includes('參與紀錄'))snapshot.rosters={};if(!granted.includes('活動管理'))snapshot.publicSubmissions=[];try{
      const result=await request('/api/sync',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({revision:version,payload:snapshot})});
      version=result.revision;lastSaved=JSON.stringify(snapshot);status('☁️ 已同步雲端');
    }catch(e){console.error('Temple sync',e);warning()}}
    busy=false;
  }
  function changed(){if(booting)return;pending=true;status(initialized?'☁️ 正在儲存…':'⚠️ 尚未初始化雲端。請由電腦管理員匯入資料。',!initialized);if(initialized)void save()}
  const originalPersist=persist;
  persist=function(){const ok=originalPersist();if(ok)changed();return ok};
  const originalRoster=saveRosters;
  saveRosters=function(){originalRoster();changed()};
  const originalPublic=publicSave;
  publicSave=function(){originalPublic();changed()};
  async function initialize(){
    if(initialized)return alert('已有雲端資料，禁止重複匯入！');
    if(!confirm('請先按「下載此裝置資料備份」。確定要把目前這台電腦的資料設為所有裝置共用的第一份雲端資料嗎？\n\n注意：如果這是手機或資料不完整，請取消。'))return;
    backup();
    try{const result=await request('/api/sync/initialize',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({payload:localSnapshot()})});version=result.revision;initialized=true;failed=false;lastSaved=JSON.stringify(localSnapshot());status('☁️ 已完成首次匯入，可開始跨裝置同步');}catch(e){alert('匯入失敗：'+e.message);warning()}
  }
  async function refresh(){if(booting||busy||pending||failed)return;try{
    const result=await request('/api/sync');
    if(result.initialized&&result.revision!==version){
      if(JSON.stringify(localSnapshot())!==lastSaved && lastSaved && !confirm('雲端有新資料，但目前裝置資料和上次同步不一致。請先下載備份。確定用雲端資料更新畫面？')){warning();return}
      version=result.revision;replaceSnapshot(result.payload);lastSaved=JSON.stringify(localSnapshot());status('☁️ 已更新最新資料');
    }
  }catch(e){console.error(e);warning()}}
  function ui(){
    const b=document.createElement('div');b.style.cssText='position:fixed;right:12px;bottom:12px;z-index:99999;max-width:350px;background:#e0f2eb;color:#075d53;padding:12px;border-radius:12px;box-shadow:0 4px 15px #0002;font:13px sans-serif;';
    b.innerHTML='<div id="temple-sync-box">☁️ 正在檢查雲端資料…</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px"><button type="button" id="temple-backup">下載此裝置資料備份</button><button type="button" id="temple-import" style="display:none">管理員首次匯入</button><button type="button" id="temple-refresh">重新同步</button></div>';
    document.body.appendChild(b);
    document.getElementById('temple-backup').onclick=backup;
    document.getElementById('temple-import').onclick=initialize;
    document.getElementById('temple-refresh').onclick=()=>{if(failed){alert('已發生儲存衝突，請先下載本機備份，避免覆蓋資料。');return}void refresh()};
  }
  async function boot(){ui();try{
    const [user,result]=await Promise.all([request('/api/me'),request('/api/sync')]);granted=user.user?.permissions||[];
    if(!result.initialized){status('⚠️ 雲端尚未匯入。請在最新資料的電腦下載備份並由最高管理員初始化。',true);if(user.user?.admin)document.getElementById('temple-import').style.display='';return}
    initialized=true;version=result.revision;
    // Preserve local old data as a backup, never silently merge local stale content.
    for(const k of keys){if(localStorage.getItem(k))localStorage.setItem(k+'-precloud-backup',localStorage.getItem(k))}
    replaceSnapshot(result.payload);lastSaved=JSON.stringify(localSnapshot());status('☁️ 已連接共用資料庫');
  }catch(e){console.error(e);warning()}finally{booting=false}}
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh()});
  window.addEventListener('focus',()=>void refresh());
  setInterval(()=>void refresh(),30000);
  if(!new URLSearchParams(location.search).has('register'))void boot();
})();
