import { useState } from "react";
import { useGraphData } from "../hooks/useGraphData";
import type { UserNode } from "../types";

interface UserListProps {
  onEdit: (user: UserNode) => void;
}

const UserList = ({ onEdit }: UserListProps) => {
  const { users } = useGraphData();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = users.filter((u) => {
    const full = `${u.name} ${u.surname} ${u.city || ""}`.toLowerCase();
    return full.includes(search.toLowerCase());
  });

  const handleSelect = (user: UserNode) => {
    setSelectedId(user.id === selectedId ? null : user.id);
    onEdit(user);
  };

  const handleEdit = (user: UserNode) => {
    setSelectedId(user.id);
    onEdit(user);
  };

  return (
    <div>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="🔍 Search users..."
        style={{
          width: "100%",
          padding: "10px 12px",
          border: "1px solid #ddd",
          borderRadius: "6px",
          fontSize: "14px",
          marginBottom: "12px",
          boxSizing: "border-box",
        }}
      />

      {filtered.length === 0 ? (
        <p style={{ color: "#888", fontSize: "13px" }}>No users found.</p>
      ) : (
        <div style={{ maxHeight: "400px", overflowY: "auto" }}>
          {filtered.map((user) => (
            <div
              key={user.id}
              className={`user-list-item${selectedId === user.id ? " selected" : ""}`}
              onClick={() => handleSelect(user)}
            >
              <div className="user-name">
                {user.gender === "male" ? "♂ " : user.gender === "female" ? "♀ " : ""}
                {user.name} {user.surname}
                {user.maidenName && (
                  <span style={{ color: "#999", fontWeight: 400, marginLeft: "4px" }}>
                    (née {user.maidenName})
                  </span>
                )}
                {user.city && (
                  <span style={{ color: "#888", fontWeight: 400, marginLeft: "8px", fontSize: "12px" }}>
                    📍 {user.city}
                  </span>
                )}
              </div>
              <button
                className="btn-secondary"
                onClick={(e) => {
                  e.stopPropagation();
                  handleEdit(user);
                }}
              >
                ✏️ Edit
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserList;