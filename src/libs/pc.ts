import store from "../event/store";
import device from "../device";
import Score, { ScoreStateInt } from "./score";


export default class Peer {
  pc: RTCPeerConnection;
  streamType: string = "low";
  subscribeType: string = "both";
  outboundStatsTimer?:any;
  audioScore: Score;
  videoHighScore: Score;
  videoLowscore: Score;
  netQuality:ScoreStateInt= ScoreStateInt.EXCELLENT;
  connectState: 'disconnected' | 'failed' | 'connected' = 'disconnected'
  netQualityCallback?:(value:number) => void;
  candidateQueue: {
    candidate: RTCIceCandidate;
    callback: () => void;
  }[] = [];
  public localStream?: MediaStream;
  public remoteStream: MediaStream = new MediaStream();
  candidateList: {
    candidate: string;
    sdpMid: string | number | null;
    sdpMLineIndex: string | number | null;
  }[] = [];

  constructor(
    iceServers: any[] = [],
    sendIceCandidate: Function,
    stateCallback?: Function,
    netQualityCallback?:(value:number) => void
  ) {
    this.audioScore = new Score(10);
    this.videoHighScore = new Score(10);
    this.videoLowscore = new Score(10);

    const WEBRTC_CONSTANTS = [
      "RTCPeerConnection",
      "webkitRTCPeerConnection",
      "mozRTCPeerConnection",
      "RTCIceGatherer",
    ];

    iceServers.forEach((value) => {
      value.username = value.userName;
      value.credential = value.password;
    });

    // this.score = new Score(10);

    if (typeof window.RTCPeerConnection === "undefined") {
      const RTC = WEBRTC_CONSTANTS.find((item) => {
        return item in window;
      });
      // @ts-ignore
      this.pc = new window[RTC]({ iceServers, bundlePolicy: "max-bundle" });
    }

    this.pc = new RTCPeerConnection({
      iceServers,
      bundlePolicy: "max-bundle",
    });

    // 媒体流事件回调
    this.pc.onicecandidate = (ev) => {
      console.log("ice========", ev);
      if (ev.candidate) {
        this.candidateList.push({
          candidate: ev.candidate.candidate,
          sdpMid: ev.candidate.sdpMid,
          sdpMLineIndex: ev.candidate.sdpMLineIndex,
        });
      }
    };
    // 连接状态改变事件
    this.pc.onconnectionstatechange = (ev) => {
      console.log("ice-connection========", ev.target);
      stateCallback && stateCallback(ev.target);
    };

    this.pc.onnegotiationneeded = (e) => {};

    this.pc.onicegatheringstatechange = (e) => {
      // @ts-ignore
      switch (e.target!.iceGatheringState) {
        case "gathering":
          this.candidateList = [];
          break;
        case "complete":
          sendIceCandidate(this.candidateList);
          break;
      }
    };
    if(netQualityCallback){
      netQualityCallback(this.netQuality)
      this.onNetQualityChanged(netQualityCallback)
    }
  }
  

  addIceCandidate(candidate, callback) {
    const _candidate = new RTCIceCandidate(candidate);

    this.pc.onsignalingstatechange = (ev) => {
      console.log(
        "%c [RTC SDK] onsignalingstatechange.....",
        "color:red;font-size:20px;",
        ev
      );
      if (this.pc.signalingState === "stable") {
        while (this.candidateQueue.length) {
          const entry = this.candidateQueue.shift();
          console.log("candidate-entry=======", entry, this.candidateQueue);
          this.pc.addIceCandidate(entry?.candidate).then(() => {
            callback();
          });
        }
      }
    };
    switch (this.pc.signalingState) {
      case "closed":
        throw new Error("PeerConnection is closed");
      case "stable":
        if (this.pc.remoteDescription) {
          this.pc
            .addIceCandidate(_candidate)
            .then((r) => {
              callback();
            })
            .catch((err) => {
              console.log("add-ice-err", err);
            });
        }
        break;
      default:
        this.candidateQueue.push({
          candidate: _candidate,
          callback,
        });
        console.log("candidateQueue==========", this.candidateQueue);
        break;
    }
  }

  /**
   * 将音视频流数据载入video标签内
   * @param stream
   * @param video
   */
  addMediaStream(stream: MediaStream, video?: HTMLVideoElement) {
    // console.log('video-------', video)
    // stream.getTracks().forEach((track) => this.pc.addTrack(track));
    // this.localStream = stream;
    // this.switchLocalStream(stream);
    if (video) {
      video.pause();
      video.srcObject = stream;
      video.load();
    }
  }

