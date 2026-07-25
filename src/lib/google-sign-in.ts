/** Google Identity Services — verified server-side (bypasses Supabase audience allow-list). */

import { supabase } from "@/integrations/supabase/client";

export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  "670259483154-67e6dgusfovkfi2000smjkksrf5n15pt.apps.googleusercontent.com";

function randomNonce() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Exchange Google credential for a Supabase session via UpWatch API. */
async function signInWithGoogleCredentialViaServer(credential: string) {
  const res = await fetch("/api/public/google/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: credential }),
  });

  const data = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    error?: string;
    detail?: string;
  };

  if (!res.ok) {
    throw new Error(data.detail ? `${data.error}: ${data.detail}` : data.error || "Google sign-in failed");
  }

  if (!data.access_token || !data.refresh_token) {
    throw new Error("Google sign-in failed: no session returned");
  }

  const { error } = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });

  if (error) throw error;

  const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
  if (sessionErr || !sessionData.session) {
    throw new Error("Signed in with Google but the session was not saved. Try again.");
  }
}

/** Prefer direct Supabase exchange; fall back to server when audience is not allow-listed. */
export async function signInWithGoogleCredential(credential: string, rawNonce: string) {
  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: credential,
    nonce: rawNonce,
  });

  if (!error && data.session) return;

  const message = error?.message ?? "";
  const audienceBlocked = /audience|client id|unacceptable/i.test(message);
  if (audienceBlocked || /no session returned/i.test(message)) {
    await signInWithGoogleCredentialViaServer(credential);
    return;
  }

  if (error) throw error;
  throw new Error("Google sign-in failed: no session returned");
}

type CredentialResponse = { credential: string };

type GoogleIdApi = {
  initialize: (config: {
    client_id: string;
    callback: (response: CredentialResponse) => void;
    nonce?: string;
    use_fedcm_for_prompt?: boolean;
  }) => void;
  renderButton: (
    parent: HTMLElement,
    options: {
      type?: string;
      theme?: string;
      size?: string;
      text?: string;
      shape?: string;
      width?: number;
      logo_alignment?: string;
    },
  ) => void;
};

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } };
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadGoogleIdentityScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-upwatch-gis="1"]');
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Google sign-in script failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.dataset.upwatchGis = "1";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google sign-in script failed to load"));
    document.head.appendChild(script);
  });

  return scriptPromise;
}

export async function mountGoogleSignInButton(
  container: HTMLElement,
  onSuccess: () => void,
  onError: (message: string) => void,
) {
  await loadGoogleIdentityScript();
  const gis = window.google?.accounts?.id;
  if (!gis) throw new Error("Google sign-in is unavailable");

  container.replaceChildren();

  const rawNonce = randomNonce();
  const hashedNonce = await sha256Hex(rawNonce);

  gis.initialize({
    client_id: GOOGLE_CLIENT_ID,
    nonce: hashedNonce,
    use_fedcm_for_prompt: false,
    callback: async (response) => {
      try {
        await signInWithGoogleCredential(response.credential, rawNonce);
        onSuccess();
      } catch (err) {
        console.error("google sign-in failed", err);
        onError(err instanceof Error ? err.message : "Google sign-in failed");
      }
    },
  });

  const width = Math.min(Math.max(container.offsetWidth || 320, 280), 400);
  gis.renderButton(container, {
    type: "standard",
    theme: "outline",
    size: "large",
    text: "continue_with",
    shape: "rectangular",
    width,
    logo_alignment: "left",
  });
}
