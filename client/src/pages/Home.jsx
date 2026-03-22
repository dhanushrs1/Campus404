import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header/Header';
import Footer from '../components/Footer/Footer';
import './Home.css';

const PLATFORM_LOGOS = [
  'Python',
  'JavaScript',
  'Java',
  'C++',
  'Go',
  'Rust',
  'TypeScript',
  'SQL',
  'Docker',
  'GitHub',
  'Linux',
  'Node.js',
];

const FEATURE_CARDS = [
  {
    title: 'Challenge Engine',
    text: 'Practice on real coding tasks with instant test-case feedback and clear performance hints.',
    stat: '1,200+ challenges',
  },
  {
    title: 'Roadmap Progression',
    text: 'Move from fundamentals to advanced topics with guided modules mapped to real developer roles.',
    stat: '40+ language tracks',
  },
  {
    title: 'Skill Verification',
    text: 'Earn badges and completion signals that show measurable growth across domains.',
    stat: '95% learner satisfaction',
  },
  {
    title: 'Sandbox IDE',
    text: 'Run code in-browser with a clean terminal and experiment safely before submitting challenges.',
    stat: 'Low-latency execution',
  },
];

const LEARNING_STEPS = [
  {
    step: '01',
    title: 'Pick a Path',
    desc: 'Choose frontend, backend, data structures, or language-specific practice and set weekly goals.',
  },
  {
    step: '02',
    title: 'Write and Run',
    desc: 'Code directly in the platform editor, execute test suites, and iterate with guided feedback.',
  },
  {
    step: '03',
    title: 'Track Progress',
    desc: 'Monitor solved levels, XP earned, and completion velocity using dashboard insights.',
  },
  {
    step: '04',
    title: 'Build Credibility',
    desc: 'Show your completed modules and challenge streaks as proof of practical coding consistency.',
  },
];

const FAQ = [
  {
    q: 'What is Campus404?',
    a: 'Campus404 is a coding learning platform where developers practice with challenge-based modules, in-browser execution, and progress tracking.',
  },
  {
    q: 'Who is Campus404 for?',
    a: 'It is designed for students, self-learners, and working developers who want structured coding practice and measurable progress.',
  },
  {
    q: 'Can beginners use Campus404?',
    a: 'Yes. Learning paths start from foundational topics and gradually move into intermediate and advanced coding challenges.',
  },
  {
    q: 'Does Campus404 support multiple programming languages?',
    a: 'Yes. The platform supports multiple languages and module types so learners can practice based on career goals.',
  },
];

