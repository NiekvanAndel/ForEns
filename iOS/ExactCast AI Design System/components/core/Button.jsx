import React from 'react';

const base={display:'inline-flex',alignItems:'center',justifyContent:'center',gap:'8px',borderRadius:'var(--radius-pill)',fontFamily:'var(--font-core)',fontWeight:'var(--fw-semibold)',fontSize:'var(--fs-body)',lineHeight:1,textDecoration:'none',border:0,cursor:'pointer',whiteSpace:'nowrap',transition:'var(--dur-fast)'};

const variants={
  primary:{background:'var(--gradient-primary)',color:'#fff'},
  ghost:{background:'transparent',color:'#fff',border:'var(--border-width-ghost) solid var(--border-on-navy)'},
  'ghost-dark':{background:'transparent',color:'var(--ink-heading)',border:'var(--border-width-ghost) solid var(--border-ghost)'},
  white:{background:'#fff',color:'var(--green-dark)'}
};
const hovers={
  primary:{filter:'var(--brighten-hover)',transform:'var(--lift-hover)'},
  ghost:{borderColor:'var(--border-on-navy-hover)'},
  'ghost-dark':{borderColor:'var(--border-ghost-hover)'},
  white:{filter:'var(--brighten-hover)',transform:'var(--lift-hover)'}
};

export function Button({variant='primary',size='md',href,children,icon,disabled,full,onClick,style}){
  const [hover,setHover]=React.useState(false);
  const Tag=href?'a':'button';
  const s={...base,...variants[variant],
    padding:size==='sm'?'var(--btn-pad-sm)':'var(--btn-pad)',
    width:full?'100%':undefined,
    opacity:disabled?.45:1,
    pointerEvents:disabled?'none':undefined,
    ...(hover&&!disabled?hovers[variant]:null),...style};
  return <Tag href={href} onClick={onClick} disabled={Tag==='button'?disabled:undefined} style={s}
    onMouseEnter={()=>setHover(true)} onMouseLeave={()=>setHover(false)}>{children}{icon}</Tag>;
}
