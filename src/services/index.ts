import {
  ChannelCreateRequest,
  ChannelExtraRequest,
  ChannelResponse,
  ChannelJoinRequest,
  ChannelMediaDeviceRequest,
  ChannelRequest,
  ChannelSubscribeRequest,
  ChannelUserIdRequest,
  ChannelRefuseRequest,
  ChannelStreamType,
} from "./types";
import Fetch from "./fetch";

export default class Services {
  domain: string;
  token = "";
  fetch: Fetch;
  constructor(domain: string) {
    this.domain = domain;
    this.fetch = new Fetch();
    this.fetch.setConfig({
      "Access-Control-Allow-Headers": "*",
      "Content-Type": "application/json",
    });
  }

  setToken(token: string) {
    this.token = token;
    this.fetch.setConfig({
      Authorization: `Bearer ${this.token}`, // 认证信息
      timeout: 10000, // 请求超时时间
    });
  }

  clearToken() {
    this.token = "";
    this.fetch.resetConfig();
  }

  async getChannelUsers(params: ChannelRequest): Promise<ChannelResponse> {
    return await this.fetch.get(
      `${this.domain}/channel/getChannelSpaceUserList?channelId=${params.channelId}`,
      "getChannelUsers"
    );
  }

  /**
   * 创建频道
   * @param params
   */
  async createChannel(params: ChannelCreateRequest): Promise<ChannelResponse> {
    return await this.fetch.post(
      `${this.domain}/channel/create`,
      params,
      "createChannel"
    );
  }

  /**
   * 加入频道
   * @param params
   */
  async joinChannel(params: ChannelJoinRequest): Promise<ChannelResponse> {
    return await this.fetch.post(
      `${this.domain}/channel/join`,
      params,
      "joinChannel"
    );
  }

  /**
   * 邀请进入频道
   * @param params
   */
  async inviteChannel(params: ChannelUserIdRequest): Promise<ChannelResponse> {
    return await this.fetch.post(
      `${this.domain}/channel/invite`,
      params,
      "inviteChannel"
    );
  }

  /**
   * 离开频道
   * @param params
   */
  async leaveChannel(params: ChannelRequest): Promise<ChannelResponse> {
    return await this.fetch.post(
      `${this.domain}/channel/leave`,
      params,
      "leaveChannel"
    );
  }

  /**
   * 关闭频道
   * @param params
   */
  async closeChannel(params: ChannelRequest): Promise<ChannelResponse> {
    return await this.fetch.post(
      `${this.domain}/channel/end`,
      params,
      "closeChannel"
    );
  }

  /**
   * 踢出频道
   * @param params
   */
  async kickChannel(params: ChannelUserIdRequest): Promise<ChannelResponse> {
    return await this.fetch.post(
      `${this.domain}/channel/kick`,
      params,
      "kickChannel"
    );
  }

  /**
   * 拒接会议
   * @param params
   */
  async refuseChannel(params: ChannelRefuseRequest): Promise<ChannelResponse> {
    return await this.fetch.post(
      `${this.domain}/channel/refuse`,
      params,
      "refuseChannel"
    );
  }

  /**
   * 编辑业务逻辑参数
   * @param params
   */
  async setExtraChannel(params: ChannelExtraRequest): Promise<ChannelResponse> {
    return await this.fetch.post(
      `${this.domain}/channel/setExtraParams`,
      params,
      "setExtraChannel"
    );
  }

  async getExtraChannel(params): Promise<ChannelResponse> {
    return await this.fetch.get(
      `${this.domain}/channel/getExtraParams?channelId=${params.channelId}`,
      "getExtraChannel"
    );
  }

  /**
   * 订阅成员
   * @param params
   */
  async subscribeChannel(
    params: ChannelSubscribeRequest
  ): Promise<ChannelResponse> {
    return await this.fetch.post(
      `${this.domain}/channel/subscribe`,
      params,
      "subscribeChannel"
    );
  }

  async answerSubscribe(params): Promise<ChannelResponse> {
    return await this.fetch.post(
      `${this.domain}/channel/subscribeAnswer`,
      params,
      "answerSubscribe"
    );
  }

  /**
   * 取消订阅
   */
  async cancelSubscribeChannel(
    params: ChannelUserIdRequest
  ): Promise<ChannelResponse> {
    return await this.fetch.post(
      `${this.domain}/channel/unsubscribe`,
      params,
      "cancelSubscribeChannel"
    );
  }

  /**
   * 编辑频道端媒体设备信息
   * @param params
   */
  async setMediaDeviceChannel(
    params: ChannelMediaDeviceRequest
  ): Promise<ChannelResponse> {
    return await this.fetch.post(
      `${this.domain}/channel/updateMediaDeviceInfo`,
      params,
      "setMediaDeviceChannel"
    );
  }

  /**
   * 获取当前用户正在进行中的频道
   */
  async getRunningChannel() {
    return await this.fetch.get(
      `${this.domain}/channel/getRunningChannel`,
      "getRunningChannel"
    );
  }

