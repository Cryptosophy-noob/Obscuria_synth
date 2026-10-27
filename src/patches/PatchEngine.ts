
import {
  DEFAULT_SYNTH_PARAMS,
  type SynthParams,
  type Waveform,
} from "../audio/ObscuriaSynth";

export type PatchCategory =
  | "bass"
  | "lead"
  | "pad"
  | "drone"
  | "fx"
  | "experimental";

export interface PatchDNA {
  oscillatorBalance: number;
  harmonicity: number;
  filterCharacter: number;
  modulationDepth: number;
  envelopeShape: number;
  instability: number;
}

export interface SynthPatch {
  id: string;
  name: string;
  category: PatchCategory;
  description: string;
  params: SynthParams;
  dna: PatchDNA;
  createdAt: string;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

const randomBetween = (min: number, max: number): number =>
  min + Math.random() * (max - min);

const randomChoice = <T,>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)];

const randomId = (): string =>
  `patch-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

const randomWaveform = (): Waveform =>
  randomChoice<Waveform>(["sawtooth", "square", "triangle", "sine"]);

const randomDNA = (): PatchDNA => ({
  oscillatorBalance: randomBetween(0, 1),
  harmonicity: randomBetween(0, 1),
  filterCharacter: randomBetween(0, 1),
  modulationDepth: randomBetween(0, 1),
  envelopeShape: randomBetween(0, 1),
  instability: randomBetween(0, 1),
});

const cloneParams = (params: SynthParams): SynthParams => ({
  ...params,
});

const validCategories: PatchCategory[] = [
  "bass",
  "lead",
  "pad",
  "drone",
  "fx",
  "experimental",
];

export class PatchEngine {
  createPatch(
    name: string,
    category: PatchCategory,
    params: SynthParams,
    description = "",
    dna = randomDNA(),
  ): SynthPatch {
    return {
      id: randomId(),
      name,
      category,
      description,
      params: cloneParams(params),
      dna: { ...dna },
      createdAt: new Date().toISOString(),
    };
  }

  createDefaultPatch(): SynthPatch {
    return this.createPatch(
      "Init",
      "experimental",
      { ...DEFAULT_SYNTH_PARAMS },
      "Suono iniziale con parametri predefiniti.",
      {
        oscillatorBalance: 0.5,
        harmonicity: 0.5,
        filterCharacter: 0.5,
        modulationDepth: 0,
        envelopeShape: 0.5,
        instability: 0,
      },
    );
  }

  applyPatch(
    patch: SynthPatch,
    setParams: (params: SynthParams) => void,
  ): void {
    setParams(cloneParams(patch.params));
  }

  mutatePatch(
    source: SynthPatch,
    intensity = 0.2,
    name?: string,
  ): SynthPatch {
    const amount = clamp(intensity, 0, 1);
    const original = source.params;

    const vary = (
      value: number,
      min: number,
      max: number,
    ): number =>
      clamp(
        value + randomBetween(-1, 1) * (max - min) * amount,
        min,
        max,
      );

    const params: SynthParams = {
      waveform: Math.random() < amount
        ? randomWaveform()
        : original.waveform,

      octave: Math.random() < amount * 0.5
        ? randomChoice([-2, -1, 0, 1, 2])
        : original.octave,

      detune: vary(original.detune, -100, 100),
      subLevel: vary(original.subLevel, 0, 1),
      cutoff: vary(original.cutoff, 40, 18000),
      resonance: vary(original.resonance, 0.1, 20),
      attack: vary(original.attack, 0.001, 5),
      decay: vary(original.decay, 0.01, 5),
      sustain: vary(original.sustain, 0, 1),
      release: vary(original.release, 0.01, 8),
      volume: vary(original.volume, 0, 1),
      lfoRate: vary(original.lfoRate, 0.05, 30),
      lfoDepth: vary(original.lfoDepth, 0, 1),

      lfoTarget: Math.random() < amount
        ? randomChoice(["filter", "pitch"] as const)
        : original.lfoTarget,

      pulseWidth: vary(original.pulseWidth, 0.05, 0.95),
    };

    const dna: PatchDNA = {
      oscillatorBalance: clamp(
        source.dna.oscillatorBalance + randomBetween(-amount, amount),
        0,
        1,
      ),
      harmonicity: clamp(
        source.dna.harmonicity + randomBetween(-amount, amount),
        0,
        1,
      ),
      filterCharacter: clamp(
        source.dna.filterCharacter + randomBetween(-amount, amount),
        0,
        1,
      ),
      modulationDepth: clamp(
        source.dna.modulationDepth + randomBetween(-amount, amount),
        0,
        1,
      ),
      envelopeShape: clamp(
        source.dna.envelopeShape + randomBetween(-amount, amount),
        0,
        1,
      ),
      instability: clamp(
        source.dna.instability + randomBetween(-amount, amount),
        0,
        1,
      ),
    };

    return this.createPatch(
      name ?? `${source.name} Mutant`,
      source.category,
      params,
      `Mutazione di ${source.name}, intensità ${Math.round(amount * 100)}%.`,
      dna,
    );
  }

  generatePatch(
    category: PatchCategory = "experimental",
    name?: string,
  ): SynthPatch {
    const params: SynthParams = { ...DEFAULT_SYNTH_PARAMS };

    params.waveform = category === "bass"
      ? randomChoice<Waveform>(["square", "sawtooth"])
      : category === "pad"
        ? randomChoice<Waveform>(["triangle", "sine"])
        : category === "fx"
          ? randomWaveform()
          : randomChoice<Waveform>(["sawtooth", "square", "triangle"]);

    params.octave = category === "bass"
      ? randomChoice([-2, -1, 0])
      : category === "lead"
        ? randomChoice([0, 1, 2])
        : 0;

    params.detune = category === "drone"
      ? randomBetween(-35, 35)
      : randomBetween(-15, 15);

    params.subLevel = category === "bass"
      ? randomBetween(0.45, 0.9)
      : randomBetween(0.02, 0.35);

    params.cutoff = category === "bass"
      ? randomBetween(80, 1200)
      : category === "pad"
        ? randomBetween(500, 6000)
        : randomBetween(150, 10000);

    params.resonance = randomBetween(0.2, 12);

    params.attack = category === "pad"
      ? randomBetween(0.4, 3)
      : category === "drone"
        ? randomBetween(1, 4)
        : randomBetween(0.001, 0.15);

    params.decay = randomBetween(0.1, 2.5);

    params.sustain = category === "fx"
      ? randomBetween(0.05, 0.5)
      : randomBetween(0.25, 0.9);

    params.release = category === "pad" || category === "drone"
      ? randomBetween(1, 6)
      : randomBetween(0.1, 2);

    params.volume = 0.65;
    params.lfoRate = randomBetween(0.1, 12);

    params.lfoDepth =
      category === "experimental" || category === "fx"
        ? randomBetween(0.3, 1)
        : randomBetween(0.05, 0.6);

    params.lfoTarget = randomChoice(["filter", "pitch"] as const);
    params.pulseWidth = randomBetween(0.15, 0.85);

    return this.createPatch(
      name ?? `${category.toUpperCase()} ${Math.floor(Math.random() * 900 + 100)}`,
      category,
      params,
      `Patch generata proceduralmente: categoria ${category}.`,
      randomDNA(),
    );
  }

  serialize(patch: SynthPatch): string {
    return JSON.stringify(patch, null, 2);
  }

  deserialize(json: string): SynthPatch {
    const parsed: unknown = JSON.parse(json);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("params" in parsed) ||
      !("name" in parsed) ||
      !("category" in parsed)
    ) {
      throw new Error("File patch non valido.");
    }

    const candidate = parsed as Partial<SynthPatch>;

    if (
      typeof candidate.name !== "string" ||
      typeof candidate.category !== "string" ||
      typeof candidate.params !== "object" ||
      candidate.params === null
    ) {
      throw new Error("La struttura della patch è incompleta.");
    }

    if (!validCategories.includes(candidate.category as PatchCategory)) {
      throw new Error("Categoria della patch non riconosciuta.");
    }

    const rawParams = candidate.params as unknown as Record<string, unknown>;
    const defaults = DEFAULT_SYNTH_PARAMS;

    const numericKeys = [
      "octave",
      "detune",
      "subLevel",
      "cutoff",
      "resonance",
      "attack",
      "decay",
      "sustain",
      "release",
      "volume",
      "lfoRate",
      "lfoDepth",
      "pulseWidth",
    ] as const;

    for (const key of numericKeys) {
      if (
        typeof rawParams[key] !== "number" ||
        !Number.isFinite(rawParams[key])
      ) {
        throw new Error(`Parametro numerico non valido: ${key}`);
      }
    }

    const waveforms: Waveform[] = [
      "sawtooth",
      "square",
      "triangle",
      "sine",
    ];

    if (
      typeof rawParams.waveform !== "string" ||
      !waveforms.includes(rawParams.waveform as Waveform)
    ) {
      throw new Error("Forma d'onda non valida.");
    }

    if (
      rawParams.lfoTarget !== "filter" &&
      rawParams.lfoTarget !== "pitch"
    ) {
      throw new Error("Destinazione LFO non valida.");
    }

    const params: SynthParams = {
      ...defaults,
      ...(rawParams as unknown as SynthParams),
    };

    const rawDNA = candidate.dna;

    const dna: PatchDNA =
      rawDNA &&
      typeof rawDNA === "object" &&
      typeof rawDNA.oscillatorBalance === "number" &&
      typeof rawDNA.harmonicity === "number" &&
      typeof rawDNA.filterCharacter === "number" &&
      typeof rawDNA.modulationDepth === "number" &&
      typeof rawDNA.envelopeShape === "number" &&
      typeof rawDNA.instability === "number"
        ? { ...rawDNA }
        : randomDNA();

    return {
      id: typeof candidate.id === "string" ? candidate.id : randomId(),
      name: candidate.name,
      category: candidate.category as PatchCategory,
      description: typeof candidate.description === "string"
        ? candidate.description
        : "",
      params,
      dna,
      createdAt: typeof candidate.createdAt === "string"
        ? candidate.createdAt
        : new Date().toISOString(),
    };
  }
}
