/**
 * 事件订阅-发布装置
 * 用于构建一个全局的事件订阅-发布事件
 */
export default class EventEmitter {
  // 事件队列
  eventList: any[];

  constructor() {
    this.eventList = [];
  }

  /**
   * 订阅事件
   * @param event
   * @param fn
   */
  on(event: string, fn: Function) {
    // 如果队列中没有该事件，就给该event创建一个队列
    // 如果队列中有该event，则把对应的fn添加到队列中
    (this.eventList[event] || (this.eventList[event] = [])).push(fn);
  }

  /**
   * 只监听一次事件
   * @param event
   * @param fn
   */
  once(event: string, fn: Function) {
    const _this = this;
    // 先绑定，后删除
    function on() {
      _this.off(event, on);
      fn.apply(_this, arguments);
    }
    on.fn = fn;
    _this.on(event, on);
  }

  /**
   * 取消订阅事件
   * @param event
   * @param fn
   */
  off(event: string, fn: Function) {
    const _this = this;
    const fns = _this.eventList[event];
    // 如果事件队列中不存在对应的fns，则返回false
    if (!fns) return false;
    if (!fn) {
      // 如果没有传 fn 的话，就会将 event 值对应缓存列表中的 fn 都清空
      fns && (fns.length = 0);
    } else {
      // 若有 fn，遍历缓存列表，看看传入的 fn 与哪个函数相同，如果相同就直接从缓存列表中删掉即可
      let cb;
      for (let i = 0, cbLen = fns.length; i < cbLen; i++) {
        cb = fns[i];
        if (cb === fn || cb.fn === fn) {
          fns.splice(i, 1);
          break;
        }
      }
    }
  }

  clear() {
    this.eventList = [];
  }

  /**
   * 发布事件
   * @param event
   * @param params
   */
  emit(event: string, params: any) {
    const _this = this;
    if (!_this.eventList[event]) return;
    // 第一个参数为事件
    let fns = [..._this.eventList[event]];
    // 遍历所有事件，通知所有挂载点
    fns.forEach((fn) => {
      fn(params);
    });
  }
}
