"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchLawyerInbox,
  fetchMatterMessages,
  fetchMe,
  sendMatterMessage,
} from "../../../lib/auth";
import InboxConversationList from "./components/InboxConversationList";
import InboxConversationView from "./components/InboxConversationView";

function getErrorMessage(error, fallback) {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (typeof error?.message === "string" && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

function sortInboxItems(items) {
  return [...items].sort(
    (a, b) =>
      (b.latest_message_created_at || "").localeCompare(
        a.latest_message_created_at || ""
      )
  );
}

export default function LawyerInboxPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);
  const [items, setItems] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxError, setInboxError] = useState("");
  const [selectedMatterId, setSelectedMatterId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const selectedConversation = useMemo(
    () => items.find((item) => item.matter_id === selectedMatterId) || null,
    [items, selectedMatterId]
  );

  useEffect(() => {
    let cancelled = false;

    async function loadInbox() {
      if (!cancelled) {
        setInboxError("");
        setInboxLoading(true);
      }

      try {
        const me = await fetchMe(true);
        if (cancelled) return;

        if (!me || me.role !== "lawyer") {
          router.push("/portal");
          return;
        }

        setCurrentUser(me);
        const data = await fetchLawyerInbox();
        if (!cancelled) {
          setItems(sortInboxItems(Array.isArray(data) ? data : []));
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setInboxError(getErrorMessage(e, "Failed to load inbox."));
        }
      } finally {
        if (!cancelled) {
          setInboxLoading(false);
        }
      }
    }

    loadInbox();

    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!selectedMatterId) {
      setMessages([]);
      setMessagesError("");
      setMessagesLoading(false);
      return;
    }

    let cancelled = false;

    async function loadMessages() {
      if (!cancelled) {
        setMessagesError("");
        setMessagesLoading(true);
      }

      try {
        const data = await fetchMatterMessages(selectedMatterId);
        if (!cancelled) {
          setMessages(Array.isArray(data) ? data : []);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setMessages([]);
          setMessagesError(getErrorMessage(e, "Failed to load messages."));
        }
      } finally {
        if (!cancelled) {
          setMessagesLoading(false);
        }
      }
    }

    loadMessages();

    return () => {
      cancelled = true;
    };
  }, [selectedMatterId]);

  function handleSelectConversation(item) {
    setSelectedMatterId(item.matter_id);
    setNewMessage("");
    setMessagesError("");
  }

  async function handleSendMessage(e) {
    e.preventDefault();
    if (sendingMessage || !selectedMatterId) return;

    const trimmed = newMessage.trim();
    if (!trimmed) return;

    setSendingMessage(true);
    setMessagesError("");

    try {
      const created = await sendMatterMessage(selectedMatterId, trimmed);
      setMessages((prev) => [...prev, created]);
      setNewMessage("");
      setItems((prev) =>
        sortInboxItems(
          prev.map((item) =>
            item.matter_id === selectedMatterId
              ? {
                  ...item,
                  latest_message_id: created.id,
                  latest_message_body: created.body,
                  latest_message_sender_id: created.sender_id,
                  latest_message_sender_name: created.sender_name,
                  latest_message_sender_role: created.sender_role,
                  latest_message_created_at: created.created_at,
                }
              : item
          )
        )
      );
    } catch (e) {
      console.error(e);
      setMessagesError(getErrorMessage(e, "Failed to send message."));
    } finally {
      setSendingMessage(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <section className="bg-slate-950">
        <div className="mx-auto max-w-7xl px-6 py-14">
          <Link
            href="/portal/lawyer"
            className="text-sm text-blue-200 hover:text-white"
          >
            Back to dashboard
          </Link>
          <h1 className="mt-4 text-3xl font-semibold text-white">Inbox</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
            Review and respond to secure matter conversations from one workspace.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <InboxConversationList
              items={items}
              loading={inboxLoading}
              error={inboxError}
              selectedMatterId={selectedMatterId}
              onSelectConversation={handleSelectConversation}
            />
          </div>

          <div className="lg:col-span-8">
            <InboxConversationView
              conversation={selectedConversation}
              messages={messages}
              messagesLoading={messagesLoading}
              messagesError={messagesError}
              currentUser={currentUser}
              newMessage={newMessage}
              onMessageChange={setNewMessage}
              onSendMessage={handleSendMessage}
              sendingMessage={sendingMessage}
            />
          </div>
        </div>
      </section>
    </main>
  );
}
