/** Staff Vite apps with email/password login screens (guest has no login). */
export type LoginAppTarget = {
  readonly id: "admin" | "executive" | "work";
  readonly packageName: string;
  readonly previewPort: number;
  readonly loginHeading: string;
};

export const LOGIN_APP_TARGETS: readonly LoginAppTarget[] = [
  {
    id: "executive",
    packageName: "@hotelos/executive",
    previewPort: 4173,
    loginHeading: "כניסת הנהלת רשת",
  },
  {
    id: "admin",
    packageName: "@hotelos/admin",
    previewPort: 4174,
    loginHeading: "כניסת מנהל/תפעול",
  },
  {
    id: "work",
    packageName: "@hotelos/work",
    previewPort: 4176,
    loginHeading: "כניסת עובד",
  },
] as const;

export function loginPreviewUrl(port: number): string {
  return `http://127.0.0.1:${port}/`;
}
