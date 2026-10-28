import { deflateRawSync } from 'node:zlib';
import { monthDays, shortName } from './domain.mjs';

const esc = value => String(value ?? '').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const crcTable = Array.from({length:256}, (_, i) => { let n=i; for(let j=0;j<8;j++) n=(n&1)?0xedb88320^(n>>>1):n>>>1; return n>>>0; });
function crc32(b) { let c=0xffffffff; for(const x of b)c=crcTable[(c^x)&255]^(c>>>8); return (c^0xffffffff)>>>0; }
export function zip(files) {
  const chunks=[], central=[]; let offset=0;
  for (const [name, content] of Object.entries(files)) {
    const n=Buffer.from(name), raw=Buffer.from(content), packed=deflateRawSync(raw), crc=crc32(raw);
    const h=Buffer.alloc(30); h.writeUInt32LE(0x04034b50,0);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(8,8);h.writeUInt16LE(33,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(packed.length,18);h.writeUInt32LE(raw.length,22);h.writeUInt16LE(n.length,26);
    chunks.push(h,n,packed);
    const d=Buffer.alloc(46);d.writeUInt32LE(0x02014b50,0);d.writeUInt16LE(20,4);d.writeUInt16LE(20,6);d.writeUInt16LE(0x800,8);d.writeUInt16LE(8,10);d.writeUInt16LE(33,14);d.writeUInt32LE(crc,16);d.writeUInt32LE(packed.length,20);d.writeUInt32LE(raw.length,24);d.writeUInt16LE(n.length,28);d.writeUInt32LE(offset,42);
    central.push(d,n);offset+=h.length+n.length+packed.length;
  }
  const directory=Buffer.concat(central), end=Buffer.alloc(22), count=Object.keys(files).length;
  end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(count,8);end.writeUInt16LE(count,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...chunks,directory,end]);
}
export function columnName(i) { let s='';while(i){i--;s=String.fromCharCode(65+i%26)+s;i=Math.floor(i/26);}return s; }
const cell=(ref,value,style=0)=>`<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(value)}</t></is></c>`;
export function workbook(sheet) {
  const days=monthDays(sheet.month), last=columnName(days*2+1), merges=[`A1:${last}1`,`A2:${last}2`,'A4:A5'];
  const [year,month]=sheet.month.split('-');
  const period=new Intl.DateTimeFormat('ru-RU',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${sheet.month}-01T12:00:00Z`));
  let rows=`<row r="1" ht="30" customHeight="1">${cell('A1',sheet.name+' — '+period,1)}</row><row r="2" ht="36" customHeight="1">${cell('A2',sheet.signerSnapshot ? `${sheet.signerSnapshot.position ? sheet.signerSnapshot.position+' · ' : ''}${shortName(sheet.signerSnapshot.name)}  ____________________` : 'Подписант не выбран  ____________________',2)}</row><row r="3" ht="12" customHeight="1"/>`;
  let top=cell('A4','Сотрудник',3), bottom='';
  for(let day=1;day<=days;day++){
    const a=columnName(day*2),b=columnName(day*2+1),date=new Date(Date.UTC(+year,+month-1,day)),weekend=[0,6].includes(date.getUTCDay());
    merges.push(`${a}4:${b}4`);top+=cell(a+'4',`${String(day).padStart(2,'0')}.${month}\n${new Intl.DateTimeFormat('ru-RU',{weekday:'short',timeZone:'UTC'}).format(date)}`,weekend?4:3);
    bottom+=cell(a+'5','Вид работы',weekend?4:3)+cell(b+'5','Вид работы\nкомандировка',weekend?4:3);
  }
  rows+=`<row r="4" ht="36" customHeight="1">${top}</row><row r="5" ht="48" customHeight="1">${bottom}</row>`;
  for(const [i,row] of sheet.rows.entries()){
    const n=i+6;let content=cell('A'+n,row.employeeSnapshot.name+'\n'+row.employeeSnapshot.position,5);
    for(let d=1;d<=days;d++){
      const entry=row.cells[String(d)];
      content+=cell(columnName(d*2)+n,entry?(entry.category==='regular'?entry.label:'—'):'',0);
      content+=cell(columnName(d*2+1)+n,entry?(entry.category==='trip'?entry.label:'—'):'',entry?.category==='trip'?6:0);
    }
    const longest=Math.max(0,...Object.values(row.cells).map(e=>e.label.length));
    const height=Math.max(72,Math.ceil(longest/11)*15+16,Math.ceil(row.employeeSnapshot.name.length/30)*15+36);
    rows+=`<row r="${n}" ht="${Math.min(height,409)}" customHeight="1">${content}</row>`;
  }
  const styles=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="3"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="16"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8F1EC"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F2EE"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEEF2FA"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border/><border><left style="thin"><color rgb="FFD9D9D9"/></left><right style="thin"><color rgb="FFD9D9D9"/></right><top style="thin"><color rgb="FFD9D9D9"/></top><bottom style="thin"><color rgb="FFD9D9D9"/></bottom></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="right" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="2" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf><xf numFmtId="0" fontId="0" fillId="4" borderId="1" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  return zip({
    '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':'<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets><sheet name="Табель" sheetId="1" r:id="rId1"/></sheets><definedNames><definedName name="_xlnm.Print_Titles" localSheetId="0">Табель!$1:$5</definedName></definedNames></workbook>',
    'xl/_rels/workbook.xml.rels':'<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml':styles,
    'xl/worksheets/sheet1.xml':`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:${last}${Math.max(5,sheet.rows.length+5)}"/><sheetViews><sheetView workbookViewId="0"><selection activeCell="A1" sqref="A1"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="20"/><cols><col min="1" max="1" width="34" customWidth="1"/><col min="2" max="${days*2+1}" width="12" customWidth="1"/></cols><sheetData>${rows}</sheetData><mergeCells count="${merges.length}">${merges.map(r=>`<mergeCell ref="${r}"/>`).join('')}</mergeCells><pageMargins left="0.25" right="0.25" top="0.4" bottom="0.4" header="0.2" footer="0.2"/><pageSetup paperSize="8" orientation="landscape"/></worksheet>`
  });
}
