import WS from "./libs/ws";
import Peer from "./libs/pc";
import Services from "./services";
import Auth from "./services/auth";
import store from "./event/store";
import DeviceManager, {
  enumerateDevices,
  getAudioDeviceList,
  getVideoDeviceList,
} from "./device";
import StreamManager, { StreamType } from "./stream/manager";
import { ChannelMember } from "./services/types";
import {
  SDKID,
  MEDIA_CONSTRAINTS,
  CONSTRAINTS_OPTIONS,
  DISPLAY_CONSTRAINTS_OPTIONS,
} from "./libs/constants";
import { Constraints, DisplayMediaStreamConstraints, RestartMediaConstraints, SDKConfig } from "./types";
import device from "./device";
import Task from "./utils/taskQuee";
import { queryResult } from "./utils/tools";

/**
 * RTC-WEB-SDK
 */
export default class RTC {
  simulcast: boolean = true; // 大小流设置
  maintainResolution: boolean = false;
  bitrate: number = 2000000;
  subScribeTask: Task;
  // 本端
  owner: string = "";
  // video: boolean = true;
  // audio: boolean = true;
  constraints: string = "360P";
  channelId: string = "";
  password: string = "";
  isEmpty: boolean = false;
  localDom: string = "";
  private localStream?: MediaStream = new MediaStream();
  private upside: boolean = false;

  timer: { [key: string]: any } = {};

  // sdk 配置信息
  config: SDKConfig = {};

  // appId: string = "";
  // accessToken: string = "";
  // refreshToken: string = "";
  // iceServers: any[] = [];
  // wsUrl: string = "";

  // 消息事件回调
  onReceiveMessage?: (channelId, messageId, messageData) => void;

  private peers: {
    [key: string]: Peer;
  } = {};

  // 接口服务
  public service?: Services;
  // 鉴权服务
  public auth?: Auth;
  private ws?: WS;

  // 设备管理器
  private deviceManager: DeviceManager;
  // 媒体流管理器
  private streamManager: {
    [key: string]: StreamManager;
  } = {};
  // 链接管理器
  private peerManager: {
    [key: string]: Peer;
  } = {};

  // 设备列表
  private deviceList: any[] = [];

  // 扬声器是否静音
  private speakerMute = false;

  constructor() {
    this.deviceManager = new DeviceManager();
    this.subScribeTask = new Task();
  }

  /**
   * 设置配置内容
   * @param config
   */
  setConfig(config: SDKConfig) {
    this.config = {
      ...config,
      ...this.config,
    };
  }

  /**
   * 获取配置内容
   */
  getConfig(): SDKConfig {
    return this.config;
  }

  /**
   * 初始化SDK内部依赖
   * @param domain
   * @param appId
   * @param userId
   * @param deviceId
   * @param server
   * @param watchDevice
   */
  async init(
    domain: string,
    appId: string,
    userId: string,
    deviceId: string,
    server?: any,
    watchDevice?: boolean,
    forceRefreshToken?: boolean
  ) {
    this.service = new Services(domain);
    this.auth = new Auth(this.service, appId);
    this.setConfig({ appId });
    const accessToken = window.localStorage.getItem("rokid-rtc-access");
    const refreshToken = window.localStorage.getItem("rokid-rtc-refresh");
    if (!forceRefreshToken && accessToken && refreshToken) {
      this.setConfig({ accessToken, refreshToken });
    } else {
      const { data } = await this.auth.getToken({
        userId,
        sdkId: SDKID,
        deviceType: "Web",
        deviceId,
      });
      this.setConfig({
        accessToken: data.accessToken.accessToken,
        refreshToken: data.refreshToken.refreshToken,
      });
      window.localStorage.setItem(
        "rokid-rtc-access",
        data.accessToken.accessToken
      );
      window.localStorage.setItem(
        "rokid-rtc-refresh",
        data.refreshToken.refreshToken
      );
    }
    const config = this.getConfig();
    this.service.setToken(<string>config.accessToken);
    // token刷新事件回调
    store.on("REFRESH", async ({ func, params }) => {
      const { data } = await this.auth?.refreshToken(
        <string>config.refreshToken
      );
      this.setConfig({
        accessToken: data.accessToken.accessToken,
        refreshToken: data.refreshToken.refreshToken,
      });
      window.localStorage.setItem(
        "rokid-rtc-access",
        data.accessToken.accessToken
      );
      window.localStorage.setItem(
        "rokid-rtc-refresh",
        data.refreshToken.refreshToken
      );
      this.service![func](params);
    });

    // ws已关闭
    store.on("WS_CLOSE", async () => {
      store.emit('WS_RECONNECT_STATUS', { channelId: this.channelId, status: 'start' });
    });

    // ws重连事件回调
    store.on("WS_RECONNECT", async () => {
      console.log("WS_RECONNECT", this.channelId, this.peers[this.owner]?.pc.signalingState);
      const channelId = this.channelId;
      if (!channelId) {
        // 通知上层业务ws重连成功
        store.emit('WS_RECONNECT_STATUS', { channelId: '', status: 'success' });
        return;
      }

      // 若本地pc已断开，重新建立pc连接
      if (this.peers[this.owner]?.pc.signalingState === 'closed') {
        await this.join(
          channelId,
          this.isEmpty,
          this.password,
          this.constraints,
          this.streamManager[this.owner]?.getStreamAudio(),
          this.streamManager[this.owner]?.getStreamVideo(),
          this.bitrate
        )
      }
      // 重新订阅其他用户
      const users = Object.keys(this.peers).filter(user => user !== this.owner);
      await this.subscribe(users.map(user => {
        return {
          userId: user,
          stream: this.peers[user].streamType,
          subscribeType: this.peers[user].subscribeType
        }
      }))
      // 重新获取用户列表 -》人员动态变化等
      await this.reloadMemberList();

      // 通知上层业务ws重连成功
      store.emit('WS_RECONNECT_STATUS', { channelId: this.channelId, status: 'success' });
    });

    if (!server) {
      const re = await this.service.getServerInfo(appId);
      server = re.data;
    }
    this.setConfig({
      iceServers: server.iceServers,
      wsUrl: server.rtcWebsocketUrl,
    });
    if (watchDevice) {
      this.deviceList = await enumerateDevices();
      this.deviceManager.injectWatcher((deviceList) => {
        store.emit("MEDIA_CHANGE", {
          oldList: this.deviceList,
          newList: deviceList,
        });
        this.deviceList = deviceList;
      });
    }
    return this.getConfig();
  }

