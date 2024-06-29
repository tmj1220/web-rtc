import store from "../event/store";

interface FetchConfig {
  baseURL: string;
  headers: any;
  method: string;
}

interface InterceptorsHandlers<T, K> {
  fullfield: () => Promise<T>;
  reject: () => Promise<K>;
}

class Interceptors<T = any, K = any> {
  handlers: InterceptorsHandlers<T, K>[] = [];
  constructor() {}
  use(fullfield, reject) {
    this.handlers.push({
      fullfield,
      reject,
    });
  }
}

interface FetchResponse {}

export default class Fetch {
  xhr: XMLHttpRequest;
  defaultConfig: any;
  interceptors: {
    request: Interceptors;
    response: Interceptors;
  };
  constructor() {
    this.xhr = new XMLHttpRequest();
    this.defaultConfig = {};
    this.interceptors = {
      request: new Interceptors(),
      response: new Interceptors(),
    };
  }

  setConfig(config) {
    // 合并配置项
    this.defaultConfig = Object.assign(this.defaultConfig, config);
  }

  resetConfig() {
    this.defaultConfig = {}
  }

  /**
   * 基础请求
   * @param method
   * @param url
   * @param data
   * @param headers
   * @param func
   */
  async request(method, url, data?, headers?, func?): Promise<any> {
    const ua = navigator.userAgent;
    const async = ua.indexOf("Firefox") !== -1;
    return new Promise((resolve, reject) => {
      this.xhr.onreadystatechange = () => {
        if (this.xhr.readyState === 4) {
          // 响应状态成功
          // return this.xhr;
          if (typeof this.xhr.response === "string") {
            const res = JSON.parse(this.xhr.response);
            const { code, message } = res;
            if (code !== 1) {
              reject({ code, message });
            } else if (code === 20003) {
              // rk 过期
              store.emit("REFRESH", { func, params: data });
              resolve(res);
            } else if (code === 20005) {
              // ak 过期
              store.emit("ACCESS", { func, params: data });
              // 再调用一次刷新token接口，获取新的token
              resolve(res);
            } else {
              resolve(res);
            }
            // resolve(JSON.parse(this.xhr.response));
          } else {
            resolve(this.xhr.response);
          }
        }
      };
      // 开启请求
      this.xhr.open(method, url, async);
      for (const key in this.defaultConfig) {
        this.xhr.setRequestHeader(key, this.defaultConfig[key]);
      }
      this.xhr.send(JSON.stringify(data));

      this.xhr.onload = () => {};
      this.xhr.onprogress = () => {};
      this.xhr.onerror = (err) => {
        console.log("err========", err);
        reject(err);
      };
    });
  }

  /**
   * GET 请求
   * @param url
   * @param func
   */
  get(url: string, func?) {
    return this.request("GET", url, null, func);
  }

  /**
   * POST 请求
   * @param url
   * @param params
   * @param func
   */
  post<T = any>(url: string, params?: T, func?) {
    return this.request("POST", url, params, func);
  }
}
