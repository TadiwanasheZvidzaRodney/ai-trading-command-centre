import { z } from "zod";

const environmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().min(1).default("127.0.0.1"),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z
    .string()
    .refine((value) => {
      try {
        const uri = new URL(value);
        return (
          (uri.protocol === "mongodb:" || uri.protocol === "mongodb+srv:") &&
          uri.hostname.length > 0
        );
      } catch {
        return false;
      }
    }, "Must be a valid MongoDB URI")
    .optional(),
});

export type AppConfig = z.infer<typeof environmentSchema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const result = environmentSchema.safeParse(source);

  if (!result.success) {
    const fields = result.error.issues
      .map((issue) => String(issue.path[0] ?? "environment"))
      .join(", ");
    throw new Error(`Invalid environment configuration: ${fields}`);
  }

  return result.data;
}
