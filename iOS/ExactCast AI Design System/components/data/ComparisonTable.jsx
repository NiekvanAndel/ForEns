import React from 'react';
export function ComparisonTable({columns=[],rows=[],style}){
  return <div style={{background:'#fff',borderRadius:'var(--radius-card)',boxShadow:'var(--shadow-card)',overflow:'hidden',...style}}>
    <table style={{width:'100%',borderCollapse:'separate',borderSpacing:0,fontFamily:'var(--font-core)'}}>
      <thead><tr>
        <th style={{background:'var(--navy-panel)',padding:'16px 18px',textAlign:'left'}}/>
        {columns.map((c,i)=><th key={i} style={{padding:'16px 18px',textAlign:'left',fontSize:'var(--fs-label)',fontWeight:'var(--fw-semibold)',color:'#fff',
          background:i===columns.length-1?'var(--gradient-primary)':'var(--navy-panel)'}}>{c}</th>)}
      </tr></thead>
      <tbody>{rows.map((r,ri)=>{const last=ri===rows.length-1;return <tr key={ri}>
        <th style={{padding:'16px 18px',textAlign:'left',fontSize:'var(--fs-body-sm)',fontWeight:'var(--fw-semibold)',color:'var(--ink-heading)',width:'34%',borderBottom:last?0:'1px solid var(--hairline-soft)'}}>{r.label}</th>
        {r.cells.map((cell,ci)=>{const isLast=ci===r.cells.length-1;return <td key={ci} style={{padding:'16px 18px',fontSize:'var(--fs-body-sm)',
          color:isLast?'var(--ink-heading)':'var(--muted)',fontWeight:isLast?'var(--fw-semibold)':'var(--fw-regular)',
          background:isLast?'var(--green-tint)':undefined,borderBottom:last?0:'1px solid var(--hairline-soft)'}}>
          {cell==='—'?<span style={{color:'var(--ink-disabled)'}}>—</span>:cell}</td>;})}
      </tr>;})}</tbody>
    </table>
  </div>;
}
