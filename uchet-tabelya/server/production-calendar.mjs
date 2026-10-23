import { AppError,monthDays } from './domain.mjs';
export const calendarSources=['https://www.cbr.ru/other/holidays/','https://static.government.ru/media/files/4jeB8hNKm69ggOa9yDiYOli6YoAyM21i.pdf'];
const fixed=['01-01','01-02','01-03','01-04','01-05','01-06','01-07','01-08','02-23','03-08','05-01','05-09','06-12','11-04'];
const transfers={2026:{off:['01-09','03-09','05-11','12-31'],on:[]},2027:{off:['02-22','05-03','05-10','06-14','11-05','12-31'],on:['02-20']}};
export function calendar(month,overrides={}){
 const total=monthDays(month),year=Number(month.slice(0,4)),rules=transfers[year],custom=overrides[String(year)];
 if(!rules&&!custom?.approved)throw new AppError(`Календарь ${year} года не подтверждён. Администратор должен настроить праздники и переносы`);
 const off=new Set([...(rules?.off||[]),...fixed].map(x=>year+'-'+x)),on=new Set((rules?.on||[]).map(x=>year+'-'+x));
 for(const date of custom?.off||[])off.add(date);
 for(const date of custom?.on||[]){if(!fixed.includes(date.slice(5)))on.add(date);}
 const nonworking=[];
 for(let d=1;d<=total;d++){
  const date=month+'-'+String(d).padStart(2,'0'),weekend=[0,6].includes(new Date(date+'T12:00:00Z').getUTCDay());
  if((weekend&&!on.has(date))||off.has(date))nonworking.push(d);
 }
 const workingDays=total-nonworking.length;
 if(!workingDays)throw new AppError('В месяце нет рабочих дней. Проверьте календарь');
 return {nonworking,workingDays,source:rules?calendarSources[0]:(custom.source||'Календарь подтверждён администратором')};
}
export function validateCalendarOverride(year,data){
 if(!Number.isInteger(year)||year<2000||year>2100||data.approved!==true)throw new AppError('Подтвердите календарь выбранного года');
 for(const key of ['off','on']){
  if(!Array.isArray(data[key])||data[key].length>366)throw new AppError('Некорректный список дат');
  for(const date of data[key])if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number(date.slice(0,4))!==year||Number.isNaN(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date)throw new AppError('Некорректная дата календаря');
 }
 if(data.off.some(x=>data.on.includes(x)))throw new AppError('Дата не может быть одновременно рабочей и нерабочей');
 return {off:[...new Set(data.off)],on:[...new Set(data.on)],approved:true,source:String(data.source||'Подтверждено администратором').slice(0,500)};
}
