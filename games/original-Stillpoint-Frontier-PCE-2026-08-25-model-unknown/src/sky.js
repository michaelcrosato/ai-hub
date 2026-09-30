/**
 * sky.js — world time, the sun and moon, weather and the light budget they
 * imply. sampleEnvironment() is deterministic for a given minute and biome;
 * the Environment class advances the clock and pushes samples to the
 * renderer and HUD. No three.js here.
 */
import { hash2 } from './terrain.js';

export const MINUTES_PER_DAY = 1440;
const SYNODIC_MONTH = 29.530588;
const MOON_PHASE_OFFSET = 0.42;
const AXIAL_TILT = (38 * Math.PI) / 180;
export const WEATHER_IDS = ['clear', 'overcast', 'rain', 'fog', 'wind'];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const wrap01 = (v) => ((v % 1) + 1) % 1;
function smoothstep(edge0, edge1, value) {
  const s = clamp01((value - edge0) / Math.max(1e-6, edge1 - edge0));
  return s * s * (3 - 2 * s);
}

function directionFrom(azimuth, elevation) {
  const c = Math.cos(elevation);
  return [Math.sin(azimuth) * c, Math.sin(elevation), -Math.cos(azimuth) * c];
}

/** Position of a body on the sky for a fraction of the day and a declination. */
function celestialPosition(dayFraction, declination = 0) {
  const hourAngle = (wrap01(dayFraction) - 0.5) * Math.PI * 2;
  const cd = Math.cos(declination);
  const east = -cd * Math.sin(hourAngle);
  const up = Math.sin(AXIAL_TILT) * Math.sin(declination) + Math.cos(AXIAL_TILT) * cd * Math.cos(hourAngle);
  const north = Math.cos(AXIAL_TILT) * Math.sin(declination) - Math.sin(AXIAL_TILT) * cd * Math.cos(hourAngle);
  const elevation = Math.atan2(up, Math.hypot(east, north));
  const azimuth = Math.atan2(east, north);
  return { azimuth, elevation, direction: directionFrom(azimuth, elevation) };
}

function moonPhaseName(progress) {
  const p = wrap01(progress);
  if (p < 0.03 || p >= 0.97) return 'new';
  if (p < 0.22) return 'waxing-crescent';
  if (p < 0.28) return 'first-quarter';
  if (p < 0.47) return 'waxing-gibbous';
  if (p < 0.53) return 'full';
  if (p < 0.72) return 'waning-gibbous';
  if (p < 0.78) return 'last-quarter';
  return 'waning-crescent';
}

export const WEATHER_LABELS = { clear: 'Long clear', overcast: 'Low overcast', rain: 'Greywater rain', fog: 'Basin mist', wind: 'Crown wind' };
/** cloud cover, fog density, precipitation, wind km/h, base temperature °C */
const WEATHER_TABLE = {
  clear: [0.08, 0.0028, 0, 12, 17],
  overcast: [0.72, 0.0044, 0, 20, 13],
  rain: [0.92, 0.0068, 0.78, 28, 9],
  fog: [0.68, 0.0115, 0, 7, 8],
  wind: [0.25, 0.0037, 0, 54, 14],
};

export function withWeather(sample, weatherId) {
  const [cloudCover, fogDensity, precipitation, windKph, baseTemp] = WEATHER_TABLE[weatherId];
  const previousBase = WEATHER_TABLE[sample.weatherId][4];
  return {
    ...sample,
    weatherId,
    weatherLabel: WEATHER_LABELS[weatherId],
    cloudCover,
    fogDensity,
    precipitation,
    windKph,
    temperatureC: baseTemp + (sample.temperatureC - previousBase),
  };
}

