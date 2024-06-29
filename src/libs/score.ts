const RTT_WEIGHT = 0.2;
const LOSS_WEIGHT = 0.6;
const JITTER_WEIGHT = 0.2;

const FIRST_LEVEL = 1.0;
const SECOND_LEVEL = 2.0;
const THIRD_LEVEL = 3.0;
const FOURTH_LEVEL = 4.0;
const FIFTH_LEVEL = 5.0;

const BAD_LOSS_RATE = 0.055;

export enum ScoreState {
  UNKNOWN = "UNKNOWN",
  EXCELLENT = "EXCELLENT",
  GOOD = "GOOD",
  BAD = "BAD",
}
export enum ScoreStateInt {
  UNKNOWN,
  EXCELLENT,
  GOOD,
  BAD,
}

export default class Score {
  rttScoreList: number[] = [];
  lossScoreList: number[] = [];
  jitterScoreList: number[] = [];
  lossList: number[] = [];
  rttList: number[] = [];
  jitterList: number[] = [];

  totalScoreList: number[] = [];

  total: number = 0;

  badLossCount: number = 0;

  constructor(total: number) {
    this.total = total;
  }

  addRtt(rtt: number) {
    if (this.rttList.length === this.total) this.rttList.shift();
    this.rttList.push(rtt * 1000);
  }

  addLoss(loss: number) {
    if (this.lossList.length === this.total) this.lossList.shift();
    this.lossList.push(loss);
  }

  addJitter(jitter: number) {
    if (this.jitterList.length === this.total) this.jitterList.shift();
    this.jitterList.push(jitter * 1000);
  }

  calculateTotalScore(): number {
    // console.log(
    //   "remote=========",
    //   this.calculateRttScore(),
    //   this.calculateLossScore(),
    //   this.calculateJitterScore()
    // );
    let score =
      this.calculateRttScore() * RTT_WEIGHT +
      this.calculateLossScore() * LOSS_WEIGHT +
      this.calculateJitterScore() * JITTER_WEIGHT;

    if (this.totalScoreList.length === this.total) this.totalScoreList.shift();

    if (this.totalScoreList.length > 0) {
      const avg_4 = this.calculateAvg(this.totalScoreList);
      score = avg_4 * 0.4 + score * 0.6;
    }

    this.totalScoreList.push(score);
    return score;
  }

  calculateScoreEnum(score: number) {
    if (score >= FOURTH_LEVEL) {
      return ScoreState.EXCELLENT;
    }

    if (score >= THIRD_LEVEL) {
      return ScoreState.GOOD;
    }

    return ScoreState.BAD;
  }
calculateScoreEnumInt(score: number) {
    if (score >= FOURTH_LEVEL) {
      return ScoreStateInt.EXCELLENT;
    }

    if (score >= THIRD_LEVEL) {
      return ScoreStateInt.GOOD;
    }

    return ScoreStateInt.BAD;
}
  

  calculateLossAvg() {
    const lossRateScore = this.calculateAvg(this.lossScoreList);
    const badLossList = this.lossList.filter((loss) => {
      return loss < BAD_LOSS_RATE;
    });
    const badLossScore = this.totalScore(6, 4, 2, 1, badLossList.length);
    return badLossScore > 0
      ? Math.min(lossRateScore, badLossScore)
      : lossRateScore;
  }

  /**
   * 计算平均值
   * @param score
   */
  calculateAvg(score: number[]) {
    return (
      score.reduce((acc, val) => {
        return acc + val;
      }, 0) / score.length
    );
  }

  totalScore(
    low: number,
    middle: number,
    good: number,
    perfect: number,
    score: number
  ) {
    if (score >= perfect && score < good) {
      return FOURTH_LEVEL;
    }

    if (score >= good && score < middle) {
      return THIRD_LEVEL;
    }

    if (score >= middle && score < low) {
      return SECOND_LEVEL;
    }

    if (score >= low) {
      return FIRST_LEVEL;
    }

    return FIFTH_LEVEL;
  }

  private calculateRttScore() {
    const rttAvg = this.calculateAvg(this.rttList);
    return this.totalScore(1000.0, 500.0, 200.0, 100.0, rttAvg);
  }

  private calculateLossScore() {
    const lossAvg = this.calculateAvg(this.lossList);
    const badLossList = this.lossList.filter((loss) => {
      return loss >= BAD_LOSS_RATE;
    });
    const badLossScore = this.totalScore(6, 4, 2, 1, badLossList.length);
    return Math.min(
      this.totalScore(0.15, 0.1, 0.05, 0.02, lossAvg),
      badLossScore
    );
  }

  private calculateJitterScore() {
    const jitterAvg = this.calculateAvg(this.jitterList);
    return this.totalScore(1000.0, 500.0, 200.0, 100.0, jitterAvg);
  }
}