  /**
   * 频道内的传递事件回调
   * @param msg
   */
  private async onChannelAction(msg) {
    const { messageData, messageId, timestamp, channelId } = msg;
    const {
      operateType,
      activeOperateUser,
      passiveOperateUserList,
      inviteUserId,
    } = messageData;
    switch (operateType) {
      case "LEAVE": // 某人主动离开，需要断开连接
        this.peers[activeOperateUser]?.destroy?.();
        delete this.peers[activeOperateUser];
        break;
      case "KICK": // 用户被提出，需要断开连接
        passiveOperateUserList.forEach((user) => {
          this.peers[user]?.destroy?.();
          delete this.peers[user];
          user === this.owner && this.ws?.setChannelId?.(undefined);
        });
        break;
    }
    console.log("[RTC SDK] receive msg", msg);
    if (this.onReceiveMessage) {
      this.onReceiveMessage(channelId, messageId, messageData);
    }
  }

  /**
   * 发送ice媒体信息
   * @param iceCandidateList
   * @param userId
   */
  async sendIceCandidate(
    iceCandidateList: {
      candidate: string;
      sdpMid: string | number | null;
      sdpMLineIndex: string | number | null;
    }[],
    userId
  ) {
    try {
      await this.service!.sendIceCandidate({
        channelId: this.channelId,
        passiveSubscribeUserId: userId ? userId : "",
        iceCandidateList: iceCandidateList,
      });
    } catch (e) {
      console.error(
        "[RTC SDK] send ice candidate error",
        e,
        iceCandidateList,
        userId
      );
      throw e;
    }
  }

  /**
   * ice媒体信息事件回调
   * @param msg
   */
  private onIceCandidate(msg) {
    try {
      const { messageData } = msg;
      this.peers[
        messageData.passiveSubscribeUserId
          ? messageData.passiveSubscribeUserId
          : this.owner
      ].addIceCandidate(msg.messageData, (err) => {
        if (err) console.log("ice-candidate-err", err);
      });
    } catch (e) {
      console.error("[RTC SDK] receive ice candidate error", e);
      throw e;
    }
  }

  /**
   * 创建频道
   * @param userIdList
   * @param password
   * @param channelName
   * @param extraParams
   * @param maxResolution
   * @param maxMembers
   * @param channelSubject
   * @param recordParams
   * @param remark
   */
  async create(
    userIdList,
    maxResolution = "360P",
    password = "",
    maxMembers = 16,
    channelName?,
    extraParams?,
    channelSubject?,
    recordParams?,
    remark?
  ): Promise<string> {
    try {
      const {
        data: { channelId },
      } = await this.service!.createChannel({
        userIdList,
        password,
        channelName,
        extraParams,
        maxResolution,
        maxMembers,
        channelSubject,
        recordParams,
        remark,
      });
      this.channelId = channelId;
      return channelId;
    } catch (e) {
      console.error("[RTC SDK] create channel error", e);
      throw e;
    }
  }

  /**
   * 获取频道内的成员
   * @param channelId 频道
   */
  async getUserList(channelId?): Promise<ChannelMember[]> {
    try {
      const { data } = await this.service!.getChannelUsers({
        channelId: channelId ? channelId : this.channelId,
      });
      return data;
    } catch (e) {
      console.error("[RTC SDK] get channel user list error", e);
      throw e;
    }
  }

  /**
   * 邀请人员进入频道
   * 并自动订阅该成员
   * @param userIdList
   */
  async invite(userIdList): Promise<string[]> {
    try {
      const { data } = await this.service!.inviteChannel({
        channelId: this.channelId,
        userIdList,
      });
      return data;
    } catch (e) {
      console.error("[RTC SDK] invite user into channel error", e);
      throw e;
    }
  }

  /**
   * 踢出成员
   * @param userIdList
   */
  async kick(userIdList): Promise<boolean> {
    // 踢出成员不需要取消订阅
    try {
      const { message } = await this.service!.kickChannel({
        channelId: this.channelId,
        // userId: this.owner,
        userIdList: userIdList,
      });
      return message === "success";
    } catch (e) {
      console.error("[RTC SDK] kick user out channel error", e);
      throw e;
    }
  }

  private closeInternal() {
    this.ws?.setChannelId(undefined);
    this.closePeer();
    this.closeStream();
    this.channelId = "";
    this.speakerMute = false;
  }

  /**
   * 关闭频道
   */
  async close(): Promise<boolean> {
    try {
      if(!this.channelId) return true
      const { message } = await this.service!.closeChannel({
        channelId: this.channelId,
        // userId: this.owner,
      });
      this.closeInternal();
      return message === "success";
    } catch (e) {
      console.error("[RTC SDK] close channel error", e);
      throw e;
    }
  }

  /**
   * 离开频道
   */
  async leave(channelId: string = ""): Promise<boolean> {
    try {
      const { message } = await this.service!.leaveChannel({
        channelId: channelId ? channelId : this.channelId,
      });
      this.closeInternal();
      return message === "success";
    } catch (e) {
      console.error("[RTC SDK] leave channel error", e);
      throw e;
    }
  }

  /**
   * 转发端上协议内容
   * @param msg
   */
  onForward(msg) {
    return msg;
  }

  /**
   * 收到再次订阅回调事件
   * @param msg
   */
  private async onResubscribe(msg) {
    const { messageData, messageId, timestamp, channelId } = msg;
    const { passiveUserId } = messageData;
    if (this.peers[passiveUserId]) {
      // 重新订阅推流的人
      console.log(
        "again-subscribe=======",
        passiveUserId,
        this.peers[passiveUserId].subscribeType
      );
      await this.subscribe([
        {
          userId: passiveUserId,
          stream: this.peers[passiveUserId].streamType,
          subscribeType: this.peers[passiveUserId].subscribeType,
        },
      ]);
    }
  }

  /**
   * 挂载事件
   * @param name 事件名称
   * @param fn 事件回调函数
   */
  mountEvent(name, fn) {
    store.on(name, fn);
  }

  getSubscribeTypeByAudioVideo(audio, video, screen?): string {
    if (audio && !video) return "audio";
    if (video && !audio) return "video";
    if (!video && !audio) return "none";
    if (video && audio) return "both";
    if (screen) return "both";
    return "both";
  }

  getAudioVideoBySubscribeType(subscribeType: string) {
    switch (subscribeType) {
      case "audio":
        return {
          audio: true,
          video: false,
        };
      case "video":
        return {
          audio: false,
          video: true,
        };
      case "both":
        return {
          audio: true,
          video: true,
        };
      case "none":
        return {
          audio: false,
          video: false,
        };
      default:
        return {
          audio: true,
          video: true,
        };
    }
  }

