import {randomUUID} from 'node:crypto';
import {AppError,text} from './domain.mjs';
const employmentTypes=['trip','office','general'];
const key=name=>name.toLocaleLowerCase('ru');
export function initCatalogues(db){
 db.exec('BEGIN IMMEDIATE');
 try{
  db.exec(`CREATE TABLE IF NOT EXISTS departments(id TEXT PRIMARY KEY,name TEXT NOT NULL,name_key TEXT NOT NULL UNIQUE,active INTEGER NOT NULL DEFAULT 1);
  CREATE TABLE IF NOT EXISTS work_blocks(id TEXT PRIMARY KEY,number INTEGER NOT NULL UNIQUE,name TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);`);
  const employeeColumns=db.prepare('PRAGMA table_info(employees)').all().map(c=>c.name);
  if(!employeeColumns.includes('department_id'))db.exec('ALTER TABLE employees ADD COLUMN department_id TEXT REFERENCES departments(id)');
  for(const e of db.prepare("SELECT id,department FROM employees WHERE department_id IS NULL AND trim(department)<>''").all()){
   const name=text(e.department,'Подразделение',150,true);if(!name)continue;
   let department=db.prepare('SELECT id,name FROM departments WHERE name_key=?').get(key(name));
   if(!department){department={id:randomUUID(),name};db.prepare('INSERT INTO departments(id,name,name_key) VALUES(?,?,?)').run(department.id,name,key(name));}
   db.prepare('UPDATE employees SET department_id=?,department=? WHERE id=?').run(department.id,department.name,e.id);
  }
  const workColumns=db.prepare('PRAGMA table_info(planning_works)').all().map(c=>c.name);
  for(const [name,type]of [['block_id','TEXT REFERENCES work_blocks(id)'],['item_number','INTEGER'],['type_ids_json',`TEXT NOT NULL DEFAULT '["trip","office","general"]'`],['legacy_code','TEXT']])if(!workColumns.includes(name))db.exec(`ALTER TABLE planning_works ADD COLUMN ${name} ${type}`);
  const legacy=db.prepare('SELECT id,code FROM planning_works WHERE block_id IS NULL ORDER BY code,id').all();
  if(legacy.length){
   let block=db.prepare('SELECT * FROM work_blocks WHERE number=1').get();
   if(!block){block={id:randomUUID(),number:1};db.prepare('INSERT INTO work_blocks(id,number,name) VALUES(?,?,?)').run(block.id,1,'Блок 1');}
   let ordinal=Number(db.prepare('SELECT MAX(item_number) AS n FROM planning_works WHERE block_id=?').get(block.id).n||0);
   for(const w of legacy)db.prepare('UPDATE planning_works SET code=?,legacy_code=? WHERE id=?').run('__migration_'+randomUUID(),w.code,w.id);
   for(const w of legacy){ordinal++;db.prepare('UPDATE planning_works SET block_id=?,item_number=?,code=? WHERE id=?').run(block.id,ordinal,`1.${ordinal}`,w.id);}
  }
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS planning_work_ordinal ON planning_works(block_id,item_number)');
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}
export function chooseDepartment(db,data){
 const department=data.departmentId
  ?db.prepare('SELECT id,name FROM departments WHERE id=? AND active=1').get(text(data.departmentId,'Подразделение',100))
  :db.prepare('SELECT id,name FROM departments WHERE name_key=? AND active=1').get(key(text(data.department,'Подразделение',150)));
 if(!department)throw new AppError('Выберите подразделение из справочника. Добавлять подразделения можно только в разделе «Подразделения»');
 return department;
}
export function workTypes(value){
 if(!Array.isArray(value)||value.some(t=>!employmentTypes.includes(t)))throw new AppError('Некорректные типы занятости работы');
 return [...new Set(value)];
}
export function numberedWork(db,data,old=null){
 const blockId=data.blockId||old?.block_id;if(typeof blockId!=='string'||!blockId)throw new AppError('Выберите блок работ');
 const block=db.prepare('SELECT * FROM work_blocks WHERE id=? AND active=1').get(blockId);
 if(!block)throw new AppError('Выберите блок работ');
 const ordinal=data.itemNumber===undefined?(old?.block_id===block.id?old.item_number:Number(db.prepare('SELECT MAX(item_number) AS n FROM planning_works WHERE block_id=?').get(block.id).n||0)+1):Number(data.itemNumber);
 if(!Number.isSafeInteger(ordinal)||ordinal<1||ordinal>999999)throw new AppError('Номер работы в блоке — целое число от 1 до 999999');
 return {blockId:block.id,itemNumber:ordinal,code:block.number+'.'+ordinal,label:text(data.label??old?.label,'Название работы',160),typeIds:data.typeIds===undefined?(old?JSON.parse(old.type_ids_json):[]):workTypes(data.typeIds)};
}
export async function catalogueApi({db,path,method,req,res,user,body,json,can,catalog}){
 const match=/^\/api\/(departments|work-blocks|position-works)(?:\/([a-f0-9-]+))?$/.exec(path);
 if(!match)return false;
 const [,kind,id]=match,resource=kind==='departments'?'departments':'workBlocks';
 const permission=kind==='position-works'?'planWorks.permissions':resource+'.'+(method==='GET'?'view':method==='POST'?'create':method==='DELETE'?'delete':'edit');
 if(!can(user,'database')||!can(user,permission))throw new AppError('Нет права на действие справочника',403);
 if(kind==='departments'&&method==='GET'&&!id){json(res,db.prepare('SELECT id,name FROM departments WHERE active=1 ORDER BY name').all());return true;}
 const d=await body(req);
 if(kind==='position-works'){
  if(method!=='PUT'||!id)throw new AppError('Метод не поддерживается',405);
  if(!db.prepare('SELECT 1 FROM positions WHERE id=?').get(id)||!db.prepare('SELECT 1 FROM work_blocks WHERE id=? AND active=1').get(d.blockId))throw new AppError('Должность или блок не найдены');
  if(!Array.isArray(d.workIds))throw new AppError('Выберите работы');
  const valid=db.prepare('SELECT id FROM planning_works WHERE block_id=? AND active=1').all(d.blockId).map(w=>w.id);
  if(d.workIds.some(x=>!valid.includes(x)))throw new AppError('Работа не принадлежит выбранному блоку');
  db.exec('BEGIN IMMEDIATE');try{
   db.prepare('DELETE FROM planning_permissions WHERE position_id=? AND work_id IN (SELECT id FROM planning_works WHERE block_id=?)').run(id,d.blockId);
   for(const workId of new Set(d.workIds))db.prepare('INSERT INTO planning_permissions VALUES(?,?)').run(id,workId);
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e;}
  json(res,catalog(db));return true;
 }
 const table=kind==='departments'?'departments':'work_blocks';
 if(id&&!db.prepare(`SELECT 1 FROM ${table} WHERE id=? AND active=1`).get(id))throw new AppError('Запись не найдена',404);
 db.exec('BEGIN IMMEDIATE');try{
  if(method==='DELETE'&&id){
   if(kind==='departments'&&db.prepare('SELECT 1 FROM employees WHERE department_id=? AND active=1').get(id))throw new AppError('Подразделение назначено сотрудникам. Сначала выберите им другое подразделение',409);
   if(kind==='work-blocks'&&db.prepare('SELECT 1 FROM planning_works WHERE block_id=? AND active=1').get(id))throw new AppError('В блоке есть работы. Сначала перенесите или уберите их',409);
   db.prepare(`UPDATE ${table} SET active=0 WHERE id=?`).run(id);
  }else if(method==='POST'&&!id||method==='PUT'&&id){
   const name=text(d.name,'Название',150);
   if(kind==='departments'){
    if(id){db.prepare('UPDATE departments SET name=?,name_key=? WHERE id=?').run(name,key(name),id);db.prepare('UPDATE employees SET department=? WHERE department_id=?').run(name,id);}
    else db.prepare('INSERT INTO departments(id,name,name_key) VALUES(?,?,?)').run(randomUUID(),name,key(name));
   }else{
    const number=d.number===undefined?(id?db.prepare('SELECT number FROM work_blocks WHERE id=?').get(id).number:Number(db.prepare('SELECT MAX(number) AS n FROM work_blocks').get().n||0)+1):Number(d.number);
    if(!Number.isSafeInteger(number)||number<1||number>999999)throw new AppError('Номер блока — целое число от 1 до 999999');
    if(id){
     db.prepare('UPDATE work_blocks SET name=?,number=? WHERE id=?').run(name,number,id);
     const works=db.prepare('SELECT id,item_number FROM planning_works WHERE block_id=?').all(id);
     for(const w of works)db.prepare('UPDATE planning_works SET code=? WHERE id=?').run('__renumber_'+randomUUID(),w.id);
     for(const w of works)db.prepare('UPDATE planning_works SET code=? WHERE id=?').run(number+'.'+w.item_number,w.id);
    }else db.prepare('INSERT INTO work_blocks(id,number,name) VALUES(?,?,?)').run(randomUUID(),number,name);
   }
  }else throw new AppError('Метод не поддерживается',405);
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
 json(res,kind==='departments'?{departments:db.prepare('SELECT id,name FROM departments WHERE active=1 ORDER BY name').all()}:catalog(db));return true;
}
