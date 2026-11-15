
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type User = {
  id: number;
  name: string;
  username: string;
  email: string | null;
  role: "admin" | "user";
  createdAt?: string;
};

export default function AdminDashboard() {
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    newPassword: "",
  });

  const getToken = () =>
    localStorage.getItem("access_token") ||
    sessionStorage.getItem("access_token");

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      if (!token) {
        router.replace("/");
        return;
      }

      const profileResponse = await fetch(
        `${API_URL}/users/profile`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!profileResponse.ok) {
        router.replace("/login");
        return;
      }

      const profileData = await profileResponse.json();
      const currentUser = profileData.user;

      if (currentUser?.role !== "admin") {
        router.replace("/dashboard");
        return;
      }

      const response = await fetch(`${API_URL}/users/admin`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Unable to retrieve accounts.");
      }

      const data = await response.json();
      setUsers(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    const value = search.toLowerCase();

    return users.filter((user) =>
      [
        user.name,
        user.username,
        user.email || "",
        user.role,
      ].some((field) => field.toLowerCase().includes(value))
    );
  }, [users, search]);

  const openEdit = (user: User) => {
    setEditingUser(user);

    setForm({
      name: user.name,
      username: user.username,
      email: user.email || "",
      newPassword: "",
    });
  };

  const saveUser = async () => {
    if (!editingUser) return;

    if (
      !form.name.trim() ||
      !form.username.trim()
    ) {
      alert("Name and username are required.");
      return;
    }

    try {
      setSaving(true);

      const token = getToken();

      const payload: {
        name: string;
        username: string;
        email: string;
        newPassword?: string;
      } = {
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
      };

      if (form.newPassword.trim()) {
        payload.newPassword = form.newPassword;
      }

      const response = await fetch(
        `${API_URL}/users/admin/${editingUser.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to update account."
        );
      }

      setEditingUser(null);
      await loadUsers();

      alert("Account updated successfully!");
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (user: User) => {
    if (user.role === "admin") {
      alert("Admin accounts cannot be deleted here.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${user.name}'s account? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      const token = getToken();

      const response = await fetch(
        `${API_URL}/users/admin/${user.id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to delete account."
        );
      }

      setUsers((previous) =>
        previous.filter((item) => item.id !== user.id)
      );

      alert("Account deleted successfully!");
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    }
  };

  const logout = () => {
    localStorage.removeItem("access_token");
    sessionStorage.removeItem("access_token");
    router.replace("/login");
  };

  const adminCount = users.filter(
    (user) => user.role === "admin"
  ).length;

  const userCount = users.filter(
    (user) => user.role === "user"
  ).length;

  if (loading) {
    return (
      <main className="admin-loading">
        <div className="admin-loader" />
        <p>Loading Admin Dashboard...</p>

        <style jsx>{`
          .admin-loading {
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            gap: 16px;
            background: #241a14;
            color: #f3ede3;
          }

          .admin-loader {
            width: 38px;
            height: 38px;
            border: 3px solid rgba(220,203,181,.2);
            border-top-color: #cbbba6;
            border-radius: 50%;
            animation: spin .8s linear infinite;
          }

          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <div className="admin-container">
        <header className="admin-header">
          <div>
            <p className="admin-eyebrow">
              CAPYBARA AUTHENTICATION
            </p>
            <h1>Admin Dashboard</h1>
            <p className="admin-subtitle">
              Manage and monitor registered accounts.
            </p>
          </div>

          <div className="header-actions">
            <button
              className="back-button"
              onClick={() => router.push("/dashboard")}
            >
              ← Dashboard
            </button>

            <button
              className="logout-button"
              onClick={logout}
            >
              Log out
            </button>
          </div>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <span>Total Accounts</span>
            <strong>{users.length}</strong>
            <small>All registered accounts</small>
          </div>

          <div className="stat-card">
            <span>Administrators</span>
            <strong>{adminCount}</strong>
            <small>Privileged accounts</small>
          </div>

          <div className="stat-card">
            <span>Regular Users</span>
            <strong>{userCount}</strong>
            <small>Standard accounts</small>
          </div>
        </section>

        <section className="accounts-panel">
          <div className="panel-heading">
            <div>
              <h2>Registered Accounts</h2>
              <p>View and manage all user accounts.</p>
            </div>

            <button
              className="refresh-button"
              onClick={loadUsers}
            >
              ↻ Refresh
            </button>
          </div>

          <div className="search-wrapper">
            <span>⌕</span>
            <input
              type="text"
              placeholder="Search name, username, email, or role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {error && (
            <div className="error-message">{error}</div>
          )}

          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>ACCOUNT</th>
                  <th>USERNAME</th>
                  <th>EMAIL</th>
                  <th>ROLE</th>
                  <th>DATE CREATED</th>
                  <th>ACTIONS</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="account-name">
                        <div className="avatar">
                          {user.name.charAt(0).toUpperCase()}
                        </div>

                        <div>
                          <strong>{user.name}</strong>
                          <small>ID #{user.id}</small>
                        </div>
                      </div>
                    </td>

                    <td>@{user.username}</td>

                    <td>{user.email || "No email"}</td>

                    <td>
                      <span
                        className={`role-badge ${user.role}`}
                      >
                        {user.role}
                      </span>
                    </td>

                    <td>
                      {user.createdAt
                        ? new Date(user.createdAt).toLocaleDateString()
                        : "—"}
                    </td>

                    <td>
                      <div className="action-buttons">
                        <button
                          className="edit-button"
                          onClick={() => openEdit(user)}
                        >
                          Edit
                        </button>

                        <button
                          className="delete-button"
                          disabled={user.role === "admin"}
                          onClick={() => deleteUser(user)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="empty-state">
                      No accounts found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {editingUser && (
        <div
          className="modal-overlay"
          onClick={() => setEditingUser(null)}
        >
          <div
            className="edit-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <p>ACCOUNT MANAGEMENT</p>
                <h2>Edit Account</h2>
              </div>

              <button
                className="close-button"
                onClick={() => setEditingUser(null)}
              >
                ×
              </button>
            </div>

            <label>Full Name</label>
            <input
              value={form.name}
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
            />

            <label>Username</label>
            <input
              value={form.username}
              onChange={(e) =>
                setForm({ ...form, username: e.target.value })
              }
            />

            <label>Email Address</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
            />

            <label>New Password</label>
            <input
              type="password"
              placeholder="Leave blank to keep current password"
              value={form.newPassword}
              onChange={(e) =>
                setForm({
                  ...form,
                  newPassword: e.target.value,
                })
              }
            />

            <div className="modal-note">
              Account role: <strong>{editingUser.role}</strong>
              <br />
              Password changes are optional.
            </div>

            <div className="modal-actions">
              <button
                className="cancel-button"
                onClick={() => setEditingUser(null)}
                disabled={saving}
              >
                Cancel
              </button>

              <button
                className="save-button"
                onClick={saveUser}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .admin-page {
          min-height: 100vh;
          padding: 55px 24px;
          background: #241a14;
          color: #f3ede3;
        }

        .admin-container {
          width: 100%;
          max-width: 1450px;
          margin: auto;
        }

        .admin-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 35px;
        }

        .admin-eyebrow {
          color: #bda68d;
          font-size: 11px;
          letter-spacing: 3px;
          font-weight: 700;
        }

        h1 {
          font-size: clamp(30px, 4vw, 43px);
          margin: 10px 0;
          font-weight: 800;
        }

        .admin-subtitle,
        .panel-heading p {
          color: #ad9b89;
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 10px;
        }

        button {
          cursor: pointer;
          font: inherit;
          transition: .25s ease;
        }

        .back-button,
        .logout-button,
        .refresh-button {
          padding: 11px 17px;
          border-radius: 13px;
          color: #f3ede3;
          background: rgba(220,203,181,.08);
          border: 1px solid rgba(220,203,181,.15);
        }

        .back-button:hover,
        .refresh-button:hover {
          background: rgba(220,203,181,.17);
          transform: translateY(-2px);
        }

        .logout-button {
          background: rgba(173,91,70,.15);
          border-color: rgba(173,91,70,.3);
        }

        .logout-button:hover {
          background: rgba(173,91,70,.3);
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 18px;
          margin-bottom: 25px;
        }

        .stat-card,
        .accounts-panel {
          background: rgba(255,255,255,.045);
          border: 1px solid rgba(220,203,181,.13);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border-radius: 20px;
          box-shadow: 0 12px 35px rgba(0,0,0,.12);
        }

        .stat-card {
          padding: 25px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .stat-card span {
          color: #bda994;
          font-size: 13px;
        }

        .stat-card strong {
          font-size: 34px;
        }

        .stat-card small {
          color: #8f7e6d;
        }

        .accounts-panel {
          padding: 28px;
        }

        .panel-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          margin-bottom: 23px;
        }

        .panel-heading h2 {
          font-size: 21px;
          margin-bottom: 7px;
        }

        .search-wrapper {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 0 16px;
          height: 48px;
          background: rgba(0,0,0,.17);
          border: 1px solid rgba(220,203,181,.13);
          border-radius: 12px;
          margin-bottom: 22px;
          color: #bda994;
        }

        .search-wrapper input {
          width: 100%;
          border: none;
          outline: none;
          background: transparent;
          color: #f3ede3;
          font-size: 13px;
        }

        .table-wrapper {
          width: 100%;
          overflow-x: auto;
        }

        table {
          width: 100%;
          min-width: 850px;
          border-collapse: collapse;
          text-align: left;
        }

        th {
          padding: 15px 12px;
          font-size: 10px;
          letter-spacing: 1px;
          color: #9d8975;
          border-bottom: 1px solid rgba(220,203,181,.13);
        }

        td {
          padding: 17px 12px;
          font-size: 12px;
          color: #d7c9b9;
          border-bottom: 1px solid rgba(220,203,181,.08);
        }

        tbody tr:hover {
          background: rgba(220,203,181,.035);
        }

        .account-name {
          display: flex;
          align-items: center;
          gap: 11px;
        }

        .account-name strong,
        .account-name small {
          display: block;
        }

        .account-name strong {
          color: #f3ede3;
          font-size: 12px;
        }

        .account-name small {
          color: #8f7e6d;
          margin-top: 5px;
        }

        .avatar {
          width: 34px;
          height: 34px;
          display: grid;
          place-items: center;
          flex-shrink: 0;
          border-radius: 11px;
          background: rgba(203,187,166,.16);
          color: #e0cbb3;
          font-weight: 700;
        }

        .role-badge {
          display: inline-block;
          padding: 6px 10px;
          border-radius: 20px;
          text-transform: capitalize;
          font-size: 10px;
          font-weight: 700;
        }

        .role-badge.admin {
          background: rgba(190,148,93,.15);
          color: #e6bd82;
        }

        .role-badge.user {
          background: rgba(112,155,127,.13);
          color: #a5d0ad;
        }

        .action-buttons {
          display: flex;
          gap: 7px;
        }

        .edit-button,
        .delete-button {
          padding: 7px 11px;
          border-radius: 8px;
          font-size: 11px;
          border: 1px solid transparent;
        }

        .edit-button {
          color: #e4c69e;
          background: rgba(190,148,93,.13);
          border-color: rgba(190,148,93,.2);
        }

        .edit-button:hover {
          background: rgba(190,148,93,.28);
        }

        .delete-button {
          color: #e69a8a;
          background: rgba(173,91,70,.13);
          border-color: rgba(173,91,70,.2);
        }

        .delete-button:hover:not(:disabled) {
          background: rgba(173,91,70,.28);
        }

        .delete-button:disabled {
          opacity: .3;
          cursor: not-allowed;
        }

        .empty-state {
          padding: 40px;
          text-align: center;
          color: #9d8975;
        }

        .error-message {
          padding: 13px;
          margin-bottom: 18px;
          border-radius: 10px;
          color: #f0a69a;
          background: rgba(173,91,70,.13);
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 100;
          display: grid;
          place-items: center;
          padding: 20px;
          background: rgba(0,0,0,.68);
          backdrop-filter: blur(8px);
        }

        .edit-modal {
          width: 100%;
          max-width: 470px;
          max-height: 90vh;
          overflow-y: auto;
          padding: 28px;
          border-radius: 22px;
          background: #30231b;
          border: 1px solid rgba(220,203,181,.2);
          box-shadow: 0 25px 80px rgba(0,0,0,.4);
          animation: appear .25s ease;
        }

        @keyframes appear {
          from {
            opacity: 0;
            transform: translateY(12px) scale(.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .modal-heading {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
        }

        .modal-heading p {
          font-size: 10px;
          letter-spacing: 2px;
          color: #bda68d;
          margin-bottom: 8px;
        }

        .modal-heading h2 {
          font-size: 23px;
        }

        .close-button {
          width: 35px;
          height: 35px;
          border: 0;
          border-radius: 10px;
          background: rgba(255,255,255,.08);
          color: #f3ede3;
          font-size: 23px;
        }

        .edit-modal label {
          display: block;
          margin: 15px 0 8px;
          font-size: 12px;
          color: #cbbba6;
        }

        .edit-modal input {
          width: 100%;
          padding: 13px;
          border: 1px solid rgba(220,203,181,.16);
          border-radius: 11px;
          outline: none;
          background: rgba(0,0,0,.2);
          color: #f3ede3;
          font-size: 13px;
        }

        .edit-modal input:focus {
          border-color: #bda68d;
        }

        .modal-note {
          margin-top: 18px;
          padding: 13px;
          border-radius: 10px;
          background: rgba(255,255,255,.04);
          color: #ad9b89;
          font-size: 11px;
          line-height: 1.8;
        }

        .modal-note strong {
          color: #e6bd82;
          text-transform: capitalize;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          margin-top: 23px;
        }

        .cancel-button,
        .save-button {
          padding: 11px 16px;
          border-radius: 10px;
          font-size: 12px;
        }

        .cancel-button {
          color: #d7c9b9;
          background: rgba(255,255,255,.07);
          border: 1px solid rgba(255,255,255,.1);
        }

        .save-button {
          color: #241a14;
          background: #cbbba6;
          border: 1px solid #cbbba6;
          font-weight: 700;
        }

        .save-button:hover:not(:disabled) {
          background: #e0cbb3;
          transform: translateY(-2px);
        }

        button:disabled {
          opacity: .6;
          cursor: not-allowed;
        }

        @media (max-width: 750px) {
          .admin-page {
            padding: 30px 14px;
          }

          .admin-header {
            align-items: flex-start;
            flex-direction: column;
          }

          .stats-grid {
            grid-template-columns: 1fr;
          }

          .accounts-panel {
            padding: 18px;
          }

          .panel-heading {
            align-items: flex-start;
          }
        }

        @media (max-width: 430px) {
          .header-actions {
            width: 100%;
          }

          .header-actions button {
            flex: 1;
          }

          .panel-heading {
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
