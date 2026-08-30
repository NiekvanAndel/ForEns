import React from 'react';
import { Icon } from '../brand/Icon.jsx';

/* The tab bar is liquid glass: a translucent tint over a blurred, saturated backdrop.
   appearance="light" (default) | "dark" (iOS Dark Mode) | "opaque" (Reduce Transparency). */
const materials={
  light:{background:'var(--glass-tint)',backdropFilter:'var(--glass-blur)',border:'1px solid var(--glass-edge)',
    boxShadow:'var(--glass-shadow), inset 0 1px 0 var(--glass-hairline)',
    capsule:'var(--glass-capsule)',idle:'var(--app-tab-idle)',accent:'var(--app-accent)'},
  dark:{background:'var(--glass-tint-dark)',backdropFilter:'var(--glass-blur)',border:'1px solid var(--glass-edge-dark)',
    boxShadow:'var(--glass-shadow), inset 0 1px 0 var(--glass-hairline-dark)',
    capsule:'var(--glass-capsule-dark)',idle:'var(--app-tab-idle-dark)',accent:'var(--app-accent-dark)'},
  opaque:{background:'var(--glass-tint-opaque)',backdropFilter:'none',border:'1px solid var(--glass-edge)',
    boxShadow:'var(--glass-shadow)',capsule:'var(--cream-2)',idle:'var(--app-tab-idle-current)',accent:'var(--app-accent-current)'}
};

export function TabBar({items=[],active=0,onChange,appearance='system',style}){
  /* appearance="system" follows the iOS setting through --app-accent-current /
     --app-tab-idle-current; "light"/"dark" pin the material explicitly. */
  const m=appearance==='system'
    ?{...materials.light,idle:'var(--app-tab-idle-current)',accent:'var(--app-accent-current)'}
    :(materials[appearance]||materials.light);
  return <div style={{display:'flex',alignItems:'center',gap:'2px',borderRadius:'var(--radius-pill)',padding:'8px 10px',
    background:m.background,backdropFilter:m.backdropFilter,WebkitBackdropFilter:m.backdropFilter,
    border:m.border,boxShadow:m.boxShadow,...style}}>
    {items.map((it,i)=>{const on=i===active;return (
      <button key={i} onClick={()=>onChange&&onChange(i)} style={{flex:1,background:on?m.capsule:'transparent',
        border:0,cursor:'pointer',borderRadius:'var(--radius-pill)',padding:'8px 4px 6px',display:'flex',flexDirection:'column',
        alignItems:'center',gap:'3px',color:on?m.accent:m.idle,fontFamily:'var(--font-core)',
        boxShadow:on&&appearance!=='opaque'?'0 2px 8px -4px rgba(9,28,61,.35)':'none',transition:'var(--dur-fast)'}}>
        <Icon name={it.icon} size={24} weight={on?'fill':'regular'}/>
        <span style={{fontSize:'12px',fontWeight:on?'var(--fw-semibold)':'var(--fw-medium)'}}>{it.label}</span>
      </button>);})}
  </div>;
}
