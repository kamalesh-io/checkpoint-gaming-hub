import { invoke } from '@tauri-apps/api/core';
import { isTauriRuntime } from '@/services/api';

/**
 * Opens an external URL in the user's default system browser.
 * In Tauri desktop, delegates to native shell/cmd so it opens outside the WebView.
 * In web preview, falls back to window.open.
 */
export async function openExternalUrl(url: string): Promise<void> {
  if (!url) return;
  if (isTauriRuntime()) {
    try {
      await invoke('open_external_url', { url });
      return;
    } catch (err) {
      console.warn('[openExternalUrl] Tauri invoke failed, falling back to window.open:', err);
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}
