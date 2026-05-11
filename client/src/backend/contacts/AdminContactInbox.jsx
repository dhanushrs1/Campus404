import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Clipboard,
  Copy,
  Globe2,
  Inbox,
  Loader2,
  Mail,
  MonitorSmartphone,
  RefreshCw,
  Reply,
  Search,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  fetchAdminContactMessages,
  updateAdminContactMessage,
} from "../../shared/contactApi.js";
import "./AdminContactInbox.css";

const SESSION_EXPIRED_STATUS = 401;

function normalizeMessage(item) {
  return {
    id: Number(item?.id) || 0,
    name: String(item?.name || "").trim() || "Unknown sender",
    email: String(item?.email || "").trim(),
    subject: String(item?.subject || "").trim() || "No subject",
    message: String(item?.message || "").trim(),
    status: String(item?.status || "unread").trim().toLowerCase(),
    consent_accepted: item?.consent_accepted !== false,
    ip_address: String(item?.ip_address || "").trim(),
    user_agent: String(item?.user_agent || "").trim(),
    created_at: item?.created_at || new Date().toISOString(),
    updated_at: item?.updated_at || item?.created_at || new Date().toISOString(),
  };
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildMessageCopy(message) {
  return [
    `Name: ${message.name}`,
    `Email: ${message.email}`,
    `Subject: ${message.subject}`,
    "",
    message.message,
  ].join("\n");
}

function buildReplyUrl(message) {
  const firstName = message.name.split(/\s+/)[0] || "there";
  const subject = `Re: ${message.subject}`;
  const body = [
    `Hi ${firstName},`,
    "",
    "",
    "",
    "Original message:",
    message.message,
  ].join("\n");

  return `mailto:${message.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function AdminContactInbox({ onSessionExpired, onUnreadCountChange }) {
  const [messages, setMessages] = useState([]);
  const [openMessage, setOpenMessage] = useState(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [total, setTotal] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const hasUnread = useMemo(
    () => messages.some((message) => message.status === "unread"),
    [messages],
  );

  const loadMessages = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setRefreshing(true);
      setError("");

      const data = await fetchAdminContactMessages({
        search,
        limit: 75,
      });

      const nextMessages = Array.isArray(data?.items)
        ? data.items.map(normalizeMessage)
        : [];
      const nextUnreadTotal = Number(data?.unread_total) || 0;

      setMessages(nextMessages);
      setTotal(Number(data?.total) || nextMessages.length);
      setUnreadTotal(nextUnreadTotal);
      onUnreadCountChange?.(nextUnreadTotal);
    } catch (err) {
      if (err?.status === SESSION_EXPIRED_STATUS) {
        onSessionExpired?.();
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load contact messages.");
      setMessages([]);
      setTotal(0);
      setUnreadTotal(0);
      onUnreadCountChange?.(0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onSessionExpired, onUnreadCountChange, search]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadMessages();
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [loadMessages]);

  const showNotice = (message) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const handleCopy = async (text, label) => {
    try {
      await copyToClipboard(text);
      showNotice(`${label} copied.`);
    } catch {
      showNotice("Copy failed. Please select and copy manually.");
    }
  };

  const applyUpdatedMessage = (updatedMessage, previousStatus) => {
    setMessages((current) => current.map((item) => (
      item.id === updatedMessage.id ? updatedMessage : item
    )));
    setOpenMessage((current) => (
      current?.id === updatedMessage.id ? updatedMessage : current
    ));

    if (previousStatus === "unread" && updatedMessage.status !== "unread") {
      setUnreadTotal((current) => {
        const next = Math.max(0, current - 1);
        onUnreadCountChange?.(next);
        return next;
      });
    }
  };

  const updateMessageStatus = async (message, nextStatus) => {
    if (!message || message.status === nextStatus) return null;

    setUpdatingId(message.id);
    setError("");
    try {
      const updated = normalizeMessage(
        await updateAdminContactMessage(message.id, { status: nextStatus }),
      );
      applyUpdatedMessage(updated, message.status);
      return updated;
    } catch (err) {
      if (err?.status === SESSION_EXPIRED_STATUS) {
        onSessionExpired?.();
        return null;
      }
      setError(err instanceof Error ? err.message : "Failed to update contact message.");
      return null;
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenMessage = async (message) => {
    setOpenMessage(message);
    if (message.status === "unread") {
      await updateMessageStatus(message, "read");
    }
  };

  const handleReply = async (event, message) => {
    event.preventDefault();
    if (message.status === "unread") {
      await updateMessageStatus(message, "read");
    }
    window.location.href = buildReplyUrl(message);
  };

  return (
    <div className="ci-page">
      <div className="ci-header">
        <div>
          <h2>Contact Inbox</h2>
          <p>Open a message to read it, review security details, and reply from your email client.</p>
        </div>

        <button
          type="button"
          className="ci-btn ci-btn--ghost"
          onClick={() => loadMessages({ silent: true })}
          disabled={refreshing}
        >
          {refreshing ? <Loader2 size={15} className="ci-spin" /> : <RefreshCw size={15} />}
          Refresh
        </button>
      </div>

      {(error || notice) && (
        <div className={`ci-banner ${error ? "ci-banner--error" : "ci-banner--success"}`} role={error ? "alert" : "status"}>
          {error ? <AlertTriangle size={15} /> : <Check size={15} />}
          <span>{error || notice}</span>
        </div>
      )}

      <div className="ci-toolbar">
        <div className="ci-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, subject, or message..."
          />
        </div>
      </div>

      <div className="ci-summary" aria-label="Inbox summary">
        <span>{total} message{total === 1 ? "" : "s"}</span>
        <span className={hasUnread ? "is-strong" : ""}>{unreadTotal} new</span>
      </div>

      <section className="ci-list" aria-label="Contact messages">
        {loading ? (
          <div className="ci-empty">
            <Loader2 size={20} className="ci-spin" />
            <span>Loading messages...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="ci-empty">
            <Inbox size={28} />
            <span>No contact messages found.</span>
          </div>
        ) : (
          <table className="ci-table">
            <thead>
              <tr>
                <th>Sender</th>
                <th>Subject</th>
                <th>Sent</th>
                <th>Security</th>
                <th className="ci-table__actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {messages.map((message) => (
                <tr key={message.id} className={message.status === "unread" ? "is-unread" : ""}>
                  <td>
                    <button
                      type="button"
                      className="ci-sender"
                      onClick={() => handleOpenMessage(message)}
                    >
                      <strong>
                        {message.name}
                        {message.status === "unread" && <span className="ci-new-pill">New</span>}
                      </strong>
                      <span>{message.email}</span>
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="ci-subject"
                      onClick={() => handleOpenMessage(message)}
                    >
                      {message.subject}
                    </button>
                  </td>
                  <td>
                    <span className="ci-date">{formatDateTime(message.created_at)}</span>
                  </td>
                  <td>
                    <span className="ci-security-mini">
                      <Globe2 size={13} />
                      {message.ip_address || "IP unavailable"}
                    </span>
                  </td>
                  <td>
                    <div className="ci-actions">
                      <button
                        type="button"
                        className="ci-icon-btn"
                        title="Copy sender email"
                        aria-label="Copy sender email"
                        onClick={() => handleCopy(message.email, "Email")}
                      >
                        <Clipboard size={14} />
                      </button>
                      <button
                        type="button"
                        className="ci-icon-btn"
                        title="Copy full message"
                        aria-label="Copy full message"
                        onClick={() => handleCopy(buildMessageCopy(message), "Message")}
                      >
                        <Copy size={14} />
                      </button>
                      <a
                        className="ci-icon-btn"
                        href={buildReplyUrl(message)}
                        title="Reply by email"
                        aria-label="Reply by email"
                        onClick={(event) => handleReply(event, message)}
                      >
                        <Reply size={14} />
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {openMessage && (
        <div className="ci-modalOverlay" role="presentation" onMouseDown={() => setOpenMessage(null)}>
          <section
            className="ci-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-message-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="ci-modal__header">
              <div>
                <p className="ci-modal__eyebrow">Contact message</p>
                <h3 id="contact-message-title">{openMessage.subject}</h3>
              </div>
              <button
                type="button"
                className="ci-modal__close"
                aria-label="Close message"
                onClick={() => setOpenMessage(null)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="ci-modal__sender">
              <Mail size={17} aria-hidden="true" />
              <div>
                <strong>{openMessage.name}</strong>
                <span>{openMessage.email}</span>
              </div>
            </div>

            <p className="ci-modal__message">{openMessage.message}</p>

            <div className="ci-security">
              <h4>
                <ShieldCheck size={15} />
                Security details
              </h4>
              <dl>
                <div>
                  <dt>IP address</dt>
                  <dd>{openMessage.ip_address || "Unavailable"}</dd>
                </div>
                <div>
                  <dt>Device / browser</dt>
                  <dd>
                    <MonitorSmartphone size={13} />
                    {openMessage.user_agent || "Unavailable"}
                  </dd>
                </div>
                <div>
                  <dt>Consent</dt>
                  <dd>{openMessage.consent_accepted ? "Accepted before sending" : "Not recorded"}</dd>
                </div>
              </dl>
            </div>

            <footer className="ci-modal__actions">
              <button
                type="button"
                className="ci-btn ci-btn--ghost"
                onClick={() => handleCopy(openMessage.email, "Email")}
              >
                <Clipboard size={14} />
                Copy Email
              </button>
              <button
                type="button"
                className="ci-btn ci-btn--ghost"
                onClick={() => handleCopy(buildMessageCopy(openMessage), "Message")}
              >
                <Copy size={14} />
                Copy Message
              </button>
              <a
                className="ci-btn ci-btn--primary"
                href={buildReplyUrl(openMessage)}
                onClick={(event) => handleReply(event, openMessage)}
              >
                {updatingId === openMessage.id ? <Loader2 size={14} className="ci-spin" /> : <Reply size={14} />}
                Reply
              </a>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
