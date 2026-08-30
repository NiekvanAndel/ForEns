import React from 'react';
export function SpecCard({title,value,children,style}){
  return <div style={{background:'#fff',borderRadius:'var(--radius-card)',boxShadow:'var(--shadow-card)',padding:'20px 22px',...style}}>
    <b style={{display:'block',color:'var(--ink-heading)',fontSize:'var(--fs-body)',marginBottom:'4px',fontFamily:'var(--font-core)'}}>{title}</b>
    {value?<div style={{fontSize:'var(--fs-meta)',color:'var(--green-dark)',fontWeight:'var(--fw-semibold)',marginBottom:'8px'}}>{value}</div>:null}
    <p style={{margin:0,fontSize:'var(--fs-ui)',color:'var(--muted)',lineHeight:1.6}}>{children}</p>
  </div>;
}
