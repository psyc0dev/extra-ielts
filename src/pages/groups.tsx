import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  ArrowLeft,
  PaperPlaneRight,
  ChatCircle,
  User,
} from "@phosphor-icons/react";
import {
  listMyGroups,
  listGroupMessages,
  sendGroupMessage,
  type MyGroup,
  type GroupMessage,
} from "@/lib/api";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import { toast } from "sonner";
import Cookies from "js-cookie";
import en from "@/locales/en";

function formatMessageTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } else if (isYesterday) {
    return `Yesterday ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } else {
    return date.toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
}

function MessageBubble({
  message,
  isConsecutive,
  isLastInGroup,
  isFirstInGroup,
}: {
  message: GroupMessage;
  isConsecutive: boolean;
  isLastInGroup: boolean;
  isFirstInGroup: boolean;
}) {
  // Telegram style: name on first message, avatar on last message of a block
  const showAvatar = isLastInGroup;
  const showName = isFirstInGroup;

  return (
    <div className={`flex ${message.isMe ? "justify-end" : "justify-start"} ${isConsecutive ? "mt-0.5" : "mt-2"}`}>
      <div className={`flex gap-2 max-w-[80%] ${message.isMe ? "flex-row-reverse" : "flex-row"} items-end`}>
        <div className="size-8 shrink-0 self-end">
          {showAvatar ? (
            <Avatar className="size-8">
              <AvatarImage src={message.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-neutral-700 text-neutral-200 text-xs font-medium">
                {message.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            /* Spacer to keep messages aligned when avatar is hidden */
            <div className="size-8" />
          )}
        </div>

        <div className={`flex flex-col ${message.isMe ? "items-end" : "items-start"}`}>
          {showName && (
            <span className={`text-[11px] font-medium mb-0.5 px-1 ${message.isMe ? "text-blue-400" : "text-blue-400/80"}`}>
              {message.username}
            </span>
          )}

          <div
            className={`relative px-3 py-1.5 text-sm leading-snug ${
              message.isMe
                ? "bg-[#2B5278] text-white rounded-2xl rounded-br-sm"
                : "bg-[#182533] text-neutral-100 rounded-2xl rounded-bl-sm"
            }`}
          >
            <span>{message.content}</span>

            {/* Timestamp inline for Telegram style */}
            <span className={`inline-block text-[10px] opacity-50 ml-2 translate-y-0.5 ${message.isMe ? "text-blue-100" : "text-neutral-400"}`}>
              {formatMessageTime(message.createdAt)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatRoom({
  group,
  onBack,
}: {
  group: MyGroup;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadMessages = async () => {
    try {
      const res = await listGroupMessages(group.id);
      setMessages(res.messages);
    } catch {
      toast.error(en.groups.chat.loadError);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMessages();

    const token = Cookies.get("accessToken");
    if (!token) return;

    // Use ws:// for localhost, wss:// for production
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

    let wsUrl: string;
    if (baseUrl.startsWith("/")) {
      // Relative path (e.g. "/api") — use current host
      wsUrl = `${wsProtocol}//${window.location.host}${baseUrl}/groups/${group.id}/ws?token=${token}`;
    } else {
      // Absolute URL (e.g. "https://api.example.com/api") — derive WS URL
      const wsHost = baseUrl.replace(/^https?:\/\//, "");
      wsUrl = `${wsProtocol}//${wsHost}/groups/${group.id}/ws?token=${token}`;
    }

    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setMessages((prev) => {
            if (prev.some(m => m.id === data.id)) return prev;
            return [...prev, data];
          });
        } catch (err) {
          console.error("WebSocket message error", err);
        }
      };

      ws.onclose = () => {
        // Reconnect after 3 seconds
        reconnectTimer = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [group.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    const content = inputValue.trim();
    if (!content || sending) return;

    setSending(true);
    try {
      const res = await sendGroupMessage(group.id, content);
      setMessages((prev) => [...prev, res.message]);
      setInputValue("");
      inputRef.current?.focus();
    } catch {
      toast.error(en.groups.chat.sendError);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: GroupMessage[] }[] = [];
    let currentGroup: { date: string; messages: GroupMessage[] } | null = null;

    messages.forEach((msg) => {
      const date = new Date(msg.createdAt).toDateString();
      if (!currentGroup || currentGroup.date !== date) {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = { date, messages: [msg] };
      } else {
        currentGroup.messages.push(msg);
      }
    });
    if (currentGroup) groups.push(currentGroup);
    return groups;
  }, [messages]);

  return (
    <div className="relative flex h-full min-h-full flex-col overflow-hidden bg-neutral-900">
      <CardHeader className="z-10 flex flex-row items-center gap-3 border-b border-neutral-800 bg-neutral-900 px-4 py-3 shrink-0">
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onBack}>
          <ArrowLeft weight="bold" className="size-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-sm font-semibold truncate">{group.name}</CardTitle>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users weight="bold" className="size-3" />
            {en.groups.chat.memberCount(group.memberCount)}
          </div>
        </div>
      </CardHeader>

      <CardContent className="relative flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 px-4 pt-3 pb-2" ref={scrollRef}>
          {loading ? (
            <div className="flex flex-col gap-4 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
                >
                  <Skeleton className="h-10 w-48 rounded-xl" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <ChatCircle weight="duotone" className="size-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{en.groups.chat.empty}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{en.groups.chat.emptySub}</p>
            </div>
          ) : (
            <div className="mx-auto flex w-full max-w-4xl flex-col gap-1 px-1">
              {groupedMessages.map((group) => (
                <div key={group.date} className="flex flex-col first:[&]:mt-0 mt-4">
                  <div className="flex items-center justify-center mb-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] border-neutral-800 bg-neutral-950"
                    >
                      {new Date(group.date).toLocaleDateString([], { month: "long", day: "numeric" })}
                    </Badge>
                  </div>
                  {group.messages.map((msg, msgIdx) => {
                    const isConsecutive =
                      msgIdx > 0 &&
                      group.messages[msgIdx - 1].userId === msg.userId &&
                      new Date(msg.createdAt).getTime() -
                        new Date(group.messages[msgIdx - 1].createdAt).getTime() <
                        60000;
                    const isFirstInGroup =
                      msgIdx === 0 ||
                      group.messages[msgIdx - 1].userId !== msg.userId;
                    const isLastInGroup =
                      msgIdx === group.messages.length - 1 ||
                      group.messages[msgIdx + 1].userId !== msg.userId;
                    return (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        isConsecutive={isConsecutive}
                        isFirstInGroup={isFirstInGroup}
                        isLastInGroup={isLastInGroup}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator className="bg-neutral-800" />

        <div className="z-10 shrink-0 border-t border-neutral-800 bg-neutral-900 px-3 py-3">
          <div className="mx-auto flex w-full max-w-4xl items-center gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={en.groups.chat.inputPlaceholder}
              disabled={sending}
              className="h-11 flex-1 rounded-full border-neutral-800 bg-neutral-950 px-4 text-sm"
            />
            <Button
              size="sm"
              className="h-11 w-11 rounded-full p-0"
              disabled={!inputValue.trim() || sending}
              onClick={handleSend}
            >
              <PaperPlaneRight weight="bold" className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </div>
  );
}

function GroupListItem({
  group,
  onClick,
}: {
  group: MyGroup;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="w-full text-left"
    >
      <div className="flex items-center gap-3 p-3 rounded-xl border border-neutral-800 bg-neutral-950 hover:border-neutral-700 transition-colors">
        <div className="flex items-center justify-center size-10 rounded-full bg-gradient-to-br from-blue-600 to-purple-600 shrink-0">
          <Users weight="bold" className="size-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate">{group.name}</h3>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <User weight="bold" className="size-3" />
            {en.groups.list.memberCount(group.memberCount)}
          </div>
        </div>
        <div className="shrink-0">
          <ChatCircle weight="bold" className="size-5 text-muted-foreground" />
        </div>
      </div>
    </motion.button>
  );
}

export function Groups() {
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState<MyGroup | null>(null);
  const sk = useDelayedLoading(loading);

  useEffect(() => {
    listMyGroups()
      .then((res) => setGroups(res.groups))
      .catch(() => toast.error(en.groups.list.loadError))
      .finally(() => setLoading(false));
  }, []);

  if (selectedGroup) {
    return (
      <div className="h-full min-h-full">
        <ChatRoom
          group={selectedGroup}
          onBack={() => setSelectedGroup(null)}
        />
      </div>
    );
  }

  return (
    <div className="p-5 flex flex-col gap-4 font-body">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="border-neutral-800 bg-neutral-900">
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Users weight="bold" className="size-4" />
              {en.groups.list.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {sk ? (
              <div className="flex flex-col gap-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-xl" />
                ))}
              </div>
            ) : groups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Users weight="duotone" className="size-12 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">{en.groups.list.empty}</p>
                <p className="text-xs text-muted-foreground/60 mt-1 max-w-xs">
                  {en.groups.list.emptySub}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <AnimatePresence>
                  {groups.map((group, i) => (
                    <motion.div
                      key={group.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                    >
                      <GroupListItem
                        group={group}
                        onClick={() => setSelectedGroup(group)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
