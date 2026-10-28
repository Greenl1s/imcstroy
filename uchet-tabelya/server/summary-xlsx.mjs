// Layout follows the supplied «НТС 1.1» sheet. Only layout is retained, never its personnel data.
import {zip,columnName} from './xlsx.mjs';
import {monthDays,shortName} from './domain.mjs';
import {publicMonthly} from './monthly.mjs';
import {cellAppearance} from './cell-state.mjs';
const esc=v=>String(v??'').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function summaryWorkbook(source){
 const s=publicMonthly(source,source.viewStage),pay=s.viewStage==='control',days=monthDays(s.month),start=pay?8:5,lastDay=start+days-1,plannedDaysCol=lastDay+1,plannedPayCol=lastDay+2,workedCol=lastDay+3,payCol=lastDay+4,lastCol=pay?payCol:lastDay;
 const endRow=s.rows.length+3,plannedTotalRow=endRow+1,totalRow=endRow+2,noteStart=(pay?totalRow:endRow)+3,signatureRow=noteStart+3,last=columnName(lastCol),dayFirst=columnName(start),dayLast=columnName(lastDay);
 const colors=['#eeeeee',...new Set(s.rows.flatMap(row=>Object.values(row.cells).map(e=>cellAppearance(s,e).color)))];
 const styles=[],style=(font=0,border=1,align=0,num=0,color=null)=>{const fill=color?colors.indexOf(color)+2:0,key=JSON.stringify([font,border,align,num,fill]);let id=styles.findIndex(s=>s.key===key);if(id<0){id=styles.length;styles.push({key,font,border,align,num,fill});}return id;};
 style(0,0); // default style 0
 const cell=(r,c,value,st=0,formula=null)=>value===''&&!formula?`<c r="${columnName(c)}${r}" s="${st}"/>`:`<c r="${columnName(c)}${r}" s="${st}"${typeof value==='number'||formula?'':' t="inlineStr"'}>${formula?`<f>${esc(formula)}</f><v>${value}</v>`:typeof value==='number'?`<v>${value}</v>`:`<is><t xml:space="preserve">${esc(value)}</t></is>`}</c>`;
 const row=(r,cells,height=14.5)=>`<row r="${r}" ht="${height}" customHeight="1">${cells}</row>`;
 const month=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(s.month+'-01T12:00:00Z'));
 let xml=row(1,cell(1,3,month[0].toUpperCase()+month.slice(1),style(1,0))+(pay?cell(1,7,s.baseCents/100,style(0,0,1)):''));
 const labels=['№ п/п','Подразделение','Ф.И.О.','Должность',...(pay?['Коэффициент','З/п ВСМ','З/п ВСМ в день']:[])];
 let head=labels.map((label,i)=>cell(2,i+1,label,style(1,1,i===1||i===3?4:7,i===5||i===6?4:0))).join('');
 head+=cell(2,start,`Период работ НТС и ТК с 01.${s.month.slice(5)}.${s.month.slice(0,4)} по ${days}.${s.month.slice(5)}.${s.month.slice(0,4)}`,style(1,1,6));
 // Borders of a merged header must be present on every covered cell.
 for(let c=start+1;c<=lastDay;c++)head+=cell(2,c,'',style(1,1,6));
 if(pay)head+=cell(2,plannedDaysCol,'Запланированные отработанные дни',style(0,1,3))+cell(2,plannedPayCol,'Запланированные з/п за отработанные дни',style(0,1,3))+cell(2,workedCol,'Общ.кол-во отработанных дней',style(0,1,3,2))+cell(2,payCol,'Зп за отработан-ные дни',style(0,1,3,3));
 xml+=row(2,head,47.25);
 let dateCells=labels.map((_,i)=>cell(3,i+1,'',style(1,1,7))).join('');
 for(let d=1;d<=days;d++)dateCells+=cell(3,start+d-1,d,style(2,1,0,49,s.calendar.nonworking.includes(d)?'#eeeeee':null));
 if(pay)dateCells+=cell(3,plannedDaysCol,'',style())+cell(3,plannedPayCol,'',style())+cell(3,workedCol,'',style())+cell(3,payCol,'',style());
 xml+=row(3,dateCells,24);
 s.rows.forEach((r,i)=>{
  const n=i+4,e=r.employeeSnapshot;let content=cell(n,1,i+1,style())+cell(n,2,e.department||'',style(0,1,4))+cell(n,3,e.name,style())+cell(n,4,e.position,style(0,1,1));
  if(pay)content+=cell(n,5,Number(r.coefficient),style())+cell(n,6,r.pay.monthlyCents/100,style(0,1,0,4),`ROUND(E${n}*$G$1,2)`)+cell(n,7,r.pay.daily,style(0,1,0,4),`F${n}/${s.calendar.workingDays}`);
  for(let d=1;d<=days;d++){const entry=r.cells[String(d)],a=entry?cellAppearance(s,entry):null;content+=cell(n,start+d-1,entry?entry.typeCode+String(entry.polygonNumber):'',style(a?.bold?1:0,1,0,0,a?a.color:s.calendar.nonworking.includes(d)?'#eeeeee':null));}
  if(pay)content+=cell(n,plannedDaysCol,r.pay.plannedDays,style())+cell(n,plannedPayCol,r.pay.plannedCents/100,style(0,1,0,4),`ROUND(${columnName(plannedDaysCol)}${n}*G${n},2)`)+cell(n,workedCol,r.pay.worked,style(),`COUNTA(${dayFirst}${n}:${dayLast}${n})`)+cell(n,payCol,r.pay.accruedCents/100,style(0,1,0,3),`ROUND(${columnName(workedCol)}${n}*G${n},2)`);
  const height=Math.max(14.5,Math.ceil((e.department||'').length/17)*14.5,Math.ceil((e.position||'').length/30)*14.5);
  xml+=row(n,content,height);
 });
 if(pay){
 xml+=row(plannedTotalRow,cell(plannedTotalRow,3,'Запланированные затраты',style(1,0))+(pay?cell(plannedTotalRow,plannedPayCol,s.totalPlannedCents/100,style(1,1,0,4),s.rows.length?`SUM(${columnName(plannedPayCol)}4:${columnName(plannedPayCol)}${endRow})`:'0'):cell(plannedTotalRow,start,s.totalPlannedCents/100,style(1,0,0,4))),20);
 xml+=row(totalRow,cell(totalRow,3,'Подтвержденные затраты',style(1,0))+(pay?cell(totalRow,payCol,s.totalAccruedCents/100,style(1,1,0,4),s.rows.length?`SUM(${columnName(payCol)}4:${columnName(payCol)}${endRow})`:'0'):cell(totalRow,start,s.totalAccruedCents/100,style(1,0,0,4))),20);
 }
 const merges=labels.map((_,i)=>`${columnName(i+1)}2:${columnName(i+1)}3`);merges.push(`${dayFirst}2:${dayLast}2`);
 const legendEnd=columnName(pay?workedCol:lastDay);
 s.types.forEach((t,i)=>{const n=noteStart+i;const desc=`${t.code} — ${t.name}. Первая цифра — тип занятости, следующие цифры — номер полигона, включая 0.`;xml+=row(n,cell(n,start,desc,style(3,0,4)),i===0?55.5:i===1?46.5:29);merges.push(`${dayFirst}${n}:${legendEnd}${n}`);});
 const sign=s.signerSnapshot?`${s.signerSnapshot.position} · ${shortName(s.signerSnapshot.name)} ____________________`:'Подпись ____________________';
 xml+=row(signatureRow,cell(signatureRow,3,sign,style(0,0,1)),28);merges.push(`C${signatureRow}:${last}${signatureRow}`);
 const widths=[5.54296875,17.1796875,35,30.26953125,...(pay?[30.26953125,30.26953125,30.26953125]:[]),...Array.from({length:days},(_,i)=>i===1?3.7265625:i===2?4.453125:i===3?4.1796875:i<16?4:3),...(pay?[20,23,15.81640625,13]:[])];
 const alignments=['','wrapText="1"','horizontal="left"','horizontal="center" wrapText="1"','vertical="center" wrapText="1"','horizontal="left" vertical="center"','horizontal="center" vertical="center"','horizontal="center" vertical="center" wrapText="1"'];
 const stylesXml=`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><name val="Calibri"/><sz val="11"/></font><font><name val="Calibri"/><sz val="11"/><b/></font><font><name val="Calibri"/><sz val="10"/></font><font><name val="Times New Roman"/><sz val="12"/></font></fonts><fills count="${colors.length+2}"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>${colors.map(c=>`<fill><patternFill patternType="solid"><fgColor rgb="FF${c.slice(1).toUpperCase()}"/><bgColor indexed="64"/></patternFill></fill>`).join('')}</fills><borders count="2"><border><left/><right/><top/><bottom/></border><border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right><top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${styles.length}">${styles.map(x=>`<xf numFmtId="${x.num}" fontId="${x.font}" fillId="${x.fill}" borderId="${x.border}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1" applyNumberFormat="1"><alignment ${alignments[x.align]}/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
 return zip({
 '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
 '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
 'xl/workbook.xml':`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Сводная таблица" sheetId="1" r:id="rId1"/></sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`,
 'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
 'xl/styles.xml':stylesXml,
 'xl/worksheets/sheet1.xml':`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}${signatureRow}"/><sheetViews><sheetView workbookViewId="0"><pane xSplit="3" ySplit="3" topLeftCell="D4" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><sheetFormatPr baseColWidth="8" defaultRowHeight="14.5"/><cols>${widths.map((w,i)=>`<col min="${i+1}" max="${i+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${xml}</sheetData><mergeCells count="${merges.length}">${merges.map(m=>`<mergeCell ref="${m}"/>`).join('')}</mergeCells><pageMargins left="0" right="0" top="0" bottom="0" header="0" footer="0"/><pageSetup orientation="portrait" paperSize="8"/></worksheet>`
 });
}