  private async onMediaDevice(msg) {
    const { userId, mediaDeviceInfo } = msg.messageData;
    const JSON_media = JSON.parse(mediaDeviceInfo);
    const { portraitDegree, audio, video, screenShare } = JSON_media;
    const videoDom = document.getElementById(
      `remote_video_${userId}`
    ) as HTMLVideoElement;
    const audioDom = document.getElementById(
      `remote_audio_${userId}`
    ) as HTMLAudioElement;
    console.log("media-rotate======", this.peers, userId, video);
    // 1. 开启视频，关闭音频
    // 2. 关闭视频，开启音频
    // 3. 开启音频，开启视频
    // 4. 开启屏幕共享
    if (videoDom) video || screenShare ? videoDom.load() : videoDom.pause();
    if (this.upside && videoDom) {
      // 需要翻转拉流设备端界面
      switch (portraitDegree) {
        case 0:
          videoDom.setAttribute("style", "transform: rotateX(0deg)");
          break;
        // case 90:
        //   video.setAttribute("style", "transform: rotateX(270deg)");
        //   break;
        case 180:
          videoDom.setAttribute("style", "transform: rotateX(180deg)");
          break;
        // case 270:
        //   video.setAttribute("style", "transform: rotateX(90deg)");
        //   break;
        default:
          videoDom.setAttribute("style", "transform: rotateX(0deg)");
      }
    }
  }

  /**
   * 初始化
   * @param user 当前用户（后期替换成token）
   * @param ws  长连接地址 兼容用户配置
   * @param dom 视频窗口
   * @param token 用户token  兼容用户配置
   */
  connect(user: string, ws: string, dom: string, token: string) {
    try {
      const config = this.getConfig();
      this.ws = new WS(`${config.wsUrl}/${config.appId}/${config.accessToken}`);
      this.owner = user;
      // this.localVideo = document.getElementById(dom) as HTMLVideoElement;
      this.localDom = dom;
      // 挂载事件
      store.on("ICE_CANDIDATE", this.onIceCandidate.bind(this));
      store.on("CHANNEL_ACTION", this.onChannelAction.bind(this));
      store.on("AGAIN_SUBSCRIBE", this.onResubscribe.bind(this));
      store.on("MEDIA_DEVICE", this.onMediaDevice.bind(this));
      store.on("MEDIA_CHANGE", this.onMediaChange.bind(this));
    } catch (e) {
      console.log("e========", e);
      throw e;
    }
  }

  /**
   * 监听设备变化事件
   * @param deviceList
   * @private
   */
  private async onMediaChange({ oldList, newList }) {
    // 旧设备列表
    const oldVideoList = getVideoDeviceList(oldList);
    const oldAudioList = getAudioDeviceList(oldList);
    // 新设备列表
    const newVideoList = getVideoDeviceList(newList);
    const newAudioList = getAudioDeviceList(newList);

    if (oldVideoList.length !== newVideoList.length) {

      console.log(
        'VIDEO_CHANGE videoTrack', 
        this.streamManager[this.owner]?.getStreamVideoTrack(),
        (this.streamManager[this.owner]?.getStreamVideoTrack() as any)?.getSettings()
      )
      
      // 无视频设备
      if (!newVideoList.length) {
        // 当前视频流开关为true，则关闭视频流
        if (this.streamManager[this.owner]?.getStreamVideo()) {
          await this.switchMediaConstraints('video', false)
        }
      }
      // 有视频设备但在屏幕共享中，不告诉业务端设备变化
      else if (this.streamManager[this.owner]?.getScreenShare()) {
        return
      }
      // 视频设备发生变更
      store.emit("VIDEO_CHANGE", { deviceList: newVideoList });
    }

    if (oldAudioList.length !== newAudioList.length) {
      // 音频设备发生变更
      store.emit("AUDIO_CHANGE", { deviceList: newAudioList });
      console.log(
        'AUDIO_CHANGE audioTrack', 
        this.streamManager[this.owner]?.getStreamAudioTrack(),
        (this.streamManager[this.owner]?.getStreamAudioTrack() as any)?.getSettings()
      )
      // 无音频设备，且当前音频流开关为true，则关闭音频流
      if (
        !newAudioList.length && 
        this.streamManager[this.owner]?.getStreamAudio()
      ) {
        await this.switchMediaConstraints('audio', false)
      }
    }

    console.log("device======", oldList, newList);
  }

  /**
   * 设置本地视频文件推流
   * @param file
   * @param dom
   */
  async setLocalVideoFile(file: File, dom: string) {
    const stream = await this.deviceManager.getFileStream(file, dom);
    this.streamManager[this.owner] = new StreamManager(
      <MediaStream>stream,
      true,
      true,
      false
    );
    this.streamManager[this.owner].setStreamType(<StreamType>"local");
    this.streamManager[this.owner].setStreamAudio(<boolean>true);
    this.streamManager[this.owner].setStreamVideo(<boolean>true);
  }
/**
 * 获取pc连接状态
 */
getUserStreamState(userId:string){
  return this.peers[userId]?.connectState
}
  /**
   * peer连接状态发生改变
   * @param connectionState
   * @param userId
   */
  onConnectChange(connectionState: 'disconnected'| 'connected' | 'failed', userId?: string) {
    console.log(
      "%c [RTC SDK] onConnectChange.....",
      "color:gray;font-size:20px;",
      connectionState, 
      userId
    );
    const user = userId ? userId : this.owner;
    if(this.peers[user])  this.peers[user].connectState = connectionState;
    // pc连接状态变更
    store.emit("onUserStreamConnectState", {
      messageData: {
        userId:user,
        state:connectionState,
      },
    });
    if (this.timer[user]) clearTimeout(this.timer[user]);
    if (connectionState === "disconnected" || connectionState === "failed") {
      const refresh = () => {
        this.timer[user] = setTimeout(async () => {
          if (userId && !this.peers[userId]) {
            clearTimeout(this.timer[userId]);
            return;
          }
          try {
            console.log("reconect---id", userId);
            const remoteUserList = await this.getUserList(this.channelId);

            if (!userId) {
              await this.reconnectChannel();
            } else {
              const currentUserInfo = remoteUserList.find(
                (userInfo) => userInfo.userId === userId
              );
              const mediaInfoString = currentUserInfo?.mediaDeviceInfo || "{}";
              const mediaDeviceInfo = JSON.parse(mediaInfoString);
              await this.reconnectChannel(userId, mediaDeviceInfo);
              store.emit("MEDIA_DEVICE", {
                messageData: {
                  userId,
                  mediaDeviceInfo: mediaInfoString,
                },
              });
            }
            store.emit("RECONNECT", { channelId: this.channelId, user });
            clearTimeout(this.timer[user]);
          } catch (e: any) {
            console.log("reconnection=======error", e.message, e.code);
            if (e.code) {
              const { code } = e;
              if ([20001, 10014, 10004].includes(code)) {
                store.emit("SOCKET", { messageData: { code } });
                clearTimeout(this.timer[user]);
              } else {
                refresh();
              }
            } else {
              refresh();
            }
          }
        }, 2000);
      };
      refresh();
    }
  }

