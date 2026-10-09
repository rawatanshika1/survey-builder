import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useAuth } from "../context/AuthContext.jsx";

const features = [
  { title: "Conversational Mode", description: "Make every response feel like a natural, one-question-at-a-time conversation.", icon: "↗" },
  { title: "Drop-off Analytics", description: "See where respondents leave and make it easier for them to finish.", icon: "⌁" },
  { title: "AI Insights", description: "Turn open-text answers into clear themes and sentiment at a glance.", icon: "✳" },
  { title: "7 Question Types", description: "Choose from seven flexible formats, from multiple choice to open-ended.", icon: "▤" },
  { title: "CSV Export", description: "Take your response data wherever your team needs it, in a few clicks.", icon: "↓" },
  { title: "Dark Mode", description: "A comfortable survey-building experience, day or night.", icon: "◐" }
];

const steps = [
  { number: "01", title: "Build", description: "Create your survey" },
  { number: "02", title: "Share", description: "Reach your audience" },
  { number: "03", title: "Analyze", description: "Discover insights" }
];

function ChatMark({ className = "h-7 w-7" }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path d="M4 10.5A5.5 5.5 0 0 1 9.5 5h15a5.5 5.5 0 0 1 5.5 5.5v9a5.5 5.5 0 0 1-5.5 5.5h-9l-7 5v-6.1A5.5 5.5 0 0 1 4 18.5v-8Z" fill="#14b8c4" />
      <path d="M14 19.5A5.5 5.5 0 0 1 19.5 14h11a5.5 5.5 0 0 1 5.5 5.5v8a5.5 5.5 0 0 1-5.5 5.5h-2l-6 4v-4h-3a5.5 5.5 0 0 1-5.5-5.5v-8Z" fill="#0f2a43" stroke="white" strokeWidth="1.5" />
    </svg>
  );
}

