import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Code2,
  Copy,
  GraduationCap,
  Mail,
  MapPin,
  MessageCircle,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import Seo from "../../../shared/Seo.jsx";
import "./ContactPage.css";

const CONTACT_TOPICS = [
  "Student support",
  "Open-source contribution",
  "College collaboration",
  "Club or community",
  "Security or abuse",
  "General question",
];

const CONTACT_PATHS = [
  {
    title: "Student Support",
    text: "Questions about accounts, tracks, workspace access, submissions, or learning progress.",
    icon: MessageCircle,
  },
  {
    title: "Open-Source Contributions",
    text: "Ideas, fixes, issues, documentation improvements, and student-led platform contributions.",
    icon: Code2,
  },
  {
    title: "KVG Collaboration",
    text: "Academic partnerships, department updates, demos, workshops, and campus coordination.",
    icon: GraduationCap,
  },
  {
    title: "Safety And Security",
    text: "Responsible reports about misuse, platform safety, abuse, or security concerns.",
    icon: ShieldCheck,
  },
];

const CONTACT_FACTS = [
  {
    label: "Built By",
    value: "KVG Engineering College",
    icon: MapPin,
  },
  {
    label: "Led By",
    value: "Cognex Club",
    icon: Users,
  },
  {
    label: "Project Type",
    value: "Open-source learning platform",
    icon: Code2,
  },
  {
    label: "Response Flow",
    value: "Student-first triage",
    icon: Clock3,
  },
];

const DEFAULT_FORM = {
  name: "",
  email: "",
  topic: CONTACT_TOPICS[0],
  message: "",
};

export default function ContactPage() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [status, setStatus] = useState("");

  const contactBrief = useMemo(() => {
    return [
      "Campus404 contact request",
      `Name: ${form.name || "Not provided"}`,
      `Email: ${form.email || "Not provided"}`,
      `Topic: ${form.topic}`,
      "",
      form.message || "Message not provided.",
    ].join("\n");
  }, [form]);

  const updateField = (field) => (event) => {
    setStatus("");
    setForm((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const handleCopyBrief = async (event) => {
    event.preventDefault();

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(contactBrief);
        setStatus("Contact brief copied. Share it with the official Campus404 or Cognex channel.");
        return;
      }
    } catch {
      // Fall through to the manual-copy message below.
    }

    setStatus("Contact brief is ready. Select the form text and share it with the official channel.");
  };

  return (
    <main className="contactPage">
      <Seo
        title="Contact Us"
        description="Contact Campus404, the open-source coding learning platform built by KVG Engineering College and led by the Cognex club."
        pathname={APP_ROUTES.contactUs}
      />

      <section className="contactHero">
        <div className="contactHero__stage">
          <div className="contactHero__content">
            <p className="contactPage__eyebrow">Contact Campus404</p>
            <h1>Reach the people building the platform.</h1>
            <p>
              Campus404 is an open-source coding learning platform built by KVG
              Engineering College and led by Cognex. Use this page to prepare support
              questions, contribution ideas, collaboration requests, and safety reports.
            </p>
            <div className="contactHero__actions">
              <a href="#contact-form" className="contactPage__button contactPage__button--primary">
                <Send size={18} />
                Start a Message
              </a>
              <a href="#contact-paths" className="contactPage__button contactPage__button--ghost">
                <ArrowRight size={18} />
                Choose a Topic
              </a>
            </div>
          </div>

          <div className="contactHero__visual" aria-hidden="true">
            <img src={ASSETS.icons.helpDesk} alt="" />
          </div>
        </div>
      </section>

      <section className="contactPage__shell contactIdentity" aria-label="Project identity">
        {CONTACT_FACTS.map(({ label, value, icon: Icon }) => (
          <div key={label} className="contactIdentity__item">
            <Icon size={19} aria-hidden="true" />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </section>

      <section id="contact-paths" className="contactPage__shell contactPaths" aria-label="Contact options">
        <div className="contactPage__sectionHead">
          <p className="contactPage__eyebrow">Where to begin</p>
          <h2>Pick the closest reason for contacting us.</h2>
        </div>

        <div className="contactPaths__grid">
          {CONTACT_PATHS.map(({ title, text, icon: Icon }) => (
            <article key={title} className="contactPathCard">
              <span className="contactPathCard__icon">
                <Icon size={22} aria-hidden="true" />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="contactPage__shell contactWork">
        <div className="contactWork__note">
          <p className="contactPage__eyebrow">How we work</p>
          <h2>Open-source, student-led, and college-backed.</h2>
          <p>
            Campus404 is shaped for practical learning, transparent collaboration, and
            student ownership. Cognex leads the platform direction with support from
            KVG Engineering College, so messages should be clear, respectful, and tied
            to learning, contribution, safety, or collaboration.
          </p>
        </div>

        <div className="contactWork__steps" aria-label="Contact process">
          <div>
            <span>Prepare</span>
            <strong>Write the issue, request, or idea with enough context.</strong>
          </div>
          <div>
            <span>Route</span>
            <strong>Share it with the official Campus404, Cognex, or college channel.</strong>
          </div>
          <div>
            <span>Follow Up</span>
            <strong>Include screenshots, URLs, account details, or steps when useful.</strong>
          </div>
        </div>
      </section>

      <section id="contact-form" className="contactPage__shell contactDraft">
        <div className="contactDraft__intro">
          <p className="contactPage__eyebrow">Message Draft</p>
          <h2>Create a clean contact brief.</h2>
          <p>
            This draft form prepares your message. The final email address, issue tracker,
            or support form can be connected when the official contact assets are ready.
          </p>
        </div>

        <form className="contactForm" onSubmit={handleCopyBrief}>
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
            <span>Message</span>
            <textarea
              value={form.message}
              onChange={updateField("message")}
              placeholder="Share the context, page URL, account details, screenshots to attach later, or contribution idea."
              rows={7}
              required
            />
          </label>

          <div className="contactForm__actions">
            <button type="submit" className="contactPage__button contactPage__button--primary">
              <Copy size={18} />
              Copy Brief
            </button>
            <p aria-live="polite">
              {status ? (
                <>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  {status}
                </>
              ) : (
                <>
                  <Mail size={16} aria-hidden="true" />
                  Official contact endpoint pending final assets.
                </>
              )}
            </p>
          </div>
        </form>
      </section>
    </main>
  );
}
