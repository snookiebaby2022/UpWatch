import { supabase } from "@/integrations/supabase/client";

const OWNER_EMAIL = "snookiebaby2022@gmail.com";

export async function resolveAdminAccess(userId: string): Promise<{
  isAdmin: boolean;
  roleCheckFailed: boolean;
}> {
  // Direct check — works even when has_role RPC is overloaded/broken (RLS: own roles only).
  const { data: roleRow, error: roleErr } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();

  if (!roleErr && roleRow) {
    return { isAdmin: true, roleCheckFailed: false };
  }

  let { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (error) {
    console.error("has_role RPC failed — run supabase/fix-has-role-overload.sql", error);
    // Owner bootstrap fallback when RPC is broken
    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email?.toLowerCase();
    if (email === OWNER_EMAIL.toLowerCase()) {
      const { data: booted, error: bootErr } = await supabase.rpc("bootstrap_admin");
      if (!bootErr && booted) {
        const { data: row } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        if (row) return { isAdmin: true, roleCheckFailed: false };
      }
    }
    return { isAdmin: false, roleCheckFailed: true };
  }

  if (!isAdmin) {
    const { data: booted, error: bootErr } = await supabase.rpc("bootstrap_admin");
    if (bootErr) {
      console.error("bootstrap_admin RPC failed", bootErr);
    } else if (booted) {
      ({ data: isAdmin, error } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      }));
      if (error) {
        const { data: row } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        return { isAdmin: !!row, roleCheckFailed: !row };
      }
    }
  }

  return { isAdmin: !!isAdmin, roleCheckFailed: false };
}
