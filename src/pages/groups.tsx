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
  Image as ImageIcon,
  X,
} from "@phosphor-icons/react";
import {
  listMyGroups,
  listGroupMessages,
  sendGroupMessage,
  leaveGroup,
  type MyGroup,
  type GroupMessage,
} from "@/lib/api";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import { useAuth } from "@/hooks/use-auth";
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

function MessageCluster({
  cluster,
  onImageLoad,
}: {
  cluster: {
    isMe: boolean;
    userId: string;
    username: string;
    avatarUrl: string | null;
    messages: GroupMessage[];
  };
  onImageLoad?: () => void;
}) {
  const isMe = cluster.isMe;

  return (
    <div className={`flex w-full ${isMe ? "justify-end" : "justify-start"} mt-2 first:mt-0`}>
      <div className={`flex gap-2 max-w-[80%] ${isMe ? "flex-row-reverse" : "flex-row"} items-stretch`}>
        {/* Avatar column — sticky bottom for Telegram effect */}
        <div className="w-8 shrink-0 flex flex-col justify-end">
          <div className="sticky bottom-0 pb-1 z-10">
            <Avatar className="size-8">
              <AvatarImage src={cluster.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-neutral-700 text-neutral-200 text-xs font-medium">
                {cluster.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>
        </div>

        {/* Messages column */}
        <div className={`flex flex-col flex-1 min-w-0 ${isMe ? "items-end" : "items-start"}`}>
          <span className={`text-[11px] font-medium mb-0.5 px-1 ${isMe ? "text-blue-400" : "text-blue-400/80"}`}>
            {cluster.username}
          </span>
          
          {cluster.messages.map((message, mIdx) => {
            const hasImage = !!message.imageUrl;

            return (
              <div
                key={message.id}
                className={`relative px-3 py-1.5 text-sm leading-snug ${
                  mIdx > 0 ? "mt-0.5" : ""
                } ${
                  isMe
                    ? "bg-[#2B5278] text-white rounded-2xl rounded-br-sm"
                    : "bg-[#182533] text-neutral-100 rounded-2xl rounded-bl-sm"
                } ${hasImage ? "p-1" : ""}`}
              >
                {hasImage && (
                  <img
                    src={message.imageUrl!}
                    alt=""
                    className="rounded-xl max-w-[280px] max-h-[280px] object-cover"
                    loading="lazy"
                    onLoad={onImageLoad}
                  />
                )}
                {message.content && (
                  <span className={hasImage ? "block mt-1 px-2 py-0.5" : ""}>{message.content}</span>
                )}

                <span className={`inline-block text-[10px] opacity-50 ml-2 translate-y-0.5 ${isMe ? "text-blue-100" : "text-neutral-400"}`}>
                  {formatMessageTime(message.createdAt)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ChatRoom({
  group,
  onBack,
  onLeftGroup,
}: {
  group: MyGroup;
  onBack: () => void;
  onLeftGroup: (groupId: string) => void;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const sentIds = useRef<Set<string>>(new Set());

  const handleLeaveGroup = async () => {
    if (leaving) return;
    const ok = window.confirm("Leave this group?");
    if (!ok) return;

    setLeaving(true);
    try {
      await leaveGroup(group.id);
      toast.success("You left the group.");
      onLeftGroup(group.id);
    } catch {
      toast.error("Failed to leave group.");
    } finally {
      setLeaving(false);
    }
  };

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

    let currentUserId: string | null = null;
    try {
      const payloadBase64 = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
      if (payloadBase64) {
        currentUserId = JSON.parse(atob(payloadBase64)).userId ?? null;
      }
    } catch {
      currentUserId = null;
    }

    const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";

    // Derive WS protocol from the API URL, not the page URL (Tauri uses tauri:// protocol)
    const wsProtocol = baseUrl.startsWith("https://") ? "wss:" : "ws:";

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
          // Ignore our own WS echo to avoid duplicate bubbles with optimistic UI
          if (currentUserId && data.userId === currentUserId) return;
          // Skip messages we already added via POST response
          if (sentIds.current.has(data.id)) return;
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

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const viewport = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]");
        if (viewport) {
          viewport.scrollTop = viewport.scrollHeight;
        }
      });
    });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    const content = inputValue.trim();
    const image = pendingImage;
    if ((!content && !image) || sending) return;

    setSending(true);
    setInputValue("");
    setPendingImage(null);
    inputRef.current?.focus();

    // Optimistic insert — add message immediately with a temp ID
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: tempId, groupId: group.id, userId: "me", username: "", avatarUrl: null, content: content || "", imageUrl: image, createdAt: new Date().toISOString(), isMe: true },
    ]);

    try {
      const res = await sendGroupMessage(group.id, content || "", image || undefined);
      sentIds.current.add(res.message.id);
      // Replace temp message with the real one from the server
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? res.message : m))
      );
    } catch {
      // Remove the optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
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

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      toast.error("Only PNG, JPEG, WebP, and GIF images are allowed.");
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error("Image must be under 1MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPendingImage(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  const groupedMessages = useMemo(() => {
    const dates: { date: string; clusters: { id: string; isMe: boolean; userId: string; username: string; avatarUrl: string | null; messages: GroupMessage[] }[] }[] = [];

    messages.forEach((msg) => {
      const date = new Date(msg.createdAt).toDateString();
      let currentDate = dates[dates.length - 1];
      if (!currentDate || currentDate.date !== date) {
        currentDate = { date, clusters: [] };
        dates.push(currentDate);
      }

      let currentCluster = currentDate.clusters[currentDate.clusters.length - 1];
      const isSameUser = currentCluster && currentCluster.userId === msg.userId;
      
      let isConsecutive = false;
      if (isSameUser) {
        const lastMsg = currentCluster.messages[currentCluster.messages.length - 1];
        if (new Date(msg.createdAt).getTime() - new Date(lastMsg.createdAt).getTime() < 60000) {
          isConsecutive = true;
        }
      }

      if (isConsecutive) {
        currentCluster.messages.push(msg);
      } else {
        currentDate.clusters.push({
          id: msg.id,
          isMe: msg.isMe,
          userId: msg.userId,
          username: msg.username,
          avatarUrl: msg.avatarUrl,
          messages: [msg],
        });
      }
    });
    return dates;
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
        {user?.role === "student" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-red-400 hover:text-red-300"
            onClick={handleLeaveGroup}
            disabled={leaving}
          >
            Leave
          </Button>
        )}
      </CardHeader>

      <CardContent className="relative flex-1 flex flex-col p-0 overflow-hidden">
        <ScrollArea className="flex-1 px-4 pt-3 pb-2" ref={scrollRef}>
          {loading ? (
            <div className="flex flex-col gap-1.5 p-4">
              {Array.from({ length: 8 }).map((_, i) => {
                const isMe = i % 3 === 2;
                const showAvatar = i === 2 || i === 5 || i === 7;
                return (
                  <div key={i} className={`flex ${isMe ? "justify-end" : "justify-start"} ${i > 0 && (i % 3 === 0) ? "mt-2" : "mt-0.5"}`}>
                    <div className={`flex gap-2 ${isMe ? "flex-row-reverse" : "flex-row"} items-end`}>
                      <div className="size-8 shrink-0">
                        {showAvatar ? (
                          <Skeleton className="size-8 rounded-full" />
                        ) : (
                          <div className="size-8" />
                        )}
                      </div>
                      <div className={`flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
                        {i % 3 === 0 && <Skeleton className="h-3 w-16 rounded" />}
                        <Skeleton className={`h-8 rounded-2xl ${isMe ? "rounded-br-sm" : "rounded-bl-sm"}`} style={{ width: `${120 + (i * 17) % 100}px` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <ChatCircle weight="duotone" className="size-12 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">{en.groups.chat.empty}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{en.groups.chat.emptySub}</p>
            </div>
          ) : (
            <div className="mx-auto flex w-full flex-col gap-1 px-1">
              {groupedMessages.map((group) => (
                <div key={group.date} className="flex flex-col first:[&]:mt-0 mt-4">
                  <div className="flex items-center justify-center mb-2">
                    <Badge
                      variant="outline"
                      className="text-[10px] border-neutral-800 bg-neutral-950"
                    >
                      {(() => {
                        const d = new Date(group.date)
                        const now = new Date()
                        const isToday = d.toDateString() === now.toDateString()
                        const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1)
                        const isYesterday = d.toDateString() === yesterday.toDateString()
                        if (isToday) return "Today"
                        if (isYesterday) return "Yesterday"
                        return d.toLocaleDateString([], { month: "long", day: "numeric" })
                      })()}
                    </Badge>
                  </div>
                  {group.clusters.map((cluster) => (
                    <MessageCluster
                      key={cluster.id}
                      cluster={cluster}
                      onImageLoad={scrollToBottom}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator className="bg-neutral-800" />

        <div className="z-10 shrink-0 border-t border-neutral-800 bg-neutral-900 px-3 py-3">
          {pendingImage && (
            <div className="relative mb-2 inline-block">
              <img src={pendingImage} alt="" className="h-20 rounded-lg object-cover" />
              <button
                onClick={() => setPendingImage(null)}
                className="absolute -top-1.5 -right-1.5 size-5 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center hover:bg-red-900 transition-colors"
              >
                <X weight="bold" className="size-3" />
              </button>
            </div>
          )}
          <div className="flex w-full items-center gap-2">
            <input
              ref={imageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleImageSelect}
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-11 w-11 rounded-full p-0 text-neutral-400 hover:text-white"
              onClick={() => imageInputRef.current?.click()}
              disabled={sending}
            >
              <ImageIcon weight="bold" className="size-5" />
            </Button>
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
              className={`h-11 w-11 rounded-full p-0 transition-all duration-200 ${(inputValue.trim() || pendingImage) ? "bg-blue-500 hover:bg-blue-600" : "bg-neutral-700"}`}
              disabled={(!inputValue.trim() && !pendingImage) || sending}
              onClick={handleSend}
            >
              <PaperPlaneRight weight="fill" className={`size-[18px] transition-transform duration-200 ${(inputValue.trim() || pendingImage) ? "translate-x-[1px] -translate-y-[1px]" : ""}`} />
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

  useEffect(() => {
    const el = document.querySelector('.overflow-auto') as HTMLElement | null;
    if (el) el.scrollTop = 0;
  }, [selectedGroup]);

  return (
    <AnimatePresence mode="wait">
      {selectedGroup ? (
        <motion.div
          key="chat"
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 40 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="h-full min-h-full"
        >
          <ChatRoom
            group={selectedGroup}
            onBack={() => setSelectedGroup(null)}
            onLeftGroup={(groupId) => {
              setGroups((prev) => prev.filter((g) => g.id !== groupId));
              setSelectedGroup(null);
            }}
          />
        </motion.div>
      ) : (
        <motion.div
          key="list"
          initial={{ opacity: 0, x: -40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.2, ease: "easeInOut" }}
          className="p-5 flex flex-col gap-4 font-body"
        >
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