  /**
   * 频道内用户重连
   * 频道内用户重连
   * @param userId
   */
  async reconnectChannel(
    userId?: string,
    mediaInfo?: { audio: boolean; video: boolean }
  ) {
    const config = this.getConfig();
    let pc: Peer, offer: RTCSessionDescription;
    if (userId) {
      // 拉流
      const pc = this.peers[userId];
      if (!pc) {
        return;
      }
      const subscribeUserIdList = !pc.streamType
        ? [userId]
        : [
            {
              userId,
              stream: pc.streamType,
              subscribeType: pc.subscribeType,
            },
          ];
      const { data } = await this.service!.reconnectionChannel({
        channelId: this.channelId,
        subscribeUserIdList,
        subscribeInfoList: subscribeUserIdList,
      });
      if (data.reconnectionSubscribeList[0].sdpOffer) {
        // 判断sdpOffer不为空再创建answer信息
        const answer = (await this.peers[userId].sendAnswer({
          type: "offer",
          sdp: data.reconnectionSubscribeList[0].sdpOffer,
        })) as RTCSessionDescription;
        await this.service!.answerSubscribe({
          channelId: this.channelId,
          userId: userId,
          sdpAnswer: answer?.sdp,
        });

        await this.peers[userId].renderMediaStream({
          container: document.getElementById(`remote_${userId}`),
          userId,
          video: mediaInfo?.video,
          audio: mediaInfo?.audio,
        });
      } else {
        throw `重连失败，${userId}---sdpOffer-null`;
      }
    } else {
      // 删除原推流连接
      if (this.peers[this.owner]) {
        this.peers[this.owner].destroy();
        delete this.peers[this.owner];
      }

      const stream = this.streamManager[this.owner].getStream();
      const audio = this.streamManager[this.owner].getStreamAudio();
      const video = this.streamManager[this.owner].getStreamVideo();
      const screen = this.streamManager[this.owner].getScreenShare();

      console.log('reconnectChannel ', audio, video, screen)
      console.log('constraints ', this.constraints)

      // 新建推流peerConnection 存在音视频或者屏幕共享的媒体流
      if (audio || video || screen) {
        // 不存在音视频，则不创建PeerConnection
        pc = new Peer(
          config.iceServers,
          (c) => this.sendIceCandidate(c, null),
          (status) => this.onConnectChange(status.connectionState),
          value=>this.reportVideoQuality(value)
        );
        pc.switchLocalStream(<MediaStream>stream, {
          simulcast: this.simulcast && !screen,
          constraints: this.constraints,
          bitrate: this.bitrate,
          maintainResolution: this.maintainResolution,
          screen: screen,
        });
        offer = (await pc.sendOffer(true)) as RTCSessionDescription;
        this.upside = offer?.sdp.indexOf("video-orientation") === -1;
        this.isEmpty = !audio && !video;
      }

      try {
        // 本端连接
        const { data } = await this.service!.reconnectionChannel({
          channelId: this.channelId,
          sdpOffer: audio || video || screen ? offer!.sdp : null,
        });

        if (data.sdpAnswer && pc!) {
          await pc.sendAnswer({
            type: "answer",
            sdp: data.sdpAnswer,
          });
        } else {
          if (audio || video || screen) {
            throw {
              errMsg: "sdpAnswer is null",
            };
          }
        }

        this.peers[this.owner] = pc!;
      } catch (e: any) {
        if (pc!) pc.destroy();
        clearTimeout(this.timer[this.owner]);
        throw {
          ...e,
        };
      }
    }
  }
  
  
  /**
   * 加入音视频链接
   * @param channelId 频道
   * @param password 频道密码
   * @param constraints 音视频参数
   * @param isEmpty 本地音视频设备是否存在
   * @param audio 音频开关
   * @param video 视频开关
   * @param bitrate 码率
   * @param minDelay 最小延迟
   * @param maxDelay 最大延迟
   * @param invitor 邀请人id
   */
  async join(
    channelId,
    isEmpty: boolean,
    password: string = "",
    constraints = "360P",
    audio: boolean = false,
    video: boolean = false,
    bitrate: number = 2000000,
    minDelay: number = 10,
    maxDelay: number = 150,
    invitor?: string,
    timeout= 30000
  ): Promise<{ userId: string; mediaDeviceInfo: string }[]> {
    const config = this.getConfig();
    let offer: RTCSessionDescription;

    try {
      // 本地连接存储
      let pc: Peer;
      this.channelId = channelId;
      this.password = password;
      // 音视频流均关闭 则不拉取本地音视频流
      if (!audio && !video) isEmpty = true;

      this.constraints = constraints;
      this.bitrate = bitrate;
      this.streamManager[this.owner]?.closeStream();
      // 获取本地视频流
      const stream = await this.deviceManager.getUserMedia(
        CONSTRAINTS_OPTIONS[constraints]
          ? { audio, video: video ? CONSTRAINTS_OPTIONS[constraints] : false }
          : MEDIA_CONSTRAINTS
      );

      if (stream?.active) {
        this.streamManager[this.owner] = new StreamManager(
          <MediaStream>stream,
          audio,
          video,
          false
        );
      } else {
        isEmpty = true;
      }
      this.isEmpty = isEmpty;
      // 有音或视频流，=》设置streamManager相关属性标识，创建pc连接，并渲染本地流
      if (!isEmpty) {
        // 设置媒体流类型
        this.streamManager[this.owner].setStreamType(<StreamType>"user");
        // 设置音视频状态
        this.streamManager[this.owner].setStreamVideo(<boolean>video);
        this.streamManager[this.owner].setStreamAudio(<boolean>audio);

        // 将本地视频流放置于初始化video容器中
        // 创建链接
        pc = new Peer(
          config.iceServers,
          (c) => this.sendIceCandidate(c, null),
          (status) => {
            this.onConnectChange(status.connectionState);
          },
          value=>this.reportVideoQuality(value)
        );

        pc.addMediaStream(
          <MediaStream>stream,
          <HTMLVideoElement>document.getElementById(this.localDom)
        );
        this.peers[this.owner] = pc;
      }
      // 无音频和视频 
      else {
        const streamType: StreamType =
          this.streamManager[this.owner]?.getStreamType();
        if (streamType === <StreamType>"local") {
          // const stream: MediaStream =
          //   this.streamManager[this.owner].getStream();
          // 创建链接

          pc = new Peer(
            config.iceServers,
            (c) => this.sendIceCandidate(c, null),
            (status) => {
              this.onConnectChange(status.connectionState);
            }
          );
          this.peers[this.owner] = pc;
        }
      }

      if (this.streamManager[this.owner]) {
        const stream = this.streamManager[this.owner].getStream();
        // 获取音视频媒体流之后，再重置一次音视频状态
        audio = this.streamManager[this.owner].getStreamAudio();
        video = this.streamManager[this.owner].getStreamVideo();
        // 将本地音视频流加入peer链接中
        pc!.switchLocalStream(<MediaStream>stream, {
          simulcast: this.simulcast,
          constraints: this.constraints,
          bitrate: this.bitrate,
          maintainResolution: this.maintainResolution,
        });
        // debugger;
        // this.localStream = stream;
        offer = (await pc!.sendOffer(true)) as RTCSessionDescription;
        this.upside = offer.sdp.indexOf("video-orientation") === -1;
      }

      // 本地推流
      // 向远端发起加入会议
      const streamType: StreamType =
        this.streamManager[this.owner]?.getStreamType();
      console.log("iifofo", isEmpty, streamType);
      const { data } = await this.service!.joinChannel({
        channelId: channelId,
        sdpOffer: this.isEmpty && streamType !== "local" ? null : offer!.sdp,
        password,
        bitrate,
        maxDelay,
        minDelay,
        inviteUserId: invitor,
        mediaDeviceInfo: JSON.stringify({
          audio,
          video,
          maxResolution: constraints,
        }),
      });

      if (data.sdpAnswer) {
        // 与云端建立响应
        await pc!.sendAnswer({ type: "answer", sdp: data.sdpAnswer });
      } else {
        console.log("sdpAnswer is null");
      }
      // 设置频道id
      this.ws?.setChannelId(channelId);
      // 返回频道内的用户信息（不包括本端用户）

    // 查询是否连接成功
    if(this.peers[this.owner]){
      // 创建了peer后需要获取状态
      await queryResult(()=>this.peers[this.owner].connectState==='connected',timeout)
    }

      return data;
    } catch (e: any) {
      console.error("[RTC SDK] join channel error", e);
      this.streamManager[this.owner]?.closeStream()
      this.peers[this.owner] && this.peers[this.owner].destroy();
      throw e;
    }
  }

