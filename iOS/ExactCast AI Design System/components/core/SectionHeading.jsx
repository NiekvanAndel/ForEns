import React from 'react';
import { Eyebrow } from './Eyebrow.jsx';
export function SectionHeading({eyebrow,title,lead,center,tone='dark',maxWidth='760px',style}){
  return <div style={{maxWidth,margin:center?'0 auto':undefined,textAlign:center?'center':'left',...style}}>
    {eyebrow?<Eyebrow tone={tone==='light'?'light':'green'}>{eyebrow}</Eyebrow>:null}
    <h2 style={{margin:0,fontFamily:'var(--font-core)',fontSize:'var(--fs-h2)',lineHeight:'var(--lh-h2)',fontWeight:'var(--fw-semibold)',color:tone==='light'?'#fff':'var(--ink-heading)'}}>{title}</h2>
    {lead?<p style={{marginTop:'14px',marginBottom:0,fontSize:'var(--fs-lead)',lineHeight:'var(--lh-lead)',color:tone==='light'?'var(--on-navy-body)':'var(--muted)'}}>{lead}</p>:null}
  </div>;
}
