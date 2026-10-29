<script>
/* Login and account permissions: supplied by Railway API. Existing localStorage business records are NOT migrated to SQL. */
(async function(){
const response=await fetch('/api/me',{credentials:'same-origin'}).catch(()=>null);if(!response?.ok){location.replace('/login');return}
const data=await response.json();const me=data.user;const permitted=new Set(me.permissions||[]);
const all=[...new Set(modules.map(m=>m[0]).concat(data.modules))];
const accountLabel=document.querySelector('.admin');if(accountLabel)accountLabel.innerHTML='👤 '+safe(me.name)+'｜'+safe(me.title)+' <button onclick="sanxunLogout()" style="border:0;background:#eef7f3;border-radius:8px;padding:6px;cursor:pointer">登出</button>';
window.sanxunLogout=async()=>{await fetch('/api/logout',{method:'POST'});location.replace('/login')};
function safe(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
if(me.manageUsers&&!modules.some(x=>x[0]==='帳號權限管理'))modules.push(['帳號權限管理','🔐']);
const originalDraw=drawNav;
drawNav=function(){originalDraw();document.querySelectorAll('#nav button').forEach(b=>{const text=b.textContent.trim();if(text.includes('帳號權限管理')){if(!me.manageUsers)b.remove();return}const match=modules.find(([name])=>text.includes(name));if(match&&!me.admin&&!permitted.has(match[0]))b.remove()});};
const originalGo=go;
go=function(name){if(name==='帳號權限管理'){if(!me.manageUsers)return;current=name;drawNav();renderAccounts();document.getElementById('side').classList.remove('open');return;}if(!me.admin&&!permitted.has(name)){alert('你沒有這個功能的使用權限');return;}originalGo(name)};
window.go=go;
if(!me.admin&&!permitted.has(current)){current=modules.find(x=>permitted.has(x[0]))?.[0]||'';if(current)go(current);else document.getElementById('content').innerHTML='<div class="datawrap">尚未授權任何功能，請聯絡管理員。</div>'}drawNav();
function renderAccounts(){document.getElementById('content').innerHTML=`<div class="moduleHead"><div><h1>🔐 帳號權限管理</h1><p>每個人自由填寫職位，個別決定可使用的左側功能。</p></div></div><div class="datawrap"><div id="sx-list">正在載入...</div><hr style="border:0;border-top:1px solid #e6eeec;margin:20px 0"><h3 id="sx-form-title">新增使用者</h3><form id="sx-form" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:12px"><label>姓名<input name="name" required maxlength="80" style="display:block;width:100%;padding:10px;margin-top:6px"></label><label>職位／頭銜<input name="title" maxlength="80" placeholder="例如：副主任委員" style="display:block;width:100%;padding:10px;margin-top:6px"></label><label>登入帳號<input name="username" required pattern="[A-Za-z0-9_.-]{3,40}" style="display:block;width:100%;padding:10px;margin-top:6px"></label><label>密碼（新增必填，修改時留空表示不變）<input name="password" type="password" minlength="8" autocomplete="new-password" style="display:block;width:100%;padding:10px;margin-top:6px"></label><div style="grid-column:1/-1"><strong>可使用的功能</strong><div id="sx-perms" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px;margin:15px 0"></div></div><label style="grid-column:1/-1"><input type="checkbox" name="enabled" checked> 啟用帳號</label><div style="grid-column:1/-1"><button type="submit" class="primary">儲存帳號</button> <button type="button" id="sx-reset" style="padding:11px;border:1px solid #ddd;border-radius:9px;background:#fff">取消編輯／清空</button></div><div id="sx-message" style="grid-column:1/-1;color:#9b3f36"></div></form><p class="notice">注意：登入與帳號權限已儲存在 PostgreSQL；原本信眾、捐款等業務資料仍使用各瀏覽器 localStorage，尚未遷移到資料庫。正式開放多人共用真實個資前，必須完成各資料 API 的伺服器端權限檢查與遷移。</p></div>`;
const f=document.getElementById('sx-form');let editing=null,records=[];
function renderChecks(allow=[]){document.getElementById('sx-perms').innerHTML=all.map(x=>`<label style="display:flex;gap:6px;align-items:center;font-size:13px"><input type="checkbox" value="${safe(x)}" ${allow.includes(x)?'checked':''}>${safe(x)}</label>`).join('')}
function reset(){editing=null;f.reset();f.elements.username.disabled=false;f.elements.password.required=true;f.elements.enabled.checked=true;document.getElementById('sx-form-title').textContent='新增使用者';renderChecks([])}
document.getElementById('sx-reset').onclick=reset;
async function load(){const r=await fetch('/api/users');if(!r.ok)throw Error('無法載入帳號');records=(await r.json()).users;document.getElementById('sx-list').innerHTML='<div style="overflow-x:auto"><table><thead><tr><th>姓名</th><th>頭銜</th><th>登入帳號</th><th>權限</th><th>狀態</th><th>操作</th></tr></thead><tbody>'+records.map(u=>`<tr><td>${safe(u.name)}</td><td>${safe(u.title||'—')}</td><td>${safe(u.username)}</td><td>${u.admin?'全部功能':u.permissions.length+' 項'}</td><td>${u.enabled?'啟用':'停用'}</td><td><button type="button" data-id="${u.id}" class="sx-edit" style="padding:7px 10px">編輯</button> ${u.admin?'':`<button type="button" data-id="${u.id}" class="sx-delete" style="padding:7px 10px;color:#b02f37;border:1px solid #edc5c5;border-radius:7px;margin-left:6px;background:white">刪除</button>`}</td></tr>`).join('')+'</tbody></table></div>';document.querySelectorAll('.sx-edit').forEach(b=>b.onclick=()=>{const u=records.find(x=>String(x.id)===b.dataset.id);if(!u)return;editing=u;f.elements.name.value=u.name;f.elements.title.value=u.title||'';f.elements.username.value=u.username;f.elements.username.disabled=true;f.elements.password.value='';f.elements.password.required=false;f.elements.enabled.checked=u.enabled;renderChecks(u.permissions);document.getElementById('sx-form-title').textContent='編輯：'+u.name;f.scrollIntoView({behavior:'smooth',block:'start'})})}
document.getElementById('sx-list').addEventListener('click',async e=>{
 const b=e.target.closest('.sx-delete');if(!b)return;
 const target=records.find(x=>String(x.id)===b.dataset.id);if(!target||target.admin)return;
 const self=String(target.id)===String(me.id);
 if(!confirm(self?'確定永久刪除自己的 Boss 帳號？刪除後會立即登出，且無法再使用這組帳號登入。':'確定永久刪除「'+target.name+'」的登入帳號？此操作無法復原。'))return;
 b.disabled=true;
 try{
  const r=await fetch('/api/users/'+encodeURIComponent(target.id),{method:'DELETE',credentials:'same-origin'});
  const j=await r.json();if(!r.ok)throw Error(j.error||'刪除失敗');
  if(j.loggedOut){location.replace('/login');return}
  if(editing&&String(editing.id)===String(target.id))reset();
  await load();
 }catch(ex){alert(ex.message);b.disabled=false}
});
f.onsubmit=async e=>{e.preventDefault();const msg=document.getElementById('sx-message');msg.textContent='';const vals={name:f.elements.name.value,title:f.elements.title.value,username:f.elements.username.value,enabled:f.elements.enabled.checked,permissions:[...document.querySelectorAll('#sx-perms input:checked')].map(x=>x.value)};if(f.elements.password.value)vals.password=f.elements.password.value;if(!editing&&!vals.password){msg.textContent='請設定初始密碼（至少 8 碼）';return}try{const r=await fetch(editing?'/api/users/'+editing.id:'/api/users',{method:editing?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(vals)});const j=await r.json();if(!r.ok)throw Error(j.error||'儲存失敗');reset();await load();msg.style.color='#087f7a';msg.textContent='已儲存至資料庫'}catch(ex){msg.style.color='#a22';msg.textContent=ex.message}};
renderChecks([]);load().catch(ex=>document.getElementById('sx-list').textContent=ex.message);
}
})();
</script>
