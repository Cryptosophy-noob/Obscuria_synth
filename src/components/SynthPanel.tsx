
import type { SynthParams, Waveform } from "../audio/ObscuriaSynth";

interface SynthPanelProps {
  params: SynthParams;
  onParamsChange: (next: Partial<SynthParams>) => void;
}

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  displayValue?: string;
  onChange: (value: number) => void;
}

function Knob({
  label,
  value,
  min,
  max,
  step = 0.01,
  unit = "",
  displayValue,
  onChange,
}: KnobProps) {
  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <label className="synth-control">
      <span className="synth-control__label">{label}</span>

      <span className="synth-control__value">
        {displayValue ?? `${value}${unit}`}
      </span>

      <input
        className="synth-control__slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ "--control-progress": `${percentage}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

interface SectionProps {
  title: string;
  number: string;
  children: React.ReactNode;
}

function Section({ title, number, children }: SectionProps) {
  return (
    <section className="synth-section">
      <div className="synth-section__heading">
        <span className="synth-section__number">{number}</span>
        <h3>{title}</h3>
      </div>
      <div className="synth-section__content">{children}</div>
    </section>
  );
}

export default function SynthPanel({
  params,
  onParamsChange,
}: SynthPanelProps) {
  const update = <K extends keyof SynthParams>(
    key: K,
    value: SynthParams[K],
  ) => {
    onParamsChange({ [key]: value } as Pick<SynthParams, K>);
  };

  const waveforms: { value: Waveform; label: string }[] = [
    { value: "sawtooth", label: "SAW" },
    { value: "square", label: "SQUARE" },
    { value: "triangle", label: "TRIANGLE" },
    { value: "sine", label: "SINE" },
  ];

  return (
    <div className="synth-panel">
      <header className="synth-panel__header">
        <div>
          <div className="synth-panel__eyebrow">
            OBSCURIA / VOICE ENGINE
          </div>
          <h2 className="synth-panel__title">Analog Voice</h2>
        </div>

        <div className="synth-panel__status">
          <span className="synth-panel__status-light" />
          SYNTH MODULE
        </div>
      </header>

      <div className="synth-panel__body">
        <Section title="Oscillator" number="01">
          <div className="synth-control-group">
            <span className="synth-control__label">Waveform</span>
            <div className="synth-waveforms">
              {waveforms.map((wave) => (
                <button
                  key={wave.value}
                  type="button"
                  className={`synth-waveform ${
                    params.waveform === wave.value
                      ? "synth-waveform--active"
                      : ""
                  }`}
                  aria-pressed={params.waveform === wave.value}
                  onClick={() => update("waveform", wave.value)}
                >
                  {wave.label}
                </button>
              ))}
            </div>
          </div>

          <Knob
            label="Octave"
            value={params.octave}
            min={-2}
            max={2}
            step={1}
            displayValue={`${params.octave > 0 ? "+" : ""}${params.octave}`}
            onChange={(value) => update("octave", value)}
          />

          <Knob
            label="Detune"
            value={params.detune}
            min={-50}
            max={50}
            step={1}
            unit=" ct"
            onChange={(value) => update("detune", value)}
          />

          <Knob
            label="Sub level"
            value={params.subLevel}
            min={0}
            max={1}
            step={0.01}
            displayValue={`${Math.round(params.subLevel * 100)}%`}
            onChange={(value) => update("subLevel", value)}
          />
        </Section>

        <Section title="Filter" number="02">
          <Knob
            label="Cutoff"
            value={params.cutoff}
            min={20}
            max={20000}
            step={10}
            displayValue={
              params.cutoff >= 1000
                ? `${(params.cutoff / 1000).toFixed(2)} kHz`
                : `${Math.round(params.cutoff)} Hz`
            }
            onChange={(value) => update("cutoff", value)}
          />

          <Knob
            label="Resonance"
            value={params.resonance}
            min={0.1}
            max={20}
            step={0.1}
            displayValue={params.resonance.toFixed(1)}
            onChange={(value) => update("resonance", value)}
          />

          <div className="synth-filter-note">
            LOW-PASS / 24 dB STYLE
          </div>
        </Section>

        <Section title="Envelope" number="03">
          <Knob
            label="Attack"
            value={params.attack}
            min={0.001}
            max={3}
            step={0.001}
            displayValue={`${Math.round(params.attack * 1000)} ms`}
            onChange={(value) => update("attack", value)}
          />

          <Knob
            label="Decay"
            value={params.decay}
            min={0.001}
            max={3}
            step={0.001}
            displayValue={`${params.decay.toFixed(2)} s`}
            onChange={(value) => update("decay", value)}
          />

          <Knob
            label="Sustain"
            value={params.sustain}
            min={0}
            max={1}
            step={0.01}
            displayValue={`${Math.round(params.sustain * 100)}%`}
            onChange={(value) => update("sustain", value)}
          />

          <Knob
            label="Release"
            value={params.release}
            min={0.01}
            max={5}
            step={0.01}
            displayValue={`${params.release.toFixed(2)} s`}
            onChange={(value) => update("release", value)}
          />
        </Section>

        <Section title="LFO" number="04">
          <Knob
            label="Rate"
            value={params.lfoRate}
            min={0.1}
            max={20}
            step={0.1}
            displayValue={`${params.lfoRate.toFixed(1)} Hz`}
            onChange={(value) => update("lfoRate", value)}
          />

          <Knob
            label="Depth"
            value={params.lfoDepth}
            min={0}
            max={1000}
            step={1}
            displayValue={`${params.lfoDepth}`}
            onChange={(value) => update("lfoDepth", value)}
          />

          <div className="synth-control-group">
            <label className="synth-control__label" htmlFor="lfo-target">
              Modulation target
            </label>
            <select
              id="lfo-target"
              className="synth-select"
              value={params.lfoTarget}
              onChange={(event) =>
                update(
                  "lfoTarget",
                  event.target.value as SynthParams["lfoTarget"],
                )
              }
            >
              <option value="filter">FILTER</option>
              <option value="pitch">PITCH</option>
            </select>
          </div>
        </Section>
      </div>

      <footer className="synth-panel__footer">
        <div className="synth-master">
          <div className="synth-master__heading">
            <span>MASTER LEVEL</span>
            <strong>{Math.round(params.volume * 100)}%</strong>
          </div>
          <Knob
            label="Output volume"
            value={params.volume}
            min={0}
            max={1}
            step={0.01}
            displayValue={`${Math.round(params.volume * 100)}%`}
            onChange={(value) => update("volume", value)}
          />
        </div>

        <div className="synth-panel__footer-mark">
          OBSCURIA
          <span>MODULAR SOUND SYSTEM</span>
        </div>
      </footer>
    </div>
  );
}
