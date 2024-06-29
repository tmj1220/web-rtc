import axios from "axios";
const env = {
  "web-rtc-dev.rokid.com": "dev",
  "web-rtc-test.rokid.com": "test",
  "web-rtc.rokid.com": "prod",
};
import config from "./config";

const domain = config[env[window.location.hostname] || "local"].domain;

const token = window.localStorage.getItem("token") as string;

export async function login(params) {
  const { data } = await axios.get(
    `${domain}/cooperate/login?companyIndex=${params.companyIndex}&userName=${params.userName}`
  );
  return data;
}

export async function getContactList(params) {
  const { data } = await axios.get(
    `${domain}/cooperate/getUserList?companyIndex=${params.companyIndex}`
  );
  return data;
}

export async function getDeviceLoginInfo() {
  const { data } = await axios.get(
    `${domain}upms/v1/deviceUser/getDeviceUserLoginInfo`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return data;
}
