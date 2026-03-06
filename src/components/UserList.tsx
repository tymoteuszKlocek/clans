import { useState } from "react";
import { useGraphData } from "../hooks/useGraphData";
import type { UserNode } from "../types";
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";

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

    const handleDelete = async (user: UserNode) => {
        const name = `${user.name} ${user.surname}`;
        if (!window.confirm(`Delete ${name}? This will also remove all their edges.`)) return;

        try {
            // 1. Delete all edges where this user is source or target
            const edgesRef = collection(db, "edges");

            const srcQuery = query(edgesRef, where("source", "==", user.id));
            const srcSnap = await getDocs(srcQuery);
            srcSnap.forEach((d) => deleteDoc(d.ref));

            const tgtQuery = query(edgesRef, where("target", "==", user.id));
            const tgtSnap = await getDocs(tgtQuery);
            tgtSnap.forEach((d) => deleteDoc(d.ref));

            // 2. Clear fatherId/motherId/spouseId references in other users
            const usersRef = collection(db, "users");

            const fatherQuery = query(usersRef, where("fatherId", "==", user.id));
            const fatherSnap = await getDocs(fatherQuery);
            fatherSnap.forEach((d) => updateDoc(d.ref, { fatherId: "" }));

            const motherQuery = query(usersRef, where("motherId", "==", user.id));
            const motherSnap = await getDocs(motherQuery);
            motherSnap.forEach((d) => updateDoc(d.ref, { motherId: "" }));

            const spouseQuery = query(usersRef, where("spouseId", "==", user.id));
            const spouseSnap = await getDocs(spouseQuery);
            spouseSnap.forEach((d) => updateDoc(d.ref, { spouseId: "" }));

            // 3. Delete the user doc
            await deleteDoc(doc(db, "users", user.id));

            setSelectedId(null);
            // alert(`${name} deleted.`);
        } catch (err) {
            console.error("Delete failed:", err);
            alert("Failed to delete user.");
        }
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
                            <span className="user-name">
                                {user.gender === "male" ? "♂ " : user.gender === "female" ? "♀ " : ""}
                                {user.name} {user.surname}
                                {user.maidenName && (
                                    <span style={{ color: "#999", fontWeight: 400, fontSize: "12px" }}> (née {user.maidenName})</span>
                                )}
                                {user.city && (
                                    <span style={{ color: "#888", fontWeight: 400, fontSize: "11px", marginLeft: "6px" }}>📍{user.city}</span>
                                )}
                            </span>
                            <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
                                <button className="btn-secondary" onClick={(e) => { e.stopPropagation(); handleEdit(user); }}>✏️</button>
                                <button className="btn-danger" onClick={(e) => { e.stopPropagation(); handleDelete(user); }}>🗑️</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default UserList;