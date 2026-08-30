/**
 * Shapes for the Open-Meteo family of responses and the processed model.
 *
 * The API's hourly and daily blocks are open records because the field set varies
 * by endpoint and by which `models=` is requested; the named fields are the ones
 * the app actually reads.
 */

export type Num = number | null | undefined;
export type NumArray = Num[];

export interface HourlyBlock {
  time?: string[];
  temperature_2m?: NumArray;
  precipitation?: NumArray;
  windspeed_10m?: NumArray;
  winddirection_10m?: NumArray;
  windgusts_10m?: NumArray;
  weathercode?: NumArray;
  weather_code?: NumArray;
  relativehumidity_2m?: NumArray;
  cloudcover?: NumArray;
  dewpoint_2m?: NumArray;
  apparent_temperature?: NumArray;
  surface_pressure?: NumArray;
  et0_fao_evapotranspiration?: NumArray;
  sunshine_duration?: NumArray;
  direct_normal_irradiance?: NumArray;
  cloud_cover_low?: NumArray;
  cloud_cover_mid?: NumArray;
  cloud_cover_high?: NumArray;
  shortwave_radiation?: NumArray;
  [key: string]: unknown;
}

export interface DailyBlock {
  time?: string[];
  temperature_2m_max?: NumArray;
  temperature_2m_min?: NumArray;
  precipitation_sum?: NumArray;
  precipitation_probability_max?: NumArray;
  windspeed_10m_max?: NumArray;
  winddirection_10m_dominant?: NumArray;
  weather_code?: NumArray;
  dewpoint_2m_max?: NumArray;
  dewpoint_2m_min?: NumArray;
  sunshine_duration?: NumArray;
  et0_fao_evapotranspiration?: NumArray;
  /** Ensemble responses add `<field>_member01…_member50` keys. */
  [key: string]: unknown;
}

export interface WeatherResponse {
  hourly?: HourlyBlock;
  daily?: DailyBlock;
  current_weather?: { time?: string; temperature?: number; weathercode?: number };
  utc_offset_seconds?: number;
  generationtime_ms?: number;
  error?: boolean;
  reason?: string;
}

/** One hour in the strip — past (observed) or future (modelled). */
export interface Hour {
  time: string;
  temp: number | null;
  precip: number;
  wind: number | null;
  humidity: number | null;
  wmo: number;
  isDay: 0 | 1;
  isPast: boolean;
  gusts?: number | null;
  feelsLike?: number | null;
  et0h?: number | null;
  pressure?: number | null;
  dewpoint?: number | null;
  sunMin?: number;
  windDir?: number | null;
  pChance?: number | null;
  p2mm?: number | null;
  p10mm?: number | null;
  precipP10?: number | null;
  precipP25?: number | null;
  precipP50?: number | null;
  precipP75?: number | null;
  precipP90?: number | null;
}

/** One IFS hourly precipitation entry, grouped by day. */
export interface HresHour {
  time: string;
  hour: number;
  precip: number;
  wmo: number;
  /** True once the series drops from hourly to three-hourly resolution. */
  is3h: boolean;
}

/** A processed forecast day: ensemble spread plus deterministic and model values. */
export interface Day {
  date: string;
  useHarm: boolean;
  precipP10: number; precipP25: number; precipMedian: number;
  precipP75: number; precipP90: number;
  pChance: number; p5mm: number; p20mm: number;
  tempLo: number; tempHi: number;
  tempMaxP10: number; tempMaxP25: number; tempMaxP50: number;
  tempMaxP75: number; tempMaxP90: number;
  tempMinP10: number; tempMinP25: number; tempMinP50: number;
  tempMinP75: number; tempMinP90: number;
  windP10: number; windP25: number; windP50: number; windP75: number; windP90: number;
  humidityMedian: number | null;
  humidityP10: number | null; humidityP25: number | null;
  humidityP75: number | null; humidityP90: number | null;
  sunHours: number | null;
  et0: number | null;
  windDir: number | null;
  sunModel: 'harmonie' | 'ecmwf' | 'daily' | null;
  sunOpacity: number | null;
  sunOpacityDerived: boolean;
  sun6Hourly: Record<string, number> | null;
  dayIcon: number | null;
  wmo: number;
  nMembers: number;
  ensLoaded: boolean;
  harmTempMax: number | null; harmTempMin: number | null;
  harmPrecip: number | null; harmWindMax: number | null;
  harmRhMin: number | null; harmRhMax: number | null;
  hresRhMin: number | null; hresRhMax: number | null;
  hresTempMax?: number | null; hresTempMin?: number | null;
  hresPrecip?: number; hresPrecipChance?: number | null;
  hresWindMax?: number | null; hresWindDir?: number | null;
  hresWmo?: number | null;
  hresRhMax_?: number | null;
  [key: string]: unknown;
}

export interface ForecastModel {
  pastHours: Hour[];
  futureHours: Hour[];
  allHours: Hour[];
  nowHour: string;
  days: Day[];
  currentTemp: number;
  currentWmo: number;
  nMembers: number;
  hresRunLabel: string | null;
  hresHoursByDay: Record<string, HresHour[]>;
}

/** Everything `processAll` read from module globals in the web app. */
export interface ProcessContext {
  lat: number;
  lon: number;
  /** Whether HARMONIE is enabled in preferences. */
  useHarmonie: boolean;
  /** Whether the HARMONIE fetch failed, so it must not be trusted. */
  harmFailed: boolean;
  /** ECMWF hourly weather codes for day icons (7-day call). */
  ecmwfHourly?: WeatherResponse | null;
  /** Extended ECMWF hourly weather codes (14-day call), preferred when present. */
  ecmwfHourlyExt?: WeatherResponse | null;
  /** Injected clock, so the IFS run label is deterministic under test. */
  now?: Date;
}
