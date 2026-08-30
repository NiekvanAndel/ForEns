import React from 'react';
const map={dry:'dry',light:'light',heavy:'heavy',green:'dry',amber:'light',red:'heavy'};
const fill={dry:'var(--status-dry)',light:'var(--status-light)',heavy:'var(--status-heavy)'};
export function StatusDot({status='dry',size=12,style}){
  const k=map[status]||'dry';
  return <span style={{width:size+'px',height:size+'px',flex:'0 0 '+size+'px',borderRadius:'50%',
    background:fill[k],boxShadow:k==='dry'?'inset 0 0 0 1.5px var(--status-dry-edge)':'none',
    display:'inline-block',...style}}/>;
}
