import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError, text, monthDays, safeFilename } from './domain.mjs';
import { workbook } from './xlsx.mjs';
import { workflowApi } from './workflow.mjs';
import { permissionGroups,allPermissions,normalizePermissions } from './permissions.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const host=process.env.HOST || '127.0.0.1', port=Number(process.env.PORT || 3180);
const basePath=(process.env.APP_BASE_PATH||'').replace(/\/$/,'');
if(basePath&&!/^\/[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(basePath))throw new Error('APP_BASE_PATH должен быть путём вида /tabel или пустой строкой');
const file=resolve(process.env.DATABASE_PATH || resolve(root,'data','timesheets.sqlite'));
mkdirSync(dirname(file),{recursive:true});
const db=new DatabaseSync(file);
db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','employee')),created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS positions(id TEXT PRIMARY KEY,name TEXT NOT NULL,name_key TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS employees(id TEXT PRIMARY KEY,name TEXT NOT NULL,position_id TEXT NOT NULL REFERENCES positions(id),birthday TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS work_types(id TEXT PRIMARY KEY,label TEXT NOT NULL,category TEXT NOT NULL CHECK(category IN ('regular','trip')),active INTEGER NOT NULL DEFAULT 1,UNIQUE(label,category));
CREATE TABLE IF NOT EXISTS permissions(position_id TEXT NOT NULL REFERENCES positions(id),work_type_id TEXT NOT NULL REFERENCES work_types(id),PRIMARY KEY(position_id,work_type_id));
CREATE TABLE IF NOT EXISTS signers(id TEXT PRIMARY KEY,name TEXT NOT NULL,position TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS sheets(id TEXT PRIMARY KEY,name TEXT NOT NULL,month TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('draft','completed')),revision INTEGER NOT NULL,body TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,sheet_id TEXT NOT NULL REFERENCES sheets(id),user_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS sheets_status_updated ON sheets(status,updated_at);
CREATE INDEX IF NOT EXISTS audit_sheet ON audit(sheet_id,id);
CREATE INDEX IF NOT EXISTS sheets_month ON sheets(month);
`);
// Backward-compatible migration: existing employees retain their former sections.
const columns=db.prepare('PRAGMA table_info(users)').all().map(c=>c.name);
if(!columns.includes('deleted_at'))db.exec('ALTER TABLE users ADD COLUMN deleted_at TEXT');
if(!columns.includes('access_json'))db.exec(`ALTER TABLE users ADD COLUMN access_json TEXT NOT NULL DEFAULT '["timesheets","database"]'`);
db.exec('CREATE TABLE IF NOT EXISTS workflows(id TEXT PRIMARY KEY,body TEXT NOT NULL,updated_at TEXT NOT NULL)');
db.exec('CREATE TABLE IF NOT EXISTS roles(id TEXT PRIMARY KEY,name TEXT NOT NULL COLLATE NOCASE UNIQUE,permissions_json TEXT NOT NULL)');
if(!columns.includes('custom_role_id'))db.exec('ALTER TABLE users ADD COLUMN custom_role_id TEXT REFERENCES roles(id)');
const sections=['timesheets','database','planning','verification','control'];
function userPermissions(u){
 if(u.role==='admin')return allPermissions;
 if(u.custom_role_id){const role=db.prepare('SELECT permissions_json FROM roles WHERE id=?').get(u.custom_role_id);return role?JSON.parse(role.permissions_json):[];}
 const access=JSON.parse(u.access_json||'["timesheets","database"]');
 return allPermissions.filter(p=>{const group=p.split('.')[0];return !['timesheets.reopen','timesheets.delete'].includes(p)&&(access.includes(group)||access.includes('database')&&['employees','positions','workTypes','permissions','signers'].includes(group));});
}
function userAccess(u){return sections.filter(k=>userPermissions(u).includes(k+'.view'));}
function can(u,key){return userPermissions(u).includes(key.includes('.')?key:key+'.view');}
function need(u,key){if(!can(u,key))throw new AppError('Нет права на это действие',403);}
function checkedPermissions(values){try{return normalizePermissions(values);}catch{throw new AppError('Некорректный список прав');}}
function checkedRole(id){if(id!==null&&(!id||!db.prepare('SELECT id FROM roles WHERE id=?').get(id)))throw new AppError('Роль не найдена');return id;}
function parseAccess(data){if(!Array.isArray(data)||data.some(x=>!sections.includes(x)))throw new AppError('Некорректный список разделов');return [...new Set(data)];}
const now=()=>new Date().toISOString();
const hash=s=>createHash('sha256').update(s).digest('hex');
function passwordHash(password) { const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(password,salt,64).toString('hex'); }
function passwordMatches(password,stored) { const [salt,digest]=stored.split(':');const a=scryptSync(password,salt,64),b=Buffer.from(digest,'hex');return a.length===b.length&&timingSafeEqual(a,b); }
function validatePassword(p) { if(typeof p!=='string'||p.length<10||p.length>200)throw new AppError('Пароль должен содержать от 10 до 200 символов');return p; }
function username(v) { const s=text(v,'Логин',50).toLowerCase();if(!/^[a-z0-9_.-]{3,50}$/.test(s))throw new AppError('Логин: 3–50 латинских букв, цифр, точек, дефисов или подчёркиваний');return s; }
function publicUser(u) { return {id:u.id,name:u.name,username:u.username,role:u.role,access:userAccess(u),permissions:userPermissions(u),customRoleId:u.custom_role_id||null,roleName:u.role==='admin'?'Администратор':u.custom_role_id?(db.prepare('SELECT name FROM roles WHERE id=?').get(u.custom_role_id)?.name||'Без роли'):'Сотрудник'}; }
const setupToken=process.env.SETUP_TOKEN || (!['127.0.0.1','localhost','::1'].includes(host)?randomBytes(24).toString('hex'):'');
if(!db.prepare('SELECT 1 FROM users LIMIT 1').get()&&setupToken) console.log('Код первоначальной настройки (храните в секрете): '+setupToken);
const loginAttempts=new Map();
function rateLimit(req,name) { const k=req.socket.remoteAddress+':'+name,t=Date.now();let r=loginAttempts.get(k);if(!r||r.until<t){r={count:0,until:t+15*60e3};loginAttempts.set(k,r);}r.count++;if(r.count>12)throw new AppError('Слишком много попыток входа. Повторите через 15 минут',429);if(loginAttempts.size>10000)for(const [key,value]of loginAttempts)if(value.until<t)loginAttempts.delete(key); }
function secure(req) { return process.env.APP_ORIGIN?.startsWith('https://') || req.socket.encrypted; }
function cookie(req,token,maxAge) { return `tab_session=${token}; Path=${basePath}/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure(req)?'; Secure':''}`; }
function issueSession(req,res,u) { const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(token),u.id,csrf,Date.now()+8*60*60e3);res.setHeader('Set-Cookie',cookie(req,token,8*60*60));return {user:publicUser(u),csrf}; }
function auth(req) { const raw=/\btab_session=([a-f0-9]{64})\b/.exec(req.headers.cookie||'')?.[1];if(!raw)return null;return db.prepare('SELECT users.*,sessions.csrf,sessions.token AS session_token FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND sessions.expires>? AND users.deleted_at IS NULL').get(hash(raw),Date.now())||null; }
function admin(user) { if(user.role!=='admin')throw new AppError('Действие доступно только администратору',403); }
function originCheck(req) { const origin=req.headers.origin;if(origin){const allowed=process.env.APP_ORIGIN||`http://${req.headers.host}`;if(origin!==allowed)throw new AppError('Запрос с другого сайта запрещён',403);} }
async function body(req) { const parts=[];let n=0;for await(const chunk of req){n+=chunk.length;if(n>1024*1024)throw new AppError('Слишком большой запрос',413);parts.push(chunk);}try{return JSON.parse(Buffer.concat(parts).toString()||'{}');}catch{throw new AppError('Некорректный JSON');} }
function json(res,data,status=200) {res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));}
function getSheet(id) { const s=db.prepare('SELECT * FROM sheets WHERE id=?').get(id);if(!s)throw new AppError('Табель не найден',404);return JSON.parse(s.body); }
function resultSheet(id) { const s=getSheet(id);s.history=db.prepare('SELECT action,audit.created_at AS at,users.name AS user FROM audit JOIN users ON users.id=audit.user_id WHERE sheet_id=? ORDER BY audit.id DESC LIMIT 12').all(id);return s; }
function audit(id,user,action) { db.prepare('INSERT INTO audit(sheet_id,user_id,action,created_at) VALUES(?,?,?,?)').run(id,user.id,action,now()); }
function change(id,data,user,action,fn,{completedAllowed=false}={}) {
  db.exec('BEGIN IMMEDIATE');
  try{
    const s=getSheet(id);
    if(data.expectedRevision!==s.revision)throw new AppError('Табель изменился в другом окне. Обновите страницу и повторите действие',409);
    if(s.status==='completed'&&!completedAllowed)throw new AppError('Завершённый табель доступен только для просмотра. Администратор может вернуть его в работу',403);
    fn(s);s.revision++;s.updatedAt=now();
    db.prepare('UPDATE sheets SET name=?,status=?,revision=?,body=?,updated_at=? WHERE id=?').run(s.name,s.status,s.revision,JSON.stringify(s),s.updatedAt,id);
    audit(id,user,action);db.exec('COMMIT');return resultSheet(id);
  }catch(e){db.exec('ROLLBACK');throw e;}
}
function activeEmployee(id) { id=text(id,'Сотрудник',100);const e=db.prepare('SELECT employees.*,positions.name AS position FROM employees JOIN positions ON positions.id=employees.position_id WHERE employees.id=? AND employees.active=1').get(id);if(!e)throw new AppError('Сотрудник не найден в действующей базе');return e; }
function employeeSnapshot(e) { return {name:e.name,position:e.position,birthday:e.birthday,note:e.note,positionId:e.position_id}; }
function occupiedDays(sheet) {
  const occupied=[];
  for(const record of db.prepare('SELECT id,name,body FROM sheets WHERE month=? AND id<>?').all(sheet.month,sheet.id)){
    for(const row of JSON.parse(record.body).rows)for(const day of Object.keys(row.cells))occupied.push({employeeId:row.employeeId,day:Number(day),sheetId:record.id,sheetName:record.name});
  }
  return occupied;
}
function checkDayAvailable(sheet,row,day,occupied=occupiedDays(sheet)) {
  const conflict=occupied.find(x=>x.employeeId===row.employeeId&&x.day===Number(day));
  if(conflict)throw new AppError(`${row.employeeSnapshot.name}: ${String(day).padStart(2,'0')}.${sheet.month.slice(5)}.${sheet.month.slice(0,4)} уже заполнено в табеле «${conflict.sheetName}». Сначала очистите этот день в другом табеле`,409);
}
function selectedPosition(data) {
  const p=data.positionId
    ? db.prepare('SELECT id FROM positions WHERE id=?').get(text(data.positionId,'Должность',100))
    : db.prepare('SELECT id FROM positions WHERE name_key=?').get(text(data.position,'Должность',150).toLocaleLowerCase('ru'));
  if(!p)throw new AppError('Выберите должность из списка. Новые должности добавляются кнопкой «Добавить должность»');
  return p.id;
}
function catalog() { return {positions:db.prepare('SELECT * FROM positions ORDER BY name COLLATE NOCASE').all(),employees:db.prepare('SELECT employees.id,employees.name,employees.birthday,employees.note,employees.active,employees.position_id AS positionId,positions.name AS position FROM employees JOIN positions ON positions.id=employees.position_id WHERE active=1 ORDER BY employees.name COLLATE NOCASE').all(),workTypes:db.prepare('SELECT * FROM work_types WHERE active=1 ORDER BY label COLLATE NOCASE').all(),permissions:db.prepare('SELECT position_id AS positionId,work_type_id AS workTypeId FROM permissions').all(),signers:db.prepare('SELECT * FROM signers WHERE active=1 ORDER BY name COLLATE NOCASE').all()}; }