  /**
   * 修改媒体流配置
   * @param bitrate
   * @param minDelay
   * @param maxDelay
   */
  async changeStreamConfigure(bitrate, minDelay, maxDelay) {
    this.peers[this.owner].pc.getSenders().forEach((sender) => {
      const params = sender.getParameters();
      if (params.encodings.length > 1) {
        sender.setParameters({
          ...params,
          encodings: [
            {
              rid: "l",
              active: true,
              // minBitrate: opts.low ? opts.low : 30000,
              maxBitrate: bitrate / 8,
              scaleResolutionDownBy: 4,
            },
            {
              rid: "h",
              active: true,
              // minBitrate: 100000,
              maxBitrate: bitrate,
            },
            {
              rid: "n",
              active: false,
            },
          ],
        });
      } else if (params.encodings.length == 1) {
        let encoding = params.encodings[0]
        encoding.maxBitrate = bitrate
        sender.setParameters({
          ...params,
          encodings: [encoding],
        })
      }
    });
    try {
      await this.service?.updateStreamConfig({
        channelId: this.channelId,
        bitrate,
        minDelay,
        maxDelay,
      });
      this.bitrate = bitrate;
    } catch (e: any) {
      console.error("[RTC SDK] change stream configure", e);
      throw e;
    }
  }

  /**
   * 订阅
   * @param userList
   * @param muted
   */
  async subscribe(
    userList:
      | { userId: string; stream: string; subscribeType: string }[]
      | string[],
    muted: boolean = this.speakerMute
  ) {
    this.speakerMute = muted;
    await this.subScribeTask.do(
      async () => await this.subscribeTaskFun(userList, muted)
    );
  }
  private async subscribeTaskFun(
    userList:
      | { userId: string; stream: string; subscribeType: string }[]
      | string[],
    muted: boolean = false
  ) {
    const config = this.getConfig();
    try {
      for (const user of userList) {
        let userId, stream, subscribeType;
        if (typeof user === "string") {
          // 兼容1.4.x接口内容仅存在userId
          userId = user;
        } else {
          //  1.5.x 音视频订阅接口更新
          userId = user.userId;
          stream = user.stream;
          subscribeType = user.subscribeType;
        }
        // 校验当前用户连接是否已存在
        if (this.peers[userId] && userId !== this.owner) {
          this.peers[userId].destroy();
          delete this.peers[userId];
        }

        // 新建媒体流连接
        this.peers[userId] = new Peer(
          config.iceServers,
          (c) => this.sendIceCandidate(c, userId),
          (e) => {
            this.onConnectChange(e.connectionState, userId);
          }
        );

        // 订阅接口
        const { data } = await this.service!.subscribeChannel({
          channelId: this.channelId,
          userId,
          stream,
          subscribeType,
        });
        // debugger;
        // 设置媒体流类型
        this.peers[userId].setSubscribeType(subscribeType);
        // 设置媒体流状态
        this.peers[userId].setStreamType(stream);
        console.log("local-answer========before", new Date().getTime());
        // sdp信息存在
        if (data.sdpOffer && data.sdpOffer !== "") {
          console.log("local-answer========data.sdpOffer");

          // if (true) {
          // 判断sdpOffer不为空再创建answer信息
          const sdpAnswer = (await this.peers[userId].sendAnswer({
            type: "offer",
            sdp: data.sdpOffer,
          })) as RTCSessionDescription;
          console.log("local-answer========", sdpAnswer, new Date().getTime());
          // 提交Answer信息
          await this.service!.answerSubscribe({
            channelId: this.channelId,
            userId,
            sdpAnswer: sdpAnswer.sdp,
          });
          console.log("join======", userId, this.peers);
          // 根据订阅类型匹配音视频状态
          const { audio, video } =
            this.getAudioVideoBySubscribeType(subscribeType);
          // 渲染音视频内容
          this.peers[userId].renderMediaStream({
            container: document.getElementById(`remote_${data.userId}`),
            video,
            audio,
            userId,
            muted,
          });
        }
      }
    } catch (e: any) {
      console.error("[RTC SDK] subscribe user error", e);
      // ws断开1分钟回调，被动离开频道
      if (e.code === 10014) {
        store.emit("SOCKET", { messageData: { code: e.code } });
      }else {
        throw e
      }
    }
  }

  /**
   * 切换频道内用户视频流大小
   * @param userId
   * @param stream
   */
  async switchRemoteStream(userId: string, stream: string) {
    try {
      const { data } = await this.service!.switchStream({
        userId,
        stream,
        channelId: this.channelId,
      });
      return data;
    } catch (e) {
      console.error("[RTC SDK] switch remote stream error", e);
      throw e;
    }
  }

  /**
   * 取消订阅
   * @param userIdList
   */
  async cancelSubscribe(userIdList: string[]): Promise<boolean> {
    try {
      if (userIdList.length > 0) {
        for (const user of userIdList) {
          this.peers[user].destroy();
        }
      }
      const { message } = await this.service!.cancelSubscribeChannel({
        // userId: this.owner,
        userIdList,
        channelId: this.channelId,
      });
      return message === "success";
    } catch (e) {
      console.error("[RTC SDK] cancel subscribe user error", e);
      throw e;
    }
  }

  /**
   * 获取视频流内的调试信息
   * @param user
   */
  async getStreamInfo(user: string): Promise<any[]> {
    try {
      // console.log("local-info---------", user, this.owner);
      let info;
      if (user === this.owner) {
        info = await this.peers[this.owner]?.getLocalStreamInfo();
      } else {
        if (this.peers[user]) {
          info = await this.peers[user].getRemoteStreamInfo();
        } else {
          throw "当前用户" + user + "不存在peer连接";
        }
      }
      return info;
    } catch (e) {
      console.error("[RTC SDK] get stream info error", e);
      throw e;
    }
  }

