/**
 * Authenticated module UI strings — merged into Dictionary.app by getDictionary.
 * All five locales must define identical keys (enforced by localization tests).
 */
import type { Locale } from "./config";
import { applyAr, applyFr, applyZh } from "./app-modules-locales";

export type ModuleUi = {
  eyebrow: string;
  title: string;
  subtitle: string;
  emptyTitle: string;
  emptyDescription: string;
  emptyCta: string;
  upload: string;
  allDocuments: string;
  dashboard: string;
  settings: string;
  reminders: string;
  save: string;
  cancel: string;
  edit: string;
  create: string;
  delete: string;
  back: string;
  loading: string;
  saved: string;
  errorGeneric: string;
  total: string;
  valid: string;
  expiring: string;
  expired: string;
  unknown: string;
  open: string;
  pending: string;
  inProgress: string;
  completed: string;
  overdue: string;
  all: string;
  search: string;
  filter: string;
  sort: string;
  noResults: string;
  previous: string;
  next: string;
  actions: string;
  status: string;
  name: string;
  category: string;
  expires: string;
  expiresOn: string;
  neverExpires: string;
  view: string;
  details: string;
  required: string;
  optional: string;
  companyProfileLink: string;
};

export type AppModuleBundle = {
  common: {
    lockedPlan: string;
    viewPlan: string;
    workspaceOverview: string;
    workspaceOverviewHint: string;
    complianceStatus: string;
    complianceStatusHint: string;
    complianceStatusHintEmpty: string;
    complianceEmpty: string;
    workspaceActivity: string;
    workspaceActivityHint: string;
    activityEmptyPeriod: string;
    activityEmpty: string;
    deadlineOverview: string;
    deadlineOverviewHint: string;
    deadlineEmpty: string;
    recentActivity: string;
    yourWorkspace: string;
    dashboardTitle: string;
    dashboardSubtitle: string;
    noDataYet: string;
    deadlineLabel: string;
    eventLabel: string;
    currentPlan: string;
    currentPlanHint: string;
    noSubscription: string;
    trialEnds: string;
    freeWorkspaceTrialExpiredTitle: string;
    freeWorkspaceTrialExpiredBody: string;
    freeWorkspaceTrialCta: string;
    teamMembers: string;
    planLabel: string;
    enabledCapabilities: string;
    noCapabilities: string;
    manageBilling: string;
    recentActivityTitle: string;
    recentActivityHint: string;
    recentActivityEmpty: string;
    activityDocument: string;
    activityClientRequest: string;
    activityDecision: string;
    quickActionsTitle: string;
    quickActionsHint: string;
    addDocument: string;
    completeQualification: string;
    createClientRequest: string;
    openQuestionnaire: string;
    reviewEvidence: string;
    reviewDeadlines: string;
    loadingWorkspace: string;
  };
  kpi: {
    document_compliance: { title: string; hint: string; secondaryLabel: string };
    expiring_documents: { title: string; hint: string; secondaryLabel: string };
    supplier_qualification: { title: string; hint: string; secondaryLabel: string };
    client_requests: { title: string; hint: string; secondaryLabel: string };
    questionnaires: { title: string; hint: string; secondaryLabel: string };
    evidence_intelligence: { title: string; hint: string; secondaryLabel: string };
    decision_activity: { title: string; hint: string; secondaryLabel: string };
    upcoming_deadlines: { title: string; hint: string; secondaryLabel: string };
  };
  documentCompliance: ModuleUi & {
    expiringSoon: string;
    noExpiringSoon: string;
    reminderSettings: string;
    uploadTitle: string;
    uploadSubtitle: string;
    documentsTitle: string;
    documentsSubtitle: string;
    settingsTitle: string;
    settingsSubtitle: string;
    documentsLink: string;
    detailRecordHint: string;
    documentNumberLabel: string;
    issuingAuthorityLabel: string;
    issueDateLabel: string;
    expiryDateLabel: string;
    extractionConfidenceLabel: string;
    extractionProvenanceTitle: string;
    extractionProvenanceSubtitle: string;
    versionsTitle: string;
    download: string;
    fileLabel: string;
    dragDropTitle: string;
    fileHint: string;
    chooseFile: string;
    uploadingMetadata: string;
    nameOptional: string;
    chooseFileError: string;
    uploadFailed: string;
    noExpiryCheckbox: string;
    uploadExtract: string;
    uploading: string;
  };
  supplierQualification: ModuleUi & {
    buildTitle: string;
    buildSubtitle: string;
    editProfile: string;
    completeness: string;
    allRequired: string;
    missing: string;
    evidence: string;
    qualifications: string;
    services: string;
    coverage: string;
    profile: string;
    defaultProfileName: string;
    profilePageTitle: string;
    profileCompletenessLine: string;
    evidencePageTitle: string;
    evidencePageSubtitle: string;
    qualificationsPageTitle: string;
    qualificationsPageSubtitle: string;
    servicesPageTitle: string;
    servicesPageSubtitle: string;
    coveragePageSubtitle: string;
  };
  clientRequests: ModuleUi & {
    createRequest: string;
    newTitle: string;
    newSubtitle: string;
    client: string;
    deadline: string;
    updated: string;
    items: string;
    share: string;
    noMatch: string;
    backToList: string;
  };
  tenderCalendar: ModuleUi & {
    deadlinesTitle: string;
    deadlinesSubtitle: string;
    trackedOpportunities: string;
    addTender: string;
    trackedTenders: string;
    upcomingDeadlines: string;
    pastDeadlines: string;
    calendarHeading: string;
    noItemsMonth: string;
    tendersTitle: string;
    tendersSubtitle: string;
    settingsTitle: string;
    settingsSubtitle: string;
    calendarHome: string;
    createTenderTitle: string;
    searchOpportunitiesPlaceholder: string;
    countryPlaceholder: string;
    allStatuses: string;
    emptyFilterTitle: string;
    emptyFilterDescription: string;
    nextDeadlineLabel: string;
    noDeadline: string;
    reminderRulesHint: string;
  };
  matchedOpportunities: ModuleUi & {
    recommendations: string;
    sponsored: string;
    sponsoredTitle: string;
    matchScore: string;
    dismiss: string;
    generate: string;
    noRecommendations: string;
    sponsoredEyebrow: string;
    sponsoredRequestTitle: string;
    sponsoredRequestSubtitle: string;
    sponsoredUnavailableSubtitle: string;
    backToMatched: string;
    sponsoredCta: string;
    sponsoredPayWithStripe: string;
    sponsoredPayWithPayPal: string;
    sponsoredGatewayLabel: string;
    sponsoredRedirecting: string;
    sponsoredNoGateways: string;
    sponsoredPaidSuccess: string;
    sponsoredPaidPending: string;
    sponsoredPaidError: string;
    sponsoredCheckoutCancelled: string;
    sponsoredNoPlansTitle: string;
    sponsoredNoPlansBody: string;
    sponsoredPeriodOneTime: string;
    sponsoredPeriodThreeDays: string;
    sponsoredPeriodMonthly: string;
    sponsoredPeriodQuarterly: string;
    sponsoredPeriodYearly: string;
    sponsoredCampaignDays: string;
    sponsoredCampaignDurationAdmin: string;
    sponsoredUpToCampaigns: string;
    sponsoredUpToImpressions: string;
    sponsoredConfirmTitle: string;
    sponsoredConfirmBody: string;
    sponsoredPlanLabel: string;
    sponsoredPriceLabel: string;
    sponsoredDurationLabel: string;
    sponsoredDays: string;
    sponsoredAsConfigured: string;
    sponsoredCampaignsCount: string;
    sponsoredDefaultBenefit1: string;
    sponsoredDefaultBenefit2: string;
    sponsoredDefaultBenefit3: string;
    sponsoredBenefitPriority: string;
    sponsoredBenefitNoBypass: string;
    sponsoredSubmit: string;
    sponsoredSubmitSuccess: string;
    sponsoredSubmitError: string;
    matchDisclaimer: string;
    dashboardSectionTitle: string;
    dashboardSectionSubtitle: string;
    viewMatch: string;
    viewAllOpportunities: string;
    whyMatched: string;
    gapsLabel: string;
    highlyRelevant: string;
    emptyImproveProfile: string;
    updateCompanyProfile: string;
    refreshMatches: string;
    filterRelevance: string;
    filterDeadline: string;
    filterGeography: string;
    filterCategory: string;
    filterStatus: string;
    statusAll: string;
    statusNew: string;
    statusViewed: string;
    statusHighlyRelevant: string;
    interested: string;
    viewOpportunity: string;
    locationLabel: string;
    deadlineLabel: string;
    matchedCapabilities: string;
    noMatchFilter: string;
    notEligibleTitle: string;
    notEligibleBody: string;
    unavailableTitle: string;
    unavailableBody: string;
    emptyTitleDashboard: string;
    emptyBodyDashboard: string;
  };
  questionnaireAssistant: ModuleUi & {
    workbenchTitle: string;
    workbenchSubtitle: string;
    packs: string;
    drafts: string;
    startPack: string;
    noPacks: string;
    selectTender: string;
    updateCompanyProfile: string;
  };
};

