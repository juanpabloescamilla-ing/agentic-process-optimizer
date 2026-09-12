import { z } from 'zod';
const amount = z.number().finite().nonnegative().nullable();
const fact = z.boolean().nullable();
export const processSchema = z.object({
  id: z.string().min(1), name: z.string().min(1), sector: z.string().optional(), description: z.string().optional(),
  evidence: z.array(z.object({ id: z.string(), source: z.string(), excerpt: z.string().min(1),
    kind: z.enum(['declared', 'observed', 'measured']) })),
  monthlyVolume: amount, minutesPerCase: amount, peoplePerCase: z.number().positive().nullable(), hourlyCost: amount,
  dataReady: fact, repeatable: fact, deterministicRules: fact, requiresHumanJudgment: fact,
  risk: z.enum(['low', 'medium', 'high']).nullable(),
});
export const assumptionsSchema = z.object({
  remainingHumanMinutesPerCase: amount, remainingPeoplePerCase: z.number().positive().nullable(),
  monthlyOperatingCost: amount, implementationCost: amount, monthlyAvoidedCashExpense: amount,
  periodMonths: z.number().positive().nullable(), basis: z.enum(['declared', 'estimated', 'measured']),
});
