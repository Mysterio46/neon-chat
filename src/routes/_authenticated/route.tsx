import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  // Reads the saved session on this device (no network wait on every page change).
  // The server still verifies the sign-in on every request.
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getSession();
    const user = data.session?.user;
    if (error || !user) {
      throw redirect({ to: "/auth" });
    }
    return { user };
  },
  component: () => <Outlet />,
});