  /**
   * 选择本地视频流分辨率
   * @param selector
   */
  async selectVideoConstraints(selector: Constraints) {
    try {
      if (this.peers[this.owner]) {
        const streamManager = this.streamManager[this.owner];
        const audio = streamManager.getStreamAudio();
        const video = streamManager.getStreamVideo();
        const screenShare = streamManager.getScreenShare();
        await streamManager.setStreamVideoConstraints(
          CONSTRAINTS_OPTIONS[selector]
        );
        this.constraints = selector;
        return await this.service!.setMediaDeviceChannel({
          channelId: this.channelId,
          // userId: this.owner,
          mediaDeviceInfo: JSON.stringify({
            audio,
            video,
            screenShare,
            netQuality:this.peers[this.owner].netQuality
          }),
        });
      }
    } catch (e) {
      console.error("[RTC SDK] select video constraints error", e);
      throw e;
    }
  }

  /**
   * 重置音视频流状态
   * @param constraints
   * @param audio
   * @param video
   * @param screen
   * @param audioDevice
   * @param videoDevice
   * @private
   */
  private async resetConstraints({
    constraints,
    audio,
    video,
    screen,
    audioDevice,
    videoDevice,
  }: RestartMediaConstraints): Promise<StreamManager> {
    let timer;
    try {
      const localVideo = document.getElementById(
        this.localDom
      ) as HTMLVideoElement;
      // 当前无视频流，需要再次拉起视频流，再切换视频流
      const stream = screen
        ? // 已开启屏幕共享时，需要再原有的屏幕共享中再加入音频
          await this.deviceManager.getDisplayMedia(
            <DisplayMediaStreamConstraints>constraints,
            audioDevice
          )
        : await this.deviceManager.getUserMedia(
            <MediaStreamConstraints>constraints,
            audioDevice,
            videoDevice
          );
      const streamManager = new StreamManager(
        <MediaStream>stream,
        audio,
        video,
        screen
      );
      streamManager.setStreamType(
        screen ? <StreamType>"display" : <StreamType>"user"
      );
      streamManager.setStreamVideo(video);
      streamManager.setStreamAudio(audio);
      this.streamManager[this.owner]?.closeStream()
      this.streamManager[this.owner] = streamManager;
      await this.reconnectChannel();
      localVideo.srcObject = stream;
      if (timer) clearTimeout(timer);
      return streamManager;
    } catch (e) {
      timer = setTimeout(async () => {
        await this.resetConstraints({
          constraints,
          audio,
          video,
          screen,
          audioDevice,
          videoDevice,
        });
      }, 2000);
      throw e;
    }
  }

  /**
   * 重置媒体流配置
   * @param media
   * @param flag
   * @param restart
   * @param deviceId
   */
  async switchMediaConstraints(
    media: string,
    flag: boolean,
    restart?: boolean,
    deviceId?: string
  ): Promise<boolean> {
    try {
      if (this.channelId === "") return false;
      let constraints: MediaStreamConstraints = { audio: true, video: true };
      let inputParams: RestartMediaConstraints;
      let restartParams: RestartMediaConstraints;
      let streamManager = this.streamManager[this.owner];
      // 获取视频流状态
      const videoTrack = !!this.deviceManager.getCameraTrack();
      const audioTrack = !!this.deviceManager.getMicroTrack();
      const screenTrack = !!this.deviceManager.getScreenTrack();
      const videoFlag = !!streamManager
        ? streamManager.getStreamVideo()
        : false;
      const audioFlag = !!streamManager
        ? streamManager.getStreamAudio()
        : false;

      const screenShare = !!streamManager
        ? (streamManager.getScreenShare() as boolean)
        : false;
      // 过滤音视频参数内容
      switch (media) {
        case "video":
          constraints = {
            video: CONSTRAINTS_OPTIONS[this.constraints],
            audio: audioTrack,
          };
          inputParams = {
            constraints,
            audio: audioFlag,
            video: flag,
            screen: screenShare,
            videoDevice: deviceId,
          };
          restartParams = {
            constraints,
            audio: audioFlag,
            video: flag,
            screen: screenShare,
            videoDevice: deviceId,
          };
          break;
        case "audio":
          constraints = {
            video: videoTrack ? CONSTRAINTS_OPTIONS[this.constraints] : false,
            audio: true,
          };
          inputParams = {
            constraints,
            audio: flag,
            video: videoFlag,
            screen: screenShare,
            audioDevice: deviceId,
          };
          restartParams = {
            constraints,
            audio: flag,
            video: videoFlag,
            screen: screenShare,
            audioDevice: deviceId,
          };
          break;
        default:
          constraints = { video: true, audio: true };
          break;
      }

      if (restart && !screenShare) {
        await this.resetConstraints(<RestartMediaConstraints>restartParams!);
      }

      if (!audioTrack || (!videoTrack && !screenTrack)) {
        flag &&
          (await this.resetConstraints(<RestartMediaConstraints>inputParams!));
      } else {
        console.log(
          "screen========",
          screenShare,
          streamManager.getStreamVideo()
        );
      }
      // 最新开关状态
      const latestAudioFlag = media === "audio" ? flag : audioFlag
      const latestVideoFlag = media === "video" ? flag : videoFlag
      this.streamManager[this.owner].setStreamAudio(latestAudioFlag);
      this.streamManager[this.owner].setStreamVideo(latestVideoFlag); // !screenShare 不区分屏幕共享状态
      
      this.isEmpty = !latestAudioFlag && !latestVideoFlag
        // !this.streamManager[this.owner].getStreamAudio() &&
        // !this.streamManager[this.owner].getStreamVideo();

      const { message } = await this.service!.setMediaDeviceChannel({
        channelId: this.channelId,
        mediaDeviceInfo: JSON.stringify({
          video: latestVideoFlag,
          audio: latestAudioFlag,
          screenShare,
          netQuality:this.peers[this.owner]?.netQuality
        }),
      });
      return message === "success";
    } catch (e: any) {
      console.error("[RTC SDK] switch media constraints error", e);
      throw e;
    }
  }

/**
 * 上报视频推流质量
 */
  private async reportVideoQuality(netQuality:number):Promise<void>{
    const { message } = await this.service!.setMediaDeviceChannel({
      channelId: this.channelId,
      mediaDeviceInfo: JSON.stringify({
        video: this.streamManager[this.owner]?.getStreamVideo(),
        audio: this.streamManager[this.owner]?.getStreamAudio(),
        screenShare:this.streamManager[this.owner]?.getScreenShare(),
        netQuality

      }),
    });

  }
  /**
   * 本地视频开关
   * @param flag
   * @param restart
   * @param deviceId
   */
  async switchVideoConstraints(
    flag: boolean,
    restart?: boolean,
    deviceId?: string
  ): Promise<boolean> {
    try {
      return await this.switchMediaConstraints(
        "video",
        flag,
        restart,
        deviceId
      );
    } catch (e) {
      console.error("[RTC SDK] video audio constraints error", e);
      throw e;
    }
  }

