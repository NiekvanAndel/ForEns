import React from 'react';
export function ResultRow({label,value,highlight,last,style}){
  return <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',gap:'16px',padding:'13px 0',
    borderBottom:last?0:'1px solid var(--rule-on-navy)',...style}}>
    <span style={{fontSize:'var(--fs-ui)',color:'var(--on-navy-soft)'}}>{label}</span>
    <b style={{fontSize:highlight?'22px':'var(--fs-h4)',fontWeight:'var(--fw-bold)',color:highlight?'var(--green)':'#fff',whiteSpace:'nowrap'}}>{value}</b>
  </div>;
}
