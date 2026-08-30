import React from 'react';
export function StatTile({value,label,style}){
  return <div style={{background:'var(--cream-2)',borderRadius:'var(--radius-tile)',padding:'16px 14px',textAlign:'center',...style}}>
    <b style={{display:'block',fontSize:'var(--fs-stat)',fontWeight:'var(--fw-bold)',color:'var(--green-dark)',lineHeight:1.15}}>{value}</b>
    <span style={{display:'block',fontSize:'var(--fs-caption)',color:'var(--muted)',lineHeight:1.35,marginTop:'4px'}}>{label}</span>
  </div>;
}
