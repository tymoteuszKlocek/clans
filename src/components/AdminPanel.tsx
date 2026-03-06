import { useState } from "react";
import type { UserNode } from "../types";
import AdminLogin from "./AdminLogin";
import UserForm from "./UserForm";
import UserList from "./UserList";

const AdminPanel = () => {
  const [loggedIn, setLoggedIn] = useState(false);
  const [editingUser, setEditingUser] = useState<UserNode | null>(null);
  const [showForm, setShowForm] = useState(false);

  if (!loggedIn) return <AdminLogin onLogin={() => setLoggedIn(true)} />;

  const handleEdit = (user: UserNode) => {
    setEditingUser(user);
    setShowForm(true);
  };

  const handleDone = () => {
    setEditingUser(null);
    setShowForm(false);
  };

  const hndleLogout = () => {
    setLoggedIn(false);
    setEditingUser(null);
    setShowForm(false);
  }

  return (
    <div style={{ padding: "16px", maxWidth: "600px", margin: "0 auto" }}>
      <button className="btn btn-secondary" onClick={hndleLogout}>Logout</button>
      {!showForm ? (
        <>
          <button
            className="btn-primary"
            onClick={() => { setEditingUser(null); setShowForm(true); }}
            style={{ width: "100%", marginBottom: "16px", padding: "12px", fontSize: "15px" }}
          >
            ＋ Add New User
          </button>
          <UserList onEdit={handleEdit} />
        </>
      ) : (
        <>
          <button
            className="btn-secondary"
            onClick={handleDone}
            style={{ marginBottom: "12px" }}
          >
            ← Back to List
          </button>
          
          <UserForm editingUser={editingUser}  onCancelEdit={handleDone} />
        </>
      )}
    </div>
  );
};

export default AdminPanel;