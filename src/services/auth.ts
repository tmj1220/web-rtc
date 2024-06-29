import Services from "./index";

/**
 * 用户鉴权
 */
export default class Auth {
  request: any;
  domain: string;

  constructor(request: Services, appId: string) {
    this.request = request.fetch;
    this.domain = request.domain;
    this.request.setConfig({
      appId,
    });
  }

  /**
   * 获取token
   * @param params
   */
  async getToken(params: {
    userId: string;
    sdkId: string;
    deviceType: string;
    deviceId: string;
  }) {
    return await this.request.post(
      `${this.domain}/auth/generatorToken`,
      params
    );
  }

  /**
   * 刷新token
   * @param token
   */
  async refreshToken(token: string) {
    return await this.request.post(`${this.domain}/auth/refreshToken`, {
      refreshToken: token,
    });
  }

  /**
   * 销毁token, 该接口已废弃
   * @param token
   */
  async destroyToken(token: string) {
    return await this.request.post(`${this.domain}/auth/destroyToken`, {
      refreshToken: token,
    });
  }
}
