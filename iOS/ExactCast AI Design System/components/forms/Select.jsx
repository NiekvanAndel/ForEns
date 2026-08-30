import React from 'react';
export function Select({value,onChange,options=[],style,...rest}){
  const [focus,setFocus]=React.useState(false);
  return <select value={value} onChange={onChange} onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)} {...rest}
    style={{width:'100%',padding:'11px 13px',border:'var(--border-width-field) solid '+(focus?'var(--green)':'var(--border-field)'),
      borderRadius:'var(--radius-field)',fontFamily:'var(--font-core)',fontSize:'var(--fs-body-sm)',color:'var(--ink-heading)',
      background:'#fff',outline:0,boxShadow:focus?'0 0 0 3px var(--green-focus-ring)':'none',...style}}>
    {options.map(o=>{const v=typeof o==='string'?o:o.value,l=typeof o==='string'?o:o.label;return <option key={v} value={v}>{l}</option>;})}
  </select>;
}
