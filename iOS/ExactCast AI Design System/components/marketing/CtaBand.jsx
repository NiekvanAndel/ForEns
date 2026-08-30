import React from 'react';
export function CtaBand({title,body,children,bullets,style}){
  return <div style={{background:'var(--gradient-band)',borderRadius:'var(--radius-band)',padding:'56px',display:'grid',
    gridTemplateColumns:bullets?'1fr 1fr':'1fr',gap:'40px',alignItems:'center',color:'#fff',...style}}>
    <div>
      <h2 style={{margin:'0 0 14px',fontFamily:'var(--font-core)',fontSize:'var(--fs-h2)',lineHeight:'var(--lh-h2)',fontWeight:'var(--fw-semibold)',color:'#fff'}}>{title}</h2>
      <p style={{color:'rgba(255,255,255,.9)',fontSize:'var(--fs-lead)',lineHeight:1.6,margin:'0 0 24px'}}>{body}</p>
      <div style={{display:'flex',gap:'12px',flexWrap:'wrap'}}>{children}</div>
    </div>
    {bullets?<ul style={{margin:0,paddingLeft:'20px',color:'rgba(255,255,255,.92)',fontSize:'15.5px',lineHeight:1.9}}>
      {bullets.map(b=><li key={b}>{b}</li>)}</ul>:null}
  </div>;
}
