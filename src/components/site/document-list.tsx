import { FileText } from "lucide-react";
import type { Document } from "@/types/database";

export function DocumentList({ documents }: { documents: Document[] }) {
  if (documents.length === 0) return null;
  return (
    <ul className="space-y-2">
      {documents.map((doc) => (
        <li key={doc.id}>
          <a
            href={`/api/documents/${doc.id}/download`}
            className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
            target="_blank"
            rel="noopener noreferrer"
          >
            <FileText className="h-4 w-4 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="font-medium">{doc.title}</p>
              <p className="text-xs text-muted-foreground">
                v{doc.version}
                {doc.published_at && ` · Published ${new Date(doc.published_at).toLocaleDateString()}`}
              </p>
            </div>
            <span className="text-xs text-primary underline underline-offset-4">Read document</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
