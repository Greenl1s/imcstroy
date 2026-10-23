import {randomUUID} from 'node:crypto';
import {AppError,text,monthDays} from './domain.mjs';
import {calendar,validateCalendarOverride} from './production-calendar.mjs';
export const defaultTypes=[{id:'trip',code:'1',name:'Командировка',color:'#dceaff'},{id:'office',code:'2',name:'Офис',color:'#ffe0de'},{id:'general',code:'3',name:'Общая',color:'#def0dd'}];
export function initMonthly(db){
 const columns=db.prepare('PRAGMA table_info(employees)').all().map(c=>c.name);
 if(!columns.includes('department'))db.exec("ALTER TABLE employees ADD COLUMN department TEXT NOT NULL DEFAULT ''");
 if(!columns.includes('coefficient'))db.exec('ALTER TABLE employees ADD COLUMN coefficient TEXT');
 db.exec(`CREATE TABLE IF NOT EXISTS planning_settings(id INTEGER PRIMARY KEY CHECK(id=1),body TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS polygons(id TEXT PRIMARY KEY,number INTEGER NOT NULL UNIQUE,name TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS planning_works(id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,label TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS planning_permissions(position_id TEXT NOT NULL REFERENCES positions(id),work_id TEXT NOT NULL REFERENCES planning_works(id),PRIMARY KEY(position_id,work_id));
 CREATE TABLE IF NOT EXISTS monthly_periods(month TEXT PRIMARY KEY,workflow_id TEXT NOT NULL UNIQUE REFERENCES workflows(id));`);
 db.prepare('INSERT OR IGNORE INTO planning_settings VALUES(1,?)').run(JSON.stringify({baseCents:null,types:defaultTypes,calendars:{}}));
}
export function decimal(value,label,places=6){
 const v=String(value??'').trim().replace(',','.');
 if(!new RegExp('^\\d{1,9}(?:\\.\\d{1,'+places+'})?$').test(v))throw new AppError(`${label}: укажите неотрицательное число, до ${places} знаков после запятой`);
 return v;
}
export function moneyCents(value){const v=decimal(value,'Базовая зарплата',2),[a,b='']=v.split('.');return Number(BigInt(a)*100n+BigInt(b.padEnd(2,'0')));}
export function monthlySalary(baseCents,coefficient,days,worked){
 const [a,b='']=decimal(coefficient,'Коэффициент').split('.'),factor=BigInt(a)*1000000n+BigInt(b.padEnd(6,'0'));
 const round=(n,d)=>Number((n+d/2n)/d),monthlyCents=round(BigInt(baseCents)*factor,1000000n);
 if(!Number.isSafeInteger(monthlyCents))throw new AppError('Сумма расчёта слишком велика');
 return {monthlyCents,daily:monthlyCents/100/days,worked,accruedCents:round(BigInt(monthlyCents)*BigInt(worked),BigInt(days))};
}
export function monthlySettings(db){return JSON.parse(db.prepare('SELECT body FROM planning_settings WHERE id=1').get().body);}
export function planningCatalog(db){return {signers:db.prepare('SELECT id,name,position FROM signers WHERE active=1 ORDER BY name').all(),polygons:db.prepare('SELECT * FROM polygons WHERE active=1 ORDER BY number').all(),works:db.prepare('SELECT * FROM planning_works WHERE active=1 ORDER BY code').all(),permissions:db.prepare('SELECT position_id AS positionId,work_id AS workId FROM planning_permissions').all()};}
export function publicMonthly(s){
 const out=structuredClone(s);delete out.legacyArchive;
 if(!['control','approved'].includes(s.stage)){
  delete out.baseCents;for(const row of out.rows){delete row.coefficient;delete row.pay;}
 }else for(const row of out.rows)row.pay=monthlySalary(s.baseCents,row.coefficient,s.calendar.workingDays,Object.keys(row.cells).length);
 return out;
}
function stageRight(s,action,can,user){if(!can(user,(s.stage==='approved'?'control':s.stage)+'.'+action))throw new AppError('Нет права на действие этого этапа',403);}
export function createMonthly(db,data,user,{id=null,legacy=null}={}){
 monthDays(data.month);const config=monthlySettings(db),cal=calendar(data.month,config.calendars);
 const existing=db.prepare("SELECT id FROM workflows WHERE json_extract(body,'$.month')=? AND id<>?").get(data.month,id||'');
 if(existing)throw new AppError('На этот месяц общая таблица уже создана',409);
 const employees=db.prepare('SELECT e.*,p.name AS position FROM employees e JOIN positions p ON p.id=e.position_id WHERE e.active=1 ORDER BY e.department,e.name').all();
 if(!employees.length)throw new AppError('Сначала добавьте сотрудников');
 if(config.baseCents===null)throw new AppError('Администратор должен указать базовую зарплату в настройках');
 for(const e of employees)if(!e.department||e.coefficient===null)throw new AppError(`Заполните подразделение и коэффициент сотрудника «${e.name}»`);
 for(const e of employees)monthlySalary(config.baseCents,e.coefficient,cal.workingDays,0);
 const stamp=new Date().toISOString();
 const s={format:'monthly-v2',id:id||randomUUID(),name:text(data.name,'Название таблицы',150),month:data.month,stage:'planning',revision:(legacy?.revision||0)+1,baseCents:config.baseCents,calendar:cal,types:config.types,rows:employees.map(e=>({id:randomUUID(),employeeId:e.id,positionId:e.position_id,employeeSnapshot:{name:e.name,position:e.position,department:e.department},coefficient:e.coefficient,cells:{}})),history:[...(legacy?.history||[]),{at:stamp,user:user.name,action:legacy?'Начата новая месячная форма; прежние данные сохранены в архиве записи':'Создана месячная таблица'}],updatedAt:stamp,...(legacy?{legacyArchive:legacy}:{})};
 return s;
}
export function validateMonthlyCell(db,s,row,day,value){
 if(!Number.isInteger(day)||day<1||day>monthDays(s.month))throw new AppError('Некорректный день');
 if(value===null){delete row.cells[String(day)];return;}
 if(s.calendar.nonworking.includes(day))throw new AppError('В выходные и праздничные дни работа запрещена');
 const type=s.types.find(t=>t.id===value.typeId),polygon=db.prepare('SELECT * FROM polygons WHERE id=? AND active=1').get(value.polygonId),work=db.prepare('SELECT * FROM planning_works WHERE id=? AND active=1').get(value.workId);
 if(!type||!polygon||!work)throw new AppError('Выберите тип занятости, полигон и вид работы');
 if(!db.prepare('SELECT 1 FROM planning_permissions WHERE position_id=? AND work_id=?').get(row.positionId,work.id))throw new AppError('Работа не разрешена для должности сотрудника',403);
 row.cells[String(day)]={typeId:type.id,typeCode:type.code,typeName:type.name,color:type.color,polygonId:polygon.id,polygonNumber:polygon.number,polygonName:polygon.name,workId:work.id,workCode:work.code,workName:work.label};
}
function finishMonthly(db,s,user){
 const used=new Map(),stamp=new Date().toISOString();
 const occupied=new Map();
 for(const record of db.prepare('SELECT body FROM sheets WHERE month=?').all(s.month)){
  const sheet=JSON.parse(record.body);for(const row of sheet.rows)for(const day of Object.keys(row.cells))occupied.set(row.employeeId+':'+day,sheet.name);
 }
 for(const row of s.rows){
  row.pay=monthlySalary(s.baseCents,row.coefficient,s.calendar.workingDays,Object.keys(row.cells).length);
  for(const [day,entry]of Object.entries(row.cells)){
   if(s.calendar.nonworking.includes(Number(day)))throw new AppError('Таблица содержит работу в нерабочий день');
   // A legacy manual sheet must not silently double-book this employee.
   const conflict=occupied.get(row.employeeId+':'+day);
   if(conflict)throw new AppError(`День ${day}: у сотрудника «${row.employeeSnapshot.name}» уже есть запись в табеле «${conflict}»`,409);
   if(!used.has(entry.polygonId))used.set(entry.polygonId,{entry,rows:new Map()});
   const bucket=used.get(entry.polygonId);
   if(!bucket.rows.has(row.employeeId))bucket.rows.set(row.employeeId,{id:randomUUID(),employeeId:row.employeeId,employeeSnapshot:{...row.employeeSnapshot},cells:{}});
   bucket.rows.get(row.employeeId).cells[day]={...entry,label:entry.workCode,category:entry.typeId==='trip'?'trip':'regular'};
  }
 }
 if(!used.size)throw new AppError('Нет заполненных рабочих дней для формирования табелей');
 s.generatedSheets=[];
 for(const {entry,rows}of used.values()){
  const sheet={id:randomUUID(),format:'polygon-v2',name:`${entry.polygonName} — ${s.month}`,month:s.month,status:'completed',revision:1,rows:[...rows.values()],signerId:s.signerId||null,signerSnapshot:s.signerSnapshot||null,createdAt:stamp,updatedAt:stamp,createdBy:user.name,completedAt:stamp,completedBy:user.name,sourceWorkflowId:s.id,polygonId:entry.polygonId,polygonNumber:entry.polygonNumber,polygonName:entry.polygonName,calendar:s.calendar,types:s.types,generated:true};
  db.prepare('INSERT INTO sheets VALUES(?,?,?,?,?,?,?,?)').run(sheet.id,sheet.name,sheet.month,sheet.status,sheet.revision,JSON.stringify(sheet),stamp,stamp);
  db.prepare('INSERT INTO audit(sheet_id,user_id,action,created_at) VALUES(?,?,?,?)').run(sheet.id,user.id,'Сформирован из общей таблицы',stamp);s.generatedSheets.push(sheet.id);
 }
 s.stage='approved';s.generatedAt=stamp;
}
export async function monthlyAdminApi({db,path,method,req,res,user,body,json,can}){
 if(path==='/api/monthly-settings'){
  if(user.role!=='admin')throw new AppError('Настройки доступны только администратору',403);
  if(method==='GET'){json(res,monthlySettings(db));return true;}
  if(method==='PUT'){
   const data=await body(req),config=monthlySettings(db);
   if(data.baseSalary!==undefined)config.baseCents=moneyCents(data.baseSalary);
   if(data.types!==undefined){
    if(!Array.isArray(data.types)||data.types.length!==3)throw new AppError('Настройте три типа занятости');
    const codes=new Set(),ids=new Set();config.types=data.types.map(t=>{
     if(!defaultTypes.some(d=>d.id===t.id)||ids.has(t.id)||!/^[0-9]$/.test(String(t.code))||codes.has(String(t.code))||!/^#[a-f0-9]{6}$/i.test(t.color))throw new AppError('Типы должны иметь уникальные однозначные коды и корректные цвета');
     ids.add(t.id);codes.add(String(t.code));return {id:t.id,code:String(t.code),name:text(t.name,'Название типа',100),color:t.color};
    });
   }
   if(data.calendar){const year=Number(data.calendar.year);config.calendars[String(year)]=validateCalendarOverride(year,data.calendar);}
   db.prepare('UPDATE planning_settings SET body=? WHERE id=1').run(JSON.stringify(config));json(res,config);return true;
  }
 }
 if(path==='/api/planning-catalog'&&method==='GET'){
  if(!['planning','verification','control','timesheets','database'].some(k=>can(user,k)))throw new AppError('Нет доступа',403);
  const c=planningCatalog(db);
  if(!can(user,'control')&&!can(user,'timesheets')&&!can(user,'signers.view'))c.signers=[];
  if(!['planning','verification','control','timesheets'].some(k=>can(user,k))&&!can(user,'polygons.view'))c.polygons=[];
  if(!['planning','verification','control'].some(k=>can(user,k))&&!can(user,'planWorks.view')){c.works=[];c.permissions=[];}
  json(res,c);return true;
 }
 const match=/^\/api\/(polygons|planning-works|planning-permissions)(?:\/([a-f0-9-]+))?$/.exec(path);
 if(!match)return false;
 const [,kind,id]=match,resource=kind==='polygons'?'polygons':'planWorks';
 if(!can(user,'database')||!can(user,resource+'.'+(kind==='planning-permissions'?'permissions':method==='POST'?'create':method==='DELETE'?'delete':'edit')))throw new AppError('Нет права изменять справочник',403);
 const d=await body(req);
 if(kind==='planning-permissions'){
  if(method!=='PUT')throw new AppError('Метод не поддерживается',405);
  if(!db.prepare('SELECT 1 FROM positions WHERE id=?').get(d.positionId)||!db.prepare('SELECT 1 FROM planning_works WHERE id=? AND active=1').get(d.workId))throw new AppError('Должность или работа не найдена');
  if(d.allowed===true)db.prepare('INSERT OR IGNORE INTO planning_permissions VALUES(?,?)').run(d.positionId,d.workId);else db.prepare('DELETE FROM planning_permissions WHERE position_id=? AND work_id=?').run(d.positionId,d.workId);
 }else{
  const table=kind==='polygons'?'polygons':'planning_works';
  if(id&&!db.prepare(`SELECT 1 FROM ${table} WHERE id=? AND active=1`).get(id))throw new AppError('Запись не найдена',404);
  if(method==='DELETE'&&id)db.prepare(`UPDATE ${table} SET active=0 WHERE id=?`).run(id);
  else if(method==='POST'&&!id||method==='PUT'&&id){
   const key=id||randomUUID();
   if(kind==='polygons'){
    if(!Number.isInteger(Number(d.number))||!/^\d{1,6}$/.test(String(d.number)))throw new AppError('Укажите целый номер полигона от 0');
    const number=Number(d.number),name=text(d.name,'Название полигона',150);
    if(id)db.prepare('UPDATE polygons SET number=?,name=? WHERE id=?').run(number,name,id);else db.prepare('INSERT INTO polygons(id,number,name) VALUES(?,?,?)').run(key,number,name);
   }else{
    const code=text(d.code,'Шифр работы',30),label=text(d.label,'Название работы',160);
    if(id)db.prepare('UPDATE planning_works SET code=?,label=? WHERE id=?').run(code,label,id);else db.prepare('INSERT INTO planning_works(id,code,label) VALUES(?,?,?)').run(key,code,label);
   }
  }else throw new AppError('Метод не поддерживается',405);
 }
 json(res,planningCatalog(db));return true;
}
export async function monthlyDocumentApi({db,path,method,req,res,user,body,json,can,exportFile},s){
 const match=/^\/api\/workflows\/([a-f0-9-]+)(?:\/(cells|confirm|export|convert|signer))?$/.exec(path);
 if(!match)return false;
 const [,id,action]=match;
 if(method==='GET'&&action==='export'){
  stageRight(s,'export',can,user);exportFile(res,s);return true;
 }
 if(method==='GET'&&!action){stageRight(s,'view',can,user);json(res,publicMonthly(s));return true;}
 if(!['PUT','POST','PATCH'].includes(method))return false;
 const data=await body(req);db.exec('BEGIN IMMEDIATE');
 try{
  s=JSON.parse(db.prepare('SELECT body FROM workflows WHERE id=?').get(id).body);
  if(data.expectedRevision!==s.revision)throw new AppError('Таблица изменена другим пользователем. Откройте её заново',409);
  if(action==='convert'){
   if(user.role!=='admin'||s.format==='monthly-v2'||data.confirm!==true)throw new AppError('Преобразование недоступно',403);
   s=createMonthly(db,{month:s.month,name:s.name},user,{id,legacy:s});db.prepare('INSERT OR IGNORE INTO monthly_periods VALUES(?,?)').run(s.month,s.id);
  }else{
   stageRight(s,action==='confirm'?'confirm':'edit',can,user);
   if(s.stage==='approved')throw new AppError('Табели уже сформированы. Повторное формирование и изменения запрещены',409);
   if(action==='cells'&&method==='PUT'){
    const row=s.rows.find(r=>r.id===data.rowId);if(!row)throw new AppError('Сотрудник не найден в таблице',404);
    validateMonthlyCell(db,s,row,data.day,data.entry);
   }else if(action==='signer'&&method==='PUT'){
    if(s.stage!=='control')throw new AppError('Подписант выбирается на этапе контроля');
    if(data.signerId===null){s.signerId=null;s.signerSnapshot=null;}else{
     const signer=db.prepare('SELECT id,name,position FROM signers WHERE id=? AND active=1').get(data.signerId);
     if(!signer)throw new AppError('Подписант не найден');s.signerId=signer.id;s.signerSnapshot={name:signer.name,position:signer.position};
    }
   }else if(action==='confirm'&&method==='POST'){
    if(s.stage==='control')finishMonthly(db,s,user);else s.stage=s.stage==='planning'?'verification':'control';
   }else throw new AppError('Для месячной таблицы изменяются только ячейки дней');
   s.revision++;
  }
  s.updatedAt=new Date().toISOString();s.history.push({at:s.updatedAt,user:user.name,action:action==='confirm'?({verification:'Передано на проверку',control:'Передано на контроль',approved:'Сформированы табели по полигонам'})[s.stage]:action==='convert'?'Создана месячная форма':action==='signer'?'Изменён подписант':'Изменена ячейка дня'});
  db.prepare('UPDATE workflows SET body=?,updated_at=? WHERE id=?').run(JSON.stringify(s),s.updatedAt,id);
  db.exec('COMMIT');json(res,publicMonthly(s));return true;
 }catch(e){db.exec('ROLLBACK');throw e;}
}
