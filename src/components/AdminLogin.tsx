import { useState } from "react";

const ADMIN_PASSWORD = "babajaga"; // temp

interface AdminLoginProps {
  onLogin: () => void;
}

const AdminLogin = ({ onLogin }: AdminLoginProps) => {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      onLogin();
    } else {
      setError("Wrong password");
    }
  };

  return (
    <div className="admin-login">
      <h2>🔐 Admin Login</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            placeholder="Enter admin password"
          />
          {error && <div className="error">{error}</div>}
        </div>
        <button type="submit" className="btn-primary">
          🔐 Login
        </button>
      </form>
    </div>
  );
};

export default AdminLogin;