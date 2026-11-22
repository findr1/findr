import { useState } from "react";
import { CircleCheck, Flag } from "lucide-react";
import Chip from "@/components/Chip";
import { Button } from "@/components/ui/button";
import { reportItem } from "@/lib/api";
import { getReporterId } from "@/lib/reporter";

const REASONS = [
  { value: "spam", label: "Spam" },
  { value: "fake", label: "Fake listing" },
  { value: "wrong-info", label: "Wrong information" },
];

// "Report this listing" link under an item. Opens a small form to pick a reason.
export default function ReportListing({ itemId }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  const handleSubmit = async () => {
    if (!reason) return setError("Pick a reason");
    setBusy(true);
    try {
      const { hidden } = await reportItem(itemId, reason, getReporterId());
      setDone(hidden ? "Thanks. This listing is now hidden until campus security checks it." : "Thanks, we'll take a look.");
    } catch (err) {
      if (err.status === 409) setDone("You have already reported this listing.");
      else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircleCheck className="size-4" /> {done}
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <Flag className="size-4" /> Report this listing
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-5">
      <p className="font-medium">What's wrong with this listing?</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Reason">
        {REASONS.map((r) => (
          <Chip
            key={r.value}
            selected={reason === r.value}
            onClick={() => {
              setReason(r.value);
              setError("");
            }}
          >
            {r.label}
          </Chip>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button className="h-9 px-4" onClick={handleSubmit} disabled={busy}>
          {busy ? "Sending…" : "Send report"}
        </Button>
        <Button variant="outline" className="h-9 px-4" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
