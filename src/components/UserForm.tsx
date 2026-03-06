import { useState, useEffect } from "react";
import { collection, addDoc, doc, updateDoc, getDocs, query, where, deleteDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { useGraphData } from "../hooks/useGraphData";
import UserSearch from "./UserSearch";
import type { UserNode } from "../types";


interface PendingEdge {
  targetId: string;
  type: "family" | "community";
}

interface UserFormProps {
  onLogout: () => void;
  editingUser: UserNode | null;
  onCancelEdit: () => void;
}

const EMPTY_FORM = {
  name: "",
  surname: "",
  dateOfBirth: "",
  city: "",
  community: "",
  otherInfo: "",
  fatherId: "",
  motherId: "",
  maidenName: "",
  gender: "",
  spouseId: "",
};

const UserForm = ({ onLogout, editingUser, onCancelEdit }: UserFormProps) => {
  const { users, edges } = useGraphData();
  const [form, setForm] = useState(EMPTY_FORM);
  const [pendingEdges, setPendingEdges] = useState<PendingEdge[]>([]);
  const [edgeTarget, setEdgeTarget] = useState("");
  const [edgeType, setEdgeType] = useState<"family" | "community">("family");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  // Load user data when editing
  useEffect(() => {
    if (editingUser) {
      setForm({
        name: editingUser.name,
        surname: editingUser.surname,
        dateOfBirth: editingUser.dateOfBirth || "",
        city: editingUser.city || "",
        community: editingUser.community || "",
        otherInfo: editingUser.otherInfo || "",
        fatherId: editingUser.fatherId || "",
        motherId: editingUser.motherId || "",
        maidenName: editingUser.maidenName || "",
        gender: editingUser.gender || "",
        spouseId: form.spouseId || "",
      });

      // Load existing non-parent edges for this user
      const userEdges = edges.filter(
        (e) =>
          (e.source === editingUser.id || e.target === editingUser.id) &&
          e.label !== "father" &&
          e.label !== "mother"
      );
      setPendingEdges(
        userEdges.map((e) => ({
          targetId: e.source === editingUser.id ? e.target : e.source,
          type: e.type,
        }))
      );
    } else {
      setForm(EMPTY_FORM);
      setPendingEdges([]);
    }
  }, [editingUser, edges]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const addEdge = () => {
    if (!edgeTarget) return;
    if (editingUser && edgeTarget === editingUser.id) return;
    if (pendingEdges.some((e) => e.targetId === edgeTarget)) return;
    setPendingEdges([...pendingEdges, { targetId: edgeTarget, type: edgeType }]);
    setEdgeTarget("");
  };

  const removeEdge = (targetId: string) => {
    setPendingEdges(pendingEdges.filter((e) => e.targetId !== targetId));
  };

  const getUserLabel = (id: string) => {
    const user = users.find((u) => u.id === id);
    return user ? `${user.name} ${user.surname}` : id;
  };

  const deleteUserEdges = async (userId: string) => {
    const edgesRef = collection(db, "edges");

    const q1 = query(edgesRef, where("source", "==", userId));
    const snap1 = await getDocs(q1);
    for (const d of snap1.docs) await deleteDoc(d.ref);

    const q2 = query(edgesRef, where("target", "==", userId));
    const snap2 = await getDocs(q2);
    for (const d of snap2.docs) await deleteDoc(d.ref);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.surname.trim()) return;

    setSaving(true);
    try {
      const userData = {
        name: form.name.trim(),
        surname: form.surname.trim(),
        dateOfBirth: form.dateOfBirth || null,
        city: form.city.trim() || null,
        community: form.community.trim() || null,
        otherInfo: form.otherInfo.trim() || null,
        fatherId: form.fatherId || null,
        motherId: form.motherId || null,
        maidenName: form.maidenName || "",
        gender: form.gender || "",
        spouseId: form.spouseId || "",
      };

      let userId: string;

      if (editingUser) {
        // Update existing user
        userId = editingUser.id;
        await updateDoc(doc(db, "users", userId), userData);

        // Delete old edges and recreate
        await deleteUserEdges(userId);
      } else {
        // Create new user
        const userDoc = await addDoc(collection(db, "users"), userData);
        userId = userDoc.id;
      }

      // Create parent edges
      if (form.fatherId) {
        await addDoc(collection(db, "edges"), {
          source: form.fatherId,
          target: userId,
          type: "family",
          label: "father",
        });
      }
      if (form.motherId) {
        await addDoc(collection(db, "edges"), {
          source: form.motherId,
          target: userId,
          type: "family",
          label: "mother",
        });
      }

      // Create other edges
      for (const edge of pendingEdges) {
        await addDoc(collection(db, "edges"), {
          source: userId,
          target: edge.targetId,
          type: edge.type,
        });
      }

      const label = `${form.name} ${form.surname}`;
      setForm(EMPTY_FORM);
      setPendingEdges([]);
      setSuccess(editingUser ? `✅ ${label} updated!` : `✅ ${label} added!`);
      onCancelEdit();
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      console.error("Error saving user:", err);
    } finally {
      setSaving(false);
    }
  };

  // Filter out the editing user from search lists
  const availableUsers = editingUser
    ? users.filter((u) => u.id !== editingUser.id)
    : users;

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>{editingUser ? "✏️ Edit User" : "➕ Add New User"}</h2>
        <button className="btn btn-secondary" onClick={onLogout}>Logout</button>
      </div>

      {success && (
        <div style={{ background: "#d4edda", color: "#155724", padding: "10px 14px", borderRadius: "6px", marginBottom: "16px" }}>
          {success}
        </div>
      )}

      {editingUser && (
        <div style={{ marginBottom: "16px" }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancelEdit}
            style={{ marginLeft: 0 }}
          >
            ← Back to Add New User
          </button>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label>Name *</label>
            <input name="name" value={form.name} onChange={handleChange} required />
          </div>
          <div className="form-group">
            <label>Surname *</label>
            <input name="surname" value={form.surname} onChange={handleChange} required />
          </div>
        </div>

        {/* <div className="form-row">
          <div className="form-group">
            <label>Date of Birth</label>
            <input name="dateOfBirth" type="date" value={form.dateOfBirth} onChange={handleChange} />
          </div>
          <div className="form-group">
            <label>City</label>
            <input name="city" value={form.city} onChange={handleChange} />
          </div>
        </div> */}

        <div className="form-group">
          <label>Gender *</label>
          <div style={{ display: "flex", gap: "16px", padding: "8px 0" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="radio"
                name="gender"
                value="male"
                checked={form.gender === "male"}
                onChange={() => setForm({ ...form, gender: "male" })}
              />
              ♂ Male
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
              <input
                type="radio"
                name="gender"
                value="female"
                checked={form.gender === "female"}
                onChange={() => setForm({ ...form, gender: "female" })}
              />
              ♀ Female
            </label>
          </div>
        </div>

        <div className="form-group">
          <label>Maiden Name (birth surname)</label>
          <input
            type="text"
            value={form.maidenName}
            onChange={(e) => setForm({ ...form, maidenName: e.target.value })}
            placeholder="e.g. Marszałek"
          />
        </div>

        <div className="form-group">
          <label>💍 Spouse</label>
          <UserSearch
            users={users}
            value={form.spouseId}
            onChange={(id) => setForm({ ...form, spouseId: id })}
            placeholder="Search spouse..."
          />
        </div>

        {/* <div className="form-group">
          <label>Community</label>
          <input name="community" value={form.community} onChange={handleChange} />
        </div>

        <div className="form-group">
          <label>Other Info</label>
          <textarea name="otherInfo" value={form.otherInfo} onChange={handleChange} />
        </div> */}

        <h3 style={{ margin: "20px 0 10px" }}>👨‍👩‍👧 Parents</h3>

        <div className="form-row">
          <div className="form-group">
            <label>Father</label>
            <UserSearch
              users={availableUsers}
              value={form.fatherId}
              onChange={(id) => setForm({ ...form, fatherId: id })}
              placeholder="Search father..."
            />
          </div>
          <div className="form-group">
            <label>Mother</label>
            <UserSearch
              users={availableUsers}
              value={form.motherId}
              onChange={(id) => setForm({ ...form, motherId: id })}
              placeholder="Search mother..."
            />
          </div>
        </div>

        {/* <h3 style={{ margin: "20px 0 10px" }}>🔗 Other Connections</h3> */}

        {availableUsers.length > 0 ? (
          <>
            {/* <div className="edge-row">
              <div style={{ flex: 1 }}>
                <UserSearch
                  users={availableUsers}
                  value={edgeTarget}
                  onChange={setEdgeTarget}
                  placeholder="Search user..."
                />
              </div>
              <select value={edgeType} onChange={(e) => setEdgeType(e.target.value as "family" | "community")}>
                <option value="family">Family</option>
                <option value="community">Community</option>
              </select>
              <button type="button" onClick={addEdge}>+</button>
            </div> */}

            {pendingEdges.length > 0 && (
              <ul style={{ listStyle: "none", padding: 0, marginBottom: "14px" }}>
                {pendingEdges.map((edge) => (
                  <li
                    key={edge.targetId}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      background: "#f5f5f5",
                      borderRadius: "6px",
                      marginBottom: "4px",
                      fontSize: "13px",
                    }}
                  >
                    <span>
                      {getUserLabel(edge.targetId)}{" "}
                      <span style={{ color: edge.type === "family" ? "#e94560" : "#0f3460", fontWeight: 600 }}>
                        ({edge.type})
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEdge(edge.targetId)}
                      style={{ background: "none", border: "none", color: "#e94560", cursor: "pointer", fontSize: "16px" }}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p style={{ color: "#888", fontSize: "13px", marginBottom: "14px" }}>
            No existing users to connect to yet.
          </p>
        )}

        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? "Saving..." : editingUser ? "Update User" : "Add User"}
        </button>
      </form>
    </div>
  );
};

export default UserForm;