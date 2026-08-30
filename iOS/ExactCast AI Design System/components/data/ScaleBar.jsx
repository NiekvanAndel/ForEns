import React from 'react';
export function ScaleBar({segments=[{tone:'dry'},{tone:'light'},{tone:'heavy'}],scale=[],legend=[],style}){
  const c={dry:'var(--status-dry)',light:'var(--status-light)',heavy:'var(--status-heavy)',green:'var(--status-dry)',amber:'var(--status-light)',red:'var(--status-heavy)'};
  return <div style={style}>
    <div style={{height:'22px',borderRadius:'11px',overflow:'hidden',display:'flex'}}>
      {segments.map((s,i)=><i key={i} style={{flex:s.flex||1,background:c[s.tone]}}/>)}
    </div>
    {scale.length?<div style={{display:'flex',justifyContent:'space-between',fontSize:'var(--fs-caption)',color:'var(--muted)',marginTop:'10px'}}>{scale.map((t,i)=><span key={i}>{t}</span>)}</div>:null}
    {legend.length?<div style={{display:'grid',gridTemplateColumns:'repeat('+legend.length+',1fr)',gap:'18px',marginTop:'20px'}}>
      {legend.map((l,i)=><div key={i} style={{fontSize:'var(--fs-ui)',color:'var(--muted)',lineHeight:1.6}}>
        <b style={{display:'block',color:'var(--ink-heading)',marginBottom:'3px'}}>{l.title}</b>{l.body}</div>)}
    </div>:null}
  </div>;
}
