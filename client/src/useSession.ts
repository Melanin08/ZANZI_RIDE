import { useEffect, useState } from "react";
import { authRequest, type User } from "./riderAuth";

export function useSession() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    authRequest("session").then(data => { if (active) setUser(data.user); })
      .catch(() => { if (active) setError("We couldn’t reconnect. Check your connection and try again."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  return { user, setUser, loading, error, retry: () => { setLoading(true); setError(""); setAttempt(value => value + 1); } };
}
