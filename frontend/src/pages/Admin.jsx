import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { EyeOff, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { deleteItem, getReported, restoreItem } from "@/lib/api";

const REASON_LABELS = { spam: "Spam", fake: "Fake", "wrong-info": "Wrong info" };

// The admin password is kept only while this tab is open
const KEY = "findr-admin-password";
const loadPassword = () => {
  try {
    return sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
};
const savePassword = (value) => {
  try {
    if (value) sessionStorage.setItem(KEY, value);
    else sessionStorage.removeItem(KEY);
  } catch {
    // Storage blocked: the password is just not remembered
  }
};

// Campus security page: see reported listings, then restore or delete them.
// Not linked from the menu. Open /admin directly.
export default function Admin() {
  const [password, setPassword] = useState(loadPassword);
  const [typed, setTyped] = useState("");
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const signOut = useCallback((message = "") => {
    savePassword("");
    setPassword("");
    setItems(null);
    setError(message);
  }, []);

  useEffect(() => {
    if (!password) return;
    getReported(password).then(
      (list) => {
        savePassword(password);
        setItems(list);
      },
      (err) => (err.status === 401 ? signOut("Wrong password") : setError(err.message))
    );
  }, [password, signOut]);

  const act = async (item, action) => {
    if (action === "delete" && !window.confirm(`Delete "${item.title}" for good?`)) return;
    setBusyId(item.id);
    setError("");
    try {
      if (action === "delete") await deleteItem(item.id, password);
      else await restoreItem(item.id, password);
      setItems((list) => list.filter((i) => i.id !== item.id));
    } catch (err) {
      if (err.status === 401) signOut("Wrong password");
      else setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="pb-20">
      <section className="bg-navy px-4 pt-8 pb-24 text-white">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Reported listings</h1>
          <p className="mt-2 text-white/75">For campus security. Listings reported 3 times are hidden until you check them.</p>
        </div>
      </section>

      <div className="mx-auto -mt-16 max-w-2xl px-4">
        <div className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
          {!password ? (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                setError("");
                setPassword(typed.trim());
              }}
            >
              <p className="flex items-center gap-2 font-medium">
                <ShieldCheck className="size-5" /> Admin password
              </p>
              <Input
                type="password"
                aria-label="Admin password"
                className="h-10 bg-white"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="current-password"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" size="lg" className="h-10 w-full" disabled={!typed.trim()}>
                Sign in
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {items === null ? "Loading…" : `${items.length} reported ${items.length === 1 ? "listing" : "listings"}`}
                </p>
                <Button variant="outline" className="h-8 px-3" onClick={() => signOut()}>
                  Sign out
                </Button>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              {items?.length === 0 && <p className="py-6 text-center text-muted-foreground">Nothing reported. All good.</p>}
              <ul className="divide-y">
                {items?.map((item) => (
                  <li key={item.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {item.hidden ? (
                          <Badge variant="destructive" className="gap-1">
                            <EyeOff className="size-3" /> Hidden
                          </Badge>
                        ) : (
                          <Badge variant="outline">Visible</Badge>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {item.reportCount} {item.reportCount === 1 ? "report" : "reports"}
                        </span>
                      </div>
                      {item.hidden ? (
                        <p className="mt-1 font-semibold">{item.title}</p>
                      ) : (
                        <Link to={`/items/${item.id}`} className="mt-1 block font-semibold hover:underline">
                          {item.title}
                        </Link>
                      )}
                      <p className="text-sm text-muted-foreground">
                        {Object.entries(item.reasons)
                          .map(([reason, count]) => `${REASON_LABELS[reason] ?? reason} ×${count}`)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" className="h-9 px-3" disabled={busyId === item.id} onClick={() => act(item, "restore")}>
                        Restore
                      </Button>
                      <Button variant="destructive" className="h-9 px-3" disabled={busyId === item.id} onClick={() => act(item, "delete")}>
                        Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
