/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
  readonly VITE_APP_URL_EXECUTIVE?: string;
  readonly VITE_APP_URL_ADMIN?: string;
  readonly VITE_APP_URL_GUEST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