function upsertMeta(name, content) {
  let tag = document.querySelector(`meta[name="${name}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute('name', name);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

export default function Home() {
  const isLoggedIn = Boolean(localStorage.getItem('token'));

  useEffect(() => {
    document.title = 'Campus404 | Coding Challenges, Practice Labs, and Developer Roadmaps';
    upsertMeta(
      'description',
      'Campus404 helps developers learn by building real coding skills through challenge labs, guided roadmaps, and measurable progress.'
    );
  }, []);

  return (
    <div className="home-page-v2">
      <Header />

      <main>
        <section className="hpv2-hero" aria-label="Campus404 coding platform introduction">
          <div className="hpv2-grid">
            <div className="hpv2-copy">
              <p className="hpv2-kicker">Practical coding practice platform</p>
              <h1>Build Real Developer Skills with Guided Coding Challenges</h1>
              <p className="hpv2-subtext">
                Campus404 combines structured learning paths, real challenge environments, and progress analytics so you can improve faster and code with confidence.
              </p>

              <div className="hpv2-cta-row">
                {isLoggedIn ? (
                  <>
                    <Link to="/dashboard" className="hpv2-btn hpv2-btn-primary">Open Dashboard</Link>
                    <Link to="/labs" className="hpv2-btn hpv2-btn-ghost">Explore Labs</Link>
                  </>
                ) : (
                  <>
                    <Link to="/register" className="hpv2-btn hpv2-btn-primary">Start Learning Free</Link>
                    <Link to="/login" className="hpv2-btn hpv2-btn-ghost">Login</Link>
                  </>
                )}
              </div>

              <ul className="hpv2-points" aria-label="Platform highlights">
                <li>Challenge-first learning for interview and real-world coding</li>
                <li>Clear skill progression from beginner to advanced</li>
                <li>Consistent weekly practice with XP and badge milestones</li>
              </ul>
            </div>

            <div className="hpv2-visual" aria-hidden="true">
              <div className="hpv2-terminal-card">
                <div className="hpv2-terminal-top">
                  <span />
                  <span />
                  <span />
                </div>
                <pre>{`$ campus404 run challenge --module "arrays"
Running tests...\n
Test 1/5  PASSED
Test 2/5  PASSED
Test 3/5  PASSED
Test 4/5  PASSED
Test 5/5  PASSED

XP Awarded: +120
Badge Progress: 78%`}</pre>
              </div>

              <div className="hpv2-image-card">
                <img
                  src="/placeholders/home/hero-lab-scene.svg"
                  alt="Coding workspace mockup"
                />
              </div>
            </div>
          </div>
        </section>

        <section className="hpv2-logo-strip" aria-label="Supported technologies">
          <div className="hpv2-marquee-track">
            {[...PLATFORM_LOGOS, ...PLATFORM_LOGOS].map((logo, i) => (
              <span key={`${logo}-${i}`} className="hpv2-logo-pill">{logo}</span>
            ))}
          </div>
        </section>

        <section className="hpv2-features" aria-label="Platform features">
          <div className="hpv2-section-head">
            <p className="hpv2-section-kicker">Why Campus404</p>
            <h2>Everything Needed for High-Impact Coding Practice</h2>
          </div>

          <div className="hpv2-feature-grid">
            {FEATURE_CARDS.map((card) => (
              <article key={card.title} className="hpv2-feature-card">
                <h3>{card.title}</h3>
                <p>{card.text}</p>
                <span>{card.stat}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="hpv2-learning-path" aria-label="How the learning workflow works">
          <div className="hpv2-section-head">
            <p className="hpv2-section-kicker">Learning workflow</p>
            <h2>From First Problem to Consistent Mastery</h2>
          </div>

          <div className="hpv2-horizontal-scroll" role="region" aria-label="Learning path steps">
            {LEARNING_STEPS.map((step) => (
              <article key={step.step} className="hpv2-path-card">
                <span className="hpv2-step-id">{step.step}</span>
                <h3>{step.title}</h3>
                <p>{step.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="hpv2-showcase" aria-label="Platform preview images">
          <div className="hpv2-showcase-copy">
            <p className="hpv2-section-kicker">Visual preview</p>
            <h2>Clean UI, Focused Coding Experience</h2>
            <p>
              The product experience is designed to reduce noise and keep your attention on execution, learning feedback, and measurable momentum.
            </p>
          </div>

          <div className="hpv2-showcase-grid">
            <img src="/placeholders/home/dashboard-preview.svg" alt="Dashboard preview placeholder" />
            <img src="/placeholders/home/challenge-preview.svg" alt="Challenge interface preview placeholder" />
          </div>
        </section>

        <section className="hpv2-faq" aria-label="Frequently asked questions">
          <div className="hpv2-section-head">
            <p className="hpv2-section-kicker">FAQ</p>
            <h2>Common Questions About Campus404</h2>
          </div>

          <div className="hpv2-faq-grid">
            {FAQ.map((item) => (
              <article key={item.q} className="hpv2-faq-item">
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="hpv2-final-cta" aria-label="Call to action">
          <h2>Start Practicing with Purpose</h2>
          <p>Join Campus404 and turn coding consistency into real capability.</p>
          <div className="hpv2-cta-row hpv2-cta-row-center">
            {isLoggedIn ? (
              <Link to="/labs" className="hpv2-btn hpv2-btn-primary">Go to Labs</Link>
            ) : (
              <>
                <Link to="/register" className="hpv2-btn hpv2-btn-primary">Create Account</Link>
                <Link to="/login" className="hpv2-btn hpv2-btn-ghost">Login</Link>
              </>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
