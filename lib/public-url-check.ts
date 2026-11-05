const STREAMING_HOST_SUFFIXES = [
  "youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "vimeo.com",
  "twitter.com",
  "x.com",
  "reddit.com",
  "dailymotion.com",
  "twitch.tv",
  "bilibili.com",
];

export function looksLikeStreamingPage(input: string) {
  try {
    const url = new URL(input.trim());
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    return STREAMING_HOST_SUFFIXES.some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export function looksLikeDirectMediaUrl(input: string) {
  try {
    const url = new URL(input.trim());
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}
