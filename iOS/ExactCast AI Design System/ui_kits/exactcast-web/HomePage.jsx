const { SectionHeading, Card, Button, LinkArrow, Icon, StatusCard, ComparisonTable, Callout,
  Accordion, CtaBand, SpecCard, Testimonial, StatTile } = window.ExactCastAIDesignSystem_6b62ae;

function Section({alt,children,id}){
  return <section id={id} style={{padding:'var(--section-y) 0',background:alt?'var(--cream-2)':'transparent'}}>
    <div style={{maxWidth:'var(--max-width)',margin:'0 auto',padding:'0 var(--gutter)'}}>{children}</div></section>;
}

function HomePage({onNav}){
  return <div>
    <Hero onNav={onNav}/>
    <HeroTrust/>
    <Section>
      <SectionHeading eyebrow="Waarvoor gebruik je het" title="Drie vragen die je 's ochtends stelt"
        lead="Niet 'wordt het een mooie dag', maar 'kan ik nú de was buiten hangen'."/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'24px',marginTop:'40px'}}>
        {[['Kan de was buiten?','Je ziet of er in de komende twee uur neerslag op jouw adres valt, en hoeveel. Niet de kans voor de hele regio, maar het beeld boven je straat.'],
          ['Haal ik het op de fiets?','Per vijf minuten zie je waar de bui is en welke kant hij op gaat. Vijftien minuten wachten is vaak genoeg.'],
          ['Moet ik de tuin sproeien?','ExactCast telt de neerslag die echt op jouw locatie gemeten is. Een landelijk gemiddelde zegt daar weinig over.']].map(([t,b])=>
          <Card key={t}><h3 style={{margin:'0 0 10px',fontSize:'18px',fontWeight:600,color:'var(--ink-heading)'}}>{t}</h3>
            <p style={{margin:0,fontSize:'var(--fs-body-sm)',color:'var(--muted)',lineHeight:1.6}}>{b}</p></Card>)}
      </div>
    </Section>
    <Section alt id="hoe">
      <SectionHeading eyebrow="Hoe het werkt" title="Radar vertelt waar de bui is. Stations vertellen wat er echt viel."
        lead="ExactCast AI legt die twee over elkaar en corrigeert het radarbeeld met de metingen van de stations om je heen."/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'24px',marginTop:'44px'}}>
        {[['Radarbeeld','Elke vijf minuten een nieuw beeld van waar het regent en hoe hard, op ongeveer één kilometer.'],
          ['Echte metingen','De regenmeters en weerstations van het AgroExact-netwerk meten per tien minuten wat er daadwerkelijk valt.'],
          ['Het model erbovenop','Het AI-model leert het verschil tussen radar en meting en verplaatst de bui vooruit — twee uur, per vijf minuten.']].map(([t,b],i)=>
          <div key={t} style={{position:'relative',paddingTop:'34px'}}>
            <div style={{position:'absolute',top:0,left:0,width:'34px',height:'34px',borderRadius:'50%',background:'var(--gradient-primary)',
              color:'#fff',fontWeight:700,display:'grid',placeItems:'center',fontSize:'15px'}}>{i+1}</div>
            <h3 style={{margin:'14px 0 8px',fontSize:'var(--fs-h3)',fontWeight:600,color:'var(--ink-heading)'}}>{t}</h3>
            <p style={{margin:0,fontSize:'var(--fs-body-sm)',color:'var(--muted)',lineHeight:1.6}}>{b}</p></div>)}
      </div>
      <Callout title="Wat 'nowcasting' betekent" style={{marginTop:'36px'}}>
        Een nowcast is een voorspelling voor de eerste paar uur, gemaakt uit metingen in plaats van uit een weermodel.
        Daardoor is hij op korte termijn scherper — en na twee uur juist minder betrouwbaar. Vanaf dat punt laten we het gewone weerbericht zien.
      </Callout>
    </Section>
    <Section>
      <SectionHeading eyebrow="Eerlijk vergelijken" title="Wat je elders krijgt, en wat hier anders is"/>
      <ComparisonTable style={{marginTop:'36px'}} columns={['Gratis weerapp','Landelijke buienradar','ExactCast AI']}
        rows={[{label:'Bron',cells:['Weermodel op ~10 km','Radar op ~1 km','Radar + gemeten neerslag naast je deur']},
               {label:'Vooruit kijken',cells:['Uren, grof','Circa 1 uur','2 uur, per 5 minuten']},
               {label:'Echte meting van jouw plek',cells:['—','—','Ja, uit het AgroExact-netwerk']},
               {label:'Zegt hoe zeker het is',cells:['—','—','Ja, per nowcast']},
               {label:'Eigen weerstation nodig',cells:['Nee','Nee','Nee']}]}/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'20px',marginTop:'36px'}}>
        <StatusCard status="green" title="Groen — droog">Geen neerslag in de komende twee uur. Ga je gang.</StatusCard>
        <StatusCard status="amber" title="Amber — twijfel">Een bui in de buurt, de koers is nog onzeker. Kijk over een half uur opnieuw.</StatusCard>
        <StatusCard status="red" title="Rood — regen">Neerslag binnen twee uur op jouw adres, met tijd en hoeveelheid.</StatusCard>
      </div>
    </Section>
    <Section alt>
      <SectionHeading eyebrow="Het netwerk" title="Je leunt op de stations van de mensen om je heen"
        lead="Boeren en tuinders in Nederland en Duitsland meten al jaren op hun eigen grond. Die metingen maken jouw voorspelling scherper — en je hoeft er zelf niets voor te plaatsen."/>
      <div style={{display:'grid',gridTemplateColumns:'.9fr 1.1fr',gap:'40px',marginTop:'40px',alignItems:'center'}}>
        <div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'14px'}}>
            <StatTile value="1.240" label="meetpunten"/><StatTile value="10 min" label="meetinterval"/><StatTile value="4,3 km" label="mediane afstand"/>
          </div>
          <p style={{fontSize:'var(--fs-body-sm)',color:'var(--muted)',lineHeight:1.6,marginTop:'20px'}}>
            Hoe dichter het naaste station bij je staat, hoe beter de nowcast klopt. In de app zie je precies welk station voor jou gebruikt wordt en hoe ver dat is.</p>
          <LinkArrow onClick={e=>{e.preventDefault();onNav('Netwerk');}}>Kijk wie er bij jou in de buurt meet</LinkArrow>
        </div>
        <div style={{position:'relative',aspectRatio:'4/3',borderRadius:'var(--radius-card)',overflow:'hidden',boxShadow:'var(--shadow-card)',
          background:'linear-gradient(rgba(255,255,255,.5) 1px,transparent 1px) 0 0/100% 44px,linear-gradient(90deg,rgba(255,255,255,.5) 1px,transparent 1px) 0 0/44px 100%,linear-gradient(150deg,var(--map-land-1),var(--map-land-2) 60%,var(--map-land-3))'}}>
          <div style={{position:'absolute',left:0,right:0,top:'42%',height:'18px',background:'var(--map-water)',opacity:.85,transform:'rotate(-4deg)'}}/>
          {[[30,34],[52,58],[68,28],[44,74],[76,62],[22,62]].map(([x,y],i)=>
            <div key={i} style={{position:'absolute',left:x+'%',top:y+'%',width:'15px',height:'15px',borderRadius:'50%',background:'#fff',
              border:'3px solid var(--green-dark)',transform:'translate(-50%,-50%)',boxShadow:'var(--shadow-pin)'}}/>)}
          <div style={{position:'absolute',left:'40%',top:'48%',width:'23px',height:'23px',borderRadius:'50%',background:'var(--ink-heading)',
            border:'3px solid #fff',transform:'translate(-50%,-50%)',boxShadow:'var(--shadow-pin)',zIndex:3}}>
            <div style={{position:'absolute',inset:'-9px',borderRadius:'50%',border:'2px solid rgba(12,37,71,.35)',animation:'ec-pulse 2.4s infinite'}}/></div>
          <div style={{position:'absolute',left:'14px',bottom:'14px',background:'rgba(255,255,255,.94)',borderRadius:'10px',padding:'9px 13px',
            fontSize:'var(--fs-caption)',color:'var(--ink-heading)',boxShadow:'var(--shadow-float)',display:'flex',gap:'14px'}}>
            <span>Jouw adres</span><span>Meetpunt uit het netwerk</span></div>
        </div>
      </div>
    </Section>
    <Section>
      <SectionHeading eyebrow="Onder de motorkap" title="De cijfers achter de voorspelling"/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:'20px',marginTop:'28px'}}>
        <SpecCard title="Vernieuwingsinterval" value="elke 5 minuten">Een nieuw radarbeeld, gecombineerd met de laatste stationsmeting van tien minuten.</SpecCard>
        <SpecCard title="Vooruitblik" value="120 minuten">In stappen van vijf minuten. Daarna schakelt de app over op het reguliere weerbericht.</SpecCard>
        <SpecCard title="Resolutie" value="1 km, gecorrigeerd per station">Het radarbeeld wordt bijgesteld met de gemeten neerslag van de stations binnen tien kilometer.</SpecCard>
        <SpecCard title="Zekerheid" value="wordt altijd getoond">Elke nowcast krijgt een percentage. Onder de vijftig procent zegt de app dat het onzeker is.</SpecCard>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'24px',marginTop:'36px'}}>
        <Testimonial meta="Enschede · balkontuin" quote="Ik kijk nu 's ochtends of ik de was buiten kan hangen. Klein dingetje, maar ik doe het elke dag." who="Marloes de Wit" result="Vaker droge was" todo="te bevestigen"/>
        <Testimonial meta="Deventer · woon-werkfietser" quote="Twintig minuten wachten en dan droog thuiskomen — dat zag ik in geen enkele andere app." who="Bram Kloosterman" result="Cijfer nog ophalen" todo="te bevestigen"/>
      </div>
    </Section>
    <Section alt id="vragen">
      <SectionHeading title="Veelgestelde vragen" style={{marginBottom:'32px'}}/>
      <Accordion items={[
        {q:'Heb ik een eigen weerstation nodig?',a:'Nee. Je gebruikt de metingen van de stations om je heen. Wil je later toch zelf meten, dan kun je een AgroExact-regenmeter koppelen.'},
        {q:'Waarom alleen iOS?',a:'We beginnen op iOS zodat we de voorspelling snel kunnen bijsturen op basis van wat gebruikers zien. Android staat op de planning; een datum noemen we pas als die klopt.'},
        {q:'Hoe nauwkeurig is een nowcast?',a:'Voor het eerste half uur zit hij er meestal dicht op. Daarna neemt de onzekerheid toe, en dat laten we ook zien — de app noemt altijd een percentage in plaats van te doen alsof het zeker is.'},
        {q:'Wat gebeurt er met mijn locatie?',a:'Je locatie wordt gebruikt om het juiste station te kiezen en verder niet. We verkopen geen locatiegegevens. (Tekst nog afstemmen op het privacystatement.)'},
        {q:'Werkt het ook in Duitsland?',a:'Ja, in de gebieden waar het netwerk meetpunten heeft. In de app zie je van tevoren of er een station in de buurt staat.'}]}/>
    </Section>
    <Section>
      <CtaBand title="Zie de eerste bui aankomen" body="Gratis te proberen, zonder eigen weerstation. Je hebt alleen een postcode nodig."
        bullets={['Nu in de App Store, voor iOS','Twee uur vooruit, per vijf minuten','Gebouwd op 1.240 echte meetpunten','Zegt eerlijk hoe zeker het is']}>
        <Button variant="white" icon={<Icon name="arrow-right" set="lucide" size={20}/>}>Download in de App Store</Button>
      </CtaBand>
    </Section>
  </div>;
}
Object.assign(window,{HomePage,Section});
