import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Calendar, MapPin, PackageCheck } from "lucide-react";
import ClaimForm from "@/components/ClaimForm";
import ReportListing from "@/components/ReportListing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { categories } from "@/data/reportOptions";
import { getItem } from "@/lib/api";

function heading(item, error) {
  if (error) return ["Item not found", error];
  if (!item) return ["Loading…", ""];
  if (item.returned) return ["Back with its owner", "This item has been returned. Thanks, Findr community!"];
  if (item.status === "found") return ["Is this yours?", "Answer the finder's question to get their contact."];
  return ["Have you seen this?", "Someone lost this on campus. If you found it, let them know."];
}

export default function ItemDetail() {
  const { id } = useParams();
  const [item, setItem] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getItem(id).then(setItem, (err) =>
      setError(err.status === 404 ? "This item doesn't exist or was removed." : err.message)
    );
  }, [id]);

  const [title, subtitle] = heading(item, error);
  const category = categories.find((c) => c.value === item?.category) ?? categories.at(-1);

  return (
    <main className="pb-20">
      <section className="bg-navy px-4 pt-8 pb-24 text-white">
        <div className="mx-auto max-w-xl">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-white/70 hover:text-white">
            <ArrowLeft className="size-4" /> Back to items
          </Link>
          <h1 className="mt-6 text-center text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 text-center text-white/75">{subtitle}</p>}
        </div>
      </section>

      <div className="mx-auto -mt-16 max-w-xl px-4">
        {item && (
          <article className="rounded-2xl border bg-card p-5 shadow-sm sm:p-7">
            <div className="flex items-start gap-4">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-secondary">
                <category.icon className="size-6" />
              </span>
              <div className="min-w-0">
                <Badge variant={item.returned ? "outline" : item.status === "lost" ? "default" : "secondary"} className="capitalize">
                  {item.returned ? "Returned" : item.status}
                </Badge>
                <h2 className="mt-1 text-xl font-semibold">{item.title}</h2>
                <p className="text-sm text-muted-foreground">{category.label}</p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4" /> {item.location}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="size-4" /> {item.date}
              </span>
            </div>
            {item.description && <p className="mt-4 text-sm">{item.description}</p>}

            <div className="mt-6 border-t pt-6">
              {item.returned ? (
                <p className="flex items-center gap-2 font-medium">
                  <PackageCheck className="size-5" /> This item is back with its owner.
                </p>
              ) : item.status === "found" ? (
                <ClaimForm item={item} onReturned={setItem} />
              ) : (
                <div className="space-y-3">
                  <p className="font-medium">Found it?</p>
                  <p className="text-sm text-muted-foreground">
                    Post it as found with a secret question, and the owner can claim it from you.
                  </p>
                  <Button size="lg" className="h-10 w-full" asChild>
                    <Link to="/report?type=found">Report it as found</Link>
                  </Button>
                </div>
              )}
            </div>
          </article>
        )}
        {item && (
          <div className="mt-4 px-1">
            <ReportListing itemId={item.id} />
          </div>
        )}
      </div>
    </main>
  );
}
