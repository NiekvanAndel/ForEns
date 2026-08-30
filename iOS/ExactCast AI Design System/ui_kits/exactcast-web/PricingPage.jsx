const { SectionHeading, PlanCard, Button, Icon, Callout, Accordion, Card, Field, Input, StatTile, LinkArrow } = window.ExactCastAIDesignSystem_6b62ae;

function PricingPage({onNav}){
  return <div>
    <div style={{background:'var(--gradient-dark)',borderRadius:'var(--radius-hero)',padding:'152px 0 76px',position:'relative',overflow:'hidden'}}>
      <div style={{position:'absolute',inset:0,background:'var(--gradient-sheen)',pointerEvents:'none'}}/>
      <div style={{position:'relative',zIndex:2,maxWidth:'var(--max-width)',margin:'0 auto',padding:'0 var(--gutter)'}}>
        <div style={{fontSize:'var(--fs-meta)',color:'var(--on-navy-crumb)',marginBottom:'18px'}}>Home › Prijzen</div>
        <h1 style={{margin:0,fontSize:'var(--fs-h1)',lineHeight:'var(--lh-h1)',fontWeight:600,color:'#fff',maxWidth:'16em'}}>
          Eén locatie is gratis. Meer locaties kosten minder dan een kop koffie.</h1>
        <p style={{color:'var(--on-navy-body)',fontSize:'18px',lineHeight:1.6,maxWidth:'40em',marginTop:'18px'}}>
          Alle bedragen per maand, inclusief btw. Opzeggen kan per maand, in de App Store.</p>
      </div>
    </div>
    <Section>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'24px'}}>
        <PlanCard name="Gratis" amount="€0" per="altijd" features={['1 locatie','Nowcast tot 1 uur','Actuele metingen','Radarbeeld']}
          cta={<Button variant="ghost-dark" size="sm" full>Beginnen</Button>}/>
        <PlanCard best name="Plus" amount="€3,99" per="per maand" features={['5 locaties','Nowcast tot 2 uur','Push bij regen','Historie 12 maanden','Zekerheidspercentage']}
          cta={<Button size="sm" full>Plus nemen</Button>}/>
        <PlanCard name="Familie" amount="€6,99" per="per maand" features={['15 locaties','5 gebruikers','Alles uit Plus','Historie onbeperkt']}
          cta={<Button variant="ghost-dark" size="sm" full>Familie nemen</Button>}/>
      </div>
      <Callout title="Wat is een 'locatie'?" style={{marginTop:'36px'}}>
        Eén adres of plek waarvan je de nowcast volgt: je huis, de tuin van je ouders, de camping, het sportveld van de club.
        Je kunt ze op elk moment wisselen. Een locatie is niet hetzelfde als een weerstation — dat komt uit het netwerk en heb je zelf niet nodig.
      </Callout>
    </Section>
    <Section alt>
      <SectionHeading eyebrow="Eerst kijken" title="Staat er een meetpunt bij jou in de buurt?"
        lead="Vul je postcode in. Je ziet meteen hoe ver het naaste station staat — hoe dichterbij, hoe scherper de nowcast."/>
      <div style={{display:'grid',gridTemplateColumns:'.9fr 1.1fr',gap:'36px',marginTop:'40px',alignItems:'start'}}>
        <Card pad="28px">
          <Field label="Postcode" hint="Alleen de vier cijfers is genoeg"><Input size="lg" defaultValue="7511"/></Field>
          <Button icon={<Icon name="arrow-right" set="lucide" size={20}/>}>Zoek meetpunten</Button>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'14px',marginTop:'24px'}}>
            <StatTile value="1,2 km" label="naaste station"/><StatTile value="6" label="binnen 10 km"/><StatTile value="Goed" label="dekking"/>
          </div>
          <p style={{fontSize:'var(--fs-body-sm)',color:'var(--ink-heading)',lineHeight:1.6,marginTop:'20px',marginBottom:0}}>
            In Enschede staat het naaste meetpunt op 1,2 kilometer. Dat is dicht genoeg voor een nowcast op straatniveau.</p>
        </Card>
        <Card pad="28px">
          <h3 style={{margin:'0 0 10px',fontSize:'var(--fs-h3)',fontWeight:600,color:'var(--ink-heading)'}}>Nog geen station bij jou?</h3>
          <p style={{fontSize:'var(--fs-body-sm)',color:'var(--muted)',lineHeight:1.6}}>
            Dan werkt de app nog steeds — hij gebruikt dan het radarbeeld zonder lokale correctie, en zegt dat er ook bij.
            Zodra er een meetpunt in de buurt komt, gaat je nowcast automatisch mee vooruit.</p>
          <LinkArrow onClick={e=>{e.preventDefault();onNav('Netwerk');}}>Bekijk de dekkingskaart</LinkArrow>
        </Card>
      </div>
    </Section>
    <Section>
      <SectionHeading title="Vragen over het abonnement" style={{marginBottom:'32px'}}/>
      <Accordion items={[
        {q:'Kan ik maandelijks opzeggen?',a:'Ja. Het abonnement loopt via de App Store; daar zeg je het op en het stopt aan het eind van de maand.'},
        {q:'Zit er een proefperiode bij?',a:'Plus kun je twee weken gratis proberen. Daarna gaat het abonnement automatisch door tenzij je opzegt.'},
        {q:'Wat als ik later een eigen regenmeter wil?',a:'Die koppel je aan je account. Je locatie gebruikt dan jouw eigen meting in plaats van het naaste netwerkstation.'}]}/>
    </Section>
  </div>;
}
Object.assign(window,{PricingPage});
