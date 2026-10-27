import type { WhiteNoiseParams } from "../audio/WhiteNoiseGenerator";

export type ArpeggiatorMode = "up" | "down" | "updown" | "random";

interface PerformancePanelProps {
  noiseParams: WhiteNoiseParams;
  onNoiseChange: (next: Partial<WhiteNoiseParams>) => void;
  arpEnabled: boolean;
  onArpEnabledChange: (enabled: boolean) => void;
  arpMode: ArpeggiatorMode;
  onArpModeChange: (mode: ArpeggiatorMode) => void;
  arpDivision: 4 | 8 | 16;
  onArpDivisionChange: (division: 4 | 8 | 16) => void;
  arpOctaves: number;
  onArpOctavesChange: (octaves: number) => void;
  audioReady: boolean;
  wavExporting: boolean;
  wavBitDepth: 16 | 24;
  onWavBitDepthChange: (depth: 16 | 24) => void;
  onWavExport: () => void;
  wavMessage: string;
}

export default function PerformancePanel(props: PerformancePanelProps) {
  const {
    noiseParams, onNoiseChange, arpEnabled, onArpEnabledChange,
    arpMode, onArpModeChange, arpDivision, onArpDivisionChange,
    arpOctaves, onArpOctavesChange, audioReady, wavExporting,
    wavBitDepth, onWavBitDepthChange, onWavExport, wavMessage,
  } = props;

  return (
    <section className="performance-panel">
      <header className="panel-header">
        <div>
          <span className="panel-kicker">SOUND SOURCES / PERFORMANCE</span>
          <h2>Noise & Arpeggiator</h2>
        </div>
        <span className={`performance-led ${audioReady ? "is-ready" : ""}`} />
      </header>

      <div className="performance-panel__grid">
        <section className="performance-module">
          <div className="performance-module__title">
            <span className="performance-module__index">01</span>
            <div><h3>WHITE NOISE</h3><p>Continuous noise source</p></div>
          </div>
          <label className="performance-control">
            <span>LEVEL <strong>{Math.round(noiseParams.volume * 100)}%</strong></span>
            <input type="range" min="0" max="1" step="0.01" value={noiseParams.volume}
              onChange={(event) => onNoiseChange({ volume: Number(event.target.value) })} />
          </label>
          <label className="performance-control">
            <span>LOW-PASS CUTOFF <strong>{Math.round(noiseParams.cutoff)} Hz</strong></span>
            <input type="range" min="100" max="20000" step="100" value={noiseParams.cutoff}
              onChange={(event) => onNoiseChange({ cutoff: Number(event.target.value) })} />
          </label>
        </section>

        <section className="performance-module">
          <div className="performance-module__title">
            <span className="performance-module__index">02</span>
            <div><h3>ARPEGGIATOR</h3><p>Tempo-synchronized note cycling</p></div>
            <button type="button" className={`performance-toggle ${arpEnabled ? "is-on" : ""}`}
              aria-pressed={arpEnabled} onClick={() => onArpEnabledChange(!arpEnabled)}>
              {arpEnabled ? "ON" : "OFF"}
            </button>
          </div>
          <div className="performance-control-row">
            <label className="performance-control">
              <span>MODE</span>
              <select value={arpMode} onChange={(event) => onArpModeChange(event.target.value as ArpeggiatorMode)}>
                <option value="up">UP</option>
                <option value="down">DOWN</option>
                <option value="updown">UP / DOWN</option>
                <option value="random">RANDOM</option>
              </select>
            </label>
            <label className="performance-control">
              <span>RATE</span>
              <select value={arpDivision} onChange={(event) => onArpDivisionChange(Number(event.target.value) as 4 | 8 | 16)}>
                <option value={4}>1/4</option>
                <option value={8}>1/8</option>
                <option value={16}>1/16</option>
              </select>
            </label>
            <label className="performance-control">
              <span>OCTAVES <strong>{arpOctaves}</strong></span>
              <input type="range" min="1" max="4" step="1" value={arpOctaves}
                onChange={(event) => onArpOctavesChange(Number(event.target.value))} />
            </label>
          </div>
          <p className="performance-help">
            {arpEnabled
              ? "Tieni premute più note sulla tastiera per generare un arpeggio. Il REC registra le note effettivamente arpeggiate."
              : "Quando è attivo, le note tenute premute vengono arpeggiate al BPM del sequencer."}
          </p>
        </section>
      </div>

      <div className="wav-export-row">
        <div>
          <span className="panel-kicker">MASTER BUS CAPTURE</span>
          <strong>WAV EXPORT</strong>
          <p>{wavMessage || "Esporta una battuta del pattern, con coda audio inclusa."}</p>
        </div>
        <label className="wav-depth">
          <span>BIT DEPTH</span>
          <select value={wavBitDepth} onChange={(event) => onWavBitDepthChange(Number(event.target.value) as 16 | 24)}>
            <option value={16}>16-BIT</option>
            <option value={24}>24-BIT</option>
          </select>
        </label>
        <button type="button" className={`panel-action ${wavExporting ? "is-recording" : ""}`}
          disabled={!audioReady} onClick={onWavExport}>
          {wavExporting ? "STOP & DOWNLOAD" : "EXPORT PATTERN WAV"}
        </button>
      </div>
    </section>
  );
}