  /**
   * 切换本地语音开关
   * @param flag
   * @param restart
   * @param deviceId
   */
  async switchAudioConstraints(
    flag: boolean,
    restart?: boolean,
    deviceId?: string
  ): Promise<boolean> {
    try {
      return await this.switchMediaConstraints(
        "audio",
        flag,
        restart,
        deviceId
      );
    } catch (e) {
      console.error("[RTC SDK] switch audio constraints error", e);
      throw e;
    }
  }

  /**
   * 设置播放音量
   * @param volume
   */
  adjustPlaybackVolume(volume: number) {}

  /**
   * 获取支持的视频流设备
   */
  async getMediaDevices() {
    return enumerateDevices();
  }

  async getChannelList() {
    return await this.service!.getChannelList();
  }

  async reloadMemberList() {
    const channelId = this.channelId;
    if (!channelId) {
      return;
    }
    const { data } = await this.service!.getChannelList();
    const current = data?.find((c) => c.channelId === channelId);
    if (!current) {
      this.closeInternal();
      store.emit("CLOSED", { channelId: this.channelId });
      return;
    }
    for (const id of Object.keys(this.peers)) {
      if (!current.membersList.find((p) => p.userId === id)) {
        this.peers[id].destroy();
        delete this.peers[id];
        if (this.onReceiveMessage) {
          this.onReceiveMessage(channelId, "", {
            operateType: "LEAVE",
            activeOperateUser: id,
          });
        }
      }
    }
    for (const p of current.membersList) {
      if (p.userId === this.owner) {
        continue;
      } else if (!this.peers[p.userId]) {
        if (this.onReceiveMessage) {
          this.onReceiveMessage(channelId, "", {
            operateType: "JOIN",
            activeOperateUser: p.userId,
            mediaDeviceInfo: p.mediaDeviceInfo,
          });
        }
      } else {
        store.emit("MEDIA_DEVICE", {
          messageData: p,
        });
      }
    }
  }

  /**
   * 发送端上转发消息
   * @param msg
   * @param userIdList
   */
  async sendDeviceMsg(msg, userIdList?) {
    return await this.service!.sendForwardMsg({
      channelId: this.channelId,
      userIdList,
      sendMessageStr: JSON.stringify({
        fromUserId: this.owner,
        forwardMessage: JSON.stringify(msg),
        timestamp: new Date().getTime(),
      }),
    });
  }

  /**
   * 监听屏幕共享媒体流结束
   * @param type
   * @private
   */
  private async endCapture({ type }) {
    if (type === "display") {
      await this.startCapture(false);
      store.emit("END_CAPTURE", {
        userId: this.owner,
        channelId: this.channelId,
      });
    }
  }

  /**
   * 屏幕共享
   * @param flag 开关
   * @param constraints 视频参数
   * @param localAudio 本地音频
   */
  async startCapture(
    flag: boolean,
    constraints: string = "1080P",
    localAudio: boolean = false
  ): Promise<boolean | null> {
    try {
      let stream: MediaStream, streamType: string;
      const streamManager = this.streamManager[this.owner];
      console.log(' streamManager: ', streamManager)
      // 音频开关状态
      let audio = streamManager ? streamManager.getStreamAudio() : false;
      // 视频开关状态
      let video = streamManager ? streamManager.getStreamVideo() : false;
      // 音轨存在标识
      const audioFlag = !!streamManager
        ? !!this.deviceManager.getMicroTrack()
        : false;
        // 视频轨存在标识
      const videoFlag = !!streamManager
        ? !!this.deviceManager.getCameraTrack()
        : false;
      
      // 开启屏幕共享
      if (flag) {
        try {
          stream = (await this.deviceManager.getDisplayMedia({
            video: DISPLAY_CONSTRAINTS_OPTIONS[constraints],
            audio: true,
          })) as MediaStream;
          // 监听屏幕共享关闭后，自动开启摄像头
          store.on("VIDEO_END", this.endCapture.bind(this));
          streamType = "display";
          this.streamManager[this.owner]?.closeVideo()
        } catch (e: any) {
          // 用户拒绝授权屏幕共享 不进行操作
          if (e === "NotAllowedError") {
            return null;
          } else {
            stream = new MediaStream();
            streamType = "user";
          }
        }
      }
      // 关闭屏幕共享
      else {
        store.off("END_CAPTURE", this.endCapture);
        if (audioFlag || videoFlag) {
         
          stream = (await this.deviceManager.getUserMedia({
            audio: audioFlag,
            video: video ? CONSTRAINTS_OPTIONS[this.constraints] : false,
          })) as MediaStream;
          // 无音频也无视频
          if (!stream) {
            audio = false;
            video = false;
            stream = new MediaStream();
          }
          // 无音频有视频
          else if (!this.deviceManager.getMicroTrack()) {
            audio = false;
          }
          // 有音频无视频
          else if (!this.deviceManager.getCameraTrack()) {
            video = false;
          }
          this.streamManager[this.owner]?.closeStream()
        } else {
          stream = new MediaStream();
        }
        // 关闭屏幕共享的视频流
        this.deviceManager.stopTrack(
          <MediaStreamTrack>this.deviceManager.getScreenTrack()
        );
        this.deviceManager.setScreenTrack(undefined);
        streamType = "user";
      }
      this.streamManager[this.owner] = new StreamManager(
        <MediaStream>stream,
        audio,
        video,
        flag
      );
      // 设置当前媒体流类型
      this.streamManager[this.owner].setStreamType(<StreamType>streamType);
      // 设置当前屏幕共享状态
      this.streamManager[this.owner].setScreenShare(<boolean>flag);
      // 同步音频状态
      this.streamManager[this.owner].setStreamAudio(audio);

      // 屏幕共享时关闭大小流, 需要重连
      await this.reconnectChannel();
      const localVideo = document.getElementById(
        this.localDom
      ) as HTMLVideoElement;
      if (localVideo) {
        localVideo.pause();
        localVideo.srcObject = stream;
        localVideo.load();
      }
      await this.service!.setMediaDeviceChannel({
        channelId: this.channelId,
        mediaDeviceInfo: JSON.stringify({
          video,
          audio,
          screenShare: flag,
          netQuality:this.peers[this.owner]?.netQuality
        }),
      });
      return flag;
    } catch (e) {
      console.error("[RTC SDK] start capture error", e);
      throw e;
    }
  }

  /**
   * 拒绝邀请
   */
  async refuseInvite(
    channelId: string,
    refuseState: string = "refuse",
    invitor: string = ""
  ) {
    try {
      await this.service!.refuseChannel({
        channelId: channelId ? channelId : this.channelId,
        refuseState,
        inviteUserId: invitor,
      });
    } catch (e) {
      console.error("[RTC SDK] refuse invite error", e);
      throw e;
    }
  }

