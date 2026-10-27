
import { useState } from "react";
import {
  DrumMachine,
  type DrumParams,
  type DrumVoice,
} from "../audio/DrumMachine";

interface DrumPanelProps {
  drumMachine: DrumMachine;
}

const VOICES: {
  id: DrumVoice;
  name: string;
  description: string;
  parameters: {
    key: keyof DrumParams;
    label: string;
    min: number;
    max: number;
    step: number;
    unit: string;
  }[];
}[] = [
  {
    id: "kick",
    name: "KICK",
    description: "LOW FREQUENCY PERCUSSION",
    parameters: [
      { key: "kickPitch", label: "PITCH", min: 30, max: 100, step: 1, unit: "Hz" },
      { key: "kickDecay", label: "DECAY", min: 0.04, max: 1.2, step: 0.01, unit: "s" },
      { key: "kickDrive", label: "DRIVE", min: 0.1, max: 8, step: 0.1, unit: "x" },
    ],
  },
  {
    id: "snare",
    name: "SNARE",
    description: "NOISE + TONAL BODY",
    parameters: [
      { key: "snareTone", label: "TONE", min: 500, max: 10000, step: 100, unit: "Hz" },
      { key: "snareDecay", label: "DECAY", min: 0.04, max: 0.8, step: 0.01, unit: "s" },
    ],
  },
  {
    id: "hat",
    name: "HI-HAT",
    description: "SYNTHETIC HIGH FREQUENCIES",
    parameters: [
      { key: "hatTone", label: "TONE", min: 3000, max: 16000, step: 100, unit: "Hz" },
      { key: "hatDecay", label: "DECAY", min: 0.015, max: 0.5, step: 0.005, unit: "s" },
    ],
  },
];

export default function DrumPanel({ drumMachine }: DrumPanelProps) {
  const [params, setParams] = useState<DrumParams>(
    () => drumMachine.getParams(),
  );

  const updateParameter = (key: keyof DrumParams, value: number) => {
    const next = { ...params, [key]: value };
    drumMachine.setParams({ [key]: value });
    setParams(next);
  };

  const trigger = (voice: DrumVoice) => {
    drumMachine.trigger(voice);
  };

  return (
    <section className="drum-panel">
      <header className="panel-header">
        <div>
          <span className="panel-kicker">PERCUSSION SYNTHESIS</span>
          <h2>DRUM MACHINE</h2>
        </div>

        <label className="drum-master">
          <span>DRUM MASTER</span>
          <strong>{Math.round(params.volume * 100)}%</strong>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={params.volume}
            onChange={(event) =>
              updateParameter("volume", Number(event.target.value))
            }
          />
        </label>
      </header>

      <div className="drum-voice-grid">
        {VOICES.map((voice) => (
          <article className="drum-voice" key={voice.id}>
            <div className="drum-voice-header">
              <div className="drum-voice-badge">
                {voice.id === "kick" ? "BD" : voice.id === "snare" ? "SD" : "HH"}
              </div>

              <div>
                <h3>{voice.name}</h3>
                <p>{voice.description}</p>
              </div>
            </div>

            <button
              type="button"
              className="drum-trigger"
              onClick={() => trigger(voice.id)}
            >
              TRIGGER
            </button>

            {voice.parameters.map((parameter) => {
              const value = params[parameter.key];

              return (
                <label className="drum-control" key={parameter.key}>
                  <span>{parameter.label}</span>
                  <strong>
                    {parameter.key.toLowerCase().includes("decay")
                      ? value.toFixed(3).replace(/0+$/, "").replace(/\.$/, "")
                      : Number(value.toFixed(2))}
                    {parameter.unit === "Hz"
                      ? " Hz"
                      : parameter.unit === "s"
                        ? " s"
                        : parameter.unit === "x"
                          ? "x"
                          : ""}
                  </strong>

                  <input
                    type="range"
                    min={parameter.min}
                    max={parameter.max}
                    step={parameter.step}
                    value={value}
                    onChange={(event) =>
                      updateParameter(
                        parameter.key,
                        Number(event.target.value),
                      )
                    }
                  />
                </label>
              );
            })}
          </article>
        ))}
      </div>

      <footer className="drum-panel-footer">
        <span>3 SYNTHETIC VOICES</span>
        <span>REAL-TIME AUDIO</span>
        <span>NO EXTERNAL SAMPLES</span>
      </footer>
    </section>
  );
}