const en: AppModuleBundle = {
  common: {
    lockedPlan: "Not on your current plan",
    viewPlan: "View plan",
    workspaceOverview: "Workspace overview",
    workspaceOverviewHint:
      "Live company metrics. Empty modules show zero — never estimated values.",
    complianceStatus: "Compliance status",
    complianceStatusHint: "Current document status mix for your company.",
    complianceStatusHintEmpty:
      "Status mix from your documents. Historical trend appears when updates accumulate.",
    complianceEmpty: "No compliance documents yet.",
    workspaceActivity: "Workspace activity",
    workspaceActivityHint:
      "Client request and questionnaire activity in the last 30 days.",
    activityEmptyPeriod: "No activity in this period.",
    activityEmpty: "No recent activity recorded yet.",
    deadlineOverview: "Deadline overview",
    deadlineOverviewHint: "Upcoming Tender Calendar deadlines by time window.",
    deadlineEmpty: "No upcoming calendar deadlines.",
    recentActivity: "Recent activity",
    yourWorkspace: "Your Bidvera workspace",
    dashboardTitle: "Dashboard",
    dashboardSubtitle:
      "Compliance, qualification, client requests, questionnaires, evidence, decisions, and deadlines — in one company workspace.",
    noDataYet: "No data yet",
    deadlineLabel: "Deadline",
    eventLabel: "Event",
    currentPlan: "Current plan",
    currentPlanHint:
      "Workspace subscription and enabled capabilities for your company.",
    noSubscription: "No active subscription row",
    trialEnds: "Trial ends {date}",
    freeWorkspaceTrialExpiredTitle: "Your Free Workspace trial has ended.",
    freeWorkspaceTrialExpiredBody:
      "Payment is required to continue. Choose a paid plan to restore access.",
    freeWorkspaceTrialCta: "Choose a plan",
    teamMembers: "Team members",
    planLabel: "Plan",
    enabledCapabilities: "Enabled capabilities",
    noCapabilities: "No commercial capabilities enabled yet.",
    manageBilling: "Manage billing",
    recentActivityTitle: "Recent activity",
    recentActivityHint: "Latest updates in your company workspace.",
    recentActivityEmpty: "No recent activity yet.",
    activityDocument: "Document updated",
    activityClientRequest: "Client request",
    activityDecision: "Decision activity",
    quickActionsTitle: "Quick actions",
    quickActionsHint: "Shortcuts for capabilities on your current plan.",
    addDocument: "Add document",
    completeQualification: "Complete qualification",
    createClientRequest: "Create client request",
    openQuestionnaire: "Open questionnaires",
    reviewEvidence: "Review evidence",
    reviewDeadlines: "Review deadlines",
    loadingWorkspace: "Loading workspace…",
  },
  kpi: {
    document_compliance: {
      title: "Document compliance",
      hint: "Valid documents",
      secondaryLabel: "total docs",
    },
    expiring_documents: {
      title: "Expiring documents",
      hint: "Approaching expiry",
      secondaryLabel: "expired",
    },
    supplier_qualification: {
      title: "Supplier qualification",
      hint: "Profile completeness",
      secondaryLabel: "evidence items",
    },
    client_requests: {
      title: "Client requests",
      hint: "Open requests",
      secondaryLabel: "completed",
    },
    questionnaires: {
      title: "Questionnaires",
      hint: "Pending drafts",
      secondaryLabel: "done / packs",
    },
    evidence_intelligence: {
      title: "Supplier evidence",
      hint: "Verified evidence",
      secondaryLabel: "missing / open",
    },
    decision_activity: {
      title: "Decision activity",
      hint: "Stored decisions",
      secondaryLabel: "updated (30d)",
    },
    upcoming_deadlines: {
      title: "Upcoming deadlines",
      hint: "Calendar deadlines",
      secondaryLabel: "next window",
    },
  },
  documentCompliance: {
    eyebrow: "Document Compliance",
    title: "Compliance documents",
    subtitle: "Track licences, certificates, and expiry reminders for your business.",
    emptyTitle: "No compliance documents yet",
    emptyDescription:
      "Upload licences, certificates, and other business documents to track expiry and get reminders.",
    emptyCta: "Upload document",
    upload: "Upload",
    allDocuments: "All documents",
    dashboard: "Dashboard",
    settings: "Settings",
    reminders: "Reminders",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    create: "Create",
    delete: "Delete",
    back: "Back",
    loading: "Loading…",
    saved: "Saved",
    errorGeneric: "Something went wrong. Please try again.",
    total: "Total",
    valid: "Valid",
    expiring: "Expiring",
    expired: "Expired",
    unknown: "Unknown",
    open: "Open",
    pending: "Pending",
    inProgress: "In progress",
    completed: "Completed",
    overdue: "Overdue",
    all: "All",
    search: "Search",
    filter: "Filter",
    sort: "Sort",
    noResults: "No results",
    previous: "Previous",
    next: "Next",
    actions: "Actions",
    status: "Status",
    name: "Name",
    category: "Category",
    expires: "Expires",
    expiresOn: "expires {date}",
    neverExpires: "No expiry",
    view: "View",
    details: "Details",
    required: "Required",
    optional: "Optional",
    companyProfileLink: "Company Profile",
    expiringSoon: "Expiring soon",
    noExpiringSoon: "No documents expiring soon.",
    reminderSettings: "Reminder settings",
    uploadTitle: "Upload document",
    uploadSubtitle: "Add a licence, certificate, or other compliance document.",
    documentsTitle: "All documents",
    documentsSubtitle: "Browse and manage your compliance document library.",
    settingsTitle: "Reminder settings",
    settingsSubtitle: "Choose when Bidvera should remind you before documents expire.",
    documentsLink: "Documents",
    detailRecordHint: "Tenant-scoped compliance record",
    documentNumberLabel: "Document number",
    issuingAuthorityLabel: "Issuing authority",
    issueDateLabel: "Issue date",
    expiryDateLabel: "Expiry date",
    extractionConfidenceLabel: "Extraction confidence",
    extractionProvenanceTitle: "Extraction provenance",
    extractionProvenanceSubtitle:
      "Evidence supporting extracted fields — never auto-actions.",
    versionsTitle: "Versions",
    download: "Download",
    fileLabel: "File",
    dragDropTitle: "Drag & drop your document here",
    fileHint: "PDF, Word, images, and common office files",
    chooseFile: "Choose file",
    uploadingMetadata: "Uploading & extracting metadata",
    nameOptional: "Name (optional)",
    chooseFileError: "Choose a file to upload.",
    uploadFailed: "Upload failed.",
    noExpiryCheckbox: "This document has no expiry",
    uploadExtract: "Upload & extract",
    uploading: "Uploading…",
  },
  supplierQualification: {
    eyebrow: "Supplier Qualification",
    title: "Supplier qualification",
    subtitle:
      "Supplier readiness for bids and questionnaires — separate from Company Profile used for tender-fit analysis.",
    emptyTitle: "Your supplier profile is empty",
    emptyDescription:
      "Start with legal company details, then add qualifications, services, coverage, and evidence references.",
    emptyCta: "Start supplier profile",
    upload: "Upload",
    allDocuments: "All",
    dashboard: "Dashboard",
    settings: "Settings",
    reminders: "Reminders",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    create: "Create",
    delete: "Delete",
    back: "Back",
    loading: "Loading…",
    saved: "Saved",
    errorGeneric: "Something went wrong. Please try again.",
    total: "Total",
    valid: "Valid",
    expiring: "Expiring",
    expired: "Expired",
    unknown: "Unknown",
    open: "Open",
    pending: "Pending",
    inProgress: "In progress",
    completed: "Completed",
    overdue: "Overdue",
    all: "All",
    search: "Search",
    filter: "Filter",
    sort: "Sort",
    noResults: "No results",
    previous: "Previous",
    next: "Next",
    actions: "Actions",
    status: "Status",
    name: "Name",
    category: "Category",
    expires: "Expires",
    expiresOn: "expires {date}",
    neverExpires: "No expiry",
    view: "View",
    details: "Details",
    required: "Required",
    optional: "Optional",
    companyProfileLink: "Company Profile",
    buildTitle: "Build your qualification profile",
    buildSubtitle:
      "Supplier readiness for bids and questionnaires — separate from Company Profile used for tender-fit analysis.",
    editProfile: "Edit supplier profile",
    completeness: "Profile completeness",
    allRequired: "All required fields populated.",
    missing: "Missing: {fields}",
    evidence: "Evidence",
    qualifications: "Qualifications",
    services: "Services",
    coverage: "Coverage",
    profile: "Profile",
    defaultProfileName: "Supplier profile",
    profilePageTitle: "Company profile",
    profileCompletenessLine:
      "Completeness: {percent}% — required fields only; never AI-inferred.",
    evidencePageTitle: "Documents & evidence references",
    evidencePageSubtitle:
      "Optional supporting files or URLs. Ownership is tenant-scoped; content is not auto-verified.",
    qualificationsPageTitle: "Qualifications & certifications",
    qualificationsPageSubtitle:
      "Free-form certifications and licenses — not treated as verified evidence.",
    servicesPageTitle: "Services & sectors",
    servicesPageSubtitle:
      "Custom sectors and services are allowed — no hard-coded industry taxonomy.",
    coveragePageSubtitle:
      "Geographic coverage, currencies, and languages — country-agnostic.",
  },
  clientRequests: {
    eyebrow: "Client Requests",
    title: "Client requests",
    subtitle:
      "Track buyer requests for company information and documents, link evidence, and share a secure dossier.",
    emptyTitle: "No client requests yet",
    emptyDescription:
      "Track buyer requests for company information and documents, link existing Bidvera evidence, and share a secure dossier.",
    emptyCta: "Create request",
    upload: "Upload",
    allDocuments: "All",
    dashboard: "Dashboard",
    settings: "Settings",
    reminders: "Reminders",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    create: "Create",
    delete: "Delete",
    back: "Back",
    loading: "Loading…",
    saved: "Saved",
    errorGeneric: "Something went wrong. Please try again.",
    total: "Total",
    valid: "Valid",
    expiring: "Expiring",
    expired: "Expired",
    unknown: "Unknown",
    open: "Open",
    pending: "Pending",
    inProgress: "In progress",
    completed: "Completed",
    overdue: "Overdue",
    all: "All",
    search: "Search",
    filter: "Filter",
    sort: "Sort",
    noResults: "No results",
    previous: "Previous",
    next: "Next",
    actions: "Actions",
    status: "Status",
    name: "Name",
    category: "Category",
    expires: "Expires",
    expiresOn: "expires {date}",
    neverExpires: "No expiry",
    view: "View",
    details: "Details",
    required: "Required",
    optional: "Optional",
    companyProfileLink: "Company Profile",
    createRequest: "Create request",
    newTitle: "New client request",
    newSubtitle: "Capture what the buyer asked for and track fulfilment.",
    client: "Client",
    deadline: "Deadline",
    updated: "Updated",
    items: "Items",
    share: "Share",
    noMatch: "No requests match these filters.",
    backToList: "Back to requests",
  },
  tenderCalendar: {
    eyebrow: "Tender Calendar",
    title: "Deadlines & reminders",
    subtitle:
      "Track submission dates and get reminder alerts for opportunities you follow.",
    emptyTitle: "No tracked opportunities yet",
    emptyDescription:
      "Add tenders you are following to see deadlines on the calendar and receive reminders.",
    emptyCta: "Add tender",
    upload: "Upload",
    allDocuments: "All",
    dashboard: "Dashboard",
    settings: "Settings",
    reminders: "Reminders",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    create: "Create",
    delete: "Delete",
    back: "Back",
    loading: "Loading…",
    saved: "Saved",
    errorGeneric: "Something went wrong. Please try again.",
    total: "Total",
    valid: "Valid",
    expiring: "Expiring",
    expired: "Expired",
    unknown: "Unknown",
    open: "Open",
    pending: "Pending",
    inProgress: "In progress",
    completed: "Completed",
    overdue: "Overdue",
    all: "All",
    search: "Search",
    filter: "Filter",
    sort: "Sort",
    noResults: "No results",
    previous: "Previous",
    next: "Next",
    actions: "Actions",
    status: "Status",
    name: "Name",
    category: "Category",
    expires: "Expires",
    expiresOn: "expires {date}",
    neverExpires: "No expiry",
    view: "View",
    details: "Details",
    required: "Required",
    optional: "Optional",
    companyProfileLink: "Company Profile",
    deadlinesTitle: "Deadlines & reminders",
    deadlinesSubtitle:
      "Track submission dates and get reminder alerts for opportunities you follow.",
    trackedOpportunities: "Tracked opportunities",
    addTender: "Add tender",
    trackedTenders: "Tracked tenders",
    upcomingDeadlines: "Upcoming deadlines",
    pastDeadlines: "Past deadlines",
    calendarHeading: "Calendar · {month}",
    noItemsMonth: "No deadlines in this month.",
    tendersTitle: "Tracked opportunities",
    tendersSubtitle: "Opportunities you are following on the calendar.",
    settingsTitle: "Reminder settings",
    settingsSubtitle: "Configure how far ahead Bidvera reminds you of deadlines.",
    calendarHome: "Calendar",
    createTenderTitle: "Create tender",
    searchOpportunitiesPlaceholder: "Search title, reference, buyer…",
    countryPlaceholder: "Country",
    allStatuses: "All statuses",
    emptyFilterTitle: "No opportunities match these filters",
    emptyFilterDescription: "Try clearing filters or search for a different term.",
    nextDeadlineLabel: "Next {date}",
    noDeadline: "No deadline",
    reminderRulesHint:
      "Reminders use each deadline’s stored date/time. Timezones are never invented.",
  },
  matchedOpportunities: {
    eyebrow: "Matched Opportunities",
    title: "Matched opportunities",
    subtitle: "Recommendations based on your company profile and preferences.",
    emptyTitle: "No recommendations yet",
    emptyDescription:
      "Generate recommendations when Matching is available for your workspace.",
    emptyCta: "Generate recommendations",
    upload: "Upload",
    allDocuments: "All",
    dashboard: "Dashboard",
    settings: "Settings",
    reminders: "Reminders",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    create: "Create",
    delete: "Delete",
    back: "Back",
    loading: "Loading…",
    saved: "Saved",
    errorGeneric: "Something went wrong. Please try again.",
    total: "Total",
    valid: "Valid",
    expiring: "Expiring",
    expired: "Expired",
    unknown: "Unknown",
    open: "Open",
    pending: "Pending",
    inProgress: "In progress",
    completed: "Completed",
    overdue: "Overdue",
    all: "All",
    search: "Search",
    filter: "Filter",
    sort: "Sort",
    noResults: "No results",
    previous: "Previous",
    next: "Next",
    actions: "Actions",
    status: "Status",
    name: "Name",
    category: "Category",
    expires: "Expires",
    expiresOn: "expires {date}",
    neverExpires: "No expiry",
    view: "View",
    details: "Details",
    required: "Required",
    optional: "Optional",
    companyProfileLink: "Company Profile",
    recommendations: "Recommendations",
    sponsored: "Sponsored",
    sponsoredTitle: "Sponsored matching",
    matchScore: "Match score",
    dismiss: "Dismiss",
    generate: "Generate",
    noRecommendations: "No recommendations to show.",
    sponsoredEyebrow: "Sponsored matching",
    sponsoredRequestTitle: "Request Sponsored Matching",
    sponsoredRequestSubtitle:
      "Choose an active plan and pay securely with Stripe or PayPal. Sponsorship never bypasses matching relevance.",
    sponsoredUnavailableSubtitle:
      "Sponsored Matching is not available right now. Organic matched opportunities remain available when Matching Engine is enabled for your workspace.",
    backToMatched: "Back to matched opportunities",
    sponsoredCta: "Sponsored Matching",
    sponsoredPayWithStripe: "Pay with Stripe",
    sponsoredPayWithPayPal: "Pay with PayPal",
    sponsoredGatewayLabel: "Payment method",
    sponsoredRedirecting: "Redirecting to checkout…",
    sponsoredNoGateways:
      "Payment methods are not configured. Ask Super Admin to enable Stripe or PayPal in Payments.",
    sponsoredPaidSuccess:
      "Payment received. Your Sponsored Matching request is confirmed.",
    sponsoredPaidPending: "Payment is still processing. Refresh in a moment.",
    sponsoredPaidError: "We could not confirm payment. Contact support if you were charged.",
    sponsoredCheckoutCancelled: "Checkout was cancelled. No payment was taken.",
    sponsoredNoPlansTitle: "No sponsored plans available",
    sponsoredNoPlansBody:
      "Active Sponsored Matching plans will appear here when Super Admin publishes them.",
    sponsoredPeriodOneTime: "One-time",
    sponsoredPeriodThreeDays: "3 days",
    sponsoredPeriodMonthly: "Monthly",
    sponsoredPeriodQuarterly: "Quarterly",
    sponsoredPeriodYearly: "Yearly",
    sponsoredCampaignDays: "{days}-day campaign",
    sponsoredCampaignDurationAdmin: "Campaign duration set by admin",
    sponsoredUpToCampaigns: "up to {n} campaigns",
    sponsoredUpToImpressions: "up to {n} impressions",
    sponsoredConfirmTitle: "Confirm & pay",
    sponsoredConfirmBody:
      "You will be redirected to Stripe or PayPal to complete payment using Bidvera’s configured payment credentials. Sponsorship never bypasses matching relevance.",
    sponsoredPlanLabel: "Plan",
    sponsoredPriceLabel: "Price",
    sponsoredDurationLabel: "Duration / limits",
    sponsoredDays: "{days} days",
    sponsoredAsConfigured: "As configured",
    sponsoredCampaignsCount: "{n} campaigns",
    sponsoredDefaultBenefit1: "Sponsored label among relevant matches only",
    sponsoredDefaultBenefit2: "Does not bypass eligibility or relevance",
    sponsoredDefaultBenefit3: "Organic matches remain primary at equal relevance",
    sponsoredBenefitPriority: "Priority placement among relevant matches",
    sponsoredBenefitNoBypass: "Does not bypass relevance",
    sponsoredSubmit: "Continue to payment",
    sponsoredSubmitSuccess:
      "Request submitted. Our team will follow up — no payment was charged.",
    sponsoredSubmitError: "Could not start checkout.",
    matchDisclaimer:
      "A match means Bidvera identified a relevant opportunity — not a won contract.",
    dashboardSectionTitle: "Matching Opportunities",
    dashboardSectionSubtitle:
      "Projects that fit your company capabilities, location, and qualifications.",
    viewMatch: "View match",
    viewAllOpportunities: "View all opportunities",
    whyMatched: "Why it matches",
    gapsLabel: "Gaps to review",
    highlyRelevant: "Highly relevant",
    emptyImproveProfile:
      "Complete services, geography, and certifications on your company profile to improve match quality.",
    updateCompanyProfile: "Update company profile",
    refreshMatches: "Refresh matches",
    filterRelevance: "Relevance",
    filterDeadline: "Deadline",
    filterGeography: "Geography",
    filterCategory: "Category",
    filterStatus: "Status",
    statusAll: "All",
    statusNew: "New",
    statusViewed: "Viewed",
    statusHighlyRelevant: "Highly relevant",
    interested: "I'm interested",
    viewOpportunity: "View opportunity",
    locationLabel: "Location",
    deadlineLabel: "Deadline",
    matchedCapabilities: "Matched capabilities",
    noMatchFilter: "No matches for these filters.",
    notEligibleTitle: "Complete your matching profile",
    notEligibleBody:
      "Add company capabilities and geography so Bidvera can evaluate project fit. Matches are never fabricated.",
    unavailableTitle: "Matching is not on this plan",
    unavailableBody:
      "When Matching is enabled for your workspace, relevant project matches appear here.",
    emptyTitleDashboard: "No matches yet",
    emptyBodyDashboard:
      "When live projects fit your eligible profile, they appear here. Improving services and geography raises precision.",
  },
  questionnaireAssistant: {
    eyebrow: "Questionnaire Assistant",
    title: "Questionnaire Assistant",
    subtitle: "Draft structured answers from your company evidence and packs.",
    emptyTitle: "No questionnaire packs yet",
    emptyDescription:
      "Open a tender workspace to start a questionnaire pack when available.",
    emptyCta: "Browse tenders",
    upload: "Upload",
    allDocuments: "All",
    dashboard: "Dashboard",
    settings: "Settings",
    reminders: "Reminders",
    save: "Save",
    cancel: "Cancel",
    edit: "Edit",
    create: "Create",
    delete: "Delete",
    back: "Back",
    loading: "Loading…",
    saved: "Saved",
    errorGeneric: "Something went wrong. Please try again.",
    total: "Total",
    valid: "Valid",
    expiring: "Expiring",
    expired: "Expired",
    unknown: "Unknown",
    open: "Open",
    pending: "Pending",
    inProgress: "In progress",
    completed: "Completed",
    overdue: "Overdue",
    all: "All",
    search: "Search",
    filter: "Filter",
    sort: "Sort",
    noResults: "No results",
    previous: "Previous",
    next: "Next",
    actions: "Actions",
    status: "Status",
    name: "Name",
    category: "Category",
    expires: "Expires",
    expiresOn: "expires {date}",
    neverExpires: "No expiry",
    view: "View",
    details: "Details",
    required: "Required",
    optional: "Optional",
    companyProfileLink: "Company Profile",
    workbenchTitle: "Questionnaire workbench",
    workbenchSubtitle: "Review questions and draft answers with your evidence.",
    packs: "Packs",
    drafts: "Drafts",
    startPack: "Start pack",
    noPacks: "No packs for this tender yet.",
    selectTender: "Select a tender",
    updateCompanyProfile: "Update company profile",
  },
};

