declare module "@ffmpeg-installer/ffmpeg" {
  const ffmpeg: { path: string; url: string; version: string };
  export default ffmpeg;
}

declare module "@ffprobe-installer/ffprobe" {
  const ffprobe: { path: string; url: string; version: string };
  export default ffprobe;
}
