import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Pencil, X } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { changeUsername } from "@/lib/profile.functions";

async function fetchMyProfile(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data;
}

export function UsernameEditor({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const save = useServerFn(changeUsername);
  const profile = useQuery({
    queryKey: ["my-profile", userId],
    queryFn: () => fetchMyProfile(userId),
  });

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const mutation = useMutation({
    mutationFn: (username: string) => save({ data: { username } }),
    onSuccess: async () => {
      setEditing(false);
      setError("");
      await queryClient.invalidateQueries();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Couldn't save. Try again."),
  });

  function startEdit() {
    setValue(profile.data?.username ?? "");
    setError("");
    setEditing(true);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const next = value.trim();
    if (next === profile.data?.username) {
      setEditing(false);
      return;
    }
    setError("");
    mutation.mutate(next);
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="field-label">Your username</p>
      {!editing ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium">{profile.data?.username ?? "…"}</span>
          <button
            type="button"
            onClick={startEdit}
            className="flex min-h-11 items-center gap-1.5 rounded-md border border-border-strong px-3 text-xs transition-colors hover:bg-secondary"
          >
            <Pencil size={12} /> Change
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-1">
          <div className="flex items-center gap-2">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              autoFocus
              aria-label="New username"
              maxLength={24}
              placeholder="new username"
              className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex min-h-11 items-center gap-1 rounded-md bg-accent px-3 text-xs font-medium text-accent-foreground disabled:opacity-40"
            >
              <Check size={13} /> Save
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="grid min-h-11 min-w-11 place-items-center rounded-md border border-border-strong text-xs transition-colors hover:bg-secondary"
              aria-label="Cancel"
            >
              <X size={13} />
            </button>
          </div>
          <p className="mt-1.5 text-xs text-faint">
            Shown to your leagues on picks and standings. Must be unique.
          </p>
        </form>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