  public async changeVideoStream(stream: MediaStream) {
    try {
      if (!stream) return;
      const [videoTrack] = stream.getVideoTracks() || [];
      // const [audioTrack] = stream.getAudioTracks();
      const senderVideo = this.pc.getSenders().find((sender) => {
        return (sender.track && sender.track.kind) === "video";
      });
      console.log(
        "change-stream=======",
        videoTrack,
        senderVideo,
        this.pc.getSenders()
      );
      if (senderVideo && videoTrack) {
        await senderVideo.replaceTrack(videoTrack);
      }
    } catch (e) {
      console.log("change-stream-error=======", JSON.stringify(e));
    }
  }
  public async changeMediaStream(stream: MediaStream) {
    try {
      if (!stream) return;
      const [videoTrack] = stream.getVideoTracks() || [];
      const [audioTrack] = stream.getAudioTracks() || [];
      // const [audioTrack] = stream.getAudioTracks();
      const senderVideo = this.pc.getSenders().find((sender) => {
        return (sender.track && sender.track.kind) === "video";
      });
      const senderAudio = this.pc.getSenders().find((sender) => {
        return (sender.track && sender.track.kind) === "audio";
      });
      console.log(
        "change-stream=======",
        videoTrack,
        senderVideo,
        this.pc.getSenders()
      );
      if (senderVideo && videoTrack) {
        await senderVideo.replaceTrack(videoTrack);
      }
      if (senderAudio && audioTrack) {
        await senderAudio.replaceTrack(audioTrack);
      }
    } catch (e) {
      console.log("change-stream-error=======", JSON.stringify(e));
    }
  }

  switchAudio(flag: boolean) {
    if (this.remoteStream) {
      const [audioTrack] = this.remoteStream.getAudioTracks() || [];
      if (audioTrack) audioTrack.enabled = flag;
    }
  }

  setSubscribeType(type: string) {
    this.subscribeType = type;
  }

  setStreamType(type: string) {
    this.streamType = type;
  }

  renderMediaStream(opts?) {
    const audioStream = new MediaStream(),
      videoStream = new MediaStream();
    this.pc.getReceivers().forEach((sender) => {
      if (sender.track && sender.track.kind === "video") {
        videoStream.addTrack(sender.track);
      }
      if (sender.track && sender.track.kind === "audio") {
        audioStream.addTrack(sender.track);
      }
    });

    // this.remoteStream = stream;
    console.log(
      "sender=========",
      audioStream,
      videoStream,
      this.subscribeType
    );
    const videoPlayer: HTMLVideoElement = document.createElement(
      "video"
    ) as HTMLVideoElement;
    const audioPlayer: HTMLAudioElement = document.createElement(
      "audio"
    ) as HTMLAudioElement;
    videoPlayer.autoplay = true;
    videoPlayer.id = `remote_video_${opts.userId}`;
    videoPlayer.className = "remote-video";
    videoPlayer.srcObject = videoStream;
    audioPlayer.autoplay = true;
    audioPlayer.id = `remote_audio_${opts.userId}`;
    audioPlayer.srcObject = audioStream;
    audioPlayer.muted = opts.muted;
    if (opts.container) {
      opts.container.innerHTML = "";
      opts.container.appendChild(videoPlayer);
      opts.container.appendChild(audioPlayer);
    }
    if (opts.video) videoPlayer.load();
    if (opts.audio) audioPlayer.load();
    store.emit('STREAM_UPDATE', { userId: opts.userId })
  }

  /**
   * 将本地音视频流加入peer链接中
   * @param stream
   * @param opts
   */
  switchLocalStream(stream: MediaStream, opts?) {
    if (!stream) return;
    console.log("local=====opts=====", opts);
    if (!opts) {
      // 初始化opts配置
      opts = {
        high: 0,
        low: 0,
        video: false,
        audio: false,
      };
    }
    // 取媒体流中的视频轨道
    const [videoTrack] = stream.getVideoTracks() || [];
    // 去媒体流中的音频轨道
    const [audioTrack] = stream.getAudioTracks() || [];
    // 加入音频轨道
    if (!!audioTrack && !opts.audio) {
      this.pc.addTransceiver(audioTrack, {
        streams: [stream],
      });
    }
    // 加入视频轨道
    if (!!videoTrack && !opts.video) {
      let transceiver: RTCRtpTransceiver;
      if (opts.simulcast && opts.constraints != "360P" && !opts.maintainResolution && !opts.screen) {
        const lowMaxBitrate = (opts.low && opts.low) > 0 ? opts.low : opts.bitrate / 8
        transceiver = this.pc.addTransceiver(videoTrack, {
          streams: [stream],
          sendEncodings: [
            {
              rid: "l",
              active: true,
              maxBitrate: lowMaxBitrate,
              scaleResolutionDownBy: 4,
            },
            {
              rid: "h",
              active: true,
              maxBitrate:
                (opts.high && opts.high) > 0 ? opts.high : opts.bitrate,
            },
            {
              rid: "n",
              active: false,
            },
          ],
        });
      } else {
        let encoding = {
          active: true,
          maxBitrate: opts.bitrate,
          // web sdk 不支持设置帧率, 这里先hardcode
          maxFramerate: (opts.maintainResolution || opts.screen) ? 10 : undefined,
        };
        transceiver = this.pc.addTransceiver(videoTrack, {
          streams: [stream],
          sendEncodings: [encoding],
        });
      }
      if (opts.maintainResolution && transceiver) {
        let params = transceiver.sender.getParameters();
        params.degradationPreference = 'maintain-resolution';
        transceiver.sender.setParameters(params);
      }
    }
  }

