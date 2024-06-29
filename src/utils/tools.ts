
 /**
* 轮询获取结果
*/
export function queryResult(callback:()=>boolean, timeout = 30000) {

 let timerId;
 return new Promise((resolve, reject) => {
   try {
    timerId = setInterval(() => {
      if (callback()) {
        clearInterval(timerId);
        resolve(true);
      }
    }, 1000); // 每秒查询一次
   } catch (error) {
    clearInterval(timerId);
    timerId=undefined;
    reject(error);
   }
   setTimeout(() => {
     clearInterval(timerId);
     timerId=undefined;
     reject(new Error("超时"));
   }, timeout);
 });
}