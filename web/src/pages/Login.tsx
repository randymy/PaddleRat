import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { login as apiLogin, verify as apiVerify } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // If we have a token in the URL, verify it
  const urlToken = params.get("token");
  if (urlToken) {
    apiVerify(urlToken).then(({ token, user }) => {
      login(token, user);
      navigate("/");
    }).catch(() => setError("Invalid or expired link"));
    return <div className="page"><p>Verifying...</p></div>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await apiLogin(email);
      setSent(true);
      // Dev: if the response includes a dev link, auto-verify
      if (res._dev_link) {
        const token = res._dev_link.split("token=")[1];
        const verifyRes = await apiVerify(token);
        login(verifyRes.token, verifyRes.user);
        window.location.href = "/";
        return;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="page">
        <h1>Check Your Email</h1>
        <p>We sent a login link to <strong>{email}</strong>.</p>
        <p>Click the link to sign in.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>PaddleRats</h1>
      <p>Sign in to coordinate your next session.</p>
      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Sending..." : "Send Login Link"}
        </button>
      </form>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
