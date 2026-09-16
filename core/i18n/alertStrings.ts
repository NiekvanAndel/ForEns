/**
 * What the significant-weather block says, in every language the app speaks.
 *
 * A table of functions rather than strings with `{placeholders}`, which is the usual
 * shape and the wrong one here. These sentences interpolate a count and then have to
 * agree with it — "over 1 uur" against "in 1 hour" against "in 1 Stunde" — and a
 * placeholder table pushes that agreement out to whoever fills it in, where it gets
 * done once for Dutch and forgotten for the rest. A function per phrase puts each
 * language's grammar next to that language's words.
 *
 * Numbers arrive already formatted and already converted: a gust is "82 km/u" or
 * "44 kn" depending on what the reader picked, and this decides only where in the
 * sentence it goes. `core/model/alert` does the measuring.
 *
 * The advice lines are deliberately concrete — secure loose items, protect vulnerable
 * plants — because the block exists to change what somebody does in the next few
 * hours. A translation that turns them into "be careful" has lost the point of them.
 */
import type { LangCode } from './strings';

/** The eyebrow above the headline, per kind. Kinds are `core/model/alert`'s. */
export interface AlertLabels {
  storm: string;
  wind: string;
  rain: string;
  fog: string;
  frost: string;
  heat: string;
}

export interface AlertPhrases {
  labels: AlertLabels;
  /** When something happens, as the headline says it. */
  now: string;
  inMinutes: (n: number) => string;
  inHours: (n: number) => string;
  /** No moment to name — the hourly model says rain, the nowcast has no start. */
  comingHours: string;

  stormHeadline: (when: string) => string;
  stormSub: (gust: string) => string;

  windHeavyHeadline: (gust: string) => string;
  windHeavySub: string;
  windHeadline: (gust: string) => string;
  windSub: (mean: string) => string;

  rainHeavyHeadline: (when: string) => string;
  rainHeadline: (when: string) => string;
  rainSub: (mm: string) => string;

  fogHeadline: (when: string) => string;
  fogSub: string;

  frostHeadline: (temp: string) => string;
  frostSub: string;

  heatHeadline: (temp: string) => string;
  heatSub: string;
}

