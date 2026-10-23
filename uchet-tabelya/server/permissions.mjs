export const permissionGroups=[
 ['Табели','timesheets',[['view','Просматривать табели и историю'],['create','Создавать табели'],['edit','Переименовывать, выбирать подписанта, добавлять и удалять строки, заполнять и очищать дни'],['export','Выгружать Excel'],['complete','Завершать табели'],['reopen','Возвращать завершённые в работу'],['delete','Удалять табели']]],
 ['Полигоны','polygons',[['view','Просматривать полигоны'],['create','Добавлять полигоны'],['edit','Редактировать полигоны'],['delete','Убирать полигоны из справочника']]],
 ['Работы общих таблиц','planWorks',[['view','Просматривать шифры и работы'],['create','Добавлять работы'],['edit','Редактировать работы'],['delete','Убирать работы'],['permissions','Настраивать ограничения по должностям']]],
 ['База данных','database',[['view','Открывать раздел базы данных']]],
 ['Сотрудники','employees',[['view','Просматривать сотрудников'],['create','Добавлять сотрудников'],['edit','Изменять ФИО, должность, подразделение, коэффициент и примечание'],['delete','Убирать сотрудников из справочника']]],
 ['Должности','positions',[['view','Просматривать должности'],['create','Добавлять должности']]],
 ['Виды работ и командировки','workTypes',[['view','Просматривать обе категории работ'],['create','Добавлять работы'],['edit','Переименовывать работы'],['delete','Убирать работы из справочника']]],
 ['Матрица разрешённых работ','permissions',[['edit','Разрешать и запрещать работы для должностей']]],
 ['Подписанты','signers',[['view','Просматривать подписантов'],['create','Добавлять подписантов'],['edit','Изменять ФИО и должность подписанта'],['delete','Убирать подписантов из справочника']]],
 ['Планирование','planning',[['view','Просматривать таблицы и историю'],['create','Создавать общие таблицы'],['edit','Изменять строки таблиц'],['export','Выгружать общую таблицу Excel'],['confirm','Подтверждать передачу в верификацию']]],
 ['Верификация','verification',[['view','Просматривать таблицы и историю'],['edit','Редактировать строки'],['export','Выгружать общую таблицу Excel'],['confirm','Подтверждать передачу в контроль']]],
 ['Контроль','control',[['view','Просматривать контроль, расчёты зарплаты и историю'],['edit','Редактировать строки'],['export','Выгружать общую таблицу Excel'],['confirm','Подтверждать завершение контроля']]]
];
export const allPermissions=permissionGroups.flatMap(([,group,actions])=>actions.map(([action])=>group+'.'+action));
export function normalizePermissions(values){
 if(!Array.isArray(values)||values.some(v=>!allPermissions.includes(v)))throw new Error('Некорректный список прав');
 const result=new Set(values);
 for(const value of values){
  const group=value.split('.')[0];
  if(allPermissions.includes(group+'.view'))result.add(group+'.view');
  if(['employees','positions','workTypes','permissions','signers','polygons','planWorks'].includes(group))result.add('database.view');
  if(group==='planWorks'&&value.endsWith('.permissions'))result.add('positions.view');
  if(group==='permissions'){result.add('positions.view');result.add('workTypes.view');}
  if(group==='employees'&&['create','edit'].includes(value.split('.')[1]))result.add('positions.view');
 }
 return [...result];
}
