export function createDemoWavFile(durationSeconds = 2.5) {
  const sampleRate = 44100;
  const channels = 1;
  const bitsPerSample = 16;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const dataBytes = sampleCount * channels * (bitsPerSample / 8);
  const buffer = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buffer);

  const writeAscii = (offset: number, value: string) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
  };

  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * (bitsPerSample / 8), true);
  view.setUint16(32, channels * (bitsPerSample / 8), true);
  view.setUint16(34, bitsPerSample, true);
  writeAscii(36, "data");
  view.setUint32(40, dataBytes, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const envelope = Math.min(1, time / 0.05, (durationSeconds - time) / 0.08);
    const frequency = 330 + 110 * Math.sin(2 * Math.PI * 0.5 * time);
    const sample = Math.sin(2 * Math.PI * frequency * time) * 0.24 * Math.max(0, envelope);
    view.setInt16(44 + index * 2, Math.round(sample * 32767), true);
  }

  return new File([buffer], "clearframe-demo-tone.wav", { type: "audio/wav" });
}