  /**
   * 订阅端点信息
   */
  async sendOffer(
    self: boolean,
    restart?: boolean
  ): Promise<RTCSessionDescription | null> {
    try {
      if (!self) {
        this.pc.addTransceiver("audio", { direction: "recvonly" });
        this.pc.addTransceiver("video", { direction: "recvonly" });
      } else {
        this.pc.getTransceivers().forEach((trans) => {
          trans.direction = "sendonly";
        });
      }
      const desc = (await this.pc.createOffer({
        iceRestart: restart,
      })) as RTCSessionDescription;
      // 订阅信号转化为应答应答信号
      await this.pc.setLocalDescription(new RTCSessionDescription(desc));
      console.log("desc-offer=======", desc);
      return desc;
    } catch (e) {
      console.error("[RTC SDK] send offer", e);
      return null;
    }
  }

  /**
   * 应答端点信息
   */
  async sendAnswer(opts?) {
    try {
      console.log("capa=====", opts);
      const offer = new RTCSessionDescription({
        type: opts.type,
        sdp: opts.sdp,
      });
      await this.pc.setRemoteDescription(offer);
      if (opts.type === "offer") {
        const sdpAnswer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(sdpAnswer);
        return sdpAnswer;
      }
    } catch (e) {
      console.error("[RTC SDK] send answer", e);
    }
  }

