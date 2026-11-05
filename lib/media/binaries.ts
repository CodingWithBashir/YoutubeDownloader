import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import ffprobeInstaller from "@ffprobe-installer/ffprobe";
import { env } from "@/lib/env";

export const FFMPEG_PATH = env.ffmpegPath || ffmpegInstaller.path || "ffmpeg";
export const FFPROBE_PATH = env.ffprobePath || ffprobeInstaller.path || "ffprobe";
