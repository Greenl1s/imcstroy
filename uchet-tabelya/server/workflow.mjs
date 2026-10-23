import { randomUUID } from 'node:crypto';
import { AppError, text, monthDays } from './domain.mjs';
export const stages=['planning','verification','control'];
export async function workflowApi({db,path,method,req,res,user,body,json,can}){
 if(!path.startsWith('/api/workflows'))return false;
 const access=stage=>{if(!can(user,stage))throw new AppError('Нет доступа к этому этапу',403);};
 const allowed=s=>access(s.stage==='approved'?'control':s.stage);
 const match=/^\/api\/workflows(?:\/([a-f0-9-]+)(?:\/(confirm))?)?$/.exec(path);
 if(!match)throw new AppError('Таблица не найдена',404);
 const [,id,action]=match;
 if(!id&&method==='GET'){
  const rows=db.prepare('SELECT body FROM workflows ORDER BY updated_at DESC').all().map(r=>JSON.parse(r.body)).filter(s=>can(user,s.stage==='approved'?'control':s.stage));
  json(res,rows.map(({rows,history,...s})=>({...s,rowCount:rows.length})));return true;
 }
 if(!id&&method==='POST'){
  access('planning');if(!can(user,'planning.create'))throw new AppError('Нет права создавать таблицы',403);const data=await body(req);monthDays(data.month);
  const stamp=new Date().toISOString(),s={id:randomUUID(),name:text(data.name,'Название таблицы',150),month:data.month,stage:'planning',revision:1,rows:[],history:[{at:stamp,user:user.name,action:'Создана таблица'}],updatedAt:stamp};
  db.prepare('INSERT INTO workflows VALUES(?,?,?)').run(s.id,JSON.stringify(s),stamp);json(res,s,201);return true;
 }
 const get=()=>{const record=db.prepare('SELECT body FROM workflows WHERE id=?').get(id);if(!record)throw new AppError('Таблица не найдена',404);return JSON.parse(record.body);};
 if(method==='GET'&&id&&!action){const s=get();allowed(s);json(res,s);return true;}
 if((method==='PATCH'&&!action)||(method==='POST'&&action==='confirm')){
  const data=await body(req);db.exec('BEGIN IMMEDIATE');
  try{
   const s=get();allowed(s);
   if(!can(user,(s.stage==='approved'?'control':s.stage)+(method==='PATCH'?'.edit':'.confirm')))throw new AppError('Нет права редактировать или подтверждать этап',403);
   if(s.stage==='approved')throw new AppError('Контроль завершён. Таблица доступна только для просмотра',403);
   if(s.revision!==data.expectedRevision)throw new AppError('Таблица изменена другим пользователем. Откройте её заново',409);
   if(method==='PATCH'){
    if(data.name!==undefined)s.name=text(data.name,'Название таблицы',150);
    if(data.rows!==undefined){
     if(!Array.isArray(data.rows)||data.rows.length>500)throw new AppError('Допустимо до 500 строк');
     s.rows=data.rows.map(r=>{
      if(!r||typeof r!=='object')throw new AppError('Некорректная строка таблицы');
      const date=text(r.date,'Дата',10,true);
      if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||date.slice(0,7)!==s.month||Number(date.slice(8))<1||Number(date.slice(8))>monthDays(s.month)))throw new AppError('Дата строки должна находиться в месяце таблицы');
      return {employee:text(r.employee,'Сотрудник',150,true),work:text(r.work,'Работа',500,true),date,note:text(r.note,'Примечание',500,true)};
     });
    }
   }else{
    if(!s.rows.length||s.rows.some(r=>!r.employee||!r.work||!r.date))throw new AppError('Добавьте строки и заполните сотрудника, работу и дату перед подтверждением');
    s.stage=stages[stages.indexOf(s.stage)+1]||'approved';
   }
   s.revision++;s.updatedAt=new Date().toISOString();s.history.push({at:s.updatedAt,user:user.name,action:action==='confirm'?`Подтверждено: ${{planning:'Планирование',verification:'Верификация',control:'Контроль',approved:'Согласовано'}[s.stage]}`:'Изменена таблица'});
   db.prepare('UPDATE workflows SET body=?,updated_at=? WHERE id=?').run(JSON.stringify(s),s.updatedAt,id);
   db.exec('COMMIT');json(res,s);return true;
  }catch(e){db.exec('ROLLBACK');throw e;}
 }
 throw new AppError('Действие не найдено',404);
}
