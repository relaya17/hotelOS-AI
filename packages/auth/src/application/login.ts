import type { TenantId } from "@hotelos/shared";
import { err, ok, type Result } from "@hotelos/shared";
import { AuthError } from "../domain/errors.js";
import { verifyPassword } from "../domain/password.js";
import type { AuthPrincipal } from "../domain/tenancy.js";
import { Ids } from "@hotelos/shared";

export type LoginUserRecord = {
  readonly id: string;
  readonly tenantId: string;
  readonly chainId: string | null;
  readonly hotelId: string | null;
  readonly departmentId: string | null;
  readonly email: string;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly roles: readonly string[];
};

export type LoginUserReader = {
  findByTenantAndEmail: (
    tenantId: TenantId,
    email: string,
  ) => Promise<LoginUserRecord | null>;
};

export type LoginInput = {
  readonly tenantId: TenantId;
  readonly email: string;
  readonly password: string;
};

export type LoginSuccess = {
  readonly principal: AuthPrincipal;
  readonly displayName: string;
  readonly email: string;
};

export async function loginUser(
  reader: LoginUserReader,
  input: LoginInput,
): Promise<Result<LoginSuccess, AuthError>> {
  const user = await reader.findByTenantAndEmail(
    input.tenantId,
    input.email.trim().toLowerCase(),
  );
  if (!user) {
    return err(new AuthError("UNAUTHORIZED", "Invalid credentials"));
  }

  const valid = await verifyPassword(input.password, user.passwordHash);
  if (!valid) {
    return err(new AuthError("UNAUTHORIZED", "Invalid credentials"));
  }

  const scope: AuthPrincipal["scope"] = {
    tenantId: Ids.tenant(user.tenantId),
  };
  if (user.chainId !== null) {
    (scope as { chainId: ReturnType<typeof Ids.chain> }).chainId = Ids.chain(
      user.chainId,
    );
  }
  if (user.hotelId !== null) {
    (scope as { hotelId: ReturnType<typeof Ids.hotel> }).hotelId = Ids.hotel(
      user.hotelId,
    );
  }
  if (user.departmentId !== null) {
    (
      scope as { departmentId: ReturnType<typeof Ids.department> }
    ).departmentId = Ids.department(user.departmentId);
  }

  return ok({
    principal: {
      userId: Ids.user(user.id),
      roles: user.roles,
      scope,
    },
    displayName: user.displayName,
    email: user.email,
  });
}