function SurveyIllustration() {
  return (
    <motion.div
      className="relative mx-auto w-full max-w-[560px]"
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 5, ease: "easeInOut", repeat: Infinity }}
    >
      <svg viewBox="0 0 620 490" className="w-full overflow-visible" role="img" aria-label="AskFlow survey dashboard illustration">
        <defs>
          <filter id="windowShadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="22" stdDeviation="18" floodColor="#0f2a43" floodOpacity=".14" />
          </filter>
        </defs>
        <ellipse cx="311" cy="439" rx="204" ry="20" fill="#0f2a43" opacity=".08" />
        <g filter="url(#windowShadow)">
          <rect x="105" y="68" width="410" height="316" rx="21" fill="white" />
          <path d="M105 89a21 21 0 0 1 21-21h368a21 21 0 0 1 21 21v31H105V89Z" fill="#f3f8fa" />
          <circle cx="130" cy="94" r="5" fill="#ff9e86" />
          <circle cx="147" cy="94" r="5" fill="#ffd166" />
          <circle cx="164" cy="94" r="5" fill="#5ed6c0" />
          <rect x="208" y="87" width="204" height="14" rx="7" fill="#e4edef" />
          <rect x="132" y="145" width="207" height="15" rx="7.5" fill="#0f2a43" />
          <rect x="132" y="169" width="157" height="9" rx="4.5" fill="#c8d6dc" />
          <rect x="132" y="199" width="221" height="51" rx="11" fill="#f4fbfb" stroke="#e3eeee" />
          <circle cx="152" cy="224" r="9" fill="#14b8c4" />
          <path d="m148 224 3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="170" y="215" width="139" height="8" rx="4" fill="#8298a5" />
          <rect x="170" y="230" width="94" height="6" rx="3" fill="#d2dfe3" />
          <rect x="132" y="260" width="221" height="51" rx="11" fill="#f4fbfb" stroke="#e3eeee" />
          <circle cx="152" cy="285" r="9" fill="#14b8c4" />
          <path d="m148 285 3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="170" y="276" width="130" height="8" rx="4" fill="#8298a5" />
          <rect x="170" y="291" width="88" height="6" rx="3" fill="#d2dfe3" />
          <rect x="132" y="322" width="90" height="29" rx="9" fill="#14b8c4" />
          <rect x="151" y="332" width="52" height="8" rx="4" fill="white" opacity=".92" />
          <rect x="373" y="145" width="113" height="206" rx="14" fill="#f7fafb" />
          <text x="391" y="169" fill="#0f2a43" fontFamily="sans-serif" fontSize="14" fontWeight="700">RESPONSE</text>
          <text x="391" y="195" fill="#0f2a43" fontFamily="sans-serif" fontSize="19" fontWeight="700">+28%</text>
          <path d="M390 276h13v49h-13zM410 251h13v74h-13zM430 264h13v61h-13zM450 226h13v99h-13z" fill="#14b8c4" />
          <path d="M389 332h76" stroke="#dce6e8" strokeWidth="2" strokeLinecap="round" />
          <circle cx="467" cy="157" r="17" fill="#d9f8f4" />
          <circle cx="467" cy="153" r="5" fill="#0f2a43" />
          <path d="M457 167c1.6-6 5-9 10-9s8.4 3 10 9" fill="#0f2a43" />
        </g>
        <g filter="url(#windowShadow)">
          <rect x="30" y="191" width="154" height="83" rx="16" fill="white" />
          <text x="48" y="216" fill="#0f2a43" fontFamily="sans-serif" fontSize="14" fontWeight="700">GREAT</text>
          <text x="47" y="246" fill="#f5a623" fontFamily="sans-serif" fontSize="21" letterSpacing="2">★★★★★</text>
          <rect x="48" y="255" width="78" height="5" rx="2.5" fill="#d7e1e4" />
        </g>
        <g filter="url(#windowShadow)">
          <rect x="423" y="318" width="160" height="70" rx="16" fill="#0f2a43" />
          <path d="M443 342h91M443 354h70" stroke="#dce8eb" strokeWidth="6" strokeLinecap="round" opacity=".9" />
          <circle cx="557" cy="352" r="13" fill="#14b8c4" />
          <path d="m552 352 4 4 7-8" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="m447 388-10 11 20-11" fill="#0f2a43" />
        </g>
        <g transform="translate(463 62)">
          <circle cx="26" cy="26" r="25" fill="#fff" />
          <path d="M26 10v5m0 22v5M10 26h5m22 0h5M14.7 14.7l3.6 3.6m15.4 15.4 3.6 3.6m0-22.6-3.6 3.6m-15.4 15.4-3.6 3.6" stroke="#14b8c4" strokeWidth="4" strokeLinecap="round" />
          <circle cx="26" cy="26" r="8" fill="#0f2a43" />
          <circle cx="26" cy="26" r="3" fill="#fff" />
        </g>
        <path d="M113 382c-37 8-49 31-44 57 24-8 39-24 44-57Z" fill="#42c7ad" />
        <path d="M113 382c-8 21-19 37-37 51" stroke="#087f77" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M139 393c29 11 38 32 28 52-20-11-31-27-28-52Z" fill="#93df9d" />
        <path d="M139 393c4 21 12 36 24 48" stroke="#087f77" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M94 439h86l-11 11h-64l-11-11Z" fill="#0f2a43" />
        <rect x="117" y="429" width="40" height="10" rx="5" fill="#d78c50" />
        <circle cx="532" cy="238" r="5" fill="#f5a623" />
        <circle cx="82" cy="124" r="4" fill="#14b8c4" />
        <path d="m532 134 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2 5-10Z" fill="#f5a623" opacity=".9" />
      </svg>
    </motion.div>
  );
}

