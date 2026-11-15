
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type User = {
  id: number;
  name: string;
  username: string;
  email: string | null;
  createdAt?: string;
};

export default function Dashboard() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function getToken() {
    return (
      localStorage.getItem("access_token") ||
      sessionStorage.getItem("access_token")
    );
  }

  function clearSession() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("access_token");
    sessionStorage.removeItem("user");
  }

  function clearMessages() {
    setMessage("");
    setError("");
  }

  async function loadProfile(token: string) {
    const response = await fetch(`${API_URL}/users/profile`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Unable to retrieve profile.");
    }

    setUser(data.user);
    setName(data.user.name);
    setUsername(data.user.username);
    setEmail(data.user.email || "");

    return data.user;
  }

  useEffect(() => {
    async function verifyUser() {
      const token = getToken();

      if (!token) {
        router.replace("/");
        return;
      }

      try {
        await loadProfile(token);
      } catch {
        clearSession();
        router.replace("/");
      } finally {
        setLoading(false);
      }
    }

    verifyUser();
  }, [router]);

  async function handleLogout() {
    setLoggingOut(true);

    const token = getToken();

    try {
      if (token) {
        await fetch(`${API_URL}/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch {
      console.error("Logout request failed.");
    } finally {
      clearSession();
      router.replace("/");
    }
  }

  function startEditing() {
    if (!user) return;

    setName(user.name);
    setUsername(user.username);
    setEmail(user.email || "");
    setCurrentPassword("");
    setNewPassword("");
    setEditing(true);
    clearMessages();
  }

  function cancelEditing() {
    if (!user) return;

    setName(user.name);
    setUsername(user.username);
    setEmail(user.email || "");
    setCurrentPassword("");
    setNewPassword("");
    setEditing(false);
    clearMessages();
  }

  async function handleUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    if (newPassword && !currentPassword) {
      setError("Enter your current password to change it.");
      return;
    }

    if (newPassword && newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }

    const token = getToken();

    if (!token) {
      router.replace("/");
      return;
    }

    setSaving(true);

    try {
      const body: {
        name: string;
        username: string;
        email: string;
        currentPassword?: string;
        newPassword?: string;
      } = {
        name,
        username,
        email,
      };

      if (newPassword) {
        body.currentPassword = currentPassword;
        body.newPassword = newPassword;
      }

      const response = await fetch(`${API_URL}/users/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Profile update failed.");
      }

      setUser(data.user);
      setName(data.user.name);
      setUsername(data.user.username);
      setEmail(data.user.email || "");

      setCurrentPassword("");
      setNewPassword("");
      setEditing(false);
      setMessage("Your account has been updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearMessages();

    if (!deletePassword) {
      setError("Please enter your password to delete your account.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to permanently delete your account? This action cannot be undone."
    );

    if (!confirmed) return;

    const token = getToken();

    if (!token) {
      router.replace("/");
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(`${API_URL}/users/profile`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          password: deletePassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Account deletion failed.");
      }

      clearSession();
      router.replace("/");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
      setDeleting(false);
    }
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "13px 15px",
    borderRadius: "12px",
    border: "1px solid rgba(238,229,216,0.2)",
    background: "rgba(255,255,255,0.07)",
    color: "#eee5d8",
    outline: "none",
    fontSize: "14px",
    boxSizing: "border-box",
  };

  const fieldLabel: React.CSSProperties = {
    display: "block",
    fontSize: "11px",
    opacity: 0.65,
    marginBottom: "8px",
    letterSpacing: "1px",
  };

  const actionButton: React.CSSProperties = {
    padding: "12px 22px",
    borderRadius: "25px",
    border: "1px solid rgba(238,229,216,0.3)",
    background: "rgba(255,255,255,0.1)",
    color: "#eee5d8",
    cursor: "pointer",
    fontSize: "12px",
    fontWeight: 600,
    letterSpacing: "1px",
  };

  if (loading) {
    return (
      <main className="auth-page">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />

        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#eee5d8",
            fontSize: "14px",
            letterSpacing: "2px",
          }}
        >
          VERIFYING YOUR SESSION...
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-page">
        <div className="ambient ambient-one" />
        <div className="ambient ambient-two" />

        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: "16px",
            color: "#eee5d8",
          }}
        >
          <h2>Unable to load your account.</h2>
          <button
            className="signin-button"
            onClick={() => router.replace("/")}
          >
            Return to login
          </button>
        </div>
      </main>
    );
  }
  const displayName =
  user.username === "fimperial"
    ? "Sir Fritz"
    : user.name.split(" ")[0];

  return (
    <main className="auth-page dashboard-page">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <div className="geometry geometry-one" />
      <div className="geometry geometry-two" />

      <header className="auth-header dashboard-header">
        <img
          src="/images/CapyLogo.gif"
          alt="Capybara Logo"
          width={150}
          height={110}
          className="auth-logo"
        />

        <button
          className="dashboard-logout"
          onClick={handleLogout}
          disabled={loggingOut}
        >
          {loggingOut ? "Signing out..." : "LOG OUT ↗"}
        </button>
      </header>

      <section
        className="auth-stage dashboard-stage"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          boxSizing: "border-box",
          gap: "24px",
          paddingBottom: "100px",
        }}
      >
        {/* WELCOME PANEL */}
        <div
          className="auth-panel"
          style={{
            width: "100%",
            maxWidth: "1000px",
            minHeight: "460px",
          }}
        >
          <div
            className="login-side"
            style={{
              justifyContent: "center",
            }}
          >
            <div className="login-content">
              <span className="eyebrow">YOUR PERSONAL SPACE</span>

              <h1 style={{ marginBottom: "12px" }}>
                Welcome, {displayName}!
              </h1>

              <p className="login-description">
                You're signed in and ready to go.
              </p>

              <div
                style={{
                  marginTop: "42px",
                  padding: "25px",
                  borderRadius: "20px",
                  background: "rgba(255,255,255,0.07)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  backdropFilter: "blur(20px)",
                }}
              >
                <span
                  className="eyebrow"
                  style={{ display: "block", marginBottom: "20px" }}
                >
                  ACCOUNT INFORMATION
                </span>

                <div style={{ marginBottom: "20px" }}>
                  <p style={{ fontSize: "11px", opacity: 0.55, marginBottom: "6px" }}>
                    FULL NAME
                  </p>
                  <p style={{ fontSize: "16px" }}>{user.name}</p>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <p style={{ fontSize: "11px", opacity: 0.55, marginBottom: "6px" }}>
                    USERNAME
                  </p>
                  <p style={{ fontSize: "16px" }}>{user.username}</p>
                </div>

                <div style={{ marginBottom: "20px" }}>
                  <p style={{ fontSize: "11px", opacity: 0.55, marginBottom: "6px" }}>
                    EMAIL ADDRESS
                  </p>
                  <p style={{ fontSize: "16px", overflowWrap: "anywhere" }}>
                    {user.email || "No email provided"}
                  </p>
                </div>

                <div>
                  <p style={{ fontSize: "11px", opacity: 0.55, marginBottom: "6px" }}>
                    ACCOUNT ID
                  </p>
                  <p style={{ fontSize: "16px" }}>#{user.id}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="welcome-side">
            <div className="welcome-content">
              <span className="eyebrow">CAPY-VERIFIED SESSION</span>

              <h2>You're right where you capy-should be.</h2>

              <p>
                Your account is all settled in, and your session has been
                successfully capy-tured. Welcome back!
              </p>
            </div>

            <span className="welcome-index">03 / DASHBOARD</span>
          </div>
        </div>

        {/* ACCOUNT MANAGEMENT */}
        <div
          className="dashboard-glass-card"
          style={{
            width: "100%",
            maxWidth: "1000px",
            padding: "32px",
            boxSizing: "border-box",
            borderRadius: "24px",
            color: "#eee5d8",
          }}
        >
          <span className="eyebrow">ACCOUNT SETTINGS</span>

          <h2 style={{ fontSize: "26px", marginTop: "12px" }}>
            Manage your account.
          </h2>

          <p
            style={{
              fontSize: "13px",
              opacity: 0.65,
              marginTop: "8px",
              marginBottom: "25px",
            }}
          >
            Keep your personal information up to date.
          </p>

          {message && (
            <p
              style={{
                padding: "13px",
                borderRadius: "10px",
                background: "rgba(80,180,120,0.15)",
                border: "1px solid rgba(100,220,150,0.3)",
                color: "#a8e6bd",
                fontSize: "13px",
                marginBottom: "20px",
              }}
            >
              {message}
            </p>
          )}

          {error && (
            <p
              style={{
                padding: "13px",
                borderRadius: "10px",
                background: "rgba(220,70,70,0.12)",
                border: "1px solid rgba(255,100,100,0.3)",
                color: "#ffaaaa",
                fontSize: "13px",
                marginBottom: "20px",
              }}
            >
              {error}
            </p>
          )}

          {/* EDIT ACCOUNT BUTTON */}
          <div
            className={`dashboard-edit-toggle ${
              editing ? "is-hidden" : ""
            }`}
            aria-hidden={editing}
          >
            <button
              className="dashboard-action-button"
              type="button"
              onClick={startEditing}
              style={actionButton}
              tabIndex={editing ? -1 : 0}
            >
              EDIT ACCOUNT ↗
            </button>
          </div>

          {/* EXPANDING EDIT FORM */}
          <div
            className={`dashboard-edit-expand ${
              editing ? "is-open" : ""
            }`}
            aria-hidden={!editing}
          >
            <div className="dashboard-edit-expand-inner">
              <form onSubmit={handleUpdate}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "20px",
                  }}
                >
                  <div>
                    <label style={fieldLabel}>FULL NAME</label>
                    <input
                      style={inputStyle}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      minLength={2}
                      maxLength={100}
                      disabled={!editing}
                    />
                  </div>

                  <div>
                    <label style={fieldLabel}>USERNAME</label>
                    <input
                      style={inputStyle}
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      minLength={3}
                      maxLength={50}
                      disabled={!editing}
                    />
                  </div>

                  <div style={{ gridColumn: "1 / -1" }}>
                    <label style={fieldLabel}>EMAIL ADDRESS</label>
                    <input
                      type="email"
                      style={inputStyle}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      maxLength={150}
                      disabled={!editing}
                    />
                  </div>
                </div>

                <div
                  style={{
                    marginTop: "30px",
                    paddingTop: "25px",
                    borderTop: "1px solid rgba(238,229,216,0.15)",
                  }}
                >
                  <span className="eyebrow">PASSWORD SECURITY</span>

                  <p
                    style={{
                      fontSize: "12px",
                      opacity: 0.6,
                      marginTop: "8px",
                      marginBottom: "18px",
                    }}
                  >
                    Leave these fields empty if you don't want to change
                    your password.
                  </p>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "20px",
                    }}
                  >
                    <div>
                      <label style={fieldLabel}>CURRENT PASSWORD</label>
                      <input
                        type="password"
                        style={inputStyle}
                        value={currentPassword}
                        onChange={(e) =>
                          setCurrentPassword(e.target.value)
                        }
                        autoComplete="current-password"
                        disabled={!editing}
                      />
                    </div>

                    <div>
                      <label style={fieldLabel}>NEW PASSWORD</label>
                      <input
                        type="password"
                        style={inputStyle}
                        value={newPassword}
                        onChange={(e) =>
                          setNewPassword(e.target.value)
                        }
                        minLength={8}
                        autoComplete="new-password"
                        disabled={!editing}
                      />
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    flexWrap: "wrap",
                    marginTop: "25px",
                  }}
                >
                  <button
                    className="dashboard-action-button"
                    type="submit"
                    disabled={saving || !editing}
                    style={actionButton}
                  >
                    {saving ? "SAVING..." : "SAVE CHANGES ↗"}
                  </button>

                  <button
                    className="dashboard-action-button"
                    type="button"
                    onClick={cancelEditing}
                    disabled={saving || !editing}
                    style={actionButton}
                  >
                    CANCEL
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

        {/* DELETE ACCOUNT */}
        <div
          className="dashboard-danger-card"
          style={{
            width: "100%",
            maxWidth: "1000px",
            padding: "28px 32px",
            boxSizing: "border-box",
            borderRadius: "24px",
            color: "#eee5d8",
          }}
        >
          <span
            className="eyebrow"
            style={{ color: "#ffaaaa" }}
          >
            DANGER ZONE
          </span>

          <h2 style={{ fontSize: "22px", marginTop: "12px" }}>
            Delete your account.
          </h2>

          <p
            style={{
              fontSize: "13px",
              opacity: 0.65,
              marginTop: "8px",
              marginBottom: "20px",
            }}
          >
            This permanently deletes your account and cannot be undone.
          </p>

          <form
            onSubmit={handleDelete}
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "12px",
              alignItems: "end",
            }}
          >
            <div style={{ flex: "1 1 230px" }}>
              <label style={fieldLabel}>CONFIRM YOUR PASSWORD</label>
              <input
                type="password"
                style={inputStyle}
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <button
              className="dashboard-delete-button"
              type="submit"
              disabled={deleting}
              style={{
                ...actionButton,
                background: "rgba(180,45,45,0.25)",
                border: "1px solid rgba(255,120,120,0.4)",
                color: "#ffbaba",
              }}
            >
              {deleting ? "DELETING..." : "DELETE ACCOUNT"}
            </button>
          </form>
        </div>

        <p
          style={{
            color: "#eee5d8",
            opacity: 0.5,
            fontSize: "11px",
            letterSpacing: "1px",
            textAlign: "center",
          }}
        >
          YOUR SPACE. YOUR ACCOUNT. YOUR EXPERIENCE.
        </p>
      </section>

      <footer className="auth-footer dashboard-footer">
        <span>© 2026. All rights reserved.</span>

        <div>
          <span>SECURE SESSION</span>
        </div>
      </footer>
    </main>
  );
}
