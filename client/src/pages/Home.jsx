import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header/Header';
import Footer from '../components/Footer/Footer';
import './Home.css';

const INFO_CARDS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    ),
    title: 'Structured Modules',
    desc: 'From language fundamentals to advanced architecture, learn through interconnected challenge paths.'
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 17l6-6-6-6M12 19h8"/>
      </svg>
    ),
    title: 'In-Browser Sandbox',
    desc: 'Write, run, and test your code in a fully featured environment directly in your browser.'
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="7"/><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88"/>
      </svg>
    ),
    title: 'Skill Validation',
    desc: 'Earn verified badges and public completion certificates to showcase your programming capability.'
  }
];

const FAQ_DATA = [
  {
    q: 'What is Campus404?',
    a: 'Campus404 is an immersive learning platform designed to take you from a curious beginner to a capable developer through hands-on, challenge-based coding modules.'
  },
  {
    q: 'Do I need prior coding experience?',
    a: 'Not at all. We offer dedicated introductory modules starting from syntax fundamentals before moving you into algorithmic problem solving and architecture.'
  },
  {
    q: 'What languages does Campus404 support?',
    a: 'The platform currently supports Python, JavaScript, Java, C++, Go, and Rust, allowing you to master multi-paradigm programming.'
  },
  {
    q: 'Is my progress saved?',
    a: 'Yes! Create a free account to track your XP, maintain challenge streaks, unlock badges, and save your sandbox environments.'
  }
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
  const [activeFaq, setActiveFaq] = useState(null);
  const isLoggedIn = Boolean(localStorage.getItem('token'));

  useEffect(() => {
    document.title = 'Campus404 | Elevated Coding Practice';
    upsertMeta('description', 'Master real-world programming through interactive coding challenges, structured roadmaps, and instant sandbox feedback.');
  }, []);

  const toggleFaq = (index) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  return (
    <div className="home-modern">
      <Header />

      <main className="home-main-content">
        
        {/* --- HERO SECTION --- */}
        <section className="hm-hero">
          <div className="hm-hero-bg">
            <div className="hm-blob hm-blob-1"></div>
            <div className="hm-blob hm-blob-2"></div>
            <div className="hm-blob hm-blob-3"></div>
          </div>
          
          <div className="hm-hero-inner">
            <div className="hm-kicker">
              <span className="hm-kicker-dot"></span>
              Elevate your programming journey
            </div>
            
            <h1 className="hm-title">
              Master Code Through <br />
              <span className="hm-title-accent">Applied Challenges</span>
            </h1>
            
            <p className="hm-subtitle">
              Campus404 bridges the gap between theory and practice with structured roadmaps, an embedded lightning-fast IDE, and measurable skill progression.
            </p>
            
            <div className="hm-hero-actions">
              {isLoggedIn ? (
                <>
                  <Link to="/dashboard" className="hm-btn hm-btn-primary">
                    Go to Dashboard
                  </Link>
                  <Link to="/labs" className="hm-btn hm-btn-outline">
                    Explore Modules
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/register" className="hm-btn hm-btn-primary">
                    Start Coding Free
                  </Link>
                  <Link to="/login" className="hm-btn hm-btn-outline">
                    Sign In
                  </Link>
                </>
              )}
            </div>

            <div className="hm-hero-stats">
              <div className="hm-stat"><strong>40+</strong> Guided Modules</div>
              <div className="hm-stat-divider"></div>
              <div className="hm-stat"><strong>1.2k+</strong> Challenges</div>
              <div className="hm-stat-divider"></div>
              <div className="hm-stat"><strong>0ms</strong> Setup Time</div>
            </div>
          </div>
        </section>

        {/* --- INFO / ABOUT CARDS --- */}
        <section className="hm-info-section">
          <div className="hm-section-header">
            <h2>Why Learn on Campus404?</h2>
            <p>Designed to accelerate your understanding through practice.</p>
          </div>
          
          <div className="hm-cards-grid">
            {INFO_CARDS.map((card, idx) => (
              <div className="hm-info-card" key={idx}>
                <div className="hm-card-icon">{card.icon}</div>
                <h3 className="hm-card-title">{card.title}</h3>
                <p className="hm-card-desc">{card.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --- SHOWCASE / PLATFORM ABOUT --- */}
        <section className="hm-showcase-section">
          <div className="hm-showcase-grid">
            <div className="hm-showcase-content">
              <h2>An Environment Built For <span className="hm-text-blue">Focus</span></h2>
              <p>
                We removed the distractions. No configuring local environments, no complex setups. Just a clean, responsive interface that puts your code and your challenges front and center.
              </p>
              <ul className="hm-checklist">
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--c-cobalt)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Instant, secure sandbox execution
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--c-cobalt)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Real-time test case assertions
                </li>
                <li>
                  <svg viewBox="0 0 24 24" fill="none" stroke="var(--c-cobalt)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  Earn XP and rank up globally
                </li>
              </ul>
            </div>
            <div className="hm-showcase-visual">
              <div className="hm-mockup-window">
                <div className="hm-mockup-header">
                  <span></span><span></span><span></span>
                </div>
                <div className="hm-mockup-body">
                  <pre><code>{`function solveChallenge(array) {
  // Sort the array in O(n log n)
  const sorted = array.sort((a,b) => a - b);
  
  // Find target using binary search
  return binarySearch(sorted, target);
}

// Running Test Cases...
// 🟢 PASS: Case 1
// 🟢 PASS: Case 2
// 🟢 PASS: Case 3
// ✅ Challenge Completed! XP +50`}</code></pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* --- FAQ SECTION --- */}
        <section className="hm-faq-section">
          <div className="hm-section-header">
            <h2>Frequently Asked Questions</h2>
            <p>Everything you need to know about getting started.</p>
          </div>

          <div className="hm-faq-container">
            {FAQ_DATA.map((faq, idx) => {
              const isActive = activeFaq === idx;
              return (
                <div 
                  className={`hm-faq-item ${isActive ? 'active' : ''}`} 
                  key={idx}
                  onClick={() => toggleFaq(idx)}
                >
                  <div className="hm-faq-q">
                    <h3>{faq.q}</h3>
                    <div className="hm-faq-toggle">
                      {isActive ? '-' : '+'}
                    </div>
                  </div>
                  <div className="hm-faq-a">
                    <p>{faq.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* --- BOTTOM CTA --- */}
        <section className="hm-bottom-cta">
          <div className="hm-cta-content">
            <h2>Ready to write better code?</h2>
            <p>Join thousands of developers advancing their careers today.</p>
            {isLoggedIn ? (
              <Link to="/dashboard" className="hm-btn hm-btn-primary hm-btn-lg">Return to Dashboard</Link>
            ) : (
              <Link to="/register" className="hm-btn hm-btn-primary hm-btn-lg">Create Free Account</Link>
            )}
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
