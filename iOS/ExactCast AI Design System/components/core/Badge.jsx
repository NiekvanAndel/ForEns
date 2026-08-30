import React from 'react';
const tones={
  green:{background:'var(--gradient-primary)',color:'#fff'},
  amber:{background:'var(--status-amber-tint)',color:'var(--status-amber-ink)'},
  navy:{background:'var(--navy-panel)',color:'#fff'}
};
export function Badge({children,tone='green',square,style}){
  return <span style={{display:'inline-block',borderRadius:square?'6px':'var(--radius-pill)',padding:square?'1px 7px':'4px 12px',fontFamily:'var(--font-core)',fontSize:square?'var(--fs-tag)':'12px',fontWeight:'var(--fw-bold)',letterSpacing:square?'.02em':undefined,lineHeight:1.45,...tones[tone],...style}}>{children}</span>;
}
