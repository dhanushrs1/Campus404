import { useState } from "react";
import {
  ArrowRight,
  Bug,
  Clock3,
  Code2,
  HeartHandshake,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import Seo from "../../../shared/Seo.jsx";
import "./ContactPage.css";

const CONTACT_EMAIL = "hello@campus404.dev";
const GITHUB_URL = "https://github.com/campus-404";

const CONTACT_TOPICS = [
  "General inquiry",
  "Bug report",
  "Open-source contribution",
  "Collaboration",
  "Security issue",
];

const CONTACT_CARDS = [
  {
    title: "General Inquiry",
    text: "Questions about Campus404, features, accounts, or how the platform works.",
    action: "Send a message",
    href: "#contact-form",
    icon: MessageCircle,
  },
  {
    title: "Bug Report",
    text: "Found something broken? Share the page, steps, and what you expected.",
    action: "Report a bug",
    href: "#contact-form",
    icon: Bug,
  },
  {
    title: "Open Source",
    text: "Suggest ideas, contribute fixes, or help improve the platform.",
    action: "View on GitHub",
    href: GITHUB_URL,
    icon: Code2,
    external: true,
  },
  {
    title: "Collaboration",
    text: "For academic, community, workshop, or project partnership conversations.",
    action: "Let's collaborate",
    href: "#contact-form",
    icon: HeartHandshake,
  },
];

const CONTACT_DETAILS = [
  {
    title: "Email Us",
    text: CONTACT_EMAIL,
    note: "Use this for support, feedback, and collaboration requests.",
    icon: Mail,
  },
  {
    title: "GitHub",
    text: "github.com/campus-404",
    note: "Open issues, suggest improvements, or contribute.",
    icon: Code2,
  },
  {
    title: "Response Time",
    text: "1-2 business days",
    note: "Most messages are reviewed during working hours.",
    icon: Clock3,
  },
  {
    title: "Safety",
    text: "Security reports welcome",
    note: "Include clear steps and avoid exposing private data.",
    icon: ShieldCheck,
  },
];

const FAQS = [
  {
    question: "How quickly will I get a response?",
    answer: "Most contact requests are reviewed within one to two business days.",
  },
  {
    question: "Can I contribute to Campus404?",
    answer: "Yes. Open-source ideas, bug reports, documentation fixes, and feature suggestions are welcome.",
  },
  {
    question: "Where can I report a security issue?",
    answer: "Use the contact form or email with clear reproduction steps. Please avoid destructive testing or exposing user data.",
  },
];

const DEFAULT_FORM = {
  name: "",
  email: "",
  topic: CONTACT_TOPICS[0],
  subject: "",
  message: "",
};

export default function ContactPage() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [status, setStatus] = useState("");

  const updateField = (field) => (event) => {
    setStatus("");
    setForm((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    const subject = form.subject || `${form.topic} - Campus404`;
    const body = [
      `Name: ${form.name || "Not provided"}`,
      `Email: ${form.email || "Not provided"}`,
      `Topic: ${form.topic}`,
      "",
      form.message,
    ].join("\n");

    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setStatus("Opening your email app with the message ready to send.");
  };

  return (
    <main className="contactPage">
      <Seo
        title="Contact Us"
        description="Contact Campus404 for support, bug reports, open-source contributions, collaboration, and security questions."
        pathname={APP_ROUTES.contactUs}
      />

      <section className="contactHero">
        <div className="contactHero__stage">
          <div className="contactHero__content">
            <p className="contactPage__eyebrow">Contact Campus404</p>
            <h1>Let's connect.</h1>
            <p>
              Reach out for questions, bug reports, open-source contributions,
              collaboration opportunities, or support with the platform.
            </p>
            <div className="contactHero__actions">
              <a href="#contact-form" className="contactPage__button contactPage__button--primary">
                <Send size={18} />
                Send a Message
              </a>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noreferrer"
                className="contactPage__button contactPage__button--ghost"
              >
                <Code2 size={18} />
                View GitHub
              </a>
            </div>
          </div>

          <div className="contactHero__visual" aria-hidden="true">
            <img src={ASSETS.contact.heroBuildLearn} alt="" />
          </div>
        </div>
      </section>

      <section className="contactPage__shell contactCards" aria-label="Contact options">
        {CONTACT_CARDS.map(({ title, text, action, href, icon: Icon, external }) => (
          <article key={title} className="contactCard">
            <span className="contactCard__icon">
              <Icon size={22} aria-hidden="true" />
            </span>
            <h2>{title}</h2>
            <p>{text}</p>
            <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined}>
              {action}
              <ArrowRight size={15} aria-hidden="true" />
            </a>
          </article>
        ))}
      </section>

      <section id="contact-form" className="contactPage__shell contactMain">
        <form className="contactForm" onSubmit={handleSubmit}>
          <div className="contactForm__head">
            <p className="contactPage__eyebrow">Send us a message</p>
            <h2>We'll get back to you.</h2>
          </div>

          <div className="contactForm__row">
            <label>
              <span>Name</span>
              <input
                type="text"
                value={form.name}
                onChange={updateField("name")}
                placeholder="Your name"
                autoComplete="name"
              />
            </label>

            <label>
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={updateField("email")}
                placeholder="you@example.com"
                autoComplete="email"
              />
            </label>
          </div>

          <label>
            <span>Topic</span>
            <select value={form.topic} onChange={updateField("topic")}>
              {CONTACT_TOPICS.map((topic) => (
                <option key={topic} value={topic}>
                  {topic}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Subject</span>
            <input
              type="text"
              value={form.subject}
              onChange={updateField("subject")}
              placeholder="How can we help?"
            />
          </label>

          <label>
            <span>Message</span>
            <textarea
              value={form.message}
              onChange={updateField("message")}
              placeholder="Type your message here..."
              rows={7}
              required
            />
          </label>

          <div className="contactForm__actions">
            <button type="submit" className="contactPage__button contactPage__button--primary">
              <Send size={18} />
              Send Message
            </button>
            <p aria-live="polite">
              <ShieldCheck size={16} aria-hidden="true" />
              {status || "We respect your privacy. Your information is safe with us."}
            </p>
          </div>
        </form>

        <aside className="contactDetails" aria-label="Contact details">
          {CONTACT_DETAILS.map(({ title, text, note, icon: Icon }) => (
            <div key={title} className="contactDetail">
              <span className="contactDetail__icon">
                <Icon size={24} aria-hidden="true" />
              </span>
              <div>
                <h2>{title}</h2>
                <strong>{text}</strong>
                <p>{note}</p>
              </div>
            </div>
          ))}
        </aside>
      </section>

      <section className="contactPage__shell contactFaq">
        <div className="contactFaq__head">
          <div>
            <p className="contactPage__eyebrow">Quick answers</p>
            <h2>Frequently asked questions</h2>
          </div>
          <a href="#contact-form">Can't find what you need? Send us a message.</a>
        </div>

        <div className="contactFaq__list">
          {FAQS.map(({ question, answer }) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
