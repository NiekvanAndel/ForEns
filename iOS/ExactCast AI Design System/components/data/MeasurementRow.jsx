import React from 'react';
import { StatusDot } from './StatusDot.jsx';
const advColor={dry:'var(--status-dry-ink)',light:'var(--status-light-ink)',heavy:'var(--status-heavy-ink)'};
const alias={dry:'dry',light:'light',heavy:'heavy',green:'dry',amber:'light',red:'heavy'};
export function MeasurementRow({status='dry',name,meta,advice,compact,style}){
  const key=alias[status]||'dry';
  const s=compact?{fs:11,ms:10,as:11,pad:'9px 10px',r:'11px',dot:12}:{fs:15,ms:13,as:14.5,pad:'12px 14px',r:'var(--radius-tile)',dot:14};
  return <div style={{display:'flex',alignItems:'center',gap:'10px',padding:s.pad,borderRadius:s.r,background:'#F6F8FA',...style}}>
    <StatusDot status={status} size={s.dot}/>
    <div>
      <div style={{fontSize:s.fs+'px',fontWeight:'var(--fw-semibold)',color:'var(--ink-heading)',lineHeight:1.25}}>{name}</div>
      {meta?<div style={{fontSize:s.ms+'px',color:'var(--muted)'}}>{meta}</div>:null}
    </div>
    {advice?<div style={{marginLeft:'auto',fontSize:s.as+'px',fontWeight:'var(--fw-bold)',color:advColor[key],whiteSpace:'nowrap'}}>{advice}</div>:null}
  </div>;
}
