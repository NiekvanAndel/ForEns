import React from 'react';
import { Badge } from '../core/Badge.jsx';
export function Testimonial({meta,quote,who,result,todo,style}){
  return <div style={{background:'#fff',borderRadius:'var(--radius-card)',boxShadow:'var(--shadow-card)',padding:'var(--card-pad)',...style}}>
    {meta?<div style={{fontSize:'var(--fs-caption)',color:'var(--green-dark)',fontWeight:'var(--fw-semibold)',marginBottom:'10px',lineHeight:1.5}}>
      {meta} {todo?<Badge tone="amber" square>{todo}</Badge>:null}</div>:null}
    <q style={{display:'block',fontSize:'15.5px',color:'var(--ink-heading)',lineHeight:1.6,fontStyle:'italic'}}>{quote}</q>
    <div style={{marginTop:'14px',fontSize:'var(--fs-label)',fontWeight:'var(--fw-semibold)',color:'var(--ink-heading)'}}>{who}</div>
    {result?<div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid var(--hairline)',fontSize:'var(--fs-label)',color:'var(--muted)'}}>
      <b style={{color:'var(--green-dark)'}}>Resultaat:</b> {result}</div>:null}
  </div>;
}
