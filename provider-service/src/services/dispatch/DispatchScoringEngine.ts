export interface ScoreParameters {
  distanceMeters: number;
  overallRating: number;
  isPriorityPackage: boolean;
  jobsToday: number;
  lastJobAssignedAt?: Date;
  consecutiveJobsToday?: number;
  fraudPenaltyScore?: number;
  arrivalConfidenceScore?: number; // 0 to 100
}

export interface DispatchWeights {
  distanceWeight: number;
  ratingWeight: number;
  priorityPackageWeight: number;
  loadBalancingWeight: number;
  recencyWeight: number;
  arrivalConfidenceWeight?: number;
  cooldownConsecutiveLimit?: number;
  cooldownPenaltyFactor?: number;
}

export class DispatchScoringEngine {
  public calculateScore(params: ScoreParameters, weights: DispatchWeights): number {
    const distKm = Math.max(0, params.distanceMeters / 1000);
    const distanceScore = Math.max(0, 100 - distKm * 5);

    const rating = params.overallRating || 4.5;
    const ratingScore = (rating / 5) * 100;

    const priorityScore = params.isPriorityPackage ? 100 : 0;

    const workloadScore = Math.max(0, 100 - params.jobsToday * 10);

    let recencyScore = 100;
    if (params.lastJobAssignedAt) {
      const minsSince = Math.floor((Date.now() - new Date(params.lastJobAssignedAt).getTime()) / 60000);
      recencyScore = Math.min(100, minsSince * 2);
    }

    const confidenceScore = params.arrivalConfidenceScore ?? 85;

    const wDist = (weights.distanceWeight !== undefined ? weights.distanceWeight : 40) / 100;
    const wRate = (weights.ratingWeight !== undefined ? weights.ratingWeight : 20) / 100;
    const wPrio = (weights.priorityPackageWeight !== undefined ? weights.priorityPackageWeight : 15) / 100;
    const wLoad = (weights.loadBalancingWeight !== undefined ? weights.loadBalancingWeight : 15) / 100;
    const wRece = (weights.recencyWeight !== undefined ? weights.recencyWeight : 10) / 100;

    let totalScore =
      distanceScore * wDist +
      ratingScore * wRate +
      priorityScore * wPrio +
      workloadScore * wLoad +
      recencyScore * wRece;

    // Cooldown penalty
    const consecutiveJobs = params.consecutiveJobsToday || 0;
    const cooldownLimit = weights.cooldownConsecutiveLimit || 5;
    if (consecutiveJobs >= cooldownLimit) {
      totalScore -= weights.cooldownPenaltyFactor || 20;
    }

    // Fraud penalty
    if (params.fraudPenaltyScore) {
      totalScore -= params.fraudPenaltyScore;
    }

    return Math.max(0, totalScore);
  }
}

export const dispatchScoringEngine = new DispatchScoringEngine();