export function sampleEnvironment(totalMinutes, biomeId, seed = 5312912) {
  const minutes = Number.isFinite(totalMinutes) ? Math.max(0, Math.min(9999999, totalMinutes)) : 1058;
  const minuteOfDay = Math.floor(minutes) % MINUTES_PER_DAY;
  const dayFraction = (minutes % MINUTES_PER_DAY) / MINUTES_PER_DAY;
  const sun = celestialPosition(dayFraction);
  const days = minutes / MINUTES_PER_DAY;
  const moonProgress = wrap01(MOON_PHASE_OFFSET + days / SYNODIC_MONTH);
  const moon = celestialPosition(wrap01(dayFraction - moonProgress), Math.sin((days / 27.212221 + 0.17) * Math.PI * 2) * 0.087);
  const moonIllumination = clamp01((1 - Math.cos(moonProgress * Math.PI * 2)) * 0.5);
  const daylight = smoothstep(-0.14, 0.24, sun.elevation);
  const goldenHour = (1 - Math.min(1, Math.abs(sun.elevation - 0.06) / 0.32)) * smoothstep(-0.12, 0.16, sun.elevation);
  const roll = hash2(Math.floor(minutes / 150), biomeId.length, seed) / 4294967296;
  const wet = biomeId === 'riverlands' || biomeId === 'salt_coast' || biomeId === 'pine_forest' ? 0.18 : 0;
  const dry = biomeId === 'glass_badlands' || biomeId === 'warden_steppe' ? 0.18 : 0;
  const weatherId = roll < 0.13 + wet ? 'rain' : roll < 0.25 + wet ? 'fog' : roll < 0.43 ? 'overcast' : roll > 0.82 - dry ? 'wind' : 'clear';
  const [cloudCover, fogDensity, precipitation, windKph, baseTemp] = WEATHER_TABLE[weatherId];
  const hour = Math.floor(minuteOfDay / 60);
  const phase = minuteOfDay >= 300 && minuteOfDay < 420 ? 'dawn' : minuteOfDay >= 420 && minuteOfDay < 1020 ? 'day' : minuteOfDay >= 1020 && minuteOfDay < 1140 ? 'dusk' : 'night';
  return {
    day: Math.floor(minutes / MINUTES_PER_DAY) + 1,
    hour,
    minute: minuteOfDay % 60,
    phase,
    daylight,
    night: 1 - daylight,
    goldenHour,
    sunAzimuth: sun.azimuth,
    sunElevation: sun.elevation,
    sunDirection: sun.direction,
    moonAzimuth: moon.azimuth,
    moonElevation: moon.elevation,
    moonDirection: moon.direction,
    moonPhase: moonPhaseName(moonProgress),
    moonPhaseProgress: moonProgress,
    moonIllumination,
    weatherId,
    weatherLabel: WEATHER_LABELS[weatherId],
    cloudCover,
    fogDensity,
    precipitation,
    windKph,
    temperatureC: baseTemp + Math.sin((dayFraction - 0.28) * Math.PI * 2) * 6,
  };
}

export function formatWorldTime(sample) {
  return `DAY ${String(sample.day).padStart(2, '0')} // ${String(sample.hour).padStart(2, '0')}:${String(sample.minute).padStart(2, '0')}`;
}

/** How much light the sun and moon give, and which one should cast the shadow. */
export function celestialLighting(sample) {
  const sunVisibility = smoothstep(-0.105, 0.12, sample.sunElevation);
  const moonVisibility = smoothstep(-0.08, 0.16, sample.moonElevation);
  const sunUp = smoothstep(0, 0.14, sample.sunElevation);
  const moonUp = smoothstep(0, 0.12, sample.moonElevation);
  const sunClouds = 1 - sample.cloudCover * 0.58;
  const moonClouds = 1 - sample.cloudCover * 0.78;
  const sunIntensity = Math.max(0, (0.18 + sample.daylight * 2.32) * sunUp * sunClouds);
  const moonIntensity = Math.max(0, 0.42 * sample.moonIllumination ** 1.28 * moonUp * sample.night * moonClouds);
  const moonDiscIntensity = Math.max(0, (0.18 + sample.moonIllumination * 3.2) * moonVisibility * (1 - sample.cloudCover * 0.64));
  const starIntensity = Math.max(0, sample.night ** 1.45 * (1 - sample.cloudCover * 0.92) * (1 - sample.moonIllumination * moonVisibility * 0.34));
  const total = sunIntensity + moonIntensity;
  const contrast = total > 1e-6 ? Math.abs(sunIntensity - moonIntensity) / total : 0;
  const shadow = Math.max(sunIntensity, moonIntensity) * smoothstep(0.04, 0.24, contrast);
  const shadowIntensity = shadow >= 0.02 ? shadow : 0;
  return {
    sunVisibility,
    moonVisibility,
    sunIntensity,
    moonIntensity,
    shadowIntensity,
    moonDiscIntensity,
    starIntensity,
    shadowSource: shadowIntensity === 0 ? 'none' : moonIntensity > sunIntensity ? 'moon' : 'sun',
  };
}

export const TIME_SCALES = [0.25, 0.5, 1, 2, 8, 24, 96];
export const TIME_MODES = ['smooth', 'stepped'];
const STEP_SECONDS = 0.25;

