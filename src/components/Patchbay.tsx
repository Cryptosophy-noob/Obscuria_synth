import { useRef, useState } from "react";
import {
  PatchEngine,
  type PatchCategory,
  type SynthPatch,
} from "../patches/PatchEngine";
import { FACTORY_PRESETS } from "../patches/presets";

interface PatchBayProps {
  activePatch: SynthPatch;
  onSelectPatch: (patch: SynthPatch) => void;
}

const engine = new PatchEngine();

const categories: { value: PatchCategory; label: string }[] = [
  { value: "bass", label: "BASS" },
  { value: "lead", label: "LEAD" },
  { value: "pad", label: "PAD" },
  { value: "drone", label: "DRONE" },
  { value: "fx", label: "FX" },
  { value: "experimental", label: "EXPERIMENTAL" },
];

export default function PatchBay({
  activePatch,
  onSelectPatch,
}: PatchBayProps) {
  const [category, setCategory] =
    useState<PatchCategory>("experimental");
  const [mutationIntensity, setMutationIntensity] = useState(0.2);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const presetList = FACTORY_PRESETS;

  const selectPatch = (patch: SynthPatch) => {
    onSelectPatch(patch);
    setMessage(`PATCH LOADED: ${patch.name}`);
  };

  const generate = () => {
    const patch = engine.generatePatch(category);
    selectPatch(patch);
  };

  const mutate = () => {
    const patch = engine.mutatePatch(
      activePatch,
      mutationIntensity,
    );
    selectPatch(patch);
  };

  const resetPatch = () => {
    selectPatch(engine.createDefaultPatch());
  };

  const exportPatch = () => {
    const json = engine.serialize(activePatch);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `${activePatch.name
      .trim()
      .replace(/[^a-z0-9-_]+/gi, "-")
      .toLowerCase() || "obscuria-patch"}.json`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    setMessage("PATCH EXPORTED");
  };

  const importPatch = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const json = await file.text();
      const patch = engine.deserialize(json);
      selectPatch(patch);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `IMPORT ERROR: ${error.message}`
          : "IMPORT ERROR: FILE NON VALIDO",
      );
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="patch-bay">
      <header className="patch-bay__header">
        <div>
          <div className="patch-bay__eyebrow">OBSCURIA / PATCH SYSTEM</div>
          <h2 className="patch-bay__title">Patch Matrix</h2>
        </div>

        <div className="patch-bay__active">
          <span className="patch-bay__active-dot" />
          <div>
            <span className="patch-bay__active-label">ACTIVE PATCH</span>
            <strong>{activePatch.name}</strong>
          </div>
        </div>
      </header>

      <section className="patch-bay__generator">
        <div className="patch-bay__section-heading">
          <span>01</span>
          <h3>GENETIC SYNTHESIS</h3>
        </div>

        <label className="patch-bay__field">
          <span>Patch category</span>
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as PatchCategory)
            }
            className="patch-bay__select"
          >
            {categories.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          className="patch-bay__button patch-bay__button--primary"
          onClick={generate}
        >
          <span className="patch-bay__button-symbol">✳</span>
          GENERATE PATCH
        </button>

        <div className="patch-bay__divider" />

        <div className="patch-bay__mutation-heading">
          <span className="patch-bay__field-label">Mutation intensity</span>
          <strong>{Math.round(mutationIntensity * 100)}%</strong>
        </div>

        <input
          className="patch-bay__range"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={mutationIntensity}
          onChange={(event) =>
            setMutationIntensity(Number(event.target.value))
          }
          aria-label="Mutation intensity"
        />

        <div className="patch-bay__range-labels">
          <span>SUBTLE</span>
          <span>EXTREME</span>
        </div>

        <button
          type="button"
          className="patch-bay__button"
          onClick={mutate}
        >
          MUTATE ACTIVE PATCH
        </button>
      </section>

      <section className="patch-bay__presets">
        <div className="patch-bay__section-heading">
          <span>02</span>
          <h3>FACTORY PRESETS</h3>
          <span className="patch-bay__count">
            {presetList.length.toString().padStart(2, "0")}
          </span>
        </div>

        {presetList.length > 0 ? (
          <div className="patch-bay__preset-list">
            {presetList.map((patch) => {
              const selected = patch.id === activePatch.id;

              return (
                <button
                  type="button"
                  key={patch.id}
                  className={`patch-bay__preset ${
                    selected ? "patch-bay__preset--active" : ""
                  }`}
                  onClick={() => selectPatch(patch)}
                  aria-pressed={selected}
                >
                  <span className="patch-bay__preset-indicator" />
                  <span className="patch-bay__preset-info">
                    <strong>{patch.name}</strong>
                    <small>{patch.category.toUpperCase()}</small>
                  </span>
                  <span className="patch-bay__preset-arrow">↗</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="patch-bay__empty">
            Nessun preset disponibile.
          </p>
        )}
      </section>

      <section className="patch-bay__dna">
        <div className="patch-bay__section-heading">
          <span>03</span>
          <h3>PATCH DNA</h3>
        </div>

        <div className="patch-bay__dna-list">
          {(
            [
              ["Oscillator balance", activePatch.dna.oscillatorBalance],
              ["Harmonicity", activePatch.dna.harmonicity],
              ["Filter character", activePatch.dna.filterCharacter],
              ["Modulation", activePatch.dna.modulationDepth],
              ["Envelope shape", activePatch.dna.envelopeShape],
              ["Instability", activePatch.dna.instability],
            ] as const
          ).map(([label, value]) => (
            <div className="patch-bay__dna-row" key={label}>
              <span>{label}</span>
              <div className="patch-bay__dna-track">
                <span
                  className="patch-bay__dna-fill"
                  style={{
                    width: `${Math.max(0, Math.min(1, value)) * 100}%`,
                  }}
                />
              </div>
              <strong>{Math.round(value * 100)}</strong>
            </div>
          ))}
        </div>
        <p className="patch-bay__hint">
          DNA descrittivo della patch. I valori rappresentano il profilo
          generativo, non controlli audio indipendenti.
        </p>
      </section>

      <footer className="patch-bay__footer">
        <button
          type="button"
          className="patch-bay__button patch-bay__button--small"
          onClick={resetPatch}
        >
          INIT
        </button>

        <button
          type="button"
          className="patch-bay__button patch-bay__button--small"
          onClick={() => fileInputRef.current?.click()}
        >
          IMPORT JSON
        </button>

        <button
          type="button"
          className="patch-bay__button patch-bay__button--small"
          onClick={exportPatch}
        >
          EXPORT JSON
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={importPatch}
        />
      </footer>

      <div className="patch-bay__message" role="status" aria-live="polite">
        {message || "PATCH ENGINE READY"}
      </div>
    </div>
  );
}
