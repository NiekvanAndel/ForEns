import React from 'react';
export function Eyebrow({children,tone='green',style}){
  return <div style={{fontFamily:'var(--font-core)',fontSize:'var(--fs-eyebrow)',fontWeight:'var(--fw-bold)',letterSpacing:'var(--ls-eyebrow)',textTransform:'uppercase',color:tone==='light'?'var(--green)':'var(--green-dark)',marginBottom:'12px',...style}}>{children}</div>;
}
