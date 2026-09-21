import type { Locale } from "./config";
import {
  appModulesByLocale,
  type AppModuleBundle,
} from "./app-modules";

export type Dictionary = {
  nav: {
    product: string;
    pricing: string;
    faq: string;
    solutions: string;
    resources: string;
    signIn: string;
    startFree: string;
    app: string;
    language: string;
  };
  brand: {
    tagline: string;
    description: string;
  };
  landing: {
    headline: string;
    subhead: string;
    ctaPrimary: string;
    ctaSecondary: string;
    trialNote: string;
    previewLabel: string;
    previewQuestion: string;
    previewDecision: string;
    previewFit: string;
    previewRisk: string;
    previewRiskValue: string;
    previewMissing: string;
    previewMissingValue: string;
    previewNext: string;
    previewNextValue: string;
    previewWhy: string;
    sectionTitle: string;
    sectionBody: string;
    feature1Title: string;
    feature1Body: string;
    feature2Title: string;
    feature2Body: string;
    feature3Title: string;
    feature3Body: string;
    capabilitiesTitle: string;
    capabilitiesLearnMore: string;
    capabilitiesShowLess: string;
    capabilities: Array<{ title: string; body: string; detail: string }>;
    smartMatch: {
      eyebrow: string;
      title: string;
      body: string;
      benefit1: string;
      benefit2: string;
      benefit3: string;
      dimensionsLabel: string;
      dimensions: [string, string, string, string, string, string];
      note: string;
      ctaPrimary: string;
      ctaSecondary: string;
    };
    bottomTitle: string;
    bottomBody: string;
    bottomCta: string;
    howTitle: string;
    howBody: string;
    step1Title: string;
    step1Body: string;
    step2Title: string;
    step2Body: string;
    step3Title: string;
    step3Body: string;
    step4Title: string;
    step4Body: string;
    beforeAfterTitle: string;
    beforeAfterBody: string;
    beforeLabel: string;
    afterLabel: string;
    beforeItems: [string, string, string, string];
    afterItems: [string, string, string, string];
    complianceEyebrow: string;
    complianceHeadline: string;
    complianceBody: string;
    complianceBenefit1Title: string;
    complianceBenefit1Body: string;
    complianceBenefit2Title: string;
    complianceBenefit2Body: string;
    complianceBenefit3Title: string;
    complianceBenefit3Body: string;
    compliancePanelTitle: string;
    complianceAddLabel: string;
    complianceAlertTitle: string;
    complianceReadyLabel: string;
    complianceReadyHint: string;
    complianceStatusValid: string;
    complianceStatusExpiring: string;
    complianceDocTrade: string;
    complianceDocTax: string;
    complianceDocInsurance: string;
    complianceDocQuality: string;
    complianceDocFinancial: string;
    complianceDateTrade: string;
    complianceDateTax: string;
    complianceDateInsurance: string;
    complianceDateQuality: string;
    complianceDateFinancial: string;
    pricingTeaserTitle: string;
    pricingTeaserBody: string;
    pricingTeaserCta: string;
    viewAllFaq: string;
    testimonialsTitle: string;
    testimonialsBody: string;
    testimonialsEmptyTitle: string;
    testimonialsEmptyBody: string;
    testimonialsEmptyCta: string;
  };
  product: {
    eyebrow: string;
    title: string;
    body: string;
    step1Title: string;
    step1Body: string;
    step2Title: string;
    step2Body: string;
    step3Title: string;
    step3Body: string;
    seeTitle: string;
    seeItems: string[];
    cta: string;
    futureTitle: string;
    futureBody: string;
    highlightItems: string[];
  };
  pricing: {
    eyebrow: string;
    title: string;
    body: string;
    perMonth: string;
    perMonthYearly: string;
    analysesSeats: string;
    seatsOnly: string;
    startFree: string;
    startFreeWorkspace: string;
    startTrial: string;
    startSubscription: string;
    choose: string;
    monthly: string;
    yearly: string;
    save: string;
    recommended: string;
    mostPopular: string;
    trialBadge: string;
    noChargeToday: string;
    paymentMethodRequired: string;
    cancelBeforeTrial: string;
    freeHeadline: string;
    freeLimitedNote: string;
    comparisonTitle: string;
    comparisonFeature: string;
    yearlyNote: string;
    valueTitle1: string;
    valueBody1: string;
    valueTitle2: string;
    valueBody2: string;
    valueTitle3: string;
    valueBody3: string;
    ctaTitle: string;
    ctaBody: string;
    groups: {
      readiness: string;
      opportunities: string;
      intelligence: string;
      workflow: string;
    };
    features: {
      company_profile: string;
      document_compliance: string;
      supplier_qualification: string;
      client_requests: string;
      tender_calendar: string;
      evidence_intelligence: string;
      advanced_decision_engine: string;
      decision_memory: string;
      decision_simulator: string;
      explainable_decision: string;
      tender_analysis: string;
      questionnaire_assistant: string;
      smart_alerts: string;
      team_collaboration: string;
      pdf_export: string;
      tender_action_plan: string;
    };
  };
  faq: {
    eyebrow: string;
    title: string;
    items: Array<{ q: string; a: string }>;
  };
  auth: {
    loginTitle: string;
    loginBody: string;
    emailChangedNotice: string;
    signupTitle: string;
    signupBody: string;
    /** Desktop split panel (Facebook-style left column) */
    sideHeadline: string;
    sideBody: string;
    /** Illustration status pills (opportunity-fit messaging on auth screens) */
    sidePillMatched: string;
    sidePillReview: string;
    sidePillNotAMatch: string;
    name: string;
    companyName: string;
    email: string;
    password: string;
    confirmPassword: string;
    submitLogin: string;
    submitSignup: string;
    haveAccount: string;
    newHere: string;
    acceptTerms: string;
    acceptTermsError: string;
    continueGoogle: string;
    googleComingSoon: string;
    continueMicrosoft: string;
    microsoftComingSoon: string;
    forgotPassword: string;
    forgotTitle: string;
    forgotBody: string;
    forgotSubmit: string;
    forgotSent: string;
    resetTitle: string;
    resetBody: string;
    resetSubmit: string;
    passwordMismatch: string;
  };
  assistant: {
    askLabel: string;
    title: string;
    description: string;
    placeholder: string;
    send: string;
    thinking: string;
    play: string;
    pause: string;
    mute: string;
    unmute: string;
    voiceUnavailable: string;
    errorGeneric: string;
    attachImage: string;
    removeImage: string;
    imageOnlyOne: string;
    imageTooLarge: string;
    imageInvalid: string;
    imageQuotaReached: string;
    replyQuotaReached: string;
  };
  app: {
    nav: {
      dashboard: string;
      tenders: string;
      tenderCalendar: string;
      documentCompliance: string;
      supplierQualification: string;
      clientRequests: string;
      questionnaireAssistant: string;
      matchedOpportunities: string;
      company: string;
      billing: string;
      alerts: string;
      settings: string;
      decisionMemory: string;
      teamWorkflow: string;
      sectionCapabilities: string;
      sectionWorkspace: string;
      sectionAccount: string;
    };
    shell: {
      tagline: string;
      analyzeTender: string;
      upgrade: string;
      signOut: string;
      openMenu: string;
      closeMenu: string;
      decisionWorkspace: string;
      yourCompany: string;
      workspace: string;
    };
    dashboard: {
      eyebrow: string;
      title: string;
      subtitle: string;
      analyzeCta: string;
      activeTenders: string;
      inPipeline: string;
      bid: string;
      pursue: string;
      review: string;
      verifyFirst: string;
      noBid: string;
      skipEffort: string;
      upcomingDeadlines: string;
      upcomingEmpty: string;
      upcomingCalendarDeadlines: string;
      upcomingCalendarHint: string;
      upcomingCalendarEmpty: string;
      addCalendarTender: string;
      highRisk: string;
      highRiskEmpty: string;
      recentAnalyses: string;
      recentEmpty: string;
      viewAll: string;
      due: string;
      analyzed: string;
      decisionDistribution: string;
      decisionDistributionHint: string;
      upcomingHint: string;
      uploadTender: string;
      riskOverview: string;
      riskOverviewHint: string;
      recentHint: string;
      platformTitle: string;
      platformHint: string;
      capabilityAnalysisDesc: string;
      capabilityComplianceDesc: string;
      capabilityQualificationDesc: string;
      capabilityCalendarDesc: string;
      capabilityOpen: string;
      capabilityGetStarted: string;
      capabilityUpgrade: string;
      statusAnalyses: string;
      statusDocuments: string;
      statusCompleteness: string;
      statusDeadlines: string;
      statusLocked: string;
      gettingStartedTitle: string;
      gettingStartedHint: string;
    };
    onboarding: {
      signOutHint: string;
      stepVerify: string;
      stepCompany: string;
      stepPlan: string;
      verifyTitle: string;
      verifyBody: string;
      resend: string;
      resent: string;
      verifyInvalidTitle: string;
      verifyInvalidBody: string;
      companyTitle: string;
      companyBody: string;
      companyName: string;
      country: string;
      industry: string;
      companySize: string;
      services: string;
      servicesHint: string;
      experience: string;
      experienceOptional: string;
      privacyNote: string;
      companySubmit: string;
      companySkip: string;
      planTitle: string;
      planBody: string;
      trialTitle: string;
      trialBody: string;
      trialCta: string;
      paidCta: string;
      freeTitle: string;
      freeBody: string;
      freeCta: string;
      noChargeToday: string;
      paymentMethodRequired: string;
      cancelBeforeTrial: string;
      monthly: string;
      yearly: string;
      checkoutCanceled: string;
      checkoutPending: string;
    };
    companyProfile: {
      title: string;
      subtitle: string;
      headerHint: string;
      /** Text before the Supplier Qualification link on the company page. */
      supplierQualificationHint: string;
      supplierQualificationLink: string;
      companyName: string;
      completeness: string;
      savedTitle: string;
      savedBody: string;
      saveErrorTitle: string;
      basicsTitle: string;
      basicsBody: string;
      industry: string;
      country: string;
      companySize: string;
      notProvided: string;
      experienceLevel: string;
      experienceYears: string;
      experienceYearsPlaceholder: string;
      revenueRange: string;
      revenuePlaceholder: string;
      employees: string;
      employeesPlaceholder: string;
      sizeSolo: string;
      sizeSmall: string;
      sizeMedium: string;
      sizeEnterprise: string;
      expNew: string;
      expSome: string;
      expExperienced: string;
      expHighly: string;
      capabilitiesTitle: string;
      services: string;
      certifications: string;
      geographicCoverage: string;
      commaSeparated: string;
      contractTitle: string;
      contractMin: string;
      contractMax: string;
      rulesTitle: string;
      rulesBody: string;
      save: string;
      learningTitle: string;
      learningBody: string;
      learningCheckbox: string;
      learningSaving: string;
    };
    billing: {
      title: string;
      subtitle: string;
      activatedTitle: string;
      activatedBody: string;
      trialEndedTitle: string;
      trialEndedBody: string;
      viewPlans: string;
      currentPlanTitle: string;
      currentPlanBody: string;
      plan: string;
      status: string;
      provider: string;
      billingCycle: string;
      renewal: string;
      paymentMethod: string;
      changePlan: string;
      upgradePlan: string;
      cancelSubscription: string;
      cancelScheduled: string;
      upgradesTitle: string;
      upgradesBody: string;
      upgradesBodyOne: string;
      openCheckout: string;
      paymentHistory: string;
      noPayments: string;
      invoices: string;
      noInvoices: string;
      viewInvoice: string;
      trialFallback: string;
      usageTitle: string;
      trialUsageTitle: string;
      trialEndedDesc: string;
      unlimitedDesc: string;
      remainingDesc: string;
      trialEnds: string;
      expired: string;
      analysesUsed: string;
      used: string;
      remaining: string;
      unlimited: string;
      hoursSaved: string;
      risksDetected: string;
      upgradeContinue: string;
      runningLow: string;
      seePlans: string;
      trialBadge: string;
      trialEndsIn: string;
      trialEndsInOne: string;
      trialEndingToday: string;
      trialEndsOn: string;
      noChargeToday: string;
      paymentMethodRequired: string;
      trialAutoConvert: string;
      cancelTrial: string;
      cancelTrialTitle: string;
      cancelTrialExplainConvert: string;
      cancelTrialExplainAccess: string;
      cancelTrialExplainData: string;
      cancelPaidTitle: string;
      cancelPaidExplainDate: string;
      cancelPaidExplainAccess: string;
      cancelPaidExplainAfter: string;
      confirmCancel: string;
      keepPlan: string;
      cancellationDate: string;
      accessUntil: string;
      freeWorkspace: string;
      freeWorkspaceBody: string;
      freeCapabilityProfile: string;
      freeCapabilityCompliance: string;
      nextBillingDate: string;
      usage: string;
      paymentFailed: string;
      pastDue: string;
      statusTrialing: string;
      statusActive: string;
      statusCanceled: string;
      statusUnpaid: string;
      statusExpired: string;
      statusIncomplete: string;
      monthlyInterval: string;
      yearlyInterval: string;
      seatsUsage: string;
      aiUsage: string;
      analysesUsage: string;
      analysesNotIncluded: string;
      cancelError: string;
      started: string;
      paypalMethod: string;
      graceTitle: string;
      graceBody: string;
      inactiveTitle: string;
      inactiveBody: string;
      billingHistory: string;
      billingHistoryEmpty: string;
      invoiceDate: string;
      invoiceAmount: string;
      invoiceStatus: string;
      viewReceipt: string;
      updatePaymentMethod: string;
      retryPayment: string;
      paymentProblemTitle: string;
      paymentProblemBody: string;
      paypalManageHint: string;
      paymentPortalError: string;
      canceledAlertTitle: string;
      subscriptionEndedTitle: string;
      subscriptionEndedBody: string;
      choosePlan: string;
      graceDaysRemaining: string;
      graceDaysRemainingOne: string;
    };
    alerts: {
      title: string;
      subtitle: string;
      emptyTitle: string;
      emptyDescription: string;
      newBadge: string;
      markAllRead: string;
      unreadCount: string;
    };
    settings: {
      title: string;
      subtitle: string;
      accountTitle: string;
      accountBody: string;
      name: string;
      email: string;
      avatarLabel: string;
      avatarHint: string;
      avatarUpload: string;
      avatarUploading: string;
      avatarRemove: string;
      accountSave: string;
      accountSaving: string;
      accountSaved: string;
      emailChangeHint: string;
      emailChangePending: string;
      emailChangeSent: string;
      emailChangeResend: string;
      emailChangeResent: string;
      emailChangeExpires: string;
      emailChangePasswordLabel: string;
      emailChangePasswordHint: string;
      emailChangePasswordRequired: string;
      emailChangeCancel: string;
      emailChangeCancelled: string;
      emailChangeInvalidTitle: string;
      emailChangeInvalidBody: string;
      emailChangeBackSettings: string;
      companyProfileTitle: string;
      companyProfileBody: string;
      editCompanyProfile: string;
      notificationsTitle: string;
      notificationsBody: string;
      moduleRemindersTitle: string;
      moduleRemindersBody: string;
      complianceRemindersLink: string;
      calendarRemindersLink: string;
      planTitle: string;
      planUnlimited: string;
      planLimited: string;
      manageBilling: string;
      viewUpgrade: string;
      signOut: string;
      revokeOtherSessions: string;
      revokeOtherSessionsHint: string;
      timezone: string;
      timezoneHint: string;
      channels: string;
      channelInApp: string;
      channelEmail: string;
      channelWhatsapp: string;
      channelSms: string;
      channelPush: string;
      deadlineAlerts: string;
      deadline7d: string;
      deadline3d: string;
      deadline24h: string;
      deadlinePassed: string;
      otherAlerts: string;
      alertAnalysisDone: string;
      alertHighRisk: string;
      alertMissingDocs: string;
      alertScoreChange: string;
      alertRequirementStatus: string;
      alertDecisionMemory: string;
      alertWorkflow: string;
      prefsSaved: string;
      savePrefs: string;
    };
    tenders: {
      title: string;
      subtitle: string;
      subtitleOne: string;
      analyzeCta: string;
      emptyTitle: string;
      emptyDescription: string;
      search: string;
      searchPlaceholder: string;
      decision: string;
      allDecisions: string;
      bid: string;
      review: string;
      noBid: string;
      risk: string;
      allRiskLevels: string;
      low: string;
      medium: string;
      high: string;
      critical: string;
      deadline: string;
      anyDeadline: string;
      next7d: string;
      next14d: string;
      next30d: string;
      overdue: string;
      sort: string;
      sortRecent: string;
      sortDeadlineSoon: string;
      sortDeadlineLate: string;
      sortFit: string;
      sortTitle: string;
      colTender: string;
      colClient: string;
      colDeadline: string;
      colFit: string;
      colDecision: string;
      colRisk: string;
      colAnalyzed: string;
      colNextAction: string;
      deadlineWithDate: string;
      fitWithScore: string;
      noNextAction: string;
    };
    upload: {
      title: string;
      subtitle: string;
      trialLeft: string;
      trialEnds: string;
      phaseIdleTitle: string;
      phaseIdleBody: string;
      phaseUploadingTitle: string;
      phaseUploadingBody: string;
      phaseDiscoveringTitle: string;
      phaseDiscoveringBody: string;
      phaseExtractingTitle: string;
      phaseExtractingBody: string;
      phasePreparingTitle: string;
      phasePreparingBody: string;
      phaseProcessingTitle: string;
      phaseProcessingBody: string;
      phaseAnalyzingTitle: string;
      phaseAnalyzingBody: string;
      phaseSuccessTitle: string;
      phaseSuccessBody: string;
      phaseErrorTitle: string;
      phaseErrorBody: string;
      phaseAnalysisErrorTitle: string;
      phaseAnalysisErrorBody: string;
      phaseTimeoutBody: string;
      phaseTimeoutTitle: string;
      stillWorking: string;
      openTender: string;
      trialUsedTitle: string;
      trialUsedBody: string;
      viewPlans: string;
      unlimitedPlan: string;
      remainingAnalyses: string;
      dragHere: string;
      processingTender: string;
      fileTypes: string;
      chooseFile: string;
      filesSelected: string;
      filesDiscovered: string;
      maxFilesReached: string;
      removeFile: string;
      statusReady: string;
      statusUploading: string;
      statusDiscovering: string;
      statusExtracting: string;
      statusPreparing: string;
      statusProcessing: string;
      statusAnalyzing: string;
      startUpload: string;
      waitForUpload: string;
      bodyTooLarge: string;
      decisionReady: string;
      unableContinue: string;
      openDecision: string;
      uploadAnother: string;
      tryAgain: string;
      creditsExhausted: string;
      passwordRequiredTitle: string;
      passwordRequiredBody: string;
      passwordLabel: string;
      passwordSubmit: string;
      passwordCancel: string;
      passwordWrong: string;
      intakeRepairedTitle: string;
      intakePartialTitle: string;
      intakeIncompleteTitle: string;
      intakeReadyTitle: string;
      intakeBlockedTitle: string;
      intakeUnsupportedTitle: string;
      intakeCorruptedTitle: string;
      intakePartiallyReadableTitle: string;
    };
    tenderDetail: {
      backToTenders: string;
      unknownClient: string;
      deadline: string;
      analyzed: string;
      fullReport: string;
      analysisInProgressTitle: string;
      analysisInProgressBody: string;
      analysisFailedTitle: string;
      analysisFailedBody: string;
      analysisFailedPhase: string;
      canonicalNote: string;
      missingDocuments: string;
      required: string;
      nextActions: string;
      noNextActions: string;
      teamWorkflow: {
        title: string;
        subtitle: string;
        empty: string;
        criticalBanner: string;
        assign: string;
        respond: string;
        complete: string;
        create: string;
        responsePlaceholder: string;
        evidencePlaceholder: string;
        department: string;
        assignee: string;
        requiredResponse: string;
        linkedItem: string;
      };
      decisionSupport: string;
      fitSuffix: string;
      overallFit: string;
      confidence: string;
      confidenceHigh: string;
      confidenceMedium: string;
      confidenceLow: string;
      heroBidLabel: string;
      heroBidHint: string;
      heroReviewLabel: string;
      heroReviewHint: string;
      heroNoBidLabel: string;
      heroNoBidHint: string;
      companyTenderFit: string;
      unknown: string;
      basisAi: string;
      basisNotProvided: string;
      basisFromProfile: string;
      basisFromTender: string;
      tenderReadiness: string;
      readinessCounts: string;
      recommendation: string;
      keyBlockers: string;
      keyBlockersNext: string;
      whyTitle: string;
      executiveSummary: string;
      viewDetails: string;
      hideDetails: string;
      topReasons: string;
      criticalAlerts: string;
      whatToDoNext: string;
      decisionDisclaimer: string;
      expiredDeadlineAlert: string;
      mandatoryGapAlert: string;
      missingDocumentAlert: string;
      detailedAnalysisTitle: string;
      detailedAnalysisHint: string;
    };
    report: {
      backToTender: string;
      title: string;
      subtitle: string;
      reportNotReady: string;
      reportNotReadyBody: string;
      print: string;
      downloadPdf: string;
      shareLink: string;
      copied: string;
      shareExpires: string;
      revokeShare: string;
      shareRevoked: string;
      reportEyebrow: string;
      unknownClient: string;
      deadline: string;
      analyzed: string;
      recommendation: string;
      companyTenderFit: string;
      confidence: string;
      whyTitle: string;
      bidScore: string;
      bidScoreLine: string;
      expectedValue: string;
      risk: string;
      effort: string;
      positive: string;
      negative: string;
      overall: string;
      unknown: string;
      tenderReadiness: string;
      readinessCounts: string;
      nextStep: string;
      complianceMatrix: string;
      requirements: string;
      ready: string;
      missing: string;
      verify: string;
      notApplicable: string;
      withSources: string;
      mandatory: string;
      optional: string;
      evidenceLabel: string;
      noExcerpt: string;
      page: string;
      sourceNotLocated: string;
      noRequirements: string;
      missingRequirements: string;
      noMissingRequirements: string;
      mandatoryParen: string;
      verificationItems: string;
      nothingPendingVerify: string;
      risks: string;
      noRisks: string;
      clarifications: string;
      noClarifications: string;
      reason: string;
      source: string;
      evidence: string;
      noEvidence: string;
      historicalTitle: string;
      historicalBody: string;
      historicalPriority: string;
      historicalEmpty: string;
      decisionMemoryTitle: string;
      currentAnalysisLabel: string;
      historicalDecisionLabel: string;
      decisionMemoryCurrentNote: string;
      decisionMemoryEmpty: string;
      relevanceReasons: string;
      missingDocuments: string;
      nextActions: string;
      noNextActions: string;
      basisDirect: string;
      basisAi: string;
      basisUncertain: string;
      evidenceVerificationTitle: string;
      evidenceVerificationDisclaimer: string;
      verificationSummary: string;
      noVerificationChains: string;
      verificationStatusVerified: string;
      verificationStatusNeedsVerification: string;
      verificationStatusMissingEvidence: string;
      verificationStatusNotApplicable: string;
      verifierLabel: string;
      verifiedAtLabel: string;
      decisionOutcomeTitle: string;
      decisionOutcomeBidvera: string;
      decisionOutcomeHuman: string;
      decisionOutcomeActual: string;
      decisionOutcomeDate: string;
      decisionOutcomeReason: string;
      decisionOutcomeSuccess: string;
      decisionOutcomeSuccessAligned: string;
      decisionOutcomeSuccessMisaligned: string;
      decisionOutcomeSuccessPending: string;
      decisionOutcomeSuccessNeutral: string;
      decisionOutcomeRecorded: string;
      outcomeLearningTitle: string;
      decisionOutcomeAttachment: string;
      decisionOutcomeEvalSuccessful: string;
      decisionOutcomeEvalUnsuccessful: string;
      decisionOutcomeEvalNotEvaluated: string;
    };
    decisionMemory: {
      title: string;
      subtitle: string;
      emptyTitle: string;
      emptyDescription: string;
      emptyDescriptionCompanyContext: string;
      viewTender: string;
      openCompanyProfile: string;
      analyzed: string;
      scores: string;
      requirements: string;
      risks: string;
      reasoning: string;
      relevance: string;
      disclaimer: string;
      back: string;
    };
    pwa: {
      availableOn: string;
      updateTitle: string;
      updateBody: string;
      updateNow: string;
      installedTitle: string;
      installedBody: string;
      title: string;
      bodyBefore: string;
      bodyAnd: string;
      bodyAfter: string;
      installCta: string;
      openingInstaller: string;
      dismiss: string;
      guideTitleSafari: string;
      guideTitleEdge: string;
      guideTitleChrome: string;
      guideTitleDefault: string;
      guideDescription: string;
      desktopMeta: string;
      openInstallDialog: string;
      gotIt: string;
      iosStep1: string;
      iosStep2: string;
      iosStep2Strong: string;
      iosStep3: string;
      safariMacStep1: string;
      safariMacStep1Strong: string;
      safariMacStep2: string;
      safariMacStep2Strong: string;
      safariMacStep3: string;
      chromiumStep1Before: string;
      chromiumStep1Strong: string;
      chromiumStep1After: string;
      chromiumStep2Before: string;
      chromiumStep2Strong: string;
      chromiumStep3Before: string;
      chromiumStep3Install: string;
      chromiumStep3Mid: string;
      chromiumStep3Apps: string;
    };
  };
};

/** Eight verified commercially marketed customer-facing capabilities (no Tender Analysis / Matching as sold modules). */
const LANDING_CAPABILITIES: Array<{ title: string; body: string; detail: string }> = [
  {
    title: "Company Profile",
    body: "Keep company identity, services and readiness information organized in one workspace.",
    detail:
      "Capture industry, services, geography and size so the team shares one current view of what the company offers. This foundation supports qualification, evidence and opportunity review — without hunting across spreadsheets and folders.",
  },
  {
    title: "Document Compliance",
    body: "Track critical company documents and expiry dates before they become blockers.",
    detail:
      "Store licences, certificates and insurance in a secure workspace, monitor validity, and see what needs attention before it lapses. Useful when buyers ask for proof and your team needs a single source of truth.",
  },
  {
    title: "Supplier Qualification",
    body: "Show what your company is qualified to deliver — and where gaps remain.",
    detail:
      "Maintain qualifications, coverage and supporting evidence so readiness is visible before you commit time to a request. Helps teams avoid pursuing work they cannot substantiate.",
  },
  {
    title: "Client Requests",
    body: "Centralize buyer document and information requests into a clear dossier.",
    detail:
      "Capture incoming requests, link existing evidence where available, track completion and share a secure package. Reduces email-thread chaos when multiple stakeholders respond to the same buyer.",
  },
  {
    title: "Tender Calendar",
    body: "Keep deadlines, milestones and reminders visible for the opportunities you track.",
    detail:
      "Organize key dates and reminder settings so important submissions are less likely to be missed. Complements Client Requests by giving the team a shared timeline — not a private spreadsheet.",
  },
  {
    title: "Questionnaire Assistant",
    body: "Structure questionnaire questions and draft evidence-backed answers with clear verify steps.",
    detail:
      "Detect and organize questionnaire content, draft responses grounded in available evidence, and flag items that still need human verification. Speeds structured responses without inventing unsupported claims.",
  },
  {
    title: "Decision Engine",
    body: "Reach explainable BID, REVIEW or NO-BID outcomes from readiness, qualification and evidence.",
    detail:
      "Combine company readiness signals with requirement and evidence context to produce a decision you can explain. Evidence Intelligence and Explainable Decision keep the rationale traceable. Decision Memory and Decision Simulator support judgment — they do not replace human ownership.",
  },
  {
    title: "Team Decision Workflow",
    body: "Turn a decision into assigned next steps, verification and alerts the team can execute.",
    detail:
      "Create workflow tasks, attach evidence, verify closed-loop updates, and use Smart Alerts plus Tender Action Plan where entitled. Keeps follow-through visible after the recommendation is made.",
  },
];

const en: Dictionary = {
  nav: {
    product: "Product",
    pricing: "Pricing",
    faq: "FAQ",
    solutions: "Solutions",
    resources: "Resources",
    signIn: "Sign in",
    startFree: "Start free",
    app: "App",
    language: "Language",
  },
  brand: {
    tagline: "Know What to Pursue. Know What You’re Ready For.",
    description:
      "Bidvera helps companies understand readiness, manage compliance and qualifications, organize evidence, evaluate relevant opportunities and make explainable decisions.",
  },
  landing: {
    headline: "Know What to Pursue. Know What You’re Ready For.",
    subhead:
      "Bidvera helps business teams understand company readiness, manage compliance and qualifications, organize evidence, evaluate relevant work, and turn explainable decisions into clear next actions.",
    ctaPrimary: "Explore Bidvera",
    ctaSecondary: "See how it works",
    trialNote: "Readiness · Opportunities · Evidence · Decisions · Action",
    previewLabel: "Decision intelligence",
    previewQuestion: "READY TO PURSUE?",
    previewDecision: "REVIEW",
    previewFit: "Strong readiness fit",
    previewRisk: "Evidence verified",
    previewRiskValue: "3 requirements confirmed",
    previewMissing: "Needs attention",
    previewMissingValue: "1 qualification item to verify",
    previewNext: "Next action",
    previewNextValue: "Confirm outstanding evidence",
    previewWhy:
      "Qualification looks strong. One item still needs verification before your team commits.",
    sectionTitle: "Why companies use Bidvera",
    sectionBody:
      "Instead of reconstructing readiness from folders, email and spreadsheets, Bidvera gives your team a structured workspace for company information, proof, decisions and follow-through.",
    feature1Title: "Know your readiness",
    feature1Body:
      "Keep company information, qualifications and compliance evidence organized and current.",
    feature2Title: "Organize relevant work",
    feature2Body:
      "Capture client requests and calendar deadlines, then evaluate requirements against what you can actually deliver.",
    feature3Title: "Act with confidence",
    feature3Body:
      "Make explainable decisions, assign next actions and keep the team aligned.",
    capabilitiesTitle: "Eight capabilities for readiness, opportunities and action",
    capabilitiesLearnMore: "Learn more",
    capabilitiesShowLess: "Show less",
    capabilities: LANDING_CAPABILITIES,
    smartMatch: {
      eyebrow: "Smart Match Engine",
      title: "See which opportunities fit your company profile",
      body: "Smart Match Engine compares opportunity signals with your company profile so teams can prioritize further review — instead of scanning every lead the same way.",
      benefit1: "Surface opportunities aligned with services, industry and geography.",
      benefit2: "Use qualifications, experience and company size as structured match dimensions.",
      benefit3: "Review match explanations before committing team time.",
      dimensionsLabel: "Matching dimensions",
      dimensions: [
        "Services",
        "Industry",
        "Geography",
        "Qualifications",
        "Experience",
        "Company size",
      ],
      note: "Match scores guide exploration and review. They do not guarantee eligibility, coverage of every market, or contract awards. Access depends on workspace configuration.",
      ctaPrimary: "Create your company profile",
      ctaSecondary: "Learn how Bidvera works",
    },
    bottomTitle: "Bring readiness, opportunities and decisions into one workspace",
    bottomBody:
      "Organize what the company has, verify what can be proven, evaluate what is relevant, and decide what to pursue — with the team.",
    bottomCta: "Explore Bidvera",
    howTitle: "How it works",
    howBody: "From company readiness to confident action.",
    step1Title: "Understand",
    step1Body:
      "Build a clear picture of your company, documents, qualifications and readiness.",
    step2Title: "Organize",
    step2Body:
      "Use Client Requests to capture incoming work, then keep key dates on the Tender Calendar.",
    step3Title: "Verify",
    step3Body:
      "Check requirements against profile, documents, qualifications and evidence.",
    step4Title: "Decide & Act",
    step4Body:
      "Reach an explainable decision, then move it through team workflow, alerts and a clear action plan.",
    beforeAfterTitle: "From scattered information to confident action",
    beforeAfterBody:
      "Stop piecing together documents, qualifications and opportunities from different places. Bidvera brings readiness, evidence and decisions into one workspace.",
    beforeLabel: "Without a structured Bidvera workflow",
    afterLabel: "With Bidvera",
    beforeItems: [
      "Documents, qualifications and evidence scattered across folders and inboxes",
      "Unclear which requests you are actually ready for",
      "Manual review without a shared evidence trail",
      "Decisions made without clear ownership of next actions",
    ],
    afterItems: [
      "One workspace for company intelligence, readiness and verified evidence",
      "Incoming work organized against real capability",
      "Explainable BID / REVIEW / NO-BID with the rationale behind them",
      "Assigned next actions, alerts and a plan the team can execute",
    ],
    complianceEyebrow: "Document Compliance",
    complianceHeadline: "Keep your company ready, all the time.",
    complianceBody:
      "Keep critical company documents organized, track expiry dates, and stay on top of compliance requirements from one secure workspace.",
    complianceBenefit1Title: "Stay organized",
    complianceBenefit1Body: "Keep all company documents in one secure workspace.",
    complianceBenefit2Title: "Track expiry dates",
    complianceBenefit2Body: "See what is current and what needs attention before it lapses.",
    complianceBenefit3Title: "Stay ready for requirements",
    complianceBenefit3Body: "Know which documents support the next requirement.",
    compliancePanelTitle: "Company documents",
    complianceAddLabel: "Add document",
    complianceAlertTitle: "Insurance expires soon",
    complianceReadyLabel: "You're ready",
    complianceReadyHint: "Key documents are tracked in one workspace.",
    complianceStatusValid: "Valid",
    complianceStatusExpiring: "Expiring soon",
    complianceDocTrade: "Trade License",
    complianceDocTax: "Tax Certificate",
    complianceDocInsurance: "Insurance",
    complianceDocQuality: "Quality Certificate",
    complianceDocFinancial: "Financial Statement",
    complianceDateTrade: "Valid until 31 Dec 2026",
    complianceDateTax: "Valid until 15 Oct 2026",
    complianceDateInsurance: "Expires 28 Nov 2026",
    complianceDateQuality: "Valid until 1 Aug 2027",
    complianceDateFinancial: "Valid until 10 Feb 2027",
    pricingTeaserTitle: "Simple pricing for growing teams",
    pricingTeaserBody:
      "Start free. Upgrade when Bidvera is saving your team real time — from {price}/mo on Pro.",
    pricingTeaserCta: "Compare plans",
    viewAllFaq: "View all FAQ →",
    testimonialsTitle: "What teams say",
    testimonialsBody:
      "Real feedback from teams using Bidvera to stay ready and decide with confidence.",
    testimonialsEmptyTitle: "Early customer feedback",
    testimonialsEmptyBody:
      "We only publish genuine customer testimonials. Be among the first teams to bring readiness, evidence and decisions into one workspace — then tell us how it went.",
    testimonialsEmptyCta: "Explore Bidvera",
  },
  product: {
    eyebrow: "Product",
    title: "Company intelligence. Readiness. Decisions you can explain.",
    body: "Bidvera is not a generic AI PDF summariser. It is a workspace for company readiness, compliance, qualification, evidence, opportunity intelligence and explainable decisions. BID / REVIEW / NO-BID is one Decision Engine outcome — not the whole product.",
    step1Title: "Understand the company",
    step1Body:
      "Build a living picture of your profile, documents, qualifications and readiness.",
    step2Title: "Organize what is relevant",
    step2Body:
      "Use Client Requests to capture incoming work that aligns with what your company can actually deliver, and keep deadlines on the Tender Calendar.",
    step3Title: "Verify, decide and act",
    step3Body:
      "Analyze the requirements that matter, connect evidence, make explainable BID / REVIEW / NO-BID decisions, and turn them into next actions with the team.",
    seeTitle: "What your team works with",
    seeItems: [
      "Company profile, document compliance and supplier qualification",
      "Client requests and calendar deadlines",
      "Evidence intelligence with source-backed verification",
      "Decision Engine outcomes: BID / REVIEW / NO-BID",
      "Explainable rationale, decision memory and simulation",
      "Questionnaire assistance and PDF export",
      "Team decision workflow, action plans and smart alerts",
    ],
    cta: "Explore Bidvera",
    futureTitle: "Active capabilities in one workspace",
    futureBody:
      "Bidvera already covers company foundation, opportunity intelligence, evidence, decisions and team action.",
    highlightItems: [
      "Company Profile",
      "Document Compliance",
      "Client Requests",
      "Evidence Intelligence",
      "Decision Engine",
      "Team Decision Workflow",
      "Advanced AI Trust & Security",
    ],
  },
  pricing: {
    eyebrow: "Pricing",
    title: "One workspace for readiness, opportunities and action",
    body: "Start with a limited Free Workspace, or try a paid plan for 14 days. Prices come from your live Bidvera plans.",
    perMonth: "/month",
    perMonthYearly: "/mo billed yearly",
    analysesSeats: "{analyses} analyses / month · {seats} seats",
    seatsOnly: "{seats} seats",
    startFree: "Start free",
    startFreeWorkspace: "Start Free Workspace",
    startTrial: "Start 14-day free trial",
    startSubscription: "Start subscription",
    choose: "Choose {plan}",
    monthly: "Monthly",
    yearly: "Yearly",
    save: "Save ~17%",
    recommended: "Most popular",
    mostPopular: "Best for growing teams",
    trialBadge: "14-day free trial",
    noChargeToday: "No charge today",
    paymentMethodRequired: "Payment method required",
    cancelBeforeTrial: "Cancel before the trial ends to avoid the subscription charge.",
    freeHeadline: "Start free. Build your company workspace.",
    freeLimitedNote: "Limited workspace — company profile and document compliance only.",
    comparisonTitle: "Compare plans",
    comparisonFeature: "Capability",
    yearlyNote: "Yearly totals use the price configured for each plan. Checkout uses the interval you select.",
    valueTitle1: "A company intelligence workspace",
    valueBody1:
      "Organize company information, compliance, qualifications, evidence and requests in one place — then act with the team.",
    valueTitle2: "Clear limits, no hidden usage",
    valueBody2: "Seats and usage limits are shown on each plan. What you see is what the plan includes.",
    valueTitle3: "Try a paid plan, then decide",
    valueBody3:
      "Eligible plans include a 14-day trial with a payment method on file. Cancel before the trial ends if you do not want the subscription to start.",
    ctaTitle: "Ready to keep your company ready?",
    ctaBody: "Start with Free Workspace, or choose a plan and try Bidvera for 14 days.",
    groups: {
      readiness: "Company readiness",
      opportunities: "Opportunities & requests",
      intelligence: "Intelligence & decisions",
      workflow: "AI & workflow",
    },
    features: {
      company_profile: "Company Profile",
      document_compliance: "Document Compliance",
      supplier_qualification: "Supplier Qualification",
      client_requests: "Client Requests",
      tender_calendar: "Tender Calendar",
      evidence_intelligence: "Evidence Intelligence",
      advanced_decision_engine: "Decision Engine",
      decision_memory: "Decision Memory",
      decision_simulator: "Decision Simulator",
      explainable_decision: "Explainable Decision",
      tender_analysis: "Tender Analysis",
      questionnaire_assistant: "Questionnaire Assistant",
      smart_alerts: "Smart Alerts",
      team_collaboration: "Team Decision Workflow",
      pdf_export: "PDF Export",
      tender_action_plan: "Tender Action Plan",
    },
  },
  faq: {
    eyebrow: "FAQ",
    title: "Questions, answered plainly",
    items: [
      {
        q: "What is Bidvera?",
        a: "Bidvera is a company intelligence workspace that helps businesses organize their company information, manage compliance, evaluate relevant opportunities, work with evidence, and take confident action.",
      },
      {
        q: "How does Bidvera help keep my company ready?",
        a: "Bidvera brings your company profile, qualifications and key documents together so your team can maintain a reliable and up-to-date business foundation.",
      },
      {
        q: "How does Document Compliance work?",
        a: "Track important company documents, monitor expiry dates and receive alerts when attention is needed, helping your business stay prepared.",
      },
      {
        q: "How does Bidvera help with opportunities and client requests?",
        a: "Teams can capture client requests, keep deadlines on the Tender Calendar, and evaluate requirements against company profile, capabilities and qualifications.",
      },
      {
        q: "Can Bidvera help with client requests and questionnaires?",
        a: "Yes. Teams can manage client requests and use the Questionnaire Assistant to organize and respond to required information more efficiently.",
      },
      {
        q: "How does Bidvera use evidence?",
        a: "Evidence Intelligence connects company information, qualifications and supporting evidence so teams can understand what is verified, what needs attention and why.",
      },
      {
        q: "Can my team collaborate in Bidvera?",
        a: "Yes. Team Decision Workflow helps members work together, assign responsibilities, review information and coordinate next actions in one workspace.",
      },
      {
        q: "Is Bidvera secure?",
        a: "Bidvera is designed with controlled access, tenant isolation and security protections so each company’s workspace and information remain separated.",
      },
      {
        q: "Can I try Bidvera before subscribing?",
        a: "Yes. You can start with the available free trial and explore the platform before choosing a subscription.",
      },
    ],
  },
  auth: {
    loginTitle: "Sign in",
    loginBody: "Access your company’s Bidvera workspace.",
    emailChangedNotice:
      "Your email was updated. Sign in with your new address. All other sessions were signed out.",
    sideHeadline: "Know what to pursue. Know what you’re ready for.",
    sideBody:
      "Bidvera helps your team organize readiness, verify evidence, evaluate opportunities and decide with confidence.",
    sidePillMatched: "MATCHED — A suitable opportunity was found for the company.",
    sidePillReview: "REVIEW — Review the opportunity details and its relevance.",
    sidePillNotAMatch: "NOT A MATCH — The opportunity does not match the company's profile.",
    signupTitle: "Create your Bidvera account",
    signupBody: "Email and password first. Company setup comes next.",
    name: "Your name",
    companyName: "Company name",
    email: "Work email",
    password: "Password",
    confirmPassword: "Confirm password",
    submitLogin: "Sign in",
    submitSignup: "Create account",
    haveAccount: "Already have an account?",
    newHere: "New to Bidvera?",
    acceptTerms: "I accept the Terms of Service and Privacy Policy.",
    acceptTermsError: "You must accept the Terms and Privacy Policy.",
    continueGoogle: "Continue with Google",
    googleComingSoon: "Google sign-in is coming soon",
    continueMicrosoft: "Continue with Microsoft",
    microsoftComingSoon: "Microsoft sign-in is coming soon",
    forgotPassword: "Forgot password?",
    forgotTitle: "Reset password",
    forgotBody: "We’ll email you a one-time link if an account exists.",
    forgotSubmit: "Send reset link",
    forgotSent: "If that email is registered, a reset link is on its way.",
    resetTitle: "Choose a new password",
    resetBody: "Use at least 12 characters.",
    resetSubmit: "Update password",
    passwordMismatch: "Passwords do not match.",
  },
  assistant: {
    askLabel: "Ask Bidvera",
    title: "Bidvera AI Assistant",
    description:
      "Ask about Bidvera, company readiness, opportunities, evidence, or next steps. Answers use Bidvera AI; voice is spoken via secure text-to-speech.",
    placeholder: "Ask a question…",
    send: "Send",
    thinking: "Thinking…",
    play: "Play",
    pause: "Pause",
    mute: "Mute",
    unmute: "Unmute",
    voiceUnavailable: "Voice is unavailable right now. You can still read the answer.",
    errorGeneric: "Could not get an answer. Please try again.",
    attachImage: "Attach image",
    removeImage: "Remove image",
    imageOnlyOne: "Only one image can be attached.",
    imageTooLarge: "Image is too large (max 4MB).",
    imageInvalid: "Use a JPEG, PNG, WebP, or GIF image.",
    imageQuotaReached: "Image upload locked — 1 image / 4 hours for this browser and address.",
    replyQuotaReached: "Send locked — 10 replies used for this browser and address (resets in 4 hours).",
  },
  app: {
    nav: {
      dashboard: "Dashboard",
      tenders: "Tender Analysis",
      tenderCalendar: "Tender Calendar",
      documentCompliance: "Document Compliance",
      supplierQualification: "Supplier Qualification",
      clientRequests: "Client Requests",
      questionnaireAssistant: "Questionnaire Assistant",
      matchedOpportunities: "Matched Opportunities",
      company: "Company Profile",
      billing: "Billing",
      alerts: "Smart Alerts",
      settings: "Settings",
      decisionMemory: "Decision Memory",
      teamWorkflow: "Team Decision Workflow",
      sectionCapabilities: "Capabilities",
      sectionWorkspace: "Workspace",
      sectionAccount: "Account",
    },
    shell: {
      tagline: "Verify Before You Bid.",
      analyzeTender: "Analyze Tender",
      upgrade: "Upgrade",
      signOut: "Sign out",
      openMenu: "Open menu",
      closeMenu: "Close menu",
      decisionWorkspace: "Bidvera workspace",
      yourCompany: "Your company",
      workspace: "Workspace",
    },
    dashboard: {
      eyebrow: "Your Bidvera platform",
      title: "Dashboard",
      subtitle:
        "Analyze tenders, keep documents compliant, maintain supplier readiness, and track deadlines — in one workspace.",
      analyzeCta: "Analyze Tender",
      activeTenders: "Open decisions",
      inPipeline: "GO + Conditional GO",
      bid: "GO",
      pursue: "Pursue",
      review: "CONDITIONAL GO",
      verifyFirst: "Verify first",
      noBid: "NO-BID",
      skipEffort: "Skip effort",
      upcomingDeadlines: "Analysis deadlines",
      upcomingEmpty: "No analysis deadlines in the next two weeks.",
      upcomingCalendarDeadlines: "Upcoming deadlines",
      upcomingCalendarHint: "From Tender Calendar — same deadlines shown in the calendar module",
      upcomingCalendarEmpty: "No upcoming calendar deadlines yet.",
      addCalendarTender: "Add a calendar tender",
      highRisk: "High-risk tenders",
      highRiskEmpty: "No high or critical risk tenders right now.",
      recentAnalyses: "Recent analyses",
      recentEmpty: "No analyses yet. Upload a tender to get your first decision.",
      viewAll: "View all",
      due: "Due",
      analyzed: "Analyzed",
      decisionDistribution: "Decision distribution",
      decisionDistributionHint: "Share of completed BID / REVIEW / NO-BID outcomes",
      upcomingHint: "Submission deadlines from Tender Analysis only",
      uploadTender: "Upload a tender",
      riskOverview: "Risk overview",
      riskOverviewHint: "Critical or high disqualification exposure",
      recentHint: "Latest go / no-go outcomes",
      platformTitle: "What you can do in Bidvera",
      platformHint: "Four capabilities in one product — open any module to continue.",
      capabilityAnalysisDesc: "Upload packages and get go / no-go decisions.",
      capabilityComplianceDesc: "Track business documents and expiry reminders.",
      capabilityQualificationDesc:
        "Supplier readiness for bids and questionnaires — not your workspace Company Profile.",
      capabilityCalendarDesc: "Track opportunity deadlines and reminders.",
      capabilityOpen: "Open",
      capabilityGetStarted: "Get started",
      capabilityUpgrade: "Upgrade to unlock",
      statusAnalyses: "{count} analyses",
      statusDocuments: "{count} documents",
      statusCompleteness: "{percent}% complete",
      statusDeadlines: "{count} upcoming",
      statusLocked: "Not on your current plan",
      gettingStartedTitle: "Suggested next steps",
      gettingStartedHint: "Pick any path — you can come back anytime.",
    },
    onboarding: {
      signOutHint: "Account",
      stepVerify: "Verify email",
      stepCompany: "Company",
      stepPlan: "Plan",
      verifyTitle: "Verify your email",
      verifyBody: "We sent a link to",
      resend: "Resend verification email",
      resent: "Verification email sent.",
      verifyInvalidTitle: "Link invalid or expired",
      verifyInvalidBody: "Request a new verification email from onboarding.",
      companyTitle: "Tell us about your company",
      companyBody:
        "Used for tender fit analysis. Separately, Supplier Qualification and Document Compliance help you stay bid-ready.",
      companyName: "Company name",
      country: "Country / business location",
      industry: "Industry / sector",
      companySize: "Company size",
      services: "Main services / capabilities",
      servicesHint: "Add multiple tags — press Enter after each one.",
      experience: "Experience level",
      experienceOptional: "optional",
      privacyNote:
        "We only use this information to personalize your Bidvera experience and improve tender-fit analysis. We don't need sensitive company or personal information.",
      companySubmit: "Continue",
      companySkip: "Skip for now",
      planTitle: "Choose how to start",
      planBody: "Start with Free Workspace, or pick a paid plan. Eligible Stripe plans include a 14-day trial.",
      trialTitle: "14-day free trial",
      trialBody: "Payment method required. No charge today. The selected plan starts automatically unless you cancel.",
      trialCta: "Start 14-day free trial",
      paidCta: "Start subscription",
      freeTitle: "Free Workspace",
      freeBody: "Start free. Build your company workspace. Limited to company profile and document compliance.",
      freeCta: "Start Free Workspace",
      noChargeToday: "No charge today",
      paymentMethodRequired: "Payment method required",
      cancelBeforeTrial: "Cancel before the trial ends to avoid the subscription charge.",
      monthly: "Monthly",
      yearly: "Yearly",
      checkoutCanceled: "Checkout was canceled. You can try again anytime.",
      checkoutPending: "Payment received — finishing activation…",
    },
    companyProfile: {
      title: "Company Profile",
      subtitle:
        "Workspace company information used for tender-fit analysis. Separate from Supplier Qualification (bid readiness & evidence).",
      headerHint:
        "Improve match quality over time. Changes apply to future tender analyses only — not the Supplier Qualification profile.",
      supplierQualificationHint:
        "Need bid-ready registration details and evidence? Use",
      supplierQualificationLink: "Supplier Qualification",
      companyName: "Company name",
      completeness: "Completeness",
      savedTitle: "Saved",
      savedBody:
        "Company profile updated. Analysis will use the latest details on the next tender.",
      saveErrorTitle: "Could not save",
      basicsTitle: "Company basics",
      basicsBody:
        "General workspace details for tender-fit — not supplier registration evidence.",
      industry: "Industry",
      country: "Country",
      companySize: "Company size",
      notProvided: "Not provided",
      experienceLevel: "Experience level (optional)",
      experienceYears: "Years of experience (optional)",
      experienceYearsPlaceholder: "e.g. 5",
      revenueRange: "Revenue range (optional)",
      revenuePlaceholder: "e.g. £2m–£5m",
      employees: "Employees (optional)",
      employeesPlaceholder: "e.g. 50–100",
      sizeSolo: "Solo",
      sizeSmall: "Small",
      sizeMedium: "Medium",
      sizeEnterprise: "Enterprise",
      expNew: "New / Limited experience",
      expSome: "Some experience",
      expExperienced: "Experienced",
      expHighly: "Highly experienced",
      capabilitiesTitle: "Capabilities & coverage",
      services: "Services",
      certifications: "Certifications",
      geographicCoverage: "Geographic coverage",
      commaSeparated: "Comma-separated",
      contractTitle: "Contract preferences",
      contractMin: "Minimum contract size (£)",
      contractMax: "Maximum contract size (£)",
      rulesTitle: "Custom qualification rules",
      rulesBody: "One rule per line. These become filters during analysis.",
      save: "Save profile",
      learningTitle: "Global learning consent",
      learningBody:
        "When enabled, Bidvera may contribute privacy-filtered outcome patterns (never company names, documents, strategies, or identifiable histories) to the global learning layer. Your company-private outcomes always stay tenant-isolated. You can opt out at any time.",
      learningCheckbox:
        "Contribute anonymized outcomes to verified global patterns",
      learningSaving: "(saving…)",
    },
    billing: {
      title: "Billing",
      subtitle: "Your workspace plan, trial, renewal, and usage.",
      activatedTitle: "Subscription activated",
      activatedBody: "Your plan is now active. Limits update immediately.",
      trialEndedTitle: "Trial ended",
      trialEndedBody:
        "Your free trial has ended. Upgrade to restore paid workspace capabilities.",
      viewPlans: "View plans →",
      currentPlanTitle: "Current plan",
      currentPlanBody: "Subscription status and billing cycle",
      plan: "Plan",
      status: "Status",
      provider: "Provider",
      billingCycle: "Billing cycle",
      renewal: "Renewal",
      paymentMethod: "Payment method",
      changePlan: "Change plan",
      upgradePlan: "Upgrade plan",
      cancelSubscription: "Cancel subscription",
      cancelScheduled: "Cancellation scheduled at period end.",
      upgradesTitle: "Available upgrades",
      upgradesBody: "{count} plans visible with enabled gateways",
      upgradesBodyOne: "1 plan visible with enabled gateways",
      openCheckout: "Open checkout →",
      paymentHistory: "Payment history",
      noPayments: "No payments yet.",
      invoices: "Invoices",
      noInvoices: "No invoices yet.",
      viewInvoice: "View",
      trialFallback: "Trial",
      usageTitle: "Workspace usage",
      trialUsageTitle: "Trial usage",
      trialEndedDesc:
        "Your free trial has ended — upgrade to restore paid workspace capabilities.",
      unlimitedDesc: "{plan} · Unlimited analyses · {status}",
      remainingDesc: "{remaining} of {limit} free analyses remaining",
      trialEnds: "Trial ends {date}",
      expired: "· Expired",
      analysesUsed: "Analyses used",
      used: "Used",
      remaining: "Remaining",
      unlimited: "Unlimited",
      hoursSaved: "Est. hours saved",
      risksDetected: "Risks detected",
      upgradeContinue: "Upgrade to continue",
      runningLow: "Running low?",
      seePlans: "See plans",
      trialBadge: "14-day free trial",
      trialEndsIn: "Your trial ends in {days} days",
      trialEndsInOne: "Your trial ends in 1 day",
      trialEndingToday: "Your trial ends today",
      trialEndsOn: "Ends on {date}",
      noChargeToday: "No charge today.",
      paymentMethodRequired: "Payment method required",
      trialAutoConvert:
        "Your selected subscription starts automatically after the trial unless you cancel before it ends.",
      cancelTrial: "Cancel trial",
      cancelTrialTitle: "Cancel trial?",
      cancelTrialExplainConvert: "Your trial will not convert into a paid subscription.",
      cancelTrialExplainAccess: "After the trial ends, access follows Free Workspace rules.",
      cancelTrialExplainData: "Your company data will be preserved.",
      cancelPaidTitle: "Cancel subscription?",
      cancelPaidExplainDate: "Cancellation takes effect on {date}.",
      cancelPaidExplainAccess: "You keep access until that date.",
      cancelPaidExplainAfter:
        "After that date, the workspace moves to Free Workspace. Company documents, requests, evidence and history are not deleted.",
      confirmCancel: "Confirm cancellation",
      keepPlan: "Keep plan",
      cancellationDate: "Cancellation date",
      accessUntil: "Access remains available until {date}.",
      freeWorkspace: "Free Workspace",
      freeWorkspaceBody:
        "A limited workspace. Company Profile and limited Document Compliance are included. Paid capabilities are not.",
      freeCapabilityProfile: "Company Profile",
      freeCapabilityCompliance: "Document Compliance (limited)",
      nextBillingDate: "Next billing date",
      usage: "Usage",
      paymentFailed: "Payment failed",
      pastDue: "Past due",
      statusTrialing: "Trialing",
      statusActive: "Active",
      statusCanceled: "Canceled",
      statusUnpaid: "Unpaid",
      statusExpired: "Expired",
      statusIncomplete: "Incomplete",
      monthlyInterval: "Monthly",
      yearlyInterval: "Annual",
      seatsUsage: "Seats",
      aiUsage: "AI usage",
      analysesUsage: "Tender analyses",
      analysesNotIncluded: "Not included",
      cancelError: "Unable to cancel right now. Try again or contact support.",
      started: "Started",
      paypalMethod: "PayPal",
      graceTitle: "Payment issue — grace period",
      graceBody: "Your payment failed. Access continues until {date}. Update billing to avoid interruption.",
      inactiveTitle: "Subscription inactive",
      inactiveBody:
        "Your subscription is not active. Company data is preserved. Renew or upgrade to restore paid capabilities.",
      billingHistory: "Billing history",
      billingHistoryEmpty: "No invoices yet. Invoices appear here after a successful or failed charge.",
      invoiceDate: "Date",
      invoiceAmount: "Amount",
      invoiceStatus: "Status",
      viewReceipt: "View receipt",
      updatePaymentMethod: "Update payment method",
      retryPayment: "Resolve payment",
      paymentProblemTitle: "Payment problem",
      paymentProblemBody:
        "We could not collect the subscription payment. Update your payment method to keep access.",
      paypalManageHint: "PayPal manages the payment method for this subscription in your PayPal account.",
      paymentPortalError: "Unable to open the secure payment page. Try again or contact support.",
      canceledAlertTitle: "Your subscription is canceled",
      subscriptionEndedTitle: "Your subscription has ended",
      subscriptionEndedBody:
        "Your workspace is safe, but some premium features are now locked.",
      choosePlan: "Choose a plan",
      graceDaysRemaining: "You have {days} days remaining to resolve the payment.",
      graceDaysRemainingOne: "You have 1 day remaining to resolve the payment.",
    },
    alerts: {
      title: "Alerts",
      subtitle:
        "Analysis deadlines, document expiry, calendar reminders, Decision Memory, and workflow updates.",
      emptyTitle: "No alerts yet",
      emptyDescription:
        "You’ll see analysis, document expiry, and calendar reminder notifications here.",
      newBadge: "New",
      markAllRead: "Mark all as read",
      unreadCount: "{count} unread",
    },
    settings: {
      title: "Settings",
      subtitle: "Account preferences and workspace defaults.",
      accountTitle: "Account",
      accountBody: "Signed-in user",
      name: "Name",
      email: "Email",
      avatarLabel: "Profile photo",
      avatarHint: "Shown in the top bar. JPG, PNG, WebP, or GIF · max 5MB.",
      avatarUpload: "Upload photo",
      avatarUploading: "Uploading…",
      avatarRemove: "Remove",
      accountSave: "Save changes",
      accountSaving: "Saving…",
      accountSaved: "Account updated.",
      emailChangeHint:
        "Changing email requires your password and a confirmation link to the new address.",
      emailChangePending: "Confirmation pending for {email}.",
      emailChangeSent:
        "Check {email} for a confirmation link. Your current email stays active until you confirm.",
      emailChangeResend: "Resend confirmation",
      emailChangeResent: "Confirmation resent to {email}.",
      emailChangeExpires: "Expires {when}.",
      emailChangePasswordLabel: "Current password",
      emailChangePasswordHint: "Required to request an email change.",
      emailChangePasswordRequired: "Enter your current password to change your email.",
      emailChangeCancel: "Cancel email change",
      emailChangeCancelled: "Email change cancelled.",
      emailChangeInvalidTitle: "Link invalid or expired",
      emailChangeInvalidBody: "Request a new confirmation link from Settings.",
      emailChangeBackSettings: "Back to Settings",
      companyProfileTitle: "Company Profile",
      companyProfileBody:
        "Industry, size, services, country, and experience used for company–tender fit on future analyses. Private to your organization.",
      editCompanyProfile: "Edit Company Profile",
      notificationsTitle: "Notifications",
      notificationsBody:
        "Channel preferences for in-app and email alerts across Bidvera.",
      moduleRemindersTitle: "Module reminder schedules",
      moduleRemindersBody:
        "Document Compliance and Tender Calendar have their own reminder offsets.",
      complianceRemindersLink: "Document Compliance reminders",
      calendarRemindersLink: "Tender Calendar reminders",
      planTitle: "Plan",
      planUnlimited: "Business · Unlimited · {used} used",
      planLimited: "{used}/{limit} analyses used",
      manageBilling: "Manage billing",
      viewUpgrade: "View upgrade options",
      signOut: "Sign out",
      revokeOtherSessions: "Sign out other devices",
      revokeOtherSessionsHint: "Keeps this session active.",
      timezone: "Company timezone",
      timezoneHint: "Used for deadline alert copy and wall-clock display.",
      channels: "Channels",
      channelInApp: "In-app alerts",
      channelEmail: "Email",
      channelWhatsapp: "WhatsApp (coming soon)",
      channelSms: "SMS (coming soon)",
      channelPush: "Push (coming soon)",
      deadlineAlerts: "Analysis deadline alerts",
      deadline7d: "7 days before",
      deadline3d: "3 days before",
      deadline24h: "24 hours before",
      deadlinePassed: "Deadline passed",
      otherAlerts: "Other alerts",
      alertAnalysisDone: "Analysis completed",
      alertHighRisk: "High-risk findings",
      alertMissingDocs: "Missing documents",
      alertScoreChange: "Score or decision changes",
      alertRequirementStatus: "Requirement status changes",
      alertDecisionMemory: "Relevant Decision Memory",
      alertWorkflow: "Workflow / package events",
      prefsSaved: "Preferences saved.",
      savePrefs: "Save notification preferences",
    },
    tenders: {
      title: "Tenders",
      subtitle: "{count} tenders · filter by decision, risk, and deadline",
      subtitleOne: "1 tender · filter by decision, risk, and deadline",
      analyzeCta: "Analyze Tender",
      emptyTitle: "No tenders yet",
      emptyDescription:
        "Upload an ITT or PQQ to get a Bid / Review / No-Bid recommendation.",
      search: "Search",
      searchPlaceholder: "Title or client",
      decision: "Decision",
      allDecisions: "All decisions",
      bid: "GO",
      review: "CONDITIONAL GO",
      noBid: "NO-BID",
      risk: "Risk",
      allRiskLevels: "All risk levels",
      low: "Low",
      medium: "Medium",
      high: "High",
      critical: "Critical",
      deadline: "Deadline",
      anyDeadline: "Any deadline",
      next7d: "Next 7 days",
      next14d: "Next 14 days",
      next30d: "Next 30 days",
      overdue: "Overdue",
      sort: "Sort",
      sortRecent: "Recently analyzed",
      sortDeadlineSoon: "Deadline soonest",
      sortDeadlineLate: "Deadline latest",
      sortFit: "Fit score",
      sortTitle: "Title A–Z",
      colTender: "Tender",
      colClient: "Client",
      colDeadline: "Deadline",
      colFit: "Fit",
      colDecision: "Decision",
      colRisk: "Risk",
      colAnalyzed: "Analyzed",
      colNextAction: "Next action",
      deadlineWithDate: "Deadline {date}",
      fitWithScore: "Fit {score}",
      noNextAction: "No next action",
    },
    upload: {
      title: "Analyze Tender",
      subtitle: "Upload an ITT or PQQ to get a Bid / Review / No-Bid recommendation.",
      trialLeft: "Trial · {remaining} analyses left",
      trialEnds: " · ends {date}",
      phaseIdleTitle: "Upload a tender pack",
      phaseIdleBody:
        "Upload multiple tender files or a ZIP/RAR package. We’ll focus on the bid decision — not a raw document dump.",
      phaseUploadingTitle: "Uploading…",
      phaseUploadingBody: "Securely transferring your files.",
      phaseDiscoveringTitle: "Discovering files…",
      phaseDiscoveringBody: "Inventorying every document in your tender package.",
      phaseExtractingTitle: "Extracting documents…",
      phaseExtractingBody: "Unpacking archives and reading tender documents.",
      phasePreparingTitle: "Preparing tender package…",
      phasePreparingBody: "Validating files and assembling one package for analysis.",
      phaseProcessingTitle: "Processing document…",
      phaseProcessingBody: "Queued for extraction and requirement structuring.",
      phaseAnalyzingTitle: "Analyzing fit…",
      phaseAnalyzingBody:
        "Matching company profile, running rules, and generating a decision.",
      phaseSuccessTitle: "Analysis ready",
      phaseSuccessBody: "Your decision pack is available.",
      phaseErrorTitle: "Upload failed",
      phaseErrorBody: "Something went wrong while uploading or preparing the package. Check the files and try again.",
      phaseAnalysisErrorTitle: "Analysis could not finish",
      phaseAnalysisErrorBody:
        "Your tender package was uploaded and prepared successfully. The failure happened during analysis — open the tender for details.",
      phaseTimeoutBody:
        "Large files can take several minutes. Analysis is still running in the background — open the tender when ready.",
      phaseTimeoutTitle: "Still processing",
      stillWorking: "Analysis continues in the background",
      openTender: "Open tender",
      trialUsedTitle: "Trial analyses used",
      trialUsedBody: "Upgrade to analyze more tenders.",
      viewPlans: "View plans",
      unlimitedPlan: "Unlimited analyses on your active Business plan",
      remainingAnalyses: "{count} free analyses remaining",
      dragHere: "Drag and drop tender files or ZIP/RAR packages here",
      processingTender: "Processing your tender package…",
      fileTypes:
        "PDF, DOCX, XLS/XLSX, CSV, TXT, PPTX, images, ZIP/RAR · up to {max} files per package · max {maxFileMb}MB per file · max {maxPackageMb}MB per package · legacy DOC/PPT may fail extraction",
      chooseFile: "Choose files",
      filesSelected: "{count} files selected",
      filesDiscovered: "{count} files discovered in package",
      maxFilesReached: "Up to {max} files per package.",
      removeFile: "Remove",
      statusReady: "Ready",
      statusUploading: "Uploading…",
      statusDiscovering: "Discovering…",
      statusExtracting: "Extracting…",
      statusPreparing: "Preparing…",
      statusProcessing: "Processing…",
      statusAnalyzing: "Analyzing…",
      startUpload: "Upload & analyze",
      waitForUpload: "Wait for the current upload to finish before adding more files.",
      bodyTooLarge:
        "The tender package is too large for this request. Reduce total size or split the package, then try again.",
      decisionReady: "Decision ready — open the pack below.",
      unableContinue: "Unable to continue",
      openDecision: "Open decision",
      uploadAnother: "Upload another",
      tryAgain: "Try again",
      creditsExhausted: "You’ve used all free analyses. Upgrade to continue.",
      passwordRequiredTitle: "Password required",
      passwordRequiredBody:
        "This file is password protected. Enter the password to continue.",
      passwordLabel: "Archive password",
      passwordSubmit: "Unlock & continue",
      passwordCancel: "Cancel",
      passwordWrong: "Incorrect password. Please try again.",
      intakeRepairedTitle: "Repaired automatically",
      intakePartialTitle: "Partially readable",
      intakeIncompleteTitle: "Package incomplete",
      intakeReadyTitle: "Ready for analysis",
      intakeBlockedTitle: "Analysis blocked",
      intakeUnsupportedTitle: "Unsupported format",
      intakeCorruptedTitle: "Corrupted file",
      intakePartiallyReadableTitle: "Partially readable",
    },
    tenderDetail: {
      backToTenders: "← Tenders",
      unknownClient: "Unknown client",
      deadline: "Deadline",
      analyzed: "Analyzed",
      fullReport: "Full report",
      analysisInProgressTitle: "Analysis in progress",
      analysisInProgressBody:
        "Status: {status}. Refresh shortly — processing is underway.",
      analysisFailedTitle: "Analysis failed",
      analysisFailedBody:
        "Processing reached a terminal failure. See the error details below.",
      analysisFailedPhase: "Stopped at phase: {phase}",
      canonicalNote:
        "Canonical analysis — the same requirements, compliance, fit, readiness, risks, Bid Score, and recommendation for every authorized user. Roles control access only.",
      missingDocuments: "Missing documents",
      required: "Required",
      nextActions: "Next actions",
      noNextActions: "No recommended actions for this decision.",
      teamWorkflow: {
        title: "Team Decision Workflow",
        subtitle:
          "Assign requirements, risks, and missing evidence to Finance, Legal, Technical, and other departments. Responses are evidence only — they do not auto-change the Decision Engine.",
        empty: "No team tasks yet. Analysis gaps can seed tasks automatically, or create one manually.",
        criticalBanner: "{count} unresolved critical team task(s) before final decision.",
        assign: "Assign",
        respond: "Save response",
        complete: "Complete with response",
        create: "Create task",
        responsePlaceholder: "Enter verified response (never invent facts)…",
        evidencePlaceholder: "Evidence note / reference (optional)…",
        department: "Department",
        assignee: "Assignee",
        requiredResponse: "Required response",
        linkedItem: "Linked tender item",
      },
      decisionSupport: "Decision support",
      fitSuffix: "Fit",
      overallFit: "Overall fit",
      confidence: "Confidence",
      confidenceHigh: "HIGH",
      confidenceMedium: "MEDIUM",
      confidenceLow: "LOW",
      heroBidLabel: "Bidvera recommends pursuing",
      heroBidHint:
        "Based on the information provided, fit supports committing bid effort — still verify before submission.",
      heroReviewLabel: "Bidvera recommends review",
      heroReviewHint:
        "Ambiguity, gaps, or unknowns need human confirmation before committing.",
      heroNoBidLabel: "Bidvera recommends not pursuing",
      heroNoBidHint:
        "Based on available data, critical gaps make bid effort unlikely to pay off — confirm with your team.",
      companyTenderFit: "Company–Tender Fit",
      unknown: "Unknown",
      basisAi: " · AI assessment",
      basisNotProvided: " · Not provided",
      basisFromProfile: " · From company profile",
      basisFromTender: " · From tender",
      tenderReadiness: "Tender Readiness",
      readinessCounts: "{ready} ready · {verify} verify · {missing} missing",
      recommendation: "Recommendation:",
      keyBlockers: "Key blockers",
      keyBlockersNext:
        "Recommended next step: Resolve the highlighted issues before making the final bid decision.",
      whyTitle: "Why this recommendation?",
      executiveSummary: "Executive Summary",
      viewDetails: "View Details",
      hideDetails: "Hide Details",
      topReasons: "Key reasons",
      criticalAlerts: "Critical items",
      whatToDoNext: "What to do next",
      decisionDisclaimer:
        "Bidvera provides an evidence-based recommendation. The final decision remains with your company.",
      expiredDeadlineAlert: "Submission deadline has passed — confirm whether this tender is still open.",
      mandatoryGapAlert: "Mandatory gap",
      missingDocumentAlert: "Missing document",
      detailedAnalysisTitle: "Detailed analysis",
      detailedAnalysisHint:
        "Full requirements, compliance, evidence, risks, fit, and workflow — same canonical data as the report.",
    },
    report: {
      backToTender: "← Tender",
      title: "Analysis report",
      subtitle:
        "Full decision package — view, print, download PDF, or share a read-only link.",
      reportNotReady: "Report not ready",
      reportNotReadyBody:
        "This report is not ready to view yet. Please try again shortly.",
      print: "Print",
      downloadPdf: "Download PDF",
      shareLink: "Share link",
      copied: "Copied.",
      shareExpires: "Expires in 72h · read-only:",
      revokeShare: "Revoke shared links",
      shareRevoked: "Shared links revoked.",
      reportEyebrow: "Bidvera decision report",
      unknownClient: "Unknown client",
      deadline: "Deadline",
      analyzed: "Analyzed",
      recommendation: "Recommendation",
      companyTenderFit: "Company–Tender Fit",
      confidence: "Confidence",
      whyTitle: "Why this recommendation",
      bidScore: "Bid Score",
      bidScoreLine: "Bid Score: {score}/100 — {priority}",
      expectedValue: "Expected Value:",
      risk: "Risk:",
      effort: "Effort:",
      positive: "Positive",
      negative: "Negative",
      overall: "Overall",
      unknown: "Unknown",
      tenderReadiness: "Tender Readiness",
      readinessCounts: "{ready} Ready · {verify} Verify · {missing} Missing",
      nextStep: "Next step:",
      complianceMatrix: "Compliance Matrix",
      requirements: "Requirements",
      ready: "Ready",
      missing: "Missing",
      verify: "Verify",
      notApplicable: "Not applicable",
      withSources: "With sources",
      mandatory: "Mandatory",
      optional: "Optional",
      evidenceLabel: "Evidence:",
      noExcerpt: "No supporting excerpt available.",
      page: "Page {n}",
      sourceNotLocated: "Source could not be precisely located.",
      noRequirements: "No requirements were extracted for this tender.",
      missingRequirements: "Missing requirements",
      noMissingRequirements: "No missing requirements identified.",
      mandatoryParen: " (mandatory)",
      verificationItems: "Verification items",
      nothingPendingVerify: "Nothing pending verification.",
      risks: "Risks",
      noRisks: "No significant risks flagged.",
      clarifications: "Clarification questions",
      noClarifications:
        "No clarification questions generated — no meaningful ambiguity detected.",
      reason: "Reason:",
      source: "Source:",
      evidence: "Evidence",
      noEvidence: "No source excerpts available.",
      historicalTitle: "Relevant historical intelligence",
      historicalBody:
        "Similar historical outcomes may provide a relevant signal for this opportunity. This is an additional signal — not a guarantee of success or failure.",
      historicalPriority:
        "Current tender evidence and your company profile always take priority.",
      historicalEmpty: "No verified historical pattern applies to this opportunity yet.",
      decisionMemoryTitle: "Decision Memory",
      currentAnalysisLabel: "Current Analysis",
      historicalDecisionLabel: "Historical Decision",
      decisionMemoryCurrentNote:
        "Scores, requirements, and the recommendation above are authoritative for this tender and are unchanged by history.",
      decisionMemoryEmpty: "No relevant prior decisions found for this opportunity yet.",
      relevanceReasons: "Why relevant",
      missingDocuments: "Missing documents",
      nextActions: "Recommended next actions",
      noNextActions: "No recommended actions.",
      basisDirect: "Direct source",
      basisAi: "AI interpretation",
      basisUncertain: "Source uncertain",
      evidenceVerificationTitle: "Evidence & verification",
      evidenceVerificationDisclaimer:
        "Verification reflects recorded evidence and human review only. AI interpretations are never treated as verified.",
      verificationSummary:
        "{verified} verified · {needs} needs verification · {missing} missing evidence · {na} not applicable",
      noVerificationChains: "No verification chains available for this tender.",
      verificationStatusVerified: "Verified",
      verificationStatusNeedsVerification: "Needs verification",
      verificationStatusMissingEvidence: "Missing evidence",
      verificationStatusNotApplicable: "Not applicable",
      verifierLabel: "Verifier:",
      verifiedAtLabel: "Verified at:",
      decisionOutcomeTitle: "Decision outcome",
      decisionOutcomeBidvera: "Bidvera decision",
      decisionOutcomeHuman: "Human final decision",
      decisionOutcomeActual: "Actual outcome",
      decisionOutcomeDate: "Outcome date",
      decisionOutcomeReason: "Outcome reason",
      decisionOutcomeSuccess: "Decision vs outcome",
      decisionOutcomeSuccessAligned: "Original decision aligned with outcome",
      decisionOutcomeSuccessMisaligned: "Original decision did not align with outcome",
      decisionOutcomeSuccessPending: "Outcome still pending",
      decisionOutcomeSuccessNeutral: "Neutral relative to original decision",
      decisionOutcomeRecorded: "Recorded outcome",
      outcomeLearningTitle: "Outcome-based historical intelligence",
      decisionOutcomeAttachment: "Supporting document",
      decisionOutcomeEvalSuccessful: "Successful",
      decisionOutcomeEvalUnsuccessful: "Unsuccessful",
      decisionOutcomeEvalNotEvaluated: "Not evaluated",
    },
    decisionMemory: {
      title: "Decision Memory",
      subtitle:
        "Prior tender decisions for your company — reference only. Never changes a current analysis.",
      emptyTitle: "No decisions stored yet",
      emptyDescription:
        "Completed tender analyses appear here automatically. Open a tender to see Current Analysis vs Historical Decision.",
      emptyDescriptionCompanyContext:
        "Stored decisions appear here when Decision Intelligence records an outcome for your company. Keep qualifications and evidence current so future decisions have strong company context.",
      viewTender: "Open tender",
      openCompanyProfile: "Open company profile",
      analyzed: "Analyzed",
      scores: "Scores",
      requirements: "Requirements",
      risks: "Risks",
      reasoning: "Reasoning",
      relevance: "Relevance",
      disclaimer:
        "Historical Decision — reference only. Does not change Current Analysis scores or recommendation.",
      back: "Back to Decision Memory",
    },
    pwa: {
      availableOn: "Available on Windows and macOS",
      updateTitle: "App update ready",
      updateBody: "A newer Bidvera desktop build is waiting. Reload to apply.",
      updateNow: "Update now",
      installedTitle: "Bidvera is installed",
      installedBody:
        "You’re running the desktop app mode — faster access from your dock or taskbar.",
      title: "Install Bidvera as a desktop app",
      bodyBefore: "Works on",
      bodyAnd: "and",
      bodyAfter: "— opens in its own window, no App Store needed.",
      installCta: "Install Bidvera",
      openingInstaller: "Opening installer…",
      dismiss: "Dismiss",
      guideTitleSafari: "Install Bidvera in Safari",
      guideTitleEdge: "Install Bidvera in Edge",
      guideTitleChrome: "Install Bidvera in Chrome",
      guideTitleDefault: "Install Bidvera",
      guideDescription: "Follow these steps to add Bidvera as a desktop app.",
      desktopMeta: "Desktop app · Windows & macOS",
      openInstallDialog: "Open install dialog",
      gotIt: "Got it",
      iosStep1: "Tap the Share button in Safari.",
      iosStep2: "Choose",
      iosStep2Strong: "Add to Home Screen",
      iosStep3: "Confirm — Bidvera opens full-screen from your home screen.",
      safariMacStep1: "In the menu bar open",
      safariMacStep1Strong: "File",
      safariMacStep2: "Choose",
      safariMacStep2Strong: "Add to Dock",
      safariMacStep3: "Confirm — Bidvera appears in your Dock like a Mac app.",
      chromiumStep1Before: "Look at the right side of the {browser} address bar for the",
      chromiumStep1Strong: "install / computer",
      chromiumStep1After: "icon.",
      chromiumStep2Before: "Click it, then choose",
      chromiumStep2Strong: "Install",
      chromiumStep3Before: "Or open the browser menu →",
      chromiumStep3Install: "Install Bidvera",
      chromiumStep3Mid: "/",
      chromiumStep3Apps: "Apps → Install this site as an app",
    },
  },
};

const es: Dictionary = {
  nav: {
    product: "Producto",
    pricing: "Precios",
    faq: "Preguntas",
    solutions: "Soluciones",
    resources: "Recursos",
    signIn: "Iniciar sesión",
    startFree: "Empezar gratis",
    app: "App",
    language: "Idioma",
  },
  brand: {
    tagline: "Sabe qué perseguir. Sabe para qué estás listo.",
    description:
      "Bidvera ayuda a las empresas a entender su preparación, gestionar cumplimiento y cualificación, organizar evidencias, evaluar oportunidades relevantes y tomar decisiones explicables.",
  },
  landing: {
    headline: "Sabe qué perseguir. Sabe para qué estás listo.",
    subhead:
      "Bidvera ayuda a equipos empresariales a entender la preparación de la empresa, gestionar cumplimiento y cualificación, organizar evidencias, evaluar trabajo relevante y convertir decisiones explicables en siguientes pasos claros.",
    ctaPrimary: "Explorar Bidvera",
    ctaSecondary: "Cómo funciona",
    trialNote: "Preparación · Oportunidades · Evidencias · Decisiones · Acción",
    previewLabel: "Inteligencia de decisión",
    previewQuestion: "¿LISTO PARA PERSEGUIR?",
    previewDecision: "REVIEW",
    previewFit: "Buen encaje de preparación",
    previewRisk: "Evidencia verificada",
    previewRiskValue: "3 requisitos confirmados",
    previewMissing: "Requiere atención",
    previewMissingValue: "1 cualificación por verificar",
    previewNext: "Siguiente acción",
    previewNextValue: "Confirmar evidencia pendiente",
    previewWhy:
      "La cualificación parece sólida. Un elemento aún necesita verificación antes de comprometer al equipo.",
    sectionTitle: "Por qué las empresas usan Bidvera",
    sectionBody:
      "En lugar de reconstruir la preparación desde carpetas, correo y hojas de cálculo, Bidvera ofrece un espacio estructurado para información de empresa, pruebas, decisiones y seguimiento.",
    feature1Title: "Conoce tu preparación",
    feature1Body:
      "Mantén organizada y actualizada la información de empresa, cualificaciones y evidencia de cumplimiento.",
    feature2Title: "Organiza el trabajo relevante",
    feature2Body:
      "Captura solicitudes de clientes y fechas del calendario, y evalúa requisitos frente a lo que puedes entregar.",
    feature3Title: "Actúa con confianza",
    feature3Body:
      "Toma decisiones explicables, asigna siguientes pasos y mantén al equipo alineado.",
    capabilitiesTitle: "Ocho capacidades para preparación, oportunidades y acción",
    capabilitiesLearnMore: "Saber más",
    capabilitiesShowLess: "Mostrar menos",
    capabilities: [
      {
        title: "Perfil de empresa",
        body: "Mantén identidad, servicios y preparación de la empresa en un solo espacio.",
        detail:
          "Captura sector, servicios, geografía y tamaño para que el equipo comparta una vista actual de lo que ofrece la empresa. Esta base apoya cualificación, evidencias y revisión de oportunidades.",
      },
      {
        title: "Cumplimiento documental",
        body: "Controla documentos críticos y fechas de caducidad antes de que bloqueen el trabajo.",
        detail:
          "Guarda licencias, certificados y seguros en un espacio seguro, supervisa la vigencia y ve qué necesita atención antes de vencer.",
      },
      {
        title: "Cualificación de proveedor",
        body: "Muestra para qué está cualificada tu empresa — y dónde hay huecos.",
        detail:
          "Mantén cualificaciones, cobertura y evidencias de apoyo para ver la preparación antes de invertir tiempo en una solicitud.",
      },
      {
        title: "Solicitudes de clientes",
        body: "Centraliza peticiones de documentos e información del comprador en un dossier claro.",
        detail:
          "Captura solicitudes entrantes, vincula evidencias existentes, sigue el avance y comparte un paquete seguro. Reduce el caos de hilos de correo.",
      },
      {
        title: "Calendario de licitaciones",
        body: "Mantén visibles plazos, hitos y recordatorios de las oportunidades que sigues.",
        detail:
          "Organiza fechas clave y recordatorios para que los envíos importantes sean menos fáciles de olvidar. Complementa las solicitudes de clientes con una línea de tiempo compartida.",
      },
      {
        title: "Asistente de cuestionarios",
        body: "Estructura preguntas y redacta respuestas con evidencias y pasos de verificación claros.",
        detail:
          "Detecta y organiza el contenido del cuestionario, redacta borradores basados en evidencias disponibles y marca lo que aún requiere verificación humana.",
      },
      {
        title: "Motor de decisión",
        body: "Llega a BID, REVIEW o NO-BID explicables a partir de preparación, cualificación y evidencias.",
        detail:
          "Combina señales de preparación con requisitos y evidencias para producir una decisión que puedes explicar. La memoria y el simulador de decisión apoyan el juicio — no sustituyen la responsabilidad del equipo.",
      },
      {
        title: "Flujo de decisión de equipo",
        body: "Convierte una decisión en pasos asignados, verificación y alertas ejecutables.",
        detail:
          "Crea tareas, adjunta evidencias, cierra el bucle de verificación y usa alertas inteligentes y el plan de acción cuando estén disponibles en el plan.",
      },
    ],
    smartMatch: {
      eyebrow: "Smart Match Engine",
      title: "Ve qué oportunidades encajan con el perfil de tu empresa",
      body: "Smart Match Engine compara señales de oportunidad con el perfil de tu empresa para priorizar la revisión — en lugar de tratar cada lead igual.",
      benefit1: "Destaca oportunidades alineadas con servicios, sector y geografía.",
      benefit2: "Usa cualificaciones, experiencia y tamaño como dimensiones de encaje.",
      benefit3: "Revisa explicaciones de encaje antes de comprometer tiempo del equipo.",
      dimensionsLabel: "Dimensiones de coincidencia",
      dimensions: [
        "Servicios",
        "Sector",
        "Geografía",
        "Cualificaciones",
        "Experiencia",
        "Tamaño de empresa",
      ],
      note: "Las puntuaciones orientan la exploración y la revisión. No garantizan elegibilidad, cobertura de todo el mercado ni adjudicaciones. El acceso depende de la configuración del espacio de trabajo.",
      ctaPrimary: "Crea el perfil de tu empresa",
      ctaSecondary: "Cómo funciona Bidvera",
    },
    bottomTitle: "Reúne preparación, oportunidades y decisiones en un solo espacio",
    bottomBody:
      "Organiza lo que la empresa tiene, verifica lo que se puede demostrar, evalúa lo relevante y decide qué perseguir — con el equipo.",
    bottomCta: "Explorar Bidvera",
    howTitle: "Cómo funciona",
    howBody: "De la preparación de la empresa a la acción con confianza.",
    step1Title: "Comprender",
    step1Body:
      "Construye una imagen clara de tu empresa, documentos, cualificaciones y preparación.",
    step2Title: "Organizar",
    step2Body:
      "Usa las solicitudes de clientes para capturar el trabajo entrante, y mantén las fechas clave en el calendario.",
    step3Title: "Verificar",
    step3Body:
      "Contrasta requisitos con perfil, documentos, cualificaciones y evidencias.",
    step4Title: "Decidir y actuar",
    step4Body:
      "Llega a una decisión explicable y avánzala con el flujo de equipo, alertas y un plan de acción claro.",
    beforeAfterTitle: "De información dispersa a acción con confianza",
    beforeAfterBody:
      "Deja de reconstruir documentos, cualificaciones y oportunidades desde sitios distintos. Bidvera reúne preparación, evidencias y decisiones.",
    beforeLabel: "Sin un flujo estructurado Bidvera",
    afterLabel: "Con Bidvera",
    beforeItems: [
      "Documentos, cualificaciones y evidencias dispersos en carpetas e inboxes",
      "Poco claro qué solicitudes puedes perseguir de verdad",
      "Revisión manual sin un rastro de evidencia compartido",
      "Decisiones sin ownership claro de siguientes acciones",
    ],
    afterItems: [
      "Un espacio para inteligencia de empresa, preparación y evidencias verificadas",
      "Trabajo entrante organizado frente a capacidad real",
      "BID / REVIEW / NO-BID explicable, con la justificación detrás",
      "Acciones asignadas, alertas y un plan que el equipo puede ejecutar",
    ],
    complianceEyebrow: "Cumplimiento documental",
    complianceHeadline: "Mantén tu empresa lista, en todo momento.",
    complianceBody:
      "Organiza documentos críticos, controla fechas de caducidad y sigue los requisitos de cumplimiento desde un espacio seguro.",
    complianceBenefit1Title: "Mantén el orden",
    complianceBenefit1Body: "Todos los documentos de empresa en un espacio seguro.",
    complianceBenefit2Title: "Controla caducidades",
    complianceBenefit2Body: "Ve qué está vigente y qué necesita atención antes de vencer.",
    complianceBenefit3Title: "Listo para requisitos",
    complianceBenefit3Body: "Sabe qué documentos respaldan el siguiente requisito.",
    compliancePanelTitle: "Documentos de empresa",
    complianceAddLabel: "Añadir documento",
    complianceAlertTitle: "El seguro vence pronto",
    complianceReadyLabel: "Estás listo",
    complianceReadyHint: "Los documentos clave están rastreados en un solo espacio.",
    complianceStatusValid: "Vigente",
    complianceStatusExpiring: "Vence pronto",
    complianceDocTrade: "Licencia comercial",
    complianceDocTax: "Certificado fiscal",
    complianceDocInsurance: "Seguro",
    complianceDocQuality: "Certificado de calidad",
    complianceDocFinancial: "Estados financieros",
    complianceDateTrade: "Válido hasta 31 dic 2026",
    complianceDateTax: "Válido hasta 15 oct 2026",
    complianceDateInsurance: "Vence 28 nov 2026",
    complianceDateQuality: "Válido hasta 1 ago 2027",
    complianceDateFinancial: "Válido hasta 10 feb 2027",
    pricingTeaserTitle: "Precios simples para equipos en crecimiento",
    pricingTeaserBody:
      "Empieza gratis. Mejora de plan cuando Bidvera ahorre tiempo real — desde {price}/mes en Pro.",
    pricingTeaserCta: "Comparar planes",
    viewAllFaq: "Ver todas las preguntas →",
    testimonialsTitle: "Lo que dicen los equipos",
    testimonialsBody:
      "Feedback real de equipos que usan Bidvera para mantenerse listos y decidir con confianza.",
    testimonialsEmptyTitle: "Feedback de primeros clientes",
    testimonialsEmptyBody:
      "Solo publicamos testimonios genuinos. Sé de los primeros equipos en reunir preparación, evidencias y decisiones — y cuéntanos cómo te fue.",
    testimonialsEmptyCta: "Explorar Bidvera",
  },
  product: {
    eyebrow: "Producto",
    title: "Inteligencia de empresa. Preparación. Decisiones explicables.",
    body: "Bidvera no es un resumidor genérico de PDF. Es un espacio de trabajo para preparación, cumplimiento, cualificación, evidencias, oportunidades y decisiones explicables. BID / REVIEW / NO-BID es un resultado del motor de decisión — no el producto entero.",
    step1Title: "Comprende la empresa",
    step1Body:
      "Construye una imagen viva de tu perfil, documentos, cualificaciones y preparación.",
    step2Title: "Organiza lo relevante",
    step2Body:
      "Usa las solicitudes de clientes para capturar el trabajo alineado con lo que tu empresa puede entregar, y mantén las fechas en el calendario.",
    step3Title: "Verifica, decide y actúa",
    step3Body:
      "Analiza los requisitos que importan, conecta evidencias, toma decisiones BID / REVIEW / NO-BID explicables y conviértelas en siguientes acciones con el equipo.",
    seeTitle: "Con qué trabaja tu equipo",
    seeItems: [
      "Perfil de empresa, cumplimiento documental y cualificación de proveedor",
      "Solicitudes de clientes y calendario",
      "Inteligencia de evidencia con verificación respaldada",
      "Resultados del motor de decisión: BID / REVIEW / NO-BID",
      "Justificación explicable, memoria y simulador de decisión",
      "Análisis de licitaciones como un paso del flujo",
      "Asistente de cuestionarios y exportación PDF",
      "Flujo de equipo, plan de acción y alertas inteligentes",
    ],
    cta: "Explorar Bidvera",
    futureTitle: "Capacidades activas en un solo espacio",
    futureBody:
      "Bidvera ya cubre la base de la empresa, inteligencia de oportunidades, evidencias, decisiones y acción de equipo.",
    highlightItems: [
      "Perfil de empresa",
      "Cumplimiento documental",
      "Solicitudes de clientes",
      "Inteligencia de evidencia",
      "Motor de decisión",
      "Análisis de licitaciones",
      "Flujo de decisión de equipo",
      "Confianza y seguridad de IA",
    ],
  },
  pricing: {
    eyebrow: "Precios",
    title: "Un espacio para preparación, oportunidades y acción",
    body: "Empieza con un Free Workspace limitado o prueba un plan de pago durante 14 días. Los precios salen de los planes reales de Bidvera.",
    perMonth: "/mes",
    perMonthYearly: "/mes facturado al año",
    analysesSeats: "{analyses} análisis / mes · {seats} plazas",
    seatsOnly: "{seats} plazas",
    startFree: "Empezar gratis",
    startFreeWorkspace: "Empezar Free Workspace",
    startTrial: "Empezar prueba de 14 días",
    startSubscription: "Empezar suscripción",
    choose: "Elegir {plan}",
    monthly: "Mensual",
    yearly: "Anual",
    save: "Ahorra ~17%",
    recommended: "Más popular",
    mostPopular: "Ideal para equipos en crecimiento",
    trialBadge: "Prueba gratis de 14 días",
    noChargeToday: "Sin cargo hoy",
    paymentMethodRequired: "Se requiere un método de pago",
    cancelBeforeTrial: "Cancela antes de que termine la prueba para evitar el cobro de la suscripción.",
    freeHeadline: "Empieza gratis. Construye el espacio de tu empresa.",
    freeLimitedNote: "Espacio limitado: perfil de empresa y cumplimiento documental.",
    comparisonTitle: "Comparar planes",
    comparisonFeature: "Capacidad",
    yearlyNote: "Los totales anuales usan el precio configurado de cada plan. El pago usa el intervalo que elijas.",
    valueTitle1: "Un espacio de inteligencia empresarial",
    valueBody1:
      "Organiza información, cumplimiento, cualificaciones, evidencias y solicitudes en un solo lugar, y actúa con el equipo.",
    valueTitle2: "Límites claros, sin uso oculto",
    valueBody2: "Los asientos y límites de uso se muestran en cada plan. Lo que ves es lo que incluye.",
    valueTitle3: "Prueba un plan de pago y decide",
    valueBody3:
      "Los planes elegibles incluyen 14 días de prueba con un método de pago. Cancela antes del final si no quieres que empiece la suscripción.",
    ctaTitle: "¿Listos para mantener la empresa preparada?",
    ctaBody: "Empieza con Free Workspace o elige un plan y prueba Bidvera 14 días.",
    groups: {
      readiness: "Preparación de la empresa",
      opportunities: "Oportunidades y solicitudes",
      intelligence: "Inteligencia y decisiones",
      workflow: "IA y flujo de trabajo",
    },
    features: {
      company_profile: "Perfil de empresa",
      document_compliance: "Document Compliance",
      supplier_qualification: "Supplier Qualification",
      client_requests: "Solicitudes de clientes",
      tender_calendar: "Calendario",
      evidence_intelligence: "Evidence Intelligence",
      advanced_decision_engine: "Motor de decisión",
      decision_memory: "Decision Memory",
      decision_simulator: "Decision Simulator",
      explainable_decision: "Explainable Decision",
      tender_analysis: "Tender Analysis",
      questionnaire_assistant: "Questionnaire Assistant",
      smart_alerts: "Alertas inteligentes",
      team_collaboration: "Flujo de decisión de equipo",
      pdf_export: "Exportación PDF",
      tender_action_plan: "Tender Action Plan",
    },
  },
  faq: {
    eyebrow: "Preguntas",
    title: "Respuestas claras",
    items: [
      {
        q: "¿Qué es Bidvera?",
        a: "Bidvera es un espacio de inteligencia empresarial que ayuda a las empresas a organizar su información, gestionar el cumplimiento, evaluar oportunidades relevantes, trabajar con evidencias y actuar con confianza.",
      },
      {
        q: "¿Cómo ayuda Bidvera a mantener mi empresa preparada?",
        a: "Bidvera reúne el perfil de empresa, las cualificaciones y los documentos clave para que tu equipo mantenga una base empresarial fiable y actualizada.",
      },
      {
        q: "¿Cómo funciona Document Compliance?",
        a: "Haz seguimiento de documentos importantes, controla fechas de vencimiento y recibe alertas cuando haga falta atención, para que tu empresa se mantenga preparada.",
      },
      {
        q: "¿Cómo ayuda Bidvera con oportunidades y solicitudes de clientes?",
        a: "Los equipos pueden capturar solicitudes de clientes, mantener plazos en el calendario y evaluar requisitos frente al perfil, capacidades y cualificaciones de la empresa.",
      },
      {
        q: "¿Bidvera puede ayudar con solicitudes de clientes y cuestionarios?",
        a: "Sí. Los equipos pueden gestionar solicitudes de clientes y usar el Asistente de cuestionarios para organizar y responder la información requerida con mayor eficiencia.",
      },
      {
        q: "¿Cómo utiliza Bidvera la evidencia?",
        a: "Evidence Intelligence conecta la información de la empresa, las cualificaciones y las evidencias de respaldo para que los equipos entiendan qué está verificado, qué necesita atención y por qué.",
      },
      {
        q: "¿Mi equipo puede colaborar en Bidvera?",
        a: "Sí. Team Decision Workflow ayuda a los miembros a trabajar juntos, asignar responsabilidades, revisar información y coordinar los siguientes pasos en un solo espacio.",
      },
      {
        q: "¿Es seguro Bidvera?",
        a: "Bidvera está diseñado con acceso controlado, aislamiento por inquilino y protecciones de seguridad para que el espacio e información de cada empresa permanezcan separados.",
      },
      {
        q: "¿Puedo probar Bidvera antes de suscribirme?",
        a: "Sí. Puedes empezar con la prueba gratuita disponible y explorar la plataforma antes de elegir una suscripción.",
      },
    ],
  },
  auth: {
    loginTitle: "Iniciar sesión",
    loginBody: "Accede al espacio Bidvera de tu empresa.",
    emailChangedNotice:
      "Tu correo se actualizó. Inicia sesión con la nueva dirección. Se cerraron las demás sesiones.",
    sideHeadline: "Sabe qué perseguir. Sabe para qué estás listo.",
    sideBody:
      "Bidvera ayuda a tu equipo a organizar la preparación, verificar evidencias, evaluar oportunidades y decidir con confianza.",
    sidePillMatched: "COINCIDENCIA — Se encontró una oportunidad adecuada para la empresa.",
    sidePillReview: "REVISIÓN — Revisa los detalles de la oportunidad y su relevancia.",
    sidePillNotAMatch: "SIN COINCIDENCIA — La oportunidad no encaja con el perfil de la empresa.",
    signupTitle: "Crea tu cuenta Bidvera",
    signupBody: "Email y contraseña primero. La empresa viene después.",
    name: "Tu nombre",
    companyName: "Nombre de la empresa",
    email: "Email de trabajo",
    password: "Contraseña",
    confirmPassword: "Confirmar contraseña",
    submitLogin: "Iniciar sesión",
    submitSignup: "Crear cuenta",
    haveAccount: "¿Ya tienes cuenta?",
    newHere: "¿Nuevo en Bidvera?",
    acceptTerms: "Acepto los Términos y la Política de privacidad.",
    acceptTermsError: "Debes aceptar los Términos y la Política de privacidad.",
    continueGoogle: "Continuar con Google",
    googleComingSoon: "Inicio con Google próximamente",
    continueMicrosoft: "Continuar con Microsoft",
    microsoftComingSoon: "Inicio con Microsoft próximamente",
    forgotPassword: "¿Olvidaste la contraseña?",
    forgotTitle: "Restablecer contraseña",
    forgotBody: "Te enviaremos un enlace si existe la cuenta.",
    forgotSubmit: "Enviar enlace",
    forgotSent: "Si el email está registrado, el enlace está en camino.",
    resetTitle: "Elige una nueva contraseña",
    resetBody: "Usa al menos 12 caracteres.",
    resetSubmit: "Actualizar contraseña",
    passwordMismatch: "Las contraseñas no coinciden.",
  },
  assistant: {
    askLabel: "Pregunta a Bidvera",
    title: "Asistente Bidvera AI",
    description:
      "Pregunta sobre Bidvera, preparación, oportunidades, evidencias o siguientes pasos. Las respuestas usan Bidvera AI; la voz es TTS seguro.",
    placeholder: "Haz una pregunta…",
    send: "Enviar",
    thinking: "Pensando…",
    play: "Reproducir",
    pause: "Pausa",
    mute: "Silenciar",
    unmute: "Activar sonido",
    voiceUnavailable: "La voz no está disponible. Puedes leer la respuesta.",
    errorGeneric: "No se pudo obtener respuesta. Inténtalo de nuevo.",
    attachImage: "Adjuntar imagen",
    removeImage: "Quitar imagen",
    imageOnlyOne: "Solo se puede adjuntar una imagen.",
    imageTooLarge: "La imagen es demasiado grande (máx. 4MB).",
    imageInvalid: "Usa JPEG, PNG, WebP o GIF.",
    imageQuotaReached: "Subida bloqueada — 1 imagen / 4 horas para este navegador y dirección.",
    replyQuotaReached: "Envío bloqueado — 10 respuestas usadas (se reinicia en 4 horas).",
  },
  app: {
    nav: {
      dashboard: "Panel",
      tenders: "Análisis de licitaciones",
      tenderCalendar: "Calendario de licitaciones",
      documentCompliance: "Cumplimiento documental",
      supplierQualification: "Calificación de proveedor",
      clientRequests: "Solicitudes de clientes",
      questionnaireAssistant: "Asistente de cuestionarios",
      matchedOpportunities: "Oportunidades coincidentes",
      company: "Perfil de empresa",
      billing: "Facturación",
      alerts: "Alertas",
      settings: "Ajustes",
      decisionMemory: "Memoria de decisión",
      teamWorkflow: "Flujo del equipo",
      sectionCapabilities: "Capacidades",
      sectionWorkspace: "Espacio de trabajo",
      sectionAccount: "Cuenta",
    },
    shell: {
      tagline: "Verifica antes de ofertar.",
      analyzeTender: "Analizar licitación",
      upgrade: "Mejorar plan",
      signOut: "Cerrar sesión",
      openMenu: "Abrir menú",
      closeMenu: "Cerrar menú",
      decisionWorkspace: "Espacio Bidvera",
      yourCompany: "Tu empresa",
      workspace: "Espacio de trabajo",
    },
    dashboard: {
      eyebrow: "Resumen ejecutivo",
      title: "Panel",
      subtitle:
        "Qué hacer a continuación, qué licitaciones vale la pena perseguir y qué te bloquea.",
      analyzeCta: "Analizar licitación",
      activeTenders: "Licitaciones activas",
      inPipeline: "En pipeline",
      bid: "Ofertar",
      pursue: "Perseguir",
      review: "Revisar",
      verifyFirst: "Verificar primero",
      noBid: "No ofertar",
      skipEffort: "Evitar el esfuerzo",
      upcomingDeadlines: "Próximos plazos",
      upcomingEmpty: "No hay plazos en las próximas dos semanas.",
      upcomingCalendarDeadlines: "Próximos plazos",
      upcomingCalendarHint:
        "From Tender Calendar — same deadlines shown in the calendar module",
      upcomingCalendarEmpty: "Aún no hay plazos próximos en el calendario.",
      addCalendarTender: "Añadir una licitación al calendario",
      highRisk: "Licitaciones de alto riesgo",
      highRiskEmpty: "No hay licitaciones de riesgo alto o crítico ahora.",
      recentAnalyses: "Análisis recientes",
      recentEmpty:
        "Aún no hay análisis. Sube una licitación para obtener tu primera decisión.",
      viewAll: "Ver todo",
      due: "Vence",
      analyzed: "Analizado",
      decisionDistribution: "Distribución de decisiones",
      decisionDistributionHint: "Proporción de resultados BID / REVIEW / NO-BID",
      upcomingHint: "Licitaciones aún en el calendario",
      uploadTender: "Subir una licitación",
      riskOverview: "Resumen de riesgos",
      riskOverviewHint: "Exposición crítica o alta a descalificación",
      recentHint: "Últimos resultados de seguir / no seguir",
      platformTitle: "Qué puedes hacer en Bidvera",
      platformHint: "Four capabilities in one product — open any module to continue.",
      capabilityAnalysisDesc: "Sube paquetes y obtén decisiones go / no-go.",
      capabilityComplianceDesc: "Controla documentos empresariales y recordatorios de caducidad.",
      capabilityQualificationDesc:
        "Supplier readiness for bids and questionnaires — not your workspace Company Profile.",
      capabilityCalendarDesc: "Sigue plazos de oportunidades y recordatorios.",
      capabilityOpen: "Abrir",
      capabilityGetStarted: "Empezar",
      capabilityUpgrade: "Mejora el plan para desbloquear",
      statusAnalyses: "{count} análisis",
      statusDocuments: "{count} documentos",
      statusCompleteness: "{percent}% completo",
      statusDeadlines: "{count} próximos",
      statusLocked: "No incluido en tu plan actual",
      gettingStartedTitle: "Próximos pasos sugeridos",
      gettingStartedHint: "Pick any path — you can come back anytime.",
    },
    onboarding: {
      signOutHint: "Cuenta",
      stepVerify: "Verificar email",
      stepCompany: "Empresa",
      stepPlan: "Plan",
      verifyTitle: "Verifica tu email",
      verifyBody: "Enviamos un enlace a",
      resend: "Reenviar verificación",
      resent: "Email de verificación enviado.",
      verifyInvalidTitle: "Enlace inválido o caducado",
      verifyInvalidBody: "Solicita un nuevo email desde el onboarding.",
      companyTitle: "Cuéntanos sobre tu empresa",
      companyBody:
        "Esto ayuda a Bidvera a evaluar qué tan bien encaja una licitación con tu negocio.",
      companyName: "Nombre de la empresa",
      country: "País / ubicación de negocio",
      industry: "Industria / sector",
      companySize: "Tamaño de la empresa",
      services: "Servicios / capacidades principales",
      servicesHint: "Añade varias etiquetas — pulsa Enter después de cada una.",
      experience: "Nivel de experiencia",
      experienceOptional: "opcional",
      privacyNote:
        "Solo usamos esta información para personalizar Bidvera y mejorar el análisis de encaje. No necesitamos datos sensibles de la empresa ni personales.",
      companySubmit: "Continuar",
      companySkip: "Omitir por ahora",
      planTitle: "Elige cómo empezar",
      planBody: "Empieza con Free Workspace o elige un plan de pago. Los planes Stripe elegibles incluyen 14 días de prueba.",
      trialTitle: "Prueba de 14 días",
      trialBody: "Se requiere un método de pago. Sin cargo hoy. El plan elegido empieza automáticamente si no cancelas.",
      trialCta: "Empezar prueba de 14 días",
      paidCta: "Empezar suscripción",
      freeTitle: "Free Workspace",
      freeBody: "Empieza gratis. Construye el espacio de tu empresa. Limitado al perfil y al cumplimiento documental.",
      freeCta: "Empezar Free Workspace",
      noChargeToday: "Sin cargo hoy",
      paymentMethodRequired: "Se requiere un método de pago",
      cancelBeforeTrial: "Cancela antes de que termine la prueba para evitar el cobro.",
      monthly: "Mensual",
      yearly: "Anual",
      checkoutCanceled: "Pago cancelado. Puedes intentarlo de nuevo.",
      checkoutPending: "Pago recibido — activando…",
    },
    companyProfile: {
      title: "Perfil de empresa",
      subtitle:
        "Se usa para el encaje empresa–licitación en análisis futuros. Privado para tu organización: no se requieren datos personales o financieros sensibles.",
      headerHint:
        "Mejora la calidad del encaje con el tiempo. Los cambios se aplican solo a análisis futuros.",
      supplierQualificationHint:
        "¿Necesitas datos de registro y evidencias listos para ofertar? Usa",
      supplierQualificationLink: "Calificación de proveedor",
      companyName: "Nombre de la empresa",
      completeness: "Completitud",
      savedTitle: "Guardado",
      savedBody:
        "Perfil actualizado. El análisis usará los datos más recientes en la próxima licitación.",
      saveErrorTitle: "No se pudo guardar",
      basicsTitle: "Datos básicos",
      basicsBody:
        "Solo para análisis de encaje — sin datos personales o financieros sensibles.",
      industry: "Sector",
      country: "País",
      companySize: "Tamaño de empresa",
      notProvided: "No indicado",
      experienceLevel: "Nivel de experiencia (opcional)",
      experienceYears: "Años de experiencia (opcional)",
      experienceYearsPlaceholder: "p. ej. 5",
      revenueRange: "Rango de ingresos (opcional)",
      revenuePlaceholder: "p. ej. £2m–£5m",
      employees: "Empleados (opcional)",
      employeesPlaceholder: "p. ej. 50–100",
      sizeSolo: "Autónomo",
      sizeSmall: "Pequeña",
      sizeMedium: "Mediana",
      sizeEnterprise: "Grande",
      expNew: "Nueva / experiencia limitada",
      expSome: "Algo de experiencia",
      expExperienced: "Con experiencia",
      expHighly: "Muy experimentada",
      capabilitiesTitle: "Capacidades y cobertura",
      services: "Servicios",
      certifications: "Certificaciones",
      geographicCoverage: "Cobertura geográfica",
      commaSeparated: "Separados por comas",
      contractTitle: "Preferencias de contrato",
      contractMin: "Tamaño mínimo de contrato (£)",
      contractMax: "Tamaño máximo de contrato (£)",
      rulesTitle: "Reglas de cualificación personalizadas",
      rulesBody: "Una regla por línea. Se usan como filtros en el análisis.",
      save: "Guardar perfil",
      learningTitle: "Consentimiento de aprendizaje global",
      learningBody:
        "Si está activado, Bidvera puede aportar patrones de resultado filtrados por privacidad (nunca nombres de empresa, documentos, estrategias ni historiales identificables) a la capa global. Tus resultados privados siguen aislados por organización. Puedes optar por no participar en cualquier momento.",
      learningCheckbox:
        "Aportar resultados anonimizados a patrones globales verificados",
      learningSaving: "(guardando…)",
    },
    billing: {
      title: "Facturación",
      subtitle: "Plan actual, renovación, historial de pagos y facturas.",
      activatedTitle: "Suscripción activada",
      activatedBody: "Tu plan ya está activo. Los límites se actualizan de inmediato.",
      trialEndedTitle: "Prueba finalizada",
      trialEndedBody:
        "Tu prueba gratuita ha terminado. El análisis de licitaciones no estará disponible hasta que mejores el plan.",
      viewPlans: "Ver planes →",
      currentPlanTitle: "Plan actual",
      currentPlanBody: "Estado de la suscripción y ciclo de facturación",
      plan: "Plan",
      status: "Estado",
      provider: "Proveedor",
      billingCycle: "Ciclo de facturación",
      renewal: "Renovación",
      paymentMethod: "Método de pago",
      changePlan: "Cambiar plan",
      upgradePlan: "Mejorar plan",
      cancelSubscription: "Cancelar suscripción",
      cancelScheduled: "Cancelación programada al final del periodo.",
      upgradesTitle: "Mejoras disponibles",
      upgradesBody: "{count} planes visibles con pasarelas activas",
      upgradesBodyOne: "1 plan visible con pasarelas activas",
      openCheckout: "Abrir pago →",
      paymentHistory: "Historial de pagos",
      noPayments: "Aún no hay pagos.",
      invoices: "Facturas",
      noInvoices: "Aún no hay facturas.",
      viewInvoice: "Ver",
      trialFallback: "Prueba",
      usageTitle: "Uso del espacio",
      trialUsageTitle: "Uso de la prueba",
      trialEndedDesc:
        "Tu prueba gratuita ha terminado — mejora el plan para analizar más licitaciones.",
      unlimitedDesc: "{plan} · Análisis ilimitados · {status}",
      remainingDesc: "{remaining} de {limit} análisis gratuitos restantes",
      trialEnds: "La prueba termina el {date}",
      expired: "· Caducada",
      analysesUsed: "Análisis usados",
      used: "Usados",
      remaining: "Restantes",
      unlimited: "Ilimitados",
      hoursSaved: "Horas estimadas ahorradas",
      risksDetected: "Riesgos detectados",
      upgradeContinue: "Mejorar para continuar",
      runningLow: "¿Se agotan?",
      seePlans: "Ver planes",
      trialBadge: "Prueba gratuita de 14 días",
      trialEndsIn: "Tu prueba termina en {days} días",
      trialEndsInOne: "Tu prueba termina en 1 día",
      trialEndingToday: "Tu prueba termina hoy",
      trialEndsOn: "Termina el {date}",
      noChargeToday: "Sin cargo hoy.",
      paymentMethodRequired: "Se requiere un método de pago",
      trialAutoConvert:
        "La suscripción elegida comienza automáticamente al terminar la prueba, salvo que canceles antes.",
      cancelTrial: "Cancelar prueba",
      cancelTrialTitle: "¿Cancelar la prueba?",
      cancelTrialExplainConvert: "La prueba no se convertirá en una suscripción de pago.",
      cancelTrialExplainAccess: "Al terminar, el acceso seguirá las reglas de Free Workspace.",
      cancelTrialExplainData: "Los datos de la empresa se conservan.",
      cancelPaidTitle: "¿Cancelar la suscripción?",
      cancelPaidExplainDate: "La cancelación se aplica el {date}.",
      cancelPaidExplainAccess: "Conservas el acceso hasta esa fecha.",
      cancelPaidExplainAfter:
        "Después, el espacio pasa a Free Workspace. No se eliminan documentos, solicitudes, evidencias ni el historial.",
      confirmCancel: "Confirmar cancelación",
      keepPlan: "Mantener el plan",
      cancellationDate: "Fecha de cancelación",
      accessUntil: "El acceso sigue disponible hasta el {date}.",
      freeWorkspace: "Free Workspace",
      freeWorkspaceBody:
        "Un espacio limitado. Incluye Company Profile y Document Compliance limitado. Las capacidades de pago no están incluidas.",
      freeCapabilityProfile: "Company Profile",
      freeCapabilityCompliance: "Document Compliance (limitado)",
      nextBillingDate: "Próxima fecha de facturación",
      usage: "Uso",
      paymentFailed: "Pago fallido",
      pastDue: "Vencido",
      statusTrialing: "En prueba",
      statusActive: "Activo",
      statusCanceled: "Cancelado",
      statusUnpaid: "Impago",
      statusExpired: "Caducado",
      statusIncomplete: "Incompleto",
      monthlyInterval: "Mensual",
      yearlyInterval: "Anual",
      seatsUsage: "Plazas",
      aiUsage: "Uso de IA",
      analysesUsage: "Análisis",
      analysesNotIncluded: "No incluido",
      cancelError: "No se pudo cancelar ahora. Inténtalo de nuevo o contacta con soporte.",
      started: "Inicio",
      paypalMethod: "PayPal",
      graceTitle: "Problema de pago — periodo de gracia",
      graceBody:
        "El pago falló. El acceso continúa hasta el {date}. Actualiza la facturación para evitar la interrupción.",
      inactiveTitle: "Suscripción inactiva",
      inactiveBody:
        "Tu suscripción no está activa. Los datos de la empresa se conservan. Renueva o mejora el plan para recuperar las capacidades de pago.",
      billingHistory: "Historial de facturación",
      billingHistoryEmpty:
        "Aún no hay facturas. Aparecerán aquí tras un cargo correcto o fallido.",
      invoiceDate: "Fecha",
      invoiceAmount: "Importe",
      invoiceStatus: "Estado",
      viewReceipt: "Ver recibo",
      updatePaymentMethod: "Actualizar método de pago",
      retryPayment: "Resolver el pago",
      paymentProblemTitle: "Problema de pago",
      paymentProblemBody:
        "No pudimos cobrar la suscripción. Actualiza el método de pago para conservar el acceso.",
      paypalManageHint:
        "PayPal gestiona el método de pago de esta suscripción en tu cuenta de PayPal.",
      paymentPortalError:
        "No se pudo abrir la página de pago segura. Inténtalo de nuevo o contacta con soporte.",
      canceledAlertTitle: "Tu suscripción está cancelada",
      subscriptionEndedTitle: "Tu suscripción ha finalizado",
      subscriptionEndedBody:
        "Tu espacio de trabajo está a salvo, pero algunas funciones premium ahora están bloqueadas.",
      choosePlan: "Elegir un plan",
      graceDaysRemaining: "Te quedan {days} días para resolver el pago.",
      graceDaysRemainingOne: "Te queda 1 día para resolver el pago.",
    },
    alerts: {
      title: "Alertas",
      subtitle: "Plazos, Decision Memory, puntuaciones, requisitos y flujo de trabajo.",
      emptyTitle: "Aún no hay alertas",
      emptyDescription: "Aquí verás notificaciones de plazos, riesgos y análisis.",
      newBadge: "Nueva",
      markAllRead: "Marcar todo como leído",
      unreadCount: "{count} sin leer",
    },
    settings: {
      title: "Ajustes",
      subtitle: "Preferencias de la cuenta y valores del espacio de trabajo.",
      accountTitle: "Cuenta",
      accountBody: "Usuario conectado",
      name: "Nombre",
      email: "Correo",
      avatarLabel: "Foto de perfil",
      avatarHint: "Se muestra en la barra superior. JPG, PNG, WebP o GIF · máx. 5 MB.",
      avatarUpload: "Subir foto",
      avatarUploading: "Subiendo…",
      avatarRemove: "Quitar",
      accountSave: "Guardar cambios",
      accountSaving: "Guardando…",
      accountSaved: "Cuenta actualizada.",
      emailChangeHint:
        "Al cambiar el correo se pide tu contraseña y un enlace de confirmación a la nueva dirección.",
      emailChangePending: "Confirmación pendiente para {email}.",
      emailChangeSent:
        "Revisa {email} para confirmar. Tu correo actual sigue activo hasta que confirmes.",
      emailChangeResend: "Reenviar confirmación",
      emailChangeResent: "Confirmación reenviada a {email}.",
      emailChangeExpires: "Caduca {when}.",
      emailChangePasswordLabel: "Contraseña actual",
      emailChangePasswordHint: "Obligatoria para solicitar un cambio de correo.",
      emailChangePasswordRequired: "Introduce tu contraseña actual para cambiar el correo.",
      emailChangeCancel: "Cancelar cambio de correo",
      emailChangeCancelled: "Cambio de correo cancelado.",
      emailChangeInvalidTitle: "Enlace inválido o caducado",
      emailChangeInvalidBody: "Solicita un nuevo enlace desde Ajustes.",
      emailChangeBackSettings: "Volver a Ajustes",
      companyProfileTitle: "Perfil de la empresa",
      companyProfileBody:
        "Sector, tamaño, servicios, país y experiencia usados para el ajuste empresa–licitación en análisis futuros. Privado para tu organización.",
      editCompanyProfile: "Editar perfil de la empresa",
      notificationsTitle: "Notificaciones",
      notificationsBody:
        "Alertas de plazos y análisis — en la app y por correo. WhatsApp / SMS / push se podrán conectar más adelante.",
      moduleRemindersTitle: "Programas de recordatorios por módulo",
      moduleRemindersBody: "Cumplimiento documental y Calendario tienen sus propios plazos de recordatorio.",
      complianceRemindersLink: "Recordatorios de cumplimiento documental",
      calendarRemindersLink: "Recordatorios del calendario",
      planTitle: "Plan",
      planUnlimited: "Business · Ilimitado · {used} usados",
      planLimited: "{used}/{limit} análisis usados",
      manageBilling: "Gestionar facturación",
      viewUpgrade: "Ver opciones de mejora",
      signOut: "Cerrar sesión",
      revokeOtherSessions: "Cerrar sesión en otros dispositivos",
      revokeOtherSessionsHint: "Mantiene esta sesión activa.",
      timezone: "Zona horaria de la empresa",
      timezoneHint: "Se usa para el texto de alertas de plazo y la hora local.",
      channels: "Canales",
      channelInApp: "Alertas en la app",
      channelEmail: "Correo",
      channelWhatsapp: "WhatsApp (próximamente)",
      channelSms: "SMS (próximamente)",
      channelPush: "Push (próximamente)",
      deadlineAlerts: "Alertas de plazo",
      deadline7d: "7 días antes",
      deadline3d: "3 días antes",
      deadline24h: "24 horas antes",
      deadlinePassed: "Plazo vencido",
      otherAlerts: "Otras alertas",
      alertAnalysisDone: "Análisis completado",
      alertHighRisk: "Hallazgos de alto riesgo",
      alertMissingDocs: "Documentos faltantes",
      alertScoreChange: "Cambios de puntuación o decisión",
      alertRequirementStatus: "Cambios de estado de requisitos",
      alertDecisionMemory: "Decision Memory relevante",
      alertWorkflow: "Eventos de flujo / paquete",
      prefsSaved: "Preferencias guardadas.",
      savePrefs: "Guardar preferencias de notificación",
    },
    tenders: {
      title: "Licitaciones",
      subtitle: "{count} licitaciones · filtrar por decisión, riesgo y plazo",
      subtitleOne: "1 licitación · filtrar por decisión, riesgo y plazo",
      analyzeCta: "Analizar licitación",
      emptyTitle: "Aún no hay licitaciones",
      emptyDescription:
        "Sube un ITT o PQQ para obtener una recomendación Bid / Review / No-Bid.",
      search: "Buscar",
      searchPlaceholder: "Título o cliente",
      decision: "Decisión",
      allDecisions: "Todas las decisiones",
      bid: "Ofertar",
      review: "Revisar",
      noBid: "No ofertar",
      risk: "Riesgo",
      allRiskLevels: "Todos los niveles",
      low: "Bajo",
      medium: "Medio",
      high: "Alto",
      critical: "Crítico",
      deadline: "Plazo",
      anyDeadline: "Cualquier plazo",
      next7d: "Próximos 7 días",
      next14d: "Próximos 14 días",
      next30d: "Próximos 30 días",
      overdue: "Vencidas",
      sort: "Orden",
      sortRecent: "Analizadas recientemente",
      sortDeadlineSoon: "Plazo más cercano",
      sortDeadlineLate: "Plazo más lejano",
      sortFit: "Puntuación de ajuste",
      sortTitle: "Título A–Z",
      colTender: "Licitación",
      colClient: "Cliente",
      colDeadline: "Plazo",
      colFit: "Ajuste",
      colDecision: "Decisión",
      colRisk: "Riesgo",
      colAnalyzed: "Analizada",
      colNextAction: "Siguiente acción",
      deadlineWithDate: "Plazo {date}",
      fitWithScore: "Ajuste {score}",
      noNextAction: "Sin siguiente acción",
    },
    upload: {
      title: "Analizar licitación",
      subtitle:
        "Sube un ITT o PQQ para obtener una recomendación Bid / Review / No-Bid.",
      trialLeft: "Prueba · {remaining} análisis restantes",
      trialEnds: " · termina {date}",
      phaseIdleTitle: "Sube un paquete de licitación",
      phaseIdleBody:
        "Sube varios archivos o un paquete ZIP/RAR. Nos centramos en la decisión de oferta — no en un volcado del documento.",
      phaseUploadingTitle: "Subiendo…",
      phaseUploadingBody: "Transfiriendo tus archivos de forma segura.",
      phaseDiscoveringTitle: "Descubriendo archivos…",
      phaseDiscoveringBody: "Inventariando cada documento del paquete de licitación.",
      phaseExtractingTitle: "Extrayendo paquete…",
      phaseExtractingBody: "Descomprimiendo ZIP/RAR y descubriendo documentos de licitación.",
      phasePreparingTitle: "Preparando documentos…",
      phasePreparingBody: "Validando archivos y preparando el paquete para el análisis.",
      phaseProcessingTitle: "Procesando documento…",
      phaseProcessingBody: "En cola para extracción y estructuración de requisitos.",
      phaseAnalyzingTitle: "Analizando ajuste…",
      phaseAnalyzingBody:
        "Comparando el perfil de la empresa, aplicando reglas y generando una decisión.",
      phaseSuccessTitle: "Análisis listo",
      phaseSuccessBody: "Tu paquete de decisión está disponible.",
      phaseErrorTitle: "Error al subir",
      phaseErrorBody: "Algo salió mal al subir o preparar el paquete. Revisa los archivos e inténtalo de nuevo.",
      phaseAnalysisErrorTitle: "El análisis no pudo terminar",
      phaseAnalysisErrorBody:
        "Tu paquete se subió y preparó correctamente. El fallo ocurrió durante el análisis — abre la licitación para más detalles.",
      phaseTimeoutBody:
        "Sigue procesándose tras 1 minuto. Abre la licitación en breve — el análisis puede terminar en segundo plano.",
      phaseTimeoutTitle: "Aún procesando",
      stillWorking: "El análisis continúa en segundo plano",
      openTender: "Abrir licitación",
      trialUsedTitle: "Análisis de prueba agotados",
      trialUsedBody: "Mejora el plan para analizar más licitaciones.",
      viewPlans: "Ver planes",
      unlimitedPlan: "Análisis ilimitados en tu plan Business activo",
      remainingAnalyses: "{count} análisis gratuitos restantes",
      dragHere: "Arrastra y suelta archivos o paquetes ZIP/RAR aquí",
      processingTender: "Procesando tu paquete de licitación…",
      fileTypes: "PDF, Word, Excel, PowerPoint, CSV, TXT, imágenes, ZIP/RAR · hasta {max} archivos por paquete · máx. {maxFileMb}MB por archivo · máx. {maxPackageMb}MB por paquete",
      chooseFile: "Elegir archivos",
      filesSelected: "{count} archivos seleccionados",
      maxFilesReached: "Hasta {max} archivos por paquete.",
      filesDiscovered: "{count} archivos descubiertos en el paquete",
      removeFile: "Quitar",
      statusReady: "Listo",
      statusUploading: "Subiendo…",
      statusDiscovering: "Descubriendo…",
      statusExtracting: "Extrayendo…",
      statusPreparing: "Preparando…",
      statusProcessing: "Procesando…",
      statusAnalyzing: "Analizando…",
      startUpload: "Subir y analizar",
      waitForUpload: "Espera a que termine la subida actual antes de añadir más archivos.",
      bodyTooLarge:
        "El paquete de licitación es demasiado grande para esta solicitud. Prueba con menos archivos, o reinicia la app tras el aumento del límite e inténtalo de nuevo.",
      decisionReady: "Decisión lista — abre el paquete abajo.",
      unableContinue: "No se puede continuar",
      openDecision: "Abrir decisión",
      uploadAnother: "Subir otra",
      tryAgain: "Reintentar",
      creditsExhausted: "Has usado todos los análisis gratuitos. Mejora el plan para continuar.",
      passwordRequiredTitle: "Contraseña requerida",
      passwordRequiredBody:
        "Este archivo está protegido con contraseña. Introdúcela para continuar.",
      passwordLabel: "Contraseña del archivo",
      passwordSubmit: "Desbloquear y continuar",
      passwordCancel: "Cancelar",
      passwordWrong: "Contraseña incorrecta. Inténtalo de nuevo.",
      intakeRepairedTitle: "Reparado automáticamente",
      intakePartialTitle: "Parcialmente legible",
      intakeIncompleteTitle: "Paquete incompleto",
      intakeReadyTitle: "Listo para analizar",
      intakeBlockedTitle: "Análisis bloqueado",
      intakeUnsupportedTitle: "Formato no compatible",
      intakeCorruptedTitle: "Archivo dañado",
      intakePartiallyReadableTitle: "Parcialmente legible2",
    },
    tenderDetail: {
      backToTenders: "← Licitaciones",
      unknownClient: "Cliente desconocido",
      deadline: "Plazo",
      analyzed: "Analizado",
      fullReport: "Informe completo",
      analysisInProgressTitle: "Análisis en curso",
      analysisInProgressBody:
        "Estado: {status}. Actualiza en breve — el procesamiento está en marcha.",
      analysisFailedTitle: "Análisis fallido",
      analysisFailedBody:
        "El procesamiento terminó en un fallo terminal. Consulta el detalle del error abajo.",
      analysisFailedPhase: "Se detuvo en la fase: {phase}",
      canonicalNote:
        "Análisis canónico — los mismos requisitos, cumplimiento, ajuste, preparación, riesgos, Bid Score y recomendación para cada usuario autorizado. Los roles solo controlan el acceso.",
      missingDocuments: "Documentos faltantes",
      required: "Obligatorio",
      nextActions: "Siguientes acciones",
      noNextActions: "No hay acciones recomendadas para esta decisión.",
      teamWorkflow: {
        title: "Flujo de decisión del equipo",
        subtitle:
          "Asigna requisitos, riesgos y evidencia faltante a Finanzas, Legal, Técnico y otros. Las respuestas son evidencia — no cambian automáticamente el Decision Engine.",
        empty: "Aún no hay tareas de equipo.",
        criticalBanner: "{count} tarea(s) crítica(s) sin resolver antes de la decisión final.",
        assign: "Asignar",
        respond: "Guardar respuesta",
        complete: "Completar con respuesta",
        create: "Crear tarea",
        responsePlaceholder: "Respuesta verificada (no inventar)…",
        evidencePlaceholder: "Nota de evidencia (opcional)…",
        department: "Departamento",
        assignee: "Asignado",
        requiredResponse: "Respuesta requerida",
        linkedItem: "Elemento vinculado",
      },
      decisionSupport: "Apoyo a la decisión",
      fitSuffix: "Ajuste",
      overallFit: "Ajuste general",
      confidence: "Confianza",
      confidenceHigh: "ALTA",
      confidenceMedium: "MEDIA",
      confidenceLow: "BAJA",
      heroBidLabel: "Bidvera recomienda ofertar",
      heroBidHint:
        "Según la información disponible, el ajuste apoya invertir esfuerzo — verifica antes de presentar.",
      heroReviewLabel: "Bidvera recomienda revisar",
      heroReviewHint:
        "La ambigüedad, lagunas o desconocidos requieren confirmación humana antes de comprometerse.",
      heroNoBidLabel: "Bidvera recomienda no ofertar",
      heroNoBidHint:
        "Según los datos disponibles, las brechas críticas hacen poco rentable el esfuerzo — confirma con tu equipo.",
      companyTenderFit: "Ajuste empresa–licitación",
      unknown: "Desconocido",
      basisAi: " · Evaluación IA",
      basisNotProvided: " · No facilitado",
      basisFromProfile: " · Del perfil de la empresa",
      basisFromTender: " · De la licitación",
      tenderReadiness: "Preparación de la licitación",
      readinessCounts: "{ready} listos · {verify} verificar · {missing} faltantes",
      recommendation: "Recomendación:",
      keyBlockers: "Bloqueos clave",
      keyBlockersNext:
        "Siguiente paso: resuelve los problemas destacados antes de la decisión final.",
      whyTitle: "¿Por qué esta recomendación?",
      executiveSummary: "Resumen ejecutivo",
      viewDetails: "Ver detalles",
      hideDetails: "Ocultar detalles",
      topReasons: "Razones clave",
      criticalAlerts: "Elementos críticos",
      whatToDoNext: "Qué hacer ahora",
      decisionDisclaimer:
        "Bidvera ofrece una recomendación basada en evidencia. La decisión final corresponde a su empresa.",
      expiredDeadlineAlert:
        "El plazo de presentación ha vencido — confirme si la licitación sigue abierta.",
      mandatoryGapAlert: "Brecha obligatoria",
      missingDocumentAlert: "Documento faltante",
      detailedAnalysisTitle: "Análisis detallado",
      detailedAnalysisHint:
        "Requisitos, cumplimiento, evidencia, riesgos, ajuste y flujo de trabajo — mismos datos canónicos que el informe.",
    },
    report: {
      backToTender: "← Licitación",
      title: "Informe de análisis",
      subtitle:
        "Paquete completo de decisión — ver, imprimir, descargar PDF o compartir un enlace de solo lectura.",
      reportNotReady: "Informe no listo",
      reportNotReadyBody:
        "Este informe aún no está listo. Inténtalo de nuevo en unos momentos.",
      print: "Imprimir",
      downloadPdf: "Descargar PDF",
      shareLink: "Compartir enlace",
      copied: "Copiado.",
      shareExpires: "Caduca en 72 h · solo lectura:",
      revokeShare: "Revocar enlaces compartidos",
      shareRevoked: "Enlaces compartidos revocados.",
      reportEyebrow: "Informe de decisión Bidvera",
      unknownClient: "Cliente desconocido",
      deadline: "Fecha límite",
      analyzed: "Analizado",
      recommendation: "Recomendación",
      companyTenderFit: "Ajuste empresa–licitación",
      confidence: "Confianza",
      whyTitle: "Por qué esta recomendación",
      bidScore: "Puntuación de oferta",
      bidScoreLine: "Puntuación: {score}/100 — {priority}",
      expectedValue: "Valor esperado:",
      risk: "Riesgo:",
      effort: "Esfuerzo:",
      positive: "Positivo",
      negative: "Negativo",
      overall: "Total",
      unknown: "Desconocido",
      tenderReadiness: "Preparación de la licitación",
      readinessCounts: "{ready} listos · {verify} verificar · {missing} faltantes",
      nextStep: "Siguiente paso:",
      complianceMatrix: "Matriz de cumplimiento",
      requirements: "Requisitos",
      ready: "Listo",
      missing: "Faltante",
      verify: "Verificar",
      notApplicable: "No aplica",
      withSources: "Con fuentes",
      mandatory: "Obligatorio",
      optional: "Opcional",
      evidenceLabel: "Evidencia:",
      noExcerpt: "No hay extracto de apoyo disponible.",
      page: "Página {n}",
      sourceNotLocated: "No se pudo ubicar la fuente con precisión.",
      noRequirements: "No se extrajeron requisitos para esta licitación.",
      missingRequirements: "Requisitos faltantes",
      noMissingRequirements: "No se identificaron requisitos faltantes.",
      mandatoryParen: " (obligatorio)",
      verificationItems: "Elementos a verificar",
      nothingPendingVerify: "Nada pendiente de verificación.",
      risks: "Riesgos",
      noRisks: "No se señalaron riesgos significativos.",
      clarifications: "Preguntas de aclaración",
      noClarifications:
        "No se generaron preguntas de aclaración — no se detectó ambigüedad relevante.",
      reason: "Motivo:",
      source: "Fuente:",
      evidence: "Evidencia",
      noEvidence: "No hay extractos de fuente disponibles.",
      historicalTitle: "Inteligencia histórica relevante",
      historicalBody:
        "Resultados históricos similares pueden aportar una señal útil para esta oportunidad. Es una señal adicional — no una garantía de éxito o fracaso.",
      historicalPriority:
        "La evidencia de la licitación actual y el perfil de tu empresa siempre tienen prioridad.",
      historicalEmpty:
        "Aún no aplica ningún patrón histórico verificado a esta oportunidad.",
      decisionMemoryTitle: "Memoria de decisión",
      currentAnalysisLabel: "Análisis actual",
      historicalDecisionLabel: "Decisión histórica",
      decisionMemoryCurrentNote:
        "Las puntuaciones, requisitos y la recomendación anteriores son autoritativos para esta licitación y no cambian con el historial.",
      decisionMemoryEmpty: "Aún no hay decisiones previas relevantes para esta oportunidad.",
      relevanceReasons: "Por qué es relevante",
      missingDocuments: "Documentos faltantes",
      nextActions: "Próximas acciones recomendadas",
      noNextActions: "No hay acciones recomendadas.",
      basisDirect: "Fuente directa",
      basisAi: "Interpretación de IA",
      basisUncertain: "Fuente incierta",
      evidenceVerificationTitle: "Evidencia y verificación",
      evidenceVerificationDisclaimer:
        "La verificación refleja únicamente evidencia registrada y revisión humana. Las interpretaciones de IA nunca se tratan como verificadas.",
      verificationSummary:
        "{verified} verificados · {needs} requieren verificación · {missing} sin evidencia · {na} no aplicable",
      noVerificationChains: "No hay cadenas de verificación disponibles para esta licitación.",
      verificationStatusVerified: "Verificado",
      verificationStatusNeedsVerification: "Requiere verificación",
      verificationStatusMissingEvidence: "Sin evidencia",
      verificationStatusNotApplicable: "No aplicable",
      verifierLabel: "Verificador:",
      verifiedAtLabel: "Verificado el:",
      decisionOutcomeTitle: "Resultado de la decisión",
      decisionOutcomeBidvera: "Decisión de Bidvera",
      decisionOutcomeHuman: "Decisión humana final",
      decisionOutcomeActual: "Resultado real",
      decisionOutcomeDate: "Fecha del resultado",
      decisionOutcomeReason: "Motivo del resultado",
      decisionOutcomeSuccess: "Decisión vs resultado",
      decisionOutcomeSuccessAligned: "La decisión original coincidió con el resultado",
      decisionOutcomeSuccessMisaligned: "La decisión original no coincidió con el resultado",
      decisionOutcomeSuccessPending: "Resultado aún pendiente",
      decisionOutcomeSuccessNeutral: "Neutral respecto a la decisión original",
      decisionOutcomeRecorded: "Resultado registrado",
      outcomeLearningTitle: "Inteligencia histórica basada en resultados",
      decisionOutcomeAttachment: "Documento de respaldo",
      decisionOutcomeEvalSuccessful: "Exitoso",
      decisionOutcomeEvalUnsuccessful: "No exitoso",
      decisionOutcomeEvalNotEvaluated: "No evaluado",
    },
    decisionMemory: {
      title: "Memoria de decisión",
      subtitle:
        "Decisiones previas de tu empresa — solo referencia. Nunca cambia el análisis actual.",
      emptyTitle: "Aún no hay decisiones guardadas",
      emptyDescription:
        "Los análisis completados aparecen aquí automáticamente. Abre una licitación para ver Análisis actual frente a Decisión histórica.",
      emptyDescriptionCompanyContext:
        "Las decisiones almacenadas aparecen aquí cuando Decision Intelligence registra un resultado para tu empresa. Mantén cualificaciones y evidencia al día para dar contexto sólido a futuras decisiones.",
      viewTender: "Abrir licitación",
      openCompanyProfile: "Abrir perfil de empresa",
      analyzed: "Analizado",
      scores: "Puntuaciones",
      requirements: "Requisitos",
      risks: "Riesgos",
      reasoning: "Razonamiento",
      relevance: "Relevancia",
      disclaimer:
        "Decisión histórica — solo referencia. No cambia las puntuaciones ni la recomendación del Análisis actual.",
      back: "Volver a Memoria de decisión",
    },
    pwa: {
      availableOn: "Disponible en Windows y macOS",
      updateTitle: "Actualización lista",
      updateBody: "Hay una versión nueva de Bidvera de escritorio. Recarga para aplicarla.",
      updateNow: "Actualizar ahora",
      installedTitle: "Bidvera está instalada",
      installedBody:
        "Estás en modo aplicación de escritorio — acceso más rápido desde el dock o la barra de tareas.",
      title: "Instala Bidvera como app de escritorio",
      bodyBefore: "Funciona en",
      bodyAnd: "y",
      bodyAfter: "— se abre en su propia ventana, sin App Store.",
      installCta: "Instalar Bidvera",
      openingInstaller: "Abriendo instalador…",
      dismiss: "Cerrar",
      guideTitleSafari: "Instalar Bidvera en Safari",
      guideTitleEdge: "Instalar Bidvera en Edge",
      guideTitleChrome: "Instalar Bidvera en Chrome",
      guideTitleDefault: "Instalar Bidvera",
      guideDescription: "Sigue estos pasos para añadir Bidvera como app de escritorio.",
      desktopMeta: "App de escritorio · Windows y macOS",
      openInstallDialog: "Abrir diálogo de instalación",
      gotIt: "Entendido",
      iosStep1: "Toca el botón Compartir en Safari.",
      iosStep2: "Elige",
      iosStep2Strong: "Añadir a pantalla de inicio",
      iosStep3: "Confirma — Bidvera se abre a pantalla completa desde el inicio.",
      safariMacStep1: "En la barra de menú abre",
      safariMacStep1Strong: "Archivo",
      safariMacStep2: "Elige",
      safariMacStep2Strong: "Añadir al Dock",
      safariMacStep3: "Confirma — Bidvera aparece en el Dock como una app de Mac.",
      chromiumStep1Before: "Mira a la derecha de la barra de direcciones de {browser} el icono",
      chromiumStep1Strong: "instalar / ordenador",
      chromiumStep1After: ".",
      chromiumStep2Before: "Haz clic y elige",
      chromiumStep2Strong: "Instalar",
      chromiumStep3Before: "O abre el menú del navegador →",
      chromiumStep3Install: "Instalar Bidvera",
      chromiumStep3Mid: "/",
      chromiumStep3Apps: "Apps → Instalar este sitio como una aplicación",
    },
  },
};

const zh: Dictionary = {
  nav: {
    product: "产品",
    pricing: "定价",
    faq: "常见问题",
    solutions: "解决方案",
    resources: "资源",
    signIn: "登录",
    startFree: "免费开始",
    app: "应用",
    language: "语言",
  },
  brand: {
    tagline: "知道该追求什么。知道自己准备好了什么。",
    description:
      "Bidvera 帮助企业理解就绪度，管理合规与资质，整理证据，发现相关机会，并做出可解释的决策。",
  },
  landing: {
    headline: "知道该追求什么。知道自己准备好了什么。",
    subhead:
      "Bidvera 帮助业务团队理解企业就绪度，管理合规与资质，整理证据，评估相关工作，并将可解释的决策转化为清晰的下一步。",
    ctaPrimary: "探索 Bidvera",
    ctaSecondary: "了解运作方式",
    trialNote: "就绪度 · 机会 · 证据 · 决策 · 行动",
    previewLabel: "决策情报",
    previewQuestion: "是否值得跟进？",
    previewDecision: "REVIEW",
    previewFit: "就绪度匹配良好",
    previewRisk: "证据已核验",
    previewRiskValue: "3 项要求已确认",
    previewMissing: "需要关注",
    previewMissingValue: "1 项资质待核验",
    previewNext: "下一步",
    previewNextValue: "确认尚未齐备的证据",
    previewWhy: "资质看起来充分。团队承诺前仍有一项需要核验。",
    sectionTitle: "企业为什么使用 Bidvera",
    sectionBody:
      "不必再从文件夹、邮件和表格拼凑就绪度。Bidvera 为公司信息、证据、决策与跟进提供结构化工作区。",
    feature1Title: "了解就绪度",
    feature1Body: "持续整理公司信息、资质与合规证据。",
    feature2Title: "整理相关工作",
    feature2Body: "记录客户请求与日历截止日期，并对照真实交付能力评估要求。",
    feature3Title: "自信行动",
    feature3Body: "做出可解释的决策，分配下一步，并保持团队一致。",
    capabilitiesTitle: "八项能力：就绪度、机会与行动",
    capabilitiesLearnMore: "了解更多",
    capabilitiesShowLess: "收起",
    capabilities: [
      {
        title: "公司资料",
        body: "在一个工作区整理企业身份、服务与就绪信息。",
        detail:
          "记录行业、服务、地理与规模，让团队共享公司现状。该基础支撑资质、证据与机会评审。",
      },
      {
        title: "文件合规",
        body: "跟踪关键公司文件与到期日，避免成为卡点。",
        detail:
          "在安全工作区存放证照与保险，监控有效期，并在过期前看到待办事项。",
      },
      {
        title: "供应商资质",
        body: "展示公司有资格交付什么——以及缺口在哪里。",
        detail: "维护资质、覆盖范围与支撑证据，在投入时间前看清就绪度。",
      },
      {
        title: "客户请求",
        body: "把买方文件与信息请求集中到清晰案卷。",
        detail:
          "捕获进项请求、关联已有证据、跟踪完成度并安全共享，减少邮件线程混乱。",
      },
      {
        title: "招标日历",
        body: "让你跟踪的机会截止日期、里程碑与提醒可见。",
        detail:
          "整理关键日期与提醒，降低错过提交的风险，并与客户请求形成共享时间线。",
      },
      {
        title: "问卷助手",
        body: "结构化问题，并基于证据起草需人工核验的答案。",
        detail:
          "检测并整理问卷内容，基于可用证据起草答复，并标出仍需人工核验的项。",
      },
      {
        title: "决策引擎",
        body: "根据就绪度、资质与证据给出可解释的 投标 / 复核 / 不投标。",
        detail:
          "结合公司就绪信号与要求、证据上下文生成可解释决策。决策记忆与模拟器支持判断——不能替代团队责任。",
      },
      {
        title: "团队决策流程",
        body: "把决策变成可执行的已分配步骤、核验与提醒。",
        detail:
          "创建任务、附上证据、闭环核验，并在权限允许时使用智能提醒与行动计划。",
      },
    ],
    smartMatch: {
      eyebrow: "Smart Match Engine",
      title: "看清哪些机会更符合公司资料",
      body: "Smart Match Engine 将机会信号与公司资料对比，帮助团队优先安排进一步评审——而不是用同一方式扫过每条线索。",
      benefit1: "按服务、行业与地理突出相关机会。",
      benefit2: "用资质、经验与公司规模作为结构化匹配维度。",
      benefit3: "在投入团队时间前查看匹配说明。",
      dimensionsLabel: "匹配维度",
      dimensions: ["服务", "行业", "地理", "资质", "经验", "公司规模"],
      note: "匹配分数用于探索与评审，不保证资格、全市场覆盖或中标。访问取决于工作区配置。",
      ctaPrimary: "创建公司资料",
      ctaSecondary: "了解 Bidvera 如何运作",
    },
    bottomTitle: "把就绪度、机会与决策放进同一个工作区",
    bottomBody:
      "整理企业已有能力，核验可证明事项，评估相关工作，并与团队决定跟进什么。",
    bottomCta: "探索 Bidvera",
    howTitle: "如何运作",
    howBody: "从企业就绪度到有把握的行动。",
    step1Title: "理解",
    step1Body: "建立公司、文件、资质与就绪度的清晰图景。",
    step2Title: "整理",
    step2Body: "通过客户请求捕获进项工作，并把关键日期放在招标日历上。",
    step3Title: "核验",
    step3Body: "对照资料、文件、资质与证据检查要求。",
    step4Title: "决策并行动",
    step4Body: "形成可解释决策，再通过团队流程、提醒与行动计划推进。",
    beforeAfterTitle: "从分散信息到有把握的行动",
    beforeAfterBody:
      "不必再从不同地方拼凑文件、资质与机会。Bidvera 把就绪度、证据与决策放在同一工作区。",
    beforeLabel: "没有结构化 Bidvera 流程时",
    afterLabel: "使用 Bidvera",
    beforeItems: [
      "文件、资质与证据散落在文件夹和收件箱中",
      "不清楚哪些请求你真正准备好了",
      "人工审阅缺少共享的证据轨迹",
      "做了决策却没有清晰的下一步责任人",
    ],
    afterItems: [
      "一个工作区覆盖企业情报、就绪度与已核验证据",
      "进项工作对照真实能力整理",
      "可解释的 投标 / 复核 / 不投标，并附带依据",
      "已分配的下一步、提醒和团队可执行的计划",
    ],
    complianceEyebrow: "文件合规",
    complianceHeadline: "让公司随时保持就绪。",
    complianceBody:
      "在一个安全工作区整理关键公司文件、跟踪到期日，并掌握合规要求。",
    complianceBenefit1Title: "保持有序",
    complianceBenefit1Body: "把全部公司文件放在同一个安全工作区。",
    complianceBenefit2Title: "跟踪到期日",
    complianceBenefit2Body: "看清哪些仍有效、哪些需要在过期前处理。",
    complianceBenefit3Title: "随时应对要求",
    complianceBenefit3Body: "知道哪些文件能支撑下一项要求。",
    compliancePanelTitle: "公司文件",
    complianceAddLabel: "添加文件",
    complianceAlertTitle: "保险即将到期",
    complianceReadyLabel: "已就绪",
    complianceReadyHint: "关键文件已在同一工作区跟踪。",
    complianceStatusValid: "有效",
    complianceStatusExpiring: "即将到期",
    complianceDocTrade: "营业执照",
    complianceDocTax: "税务证明",
    complianceDocInsurance: "保险",
    complianceDocQuality: "质量证书",
    complianceDocFinancial: "财务报表",
    complianceDateTrade: "有效期至 2026年12月31日",
    complianceDateTax: "有效期至 2026年10月15日",
    complianceDateInsurance: "2026年11月28日到期",
    complianceDateQuality: "有效期至 2027年8月1日",
    complianceDateFinancial: "有效期至 2027年2月10日",
    pricingTeaserTitle: "适合成长团队的简明定价",
    pricingTeaserBody:
      "免费开始。当 Bidvera 真正节省团队时间后再升级——Pro 起 {price}/月。",
    pricingTeaserCta: "比较方案",
    viewAllFaq: "查看全部常见问题 →",
    testimonialsTitle: "团队怎么说",
    testimonialsBody: "来自使用 Bidvera 保持就绪并自信决策的团队的真实反馈。",
    testimonialsEmptyTitle: "早期客户反馈",
    testimonialsEmptyBody:
      "我们只发布真实客户评价。成为首批把就绪度、证据与决策放进同一工作区的团队——然后告诉我们效果。",
    testimonialsEmptyCta: "探索 Bidvera",
  },
  product: {
    eyebrow: "产品",
    title: "企业情报。就绪度。可解释的决策。",
    body: "Bidvera 不是通用 AI PDF 摘要工具。它是面向企业就绪度、合规、资质、证据、机会情报与可解释决策的工作区。投标 / 复核 / 不投标 是决策引擎的一种结果，不是全部产品。",
    step1Title: "理解企业",
    step1Body: "建立公司资料、文件、资质与就绪度的持续视图。",
    step2Title: "发现相关机会",
    step2Body: "发现与企业真实交付能力相符的机会与客户请求。",
    step3Title: "核验、决策并行动",
    step3Body: "分析关键要求、关联证据，做出可解释的 投标 / 复核 / 不投标 决策，并转化为团队下一步。",
    seeTitle: "团队在工作区中使用的能力",
    seeItems: [
      "公司资料、文件合规与供应商资质",
      "客户请求与日历截止日期",
      "有来源支撑的证据情报",
      "决策引擎结果：投标 / 复核 / 不投标",
      "可解释依据、决策记忆与模拟",
      "招标分析作为流程中的一步",
      "问卷助手与 PDF 导出",
      "团队决策流程、行动计划与智能提醒",
    ],
    cta: "探索 Bidvera",
    futureTitle: "一个工作区中的现有能力",
    futureBody: "Bidvera 已覆盖企业基础、机会情报、证据、决策与团队行动。",
    highlightItems: [
      "公司资料",
      "文件合规",
      "客户请求",
      "证据情报",
      "决策引擎",
      "招标分析",
      "团队决策流程",
      "高级 AI 信任与安全",
    ],
  },
  pricing: {
    eyebrow: "定价",
    title: "一个用于就绪、机会与行动的工作区",
    body: "可先使用有限的免费工作区，或试用付费套餐 14 天。价格来自 Bidvera 当前套餐。",
    perMonth: "/月",
    perMonthYearly: "/月（按年计费）",
    analysesSeats: "每月 {analyses} 次分析 · {seats} 个席位",
    seatsOnly: "{seats} 个席位",
    startFree: "免费开始",
    startFreeWorkspace: "开始免费工作区",
    startTrial: "开始 14 天免费试用",
    startSubscription: "开始订阅",
    choose: "选择 {plan}",
    monthly: "按月",
    yearly: "按年",
    save: "约省 17%",
    recommended: "最受欢迎",
    mostPopular: "适合成长团队",
    trialBadge: "14 天免费试用",
    noChargeToday: "今天不扣费",
    paymentMethodRequired: "需要支付方式",
    cancelBeforeTrial: "请在试用结束前取消，以免产生订阅费用。",
    freeHeadline: "免费开始。搭建公司工作区。",
    freeLimitedNote: "有限工作区 — 仅含公司资料与文档合规。",
    comparisonTitle: "套餐对比",
    comparisonFeature: "能力",
    yearlyNote: "年付总额以各套餐已配置价格为准。结账使用你选择的周期。",
    valueTitle1: "企业情报工作区",
    valueBody1: "在一处整理公司信息、合规、资质、证据与请求，再与团队一起行动。",
    valueTitle2: "限额清晰，没有隐藏用量",
    valueBody2: "席位与用量限制都显示在套餐上。所见即所得。",
    valueTitle3: "先试用付费套餐，再决定",
    valueBody3: "符合条件的套餐提供 14 天试用并需绑定支付方式。若不希望订阅开始，请在试用结束前取消。",
    ctaTitle: "准备好保持公司就绪了吗？",
    ctaBody: "从免费工作区开始，或选择套餐试用 Bidvera 14 天。",
    groups: {
      readiness: "企业就绪",
      opportunities: "机会与请求",
      intelligence: "情报与决策",
      workflow: "AI 与协作",
    },
    features: {
      company_profile: "公司资料",
      document_compliance: "文档合规",
      supplier_qualification: "供应商资质",
      client_requests: "客户请求",
      tender_calendar: "日历",
      evidence_intelligence: "证据情报",
      advanced_decision_engine: "决策引擎",
      decision_memory: "决策记忆",
      decision_simulator: "决策模拟",
      explainable_decision: "可解释决策",
      tender_analysis: "招标分析",
      questionnaire_assistant: "问卷助手",
      smart_alerts: "智能提醒",
      team_collaboration: "团队决策流程",
      pdf_export: "PDF 导出",
      tender_action_plan: "行动计划",
    },
  },
  faq: {
    eyebrow: "常见问题",
    title: "直白回答",
    items: [
      {
        q: "Bidvera 是什么？",
        a: "Bidvera 是一个企业情报工作区，帮助企业整理公司信息、管理合规、发现相关机会、处理证据并自信地采取行动。",
      },
      {
        q: "Bidvera 如何帮助保持企业就绪？",
        a: "Bidvera 将公司资料、资质与关键文档集中在一起，帮助团队维护可靠且最新的业务基础。",
      },
      {
        q: "Document Compliance 如何运作？",
        a: "跟踪重要公司文档、监控到期日期，并在需要关注时收到提醒，帮助企业保持准备状态。",
      },
      {
        q: "Bidvera 如何帮助处理机会与客户请求？",
        a: "团队可以捕获客户请求、在招标日历上跟踪截止日期，并对照公司资料、能力与资质评估要求。",
      },
      {
        q: "Bidvera 能否帮助处理客户请求与问卷？",
        a: "可以。团队可以管理客户请求，并使用 Questionnaire Assistant 更高效地整理和回复所需信息。",
      },
      {
        q: "Bidvera 如何使用证据？",
        a: "Evidence Intelligence 将公司信息、资质与支持证据连接起来，帮助团队了解哪些已验证、哪些需要关注以及原因。",
      },
      {
        q: "团队可以在 Bidvera 中协作吗？",
        a: "可以。Team Decision Workflow 帮助成员共同工作、分配职责、审阅信息，并在一个工作区中协调后续行动。",
      },
      {
        q: "Bidvera 安全吗？",
        a: "Bidvera 采用受控访问、租户隔离与安全保护设计，确保每家公司的空间与信息彼此分离。",
      },
      {
        q: "订阅前可以试用 Bidvera 吗？",
        a: "可以。你可以先使用可用的免费试用，在订阅前探索平台。",
      },
    ],
  },
  auth: {
    loginTitle: "登录",
    loginBody: "进入公司的 Bidvera 工作区。",
    emailChangedNotice: "邮箱已更新。请使用新地址登录。其他会话已退出。",
    sideHeadline: "知道该追求什么。知道自己准备好了什么。",
    sideBody: "Bidvera 帮助团队整理就绪度、核验证据、评估机会，并自信决策。",
    sidePillMatched: "匹配 — 已为公司找到合适的机会。",
    sidePillReview: "复核 — 请审阅该机会的详情及其相关性。",
    sidePillNotAMatch: "不匹配 — 该机会与公司资料不符。",
    signupTitle: "创建 Bidvera 账户",
    signupBody: "先设置邮箱和密码，随后完善公司信息。",
    name: "您的姓名",
    companyName: "公司名称",
    email: "工作邮箱",
    password: "密码",
    confirmPassword: "确认密码",
    submitLogin: "登录",
    submitSignup: "创建账户",
    haveAccount: "已有账户？",
    newHere: "第一次使用 Bidvera？",
    acceptTerms: "我接受服务条款与隐私政策。",
    acceptTermsError: "必须接受服务条款与隐私政策。",
    continueGoogle: "使用 Google 继续",
    googleComingSoon: "Google 登录即将推出",
    continueMicrosoft: "使用 Microsoft 继续",
    microsoftComingSoon: "Microsoft 登录即将推出",
    forgotPassword: "忘记密码？",
    forgotTitle: "重置密码",
    forgotBody: "若账户存在，我们将发送一次性链接。",
    forgotSubmit: "发送重置链接",
    forgotSent: "若邮箱已注册，重置链接正在发送。",
    resetTitle: "设置新密码",
    resetBody: "至少 12 个字符。",
    resetSubmit: "更新密码",
    passwordMismatch: "两次密码不一致。",
  },
  assistant: {
    askLabel: "询问 Bidvera",
    title: "Bidvera AI 助手",
    description:
      "询问 Bidvera、企业就绪度、机会、证据或下一步。回答由 Bidvera AI 生成；语音为安全 TTS。",
    placeholder: "输入问题…",
    send: "发送",
    thinking: "思考中…",
    play: "播放",
    pause: "暂停",
    mute: "静音",
    unmute: "取消静音",
    voiceUnavailable: "语音暂不可用，仍可阅读文字回答。",
    errorGeneric: "无法获取回答，请重试。",
    attachImage: "添加图片",
    removeImage: "移除图片",
    imageOnlyOne: "只能添加一张图片。",
    imageTooLarge: "图片过大（最大 4MB）。",
    imageInvalid: "请使用 JPEG、PNG、WebP 或 GIF。",
    imageQuotaReached: "图片上传已锁定 — 本浏览器与地址每 4 小时仅 1 张。",
    replyQuotaReached: "发送已锁定 — 本浏览器与地址已用完 10 次回复（4 小时后重置）。",
  },
  app: {
    nav: {
      dashboard: "仪表盘",
      tenders: "招标分析",
      tenderCalendar: "招标日历",
      documentCompliance: "文件合规",
      supplierQualification: "供应商资质",
      clientRequests: "客户请求",
      questionnaireAssistant: "问卷助手",
      matchedOpportunities: "匹配机会",
      company: "公司资料",
      billing: "账单",
      alerts: "提醒",
      settings: "设置",
      decisionMemory: "决策记忆",
      teamWorkflow: "团队流程",
      sectionCapabilities: "能力",
      sectionWorkspace: "工作区",
      sectionAccount: "账户",
    },
    shell: {
      tagline: "先验证，再投标。",
      analyzeTender: "分析招标",
      upgrade: "升级",
      signOut: "退出登录",
      openMenu: "打开菜单",
      closeMenu: "关闭菜单",
      decisionWorkspace: "Bidvera 工作区",
      yourCompany: "您的公司",
      workspace: "工作区",
    },
    dashboard: {
      eyebrow: "高管概览",
      title: "仪表盘",
      subtitle: "下一步做什么、哪些招标值得跟进，以及什么在阻碍你。",
      analyzeCta: "分析招标",
      activeTenders: "进行中的招标",
      inPipeline: "管线中",
      bid: "投标",
      pursue: "跟进",
      review: "复核",
      verifyFirst: "先核实",
      noBid: "不投标",
      skipEffort: "跳过投入",
      upcomingDeadlines: "即将到期",
      upcomingEmpty: "未来两周内没有即将到期的截止日期。",
      upcomingCalendarDeadlines: "即将到来的截止日期",
      upcomingCalendarHint:
        "From Tender Calendar — same deadlines shown in the calendar module",
      upcomingCalendarEmpty: "暂无即将到来的日历截止日期。",
      addCalendarTender: "添加日历招标",
      highRisk: "高风险招标",
      highRiskEmpty: "当前没有高风险或关键风险招标。",
      recentAnalyses: "最近分析",
      recentEmpty: "尚无分析。上传一份招标以获得首次决策。",
      viewAll: "查看全部",
      due: "截止",
      analyzed: "已分析",
      decisionDistribution: "决策分布",
      decisionDistributionHint: "已完成 BID / REVIEW / NO-BID 结果占比",
      upcomingHint: "仍在日程中的招标",
      uploadTender: "上传招标文件",
      riskOverview: "风险概览",
      riskOverviewHint: "严重或高取消资格风险",
      recentHint: "最新的投标 / 不投标结果",
      platformTitle: "您可以在 Bidvera 中做什么",
      platformHint: "Four capabilities in one product — open any module to continue.",
      capabilityAnalysisDesc: "上传标书包并获得继续/不继续的决策。",
      capabilityComplianceDesc: "跟踪业务文档与到期提醒。",
      capabilityQualificationDesc:
        "Supplier readiness for bids and questionnaires — not your workspace Company Profile.",
      capabilityCalendarDesc: "跟踪机会截止日期与提醒。",
      capabilityOpen: "打开",
      capabilityGetStarted: "开始",
      capabilityUpgrade: "升级以解锁",
      statusAnalyses: "{count} 次分析",
      statusDocuments: "{count} 份文档",
      statusCompleteness: "完整度 {percent}%",
      statusDeadlines: "{count} 个即将到来",
      statusLocked: "不在当前套餐内",
      gettingStartedTitle: "建议的下一步",
      gettingStartedHint: "Pick any path — you can come back anytime.",
    },
    onboarding: {
      signOutHint: "账户",
      stepVerify: "验证邮箱",
      stepCompany: "公司",
      stepPlan: "套餐",
      verifyTitle: "验证您的邮箱",
      verifyBody: "我们已发送链接至",
      resend: "重新发送验证邮件",
      resent: "验证邮件已发送。",
      verifyInvalidTitle: "链接无效或已过期",
      verifyInvalidBody: "请在引导流程中重新申请验证邮件。",
      companyTitle: "告诉我们您的公司",
      companyBody: "这有助于 Bidvera 评估招标与您业务的匹配程度。",
      companyName: "公司名称",
      country: "国家 / 业务所在地",
      industry: "行业 / 领域",
      companySize: "公司规模",
      services: "主要服务 / 能力",
      servicesHint: "可添加多个标签 — 每项后按 Enter。",
      experience: "经验水平",
      experienceOptional: "可选",
      privacyNote:
        "我们仅用这些信息个性化 Bidvera 体验并改进招标匹配分析。我们不需要敏感的公司或个人资料。",
      companySubmit: "继续",
      companySkip: "暂时跳过",
      planTitle: "选择开始方式",
      planBody: "可先使用免费工作区，或选择付费套餐。符合条件的 Stripe 套餐含 14 天试用。",
      trialTitle: "14 天免费试用",
      trialBody: "需要支付方式。今天不扣费。若未取消，所选套餐将自动开始。",
      trialCta: "开始 14 天试用",
      paidCta: "开始订阅",
      freeTitle: "免费工作区",
      freeBody: "免费开始，搭建公司工作区。仅包含公司资料与文档合规。",
      freeCta: "开始免费工作区",
      noChargeToday: "今天不扣费",
      paymentMethodRequired: "需要支付方式",
      cancelBeforeTrial: "请在试用结束前取消，以免产生订阅费用。",
      monthly: "按月",
      yearly: "按年",
      checkoutCanceled: "支付已取消，可随时重试。",
      checkoutPending: "已收到付款 — 正在开通…",
    },
    companyProfile: {
      title: "公司资料",
      subtitle:
        "用于后续分析中的公司与标书匹配。仅限贵组织可见 — 无需敏感个人或财务信息。",
      headerHint: "逐步提高匹配质量。更改仅应用于未来的标书分析。",
      supplierQualificationHint: "需要投标就绪的注册详情与证据？请使用",
      supplierQualificationLink: "供应商资质",
      companyName: "公司名称",
      completeness: "完整度",
      savedTitle: "已保存",
      savedBody: "公司资料已更新。下次分析将使用最新信息。",
      saveErrorTitle: "无法保存",
      basicsTitle: "基本信息",
      basicsBody: "仅用于匹配分析 — 无需敏感个人或财务信息。",
      industry: "行业",
      country: "国家",
      companySize: "公司规模",
      notProvided: "未提供",
      experienceLevel: "经验水平（可选）",
      experienceYears: "相关年限（可选）",
      experienceYearsPlaceholder: "例如 5",
      revenueRange: "营收区间（可选）",
      revenuePlaceholder: "例如 £2m–£5m",
      employees: "员工规模（可选）",
      employeesPlaceholder: "例如 50–100",
      sizeSolo: "个人",
      sizeSmall: "小型",
      sizeMedium: "中型",
      sizeEnterprise: "大型",
      expNew: "新业务 / 经验有限",
      expSome: "有一定经验",
      expExperienced: "经验丰富",
      expHighly: "高度成熟",
      capabilitiesTitle: "能力与覆盖范围",
      services: "服务",
      certifications: "认证",
      geographicCoverage: "地理覆盖",
      commaSeparated: "逗号分隔",
      contractTitle: "合同偏好",
      contractMin: "最小合同金额（£）",
      contractMax: "最大合同金额（£）",
      rulesTitle: "自定义资格规则",
      rulesBody: "每行一条规则，将在分析中作为筛选条件。",
      save: "保存资料",
      learningTitle: "全球学习授权",
      learningBody:
        "启用后，Bidvera 可将经过隐私过滤的结果模式（绝不包含公司名称、文档、策略或可识别历史）贡献到全球学习层。贵公司私有结果始终保持租户隔离。可随时退出。",
      learningCheckbox: "向已验证的全球模式贡献匿名化结果",
      learningSaving: "（保存中…）",
    },
    billing: {
      title: "账单",
      subtitle: "当前套餐、续费、付款记录与发票。",
      activatedTitle: "订阅已激活",
      activatedBody: "套餐现已生效，限额立即更新。",
      trialEndedTitle: "试用已结束",
      trialEndedBody: "免费试用已结束。升级前无法分析标书。",
      viewPlans: "查看套餐 →",
      currentPlanTitle: "当前套餐",
      currentPlanBody: "订阅状态与计费周期",
      plan: "套餐",
      status: "状态",
      provider: "支付方",
      billingCycle: "计费周期",
      renewal: "续费",
      paymentMethod: "支付方式",
      changePlan: "更改套餐",
      upgradePlan: "升级套餐",
      cancelSubscription: "取消订阅",
      cancelScheduled: "已安排在周期结束时取消。",
      upgradesTitle: "可用升级",
      upgradesBody: "有 {count} 个套餐及已启用的支付通道可见",
      upgradesBodyOne: "有 1 个套餐及已启用的支付通道可见",
      openCheckout: "打开结账 →",
      paymentHistory: "付款记录",
      noPayments: "暂无付款。",
      invoices: "发票",
      noInvoices: "暂无发票。",
      viewInvoice: "查看",
      trialFallback: "试用",
      usageTitle: "工作区用量",
      trialUsageTitle: "试用用量",
      trialEndedDesc: "免费试用已结束 — 升级以继续分析标书。",
      unlimitedDesc: "{plan} · 无限分析 · {status}",
      remainingDesc: "剩余 {remaining} / {limit} 次免费分析",
      trialEnds: "试用截止 {date}",
      expired: "· 已过期",
      analysesUsed: "已用分析次数",
      used: "已用",
      remaining: "剩余",
      unlimited: "无限",
      hoursSaved: "预计节省工时",
      risksDetected: "已识别风险",
      upgradeContinue: "升级以继续",
      runningLow: "额度不足？",
      seePlans: "查看套餐",
      trialBadge: "14 天免费试用",
      trialEndsIn: "试用将在 {days} 天后结束",
      trialEndsInOne: "试用将在 1 天后结束",
      trialEndingToday: "试用将于今天结束",
      trialEndsOn: "结束日期：{date}",
      noChargeToday: "今天不扣费。",
      paymentMethodRequired: "需要支付方式",
      trialAutoConvert: "除非你在试用结束前取消，所选订阅将在试用结束后自动开始。",
      cancelTrial: "取消试用",
      cancelTrialTitle: "取消试用？",
      cancelTrialExplainConvert: "试用不会转为付费订阅。",
      cancelTrialExplainAccess: "试用结束后，访问将遵循免费工作区规则。",
      cancelTrialExplainData: "公司数据将被保留。",
      cancelPaidTitle: "取消订阅？",
      cancelPaidExplainDate: "取消将于 {date} 生效。",
      cancelPaidExplainAccess: "在该日期之前你仍可继续使用。",
      cancelPaidExplainAfter:
        "此后工作区将转为免费工作区。不会删除公司文档、请求、证据或历史记录。",
      confirmCancel: "确认取消",
      keepPlan: "保留当前套餐",
      cancellationDate: "取消日期",
      accessUntil: "在 {date} 之前仍可继续使用。",
      freeWorkspace: "免费工作区",
      freeWorkspaceBody:
        "有限工作区。包含公司资料和有限的文件合规。不包含付费能力。",
      freeCapabilityProfile: "公司资料",
      freeCapabilityCompliance: "文件合规（有限）",
      nextBillingDate: "下次扣费日期",
      usage: "用量",
      paymentFailed: "支付失败",
      pastDue: "已逾期",
      statusTrialing: "试用中",
      statusActive: "已生效",
      statusCanceled: "已取消",
      statusUnpaid: "未支付",
      statusExpired: "已过期",
      statusIncomplete: "未完成",
      monthlyInterval: "按月",
      yearlyInterval: "按年",
      seatsUsage: "席位",
      aiUsage: "AI 用量",
      analysesUsage: "分析次数",
      analysesNotIncluded: "未包含",
      cancelError: "暂时无法取消。请重试或联系支持。",
      started: "开始时间",
      paypalMethod: "PayPal",
      graceTitle: "支付问题 — 宽限期",
      graceBody: "支付失败。访问将持续到 {date}。请更新账单以免中断。",
      inactiveTitle: "订阅未生效",
      inactiveBody: "当前订阅未生效。公司数据已保留。续订或升级可恢复付费能力。",
      billingHistory: "账单记录",
      billingHistoryEmpty: "暂无发票。成功或失败的扣费后会显示在这里。",
      invoiceDate: "日期",
      invoiceAmount: "金额",
      invoiceStatus: "状态",
      viewReceipt: "查看收据",
      updatePaymentMethod: "更新支付方式",
      retryPayment: "处理付款",
      paymentProblemTitle: "付款问题",
      paymentProblemBody: "未能收取订阅费用。请更新支付方式以保持访问。",
      paypalManageHint: "此订阅的支付方式由 PayPal 账户管理。",
      paymentPortalError: "无法打开安全支付页面。请重试或联系支持。",
      canceledAlertTitle: "您的订阅已取消",
      subscriptionEndedTitle: "您的订阅已结束",
      subscriptionEndedBody: "您的工作区数据安全无虞，但部分高级功能已锁定。",
      choosePlan: "选择套餐",
      graceDaysRemaining: "您还有 {days} 天时间解决付款问题。",
      graceDaysRemainingOne: "您还有 1 天时间解决付款问题。",
    },
    alerts: {
      title: "提醒",
      subtitle: "截止日期、决策记忆、评分、要求与流程更新。",
      emptyTitle: "暂无提醒",
      emptyDescription: "截止日期、风险与分析通知将显示在这里。",
      newBadge: "新",
      markAllRead: "全部标为已读",
      unreadCount: "{count} 条未读",
    },
    settings: {
      title: "设置",
      subtitle: "账户偏好与工作区默认项。",
      accountTitle: "账户",
      accountBody: "当前登录用户",
      name: "姓名",
      email: "邮箱",
      avatarLabel: "头像",
      avatarHint: "显示在顶部栏。支持 JPG、PNG、WebP 或 GIF · 最大 5MB。",
      avatarUpload: "上传照片",
      avatarUploading: "上传中…",
      avatarRemove: "移除",
      accountSave: "保存更改",
      accountSaving: "保存中…",
      accountSaved: "账户已更新。",
      emailChangeHint: "更改邮箱需要当前密码，并向新地址发送确认链接。",
      emailChangePending: "待确认：{email}。",
      emailChangeSent: "请查收 {email} 中的确认链接。确认前仍使用当前邮箱。",
      emailChangeResend: "重新发送确认",
      emailChangeResent: "已重新发送确认至 {email}。",
      emailChangeExpires: "过期时间 {when}。",
      emailChangePasswordLabel: "当前密码",
      emailChangePasswordHint: "更改邮箱时必须验证。",
      emailChangePasswordRequired: "更改邮箱请输入当前密码。",
      emailChangeCancel: "取消邮箱更改",
      emailChangeCancelled: "已取消邮箱更改。",
      emailChangeInvalidTitle: "链接无效或已过期",
      emailChangeInvalidBody: "请在设置中重新申请确认链接。",
      emailChangeBackSettings: "返回设置",
      companyProfileTitle: "公司资料",
      companyProfileBody:
        "行业、规模、服务、国家与经验，用于后续分析中的公司–标书匹配。仅限本组织可见。",
      editCompanyProfile: "编辑公司资料",
      notificationsTitle: "通知",
      notificationsBody:
        "截止日期与分析提醒 — 应用内与邮件。WhatsApp / 短信 / 推送可稍后接入。",
      moduleRemindersTitle: "模块提醒计划",
      moduleRemindersBody: "文档合规与招标日历各自有提醒提前量。",
      complianceRemindersLink: "文档合规提醒",
      calendarRemindersLink: "招标日历提醒",
      planTitle: "套餐",
      planUnlimited: "Business · 无限 · 已用 {used}",
      planLimited: "已用 {used}/{limit} 次分析",
      manageBilling: "管理账单",
      viewUpgrade: "查看升级选项",
      signOut: "退出登录",
      revokeOtherSessions: "退出其他设备",
      revokeOtherSessionsHint: "保持当前会话有效。",
      timezone: "公司时区",
      timezoneHint: "用于截止日期提醒文案与本地时间显示。",
      channels: "渠道",
      channelInApp: "应用内提醒",
      channelEmail: "邮件",
      channelWhatsapp: "WhatsApp（即将推出）",
      channelSms: "短信（即将推出）",
      channelPush: "推送（即将推出）",
      deadlineAlerts: "截止日期提醒",
      deadline7d: "提前 7 天",
      deadline3d: "提前 3 天",
      deadline24h: "提前 24 小时",
      deadlinePassed: "截止日期已过",
      otherAlerts: "其他提醒",
      alertAnalysisDone: "分析完成",
      alertHighRisk: "高风险发现",
      alertMissingDocs: "缺少文档",
      alertScoreChange: "评分或决策变更",
      alertRequirementStatus: "要求状态变更",
      alertDecisionMemory: "相关决策记忆",
      alertWorkflow: "流程 / 材料包事件",
      prefsSaved: "偏好已保存。",
      savePrefs: "保存通知偏好",
    },
    tenders: {
      title: "招标",
      subtitle: "{count} 份招标 · 按决策、风险与截止日期筛选",
      subtitleOne: "1 份招标 · 按决策、风险与截止日期筛选",
      analyzeCta: "分析招标",
      emptyTitle: "暂无招标",
      emptyDescription: "上传 ITT 或 PQQ，获取 Bid / Review / No-Bid 建议。",
      search: "搜索",
      searchPlaceholder: "标题或客户",
      decision: "决策",
      allDecisions: "全部决策",
      bid: "投标",
      review: "复核",
      noBid: "不投标",
      risk: "风险",
      allRiskLevels: "全部风险等级",
      low: "低",
      medium: "中",
      high: "高",
      critical: "严重",
      deadline: "截止日期",
      anyDeadline: "任意截止日期",
      next7d: "未来 7 天",
      next14d: "未来 14 天",
      next30d: "未来 30 天",
      overdue: "已逾期",
      sort: "排序",
      sortRecent: "最近分析",
      sortDeadlineSoon: "截止日期最近",
      sortDeadlineLate: "截止日期最远",
      sortFit: "匹配分数",
      sortTitle: "标题 A–Z",
      colTender: "招标",
      colClient: "客户",
      colDeadline: "截止日期",
      colFit: "匹配",
      colDecision: "决策",
      colRisk: "风险",
      colAnalyzed: "已分析",
      colNextAction: "下一步",
      deadlineWithDate: "截止 {date}",
      fitWithScore: "匹配 {score}",
      noNextAction: "暂无下一步",
    },
    upload: {
      title: "分析招标",
      subtitle: "上传 ITT 或 PQQ，获取 Bid / Review / No-Bid 建议。",
      trialLeft: "试用 · 剩余 {remaining} 次分析",
      trialEnds: " · 截止 {date}",
      phaseIdleTitle: "上传招标文件包",
      phaseIdleBody: "可上传多个招标文件或 ZIP/RAR 压缩包。我们关注投标决策 — 而非原始文档堆砌。",
      phaseUploadingTitle: "上传中…",
      phaseUploadingBody: "正在安全传输你的文件。",
      phaseDiscoveringTitle: "正在发现文件…",
      phaseDiscoveringBody: "正在清点招标包中的每份文档。",
      phaseExtractingTitle: "正在解压文件包…",
      phaseExtractingBody: "正在解压 ZIP/RAR 并发现招标文档。",
      phasePreparingTitle: "正在准备文档…",
      phasePreparingBody: "正在校验文件并准备分析。",
      phaseProcessingTitle: "正在处理文档…",
      phaseProcessingBody: "已排队进行提取与需求结构化。",
      phaseAnalyzingTitle: "正在分析匹配…",
      phaseAnalyzingBody: "对照公司资料、运行规则并生成决策。",
      phaseSuccessTitle: "分析已完成",
      phaseSuccessBody: "决策包已可用。",
      phaseErrorTitle: "上传失败",
      phaseErrorBody: "上传或准备文件包时出错。请检查文件后重试。",
      phaseAnalysisErrorTitle: "分析未能完成",
      phaseAnalysisErrorBody: "文件包已成功上传并准备就绪。失败发生在分析阶段 — 打开招标查看详情。",
      phaseTimeoutBody: "已超过 1 分钟仍在处理。请稍后打开该招标 — 分析可能在后台完成。",
      phaseTimeoutTitle: "仍在处理",
      stillWorking: "分析仍在后台进行",
      openTender: "打开招标",
      trialUsedTitle: "试用分析已用尽",
      trialUsedBody: "升级后可继续分析更多招标。",
      viewPlans: "查看套餐",
      unlimitedPlan: "当前 Business 套餐为无限分析",
      remainingAnalyses: "剩余 {count} 次免费分析",
      dragHere: "将招标文件或 ZIP/RAR 压缩包拖放到此处",
      processingTender: "正在处理你的招标包…",
      fileTypes: "PDF、Word、Excel、PowerPoint、CSV、TXT、图片、ZIP/RAR · 每包最多 {max} 个文件 · 单文件最大 {maxFileMb}MB · 整包最大 {maxPackageMb}MB",
      chooseFile: "选择文件",
      filesSelected: "已选择 {count} 个文件",
      maxFilesReached: "每个包最多 {max} 个文件。",
      filesDiscovered: "包中发现 {count} 个文件",
      removeFile: "移除",
      statusReady: "就绪",
      statusUploading: "上传中…",
      statusDiscovering: "发现中…",
      statusExtracting: "解压中…",
      statusPreparing: "准备中…",
      statusProcessing: "处理中…",
      statusAnalyzing: "分析中…",
      startUpload: "上传并分析",
      waitForUpload: "请等待当前上传完成后再添加更多文件。",
      bodyTooLarge:
        "招标包过大，无法完成本次请求。请减少文件数量，或在提高大小限制后重启应用再试。",
      decisionReady: "决策已就绪 — 请打开下方结果包。",
      unableContinue: "无法继续",
      openDecision: "打开决策",
      uploadAnother: "再上传一份",
      tryAgain: "重试",
      creditsExhausted: "免费分析次数已用完。升级后可继续。",
      passwordRequiredTitle: "需要密码",
      passwordRequiredBody: "此文件受密码保护。请输入密码以继续。",
      passwordLabel: "压缩包密码",
      passwordSubmit: "解锁并继续",
      passwordCancel: "取消",
      passwordWrong: "密码不正确。请重试。",
      intakeRepairedTitle: "已自动修复",
      intakePartialTitle: "部分可读",
      intakeIncompleteTitle: "文件包不完整",
      intakeReadyTitle: "可开始分析",
      intakeBlockedTitle: "分析已阻止",
      intakeUnsupportedTitle: "不支持的格式",
      intakeCorruptedTitle: "文件已损坏",
      intakePartiallyReadableTitle: "部分可读2",
    },
    tenderDetail: {
      backToTenders: "← 招标",
      unknownClient: "未知客户",
      deadline: "截止日期",
      analyzed: "已分析",
      fullReport: "完整报告",
      analysisInProgressTitle: "分析进行中",
      analysisInProgressBody: "状态：{status}。请稍后刷新 — 正在处理。",
      analysisFailedTitle: "分析失败",
      analysisFailedBody: "处理已以终端失败结束。请查看下方错误详情。",
      analysisFailedPhase: "停止于阶段：{phase}",
      canonicalNote:
        "规范分析 — 每位授权用户看到相同的要求、合规、匹配、就绪度、风险、Bid Score 与建议。角色仅控制访问权限。",
      missingDocuments: "缺少文档",
      required: "必需",
      nextActions: "下一步",
      noNextActions: "此决策暂无推荐行动。",
      teamWorkflow: {
        title: "团队决策流程",
        subtitle:
          "将要求、风险与缺失证据分配给财务、法务、技术等部门。团队回复仅为证据，不会自动改变 Decision Engine。",
        empty: "暂无团队任务。",
        criticalBanner: "最终决策前仍有 {count} 项未解决的关键团队任务。",
        assign: "分配",
        respond: "保存回复",
        complete: "完成并提交回复",
        create: "创建任务",
        responsePlaceholder: "输入已核实回复（勿编造）…",
        evidencePlaceholder: "证据说明（可选）…",
        department: "部门",
        assignee: "负责人",
        requiredResponse: "所需回复",
        linkedItem: "关联标书项",
      },
      decisionSupport: "决策支持",
      fitSuffix: "匹配",
      overallFit: "总体匹配",
      confidence: "置信度",
      confidenceHigh: "高",
      confidenceMedium: "中",
      confidenceLow: "低",
      heroBidLabel: "Bidvera 建议跟进",
      heroBidHint: "根据现有信息，匹配度支持投入投标精力 — 提交前仍需核实。",
      heroReviewLabel: "Bidvera 建议复核",
      heroReviewHint: "模糊、缺口或未知项需人工确认后再承诺。",
      heroNoBidLabel: "Bidvera 建议不跟进",
      heroNoBidHint: "根据现有数据，关键缺口使投标投入回报不大 — 请与团队确认。",
      companyTenderFit: "公司–招标匹配",
      unknown: "未知",
      basisAi: " · AI 评估",
      basisNotProvided: " · 未提供",
      basisFromProfile: " · 来自公司资料",
      basisFromTender: " · 来自招标",
      tenderReadiness: "招标就绪度",
      readinessCounts: "{ready} 就绪 · {verify} 待核 · {missing} 缺失",
      recommendation: "建议：",
      keyBlockers: "关键阻碍",
      keyBlockersNext: "建议下一步：在最终投标决策前解决突出问题。",
      whyTitle: "为何给出此建议？",
      executiveSummary: "执行摘要",
      viewDetails: "查看详情",
      hideDetails: "收起详情",
      topReasons: "关键原因",
      criticalAlerts: "关键事项",
      whatToDoNext: "下一步建议",
      decisionDisclaimer:
        "Bidvera 提供基于证据的建议。最终决策权在贵公司。",
      expiredDeadlineAlert: "提交截止日期已过 — 请确认该招标是否仍开放。",
      mandatoryGapAlert: "强制性缺口",
      missingDocumentAlert: "缺少文档",
      detailedAnalysisTitle: "详细分析",
      detailedAnalysisHint:
        "完整要求、合规、证据、风险、匹配与工作流 — 与报告相同的规范数据。",
    },
    report: {
      backToTender: "← 招标",
      title: "分析报告",
      subtitle: "完整决策包 — 查看、打印、下载 PDF 或分享只读链接。",
      reportNotReady: "报告尚未就绪",
      reportNotReadyBody: "报告尚未就绪，请稍后重试。",
      print: "打印",
      downloadPdf: "下载 PDF",
      shareLink: "分享链接",
      copied: "已复制。",
      shareExpires: "72 小时后失效 · 只读：",
      revokeShare: "撤销已分享链接",
      shareRevoked: "已撤销分享链接。",
      reportEyebrow: "Bidvera 决策报告",
      unknownClient: "未知客户",
      deadline: "截止日期",
      analyzed: "已分析",
      recommendation: "建议",
      companyTenderFit: "公司–招标匹配度",
      confidence: "置信度",
      whyTitle: "为何给出此建议",
      bidScore: "投标评分",
      bidScoreLine: "投标评分：{score}/100 — {priority}",
      expectedValue: "预期价值：",
      risk: "风险：",
      effort: "投入：",
      positive: "正面",
      negative: "负面",
      overall: "总体",
      unknown: "未知",
      tenderReadiness: "招标就绪度",
      readinessCounts: "{ready} 就绪 · {verify} 待核 · {missing} 缺失",
      nextStep: "下一步：",
      complianceMatrix: "合规矩阵",
      requirements: "要求",
      ready: "就绪",
      missing: "缺失",
      verify: "待核",
      notApplicable: "不适用",
      withSources: "有来源",
      mandatory: "强制",
      optional: "可选",
      evidenceLabel: "证据：",
      noExcerpt: "暂无支持摘录。",
      page: "第 {n} 页",
      sourceNotLocated: "无法精确定位来源。",
      noRequirements: "未从此招标中提取到要求。",
      missingRequirements: "缺失要求",
      noMissingRequirements: "未发现缺失要求。",
      mandatoryParen: "（强制）",
      verificationItems: "待核项",
      nothingPendingVerify: "无待核项。",
      risks: "风险",
      noRisks: "未标记重大风险。",
      clarifications: "澄清问题",
      noClarifications: "未生成澄清问题 — 未检测到明显歧义。",
      reason: "原因：",
      source: "来源：",
      evidence: "证据",
      noEvidence: "暂无来源摘录。",
      historicalTitle: "相关历史情报",
      historicalBody:
        "类似的历史结果可为本次机会提供参考信号。这只是额外信号 — 不保证成败。",
      historicalPriority: "当前招标证据与公司资料始终优先。",
      historicalEmpty: "尚无适用于本机会的已验证历史模式。",
      decisionMemoryTitle: "决策记忆",
      currentAnalysisLabel: "当前分析",
      historicalDecisionLabel: "历史决策",
      decisionMemoryCurrentNote:
        "上方的评分、要求与建议是本招标的权威结果，不会因历史记录而改变。",
      decisionMemoryEmpty: "尚无与本次机会相关的既往决策。",
      relevanceReasons: "相关原因",
      missingDocuments: "缺失文件",
      nextActions: "建议下一步",
      noNextActions: "无建议操作。",
      basisDirect: "直接来源",
      basisAi: "AI 解读",
      basisUncertain: "来源不确定",
      evidenceVerificationTitle: "证据与验证",
      evidenceVerificationDisclaimer:
        "验证仅反映已记录的证据和人工审核。AI 解读永远不会被视为已验证。",
      verificationSummary:
        "{verified} 已验证 · {needs} 待验证 · {missing} 缺少证据 · {na} 不适用",
      noVerificationChains: "此招标暂无验证链。",
      verificationStatusVerified: "已验证",
      verificationStatusNeedsVerification: "待验证",
      verificationStatusMissingEvidence: "缺少证据",
      verificationStatusNotApplicable: "不适用",
      verifierLabel: "验证人：",
      verifiedAtLabel: "验证时间：",
      decisionOutcomeTitle: "决策结果",
      decisionOutcomeBidvera: "Bidvera 决策",
      decisionOutcomeHuman: "人工最终决策",
      decisionOutcomeActual: "实际结果",
      decisionOutcomeDate: "结果日期",
      decisionOutcomeReason: "结果原因",
      decisionOutcomeSuccess: "决策与结果",
      decisionOutcomeSuccessAligned: "原始决策与结果一致",
      decisionOutcomeSuccessMisaligned: "原始决策与结果不一致",
      decisionOutcomeSuccessPending: "结果待定",
      decisionOutcomeSuccessNeutral: "相对于原始决策为中性",
      decisionOutcomeRecorded: "已记录结果",
      outcomeLearningTitle: "基于结果的历史情报",
      decisionOutcomeAttachment: "支持文件",
      decisionOutcomeEvalSuccessful: "成功",
      decisionOutcomeEvalUnsuccessful: "未成功",
      decisionOutcomeEvalNotEvaluated: "未评估",
    },
    decisionMemory: {
      title: "决策记忆",
      subtitle: "贵司既往招标决策 — 仅供参考，绝不改变当前分析。",
      emptyTitle: "尚无已存储决策",
      emptyDescription: "完成的招标分析会自动出现在此。打开招标可对比当前分析与历史决策。",
      emptyDescriptionCompanyContext:
        "当决策智能为贵司记录结果时，已存决策会出现在此。请保持资质与证据最新，以便未来决策有充分的公司背景。",
      viewTender: "打开招标",
      openCompanyProfile: "打开公司资料",
      analyzed: "已分析",
      scores: "评分",
      requirements: "要求",
      risks: "风险",
      reasoning: "理由",
      relevance: "相关性",
      disclaimer: "历史决策 — 仅供参考。不会改变当前分析的评分或建议。",
      back: "返回决策记忆",
    },
    pwa: {
      availableOn: "适用于 Windows 与 macOS",
      updateTitle: "应用更新已就绪",
      updateBody: "有新的 Bidvera 桌面版本可用。重新加载以应用。",
      updateNow: "立即更新",
      installedTitle: "Bidvera 已安装",
      installedBody: "你正在使用桌面应用模式 — 可从程序坞或任务栏更快打开。",
      title: "将 Bidvera 安装为桌面应用",
      bodyBefore: "适用于",
      bodyAnd: "和",
      bodyAfter: "— 独立窗口打开，无需 App Store。",
      installCta: "安装 Bidvera",
      openingInstaller: "正在打开安装程序…",
      dismiss: "关闭",
      guideTitleSafari: "在 Safari 中安装 Bidvera",
      guideTitleEdge: "在 Edge 中安装 Bidvera",
      guideTitleChrome: "在 Chrome 中安装 Bidvera",
      guideTitleDefault: "安装 Bidvera",
      guideDescription: "按以下步骤将 Bidvera 添加为桌面应用。",
      desktopMeta: "桌面应用 · Windows 与 macOS",
      openInstallDialog: "打开安装对话框",
      gotIt: "知道了",
      iosStep1: "在 Safari 中点按共享按钮。",
      iosStep2: "选择",
      iosStep2Strong: "添加到主屏幕",
      iosStep3: "确认 — Bidvera 可从主屏幕全屏打开。",
      safariMacStep1: "在菜单栏打开",
      safariMacStep1Strong: "文件",
      safariMacStep2: "选择",
      safariMacStep2Strong: "添加到程序坞",
      safariMacStep3: "确认 — Bidvera 会像 Mac 应用一样出现在程序坞。",
      chromiumStep1Before: "查看 {browser} 地址栏右侧的",
      chromiumStep1Strong: "安装 / 电脑",
      chromiumStep1After: "图标。",
      chromiumStep2Before: "点击后选择",
      chromiumStep2Strong: "安装",
      chromiumStep3Before: "或打开浏览器菜单 →",
      chromiumStep3Install: "安装 Bidvera",
      chromiumStep3Mid: "/",
      chromiumStep3Apps: "应用 → 将此网站安装为应用",
    },
  },
};

const ar: Dictionary = {
  nav: {
    product: "المنتج",
    pricing: "الأسعار",
    faq: "الأسئلة",
    solutions: "الحلول",
    resources: "الموارد",
    signIn: "تسجيل الدخول",
    startFree: "ابدأ مجانًا",
    app: "التطبيق",
    language: "اللغة",
  },
  brand: {
    tagline: "اعرف ما يستحق المتابعة. اعرف ما أنت جاهز له.",
    description:
      "تساعد بيدفراء الشركات على فهم الجاهزية وإدارة الامتثال والتأهيل وتنظيم الأدلة وتقييم الفرص ذات الصلة واتخاذ قرارات قابلة للتفسير.",
  },
  landing: {
    headline: "اعرف ما يستحق المتابعة. اعرف ما أنت جاهز له.",
    subhead:
      "تساعد بيدفراء فرق الأعمال على فهم جاهزية الشركة، وإدارة الامتثال والتأهيل، وتنظيم الأدلة، وتقييم العمل ذي الصلة، وتحويل القرارات القابلة للتفسير إلى خطوات تالية واضحة.",
    ctaPrimary: "استكشف بيدفراء",
    ctaSecondary: "كيف يعمل",
    trialNote: "الجاهزية · الفرص · الأدلة · القرارات · التنفيذ",
    previewLabel: "ذكاء القرار",
    previewQuestion: "هل أنت جاهز للمتابعة؟",
    previewDecision: "REVIEW",
    previewFit: "توافق جاهزية قوي",
    previewRisk: "تم التحقق من الأدلة",
    previewRiskValue: "٣ متطلبات مؤكدة",
    previewMissing: "يحتاج انتباهًا",
    previewMissingValue: "بند تأهيل واحد للتحقق",
    previewNext: "الخطوة التالية",
    previewNextValue: "تأكيد الأدلة المتبقية",
    previewWhy:
      "التأهيل يبدو قويًا. ما يزال بند واحد يحتاج تحققًا قبل التزام الفريق.",
    sectionTitle: "لماذا تستخدم الشركات بيدفراء",
    sectionBody:
      "بدلًا من إعادة بناء الجاهزية من المجلدات والبريد وجداول البيانات، توفّر بيدفراء مساحة منظمة لمعلومات الشركة والإثبات والقرارات والمتابعة.",
    feature1Title: "اعرف جاهزيتك",
    feature1Body:
      "أبقِ معلومات الشركة والتأهيل وأدلة الامتثال منظمة ومحدّثة.",
    feature2Title: "نظّم العمل ذا الصلة",
    feature2Body:
      "التقط طلبات العملاء ومواعيد التقويم، ثم قيّم المتطلبات مقابل ما تستطيع تسليمه فعليًا.",
    feature3Title: "نفّذ بثقة",
    feature3Body:
      "اتخذ قرارات قابلة للتفسير، وعيّن الخطوات التالية، وأبقِ الفريق متوافقًا.",
    capabilitiesTitle: "ثماني قدرات للجاهزية والفرص والتنفيذ",
    capabilitiesLearnMore: "اعرف المزيد",
    capabilitiesShowLess: "عرض أقل",
    capabilities: [
      {
        title: "ملف الشركة",
        body: "أبقِ هوية الشركة وخدماتها ومعلومات الجاهزية منظمة في مساحة واحدة.",
        detail:
          "سجّل القطاع والخدمات والجغرافيا والحجم ليتشارك الفريق صورة حديثة عما تقدّمه الشركة. يدعم هذا الأساس التأهيل والأدلة ومراجعة الفرص.",
      },
      {
        title: "امتثال المستندات",
        body: "تتبّع مستندات الشركة الحرجة وتواريخ الانتهاء قبل أن تصبح عوائق.",
        detail:
          "احفظ التراخيص والشهادات والتأمين في مساحة آمنة، وراقب الصلاحية، واعرف ما يحتاج انتباهًا قبل انتهاء المدة.",
      },
      {
        title: "تأهيل المورّد",
        body: "أظهر ما أنت مؤهّل لتقديمه — وأين توجد الفجوات.",
        detail:
          "حافظ على التأهيلات والتغطية والأدلة الداعمة لترى الجاهزية قبل استثمار الوقت في طلب.",
      },
      {
        title: "طلبات العملاء",
        body: "مركز طلبات المشتري للمستندات والمعلومات في ملف واضح.",
        detail:
          "التقط الطلبات الواردة، واربط الأدلة الموجودة، وتتبّع الإنجاز، وشارك حزمة آمنة — لتقليل فوضى سلاسل البريد.",
      },
      {
        title: "تقويم المناقصات",
        body: "أبقِ المواعيد النهائية والمعالم والتذكيرات مرئية للفرص التي تتابعها.",
        detail:
          "نظّم التواريخ الرئيسية وإعدادات التذكير لتقليل احتمال تفويت التسليمات المهمة، مع خط زمني مشترك للفريق.",
      },
      {
        title: "مساعد الاستبيانات",
        body: "هيكل الأسئلة واصنع مسودات إجابات مدعومة بالأدلة مع خطوات تحقق واضحة.",
        detail:
          "اكتشف محتوى الاستبيان ونظّمه، وصغ إجابات مبنية على الأدلة المتاحة، وميّز ما يزال يحتاج تحققًا بشريًا.",
      },
      {
        title: "محرك القرار",
        body: "صل إلى BID أو REVIEW أو NO-BID قابلة للتفسير من الجاهزية والتأهيل والأدلة.",
        detail:
          "ادمج إشارات جاهزية الشركة مع سياق المتطلبات والأدلة لإنتاج قرار يمكن شرحه. تدعم ذاكرة القرار والمحاكي الحكم — ولا تحل محل مسؤولية الفريق.",
      },
      {
        title: "سير عمل قرار الفريق",
        body: "حوّل القرار إلى خطوات معيّنة وتحقق وتنبيهات يمكن تنفيذها.",
        detail:
          "أنشئ مهام سير العمل، وأرفق الأدلة، وأغلق حلقة التحقق، واستخدم التنبيهات الذكية وخطة العمل عند توفرها في الخطة.",
      },
    ],
    smartMatch: {
      eyebrow: "Smart Match Engine",
      title: "اعرف أي الفرص تناسب ملف شركتك",
      body: "يقارن Smart Match Engine إشارات الفرصة مع ملف شركتك لمساعدة الفرق على ترتيب أولوية المراجعة — بدل معاملة كل فرصة بنفس الطريقة.",
      benefit1: "أبرز الفرص المتوافقة مع الخدمات والقطاع والجغرافيا.",
      benefit2: "استخدم التأهيل والخبرة وحجم الشركة كأبعاد مطابقة منظمة.",
      benefit3: "راجع تفسيرات المطابقة قبل تخصيص وقت الفريق.",
      dimensionsLabel: "أبعاد المطابقة",
      dimensions: ["الخدمات", "القطاع", "الجغرافيا", "التأهيل", "الخبرة", "حجم الشركة"],
      note: "درجات المطابقة توجّه الاستكشاف والمراجعة. لا تضمن الأهلية أو تغطية كل الأسواق أو ترسية العقود. يعتمد الوصول على إعداد مساحة العمل.",
      ctaPrimary: "أنشئ ملف شركتك",
      ctaSecondary: "تعرّف كيف تعمل بيدفراء",
    },
    bottomTitle: "اجمع الجاهزية والفرص والقرارات في مساحة واحدة",
    bottomBody:
      "نظّم ما تملكه الشركة، وتحقق مما يمكن إثباته، وقيّم ما هو ذو صلة، وقرر ما يستحق المتابعة — مع الفريق.",
    bottomCta: "استكشف بيدفراء",
    howTitle: "كيف يعمل",
    howBody: "من جاهزية الشركة إلى تنفيذ واثق.",
    step1Title: "افهم",
    step1Body: "ابنِ صورة واضحة لشركتك ومستنداتها وتأهيلها وجاهزيتها.",
    step2Title: "نظّم",
    step2Body:
      "استخدم طلبات العملاء لالتقاط العمل الوارد، وأبقِ التواريخ الرئيسية في تقويم المناقصات.",
    step3Title: "تحقق",
    step3Body: "قابل المتطلبات بالملف والمستندات والتأهيل والأدلة.",
    step4Title: "قرر ونفّذ",
    step4Body:
      "صل إلى قرار قابل للتفسير ثم ادفعه عبر سير عمل الفريق والتنبيهات وخطة عمل واضحة.",
    beforeAfterTitle: "من معلومات مشتتة إلى تنفيذ واثق",
    beforeAfterBody:
      "توقف عن تجميع المستندات والتأهيل والفرص من أماكن مختلفة. تجمع بيدفراء الجاهزية والأدلة والقرارات.",
    beforeLabel: "بدون سير عمل منظم في بيدفراء",
    afterLabel: "مع بيدفراء",
    beforeItems: [
      "مستندات وتأهيل وأدلة مشتتة عبر المجلدات وصناديق الوارد",
      "غير واضح أي الطلبات أنت جاهز لها فعليًا",
      "مراجعة يدوية بلا مسار أدلة مشترك",
      "قرارات بلا ملكية واضحة للخطوات التالية",
    ],
    afterItems: [
      "مساحة واحدة لذكاء الشركة والجاهزية والأدلة المتحققة",
      "عمل وارد منظم مقابل القدرة الحقيقية",
      "BID / REVIEW / NO-BID قابلة للتفسير مع المبرر",
      "خطوات تالية معيّنة وتنبيهات وخطة يمكن للفريق تنفيذها",
    ],
    complianceEyebrow: "امتثال المستندات",
    complianceHeadline: "أبقِ شركتك جاهزة في كل حين.",
    complianceBody:
      "نظّم مستندات الشركة الحرجة، وتتبع تواريخ الانتهاء، وتابع متطلبات الامتثال من مساحة آمنة واحدة.",
    complianceBenefit1Title: "ابقَ منظمًا",
    complianceBenefit1Body: "كل مستندات الشركة في مساحة آمنة واحدة.",
    complianceBenefit2Title: "تتبّع الانتهاء",
    complianceBenefit2Body: "اعرف ما هو ساري وما يحتاج انتباهًا قبل انتهاء المدة.",
    complianceBenefit3Title: "جاهز للمتطلبات",
    complianceBenefit3Body: "اعرف أي المستندات تدعم المطلب التالي.",
    compliancePanelTitle: "مستندات الشركة",
    complianceAddLabel: "إضافة مستند",
    complianceAlertTitle: "التأمين ينتهي قريبًا",
    complianceReadyLabel: "أنت جاهز",
    complianceReadyHint: "المستندات الرئيسية متتبَّعة في مساحة واحدة.",
    complianceStatusValid: "ساري",
    complianceStatusExpiring: "ينتهي قريبًا",
    complianceDocTrade: "رخصة تجارية",
    complianceDocTax: "شهادة ضريبية",
    complianceDocInsurance: "تأمين",
    complianceDocQuality: "شهادة جودة",
    complianceDocFinancial: "بيانات مالية",
    complianceDateTrade: "ساري حتى ٣١ ديسمبر ٢٠٢٦",
    complianceDateTax: "ساري حتى ١٥ أكتوبر ٢٠٢٦",
    complianceDateInsurance: "ينتهي ٢٨ نوفمبر ٢٠٢٦",
    complianceDateQuality: "ساري حتى ١ أغسطس ٢٠٢٧",
    complianceDateFinancial: "ساري حتى ١٠ فبراير ٢٠٢٧",
    pricingTeaserTitle: "أسعار بسيطة للفرق النامية",
    pricingTeaserBody:
      "ابدأ مجانًا. رقِّ الخطة عندما توفّر بيدفراء وقتًا حقيقيًا — من {price}/شهر على Pro.",
    pricingTeaserCta: "قارن الخطط",
    viewAllFaq: "عرض كل الأسئلة ←",
    testimonialsTitle: "ماذا تقول الفرق",
    testimonialsBody:
      "ملاحظات حقيقية من فرق تستخدم بيدفراء للبقاء جاهزة واتخاذ قرارات بثقة.",
    testimonialsEmptyTitle: "ملاحظات العملاء الأوائل",
    testimonialsEmptyBody:
      "ننشر فقط شهادات عملاء حقيقية. كن من أوائل الفرق التي تجمع الجاهزية والأدلة والقرارات — ثم أخبرنا بالنتيجة.",
    testimonialsEmptyCta: "استكشف بيدفراء",
  },
  product: {
    eyebrow: "المنتج",
    title: "ذكاء الشركة. الجاهزية. قرارات قابلة للتفسير.",
    body: "بيدفراء ليست ملخّص PDF عام بالذكاء الاصطناعي. هي مساحة عمل للجاهزية والامتثال والتأهيل والأدلة وذكاء الفرص والقرارات القابلة للتفسير. متوافق / يحتاج تحقق / غير متوافق نتيجة لمحرك القرار — وليست المنتج بأكمله.",
    step1Title: "افهم الشركة",
    step1Body:
      "ابنِ صورة حية لملف الشركة والمستندات والتأهيل والجاهزية.",
    step2Title: "اكتشف ما هو ملائم",
    step2Body:
      "أظهر الفرص وطلبات العملاء المتوافقة مع ما تستطيع شركتك تسليمه فعليًا.",
    step3Title: "تحقق، قرّر ونفّذ",
    step3Body:
      "حلّل المتطلبات المهمة، اربط الأدلة، واتخذ قرارات متوافق / يحتاج تحقق / غير متوافق قابلة للتفسير، ثم حوّلها إلى خطوات تالية مع الفريق.",
    seeTitle: "ما يعمل عليه فريقك",
    seeItems: [
      "ملف الشركة وامتثال المستندات وتأهيل المورد",
      "طلبات العملاء ومواعيد التقويم",
      "ذكاء الأدلة مع تحقق مدعوم بالمصادر",
      "نتائج محرك القرار: متوافق / يحتاج تحقق / غير متوافق",
      "تبرير قابل للتفسير وذاكرة القرار والمحاكي",
      "تحليل المناقصات كخطوة ضمن سير العمل",
      "مساعد الاستبيانات وتصدير PDF",
      "سير قرار الفريق وخطط العمل والتنبيهات الذكية",
    ],
    cta: "استكشف بيدفراء",
    futureTitle: "قدرات نشطة في مساحة واحدة",
    futureBody:
      "تغطي بيدفراء بالفعل أساس الشركة وذكاء الفرص والأدلة والقرارات وعمل الفريق.",
    highlightItems: [
      "ملف الشركة",
      "امتثال المستندات",
      "طلبات العملاء",
      "ذكاء الأدلة",
      "محرك القرار",
      "تحليل المناقصات",
      "سير قرار الفريق",
      "ثقة وأمان الذكاء الاصطناعي",
    ],
  },
  pricing: {
    eyebrow: "الأسعار",
    title: "مساحة واحدة للجاهزية والفرص والعمل",
    body: "ابدأ بمساحة عمل مجانية محدودة، أو جرّب خطة مدفوعة لـ 14 يومًا. الأسعار من خطط بيدفراء الحالية.",
    perMonth: "/شهر",
    perMonthYearly: "/شهر تُفوتر سنويًا",
    analysesSeats: "{analyses} تحليلات / شهر · {seats} مقاعد",
    seatsOnly: "{seats} مقاعد",
    startFree: "ابدأ مجانًا",
    startFreeWorkspace: "ابدأ مساحة العمل المجانية",
    startTrial: "ابدأ تجربة 14 يومًا",
    startSubscription: "بدء الاشتراك",
    choose: "اختر {plan}",
    monthly: "شهري",
    yearly: "سنوي",
    save: "وفّر حوالي 17%",
    recommended: "الأكثر اختيارًا",
    mostPopular: "الأنسب للفرق النامية",
    trialBadge: "تجربة مجانية 14 يومًا",
    noChargeToday: "لا رسوم اليوم",
    paymentMethodRequired: "يلزم أسلوب دفع",
    cancelBeforeTrial: "ألغِ قبل انتهاء التجربة لتجنب رسوم الاشتراك.",
    freeHeadline: "ابدأ مجانًا. ابنِ مساحة عمل شركتك.",
    freeLimitedNote: "مساحة محدودة — ملف الشركة والامتثال المستندي فقط.",
    comparisonTitle: "مقارنة الخطط",
    comparisonFeature: "القدرة",
    yearlyNote: "المجاميع السنوية تستخدم سعر كل خطة كما هو مضبوط. الدفع يستخدم الفترة التي تختارها.",
    valueTitle1: "مساحة ذكاء للشركة",
    valueBody1: "نظّم معلومات الشركة والامتثال والتأهيل والأدلة والطلبات في مكان واحد، ثم اعمل مع الفريق.",
    valueTitle2: "حدود واضحة بلا استخدام خفي",
    valueBody2: "المقاعد وحدود الاستخدام ظاهرة على كل خطة. ما تراه هو ما تتضمنه الخطة.",
    valueTitle3: "جرّب خطة مدفوعة ثم قرر",
    valueBody3:
      "الخطط المؤهلة تتضمن تجربة 14 يومًا مع أسلوب دفع. ألغِ قبل انتهائها إن لم ترد بدء الاشتراك.",
    ctaTitle: "جاهزون لإبقاء الشركة مستعدة؟",
    ctaBody: "ابدأ بمساحة العمل المجانية، أو اختر خطة وجرّب بيدفراء 14 يومًا.",
    groups: {
      readiness: "جاهزية الشركة",
      opportunities: "الفرص والطلبات",
      intelligence: "الذكاء والقرارات",
      workflow: "الذكاء الاصطناعي وسير العمل",
    },
    features: {
      company_profile: "ملف الشركة",
      document_compliance: "امتثال المستندات",
      supplier_qualification: "تأهيل المورد",
      client_requests: "طلبات العملاء",
      tender_calendar: "التقويم",
      evidence_intelligence: "ذكاء الأدلة",
      advanced_decision_engine: "محرك القرار",
      decision_memory: "ذاكرة القرار",
      decision_simulator: "محاكي القرار",
      explainable_decision: "قرار قابل للتفسير",
      tender_analysis: "تحليل المناقصات",
      questionnaire_assistant: "مساعد الاستبيانات",
      smart_alerts: "تنبيهات ذكية",
      team_collaboration: "سير قرار الفريق",
      pdf_export: "تصدير PDF",
      tender_action_plan: "خطة العمل",
    },
  },
  faq: {
    eyebrow: "الأسئلة",
    title: "إجابات واضحة",
    items: [
      {
        q: "ما هي Bidvera؟",
        a: "Bidvera هي مساحة عمل لذكاء الشركة تساعد الشركات على تنظيم معلوماتها، وإدارة الامتثال، وتقييم الفرص ذات الصلة، والعمل بالأدلة، واتخاذ إجراءات بثقة.",
      },
      {
        q: "كيف تساعد Bidvera في إبقاء شركتي جاهزة؟",
        a: "تجمع Bidvera ملف الشركة والتأهيلات والمستندات الأساسية معًا حتى يتمكن فريقك من الحفاظ على أساس عمل موثوق ومحدّث.",
      },
      {
        q: "كيف يعمل Document Compliance؟",
        a: "تتبّع مستندات الشركة المهمة، وراقب تواريخ الانتهاء، وتلقَّ تنبيهات عند الحاجة إلى اهتمام، مما يساعد شركتك على البقاء مستعدة.",
      },
      {
        q: "كيف تساعد Bidvera في الفرص وطلبات العملاء؟",
        a: "يمكن للفرق التقاط طلبات العملاء، ومتابعة المواعيد في تقويم المناقصات، وتقييم المتطلبات مقابل ملف الشركة والقدرات والتأهيلات.",
      },
      {
        q: "هل يمكن لـ Bidvera المساعدة في طلبات العملاء والاستبيانات؟",
        a: "نعم. يمكن للفرق إدارة طلبات العملاء واستخدام Questionnaire Assistant لتنظيم المعلومات المطلوبة والرد عليها بكفاءة أكبر.",
      },
      {
        q: "كيف تستخدم Bidvera الأدلة؟",
        a: "يربط Evidence Intelligence معلومات الشركة والتأهيلات والأدلة الداعمة حتى تفهم الفرق ما تم التحقق منه وما يحتاج إلى اهتمام ولماذا.",
      },
      {
        q: "هل يمكن لفريقي التعاون في Bidvera؟",
        a: "نعم. يساعد Team Decision Workflow الأعضاء على العمل معًا، وتعيين المسؤوليات، ومراجعة المعلومات، وتنسيق الخطوات التالية في مساحة واحدة.",
      },
      {
        q: "هل Bidvera آمنة؟",
        a: "صُممت Bidvera بوصول مُتحكَّم فيه وعزل للمستأجرين وحمايات أمنية حتى تبقى مساحة عمل ومعلومات كل شركة منفصلة.",
      },
      {
        q: "هل يمكنني تجربة Bidvera قبل الاشتراك؟",
        a: "نعم. يمكنك البدء بالتجربة المجانية المتاحة واستكشاف المنصة قبل اختيار اشتراك.",
      },
    ],
  },
  auth: {
    loginTitle: "تسجيل الدخول",
    loginBody: "ادخل إلى مساحة عمل بيدفراء لشركتك.",
    emailChangedNotice:
      "تم تحديث بريدك. سجّل الدخول بالعنوان الجديد. تم إنهاء الجلسات الأخرى.",
    sideHeadline: "اعرف ما يستحق المتابعة. اعرف ما أنت جاهز له.",
    sideBody:
      "تساعد بيدفراء فريقك على تنظيم الجاهزية والتحقق من الأدلة وتقييم الفرص واتخاذ القرار بثقة.",
    sidePillMatched: "مطابقة — وُجدت فرصة مناسبة للشركة.",
    sidePillReview: "مراجعة — راجع تفاصيل الفرصة ومدى صلتها.",
    sidePillNotAMatch: "ليست مطابقة — الفرصة لا تتوافق مع ملف الشركة.",
    signupTitle: "أنشئ حساب Bidvera",
    signupBody: "البريد وكلمة المرور أولاً، ثم إعداد الشركة.",
    name: "اسمك",
    companyName: "اسم الشركة",
    email: "البريد المهني",
    password: "كلمة المرور",
    confirmPassword: "تأكيد كلمة المرور",
    submitLogin: "تسجيل الدخول",
    submitSignup: "إنشاء حساب",
    haveAccount: "لديك حساب بالفعل؟",
    newHere: "جديد على Bidvera؟",
    acceptTerms: "أوافق على الشروط وسياسة الخصوصية.",
    acceptTermsError: "يجب قبول الشروط وسياسة الخصوصية.",
    continueGoogle: "تسجيل بواسطة كوكول",
    googleComingSoon: "تسجيل كوكول قريبًا",
    continueMicrosoft: "تسجيل بواسطة Microsoft",
    microsoftComingSoon: "تسجيل Microsoft قريبًا",
    forgotPassword: "نسيت كلمة المرور؟",
    forgotTitle: "إعادة تعيين كلمة المرور",
    forgotBody: "سنرسل رابطًا لمرة واحدة إن وُجد الحساب.",
    forgotSubmit: "إرسال رابط الإعادة",
    forgotSent: "إن كان البريد مسجلاً، فالرابط في الطريق.",
    resetTitle: "اختر كلمة مرور جديدة",
    resetBody: "استخدم 12 حرفًا على الأقل.",
    resetSubmit: "تحديث كلمة المرور",
    passwordMismatch: "كلمتا المرور غير متطابقتين.",
  },
  assistant: {
    askLabel: "اسأل Bidvera",
    title: "مساعد بيدفراء",
    description:
      "اسأل عن بيدفراء أو الجاهزية أو الفرص أو الأدلة أو الخطوات التالية. الإجابات من المساعد الذكي، والصوت عبر تحويل نص إلى كلام آمن.",
    placeholder: "اطرح سؤالاً…",
    send: "إرسال",
    thinking: "جارٍ التفكير…",
    play: "تشغيل",
    pause: "إيقاف مؤقت",
    mute: "كتم",
    unmute: "إلغاء الكتم",
    voiceUnavailable: "الصوت غير متاح الآن. يمكنك قراءة الإجابة.",
    errorGeneric: "تعذر الحصول على إجابة. حاول مرة أخرى.",
    attachImage: "إرفاق صورة",
    removeImage: "إزالة الصورة",
    imageOnlyOne: "يُسمح بصورة واحدة فقط.",
    imageTooLarge: "الصورة كبيرة جداً (الحد 4 ميجابايت).",
    imageInvalid: "استخدم صورة JPEG أو PNG أو WebP أو GIF.",
    imageQuotaReached: "تم تجميد رفع الصور — صورة واحدة كل 4 ساعات لهذا المتصفح والعنوان.",
    replyQuotaReached: "تم تجميد الإرسال — استُهلكت 10 ردود لهذا المتصفح والعنوان (يُعاد بعد 4 ساعات).",
  },
  app: {
    nav: {
      dashboard: "لوحة التحكم",
      tenders: "تحليل المناقصات",
      tenderCalendar: "تقويم المناقصات",
      documentCompliance: "امتثال المستندات",
      supplierQualification: "تأهيل المورد",
      clientRequests: "طلبات العملاء",
      questionnaireAssistant: "مساعد الاستبيانات",
      matchedOpportunities: "الفرص المطابقة",
      company: "ملف الشركة",
      billing: "الفوترة",
      alerts: "التنبيهات",
      settings: "الإعدادات",
      decisionMemory: "ذاكرة القرار",
      teamWorkflow: "سير عمل الفريق",
      sectionCapabilities: "القدرات",
      sectionWorkspace: "مساحة العمل",
      sectionAccount: "الحساب",
    },
    shell: {
      tagline: "تحقّق قبل أن تقدّم.",
      analyzeTender: "تحليل مناقصة",
      upgrade: "ترقية",
      signOut: "تسجيل الخروج",
      openMenu: "فتح القائمة",
      closeMenu: "إغلاق القائمة",
      decisionWorkspace: "مساحة Bidvera",
      yourCompany: "شركتك",
      workspace: "مساحة العمل",
    },
    dashboard: {
      eyebrow: "نظرة تنفيذية",
      title: "لوحة التحكم",
      subtitle:
        "ما العمل التالي، وأي المناقصات تستحق المتابعة، وما الذي يعيقك.",
      analyzeCta: "تحليل مناقصة",
      activeTenders: "مناقصات نشطة",
      inPipeline: "في المسار",
      bid: "متوافق",
      pursue: "متابعة",
      review: "يحتاج تحقق",
      verifyFirst: "تحقّق أولًا",
      noBid: "غير متوافق",
      skipEffort: "تجنّب الجهد",
      upcomingDeadlines: "المواعيد القادمة",
      upcomingEmpty: "لا مواعيد نهائية خلال الأسبوعين القادمين.",
      upcomingCalendarDeadlines: "المواعيد القادمة",
      upcomingCalendarHint:
        "From Tender Calendar — same deadlines shown in the calendar module",
      upcomingCalendarEmpty: "لا مواعيد تقويم قادمة بعد.",
      addCalendarTender: "إضافة مناقصة إلى التقويم",
      highRisk: "مناقصات عالية المخاطر",
      highRiskEmpty: "لا توجد مناقصات بمخاطر عالية أو حرجة حاليًا.",
      recentAnalyses: "التحليلات الأخيرة",
      recentEmpty:
        "لا تحليلات بعد. ارفع مناقصة للحصول على قرارك الأول.",
      viewAll: "عرض الكل",
      due: "الاستحقاق",
      analyzed: "تم التحليل",
      decisionDistribution: "توزيع القرارات",
      decisionDistributionHint: "حصة نتائج متوافق / يحتاج تحقق / غير متوافق المكتملة",
      upcomingHint: "مناقصات لا تزال في التقويم",
      uploadTender: "رفع مناقصة",
      riskOverview: "نظرة على المخاطر",
      riskOverviewHint: "تعرض حرج أو عالٍ للاستبعاد",
      recentHint: "أحدث نتائج متوافق / يحتاج تحقق / غير متوافق",
      platformTitle: "ما يمكنك فعله في بيدفراء",
      platformHint: "Four capabilities in one product — open any module to continue.",
      capabilityAnalysisDesc: "ارفع الحزم واحصل على قرارات متابعة / عدم متابعة.",
      capabilityComplianceDesc: "تتبّع مستندات العمل وتذكيرات انتهاء الصلاحية.",
      capabilityQualificationDesc:
        "Supplier readiness for bids and questionnaires — not your workspace Company Profile.",
      capabilityCalendarDesc: "تتبّع مواعيد الفرص والتذكيرات.",
      capabilityOpen: "فتح",
      capabilityGetStarted: "ابدأ",
      capabilityUpgrade: "رقِّ الخطة لإلغاء القفل",
      statusAnalyses: "{count} تحليلات",
      statusDocuments: "{count} مستندات",
      statusCompleteness: "مكتمل بنسبة {percent}%",
      statusDeadlines: "{count} قادمة",
      statusLocked: "غير مدرج في خطتك الحالية",
      gettingStartedTitle: "الخطوات التالية المقترحة",
      gettingStartedHint: "Pick any path — you can come back anytime.",
    },
    onboarding: {
      signOutHint: "الحساب",
      stepVerify: "تأكيد البريد",
      stepCompany: "الشركة",
      stepPlan: "الخطة",
      verifyTitle: "أكد بريدك",
      verifyBody: "أرسلنا رابطًا إلى",
      resend: "إعادة إرسال رسالة التأكيد",
      resent: "تم إرسال رسالة التأكيد.",
      verifyInvalidTitle: "الرابط غير صالح أو منتهٍ",
      verifyInvalidBody: "اطلب رسالة تأكيد جديدة من الإعداد.",
      companyTitle: "أخبرنا عن شركتك",
      companyBody: "يساعد هذا بيدفراء على تقييم مدى ملاءمة المناقصة لعملك.",
      companyName: "اسم الشركة",
      country: "البلد / موقع العمل",
      industry: "القطاع / المجال",
      companySize: "حجم الشركة",
      services: "الخدمات / القدرات الرئيسية",
      servicesHint: "أضف عدة وسوم — اضغط Enter بعد كل واحدة.",
      experience: "مستوى الخبرة",
      experienceOptional: "اختياري",
      privacyNote:
        "نستخدم هذه المعلومات فقط لتخصيص تجربة بيدفراء وتحسين تحليل ملاءمة المناقصات. لا نحتاج معلومات حساسة عن الشركة أو الأفراد.",
      companySubmit: "متابعة",
      companySkip: "تخطّ الآن",
      planTitle: "اختر طريقة البدء",
      planBody: "ابدأ بمساحة العمل المجانية أو اختر خطة مدفوعة. خطط Stripe المؤهلة تتضمن تجربة 14 يومًا.",
      trialTitle: "تجربة 14 يومًا",
      trialBody: "يلزم أسلوب دفع. لا رسوم اليوم. تبدأ الخطة المحددة تلقائيًا ما لم تُلغِ.",
      trialCta: "ابدأ تجربة 14 يومًا",
      paidCta: "بدء الاشتراك",
      freeTitle: "مساحة العمل المجانية",
      freeBody: "ابدأ مجانًا وابنِ مساحة شركتك. مقتصرة على ملف الشركة والامتثال المستندي.",
      freeCta: "ابدأ مساحة العمل المجانية",
      noChargeToday: "لا رسوم اليوم",
      paymentMethodRequired: "يلزم أسلوب دفع",
      cancelBeforeTrial: "ألغِ قبل انتهاء التجربة لتجنب رسوم الاشتراك.",
      monthly: "شهري",
      yearly: "سنوي",
      checkoutCanceled: "أُلغي الدفع. يمكنك المحاولة لاحقًا.",
      checkoutPending: "تم استلام الدفع — جاري التفعيل…",
    },
    companyProfile: {
      title: "ملف الشركة",
      subtitle:
        "يُستخدم لمطابقة الشركة والمناقصة في التحليلات القادمة. خاص بمؤسستك — لا نطلب بيانات شخصية أو مالية حساسة.",
      headerHint:
        "حسّن جودة المطابقة مع الوقت. تُطبَّق التغييرات على تحليلات المناقصات المستقبلية فقط.",
      supplierQualificationHint:
        "هل تحتاج تفاصيل تسجيل وأدلة جاهزة للمناقصة؟ استخدم",
      supplierQualificationLink: "تأهيل المورد",
      companyName: "اسم الشركة",
      completeness: "اكتمال الملف",
      savedTitle: "تم الحفظ",
      savedBody:
        "تم تحديث ملف الشركة. سيستخدم التحليل أحدث التفاصيل في المناقصة التالية.",
      saveErrorTitle: "تعذّر الحفظ",
      basicsTitle: "أساسيات الشركة",
      basicsBody:
        "للتحليل والمطابقة فقط — لا حاجة لبيانات شخصية أو مالية حساسة.",
      industry: "القطاع",
      country: "الدولة",
      companySize: "حجم الشركة",
      notProvided: "غير محدد",
      experienceLevel: "مستوى الخبرة (اختياري)",
      experienceYears: "سنوات الخبرة (اختياري)",
      experienceYearsPlaceholder: "مثال: 5",
      revenueRange: "نطاق الإيرادات (اختياري)",
      revenuePlaceholder: "مثال: £2m–£5m",
      employees: "عدد الموظفين (اختياري)",
      employeesPlaceholder: "مثال: 50–100",
      sizeSolo: "فردي",
      sizeSmall: "صغيرة",
      sizeMedium: "متوسطة",
      sizeEnterprise: "كبيرة",
      expNew: "جديدة / خبرة محدودة",
      expSome: "بعض الخبرة",
      expExperienced: "ذات خبرة",
      expHighly: "خبرة عالية",
      capabilitiesTitle: "القدرات والتغطية",
      services: "الخدمات",
      certifications: "الشهادات",
      geographicCoverage: "التغطية الجغرافية",
      commaSeparated: "مفصولة بفواصل",
      contractTitle: "تفضيلات العقود",
      contractMin: "الحد الأدنى لقيمة العقد (£)",
      contractMax: "الحد الأقصى لقيمة العقد (£)",
      rulesTitle: "قواعد التأهيل المخصصة",
      rulesBody: "قاعدة واحدة في كل سطر. تُستخدم كمرشّحات أثناء التحليل.",
      save: "حفظ الملف",
      learningTitle: "الموافقة على التعلم العالمي",
      learningBody:
        "عند التفعيل، قد تساهم بيدفراء بأنماط نتائج مُفلترة للخصوصية (دون أسماء شركات أو مستندات أو استراتيجيات أو سجلات قابلة للتعريف) في طبقة التعلم العالمية. تبقى نتائج شركتك الخاصة معزولة داخل المستأجر. يمكنك الإلغاء في أي وقت.",
      learningCheckbox:
        "المساهمة بنتائج مجهولة الهوية في الأنماط العالمية الموثّقة",
      learningSaving: "(جارٍ الحفظ…)",
    },
    billing: {
      title: "الفوترة",
      subtitle: "الخطة الحالية والتجديد وسجل المدفوعات والفواتير.",
      activatedTitle: "تم تفعيل الاشتراك",
      activatedBody: "خطتك نشطة الآن. تُحدَّث الحدود فورًا.",
      trialEndedTitle: "انتهت التجربة",
      trialEndedBody:
        "انتهت تجربتك المجانية. تحليل المناقصات غير متاح حتى تقوم بالترقية.",
      viewPlans: "عرض الخطط ←",
      currentPlanTitle: "الخطة الحالية",
      currentPlanBody: "حالة الاشتراك ودورة الفوترة",
      plan: "الخطة",
      status: "الحالة",
      provider: "مزوّد الدفع",
      billingCycle: "دورة الفوترة",
      renewal: "التجديد",
      paymentMethod: "طريقة الدفع",
      changePlan: "تغيير الخطة",
      upgradePlan: "ترقية الخطة",
      cancelSubscription: "إلغاء الاشتراك",
      cancelScheduled: "تم جدولة الإلغاء عند نهاية الفترة.",
      upgradesTitle: "ترقيات متاحة",
      upgradesBody: "{count} خطط ظاهرة مع بوابات دفع مفعّلة",
      upgradesBodyOne: "خطة واحدة ظاهرة مع بوابات دفع مفعّلة",
      openCheckout: "فتح الدفع ←",
      paymentHistory: "سجل المدفوعات",
      noPayments: "لا مدفوعات بعد.",
      invoices: "الفواتير",
      noInvoices: "لا فواتير بعد.",
      viewInvoice: "عرض",
      trialFallback: "تجربة",
      usageTitle: "استخدام مساحة العمل",
      trialUsageTitle: "استخدام التجربة",
      trialEndedDesc:
        "انتهت تجربتك المجانية — قم بالترقية لتحليل مزيد من المناقصات.",
      unlimitedDesc: "{plan} · تحليلات غير محدودة · {status}",
      remainingDesc: "{remaining} من {limit} تحليلات مجانية متبقية",
      trialEnds: "تنتهي التجربة في {date}",
      expired: "· منتهية",
      analysesUsed: "التحليلات المستخدمة",
      used: "المستخدم",
      remaining: "المتبقي",
      unlimited: "غير محدود",
      hoursSaved: "ساعات موفّرة تقديريًا",
      risksDetected: "المخاطر المكتشفة",
      upgradeContinue: "ترقية للمتابعة",
      runningLow: "الرصيد ينفد؟",
      seePlans: "اطّلع على الخطط",
      trialBadge: "تجربة مجانية لمدة 14 يومًا",
      trialEndsIn: "تنتهي تجربتك خلال {days} أيام",
      trialEndsInOne: "تنتهي تجربتك خلال يوم واحد",
      trialEndingToday: "تنتهي تجربتك اليوم",
      trialEndsOn: "تنتهي في {date}",
      noChargeToday: "لا رسوم اليوم.",
      paymentMethodRequired: "يلزم وسيلة دفع",
      trialAutoConvert:
        "يبدأ الاشتراك المحدد تلقائيًا بعد انتهاء التجربة ما لم تُلغِ قبل انتهائها.",
      cancelTrial: "إلغاء التجربة",
      cancelTrialTitle: "إلغاء التجربة؟",
      cancelTrialExplainConvert: "لن تتحول التجربة إلى اشتراك مدفوع.",
      cancelTrialExplainAccess: "بعد انتهاء التجربة يتبع الوصول قواعد مساحة العمل المجانية.",
      cancelTrialExplainData: "ستُحفظ بيانات الشركة.",
      cancelPaidTitle: "إلغاء الاشتراك؟",
      cancelPaidExplainDate: "يسري الإلغاء في {date}.",
      cancelPaidExplainAccess: "تحتفظ بالوصول حتى ذلك التاريخ.",
      cancelPaidExplainAfter:
        "بعد ذلك تنتقل المساحة إلى مساحة العمل المجانية. لا تُحذف المستندات أو الطلبات أو الأدلة أو السجل.",
      confirmCancel: "تأكيد الإلغاء",
      keepPlan: "الإبقاء على الخطة",
      cancellationDate: "تاريخ الإلغاء",
      accessUntil: "يبقى الوصول متاحًا حتى {date}.",
      freeWorkspace: "مساحة العمل المجانية",
      freeWorkspaceBody:
        "مساحة محدودة. تشمل ملف الشركة وامتثال المستندات المحدود. لا تشمل القدرات المدفوعة.",
      freeCapabilityProfile: "ملف الشركة",
      freeCapabilityCompliance: "امتثال المستندات (محدود)",
      nextBillingDate: "تاريخ الفوترة التالي",
      usage: "الاستخدام",
      paymentFailed: "فشل الدفع",
      pastDue: "متأخر",
      statusTrialing: "قيد التجربة",
      statusActive: "نشط",
      statusCanceled: "ملغى",
      statusUnpaid: "غير مدفوع",
      statusExpired: "منتهٍ",
      statusIncomplete: "غير مكتمل",
      monthlyInterval: "شهري",
      yearlyInterval: "سنوي",
      seatsUsage: "المقاعد",
      aiUsage: "استخدام الذكاء الاصطناعي",
      analysesUsage: "التحليلات",
      analysesNotIncluded: "غير مشمول",
      cancelError: "تعذّر الإلغاء الآن. أعد المحاولة أو تواصل مع الدعم.",
      started: "تاريخ البدء",
      paypalMethod: "PayPal",
      graceTitle: "مشكلة في الدفع — فترة سماح",
      graceBody: "فشل الدفع. يستمر الوصول حتى {date}. حدّث الفوترة لتجنب الانقطاع.",
      inactiveTitle: "الاشتراك غير نشط",
      inactiveBody:
        "اشتراكك غير نشط. بيانات الشركة محفوظة. جدّد أو رقِّ الخطة لاستعادة القدرات المدفوعة.",
      billingHistory: "سجل الفوترة",
      billingHistoryEmpty: "لا فواتير بعد. تظهر الفواتير هنا بعد عملية تحصيل ناجحة أو فاشلة.",
      invoiceDate: "التاريخ",
      invoiceAmount: "المبلغ",
      invoiceStatus: "الحالة",
      viewReceipt: "عرض الإيصال",
      updatePaymentMethod: "تحديث وسيلة الدفع",
      retryPayment: "معالجة الدفع",
      paymentProblemTitle: "مشكلة في الدفع",
      paymentProblemBody:
        "تعذّر تحصيل رسوم الاشتراك. حدّث وسيلة الدفع للحفاظ على الوصول.",
      paypalManageHint: "يدير PayPal وسيلة الدفع لهذا الاشتراك من حسابك في PayPal.",
      paymentPortalError: "تعذّر فتح صفحة الدفع الآمنة. أعد المحاولة أو تواصل مع الدعم.",
      canceledAlertTitle: "تم إلغاء اشتراكك",
      subscriptionEndedTitle: "انتهى اشتراكك",
      subscriptionEndedBody:
        "مساحة عملك آمنة، لكن بعض الميزات المميزة أصبحت مقفلة الآن.",
      choosePlan: "اختر خطة",
      graceDaysRemaining: "يتبقى لديك {days} أيام لحل مشكلة الدفع.",
      graceDaysRemainingOne: "يتبقى لديك يوم واحد لحل مشكلة الدفع.",
    },
    alerts: {
      title: "التنبيهات",
      subtitle: "المواعيد وذاكرة القرار والدرجات والمتطلبات وسير العمل.",
      emptyTitle: "لا تنبيهات بعد",
      emptyDescription: "ستظهر هنا إشعارات المواعيد والمخاطر والتحليل.",
      newBadge: "جديد",
      markAllRead: "تعليم الكل كمقروء",
      unreadCount: "{count} غير مقروء",
    },
    settings: {
      title: "الإعدادات",
      subtitle: "تفضيلات الحساب وإعدادات مساحة العمل الافتراضية.",
      accountTitle: "الحساب",
      accountBody: "المستخدم المسجّل",
      name: "الاسم",
      email: "البريد الإلكتروني",
      avatarLabel: "صورة الملف الشخصي",
      avatarHint: "تظهر في الشريط العلوي. JPG أو PNG أو WebP أو GIF · بحد أقصى 5 ميغابايت.",
      avatarUpload: "رفع صورة",
      avatarUploading: "جاري الرفع…",
      avatarRemove: "إزالة",
      accountSave: "حفظ التغييرات",
      accountSaving: "جاري الحفظ…",
      accountSaved: "تم تحديث الحساب.",
      emailChangeHint: "تغيير البريد يتطلب كلمة المرور ورابط تأكيد إلى العنوان الجديد.",
      emailChangePending: "تأكيد معلّق لـ {email}.",
      emailChangeSent: "تحقق من {email} لرابط التأكيد. يبقى بريدك الحالي نشطًا حتى تؤكد.",
      emailChangeResend: "إعادة إرسال التأكيد",
      emailChangeResent: "أُعيد إرسال التأكيد إلى {email}.",
      emailChangeExpires: "ينتهي {when}.",
      emailChangePasswordLabel: "كلمة المرور الحالية",
      emailChangePasswordHint: "مطلوبة لطلب تغيير البريد.",
      emailChangePasswordRequired: "أدخل كلمة المرور الحالية لتغيير البريد.",
      emailChangeCancel: "إلغاء تغيير البريد",
      emailChangeCancelled: "تم إلغاء تغيير البريد.",
      emailChangeInvalidTitle: "الرابط غير صالح أو منتهٍ",
      emailChangeInvalidBody: "اطلب رابط تأكيد جديد من الإعدادات.",
      emailChangeBackSettings: "العودة إلى الإعدادات",
      companyProfileTitle: "ملف الشركة",
      companyProfileBody:
        "القطاع والحجم والخدمات والبلد والخبرة المستخدمة لملاءمة الشركة–المناقصة في التحليلات القادمة. خاص بمنظمتك.",
      editCompanyProfile: "تعديل ملف الشركة",
      notificationsTitle: "الإشعارات",
      notificationsBody:
        "تنبيهات المواعيد والتحليل — داخل التطبيق والبريد. يمكن ربط واتساب / SMS / الدفع لاحقًا.",
      moduleRemindersTitle: "جداول تذكير الوحدات",
      moduleRemindersBody: "امتثال المستندات وتقويم المناقصات لهما إزاحات تذكير خاصة.",
      complianceRemindersLink: "تذكيرات امتثال المستندات",
      calendarRemindersLink: "تذكيرات تقويم المناقصات",
      planTitle: "الخطة",
      planUnlimited: "Business · غير محدود · {used} مستخدم",
      planLimited: "{used}/{limit} تحليلات مستخدمة",
      manageBilling: "إدارة الفوترة",
      viewUpgrade: "عرض خيارات الترقية",
      signOut: "تسجيل الخروج",
      revokeOtherSessions: "تسجيل الخروج من الأجهزة الأخرى",
      revokeOtherSessionsHint: "تبقى هذه الجلسة نشطة.",
      timezone: "المنطقة الزمنية للشركة",
      timezoneHint: "تُستخدم لنص تنبيهات الموعد وعرض الساعة المحلية.",
      channels: "القنوات",
      channelInApp: "تنبيهات داخل التطبيق",
      channelEmail: "البريد الإلكتروني",
      channelWhatsapp: "واتساب (قريبًا)",
      channelSms: "SMS (قريبًا)",
      channelPush: "دفع (قريبًا)",
      deadlineAlerts: "تنبيهات الموعد النهائي",
      deadline7d: "قبل 7 أيام",
      deadline3d: "قبل 3 أيام",
      deadline24h: "قبل 24 ساعة",
      deadlinePassed: "انتهى الموعد",
      otherAlerts: "تنبيهات أخرى",
      alertAnalysisDone: "اكتمل التحليل",
      alertHighRisk: "نتائج عالية المخاطر",
      alertMissingDocs: "مستندات ناقصة",
      alertScoreChange: "تغيّر الدرجة أو القرار",
      alertRequirementStatus: "تغيّر حالة المتطلبات",
      alertDecisionMemory: "ذاكرة قرار ذات صلة",
      alertWorkflow: "أحداث سير العمل / الحزمة",
      prefsSaved: "تم حفظ التفضيلات.",
      savePrefs: "حفظ تفضيلات الإشعارات",
    },
    tenders: {
      title: "المناقصات",
      subtitle: "{count} مناقصات · تصفية حسب القرار والمخاطر والموعد",
      subtitleOne: "مناقصة واحدة · تصفية حسب القرار والمخاطر والموعد",
      analyzeCta: "تحليل مناقصة",
      emptyTitle: "لا مناقصات بعد",
      emptyDescription:
        "ارفع ITT أو PQQ للحصول على توصية متوافق / يحتاج تحقق / غير متوافق.",
      search: "بحث",
      searchPlaceholder: "العنوان أو العميل",
      decision: "القرار",
      allDecisions: "كل القرارات",
      bid: "متوافق",
      review: "يحتاج تحقق",
      noBid: "غير متوافق",
      risk: "المخاطر",
      allRiskLevels: "كل مستويات المخاطر",
      low: "منخفض",
      medium: "متوسط",
      high: "مرتفع",
      critical: "حرج",
      deadline: "الموعد النهائي",
      anyDeadline: "أي موعد",
      next7d: "خلال 7 أيام",
      next14d: "خلال 14 يومًا",
      next30d: "خلال 30 يومًا",
      overdue: "متأخرة",
      sort: "ترتيب",
      sortRecent: "الأحدث تحليلًا",
      sortDeadlineSoon: "أقرب موعد",
      sortDeadlineLate: "أبعد موعد",
      sortFit: "درجة الملاءمة",
      sortTitle: "العنوان أ–ي",
      colTender: "المناقصة",
      colClient: "العميل",
      colDeadline: "الموعد",
      colFit: "الملاءمة",
      colDecision: "القرار",
      colRisk: "المخاطر",
      colAnalyzed: "تاريخ التحليل",
      colNextAction: "الإجراء التالي",
      deadlineWithDate: "الموعد {date}",
      fitWithScore: "الملاءمة {score}",
      noNextAction: "لا إجراء تالٍ",
    },
    upload: {
      title: "تحليل مناقصة",
      subtitle:
        "ارفع ITT أو PQQ للحصول على توصية متوافق / يحتاج تحقق / غير متوافق.",
      trialLeft: "تجربة · متبقٍ {remaining} تحليلات",
      trialEnds: " · تنتهي {date}",
      phaseIdleTitle: "ارفع حزمة مناقصة",
      phaseIdleBody:
        "ارفع عدة ملفات أو حزمة ZIP/RAR. نركّز على قرار المناقصة — وليس تفريغًا خامًا للمستند.",
      phaseUploadingTitle: "جارٍ الرفع…",
      phaseUploadingBody: "نقل آمن لملفاتك.",
      phaseDiscoveringTitle: "جارٍ اكتشاف الملفات…",
      phaseDiscoveringBody: "جرد كل مستند في حزمة المناقصة.",
      phaseExtractingTitle: "جارٍ استخراج الحزمة…",
      phaseExtractingBody: "فك ضغط ZIP/RAR واكتشاف مستندات المناقصة.",
      phasePreparingTitle: "جارٍ تجهيز المستندات…",
      phasePreparingBody: "التحقق من الملفات وتجهيز الحزمة للتحليل.",
      phaseProcessingTitle: "جارٍ معالجة المستند…",
      phaseProcessingBody: "في قائمة الانتظار للاستخراج وهيكلة المتطلبات.",
      phaseAnalyzingTitle: "جارٍ تحليل الملاءمة…",
      phaseAnalyzingBody:
        "مطابقة ملف الشركة وتشغيل القواعد وإنشاء القرار.",
      phaseSuccessTitle: "التحليل جاهز",
      phaseSuccessBody: "حزمة القرار متاحة.",
      phaseErrorTitle: "فشل الرفع",
      phaseErrorBody: "حدث خطأ أثناء الرفع أو تجهيز الحزمة. تحقق من الملفات وحاول مجددًا.",
      phaseAnalysisErrorTitle: "تعذّر إكمال التحليل",
      phaseAnalysisErrorBody:
        "تم رفع الحزمة وتجهيزها بنجاح. حدث الفشل أثناء التحليل — افتح المناقصة للتفاصيل.",
      phaseTimeoutBody:
        "الملفات الكبيرة قد تستغرق عدة دقائق. التحليل ما زال يعمل في الخلفية — افتح المناقصة عند الجاهزية.",
      phaseTimeoutTitle: "ما زال قيد المعالجة",
      stillWorking: "يستمر التحليل في الخلفية",
      openTender: "فتح المناقصة",
      trialUsedTitle: "استُنفدت تحليلات التجربة",
      trialUsedBody: "قم بالترقية لتحليل مزيد من المناقصات.",
      viewPlans: "عرض الخطط",
      unlimitedPlan: "تحليلات غير محدودة على خطة Business النشطة",
      remainingAnalyses: "{count} تحليلات مجانية متبقية",
      dragHere: "اسحب ملفات المناقصة أو حزم ZIP/RAR وأفلتها هنا",
      processingTender: "جارٍ معالجة حزمة المناقصة…",
      fileTypes: "PDF وWord وExcel وPowerPoint وCSV وTXT والصور وZIP/RAR · حتى {max} ملفًا لكل حزمة · بحد أقصى {maxFileMb}MB لكل ملف · و{maxPackageMb}MB لكل حزمة",
      chooseFile: "اختر ملفات",
      filesSelected: "{count} ملفات محددة",
      maxFilesReached: "حتى {max} ملفًا لكل حزمة.",
      filesDiscovered: "تم اكتشاف {count} ملفات في الحزمة",
      removeFile: "إزالة",
      statusReady: "جاهز",
      statusUploading: "جارٍ الرفع…",
      statusDiscovering: "جارٍ الاكتشاف…",
      statusExtracting: "جارٍ الاستخراج…",
      statusPreparing: "جارٍ التجهيز…",
      statusProcessing: "جارٍ المعالجة…",
      statusAnalyzing: "جارٍ التحليل…",
      startUpload: "رفع وبدء التحليل",
      waitForUpload: "انتظر انتهاء الرفع الحالي قبل إضافة المزيد من الملفات.",
      bodyTooLarge:
        "حزمة المناقصة أكبر من حد الطلب. قلّل عدد الملفات، أو أعد تشغيل التطبيق بعد رفع حد الحجم ثم ارفع مجددًا.",
      decisionReady: "القرار جاهز — افتح الحزمة أدناه.",
      unableContinue: "تعذّر المتابعة",
      openDecision: "فتح القرار",
      uploadAnother: "رفع ملف آخر",
      tryAgain: "حاول مجددًا",
      creditsExhausted: "استخدمت كل التحليلات المجانية. قم بالترقية للمتابعة.",
      passwordRequiredTitle: "كلمة المرور مطلوبة",
      passwordRequiredBody: "هذا الملف محمي بكلمة مرور. أدخل كلمة المرور للمتابعة.",
      passwordLabel: "كلمة مرور الأرشيف",
      passwordSubmit: "فتح ومتابعة",
      passwordCancel: "إلغاء",
      passwordWrong: "كلمة المرور غير صحيحة. حاول مرة أخرى.",
      intakeRepairedTitle: "تم الإصلاح تلقائيًا",
      intakePartialTitle: "قابل للقراءة جزئيًا",
      intakeIncompleteTitle: "الحزمة غير مكتملة",
      intakeReadyTitle: "جاهز للتحليل",
      intakeBlockedTitle: "التحليل محظور",
      intakeUnsupportedTitle: "تنسيق غير مدعوم",
      intakeCorruptedTitle: "ملف تالف",
      intakePartiallyReadableTitle: "قابل للقراءة جزئيًا2",
    },
    tenderDetail: {
      backToTenders: "← المناقصات",
      unknownClient: "عميل غير معروف",
      deadline: "الموعد النهائي",
      analyzed: "تم التحليل",
      fullReport: "التقرير الكامل",
      analysisInProgressTitle: "التحليل قيد التنفيذ",
      analysisInProgressBody:
        "الحالة: {status}. حدّث الصفحة بعد قليل — المعالجة جارية.",
      analysisFailedTitle: "فشل التحليل",
      analysisFailedBody:
        "انتهى المعالجة بفشل نهائي. راجع تفاصيل الخطأ أدناه.",
      analysisFailedPhase: "توقف عند المرحلة: {phase}",
      canonicalNote:
        "تحليل موحّد — نفس المتطلبات والامتثال والملاءمة والجاهزية والمخاطر ودرجة العرض والتوصية لكل مستخدم مخوّل. الأدوار تتحكم في الوصول فقط.",
      missingDocuments: "مستندات ناقصة",
      required: "إلزامي",
      nextActions: "الإجراءات التالية",
      noNextActions: "لا إجراءات موصى بها لهذا القرار.",
      teamWorkflow: {
        title: "سير عمل قرار الفريق",
        subtitle:
          "عيّن المتطلبات والمخاطر والأدلة الناقصة للمالية والقانوني والتقني وغيرها. ردود الفريق أدلة فقط — لا تغيّر Decision Engine تلقائيًا.",
        empty: "لا مهام فريق بعد.",
        criticalBanner: "{count} مهمة فريق حرجة غير محلولة قبل القرار النهائي.",
        assign: "تعيين",
        respond: "حفظ الرد",
        complete: "إكمال مع الرد",
        create: "إنشاء مهمة",
        responsePlaceholder: "أدخل ردًا موثّقًا (لا تختلق)…",
        evidencePlaceholder: "ملاحظة الدليل (اختياري)…",
        department: "القسم",
        assignee: "المُكلَّف",
        requiredResponse: "الرد المطلوب",
        linkedItem: "عنصر المناقصة المرتبط",
      },
      decisionSupport: "دعم القرار",
      fitSuffix: "ملاءمة",
      overallFit: "الملاءمة الإجمالية",
      confidence: "الثقة",
      confidenceHigh: "مرتفعة",
      confidenceMedium: "متوسطة",
      confidenceLow: "منخفضة",
      heroBidLabel: "بيدفراء توصي بالمتابعة",
      heroBidHint:
        "بناءً على المعلومات المتوفرة، تدعم الملاءمة بذل جهد العرض — مع التحقق قبل التقديم.",
      heroReviewLabel: "بيدفراء توصي بالمراجعة",
      heroReviewHint:
        "الغموض أو الفجوات أو المجهول يحتاج تأكيدًا بشريًا قبل الالتزام.",
      heroNoBidLabel: "بيدفراء توصي بعدم المتابعة",
      heroNoBidHint:
        "بناءً على البيانات المتاحة، فجوات حرجة تجعل جهد العرض غير مجدٍ — أكّد مع فريقك.",
      companyTenderFit: "ملاءمة الشركة–المناقصة",
      unknown: "غير معروف",
      basisAi: " · تقييم بالذكاء الاصطناعي",
      basisNotProvided: " · غير متوفر",
      basisFromProfile: " · من ملف الشركة",
      basisFromTender: " · من المناقصة",
      tenderReadiness: "جاهزية المناقصة",
      readinessCounts: "{ready} جاهز · {verify} تحقق · {missing} ناقص",
      recommendation: "التوصية:",
      keyBlockers: "عوائق رئيسية",
      keyBlockersNext:
        "الخطوة التالية الموصى بها: عالج المشكلات الموضّحة قبل اتخاذ قرار العرض النهائي.",
      whyTitle: "لماذا هذه التوصية؟",
      executiveSummary: "الملخص التنفيذي",
      viewDetails: "عرض التفاصيل",
      hideDetails: "إخفاء التفاصيل",
      topReasons: "الأسباب الرئيسية",
      criticalAlerts: "عناصر حرجة",
      whatToDoNext: "ماذا تفعل الآن",
      decisionDisclaimer:
        "يقدّم بيدفراء توصية مبنية على الأدلة. القرار النهائي يبقى لشركتكم.",
      expiredDeadlineAlert:
        "انتهى الموعد النهائي للتقديم — تأكّدوا مما إذا كانت المناقصة ما زالت مفتوحة.",
      mandatoryGapAlert: "فجوة إلزامية",
      missingDocumentAlert: "مستند ناقص",
      detailedAnalysisTitle: "تحليل مفصّل",
      detailedAnalysisHint:
        "المتطلبات والامتثال والأدلة والمخاطر والملاءمة وسير العمل — نفس البيانات الموحّدة كما في التقرير.",
    },
    report: {
      backToTender: "← المناقصة",
      title: "تقرير التحليل",
      subtitle:
        "حزمة القرار الكاملة — عرض، طباعة، تنزيل PDF، أو مشاركة رابط للقراءة فقط.",
      reportNotReady: "التقرير غير جاهز",
      reportNotReadyBody: "التقرير غير جاهز للعرض بعد. يرجى المحاولة لاحقًا.",
      print: "طباعة",
      downloadPdf: "تنزيل PDF",
      shareLink: "مشاركة الرابط",
      copied: "تم النسخ.",
      shareExpires: "ينتهي خلال 72 ساعة · للقراءة فقط:",
      revokeShare: "إلغاء الروابط المشتركة",
      shareRevoked: "تم إلغاء الروابط المشتركة.",
      reportEyebrow: "تقرير قرار بيدفراء",
      unknownClient: "عميل غير معروف",
      deadline: "الموعد النهائي",
      analyzed: "تم التحليل",
      recommendation: "التوصية",
      companyTenderFit: "ملاءمة الشركة–المناقصة",
      confidence: "الثقة",
      whyTitle: "لماذا هذه التوصية",
      bidScore: "درجة العرض",
      bidScoreLine: "درجة العرض: {score}/100 — {priority}",
      expectedValue: "القيمة المتوقعة:",
      risk: "المخاطر:",
      effort: "الجهد:",
      positive: "إيجابي",
      negative: "سلبي",
      overall: "الإجمالي",
      unknown: "غير معروف",
      tenderReadiness: "جاهزية المناقصة",
      readinessCounts: "{ready} جاهز · {verify} تحقق · {missing} ناقص",
      nextStep: "الخطوة التالية:",
      complianceMatrix: "مصفوفة الامتثال",
      requirements: "المتطلبات",
      ready: "جاهز",
      missing: "ناقص",
      verify: "تحقق",
      notApplicable: "غير منطبق",
      withSources: "مع مصادر",
      mandatory: "إلزامي",
      optional: "اختياري",
      evidenceLabel: "الدليل:",
      noExcerpt: "لا يتوفر مقتطف داعم.",
      page: "صفحة {n}",
      sourceNotLocated: "تعذّر تحديد المصدر بدقة.",
      noRequirements: "لم تُستخرج متطلبات لهذه المناقصة.",
      missingRequirements: "المتطلبات الناقصة",
      noMissingRequirements: "لم تُحدَّد متطلبات ناقصة.",
      mandatoryParen: " (إلزامي)",
      verificationItems: "بنود التحقق",
      nothingPendingVerify: "لا يوجد ما ينتظر التحقق.",
      risks: "المخاطر",
      noRisks: "لم تُشر إلى مخاطر جوهرية.",
      clarifications: "أسئلة التوضيح",
      noClarifications:
        "لم تُنشأ أسئلة توضيح — لم تُكتشف أي غموض ذي معنى.",
      reason: "السبب:",
      source: "المصدر:",
      evidence: "الأدلة",
      noEvidence: "لا تتوفر مقتطفات من المصدر.",
      historicalTitle: "ذكاء تاريخي ذو صلة",
      historicalBody:
        "قد توفر نتائج تاريخية مشابهة إشارة مفيدة لهذه الفرصة. هذه إشارة إضافية — وليست ضمانًا للنجاح أو الفشل.",
      historicalPriority:
        "أدلة المناقصة الحالية وملف شركتك لهما الأولوية دائمًا.",
      historicalEmpty: "لا ينطبق بعد أي نمط تاريخي موثّق على هذه الفرصة.",
      decisionMemoryTitle: "ذاكرة القرار",
      currentAnalysisLabel: "التحليل الحالي",
      historicalDecisionLabel: "قرار تاريخي",
      decisionMemoryCurrentNote:
        "الدرجات والمتطلبات والتوصية أعلاه هي المرجع لهذه المناقصة ولا تتغيّر بسبب السجل التاريخي.",
      decisionMemoryEmpty: "لا توجد قرارات سابقة ذات صلة بهذه الفرصة بعد.",
      relevanceReasons: "سبب الصلة",
      missingDocuments: "المستندات الناقصة",
      nextActions: "الإجراءات التالية الموصى بها",
      noNextActions: "لا توجد إجراءات موصى بها.",
      basisDirect: "مصدر مباشر",
      basisAi: "تفسير بالذكاء الاصطناعي",
      basisUncertain: "مصدر غير مؤكد",
      evidenceVerificationTitle: "الأدلة والتحقق",
      evidenceVerificationDisclaimer:
        "يعكس التحقق الأدلة المسجلة والمراجعة البشرية فقط. لا تُعامل تفسيرات الذكاء الاصطناعي كمُحققة أبداً.",
      verificationSummary:
        "{verified} مُحقق · {needs} يحتاج تحقق · {missing} أدلة مفقودة · {na} غير قابل للتطبيق",
      noVerificationChains: "لا توجد سلاسل تحقق متاحة لهذه المناقصة.",
      verificationStatusVerified: "مُحقق",
      verificationStatusNeedsVerification: "يحتاج تحقق",
      verificationStatusMissingEvidence: "أدلة مفقودة",
      verificationStatusNotApplicable: "غير قابل للتطبيق",
      verifierLabel: "المُحقق:",
      verifiedAtLabel: "تاريخ التحقق:",
      decisionOutcomeTitle: "نتيجة القرار",
      decisionOutcomeBidvera: "قرار Bidvera",
      decisionOutcomeHuman: "القرار البشري النهائي",
      decisionOutcomeActual: "النتيجة الفعلية",
      decisionOutcomeDate: "تاريخ النتيجة",
      decisionOutcomeReason: "سبب النتيجة",
      decisionOutcomeSuccess: "القرار مقابل النتيجة",
      decisionOutcomeSuccessAligned: "القرار الأصلي متوافق مع النتيجة",
      decisionOutcomeSuccessMisaligned: "القرار الأصلي غير متوافق مع النتيجة",
      decisionOutcomeSuccessPending: "النتيجة لا تزال معلقة",
      decisionOutcomeSuccessNeutral: "محايد بالنسبة للقرار الأصلي",
      decisionOutcomeRecorded: "نتيجة مسجلة",
      outcomeLearningTitle: "الذكاء التاريخي القائم على النتائج",
      decisionOutcomeAttachment: "مستند داعم",
      decisionOutcomeEvalSuccessful: "ناجح",
      decisionOutcomeEvalUnsuccessful: "غير ناجح",
      decisionOutcomeEvalNotEvaluated: "غير مقيّم",
    },
    decisionMemory: {
      title: "ذاكرة القرار",
      subtitle:
        "قرارات المناقصات السابقة لشركتك — للمرجع فقط. لا تغيّر التحليل الحالي أبدًا.",
      emptyTitle: "لا قرارات مخزّنة بعد",
      emptyDescription:
        "تظهر التحليلات المكتملة هنا تلقائيًا. افتح مناقصة لمقارنة التحليل الحالي بالقرار التاريخي.",
      emptyDescriptionCompanyContext:
        "تظهر القرارات المخزّنة هنا عندما يسجّل ذكاء القرار نتيجة لشركتك. أبقِ المؤهلات والأدلة محدّثة حتى تحظى القرارات المستقبلية بسياق شركة قوي.",
      viewTender: "فتح المناقصة",
      openCompanyProfile: "فتح ملف الشركة",
      analyzed: "تم التحليل",
      scores: "الدرجات",
      requirements: "المتطلبات",
      risks: "المخاطر",
      reasoning: "المبررات",
      relevance: "الصلة",
      disclaimer:
        "قرار تاريخي — للمرجع فقط. لا يغيّر درجات التحليل الحالي أو التوصية.",
      back: "العودة إلى ذاكرة القرار",
    },
    pwa: {
      availableOn: "متاح على Windows و macOS",
      updateTitle: "تحديث التطبيق جاهز",
      updateBody: "يتوفر إصدار أحدث من بيدفراء لسطح المكتب. أعد التحميل للتطبيق.",
      updateNow: "حدّث الآن",
      installedTitle: "تم تثبيت بيدفراء",
      installedBody:
        "أنت في وضع تطبيق سطح المكتب — وصول أسرع من الشريط أو شريط المهام.",
      title: "ثبّت بيدفراء كتطبيق سطح مكتب",
      bodyBefore: "يعمل على",
      bodyAnd: "و",
      bodyAfter: "— يفتح في نافذته الخاصة دون متجر تطبيقات.",
      installCta: "تثبيت بيدفراء",
      openingInstaller: "جارٍ فتح المثبّت…",
      dismiss: "إغلاق",
      guideTitleSafari: "تثبيت بيدفراء في Safari",
      guideTitleEdge: "تثبيت بيدفراء في Edge",
      guideTitleChrome: "تثبيت بيدفراء في Chrome",
      guideTitleDefault: "تثبيت بيدفراء",
      guideDescription: "اتبع هذه الخطوات لإضافة بيدفراء كتطبيق سطح مكتب.",
      desktopMeta: "تطبيق سطح مكتب · Windows و macOS",
      openInstallDialog: "فتح نافذة التثبيت",
      gotIt: "حسنًا",
      iosStep1: "اضغط زر المشاركة في Safari.",
      iosStep2: "اختر",
      iosStep2Strong: "إضافة إلى الشاشة الرئيسية",
      iosStep3: "أكّد — تفتح بيدفراء بملء الشاشة من الشاشة الرئيسية.",
      safariMacStep1: "من شريط القوائم افتح",
      safariMacStep1Strong: "ملف",
      safariMacStep2: "اختر",
      safariMacStep2Strong: "إضافة إلى Dock",
      safariMacStep3: "أكّد — تظهر بيدفراء في Dock كتطبيق Mac.",
      chromiumStep1Before: "انظر إلى يمين شريط عنوان {browser} لأيقونة",
      chromiumStep1Strong: "تثبيت / جهاز",
      chromiumStep1After: ".",
      chromiumStep2Before: "انقر ثم اختر",
      chromiumStep2Strong: "تثبيت",
      chromiumStep3Before: "أو افتح قائمة المتصفح ←",
      chromiumStep3Install: "تثبيت بيدفراء",
      chromiumStep3Mid: "/",
      chromiumStep3Apps: "التطبيقات ← تثبيت هذا الموقع كتطبيق",
    },
  },
};

const fr: Dictionary = {
  nav: {
    product: "Produit",
    pricing: "Tarifs",
    faq: "FAQ",
    solutions: "Solutions",
    resources: "Ressources",
    signIn: "Connexion",
    startFree: "Commencer gratuitement",
    app: "App",
    language: "Langue",
  },
  brand: {
    tagline: "Sachez quoi poursuivre. Sachez pour quoi vous êtes prêts.",
    description:
      "Bidvera aide les entreprises à comprendre leur préparation, gérer conformité et qualifications, organiser les preuves, évaluer des opportunités pertinentes et prendre des décisions explicables.",
  },
  landing: {
    headline: "Sachez quoi poursuivre. Sachez pour quoi vous êtes prêts.",
    subhead:
      "Bidvera aide les équipes à comprendre la préparation de l’entreprise, gérer conformité et qualifications, organiser les preuves, évaluer le travail pertinent et transformer des décisions explicables en prochaines actions claires.",
    ctaPrimary: "Explorer Bidvera",
    ctaSecondary: "Voir le fonctionnement",
    trialNote: "Préparation · Opportunités · Preuves · Décisions · Action",
    previewLabel: "Intelligence de décision",
    previewQuestion: "PRÊT À POURSUIVRE ?",
    previewDecision: "REVIEW",
    previewFit: "Bon alignement de préparation",
    previewRisk: "Preuves vérifiées",
    previewRiskValue: "3 exigences confirmées",
    previewMissing: "À traiter",
    previewMissingValue: "1 élément de qualification à vérifier",
    previewNext: "Prochaine action",
    previewNextValue: "Confirmer les preuves restantes",
    previewWhy:
      "La qualification paraît solide. Un élément doit encore être vérifié avant que l’équipe s’engage.",
    sectionTitle: "Pourquoi les entreprises utilisent Bidvera",
    sectionBody:
      "Au lieu de reconstruire la préparation depuis dossiers, e-mails et tableurs, Bidvera offre un espace structuré pour l’information d’entreprise, les preuves, les décisions et le suivi.",
    feature1Title: "Connaître votre préparation",
    feature1Body:
      "Gardez à jour les informations d’entreprise, les qualifications et les preuves de conformité.",
    feature2Title: "Organiser le travail pertinent",
    feature2Body:
      "Capturez les demandes clients et les échéances du calendrier, puis évaluez les exigences face à ce que vous pouvez réellement livrer.",
    feature3Title: "Agir en confiance",
    feature3Body:
      "Prenez des décisions explicables, assignez les prochaines actions et alignez l’équipe.",
    capabilitiesTitle: "Huit capacités pour la préparation, les opportunités et l’action",
    capabilitiesLearnMore: "En savoir plus",
    capabilitiesShowLess: "Réduire",
    capabilities: [
      {
        title: "Profil d’entreprise",
        body: "Gardez identité, services et préparation de l’entreprise dans un seul espace.",
        detail:
          "Capturez secteur, services, géographie et taille pour une vue partagée de l’offre. Cette base soutient qualification, preuves et revue d’opportunités.",
      },
      {
        title: "Conformité documentaire",
        body: "Suivez les documents critiques et les dates d’expiration avant qu’ils ne bloquent.",
        detail:
          "Stockez licences, certificats et assurances dans un espace sécurisé, surveillez la validité et voyez ce qui demande attention avant expiration.",
      },
      {
        title: "Qualification fournisseur",
        body: "Montrez ce que votre entreprise est qualifiée à livrer — et où restent des écarts.",
        detail:
          "Maintenez qualifications, couverture et preuves pour voir la préparation avant d’investir du temps sur une demande.",
      },
      {
        title: "Demandes clients",
        body: "Centralisez les demandes d’information et de documents de l’acheteur dans un dossier clair.",
        detail:
          "Capturez les demandes entrantes, liez les preuves existantes, suivez l’avancement et partagez un dossier sécurisé.",
      },
      {
        title: "Calendrier des appels d’offres",
        body: "Gardez visibles échéances, jalons et rappels pour les opportunités suivies.",
        detail:
          "Organisez les dates clés et rappels pour réduire les oublis de soumission, avec une chronologie partagée pour l’équipe.",
      },
      {
        title: "Assistant questionnaires",
        body: "Structurez les questions et rédigez des réponses fondées sur des preuves avec étapes de vérification.",
        detail:
          "Détectez et organisez le contenu du questionnaire, rédigez des brouillons basés sur les preuves disponibles et signalez ce qui nécessite encore une vérification humaine.",
      },
      {
        title: "Moteur de décision",
        body: "Aboutissez à BID, REVIEW ou NO-BID explicables à partir de la préparation, de la qualification et des preuves.",
        detail:
          "Combinez les signaux de préparation avec le contexte des exigences et des preuves. La mémoire et le simulateur de décision soutiennent le jugement — ils ne remplacent pas la responsabilité de l’équipe.",
      },
      {
        title: "Workflow de décision d’équipe",
        body: "Transformez une décision en prochaines étapes assignées, vérifications et alertes exécutables.",
        detail:
          "Créez des tâches, joignez des preuves, fermez la boucle de vérification et utilisez alertes intelligentes et plan d’action selon le plan.",
      },
    ],
    smartMatch: {
      eyebrow: "Smart Match Engine",
      title: "Voyez quelles opportunités correspondent au profil de votre entreprise",
      body: "Smart Match Engine compare les signaux d’opportunité au profil de votre entreprise pour prioriser la revue — au lieu de traiter chaque piste de la même façon.",
      benefit1: "Faites remonter les opportunités alignées sur services, secteur et géographie.",
      benefit2: "Utilisez qualifications, expérience et taille comme dimensions structurées.",
      benefit3: "Examinez les explications d’adéquation avant d’engager le temps de l’équipe.",
      dimensionsLabel: "Dimensions de correspondance",
      dimensions: [
        "Services",
        "Secteur",
        "Géographie",
        "Qualifications",
        "Expérience",
        "Taille d’entreprise",
      ],
      note: "Les scores guident l’exploration et la revue. Ils ne garantissent ni éligibilité, ni couverture de tout le marché, ni attribution de contrats. L’accès dépend de la configuration de l’espace de travail.",
      ctaPrimary: "Créer le profil de votre entreprise",
      ctaSecondary: "Comment fonctionne Bidvera",
    },
    bottomTitle: "Réunissez préparation, opportunités et décisions dans un seul espace",
    bottomBody:
      "Organisez ce que l’entreprise a, vérifiez ce qui peut être prouvé, évaluez ce qui est pertinent et décidez quoi poursuivre — avec l’équipe.",
    bottomCta: "Explorer Bidvera",
    howTitle: "Comment ça fonctionne",
    howBody: "De la préparation de l’entreprise à une action confiante.",
    step1Title: "Comprendre",
    step1Body:
      "Construisez une image claire de l’entreprise, des documents, des qualifications et de la préparation.",
    step2Title: "Organiser",
    step2Body:
      "Utilisez les demandes clients pour capturer le travail entrant, puis gardez les dates clés sur le calendrier.",
    step3Title: "Vérifier",
    step3Body:
      "Comparez les exigences au profil, aux documents, aux qualifications et aux preuves.",
    step4Title: "Décider et agir",
    step4Body:
      "Aboutissez à une décision explicable, puis avancez via le workflow d’équipe, les alertes et un plan d’action clair.",
    beforeAfterTitle: "D’informations dispersées à une action confiante",
    beforeAfterBody:
      "Arrêtez de reconstituer documents, qualifications et opportunités depuis des endroits différents. Bidvera réunit préparation, preuves et décisions.",
    beforeLabel: "Sans un workflow Bidvera structuré",
    afterLabel: "Avec Bidvera",
    beforeItems: [
      "Documents, qualifications et preuves dispersés dans dossiers et boîtes mail",
      "Peu clair quelles demandes vous êtes réellement prêts à poursuivre",
      "Revue manuelle sans piste de preuve partagée",
      "Décisions sans propriété claire des prochaines actions",
    ],
    afterItems: [
      "Un espace pour l’intelligence d’entreprise, la préparation et les preuves vérifiées",
      "Travail entrant organisé face à la capacité réelle",
      "BID / REVIEW / NO-BID explicables, avec le raisonnement derrière",
      "Prochaines actions assignées, alertes et un plan exécutable par l’équipe",
    ],
    complianceEyebrow: "Conformité documentaire",
    complianceHeadline: "Gardez votre entreprise prête, en permanence.",
    complianceBody:
      "Organisez les documents critiques, suivez les dates d’expiration et maîtrisez les exigences de conformité depuis un espace sécurisé.",
    complianceBenefit1Title: "Restez organisé",
    complianceBenefit1Body: "Tous les documents d’entreprise dans un espace sécurisé.",
    complianceBenefit2Title: "Suivez les expirations",
    complianceBenefit2Body: "Voyez ce qui est valide et ce qui demande attention avant expiration.",
    complianceBenefit3Title: "Prêt pour les exigences",
    complianceBenefit3Body: "Sachez quels documents soutiennent la prochaine exigence.",
    compliancePanelTitle: "Documents d’entreprise",
    complianceAddLabel: "Ajouter un document",
    complianceAlertTitle: "L’assurance expire bientôt",
    complianceReadyLabel: "Vous êtes prêts",
    complianceReadyHint: "Les documents clés sont suivis dans un seul espace.",
    complianceStatusValid: "Valide",
    complianceStatusExpiring: "Expire bientôt",
    complianceDocTrade: "Licence commerciale",
    complianceDocTax: "Attestation fiscale",
    complianceDocInsurance: "Assurance",
    complianceDocQuality: "Certificat qualité",
    complianceDocFinancial: "États financiers",
    complianceDateTrade: "Valide jusqu’au 31 déc. 2026",
    complianceDateTax: "Valide jusqu’au 15 oct. 2026",
    complianceDateInsurance: "Expire le 28 nov. 2026",
    complianceDateQuality: "Valide jusqu’au 1 août 2027",
    complianceDateFinancial: "Valide jusqu’au 10 fév. 2027",
    pricingTeaserTitle: "Tarifs simples pour les équipes en croissance",
    pricingTeaserBody:
      "Commencez gratuitement. Passez à un plan supérieur quand Bidvera fait gagner du temps réel — dès {price}/mois sur Pro.",
    pricingTeaserCta: "Comparer les plans",
    viewAllFaq: "Voir toute la FAQ →",
    testimonialsTitle: "Ce que disent les équipes",
    testimonialsBody:
      "Retours réels d’équipes qui utilisent Bidvera pour rester prêtes et décider en confiance.",
    testimonialsEmptyTitle: "Retours des premiers clients",
    testimonialsEmptyBody:
      "Nous publions uniquement de vrais témoignages. Soyez parmi les premières équipes à réunir préparation, preuves et décisions — puis dites-nous comment cela s’est passé.",
    testimonialsEmptyCta: "Explorer Bidvera",
  },
  product: {
    eyebrow: "Produit",
    title: "Intelligence d’entreprise. Préparation. Décisions explicables.",
    body: "Bidvera n’est pas un résumeur PDF générique. C’est un espace de travail pour la préparation, la conformité, la qualification, les preuves, l’intelligence d’opportunités et les décisions explicables. SOUMISSIONNER / REVOIR / NE PAS SOUMISSIONNER est un résultat du moteur de décision — pas le produit entier.",
    step1Title: "Comprendre l’entreprise",
    step1Body:
      "Construisez une vision vivante du profil, des documents, des qualifications et de la préparation.",
    step2Title: "Organiser ce qui est pertinent",
    step2Body:
      "Utilisez les demandes clients pour capturer le travail aligné sur ce que votre entreprise peut réellement livrer, et gardez les échéances au calendrier.",
    step3Title: "Vérifier, décider et agir",
    step3Body:
      "Analysez les exigences qui comptent, reliez les preuves, prenez des décisions SOUMISSIONNER / REVOIR / NE PAS SOUMISSIONNER explicables, et transformez-les en prochaines actions avec l’équipe.",
    seeTitle: "Ce avec quoi votre équipe travaille",
    seeItems: [
      "Profil entreprise, conformité documentaire et qualification fournisseur",
      "Demandes clients et calendrier des échéances",
      "Intelligence de preuves avec vérification sourcée",
      "Résultats du moteur de décision : SOUMISSIONNER / REVOIR / NE PAS",
      "Justification explicable, mémoire et simulateur de décision",
      "Analyse d’AO comme une étape du flux",
      "Assistant questionnaires et export PDF",
      "Flux d’équipe, plan d’action et alertes intelligentes",
    ],
    cta: "Explorer Bidvera",
    futureTitle: "Capacités actives dans un seul espace",
    futureBody:
      "Bidvera couvre déjà le socle entreprise, l’intelligence d’opportunités, les preuves, les décisions et l’action d’équipe.",
    highlightItems: [
      "Profil entreprise",
      "Conformité documentaire",
      "Demandes clients",
      "Intelligence de preuves",
      "Moteur de décision",
      "Analyse d’AO",
      "Flux de décision d’équipe",
      "Confiance et sécurité IA",
    ],
  },
  pricing: {
    eyebrow: "Tarifs",
    title: "Un espace pour la préparation, les opportunités et l’action",
    body: "Commencez par un Free Workspace limité, ou essayez une offre pendant 14 jours. Les prix viennent des plans Bidvera en vigueur.",
    perMonth: "/mois",
    perMonthYearly: "/mois facturé à l’année",
    analysesSeats: "{analyses} analyses / mois · {seats} sièges",
    seatsOnly: "{seats} sièges",
    startFree: "Commencer gratuitement",
    startFreeWorkspace: "Démarrer Free Workspace",
    startTrial: "Démarrer l’essai de 14 jours",
    startSubscription: "Démarrer l’abonnement",
    choose: "Choisir {plan}",
    monthly: "Mensuel",
    yearly: "Annuel",
    save: "Économisez ~17%",
    recommended: "Le plus choisi",
    mostPopular: "Idéal pour les équipes en croissance",
    trialBadge: "Essai gratuit de 14 jours",
    noChargeToday: "Aucun prélèvement aujourd’hui",
    paymentMethodRequired: "Moyen de paiement requis",
    cancelBeforeTrial: "Annulez avant la fin de l’essai pour éviter le prélèvement.",
    freeHeadline: "Commencez gratuitement. Construisez l’espace de votre entreprise.",
    freeLimitedNote: "Espace limité — profil entreprise et conformité documentaire uniquement.",
    comparisonTitle: "Comparer les offres",
    comparisonFeature: "Capacité",
    yearlyNote: "Les totaux annuels utilisent le prix configuré de chaque offre. Le paiement utilise l’intervalle choisi.",
    valueTitle1: "Un espace d’intelligence d’entreprise",
    valueBody1:
      "Organisez informations, conformité, qualifications, preuves et demandes au même endroit, puis agissez avec l’équipe.",
    valueTitle2: "Des limites claires, sans usage caché",
    valueBody2: "Sièges et limites d’usage sont affichés sur chaque offre. Ce que vous voyez est inclus.",
    valueTitle3: "Essayez une offre, puis décidez",
    valueBody3:
      "Les offres éligibles incluent 14 jours d’essai avec un moyen de paiement. Annulez avant la fin si vous ne souhaitez pas démarrer l’abonnement.",
    ctaTitle: "Prêts à garder l’entreprise préparée ?",
    ctaBody: "Commencez par Free Workspace, ou choisissez une offre et essayez Bidvera 14 jours.",
    groups: {
      readiness: "Préparation de l’entreprise",
      opportunities: "Opportunités et demandes",
      intelligence: "Intelligence et décisions",
      workflow: "IA et flux de travail",
    },
    features: {
      company_profile: "Profil entreprise",
      document_compliance: "Conformité documentaire",
      supplier_qualification: "Qualification fournisseur",
      client_requests: "Demandes clients",
      tender_calendar: "Calendrier",
      evidence_intelligence: "Intelligence de preuves",
      advanced_decision_engine: "Moteur de décision",
      decision_memory: "Mémoire de décision",
      decision_simulator: "Simulateur de décision",
      explainable_decision: "Décision explicable",
      tender_analysis: "Analyse d’appels d’offres",
      questionnaire_assistant: "Assistant questionnaires",
      smart_alerts: "Alertes intelligentes",
      team_collaboration: "Flux de décision d’équipe",
      pdf_export: "Export PDF",
      tender_action_plan: "Plan d’action",
    },
  },
  faq: {
    eyebrow: "FAQ",
    title: "Des réponses claires",
    items: [
      {
        q: "Qu’est-ce que Bidvera ?",
        a: "Bidvera est un espace de travail d’intelligence d’entreprise qui aide les sociétés à organiser leurs informations, gérer la conformité, évaluer des opportunités pertinentes, travailler avec les preuves et agir en confiance.",
      },
      {
        q: "Comment Bidvera aide-t-il à maintenir mon entreprise prête ?",
        a: "Bidvera rassemble le profil entreprise, les qualifications et les documents clés pour que votre équipe maintienne une base métier fiable et à jour.",
      },
      {
        q: "Comment fonctionne Document Compliance ?",
        a: "Suivez les documents importants, surveillez les dates d’expiration et recevez des alertes lorsqu’une attention est nécessaire, pour garder votre entreprise préparée.",
      },
      {
        q: "Comment Bidvera aide-t-il avec les opportunités et demandes clients ?",
        a: "Les équipes peuvent capturer les demandes clients, suivre les échéances au calendrier, et évaluer les exigences par rapport au profil, aux capacités et aux qualifications.",
      },
      {
        q: "Bidvera peut-il aider avec les demandes clients et les questionnaires ?",
        a: "Oui. Les équipes peuvent gérer les demandes clients et utiliser le Questionnaire Assistant pour organiser et répondre aux informations requises plus efficacement.",
      },
      {
        q: "Comment Bidvera utilise-t-il les preuves ?",
        a: "Evidence Intelligence relie les informations d’entreprise, les qualifications et les preuves à l’appui pour que les équipes comprennent ce qui est vérifié, ce qui nécessite attention et pourquoi.",
      },
      {
        q: "Mon équipe peut-elle collaborer dans Bidvera ?",
        a: "Oui. Team Decision Workflow aide les membres à travailler ensemble, assigner les responsabilités, examiner les informations et coordonner les prochaines actions dans un seul espace.",
      },
      {
        q: "Bidvera est-il sécurisé ?",
        a: "Bidvera est conçu avec un accès contrôlé, l’isolation des locataires et des protections de sécurité pour que l’espace et les informations de chaque entreprise restent séparés.",
      },
      {
        q: "Puis-je essayer Bidvera avant de m’abonner ?",
        a: "Oui. Vous pouvez commencer avec l’essai gratuit disponible et explorer la plateforme avant de choisir un abonnement.",
      },
    ],
  },
  auth: {
    loginTitle: "Connexion",
    loginBody: "Accédez à l’espace Bidvera de votre entreprise.",
    emailChangedNotice:
      "Votre e-mail a été mis à jour. Connectez-vous avec la nouvelle adresse. Les autres sessions ont été fermées.",
    sideHeadline: "Sachez quoi poursuivre. Sachez pour quoi vous êtes prêts.",
    sideBody:
      "Bidvera aide votre équipe à organiser la préparation, vérifier les preuves, évaluer des opportunités et décider en confiance.",
    sidePillMatched: "CORRESPONDANCE — Une opportunité adaptée a été trouvée pour l’entreprise.",
    sidePillReview: "REVUE — Examinez les détails de l’opportunité et sa pertinence.",
    sidePillNotAMatch: "PAS DE CORRESPONDANCE — L’opportunité ne correspond pas au profil de l’entreprise.",
    signupTitle: "Créez votre compte Bidvera",
    signupBody: "Email et mot de passe d’abord. L’entreprise ensuite.",
    name: "Votre nom",
    companyName: "Nom de l’entreprise",
    email: "Email professionnel",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    submitLogin: "Connexion",
    submitSignup: "Créer un compte",
    haveAccount: "Vous avez déjà un compte ?",
    newHere: "Nouveau sur Bidvera ?",
    acceptTerms: "J’accepte les Conditions et la Politique de confidentialité.",
    acceptTermsError: "Vous devez accepter les Conditions et la Politique.",
    continueGoogle: "Continuer avec Google",
    googleComingSoon: "Connexion Google bientôt disponible",
    continueMicrosoft: "Continuer avec Microsoft",
    microsoftComingSoon: "Connexion Microsoft bientôt disponible",
    forgotPassword: "Mot de passe oublié ?",
    forgotTitle: "Réinitialiser le mot de passe",
    forgotBody: "Nous enverrons un lien unique si le compte existe.",
    forgotSubmit: "Envoyer le lien",
    forgotSent: "Si l’email est enregistré, le lien est en route.",
    resetTitle: "Choisissez un nouveau mot de passe",
    resetBody: "Au moins 12 caractères.",
    resetSubmit: "Mettre à jour",
    passwordMismatch: "Les mots de passe ne correspondent pas.",
  },
  assistant: {
    askLabel: "Demander à Bidvera",
    title: "Assistant Bidvera AI",
    description:
      "Posez des questions sur Bidvera, la préparation, les opportunités, les preuves ou les prochaines étapes. Réponses Bidvera AI ; voix via TTS sécurisé.",
    placeholder: "Posez une question…",
    send: "Envoyer",
    thinking: "Réflexion…",
    play: "Lecture",
    pause: "Pause",
    mute: "Muet",
    unmute: "Son",
    voiceUnavailable: "La voix est indisponible. Vous pouvez lire la réponse.",
    errorGeneric: "Impossible d’obtenir une réponse. Réessayez.",
    attachImage: "Joindre une image",
    removeImage: "Retirer l’image",
    imageOnlyOne: "Une seule image est autorisée.",
    imageTooLarge: "Image trop volumineuse (max. 4 Mo).",
    imageInvalid: "Utilisez JPEG, PNG, WebP ou GIF.",
    imageQuotaReached: "Envoi d’images verrouillé — 1 image / 4 h pour ce navigateur et cette adresse.",
    replyQuotaReached: "Envoi verrouillé — 10 réponses utilisées (réinitialisation dans 4 h).",
  },
  app: {
    nav: {
      dashboard: "Tableau de bord",
      tenders: "Analyse d’AO",
      tenderCalendar: "Calendrier des AO",
      documentCompliance: "Conformité documentaire",
      supplierQualification: "Qualification fournisseur",
      clientRequests: "Demandes clients",
      questionnaireAssistant: "Assistant questionnaires",
      matchedOpportunities: "Opportunités correspondantes",
      company: "Profil entreprise",
      billing: "Facturation",
      alerts: "Alertes",
      settings: "Paramètres",
      decisionMemory: "Mémoire de décision",
      teamWorkflow: "Flux d’équipe",
      sectionCapabilities: "Capacités",
      sectionWorkspace: "Espace de travail",
      sectionAccount: "Compte",
    },
    shell: {
      tagline: "Vérifiez avant de soumissionner.",
      analyzeTender: "Analyser un AO",
      upgrade: "Passer au plan supérieur",
      signOut: "Se déconnecter",
      openMenu: "Ouvrir le menu",
      closeMenu: "Fermer le menu",
      decisionWorkspace: "Espace Bidvera",
      yourCompany: "Votre entreprise",
      workspace: "Espace de travail",
    },
    dashboard: {
      eyebrow: "Vue exécutive",
      title: "Tableau de bord",
      subtitle:
        "Que faire ensuite, quels AO valent la peine d’être poursuivis, et ce qui vous bloque.",
      analyzeCta: "Analyser un AO",
      activeTenders: "AO actifs",
      inPipeline: "En pipeline",
      bid: "Soumissionner",
      pursue: "Poursuivre",
      review: "Revoir",
      verifyFirst: "Vérifier d’abord",
      noBid: "Ne pas soumissionner",
      skipEffort: "Éviter l’effort",
      upcomingDeadlines: "Échéances à venir",
      upcomingEmpty: "Aucune échéance dans les deux prochaines semaines.",
      upcomingCalendarDeadlines: "Échéances à venir",
      upcomingCalendarHint:
        "From Tender Calendar — same deadlines shown in the calendar module",
      upcomingCalendarEmpty: "Aucune échéance calendrier à venir pour le moment.",
      addCalendarTender: "Ajouter un appel d’offres au calendrier",
      highRisk: "AO à haut risque",
      highRiskEmpty: "Aucun AO à risque élevé ou critique pour le moment.",
      recentAnalyses: "Analyses récentes",
      recentEmpty:
        "Aucune analyse pour l’instant. Déposez un AO pour obtenir votre première décision.",
      viewAll: "Tout voir",
      due: "Échéance",
      analyzed: "Analysé",
      decisionDistribution: "Répartition des décisions",
      decisionDistributionHint: "Part des résultats BID / REVIEW / NO-BID terminés",
      upcomingHint: "Appels d'offres encore au calendrier",
      uploadTender: "Téléverser un appel d'offres",
      riskOverview: "Vue des risques",
      riskOverviewHint: "Exposition critique ou élevée à la disqualification",
      recentHint: "Derniers résultats go / no-go",
      platformTitle: "Ce que vous pouvez faire dans Bidvera",
      platformHint: "Four capabilities in one product — open any module to continue.",
      capabilityAnalysisDesc: "Téléversez des dossiers et obtenez des décisions go / no-go.",
      capabilityComplianceDesc: "Suivez les documents métier et les rappels d’expiration.",
      capabilityQualificationDesc:
        "Supplier readiness for bids and questionnaires — not your workspace Company Profile.",
      capabilityCalendarDesc: "Suivez les échéances d’opportunités et les rappels.",
      capabilityOpen: "Ouvrir",
      capabilityGetStarted: "Commencer",
      capabilityUpgrade: "Passez à une offre supérieure pour débloquer",
      statusAnalyses: "{count} analyses",
      statusDocuments: "{count} documents",
      statusCompleteness: "{percent}% complété",
      statusDeadlines: "{count} à venir",
      statusLocked: "Non inclus dans votre offre actuelle",
      gettingStartedTitle: "Prochaines étapes suggérées",
      gettingStartedHint: "Pick any path — you can come back anytime.",
    },
    onboarding: {
      signOutHint: "Compte",
      stepVerify: "Vérifier l’email",
      stepCompany: "Entreprise",
      stepPlan: "Offre",
      verifyTitle: "Vérifiez votre email",
      verifyBody: "Nous avons envoyé un lien à",
      resend: "Renvoyer l’email de vérification",
      resent: "Email de vérification envoyé.",
      verifyInvalidTitle: "Lien invalide ou expiré",
      verifyInvalidBody: "Demandez un nouvel email depuis l’onboarding.",
      companyTitle: "Parlez-nous de votre entreprise",
      companyBody:
        "Cela aide Bidvera à évaluer l’adéquation d’un appel d’offres avec votre activité.",
      companyName: "Nom de l’entreprise",
      country: "Pays / localisation d’activité",
      industry: "Secteur d’activité",
      companySize: "Taille de l’entreprise",
      services: "Services / capacités principales",
      servicesHint: "Ajoutez plusieurs tags — Entrée après chacun.",
      experience: "Niveau d’expérience",
      experienceOptional: "facultatif",
      privacyNote:
        "Nous utilisons ces informations uniquement pour personnaliser Bidvera et améliorer l’analyse d’adéquation. Nous n’avons pas besoin d’informations sensibles.",
      companySubmit: "Continuer",
      companySkip: "Passer pour l’instant",
      planTitle: "Choisissez comment démarrer",
      planBody: "Commencez par Free Workspace ou choisissez une offre. Les offres Stripe éligibles incluent 14 jours d’essai.",
      trialTitle: "Essai de 14 jours",
      trialBody: "Un moyen de paiement est requis. Aucun prélèvement aujourd’hui. L’offre choisie démarre automatiquement sauf annulation.",
      trialCta: "Démarrer l’essai de 14 jours",
      paidCta: "Démarrer l’abonnement",
      freeTitle: "Free Workspace",
      freeBody: "Commencez gratuitement. Espace limité au profil entreprise et à la conformité documentaire.",
      freeCta: "Démarrer Free Workspace",
      noChargeToday: "Aucun prélèvement aujourd’hui",
      paymentMethodRequired: "Moyen de paiement requis",
      cancelBeforeTrial: "Annulez avant la fin de l’essai pour éviter le prélèvement.",
      monthly: "Mensuel",
      yearly: "Annuel",
      checkoutCanceled: "Paiement annulé. Réessayez quand vous voulez.",
      checkoutPending: "Paiement reçu — activation en cours…",
    },
    companyProfile: {
      title: "Profil entreprise",
      subtitle:
        "Utilisé pour l’adéquation entreprise–appel d’offres dans les analyses futures. Privé à votre organisation — aucune donnée personnelle ou financière sensible n’est requise.",
      headerHint:
        "Améliorez la qualité d’adéquation au fil du temps. Les changements s’appliquent uniquement aux analyses futures.",
      supplierQualificationHint:
        "Besoin de détails d’enregistrement et de preuves prêts à soumissionner ? Utilisez",
      supplierQualificationLink: "Qualification fournisseur",
      companyName: "Nom de l’entreprise",
      completeness: "Complétude",
      savedTitle: "Enregistré",
      savedBody:
        "Profil mis à jour. L’analyse utilisera les dernières informations sur le prochain appel d’offres.",
      saveErrorTitle: "Enregistrement impossible",
      basicsTitle: "Informations de base",
      basicsBody:
        "Uniquement pour l’analyse d’adéquation — aucune donnée personnelle ou financière sensible.",
      industry: "Secteur",
      country: "Pays",
      companySize: "Taille de l’entreprise",
      notProvided: "Non renseigné",
      experienceLevel: "Niveau d’expérience (facultatif)",
      experienceYears: "Années d’expérience (facultatif)",
      experienceYearsPlaceholder: "ex. 5",
      revenueRange: "Fourchette de revenus (facultatif)",
      revenuePlaceholder: "ex. £2m–£5m",
      employees: "Effectifs (facultatif)",
      employeesPlaceholder: "ex. 50–100",
      sizeSolo: "Indépendant",
      sizeSmall: "Petite",
      sizeMedium: "Moyenne",
      sizeEnterprise: "Grande",
      expNew: "Nouvelle / expérience limitée",
      expSome: "Quelque expérience",
      expExperienced: "Expérimentée",
      expHighly: "Très expérimentée",
      capabilitiesTitle: "Capacités et couverture",
      services: "Services",
      certifications: "Certifications",
      geographicCoverage: "Couverture géographique",
      commaSeparated: "Séparés par des virgules",
      contractTitle: "Préférences contractuelles",
      contractMin: "Taille minimale de contrat (£)",
      contractMax: "Taille maximale de contrat (£)",
      rulesTitle: "Règles de qualification personnalisées",
      rulesBody: "Une règle par ligne. Elles deviennent des filtres lors de l’analyse.",
      save: "Enregistrer le profil",
      learningTitle: "Consentement à l’apprentissage global",
      learningBody:
        "Si activé, Bidvera peut contribuer des motifs de résultats filtrés pour la confidentialité (jamais de noms d’entreprise, documents, stratégies ou historiques identifiables) à la couche d’apprentissage globale. Vos résultats privés restent isolés par locataire. Vous pouvez vous retirer à tout moment.",
      learningCheckbox:
        "Contribuer des résultats anonymisés aux motifs globaux vérifiés",
      learningSaving: "(enregistrement…)",
    },
    billing: {
      title: "Facturation",
      subtitle: "Offre actuelle, renouvellement, historique des paiements et factures.",
      activatedTitle: "Abonnement activé",
      activatedBody: "Votre offre est active. Les plafonds sont mis à jour immédiatement.",
      trialEndedTitle: "Essai terminé",
      trialEndedBody:
        "Votre essai gratuit est terminé. L’analyse d’appels d’offres est indisponible jusqu’à une mise à niveau.",
      viewPlans: "Voir les offres →",
      currentPlanTitle: "Offre actuelle",
      currentPlanBody: "Statut de l’abonnement et cycle de facturation",
      plan: "Offre",
      status: "Statut",
      provider: "Fournisseur",
      billingCycle: "Cycle de facturation",
      renewal: "Renouvellement",
      paymentMethod: "Moyen de paiement",
      changePlan: "Changer d’offre",
      upgradePlan: "Mettre à niveau",
      cancelSubscription: "Annuler l’abonnement",
      cancelScheduled: "Annulation prévue en fin de période.",
      upgradesTitle: "Mises à niveau disponibles",
      upgradesBody: "{count} offres visibles avec passerelles activées",
      upgradesBodyOne: "1 offre visible avec passerelles activées",
      openCheckout: "Ouvrir le paiement →",
      paymentHistory: "Historique des paiements",
      noPayments: "Aucun paiement pour le moment.",
      invoices: "Factures",
      noInvoices: "Aucune facture pour le moment.",
      viewInvoice: "Voir",
      trialFallback: "Essai",
      usageTitle: "Usage de l’espace",
      trialUsageTitle: "Usage de l’essai",
      trialEndedDesc:
        "Votre essai gratuit est terminé — mettez à niveau pour analyser davantage d’appels d’offres.",
      unlimitedDesc: "{plan} · Analyses illimitées · {status}",
      remainingDesc: "{remaining} sur {limit} analyses gratuites restantes",
      trialEnds: "L’essai se termine le {date}",
      expired: "· Expiré",
      analysesUsed: "Analyses utilisées",
      used: "Utilisées",
      remaining: "Restantes",
      unlimited: "Illimitées",
      hoursSaved: "Heures estimées gagnées",
      risksDetected: "Risques détectés",
      upgradeContinue: "Mettre à niveau pour continuer",
      runningLow: "Quota bas ?",
      seePlans: "Voir les offres",
      trialBadge: "Essai gratuit de 14 jours",
      trialEndsIn: "Votre essai se termine dans {days} jours",
      trialEndsInOne: "Votre essai se termine dans 1 jour",
      trialEndingToday: "Votre essai se termine aujourd’hui",
      trialEndsOn: "Se termine le {date}",
      noChargeToday: "Aucun prélèvement aujourd’hui.",
      paymentMethodRequired: "Un moyen de paiement est requis",
      trialAutoConvert:
        "L’abonnement choisi commence automatiquement à la fin de l’essai, sauf annulation avant cette date.",
      cancelTrial: "Annuler l’essai",
      cancelTrialTitle: "Annuler l’essai ?",
      cancelTrialExplainConvert: "L’essai ne se convertira pas en abonnement payant.",
      cancelTrialExplainAccess:
        "Après l’essai, l’accès suit les règles de Free Workspace.",
      cancelTrialExplainData: "Les données de l’entreprise sont conservées.",
      cancelPaidTitle: "Annuler l’abonnement ?",
      cancelPaidExplainDate: "L’annulation prend effet le {date}.",
      cancelPaidExplainAccess: "Vous conservez l’accès jusqu’à cette date.",
      cancelPaidExplainAfter:
        "Ensuite, l’espace passe en Free Workspace. Les documents, demandes, preuves et l’historique ne sont pas supprimés.",
      confirmCancel: "Confirmer l’annulation",
      keepPlan: "Conserver l’offre",
      cancellationDate: "Date d’annulation",
      accessUntil: "L’accès reste disponible jusqu’au {date}.",
      freeWorkspace: "Free Workspace",
      freeWorkspaceBody:
        "Espace limité. Profil d’entreprise et conformité documentaire limitée sont inclus. Les capacités payantes ne le sont pas.",
      freeCapabilityProfile: "Profil d’entreprise",
      freeCapabilityCompliance: "Conformité documentaire (limitée)",
      nextBillingDate: "Prochaine date de facturation",
      usage: "Usage",
      paymentFailed: "Paiement échoué",
      pastDue: "En retard",
      statusTrialing: "En essai",
      statusActive: "Actif",
      statusCanceled: "Annulé",
      statusUnpaid: "Impayé",
      statusExpired: "Expiré",
      statusIncomplete: "Incomplet",
      monthlyInterval: "Mensuel",
      yearlyInterval: "Annuel",
      seatsUsage: "Sièges",
      aiUsage: "Usage IA",
      analysesUsage: "Analyses",
      analysesNotIncluded: "Non inclus",
      cancelError: "Impossible d’annuler pour le moment. Réessayez ou contactez le support.",
      started: "Début",
      paypalMethod: "PayPal",
      graceTitle: "Problème de paiement — période de grâce",
      graceBody:
        "Le paiement a échoué. L’accès continue jusqu’au {date}. Mettez à jour la facturation pour éviter l’interruption.",
      inactiveTitle: "Abonnement inactif",
      inactiveBody:
        "Votre abonnement n’est pas actif. Les données de l’entreprise sont conservées. Renouvelez ou mettez à niveau pour rétablir les capacités payantes.",
      billingHistory: "Historique de facturation",
      billingHistoryEmpty:
        "Aucune facture pour le moment. Elles apparaissent ici après un prélèvement réussi ou échoué.",
      invoiceDate: "Date",
      invoiceAmount: "Montant",
      invoiceStatus: "Statut",
      viewReceipt: "Voir le reçu",
      updatePaymentMethod: "Mettre à jour le moyen de paiement",
      retryPayment: "Régulariser le paiement",
      paymentProblemTitle: "Problème de paiement",
      paymentProblemBody:
        "Le paiement de l’abonnement n’a pas pu être encaissé. Mettez à jour le moyen de paiement pour conserver l’accès.",
      paypalManageHint:
        "PayPal gère le moyen de paiement de cet abonnement dans votre compte PayPal.",
      paymentPortalError:
        "Impossible d’ouvrir la page de paiement sécurisée. Réessayez ou contactez le support.",
      canceledAlertTitle: "Votre abonnement est annulé",
      subscriptionEndedTitle: "Votre abonnement a pris fin",
      subscriptionEndedBody:
        "Votre espace de travail est en sécurité, mais certaines fonctionnalités premium sont désormais verrouillées.",
      choosePlan: "Choisir un plan",
      graceDaysRemaining: "Il vous reste {days} jours pour résoudre le paiement.",
      graceDaysRemainingOne: "Il vous reste 1 jour pour résoudre le paiement.",
    },
    alerts: {
      title: "Alertes",
      subtitle: "Échéances, Decision Memory, scores, exigences et flux de travail.",
      emptyTitle: "Pas encore d’alertes",
      emptyDescription: "Les notifications d’échéances, risques et analyses apparaîtront ici.",
      newBadge: "Nouveau",
      markAllRead: "Tout marquer comme lu",
      unreadCount: "{count} non lues",
    },
    settings: {
      title: "Paramètres",
      subtitle: "Préférences du compte et valeurs par défaut de l’espace de travail.",
      accountTitle: "Compte",
      accountBody: "Utilisateur connecté",
      name: "Nom",
      email: "E-mail",
      avatarLabel: "Photo de profil",
      avatarHint: "Affichée dans la barre supérieure. JPG, PNG, WebP ou GIF · max. 5 Mo.",
      avatarUpload: "Téléverser une photo",
      avatarUploading: "Téléversement…",
      avatarRemove: "Supprimer",
      accountSave: "Enregistrer les modifications",
      accountSaving: "Enregistrement…",
      accountSaved: "Compte mis à jour.",
      emailChangeHint:
        "Changer l’e-mail exige votre mot de passe et un lien de confirmation à la nouvelle adresse.",
      emailChangePending: "Confirmation en attente pour {email}.",
      emailChangeSent:
        "Vérifiez {email} pour le lien de confirmation. Votre e-mail actuel reste actif jusqu’à confirmation.",
      emailChangeResend: "Renvoyer la confirmation",
      emailChangeResent: "Confirmation renvoyée à {email}.",
      emailChangeExpires: "Expire le {when}.",
      emailChangePasswordLabel: "Mot de passe actuel",
      emailChangePasswordHint: "Requis pour demander un changement d’e-mail.",
      emailChangePasswordRequired: "Saisissez votre mot de passe actuel pour changer l’e-mail.",
      emailChangeCancel: "Annuler le changement d’e-mail",
      emailChangeCancelled: "Changement d’e-mail annulé.",
      emailChangeInvalidTitle: "Lien invalide ou expiré",
      emailChangeInvalidBody: "Demandez un nouveau lien depuis les Paramètres.",
      emailChangeBackSettings: "Retour aux Paramètres",
      companyProfileTitle: "Profil de l’entreprise",
      companyProfileBody:
        "Secteur, taille, services, pays et expérience utilisés pour l’adéquation entreprise–appel d’offres sur les analyses futures. Privé à votre organisation.",
      editCompanyProfile: "Modifier le profil de l’entreprise",
      notificationsTitle: "Notifications",
      notificationsBody:
        "Alertes d’échéances et d’analyse — dans l’app et par e-mail. WhatsApp / SMS / push pourront être branchés plus tard.",
      moduleRemindersTitle: "Planifications de rappels par module",
      moduleRemindersBody: "La conformité documentaire et le calendrier ont leurs propres décalages de rappel.",
      complianceRemindersLink: "Rappels de conformité documentaire",
      calendarRemindersLink: "Rappels du calendrier",
      planTitle: "Offre",
      planUnlimited: "Business · Illimité · {used} utilisés",
      planLimited: "{used}/{limit} analyses utilisées",
      manageBilling: "Gérer la facturation",
      viewUpgrade: "Voir les options de mise à niveau",
      signOut: "Se déconnecter",
      revokeOtherSessions: "Déconnecter les autres appareils",
      revokeOtherSessionsHint: "Cette session reste active.",
      timezone: "Fuseau horaire de l’entreprise",
      timezoneHint: "Utilisé pour le texte des alertes d’échéance et l’affichage de l’heure locale.",
      channels: "Canaux",
      channelInApp: "Alertes dans l’app",
      channelEmail: "E-mail",
      channelWhatsapp: "WhatsApp (bientôt)",
      channelSms: "SMS (bientôt)",
      channelPush: "Push (bientôt)",
      deadlineAlerts: "Alertes d’échéance",
      deadline7d: "7 jours avant",
      deadline3d: "3 jours avant",
      deadline24h: "24 heures avant",
      deadlinePassed: "Échéance dépassée",
      otherAlerts: "Autres alertes",
      alertAnalysisDone: "Analyse terminée",
      alertHighRisk: "Constats à haut risque",
      alertMissingDocs: "Documents manquants",
      alertScoreChange: "Changements de score ou de décision",
      alertRequirementStatus: "Changements d’état des exigences",
      alertDecisionMemory: "Decision Memory pertinente",
      alertWorkflow: "Événements de flux / dossier",
      prefsSaved: "Préférences enregistrées.",
      savePrefs: "Enregistrer les préférences de notification",
    },
    tenders: {
      title: "Appels d’offres",
      subtitle: "{count} appels d’offres · filtrer par décision, risque et échéance",
      subtitleOne: "1 appel d’offres · filtrer par décision, risque et échéance",
      analyzeCta: "Analyser un appel d’offres",
      emptyTitle: "Pas encore d’appels d’offres",
      emptyDescription:
        "Téléversez un ITT ou PQQ pour obtenir une recommandation Bid / Review / No-Bid.",
      search: "Recherche",
      searchPlaceholder: "Titre ou client",
      decision: "Décision",
      allDecisions: "Toutes les décisions",
      bid: "Soumettre",
      review: "Réviser",
      noBid: "Ne pas soumettre",
      risk: "Risque",
      allRiskLevels: "Tous les niveaux",
      low: "Faible",
      medium: "Moyen",
      high: "Élevé",
      critical: "Critique",
      deadline: "Échéance",
      anyDeadline: "Toute échéance",
      next7d: "7 prochains jours",
      next14d: "14 prochains jours",
      next30d: "30 prochains jours",
      overdue: "En retard",
      sort: "Tri",
      sortRecent: "Récemment analysés",
      sortDeadlineSoon: "Échéance la plus proche",
      sortDeadlineLate: "Échéance la plus lointaine",
      sortFit: "Score d’adéquation",
      sortTitle: "Titre A–Z",
      colTender: "Appel d’offres",
      colClient: "Client",
      colDeadline: "Échéance",
      colFit: "Adéquation",
      colDecision: "Décision",
      colRisk: "Risque",
      colAnalyzed: "Analysé",
      colNextAction: "Prochaine action",
      deadlineWithDate: "Échéance {date}",
      fitWithScore: "Adéquation {score}",
      noNextAction: "Aucune action suivante",
    },
    upload: {
      title: "Analyser un appel d’offres",
      subtitle:
        "Téléversez un ITT ou PQQ pour obtenir une recommandation Bid / Review / No-Bid.",
      trialLeft: "Essai · {remaining} analyses restantes",
      trialEnds: " · se termine le {date}",
      phaseIdleTitle: "Téléverser un dossier d’appel d’offres",
      phaseIdleBody:
        "Téléversez plusieurs fichiers ou un package ZIP/RAR. Nous nous concentrons sur la décision — pas sur un dump brut du document.",
      phaseUploadingTitle: "Téléversement…",
      phaseUploadingBody: "Transfert sécurisé de vos fichiers.",
      phaseDiscoveringTitle: "Découverte des fichiers…",
      phaseDiscoveringBody: "Inventaire de chaque document du dossier d’appel d’offres.",
      phaseExtractingTitle: "Extraction du package…",
      phaseExtractingBody: "Décompression ZIP/RAR et découverte des documents d’appel d’offres.",
      phasePreparingTitle: "Préparation des documents…",
      phasePreparingBody: "Validation des fichiers et préparation du dossier pour l’analyse.",
      phaseProcessingTitle: "Traitement du document…",
      phaseProcessingBody: "En file pour extraction et structuration des exigences.",
      phaseAnalyzingTitle: "Analyse de l’adéquation…",
      phaseAnalyzingBody:
        "Correspondance au profil, règles et génération d’une décision.",
      phaseSuccessTitle: "Analyse prête",
      phaseSuccessBody: "Votre pack de décision est disponible.",
      phaseErrorTitle: "Échec du téléversement",
      phaseErrorBody:
        "Une erreur s’est produite lors du téléversement ou de la préparation du dossier. Vérifiez les fichiers et réessayez.",
      phaseAnalysisErrorTitle: "L’analyse n’a pas pu aboutir",
      phaseAnalysisErrorBody:
        "Votre dossier a bien été téléversé et préparé. L’échec s’est produit pendant l’analyse — ouvrez l’appel d’offres pour plus de détails.",
      phaseTimeoutBody:
        "Toujours en cours après 1 minute. Ouvrez l’appel d’offres sous peu — l’analyse peut se terminer en arrière-plan.",
      phaseTimeoutTitle: "Toujours en cours",
      stillWorking: "L’analyse continue en arrière-plan",
      openTender: "Ouvrir l’appel d’offres",
      trialUsedTitle: "Analyses d’essai épuisées",
      trialUsedBody: "Passez à une offre supérieure pour analyser davantage.",
      viewPlans: "Voir les offres",
      unlimitedPlan: "Analyses illimitées sur votre offre Business active",
      remainingAnalyses: "{count} analyses gratuites restantes",
      dragHere: "Glissez-déposez vos fichiers ou packages ZIP/RAR ici",
      processingTender: "Traitement de votre dossier d’appel d’offres…",
      fileTypes: "PDF, Word, Excel, PowerPoint, CSV, TXT, images, ZIP/RAR · jusqu’à {max} fichiers par dossier · max {maxFileMb}MB par fichier · max {maxPackageMb}MB par dossier",
      chooseFile: "Choisir des fichiers",
      filesSelected: "{count} fichiers sélectionnés",
      maxFilesReached: "Jusqu’à {max} fichiers par dossier.",
      filesDiscovered: "{count} fichiers découverts dans le dossier",
      removeFile: "Retirer",
      statusReady: "Prêt",
      statusUploading: "Téléversement…",
      statusDiscovering: "Découverte…",
      statusExtracting: "Extraction…",
      statusPreparing: "Préparation…",
      statusProcessing: "Traitement…",
      statusAnalyzing: "Analyse…",
      startUpload: "Téléverser et analyser",
      waitForUpload: "Attendez la fin du téléversement en cours avant d’ajouter d’autres fichiers.",
      bodyTooLarge:
        "Le dossier est trop volumineux pour cette requête. Réduisez le nombre de fichiers, ou redémarrez l’app après l’augmentation de la limite puis réessayez.",
      decisionReady: "Décision prête — ouvrez le pack ci-dessous.",
      unableContinue: "Impossible de continuer",
      openDecision: "Ouvrir la décision",
      uploadAnother: "Téléverser un autre",
      tryAgain: "Réessayer",
      creditsExhausted:
        "Vous avez utilisé toutes les analyses gratuites. Passez à une offre supérieure pour continuer.",
      passwordRequiredTitle: "Mot de passe requis",
      passwordRequiredBody:
        "Ce fichier est protégé par mot de passe. Saisissez le mot de passe pour continuer.",
      passwordLabel: "Mot de passe de l’archive",
      passwordSubmit: "Déverrouiller et continuer",
      passwordCancel: "Annuler",
      passwordWrong: "Mot de passe incorrect. Réessayez.",
      intakeRepairedTitle: "Réparé automatiquement",
      intakePartialTitle: "Partiellement lisible",
      intakeIncompleteTitle: "Dossier incomplet",
      intakeReadyTitle: "Prêt pour l’analyse",
      intakeBlockedTitle: "Analyse bloquée",
      intakeUnsupportedTitle: "Format non pris en charge",
      intakeCorruptedTitle: "Fichier corrompu",
      intakePartiallyReadableTitle: "Partiellement lisible2",
    },
    tenderDetail: {
      backToTenders: "← Appels d’offres",
      unknownClient: "Client inconnu",
      deadline: "Échéance",
      analyzed: "Analysé",
      fullReport: "Rapport complet",
      analysisInProgressTitle: "Analyse en cours",
      analysisInProgressBody:
        "Statut : {status}. Actualisez sous peu — le traitement est en cours.",
      analysisFailedTitle: "Échec de l’analyse",
      analysisFailedBody:
        "Le traitement s’est terminé par un échec définitif. Voir le détail de l’erreur ci-dessous.",
      analysisFailedPhase: "Arrêt à la phase : {phase}",
      canonicalNote:
        "Analyse canonique — les mêmes exigences, conformité, adéquation, préparation, risques, Bid Score et recommandation pour chaque utilisateur autorisé. Les rôles contrôlent uniquement l’accès.",
      missingDocuments: "Documents manquants",
      required: "Obligatoire",
      nextActions: "Prochaines actions",
      noNextActions: "Aucune action recommandée pour cette décision.",
      teamWorkflow: {
        title: "Flux de décision d’équipe",
        subtitle:
          "Assignez exigences, risques et preuves manquantes à Finance, Juridique, Technique, etc. Les réponses sont des preuves — elles ne modifient pas automatiquement le Decision Engine.",
        empty: "Aucune tâche d’équipe pour l’instant.",
        criticalBanner:
          "{count} tâche(s) critique(s) non résolue(s) avant la décision finale.",
        assign: "Assigner",
        respond: "Enregistrer la réponse",
        complete: "Terminer avec réponse",
        create: "Créer une tâche",
        responsePlaceholder: "Réponse vérifiée (ne rien inventer)…",
        evidencePlaceholder: "Note de preuve (optionnel)…",
        department: "Département",
        assignee: "Assigné",
        requiredResponse: "Réponse requise",
        linkedItem: "Élément lié",
      },
      decisionSupport: "Aide à la décision",
      fitSuffix: "Adéquation",
      overallFit: "Adéquation globale",
      confidence: "Confiance",
      confidenceHigh: "ÉLEVÉE",
      confidenceMedium: "MOYENNE",
      confidenceLow: "FAIBLE",
      heroBidLabel: "Bidvera recommande de poursuivre",
      heroBidHint:
        "D’après les informations fournies, l’adéquation justifie l’effort — vérifiez avant soumission.",
      heroReviewLabel: "Bidvera recommande une revue",
      heroReviewHint:
        "Ambiguïtés, écarts ou inconnues nécessitent une confirmation humaine avant engagement.",
      heroNoBidLabel: "Bidvera recommande de ne pas poursuivre",
      heroNoBidHint:
        "D’après les données disponibles, des écarts critiques rendent l’effort peu rentable — confirmez avec votre équipe.",
      companyTenderFit: "Adéquation entreprise–appel d’offres",
      unknown: "Inconnu",
      basisAi: " · Évaluation IA",
      basisNotProvided: " · Non fourni",
      basisFromProfile: " · Depuis le profil entreprise",
      basisFromTender: " · Depuis l’appel d’offres",
      tenderReadiness: "Préparation de l’appel d’offres",
      readinessCounts: "{ready} prêts · {verify} à vérifier · {missing} manquants",
      recommendation: "Recommandation :",
      keyBlockers: "Blocages clés",
      keyBlockersNext:
        "Prochaine étape : résoudre les points signalés avant la décision finale.",
      whyTitle: "Pourquoi cette recommandation ?",
      executiveSummary: "Résumé exécutif",
      viewDetails: "Voir les détails",
      hideDetails: "Masquer les détails",
      topReasons: "Raisons clés",
      criticalAlerts: "Points critiques",
      whatToDoNext: "Prochaines actions",
      decisionDisclaimer:
        "Bidvera fournit une recommandation fondée sur les preuves. La décision finale reste celle de votre entreprise.",
      expiredDeadlineAlert:
        "La date limite de soumission est dépassée — confirmez si l’appel d’offres est encore ouvert.",
      mandatoryGapAlert: "Écart obligatoire",
      missingDocumentAlert: "Document manquant",
      detailedAnalysisTitle: "Analyse détaillée",
      detailedAnalysisHint:
        "Exigences, conformité, preuves, risques, adéquation et workflow — mêmes données canoniques que le rapport.",
    },
    report: {
      backToTender: "← Appel d’offres",
      title: "Rapport d’analyse",
      subtitle:
        "Dossier de décision complet — consulter, imprimer, télécharger en PDF ou partager un lien en lecture seule.",
      reportNotReady: "Rapport pas encore prêt",
      reportNotReadyBody:
        "Ce rapport n’est pas encore prêt. Réessayez dans un instant.",
      print: "Imprimer",
      downloadPdf: "Télécharger le PDF",
      shareLink: "Partager le lien",
      copied: "Copié.",
      shareExpires: "Expire dans 72 h · lecture seule :",
      revokeShare: "Révoquer les liens partagés",
      shareRevoked: "Liens partagés révoqués.",
      reportEyebrow: "Rapport de décision Bidvera",
      unknownClient: "Client inconnu",
      deadline: "Échéance",
      analyzed: "Analysé",
      recommendation: "Recommandation",
      companyTenderFit: "Adéquation entreprise–appel d’offres",
      confidence: "Confiance",
      whyTitle: "Pourquoi cette recommandation",
      bidScore: "Score d’offre",
      bidScoreLine: "Score d’offre : {score}/100 — {priority}",
      expectedValue: "Valeur attendue :",
      risk: "Risque :",
      effort: "Effort :",
      positive: "Positif",
      negative: "Négatif",
      overall: "Global",
      unknown: "Inconnu",
      tenderReadiness: "Préparation de l’appel d’offres",
      readinessCounts: "{ready} prêts · {verify} à vérifier · {missing} manquants",
      nextStep: "Prochaine étape :",
      complianceMatrix: "Matrice de conformité",
      requirements: "Exigences",
      ready: "Prêt",
      missing: "Manquant",
      verify: "À vérifier",
      notApplicable: "Non applicable",
      withSources: "Avec sources",
      mandatory: "Obligatoire",
      optional: "Facultatif",
      evidenceLabel: "Preuve :",
      noExcerpt: "Aucun extrait justificatif disponible.",
      page: "Page {n}",
      sourceNotLocated: "La source n’a pas pu être localisée précisément.",
      noRequirements: "Aucune exigence n’a été extraite pour cet appel d’offres.",
      missingRequirements: "Exigences manquantes",
      noMissingRequirements: "Aucune exigence manquante identifiée.",
      mandatoryParen: " (obligatoire)",
      verificationItems: "Points à vérifier",
      nothingPendingVerify: "Rien en attente de vérification.",
      risks: "Risques",
      noRisks: "Aucun risque significatif signalé.",
      clarifications: "Questions de clarification",
      noClarifications:
        "Aucune question de clarification générée — aucune ambiguïté pertinente détectée.",
      reason: "Motif :",
      source: "Source :",
      evidence: "Preuves",
      noEvidence: "Aucun extrait de source disponible.",
      historicalTitle: "Intelligence historique pertinente",
      historicalBody:
        "Des résultats historiques similaires peuvent fournir un signal utile pour cette opportunité. C’est un signal supplémentaire — pas une garantie de succès ou d’échec.",
      historicalPriority:
        "Les preuves de l’appel d’offres actuel et votre profil entreprise ont toujours la priorité.",
      historicalEmpty:
        "Aucun schéma historique vérifié ne s’applique encore à cette opportunité.",
      decisionMemoryTitle: "Mémoire de décision",
      currentAnalysisLabel: "Analyse actuelle",
      historicalDecisionLabel: "Décision historique",
      decisionMemoryCurrentNote:
        "Les scores, exigences et la recommandation ci-dessus font autorité pour cet appel d’offres et ne sont pas modifiés par l’historique.",
      decisionMemoryEmpty:
        "Aucune décision antérieure pertinente pour cette opportunité pour le moment.",
      relevanceReasons: "Pourquoi c’est pertinent",
      missingDocuments: "Documents manquants",
      nextActions: "Prochaines actions recommandées",
      noNextActions: "Aucune action recommandée.",
      basisDirect: "Source directe",
      basisAi: "Interprétation IA",
      basisUncertain: "Source incertaine",
      evidenceVerificationTitle: "Preuves et vérification",
      evidenceVerificationDisclaimer:
        "La vérification reflète uniquement les preuves enregistrées et la revue humaine. Les interprétations IA ne sont jamais traitées comme vérifiées.",
      verificationSummary:
        "{verified} vérifiés · {needs} à vérifier · {missing} preuves manquantes · {na} non applicable",
      noVerificationChains: "Aucune chaîne de vérification disponible pour cet appel d'offres.",
      verificationStatusVerified: "Vérifié",
      verificationStatusNeedsVerification: "À vérifier",
      verificationStatusMissingEvidence: "Preuve manquante",
      verificationStatusNotApplicable: "Non applicable",
      verifierLabel: "Vérificateur :",
      verifiedAtLabel: "Vérifié le :",
      decisionOutcomeTitle: "Résultat de la décision",
      decisionOutcomeBidvera: "Décision Bidvera",
      decisionOutcomeHuman: "Décision humaine finale",
      decisionOutcomeActual: "Résultat réel",
      decisionOutcomeDate: "Date du résultat",
      decisionOutcomeReason: "Motif du résultat",
      decisionOutcomeSuccess: "Décision vs résultat",
      decisionOutcomeSuccessAligned: "La décision initiale correspond au résultat",
      decisionOutcomeSuccessMisaligned: "La décision initiale ne correspond pas au résultat",
      decisionOutcomeSuccessPending: "Résultat encore en attente",
      decisionOutcomeSuccessNeutral: "Neutre par rapport à la décision initiale",
      decisionOutcomeRecorded: "Résultat enregistré",
      outcomeLearningTitle: "Intelligence historique basée sur les résultats",
      decisionOutcomeAttachment: "Document justificatif",
      decisionOutcomeEvalSuccessful: "Réussi",
      decisionOutcomeEvalUnsuccessful: "Non réussi",
      decisionOutcomeEvalNotEvaluated: "Non évalué",
    },
    decisionMemory: {
      title: "Mémoire de décision",
      subtitle:
        "Décisions d’appels d’offres antérieures de votre entreprise — référence uniquement. Ne modifie jamais l’analyse en cours.",
      emptyTitle: "Aucune décision enregistrée",
      emptyDescription:
        "Les analyses terminées apparaissent ici automatiquement. Ouvrez un appel d’offres pour comparer Analyse actuelle et Décision historique.",
      emptyDescriptionCompanyContext:
        "Les décisions enregistrées apparaissent ici lorsque Decision Intelligence consigne un résultat pour votre entreprise. Maintenez qualifications et preuves à jour pour donner un contexte solide aux décisions futures.",
      viewTender: "Ouvrir l’appel d’offres",
      openCompanyProfile: "Ouvrir le profil entreprise",
      analyzed: "Analysé",
      scores: "Scores",
      requirements: "Exigences",
      risks: "Risques",
      reasoning: "Raisonnement",
      relevance: "Pertinence",
      disclaimer:
        "Décision historique — référence uniquement. Ne modifie pas les scores ni la recommandation de l’Analyse actuelle.",
      back: "Retour à la Mémoire de décision",
    },
    pwa: {
      availableOn: "Disponible sur Windows et macOS",
      updateTitle: "Mise à jour prête",
      updateBody:
        "Une nouvelle version bureau de Bidvera est disponible. Rechargez pour l’appliquer.",
      updateNow: "Mettre à jour",
      installedTitle: "Bidvera est installée",
      installedBody:
        "Vous êtes en mode application bureau — accès plus rapide depuis le dock ou la barre des tâches.",
      title: "Installer Bidvera comme application bureau",
      bodyBefore: "Fonctionne sur",
      bodyAnd: "et",
      bodyAfter: "— s’ouvre dans sa propre fenêtre, sans App Store.",
      installCta: "Installer Bidvera",
      openingInstaller: "Ouverture de l’installateur…",
      dismiss: "Fermer",
      guideTitleSafari: "Installer Bidvera dans Safari",
      guideTitleEdge: "Installer Bidvera dans Edge",
      guideTitleChrome: "Installer Bidvera dans Chrome",
      guideTitleDefault: "Installer Bidvera",
      guideDescription:
        "Suivez ces étapes pour ajouter Bidvera comme application bureau.",
      desktopMeta: "Application bureau · Windows et macOS",
      openInstallDialog: "Ouvrir la boîte d’installation",
      gotIt: "Compris",
      iosStep1: "Appuyez sur le bouton Partager dans Safari.",
      iosStep2: "Choisissez",
      iosStep2Strong: "Sur l’écran d’accueil",
      iosStep3: "Confirmez — Bidvera s’ouvre en plein écran depuis l’accueil.",
      safariMacStep1: "Dans la barre de menus, ouvrez",
      safariMacStep1Strong: "Fichier",
      safariMacStep2: "Choisissez",
      safariMacStep2Strong: "Ajouter au Dock",
      safariMacStep3: "Confirmez — Bidvera apparaît dans le Dock comme une app Mac.",
      chromiumStep1Before:
        "Regardez à droite de la barre d’adresse de {browser} l’icône",
      chromiumStep1Strong: "installer / ordinateur",
      chromiumStep1After: ".",
      chromiumStep2Before: "Cliquez puis choisissez",
      chromiumStep2Strong: "Installer",
      chromiumStep3Before: "Ou ouvrez le menu du navigateur →",
      chromiumStep3Install: "Installer Bidvera",
      chromiumStep3Mid: "/",
      chromiumStep3Apps: "Applications → Installer ce site en tant qu’application",
    },
  },
};

const dictionaries: Record<Locale, Dictionary> = { en, es, zh, ar, fr };

export type LocalizedDictionary = Omit<Dictionary, "app"> & {
  app: Dictionary["app"] & AppModuleBundle;
};

export function getDictionary(locale: Locale): LocalizedDictionary {
  const base = dictionaries[locale] ?? dictionaries.en;
  const modules = appModulesByLocale[locale] ?? appModulesByLocale.en;
  return {
    ...base,
    app: {
      ...base.app,
      ...modules,
    },
  };
}

/** @deprecated use getDictionary — exposed for structural tests */
export function getCoreDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}
