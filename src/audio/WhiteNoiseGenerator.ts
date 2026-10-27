export interface WhiteNoiseParams {
  volume: number;
  cutoff: number;
}

export const DEFAULT_WHITE_NOISE_PARAMS: WhiteNoiseParams = {
  volume: 0,
  cutoff: 12000,
};

/** Continuous white-noise source routed into the instrument's master bus. */
export class WhiteNoiseGenerator {
  private context: AudioContext;
  private source: AudioBufferSourceNode;
  private filter: BiquadFilterNode;
  private gain: GainNode;
  private params = { ...DEFAULT_WHITE_NOISE_PARAMS };
  private disposed = false;

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;

    const buffer = context.createBuffer(
      1,
      Math.max(1, Math.floor(context.sampleRate * 2)),
      context.sampleRate,
    );

    const data = buffer.getChannelData(0);

    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    this.source = context.createBufferSource();
    this.source.buffer = buffer;
    this.source.loop = true;

    this.filter = context.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = this.params.cutoff;
    this.filter.Q.value = 0.2;

    this.gain = context.createGain();
    this.gain.gain.value = this.params.volume;

    this.source.connect(this.filter);
    this.filter.connect(this.gain);
    this.gain.connect(destination);

    this.source.start();
  }

  getParams(): WhiteNoiseParams {
    return { ...this.params };
  }

  setParams(next: Partial<WhiteNoiseParams>): void {
    this.params = {
      volume: Math.max(
        0,
        Math.min(1, next.volume ?? this.params.volume),
      ),
      cutoff: Math.max(
        100,
        Math.min(20000, next.cutoff ?? this.params.cutoff),
      ),
    };

    const now = this.context.currentTime;

    this.gain.gain.setTargetAtTime(
      this.params.volume,
      now,
      0.015,
    );

    this.filter.frequency.setTargetAtTime(
      this.params.cutoff,
      now,
      0.015,
    );
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;

    try {
      this.source.stop();
    } catch {
      // La sorgente è già ferma.
    }

    this.source.disconnect();
    this.filter.disconnect();
    this.gain.disconnect();
  }
}