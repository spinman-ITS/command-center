import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

interface RealtimeBinding {
  table: string;
  queryKey: string;
}

export function useRealtimeInvalidation(bindings: RealtimeBinding[]) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const channel = client.channel(`atlas-live-${bindings.map((binding) => binding.table).join("-")}`);

    for (const binding of bindings) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: binding.table },
        () => {
          void queryClient.invalidateQueries({ queryKey: [binding.queryKey] });
        },
      );
    }

    void channel.subscribe();

    return () => {
      void client.removeChannel(channel);
    };
  }, [bindings, queryClient]);
}