async function api(req,res,url) {
  const path=url.pathname,method=req.method;
  if(path==='/api/health'&&method==='GET'){
    db.prepare('SELECT 1').get();return json(res,{ok:true});
  }
  if(path==='/api/session'&&method==='GET'){
    const u=auth(req);return json(res,{...(u?{user:publicUser(u),csrf:u.csrf}:{user:null}),setupRequired:!db.prepare('SELECT 1 FROM users LIMIT 1').get(),setupTokenRequired:!!setupToken});
  }
  if(!['GET','HEAD'].includes(method))originCheck(req);
  if(path==='/api/setup'&&method==='POST'){
    const d=await body(req);rateLimit(req,'setup');
    if(db.prepare('SELECT 1 FROM users LIMIT 1').get())throw new AppError('Первоначальная настройка уже выполнена',409);
    if(setupToken&&d.setupToken!==setupToken)throw new AppError('Неверный код первоначальной настройки',403);
    const u={id:randomUUID(),username:username(d.username),name:text(d.name,'ФИО',150),role:'admin'};
    db.prepare('INSERT INTO users(id,username,name,password,role,created_at) VALUES(?,?,?,?,?,?)').run(u.id,u.username,u.name,passwordHash(validatePassword(d.password)),u.role,now());
    return json(res,issueSession(req,res,u),201);
  }
  if(path==='/api/login'&&method==='POST'){
    const d=await body(req);rateLimit(req,String(d.username||'').toLowerCase());
    if(typeof d.password!=='string'||d.password.length>200)throw new AppError('Неверный логин или пароль',401);
    const u=db.prepare('SELECT * FROM users WHERE username=? AND deleted_at IS NULL').get(String(d.username||'').trim().toLowerCase());
    const placeholder='01234567890123456789012345678901:'+Buffer.alloc(64).toString('hex');
    if(!passwordMatches(d.password,u?.password||placeholder)||!u)throw new AppError('Неверный логин или пароль',401);
    return json(res,issueSession(req,res,u));
  }
  const user=auth(req);if(!user)throw new AppError('Войдите в систему',401);
  if(!['GET','HEAD'].includes(method)&&req.headers['x-csrf-token']!==user.csrf)throw new AppError('Сессия страницы устарела. Обновите страницу',403);
  if(path==='/api/logout'&&method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(user.session_token);res.setHeader('Set-Cookie',cookie(req,'',0));return json(res,{ok:true});}
  if(await workflowApi({db,path,method,req,res,user,body,json,can}))return;
  if(path==='/api/sheet-catalog'&&method==='GET'){
    need(user,'timesheets');const c=catalog();c.employees=c.employees.map(({birthday,note,...e})=>({...e,birthday:'',note:''}));return json(res,c);
  }
  if(path==='/api/catalog'||/^\/api\/(positions|permissions|employees|work-types|signers)(\/|$)/.test(path))need(user,'database');
  if(path.startsWith('/api/sheets'))need(user,'timesheets');
  const roleMatch=/^\/api\/roles(?:\/([a-f0-9-]+))?$/.exec(path);
  if(roleMatch){
    admin(user);const id=roleMatch[1];
    if(method==='GET'&&!id)return json(res,{roles:db.prepare('SELECT * FROM roles ORDER BY name').all().map(r=>({id:r.id,name:r.name,permissions:JSON.parse(r.permissions_json)})),groups:permissionGroups});
    const d=await body(req);
    if(method==='DELETE'&&id){
      if(db.prepare('SELECT 1 FROM users WHERE custom_role_id=? AND deleted_at IS NULL').get(id))throw new AppError('Роль назначена пользователям. Сначала назначьте им другую роль',409);
      if(!db.prepare('SELECT 1 FROM roles WHERE id=?').get(id))throw new AppError('Роль не найдена',404);
      db.prepare('UPDATE users SET custom_role_id=NULL,access_json=? WHERE custom_role_id=?').run('[]',id);
      db.prepare('DELETE FROM roles WHERE id=?').run(id);return json(res,{ok:true});
    }
    if(method==='POST'&&!id||method==='PATCH'&&id){
      const name=text(d.name,'Название роли',100),permissions=checkedPermissions(d.permissions);
      if(id){if(!db.prepare('SELECT 1 FROM roles WHERE id=?').get(id))throw new AppError('Роль не найдена',404);db.prepare('UPDATE roles SET name=?,permissions_json=? WHERE id=?').run(name,JSON.stringify(permissions),id);}
      else db.prepare('INSERT INTO roles VALUES(?,?,?)').run(randomUUID(),name,JSON.stringify(permissions));
      return json(res,{ok:true});
    }
    throw new AppError('Действие не найдено',404);
  }
  const resource=/^\/api\/(employees|positions|work-types|signers|permissions)(?:\/|$)/.exec(path);
  if(resource&&method!=='GET'){
    const group={'work-types':'workTypes'}[resource[1]]||resource[1];
    need(user,group+'.'+(group==='permissions'?'edit':method==='POST'?'create':method==='DELETE'?'delete':'edit'));
  }
  if(path.startsWith('/api/sheets')){
    const action=path.endsWith('/export')?'export':path.endsWith('/complete')?'complete':path.endsWith('/reopen')?'reopen':method==='DELETE'&&!path.includes('/rows/')?'delete':method==='POST'&&path==='/api/sheets'?'create':!['GET','HEAD'].includes(method)?'edit':'view';
    need(user,'timesheets.'+action);
  }
  const userMatch=/^\/api\/users\/([a-f0-9-]+)$/.exec(path);
  if(userMatch){
    admin(user);const id=userMatch[1],d=await body(req);
    const target=db.prepare('SELECT * FROM users WHERE id=? AND deleted_at IS NULL').get(id);
    if(!target)throw new AppError('Пользователь не найден',404);
    if(method==='DELETE'){
      if(id===user.id)throw new AppError('Нельзя удалить собственный аккаунт',409);
      if(d.confirmDelete!==true)throw new AppError('Подтвердите удаление пользователя');
      if(target.role==='admin'&&db.prepare("SELECT count(*) AS n FROM users WHERE role='admin' AND deleted_at IS NULL").get().n<=1)throw new AppError('Нельзя удалить последнего администратора',409);
      db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE users SET deleted_at=? WHERE id=?').run(now(),id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}
      return json(res,{ok:true});
    }
    if(method==='PATCH'){
      const customRoleId=d.customRoleId===undefined?null:checkedRole(d.customRoleId);
      const access=d.access===undefined?[]:parseAccess(d.access);
      if(target.role==='admin')throw new AppError('У администратора всегда доступны все разделы');
      db.prepare('UPDATE users SET access_json=?,custom_role_id=? WHERE id=?').run(JSON.stringify(access),customRoleId,id);
      return json(res,publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)));
    }
  }
  if(path==='/api/catalog'&&method==='GET'){const c=catalog();for(const [field,group]of [['employees','employees'],['positions','positions'],['workTypes','workTypes'],['signers','signers'],['permissions','workTypes']])if(!can(user,group+'.view'))c[field]=[];return json(res,c);}
  if(path==='/api/positions'&&method==='POST'){
    const d=await body(req),name=text(d.name,'Должность',150),key=name.toLocaleLowerCase('ru');
    if(db.prepare('SELECT 1 FROM positions WHERE name_key=?').get(key))throw new AppError('Такая должность уже добавлена',409);
    db.prepare('INSERT INTO positions VALUES(?,?,?)').run(randomUUID(),name,key);
    return json(res,catalog(),201);
  }
  if(path==='/api/users'){
    admin(user);
    if(method==='GET')return json(res,db.prepare('SELECT * FROM users WHERE deleted_at IS NULL ORDER BY name').all().map(u=>({...publicUser(u),createdAt:u.created_at})));
    if(method==='POST'){
      const d=await body(req),role=d.role==='admin'?'admin':'employee';
      const u={id:randomUUID(),name:text(d.name,'Имя пользователя',150),username:username(d.username),role};
      const customRoleId=d.customRoleId===undefined?null:checkedRole(d.customRoleId);const access=d.access===undefined?['timesheets','database']:parseAccess(d.access);db.prepare('INSERT INTO users(id,username,name,password,role,created_at,access_json,custom_role_id) VALUES(?,?,?,?,?,?,?,?)').run(u.id,u.username,u.name,passwordHash(validatePassword(d.password)),role,now(),JSON.stringify(access),customRoleId);return json(res,publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(u.id)),201);
    }
  }
  if(path==='/api/permissions'&&method==='PUT'){
    const d=await body(req);
    d.positionId=text(d.positionId,'Должность',100);d.workTypeId=text(d.workTypeId,'Вид работы',100);
    if(!db.prepare('SELECT 1 FROM positions WHERE id=?').get(d.positionId)||!db.prepare('SELECT 1 FROM work_types WHERE id=? AND active=1').get(d.workTypeId))throw new AppError('Должность или работа не найдена');
    if(d.allowed===true)db.prepare('INSERT OR IGNORE INTO permissions VALUES(?,?)').run(d.positionId,d.workTypeId);else db.prepare('DELETE FROM permissions WHERE position_id=? AND work_type_id=?').run(d.positionId,d.workTypeId);
    return json(res,catalog());
  }
  const reference=/^\/api\/(employees|work-types|signers)(?:\/([a-f0-9-]+))?$/.exec(path);
  if(reference){
    const [,kind,id]=reference,d=await body(req);let resultId=id||randomUUID();
    const table={employees:'employees','work-types':'work_types',signers:'signers'}[kind];
    if(id&&!db.prepare(`SELECT 1 FROM ${table} WHERE id=? AND active=1`).get(id))throw new AppError('Запись не найдена',404);
    if(method==='DELETE'&&id){db.prepare(`UPDATE ${table} SET active=0 WHERE id=?`).run(id);return json(res,catalog());}
    if((method==='POST'&&!id)||(method==='PUT'&&id)){
      if(kind==='employees'){
        const name=text(d.name,'ФИО',150),note=text(d.note,'Примечание',500,true),birthday=text(d.birthday,'Дата рождения',10,true),pid=selectedPosition(d);
        if(birthday&&(!/^\d{4}-\d{2}-\d{2}$/.test(birthday)||Number.isNaN(Date.parse(birthday))||new Date(birthday).toISOString().slice(0,10)!==birthday||birthday>now().slice(0,10)))throw new AppError('Укажите корректную дату рождения, не позднее сегодняшнего дня');
        if(id)db.prepare('UPDATE employees SET name=?,position_id=?,birthday=?,note=? WHERE id=?').run(name,pid,birthday,note,id);
        else db.prepare('INSERT INTO employees(id,name,position_id,birthday,note) VALUES(?,?,?,?,?)').run(resultId,name,pid,birthday,note);
      }else if(kind==='signers'){
        const name=text(d.name,'ФИО',150),position=text(d.position,'Должность',150);
        if(id)db.prepare('UPDATE signers SET name=?,position=? WHERE id=?').run(name,position,id);
        else db.prepare('INSERT INTO signers(id,name,position) VALUES(?,?,?)').run(resultId,name,position);
      }else{
        const label=text(d.label,'Вид работы',160),category=d.category;
        if(!['regular','trip'].includes(category))throw new AppError('Выберите категорию работы');
        if(id){const old=db.prepare('SELECT category FROM work_types WHERE id=?').get(id);if(old.category!==category)throw new AppError('Категорию существующей работы менять нельзя');db.prepare('UPDATE work_types SET label=? WHERE id=?').run(label,id);}
        else{
          const old=db.prepare('SELECT * FROM work_types WHERE label=? AND category=?').get(label,category);
          if(old?.active)throw new AppError('Такая работа уже существует',409);
          if(old){resultId=old.id;db.prepare('UPDATE work_types SET active=1 WHERE id=?').run(old.id);}else db.prepare('INSERT INTO work_types(id,label,category) VALUES(?,?,?)').run(resultId,label,category);
        }
      }
      return json(res,{...catalog(),savedId:resultId},id?200:201);
    }
  }
  if(path==='/api/sheets'&&method==='GET'){
    return json(res,db.prepare('SELECT id,name,month,status,revision,created_at AS createdAt,updated_at AS updatedAt,body FROM sheets ORDER BY updated_at DESC').all().map(r=>{const s=JSON.parse(r.body);delete r.body;return {...r,employeeCount:s.rows.length,filledDays:s.rows.reduce((sum,x)=>sum+Object.keys(x.cells).length,0),signer:s.signerSnapshot?.name||''};}));
  }
  if(path==='/api/sheets'&&method==='POST'){
    const d=await body(req);monthDays(d.month);const s={id:randomUUID(),name:text(d.name,'Название табеля',150),month:d.month,status:'draft',revision:1,rows:[],signerId:null,signerSnapshot:null,createdAt:now(),updatedAt:now(),createdBy:user.name};
    db.prepare('INSERT INTO sheets VALUES(?,?,?,?,?,?,?,?)').run(s.id,s.name,s.month,s.status,s.revision,JSON.stringify(s),s.createdAt,s.updatedAt);
    audit(s.id,user,'Создан табель');return json(res,resultSheet(s.id),201);
  }
  const match=/^\/api\/sheets\/([a-f0-9-]+)(?:\/(export|rows|cells|complete|reopen|availability)(?:\/([a-f0-9-]+))?)?$/.exec(path);
  if(match){
    const [,id,action,rowId]=match;
    if(method==='GET'&&!action)return json(res,resultSheet(id));
    if(method==='GET'&&action==='availability')return json(res,occupiedDays(getSheet(id)));
    if(method==='GET'&&action==='export'){
      const s=getSheet(id),bytes=workbook(s);res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':`attachment; filename="timesheet-${s.month}.xlsx"; filename*=UTF-8''${encodeURIComponent(safeFilename(s.name)+' '+s.month+'.xlsx')}`,'Cache-Control':'no-store','Content-Length':bytes.length});return res.end(bytes);
    }
    const d=await body(req);
    if(!action&&method==='DELETE'){
      need(user,'timesheets.delete');
      if(d.confirmDelete!==true)throw new AppError('Подтвердите окончательное удаление табеля');
      db.exec('BEGIN IMMEDIATE');
      try{
        const sheet=getSheet(id);
        if(d.expectedRevision!==sheet.revision)throw new AppError('Табель изменился в другом окне. Обновите страницу и повторите удаление',409);
        db.prepare('DELETE FROM audit WHERE sheet_id=?').run(id);
        db.prepare('DELETE FROM sheets WHERE id=?').run(id);
        db.exec('COMMIT');
      }catch(e){db.exec('ROLLBACK');throw e;}
      return json(res,{ok:true});
    }
    if(!action&&method==='PATCH')return json(res,change(id,d,user,'Изменены реквизиты табеля',s=>{
      if(d.name!==undefined)s.name=text(d.name,'Название табеля',150);
      if(d.signerId!==undefined){
        if(d.signerId===null){s.signerId=null;s.signerSnapshot=null;}
        else{const signer=db.prepare('SELECT * FROM signers WHERE id=? AND active=1').get(d.signerId);if(!signer)throw new AppError('Подписант не найден');s.signerId=signer.id;s.signerSnapshot={name:signer.name,position:signer.position};}
      }
    }));
    if(action==='rows'&&method==='POST')return json(res,change(id,d,user,'Добавлен сотрудник в табель',s=>{
      const e=activeEmployee(d.employeeId);if(s.rows.some(r=>r.employeeId===e.id))throw new AppError('Сотрудник уже добавлен в этот табель',409);
      s.rows.push({id:randomUUID(),employeeId:e.id,employeeSnapshot:employeeSnapshot(e),cells:{}});
    }));
    if(action==='rows'&&rowId&&method==='PATCH')return json(res,change(id,d,user,'Изменён сотрудник строки',s=>{
      const row=s.rows.find(r=>r.id===rowId);if(!row)throw new AppError('Строка не найдена',404);const e=activeEmployee(d.employeeId);
      if(s.rows.some(r=>r.id!==rowId&&r.employeeId===e.id))throw new AppError('Сотрудник уже добавлен в табель',409);
      if(Object.keys(row.cells).length&&d.clear!==true)throw new AppError('Подтвердите очистку работ при замене сотрудника');
      row.employeeId=e.id;row.employeeSnapshot=employeeSnapshot(e);row.cells={};
    }));
    if(action==='rows'&&rowId&&method==='DELETE')return json(res,change(id,d,user,'Удалена строка сотрудника',s=>{if(!s.rows.some(r=>r.id===rowId))throw new AppError('Строка не найдена',404);s.rows=s.rows.filter(r=>r.id!==rowId);}));
    if(action==='cells'&&method==='PUT')return json(res,change(id,d,user,'Изменена работа за день',s=>{
      const row=s.rows.find(r=>r.id===d.rowId);if(!row)throw new AppError('Строка не найдена',404);
      if(!Number.isInteger(d.day)||d.day<1||d.day>monthDays(s.month))throw new AppError('Такого дня нет в выбранном месяце');
      if(d.workTypeId===null){delete row.cells[String(d.day)];return;}
      text(d.workTypeId,'Вид работы',100);
      const e=activeEmployee(row.employeeId),work=db.prepare('SELECT * FROM work_types WHERE id=? AND active=1').get(d.workTypeId);
      if(!work||!db.prepare('SELECT 1 FROM permissions WHERE position_id=? AND work_type_id=?').get(e.position_id,work.id))throw new AppError('Эта работа не разрешена для должности сотрудника',403);
      // One entry per day makes two simultaneous categories impossible at the storage level.
      checkDayAvailable(s,row,d.day);
      row.cells[String(d.day)]={workTypeId:work.id,category:work.category,label:work.label};
    }));
    if(action==='complete'&&method==='POST')return json(res,change(id,d,user,'Табель переведён в завершённые',s=>{
      const occupied=occupiedDays(s);
      for(const row of s.rows)for(const day of Object.keys(row.cells))checkDayAvailable(s,row,day,occupied);
      if(!s.signerSnapshot)throw new AppError('Перед завершением выберите подписанта');
      if(!s.rows.length||!s.rows.some(r=>Object.keys(r.cells).length))throw new AppError('Добавьте сотрудника и заполните хотя бы один день');
      s.status='completed';s.completedAt=now();s.completedBy=user.name;
    }));
    if(action==='reopen'&&method==='POST'){
      need(user,'timesheets.reopen');return json(res,change(id,d,user,'Табель возвращён в работу',s=>{if(s.status!=='completed')throw new AppError('Табель уже находится в работе');s.status='draft';delete s.completedAt;delete s.completedBy;},{completedAllowed:true}));
    }
  }
  throw new AppError('Действие не найдено',404);
}

