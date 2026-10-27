// Cell approvals refer to the current saved value. Editing invalidates every stage.
export const cellStages=['planning','verification','control'];
export const cellColors={trip:{pale:'#dceaff',bright:'#8db9f5'},office:{pale:'#ffe0de',bright:'#f2a6a0'},general:{pale:'#def0dd',bright:'#9cd397'}};
export function cellApprovals(s,e){
 if(e.approvals)return e.approvals;
 // Compatibility with stages completed before per-cell approvals were introduced.
 const n=cellStages.indexOf(s.stage);
 return Object.fromEntries(cellStages.map((stage,i)=>[stage,s.stage==='approved'||i<n?{legacy:true}:null]));
}
export function cellAppearance(s,e){
 const a=cellApprovals(s,e),palette=cellColors[e.typeId]||{pale:e.color||'#eeeeee',bright:e.color||'#eeeeee'};
 return {color:a.verification?palette.bright:palette.pale,bold:!!e.workId,italic:!a.planning};
}
export function migrateCellApprovals(s){
 if(s.cellApprovalsVersion===1)return false;
 for(const row of s.rows)for(const e of Object.values(row.cells))e.approvals=cellApprovals(s,e);
 s.cellApprovalsVersion=1;return true;
}
export function approvalProgress(s){
 const entries=s.rows.flatMap(r=>Object.values(r.cells));
 return Object.fromEntries(cellStages.map(stage=>[stage,entries.filter(e=>cellApprovals(s,e)[stage]).length]).concat([['total',entries.length]]));
}
