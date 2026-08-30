const { SectionHeading, Card, Button, Icon, SpecCard, Callout, StatTile, MeasurementRow, ResultRow, MeterBar, WarnBox, CtaBand } = window.ExactCastAIDesignSystem_6b62ae;

function NetworkPage(){
  return <div>
    <div style={{background:'var(--gradient-dark)',borderRadius:'var(--radius-hero)',padding:'152px 0 76px',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,background:'var(--gradient-sheen)',pointerEvents:'none'}}/>
      <div style={{position:'relative',zIndex:2,maxWidth:'var(--max-width)',margin:'0 auto',padding:'0 var(--gutter)'}}>
        <div style={{fontSize:'var(--fs-meta)',color:'var(--on-navy-crumb)',marginBottom:'18px'}}>Home › Het netwerk</div>
        <h1 style={{margin:0,fontSize:'var(--fs-h1)',lineHeight:'var(--lh-h1)',fontWeight:600,color:'#fff',maxWidth:'16em'}}>
          1.240 regenmeters op echte grond, niet één op het vliegveld</h1>
        <p style={{color:'var(--on-navy-body)',fontSize:'18px',lineHeight:1.6,maxWidth:'40em',marginTop:'18px'}}>
          Het AgroExact-netwerk meet al jaren voor boeren en tuinders. ExactCast AI gebruikt diezelfde metingen om jouw nowcast te corrigeren.</p>
      </div>
    </div>
    <Section>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'40px',alignItems:'center'}}>
        <div>
          <SectionHeading eyebrow="Waarom het uitmaakt" title="Twee kilometer verschil is twee heel verschillende dagen"
            lead="Bij buien is neerslag extreem lokaal. Op één hoek van de stad valt 18 mm, twee kilometer verderop 2 mm. Een landelijk model ziet dat verschil niet."/>
          <div style={{display:'grid',gap:'8px',marginTop:'28px'}}>
            <MeasurementRow status="red" name="Enschede Zuid" meta="station op 1,2 km" advice="18,4 mm"/>
            <MeasurementRow status="amber" name="Enschede Centrum" meta="station op 2,9 km" advice="6,1 mm"/>
            <MeasurementRow status="green" name="Enschede Noord" meta="station op 4,4 km" advice="1,8 mm"/>
          </div>
          <p style={{fontSize:'var(--fs-caption)',color:'var(--muted)',marginTop:'12px'}}>Gemeten op 12 augustus 2026, dezelfde bui.</p>
        </div>
        <div style={{background:'var(--gradient-dark)',borderRadius:'var(--radius-card)',padding:'30px',color:'#fff'}}>
          <div style={{fontSize:'var(--fs-label)',color:'var(--on-navy-muted)',marginBottom:'22px',lineHeight:1.5}}>
            Wat de stationscorrectie oplevert, gemeten over 90 dagen in Twente.</div>
          <ResultRow label="Nowcast zonder correctie" value="61% juist"/>
          <ResultRow label="Nowcast met stationscorrectie" value="82% juist" highlight/>
          <ResultRow label="Naaste station" value="1,2 km" last/>
          <MeterBar leftLabel="Met correctie" rightLabel="82%" pct={82} style={{marginTop:'22px'}}/>
          <MeterBar leftLabel="Zonder correctie" rightLabel="61%" pct={61} tone="cost" style={{marginTop:'12px'}}/>
          <WarnBox title="Eerlijk over deze cijfers" style={{marginTop:'22px'}}>
            Dit is één regio en één zomer. We publiceren de meting per regio zodra we een heel jaar hebben. (Cijfers nog te bevestigen.)
          </WarnBox>
        </div>
      </div>
    </Section>
    <Section alt>
      <SectionHeading eyebrow="De meetpunten" title="Wat er precies gemeten wordt"/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'20px',marginTop:'28px'}}>
        <SpecCard title="Neerslag" value="per 10 minuten, mm en duur">Elke regenmeter in het netwerk. Dit is de meting die je nowcast bijstelt.</SpecCard>
        <SpecCard title="Temperatuur" value="op 1,5 m (WMO-hoogte)">Alleen bij de volledige weerstations in het netwerk.</SpecCard>
        <SpecCard title="Wind" value="snelheid, stoten en richting op 2 m">Alleen bij volledige weerstations. Wind verschilt sterk per kavel, dus we tonen altijd welk station het is.</SpecCard>
        <SpecCard title="Luchtvochtigheid" value="op 1,5 m">Bij volledige weerstations; wordt gebruikt voor de verdampingsschatting.</SpecCard>
      </div>
      <Callout title="Wat het netwerk niet meet" style={{marginTop:'36px'}}>
        Bodemvochtsensoren zitten niet in het consumentennetwerk. Het sproeiadvies in de app is dus een schatting uit
        gemeten neerslag en verdamping — geen bodemmeting. Dat staat ook zo in de app.
      </Callout>
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'14px',marginTop:'36px'}}>
        <StatTile value="1.240" label="meetpunten"/><StatTile value="10 min" label="meetinterval"/>
        <StatTile value="4,3 km" label="mediane afstand tot een adres"/><StatTile value="NL + DE" label="dekking"/>
      </div>
    </Section>
    <Section>
      <CtaBand title="Kijk wat het naaste station bij jou meet" body="Postcode invullen is genoeg. Geen account nodig om te kijken.">
        <Button variant="white" icon={<Icon name="arrow-right" set="lucide" size={20}/>}>Zoek mijn meetpunt</Button>
      </CtaBand>
    </Section>
  </div>;
}
Object.assign(window,{NetworkPage});
