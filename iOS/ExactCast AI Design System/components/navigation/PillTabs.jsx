import React from 'react';
export function PillTabs({items=[],active=0,onChange,scroll=true,style}){
  return <div style={{display:'flex',gap:'10px',overflowX:scroll?'auto':'visible',paddingBottom:'2px',scrollbarWidth:'none',...style}}>
    {items.map((it,i)=>{const on=i===active;return (
      <button key={i} onClick={()=>onChange&&onChange(i)} style={{flex:'0 0 auto',border:0,cursor:'pointer',
        borderRadius:'var(--radius-pill)',padding:'14px 22px',fontFamily:'var(--font-core)',fontSize:'var(--fs-body)',
        fontWeight:'var(--fw-bold)',background:on?'var(--navy-panel)':'var(--cream-2)',color:on?'#fff':'var(--ink-heading)',
        transition:'var(--dur-fast)',whiteSpace:'nowrap'}}>{it}</button>);})}
  </div>;
}
