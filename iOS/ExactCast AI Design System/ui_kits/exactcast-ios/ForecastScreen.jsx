const { Card, Icon } = window.ExactCastAIDesignSystem_6b62ae;

const LAYERS=[['thermometer-simple','Temperatuur'],['drop','Neerslag'],['wind','Wind'],['sun','Zon & verdamping'],['drop-half','Vochtigheid']];

function ForecastScreen({loc}){
  const [layer,setLayer]=React.useState(1);
  const max=Math.max(...loc.hourly.map(h=>h.mm),1);
  return <div style={{padding:'0 16px 130px',display:'grid',gridTemplateColumns:'minmax(0,1fr)',gap:'14px'}}>
    <Card radius="var(--radius-app-card)" pad="16px">
      <CardHeader icon="clock" label="Detail korte termijn"/>
      <div style={{minWidth:0,display:'flex',gap:'6px',overflowX:'auto',scrollbarWidth:'none',paddingBottom:'4px'}}>
        {loc.hourly.map((h,i)=><div key={h.t} style={{flex:'0 0 74px',textAlign:'center',borderRadius:'16px',padding:'12px 6px',
          background:i===0?'var(--sky-wash)':'transparent'}}>
          <div style={{fontSize:'var(--fs-caption)',color:'var(--muted)',fontWeight:600}}>{h.t}</div>
          <div style={{margin:'8px 0'}}><WeatherIcon cond={h.cond} size={24}/></div>
          <div style={{fontSize:'var(--fs-body-sm)',fontWeight:700,color:'var(--val-temp)'}}>{h.temp}°</div>
          <div style={{fontSize:'12px',fontWeight:700,marginTop:'4px',color:h.mm>0?'var(--val-precip)':'var(--val-precip-zero)'}}>
            {h.mm.toFixed(1).replace('.',',')}<i style={{fontSize:'10px',fontWeight:600,fontStyle:'normal',color:'var(--muted)'}}> mm</i></div>
          <div style={{height:'34px',display:'flex',alignItems:'flex-end',justifyContent:'center',marginTop:'6px'}}>
            <div style={{width:'18px',height:Math.max(3,h.mm/max*34)+'px',borderRadius:'4px',
              background:h.mm>0?'linear-gradient(180deg,var(--sky),var(--accent))':'rgba(12,37,71,.08)'}}/></div>
          <div style={{fontSize:'11.5px',color:'var(--muted)',marginTop:'7px',display:'flex',flexDirection:'column',alignItems:'center',gap:'2px'}}>
            <WindArrow deg={h.deg} size={12}/>{h.wind}</div>
          <div style={{fontSize:'11.5px',fontWeight:700,color:'var(--val-sun)',marginTop:'5px'}}>{h.sun}m</div>
        </div>)}
      </div>
    </Card>

    <Card radius="var(--radius-app-card)" pad="16px">
      <CardHeader icon="calendar-blank" label={'14 dagen · '+loc.model}/>
      <div style={{minWidth:0,display:'flex',gap:'8px',overflowX:'auto',scrollbarWidth:'none',paddingBottom:'10px'}}>
        {LAYERS.map(([ic,l],i)=><button key={l} onClick={()=>setLayer(i)} style={{flex:'0 0 auto',border:0,cursor:'pointer',
          borderRadius:'var(--radius-pill)',padding:'9px 15px',fontFamily:'var(--font-core)',fontSize:'var(--fs-label)',fontWeight:600,
          display:'flex',alignItems:'center',gap:'6px',whiteSpace:'nowrap',transition:'var(--dur-fast)',
          background:i===layer?'var(--gradient-primary)':'var(--cream-2)',color:i===layer?'#fff':'var(--ink-heading)'}}>
          <Icon name={ic} size={15}/>{l}</button>)}
      </div>
      <div style={{display:'grid',gap:'2px'}}>
        {loc.daily.map(d=><DayRow key={d.day+d.date} d={d} lo={loc.range.lo} hi={loc.range.hi}/>)}
      </div>
      <div style={{fontSize:'var(--fs-caption)',color:'var(--muted)',marginTop:'12px',lineHeight:1.5}}>
        Balken lopen van de dagminimum- naar de dagmaximumtemperatuur. Na dag 7 groeit de spreiding tussen de modelleden snel.</div>
    </Card>

    <Card radius="var(--radius-app-card)" pad="16px">
      <CardHeader icon="info" label="Bron"/>
      <div style={{display:'grid',gap:'10px'}}>
        {[['Korte termijn (0–2 uur)','ExactCast AI nowcast — radar'+(loc.station?' + AgroExact-station':'')],
          ['2 uur – 48 uur','HARMONIE-AROME, per uur'],
          ['Dag 3–14',loc.model]].map(([a,b])=>
          <div key={a} style={{display:'flex',justifyContent:'space-between',gap:'14px',alignItems:'baseline',
            paddingBottom:'8px',borderBottom:'1px solid var(--hairline-soft)'}}>
            <span style={{fontSize:'var(--fs-label)',color:'var(--muted)'}}>{a}</span>
            <b style={{fontSize:'var(--fs-label)',color:'var(--ink-heading)',textAlign:'right'}}>{b}</b></div>)}
      </div>
    </Card>
  </div>;
}
Object.assign(window,{ForecastScreen});
