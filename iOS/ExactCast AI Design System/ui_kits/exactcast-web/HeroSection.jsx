const { Button, Icon, TrustBar, PhoneMock, MeasurementRow, StatusDot } = window.ExactCastAIDesignSystem_6b62ae;

function Hero({onNav}){
  return <div style={{background:'var(--gradient-dark)',borderRadius:'var(--radius-hero)',padding:'168px 0 96px',position:'relative',overflow:'hidden'}}>
    <div style={{position:'absolute',inset:0,background:'var(--gradient-sheen)',pointerEvents:'none'}}/>
    <div style={{position:'relative',zIndex:2,maxWidth:'var(--max-width)',margin:'0 auto',padding:'0 var(--gutter)',
      display:'grid',gridTemplateColumns:'1.05fr .95fr',gap:'56px',alignItems:'center'}}>
      <div>
        <h1 style={{margin:0,fontSize:'var(--fs-h1)',lineHeight:'var(--lh-h1)',fontWeight:600,color:'#fff'}}>
          Weet of het bij <span style={{color:'var(--green)'}}>jouw straat</span> gaat regenen, niet bij het vliegveld</h1>
        <p style={{color:'var(--on-navy-body)',fontSize:'var(--fs-lead)',lineHeight:'var(--lh-lead)',maxWidth:'36em',marginTop:'18px'}}>
          ExactCast AI leest de radar én de weerstations van AgroExact bij jou in de buurt. Elke vijf minuten een nieuwe
          voorspelling voor de komende twee uur — op jouw adres, niet op je provincie.</p>
        <div style={{display:'flex',gap:'14px',flexWrap:'wrap',marginTop:'32px'}}>
          <Button icon={<Icon name="arrow-right" set="lucide" size={20}/>} onClick={()=>onNav('Netwerk')}>Kijk wie er bij jou meet</Button>
          <Button variant="ghost" onClick={()=>onNav('Prijzen')}>Wat kost het?</Button>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'22px',color:'var(--on-navy-muted)',fontSize:'var(--fs-caption)'}}>
          <StatusDot status="green" size={8}/> Nu in de App Store · Android volgt
        </div>
      </div>
      <div style={{display:'flex',justifyContent:'center',alignItems:'flex-end',gap:'18px'}}>
        <PhoneMock small title="Actueel"><div style={{display:'grid',gap:'6px'}}>
          {[['Neerslag nu','0,4 mm'],['Temperatuur','20 °C'],['Wind','3,9 m/s']].map(([a,b])=>
            <div key={a} style={{background:'#fff',borderRadius:'12px',padding:'8px 10px',display:'flex',justifyContent:'space-between',
              fontSize:'10.5px',color:'var(--ink-heading)',fontWeight:600,boxShadow:'var(--shadow-card)'}}><span>{a}</span><span>{b}</span></div>)}
        </div></PhoneMock>
        <PhoneMock title="Nowcast"><div style={{display:'grid',gap:'6px'}}>
          <MeasurementRow compact status="red" name="Thuis" meta="regen in 20 min" advice="4,2 mm"/>
          <MeasurementRow compact status="amber" name="Volkspark" meta="koers onzeker" advice="Twijfel"/>
          <MeasurementRow compact status="green" name="Camping De Es" meta="droog tot morgen" advice="0 mm"/>
          <div style={{fontSize:'9.5px',color:'var(--muted)',marginTop:'6px',lineHeight:1.4}}>
            Gebaseerd op het station 1,2 km van je adres. Vernieuwd om 20:50.</div>
        </div></PhoneMock>
      </div>
    </div>
  </div>;
}

function HeroTrust(){
  return <div style={{maxWidth:'var(--max-width)',margin:'0 auto',padding:'0 var(--gutter)'}}>
    <TrustBar items={[
      {value:'1.240 meetpunten',label:'in Nederland en Duitsland'},
      {value:'elke 5 minuten',label:'een nieuwe nowcast'},
      {value:'2 uur vooruit',label:'per 5 minuten, op jouw adres'},
      {value:'Gratis te proberen',label:'je hebt geen eigen station nodig'}]}/>
  </div>;
}
Object.assign(window,{Hero,HeroTrust});
