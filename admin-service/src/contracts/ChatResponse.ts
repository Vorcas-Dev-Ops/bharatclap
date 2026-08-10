export interface ChatResponseContract {
  activeThreadsCount: number;
  slaStatus: string;
  avgFirstResponseSec: number;
  avgResponseMin: string;
  resolutionMin: string;
  escalationsCount: number;
  flaggedCount: number;
}
