export const GOOGLE_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_CLIENT_ID ||
  process.env.VITE_GOOGLE_CLIENT_ID ||
  process.env.GOOGLE_CLIENT_ID ||
  "670259483154-67e6dgusfovkfi2000smjkksrf5n15pt.apps.googleusercontent.com";

export type GoogleIdTokenClaims = {
  sub: string;
  email: string;
  email_verified: string | boolean;
  name?: string;
  picture?: string;
  aud: string;
  iss: string;
  exp: string;
};

export async function verifyGoogleIdToken(idToken: string): Promise<GoogleIdTokenClaims> {
  const res = await fetch(
    `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
  );

  const data = (await res.json()) as GoogleIdTokenClaims & {
    error_description?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error_description || data.error || "Invalid Google sign-in token");
  }

  if (data.iss !== "https://accounts.google.com" && data.iss !== "accounts.google.com") {
    throw new Error("Invalid Google token issuer");
  }

  const aud = data.aud;
  const allowedAudiences = GOOGLE_CLIENT_ID.split(",").map((s) => s.trim()).filter(Boolean);
  if (!allowedAudiences.includes(aud)) {
    throw new Error(`Google token audience mismatch (expected ${GOOGLE_CLIENT_ID})`);
  }

  const verified =
    data.email_verified === true ||
    data.email_verified === "true" ||
    data.email_verified === "1";
  if (!verified) {
    throw new Error("Google account email is not verified");
  }

  if (!data.email) {
    throw new Error("Google account did not return an email");
  }

  const exp = Number(data.exp);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) {
    throw new Error("Google sign-in token expired — try again");
  }

  return data;
}
