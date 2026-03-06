import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import type { UserNode, Edge } from "../types";

export function useGraphData() {
  const [users, setUsers] = useState<UserNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as UserNode[];
      setUsers(data);
      setLoading(false);
    });

    const unsubEdges = onSnapshot(collection(db, "edges"), (snapshot) => {
      const data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Edge[];
      setEdges(data);
    });

    return () => {
      unsubUsers();
      unsubEdges();
    };
  }, []);

  return { users, edges, loading };
}