  /**
   * 主动取消呼叫
   */
  async callCancel(userIdList: string[], channelId?: string) {
    try {
      const { data } = await this.service!.callCancel(
        channelId ? channelId : this.channelId,
        userIdList
      );
      return data;
    } catch (e) {
      console.error("[RTC SDK] call cancel error", e);
      throw e;
    }
  }

  /**
   * 开始屏幕录制
   * @param params
   */
  async startRecording(params) {
    try {
      await this.service!.startRecording({
        channelId: this.channelId,
        subStream: params.stream || "high", // 默认录制大流
        bucket: params.bucket || null,
        fileName: params.fileName || null,
      });
    } catch (e) {
      console.error("[RTC SDK] start recording error", e);
      throw e;
    }
  }

  /**
   * 结束屏幕录制
   * @param save
   */
  async stopRecording(save: boolean) {
    try {
      await this.service!.stopRecording({
        channelId: this.channelId,
        save,
      });
    } catch (e) {
      console.error("[RTC SDK] stop recording error", e);
      throw e;
    }
  }

  /**
   * 获取会议共享状态
   */
  async getShareInfo(channelId?: string) {
    try {
      return await this.service!.getShareInfo(
        channelId ? channelId : this.channelId
      );
    } catch (e) {
      console.error("[RTC SDK] get share info error", e);
      throw e;
    }
  }

  /**
   * 上报会议共享状态
   */
  async reportShareInfo(
    shareInfo: string,
    shareType: number, //共享类型：0无共享，1 屏幕共享，2 电子白板，3 AR标注，4 视频点选
    promoterUserId: string
  ) {
    try {
      return await this.service!.reportShareInfo({
        channelId: this.channelId,
        shareInfo,
        shareType,
        promoterUserId,
      });
    } catch (e) {
      console.error("[RTC SDK] report share info error", e);
      throw e;
    }
  }

  /**
   * 添加涂鸦信息
   * @param graffitiInfoList
   * @param promoterUserId
   */
  async addGraffiti(graffitiInfoList: any[], promoterUserId) {
    try {
      return await this.service!.addGraffiti({
        channelId: this.channelId,
        graffitiInfoList,
        promoterUserId,
      });
    } catch (e) {
      console.error("[RTC SDK] get graffiti info list error", e);
      throw e;
    }
  }

  /**
   * 查询涂鸦信息
   * @param channelId 频道id
   */
  async getGraffitiInfo(channelId: string) {
    try {
      return await this.service!.getGraffitiInfo(
        channelId ? channelId : this.channelId
      );
    } catch (e) {
      console.error("[RTC SDK] get graffiti info error", e);
      e;
    }
  }

  /**
   * 清空涂鸦信息
   * @param promoterUserId 操作人id
   * @param channelId 频道id
   */
  async clearGraffitiInfo(promoterUserId: string, channelId: string) {
    try {
      return await this.service!.clearGraffitiInfo({
        channelId: channelId ? channelId : this.channelId,
        promoterUserId: promoterUserId,
      });
    } catch (e) {
      console.error("[RTC SDK] clear graffiti info error", e);
      throw e;
    }
  }

  /**
   * 一键开关远端音频
   * @param flag
   */
  switchRemoteAudio(flag: boolean) {
    try {
      const memberList = Object.keys(this.peers);
      if (memberList.length > 0) {
        for (const mem of memberList) {
          if (mem !== this.owner) {
            const audioSrc = document.getElementById(
              `remote_audio_${mem}`
            ) as HTMLAudioElement;
            if (audioSrc) audioSrc.muted = !flag;
          }
        }
        this.speakerMute = !flag;
      }
    } catch (e) {
      console.error("[RTC SDK] switch remote audio error", e);
      throw e;
    }
  }

  /**
   * 切换音视频流
   * @param userId
   * @param subscribeType
   * @param stream
   */
  async switchStreamType(
    userId: string,
    subscribeType: string,
    stream: string
  ) {
    try {
      if (this.peers[userId]) {
        this.peers[userId].setStreamType(stream);
        this.peers[userId].setSubscribeType(subscribeType);
      }
      const res = await this.service!.switchStreamType({
        channelId: this.channelId,
        stream,
        subscribeType,
        userId,
      });
      if (this.peers[userId]) {
        const videoDom = document.getElementById(
          `remote_${userId}`
        ) as HTMLElement;
        const { audio, video } =
          this.getAudioVideoBySubscribeType(subscribeType);
        await this.peers[userId]?.renderMediaStream?.({
          container: videoDom,
          audio,
          video,
          userId,
        });
      }
      return res;
    } catch (e) {
      console.error("[RTC SDK] switchStreamType error", e);
      throw e;
    }
  }

  /**
   * 关闭peer连接
   * @param userId
   */
  closePeer(userId?: string) {
    if (userId) {
      if (this.peers[userId]) {
        this.peers[userId]?.destroy?.();
        delete this.peers[userId];
      }
    } else {
      const memberList = Object.keys(this.peers);
      if (memberList.length > 0) {
        for (const mem of memberList) {
          this.peers[mem]?.destroy?.();
          delete this.peers[mem];
        }
      }
    }
  }

  closeStream(userId?: string) {
    this.streamManager[this.owner]?.closeStream?.();
    delete this.streamManager[this.owner];
    if (userId) {
      if (this.streamManager[userId]) {
        this.streamManager[userId]?.closeStream?.();
        delete this.streamManager[userId];
      }
    } else {
      const streamList = Object.keys(this.streamManager);
      if (streamList.length > 0) {
        for (const user of streamList) {
          this.streamManager[user]?.closeStream?.();
          delete this.streamManager[user];
        }
      }
    }
  }
  closeSocket() {
    this.ws?.destroy?.();
  }
  /**
   * 大小流开关, 会议开启前调用
   * @param flag
   */
  enableSimulcast(flag: boolean) {
    // if (this.peers[this.owner]) throw "[RTC SDK] Before Join Meeting!";
    this.simulcast = flag;
  }

  enableMaintainResolution(enable: boolean) {
    if (enable == this.maintainResolution || !this.channelId) {
      return
    }
    this.maintainResolution = enable
    this.reconnectChannel()
  }

/**
 * 释放本地pc资源，但是不断开socket连接，等待下一次呼叫
 */
localDispose() {
  this.closeInternal();
}


  /**
   * 销毁rtc
   */
  dispose() {
    // 卸载事件
    this.onReceiveMessage = undefined;
    store.clear();

    this.closeInternal();
    // 关闭ws连接
    this.ws?.destroy?.();
    this.owner = "";

    window.localStorage.removeItem("rokid-rtc-access");
    window.localStorage.removeItem("rokid-rtc-refresh");
    this.service?.clearToken();
    this.config = {};
  }
}