const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
  try{
    const url=new URL(req.url,'http://localhost');
    if(basePath){
      if(url.pathname===basePath){res.writeHead(308,{Location:basePath+'/'+url.search});return res.end();}
      if(!url.pathname.startsWith(basePath+'/'))throw new AppError('Файл не найден',404);
      url.pathname=url.pathname.slice(basePath.length);
    }
    if(url.pathname.startsWith('/api/'))return await api(req,res,url);
    if(req.method!=='GET'&&req.method!=='HEAD')throw new AppError('Метод не поддерживается',405);
    const name=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname),path=resolve(root,'public','.'+name);
    if(!path.startsWith(resolve(root,'public')+'/')&&!path.startsWith(resolve(root,'public')+'\\'))throw new AppError('Файл не найден',404);
    if(!existsSync(path))throw new AppError('Файл не найден',404);
    const data=readFileSync(path),type={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.woff2':'font/woff2','.svg':'image/svg+xml'}[extname(path)]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':type,'Cache-Control':extname(path)==='.html'?'no-cache':'public, max-age=300'});res.end(req.method==='HEAD'?undefined:data);
  }catch(error){
    if(res.headersSent){res.destroy();return;}
    const duplicate=String(error.message).includes('UNIQUE constraint failed');
    const status=error.status||(duplicate?409:500),message=error.status?error.message:duplicate?'Запись с такими данными уже существует':'Ошибка сервера. Повторите действие';
    if(status===500)console.error('Request failed:',error.message);
    json(res,{error:message},status);
  }
});
server.listen(port,host,()=>console.log(`Табельный учёт: http://${host}:${port}`));
function stop(){server.close(()=>{db.close();process.exit(0);});}
process.on('SIGINT',stop);process.on('SIGTERM',stop);
