import axios, { AxiosRequestConfig, AxiosPromise } from "axios";

// 响应拦截器
axios.interceptors.response.use(
  (res) => {
    console.log(
      "%c [RTC SDK] api response",
      "color:cornflowerblue;font-size:20px;",
      res
    );
    const { data } = res;
    if (data.code === 1) {
      return res;
    } else {
      throw data.message || data.msg;
    }
  },
  (error) => {
    return Promise.reject(error);
  }
);

export function GET({ url, params }: AxiosRequestConfig): AxiosPromise {
  return axios({
    method: "GET",
    url,
    params,
  });
}

export function POST({ url, params }: AxiosRequestConfig): AxiosPromise {
  return axios({
    method: "POST",
    url,
    data: params,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
