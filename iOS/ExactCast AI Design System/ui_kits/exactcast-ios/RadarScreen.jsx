const { Card, Icon, StatusDot } = window.ExactCastAIDesignSystem_6b62ae;

function RadarScreen({loc}){
  const [t,setT]=React.useState(0);
  const [play,setPlay]=React.useState(false);
  React.useEffect(()=>{if(!play)return;const id=setInterval(()=>setT(v=>(v+1)%9),450);return ()=>clearInterval(id);},[play]);
  const drift=t*3.4;
  const blobs=[[26+drift,30,120,.55],[54+drift,52,152,.75],[70+drift,22,92,.4]];
  const wet=t>=2&&t<=5;
  return <div style={{padding:'0 16px 130px',display:'grid',gridTemplateColumns:'minmax(0,1fr)',gap:'14px'}}>
    <div style={{position:'relative',borderRadius:'var(--radius-app-card)',overflow:'hidden',aspectRatio:'3/4',
      boxShadow:'var(--shadow-card)',background:
      'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px) 0 0/100% 44px,linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px) 0 0/44px 100%,linear-gradient(150deg,var(--map-land-1),var(--map-land-2) 60%,var(--map-land-3))'}}>
      <div style={{position:'absolute',left:0,right:0,top:'38%',height:'16px',background:'var(--map-water)',opacity:.85,transform:'rotate(-6deg)'}}/>
      {blobs.map(([x,y,s,o],i)=><div key={i} style={{position:'absolute',left:x+'%',top:y+'%',width:s+'px',height:s*.7+'px',
        transform:'translate(-50%,-50%)',borderRadius:'50%',opacity:o,transition:'left .4s linear',
        background:'radial-gradient(closest-side,rgba(18,85,126,.85),rgba(95,208,242,.5) 60%,transparent)',filter:'blur(4px)'}}/>)}
      <div style={{position:'absolute',left:'42%',top:'56%',width:'23px',height:'23px',borderRadius:'50%',
        background:'var(--ink-heading)',border:'3px solid #fff',transform:'translate(-50%,-50%)',boxShadow:'var(--shadow-pin)'}}>
        <div style={{position:'absolute',inset:'-9px',borderRadius:'50%',border:'2px solid rgba(12,37,71,.35)',animation:'ec-pulse 2.4s infinite'}}/></div>
      {[[66,30],[24,68],[78,74]].map(([x,y],i)=><div key={i} style={{position:'absolute',left:x+'%',top:y+'%',width:'15px',height:'15px',
        borderRadius:'50%',background:'#fff',border:'3px solid var(--agro-bright)',transform:'translate(-50%,-50%)',boxShadow:'var(--shadow-pin)'}}/>)}
      <div style={{position:'absolute',left:'14px',bottom:'14px',background:'rgba(255,255,255,.94)',borderRadius:'12px',
        padding:'9px 13px',fontSize:'var(--fs-caption)',color:'var(--ink-heading)',boxShadow:'var(--shadow-float)',display:'grid',gap:'6px'}}>
        <span style={{display:'flex',alignItems:'center',gap:'6px'}}>
          <i style={{width:'10px',height:'10px',borderRadius:'50%',background:'var(--ink-heading)',border:'2px solid #fff',boxShadow:'0 0 0 1px var(--ink-heading)'}}/>Jouw locatie</span>
        <span style={{display:'flex',alignItems:'center',gap:'6px',color:'var(--agro-ink)',fontWeight:600}}>
          <i style={{width:'10px',height:'10px',borderRadius:'50%',background:'#fff',border:'3px solid var(--agro-bright)'}}/>AgroExact-station</span>
      </div>
      <div style={{position:'absolute',right:'14px',top:'14px',background:'rgba(255,255,255,.94)',borderRadius:'var(--radius-pill)',
        padding:'8px 14px',fontSize:'var(--fs-caption)',fontWeight:700,color:'var(--ink-heading)',boxShadow:'var(--shadow-float)'}}>
        {t===0?'nu':'+'+(t*15)+' min'}</div>
      <div style={{position:'absolute',left:'14px',top:'14px',display:'grid',gap:'8px'}}>
        {['plus','minus','crosshair'].map(n=><button key={n} aria-label={n} style={{width:'36px',height:'36px',borderRadius:'12px',border:0,
          background:'rgba(255,255,255,.94)',color:'var(--ink-heading)',boxShadow:'var(--shadow-float)',cursor:'pointer',display:'grid',placeItems:'center'}}>
          <Icon name={n} size={17}/></button>)}
      </div>
    </div>
    <Card radius="var(--radius-app-card)" pad="16px">
      <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
        <button onClick={()=>setPlay(p=>!p)} aria-label="Animatie" style={{width:'42px',height:'42px',flex:'0 0 42px',borderRadius:'var(--radius-pill)',
          border:0,cursor:'pointer',background:'var(--gradient-primary)',color:'#fff',display:'grid',placeItems:'center'}}>
          <Icon name={play?'pause':'play'} size={18} weight="fill"/></button>
        <div style={{flex:1}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:'var(--fs-caption)',color:'var(--muted)',marginBottom:'4px'}}>
            <span>nu</span><span>+1 uur</span><span>+2 uur</span></div>
          <input type="range" min="0" max="8" value={t} onChange={e=>setT(+e.target.value)} style={{width:'100%'}}/>
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'14px',fontSize:'var(--fs-body-sm)',color:'var(--ink-heading)',fontWeight:600}}>
        <StatusDot status={wet?'heavy':'dry'} size={10}/>
        {wet?'Bui trekt over '+loc.name+' — '+loc.alertMm+' mm verwacht':'Droog op '+loc.name}
      </div>
      <div style={{fontSize:'var(--fs-caption)',color:'var(--muted)',marginTop:'7px',lineHeight:1.5}}>
        Nowcast uit radarbeelden{loc.station?' en '+loc.stations+' AgroExact-stations om je heen':''}. Zekerheid {loc.confidence}%.</div>
    </Card>
    <div style={{display:'flex',alignItems:'center',gap:'8px',justifyContent:'center',fontSize:'var(--fs-caption)',color:'var(--muted)'}}>
      <Icon name="arrows-clockwise" size={13}/> Elke 5 minuten vernieuwd
    </div>
  </div>;
}
Object.assign(window,{RadarScreen});
