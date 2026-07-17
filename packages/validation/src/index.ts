import { ZodError, z } from "zod";

export const nonEmptyStringSchema = z.string().trim().min(1);

export const uuidSchema = z.string().uuid();

export function parseOrThrow<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  // zod's generic `.parse()` return type resolves through a conditional type that
  // ESLint's type-aware analysis can't narrow past `any` here; the function signature
  // still enforces the correct `z.infer<TSchema>` type for every caller.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return schema.parse(input);
}

export { ZodError, z };
