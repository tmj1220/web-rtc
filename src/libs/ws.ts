import store from "../event/store";
import { RTCMessage } from "../services/types";

export default class WS {
  private ws?: WebSocket;
  private timer: any;
  private beat: any;
  private unnormalClosed = false;  // 是否异常关闭
  private readonly url: string;

  public channelId?: string;

  setChannelId(channelId?: string) {
    this.channelId = channelId;
  }

  constructor(url: string) {
    this.url = url;
    this.connect(url);
  }

  private connect(url: string) {
    try {
      let isReopen = false;
      if (this.ws) {
        this.ws.close();
        isReopen = true;
      }
      this.ws = new WebSocket(url);
      // ws通道打开
      this.ws.onopen = () => {
        console.log(
          "%c [RTC SDK] ws opening.....",
          "color:greenyellow;font-size:20px;"
        );
        this.heartbeat();
        if (this.unnormalClosed) {
          store.emit('WS_RECONNECT', {url: url, channelId: this.channelId});
          this.unnormalClosed = false;
        }
      };
      // ws接受到推送消息
      this.ws.onmessage = (msg) => {
        console.log(
          "%c [RTC SDK] ws message.....",
          "color:cornflowerblue;font-size:20px;",
          msg
        );
        if (this.unnormalClosed) {
          store.emit('WS_RECONNECT', {url: url, channelId: this.channelId});
          this.unnormalClosed = false;
        }
        try {
          const { data } = msg;
          const jsonData = JSON.parse(data);
          this.onMessage(jsonData);
        } catch (e) {
          if (this.ws!.readyState === 2 || this.ws!.readyState === 3) {
            this.connect(url);
          }
          console.error("[RTC SDK] parse JSON data", e);
        }
      };
      // ws通道关闭
      this.ws.onclose = (e) => {
        console.log(
          "%c [RTC SDK] ws closing.....",
          "color:palevioletred;font-size:20px;"
        );
        this.unnormalClosed = true;
        store.emit('WS_CLOSE', { channelId: this.channelId });
        throw e;
      };
      // ws通道发生错误
      this.ws.onerror = (err) => {
        console.log(
          "%c [RTC SDK] ws error.....",
          "color:red;font-size:20px;",
          err
        );
        throw err;
      };
    } catch (e) {
      console.log('wsconnect error ', e)
      if (this.ws!.readyState === 2 || this.ws!.readyState === 3) {
        this.connect(url);
      }
    }
  }

  private heartbeat() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.connect(this.url);
    }, 15000);
    let msg: any = {
      messageType: "HEARTBEAT_PLUS",
      messageDetail: "ping",
    };
    if (this.channelId) {
      msg.messageData = {
        channelId: this.channelId,
      };
    }
    this.sendMsg(msg);
  }

  private onMessage(msg: RTCMessage<any>) {
    const { messageType, messageData, messageId, timestamp, channelId } = msg;
    if (messageType === "HEARTBEAT") {
      if (this.beat) clearTimeout(this.beat);
      this.beat = setTimeout(() => {
        this.heartbeat();
      }, 5000);
    } else {
      // 根据响应条件来触发事件
      store.emit(messageType, { messageData, messageId, timestamp, channelId });
    }
  }

  public sendMsg(msg: any) {
    this.ws!.send(JSON.stringify(msg));
  }

  public destroy() {
    this.ws?.close();
    if (this.timer) clearInterval(this.timer);
    if (this.beat) clearTimeout(this.beat);
    this.channelId = undefined;
    this.ws = undefined;
    this.unnormalClosed = false
  }
}