export default function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function startSurvey() {
    navigate(user ? "/dashboard" : "/register");
  }

  function closeMenu() {
    setMenuOpen(false);
  }

  const navLinks = [
    { label: "Home", href: "#home", active: true },
    { label: "Features", href: "#features" },
    { label: "How it works", href: "#how" },
    { label: "Contact", href: "#contact" }
  ];

  return (
    <div className="landing-scene">
      <div className="landing-blob landing-blob--one" />
      <div className="landing-blob landing-blob--two" />
      <div className="landing-blob landing-blob--three" />

      <div className="landing-card">
        <section className="landing-first-screen">
          <header className="landing-nav">
            <Link to="/" className="landing-brand" aria-label="AskFlow home">
              <ChatMark />
              <span>AskFlow</span>
            </Link>
            <button
              type="button"
              className="landing-menu-toggle"
              aria-label={menuOpen ? "Close navigation menu" : "Open navigation menu"}
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span /><span /><span />
            </button>
            <nav className={`landing-nav-links ${menuOpen ? "is-open" : ""}`} aria-label="Main navigation">
              {navLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className={`landing-nav-link ${link.active ? "is-active" : ""}`}
                  onClick={closeMenu}
                >
                  {link.label}
                </a>
              ))}
              <div className="landing-nav-actions">
                <Link to="/login" className="landing-login" onClick={closeMenu}>Login</Link>
                <Link to="/register" className="landing-register" onClick={closeMenu}>Register</Link>
              </div>
            </nav>
          </header>

          <section id="home" className="landing-hero">
            <motion.div
              className="landing-hero-copy"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            >
              <span className="landing-eyebrow"><span /> SURVEYS, MADE SIMPLE</span>
              <h1><span>AskFlow</span></h1>
              <p>Surveys that flow, insights that glow.</p>
              <div className="landing-hero-actions">
                <button type="button" className="landing-button landing-button--teal" onClick={startSurvey}>
                  Try Now
                  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </button>
                <a href="#features" className="landing-button landing-button--navy">
                  Learn More
                  <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><path d="M10 3v13m-5-5 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </a>
              </div>
              <div className="landing-social-proof">
                <div className="landing-proof-avatars" aria-hidden="true"><span>A</span><span>M</span><span>J</span></div>
                <span>Thoughtful surveys. Better answers.</span>
              </div>
            </motion.div>
            <div className="landing-hero-art"><SurveyIllustration /></div>
          </section>
        </section>

        <main className="landing-content">
          <section id="features" className="landing-section">
            <motion.div
              className="landing-section-heading"
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ duration: 0.5 }}
            >
              <span className="landing-eyebrow"><span /> BUILT FOR BETTER FEEDBACK</span>
              <h2>Everything you need to ask <span>better questions.</span></h2>
              <p>A calmer, smarter way to create surveys people actually want to finish.</p>
            </motion.div>
            <div className="landing-feature-grid">
              {features.map((feature, index) => (
                <motion.article
                  key={feature.title}
                  className="landing-feature-card"
                  initial={{ opacity: 0, y: 22 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.45, delay: index * 0.08 }}
                >
                  <span className="landing-feature-icon" aria-hidden="true">{feature.icon}</span>
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </motion.article>
              ))}
            </div>
          </section>

          <section id="how" className="landing-how">
            <div className="landing-steps">
              {steps.map((step, index) => (
                <motion.article
                  key={step.number}
                  className="landing-step"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.4, delay: index * 0.13 }}
                >
                  <span className="landing-step-number">{step.number}</span>
                  <div><h3>{step.title}</h3><p>{step.description}</p></div>
                </motion.article>
              ))}
            </div>
          </section>

          <section id="contact" className="landing-cta">
            <div>
              <h2>Ready to hear what really matters?</h2>
              <p>Start creating thoughtful surveys with AskFlow.</p>
            </div>
            <Link to="/register" className="landing-button landing-button--white">
              Register
              <svg viewBox="0 0 20 20" width="18" height="18" fill="none" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
          </section>

          <footer className="landing-footer">
            <Link to="/" className="landing-brand"><ChatMark className="h-6 w-6" /><span>AskFlow</span></Link>
            <span>© {new Date().getFullYear()} AskFlow. All rights reserved.</span>
            <a href="#home">Back to top</a>
          </footer>
        </main>
      </div>
    </div>
  );
}
