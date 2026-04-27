"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fetchLawyerInbox,
  fetchMatterMessages,
  fetchMe,
  fetchMyMatters,
  sendMatterMessage,
} from "../../../lib/auth";
import InboxConversationList from "./components/InboxConversationList";
import InboxConversationView from "./components/InboxConversationView";
import NewMessagePanel from "./components/NewMessagePanel";

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
  const [matters, setMatters] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxError, setInboxError] = useState("");
  const [mattersLoading, setMattersLoading] = useState(true);
  const [mattersError, setMattersError] = useState("");
  const [selectedMatterId, setSelectedMatterId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messagesError, setMessagesError] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [showNewMessage, setShowNewMessage] = useState(false);

  const selectedConversation = useMemo(
    () => items.find((item) => item.matter_id === selectedMatterId) || null,
    [items, selectedMatterId]
  );
  const hasSelectedConversation = Boolean(selectedConversation);
  const hasActiveRightPane = showNewMessage || hasSelectedConversation;

  async function reloadInbox() {
    const data = await fetchLawyerInbox();
    const nextItems = sortInboxItems(Array.isArray(data) ? data : []);
    setItems(nextItems);
    setInboxError("");
    return nextItems;
  }

  useEffect(() => {
    let cancelled = false;

    async function loadInbox() {
      if (!cancelled) {
        setInboxError("");
        setMattersError("");
        setInboxLoading(true);
        setMattersLoading(true);
      }

      try {
        const me = await fetchMe(true);
        if (cancelled) return;

        if (!me || me.role !== "lawyer") {
          router.push("/portal");
          return;
        }

        setCurrentUser(me);

        const [inboxResult, mattersResult] = await Promise.allSettled([
          fetchLawyerInbox(),
          fetchMyMatters(),
        ]);
        if (cancelled) return;

        if (inboxResult.status === "fulfilled") {
          setItems(
            sortInboxItems(Array.isArray(inboxResult.value) ? inboxResult.value : [])
          );
          setInboxError("");
        } else {
          setItems([]);
          setInboxError(getErrorMessage(inboxResult.reason, "Failed to load inbox."));
        }

        if (mattersResult.status === "fulfilled") {
          setMatters(Array.isArray(mattersResult.value) ? mattersResult.value : []);
          setMattersError("");
        } else {
          setMatters([]);
          setMattersError(
            getErrorMessage(mattersResult.reason, "Failed to load matters.")
          );
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setInboxError(getErrorMessage(e, "Failed to load inbox."));
          setMattersError(getErrorMessage(e, "Failed to load matters."));
        }
      } finally {
        if (!cancelled) {
          setInboxLoading(false);
          setMattersLoading(false);
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
    setShowNewMessage(false);
    setSelectedMatterId(item.matter_id);
    setNewMessage("");
    setMessagesError("");
  }

  function handleBackToConversations() {
    setShowNewMessage(false);
    setSelectedMatterId(null);
    setNewMessage("");
    setMessagesError("");
  }

  function handleStartNewMessage() {
    setShowNewMessage(true);
    setMessagesError("");
  }

  function handleCancelNewMessage() {
    setShowNewMessage(false);
  }

  function buildInboxItemFromMessage(matterId, message) {
    const matter = matters.find((m) => Number(m.id) === Number(matterId));
    if (!matter || !message) return null;

    return {
      matter_id: Number(matterId),
      matter_title: matter.title,
      matter_status: matter.status,
      client_id: matter.client_id,
      client_name: matter.client_name || null,
      latest_message_id: message.id,
      latest_message_body: message.body,
      latest_message_sender_id: message.sender_id,
      latest_message_sender_name: message.sender_name,
      latest_message_sender_role: message.sender_role,
      latest_message_created_at: message.created_at,
    };
  }

  async function handleNewMessageSent({ matterId, message }) {
    const nextItem = buildInboxItemFromMessage(matterId, message);
    if (nextItem) {
      setItems((prev) =>
        sortInboxItems([
          nextItem,
          ...prev.filter((item) => Number(item.matter_id) !== Number(matterId)),
        ])
      );
    }

    setShowNewMessage(false);
    setSelectedMatterId(matterId);
    setNewMessage("");
    setMessagesError("");

    try {
      await reloadInbox();
    } catch (e) {
      console.error(e);
      setInboxError(getErrorMessage(e, "Failed to refresh inbox."));
    }
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
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-14">
          <Link
            href="/portal/lawyer"
            className="text-sm text-blue-200 hover:text-white"
          >
            Back to dashboard
          </Link>
          <h1 className="mt-4 text-3xl font-semibold text-white">Inbox</h1>
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <p className="max-w-2xl text-sm leading-6 text-slate-300">
              Review and respond to secure matter conversations from one workspace.
            </p>
            <button
              type="button"
              onClick={handleStartNewMessage}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 sm:w-auto"
            >
              New Message
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div
            className={`lg:col-span-4 ${
              hasActiveRightPane ? "hidden lg:block" : "block"
            }`}
          >
            <InboxConversationList
              items={items}
              loading={inboxLoading}
              error={inboxError}
              selectedMatterId={selectedMatterId}
              onSelectConversation={handleSelectConversation}
            />
          </div>

          <div
            className={`lg:col-span-8 ${
              hasActiveRightPane ? "block" : "hidden lg:block"
            }`}
          >
            {showNewMessage ? (
              <NewMessagePanel
                matters={matters}
                mattersLoading={mattersLoading}
                mattersError={mattersError}
                onCancel={handleCancelNewMessage}
                onSent={handleNewMessageSent}
              />
            ) : (
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
                onBackToConversations={handleBackToConversations}
                onStartNewMessage={handleStartNewMessage}
              />
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
