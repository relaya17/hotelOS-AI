export type PaymentProviderName = "demo" | "stripe_stub" | "external";

export type CreatePaymentIntentInput = {
  readonly id: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly description: string;
  readonly payerEmail?: string;
};

export type PaymentIntentResult = {
  readonly id: string;
  readonly status: "requires_confirmation" | "succeeded";
  readonly provider: string;
  readonly clientSecret?: string;
  readonly providerRef?: string;
};

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult>;
  confirmIntent(input: {
    readonly id: string;
    readonly providerRef?: string;
  }): Promise<PaymentIntentResult>;
  /**
   * Server-side charge used by public booking — create + confirm in one step
   * so guests never handle card PAN (PCI stays at the provider).
   */
  charge(input: CreatePaymentIntentInput): Promise<PaymentIntentResult>;
}

/** Public, non-secret description of the configured payment mode (no credentials). */
export type PaymentPublicStatus = {
  readonly provider: PaymentProviderName;
  readonly mode: "demo" | "stub" | "external";
  readonly storesPan: false;
  readonly pciDssCertified: false;
  readonly labelHe: string;
  readonly labelEn: string;
};

export function describePaymentPublicStatus(
  payments: Pick<PaymentProvider, "name">,
): PaymentPublicStatus {
  if (payments.name === "external") {
    return {
      provider: "external",
      mode: "external",
      storesPan: false,
      pciDssCertified: false,
      labelHe:
        "תשלום דרך ספק חיצוני שהוגדר לפריסה · HotelOS אינה שומרת PAN · אין מצג PCI-DSS של HotelOS",
      labelEn:
        "External payment provider · HotelOS does not store PAN · no HotelOS PCI-DSS claim",
    };
  }
  if (payments.name === "stripe_stub") {
    return {
      provider: "stripe_stub",
      mode: "stub",
      storesPan: false,
      pciDssCertified: false,
      labelHe:
        "מצב stub (לא Stripe חי) · בלי כרטיס / בלי PAN · לא הסמכת PCI",
      labelEn:
        "Stripe stub (not live Stripe) · no card / no PAN · not PCI certified",
    };
  }
  return {
    provider: "demo",
    mode: "demo",
    storesPan: false,
    pciDssCertified: false,
    labelHe:
      "מצב הדגמה · בלי כרטיס אמיתי / בלי PAN במערכת · לא שער PCI חי",
    labelEn:
      "Demo mode · no real card / no PAN in HotelOS · not a live PCI gateway",
  };
}

export type PaymentProviderConfig = {
  readonly provider: PaymentProviderName;
  readonly externalUrl?: string;
  readonly externalToken?: string;
};

type FetchLike = typeof fetch;

function providerLabel(name: PaymentProviderName): string {
  if (name === "stripe_stub") return "stripe.stub";
  if (name === "external") return "external.payments";
  return "hotelos.payments";
}

export function createPaymentProvider(
  config: PaymentProviderConfig,
  fetchImpl: FetchLike = fetch,
): PaymentProvider {
  const name = config.provider;
  const label = providerLabel(name);

  async function createIntent(
    input: CreatePaymentIntentInput,
  ): Promise<PaymentIntentResult> {
    if (name === "stripe_stub") {
      return {
        id: input.id,
        status: "requires_confirmation",
        provider: label,
        clientSecret: `pi_stub_${input.id}_secret`,
        providerRef: `pi_stub_${input.id}`,
      };
    }

    if (name === "external") {
      const url = config.externalUrl?.trim();
      const token = config.externalToken?.trim();
      if (!url || !token) {
        throw new Error(
          "PAYMENT_EXTERNAL_URL and PAYMENT_EXTERNAL_TOKEN required when PAYMENT_PROVIDER=external",
        );
      }
      const response = await fetchImpl(`${url.replace(/\/$/, "")}/intents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: input.id,
          amountMinor: input.amountMinor,
          currency: input.currency,
          description: input.description,
          payerEmail: input.payerEmail ?? null,
        }),
      });
      if (!response.ok) {
        throw new Error(`External payment create failed (${response.status})`);
      }
      const payload = (await response.json()) as {
        id?: string;
        status?: string;
        clientSecret?: string;
        providerRef?: string;
      };
      return {
        id: payload.id ?? input.id,
        status:
          payload.status === "succeeded"
            ? "succeeded"
            : "requires_confirmation",
        provider: label,
        ...(payload.clientSecret
          ? { clientSecret: payload.clientSecret }
          : {}),
        ...(payload.providerRef ? { providerRef: payload.providerRef } : {}),
      };
    }

    return {
      id: input.id,
      status: "requires_confirmation",
      provider: label,
    };
  }

  async function confirmIntent(input: {
    readonly id: string;
    readonly providerRef?: string;
  }): Promise<PaymentIntentResult> {
    if (name === "external") {
      const url = config.externalUrl?.trim();
      const token = config.externalToken?.trim();
      if (!url || !token) {
        throw new Error(
          "PAYMENT_EXTERNAL_URL and PAYMENT_EXTERNAL_TOKEN required when PAYMENT_PROVIDER=external",
        );
      }
      const response = await fetchImpl(
        `${url.replace(/\/$/, "")}/intents/${encodeURIComponent(input.id)}/confirm`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            providerRef: input.providerRef ?? null,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`External payment confirm failed (${response.status})`);
      }
      return {
        id: input.id,
        status: "succeeded",
        provider: label,
        ...(input.providerRef ? { providerRef: input.providerRef } : {}),
      };
    }

    // demo + stripe_stub: PCI-free local confirm
    return {
      id: input.id,
      status: "succeeded",
      provider: label,
      ...(input.providerRef ? { providerRef: input.providerRef } : {}),
      ...(name === "stripe_stub"
        ? { clientSecret: `pi_stub_${input.id}_secret` }
        : {}),
    };
  }

  return {
    name,
    createIntent,
    confirmIntent,
    async charge(input) {
      const created = await createIntent(input);
      if (created.status === "succeeded") return created;
      return confirmIntent({
        id: created.id,
        ...(created.providerRef !== undefined
          ? { providerRef: created.providerRef }
          : {}),
      });
    },
  };
}