  async getLocalStreamInfo() {
    const senders = this.pc.getSenders();
    const stats = await this.pc.getStats();
    const arr: any[] = [];
    // console.log("local-info-remote=======", senders, stats);
    stats.forEach((report) => {
      // console.log("inbound-rtp----type========", report.type, report);
      if (report.type === "outbound-rtp") {
        // 推流端RTP包内容
        let { bytesSent, timestamp } = report;
        let remote, obj;
        stats.forEach((rep) => {
          if (rep.type === "remote-inbound-rtp" && report.ssrc === rep.ssrc) {
            remote = rep;
            const { roundTripTime = 0, fractionLost = 0, jitter = 0 } = remote;
            if (
              report.kind === "video" &&
              report.rid !== "l" &&
              report !== "h"
            ) {
              // 没有推大小流
              this.videoHighScore.addRtt(roundTripTime.toFixed(2));
              this.videoHighScore.addLoss(fractionLost.toFixed(2));
              this.videoHighScore.addJitter(jitter.toFixed(2));
              obj = {
                score:
                  bytesSent > 0
                    ? this.videoHighScore.calculateTotalScore()
                    : 1.0,
                state: this.videoHighScore.calculateScoreEnum(
                  this.videoHighScore.calculateTotalScore()
                ),
              };
            }

            if (report.kind === "video" && report.rid === "h") {
              // 大流
              this.videoHighScore.addRtt(roundTripTime.toFixed(2));
              this.videoHighScore.addLoss(fractionLost.toFixed(2));
              this.videoHighScore.addJitter(jitter.toFixed(2));
              obj = {
                score:
                  bytesSent > 0
                    ? this.videoHighScore.calculateTotalScore()
                    : 1.0,
                state: this.videoHighScore.calculateScoreEnum(
                  this.videoHighScore.calculateTotalScore()
                ),
              };
            }

            if (report.kind === "video" && report.rid === "l") {
              // 小流
              this.videoLowscore.addRtt(roundTripTime.toFixed(2));
              this.videoLowscore.addLoss(fractionLost.toFixed(2));
              this.videoLowscore.addJitter(jitter.toFixed(2));
              obj = {
                score:
                  bytesSent > 0
                    ? this.videoLowscore.calculateTotalScore()
                    : 1.0,
                state: this.videoLowscore.calculateScoreEnum(
                  this.videoLowscore.calculateTotalScore()
                ),
              };
            }

            if (report.kind === "audio") {
              // 音频
              this.audioScore.addRtt(roundTripTime.toFixed(2));
              this.audioScore.addLoss(fractionLost.toFixed(2));
              this.audioScore.addJitter(jitter.toFixed(2));
              obj = {
                score:
                  bytesSent > 0 ? this.audioScore.calculateTotalScore() : 1.0,
                state: this.audioScore.calculateScoreEnum(
                  this.audioScore.calculateTotalScore()
                ),
              };
            }
          }
        });

        // score.addRtt(roundTripTime.toFixed(2));
        // score.addLoss(fractionLost.toFixed(2));
        // score.addJitter(jitter.toFixed(2));
        arr.push({
          id: `${report.kind}-${report.id}`,
          width: ~~report.frameWidth,
          height: ~~report.frameHeight,
          limit: ~~report.qualityLimitationReason,
          bytesSent: ~~bytesSent * 8,
          timestamp: ~~timestamp,
          ...obj,
        });
      }
      // if (report.type === "remote-inbound-rtp") {
      //   const { roundTripTime, fractionLost, jitter } = report;
      //   const score = new Score(roundTripTime, fractionLost, jitter);
      //   if (sender && sender.track) {
      //     arr.push({
      //       score: score.calculateScore(),
      //     });
      //   }
      // }
    });
    for (const sender of senders) {
      const stats = await sender.getStats();
      // const score = new Score(10);
    }
    return arr;
  }
private async getOutboundStats() {
  // const senders = this.pc.getSenders();
  const stats = await this.pc?.getStats?.();
  let outboundVideoRtp: RTCStatsReport | null = null
  let inboundVideoRtp: RTCStatsReport | null = null
  let outboundAudioRtp: RTCStatsReport | null = null
  let inboundAudioRtp: RTCStatsReport | null = null
 
  stats.forEach((report) => {
    if (report.type === "outbound-rtp"){
      stats.forEach((rep) => {
        if (rep.type === "remote-inbound-rtp" && report.ssrc === rep.ssrc && report.kind === "video"){
          // console.log('666-6',rep)
          // console.log('666-7',report)
          
          if( !outboundVideoRtp && (report.rid === 'h' || !report.rid)){
            // 开启大小流后的大流或未开启大小流
            outboundVideoRtp = report
            inboundVideoRtp = rep
          }
        }else if(rep.type === "remote-inbound-rtp" && report.ssrc === rep.ssrc && report.kind === "audio"){
          outboundAudioRtp = report
          inboundAudioRtp = rep
        }
      }
      )
    }
  });
if(!(outboundVideoRtp && inboundVideoRtp) || !(outboundAudioRtp && inboundAudioRtp)) return ScoreStateInt.EXCELLENT
const outbound = outboundVideoRtp || outboundAudioRtp
const inbound = inboundVideoRtp || inboundAudioRtp
const { bytesSent, timestamp } = outbound;
const { roundTripTime = 0, fractionLost = 0, jitter = 0 } = inbound;
const score = new Score(10);
score.addRtt(+roundTripTime.toFixed(2));
score.addLoss(+fractionLost.toFixed(2));
score.addJitter(+jitter.toFixed(2));
return score.calculateScoreEnumInt(score.calculateTotalScore())

}
 onNetQualityChanged(callback:(value:number)=>void){
  if(this.outboundStatsTimer) clearInterval(this.outboundStatsTimer)
  this.outboundStatsTimer = setInterval(async () => {
    const netQuality = await this.getOutboundStats();
    if(netQuality !==this.netQuality){
      this.netQuality = netQuality
      callback(netQuality)
    }
    
  }, 1000);
 }
  async getRemoteStreamInfo() {
    const receivers = this.pc.getReceivers();
    const arr: any[] = [];
    for (const receiver of receivers) {
      const stats = await receiver.getStats();
      stats.forEach((report) => {
        if (report.type === "inbound-rtp") {
          // console.log("inbound-rtp========", report);
          // 拉流RTP包
          const {
            bytesReceived,
            timestamp,
            packetsReceived,
            packetsLost,
            estimatedPlayoutTimestamp,
            roundTripTime,
            factionLost,
            jitter,
          } = report;
          if (receiver && receiver.track) {
            arr.push({
              id: `${receiver.track.kind}-${receiver.track.id}`,
              width: ~~report.frameWidth,
              height: ~~report.frameHeight,
              latency: estimatedPlayoutTimestamp
                ? ~~(
                    performance.now() +
                    performance.timeOrigin +
                    2208988800000 -
                    estimatedPlayoutTimestamp
                  )
                : 0,
              bytesReceived: ~~bytesReceived * 8,
              timestamp: ~~timestamp,
              packetsReceived: ~~packetsReceived,
              packetsLost: ~~packetsLost,
            });
          }
        }
      });
    }
    return arr;
  }

