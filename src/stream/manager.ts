import store from "../event/store";

export enum StreamType {
  User = "user",
  Display = "display",
  Local = "local",
  Remote = "remote",
}

/**
 * 音视频流管理器
 */
export default class StreamManager {
  // 当前媒体流
  stream: MediaStream = new MediaStream();
  // 媒体流类型
  streamType: StreamType = <StreamType>"user";
  // 音频状态
  audio: boolean;
  // 视频状态
  video: boolean;
  // 屏幕共享状态
  screenShare: boolean;

  constructor(
    stream: MediaStream,
    audio: boolean,
    video: boolean,
    screen: boolean
  ) {
    this.stream = stream;
    this.audio = audio;
    this.video = video;
    this.screenShare = screen;
  }

  /**
   * 设备当前屏幕共享状态
   */
  setScreenShare(flag: boolean) {
    try {
      if (!this.stream) return;
      const [videoTrack] = this.stream.getVideoTracks() || [];
      // 视频媒体流正常且视频流来于屏幕共享
      if (!!videoTrack && this.streamType === "display") {
        this.screenShare = flag;
      }
    } catch (e) {
      console.error("[RTC SDK] set screen share error", e);
      this.screenShare = false;
      throw e;
    }
  }

  /**
   * 获取当前屏幕共享状态
   */
  getScreenShare(): boolean {
    return this.screenShare;
  }

  /**
   * 监听媒体流结束
   */
  private watchStreamEnd(stream: MediaStream, type: StreamType) {
    if (!stream) return;
    const [videoTrack] = stream.getVideoTracks() || [];
    // const [audioTrack] = stream.getAudioTracks(); // 音频流不支持监听结束事件
    if (videoTrack) {
      // 视频流结束
      videoTrack.onended = () => {
        store.emit("VIDEO_END", { type });
      };
    }
  }

  /**
   * 设置本地视频流分辨率
   * @param constraints
   */
  async setStreamVideoConstraints(constraints: MediaTrackConstraints) {
    try {
      if (!this.stream) return;
      const [videoTrack] = this.stream.getVideoTracks() || [];
      if (videoTrack) await videoTrack.applyConstraints(constraints);
    } catch (e) {
      console.error("[RTC SDK] set stream video constraints error", e);
      throw e;
    }
  }

  /**
   * 设置音频流状态
   * @param flag
   */
  setStreamAudio(flag: boolean) {
    try {
      const [audioTrack] = this.stream?.getAudioTracks() || [];
      if (audioTrack) {
        audioTrack.enabled = flag;
        this.audio = flag;
      } else {
        this.audio = false;
      }
    } catch (e) {
      console.error("[RTC SDK] set stream audio error", e);
      this.audio = false;
      throw e;
    }
  }

  /**
   * 设置视频流状态
   * @param flag
   */
  setStreamVideo(flag: boolean) {
    try {
      if (!this.stream) return;
      const [videoTrack] = this.stream.getVideoTracks() || [];
      if (videoTrack) {
        videoTrack.enabled = flag;
        this.video = flag;
      } else {
        this.video = false;
      }
    } catch (e) {
      console.error("[RTC SDK] set stream video error", e);
      this.video = false;
      throw e;
    }
  }

  getStreamAudioTrack() {
    try {
      if (!this.stream) return false;
      const [audioTrack] = this.stream.getAudioTracks() || [];
      return audioTrack;
    } catch (e) {
      console.error("[RTC STREAM] get stream audio track", e);
      throw e;
    }
  }

  getStreamVideoTrack() {
    try {
      if (!this.stream) return false;
      const [videoTrack] = this.stream.getVideoTracks() || [];
      return videoTrack;
    } catch (e) {
      console.error("[RTC STREAM] get stream video track", e);
      throw e;
    }
  }

  /**
   * 获取视频流
   */
  getStreamVideo(): boolean {
    return this.video;
  }

  /**
   * 获取音频流
   */
  getStreamAudio(): boolean {
    return this.audio;
  }

  /**
   * 获取视频流
   */
  getStream(): MediaStream {
    return this.stream;
  }

  /**
   * 设置视频流
   */
  setStreamType(type: StreamType) {
    this.streamType = type;
    this.watchStreamEnd(this.stream, type);
  }

  getStreamType(): StreamType {
    return this.streamType;
  }

  /**
   * 关闭本地音视频流
   */
  closeStream() {
    try {
      this.stream?.getTracks().forEach((track) => {
        track && track.stop();
      });
    } catch (e) {
      console.error("[RTC STREAM] close stream error", e);
      throw e;
    }
  }
  /**
   * 关闭本地视频流
   */
  closeVideo() {
    try {
      this.stream?.getTracks().forEach((track) => {
        if (track && track.kind === "video") {
           track.stop();
        }
      });
    } catch (e) {
      console.error("[RTC STREAM] close video error", e);
      throw e;
    }
  }
}
