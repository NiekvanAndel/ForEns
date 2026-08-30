const { Card, Icon, StatusDot } = window.ExactCastAIDesignSystem_6b62ae;

/* ---- 1. Summary hero — ONLY rendered when something significant is coming.
        Not rain-only: wind, storm or fog qualify too. No event, no hero. ---- */
function AlertHero({alert}){
  if(!alert) return null;
  const tone=alert.severity==='heavy'?'var(--status-heavy)':'var(--accent-dark)';
  return <div style={{background:'var(--gradient-dark)',borderRadius:'var(--radius-app-card)',padding:'20px 20px 18px',
    position:'relative',overflow:'hidden',boxShadow:'var(--shadow-card)'}}>
    <div style={{position:'absolute',inset:0,background:'var(--gradient-sheen)',pointerEvents:'none'}}/>
    <div style={{position:'relative'}}>
      <div style={{display:'flex',alignItems:'center',gap:'8px',color:'var(--sky)',fontSize:'var(--fs-eyebrow)',
        fontWeight:700,letterSpacing:'var(--ls-eyebrow)',textTransform:'uppercase'}}>
        <Icon name={alert.icon} size={14} weight="fill"/>{alert.kind}</div>
      <div style={{color:'#fff',fontSize:'27px',fontWeight:600,lineHeight:1.2,marginTop:'10px'}}>{alert.headline}</div>
      <div style={{color:'var(--on-navy-body)',fontSize:'var(--fs-body-sm)',lineHeight:1.55,marginTop:'7px'}}>{alert.sub}</div>
      <div style={{display:'flex',gap:'6px',alignItems:'flex-end',height:'56px',marginTop:'16px'}}>
        {alert.bars.map((h,i)=><div key={i} style={{flex:1,height:Math.max(4,h)+'%',borderRadius:'4px',
          background:h>55?'linear-gradient(180deg,var(--sky-soft),var(--sky))':h>18?'rgba(143,220,245,.4)':'var(--track-on-navy)'}}/>)}
      </div>
      <div style={{display:'flex',justifyContent:'space-between',color:'var(--on-navy-muted)',fontSize:'var(--fs-caption)',marginTop:'7px'}}>
        <span>nu</span><span>+30 min</span><span>+60 min</span><span>+2 uur</span></div>
    </div>
  </div>;
}

/* ---- 2. Conditions hero — the chosen location's own measurements.
        Works for any address; a station-backed one adds the green source line. ---- */
function ConditionsHero({loc}){
  const cell=(label,children)=>
    <div style={{flex:1,textAlign:'center',padding:'14px 8px'}}>
      <div style={{fontSize:'var(--fs-caption)',fontWeight:700,letterSpacing:'.08em',textTransform:'uppercase',color:'var(--muted)',marginBottom:'6px'}}>{label}</div>
      {children}</div>;
  return <Card radius="var(--radius-app-card)" pad="0" style={{overflow:'hidden'}}>
    <div style={{padding:'18px 20px 16px'}}>
      <div style={{display:'flex',alignItems:'baseline',gap:'10px',flexWrap:'wrap'}}>
        <h2 style={{margin:0,fontSize:'23px',fontWeight:700,letterSpacing:'-.01em',
          color:loc.station?'var(--agro-ink)':'var(--ink-heading)'}}>{loc.name}</h2>
        <span style={{fontSize:'var(--fs-label)',color:'var(--muted)'}}>{loc.time}</span>
      </div>
      <div style={{fontSize:'var(--fs-caption)',color:loc.station?'var(--agro-ink)':'var(--muted)',marginTop:'3px',
        display:'flex',alignItems:'center',gap:'6px'}}>
        {loc.station?<i style={{width:'8px',height:'8px',borderRadius:'50%',background:'var(--agro-bright)'}}/>:null}
        {loc.source}</div>
      <div style={{display:'flex',alignItems:'center',gap:'18px',marginTop:'14px'}}>
        <div style={{display:'grid',gap:'2px'}}>
          <span style={{color:'var(--val-high)',fontWeight:700,fontSize:'19px'}}>▲ {loc.hi}°</span>
          <span style={{color:'var(--val-low)',fontWeight:700,fontSize:'19px'}}>▼ {loc.lo}°</span></div>
        <div style={{fontSize:'58px',fontWeight:800,color:'var(--app-value)',lineHeight:1,letterSpacing:'-.03em'}}>{loc.temp}°</div>
        <div style={{marginLeft:'auto'}}><WeatherIcon cond={loc.cond} size={54}/></div>
      </div>
    </div>
    <div style={{display:'flex',borderTop:'1px solid var(--hairline)'}}>
      {cell('Wind',<div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'6px'}}>
        <WindArrow deg={loc.wind.deg}/>
        <span style={{fontSize:'21px',fontWeight:700,color:'var(--val-wind)'}}>{loc.wind.speed}</span>
        <span style={{fontSize:'11.5px',fontWeight:600,color:'var(--muted)'}}>km/u</span></div>)}
      <div style={{width:'1px',background:'var(--hairline)'}}/>
      {cell('Neerslag 24u',<div style={{display:'flex',alignItems:'baseline',justifyContent:'center',gap:'5px'}}>
        <span style={{fontSize:'21px',fontWeight:700,color:loc.precip24>0?'var(--val-precip)':'var(--val-precip-zero)'}}>{String(loc.precip24).replace('.',',')}</span>
        <span style={{fontSize:'11.5px',fontWeight:600,color:'var(--muted)'}}>mm</span></div>)}
      <div style={{width:'1px',background:'var(--hairline)'}}/>
      {cell('Vochtigheid',<div style={{display:'flex',alignItems:'baseline',justifyContent:'center',gap:'4px'}}>
        <span style={{fontSize:'21px',fontWeight:700,color:'var(--ink-heading)'}}>{loc.humidity}</span>
        <span style={{fontSize:'11.5px',fontWeight:600,color:'var(--muted)'}}>%</span></div>)}
    </div>
    <div style={{borderTop:'1px solid var(--hairline)',padding:'4px 16px 10px'}}>
      {loc.hourly.slice(0,3).map(h=><HourRow key={h.t} h={h}/>)}
    </div>
  </Card>;
}

