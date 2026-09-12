import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function Markdown({ children }: { children: string }) {
 return (
 <div className="prose prose-sm max-w-none prose-headings:font-semibold prose-a:text-primary">
 <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
 </div>
 );
}
