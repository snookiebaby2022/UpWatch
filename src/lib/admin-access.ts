import { supabase } from "@/integrations/supabase/client";

export async function resolveAdminAccess(userId: string): Promise<{
  isAdmin: boolean;
  roleCheckFailed: boolean;
}> {
  let { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });

  if (error) {
    console.error("has_role RPC failed — run supabase/fix-admin-now.sql in Supabase", error);
    return { isAdmin: false, roleCheckFailed: true };
  }

  if (!isAdmin) {
    const { data: booted, error: bootErr } = await supabase.rpc("bootstrap_admin");
    if (bootErr) {
      console.error("bootstrap_admin RPC failed — run supabase/fix-admin-now.sql in Supabase", bootErr);
    } else if (booted) {
      ({ data: isAdmin, error } = await supabase.rpc("has_role", {
        _user_id: userId,
        _role: "admin",
      }));
      if (error) {
        console.error("has_role RPC failed after bootstrap", error);
        return { isAdmin: false, roleCheckFailed: true };
      }
    }
  }

  return { isAdmin: !!isAdmin, roleCheckFailed: false };
}