  /**
   * 销毁连接
   */
  destroy() {
    try {
      if(this.outboundStatsTimer){
        clearInterval(this.outboundStatsTimer)
        this.outboundStatsTimer=undefined
      }
      if (this.pc.signalingState === "closed") return;
      // 关闭本地连接
      this.pc?.close();
    } catch (e) {
      console.error("[RTC SDK] webrtc disposing peer", e);
    }
  }

  /***************** 弃用，转移至device进行管理   ***********************/

  stopStream() {
    // 关闭本地视频流
    this.localStream
      ?.getTracks()
      .forEach((track) => track.stop && track.stop());
  }

  /**
   * 监听设备变更
   * @param active_devices
   * @param constraints
   * @private
   */
  // private async watchDeviceChange(
  //   active_devices: MediaDeviceInfo[],
  //   constraints
  // ) {
  //   navigator.mediaDevices.ondevicechange = async (e) => {
  //     const devices = await navigator.mediaDevices.enumerateDevices();
  //     const old_video = active_devices.find((device) => {
  //       return device.kind === "videoinput";
  //     });
  //     const old_audio = active_devices.find((device) => {
  //       return device.kind === "audioinput";
  //     });
  //     console.log("devicechange-e========", e, devices);
  //     const videoinput = devices.find((device) => {
  //       return device.kind === "videoinput";
  //     });
  //     const audioinput = devices.find((device) => {
  //       return device.kind === "audioinput";
  //     });
  //     //  音频设备切换
  //     if (
  //       !(audioinput && old_audio && old_audio.deviceId === audioinput.deviceId)
  //     ) {
  //       const stream = await navigator.mediaDevices.getUserMedia({
  //         audio: !!audioinput,
  //         video: !!videoinput ? constraints.video : false,
  //       });
  //       this.localStream = stream;
  //       await this.changeStream(stream);
  //       store.emit("AUDIO_CHANGE", {
  //         audio: audioinput,
  //         video: videoinput,
  //         deviceList: active_devices,
  //       });
  //     }
  //     // 视频设备切换
  //     if (
  //       !(old_video && videoinput && old_video.deviceId === videoinput.deviceId)
  //     ) {
  //       const stream = await navigator.mediaDevices.getUserMedia({
  //         audio: !!audioinput,
  //         video: !!videoinput ? constraints.video : false,
  //       });
  //       this.localStream = stream;
  //       await this.changeStream(stream);
  //       store.emit("VIDEO_CHANGE", {
  //         audio: audioinput,
  //         video: videoinput,
  //         deviceList: active_devices,
  //       });
  //     }
  //   };
  // }

  /**
   * 获取用户本地的视频流
   * 1.3.0 兼容性调整
   * @param constraints
   */
  public async getLocalMedia(constraints) {
    let stream;
    const active_devices = await navigator.mediaDevices.enumerateDevices();
    try {
      console.log("constraints========", constraints);
      if (navigator.mediaDevices === undefined) {
        console.error("[RTC SDK] media devices not defined!");
        return null;
      }
      if (typeof navigator.mediaDevices.getUserMedia === "undefined") {
        console.error("[RTC SDK] media user meaia not defined!");
        navigator.mediaDevices.getUserMedia =
          // @ts-ignore
          navigator.mediaDevices.webkitGetUserMedia ||
          // @ts-ignore
          navigator.mediaDevices.mozGetUserMedia ||
          // @ts-ignore
          navigator.mediaDevices.msGetUserMedia;
      }
      // 获取当前用户的视频流
      stream = await navigator.mediaDevices.getUserMedia(constraints);

      return stream;
    } catch (e: any) {
      console.error("[RTC SDK] get user media error", e);
      const errorMessage = e.message || "";
      // 未授权错误
      if (/(permission|denied|allowed)/.test(errorMessage.toLowerCase())) {
        if (constraints.audio) {
          // 仅开启音频，尝试仅拉取音频流
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: false,
          });
        }
      }

      // 未找到设备错误
      if (/found/.test(errorMessage.toLowerCase())) {
        if (constraints.audio) {
          // 仅开启音频，尝试仅拉取音频流
          stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: false,
          });
        } else {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: false,
          });
        }
      }

      return stream;
    } finally {
      // await this.watchDeviceChange(active_devices, constraints);
      this.localStream = stream;
    }
  }
}
