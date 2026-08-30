import React from 'react';
export function SiteFooter({columns=[],legal=[],copyright='© ExactCast AI',style}){
  return <footer style={{background:'var(--navy-panel)',color:'#fff',padding:'64px 0 28px',...style}}>
    <div style={{maxWidth:'var(--max-width)',margin:'0 auto',padding:'0 var(--gutter)'}}>
      <div style={{display:'grid',gridTemplateColumns:'1.2fr 1fr 1fr 1.2fr',gap:'36px'}}>
        {columns.map((c,i)=><div key={i}>
          <h4 style={{color:'var(--green)',fontSize:'15px',margin:'0 0 16px',fontWeight:'var(--fw-semibold)',fontFamily:'var(--font-core)'}}>{c.title}</h4>
          {c.body?<p style={{color:'var(--on-navy-soft)',fontSize:'var(--fs-ui)',lineHeight:2,margin:0}}>{c.body}</p>:null}
          {c.links?<ul style={{listStyle:'none',margin:0,padding:0}}>{c.links.map(l=><li key={l}>
            <a href="#" style={{color:'var(--on-navy-soft)',textDecoration:'none',fontSize:'var(--fs-ui)',lineHeight:2}}>{l}</a></li>)}</ul>:null}
        </div>)}
      </div>
      <div style={{borderTop:'1px solid var(--rule-on-navy)',marginTop:'40px',paddingTop:'20px',fontSize:'13px',
        color:'var(--on-navy-faint)',display:'flex',gap:'22px',flexWrap:'wrap'}}>
        <span>{copyright}</span>{legal.map(l=><a key={l} href="#" style={{color:'var(--on-navy-faint)',textDecoration:'none'}}>{l}</a>)}
      </div>
    </div>
  </footer>;
}
