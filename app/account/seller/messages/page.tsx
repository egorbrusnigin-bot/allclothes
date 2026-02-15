"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "../../../lib/supabase";
import { useIsMobile } from "../../../lib/useIsMobile";

interface Conversation {
  id: string;
  buyer_id: string;
  brand_id: string;
  order_id: string | null;
  subject: string;
  last_message_at: string;
  brand: { id: string; name: string; slug: string; logo_url: string | null } | null;
  orderNumber: string | null;
  buyerEmail: string;
  lastMessage: { text: string; sender_id: string; created_at: string } | null;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string;
  created_at: string;
  isDeleted: boolean;
  reactions: { id: string; emoji: string; user_id: string }[];
}

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

export default function SellerMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userId, setUserId] = useState("");
  const [contextMenu, setContextMenu] = useState<{ msgId: string; x: number; y: number } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval>>();
  const isMobile = useIsMobile();

  useEffect(() => {
    loadUser();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (userId) loadConversations();
  }, [userId]);

  useEffect(() => {
    if (selectedConv) {
      loadMessages(selectedConv.id);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => loadMessages(selectedConv.id), 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedConv?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadUser() {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) setUserId(session.user.id);
  }

  async function getToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token || "";
  }

  async function loadConversations() {
    try {
      const token = await getToken();
      const res = await fetch("/api/messages/conversations", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      // Filter only conversations for seller's brands
      setConversations(data.conversations || []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function loadMessages(convId: string) {
    try {
      const token = await getToken();
      const res = await fetch(`/api/messages/${convId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setMessages(data.messages || []);
    } catch { /* ignore */ }
  }

  async function sendMessage() {
    if (!newMessage.trim() || !selectedConv || sending) return;
    setSending(true);
    try {
      const token = await getToken();
      await fetch(`/api/messages/${selectedConv.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text: newMessage.trim() }),
      });
      setNewMessage("");
      await loadMessages(selectedConv.id);
      await loadConversations();
    } catch { /* ignore */ }
    setSending(false);
  }

  async function deleteMessage(msgId: string) {
    if (!selectedConv) return;
    try {
      const token = await getToken();
      await fetch(`/api/messages/${selectedConv.id}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageId: msgId }),
      });
      await loadMessages(selectedConv.id);
    } catch { /* ignore */ }
    setContextMenu(null);
  }

  async function toggleReaction(msgId: string, emoji: string) {
    if (!selectedConv) return;
    try {
      const token = await getToken();
      await fetch(`/api/messages/${selectedConv.id}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messageId: msgId, emoji }),
      });
      await loadMessages(selectedConv.id);
    } catch { /* ignore */ }
  }

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return "сейчас";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}м`;
    if (diff < 86400000) return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
    return d.toLocaleDateString("ru", { day: "numeric", month: "short" });
  }

  function handleContextMenu(e: React.MouseEvent, msgId: string) {
    e.preventDefault();
    setContextMenu({ msgId, x: e.clientX, y: e.clientY });
  }

  function groupReactions(reactions: { emoji: string; user_id: string }[]) {
    const map: Record<string, { count: number; hasOwn: boolean }> = {};
    reactions.forEach((r) => {
      if (!map[r.emoji]) map[r.emoji] = { count: 0, hasOwn: false };
      map[r.emoji].count++;
      if (r.user_id === userId) map[r.emoji].hasOwn = true;
    });
    return map;
  }

  const showChatList = isMobile && !selectedConv;
  const showChatView = !isMobile || selectedConv;

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#999", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
        Загрузка...
      </div>
    );
  }

  return (
    <div
      style={{ display: "flex", height: isMobile ? "calc(100vh - 120px)" : "calc(100vh - 200px)", minHeight: 400 }}
      onClick={() => setContextMenu(null)}
    >
      {/* Conversation list */}
      {(showChatList || !isMobile) && (
        <div style={{
          width: isMobile ? "100%" : 320,
          borderRight: isMobile ? "none" : "1px solid #e6e6e6",
          overflowY: "auto",
          flexShrink: 0,
        }}>
          <div style={{
            padding: "16px 20px",
            borderBottom: "1px solid #e6e6e6",
            fontSize: 11,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: 1,
          }}>
            Чаты с покупателями
          </div>

          {conversations.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#999", fontSize: 11 }}>
              Нет сообщений от покупателей
            </div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setSelectedConv(conv)}
                style={{
                  padding: "14px 20px",
                  borderBottom: "1px solid #f0f0f0",
                  cursor: "pointer",
                  background: selectedConv?.id === conv.id ? "#f5f5f5" : "transparent",
                  display: "flex",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", background: "#e6e6e6",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 700, flexShrink: 0, color: "#666",
                }}>
                  {(conv.buyerEmail || "?").charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>
                      {conv.buyerEmail || "Покупатель"}
                    </span>
                    <span style={{ fontSize: 10, color: "#999" }}>
                      {conv.lastMessage ? formatTime(conv.lastMessage.created_at) : ""}
                    </span>
                  </div>
                  {conv.orderNumber && (
                    <div style={{ fontSize: 10, color: "#666", marginBottom: 2 }}>
                      Заказ #{conv.orderNumber}
                    </div>
                  )}
                  {conv.brand && (
                    <div style={{ fontSize: 10, color: "#999", marginBottom: 2 }}>
                      {conv.brand.name}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: "#666", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {conv.lastMessage?.text || "Нет сообщений"}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Chat view */}
      {showChatView && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
          {selectedConv ? (
            <>
              <div style={{
                padding: "14px 20px",
                borderBottom: "1px solid #e6e6e6",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}>
                {isMobile && (
                  <button
                    onClick={() => setSelectedConv(null)}
                    style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", padding: 0, marginRight: 4 }}
                  >
                    ←
                  </button>
                )}
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", background: "#e6e6e6",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#666",
                }}>
                  {(selectedConv.buyerEmail || "?").charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.3 }}>
                    {selectedConv.buyerEmail || "Покупатель"}
                  </div>
                  {selectedConv.orderNumber && (
                    <div style={{ fontSize: 10, color: "#666" }}>Заказ #{selectedConv.orderNumber}</div>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", color: "#ccc", fontSize: 11, paddingTop: 40, textTransform: "uppercase", letterSpacing: 1 }}>
                    Нет сообщений
                  </div>
                )}
                {messages.map((msg) => {
                  const isMine = msg.sender_id === userId;
                  const grouped = groupReactions(msg.reactions);

                  return (
                    <div
                      key={msg.id}
                      style={{ display: "flex", justifyContent: isMine ? "flex-end" : "flex-start" }}
                      onContextMenu={(e) => !msg.isDeleted && handleContextMenu(e, msg.id)}
                    >
                      <div style={{ maxWidth: "75%", position: "relative" }}>
                        <div style={{
                          padding: "10px 14px",
                          borderRadius: 16,
                          borderBottomRightRadius: isMine ? 4 : 16,
                          borderBottomLeftRadius: isMine ? 16 : 4,
                          background: msg.isDeleted ? "transparent" : isMine ? "#000" : "#fff",
                          color: msg.isDeleted ? "#999" : isMine ? "#fff" : "#000",
                          border: msg.isDeleted ? "1px dashed #ddd" : isMine ? "none" : "1px solid #e6e6e6",
                          fontSize: 13,
                          fontStyle: msg.isDeleted ? "italic" : "normal",
                          lineHeight: 1.4,
                          wordBreak: "break-word",
                        }}>
                          {msg.isDeleted ? "Сообщение удалено" : msg.text}
                        </div>

                        {Object.keys(grouped).length > 0 && (
                          <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap", justifyContent: isMine ? "flex-end" : "flex-start" }}>
                            {Object.entries(grouped).map(([emoji, data]) => (
                              <button
                                key={emoji}
                                onClick={(e) => { e.stopPropagation(); toggleReaction(msg.id, emoji); }}
                                style={{
                                  display: "flex", alignItems: "center", gap: 2,
                                  padding: "2px 6px", borderRadius: 10,
                                  border: data.hasOwn ? "1px solid #000" : "1px solid #e6e6e6",
                                  background: data.hasOwn ? "#f0f0f0" : "#fff",
                                  fontSize: 12, cursor: "pointer",
                                }}
                              >
                                {emoji} <span style={{ fontSize: 10, color: "#666" }}>{data.count}</span>
                              </button>
                            ))}
                          </div>
                        )}

                        <div style={{ fontSize: 9, color: "#bbb", marginTop: 2, textAlign: isMine ? "right" : "left" }}>
                          {formatTime(msg.created_at)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{ padding: "12px 20px", borderTop: "1px solid #e6e6e6", display: "flex", gap: 8 }}>
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendMessage()}
                  placeholder="Ответить покупателю..."
                  style={{ flex: 1, padding: "10px 14px", border: "1px solid #e6e6e6", borderRadius: 8, fontSize: 13, outline: "none" }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!newMessage.trim() || sending}
                  style={{
                    padding: "10px 20px", background: "#000", color: "#fff",
                    border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700,
                    cursor: !newMessage.trim() || sending ? "not-allowed" : "pointer",
                    opacity: !newMessage.trim() || sending ? 0.5 : 1,
                  }}
                >
                  →
                </button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 }}>
              Выберите чат
            </div>
          )}
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          style={{
            position: "fixed", left: contextMenu.x, top: contextMenu.y,
            background: "#fff", border: "1px solid #e6e6e6", borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)", zIndex: 1000, overflow: "hidden", minWidth: 160,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{ display: "flex", gap: 4, padding: "8px 12px", borderBottom: "1px solid #f0f0f0" }}>
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => { toggleReaction(contextMenu.msgId, emoji); setContextMenu(null); }}
                style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", padding: "4px", borderRadius: 4 }}
              >
                {emoji}
              </button>
            ))}
          </div>
          <button
            onClick={() => deleteMessage(contextMenu.msgId)}
            style={{ display: "block", width: "100%", padding: "10px 16px", background: "none", border: "none", fontSize: 12, cursor: "pointer", textAlign: "left", color: "#ef4444" }}
          >
            Удалить сообщение
          </button>
        </div>
      )}
    </div>
  );
}
