import { z } from "zod";

/**
 * src/lib/validations/prep-task.ts
 *
 * Schemas for the kitchen Prep List's hand-added tasks (the "Add Task"
 * modal and the done toggle).
 */

const unitSchema = z.enum(["GRAM", "KILOGRAM", "MILLILITER", "LITER", "PIECE"]);

export const createPrepTaskSchema = z.object({
  name: z.string().trim().min(1, "Task name is required").max(120, "Task name is too long"),
  quantity: z
    .number()
    .finite()
    .positive("Quantity must be greater than 0")
    .max(100_000, "Quantity is too large")
    // float noise only (0.1 + 0.2) — the UI never needs more than 2 decimals
    .transform((n) => Math.round(n * 100) / 100),
  unit: unitSchema.default("KILOGRAM"),
});

export const updatePrepTaskSchema = z.object({
  done: z.boolean(),
});
