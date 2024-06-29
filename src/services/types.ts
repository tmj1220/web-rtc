/**
 * 频道入参请求
 */
export interface ChannelRequest {
  channelId: string;
  userId?: string;
}

export interface ChannelResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

export interface ChannelMember {
  userId: string;
  mediaDeviceInfo: string;
}

export interface ChannelAnswer {
  sdpAnswer: string;
  userId: string;
  code: number;
  message: string | null;
}

export interface ChannelRefuseRequest extends ChannelRequest {
  refuseState: string;
  inviteUserId?: string;
}

/**
 * 离开频道类型
 */
enum Operate {
  LEAVE = "LEAVE",
  LEAVE_AND_END = "LEAVE_AND_END",
}

interface OfferInfo {
  userId: string;
  // sdpOffer: string;
}

/**
 * 创建频道请求
 */
export interface ChannelCreateRequest {
  userIdList: string[];
  thirdChannelId?: string;
  password?: string;
  userId?: string;
  channelName?: string;
  maxMembers?: number;
  maxResolution?: string;
  channelSubject?: string;
  extraParams?: string;
  recordParams?: string;
  remark?: string;
}

export interface ChannelJoinRequest extends ChannelRequest {
  sdpOffer: string | null;
  password?: string;
  inviteUserId?: string;
  mediaDeviceInfo?: string;
  bitrate?: number;
  minDelay?: number;
  maxDelay?: number;
}

export interface ChannelUserIdRequest extends ChannelRequest {
  userIdList: string[];
}

export interface ChannelLeaveRequest extends ChannelRequest {
  operate: Operate;
}

export interface ChannelExtraRequest extends ChannelRequest {
  extraParams: string;
}

export interface ChannelSubscribeRequest extends ChannelRequest {
  userId: string;
  stream?: string;
  subscribeType?: string;
}

export interface ChannelMediaDeviceRequest extends ChannelRequest {
  mediaDeviceInfo: string;
}

export interface ChannelStreamType extends ChannelRequest {
  userId: string;
  subscribeType: string;
  stream: string;
}

export interface RTCMessage<T> {
  messageType: string;
  messageData: T;
  timestamp: number;
  channelId: string;
  messageId?: string;
}
