import React from 'react';
export function MeterBar({leftLabel,rightLabel,pct=50,tone='save',onNavy=true,style}){
  return <div style={style}>
    {(leftLabel||rightLabel)?<div style={{display:'flex',justifyContent:'space-between',fontSize:'var(--fs-caption)',color:onNavy?'var(--on-navy-muted)':'var(--muted)',marginBottom:'5px'}}><span>{leftLabel}</span><span>{rightLabel}</span></div>:null}
    <div style={{height:'14px',borderRadius:'7px',background:onNavy?'var(--track-on-navy)':'rgba(12,37,71,.09)',overflow:'hidden'}}>
      <i style={{display:'block',height:'100%',width:Math.max(0,Math.min(100,pct))+'%',borderRadius:'7px',
        background:tone==='save'?'linear-gradient(90deg,var(--green),var(--green-dark))':onNavy?'var(--fill-on-navy)':'var(--ink-disabled)'}}/>
    </div>
  </div>;
}
