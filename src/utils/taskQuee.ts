export type TaskFun = () => Promise<any>;

export interface TaskContent {
  taskId: string;
  fun: TaskFun;
}

export interface ResultContent {
  taskId: string;
  result?: any;
  error?: Error;
}

export default class Task {
  private getUuiD() {
    return Math.random().toString(16).slice(2) + `${new Date().getTime()}`;
  }

  private taskList: TaskContent[] = [];

  private resultList: ResultContent[] = [];

  // private taskLoop = () => {
  //   requestAnimationFrame(async () => {
  //     if (this.taskList.length) {
  //       const task = this.taskList.shift();
  //       const { taskId, fun } = task!;
  //       try {
  //         const result = await fun();
  //         this.resultList.push({
  //           taskId,
  //           result,
  //         });
  //       } catch (e) {
  //         this.resultList.push({
  //           taskId,
  //           error: e as Error,
  //         });
  //       }

  //       // if (this.taskList.length) {
  //       //   this.taskLoop();
  //       // }
  //     }
  //   });
  // };

  private doTask = async () => {
    if (this.taskList.length) {
      const task = this.taskList[0];
      const { taskId, fun } = task!;
      try {
        const result = await fun();
        this.resultList.push({
          taskId,
          result,
        });
      } catch (e) {
        this.resultList.push({
          taskId,
          error: e as Error,
        });
      }
    }
  };
  do = <T>(fun: TaskFun): Promise<T> => {
    const taskId = this.getUuiD();
    this.taskList.push({
      taskId,
      fun,
    });
    if (this.taskList.length === 1) {
      this.doTask();
    }
    return new Promise((resolve, reject) => {
      const done = () =>
        requestAnimationFrame(() => {
          const resultItem = this.resultList.find(
            (item) => item.taskId === taskId
          );
          if (resultItem) {
            this.resultList = this.resultList.filter(
              (item) => item.taskId !== resultItem.taskId
            );
            if (resultItem.error) {
              reject(resultItem.error);
            } else {
              resolve(resultItem.result);
            }
            this.taskList.shift();
            if (this.taskList.length) {
              this.doTask();
            }
          } else {
            done();
          }
        });

      done();
    });
  };
}
