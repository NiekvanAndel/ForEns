import React from 'react';
import { Wordmark } from '../brand/Wordmark.jsx';
import { Button } from '../core/Button.jsx';
import { Icon } from '../brand/Icon.jsx';
export function SiteHeader({links=[],active,phone,cta,onNav,style}){
  return <header style={{position:'absolute',inset:'0 0 auto 0',height:'var(--header-h)',zIndex:60,
    background:'var(--navy-scrim)',backdropFilter:'var(--blur-header)',WebkitBackdropFilter:'var(--blur-header)',...style}}>
    <div style={{maxWidth:'var(--max-width)',margin:'0 auto',padding:'0 var(--gutter)',height:'var(--header-h)',display:'flex',alignItems:'center',gap:'24px'}}>
      <a href="#" onClick={e=>{e.preventDefault();onNav&&onNav('home');}} style={{textDecoration:'none'}}><Wordmark pill size={19}/></a>
      <nav style={{display:'flex',gap:'20px',marginLeft:'auto',alignItems:'center'}}>
        {links.map(l=><a key={l} href="#" onClick={e=>{e.preventDefault();onNav&&onNav(l);}}
          style={{color:'#fff',fontSize:'var(--fs-nav)',textDecoration:'none',opacity:l===active?1:.92,whiteSpace:'nowrap',
            borderBottom:l===active?'2px solid var(--green)':'0',paddingBottom:l===active?'3px':0}}>{l}</a>)}
      </nav>
      {phone?<a href={'tel:'+phone.replace(/\s/g,'')} style={{display:'flex',alignItems:'center',gap:'6px',color:'#fff',textDecoration:'none',fontWeight:'var(--fw-semibold)',fontSize:'15px',opacity:.92,whiteSpace:'nowrap'}}>
        <Icon name="phone" set="lucide" size={17}/>{phone}</a>:null}
      {cta?<Button size="sm" href="#">{cta}</Button>:null}
    </div>
  </header>;
}
