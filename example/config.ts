/*
 * @Author: liming.lu liming.lu@rokid.com
 * @Date: 2022-10-05 15:31:58
 * @LastEditors: liming.lu
 * @LastEditTime: 2023-01-16 14:27:50
 * @FilePath: /rokid-web-rtc/example/config.ts
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
export default {
  local: {
    // domain: "https://rtc-test.rokid.com",
    // ws: "wss://rtc-wss-test.rokid.com/socket/",
    // saas: "https://saas-ar-test.rokid.com/api/",
    // domain: "https://rtc.rokid.com",
    // ws: "wss://wss-rtc.rokid.com/socket/",
    // saas: "https://saas-ar.rokid.com/api/",
    domain: "https://api-test.rokid.com/rtc",
    ws: "wss://rtc-wss-test.rokid.com/socket/",
    // saas: "https://saas-ar-dev.rokid-inc.com/api/",
    // domain: "https://rtc-hyh.rokid-inc.com",
    // ws: "wss://rtc-wss-dev.rokid.com/socket/",
    // saas: "https://saas-ar-dev.rokid-inc.com/api/",
  },
  dev: {
    domain: "https://api-dev.rokid.com",
    ws: "wss://rtc-wss-dev.rokid.com/socket/",
    saas: "https://saas-ar-dev.rokid-inc.com/api/",
  },
  test: {
    domain: "https://api-test.rokid.com",
    ws: "wss://rtc-wss-test.rokid.com/socket/",
    saas: "https://saas-ar-test.rokid.com/api/",
  },
  prod: {
    domain: "https://api.rokid.com",
    ws: "wss://wss-rtc.rokid.com/socket/",
    saas: "https://saas-ar.rokid.com/api/",
  },
  sdkId: "b93f1827e0d144dbbf4f5cf9c7b1ef80",
  rokidId: "135D8B743401461C95905C3B2822B81C",
};