/** Deep-clone helper for locale variants built from English. */
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

const es: AppModuleBundle = clone(en);
const zh: AppModuleBundle = clone(en);
const ar: AppModuleBundle = clone(en);
const fr: AppModuleBundle = clone(en);

applyZh(zh);
applyAr(ar);
applyFr(fr);

// --- Spanish ---
Object.assign(es.common, {
  lockedPlan: "No incluido en tu plan actual",
  viewPlan: "Ver plan",
  workspaceOverview: "Resumen del espacio",
  workspaceOverviewHint:
    "Métricas reales de la empresa. Los módulos vacíos muestran cero — nunca valores estimados.",
  complianceStatus: "Estado de cumplimiento",
  complianceStatusHint: "Distribución actual del estado de documentos de tu empresa.",
  complianceStatusHintEmpty:
    "Distribución según tus documentos. La tendencia histórica aparece cuando haya actualizaciones.",
  complianceEmpty: "Aún no hay documentos de cumplimiento.",
  workspaceActivity: "Actividad del espacio",
  workspaceActivityHint:
    "Actividad de solicitudes de clientes y cuestionarios en los últimos 30 días.",
  activityEmptyPeriod: "Sin actividad en este período.",
  activityEmpty: "Aún no hay actividad reciente registrada.",
  deadlineOverview: "Resumen de plazos",
  deadlineOverviewHint: "Próximos plazos del calendario por ventana temporal.",
  deadlineEmpty: "No hay plazos próximos en el calendario.",
  recentActivity: "Actividad reciente",
  yourWorkspace: "Tu espacio Bidvera",
  dashboardTitle: "Panel",
  dashboardSubtitle:
    "Cumplimiento, cualificación, solicitudes, cuestionarios, evidencias, decisiones y plazos — en un solo espacio.",
  noDataYet: "Aún no hay datos",
  deadlineLabel: "Plazo",
  eventLabel: "Evento",
  currentPlan: "Plan actual",
  currentPlanHint:
    "Suscripción del espacio y capacidades habilitadas para tu empresa.",
  noSubscription: "Sin suscripción activa",
  trialEnds: "La prueba termina el {date}",
  freeWorkspaceTrialExpiredTitle: "Tu prueba de Free Workspace ha terminado.",
  freeWorkspaceTrialExpiredBody:
    "El pago es obligatorio para continuar. Elige un plan de pago para recuperar el acceso.",
  freeWorkspaceTrialCta: "Elegir un plan",
  teamMembers: "Miembros del equipo",
  planLabel: "Plan",
  enabledCapabilities: "Capacidades habilitadas",
  noCapabilities: "Aún no hay capacidades comerciales habilitadas.",
  manageBilling: "Gestionar facturación",
  recentActivityTitle: "Actividad reciente",
  recentActivityHint: "Últimas actualizaciones en el espacio de tu empresa.",
  recentActivityEmpty: "Aún no hay actividad reciente.",
  activityDocument: "Documento actualizado",
  activityClientRequest: "Solicitud de cliente",
  activityDecision: "Actividad de decisión",
  quickActionsTitle: "Acciones rápidas",
  quickActionsHint: "Atajos a las capacidades de tu plan actual.",
  addDocument: "Añadir documento",
  completeQualification: "Completar cualificación",
  createClientRequest: "Crear solicitud de cliente",
  openQuestionnaire: "Abrir cuestionarios",
  reviewEvidence: "Revisar evidencia",
  reviewDeadlines: "Revisar plazos",
  loadingWorkspace: "Cargando el espacio de trabajo…",
});
Object.assign(es.kpi.document_compliance, {
  title: "Cumplimiento documental",
  hint: "Documentos vigentes",
  secondaryLabel: "docs totales",
});
Object.assign(es.kpi.expiring_documents, {
  title: "Documentos por vencer",
  hint: "Próximos a caducar",
  secondaryLabel: "caducados",
});
Object.assign(es.kpi.supplier_qualification, {
  title: "Cualificación de proveedor",
  hint: "Completitud del perfil",
  secondaryLabel: "evidencias",
});
Object.assign(es.kpi.client_requests, {
  title: "Solicitudes de clientes",
  hint: "Solicitudes abiertas",
  secondaryLabel: "completadas",
});
Object.assign(es.kpi.questionnaires, {
  title: "Cuestionarios",
  hint: "Borradores pendientes",
  secondaryLabel: "hechos / packs",
});
Object.assign(es.kpi.evidence_intelligence, {
  title: "Evidencia de proveedor",
  hint: "Evidencia verificada",
  secondaryLabel: "faltante / abierta",
});
Object.assign(es.kpi.decision_activity, {
  title: "Actividad de decisiones",
  hint: "Decisiones guardadas",
  secondaryLabel: "actualizadas (30 d)",
});
Object.assign(es.kpi.upcoming_deadlines, {
  title: "Próximos plazos",
  hint: "Plazos del calendario",
  secondaryLabel: "próxima ventana",
});
Object.assign(es.documentCompliance, {
  eyebrow: "Cumplimiento documental",
  title: "Documentos de cumplimiento",
  subtitle: "Controla licencias, certificados y recordatorios de caducidad.",
  emptyTitle: "Aún no hay documentos de cumplimiento",
  emptyDescription:
    "Sube licencias, certificados y otros documentos para seguir caducidades y recibir avisos.",
  emptyCta: "Subir documento",
  upload: "Subir",
  allDocuments: "Todos los documentos",
  dashboard: "Panel",
  settings: "Ajustes",
  reminders: "Recordatorios",
  save: "Guardar",
  cancel: "Cancelar",
  edit: "Editar",
  create: "Crear",
  delete: "Eliminar",
  back: "Volver",
  loading: "Cargando…",
  saved: "Guardado",
  errorGeneric: "Algo salió mal. Inténtalo de nuevo.",
  total: "Total",
  valid: "Vigente",
  expiring: "Por vencer",
  expired: "Caducado",
  unknown: "Desconocido",
  open: "Abrir",
  pending: "Pendiente",
  inProgress: "En curso",
  completed: "Completado",
  overdue: "Vencido",
  all: "Todos",
  search: "Buscar",
  filter: "Filtrar",
  sort: "Ordenar",
  noResults: "Sin resultados",
  previous: "Anterior",
  next: "Siguiente",
  actions: "Acciones",
  status: "Estado",
  name: "Nombre",
  category: "Categoría",
  expires: "Caduca",
  expiresOn: "caduca {date}",
  neverExpires: "Sin caducidad",
  view: "Ver",
  details: "Detalles",
  required: "Obligatorio",
  optional: "Opcional",
  companyProfileLink: "Perfil de empresa",
  expiringSoon: "Caducan pronto",
  noExpiringSoon: "Ningún documento caduca pronto.",
  reminderSettings: "Ajustes de recordatorios",
  uploadTitle: "Subir documento",
  uploadSubtitle: "Añade una licencia, certificado u otro documento.",
  documentsTitle: "Todos los documentos",
  documentsSubtitle: "Consulta y gestiona tu biblioteca de cumplimiento.",
  settingsTitle: "Ajustes de recordatorios",
  settingsSubtitle: "Elige cuándo Bidvera debe avisarte antes de que caduquen.",
  documentsLink: "Documentos",
  detailRecordHint: "Registro de cumplimiento del inquilino",
  documentNumberLabel: "Número de documento",
  issuingAuthorityLabel: "Autoridad emisora",
  issueDateLabel: "Fecha de emisión",
  expiryDateLabel: "Fecha de caducidad",
  extractionConfidenceLabel: "Confianza de extracción",
  extractionProvenanceTitle: "Procedencia de extracción",
  extractionProvenanceSubtitle:
    "Evidencia que respalda campos extraídos — nunca acciones automáticas.",
  versionsTitle: "Versiones",
  download: "Descargar",
  fileLabel: "Archivo",
  dragDropTitle: "Arrastra y suelta tu documento aquí",
  fileHint: "PDF, Word, imágenes y archivos de oficina habituales",
  chooseFile: "Elegir archivo",
  uploadingMetadata: "Subiendo y extrayendo metadatos",
  nameOptional: "Nombre (opcional)",
  chooseFileError: "Elige un archivo para subir.",
  uploadFailed: "Error al subir.",
  noExpiryCheckbox: "Este documento no tiene caducidad",
  uploadExtract: "Subir y extraer",
  uploading: "Subiendo…",
});
Object.assign(es.supplierQualification, {
  eyebrow: "Cualificación de proveedor",
  title: "Cualificación de proveedor",
  subtitle:
    "Preparación del proveedor para ofertas y cuestionarios — distinta del Perfil de empresa para el análisis de encaje.",
  emptyTitle: "Tu perfil de proveedor está vacío",
  emptyDescription:
    "Empieza por los datos legales y añade cualificaciones, servicios, cobertura y evidencias.",
  emptyCta: "Iniciar perfil de proveedor",
  buildTitle: "Construye tu perfil de cualificación",
  buildSubtitle:
    "Preparación del proveedor para ofertas y cuestionarios — distinta del Perfil de empresa.",
  editProfile: "Editar perfil de proveedor",
  completeness: "Completitud del perfil",
  allRequired: "Todos los campos obligatorios están completos.",
  missing: "Falta: {fields}",
  evidence: "Evidencia",
  qualifications: "Cualificaciones",
  services: "Servicios",
  coverage: "Cobertura",
  profile: "Perfil",
  defaultProfileName: "Perfil de proveedor",
  companyProfileLink: "Perfil de empresa",
  profilePageTitle: "Perfil de empresa",
  profileCompletenessLine:
    "Completitud: {percent}% — solo campos obligatorios; nunca inferidos por IA.",
  evidencePageTitle: "Documentos y referencias de evidencia",
  evidencePageSubtitle:
    "Archivos o URL de apoyo opcionales. Propiedad del inquilino; el contenido no se verifica automáticamente.",
  qualificationsPageTitle: "Cualificaciones y certificaciones",
  qualificationsPageSubtitle:
    "Certificaciones y licencias libres — no se tratan como evidencia verificada.",
  servicesPageTitle: "Servicios y sectores",
  servicesPageSubtitle:
    "Sectores y servicios personalizados — sin taxonomía sectorial fija.",
  coveragePageSubtitle:
    "Cobertura geográfica, monedas e idiomas — independiente del país.",
  save: "Guardar",
  cancel: "Cancelar",
  edit: "Editar",
  back: "Volver",
  loading: "Cargando…",
  saved: "Guardado",
  errorGeneric: "Algo salió mal. Inténtalo de nuevo.",
});
Object.assign(es.clientRequests, {
  eyebrow: "Solicitudes de clientes",
  title: "Solicitudes de clientes",
  subtitle:
    "Sigue peticiones de información y documentos, vincula evidencias y comparte un dossier seguro.",
  emptyTitle: "Aún no hay solicitudes de clientes",
  emptyDescription:
    "Registra peticiones de compradores, vincula evidencias de Bidvera y comparte un dossier seguro.",
  emptyCta: "Crear solicitud",
  createRequest: "Crear solicitud",
  newTitle: "Nueva solicitud de cliente",
  newSubtitle: "Captura lo que pidió el comprador y sigue el cumplimiento.",
  client: "Cliente",
  deadline: "Plazo",
  updated: "Actualizado",
  items: "Elementos",
  share: "Compartir",
  noMatch: "Ninguna solicitud coincide con estos filtros.",
  backToList: "Volver a solicitudes",
  pending: "Pendiente",
  inProgress: "En curso",
  completed: "Completado",
  overdue: "Vencido",
  all: "Todos",
});
Object.assign(es.tenderCalendar, {
  eyebrow: "Calendario de licitaciones",
  title: "Plazos y recordatorios",
  subtitle: "Sigue fechas de presentación y recibe alertas de las oportunidades que sigues.",
  emptyTitle: "Aún no hay oportunidades seguidas",
  emptyDescription:
    "Añade licitaciones para ver plazos en el calendario y recibir recordatorios.",
  emptyCta: "Añadir licitación",
  deadlinesTitle: "Plazos y recordatorios",
  deadlinesSubtitle:
    "Sigue fechas de presentación y recibe alertas de las oportunidades que sigues.",
  trackedOpportunities: "Oportunidades seguidas",
  addTender: "Añadir licitación",
  trackedTenders: "Licitaciones seguidas",
  upcomingDeadlines: "Próximos plazos",
  pastDeadlines: "Plazos pasados",
  calendarHeading: "Calendario · {month}",
  noItemsMonth: "No hay plazos en este mes.",
  tendersTitle: "Oportunidades seguidas",
  tendersSubtitle: "Oportunidades que sigues en el calendario.",
  settingsTitle: "Ajustes de recordatorios",
  settingsSubtitle: "Configura con qué antelación Bidvera te recuerda los plazos.",
  calendarHome: "Calendario",
  createTenderTitle: "Crear licitación",
  searchOpportunitiesPlaceholder: "Buscar título, referencia, comprador…",
  countryPlaceholder: "País",
  allStatuses: "Todos los estados",
  emptyFilterTitle: "Ninguna oportunidad coincide con estos filtros",
  emptyFilterDescription: "Prueba a quitar filtros o buscar otro término.",
  nextDeadlineLabel: "Próximo {date}",
  noDeadline: "Sin plazo",
  reminderRulesHint:
    "Los recordatorios usan la fecha/hora guardada de cada plazo. Nunca se inventan zonas horarias.",
  reminders: "Recordatorios",
  previous: "Anterior",
  next: "Siguiente",
});
Object.assign(es.matchedOpportunities, {
  eyebrow: "Oportunidades coincidentes",
  title: "Oportunidades coincidentes",
  subtitle: "Recomendaciones según el perfil y las preferencias de tu empresa.",
  emptyTitle: "Aún no hay recomendaciones",
  emptyDescription:
    "Genera recomendaciones cuando Matching esté disponible en tu espacio.",
  emptyCta: "Generar recomendaciones",
  recommendations: "Recomendaciones",
  sponsored: "Patrocinado",
  sponsoredTitle: "Matching patrocinado",
  matchScore: "Puntuación de coincidencia",
  dismiss: "Descartar",
  generate: "Generar",
  noRecommendations: "No hay recomendaciones que mostrar.",
  sponsoredEyebrow: "Matching patrocinado",
  sponsoredRequestTitle: "Solicitar matching patrocinado",
  sponsoredRequestSubtitle:
    "Elige un plan activo y paga de forma segura con Stripe o PayPal. El patrocinio nunca elude la relevancia del matching.",
  sponsoredUnavailableSubtitle:
    "El matching patrocinado no está disponible ahora. Las oportunidades orgánicas siguen disponibles cuando Matching Engine está activo.",
  backToMatched: "Volver a oportunidades coincidentes",
  sponsoredCta: "Matching patrocinado",
  sponsoredPayWithStripe: "Pagar con Stripe",
  sponsoredPayWithPayPal: "Pagar con PayPal",
  sponsoredGatewayLabel: "Método de pago",
  sponsoredRedirecting: "Redirigiendo al pago…",
  sponsoredNoGateways:
    "No hay métodos de pago configurados. Pide a Super Admin activar Stripe o PayPal en Payments.",
  sponsoredPaidSuccess:
    "Pago recibido. Tu solicitud de matching patrocinado está confirmada.",
  sponsoredPaidPending: "El pago aún se está procesando. Actualiza en un momento.",
  sponsoredPaidError:
    "No pudimos confirmar el pago. Contacta soporte si se te cobró.",
  sponsoredCheckoutCancelled: "Checkout cancelado. No se realizó ningún cobro.",
  sponsoredNoPlansTitle: "No hay planes patrocinados disponibles",
  sponsoredNoPlansBody:
    "Los planes de matching patrocinado activos aparecerán aquí cuando Super Admin los publique.",
  sponsoredPeriodOneTime: "Pago único",
  sponsoredPeriodThreeDays: "3 días",
  sponsoredPeriodMonthly: "Mensual",
  sponsoredPeriodQuarterly: "Trimestral",
  sponsoredPeriodYearly: "Anual",
  sponsoredCampaignDays: "Campaña de {days} días",
  sponsoredCampaignDurationAdmin: "Duración de campaña definida por el administrador",
  sponsoredUpToCampaigns: "hasta {n} campañas",
  sponsoredUpToImpressions: "hasta {n} impresiones",
  sponsoredConfirmTitle: "Confirmar y pagar",
  sponsoredConfirmBody:
    "Serás redirigido a Stripe o PayPal para completar el pago con las credenciales configuradas en Bidvera. El patrocinio nunca elude la relevancia del matching.",
  sponsoredPlanLabel: "Plan",
  sponsoredPriceLabel: "Precio",
  sponsoredDurationLabel: "Duración / límites",
  sponsoredDays: "{days} días",
  sponsoredAsConfigured: "Según configuración",
  sponsoredCampaignsCount: "{n} campañas",
  sponsoredDefaultBenefit1: "Etiqueta patrocinada solo entre coincidencias relevantes",
  sponsoredDefaultBenefit2: "No elude elegibilidad ni relevancia",
  sponsoredDefaultBenefit3: "Las coincidencias orgánicas siguen siendo prioritarias a igual relevancia",
  sponsoredBenefitPriority: "Colocación prioritaria entre coincidencias relevantes",
  sponsoredBenefitNoBypass: "No elude la relevancia",
  sponsoredSubmit: "Continuar al pago",
  sponsoredSubmitSuccess:
    "Solicitud enviada. Nuestro equipo hará seguimiento — no se cobró ningún pago.",
  sponsoredSubmitError: "No se pudo iniciar el checkout.",
  matchDisclaimer:
    "Una coincidencia significa que Bidvera identificó una oportunidad relevante, no un contrato ganado.",
  dashboardSectionTitle: "Oportunidades de matching",
  dashboardSectionSubtitle:
    "Proyectos que encajan con las capacidades, ubicación y cualificaciones de tu empresa.",
  viewMatch: "Ver coincidencia",
  viewAllOpportunities: "Ver todas las oportunidades",
  whyMatched: "Por qué coincide",
  gapsLabel: "Brechas a revisar",
  highlyRelevant: "Muy relevante",
  emptyImproveProfile:
    "Completa servicios, geografía y certificaciones en el perfil de empresa para mejorar la calidad del match.",
  updateCompanyProfile: "Actualizar perfil de empresa",
  refreshMatches: "Actualizar coincidencias",
  filterRelevance: "Relevancia",
  filterDeadline: "Plazo",
  filterGeography: "Geografía",
  filterCategory: "Categoría",
  filterStatus: "Estado",
  statusAll: "Todos",
  statusNew: "Nuevo",
  statusViewed: "Visto",
  statusHighlyRelevant: "Muy relevante",
  interested: "Me interesa",
  viewOpportunity: "Ver oportunidad",
  locationLabel: "Ubicación",
  deadlineLabel: "Plazo",
  matchedCapabilities: "Capacidades coincidentes",
  noMatchFilter: "No hay coincidencias para estos filtros.",
  notEligibleTitle: "Completa tu perfil de matching",
  notEligibleBody:
    "Añade capacidades y geografía de la empresa para que Bidvera evalúe el encaje. Nunca se inventan coincidencias.",
  unavailableTitle: "Matching no está en este plan",
  unavailableBody:
    "Cuando Matching esté activo en tu espacio, aquí aparecerán proyectos relevantes.",
  emptyTitleDashboard: "Aún no hay coincidencias",
  emptyBodyDashboard:
    "Cuando proyectos activos encajen con tu perfil elegible, aparecerán aquí. Mejorar servicios y geografía aumenta la precisión.",
});
Object.assign(es.questionnaireAssistant, {
  eyebrow: "Asistente de cuestionarios",
  title: "Asistente de cuestionarios",
  subtitle: "Redacta respuestas estructuradas con la evidencia de tu empresa.",
  emptyTitle: "Aún no hay packs de cuestionario",
  emptyDescription:
    "Abre un espacio de licitación para iniciar un pack cuando esté disponible.",
  emptyCta: "Ver licitaciones",
  workbenchTitle: "Mesa de cuestionarios",
  workbenchSubtitle: "Revisa preguntas y redacta respuestas con tu evidencia.",
  packs: "Packs",
  drafts: "Borradores",
  startPack: "Iniciar pack",
  noPacks: "Aún no hay packs para esta licitación.",
  selectTender: "Selecciona una licitación",
  updateCompanyProfile: "Actualizar perfil de empresa",
});

export const appModulesByLocale: Record<Locale, AppModuleBundle> = {
  en,
  es,
  zh,
  ar,
  fr,
};

export function listAppModuleLeafPaths(
  bundle: object,
  prefix = "",
): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(bundle)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out.push(...listAppModuleLeafPaths(v as object, path));
    } else {
      out.push(path);
    }
  }
  return out;
}
