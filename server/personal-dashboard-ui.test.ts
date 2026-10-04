import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const source = (relativePath: string) =>
  readFile(path.join(root, relativePath), "utf8");

describe("persönliche Dashboard-Ansicht", () => {
  it("bietet eine sichtbare Hybrid-Umschaltung und eine bestätigungspflichtige Erklärung", async () => {
    const [dashboard, preference] = await Promise.all([
      source("client/src/pages/Dashboard.tsx"),
      source("client/src/hooks/useMyTasksDefault.ts"),
    ]);

    expect(dashboard).toContain("trpc.dashboard.personal.useQuery");
    expect(dashboard).toContain("Vereinssicht");
    expect(dashboard).toContain("Meine Ansicht");
    expect(dashboard).toContain("Persönliche Ansicht aktiviert");
    expect(dashboard).toContain("Verstanden – meine Ansicht anzeigen");
    expect(dashboard).toContain('data-dashboard-mode="personal"');
    expect(dashboard).toContain("showCloseButton={false}");
    expect(dashboard).toContain("onInteractOutside={event => event.preventDefault()}");
    expect(preference).toContain("PERSONAL_DASHBOARD_EXPLANATION_STORAGE_PREFIX");
    expect(preference).toContain("markPersonalDashboardExplanationSeen");
  });

  it("verwendet serverseitige Personenverknüpfungen und persönliche Filterlinks", async () => {
    const [router, db, app, personalDashboard, preparation, post, genericTasks, dashboard, personalMap, materials] = await Promise.all([
      source("server/routers.ts"),
      source("server/db.ts"),
      source("client/src/App.tsx"),
      source("server/personal-dashboard.ts"),
      source("client/src/pages/Preparation.tsx"),
      source("client/src/pages/PostProcessing.tsx"),
      source("client/src/pages/TaskGeneric.tsx"),
      source("client/src/pages/Dashboard.tsx"),
      source("client/src/components/PersonalLocationMapCard.tsx"),
      source("client/src/pages/Materials.tsx"),
    ]);

    expect(router).toContain("personal: protectedProcedure.query");
    expect(router).toContain("getPlanningTeamAccessCredentialForCurrentTenant");
    expect(router).toContain("buildPersonalDashboard");
    expect(db).toContain("contactId: planningTeamAccesses.contactId");
    expect(app).toContain('path="/marketing" component={Marketing}');
    expect(app).toContain('path="/genehmigungen" component={Approvals}');
    expect(personalDashboard).toContain('href: "/marketing?meine=1"');
    expect(personalDashboard).toContain('href: "/genehmigungen?meine=1"');
    for (const page of [preparation, post, genericTasks]) {
      expect(page).toContain("MY_TASKS_QUERY_KEY");
      expect(page).toContain("parseMyTasksFilter");
    }
    expect(personalDashboard).toContain("responsibleHelpers");
    expect(personalDashboard).toContain("entriesByLocation");
    expect(router).toContain("db.listShiftAreaContacts()");
    expect(dashboard).toContain("Meine betreuten Helfer");
    expect(dashboard).toContain("<PersonalLocationMapCard locations={data.locations} />");
    expect(personalMap).toContain("Nur meine Zuständigkeiten");
    expect(genericTasks).toContain("createResponsibleField");
    expect(materials).toContain("createResponsibleField");
  });
});
