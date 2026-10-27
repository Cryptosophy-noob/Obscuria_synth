
export interface WavExportOptions {
  bitDepth?: 16 | 24;
  sampleRate?: number;
  filename?: string;
}

export function encodeWav(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  bitDepth: 16 | 24 = 24,
): ArrayBuffer {
  if (left.length !== right.length) {
    throw new Error("I canali stereo devono avere la stessa lunghezza.");
  }

  const channels = 2;
  const bytesPerSample = bitDepth / 8;
  const dataSize = left.length * channels * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * bytesPerSample, true);
  view.setUint16(32, channels * bytesPerSample, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;

  for (let i = 0; i < left.length; i++) {
    for (const sample of [left[i], right[i]]) {
      const value = Math.max(-1, Math.min(1, sample));

      if (bitDepth === 16) {
        view.setInt16(
          offset,
          value < 0 ? value * 32768 : value * 32767,
          true,
        );
        offset += 2;
      } else {
        const intValue = Math.round(
          value < 0 ? value * 8388608 : value * 8388607,
        );
        view.setUint8(offset, intValue & 0xff);
        view.setUint8(offset + 1, (intValue >> 8) & 0xff);
        view.setUint8(offset + 2, (intValue >> 16) & 0xff);
        offset += 3;
      }
    }
  }

  return buffer;
}

export function downloadWav(
  left: Float32Array,
  right: Float32Array,
  sampleRate: number,
  options: WavExportOptions = {},
): void {
  const bitDepth = options.bitDepth ?? 24;
  const filename = options.filename ?? "obscuria-export.wav";
  const wav = encodeWav(left, right, sampleRate, bitDepth);
  const blob = new Blob([wav], { type: "audio/wav" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function renderOffline(
  render: (context: OfflineAudioContext) => void,
  durationSeconds: number,
  sampleRate = 48000,
): Promise<AudioBuffer> {
  const frames = Math.ceil(durationSeconds * sampleRate);
  const context = new OfflineAudioContext(2, frames, sampleRate);

  render(context);
  return context.startRendering();
}

export function exportAudioBuffer(
  audio: AudioBuffer,
  options: WavExportOptions = {},
): void {
  const left = audio.getChannelData(0);
  const right = audio.numberOfChannels > 1
    ? audio.getChannelData(1)
    : left;

  downloadWav(left, right, audio.sampleRate, options);
}
