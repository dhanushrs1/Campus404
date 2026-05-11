import { useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Mail, Send } from "lucide-react";
import { APP_ROUTES } from "../../../routes/paths.js";
import { ASSETS } from "../../../shared/assets.js";
import Seo from "../../../shared/Seo.jsx";
import { submitContactMessage } from "../../../shared/contactApi.js";
import "./ContactPage.css";

const CONTACT_EMAIL = "hello@campus404.dev";

const DEFAULT_FORM = {
  name: "",
  email: "",
  subject: "",
  message: "",
  consentAccepted: false,
};

export default function ContactPage() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const updateField = (field) => (event) => {
    setError("");
    setSuccess("");
    setForm((current) => ({
      ...current,
      [field]: event.target.value,
    }));
  };

  const updateConsent = (event) => {
    setError("");
    setSuccess("");
    setForm((current) => ({
      ...current,
      consentAccepted: event.target.checked,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.consentAccepted) {
      setError("Please accept the contact and security notice before sending.");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      await submitContactMessage({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
        consent_accepted: form.consentAccepted,
      });

      setForm(DEFAULT_FORM);
      setSuccess("Message sent. We'll get back to you soon.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send your message right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="contactPage">
      <Seo
        title="Contact Us"
        description="Contact Campus404 for support, feedback, and platform questions."
        pathname={APP_ROUTES.contactUs}
      />

      <section className="contactHero">
        <div className="contactHero__stage">
          <div className="contactHero__content">
            <p className="contactPage__eyebrow">Contact Campus404</p>
            <h1>Send us a message.</h1>
            <p>
              Use this form for support, feedback, bug reports, or partnership questions.
              We only ask for what we need to reply properly.
            </p>

            <a className="contactIntro__email" href={`mailto:${CONTACT_EMAIL}`}>
              <Mail size={18} aria-hidden="true" />
              {CONTACT_EMAIL}
            </a>
          </div>

          <div className="contactHero__visual" aria-hidden="true">
            <img src={ASSETS.contact.heroBuildLearn} alt="" />
          </div>
        </div>
      </section>

      <section className="contactPage__shell contactPanel" aria-label="Contact form">
        <form className="contactForm" onSubmit={handleSubmit}>
          <div className="contactForm__row">
            <label>
              <span>Name</span>
              <input
                type="text"
                value={form.name}
                onChange={updateField("name")}
                placeholder="Your name"
                autoComplete="name"
                maxLength={128}
                required
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
                maxLength={256}
                required
              />
            </label>
          </div>

          <label>
            <span>Subject</span>
            <input
              type="text"
              value={form.subject}
              onChange={updateField("subject")}
              placeholder="What is this about?"
              minLength={2}
              maxLength={200}
              required
            />
          </label>

          <label>
            <span>Message</span>
            <textarea
              value={form.message}
              onChange={updateField("message")}
              placeholder="Tell us what happened or what you need."
              rows={8}
              minLength={10}
              maxLength={4000}
              required
            />
          </label>

          <label className="contactForm__consent">
            <input
              type="checkbox"
              checked={form.consentAccepted}
              onChange={updateConsent}
              required
            />
            <span>
              I agree that Campus404 can store this message, my server-seen IP address,
              and device/browser details for support and security, and contact me about this request.
              I also agree to the <a href={APP_ROUTES.termsAndConditions}>Terms</a> and{" "}
              <a href={APP_ROUTES.privacyPolicy}>Privacy Policy</a>.
            </span>
          </label>

          {(error || success) && (
            <p className={`contactForm__status ${error ? "is-error" : "is-success"}`} role={error ? "alert" : "status"}>
              {error ? <AlertCircle size={16} aria-hidden="true" /> : <CheckCircle2 size={16} aria-hidden="true" />}
              {error || success}
            </p>
          )}

          <div className="contactForm__actions">
            <button type="submit" className="contactPage__button contactPage__button--primary" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 size={18} className="contactPage__spin" /> : <Send size={18} />}
              {isSubmitting ? "Sending..." : "Send Message"}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}
