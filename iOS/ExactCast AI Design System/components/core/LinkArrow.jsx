import React from 'react';
export function LinkArrow({href='#',children,onClick,tone='dark',style}){
  const [h,setH]=React.useState(false);
  return <a href={href} onClick={onClick} onMouseEnter={()=>setH(true)} onMouseLeave={()=>setH(false)}
    style={{display:'inline-flex',alignItems:'center',gap:'8px',fontFamily:'var(--font-core)',fontWeight:'var(--fw-semibold)',fontSize:'var(--fs-body)',textDecoration:'none',color:tone==='light'?'#fff':'var(--ink-heading)',...style}}>
    {children}
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      style={{transition:'var(--dur-fast)',transform:h?'translateX(4px)':'none'}}><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
  </a>;
}
