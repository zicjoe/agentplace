/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_PLACE_API_BASE_URL?: string;
  readonly VITE_AGENT_PLACE_DATA_MODE?: 'fixtures' | 'api';
  readonly VITE_AGENT_PLACE_ENABLE_DEMO_CONTROLS?: 'true' | 'false';
  readonly VITE_AGENT_PLACE_PERSIST_FIXTURES?: 'true' | 'false';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
