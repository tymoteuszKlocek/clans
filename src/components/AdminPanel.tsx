import { useState } from "react";
import AdminLogin from "./AdminLogin";
import UserForm from "./UserForm";
import UserList from "./UserList";
import type { UserNode } from "../types";

const AdminPanel = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [editingUser, setEditingUser] = useState<UserNode | null>(null);

  if (!isLoggedIn) {
    return <AdminLogin onLogin={() => setIsLoggedIn(true)} />;
  }

  return (
    <div>
      <UserForm
        onLogout={() => setIsLoggedIn(false)}
        editingUser={editingUser}
        onCancelEdit={() => setEditingUser(null)}
      />
      <div style={{ maxWidth: "700px", margin: "0 auto", padding: "0 40px 40px" }}>
        <h3 style={{ marginBottom: "12px" }}>👥 Existing Users ({editingUser ? "select to edit" : "click Edit"})</h3>
        <UserList onEdit={(user) => {
          setEditingUser(user);
          window.scrollTo({ top: 0, behavior: "smooth" });
        }} />
      </div>
    </div>
  );
};

export default AdminPanel;