export const ALERT_PHRASES: Record<LangCode, AlertPhrases> = {
  nl: {
    labels: {
      storm: 'Onweer', wind: 'Wind', rain: 'Neerslag',
      fog: 'Zicht', frost: 'Vorst', heat: 'Warmte',
    },
    now: 'nu',
    inMinutes: (n) => `over ${n} minuten`,
    inHours: (n) => `over ${n} uur`,
    comingHours: 'de komende uren',

    stormHeadline: (when) => `Onweer verwacht ${when}`,
    stormSub: (gust) =>
      `Windstoten tot ${gust}. Zet los spul vast en blijf binnen tijdens de bui.`,

    windHeavyHeadline: (gust) => `Zware windstoten tot ${gust}`,
    windHeavySub: 'Kans op schade aan bomen en losse voorwerpen. Rijd voorzichtig op open wegen.',
    windHeadline: (gust) => `Harde wind, windstoten tot ${gust}`,
    windSub: (mean) => `Gemiddeld ${mean}. Let op bij het fietsen en op de snelweg.`,

    rainHeavyHeadline: (when) => `Zware bui ${when}`,
    rainHeadline: (when) => `Regen ${when}`,
    rainSub: (mm) => `Naar verwachting ${mm}.`,

    fogHeadline: (when) => `Mist ${when}`,
    fogSub: 'Beperkt zicht op de weg. Houd afstand en gebruik mistlampen waar nodig.',

    frostHeadline: (temp) => `Vorst, tot ${temp}`,
    frostSub: 'Kans op gladheid en schade aan gewassen. Bescherm kwetsbare planten.',

    heatHeadline: (temp) => `Warm, tot ${temp}`,
    heatSub: 'Drink genoeg en zoek de schaduw op tijdens de warmste uren.',
  },

  en: {
    labels: {
      storm: 'Thunderstorm', wind: 'Wind', rain: 'Precipitation',
      fog: 'Visibility', frost: 'Frost', heat: 'Heat',
    },
    now: 'now',
    inMinutes: (n) => `in ${n} minutes`,
    inHours: (n) => (n === 1 ? 'in 1 hour' : `in ${n} hours`),
    comingHours: 'in the coming hours',

    stormHeadline: (when) => `Thunderstorms expected ${when}`,
    stormSub: (gust) =>
      `Gusts up to ${gust}. Secure loose items and stay indoors while it passes.`,

    windHeavyHeadline: (gust) => `Severe gusts up to ${gust}`,
    windHeavySub: 'Possible damage to trees and loose objects. Drive carefully on exposed roads.',
    windHeadline: (gust) => `Strong wind, gusts up to ${gust}`,
    windSub: (mean) => `Averaging ${mean}. Take care cycling and on the motorway.`,

    rainHeavyHeadline: (when) => `Heavy shower ${when}`,
    rainHeadline: (when) => `Rain ${when}`,
    rainSub: (mm) => `Around ${mm} expected.`,

    fogHeadline: (when) => `Fog ${when}`,
    fogSub: 'Limited visibility on the road. Keep your distance and use fog lights where needed.',

    frostHeadline: (temp) => `Frost, down to ${temp}`,
    frostSub: 'Risk of ice and damage to crops. Protect vulnerable plants.',

    heatHeadline: (temp) => `Warm, up to ${temp}`,
    heatSub: 'Drink enough and find shade during the hottest hours.',
  },

  de: {
    labels: {
      storm: 'Gewitter', wind: 'Wind', rain: 'Niederschlag',
      fog: 'Sicht', frost: 'Frost', heat: 'Hitze',
    },
    now: 'jetzt',
    inMinutes: (n) => `in ${n} Minuten`,
    inHours: (n) => (n === 1 ? 'in 1 Stunde' : `in ${n} Stunden`),
    comingHours: 'in den kommenden Stunden',

    stormHeadline: (when) => `Gewitter erwartet ${when}`,
    stormSub: (gust) =>
      `Böen bis ${gust}. Lose Gegenstände sichern und während des Schauers drinnen bleiben.`,

    windHeavyHeadline: (gust) => `Schwere Böen bis ${gust}`,
    windHeavySub:
      'Mögliche Schäden an Bäumen und losen Gegenständen. Auf offenen Strecken vorsichtig fahren.',
    windHeadline: (gust) => `Starker Wind, Böen bis ${gust}`,
    windSub: (mean) => `Im Mittel ${mean}. Vorsicht beim Radfahren und auf der Autobahn.`,

    rainHeavyHeadline: (when) => `Kräftiger Schauer ${when}`,
    rainHeadline: (when) => `Regen ${when}`,
    rainSub: (mm) => `Erwartet werden ${mm}.`,

    fogHeadline: (when) => `Nebel ${when}`,
    fogSub:
      'Eingeschränkte Sicht auf der Straße. Abstand halten und bei Bedarf Nebelscheinwerfer nutzen.',

    frostHeadline: (temp) => `Frost, bis ${temp}`,
    frostSub: 'Glättegefahr und Schäden an Kulturen. Empfindliche Pflanzen schützen.',

    heatHeadline: (temp) => `Warm, bis ${temp}`,
    heatSub: 'Ausreichend trinken und in den heißesten Stunden Schatten suchen.',
  },

  fr: {
    labels: {
      storm: 'Orage', wind: 'Vent', rain: 'Précipitations',
      fog: 'Visibilité', frost: 'Gel', heat: 'Chaleur',
    },
    now: 'maintenant',
    inMinutes: (n) => `dans ${n} minutes`,
    inHours: (n) => (n === 1 ? 'dans 1 heure' : `dans ${n} heures`),
    comingHours: 'dans les prochaines heures',

    stormHeadline: (when) => `Orages prévus ${when}`,
    stormSub: (gust) =>
      `Rafales jusqu’à ${gust}. Attachez les objets libres et restez à l’intérieur pendant l’averse.`,

    windHeavyHeadline: (gust) => `Fortes rafales jusqu’à ${gust}`,
    windHeavySub:
      'Risque de dégâts aux arbres et aux objets libres. Roulez prudemment sur les routes exposées.',
    windHeadline: (gust) => `Vent fort, rafales jusqu’à ${gust}`,
    windSub: (mean) => `Moyenne de ${mean}. Prudence à vélo et sur l’autoroute.`,

    rainHeavyHeadline: (when) => `Forte averse ${when}`,
    rainHeadline: (when) => `Pluie ${when}`,
    rainSub: (mm) => `Environ ${mm} attendus.`,

    fogHeadline: (when) => `Brouillard ${when}`,
    fogSub:
      'Visibilité réduite sur la route. Gardez vos distances et utilisez les antibrouillards si besoin.',

    frostHeadline: (temp) => `Gel, jusqu’à ${temp}`,
    frostSub: 'Risque de verglas et de dégâts aux cultures. Protégez les plantes sensibles.',

    heatHeadline: (temp) => `Chaud, jusqu’à ${temp}`,
    heatSub: 'Buvez suffisamment et cherchez l’ombre aux heures les plus chaudes.',
  },

  es: {
    labels: {
      storm: 'Tormenta', wind: 'Viento', rain: 'Precipitación',
      fog: 'Visibilidad', frost: 'Helada', heat: 'Calor',
    },
    now: 'ahora',
    inMinutes: (n) => `en ${n} minutos`,
    inHours: (n) => (n === 1 ? 'en 1 hora' : `en ${n} horas`),
    comingHours: 'en las próximas horas',

    stormHeadline: (when) => `Tormenta prevista ${when}`,
    stormSub: (gust) =>
      `Rachas de hasta ${gust}. Asegura los objetos sueltos y permanece dentro mientras pasa.`,

    windHeavyHeadline: (gust) => `Rachas fuertes de hasta ${gust}`,
    windHeavySub:
      'Posibles daños en árboles y objetos sueltos. Conduce con cuidado en vías expuestas.',
    windHeadline: (gust) => `Viento fuerte, rachas de hasta ${gust}`,
    windSub: (mean) => `Media de ${mean}. Precaución en bici y en autopista.`,

    rainHeavyHeadline: (when) => `Chubasco fuerte ${when}`,
    rainHeadline: (when) => `Lluvia ${when}`,
    rainSub: (mm) => `Se esperan ${mm}.`,

    fogHeadline: (when) => `Niebla ${when}`,
    fogSub:
      'Visibilidad reducida en carretera. Mantén la distancia y usa las antiniebla si hace falta.',

    frostHeadline: (temp) => `Helada, hasta ${temp}`,
    frostSub: 'Riesgo de placas de hielo y daños en los cultivos. Protege las plantas sensibles.',

    heatHeadline: (temp) => `Calor, hasta ${temp}`,
    heatSub: 'Bebe lo suficiente y busca la sombra en las horas de más calor.',
  },
};

/** The phrases for a language, falling back to Dutch for anything unknown — a
 *  stored preference outlives the code that wrote it. */
export function alertPhrases(lang: LangCode): AlertPhrases {
  return ALERT_PHRASES[lang] ?? ALERT_PHRASES.nl;
}
