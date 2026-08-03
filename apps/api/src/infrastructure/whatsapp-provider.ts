export type WhatsAppProviderName = "demo" | "http" | "meta" | "off";

export type SendWhatsAppInput = {
  readonly to: string;
  readonly body: string;
  /** Body parameters for Meta approved templates ({{1}}, {{2}}, …). */
  readonly templateBodyParams?: readonly string[];
};

export type WhatsAppSendResult = {
  readonly status: "sent" | "skipped";
};

export interface WhatsAppProvider {
  readonly name: WhatsAppProviderName;
  sendWhatsApp(input: SendWhatsAppInput): Promise<WhatsAppSendResult>;
}

export type WhatsAppProviderConfig = {
  readonly provider: WhatsAppProviderName;
  readonly apiUrl: string;
  readonly apiToken: string;
  readonly metaPhoneNumberId?: string;
  readonly metaGraphVersion?: string;
  readonly metaTemplateName?: string;
  readonly metaTemplateLanguage?: string;
};

type FetchLike = typeof fetch;

/**
 * Normalize a phone to E.164 for WhatsApp gateways.
 * Israeli local numbers (05x…) become +972…; already-international numbers keep +.
 */
export function normalizeWhatsAppTo(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("INVALID_PHONE");
  }

  let value = trimmed.replace(/[\s\-().]/g, "");
  if (value.startsWith("00")) {
    value = `+${value.slice(2)}`;
  }

  if (value.startsWith("+")) {
    const digits = value.slice(1).replace(/\D/g, "");
    if (digits.length < 8 || digits.length > 15) {
      throw new Error("INVALID_PHONE");
    }
    return `+${digits}`;
  }

  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 10) {
    return `+972${digits.slice(1)}`;
  }
  if (digits.startsWith("972") && digits.length >= 11 && digits.length <= 12) {
    return `+${digits}`;
  }
  if (digits.length >= 8 && digits.length <= 15) {
    return `+${digits}`;
  }
  throw new Error("INVALID_PHONE");
}

/** Meta Cloud API expects digits only (no leading +). */
export function toWhatsAppApiPhone(raw: string): string {
  return normalizeWhatsAppTo(raw).replace(/^\+/, "");
}

async function readGatewayError(
  response: Response,
  label: string,
): Promise<Error> {
  let detail = "";
  try {
    const text = await response.text();
    if (text.trim()) {
      detail = `: ${text.slice(0, 280)}`;
    }
  } catch {
    // ignore body read failures
  }
  return new Error(`${label} responded with HTTP ${response.status}${detail}`);
}

function createHttpProvider(
  config: WhatsAppProviderConfig,
  fetchImpl: FetchLike,
): WhatsAppProvider {
  const apiUrl = config.apiUrl.trim();
  const apiToken = config.apiToken.trim();
  if (!apiUrl) {
    throw new Error(
      "WHATSAPP_API_URL is required when WHATSAPP_PROVIDER=http",
    );
  }
  if (!apiToken) {
    throw new Error(
      "WHATSAPP_API_TOKEN is required when WHATSAPP_PROVIDER=http",
    );
  }

  return {
    name: "http",
    async sendWhatsApp({ to, body }) {
      const normalizedTo = normalizeWhatsAppTo(to);
      const response = await fetchImpl(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ to: normalizedTo, body }),
      });

      if (!response.ok) {
        throw await readGatewayError(response, "WhatsApp gateway");
      }

      return { status: "sent" };
    },
  };
}

function createMetaProvider(
  config: WhatsAppProviderConfig,
  fetchImpl: FetchLike,
): WhatsAppProvider {
  const apiToken = config.apiToken.trim();
  const phoneNumberId = config.metaPhoneNumberId?.trim() ?? "";
  if (!apiToken) {
    throw new Error(
      "WHATSAPP_API_TOKEN is required when WHATSAPP_PROVIDER=meta",
    );
  }
  if (!phoneNumberId) {
    throw new Error(
      "WHATSAPP_META_PHONE_NUMBER_ID is required when WHATSAPP_PROVIDER=meta",
    );
  }

  const graphVersion = (config.metaGraphVersion?.trim() || "v21.0").replace(
    /^\/+|\/+$/g,
    "",
  );
  const templateName = config.metaTemplateName?.trim() ?? "";
  const templateLanguage = config.metaTemplateLanguage?.trim() || "he";
  const endpoint = `https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`;

  return {
    name: "meta",
    async sendWhatsApp({ to, body, templateBodyParams }) {
      const recipient = toWhatsAppApiPhone(to);
      const payload =
        templateName.length > 0
          ? {
              messaging_product: "whatsapp",
              to: recipient,
              type: "template",
              template: {
                name: templateName,
                language: { code: templateLanguage },
                components: [
                  {
                    type: "body",
                    parameters: (
                      templateBodyParams && templateBodyParams.length > 0
                        ? templateBodyParams
                        : [body]
                    ).map((text) => ({ type: "text", text })),
                  },
                ],
              },
            }
          : {
              messaging_product: "whatsapp",
              to: recipient,
              type: "text",
              text: { preview_url: false, body },
            };

      const response = await fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw await readGatewayError(response, "Meta WhatsApp Cloud API");
      }

      return { status: "sent" };
    },
  };
}

/**
 * Providers:
 * - demo: always "sent" (local/CI)
 * - off: always "skipped"
 * - http: POST WHATSAPP_API_URL with Bearer token and `{ to, body }`
 * - meta: Meta Cloud API (text, or approved template when WHATSAPP_META_TEMPLATE_NAME is set)
 */
export function createWhatsAppProvider(
  config: WhatsAppProviderConfig,
  fetchImpl: FetchLike = fetch,
): WhatsAppProvider {
  if (config.provider === "demo") {
    return {
      name: "demo",
      async sendWhatsApp() {
        return { status: "sent" };
      },
    };
  }

  if (config.provider === "off") {
    return {
      name: "off",
      async sendWhatsApp() {
        return { status: "skipped" };
      },
    };
  }

  if (config.provider === "meta") {
    return createMetaProvider(config, fetchImpl);
  }

  return createHttpProvider(config, fetchImpl);
}
