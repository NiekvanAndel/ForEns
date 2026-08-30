const { Card, Icon, Button } = window.ExactCastAIDesignSystem_6b62ae;

function Group({label,children}){
  return <div>
    <div style={{fontSize:'var(--fs-eyebrow)',fontWeight:700,letterSpacing:'var(--ls-eyebrow)',textTransform:'uppercase',
      color:'var(--muted)',padding:'0 6px 8px'}}>{label}</div>
    <Card radius="var(--radius-app-card)" pad="0" style={{overflow:'hidden'}}>{children}</Card></div>;
}

function Row({icon,label,hint,children,last}){
  return <div style={{display:'flex',alignItems:'center',gap:'12px',padding:'14px 16px',
    borderBottom:last?0:'1px solid var(--hairline-soft)'}}>
    {icon?<span style={{color:'var(--muted)',flex:'0 0 20px'}}><Icon name={icon} size={20}/></span>:null}
    <div style={{minWidth:0}}>
      <div style={{fontSize:'var(--fs-body-sm)',fontWeight:600,color:'var(--ink-heading)'}}>{label}</div>
      {hint?<div style={{fontSize:'var(--fs-caption)',color:'var(--muted)',lineHeight:1.45,marginTop:'2px'}}>{hint}</div>:null}
    </div>
    <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'8px',flex:'0 0 auto'}}>{children}</div>
  </div>;
}

function Segmented({options,value,onChange,compact}){
  return <div style={{display:'flex',gap:'3px',background:'var(--cream-2)',borderRadius:'var(--radius-pill)',padding:'3px'}}>
    {options.map(o=>{const on=o===value;return <button key={o} onClick={()=>onChange(o)} style={{border:0,cursor:'pointer',
      borderRadius:'var(--radius-pill)',padding:compact?'6px 11px':'7px 14px',fontFamily:'var(--font-core)',
      fontSize:compact?'12.5px':'var(--fs-label)',fontWeight:600,transition:'var(--dur-fast)',whiteSpace:'nowrap',
      background:on?'#fff':'transparent',color:on?'var(--accent-dark)':'var(--muted)',
      boxShadow:on?'0 2px 8px -4px rgba(9,28,61,.3)':'none'}}>{o}</button>;})}
  </div>;
}

function Toggle({on,onChange}){
  return <button onClick={()=>onChange(!on)} role="switch" aria-checked={on} style={{width:'50px',height:'30px',borderRadius:'var(--radius-pill)',
    border:0,cursor:'pointer',padding:'3px',background:on?'var(--gradient-primary)':'rgba(12,37,71,.18)',
    display:'flex',justifyContent:on?'flex-end':'flex-start',transition:'var(--dur-fast)'}}>
    <i style={{width:'24px',height:'24px',borderRadius:'50%',background:'#fff',boxShadow:'var(--shadow-float)',display:'block'}}/></button>;
}

