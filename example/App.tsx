import React, { useEffect, useState, useReducer, useRef } from "react";
import {
  Button,
  Checkbox,
  Col,
  Collapse,
  Input,
  Layout,
  PageHeader,
  Row,
  Space,
  Select,
  Switch,
  Upload,
  message,
  Modal,
  InputNumber,
} from "antd";

// import store from "../src/event/store";
// import RTCSDK from "../lib";
import rtc from "../src";
// import rtc from "../lib";
import config from "./config";
import { getContactList } from "./request";

// debug

const { Panel } = Collapse;
const { confirm } = Modal;

// 生成rtc-SDK对象
console.log("env", window.location.hostname);
const env = {
  "web-rtc-dev.rokid.com": "dev",
  "web-rtc-test.rokid.com": "test",
  "web-rtc.rokid.com": "prod",
};
// @ts-ignore
// const rtc = new RTCSDK();
// rtc.init(config[env[window.location.hostname] || "local"].domain);
// const rtc = new RTCSDK("https://rtc-test.rokid-inc.com");

let timeClock = {};

const App: React.FC<any> = ({ changeAuth, auth }) => {
  const localView = useRef(null);
  const [contactList, setContactList] = useState<any[]>([]);
  const [channelId, setChannel] = useState<string>("");
  const [mediaType, setMediaType] = useState<string>("both");
  const [remoteStream, setRemoteStream] = useState<{ [key: string]: boolean }>(
    {}
  );
  const [localPlay, setLocalPlay] = useState<boolean>(false);
  const [videoFlag, setVideoFlag] = useState<boolean>(true);
  const [audioFlag, setAudioFlag] = useState<boolean>(true);
  const [remoteAudio, setRemoteAudio] = useState<boolean>(true);
  const [name, setName] = useState<string>("");
  const [bitRate, setBitRate] = useState<number>(2000000);
  const [minDelay, setMinDelay] = useState<number>(10);
  const [maxDelay, setMaxDelay] = useState<number>(150);
  const [degree, setDegree] = useState<number>(0);
  const [userList, setUserList] = useState<
    { userId: string; mediaDeviceInfo: any }[]
  >([]);
  const [modUserList, setModUserList] = useState<string[]>([]);
  const [deviceList, setDeviceList] = useState<any[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [showDevice, setShowDevice] = useState<boolean>(false);
  const [deviceType, setDeviceType] = useState<string>("");
  const [pwd, setPwd] = useState<string>("");
  const [constraints, setConstraints] = useState<string>("360P");
  const [share, setShare] = useState<boolean>(false);
  const [recording, setRecording] = useState<boolean>(false);
  const [streamInfo, dispatch] = useReducer((state, { type, payload }) => {
    // console.log("info", payload.info);
    console.log("streamInfo----------", state, timeClock);
    if (type === "refresh") {
      payload.info.forEach((stream, index) => {
        if (state[payload.userId] && state[payload.userId][index]) {
          if (stream.bytesReceived) {
            stream.bytesRate =
              (stream.bytesReceived -
                state[payload.userId][index].bytesReceived) /
              (stream.timestamp - state[payload.userId][index].timestamp);
          }
          if (stream.bytesSent) {
            stream.bytesRate =
              (stream.bytesSent - state[payload.userId][index].bytesSent) /
              (stream.timestamp - state[payload.userId][index].timestamp);
          }
          if (stream.score) {
            stream.score = state[payload.userId][index].score;
          }
        }
      });
      return { ...state, [payload.userId]: payload.info };
    }
    if (type === "local") {
      payload.info.forEach((stream, index) => {
        if (state[payload.userId] && state[payload.userId][index]) {
          if (stream.bytesReceived) {
            stream.bytesRate =
              (stream.bytesReceived -
                state[payload.userId][index].bytesReceived) /
              (stream.timestamp - state[payload.userId][index].timestamp);
          }
          if (stream.bytesSent) {
            stream.bytesRate =
              (stream.bytesSent - state[payload.userId][index].bytesSent) /
              (stream.timestamp - state[payload.userId][index].timestamp);
          }
        }
      });
      return { ...state, [payload.userId]: payload.info };
    }
  }, {});

  // const onMessage = (msg) => {
  //   msgList.push(msg);
  //   setMsgList(msgList);
  // };

  useEffect(() => {
    // store.on("message", onMessage);
    (async () => {
      const appid = window.localStorage.getItem("appid");
      const domain = window.localStorage.getItem("domain");
      const company = window.localStorage.getItem("company");
      const name = window.localStorage.getItem("name") as string;
      const { data } = await getContactList({ companyIndex: company });
      // const loginInfo = await getDeviceLoginInfo();
      window.localStorage.setItem("userId", name);
      console.log(
        "contact======",
        data,
        config[env[window.location.hostname] || "local"].domain,
        config.rokidId
      );
      await rtc.init(
        domain || config[env[window.location.hostname] || "local"].domain,
        appid || config.rokidId,
        name,
        new Date().getTime().toString(),
        "",
        true
      );
      setContactList(data);
      handleConnect();
    })();
  }, [auth]);

  const getSubscribeType = (audio, video): string => {
    if (audio && !video) return "audio";
    if (video && !audio) return "video";
    if (!video && !audio) return "none";
    if (video && audio) return "both";
    return "both";
  };

  useEffect(() => {
    (async () => {
      const userId = window.localStorage.getItem("userId") as string;
      for (const user of userList) {
        const media_device = JSON.parse(user.mediaDeviceInfo);
        const { audio, video, screenShare } = media_device;
        if (userId !== user.userId) {
          await rtc.subscribe([
            {
              userId: user.userId,
              stream: "low",
              subscribeType: "both",
            },
          ]);
          if (timeClock[user.userId]) clearInterval(timeClock[user.userId]);
          timeClock[user.userId] = setInterval(async () => {
            const info = await rtc.getStreamInfo(user.userId);
            dispatch({
              type: "refresh",
              payload: { userId: user.userId, info },
            });
          }, 3000);
        }
      }
    })();
  }, [userList]);

  /**
   * 建立连接
   * 打通websocket
   */
  const handleConnect = async () => {
    try {
      const token = window.localStorage.getItem("token") as string;
      const name = window.localStorage.getItem("name") as string;
      const userId = window.localStorage.getItem("userId") as string;
      setName(userId);
      rtc.onReceiveMessage = async (channelId, messageId, messageData) => {
        const {
          operateType,
          activeOperateUser,
          passiveOperateUserList,
          password,
          maxResolution,
        } = messageData;

        setChannel(channelId);

        let userList;
        switch (operateType) {
          case "CREATE":

          case "REJOIN": // 重新加入会议
          case "JOIN":
            // 加入会议
            if (activeOperateUser !== userId) {
              message.info(`有新成员加入`);
              userList = await rtc.getUserList(channelId);
              setUserList(userList);
            } else {
              // await rtc.subscribe([activeOperateUser]);
            }
            break;
          case "LEAVE":
            userList = await rtc.getUserList(channelId);
            clearInterval(timeClock[activeOperateUser]);
            delete timeClock[activeOperateUser];
            setUserList(userList);
            break;
          case "INVITE":
            // 加入会议
            if (activeOperateUser !== userId) {
              if (passiveOperateUserList.indexOf(userId) > -1) {
                confirm({
                  title: "收到会议邀请，是否加入？",
                  async onOk() {
                    // 加入会议
                    await rtc.join(
                      channelId,
                      localPlay,
                      pwd,
                      constraints,
                      audioFlag,
                      videoFlag,
                      bitRate,
                      minDelay,
                      maxDelay
                    );
                  },
                  async onCancel() {
                    // 拒接会议
                    await rtc.refuseInvite(channelId);
                  },
                });
              } else {
                message.info(`新成员被邀请加入`);
              }
            }
            break;
          case "CALL_CANCEL": // 主动取消
            break;
          case "KICK":
            userList = await rtc.getUserList(channelId);
            passiveOperateUserList.forEach((user) => {
              if (user === userId) {
                // rtc.dispose();
              }
              clearInterval(timeClock[user]);
              delete timeClock[user];
            });
            // const list = Array.from(userList, (val: any) => val.userId )
            // await rtc.subscribe(Array.from(userList, (val: any) => val.userId));
            setUserList(userList);
            break;
          case "END":
            if (activeOperateUser !== userId) {
              rtc.close();
            }
        }
      };
      rtc.mountEvent("EXRTA_PARAMS", (message) => {
        console.log("msg", message);
      });
      rtc.mountEvent("SOCKET", (msg) => {
        console.log("SOCKET=========", msg);
        const { messageData } = msg;
        if (messageData.code === 10014) {
          // window.location.reload();
        }
        if (messageData.code === 20001) {
          // 重新登录
          handleExit();
        }
      });
      rtc.mountEvent("FORWARD", (msg) => {
        const { messageData } = msg;
        console.log(
          "msg-forward==============",
          msg,
          JSON.parse(messageData),
          JSON.parse(JSON.parse(messageData).forwardMessage)
        );
      });
      rtc.mountEvent("MEDIA_DEVICE", async ({ messageData }) => {
        const { mediaDeviceInfo, userId } = messageData;
        const JSON_media = JSON.parse(mediaDeviceInfo);
        console.log("media-device-list===========", userList);
        const list = userList.map((item) => {
          if (messageData.userId === item.userId) {
            item.mediaDeviceInfo = mediaDeviceInfo;
          }
          return item;
        });
        // setUserList(list);
      });
      rtc.mountEvent("RECORDING_SWITCH", (msg) => {
        const { messageData, messageId, timestamp, channelId } = msg;
        const data = JSON.parse(messageData);
        setRecording(data.recordingSwitch);
      });
      rtc.mountEvent("RECORDING_STATE", (msg) => {
        const { messageData, messageId, timestamp, channelId } = msg;
        const data = JSON.parse(messageData);
        console.log("recording-state-data", data);
      });
      rtc.mountEvent("VIDEO_CHANGE", async ({ deviceList }) => {
        setDeviceList(deviceList);
        setDeviceType("video");
        setShowDevice(true);
        // const video = deviceList.length > 0;
        // await rtc.switchVideoConstraints(video, true);
        // setVideoFlag(video);
      });
      rtc.mountEvent("AUDIO_CHANGE", async ({ deviceList }) => {
        setDeviceList(deviceList);
        setDeviceType("audio");
        setShowDevice(true);
        // const audio = deviceList.length > 0;
        // await rtc.switchVideoConstraints(audio, true);
        // setVideoFlag(audio);
      });
      rtc.connect(userId, "", "local", "");
      const { data } = await rtc.getChannelList();
      console.log("data=======", data);
      if (data && data.length > 0) await rtc.leave(data[0].channelId);
      message.success("连接成功!");
    } catch (e) {
      message.error(e as string);
    }
  };

  /**
   * 创建频道
   */
  const handleCreate = async () => {
    try {
      const channelId = await rtc.create(modUserList, constraints, pwd);
      setChannel(channelId);
      message.success("创建成功!");
    } catch (e) {
      message.error(e as string);
    }
  };

  /**
   * 加入频道
   */
  const handleJoin = async () => {
    try {
      await rtc.join(
        channelId,
        localPlay,
        pwd,
        constraints,
        audioFlag,
        videoFlag,
        bitRate,
        minDelay,
        maxDelay
      );
    } catch (err) {
      message.error(err as string);
    }
  };

  const handleInvite = async () => {
    try {
      await rtc.invite(modUserList);
      message.success("邀请成功");
    } catch (err) {
      message.error(err as string);
    }
  };

  const handleKick = async () => {
    try {
      await rtc.kick(modUserList);
      message.success("踢出成功");
    } catch (err) {
      message.error(err as string);
    }
  };

  const changeKickUser = (values) => {
    setModUserList(values);
  };

  /**
   * 查询频道内的成员
   */
  const handleGetUserList = async () => {
    try {
      const userList = await rtc.getUserList(channelId);
      console.log("users=======", userList);
      setUserList(userList);
      message.success("查询成功");
    } catch (err) {
      message.error(err as string);
    }
  };

  const changeContact = (value) => {
    console.log("select-value", value);
    setModUserList(value);
  };

  const handleClose = async () => {
    try {
      await rtc.close();
      clearInterval(timeClock[name]);
      delete timeClock[name];
      // window.location.reload();
      message.success("关闭成功");
    } catch (err) {
      message.error(err as string);
    }
  };

  const handleLeave = async () => {
    try {
      await rtc.leave();
      // rtc.dispose();
      clearInterval(timeClock[name]);
      delete timeClock[name];
      message.success("离开成功");
    } catch (err) {
      message.error(err as string);
    }
  };

  const handleExit = () => {
    window.localStorage.clear();
    // rtc.dispose();
    window.location.reload();
    changeAuth(false);
  };

  const changeChannel = (e) => {
    setChannel(e.target.value);
  };

  const changeDevice = (value) => {
    console.log("value======", value);
    setDeviceId(value);
  };

  const switchMedia = async () => {
    if (deviceType === "audio") {
      await rtc.switchAudioConstraints(true, true, deviceId);
    } else if (deviceType === "video") {
      await rtc.switchVideoConstraints(true, true, deviceId);
    }
    setShowDevice(false);
  };

  const changeName = (e) => {
    setName(e.target.value);
  };

  const changeSubscribe = async (e, user) => {
    try {
      if (e.target.checked) {
        const media_device = JSON.parse(user.mediaDeviceInfo);
        const { audio, video, screenShare } = media_device;
        // 勾选订阅
        await rtc.subscribe([
          {
            userId: user.userId,
            stream: "high",
            subscribeType: "both",
          },
        ]);
        message.success("订阅成功");
        timeClock[user.userId] = setInterval(async () => {
          const info = await rtc.getStreamInfo(user.userId);
          dispatch({ type: "refresh", payload: { userId: user.userId, info } });
        }, 3000);
      } else {
        clearInterval(timeClock[user.userId]);
        delete timeClock[user.userId];
        await rtc.cancelSubscribe([user.userId]);
        message.success("取消订阅成功");
      }
    } catch (err) {
      message.error(err as string);
    }
  };

  const changePwd = (e) => {
    setPwd(e.target.value);
  };

  const changeVideo = async (value) => {
    try {
      setConstraints(value);
      await rtc.selectVideoConstraints(value);
      message.success("提交视频流参数成功");
    } catch (err) {
      message.error(err as string);
    }
  };

  const switchAudio = async (value) => {
    try {
      await rtc.switchAudioConstraints(value);
      // setMediaFlag({ type: "", payload: { audio: value } });
      setAudioFlag(value);
      message.success("切换音频成功");
    } catch (err) {
      message.error(err as string);
    }
  };

  const switchVideo = async (value) => {
    try {
      await rtc.switchVideoConstraints(value);
      // setMediaFlag({ type: "", payload: { video: value } });
      setVideoFlag(value);
      message.success("切换视频成功");
    } catch (err) {
      message.error(err as string);
    }
  };

  const switchRemoteAudio = async (value) => {
    try {
      rtc.switchRemoteAudio(value);
      setRemoteAudio(value);
      message.success("一键开关音频成功");
    } catch (e) {
      message.error(e as string);
    }
  };

  const switchScreenShare = async (value) => {
    try {
      const re = await rtc.startCapture(value, constraints, audioFlag);
      console.log("share-screen", re);
      setShare(!!re);
    } catch (e) {
      message.error(e as string);
    }
  };

  const switchStreamInfo = (value: boolean) => {
    const userId = window.localStorage.getItem("userId") as string;
    if (timeClock[userId]) clearInterval(timeClock[userId]);
    if (value) {
      timeClock[userId] = setInterval(async () => {
        const info = await rtc.getStreamInfo(userId);
        console.log("local-info---------", info);
        dispatch({ type: "local", payload: { userId, info } });
      }, 3000);
    }
  };

  const switchRecording = async (value) => {
    try {
      if (value) {
        await rtc.startRecording(value);
      } else {
        confirm({
          title: "是否保存视频？",
          async onOk() {
            await rtc.stopRecording(true);
          },
          async onCancel() {
            await rtc.stopRecording(false);
          },
        });
      }
      setRecording(value);
    } catch (e) {
      message.error(e as string);
    }
  };

  const switchMediaType = async (value, userId) => {
    try {
      await rtc.switchStreamType(
        userId,
        value,
        remoteStream[userId] ? "high" : "low"
      );
    } catch (e) {
      message.error(e as string);
    }
  };

  const options = [
    {
      label: "360P",
      value: "360P",
    },
    {
      label: "480P",
      value: "480P",
    },
    {
      label: "720P",
      value: "720P",
    },
    {
      label: "1080P",
      value: "1080P",
    },
  ];

  const mediaTypeOptions = [
    {
      value: "both",
      label: "全部",
    },
    {
      value: "audio",
      label: "音频",
    },
    {
      value: "video",
      label: "视频",
    },
    {
      value: "none",
      label: "禁止",
    },
  ];

  const onChangeFile = (e) => {
    rtc.setLocalVideoFile(e.target.files[0], "local");
    setLocalPlay(true);
  };

  const switchStream = async (userId, flag) => {
    await rtc.switchRemoteStream(userId, flag ? "high" : "low");
    remoteStream[userId] = flag;
    setRemoteStream(remoteStream);
  };

  return (
    <Layout>
      <Layout>
        <Layout.Sider theme="light" width={200}>
          <PageHeader title="成员列表" />
          {userList.map(({ mediaDeviceInfo, userId }, index) => {
            const media_device = JSON.parse(mediaDeviceInfo);
            const { audio, video, screenShare } = media_device;
            // return userId !== name ? (
            //   video || screenShare ? (
            //     <video
            //       key={userId}
            //       autoPlay
            //       id={"remote_" + userId}
            //       className="remote-video"
            //       style={{
            //         transform: `rotateX(${degree})`,
            //       }}
            //     />
            //   ) : (
            //     <audio key={userId} autoPlay id={"remote_" + userId} />
            //   )
            // ) : null;
            return userId !== name ? (
              <div key={userId} id={"remote_" + userId} />
            ) : null;
          })}
        </Layout.Sider>
        <Layout.Content>
          <div>
            <PageHeader title="主视频" />
            <video
              id="local"
              className="local-video"
              style={
                share
                  ? {}
                  : {
                      transform: "rotateY(180deg)",
                    }
              }
              autoPlay
              muted
              loop
              preload="metadata"
            />
            {streamInfo[name]
              ? streamInfo[name].map((info) => (
                  <>
                    <Row>
                      <Col>id: {info.id}</Col>
                    </Row>
                    <Row gutter={20}>
                      <Col>宽度: {info.width}</Col>
                      <Col>高度: {info.height}</Col>
                      <Col>传输字节: {info.bytesSent}</Col>
                      <Col>时间戳: {info.timestamp}</Col>
                    </Row>
                    <Row gutter={20}>
                      <Col>
                        传输码率:
                        {info.bytesRate}
                      </Col>
                      <Col>limit: {info.limit}</Col>
                      <Col>评分：{parseFloat(info.score).toFixed(2)}</Col>
                    </Row>
                  </>
                ))
              : null}
          </div>
        </Layout.Content>
        <Layout.Sider theme="light" width={400}>
          <PageHeader title="信息" />
          <Collapse>
            {userList.map((user) =>
              user.userId !== name ? (
                <Panel
                  key={user.userId}
                  header={user.userId}
                  extra={
                    <Checkbox
                      defaultChecked={true}
                      onChange={async (e) => {
                        await changeSubscribe(e, user);
                      }}
                    />
                  }
                >
                  <Row gutter={20}>
                    <Col>
                      切换大小流：
                      <Switch
                        defaultChecked={false}
                        onChange={(value) => {
                          switchStream(user.userId, value);
                        }}
                      />
                    </Col>
                    <Space size={20}>
                      <div>
                        音频开关:
                        <Switch
                          defaultChecked={true}
                          onChange={(values) => {
                            const video = document.getElementById(
                              `remote_${user.userId}`
                            ) as HTMLVideoElement;
                            video.muted = !values;
                          }}
                        />
                      </div>
                      <div>
                        媒体类型：
                        <Select
                          defaultValue="both"
                          options={mediaTypeOptions}
                          onChange={(value) => {
                            switchMediaType(value, user.userId);
                          }}
                        />
                      </div>
                    </Space>
                  </Row>
                  {streamInfo[user.userId]
                    ? streamInfo[user.userId].map((info) => (
                        <>
                          <Row>
                            <Col>id: {info.id}</Col>
                          </Row>
                          <Row gutter={20}>
                            <Col>宽度: {info.width}</Col>
                            <Col>高度: {info.height}</Col>
                            <Col>
                              接收字节:{" "}
                              {parseFloat(info.bytesReceived).toFixed(2)}
                            </Col>
                            <Col>
                              时间戳: {parseFloat(info.timestamp).toFixed(2)}
                            </Col>
                            <Col>
                              接收码率: {parseFloat(info.bytesRate).toFixed(2)}
                            </Col>
                          </Row>
                          <Row gutter={20}>
                            <Col>
                              received:{" "}
                              {parseFloat(info.packetsReceived).toFixed(2)}
                            </Col>
                            <Col>
                              lost: {parseFloat(info.packetsLost).toFixed(2)}
                            </Col>
                            <Col>
                              latency: {parseFloat(info.latency).toFixed(2)}
                            </Col>
                          </Row>
                        </>
                      ))
                    : null}
                </Panel>
              ) : null
            )}
          </Collapse>
        </Layout.Sider>
      </Layout>
      <Layout.Footer className="theme">
        <Row gutter={20}>
          <Col>
            <Input
              placeholder="频道"
              value={channelId}
              onChange={changeChannel}
            />
          </Col>
          {/*<Col>*/}
          {/*  <Input placeholder="用户名" value={name} onChange={changeName} />*/}
          {/*</Col>*/}
          <Col>
            <Input placeholder="频道密码" value={pwd} onChange={changePwd} />
          </Col>
        </Row>
        <Row gutter={20} style={{ marginTop: 20 }}>
          <Col>
            <Select
              mode="multiple"
              placeholder="邀请 可多选"
              onChange={changeContact}
              style={{ width: 400 }}
            >
              {contactList.map((val) => (
                <Select.Option key={val}>{val}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col>
            <Select
              mode="multiple"
              placeholder="踢出成员 可多选"
              onChange={changeKickUser}
              style={{ width: 300 }}
            >
              {userList.map((val) => {
                const user = contactList.indexOf(val.userId);
                return user ? (
                  <Select.Option key={user}>{user}</Select.Option>
                ) : null;
              })}
            </Select>
          </Col>
        </Row>
        <Row gutter={20} style={{ marginTop: 20 }}>
          <Col>
            本地视频分辨率：
            <Select
              style={{ width: 120 }}
              options={options}
              defaultValue="360P"
              onChange={changeVideo}
            />
          </Col>
          <Col>
            本地音频开关：
            <Switch onChange={switchAudio} defaultChecked={audioFlag} />
          </Col>
          <Col>
            本地视频开关：
            <Switch onChange={switchVideo} defaultChecked={videoFlag} />
          </Col>
          <Col>
            本地屏幕共享：
            <Switch checked={share} onChange={switchScreenShare} />
          </Col>
          <Col>
            开启本地调试信息
            <Switch defaultChecked={false} onChange={switchStreamInfo} />
          </Col>
          <Col>
            远端音频开关
            <Switch defaultChecked={remoteAudio} onChange={switchRemoteAudio} />
          </Col>
        </Row>
        <Row gutter={20} style={{ marginTop: 20 }}>
          <Col>
            最大码率：
            <InputNumber
              value={bitRate}
              onChange={(value) => {
                setBitRate(value);
              }}
              addonAfter="bit"
            />
          </Col>
          <Col>
            最大延迟：
            <InputNumber
              value={maxDelay}
              onChange={(value) => {
                setMaxDelay(value);
              }}
              addonAfter="*10 ms"
            />
          </Col>
          <Col>
            最小延迟：
            <InputNumber
              value={minDelay}
              onChange={(value) => {
                setMinDelay(value);
              }}
              addonAfter="*10 ms"
            />
          </Col>
          <Col>
            <Button
              type="primary"
              onClick={() => {
                rtc.changeStreamConfigure(bitRate, minDelay, maxDelay);
              }}
            >
              设置
            </Button>
          </Col>
          <Col>
            开启屏幕录制
            <Switch defaultChecked={recording} onChange={switchRecording} />
          </Col>
        </Row>
        <Row style={{ marginTop: 20, cursor: "pointer" }}>
          <Col>
            <Input type="file" onChange={onChangeFile} accept="video/mp4" />
          </Col>
        </Row>
        <Space style={{ marginTop: 20 }}>
          {/*<Button type="primary" onClick={handleConnect}>*/}
          {/*  1. 建立连接*/}
          {/*</Button>*/}
          <Button type="primary" onClick={handleCreate}>
            2. 创建频道
          </Button>
          <Button type="primary" onClick={handleJoin}>
            3. 加入频道
          </Button>
          <Button type="primary" onClick={handleGetUserList}>
            4. 查询成员
          </Button>
          <Button
            onClick={async () => {
              await rtc.subscribe([
                {
                  userId: "chenbin2",
                  stream: "low",
                  subscribeType: "both",
                },
              ]);
            }}
          >
            subscribe
          </Button>
          <Button type="primary" onClick={handleKick}>
            踢出成员
          </Button>
          <Button type="primary" onClick={handleInvite}>
            邀请成员
          </Button>
          <Button danger type="primary" onClick={handleLeave}>
            退出频道
          </Button>
          <Button danger type="primary" onClick={handleClose}>
            关闭频道
          </Button>
          <Button danger type="primary" onClick={handleExit}>
            登出
          </Button>
        </Space>
      </Layout.Footer>
      <Modal
        visible={showDevice}
        onOk={switchMedia}
        onCancel={() => {
          setShowDevice(false);
        }}
      >
        选择接入设备
        <Select onChange={changeDevice} style={{ width: 200 }}>
          {deviceList.map((device) => {
            return (
              <Select.Option value={device.deviceId} key={device.deviceId}>
                {device.label}
              </Select.Option>
            );
          })}
        </Select>
      </Modal>
    </Layout>
  );
};

export default App;
