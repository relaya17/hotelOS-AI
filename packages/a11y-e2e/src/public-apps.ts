/** Public marketing / guest shells for axe beyond login (no auth). */
export type PublicAppTarget = {
  readonly id: "www" | "guest";
  readonly packageName: string;
  readonly previewPort: number;
  readonly heading: string | RegExp;
};

export const PUBLIC_APP_TARGETS: readonly PublicAppTarget[] = [
  {
    id: "www",
    packageName: "@hotelos/www",
    previewPort: 4177,
    heading: /HotelOS|הכאב/,
  },
  {
    id: "guest",
    packageName: "@hotelos/guest",
    previewPort: 4175,
    heading: /הזמנ|HotelOS|אורח/,
  },
] as const;

export function publicPreviewUrl(port: number): string {
  return `http://127.0.0.1:${port}/`;
}
