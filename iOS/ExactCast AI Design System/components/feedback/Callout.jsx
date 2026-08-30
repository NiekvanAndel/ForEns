import React from 'react';
export function Callout({title,children,style}){
  return <div style={{background:'#fff',borderLeft:'var(--accent-bar) solid var(--green)',borderRadius:'var(--radius-tile)',
    boxShadow:'var(--shadow-card)',padding:'22px 24px',...style}}>
    {title?<h3 style={{margin:'0 0 8px',fontFamily:'var(--font-core)',fontSize:'var(--fs-h4)',fontWeight:'var(--fw-semibold)',color:'var(--ink-heading)',lineHeight:1.35}}>{title}</h3>:null}
    <div style={{fontSize:'var(--fs-body-sm)',color:'var(--muted)',lineHeight:1.65}}>{children}</div>
  </div>;
}
