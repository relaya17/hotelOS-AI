import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createWhatsAppProvider,
  normalizeWhatsAppTo,
  toWhatsAppApiPhone,
} from "./whatsapp-provider.js";

test("normalizeWhatsAppTo maps Israeli local numbers to E.164", () => {
  assert.equal(normalizeWhatsAppTo("050-1234567"), "+972501234567");
  assert.equal(normalizeWhatsAppTo("+972 50-123-4567"), "+972501234567");
  assert.equal(normalizeWhatsAppTo("972501234567"), "+972501234567");
  assert.throws(() => normalizeWhatsAppTo("123"), /INVALID_PHONE/);
});

test("toWhatsAppApiPhone strips plus for Meta", () => {
  assert.equal(toWhatsAppApiPhone("050-1234567"), "972501234567");
});

test("selects demo and off WhatsApp providers", async () => {
  const demo = createWhatsAppProvider({
    provider: "demo",
    apiUrl: "",
    apiToken: "",
  });
  const off = createWhatsAppProvider({
    provider: "off",
    apiUrl: "",
    apiToken: "",
  });

  assert.equal(demo.name, "demo");
  assert.deepEqual(
    await demo.sendWhatsApp({ to: "050-1234567", body: "test" }),
    { status: "sent" },
  );
  assert.equal(off.name, "off");
  assert.deepEqual(
    await off.sendWhatsApp({ to: "050-1234567", body: "test" }),
    { status: "skipped" },
  );
});

test("http WhatsApp provider posts E.164 gateway payload with bearer token", async () => {
  let request: Request | undefined;
  const provider = createWhatsAppProvider(
    {
      provider: "http",
      apiUrl: "https://gateway.example.test/messages",
      apiToken: "token",
    },
    async (input, init) => {
      request = new Request(input, init);
      return new Response(null, { status: 202 });
    },
  );

  const result = await provider.sendWhatsApp({
    to: "050-1234567",
    body: "שלום",
  });

  assert.deepEqual(result, { status: "sent" });
  assert.equal(request?.method, "POST");
  assert.equal(request?.headers.get("authorization"), "Bearer token");
  assert.deepEqual(await request?.json(), {
    to: "+972501234567",
    body: "שלום",
  });
});

test("http WhatsApp provider requires a gateway URL and token", () => {
  assert.throws(
    () =>
      createWhatsAppProvider({
        provider: "http",
        apiUrl: "",
        apiToken: "token",
      }),
    /WHATSAPP_API_URL/,
  );
  assert.throws(
    () =>
      createWhatsAppProvider({
        provider: "http",
        apiUrl: "https://gateway.example.test/messages",
        apiToken: "",
      }),
    /WHATSAPP_API_TOKEN/,
  );
});

test("meta WhatsApp provider posts Cloud API text payload", async () => {
  let request: Request | undefined;
  const provider = createWhatsAppProvider(
    {
      provider: "meta",
      apiUrl: "",
      apiToken: "meta-token",
      metaPhoneNumberId: "1234567890",
      metaGraphVersion: "v21.0",
    },
    async (input, init) => {
      request = new Request(input, init);
      return new Response(JSON.stringify({ messages: [{ id: "wamid.1" }] }), {
        status: 200,
      });
    },
  );

  const result = await provider.sendWhatsApp({
    to: "050-1234567",
    body: "שלום יוסי, חדר 102 מוכן. מוזמנים לעלות.",
  });

  assert.deepEqual(result, { status: "sent" });
  assert.equal(
    request?.url,
    "https://graph.facebook.com/v21.0/1234567890/messages",
  );
  assert.equal(request?.headers.get("authorization"), "Bearer meta-token");
  assert.deepEqual(await request?.json(), {
    messaging_product: "whatsapp",
    to: "972501234567",
    type: "text",
    text: {
      preview_url: false,
      body: "שלום יוסי, חדר 102 מוכן. מוזמנים לעלות.",
    },
  });
});

test("meta WhatsApp provider sends approved template when configured", async () => {
  let request: Request | undefined;
  const provider = createWhatsAppProvider(
    {
      provider: "meta",
      apiUrl: "",
      apiToken: "meta-token",
      metaPhoneNumberId: "1234567890",
      metaTemplateName: "room_ready",
      metaTemplateLanguage: "he",
    },
    async (input, init) => {
      request = new Request(input, init);
      return new Response(null, { status: 200 });
    },
  );

  await provider.sendWhatsApp({
    to: "+972501234567",
    body: "fallback",
    templateBodyParams: ["יוסי מזרחי", "102"],
  });

  assert.deepEqual(await request?.json(), {
    messaging_product: "whatsapp",
    to: "972501234567",
    type: "template",
    template: {
      name: "room_ready",
      language: { code: "he" },
      components: [
        {
          type: "body",
          parameters: [
            { type: "text", text: "יוסי מזרחי" },
            { type: "text", text: "102" },
          ],
        },
      ],
    },
  });
});

test("meta WhatsApp provider requires token and phone number id", () => {
  assert.throws(
    () =>
      createWhatsAppProvider({
        provider: "meta",
        apiUrl: "",
        apiToken: "",
        metaPhoneNumberId: "123",
      }),
    /WHATSAPP_API_TOKEN/,
  );
  assert.throws(
    () =>
      createWhatsAppProvider({
        provider: "meta",
        apiUrl: "",
        apiToken: "token",
        metaPhoneNumberId: "",
      }),
    /WHATSAPP_META_PHONE_NUMBER_ID/,
  );
});
