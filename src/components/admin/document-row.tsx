"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { deleteDocument } from "@/app/admin/documents/actions";
import { useRouter } from "next/navigation";
import type { Document } from "@/types/database";

export function DocumentRow({ document, canManage }: { document: Document; canManage: boolean }) {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between rounded-md border p-3 text-sm">
      <div className="flex items-center gap-3">
        <FileText className="h-4 w-4 text-primary" />
        <div>
          <p className="font-medium">{document.title}</p>
          <Badge variant="outline" className="mt-1 capitalize">{document.type.replace("_", " ")}</Badge>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <a
          href={`/api/documents/${document.id}/download`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary"
          aria-label={`Open ${document.title}`}
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        {canManage && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Delete ${document.title}`}
            onClick={async () => {
              const result = await deleteDocument(document.id);
              if (!result.ok) toast.error(result.error ?? "Could not delete.");
              else {
                toast.success("Deleted");
                router.refresh();
              }
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
