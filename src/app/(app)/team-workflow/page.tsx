export const dynamic = "force-dynamic";

import { requireCompanyId } from "@/auth/session";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getDictionary } from "@/i18n/dictionaries";
import { getLocale } from "@/i18n/get-locale";
import { formatRelative } from "@/lib/format";
import { hasFeature } from "@/services/entitlements";
import { listCompanyWorkflowTasks } from "@/services/team-workflow";
import { Users } from "lucide-react";
import Link from "next/link";

export default async function TeamWorkflowPage() {
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.app.tenderDetail.teamWorkflow;
  const { auth, companyId } = await requireCompanyId();
  const { prisma } = await import("@/lib/db");
  await prisma.feature
    .upsert({
      where: { key: "team_collaboration" },
      create: {
        key: "team_collaboration",
        name: "Team Collaboration",
        enabledGlobal: true,
      },
      update: {},
    })
    .catch(() => undefined);
  const enabled = await hasFeature(companyId, "team_collaboration");
  const tasks = enabled
    ? await listCompanyWorkflowTasks({
        companyId,
        role: auth.user.role,
        userId: auth.user.id,
        mineOnly: false,
      })
    : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
      </div>

      {!enabled ? (
        <EmptyState
          icon={Users}
          title={t.title}
          description="Team collaboration is not enabled for this workspace."
          actionLabel="Upgrade"
          actionHref="/upgrade"
        />
      ) : tasks.length === 0 ? (
        <EmptyState icon={Users} title={t.empty} description={t.subtitle} />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/tenders/${task.tenderId}#team-workflow`}
              className="block hover:opacity-95"
            >
              <Card>
                <CardContent className="flex items-start justify-between gap-3 pt-5">
                  <div>
                    <p className="text-sm font-semibold">{task.title}</p>
                    <p className="mt-1 text-xs text-muted">
                      {task.tenderTitle ?? task.tenderId}
                      {task.assigneeName ? ` · ${task.assigneeName}` : ""}
                      {task.department ? ` · ${task.department}` : ""}
                    </p>
                    <p className="mt-2 text-xs text-muted">
                      {formatRelative(task.deadline ?? task.createdAt, locale)}
                    </p>
                  </div>
                  <Badge className="border-border bg-background text-muted">
                    {task.displayStatus.replaceAll("_", " ")}
                  </Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
