"use client";

import { useState, useTransition } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, BellOff, CheckCheck } from "lucide-react";
import { markNotificationRead, markAllNotificationsRead } from "@/app/portal/notifications/actions";
import { formatDateTime } from "@/lib/date";

interface Row {
  id: string;
  read_at: string | null;
  channel: string;
  notifications: { id: string; title: string; message: string; priority: string; action_link: string | null; created_at: string } | null;
}

const PRIORITY_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  low: "outline",
  normal: "secondary",
  high: "default",
  urgent: "destructive",
};

export function NotificationsList({ items }: { items: Row[] }) {
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "unread" | "important">("all");
  const unread = items.filter((i) => !i.read_at);

  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-muted-foreground">
        <BellOff className="mx-auto mb-3 h-8 w-8" />
        <p>No notifications yet. Published updates for your team will appear here.</p>
      </div>
    );
  }

  const filtered = items.filter((i) => {
    if (filter === "unread") return !i.read_at;
    if (filter === "important") return i.notifications?.priority === "high" || i.notifications?.priority === "urgent";
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="important">Important</TabsTrigger>
          </TabsList>
        </Tabs>
        {unread.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={isPending}
            onClick={() => startTransition(() => markAllNotificationsRead(unread.map((u) => u.id)))}
          >
            <CheckCheck className="h-4 w-4" /> Mark all as read
          </Button>
        )}
      </div>

      {filtered.length === 0 && <p className="py-8 text-center text-sm text-muted-foreground">No notifications match this filter.</p>}

      {filtered.map((item) => {
        const n = item.notifications;
        if (!n) return null;
        return (
          <Card key={item.id} className={!item.read_at ? "border-primary/40" : undefined}>
            <CardContent className="flex items-start gap-3 py-4">
              <Bell className={`mt-0.5 h-4 w-4 shrink-0 ${!item.read_at ? "text-primary" : "text-muted-foreground"}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={!item.read_at ? "font-semibold" : "font-medium text-muted-foreground"}>{n.title}</p>
                  <Badge variant={PRIORITY_VARIANT[n.priority]} className="capitalize">{n.priority}</Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
                <div className="mt-2 flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{formatDateTime(n.created_at)}</span>
                  {n.action_link && (
                    <a href={n.action_link} className="text-xs text-primary underline underline-offset-4">
                      View
                    </a>
                  )}
                  {!item.read_at && (
                    <button
                      className="text-xs text-primary underline underline-offset-4"
                      onClick={() => startTransition(() => markNotificationRead(item.id))}
                    >
                      Mark as read
                    </button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
