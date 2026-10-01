import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  buildMatchedOpportunityAlertCopy,
  matchedOpportunityAlertDedupeKey,
  MATCHED_OPPORTUNITIES_ALERT_HREF,
} from "@/modules/matching-engine/internal/match-alerts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");

function readSrc(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("matched opportunity email alerts", () => {
  it("keeps topbar, email, and inbox on the same Alert content", () => {
    const alerts = readSrc(
      "src/modules/matching-engine/internal/match-alerts.ts",
    );
    const service = readSrc(
      "src/modules/matching-engine/internal/service.ts",
    );
    const api = readSrc(
      "src/app/api/matching-engine/new-matches-count/route.ts",
    );
    const page = readSrc(
      "src/app/(app)/matched-opportunities/page.tsx",
    );
    const channels = readSrc("src/services/notifications/channels.ts");

    assert.match(alerts, /createInAppAlert/);
    assert.match(alerts, /MATCHED_OPPORTUNITIES_ALERT_HREF/);
    assert.match(alerts, /countUnreadMatchedOpportunityAlerts/);
    assert.match(alerts, /acknowledgeMatchedOpportunityNotifications/);
    assert.match(service, /emitNewMatchedOpportunityAlerts/);
    assert.match(service, /markMatchedOpportunityAlertRead/);
    assert.match(api, /countMatchedOpportunityNotificationsForCompany/);
    assert.doesNotMatch(api, /countNewMatchesForCompany/);
    assert.match(page, /acknowledgeMatchedOpportunityNotificationsForCompany/);
    assert.match(channels, /emailService\.send/);
    assert.match(channels, /prefs\.emailEnabled/);

    const copy = buildMatchedOpportunityAlertCopy({
      title: "Airport facilities RFP",
    });
    assert.equal(copy.title, "Matched opportunity: Airport facilities RFP");
    assert.match(copy.message, /Airport facilities RFP/);
    assert.equal(
      matchedOpportunityAlertDedupeKey("co1", "opp1"),
      "co1:matched-opp:opp1",
    );
    assert.equal(MATCHED_OPPORTUNITIES_ALERT_HREF, "/matched-opportunities");
  });
});
