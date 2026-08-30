import React from 'react';
export function Input({value,onChange,placeholder,type='text',size='md',invalid,style,...rest}){
  const [focus,setFocus]=React.useState(false);
  return <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    onFocus={()=>setFocus(true)} onBlur={()=>setFocus(false)} {...rest}
    style={{width:'100%',padding:size==='sm'?'10px 12px':size==='md'?'11px 13px':'var(--field-pad)',
      border:'var(--border-width-field) solid '+(invalid?'var(--status-red)':focus?'var(--green)':'var(--border-field)'),
      borderRadius:size==='sm'?'9px':'var(--radius-field)',fontFamily:'var(--font-core)',
      fontSize:size==='lg'?'var(--fs-body)':size==='sm'?'var(--fs-ui)':'var(--fs-body-sm)',
      color:'var(--ink-heading)',background:'#fff',outline:0,
      boxShadow:focus?'0 0 0 3px var(--green-focus-ring)':'none',...style}}/>;
}
