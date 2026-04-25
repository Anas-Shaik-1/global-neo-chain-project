// pages/LoginPage.jsx
import { useState } from "react";

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("admin@company.com");
  const [password, setPassword] = useState("password");
  const [showPass, setShowPass] = useState(false);

  return (
    <div id="loginPage">
      <div className="grid-bg"></div>

      <div className="login-card">
        <div className="login-logo">
          People<span>Core</span>
        </div>

        <div className="lg-group">
          <label>Work Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>

        <div className="lg-group">
          <label>Password</label>
          <div style={{ position: "relative" }}>
            <input
              type={showPass ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            <button
              onClick={() => setShowPass(!showPass)}
              style={{
                position: "absolute",
                right: 10,
                top: "50%",
                transform: "translateY(-50%)",
              }}
            >
              👁
            </button>
          </div>
        </div>

        <button className="btn-login" onClick={onLogin}>
          Sign In →
        </button>
      </div>
    </div>
  );
}
