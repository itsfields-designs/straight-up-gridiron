import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Pin, PinOff, Send, Trash2, Unlock } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  deleteMessage,
  fetchMessages,
  sendMessage,
  setChatLocked,
  setMessagePinned,
  type League,
} from "@/lib/pool";

export function ChatPanel({
  league,
  isOwner,
  currentUserId,
}: {
  league: League;
  isOwner: boolean;
  currentUserId: string;
}) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const messages = useQuery({
    queryKey: ["chat", league.id],
    queryFn: () => fetchMessages(league.id),
  });

  useEffect(() => {
    const channel = supabase
      .channel(`league-chat-${league.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "league_messages",
          filter: `league_id=eq.${league.id}`,
        },
        () => queryClient.invalidateQueries({ queryKey: ["chat", league.id] }),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [league.id, queryClient]);

  const list = messages.data ?? [];
  const pinned = list.filter((m) => m.pinned);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [list.length]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["chat", league.id] });
    queryClient.invalidateQueries({ queryKey: ["league", league.id] });
  };

  const post = useMutation({
    mutationFn: async () => {
      const text = body.trim();
      if (!text) throw new Error("Write something first");
      await sendMessage({ leagueId: league.id, userId: currentUserId, body: text });
    },
    onSuccess: () => {
      setBody("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: deleteMessage,
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const pin = useMutation({
    mutationFn: (args: { id: string; pinned: boolean }) =>
      setMessagePinned(args.id, args.pinned),
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });

  const lock = useMutation({
    mutationFn: () => setChatLocked(league.id, !league.chat_locked),
    onSuccess: () => {
      toast.success(league.chat_locked ? "Chat unlocked" : "Chat locked");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canPost = isOwner || !league.chat_locked;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-3xl font-semibold">League chat</h2>
          <p className="text-xs text-faint">
            Talk picks and results with everyone in {league.name}.
          </p>
        </div>
        {isOwner && (
          <button
            onClick={() => lock.mutate()}
            disabled={lock.isPending}
            className="flex min-h-11 items-center gap-1.5 rounded-lg border border-border-strong bg-card px-3 text-sm font-semibold disabled:opacity-60"
          >
            {league.chat_locked ? <Unlock size={14} /> : <Lock size={14} />}
            {league.chat_locked ? "Unlock chat" : "Lock chat"}
          </button>
        )}
      </div>

      {pinned.length > 0 && (
        <div className="rounded-xl border border-accent bg-accent-soft p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Pin size={12} /> Pinned
          </div>
          {pinned.map((m) => (
            <p key={m.id} className="text-sm">
              <span className="font-medium">{m.username}: </span>
              {m.body}
            </p>
          ))}
        </div>
      )}

      <div className="max-h-[28rem] space-y-3 overflow-y-auto rounded-xl border border-border-strong bg-card p-4">
        {messages.isLoading && <p role="status" className="text-sm text-muted-foreground">Loading messages…</p>}
        {!messages.isLoading && list.length === 0 && (
          <p className="py-6 text-center text-sm text-faint">No messages yet. Say something.</p>
        )}
        {list.map((m) => {
          const mine = m.userId === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%]">
                <div
                  className={`mb-0.5 flex items-center gap-2 text-xs text-faint ${
                    mine ? "justify-end" : ""
                  }`}
                >
                  <span className="font-medium">{mine ? "You" : m.username}</span>
                  <span>
                    {new Date(m.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                  {m.pinned && <Pin size={11} />}
                </div>
                <div
                   className={`rounded-xl px-3 py-2 text-sm ${
                     mine ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                  }`}
                >
                  {m.body}
                </div>
                <div className={`mt-1 flex gap-3 text-xs ${mine ? "justify-end" : ""}`}>
                  {isOwner && (
                    <button
                      onClick={() => pin.mutate({ id: m.id, pinned: !m.pinned })}
                      className="flex min-h-11 items-center gap-1 px-2 text-muted-foreground"
                    >
                      {m.pinned ? <PinOff size={12} /> : <Pin size={12} />}
                      {m.pinned ? "Unpin" : "Pin"}
                    </button>
                  )}
                  {(mine || isOwner) && (
                    <button
                      onClick={() => remove.mutate(m.id)}
                      className="flex min-h-11 items-center gap-1 px-2 text-destructive"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {canPost ? (
        <div className="flex items-end gap-2">
          <textarea
            aria-label="Message"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                post.mutate();
              }
            }}
            rows={2}
            maxLength={2000}
            placeholder={
              league.chat_locked ? "Chat is locked for members" : "Share your picks or trash talk…"
            }
            className="min-h-[3rem] flex-1 resize-none rounded-lg border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            onClick={() => post.mutate()}
            disabled={post.isPending}
            aria-label="Send message"
            className="flex min-h-12 shrink-0 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-85 disabled:opacity-60"
          >
            <Send size={16} /> <span className="hidden sm:inline">Send</span>
          </button>
        </div>
      ) : (
        <p className="rounded-md border border-border bg-secondary px-3 py-2.5 text-sm text-muted-foreground">
          The commissioner has locked this chat.
        </p>
      )}
    </div>
  );
}
