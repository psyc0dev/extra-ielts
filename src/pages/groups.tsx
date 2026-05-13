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
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  Users,
  ArrowLeft,
  PaperPlaneRight,
  ChatCircle,
  User,
  Image as ImageIcon,
  Check,
  Checks,
  ArrowBendUpLeft,
  CopySimple,
  LinkSimple,
  X,
} from "@phosphor-icons/react";
import {
  listMyGroups,
  listGroupMessages,
  markGroupMessageSeen,
  sendGroupMessage,
  leaveGroup,
  getWsToken,
  type MyGroup,
  type GroupMessage,
} from "@/lib/api";
import { useDelayedLoading } from "@/hooks/use-delayed-loading";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
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

function renderMessageContent(content: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/gi;
  const parts = content.split(urlRegex);

  return parts.map((part, idx) => {
    const isUrl = /^https?:\/\/[^\s]+$/i.test(part);
    if (!isUrl) return <span key={idx}>{part}</span>;

    // Only allow http/https URLs to prevent javascript: XSS
    let safeHref: string;
    try {
      const parsed = new URL(part);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return <span key={idx}>{part}</span>;
      }
      safeHref = parsed.href;
    } catch {
      return <span key={idx}>{part}</span>;
    }

    return (
      <a
        key={idx}
        href={safeHref}
        target="_blank"
        rel="noopener noreferrer"
        data-message-link="true"
        className="underline underline-offset-2 break-all hover:opacity-90"
      >
        {part}
      </a>
    );
  });
}

