import React, { useEffect } from "react";
import { Form, Input, Button, Layout, message } from "antd";
import { login } from "./request";
import config from "./config";
const env = {
  "web-rtc-dev.rokid.com": "dev",
  "web-rtc-test.rokid.com": "test",
  "web-rtc.rokid.com": "prod",
};

export default function Login({ changeAuth }) {
  useEffect(() => {
    console.log("useEffect....");
  }, []);

  const handleLogin = async (values) => {
    try {
      console.log("values", values);
      const { data, code, msg }: any = await login(values);
      console.log("data-login", data);
      if (data) {
        window.localStorage.setItem("token", data.accessToken);
        window.localStorage.setItem("name", values.userName);
        window.localStorage.setItem("company", values.companyIndex);
        window.localStorage.setItem(
          "domain",
          values.domain ||
            config[env[window.location.hostname] || "local"].domain
        );
        window.localStorage.setItem("appid", values.appid || config.rokidId);
        window.location.reload();
        // changeAuth(true);
      } else {
        message.error("登录失败");
      }
    } catch (e) {
      console.log("e=====", e);
      message.error(e as string);
    }
  };

  return (
    <Layout className="login">
      <Layout.Content className="login-container">
        <h1>登录</h1>
        <Form onFinish={handleLogin}>
          <Form.Item label="appid" name="appid">
            <Input placeholder="输入AppId" />
          </Form.Item>
          <Form.Item label="域名环境地址" name="domain">
            <Input placeholder="输入域名环境地址" />
          </Form.Item>
          <Form.Item label="公司" required name="companyIndex">
            <Input placeholder="请输入公司名称" />
          </Form.Item>
          <Form.Item name="userName" label="用户名" required>
            <Input placeholder="请输入用户名" />
          </Form.Item>
          {/*<Form.Item label="密码" required name="password">*/}
          {/*  <Input placeholder="请输入密码" type="password" />*/}
          {/*</Form.Item>*/}
          <Button type="primary" htmlType="submit">
            登录
          </Button>
        </Form>
      </Layout.Content>
    </Layout>
  );
}
