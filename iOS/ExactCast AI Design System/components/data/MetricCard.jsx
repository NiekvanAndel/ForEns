import React from 'react';
export function MetricCard({label,value,unit,footnote,tone='default',onClick,style}){
  const colors={default:'var(--app-value)',cool:'var(--app-value-cool)',warm:'var(--app-value-warm)',empty:'var(--muted)'};
  return <div onClick={onClick} style={{background:'var(--app-card)',borderRadius:'var(--radius-app-card)',boxShadow:'var(--shadow-card)',
    padding:'18px 16px 14px',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'space-between',
    gap:'10px',minHeight:'150px',cursor:onClick?'pointer':'default',...style}}>
    <div style={{fontFamily:'var(--font-core)',fontSize:'var(--fs-body)',fontWeight:'var(--fw-bold)',color:'var(--ink-heading)',lineHeight:1.3}}>{label}</div>
    <div style={{display:'flex',alignItems:'baseline',gap:'4px',fontFamily:'var(--font-numeric)'}}>
      <span style={{fontSize:value==='–'?'32px':'var(--fs-metric-app)',fontWeight:'var(--fw-bold)',color:value==='–'?'var(--muted)':colors[tone],lineHeight:1}}>{value}</span>
      {unit?<span style={{fontSize:'var(--fs-body)',fontWeight:'var(--fw-semibold)',color:'var(--muted)'}}>{unit}</span>:null}
    </div>
    <div style={{fontSize:'var(--fs-body-sm)',color:'var(--muted)'}}>{footnote}</div>
  </div>;
}
