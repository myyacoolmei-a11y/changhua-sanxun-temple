import express from 'express';

// One authoritative revisioned snapshot. Writes are checked against user permissions.
export function installTempleSync(app, pool, auth, modules) {
  const r = express.Router();
  const allowed = u => u.is_admin ? modules : (Array.isArray(u.permissions) ? u.permissions : []);
  const admin = u => Boolean(u.is_admin);
  const filtered = (payload, perms) => {
    const result = {db:{},rosters:{},publicSubmissions:[]};
    for (const name of perms) if (Array.isArray(payload?.db?.[name])) result.db[name] = payload.db[name];
    if (perms.includes('活動管理') || perms.includes('參與紀錄')) result.rosters = payload?.rosters || {};
    if (perms.includes('活動管理')) result.publicSubmissions = payload?.publicSubmissions || [];
    return result;
  };
  const valid = x => x && typeof x === 'object' && !Array.isArray(x) && x.db && typeof x.db === 'object' && !Array.isArray(x.db) && x.rosters && typeof x.rosters === 'object' && !Array.isArray(x.rosters) && Array.isArray(x.publicSubmissions) && Object.keys(x.db).every(k => modules.includes(k) && Array.isArray(x.db[k]));
  const eq = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  r.use(auth);
  r.get('/', async(req,res,next) => { try {
    const q = await pool.query('select revision,payload,updated_at from temple_sync_state where id=1');
    if (!q.rowCount) return res.json({initialized:false});
    return res.json({initialized:true,revision:Number(q.rows[0].revision),payload:filtered(q.rows[0].payload,allowed(req.user)),updatedAt:q.rows[0].updated_at});
  }catch(e){next(e)} });
  r.post('/initialize', async(req,res,next)=> {try {
    if(!admin(req.user)) return res.status(403).json({error:'只有最高管理員可首次匯入'});
    if(!valid(req.body?.payload)) return res.status(400).json({error:'備份資料格式不正確'});
    const p=req.body.payload;
    for(const key of modules) if(!Array.isArray(p.db[key])) p.db[key]=[];
    const q=await pool.query('insert into temple_sync_state(id,revision,payload,updated_by) values(1,1,$1,$2) on conflict(id) do nothing returning revision',[JSON.stringify(p),req.user.id]);
    if(!q.rowCount) return res.status(409).json({error:'雲端資料已存在，不能再次初始化或覆蓋'});
    res.json({ok:true,revision:1});
  }catch(e){next(e)} });
  r.put('/', async(req,res,next)=> {const client=await pool.connect();try {
    const {revision,payload}=req.body||{};
    if(!Number.isSafeInteger(revision)||revision<1||!valid(payload)) return res.status(400).json({error:'資料格式或版本不正確'});
    await client.query('BEGIN');
    const q=await client.query('select revision,payload from temple_sync_state where id=1 for update');
    if(!q.rowCount){await client.query('ROLLBACK');return res.status(409).json({error:'尚未匯入電腦資料，禁止儲存'})}
    const current=q.rows[0],old=current.payload,perm=allowed(req.user),next=structuredClone(old);
    if(Number(current.revision)!==revision){await client.query('ROLLBACK');return res.status(409).json({error:'資料已被其他裝置修改；保留本機資料，請先備份並重新同步'})}
    // Only accept changes to modules granted to this user. Unseen modules remain intact.
    for(const [name,rows] of Object.entries(payload.db)) {
      if(!perm.includes(name)){await client.query('ROLLBACK');return res.status(403).json({error:'沒有「'+name+'」修改權限'})}
      next.db[name]=rows;
    }
    if(perm.includes('活動管理')||perm.includes('參與紀錄')) next.rosters=payload.rosters;
    else if(Object.keys(payload.rosters).length) {await client.query('ROLLBACK');return res.status(403).json({error:'沒有參與紀錄權限'})}
    if(perm.includes('活動管理'))next.publicSubmissions=payload.publicSubmissions;
    else if(payload.publicSubmissions.length){await client.query('ROLLBACK');return res.status(403).json({error:'沒有活動管理權限'})}
    await client.query('update temple_sync_state set revision=revision+1,payload=$1,updated_by=$2,updated_at=now() where id=1',[JSON.stringify(next),req.user.id]);
    await client.query('COMMIT');res.json({ok:true,revision:revision+1});
  }catch(e){try{await client.query('ROLLBACK')}catch{}next(e)}finally{client.release()} });
  app.use('/api/sync',r);
}

export async function initTempleSync(pool){
  await pool.query(`create table if not exists temple_sync_state (
    id integer primary key check(id=1),revision bigint not null,
    payload jsonb not null, updated_by bigint references temple_users(id),
    updated_at timestamptz not null default now())`);
}
