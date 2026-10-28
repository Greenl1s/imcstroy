// Only verification approves individual days. Planning and control do not.
export const cellStages=['planning','verification','control'];
export const cellColors={trip:{pale:'#dceaff',bright:'#8db9f5'},office:{pale:'#ffe0de',bright:'#f2a6a0'},general:{pale:'#def0dd',bright:'#9cd397'}};
export function cellApprovals(s,e){
 if(e.approvals)return {verification:e.approvals.verification||null};
 return {verification:['control','approved'].includes(s.stage)?{legacy:true}:null};
}
export function cellAppearance(s,e){
 const a=cellApprovals(s,e),palette=cellColors[e.typeId]||{pale:e.color||'#eeeeee',bright:e.color||'#eeeeee'};
 return {color:a.verification?palette.bright:palette.pale,bold:!!e.workId,italic:false};
}
export function migrateCellApprovals(s){
 if(s.cellApprovalsVersion===2)return false;
 for(const row of s.rows)for(const e of Object.values(row.cells))e.approvals=cellApprovals(s,e);
 s.cellApprovalsVersion=2;return true;
}
export function approvalProgress(s){
 const entries=s.rows.flatMap(r=>Object.values(r.cells));
 return {verification:entries.filter(e=>cellApprovals(s,e).verification).length,total:entries.length};
}
