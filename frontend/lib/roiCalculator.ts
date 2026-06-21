import { planCatalog } from "@/lib/plans";
import type { Plan } from "@/lib/types";

export type RoiInputs = {
  monthlyCalls: number;
  avgCallMinutes: number;
  humanHourlyRate: number;
  conversionRate: number;
  conversionUplift: number;
  avgDealValue: number;
  automationRate: number;
};

export const defaultRoiInputs: RoiInputs = {
  monthlyCalls: 150,
  avgCallMinutes: 3,
  humanHourlyRate: 350,
  conversionRate: 4,
  conversionUplift: 18,
  avgDealValue: 8000,
  automationRate: 85,
};

export function recommendPlan(monthlyCalls: number): Plan {
  if (monthlyCalls <= planCatalog.free.calls) return "free";
  if (monthlyCalls <= planCatalog.pro.calls) return "pro";
  return "enterprise";
}

export function getPlanMonthlyCost(plan: Plan): number {
  const price = planCatalog[plan].price;
  return price === "0" ? 0 : Number(price);
}

export type RoiResult = {
  recommendedPlan: Plan;
  planCost: number;
  humanCostPerCall: number;
  monthlyHumanCost: number;
  laborSavings: number;
  improvedConversionRate: number;
  additionalConversions: number;
  revenueUplift: number;
  totalBenefit: number;
  netMonthlyGain: number;
  roiPercent: number | null;
  paybackDays: number | null;
  isProfitable: boolean;
  breakevenCalls: number | null;
};

export function calculateRoi(inputs: RoiInputs): RoiResult {
  const {
    monthlyCalls,
    avgCallMinutes,
    humanHourlyRate,
    conversionRate,
    conversionUplift,
    avgDealValue,
    automationRate,
  } = inputs;

  const safeCalls = Math.max(0, monthlyCalls);
  const recommendedPlan = recommendPlan(safeCalls);
  const planCost = getPlanMonthlyCost(recommendedPlan);

  const humanCostPerCall = (avgCallMinutes / 60) * humanHourlyRate;
  const monthlyHumanCost = safeCalls * humanCostPerCall;
  const laborSavings = monthlyHumanCost * (automationRate / 100);

  const improvedConversionRate = conversionRate * (1 + conversionUplift / 100);
  const additionalConversions = safeCalls * ((improvedConversionRate - conversionRate) / 100);
  const revenueUplift = additionalConversions * avgDealValue;

  const totalBenefit = laborSavings + revenueUplift;
  const netMonthlyGain = totalBenefit - planCost;

  const roiPercent =
    planCost > 0 ? Math.round((netMonthlyGain / planCost) * 100) : null;

  const paybackDays =
    planCost > 0 && totalBenefit > 0
      ? Math.ceil((planCost / totalBenefit) * 30)
      : planCost === 0
        ? 0
        : null;

  const isProfitable = netMonthlyGain > 0;

  const benefitPerCall =
    safeCalls > 0
      ? totalBenefit / safeCalls
      : humanCostPerCall * (automationRate / 100) +
        (avgDealValue * improvedConversionRate) / 100;

  const breakevenCalls =
    planCost > 0 && benefitPerCall > 0 ? Math.ceil(planCost / benefitPerCall) : null;

  return {
    recommendedPlan,
    planCost,
    humanCostPerCall,
    monthlyHumanCost,
    laborSavings,
    improvedConversionRate,
    additionalConversions,
    revenueUplift,
    totalBenefit,
    netMonthlyGain,
    roiPercent,
    paybackDays,
    isProfitable,
    breakevenCalls,
  };
}

export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}
