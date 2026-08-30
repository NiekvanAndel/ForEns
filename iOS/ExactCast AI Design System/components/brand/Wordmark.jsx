import React from 'react';
/* No logo file was supplied with the source material, so the brand is set in type.
   The accent is deliberately the cool precipitation blue, NOT the agricultural green:
   ExactCast is a consumer rain app, and green reads as farming.
   Replace this component's internals the moment a real mark lands in assets/. */
export function Wordmark({tone='navy',size=20,pill,style}){
  const light=tone==='light';
  const color=light?'#fff':'var(--ink-heading)';
  const accent=light?'var(--app-accent-dark)':'var(--app-accent)';
  const inner=(c,a)=><span style={{fontFamily:'var(--font-core)',fontSize:size+'px',lineHeight:1,letterSpacing:'-.015em',color:c,whiteSpace:'nowrap'}}>
    <strong style={{fontWeight:'var(--fw-black)'}}>Exact</strong><span style={{fontWeight:'var(--fw-medium)'}}>Cast</span>
    <span style={{color:a,fontWeight:'var(--fw-black)'}}> AI</span></span>;
  if(!pill) return <span style={style}>{inner(color,accent)}</span>;
  return <span style={{background:'#fff',borderRadius:'var(--radius-pill)',padding:'8px 18px',display:'inline-flex',alignItems:'center',...style}}>
    {inner('var(--ink-heading)','var(--app-accent)')}</span>;
}
