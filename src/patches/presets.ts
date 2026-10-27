
import {
  DEFAULT_SYNTH_PARAMS,
  type SynthParams,
} from "../audio/ObscuriaSynth";

import {
  type PatchCategory,
  type SynthPatch,
} from "./PatchEngine";

const makeParams = (
  overrides: Partial<SynthParams>,
): SynthParams => ({
  ...DEFAULT_SYNTH_PARAMS,
  ...overrides,
});

const makePreset = (
  id: string,
  name: string,
  category: PatchCategory,
  description: string,
  params: SynthParams,
  dna: SynthPatch["dna"],
): SynthPatch => ({
  id,
  name,
  category,
  description,
  params,
  dna,
  createdAt: "2026-01-01T00:00:00.000Z",
});

export const FACTORY_PRESETS: SynthPatch[] = [
  makePreset(
    "factory-subzero",
    "Subzero",
    "bass",
    "Basso compatto, scuro e centrato sulle basse frequenze.",
    makeParams({
      waveform: "square",
      octave: -1,
      detune: -5,
      subLevel: 0.7,
      cutoff: 220,
      resonance: 2.2,
      attack: 0.005,
      decay: 0.35,
      sustain: 0.55,
      release: 0.12,
      volume: 0.7,
      lfoRate: 2.2,
      lfoDepth: 0.08,
      lfoTarget: "filter",
      pulseWidth: 0.5,
    }),
    {
      oscillatorBalance: 0.62,
      harmonicity: 0.72,
      filterCharacter: 0.18,
      modulationDepth: 0.08,
      envelopeShape: 0.22,
      instability: 0.12,
    },
  ),

  makePreset(
    "factory-acid-wire",
    "Acid Wire",
    "lead",
    "Lead aggressivo con risonanza marcata e filtro dinamico.",
    makeParams({
      waveform: "sawtooth",
      octave: 1,
      detune: 8,
      subLevel: 0.12,
      cutoff: 850,
      resonance: 8.5,
      attack: 0.008,
      decay: 0.28,
      sustain: 0.25,
      release: 0.18,
      volume: 0.65,
      lfoRate: 4.8,
      lfoDepth: 0.22,
      lfoTarget: "filter",
      pulseWidth: 0.5,
    }),
    {
      oscillatorBalance: 0.55,
      harmonicity: 0.82,
      filterCharacter: 0.72,
      modulationDepth: 0.25,
      envelopeShape: 0.28,
      instability: 0.3,
    },
  ),

  makePreset(
    "factory-frost",
    "Frost",
    "pad",
    "Tessitura morbida, attacco lento e rilascio ampio.",
    makeParams({
      waveform: "triangle",
      octave: 0,
      detune: 12,
      subLevel: 0.08,
      cutoff: 3200,
      resonance: 0.8,
      attack: 1.4,
      decay: 1.8,
      sustain: 0.72,
      release: 3.5,
      volume: 0.65,
      lfoRate: 0.22,
      lfoDepth: 0.16,
      lfoTarget: "filter",
      pulseWidth: 0.5,
    }),
    {
      oscillatorBalance: 0.46,
      harmonicity: 0.4,
      filterCharacter: 0.42,
      modulationDepth: 0.18,
      envelopeShape: 0.82,
      instability: 0.22,
    },
  ),

  makePreset(
    "factory-iron-orbit",
    "Iron Orbit",
    "drone",
    "Drone denso con oscillatori leggermente disaccordati.",
    makeParams({
      waveform: "sawtooth",
      octave: -1,
      detune: -18,
      subLevel: 0.22,
      cutoff: 1250,
      resonance: 3.4,
      attack: 2.2,
      decay: 1.5,
      sustain: 0.8,
      release: 4.5,
      volume: 0.6,
      lfoRate: 0.13,
      lfoDepth: 0.3,
      lfoTarget: "pitch",
      pulseWidth: 0.5,
    }),
    {
      oscillatorBalance: 0.5,
      harmonicity: 0.68,
      filterCharacter: 0.4,
      modulationDepth: 0.34,
      envelopeShape: 0.9,
      instability: 0.52,
    },
  ),

  makePreset(
    "factory-black-glass",
    "Black Glass",
    "fx",
    "Timbro instabile e risonante, adatto a transizioni sonore.",
    makeParams({
      waveform: "square",
      octave: 0,
      detune: 24,
      subLevel: 0.05,
      cutoff: 4600,
      resonance: 11,
      attack: 0.04,
      decay: 2.4,
      sustain: 0.12,
      release: 2.8,
      volume: 0.55,
      lfoRate: 7.2,
      lfoDepth: 0.72,
      lfoTarget: "filter",
      pulseWidth: 0.25,
    }),
    {
      oscillatorBalance: 0.44,
      harmonicity: 0.92,
      filterCharacter: 0.88,
      modulationDepth: 0.76,
      envelopeShape: 0.32,
      instability: 0.78,
    },
  ),
];

export const getPresetById = (
  id: string,
): SynthPatch | undefined =>
  FACTORY_PRESETS.find((preset) => preset.id === id);

export const getPresetsByCategory = (
  category: PatchCategory,
): SynthPatch[] =>
  FACTORY_PRESETS.filter((preset) => preset.category === category);
