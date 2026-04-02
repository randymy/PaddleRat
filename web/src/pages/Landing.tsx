import { useState } from "react";
import { Link } from "react-router-dom";
import ratkingImg from "../assets/ratking.png";

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
        <span className="landing-logo">PaddleRat</span>
        <Link to="/login" className="landing-login">Log In</Link>
      </nav>

      <section className="hero-section">
        <img src={ratkingImg} alt="The Rat King and his Paddle Rats" className="hero-image" />
        <h1 className="hero-title">
          Court booked.<br />
          Need 3 more players.<br />
          <span className="hero-accent">Now.</span>
        </h1>
        <p className="hero-sub">
          PaddleRat fills your platform tennis sessions in minutes.
          Send a text, get a Y, hit the courts.
        </p>
      </section>

      <section className="how-section">
        <div className="how-step">
          <div className="step-number">1</div>
          <h3>Share a link</h3>
          <p>Drop your invite link in the group chat. Friends tap it and join your network in seconds.</p>
        </div>
        <div className="how-step">
          <div className="step-number">2</div>
          <h3>Create a session</h3>
          <p>Pick a court, set the time, choose who to invite. One tap sends the texts.</p>
        </div>
        <div className="how-step">
          <div className="step-number">3</div>
          <h3>They reply Y</h3>
          <p>First to respond get the spot. Everyone gets a confirmation with a calendar link. Done.</p>
        </div>
      </section>

      <section className="cta-section" id="signup">
        {submitted ? (
          <div className="cta-success">
            <h2>You're on the list!</h2>
            <p>{message}</p>
          </div>
        ) : (
          <>
            <h2>Become a RatKing</h2>
            <p className="cta-sub">
              We're letting in a handful of organizers to start.
              Sign up and we'll send you a login link when it's your turn.
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

      <section className="features-section">
        <div className="feature">
          <h3>No app install</h3>
          <p>Your friends just reply to a text. No downloads, no accounts, no friction.</p>
        </div>
        <div className="feature">
          <h3>PTI built in</h3>
          <p>Every player's rating is right there. Build balanced matches effortlessly.</p>
        </div>
        <div className="feature">
          <h3>Calendar links</h3>
          <p>Session fills up? Everyone gets a confirmation with a one-tap calendar add.</p>
        </div>
      </section>

      <footer className="landing-footer">
        <p>PaddleRat &mdash; Platform tennis, coordinated.</p>
      </footer>
    </div>
  );
}
