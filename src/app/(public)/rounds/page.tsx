import { redirect } from "next/navigation";

// The combined "all three rounds on one page" view is retired in favor of
// two dedicated pages (see req.: Minor gets its own page; Intermediate and
// Major share a tabbed page) - this route now just sends anyone with an old
// /rounds link or bookmark somewhere real instead of a dead page.
export default function RoundsRedirectPage() {
  redirect("/rounds/minor");
}