function HourRow({h}){
  return <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'9px 2px',fontWeight:700,fontSize:'var(--fs-body-sm)'}}>
    <span style={{color:'var(--muted)',width:'46px'}}>{h.t}</span>
    <WeatherIcon cond={h.cond} size={19}/>
    <span style={{color:'var(--val-temp)',width:'34px'}}>{h.temp}°</span>
    <span style={{color:h.mm>0?'var(--val-precip)':'var(--val-precip-zero)',width:'58px'}}>
      {h.mm.toFixed(1).replace('.',',')}<i style={{fontSize:'11px',fontWeight:600,fontStyle:'normal',color:'var(--muted)'}}> mm</i></span>
    <span style={{display:'flex',alignItems:'center',gap:'4px',color:'var(--val-wind)',marginLeft:'auto'}}>
      <WindArrow deg={h.deg} size={13}/>{h.wind}<i style={{fontSize:'11px',fontWeight:600,fontStyle:'normal',color:'var(--muted)'}}> km/u</i></span>
    <span style={{color:'var(--val-sun)',width:'34px',textAlign:'right'}}>{h.sun}<i style={{fontSize:'11px',fontWeight:600,fontStyle:'normal'}}>m</i></span>
  </div>;
}

/* ---- 3. Radar preview — tap opens the Radar page ---- */
function RadarPreview({loc,onOpen}){
  return <Card radius="var(--radius-app-card)" pad="16px">
    <CardHeader icon="broadcast" label="Radar" action="Volledig" onAction={onOpen}/>
    <div onClick={onOpen} style={{position:'relative',borderRadius:'18px',overflow:'hidden',height:'168px',cursor:'pointer',
      background:'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px) 0 0/100% 38px,linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px) 0 0/38px 100%,linear-gradient(150deg,var(--map-land-1),var(--map-land-2) 60%,var(--map-land-3))'}}>
      <div style={{position:'absolute',left:0,right:0,top:'44%',height:'14px',background:'var(--map-water)',opacity:.85,transform:'rotate(-5deg)'}}/>
      {[[28,32,110,.6],[56,54,140,.75]].map(([x,y,s,o],i)=><div key={i} style={{position:'absolute',left:x+'%',top:y+'%',
        width:s+'px',height:s*.7+'px',transform:'translate(-50%,-50%)',borderRadius:'50%',opacity:o,filter:'blur(4px)',
        background:'radial-gradient(closest-side,rgba(18,85,126,.8),rgba(95,208,242,.5) 60%,transparent)'}}/>)}
      <div style={{position:'absolute',left:'42%',top:'56%',width:'21px',height:'21px',borderRadius:'50%',background:'var(--ink-heading)',
        border:'3px solid #fff',transform:'translate(-50%,-50%)',boxShadow:'var(--shadow-pin)'}}>
        <div style={{position:'absolute',inset:'-8px',borderRadius:'50%',border:'2px solid rgba(12,37,71,.35)',animation:'ec-pulse 2.4s infinite'}}/></div>
      {loc.station?[[66,30]].map(([x,y],i)=><div key={i} style={{position:'absolute',left:x+'%',top:y+'%',width:'14px',height:'14px',
        borderRadius:'50%',background:'#fff',border:'3px solid var(--agro-bright)',transform:'translate(-50%,-50%)',boxShadow:'var(--shadow-pin)'}}/>):null}
      <div style={{position:'absolute',right:'12px',top:'12px',background:'rgba(255,255,255,.94)',borderRadius:'var(--radius-pill)',
        padding:'6px 12px',fontSize:'var(--fs-caption)',fontWeight:700,color:'var(--ink-heading)',boxShadow:'var(--shadow-float)'}}>nu · 20:50</div>
    </div>
  </Card>;
}

