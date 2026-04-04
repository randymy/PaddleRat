import { useState } from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo.png";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export default function Landing() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/waitlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Something went wrong");
      setSubmitted(true);
      setMessage(data.message);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="landing">
      <nav className="landing-nav">
        <img src={logo} alt="PaddleRat" className="landing-logo-img" />
        <Link to="/login" className="landing-login">Log In</Link>
      </nav>

      <section className="hero-section">
        <h1 className="hero-title">
          Stop the back and forth.<br />
          <span className="hero-accent">Fill your court in minutes.</span>
        </h1>
        <p className="hero-sub">
          PaddleRat automates the hardest part of platform tennis &mdash;
          finding players. Set your lineup, send one text, and let responses roll in.
        </p>
      </section>

      {/* ── For Matchmakers ──────────────────── */}
      <section className="process-section">
        <h2 className="process-title">For Matchmakers</h2>
        <p className="process-sub">You book the court. PaddleRat fills it.</p>

        <div className="process-steps">
          <div className="process-step">
            <div className="process-icon">1</div>
            <h3>Add your contacts</h3>
            <p>Share a link with your paddle crew. They tap it, confirm their identity, and they're in your network.</p>
          </div>
          <div className="process-step">
            <div className="process-icon">2</div>
            <h3>Prioritize your players</h3>
            <p>Create lists and set the order. Drag to rank who gets invited first. Uncheck anyone sitting this one out.</p>
          </div>
          <div className="process-step">
            <div className="process-icon">3</div>
            <h3>Book the match</h3>
            <p>Pick your court, set the time, hit send. PaddleRat texts your list in order until every spot is filled.</p>
          </div>
        </div>
      </section>

      {/* ── For Players ──────────────────────── */}
      <section className="process-section process-players">
        <h2 className="process-title">For Players</h2>
        <p className="process-sub">No app. No account. Just a text.</p>

        <div className="process-steps">
          <div className="process-step">
            <div className="process-icon">1</div>
            <h3>Get a text</h3>
            <p>"Randy wants to play paddle on Tuesday at 7pm at Wilmette, Court 3. Reply Y to join or N to decline."</p>
          </div>
          <div className="process-step">
            <div className="process-icon">2</div>
            <h3>Reply Y or N</h3>
            <p>That's it. One letter. If you're in, you're booked. If not, the next player on the list gets your spot.</p>
          </div>
          <div className="process-step">
            <div className="process-icon">3</div>
            <h3>Get a confirmation</h3>
            <p>When the match fills, everyone gets a confirmation with the lineup, PTI ratings, and a calendar link.</p>
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────── */}
      <section className="cta-section" id="signup">
        {submitted ? (
          <div className="cta-success">
            <h2>You're on the list!</h2>
            <p>{message}</p>
          </div>
        ) : (
          <>
            <h2>Become a Matchmaker</h2>
            <p className="cta-sub">
              We're opening up to a small group of organizers.
              Sign up and we'll send you access when it's your turn.
            </p>
            <form onSubmit={handleSubmit} className="cta-form">
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <button type="submit" disabled={loading}>
                {loading ? "Joining..." : "Request Access"}
              </button>
              {error && <p className="error">{error}</p>}
            </form>
          </>
        )}
      </section>

      <footer className="landing-footer">
        <img src={logo} alt="PaddleRat" className="footer-logo" />
        <p>Platform tennis, coordinated.</p>
      </footer>
    </div>
  );
}
