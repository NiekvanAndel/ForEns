import React from 'react';
const c={dry:'var(--status-dry)',light:'var(--status-light)',heavy:'var(--status-heavy)'};
const alias={dry:'dry',light:'light',heavy:'heavy',green:'dry',amber:'light',red:'heavy'};
export function StatusCard({status='dry',title,children,style}){
  const k=alias[status]||'dry';
  return <div style={{background:'#fff',borderRadius:'var(--radius-card)',boxShadow:'var(--shadow-card)',padding:'22px',
    borderTop:'var(--accent-top) solid '+c[k],...style}}>
    <b style={{display:'block',marginBottom:'6px',fontFamily:'var(--font-core)',color:'var(--ink-heading)'}}>{title}</b>
    <p style={{margin:0,fontSize:'var(--fs-body-sm)',color:'var(--muted)',lineHeight:1.6}}>{children}</p>
  </div>;
}
