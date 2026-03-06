import { useState, useRef, useEffect, useCallback } from "react";
import type { UserNode } from "../types";

interface UserSearchProps {
  users: UserNode[];
  value: string;
  onChange: (userId: string) => void;
  placeholder?: string;
}

const UserSearch = ({ users, value, onChange, placeholder = "Search user..." }: UserSearchProps) => {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const prevValueRef = useRef(value);

  // Sync query with selected value only when value changes externally
  useEffect(() => {
    if (prevValueRef.current !== value) {
      prevValueRef.current = value;
      if (value) {
        const user = users.find((u) => u.id === value);
        setQuery(user ? `${user.name} ${user.surname}` : "");
      } else {
        setQuery("");
      }
    }
  }, [value, users]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = users.filter((u) => {
    const full = `${u.name} ${u.surname}`.toLowerCase();
    return full.includes(query.toLowerCase());
  });

  const handleSelect = useCallback((userId: string) => {
    const user = users.find((u) => u.id === userId);
    if (user) setQuery(`${user.name} ${user.surname}`);
    onChange(userId);
    setIsOpen(false);
  }, [users, onChange]);

  const handleClear = useCallback(() => {
    onChange("");
    setQuery("");
    setIsOpen(false);
  }, [onChange]);

  return (
    <div ref={wrapperRef} style={{ position: "relative" }}>
        
      <div style={{ display: "flex", gap: "4px" }}>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (!e.target.value) onChange("");
          }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          style={{
            width: "100%",
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: "6px",
            fontSize: "14px",
          }}
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            style={{
              background: "none",
              border: "1px solid #ddd",
              borderRadius: "6px",
              padding: "0 10px",
              cursor: "pointer",
              color: "#e94560",
              fontSize: "16px",
            }}
          >
            ✕
          </button>
        )}
      </div>
      {isOpen && (
        <ul
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            right: 0,
            background: "white",
            border: "1px solid #ddd",
            borderRadius: "0 0 6px 6px",
            maxHeight: "200px",
            overflowY: "auto",
            listStyle: "none",
            padding: 0,
            margin: 0,
            zIndex: 100,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          }}
        >
          {filtered.length === 0 ? (
            <li style={{ padding: "10px 12px", color: "#888", fontSize: "13px" }}>
              No users found
            </li>
          ) : (
            filtered.slice(0, 50).map((u) => (
              <li
                key={u.id}
                onClick={() => handleSelect(u.id)}
                style={{
                  padding: "8px 12px",
                  cursor: "pointer",
                  fontSize: "14px",
                  background: u.id === value ? "#f0f0f0" : "white",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f5f5f5")}
                onMouseLeave={(e) => (e.currentTarget.style.background = u.id === value ? "#f0f0f0" : "white")}
              >
                <strong>{u.name} {u.surname}</strong>
                {u.city && <span style={{ color: "#888", marginLeft: "8px" }}>({u.city})</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default UserSearch;