import React from 'react';
export function PlanCard({name,amount,per,features=[],best,tag='Meest gekozen',cta,style}){
  return <div style={{background:'#fff',borderRadius:'var(--radius-card)',boxShadow:'var(--shadow-card)',padding:'26px',position:'relative',
    outline:best?'2px solid var(--green)':'none',...style}}>
    {best?<span style={{position:'absolute',top:'-12px',left:'26px',background:'var(--gradient-primary)',color:'#fff',fontSize:'12px',
      fontWeight:'var(--fw-bold)',padding:'4px 12px',borderRadius:'var(--radius-pill)',fontFamily:'var(--font-core)'}}>{tag}</span>:null}
    <h3 style={{margin:0,fontFamily:'var(--font-core)',fontSize:'19px',fontWeight:'var(--fw-semibold)',color:'var(--ink-heading)'}}>{name}</h3>
    <div style={{fontSize:'var(--fs-metric)',fontWeight:'var(--fw-bold)',color:'var(--ink-heading)',margin:'10px 0 2px',lineHeight:1}}>{amount}</div>
    <div style={{fontSize:'var(--fs-meta)',color:'var(--muted)',marginBottom:'16px'}}>{per}</div>
    <ul style={{listStyle:'none',margin:0,padding:0,fontSize:'var(--fs-body-sm)',color:'var(--muted)',lineHeight:2}}>
      {features.map(x=><li key={x}><span style={{color:'var(--green-dark)',fontWeight:'var(--fw-bold)'}}>✓ </span>{x}</li>)}
    </ul>
    {cta?<div style={{marginTop:'18px'}}>{cta}</div>:null}
  </div>;
}