/**
 * The world clock. 0.82 field minutes pass per real second (a day is about
 * 29 real minutes). Visual refresh runs every frame in smooth mode, or four
 * times a second in stepped mode; the HUD is told four times a second.
 */
export class Environment {
  constructor({ renderer, hud, startMinutes, biomeAtPlayer, onTimeChanged }) {
    this.renderer = renderer;
    this.hud = hud;
    this.biomeAtPlayer = biomeAtPlayer;
    this.onTimeChanged = onTimeChanged;
    this.totalMinutes = Number.isFinite(startMinutes) ? Math.max(0, startMinutes) : 1058;
    this.visualClock = Infinity;
    this.publishClock = Infinity;
    this.frozen = false;
    this.weatherOverride = null;
    this.timeScaleIndex = TIME_SCALES.indexOf(1);
    this.timeModeIndex = 0;
    this.current = sampleEnvironment(this.totalMinutes, this.biomeAtPlayer());
    this.refresh(true);
  }

  get worldMinutes() {
    return this.totalMinutes;
  }
  get sample() {
    return this.current;
  }
  get isFrozen() {
    return this.frozen;
  }
  get weatherMode() {
    return this.weatherOverride?.toUpperCase() ?? 'AUTO';
  }
  get timeScale() {
    return TIME_SCALES[this.timeScaleIndex];
  }
  get timeUpdateMode() {
    return TIME_MODES[this.timeModeIndex];
  }

  update(dt) {
    const step = Number.isFinite(dt) ? Math.max(0, Math.min(dt, 0.1)) : 0;
    if (!this.frozen) this.totalMinutes += step * 0.82 * this.timeScale;
    this.visualClock += step;
    this.publishClock += step;
    this.refresh();
  }

  advance(minutes) {
    if (Number.isFinite(minutes)) this.totalMinutes = Math.max(0, Math.min(9999999, this.totalMinutes + minutes));
    this.refresh(true);
  }

  setMinutes(minutes) {
    if (Number.isFinite(minutes)) this.totalMinutes = Math.max(0, Math.min(9999999, minutes));
    this.refresh(true);
  }

  setTimeOfDay(minuteOfDay) {
    if (!Number.isFinite(minuteOfDay)) return;
    const dayStart = Math.floor(this.totalMinutes / MINUTES_PER_DAY) * MINUTES_PER_DAY;
    this.totalMinutes = dayStart + Math.max(0, Math.min(1439, Math.floor(minuteOfDay)));
    this.refresh(true);
  }

  toggleFreeze() {
    this.frozen = !this.frozen;
    this.refresh(true);
    return this.frozen;
  }

  cycleTimeScale() {
    this.timeScaleIndex = (this.timeScaleIndex + 1) % TIME_SCALES.length;
    return this.timeScale;
  }

  setTimeScale(scale) {
    const index = TIME_SCALES.indexOf(scale);
    if (index >= 0) this.timeScaleIndex = index;
    return this.timeScale;
  }

  cycleTimeUpdateMode() {
    this.timeModeIndex = (this.timeModeIndex + 1) % TIME_MODES.length;
    this.refresh(true);
    return this.timeUpdateMode;
  }

  setWeatherOverride(id) {
    this.weatherOverride = id;
    this.refresh(true);
    return this.weatherMode;
  }

  cycleWeatherOverride() {
    const index = this.weatherOverride === null ? -1 : WEATHER_IDS.indexOf(this.weatherOverride);
    this.weatherOverride = index >= WEATHER_IDS.length - 1 ? null : WEATHER_IDS[index + 1];
    this.refresh(true);
    return this.weatherMode;
  }

  refresh(force = false) {
    if (!(force || this.timeUpdateMode === 'smooth' || this.visualClock >= STEP_SECONDS)) return;
    this.visualClock = 0;
    const sample = sampleEnvironment(this.totalMinutes, this.biomeAtPlayer());
    this.current = this.weatherOverride ? withWeather(sample, this.weatherOverride) : sample;
    this.renderer.setEnvironment(this.current);
    if (!force && this.publishClock < STEP_SECONDS) return;
    this.publishClock = 0;
    this.hud.setEnvironment({
      time: formatWorldTime(this.current),
      weather: this.current.weatherLabel,
      temperature: `${Math.round(this.current.temperatureC)}°C`,
      wind: `${Math.round(this.current.windKph)} KM/H`,
      phase: this.current.phase,
    });
    this.onTimeChanged?.(this.totalMinutes);
  }
}
