import { DatabaseSync, backup } from 'node:sqlite';
import { mkdirSync, existsSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

process.umask(0o077);
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const source=resolve(process.env.DATABASE_PATH||resolve(root,'data','timesheets.sqlite'));
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const destination=resolve(process.argv[2]||resolve(dirname(source),'backups',`timesheets-${stamp}.sqlite`));
if(!existsSync(source))throw new Error('База данных не найдена. Сначала запустите приложение.');
if(destination===source||existsSync(destination))throw new Error('Выберите новое имя файла: существующие базы и копии не перезаписываются.');
mkdirSync(dirname(destination),{recursive:true,mode:0o700});
const db=new DatabaseSync(source,{readOnly:true});
try{
  await backup(db,destination);
  chmodSync(destination,0o600);
  const check=new DatabaseSync(destination,{readOnly:true});
  try{
    const result=check.prepare('PRAGMA quick_check').get();
    if(result.quick_check!=='ok')throw new Error('Проверка целостности резервной копии не пройдена.');
  }finally{check.close();}
  console.log(destination);
}finally{db.close();}
