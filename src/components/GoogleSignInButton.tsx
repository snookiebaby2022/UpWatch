import { useEffect, useRef, useState } from "react";
import { GOOGLE_CLIENT_ID, mountGoogleSignInButton } from "@/lib/google-sign-in";

export function GoogleSignInButton({
  disabled,
  onSuccess,
  onError,
}: {
  disabled?: boolean;
  onSuccess: () => void;
  onError: (message: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const [ready, setReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  useEffect(() => {
    if (disabled || !containerRef.current) return;
    let cancelled = false;

    (async () => {
      try {
        await mountGoogleSignInButton(
          containerRef.current!,
          () => {
            setSigningIn(false);
            onSuccessRef.current();
          },
          (msg) => {
            setSigningIn(false);
            onErrorRef.current(msg);
          },
        );
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) {
          onErrorRef.current(err instanceof Error ? err.message : "Google sign-in failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [disabled]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled || signingIn) return;

    const onClick = () => setSigningIn(true);
    el.addEventListener("click", onClick, true);
    return () => el.removeEventListener("click", onClick, true);
  }, [disabled, signingIn, ready]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <p className="text-xs text-amber-400/90">
        Google sign-in is not configured (missing VITE_GOOGLE_CLIENT_ID).
      </p>
    );
  }

  return (
    <div className={disabled || signingIn ? "opacity-60 pointer-events-none" : ""}>
      <div ref={containerRef} className="flex justify-center min-h-[44px]" aria-busy={!ready || signingIn} />
      {signingIn && (
        <p className="text-xs text-zinc-500 text-center mt-2">Signing in with Google…</p>
      )}
    </div>
  );
}
