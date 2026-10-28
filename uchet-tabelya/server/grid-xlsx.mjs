import {summaryWorkbook} from './summary-xlsx.mjs';
import {cellAppearance} from './cell-state.mjs';
import {zip,columnName} from './xlsx.mjs';
import {monthDays,shortName} from './domain.mjs';
import {publicMonthly} from './monthly.mjs';
const esc=v=>String(v??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function gridWorkbook(source){
 if(source.format==='monthly-v2')return summaryWorkbook(source);
 const s=source.format==='monthly-v2'?publicMonthly(source,source.viewStage):source,total=monthDays(s.month),pay=s.format==='monthly-v2'&&s.viewStage==='control',generated=s.format==='polygon-v2';
 const heads=['№','Подразделение','Ф.И.О.','Должность',...(pay?['Коэффициент','З/п ВСМ','З/п ВСМ в день']:[]),...Array.from({length:total},(_,i)=>String(i+1)),...(pay?['Общее кол-во отработанных дней','З/п за отработанные дни']:[])];
 const colors=['#ffffff','#edf2e9','#eeeeee',...(s.types||[]).map(t=>t.color)];
 for(const row of s.rows)for(const e of Object.values(row.cells)){const color=generated?e.color:cellAppearance(s,e).color;if(!colors.includes(color))colors.push(color);}
 const styles=[{font:0,fill:0,num:0},{font:1,fill:0,num:0},{font:1,fill:3,num:0},{font:0,fill:0,num:2}];
 const colorStyle=(color,font=0)=>{const fill=colors.indexOf(color)+2;let id=styles.findIndex(x=>x.fill===fill&&x.font===font&&x.num===0);if(id<0){id=styles.length;styles.push({font,fill,num:0});}return id;};
 const cell=(r,c,value,style=0)=>typeof value==='number'?`<c r="${columnName(c)}${r}" s="${style}"><v>${value}</v></c>`:`<c r="${columnName(c)}${r}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
 const signature=s.signerSnapshot?`${s.signerSnapshot.position} · ${shortName(s.signerSnapshot.name)} ____________________`:'Подпись ____________________';
 let xml=`<row r="1" ht="32" customHeight="1">${cell(1,1,s.name+' — '+s.month,1)}</row><row r="2" ht="30" customHeight="1">${cell(2,1,signature)}</row><row r="3" ht="70" customHeight="1">${heads.map((h,i)=>cell(3,i+1,h,2)).join('')}</row>`;
 const dayStart=pay?8:5;
 s.rows.forEach((row,i)=>{
  const r=i+4,e=row.employeeSnapshot,values=[i+1,e.department||'',e.name,e.position];
  if(pay)values.push(Number(row.coefficient),row.pay.monthlyCents/100,row.pay.daily);
  let cells=values.map((v,c)=>cell(r,c+1,v,pay&&c>=5?3:0)).join('');
  for(let d=1;d<=total;d++){
   const entry=row.cells[String(d)],value=entry?(generated?entry.workCode:entry.typeCode+String(entry.polygonNumber)):'';
   cells+=cell(r,dayStart+d-1,value,entry?(generated?colorStyle(entry.color):colorStyle(cellAppearance(s,entry).color,(entry.workId?1:0)+(cellAppearance(s,entry).italic?2:0))):s.calendar.nonworking.includes(d)?colorStyle('#eeeeee'):0);
  }
  if(pay)cells+=cell(r,dayStart+total,row.pay.worked)+cell(r,dayStart+total+1,row.pay.accruedCents/100,3);
  xml+=`<row r="${r}" ht="44" customHeight="1">${cells}</row>`;
 });
 const legendStart=s.rows.length+5,last=columnName(heads.length),merges=[`A1:${last}1`,`A2:${last}2`];
 (s.types||[]).forEach((type,i)=>{const r=legendStart+i;xml+=`<row r="${r}" ht="24" customHeight="1">${cell(r,1,`${type.code} — ${type.name}`,colorStyle(type.color))}</row>`;merges.push(`A${r}:${last}${r}`);});
 const end=legendStart+(s.types||[]).length;xml+=`<row r="${end}" ht="30" customHeight="1">${cell(end,1,`Рабочих дней месяца: ${s.calendar.workingDays}. ${generated?'В ячейках — шифры работ.':'Первая цифра — тип занятости; остальные — номер полигона, включая 0.'}`)}</row>`;merges.push(`A${end}:${last}${end}`);
 const contentTypes=`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`;
 return zip({
  '[Content_Types].xml':contentTypes,
  '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  'xl/workbook.xml':`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${generated?'Табель':'Общая таблица'}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'xl/styles.xml':`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><i/><sz val="11"/><name val="Calibri"/></font><font><b/><i/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="${colors.length+2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${colors.map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c.slice(1).toUpperCase()}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills><borders count="1"><border><left style="thin"/><right style="thin"/><top style="thin"/><bottom style="thin"/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${styles.length}">${styles.map(x=>`<xf numFmtId="${x.num}" fontId="${x.font}" fillId="${x.fill}" borderId="0" xfId="0" applyAlignment="1" applyNumberFormat="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`,
  'xl/worksheets/sheet1.xml':`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}${end}"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><cols>${heads.map((h,i)=>`<col min="${i+1}" max="${i+1}" width="${i===0?5:i===1?20:i===2?32:i===3?25:i>=dayStart-1&&i<dayStart+total-1?7:16}" customWidth="1"/>`).join('')}</cols><sheetData>${xml}</sheetData><mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells><pageMargins left="0.2" right="0.2" top="0.3" bottom="0.3" header="0.1" footer="0.1"/><pageSetup orientation="landscape" paperSize="8"/></worksheet>`
 });
}
