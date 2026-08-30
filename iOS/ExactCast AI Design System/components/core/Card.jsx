import React from 'react';
export function Card({children,pad='var(--card-pad)',radius='var(--radius-card)',alt,style}){
  return <div style={{background:alt?'var(--cream-2)':'var(--white)',borderRadius:radius,boxShadow:alt?'none':'var(--shadow-card)',padding:pad,...style}}>{children}</div>;
}
