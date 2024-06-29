export enum Constraints {
  "480P" = "480P",
  "720P" = "720P",
  "1080P" = "1080P",
}

export interface SDKConfig {
  appId?: string;
  accessToken?: string;
  refreshToken?: string;
  iceServers?: any[];
  wsUrl?: string;
}

export interface RestartMediaConstraints {
  constraints: MediaStreamConstraints;
  audio: boolean;
  video: boolean;
  screen: boolean;
  audioDevice?: any;
  videoDevice?: any;
}
export type DisplayMediaStreamConstraints =any

