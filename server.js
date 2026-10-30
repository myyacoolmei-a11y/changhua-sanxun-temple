import express from 'express';
import { installTempleSync, initTempleSync } from './temple-sync.js';
import pg from 'pg';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname=path.dirname(fileURLToPath(import.meta.url));
const app=express();app.disable('x-powered-by');app.set('trust proxy',1);
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5,ssl:process.env.DB_SSL==='true'?{rejectUnauthorized:true}:undefined});
const MODULES=['首頁總覽','信眾管理','功德箱管理','關懷追蹤','活動管理','生日提醒','參與紀錄','財務管理','儀式管理','友宮管理','宮務行政','行事曆'];
const COOKIE='sanxun_session';
const hashToken=x=>crypto.createHash('sha256').update(x).digest('hex');
const hashPass=(password,salt=crypto.randomBytes(16).toString('hex'))=>salt+':'+crypto.scryptSync(password,salt,64).toString('hex');
const verifyPass=(password,saved)=>{try{const [salt,hex]=saved.split(':');return crypto.timingSafeEqual(Buffer.from(hex,'hex'),crypto.scryptSync(password,salt,64))}catch{return false}};
const cookieOpts={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'};
app.use(express.json({limit:'8mb'}));app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Cache-Control','no-store');next()});
const clean=s=>String(s||'').trim();
async function init(){
 await pool.query(`create table if not exists temple_users (id bigserial primary key, username text not null unique, display_name text not null, title text not null default '', password_hash text not null, is_admin boolean not null default false, enabled boolean not null default true, permissions jsonb not null default '[]'::jsonb, created_at timestamptz not null default now());`);
 await pool.query(`create table if not exists temple_sessions (token_hash text primary key, user_id bigint not null references temple_users(id) on delete cascade, expires_at timestamptz not null);`);
 await pool.query(`update temple_users u set permissions = (select coalesce(jsonb_agg(distinct case when value in ('三巡府行事曆','宮廟行事曆') then '行事曆' else value end), '[]'::jsonb) from jsonb_array_elements_text(u.permissions) as j(value)) where u.permissions ?| array['三巡府行事曆','宮廟行事曆'];`);
 const first=await pool.query('select count(*)::int as n from temple_users');
 if(first.rows[0].n===0){const password=process.env.ADMIN_INITIAL_PASSWORD; if(!password||password.length<8)throw Error('首次部署請設定 ADMIN_INITIAL_PASSWORD，至少 8 碼，不可寫入 GitHub');
  await pool.query('insert into temple_users(username,display_name,title,password_hash,is_admin,permissions) values($1,$2,$3,$4,true,$5)',[clean(process.env.ADMIN_USERNAME)||'LOH0715','系統管理員','系統管理',hashPass(password),JSON.stringify(MODULES)]);
  console.log('Initial admin account created; password was not logged.');}
}
async function auth(req,res,next){try{const m=(req.headers.cookie||'').match(/(?:^|;\s*)sanxun_session=([^;]+)/);if(!m)return res.status(401).json({error:'請先登入'});const token=decodeURIComponent(m[1]);const q=await pool.query(`select u.id,u.username,u.display_name,u.title,u.is_admin,u.enabled,u.permissions from temple_sessions s join temple_users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at>now() and u.enabled=true`,[hashToken(token)]);if(!q.rowCount)return res.status(401).json({error:'登入已失效，請重新登入'});req.user=q.rows[0];next()}catch(e){next(e)}}
function canManageUsers(u){return !!u.is_admin || String(u.username||'').toLowerCase()==='boss'}
function info(u){return {id:u.id,username:u.username,name:u.display_name,title:u.title,admin:u.is_admin,manageUsers:canManageUsers(u),permissions:u.is_admin?MODULES:u.permissions}}
function admin(req,res,next){if(!canManageUsers(req.user))return res.status(403).json({error:'沒有帳號管理權限'});next()}
function sameOrigin(req,res,next){if(['POST','PUT','PATCH','DELETE'].includes(req.method)){const origin=req.get('origin');const host=req.get('host');if(origin){let parsed;try{parsed=new URL(origin)}catch{return res.status(403).json({error:'來源網址格式不正確'})}if(parsed.host!==host)return res.status(403).json({error:'不允許跨站操作'})}}next()}
app.use('/api',sameOrigin);
const attempts=new Map();
app.post('/api/login',async(req,res,next)=>{try{const username=clean(req.body?.username),password=String(req.body?.password||'');const key=req.ip+':'+username.toLowerCase();const a=attempts.get(key);if(a?.until>Date.now()&&a.count>=6)return res.status(429).json({error:'登入嘗試過多，請稍後再試'});
 const q=await pool.query('select * from temple_users where username=$1 and enabled=true',[username]);const u=q.rows[0];if(!u||!verifyPass(password,u.password_hash)){const v=(a?.until>Date.now()?a.count:0)+1;attempts.set(key,{count:v,until:Date.now()+15*60*1000});return res.status(401).json({error:'帳號或密碼錯誤'});}attempts.delete(key);
 const token=crypto.randomBytes(32).toString('hex');await pool.query('insert into temple_sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval \'7 days\')',[hashToken(token),u.id]);res.cookie(COOKIE,token,{...cookieOpts,maxAge:7*24*3600*1000});res.json({user:info(u)});
 }catch(e){next(e)}});
app.post('/api/logout',auth,async(req,res,next)=>{try{const m=req.headers.cookie.match(/(?:^|;\s*)sanxun_session=([^;]+)/);if(m)await pool.query('delete from temple_sessions where token_hash=$1',[hashToken(decodeURIComponent(m[1]))]);res.clearCookie(COOKIE,cookieOpts);res.json({ok:true})}catch(e){next(e)}});
app.get('/api/me',auth,(req,res)=>res.json({user:info(req.user),modules:MODULES}));
app.get('/api/users',auth,admin,async(req,res,next)=>{try{const q=await pool.query('select id,username,display_name,title,is_admin,enabled,permissions from temple_users order by id');res.json({users:q.rows.map(u=>({...info(u),enabled:u.enabled}))})}catch(e){next(e)}});
app.post('/api/users',auth,admin,async(req,res,next)=>{try{const {username,name,title,password,permissions}=req.body||{};if(!/^[A-Za-z0-9_.-]{3,40}$/.test(username||'')||!clean(name)||String(password||'').length<8||!Array.isArray(permissions))return res.status(400).json({error:'請填寫有效的帳號、姓名及至少 8 碼密碼'});const allowed=[...new Set(permissions.filter(x=>MODULES.includes(x)))];const q=await pool.query('insert into temple_users(username,display_name,title,password_hash,permissions) values($1,$2,$3,$4,$5) returning id',[username,clean(name).slice(0,80),clean(title).slice(0,80),hashPass(password),JSON.stringify(allowed)]);res.json({id:q.rows[0].id})}catch(e){if(e.code==='23505')return res.status(409).json({error:'帳號已經存在'});next(e)}});
app.patch('/api/users/:id',auth,admin,async(req,res,next)=>{try{const id=Number(req.params.id);const q=await pool.query('select * from temple_users where id=$1',[id]);const u=q.rows[0];if(!u)return res.status(404).json({error:'找不到帳號'});if(u.is_admin&&id!==Number(req.user.id))return res.status(403).json({error:'不能修改其他最高管理員'});
if(u.is_admin&&!req.user.is_admin)return res.status(403).json({error:'Boss 不能修改最高管理員'});
const {name,title,permissions,enabled,password}=req.body||{};
if(typeof name==='string'&&!clean(name))return res.status(400).json({error:'姓名不能空白'});
if(password!==undefined&&String(password).length<8)return res.status(400).json({error:'新密碼至少 8 碼'});
const allowed=Array.isArray(permissions)?[...new Set(permissions.filter(x=>MODULES.includes(x)))]:u.permissions;
if(u.is_admin&&enabled===false)return res.status(403).json({error:'不能停用最高管理員'});
await pool.query('update temple_users set display_name=$1,title=$2,permissions=$3,enabled=$4,password_hash=$5 where id=$6',[typeof name==='string'?clean(name).slice(0,80):u.display_name,typeof title==='string'?clean(title).slice(0,80):u.title,JSON.stringify(u.is_admin?MODULES:allowed),u.is_admin?true:typeof enabled==='boolean'?enabled:u.enabled,password?hashPass(password):u.password_hash,id]);if(password||enabled===false)await pool.query('delete from temple_sessions where user_id=$1',[id]);res.json({ok:true})}catch(e){next(e)}});
// Only system admin and the dedicated boss account may delete accounts.
// Protect the system administrator, and allow boss to delete itself.
app.delete('/api/users/:id',auth,admin,async(req,res,next)=>{
 try{
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'帳號編號無效'});
  const q=await pool.query('SELECT id,username,is_admin FROM temple_users WHERE id=$1',[id]);
  if(!q.rowCount)return res.status(404).json({error:'找不到帳號'});
  const target=q.rows[0];
  if(target.is_admin)return res.status(403).json({error:'最高系統管理員不可刪除'});
  const self=id===Number(req.user.id);
  await pool.query('DELETE FROM temple_users WHERE id=$1 AND is_admin=false',[id]);
  if(self)res.clearCookie(COOKIE,cookieOpts);
  return res.json({ok:true,loggedOut:self});
 }catch(e){next(e)}
});
app.get('/health',async(req,res)=>{try{await pool.query('select 1');res.json({ok:true})}catch{res.status(503).json({ok:false})}});
app.get('/api/diagnostics',async(req,res)=>{try{const q=await pool.query('select exists(select 1 from temple_users) as initialized');res.json({api:'online',database:'online',users_initialized:q.rows[0].initialized})}catch{res.status(503).json({api:'online',database:'unavailable'})}});
app.get('/login',(_,res)=>res.sendFile(path.join(__dirname,'public','login.html')));
app.get('/login.html',(_,res)=>res.redirect('/login'));
app.get('/', async (req, res, next) => {
 try {
  const match=(req.headers.cookie||'').match(/(?:^|;\s*)sanxun_session=([^;]+)/);
  if(!match)return res.redirect('/login');
  let token;try{token=decodeURIComponent(match[1])}catch{return res.redirect('/login')}
  const result=await pool.query(`SELECT 1 FROM temple_sessions s JOIN temple_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.enabled=true`,[hashToken(token)]);
  if(!result.rowCount)return res.redirect('/login');
  return res.sendFile(path.join(__dirname,'public','index.html'));
 }catch(error){next(error)}
});
app.get('/index.html',(_,res)=>res.redirect('/'));
app.use(express.static(path.join(__dirname,'public'),{index:false}));
app.use((err,req,res,next)=>{console.error('Request error:',err.code||err.message);res.status(500).json({error:'伺服器處理失敗，請檢查 Railway logs'})});
init().then(()=>app.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Temple system ready'))).catch(e=>{console.error('Startup failed:',e.message);process.exit(1)});
