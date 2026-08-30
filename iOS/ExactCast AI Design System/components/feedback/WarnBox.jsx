import React from 'react';
export function WarnBox({title,children,style}){
  return <div style={{background:'var(--warn-bg)',border:'1px solid var(--warn-border)',borderRadius:'var(--radius-tile)',padding:'18px 20px',...style}}>
    {title?<b style={{display:'block',color:'var(--warn-title)',marginBottom:'8px',fontFamily:'var(--font-core)',fontSize:'15.5px',lineHeight:1.4}}>{title}</b>:null}
    <p style={{margin:0,fontSize:'var(--fs-label)',color:'var(--on-navy-soft)',lineHeight:1.6}}>{children}</p>
  </div>;
}
