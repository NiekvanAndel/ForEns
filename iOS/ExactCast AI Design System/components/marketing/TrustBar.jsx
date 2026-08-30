import React from 'react';
export function TrustBar({items=[],style}){
  return <div style={{background:'#fff',borderRadius:'var(--radius-card)',boxShadow:'var(--shadow-card)',position:'relative',zIndex:5,
    maxWidth:'1180px',margin:'-44px auto 0',display:'grid',gridTemplateColumns:'repeat('+items.length+',1fr)',gap:'8px',padding:'22px 12px',...style}}>
    {items.map((it,i)=><div key={i} style={{textAlign:'center',fontSize:'var(--fs-label)',color:'var(--muted)',padding:'0 10px',lineHeight:1.4,
      borderRight:i===items.length-1?0:'1px solid rgba(12,37,71,.08)'}}>
      <b style={{display:'block',color:'var(--ink-heading)',fontSize:'15px'}}>{it.value}</b>{it.label}</div>)}
  </div>;
}
