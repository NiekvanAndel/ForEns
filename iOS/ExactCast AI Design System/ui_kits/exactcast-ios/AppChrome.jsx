const { Icon } = window.ExactCastAIDesignSystem_6b62ae;

function StatusBar({time='22:21',dark}){
  return <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'14px 26px 2px',
    fontFamily:'var(--font-core)',fontSize:'15px',fontWeight:600,color:dark?'#fff':'var(--ink-heading)'}}>
    <span style={{display:'flex',alignItems:'center',gap:'5px'}}>{time}<Icon name="moon" size={13} weight="fill"/></span>
    <span style={{display:'flex',alignItems:'center',gap:'6px'}}>
      <Icon name="cell-signal-full" size={15}/><Icon name="wifi-high" size={15}/>
      <span style={{border:'1.4px solid currentColor',borderRadius:'4px',padding:'1px 3px',fontSize:'10px',fontWeight:700}}>36</span>
    </span>
  </div>;
}

/* One bar on every screen: saved-location pills, a search field, and the settings button.
   A station-backed location shows its name in AgroExact green; a plain address stays navy. */
function LocationBar({locations,active,onPick,onSettings,onSearch,query,onQuery,searching,onCloseSearch}){
  if(searching) return <div style={{padding:'6px 16px 12px',display:'flex',gap:'10px',alignItems:'center'}}>
    <div style={{flex:1,minWidth:0,display:'flex',alignItems:'center',gap:'8px',background:'#fff',borderRadius:'var(--radius-pill)',
      padding:'12px 16px',boxShadow:'var(--shadow-card)'}}>
      <span style={{color:'var(--muted)'}}><Icon name="magnifying-glass" size={18}/></span>
      <input autoFocus value={query} onChange={e=>onQuery(e.target.value)} placeholder="Plaats of postcode"
        style={{flex:1,border:0,outline:0,fontFamily:'var(--font-core)',fontSize:'var(--fs-body)',color:'var(--ink-heading)',background:'transparent'}}/>
    </div>
    <button onClick={onCloseSearch} style={{border:0,background:'none',cursor:'pointer',fontFamily:'var(--font-core)',
      fontSize:'var(--fs-body)',fontWeight:600,color:'var(--accent-dark)'}}>Klaar</button>
  </div>;
  return <div style={{padding:'6px 16px 12px',display:'flex',gap:'8px',alignItems:'center'}}>
    <div style={{flex:1,minWidth:0,display:'flex',gap:'8px',overflowX:'auto',scrollbarWidth:'none'}}>
      {locations.map((l,i)=>{const on=i===active;return (
        <button key={l.name} onClick={()=>onPick(i)} style={{flex:'0 0 auto',border:0,cursor:'pointer',
          borderRadius:'var(--radius-pill)',padding:'11px 18px',fontFamily:'var(--font-core)',fontSize:'var(--fs-body-sm)',
          fontWeight:700,background:on?'#fff':'rgba(255,255,255,.55)',
          color:on?(l.station?'var(--agro-ink)':'var(--ink-heading)'):'var(--muted)',
          boxShadow:on?'var(--shadow-card)':'none',display:'flex',alignItems:'center',gap:'7px',
          transition:'var(--dur-fast)',whiteSpace:'nowrap'}}>
          {l.station?<i style={{width:'8px',height:'8px',borderRadius:'50%',background:'var(--agro-bright)',flex:'0 0 8px'}}/>:null}
          {l.name}</button>);})}
    </div>
    <button onClick={onSearch} aria-label="Locatie zoeken" style={{width:'42px',height:'42px',flex:'0 0 42px',borderRadius:'var(--radius-pill)',
      border:0,cursor:'pointer',background:'var(--gradient-primary)',color:'#fff',display:'grid',placeItems:'center',boxShadow:'var(--shadow-card)'}}>
      <Icon name="magnifying-glass" size={19}/></button>
    <button onClick={onSettings} aria-label="Instellingen" style={{width:'42px',height:'42px',flex:'0 0 42px',borderRadius:'var(--radius-pill)',
      border:0,cursor:'pointer',background:'#fff',color:'var(--ink-heading)',display:'grid',placeItems:'center',boxShadow:'var(--shadow-card)'}}>
      <Icon name="gear-six" size={19}/></button>
  </div>;
}

/* Weather condition glyph — Phosphor fill, tinted by daylight not by severity. */
const CONDITION={clear:'sun',night:'moon-stars',cloudy:'cloud','partly-cloudy':'cloud-sun',rain:'cloud-rain',
  drizzle:'cloud-rain',showers:'cloud-rain',storm:'cloud-lightning',wind:'wind',fog:'cloud-fog'};
function WeatherIcon({cond,size=34,style}){
  return <span style={{color:cond==='clear'?'var(--val-sun)':cond==='night'?'var(--accent)':'var(--muted)',...style}}>
    <Icon name={CONDITION[cond]||'cloud'} size={size} weight="fill"/></span>;
}

function CardHeader({icon,label,action,onAction}){
  return <div style={{display:'flex',alignItems:'center',gap:'8px',padding:'2px 2px 12px'}}>
    {icon?<span style={{color:'var(--muted)'}}><Icon name={icon} size={16}/></span>:null}
    <span style={{fontSize:'var(--fs-eyebrow)',fontWeight:700,letterSpacing:'var(--ls-eyebrow)',textTransform:'uppercase',color:'var(--muted)'}}>{label}</span>
    {action?<button onClick={onAction} style={{marginLeft:'auto',border:0,background:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:'3px',
      fontFamily:'var(--font-core)',fontSize:'var(--fs-label)',fontWeight:600,color:'var(--accent-dark)'}}>
      {action}<Icon name="caret-right" size={13}/></button>:null}
  </div>;
}

/* Arrow that points where the wind is going, from a compass bearing. */
function WindArrow({deg=0,size=15,style}){
  return <span style={{display:'inline-block',transform:'rotate('+deg+'deg)',color:'var(--ink-heading)',...style}}>
    <Icon name="arrow-up" size={size}/></span>;
}

Object.assign(window,{StatusBar,LocationBar,WeatherIcon,CardHeader,WindArrow,CONDITION});
