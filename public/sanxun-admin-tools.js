/* 彰化三巡府：將原有雲端備份／同步面板搬到「宮務行政 → 系統設定」。
   不更動原儲存及同步 API，資料不刪除、不重置。 */
(()=>{
 'use strict';
 const ID='sanxun-admin-settings';
 const css=document.createElement('style');
 css.textContent=`
 #${ID}-entry{display:block;width:100%;border:0;background:transparent;color:inherit;text-align:left;padding:12px 16px;font:inherit;cursor:pointer;border-radius:10px}
 #${ID}-entry:hover{background:rgba(30,155,149,.12)}
 #${ID}-layer[hidden]{display:none!important}
 #${ID}-layer{position:fixed;inset:0;z-index:100000;background:rgba(0,25,40,.48);display:flex;justify-content:center;align-items:center;padding:20px}
 #${ID}-dialog{width:min(580px,100%);max-height:85vh;overflow:auto;background:white;color:#183747;border-radius:18px;padding:26px;box-shadow:0 20px 60px #0004;font:15px system-ui,sans-serif}
 #${ID}-dialog h2{font-size:23px;margin:0 0 10px}#${ID}-dialog p{line-height:1.7;color:#57717c}
 #${ID}-dialog .sanxun-close{float:right;border:1px solid #d7e4e7;padding:6px 11px;border-radius:8px;background:white;cursor:pointer}
 #${ID}-tools{margin-top:16px}
 #${ID}-tools>div{position:static!important;right:auto!important;bottom:auto!important;max-width:none!important;box-shadow:none!important;padding:16px!important;background:#edf8f5!important;border:1px solid #d1e8e2}
 #${ID}-notice[hidden]{display:none!important}#${ID}-notice{position:fixed;right:16px;bottom:16px;background:#fff0d8;color:#884600;padding:12px 16px;z-index:99999;border-radius:10px;box-shadow:0 3px 16px #0002;cursor:pointer}
 `;
 document.head.appendChild(css);
 let overlay,tools,notice,moved=false;
 function open(){overlay.hidden=false;const close=overlay.querySelector('.sanxun-close');close?.focus()}
 function close(){overlay.hidden=true}
 async function isAdmin(){try{const res=await fetch('/api/me',{credentials:'same-origin',cache:'no-store'});if(!res.ok)return false;const data=await res.json();return !!data.user?.admin}catch{return false}}
 function create(){
  overlay=document.createElement('div');overlay.id=ID+'-layer';overlay.hidden=true;
  overlay.innerHTML=`<section id="${ID}-dialog" role="dialog" aria-modal="true" aria-label="系統設定"><button type="button" class="sanxun-close">關閉 ✕</button><h2>⚙️ 宮務行政 · 系統設定</h2><p>資料會在背景自動同步至共用資料庫。此處可下載本裝置備份、檢查狀態及手動重新同步。發生錯誤時會另行提醒。</p><div id="${ID}-tools"></div><p style="font-size:12px">注意：下載備份不等於資料庫還原。為防止覆蓋既有信眾資料，這裡不提供一鍵還原。</p></section>`;
  document.body.appendChild(overlay);overlay.querySelector('.sanxun-close').onclick=close;
  overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!overlay.hidden)close()});
  tools=document.getElementById(ID+'-tools');
  notice=document.createElement('button');notice.type='button';notice.id=ID+'-notice';notice.hidden=true;notice.onclick=open;document.body.appendChild(notice);
 }
 function sidebar(){
  // 避免誤抓內文；優先選選單中可操作的宮務行政項目。
  const nodes=[...document.querySelectorAll('aside a,aside button,nav a,nav button,.sidebar a,.sidebar button,aside li,nav li')];
  let parent=nodes.find(n=>n.textContent?.trim().includes('宮務行政'));
  if(!parent){parent=[...document.querySelectorAll('a,button')].find(n=>n.textContent?.trim()==='宮務行政')}
  if(!parent)return false;
  const entry=document.createElement('button');entry.id=ID+'-entry';entry.type='button';entry.textContent='　⚙ 系統設定';entry.onclick=e=>{e.stopPropagation();open()};
  const wrapper=parent.closest('li')||parent;
  wrapper.insertAdjacentElement('afterend',entry);
  return true;
 }
 function relocate(){
  if(moved)return;
  const status=document.getElementById('temple-sync-box');
  if(!status)return;
  // 舊同步面板是外層 div，搬入設定頁後保留原按鈕及事件。
  const old=status.parentElement;
  if(!old)return;
  tools.appendChild(old);old.style.display='block';moved=true;
  const showError=()=>{
   const err=/失敗|衝突|尚未|錯誤|⚠️/.test(status.textContent||'');
   notice.hidden=!err;
   if(err)notice.textContent='⚠ 雲端同步異常，點此查看系統設定';
   // 原程式會自動隱藏成功狀態；但工具按鈕必須始終可操作。
   old.style.display='block';
  };
  new MutationObserver(showError).observe(status,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['style']});
  showError();
 }
 async function boot(){
  if(!await isAdmin())return;
  create();
  if(!sidebar()){
   // 舊版側邊欄若結構不同，備援加入頁首，不放回右下角。
   const btn=document.createElement('button');btn.id=ID+'-entry';btn.textContent='⚙ 宮務行政 · 系統設定';btn.onclick=open;
   (document.querySelector('header')||document.body).appendChild(btn);
  }
  relocate();
  new MutationObserver(()=>{if(!moved)relocate()}).observe(document.body,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else void boot();
})();