function SettingsScreen({state,set,locations,onReorder,onRemove,onAddLocation}){
  return <div style={{padding:'0 16px 130px',display:'grid',gridTemplateColumns:'minmax(0,1fr)',gap:'18px'}}>
    <Group label="Weergave">
      <Row icon="translate" label="Taal" hint="Overschrijft de systeemtaal van je telefoon">
        <Segmented compact options={['NL','DE','EN']} value={state.lang} onChange={v=>set('lang',v)}/></Row>
      <Row icon="text-aa" label="Tekstgrootte" hint="Overschrijft de systeeminstelling">
        <Segmented compact options={['A','A+','A++']} value={state.fontSize} onChange={v=>set('fontSize',v)}/></Row>
      <Row icon="circle-half" label="Thema" hint="Automatisch volgt de instelling van iOS" last>
        <Segmented compact options={['Licht','Donker','Auto']} value={state.theme} onChange={v=>set('theme',v)}/></Row>
    </Group>

    <Group label="Mijn locaties">
      {locations.map((l,i)=><Row key={l.name} icon="dots-six-vertical"
        label={<span style={{color:l.station?'var(--agro-ink)':'var(--ink-heading)'}}>{l.name}</span>}
        hint={l.source} last={i===locations.length-1}>
        <button onClick={()=>onReorder(i,-1)} disabled={i===0} aria-label="Omhoog" style={{border:0,background:'none',cursor:'pointer',
          color:i===0?'var(--ink-disabled)':'var(--muted)',display:'grid',placeItems:'center'}}><Icon name="arrow-up" size={17}/></button>
        <button onClick={()=>onReorder(i,1)} disabled={i===locations.length-1} aria-label="Omlaag" style={{border:0,background:'none',cursor:'pointer',
          color:i===locations.length-1?'var(--ink-disabled)':'var(--muted)',display:'grid',placeItems:'center'}}><Icon name="arrow-down" size={17}/></button>
        <button onClick={()=>onRemove(i)} aria-label="Verwijderen" style={{border:0,background:'none',cursor:'pointer',
          color:'var(--status-red)',display:'grid',placeItems:'center'}}><Icon name="trash" size={17}/></button>
      </Row>)}
      <div style={{padding:'14px 16px',borderTop:'1px solid var(--hairline-soft)'}}>
        <Button size="sm" onClick={onAddLocation}>Locatie toevoegen</Button></div>
    </Group>

    <Group label="Integraties">
      <Row icon="plugs-connected"
        label={<span>Verbinden met <b style={{color:'var(--agro-ink)'}}>AgroExact</b></span>}
        hint={state.agro?'Verbonden · 2 eigen stations, 6 in de buurt':'Koppel je eigen weerstation of regenmeter'} last>
        <Toggle on={state.agro} onChange={v=>set('agro',v)}/></Row>
    </Group>

    <Group label="Weermodel">
      <Row icon="broadcast" label="Korte termijn" hint="0–2 uur, elke 5 minuten">
        <Segmented compact options={['Nowcast','Radar']} value={state.shortModel} onChange={v=>set('shortModel',v)}/></Row>
      <Row icon="cloud-sun" label="Middellange termijn" hint="Dag 3 tot 14">
        <Segmented compact options={['ECMWF','GFS','Mix']} value={state.model} onChange={v=>set('model',v)}/></Row>
      <Row icon="chart-line" label="Spreiding tonen" hint="Toont de onzekerheid tussen de modelleden">
        <Toggle on={state.spread} onChange={v=>set('spread',v)}/></Row>
      <Row icon="ruler" label="Eenheden" hint="Neerslag in mm, wind in km/u" last>
        <Segmented compact options={['km/u','m/s','Bft']} value={state.windUnit} onChange={v=>set('windUnit',v)}/></Row>
    </Group>

    <Group label="Meldingen">
      <Row icon="cloud-rain" label="Regen op mijn locatie" hint="Uiterlijk 20 minuten vooraf">
        <Toggle on={state.notifyRain} onChange={v=>set('notifyRain',v)}/></Row>
      <Row icon="wind" label="Harde wind" hint="Vanaf windstoten boven 60 km/u">
        <Toggle on={state.notifyWind} onChange={v=>set('notifyWind',v)}/></Row>
      <Row icon="thermometer-simple" label="Vorst" hint="Wanneer de temperatuur onder 0 °C duikt">
        <Toggle on={state.notifyFrost} onChange={v=>set('notifyFrost',v)}/></Row>
      <Row icon="moon" label="Niet storen" hint="Geen meldingen tussen 22:00 en 07:00" last>
        <Toggle on={state.quiet} onChange={v=>set('quiet',v)}/></Row>
    </Group>

    <div style={{fontSize:'var(--fs-caption)',color:'var(--muted)',textAlign:'center',lineHeight:1.5}}>
      ExactCast AI · versie 0.9 (iOS) · Android volgt</div>
  </div>;
}
Object.assign(window,{SettingsScreen,Toggle,Segmented});
