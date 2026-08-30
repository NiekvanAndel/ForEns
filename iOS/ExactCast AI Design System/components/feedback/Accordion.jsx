import React from 'react';
export function Accordion({items=[],style}){
  const [open,setOpen]=React.useState(-1);
  return <div style={style}>{items.map((it,i)=>{const isOpen=open===i;return (
    <div key={i} style={{background:'#fff',borderRadius:'var(--radius-tile)',boxShadow:'var(--shadow-card)',marginBottom:'12px',overflow:'hidden'}}>
      <button onClick={()=>setOpen(isOpen?-1:i)} style={{width:'100%',background:'none',border:0,cursor:'pointer',textAlign:'left',
        padding:'18px 22px',fontFamily:'var(--font-core)',fontWeight:'var(--fw-semibold)',color:'var(--ink-heading)',fontSize:'16.5px',
        display:'flex',justifyContent:'space-between',gap:'16px',alignItems:'center'}}>
        {it.q}<span style={{fontSize:'22px',color:'var(--green-dark)',fontWeight:'var(--fw-regular)',lineHeight:1}}>{isOpen?'–':'+'}</span>
      </button>
      {isOpen?<div style={{padding:'0 22px 20px',fontSize:'15.5px',color:'var(--muted)',lineHeight:1.7}}>{it.a}</div>:null}
    </div>);})}</div>;
}
