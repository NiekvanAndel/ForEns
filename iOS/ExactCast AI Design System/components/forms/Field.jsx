import React from 'react';
export function Field({label,hint,children,style}){
  return <div style={{marginBottom:'var(--space-6)',...style}}>
    {label?<label style={{display:'block',fontFamily:'var(--font-core)',fontSize:'var(--fs-label)',fontWeight:'var(--fw-semibold)',color:'var(--ink-heading)',marginBottom:'6px'}}>{label}
      {hint?<span style={{display:'block',fontSize:'var(--fs-caption)',fontWeight:'var(--fw-regular)',color:'var(--muted)',marginTop:'3px'}}>{hint}</span>:null}</label>:null}
    {children}
  </div>;
}