function MessageCluster({
  cluster,
  currentUserId,
  highlightedMsgId,
  onImageLoad,
  onReply,
  onJumpToMessage,
  onCopyText,
  onCopyLink,
}: {
  cluster: {
    isMe: boolean;
    userId: string;
    username: string;
    avatarUrl: string | null;
    messages: GroupMessage[];
  };
  currentUserId: string | null;
  highlightedMsgId: string | null;
  onImageLoad?: () => void;
  onReply: (message: GroupMessage) => void;
  onJumpToMessage: (messageId: string) => void;
  onCopyText: (message: GroupMessage) => void;
  onCopyLink: (link: string) => void;
}) {
  const isMe = cluster.isMe;
  const [contextLink, setContextLink] = useState<string | null>(null);

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
          <div className="sticky top-0 z-10 pb-0.5">
            <span className={`text-[11px] font-medium px-1 ${isMe ? "text-blue-400" : "text-blue-400/80"} bg-neutral-900/90 backdrop-blur-sm rounded`}>
              {cluster.username}
            </span>
          </div>
          
          {cluster.messages.map((message, mIdx) => {
            const hasImage = !!message.imageUrl;
            const msgIsMe = message.isMe;
            const seenByOthers = message.seenBy.filter((s) => s.userId !== currentUserId);
            const isSeenByOthers = seenByOthers.length > 0;

            return (
              <ContextMenu key={message.id} onOpenChange={(open) => { if (!open) setContextLink(null); }}>
                <ContextMenuTrigger asChild>
                  <div
                    id={`msg-${message.id}`}
                    onContextMenu={(e) => {
                      const anchor = (e.target as HTMLElement).closest('a[data-message-link="true"]') as HTMLAnchorElement | null;
                      setContextLink(anchor?.href ?? null);
                    }}
                    className={`relative text-sm leading-snug ${
                      mIdx > 0 ? "mt-0.5" : ""
                    } ${
                      isMe
                        ? "bg-[#2B5278] text-white rounded-2xl rounded-br-sm"
                        : "bg-[#182533] text-neutral-100 rounded-2xl rounded-bl-sm"
                    } ${hasImage ? "p-1" : "px-3 py-1.5"}`}
                    style={highlightedMsgId === message.id ? {
                      boxShadow: "0 0 0 2px rgba(96,165,250,0.92), 0 0 20px rgba(96,165,250,0.35)",
                      filter: "brightness(1.08)",
                      transform: "scale(1.01)",
                      transition: "box-shadow 180ms ease, transform 180ms ease, filter 180ms ease",
                    } : undefined}
                  >
                    {message.replyTo && (
                      <button
                        type="button"
                        onClick={() => onJumpToMessage(message.replyTo!.id)}
                        className={`mb-1 w-full text-left rounded-lg border-l-2 px-2 py-1 text-xs cursor-pointer transition-opacity hover:opacity-90 ${isMe ? "border-blue-200/80 bg-white/10" : "border-blue-400/80 bg-black/20"}`}
                      >
                        <div className="font-medium opacity-90">{message.replyTo.username}</div>
                        <div className="opacity-80 truncate">
                          {message.replyTo.content || (message.replyTo.imageUrl ? en.groups.chat.replyPhoto : en.groups.chat.replyMessage)}
                        </div>
                      </button>
                    )}
                    

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
                      <span className={`${hasImage ? "block mt-1 px-2 py-0.5" : ""} pr-[4.5rem]`}>{renderMessageContent(message.content)}</span>
                    )}

                    <span className="absolute bottom-1 right-2 inline-flex items-center gap-0.5 text-[10px] opacity-50 select-none">
                      <span className={isMe ? "text-blue-100" : "text-neutral-400"}>
                        {formatMessageTime(message.createdAt)}
                      </span>
                      {msgIsMe && (
                        <span
                          className="inline-flex items-center align-middle"
                          title={isSeenByOthers ? `Seen by ${seenByOthers.map((s) => s.username).join(", ")}` : "Sent"}
                        >
                          {isSeenByOthers ? (
                            <Checks weight="bold" className="size-3 text-blue-100" />
                          ) : (
                            <Check weight="bold" className="size-3 text-blue-100/70" />
                          )}
                        </span>
                      )}
                    </span>
                  </div>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-44">
                  <ContextMenuItem onSelect={() => onReply(message)}>
                    <ArrowBendUpLeft className="mr-2 size-4" />
                    {en.groups.chat.contextMenu.reply}
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={!message.content.trim()}
                    onSelect={() => onCopyText(message)}
                  >
                    <CopySimple className="mr-2 size-4" />
                    {en.groups.chat.contextMenu.copyText}
                  </ContextMenuItem>
                  {contextLink && (
                    <ContextMenuItem onSelect={() => onCopyLink(contextLink)}>
                      <LinkSimple className="mr-2 size-4" />
                      {en.groups.chat.contextMenu.copyLink}
                    </ContextMenuItem>
                  )}
                </ContextMenuContent>
              </ContextMenu>
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
  const [replyingTo, setReplyingTo] = useState<GroupMessage | null>(null);
  const [highlightedMsgId, setHighlightedMsgId] = useState<string | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<Map<string, string>>(new Map());
  const [typingUsers, setTypingUsers] = useState<Map<string, { username: string; timer: ReturnType<typeof setTimeout> }>>(new Map());
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const sentIds = useRef<Set<string>>(new Set());
  const seenSentIds = useRef<Set<string>>(new Set());
  const wsRef = useRef<WebSocket | null>(null);
  const presenceWsRef = useRef<WebSocket | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const onlineMembersCount = useMemo(() => {
    if (!group.memberIds?.length) return 0;
    let count = 0;
    for (const memberId of group.memberIds) {
      if (onlineUsers.has(memberId)) count += 1;
    }
    return count;
  }, [group.memberIds, onlineUsers]);

  const handleLeaveGroup = async () => {
    if (leaving) return;
    const ok = window.confirm(en.groups.chat.leaveConfirm);
    if (!ok) return;

    setLeaving(true);
    try {
      await leaveGroup(group.id);
      toast.success(en.groups.chat.leftGroup);
      onLeftGroup(group.id);
    } catch {
      toast.error(en.groups.chat.leaveFailed);
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

    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const initWs = async () => {
      let token: string;
      try {
        token = await getWsToken();
      } catch {
        if (!cancelled) reconnectTimer = setTimeout(initWs, 5000);
        return;
      }
      if (cancelled) return;

      let currentUserId: string | null = null;
      try {
        const payloadBase64 = token.split(".")[1]?.replace(/-/g, "+").replace(/_/g, "/");
        if (payloadBase64) {
          currentUserId = JSON.parse(atob(payloadBase64)).userId ?? null;
          currentUserIdRef.current = currentUserId;
        }
      } catch {
        currentUserId = null;
        currentUserIdRef.current = null;
      }

      const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
      const wsProtocol = baseUrl.startsWith("https://") ? "wss:" : "ws:";

      let wsUrl: string;
      if (baseUrl.startsWith("/")) {
        wsUrl = `${wsProtocol}//${window.location.host}${baseUrl}/groups/${group.id}/ws?token=${token}`;
      } else {
        const wsHost = baseUrl.replace(/^https?:\/\//, "");
        wsUrl = `${wsProtocol}//${wsHost}/groups/${group.id}/ws?token=${token}`;
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'typing') {
            if (data.userId !== currentUserId) {
              const uid = data.userId as string;
              const uname = data.username as string;
              setTypingUsers((prev) => {
                const m = new Map(prev);
                const existing = m.get(uid);
                if (existing) clearTimeout(existing.timer);
                const timer = setTimeout(() => {
                  setTypingUsers((p) => { const n = new Map(p); n.delete(uid); return n; });
                }, 4000);
                m.set(uid, { username: uname, timer });
                return m;
              });
            }
            return;
          }

          if (data.type === 'typing_stop') {
            setTypingUsers((prev) => {
              const m = new Map(prev);
              const t = m.get(data.userId as string);
              if (t) { clearTimeout(t.timer); m.delete(data.userId as string); }
              return m;
            });
            return;
          }

          if (data.type === 'message') {
            // Ignore our own WS echo to avoid duplicate bubbles with optimistic UI
            if (currentUserId && data.userId === currentUserId) return;
            // Skip messages we already added via POST response
            if (sentIds.current.has(data.id)) return;
            const nextMessage = {
              ...(data as GroupMessage),
              replyTo: (data as GroupMessage).replyTo ?? null,
              seenBy: Array.isArray((data as GroupMessage).seenBy) ? (data as GroupMessage).seenBy : [],
            };
            setMessages((prev) => {
              if (prev.some(m => m.id === data.id)) return prev;
              return [...prev, nextMessage];
            });
            // Clear typing for the user who just sent a message
            setTypingUsers((prev) => {
              const m = new Map(prev);
              const t = m.get(data.userId as string);
              if (t) { clearTimeout(t.timer); m.delete(data.userId as string); }
              return m;
            });
            return;
          }

          if (data.type === 'message_seen') {
            const messageId = data.messageId as string;
            const userId = data.userId as string;
            const username = data.username as string;
            const seenAt = data.seenAt as string;
            setMessages((prev) => prev.map((m) => {
              if (m.id !== messageId) return m;
              if (m.seenBy.some((s) => s.userId === userId)) return m;
              return {
                ...m,
                seenBy: [...m.seenBy, { userId, username, seenAt }],
              };
            }));
            return;
          }
        } catch (err) {
          console.error("WebSocket message error", err);
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        // Reconnect after 3 seconds (get fresh token)
        if (!cancelled) reconnectTimer = setTimeout(initWs, 3000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    initWs();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      setTypingUsers((prev) => {
        for (const t of prev.values()) clearTimeout(t.timer);
        return new Map();
      });
    };
  }, [group.id]);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const initPresenceWs = async () => {
      let token: string;
      try {
        token = await getWsToken();
      } catch {
        if (!cancelled) reconnectTimer = setTimeout(initPresenceWs, 5000);
        return;
      }
      if (cancelled) return;

      const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
      const wsProtocol = baseUrl.startsWith("https://") ? "wss:" : "ws:";

      let wsUrl: string;
      if (baseUrl.startsWith("/")) {
        wsUrl = `${wsProtocol}//${window.location.host}${baseUrl}/presence/ws?token=${token}`;
      } else {
        const wsHost = baseUrl.replace(/^https?:\/\//, "");
        wsUrl = `${wsProtocol}//${wsHost}/presence/ws?token=${token}`;
      }

      const ws = new WebSocket(wsUrl);
      presenceWsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === 'online_list') {
            const map = new Map<string, string>();
            for (const u of (data.users as { userId: string; username: string }[])) {
              map.set(u.userId, u.username);
            }
            setOnlineUsers(map);
            return;
          }

          if (data.type === 'user_online') {
            setOnlineUsers((prev) => {
              const m = new Map(prev);
              m.set(data.userId as string, data.username as string);
              return m;
            });
            return;
          }

          if (data.type === 'user_offline') {
            setOnlineUsers((prev) => {
              const m = new Map(prev);
              m.delete(data.userId as string);
              return m;
            });
            return;
          }
        } catch (err) {
          console.error("Presence WebSocket message error", err);
        }
      };

      ws.onclose = () => {
        if (!cancelled) reconnectTimer = setTimeout(initPresenceWs, 1500);
      };
    };

    initPresenceWs();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      presenceWsRef.current?.close();
      setOnlineUsers(new Map());
    };
  }, []);

  // Clean up timeouts on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    };
  }, []);

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

  useEffect(() => {
    if (loading) return;
    const currentUserId = currentUserIdRef.current;
    if (!currentUserId) return;

    const unseenIncoming = messages.filter((m) =>
      m.userId !== currentUserId
      && !m.seenBy.some((s) => s.userId === currentUserId)
      && !seenSentIds.current.has(m.id),
    );

    if (unseenIncoming.length === 0) return;

    unseenIncoming.forEach((m) => {
      seenSentIds.current.add(m.id);
      markGroupMessageSeen(group.id, m.id)
        .catch(() => {
          seenSentIds.current.delete(m.id);
        });
    });
  }, [group.id, loading, messages]);

  const sendTypingEvent = () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'typing' }));
    }
  };

  const sendTypingStopEvent = () => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'typing_stop' }));
    }
  };

  const handleInputChange = (value: string) => {
    setInputValue(value);
    if (value.trim()) {
      sendTypingEvent();
      // Auto-stop typing after 3s of no input
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        sendTypingStopEvent();
      }, 3000);
    } else {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      sendTypingStopEvent();
    }
  };

  const handleSend = async () => {
    const content = inputValue.trim();
    const image = pendingImage;
    const replyTarget = replyingTo;
    if ((!content && !image) || sending) return;

    setSending(true);
    setInputValue("");
    setPendingImage(null);
    setReplyingTo(null);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    sendTypingStopEvent();
    inputRef.current?.focus();

    // Optimistic insert — add message immediately with a temp ID
    const tempId = `temp-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        groupId: group.id,
        userId: "me",
        username: user?.username ?? "",
        avatarUrl: user?.avatarUrl ?? null,
        content: content || "",
        imageUrl: image,
        replyTo: replyTarget
          ? {
            id: replyTarget.id,
            userId: replyTarget.userId,
            username: replyTarget.username,
            content: replyTarget.content,
            imageUrl: replyTarget.imageUrl,
          }
          : null,
        seenBy: [],
        createdAt: new Date().toISOString(),
        isMe: true,
      },
    ]);

    try {
      const res = await sendGroupMessage(group.id, content || "", image || undefined, replyTarget?.id);
      sentIds.current.add(res.message.id);
      // Replace temp message with the real one from the server
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? res.message : m))
      );
    } catch {
      // Remove the optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setReplyingTo(replyTarget);
      toast.error(en.groups.chat.sendError);
    } finally {
      setSending(false);
    }
  };

  const handleReply = (message: GroupMessage) => {
    setReplyingTo(message);
    inputRef.current?.focus();
  };

  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleJumpToMessage = (messageId: string) => {
    const target = document.getElementById(`msg-${messageId}`);
    if (!target) return;

    const viewport = scrollRef.current?.querySelector("[data-radix-scroll-area-viewport]") as HTMLElement | null;
    if (viewport) {
      const viewportRect = viewport.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const targetTopInViewport = targetRect.top - viewportRect.top + viewport.scrollTop;
      const centeredTop = Math.max(0, targetTopInViewport - (viewport.clientHeight / 2) + (targetRect.height / 2));
      viewport.scrollTo({ top: centeredTop, behavior: "smooth" });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    setHighlightedMsgId(messageId);
    if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMsgId(null);
    }, 1100);
  };

  const handleCopyText = async (message: GroupMessage) => {
    if (!message.content.trim()) return;
    try {
      await navigator.clipboard.writeText(message.content);
      toast.success(en.groups.chat.copied);
    } catch {
      toast.error(en.groups.chat.copyFailed);
    }
  };

  const handleCopyLink = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success(en.groups.chat.linkCopied);
    } catch {
      toast.error(en.groups.chat.linkCopyFailed);
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
      toast.error(en.groups.chat.imageInvalidType);
      return;
    }
    if (file.size > 1 * 1024 * 1024) {
      toast.error(en.groups.chat.imageTooLarge);
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
          {typingUsers.size > 0 ? (
            <div className="flex items-center gap-1 text-xs text-blue-400/80 truncate">
              {(() => {
                const names = Array.from(typingUsers.values()).map((u) => u.username);
                const shown = names.length <= 3
                  ? names.join(', ')
                  : `${names.slice(0, 3).join(', ')} and ${names.length - 3} more`;
                return `${shown}${names.length === 1 ? ' is' : ' are'} typing`;
              })()}
              <span className="inline-flex items-center gap-[3px] ml-0.5">
                <span className="size-1 rounded-full bg-blue-400/80" style={{ animation: 'typing-dot 1.4s ease-in-out infinite', animationDelay: '0ms' }} />
                <span className="size-1 rounded-full bg-blue-400/80" style={{ animation: 'typing-dot 1.4s ease-in-out infinite', animationDelay: '200ms' }} />
                <span className="size-1 rounded-full bg-blue-400/80" style={{ animation: 'typing-dot 1.4s ease-in-out infinite', animationDelay: '400ms' }} />
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground truncate">
              <span className="flex items-center gap-1 shrink-0">
                <Users weight="bold" className="size-3" />
                {en.groups.chat.memberCount(group.memberCount)}
              </span>
              {onlineMembersCount > 0 && (
                <span className="flex items-center gap-1 shrink-0">
                  <span className="size-1.5 rounded-full bg-green-500" />
                  {en.groups.chat.onlineCount(onlineMembersCount)}
                </span>
              )}
            </div>
          )}
        </div>
        {user?.role === "student" && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-red-400 hover:text-red-300"
            onClick={handleLeaveGroup}
            disabled={leaving}
          >
            {en.groups.chat.leaveGroup}
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
                  {group.clusters.map((cluster) => (
                    <MessageCluster
                      key={cluster.id}
                      cluster={cluster}
                      currentUserId={currentUserIdRef.current}
                      highlightedMsgId={highlightedMsgId}
                      onImageLoad={scrollToBottom}
                      onReply={handleReply}
                      onJumpToMessage={handleJumpToMessage}
                      onCopyText={handleCopyText}
                      onCopyLink={handleCopyLink}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator className="bg-neutral-800" />

        <div className="z-10 shrink-0 border-t border-neutral-800 bg-neutral-900 px-3 py-3">
          {replyingTo && (
            <div className="mb-2 rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-blue-400">{en.groups.chat.replyingTo(replyingTo.username)}</div>
                  <button
                    type="button"
                    onClick={() => handleJumpToMessage(replyingTo.id)}
                    className="truncate text-left text-muted-foreground transition-opacity hover:opacity-90"
                  >
                    {replyingTo.content || (replyingTo.imageUrl ? en.groups.chat.replyPhoto : en.groups.chat.replyMessage)}
                  </button>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="rounded p-0.5 text-muted-foreground hover:text-white"
                >
                  <X weight="bold" className="size-3" />
                </button>
              </div>
            </div>
          )}
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
            <div className="flex-1 min-w-0">
              <Input
                ref={inputRef}
                value={inputValue}
                onChange={(e) => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={en.groups.chat.inputPlaceholder}
                disabled={sending}
                className="h-11 w-full rounded-full border-neutral-800 bg-neutral-950 px-4 text-sm"
              />
            </div>
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