/* ---- 4. Forecast preview — tap opens the Verwachting page ---- */
function ForecastPreview({loc,onOpen}){
  const max=Math.max(...loc.hourly.map(h=>h.mm),1);
  return <Card radius="var(--radius-app-card)" pad="16px">
    <CardHeader icon="clock" label="Verwachting" action="Details" onAction={onOpen}/>
    <div onClick={onOpen} style={{cursor:'pointer',minWidth:0,display:'flex',gap:'6px',overflowX:'auto',scrollbarWidth:'none',paddingBottom:'4px'}}>
      {loc.hourly.map((h,i)=><div key={h.t} style={{flex:'0 0 62px',textAlign:'center',borderRadius:'14px',padding:'10px 4px',
        background:i===0?'var(--sky-wash)':'transparent'}}>
        <div style={{fontSize:'var(--fs-caption)',color:'var(--muted)',fontWeight:600}}>{h.t}</div>
        <div style={{margin:'7px 0'}}><WeatherIcon cond={h.cond} size={22}/></div>
        <div style={{fontSize:'var(--fs-body-sm)',fontWeight:700,color:'var(--val-temp)'}}>{h.temp}°</div>
        <div style={{height:'30px',display:'flex',alignItems:'flex-end',justifyContent:'center',marginTop:'6px'}}>
          <div style={{width:'16px',height:Math.max(3,h.mm/max*30)+'px',borderRadius:'3px',
            background:h.mm>0?'linear-gradient(180deg,var(--sky),var(--accent))':'rgba(12,37,71,.08)'}}/></div>
        <div style={{fontSize:'11px',fontWeight:700,marginTop:'5px',color:h.mm>0?'var(--val-precip)':'var(--val-precip-zero)'}}>
          {h.mm.toFixed(1).replace('.',',')}</div>
      </div>)}
    </div>
    <div style={{borderTop:'1px solid var(--hairline)',marginTop:'12px',paddingTop:'12px',display:'grid',gap:'2px'}}>
      {loc.daily.slice(0,4).map(d=><DayRow key={d.day} d={d} lo={loc.range.lo} hi={loc.range.hi}/>)}
    </div>
  </Card>;
}

function DayRow({d,lo,hi}){
  const span=hi-lo||1;
  const left=((d.lo-lo)/span)*100, width=((d.hi-d.lo)/span)*100;
  return <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'7px 2px'}}>
    <div style={{width:'44px'}}>
      <div style={{fontSize:'var(--fs-label)',fontWeight:700,color:'var(--ink-heading)'}}>{d.day}</div>
      <div style={{fontSize:'11px',color:'var(--muted)'}}>{d.date}</div></div>
    <WeatherIcon cond={d.cond} size={19}/>
    <span style={{fontSize:'var(--fs-label)',fontWeight:700,color:'var(--val-low)',width:'30px',textAlign:'right'}}>{d.lo}°</span>
    <div style={{flex:1,height:'6px',borderRadius:'3px',background:'rgba(12,37,71,.09)',position:'relative'}}>
      <i style={{position:'absolute',left:left+'%',width:width+'%',top:0,bottom:0,borderRadius:'3px',
        background:'linear-gradient(90deg,var(--val-low),var(--val-temp))'}}/></div>
    <span style={{fontSize:'var(--fs-label)',fontWeight:700,color:'var(--val-high)',width:'30px'}}>{d.hi}°</span>
  </div>;
}

function NowcastScreen({loc,onOpenRadar,onOpenForecast}){
  return <div style={{padding:'0 16px 130px',display:'grid',gridTemplateColumns:'minmax(0,1fr)',gap:'14px'}}>
    <AlertHero alert={loc.alert}/>
    <ConditionsHero loc={loc}/>
    <RadarPreview loc={loc} onOpen={onOpenRadar}/>
    <ForecastPreview loc={loc} onOpen={onOpenForecast}/>
    <div style={{display:'flex',alignItems:'center',gap:'8px',justifyContent:'center',fontSize:'var(--fs-caption)',color:'var(--muted)'}}>
      <StatusDot status="dry" size={8}/> Vernieuwd om 20:50 · {loc.model}
    </div>
  </div>;
}
Object.assign(window,{NowcastScreen,AlertHero,ConditionsHero,RadarPreview,ForecastPreview,HourRow,DayRow});
