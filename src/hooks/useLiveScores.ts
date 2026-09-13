import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Pushes score and standings changes into the UI the moment they land in the
 * database, so a finished game moves the standings without a page refresh.
 */
export function useLiveScores() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const invalidate = () => {
      queryClient.invalidateQueries({ queryKey: ["week"] });
      queryClient.invalidateQueries({ queryKey: ["all-weeks"] });
      queryClient.invalidateQueries({ queryKey: ["current-week"] });
    };

    const channel = supabase
      .channel("nfl-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "games" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "weeks" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "league_standings" }, () =>
        queryClient.invalidateQueries({ queryKey: ["standings"] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
