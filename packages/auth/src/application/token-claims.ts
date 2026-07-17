import { z } from "@hotelos/validation";

export const accessTokenClaimsSchema = z.object({
  sub: z.string().uuid(),
  tenantId: z.string().uuid(),
  chainId: z.string().uuid().optional(),
  hotelId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  roles: z.array(z.string()).min(1),
  typ: z.literal("access"),
});

export type AccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;
