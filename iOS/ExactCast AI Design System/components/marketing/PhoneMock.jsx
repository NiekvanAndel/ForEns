import React from 'react';
export function PhoneMock({children,width=236,small,title,time='20:52',style}){
  return <div style={{width:(small?196:width)+'px',background:'#0d1b2e',borderRadius:'var(--radius-phone)',padding:'9px',
    boxShadow:'var(--shadow-phone)',opacity:small?.9:1,transform:small?'translateY(22px)':'none',...style}}>
    <div style={{background:'var(--cream)',borderRadius:'var(--radius-screen)',overflow:'hidden'}}>
      <div style={{background:'var(--navy-panel)',color:'#fff',padding:'10px 14px',fontSize:'11px',display:'flex',
        justifyContent:'space-between',alignItems:'center',fontFamily:'var(--font-core)'}}><span>{time}</span><span>{title}</span></div>
      <div style={{padding:'12px 12px 16px'}}>{children}</div>
    </div>
  </div>;
}
