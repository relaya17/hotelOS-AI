export const PILOT_MAIL =
  "mailto:pilot@hotelos.ai?subject=HotelOS%20AI%20Pilot&body=שלום%2C%20אשמח%20לדבר%20על%20פיילוט%20HotelOS%20AI%20לרשת%20שלנו.";

export const CALENDLY_URL = (
  import.meta.env["VITE_CALENDLY_URL"] as string | undefined
)?.trim();

export const DEMO_VIDEO_URL = (
  import.meta.env["VITE_DEMO_VIDEO_URL"] as string | undefined
)?.trim();

export const PARTNER_NAMES = (
  import.meta.env["VITE_PARTNER_NAMES"] as string | undefined
)
  ?.split(",")
  .map((name) => name.trim())
  .filter((name) => name.length > 0) ?? [];
