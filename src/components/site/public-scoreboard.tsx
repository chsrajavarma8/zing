"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import type { Round, JudgingCriterion } from "@/types/database";

interface TeamTotal {
  teamId: string;
  teamName: string;
  referenceId: string;
  total: number;
  judgeCount: number;
  qualification?: string;
  rank?: number;
}

export function PublicScoreboard({ boards }: { boards: { round: Round; criteria: JudgingCriterion[]; teams: TeamTotal[] }[] }) {
  const [query, setQuery] = useState("");

  return (
    <div className="space-y-4">
      <div className="relative mx-auto max-w-xs">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search teams…" value={query} onChange={(e) => setQuery(e.target.value)} className="pl-8" />
      </div>

      <Tabs defaultValue={boards[0].round.id}>
        <TabsList className="flex-wrap">
          {boards.map((b) => (
            <TabsTrigger key={b.round.id} value={b.round.id}>
              {b.round.name}
            </TabsTrigger>
          ))}
        </TabsList>
        {boards.map((b) => {
          const filtered = query ? b.teams.filter((t) => t.teamName.toLowerCase().includes(query.toLowerCase())) : b.teams;
          return (
            <TabsContent key={b.round.id} value={b.round.id}>
              <Card>
                <CardContent className="overflow-x-auto pt-6">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Round</TableHead>
                        <TableHead className="text-right">Published score</TableHead>
                        <TableHead>Qualification status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filtered.map((t, i) => (
                        <TableRow key={t.teamId}>
                          <TableCell>{t.rank ?? i + 1}</TableCell>
                          <TableCell className="font-medium">
                            {t.teamName}
                            <span className="ml-2 font-mono text-xs text-muted-foreground">{t.referenceId}</span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{b.round.name}</TableCell>
                          <TableCell className="text-right font-mono font-semibold">{t.total.toFixed(1)}</TableCell>
                          <TableCell>
                            {t.qualification ? (
                              <Badge variant={t.qualification === "qualified" ? "default" : "secondary"}>
                                {t.qualification.replace("_", " ")}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">N/A</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {filtered.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                            No results match your search.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          );
        })}
      </Tabs>
      <p className="text-center text-sm text-muted-foreground">Only organizer-published results appear here.</p>
    </div>
  );
}
