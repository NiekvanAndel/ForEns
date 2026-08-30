import React from 'react';
/* Icon set = Phosphor Icons, the closest CDN match to standard iOS SF Symbols:
   rounded caps, even optical weight, and a filled twin for selected states —
   the same regular/filled pairing iOS uses in tab bars.
   Lucide is kept only for the marketing site, whose source markup embeds
   verbatim Lucide paths (arrow-right, phone). Nothing here is hand-drawn. */
const PHOSPHOR='https://unpkg.com/@phosphor-icons/core@2.1.1/assets/';
const LUCIDE='https://unpkg.com/lucide-static@0.544.0/icons/';

function url(name,set,weight){
  if(set==='lucide') return LUCIDE+name+'.svg';
  const w=weight||'regular';
  return PHOSPHOR+w+'/'+name+(w==='regular'?'':'-'+w)+'.svg';
}

export function Icon({name,size=20,set='phosphor',weight='regular',style}){
  const u=url(name,set,weight);
  return <span aria-hidden="true" style={{display:'inline-block',width:size+'px',height:size+'px',flex:'0 0 auto',
    background:'currentColor',WebkitMaskImage:'url('+u+')',maskImage:'url('+u+')',
    WebkitMaskRepeat:'no-repeat',maskRepeat:'no-repeat',WebkitMaskPosition:'center',maskPosition:'center',
    WebkitMaskSize:'contain',maskSize:'contain',...style}}/>;
}