  /**
   * 切换大小流
   * @param params
   */
  async switchStream(params: ChannelSubscribeRequest) {
    return await this.fetch.post(
      `${this.domain}/channel/switchStream`,
      params,
      "switchStream"
    );
  }

  /**
   * 断线重连
   * @param params
   */
  async reconnectionChannel(params) {
    return await this.fetch.post(
      `${this.domain}/channel/reconnection`,
      params,
      "reconnectionChannel"
    );
  }

  async getChannelScreenShare(channelId: string) {
    return await this.fetch.get(
      `${this.domain}/screenShare/getScreenShare?channelId=${channelId}`,
      "getChannelScreenShare"
    );
  }

  /**
   * 切换屏幕共享
   */
  async switchScreenShare(params) {
    return await this.fetch.post(
      `${this.domain}/screenShare/switch`,
      params,
      "switchScreenShare"
    );
  }

  /**
   * 配置用户的流
   * @param params
   */
  async updateStreamConfig(params) {
    return await this.fetch.post(
      `${this.domain}/channel/modifyStreamConfigure`,
      params,
      "updateStreamConfig"
    );
  }

  /**
   * 开启屏幕录制
   * @param params
   */
  async startRecording(params): Promise<ChannelResponse> {
    return await this.fetch.post(
      `${this.domain}/recording/start`,
      params,
      "startRecording"
    );
  }

  /**
   * 结束屏幕录制
   * @param params
   */
  async stopRecording(params) {
    return await this.fetch.post(
      `${this.domain}/recording/end`,
      params,
      "stopRecording"
    );
  }

  /**
   * 获取频道内正在录制的视频列表
   * @param params
   */
  async getRecordingList(params) {
    return await this.fetch.get(
      `${this.domain}/recording/getRecordingList?channelId=${params.channelId}`,
      "getRecordingList"
    );
  }

  /**
   * 交换ice信息
   * @param params
   */
  async sendIceCandidate(params) {
    return await this.fetch.post(
      `${this.domain}/channel/iceCandidate`,
      params,
      "sendIceCandidate"
    );
  }

  /**
   * 获取用户正在进行中的频道列表
   */
  async getChannelList() {
    return await this.fetch.get(
      `${this.domain}/channel/getChannelList`,
      "getChannelList"
    );
  }

  /**
   * 转发消息
   * @param params
   */
  async sendForwardMsg(params) {
    return await this.fetch.post(
      `${this.domain}/channel/forwardMessage`,
      params,
      "sendForwardMsg"
    );
  }

  /**
   * 初始化获取服务器信息
   */
  async getServerInfo(appId: string) {
    return await this.fetch.get(
      `${this.domain}/device/getInitConfig?appId=${appId}`,
      "getServerInfo"
    );
  }

  /**
   * 获取会议共享状态
   * @param channelId
   */
  async getShareInfo(channelId: string) {
    return await this.fetch.get(
      `${this.domain}/channel/getShareInfo?channelId=${channelId}`,
      "getShareInfo"
    );
  }

  /**
   * 上报会议共享状态
   */
  async reportShareInfo(params: {
    channelId: string;
    shareInfo: string;
    shareType: number; //共享类型：0无共享，1 屏幕共享，2 电子白板，3 AR标注，4 视频点选
    promoterUserId: string;
  }) {
    return await this.fetch.post(
      `${this.domain}/channel/shareInfoReport`,
      params,
      "reportShareInfo"
    );
  }

  /**
   * 添加涂鸦信息
   * @param params
   */
  async addGraffiti(params: {
    channelId: string;
    graffitiInfoList: any[];
    promoterUserId: string;
  }) {
    return await this.fetch.post(
      `${this.domain}/channel/addGraffiti`,
      params,
      "addGraffiti"
    );
  }

  /**
   * 查询涂鸦信息
   * @param channelId
   */
  async getGraffitiInfo(channelId: string) {
    return await this.fetch.get(
      `${this.domain}/channel/getGraffitiInfo?channelId=${channelId}`,
      "getGraffitiInfo"
    );
  }

  /**
   * 清空涂鸦信息
   * @param params
   */
  async clearGraffitiInfo(params: {
    channelId: string;
    promoterUserId: string;
  }) {
    return await this.fetch.post(
      `${this.domain}/channel/clearGraffitiInfo`,
      params,
      "clearGraffitiInfo"
    );
  }

  /**
   * 呼叫取消
   * @param userList
   * @param channelId
   */
  async callCancel(channelId: string, userList: string[]) {
    return await this.fetch.post(
      `${this.domain}/channel/callCancel`,
      {
        cancelUserIdList: userList,
        channelId,
      },
      "callCancel"
    );
  }

  /**
   * 切换音视频流
   */
  async switchStreamType(params: ChannelStreamType) {
    return await this.fetch.post(
      `${this.domain}/channel/switchSubscribeType`,
      params,
      "switchStreamType"
    );
  }
}
