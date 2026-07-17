import { ZodError, z } from "zod";

export const nonEmptyStringSchema = z.string().trim().min(1);

export const uuidSchema = z.string().uuid();

export function parseOrThrow<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  return schema.parse(input);
}

export { ZodError, z };
