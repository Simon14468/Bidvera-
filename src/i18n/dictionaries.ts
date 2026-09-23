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
  legal: {
    footerHeading: string;
    privacyLink: string;
    termsLink: string;
    privacyEyebrow: string;
    privacyTitle: string;
    privacyMetaDescription: string;
    termsEyebrow: string;
    termsTitle: string;
    termsMetaDescription: string;
    effectiveDateLabel: string;
    lastUpdatedLabel: string;
    onThisPage: string;
    relatedDocuments: string;
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
    acceptTermsLead: string;
    acceptTermsJoiner: string;
    termsOfServiceLink: string;
    privacyPolicyLink: string;
    acceptTermsError: string;
    continueGoogle: string;
    googleComingSoon: string;
    googleOAuthError: string;
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
      "Capture industry, services, geography and size so the team shares one current view of what the company offers. This foundation supports qualification, evidence and opportunity review â€” without hunting across spreadsheets and folders.",
  },
  {
    title: "Document Compliance",
    body: "Track critical company documents and expiry dates before they become blockers.",
    detail:
      "Store licences, certificates and insurance in a secure workspace, monitor validity, and see what needs attention before it lapses. Useful when buyers ask for proof and your team needs a single source of truth.",
  },
  {
    title: "Supplier Qualification",
    body: "Show what your company is qualified to deliver â€” and where gaps remain.",
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
      "Organize key dates and reminder settings so important submissions are less likely to be missed. Complements Client Requests by giving the team a shared timeline â€” not a private spreadsheet.",
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
      "Combine company readiness signals with requirement and evidence context to produce a decision you can explain. Evidence Intelligence and Explainable Decision keep the rationale traceable. Decision Memory and Decision Simulator support judgment â€” they do not replace human ownership.",
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
    tagline: "Know What to Pursue. Know What Youâ€™re Ready For.",
    description:
      "Bidvera helps companies understand readiness, manage compliance and qualifications, organize evidence, evaluate relevant opportunities and make explainable decisions.",
  },
  legal: {
    footerHeading: "Legal",
    privacyLink: "Privacy Policy",
    termsLink: "Terms of Service",
    privacyEyebrow: "Legal",
    privacyTitle: "Privacy Policy",
    privacyMetaDescription:
      "How Bidvera processes personal data for accounts, workspaces, documents, billing, Google sign-in, and security on getbidvera.com.",
    termsEyebrow: "Legal",
    termsTitle: "Terms of Service",
    termsMetaDescription:
      "Terms governing use of the Bidvera SaaS platform, including accounts, AI outputs, subscriptions, and acceptable use.",
    effectiveDateLabel: "Effective date",
    lastUpdatedLabel: "Last updated",
    onThisPage: "On this page",
    relatedDocuments: "Related",
  },
  landing: {
    headline: "Know What to Pursue. Know What Youâ€™re Ready For.",
    subhead:
      "Bidvera helps business teams understand company readiness, manage compliance and qualifications, organize evidence, evaluate relevant work, and turn explainable decisions into clear next actions.",
    ctaPrimary: "Explore Bidvera",
    ctaSecondary: "See how it works",
    trialNote: "Readiness Â· Opportunities Â· Evidence Â· Decisions Â· Action",
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
      body: "Smart Match Engine compares opportunity signals with your company profile so teams can prioritize further review â€” instead of scanning every lead the same way.",
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
      "Organize what the company has, verify what can be proven, evaluate what is relevant, and decide what to pursue â€” with the team.",
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
      "Start free. Upgrade when Bidvera is saving your team real time â€” from {price}/mo on Pro.",
    pricingTeaserCta: "Compare plans",
    viewAllFaq: "View all FAQ â†’",
    testimonialsTitle: "What teams say",
    testimonialsBody:
      "Real feedback from teams using Bidvera to stay ready and decide with confidence.",
    testimonialsEmptyTitle: "Early customer feedback",
    testimonialsEmptyBody:
      "We only publish genuine customer testimonials. Be among the first teams to bring readiness, evidence and decisions into one workspace â€” then tell us how it went.",
    testimonialsEmptyCta: "Explore Bidvera",
  },
  product: {
    eyebrow: "Product",
    title: "Company intelligence. Readiness. Decisions you can explain.",
    body: "Bidvera is not a generic AI PDF summariser. It is a workspace for company readiness, compliance, qualification, evidence, opportunity intelligence and explainable decisions. BID / REVIEW / NO-BID is one Decision Engine outcome â€” not the whole product.",
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
    analysesSeats: "{analyses} analyses / month Â· {seats} seats",
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
    freeLimitedNote: "Limited workspace â€” company profile and document compliance only.",
    comparisonTitle: "Compare plans",
    comparisonFeature: "Capability",
    yearlyNote: "Yearly totals use the price configured for each plan. Checkout uses the interval you select.",
    valueTitle1: "A company intelligence workspace",
    valueBody1:
      "Organize company information, compliance, qualifications, evidence and requests in one place â€” then act with the team.",
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
        a: "Bidvera is designed with controlled access, tenant isolation and security protections so each companyâ€™s workspace and information remain separated.",
      },
      {
        q: "Can I try Bidvera before subscribing?",
        a: "Yes. You can start with the available free trial and explore the platform before choosing a subscription.",
      },
    ],
  },
  auth: {
    loginTitle: "Sign in",
    loginBody: "Access your companyâ€™s Bidvera workspace.",
    emailChangedNotice:
      "Your email was updated. Sign in with your new address. All other sessions were signed out.",
    sideHeadline: "Know what to pursue. Know what youâ€™re ready for.",
    sideBody:
      "Bidvera helps your team organize readiness, verify evidence, evaluate opportunities and decide with confidence.",
    sidePillMatched: "MATCHED â€” A suitable opportunity was found for the company.",
    sidePillReview: "REVIEW â€” Review the opportunity details and its relevance.",
    sidePillNotAMatch: "NOT A MATCH â€” The opportunity does not match the company's profile.",
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
    acceptTermsLead: "I accept the",
    acceptTermsJoiner: "and",
    termsOfServiceLink: "Terms of Service",
    privacyPolicyLink: "Privacy Policy",
    acceptTermsError: "You must accept the Terms and Privacy Policy.",
    continueGoogle: "Continue with Google",
    googleComingSoon: "Google sign-in is coming soon",
    googleOAuthError: "Google sign-in failed. Try again.",
    continueMicrosoft: "Continue with Microsoft",
    microsoftComingSoon: "Microsoft sign-in is coming soon",
    forgotPassword: "Forgot password?",
    forgotTitle: "Reset password",
    forgotBody: "Weâ€™ll email you a one-time link if an account exists.",
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
    placeholder: "Ask a questionâ€¦",
    send: "Send",
    thinking: "Thinkingâ€¦",
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
    imageQuotaReached: "Image upload locked â€” 1 image / 4 hours for this browser and address.",
    replyQuotaReached: "Send locked â€” 10 replies used for this browser and address (resets in 4 hours).",
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
        "Analyze tenders, keep documents compliant, maintain supplier readiness, and track deadlines â€” in one workspace.",
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
      upcomingCalendarHint: "From Tender Calendar â€” same deadlines shown in the calendar module",
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
      platformHint: "Four capabilities in one product â€” open any module to continue.",
      capabilityAnalysisDesc: "Upload packages and get go / no-go decisions.",
      capabilityComplianceDesc: "Track business documents and expiry reminders.",
      capabilityQualificationDesc:
        "Supplier readiness for bids and questionnaires â€” not your workspace Company Profile.",
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
      gettingStartedHint: "Pick any path â€” you can come back anytime.",
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
      servicesHint: "Add multiple tags â€” press Enter after each one.",
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
      checkoutPending: "Payment received â€” finishing activationâ€¦",
    },
    companyProfile: {
      title: "Company Profile",
      subtitle:
        "Workspace company information used for tender-fit analysis. Separate from Supplier Qualification (bid readiness & evidence).",
      headerHint:
        "Improve match quality over time. Changes apply to future tender analyses only â€” not the Supplier Qualification profile.",
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
        "General workspace details for tender-fit â€” not supplier registration evidence.",
      industry: "Industry",
      country: "Country",
      companySize: "Company size",
      notProvided: "Not provided",
      experienceLevel: "Experience level (optional)",
      experienceYears: "Years of experience (optional)",
      experienceYearsPlaceholder: "e.g. 5",
      revenueRange: "Revenue range (optional)",
      revenuePlaceholder: "e.g. Â£2mâ€“Â£5m",
      employees: "Employees (optional)",
      employeesPlaceholder: "e.g. 50â€“100",
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
      contractMin: "Minimum contract size (Â£)",
      contractMax: "Maximum contract size (Â£)",
      rulesTitle: "Custom qualification rules",
      rulesBody: "One rule per line. These become filters during analysis.",
      save: "Save profile",
      learningTitle: "Global learning consent",
      learningBody:
        "When enabled, Bidvera may contribute privacy-filtered outcome patterns (never company names, documents, strategies, or identifiable histories) to the global learning layer. Your company-private outcomes always stay tenant-isolated. You can opt out at any time.",
      learningCheckbox:
        "Contribute anonymized outcomes to verified global patterns",
      learningSaving: "(savingâ€¦)",
    },
    billing: {
      title: "Billing",
      subtitle: "Your workspace plan, trial, renewal, and usage.",
      activatedTitle: "Subscription activated",
      activatedBody: "Your plan is now active. Limits update immediately.",
      trialEndedTitle: "Trial ended",
      trialEndedBody:
        "Your free trial has ended. Upgrade to restore paid workspace capabilities.",
      viewPlans: "View plans â†’",
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
      openCheckout: "Open checkout â†’",
      paymentHistory: "Payment history",
      noPayments: "No payments yet.",
      invoices: "Invoices",
      noInvoices: "No invoices yet.",
      viewInvoice: "View",
      trialFallback: "Trial",
      usageTitle: "Workspace usage",
      trialUsageTitle: "Trial usage",
      trialEndedDesc:
        "Your free trial has ended â€” upgrade to restore paid workspace capabilities.",
      unlimitedDesc: "{plan} Â· Unlimited analyses Â· {status}",
      remainingDesc: "{remaining} of {limit} free analyses remaining",
      trialEnds: "Trial ends {date}",
      expired: "Â· Expired",
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
      graceTitle: "Payment issue â€” grace period",
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
        "Youâ€™ll see analysis, document expiry, and calendar reminder notifications here.",
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
      avatarHint: "Shown in the top bar. JPG, PNG, WebP, or GIF Â· max 5MB.",
      avatarUpload: "Upload photo",
      avatarUploading: "Uploadingâ€¦",
      avatarRemove: "Remove",
      accountSave: "Save changes",
      accountSaving: "Savingâ€¦",
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
        "Industry, size, services, country, and experience used for companyâ€“tender fit on future analyses. Private to your organization.",
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
      planUnlimited: "Business Â· Unlimited Â· {used} used",
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
      subtitle: "{count} tenders Â· filter by decision, risk, and deadline",
      subtitleOne: "1 tender Â· filter by decision, risk, and deadline",
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
      sortTitle: "Title Aâ€“Z",
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
      trialLeft: "Trial Â· {remaining} analyses left",
      trialEnds: " Â· ends {date}",
      phaseIdleTitle: "Upload a tender pack",
      phaseIdleBody:
        "Upload multiple tender files or a ZIP/RAR package. Weâ€™ll focus on the bid decision â€” not a raw document dump.",
      phaseUploadingTitle: "Uploadingâ€¦",
      phaseUploadingBody: "Securely transferring your files.",
      phaseDiscoveringTitle: "Discovering filesâ€¦",
      phaseDiscoveringBody: "Inventorying every document in your tender package.",
      phaseExtractingTitle: "Extracting documentsâ€¦",
      phaseExtractingBody: "Unpacking archives and reading tender documents.",
      phasePreparingTitle: "Preparing tender packageâ€¦",
      phasePreparingBody: "Validating files and assembling one package for analysis.",
      phaseProcessingTitle: "Processing documentâ€¦",
      phaseProcessingBody: "Queued for extraction and requirement structuring.",
      phaseAnalyzingTitle: "Analyzing fitâ€¦",
      phaseAnalyzingBody:
        "Matching company profile, running rules, and generating a decision.",
      phaseSuccessTitle: "Analysis ready",
      phaseSuccessBody: "Your decision pack is available.",
      phaseErrorTitle: "Upload failed",
      phaseErrorBody: "Something went wrong while uploading or preparing the package. Check the files and try again.",
      phaseAnalysisErrorTitle: "Analysis could not finish",
      phaseAnalysisErrorBody:
        "Your tender package was uploaded and prepared successfully. The failure happened during analysis â€” open the tender for details.",
      phaseTimeoutBody:
        "Large files can take several minutes. Analysis is still running in the background â€” open the tender when ready.",
      phaseTimeoutTitle: "Still processing",
      stillWorking: "Analysis continues in the background",
      openTender: "Open tender",
      trialUsedTitle: "Trial analyses used",
      trialUsedBody: "Upgrade to analyze more tenders.",
      viewPlans: "View plans",
      unlimitedPlan: "Unlimited analyses on your active Business plan",
      remainingAnalyses: "{count} free analyses remaining",
      dragHere: "Drag and drop tender files or ZIP/RAR packages here",
      processingTender: "Processing your tender packageâ€¦",
      fileTypes:
        "PDF, DOCX, XLS/XLSX, CSV, TXT, PPTX, images, ZIP/RAR Â· up to {max} files per package Â· max {maxFileMb}MB per file Â· max {maxPackageMb}MB per package Â· legacy DOC/PPT may fail extraction",
      chooseFile: "Choose files",
      filesSelected: "{count} files selected",
      filesDiscovered: "{count} files discovered in package",
      maxFilesReached: "Up to {max} files per package.",
      removeFile: "Remove",
      statusReady: "Ready",
      statusUploading: "Uploadingâ€¦",
      statusDiscovering: "Discoveringâ€¦",
      statusExtracting: "Extractingâ€¦",
      statusPreparing: "Preparingâ€¦",
      statusProcessing: "Processingâ€¦",
      statusAnalyzing: "Analyzingâ€¦",
      startUpload: "Upload & analyze",
      waitForUpload: "Wait for the current upload to finish before adding more files.",
      bodyTooLarge:
        "The tender package is too large for this request. Reduce total size or split the package, then try again.",
      decisionReady: "Decision ready â€” open the pack below.",
      unableContinue: "Unable to continue",
      openDecision: "Open decision",
      uploadAnother: "Upload another",
      tryAgain: "Try again",
      creditsExhausted: "Youâ€™ve used all free analyses. Upgrade to continue.",
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
      backToTenders: "â† Tenders",
      unknownClient: "Unknown client",
      deadline: "Deadline",
      analyzed: "Analyzed",
      fullReport: "Full report",
      analysisInProgressTitle: "Analysis in progress",
      analysisInProgressBody:
        "Status: {status}. Refresh shortly â€” processing is underway.",
      analysisFailedTitle: "Analysis failed",
      analysisFailedBody:
        "Processing reached a terminal failure. See the error details below.",
      analysisFailedPhase: "Stopped at phase: {phase}",
      canonicalNote:
        "Canonical analysis â€” the same requirements, compliance, fit, readiness, risks, Bid Score, and recommendation for every authorized user. Roles control access only.",
      missingDocuments: "Missing documents",
      required: "Required",
      nextActions: "Next actions",
      noNextActions: "No recommended actions for this decision.",
      teamWorkflow: {
        title: "Team Decision Workflow",
        subtitle:
          "Assign requirements, risks, and missing evidence to Finance, Legal, Technical, and other departments. Responses are evidence only â€” they do not auto-change the Decision Engine.",
        empty: "No team tasks yet. Analysis gaps can seed tasks automatically, or create one manually.",
        criticalBanner: "{count} unresolved critical team task(s) before final decision.",
        assign: "Assign",
        respond: "Save response",
        complete: "Complete with response",
        create: "Create task",
        responsePlaceholder: "Enter verified response (never invent facts)â€¦",
        evidencePlaceholder: "Evidence note / reference (optional)â€¦",
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
        "Based on the information provided, fit supports committing bid effort â€” still verify before submission.",
      heroReviewLabel: "Bidvera recommends review",
      heroReviewHint:
        "Ambiguity, gaps, or unknowns need human confirmation before committing.",
      heroNoBidLabel: "Bidvera recommends not pursuing",
      heroNoBidHint:
        "Based on available data, critical gaps make bid effort unlikely to pay off â€” confirm with your team.",
      companyTenderFit: "Companyâ€“Tender Fit",
      unknown: "Unknown",
      basisAi: " Â· AI assessment",
      basisNotProvided: " Â· Not provided",
      basisFromProfile: " Â· From company profile",
      basisFromTender: " Â· From tender",
      tenderReadiness: "Tender Readiness",
      readinessCounts: "{ready} ready Â· {verify} verify Â· {missing} missing",
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
      expiredDeadlineAlert: "Submission deadline has passed â€” confirm whether this tender is still open.",
      mandatoryGapAlert: "Mandatory gap",
      missingDocumentAlert: "Missing document",
      detailedAnalysisTitle: "Detailed analysis",
      detailedAnalysisHint:
        "Full requirements, compliance, evidence, risks, fit, and workflow â€” same canonical data as the report.",
    },
    report: {
      backToTender: "â† Tender",
      title: "Analysis report",
      subtitle:
        "Full decision package â€” view, print, download PDF, or share a read-only link.",
      reportNotReady: "Report not ready",
      reportNotReadyBody:
        "This report is not ready to view yet. Please try again shortly.",
      print: "Print",
      downloadPdf: "Download PDF",
      shareLink: "Share link",
      copied: "Copied.",
      shareExpires: "Expires in 72h Â· read-only:",
      revokeShare: "Revoke shared links",
      shareRevoked: "Shared links revoked.",
      reportEyebrow: "Bidvera decision report",
      unknownClient: "Unknown client",
      deadline: "Deadline",
      analyzed: "Analyzed",
      recommendation: "Recommendation",
      companyTenderFit: "Companyâ€“Tender Fit",
      confidence: "Confidence",
      whyTitle: "Why this recommendation",
      bidScore: "Bid Score",
      bidScoreLine: "Bid Score: {score}/100 â€” {priority}",
      expectedValue: "Expected Value:",
      risk: "Risk:",
      effort: "Effort:",
      positive: "Positive",
      negative: "Negative",
      overall: "Overall",
      unknown: "Unknown",
      tenderReadiness: "Tender Readiness",
      readinessCounts: "{ready} Ready Â· {verify} Verify Â· {missing} Missing",
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
        "No clarification questions generated â€” no meaningful ambiguity detected.",
      reason: "Reason:",
      source: "Source:",
      evidence: "Evidence",
      noEvidence: "No source excerpts available.",
      historicalTitle: "Relevant historical intelligence",
      historicalBody:
        "Similar historical outcomes may provide a relevant signal for this opportunity. This is an additional signal â€” not a guarantee of success or failure.",
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
        "{verified} verified Â· {needs} needs verification Â· {missing} missing evidence Â· {na} not applicable",
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
        "Prior tender decisions for your company â€” reference only. Never changes a current analysis.",
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
        "Historical Decision â€” reference only. Does not change Current Analysis scores or recommendation.",
      back: "Back to Decision Memory",
    },
    pwa: {
      availableOn: "Available on Windows and macOS",
      updateTitle: "App update ready",
      updateBody: "A newer Bidvera desktop build is waiting. Reload to apply.",
      updateNow: "Update now",
      installedTitle: "Bidvera is installed",
      installedBody:
        "Youâ€™re running the desktop app mode â€” faster access from your dock or taskbar.",
      title: "Install Bidvera as a desktop app",
      bodyBefore: "Works on",
      bodyAnd: "and",
      bodyAfter: "â€” opens in its own window, no App Store needed.",
      installCta: "Install Bidvera",
      openingInstaller: "Opening installerâ€¦",
      dismiss: "Dismiss",
      guideTitleSafari: "Install Bidvera in Safari",
      guideTitleEdge: "Install Bidvera in Edge",
      guideTitleChrome: "Install Bidvera in Chrome",
      guideTitleDefault: "Install Bidvera",
      guideDescription: "Follow these steps to add Bidvera as a desktop app.",
      desktopMeta: "Desktop app Â· Windows & macOS",
      openInstallDialog: "Open install dialog",
      gotIt: "Got it",
      iosStep1: "Tap the Share button in Safari.",
      iosStep2: "Choose",
      iosStep2Strong: "Add to Home Screen",
      iosStep3: "Confirm â€” Bidvera opens full-screen from your home screen.",
      safariMacStep1: "In the menu bar open",
      safariMacStep1Strong: "File",
      safariMacStep2: "Choose",
      safariMacStep2Strong: "Add to Dock",
      safariMacStep3: "Confirm â€” Bidvera appears in your Dock like a Mac app.",
      chromiumStep1Before: "Look at the right side of the {browser} address bar for the",
      chromiumStep1Strong: "install / computer",
      chromiumStep1After: "icon.",
      chromiumStep2Before: "Click it, then choose",
      chromiumStep2Strong: "Install",
      chromiumStep3Before: "Or open the browser menu â†’",
      chromiumStep3Install: "Install Bidvera",
      chromiumStep3Mid: "/",
      chromiumStep3Apps: "Apps â†’ Install this site as an app",
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
    signIn: "Iniciar sesiÃ³n",
    startFree: "Empezar gratis",
    app: "App",
    language: "Idioma",
  },
  brand: {
    tagline: "Sabe quÃ© perseguir. Sabe para quÃ© estÃ¡s listo.",
    description:
      "Bidvera ayuda a las empresas a entender su preparaciÃ³n, gestionar cumplimiento y cualificaciÃ³n, organizar evidencias, evaluar oportunidades relevantes y tomar decisiones explicables.",
  },
  legal: {
    footerHeading: "Legal",
    privacyLink: "PolÃ­tica de privacidad",
    termsLink: "TÃ©rminos del servicio",
    privacyEyebrow: "Legal",
    privacyTitle: "PolÃ­tica de privacidad",
    privacyMetaDescription:
      "CÃ³mo Bidvera trata datos personales de cuentas, espacios de trabajo, documentos, facturaciÃ³n, acceso con Google y seguridad en getbidvera.com.",
    termsEyebrow: "Legal",
    termsTitle: "TÃ©rminos del servicio",
    termsMetaDescription:
      "Condiciones de uso de la plataforma SaaS Bidvera: cuentas, resultados de IA, suscripciones y uso aceptable.",
    effectiveDateLabel: "Fecha de entrada en vigor",
    lastUpdatedLabel: "Ãšltima actualizaciÃ³n",
    onThisPage: "En esta pÃ¡gina",
    relatedDocuments: "Relacionado",
  },
  landing: {
    headline: "Sabe quÃ© perseguir. Sabe para quÃ© estÃ¡s listo.",
    subhead:
      "Bidvera ayuda a equipos empresariales a entender la preparaciÃ³n de la empresa, gestionar cumplimiento y cualificaciÃ³n, organizar evidencias, evaluar trabajo relevante y convertir decisiones explicables en siguientes pasos claros.",
    ctaPrimary: "Explorar Bidvera",
    ctaSecondary: "CÃ³mo funciona",
    trialNote: "PreparaciÃ³n Â· Oportunidades Â· Evidencias Â· Decisiones Â· AcciÃ³n",
    previewLabel: "Inteligencia de decisiÃ³n",
    previewQuestion: "Â¿LISTO PARA PERSEGUIR?",
    previewDecision: "REVIEW",
    previewFit: "Buen encaje de preparaciÃ³n",
    previewRisk: "Evidencia verificada",
    previewRiskValue: "3 requisitos confirmados",
    previewMissing: "Requiere atenciÃ³n",
    previewMissingValue: "1 cualificaciÃ³n por verificar",
    previewNext: "Siguiente acciÃ³n",
    previewNextValue: "Confirmar evidencia pendiente",
    previewWhy:
      "La cualificaciÃ³n parece sÃ³lida. Un elemento aÃºn necesita verificaciÃ³n antes de comprometer al equipo.",
    sectionTitle: "Por quÃ© las empresas usan Bidvera",
    sectionBody:
      "En lugar de reconstruir la preparaciÃ³n desde carpetas, correo y hojas de cÃ¡lculo, Bidvera ofrece un espacio estructurado para informaciÃ³n de empresa, pruebas, decisiones y seguimiento.",
    feature1Title: "Conoce tu preparaciÃ³n",
    feature1Body:
      "MantÃ©n organizada y actualizada la informaciÃ³n de empresa, cualificaciones y evidencia de cumplimiento.",
    feature2Title: "Organiza el trabajo relevante",
    feature2Body:
      "Captura solicitudes de clientes y fechas del calendario, y evalÃºa requisitos frente a lo que puedes entregar.",
    feature3Title: "ActÃºa con confianza",
    feature3Body:
      "Toma decisiones explicables, asigna siguientes pasos y mantÃ©n al equipo alineado.",
    capabilitiesTitle: "Ocho capacidades para preparaciÃ³n, oportunidades y acciÃ³n",
    capabilitiesLearnMore: "Saber mÃ¡s",
    capabilitiesShowLess: "Mostrar menos",
    capabilities: [
      {
        title: "Perfil de empresa",
        body: "MantÃ©n identidad, servicios y preparaciÃ³n de la empresa en un solo espacio.",
        detail:
          "Captura sector, servicios, geografÃ­a y tamaÃ±o para que el equipo comparta una vista actual de lo que ofrece la empresa. Esta base apoya cualificaciÃ³n, evidencias y revisiÃ³n de oportunidades.",
      },
      {
        title: "Cumplimiento documental",
        body: "Controla documentos crÃ­ticos y fechas de caducidad antes de que bloqueen el trabajo.",
        detail:
          "Guarda licencias, certificados y seguros en un espacio seguro, supervisa la vigencia y ve quÃ© necesita atenciÃ³n antes de vencer.",
      },
      {
        title: "CualificaciÃ³n de proveedor",
        body: "Muestra para quÃ© estÃ¡ cualificada tu empresa â€” y dÃ³nde hay huecos.",
        detail:
          "MantÃ©n cualificaciones, cobertura y evidencias de apoyo para ver la preparaciÃ³n antes de invertir tiempo en una solicitud.",
      },
      {
        title: "Solicitudes de clientes",
        body: "Centraliza peticiones de documentos e informaciÃ³n del comprador en un dossier claro.",
        detail:
          "Captura solicitudes entrantes, vincula evidencias existentes, sigue el avance y comparte un paquete seguro. Reduce el caos de hilos de correo.",
      },
      {
        title: "Calendario de licitaciones",
        body: "MantÃ©n visibles plazos, hitos y recordatorios de las oportunidades que sigues.",
        detail:
          "Organiza fechas clave y recordatorios para que los envÃ­os importantes sean menos fÃ¡ciles de olvidar. Complementa las solicitudes de clientes con una lÃ­nea de tiempo compartida.",
      },
      {
        title: "Asistente de cuestionarios",
        body: "Estructura preguntas y redacta respuestas con evidencias y pasos de verificaciÃ³n claros.",
        detail:
          "Detecta y organiza el contenido del cuestionario, redacta borradores basados en evidencias disponibles y marca lo que aÃºn requiere verificaciÃ³n humana.",
      },
      {
        title: "Motor de decisiÃ³n",
        body: "Llega a BID, REVIEW o NO-BID explicables a partir de preparaciÃ³n, cualificaciÃ³n y evidencias.",
        detail:
          "Combina seÃ±ales de preparaciÃ³n con requisitos y evidencias para producir una decisiÃ³n que puedes explicar. La memoria y el simulador de decisiÃ³n apoyan el juicio â€” no sustituyen la responsabilidad del equipo.",
      },
      {
        title: "Flujo de decisiÃ³n de equipo",
        body: "Convierte una decisiÃ³n en pasos asignados, verificaciÃ³n y alertas ejecutables.",
        detail:
          "Crea tareas, adjunta evidencias, cierra el bucle de verificaciÃ³n y usa alertas inteligentes y el plan de acciÃ³n cuando estÃ©n disponibles en el plan.",
      },
    ],
    smartMatch: {
      eyebrow: "Smart Match Engine",
      title: "Ve quÃ© oportunidades encajan con el perfil de tu empresa",
      body: "Smart Match Engine compara seÃ±ales de oportunidad con el perfil de tu empresa para priorizar la revisiÃ³n â€” en lugar de tratar cada lead igual.",
      benefit1: "Destaca oportunidades alineadas con servicios, sector y geografÃ­a.",
      benefit2: "Usa cualificaciones, experiencia y tamaÃ±o como dimensiones de encaje.",
      benefit3: "Revisa explicaciones de encaje antes de comprometer tiempo del equipo.",
      dimensionsLabel: "Dimensiones de coincidencia",
      dimensions: [
        "Servicios",
        "Sector",
        "GeografÃ­a",
        "Cualificaciones",
        "Experiencia",
        "TamaÃ±o de empresa",
      ],
      note: "Las puntuaciones orientan la exploraciÃ³n y la revisiÃ³n. No garantizan elegibilidad, cobertura de todo el mercado ni adjudicaciones. El acceso depende de la configuraciÃ³n del espacio de trabajo.",
      ctaPrimary: "Crea el perfil de tu empresa",
      ctaSecondary: "CÃ³mo funciona Bidvera",
    },
    bottomTitle: "ReÃºne preparaciÃ³n, oportunidades y decisiones en un solo espacio",
    bottomBody:
      "Organiza lo que la empresa tiene, verifica lo que se puede demostrar, evalÃºa lo relevante y decide quÃ© perseguir â€” con el equipo.",
    bottomCta: "Explorar Bidvera",
    howTitle: "CÃ³mo funciona",
    howBody: "De la preparaciÃ³n de la empresa a la acciÃ³n con confianza.",
    step1Title: "Comprender",
    step1Body:
      "Construye una imagen clara de tu empresa, documentos, cualificaciones y preparaciÃ³n.",
    step2Title: "Organizar",
    step2Body:
      "Usa las solicitudes de clientes para capturar el trabajo entrante, y mantÃ©n las fechas clave en el calendario.",
    step3Title: "Verificar",
    step3Body:
      "Contrasta requisitos con perfil, documentos, cualificaciones y evidencias.",
    step4Title: "Decidir y actuar",
    step4Body:
      "Llega a una decisiÃ³n explicable y avÃ¡nzala con el flujo de equipo, alertas y un plan de acciÃ³n claro.",
    beforeAfterTitle: "De informaciÃ³n dispersa a acciÃ³n con confianza",
    beforeAfterBody:
      "Deja de reconstruir documentos, cualificaciones y oportunidades desde sitios distintos. Bidvera reÃºne preparaciÃ³n, evidencias y decisiones.",
    beforeLabel: "Sin un flujo estructurado Bidvera",
    afterLabel: "Con Bidvera",
    beforeItems: [
      "Documentos, cualificaciones y evidencias dispersos en carpetas e inboxes",
      "Poco claro quÃ© solicitudes puedes perseguir de verdad",
      "RevisiÃ³n manual sin un rastro de evidencia compartido",
      "Decisiones sin ownership claro de siguientes acciones",
    ],
    afterItems: [
      "Un espacio para inteligencia de empresa, preparaciÃ³n y evidencias verificadas",
      "Trabajo entrante organizado frente a capacidad real",
      "BID / REVIEW / NO-BID explicable, con la justificaciÃ³n detrÃ¡s",
      "Acciones asignadas, alertas y un plan que el equipo puede ejecutar",
    ],
    complianceEyebrow: "Cumplimiento documental",
    complianceHeadline: "MantÃ©n tu empresa lista, en todo momento.",
    complianceBody:
      "Organiza documentos crÃ­ticos, controla fechas de caducidad y sigue los requisitos de cumplimiento desde un espacio seguro.",
    complianceBenefit1Title: "MantÃ©n el orden",
    complianceBenefit1Body: "Todos los documentos de empresa en un espacio seguro.",
    complianceBenefit2Title: "Controla caducidades",
    complianceBenefit2Body: "Ve quÃ© estÃ¡ vigente y quÃ© necesita atenciÃ³n antes de vencer.",
    complianceBenefit3Title: "Listo para requisitos",
    complianceBenefit3Body: "Sabe quÃ© documentos respaldan el siguiente requisito.",
    compliancePanelTitle: "Documentos de empresa",
    complianceAddLabel: "AÃ±adir documento",
    complianceAlertTitle: "El seguro vence pronto",
    complianceReadyLabel: "EstÃ¡s listo",
    complianceReadyHint: "Los documentos clave estÃ¡n rastreados en un solo espacio.",
    complianceStatusValid: "Vigente",
    complianceStatusExpiring: "Vence pronto",
    complianceDocTrade: "Licencia comercial",
    complianceDocTax: "Certificado fiscal",
    complianceDocInsurance: "Seguro",
    complianceDocQuality: "Certificado de calidad",
    complianceDocFinancial: "Estados financieros",
    complianceDateTrade: "VÃ¡lido hasta 31 dic 2026",
    complianceDateTax: "VÃ¡lido hasta 15 oct 2026",
    complianceDateInsurance: "Vence 28 nov 2026",
    complianceDateQuality: "VÃ¡lido hasta 1 ago 2027",
    complianceDateFinancial: "VÃ¡lido hasta 10 feb 2027",
    pricingTeaserTitle: "Precios simples para equipos en crecimiento",
    pricingTeaserBody:
      "Empieza gratis. Mejora de plan cuando Bidvera ahorre tiempo real â€” desde {price}/mes en Pro.",
    pricingTeaserCta: "Comparar planes",
    viewAllFaq: "Ver todas las preguntas â†’",
    testimonialsTitle: "Lo que dicen los equipos",
    testimonialsBody:
      "Feedback real de equipos que usan Bidvera para mantenerse listos y decidir con confianza.",
    testimonialsEmptyTitle: "Feedback de primeros clientes",
    testimonialsEmptyBody:
      "Solo publicamos testimonios genuinos. SÃ© de los primeros equipos en reunir preparaciÃ³n, evidencias y decisiones â€” y cuÃ©ntanos cÃ³mo te fue.",
    testimonialsEmptyCta: "Explorar Bidvera",
  },
  product: {
    eyebrow: "Producto",
    title: "Inteligencia de empresa. PreparaciÃ³n. Decisiones explicables.",
    body: "Bidvera no es un resumidor genÃ©rico de PDF. Es un espacio de trabajo para preparaciÃ³n, cumplimiento, cualificaciÃ³n, evidencias, oportunidades y decisiones explicables. BID / REVIEW / NO-BID es un resultado del motor de decisiÃ³n â€” no el producto entero.",
    step1Title: "Comprende la empresa",
    step1Body:
      "Construye una imagen viva de tu perfil, documentos, cualificaciones y preparaciÃ³n.",
    step2Title: "Organiza lo relevante",
    step2Body:
      "Usa las solicitudes de clientes para capturar el trabajo alineado con lo que tu empresa puede entregar, y mantÃ©n las fechas en el calendario.",
    step3Title: "Verifica, decide y actÃºa",
    step3Body:
      "Analiza los requisitos que importan, conecta evidencias, toma decisiones BID / REVIEW / NO-BID explicables y conviÃ©rtelas en siguientes acciones con el equipo.",
    seeTitle: "Con quÃ© trabaja tu equipo",
    seeItems: [
      "Perfil de empresa, cumplimiento documental y cualificaciÃ³n de proveedor",
      "Solicitudes de clientes y calendario",
      "Inteligencia de evidencia con verificaciÃ³n respaldada",
      "Resultados del motor de decisiÃ³n: BID / REVIEW / NO-BID",
      "JustificaciÃ³n explicable, memoria y simulador de decisiÃ³n",
      "AnÃ¡lisis de licitaciones como un paso del flujo",
      "Asistente de cuestionarios y exportaciÃ³n PDF",
      "Flujo de equipo, plan de acciÃ³n y alertas inteligentes",
    ],
    cta: "Explorar Bidvera",
    futureTitle: "Capacidades activas en un solo espacio",
    futureBody:
      "Bidvera ya cubre la base de la empresa, inteligencia de oportunidades, evidencias, decisiones y acciÃ³n de equipo.",
    highlightItems: [
      "Perfil de empresa",
      "Cumplimiento documental",
      "Solicitudes de clientes",
      "Inteligencia de evidencia",
      "Motor de decisiÃ³n",
      "AnÃ¡lisis de licitaciones",
      "Flujo de decisiÃ³n de equipo",
      "Confianza y seguridad de IA",
    ],
  },
  pricing: {
    eyebrow: "Precios",
    title: "Un espacio para preparaciÃ³n, oportunidades y acciÃ³n",
    body: "Empieza con un Free Workspace limitado o prueba un plan de pago durante 14 dÃ­as. Los precios salen de los planes reales de Bidvera.",
    perMonth: "/mes",
    perMonthYearly: "/mes facturado al aÃ±o",
    analysesSeats: "{analyses} anÃ¡lisis / mes Â· {seats} plazas",
    seatsOnly: "{seats} plazas",
    startFree: "Empezar gratis",
    startFreeWorkspace: "Empezar Free Workspace",
    startTrial: "Empezar prueba de 14 dÃ­as",
    startSubscription: "Empezar suscripciÃ³n",
    choose: "Elegir {plan}",
    monthly: "Mensual",
    yearly: "Anual",
    save: "Ahorra ~17%",
    recommended: "MÃ¡s popular",
    mostPopular: "Ideal para equipos en crecimiento",
    trialBadge: "Prueba gratis de 14 dÃ­as",
    noChargeToday: "Sin cargo hoy",
    paymentMethodRequired: "Se requiere un mÃ©todo de pago",
    cancelBeforeTrial: "Cancela antes de que termine la prueba para evitar el cobro de la suscripciÃ³n.",
    freeHeadline: "Empieza gratis. Construye el espacio de tu empresa.",
    freeLimitedNote: "Espacio limitado: perfil de empresa y cumplimiento documental.",
    comparisonTitle: "Comparar planes",
    comparisonFeature: "Capacidad",
    yearlyNote: "Los totales anuales usan el precio configurado de cada plan. El pago usa el intervalo que elijas.",
    valueTitle1: "Un espacio de inteligencia empresarial",
    valueBody1:
      "Organiza informaciÃ³n, cumplimiento, cualificaciones, evidencias y solicitudes en un solo lugar, y actÃºa con el equipo.",
    valueTitle2: "LÃ­mites claros, sin uso oculto",
    valueBody2: "Los asientos y lÃ­mites de uso se muestran en cada plan. Lo que ves es lo que incluye.",
    valueTitle3: "Prueba un plan de pago y decide",
    valueBody3:
      "Los planes elegibles incluyen 14 dÃ­as de prueba con un mÃ©todo de pago. Cancela antes del final si no quieres que empiece la suscripciÃ³n.",
    ctaTitle: "Â¿Listos para mantener la empresa preparada?",
    ctaBody: "Empieza con Free Workspace o elige un plan y prueba Bidvera 14 dÃ­as.",
    groups: {
      readiness: "PreparaciÃ³n de la empresa",
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
      advanced_decision_engine: "Motor de decisiÃ³n",
      decision_memory: "Decision Memory",
      decision_simulator: "Decision Simulator",
      explainable_decision: "Explainable Decision",
      tender_analysis: "Tender Analysis",
      questionnaire_assistant: "Questionnaire Assistant",
      smart_alerts: "Alertas inteligentes",
      team_collaboration: "Flujo de decisiÃ³n de equipo",
      pdf_export: "ExportaciÃ³n PDF",
      tender_action_plan: "Tender Action Plan",
    },
  },
  faq: {
    eyebrow: "Preguntas",
    title: "Respuestas claras",
    items: [
      {
        q: "Â¿QuÃ© es Bidvera?",
        a: "Bidvera es un espacio de inteligencia empresarial que ayuda a las empresas a organizar su informaciÃ³n, gestionar el cumplimiento, evaluar oportunidades relevantes, trabajar con evidencias y actuar con confianza.",
      },
      {
        q: "Â¿CÃ³mo ayuda Bidvera a mantener mi empresa preparada?",
        a: "Bidvera reÃºne el perfil de empresa, las cualificaciones y los documentos clave para que tu equipo mantenga una base empresarial fiable y actualizada.",
      },
      {
        q: "Â¿CÃ³mo funciona Document Compliance?",
        a: "Haz seguimiento de documentos importantes, controla fechas de vencimiento y recibe alertas cuando haga falta atenciÃ³n, para que tu empresa se mantenga preparada.",
      },
      {
        q: "Â¿CÃ³mo ayuda Bidvera con oportunidades y solicitudes de clientes?",
        a: "Los equipos pueden capturar solicitudes de clientes, mantener plazos en el calendario y evaluar requisitos frente al perfil, capacidades y cualificaciones de la empresa.",
      },
      {
        q: "Â¿Bidvera puede ayudar con solicitudes de clientes y cuestionarios?",
        a: "SÃ­. Los equipos pueden gestionar solicitudes de clientes y usar el Asistente de cuestionarios para organizar y responder la informaciÃ³n requerida con mayor eficiencia.",
      },
      {
        q: "Â¿CÃ³mo utiliza Bidvera la evidencia?",
        a: "Evidence Intelligence conecta la informaciÃ³n de la empresa, las cualificaciones y las evidencias de respaldo para que los equipos entiendan quÃ© estÃ¡ verificado, quÃ© necesita atenciÃ³n y por quÃ©.",
      },
      {
        q: "Â¿Mi equipo puede colaborar en Bidvera?",
        a: "SÃ­. Team Decision Workflow ayuda a los miembros a trabajar juntos, asignar responsabilidades, revisar informaciÃ³n y coordinar los siguientes pasos en un solo espacio.",
      },
      {
        q: "Â¿Es seguro Bidvera?",
        a: "Bidvera estÃ¡ diseÃ±ado con acceso controlado, aislamiento por inquilino y protecciones de seguridad para que el espacio e informaciÃ³n de cada empresa permanezcan separados.",
      },
      {
        q: "Â¿Puedo probar Bidvera antes de suscribirme?",
        a: "SÃ­. Puedes empezar con la prueba gratuita disponible y explorar la plataforma antes de elegir una suscripciÃ³n.",
      },
    ],
  },
  auth: {
    loginTitle: "Iniciar sesiÃ³n",
    loginBody: "Accede al espacio Bidvera de tu empresa.",
    emailChangedNotice:
      "Tu correo se actualizÃ³. Inicia sesiÃ³n con la nueva direcciÃ³n. Se cerraron las demÃ¡s sesiones.",
    sideHeadline: "Sabe quÃ© perseguir. Sabe para quÃ© estÃ¡s listo.",
    sideBody:
      "Bidvera ayuda a tu equipo a organizar la preparaciÃ³n, verificar evidencias, evaluar oportunidades y decidir con confianza.",
    sidePillMatched: "COINCIDENCIA â€” Se encontrÃ³ una oportunidad adecuada para la empresa.",
    sidePillReview: "REVISIÃ“N â€” Revisa los detalles de la oportunidad y su relevancia.",
    sidePillNotAMatch: "SIN COINCIDENCIA â€” La oportunidad no encaja con el perfil de la empresa.",
    signupTitle: "Crea tu cuenta Bidvera",
    signupBody: "Email y contraseÃ±a primero. La empresa viene despuÃ©s.",
    name: "Tu nombre",
    companyName: "Nombre de la empresa",
    email: "Email de trabajo",
    password: "ContraseÃ±a",
    confirmPassword: "Confirmar contraseÃ±a",
    submitLogin: "Iniciar sesiÃ³n",
    submitSignup: "Crear cuenta",
    haveAccount: "Â¿Ya tienes cuenta?",
    newHere: "Â¿Nuevo en Bidvera?",
    acceptTerms: "Acepto los TÃ©rminos y la PolÃ­tica de privacidad.",
    acceptTermsLead: "Acepto los",
    acceptTermsJoiner: "y la",
    termsOfServiceLink: "TÃ©rminos del servicio",
    privacyPolicyLink: "PolÃ­tica de privacidad",
    acceptTermsError: "Debes aceptar los TÃ©rminos y la PolÃ­tica de privacidad.",
    continueGoogle: "Continuar con Google",
    googleComingSoon: "Inicio con Google prÃ³ximamente",
    googleOAuthError: "No se pudo iniciar sesiÃ³n con Google. IntÃ©ntalo de nuevo.",
    continueMicrosoft: "Continuar con Microsoft",
    microsoftComingSoon: "Inicio con Microsoft prÃ³ximamente",
    forgotPassword: "Â¿Olvidaste la contraseÃ±a?",
    forgotTitle: "Restablecer contraseÃ±a",
    forgotBody: "Te enviaremos un enlace si existe la cuenta.",
    forgotSubmit: "Enviar enlace",
    forgotSent: "Si el email estÃ¡ registrado, el enlace estÃ¡ en camino.",
    resetTitle: "Elige una nueva contraseÃ±a",
    resetBody: "Usa al menos 12 caracteres.",
    resetSubmit: "Actualizar contraseÃ±a",
    passwordMismatch: "Las contraseÃ±as no coinciden.",
  },
  assistant: {
    askLabel: "Pregunta a Bidvera",
    title: "Asistente Bidvera AI",
    description:
      "Pregunta sobre Bidvera, preparaciÃ³n, oportunidades, evidencias o siguientes pasos. Las respuestas usan Bidvera AI; la voz es TTS seguro.",
    placeholder: "Haz una preguntaâ€¦",
    send: "Enviar",
    thinking: "Pensandoâ€¦",
    play: "Reproducir",
    pause: "Pausa",
    mute: "Silenciar",
    unmute: "Activar sonido",
    voiceUnavailable: "La voz no estÃ¡ disponible. Puedes leer la respuesta.",
    errorGeneric: "No se pudo obtener respuesta. IntÃ©ntalo de nuevo.",
    attachImage: "Adjuntar imagen",
    removeImage: "Quitar imagen",
    imageOnlyOne: "Solo se puede adjuntar una imagen.",
    imageTooLarge: "La imagen es demasiado grande (mÃ¡x. 4MB).",
    imageInvalid: "Usa JPEG, PNG, WebP o GIF.",
    imageQuotaReached: "Subida bloqueada â€” 1 imagen / 4 horas para este navegador y direcciÃ³n.",
    replyQuotaReached: "EnvÃ­o bloqueado â€” 10 respuestas usadas (se reinicia en 4 horas).",
  },
  app: {
    nav: {
      dashboard: "Panel",
      tenders: "AnÃ¡lisis de licitaciones",
      tenderCalendar: "Calendario de licitaciones",
      documentCompliance: "Cumplimiento documental",
      supplierQualification: "CalificaciÃ³n de proveedor",
      clientRequests: "Solicitudes de clientes",
      questionnaireAssistant: "Asistente de cuestionarios",
      matchedOpportunities: "Oportunidades coincidentes",
      company: "Perfil de empresa",
      billing: "FacturaciÃ³n",
      alerts: "Alertas",
      settings: "Ajustes",
      decisionMemory: "Memoria de decisiÃ³n",
      teamWorkflow: "Flujo del equipo",
      sectionCapabilities: "Capacidades",
      sectionWorkspace: "Espacio de trabajo",
      sectionAccount: "Cuenta",
    },
    shell: {
      tagline: "Verifica antes de ofertar.",
      analyzeTender: "Analizar licitaciÃ³n",
      upgrade: "Mejorar plan",
      signOut: "Cerrar sesiÃ³n",
      openMenu: "Abrir menÃº",
      closeMenu: "Cerrar menÃº",
      decisionWorkspace: "Espacio Bidvera",
      yourCompany: "Tu empresa",
      workspace: "Espacio de trabajo",
    },
    dashboard: {
      eyebrow: "Resumen ejecutivo",
      title: "Panel",
      subtitle:
        "QuÃ© hacer a continuaciÃ³n, quÃ© licitaciones vale la pena perseguir y quÃ© te bloquea.",
      analyzeCta: "Analizar licitaciÃ³n",
      activeTenders: "Licitaciones activas",
      inPipeline: "En pipeline",
      bid: "Ofertar",
      pursue: "Perseguir",
      review: "Revisar",
      verifyFirst: "Verificar primero",
      noBid: "No ofertar",
      skipEffort: "Evitar el esfuerzo",
      upcomingDeadlines: "PrÃ³ximos plazos",
      upcomingEmpty: "No hay plazos en las prÃ³ximas dos semanas.",
      upcomingCalendarDeadlines: "PrÃ³ximos plazos",
      upcomingCalendarHint:
        "From Tender Calendar â€” same deadlines shown in the calendar module",
      upcomingCalendarEmpty: "AÃºn no hay plazos prÃ³ximos en el calendario.",
      addCalendarTender: "AÃ±adir una licitaciÃ³n al calendario",
      highRisk: "Licitaciones de alto riesgo",
      highRiskEmpty: "No hay licitaciones de riesgo alto o crÃ­tico ahora.",
      recentAnalyses: "AnÃ¡lisis recientes",
      recentEmpty:
        "AÃºn no hay anÃ¡lisis. Sube una licitaciÃ³n para obtener tu primera decisiÃ³n.",
      viewAll: "Ver todo",
      due: "Vence",
      analyzed: "Analizado",
      decisionDistribution: "DistribuciÃ³n de decisiones",
      decisionDistributionHint: "ProporciÃ³n de resultados BID / REVIEW / NO-BID",
      upcomingHint: "Licitaciones aÃºn en el calendario",
      uploadTender: "Subir una licitaciÃ³n",
      riskOverview: "Resumen de riesgos",
      riskOverviewHint: "ExposiciÃ³n crÃ­tica o alta a descalificaciÃ³n",
      recentHint: "Ãšltimos resultados de seguir / no seguir",
      platformTitle: "QuÃ© puedes hacer en Bidvera",
      platformHint: "Four capabilities in one product â€” open any module to continue.",
      capabilityAnalysisDesc: "Sube paquetes y obtÃ©n decisiones go / no-go.",
      capabilityComplianceDesc: "Controla documentos empresariales y recordatorios de caducidad.",
      capabilityQualificationDesc:
        "Supplier readiness for bids and questionnaires â€” not your workspace Company Profile.",
      capabilityCalendarDesc: "Sigue plazos de oportunidades y recordatorios.",
      capabilityOpen: "Abrir",
      capabilityGetStarted: "Empezar",
      capabilityUpgrade: "Mejora el plan para desbloquear",
      statusAnalyses: "{count} anÃ¡lisis",
      statusDocuments: "{count} documentos",
      statusCompleteness: "{percent}% completo",
      statusDeadlines: "{count} prÃ³ximos",
      statusLocked: "No incluido en tu plan actual",
      gettingStartedTitle: "PrÃ³ximos pasos sugeridos",
      gettingStartedHint: "Pick any path â€” you can come back anytime.",
    },
    onboarding: {
      signOutHint: "Cuenta",
      stepVerify: "Verificar email",
      stepCompany: "Empresa",
      stepPlan: "Plan",
      verifyTitle: "Verifica tu email",
      verifyBody: "Enviamos un enlace a",
      resend: "Reenviar verificaciÃ³n",
      resent: "Email de verificaciÃ³n enviado.",
      verifyInvalidTitle: "Enlace invÃ¡lido o caducado",
      verifyInvalidBody: "Solicita un nuevo email desde el onboarding.",
      companyTitle: "CuÃ©ntanos sobre tu empresa",
      companyBody:
        "Esto ayuda a Bidvera a evaluar quÃ© tan bien encaja una licitaciÃ³n con tu negocio.",
      companyName: "Nombre de la empresa",
      country: "PaÃ­s / ubicaciÃ³n de negocio",
      industry: "Industria / sector",
      companySize: "TamaÃ±o de la empresa",
      services: "Servicios / capacidades principales",
      servicesHint: "AÃ±ade varias etiquetas â€” pulsa Enter despuÃ©s de cada una.",
      experience: "Nivel de experiencia",
      experienceOptional: "opcional",
      privacyNote:
        "Solo usamos esta informaciÃ³n para personalizar Bidvera y mejorar el anÃ¡lisis de encaje. No necesitamos datos sensibles de la empresa ni personales.",
      companySubmit: "Continuar",
      companySkip: "Omitir por ahora",
      planTitle: "Elige cÃ³mo empezar",
      planBody: "Empieza con Free Workspace o elige un plan de pago. Los planes Stripe elegibles incluyen 14 dÃ­as de prueba.",
      trialTitle: "Prueba de 14 dÃ­as",
      trialBody: "Se requiere un mÃ©todo de pago. Sin cargo hoy. El plan elegido empieza automÃ¡ticamente si no cancelas.",
      trialCta: "Empezar prueba de 14 dÃ­as",
      paidCta: "Empezar suscripciÃ³n",
      freeTitle: "Free Workspace",
      freeBody: "Empieza gratis. Construye el espacio de tu empresa. Limitado al perfil y al cumplimiento documental.",
      freeCta: "Empezar Free Workspace",
      noChargeToday: "Sin cargo hoy",
      paymentMethodRequired: "Se requiere un mÃ©todo de pago",
      cancelBeforeTrial: "Cancela antes de que termine la prueba para evitar el cobro.",
      monthly: "Mensual",
      yearly: "Anual",
      checkoutCanceled: "Pago cancelado. Puedes intentarlo de nuevo.",
      checkoutPending: "Pago recibido â€” activandoâ€¦",
    },
    companyProfile: {
      title: "Perfil de empresa",
      subtitle:
        "Se usa para el encaje empresaâ€“licitaciÃ³n en anÃ¡lisis futuros. Privado para tu organizaciÃ³n: no se requieren datos personales o financieros sensibles.",
      headerHint:
        "Mejora la calidad del encaje con el tiempo. Los cambios se aplican solo a anÃ¡lisis futuros.",
      supplierQualificationHint:
        "Â¿Necesitas datos de registro y evidencias listos para ofertar? Usa",
      supplierQualificationLink: "CalificaciÃ³n de proveedor",
      companyName: "Nombre de la empresa",
      completeness: "Completitud",
      savedTitle: "Guardado",
      savedBody:
        "Perfil actualizado. El anÃ¡lisis usarÃ¡ los datos mÃ¡s recientes en la prÃ³xima licitaciÃ³n.",
      saveErrorTitle: "No se pudo guardar",
      basicsTitle: "Datos bÃ¡sicos",
      basicsBody:
        "Solo para anÃ¡lisis de encaje â€” sin datos personales o financieros sensibles.",
      industry: "Sector",
      country: "PaÃ­s",
      companySize: "TamaÃ±o de empresa",
      notProvided: "No indicado",
      experienceLevel: "Nivel de experiencia (opcional)",
      experienceYears: "AÃ±os de experiencia (opcional)",
      experienceYearsPlaceholder: "p. ej. 5",
      revenueRange: "Rango de ingresos (opcional)",
      revenuePlaceholder: "p. ej. Â£2mâ€“Â£5m",
      employees: "Empleados (opcional)",
      employeesPlaceholder: "p. ej. 50â€“100",
      sizeSolo: "AutÃ³nomo",
      sizeSmall: "PequeÃ±a",
      sizeMedium: "Mediana",
      sizeEnterprise: "Grande",
      expNew: "Nueva / experiencia limitada",
      expSome: "Algo de experiencia",
      expExperienced: "Con experiencia",
      expHighly: "Muy experimentada",
      capabilitiesTitle: "Capacidades y cobertura",
      services: "Servicios",
      certifications: "Certificaciones",
      geographicCoverage: "Cobertura geogrÃ¡fica",
      commaSeparated: "Separados por comas",
      contractTitle: "Preferencias de contrato",
      contractMin: "TamaÃ±o mÃ­nimo de contrato (Â£)",
      contractMax: "TamaÃ±o mÃ¡ximo de contrato (Â£)",
      rulesTitle: "Reglas de cualificaciÃ³n personalizadas",
      rulesBody: "Una regla por lÃ­nea. Se usan como filtros en el anÃ¡lisis.",
      save: "Guardar perfil",
      learningTitle: "Consentimiento de aprendizaje global",
      learningBody:
        "Si estÃ¡ activado, Bidvera puede aportar patrones de resultado filtrados por privacidad (nunca nombres de empresa, documentos, estrategias ni historiales identificables) a la capa global. Tus resultados privados siguen aislados por organizaciÃ³n. Puedes optar por no participar en cualquier momento.",
      learningCheckbox:
        "Aportar resultados anonimizados a patrones globales verificados",
      learningSaving: "(guardandoâ€¦)",
    },
    billing: {
      title: "FacturaciÃ³n",
      subtitle: "Plan actual, renovaciÃ³n, historial de pagos y facturas.",
      activatedTitle: "SuscripciÃ³n activada",
      activatedBody: "Tu plan ya estÃ¡ activo. Los lÃ­mites se actualizan de inmediato.",
      trialEndedTitle: "Prueba finalizada",
      trialEndedBody:
        "Tu prueba gratuita ha terminado. El anÃ¡lisis de licitaciones no estarÃ¡ disponible hasta que mejores el plan.",
      viewPlans: "Ver planes â†’",
      currentPlanTitle: "Plan actual",
      currentPlanBody: "Estado de la suscripciÃ³n y ciclo de facturaciÃ³n",
      plan: "Plan",
      status: "Estado",
      provider: "Proveedor",
      billingCycle: "Ciclo de facturaciÃ³n",
      renewal: "RenovaciÃ³n",
      paymentMethod: "MÃ©todo de pago",
      changePlan: "Cambiar plan",
      upgradePlan: "Mejorar plan",
      cancelSubscription: "Cancelar suscripciÃ³n",
      cancelScheduled: "CancelaciÃ³n programada al final del periodo.",
      upgradesTitle: "Mejoras disponibles",
      upgradesBody: "{count} planes visibles con pasarelas activas",
      upgradesBodyOne: "1 plan visible con pasarelas activas",
      openCheckout: "Abrir pago â†’",
      paymentHistory: "Historial de pagos",
      noPayments: "AÃºn no hay pagos.",
      invoices: "Facturas",
      noInvoices: "AÃºn no hay facturas.",
      viewInvoice: "Ver",
      trialFallback: "Prueba",
      usageTitle: "Uso del espacio",
      trialUsageTitle: "Uso de la prueba",
      trialEndedDesc:
        "Tu prueba gratuita ha terminado â€” mejora el plan para analizar mÃ¡s licitaciones.",
      unlimitedDesc: "{plan} Â· AnÃ¡lisis ilimitados Â· {status}",
      remainingDesc: "{remaining} de {limit} anÃ¡lisis gratuitos restantes",
      trialEnds: "La prueba termina el {date}",
      expired: "Â· Caducada",
      analysesUsed: "AnÃ¡lisis usados",
      used: "Usados",
      remaining: "Restantes",
      unlimited: "Ilimitados",
      hoursSaved: "Horas estimadas ahorradas",
      risksDetected: "Riesgos detectados",
      upgradeContinue: "Mejorar para continuar",
      runningLow: "Â¿Se agotan?",
      seePlans: "Ver planes",
      trialBadge: "Prueba gratuita de 14 dÃ­as",
      trialEndsIn: "Tu prueba termina en {days} dÃ­as",
      trialEndsInOne: "Tu prueba termina en 1 dÃ­a",
      trialEndingToday: "Tu prueba termina hoy",
      trialEndsOn: "Termina el {date}",
      noChargeToday: "Sin cargo hoy.",
      paymentMethodRequired: "Se requiere un mÃ©todo de pago",
      trialAutoConvert:
        "La suscripciÃ³n elegida comienza automÃ¡ticamente al terminar la prueba, salvo que canceles antes.",
      cancelTrial: "Cancelar prueba",
      cancelTrialTitle: "Â¿Cancelar la prueba?",
      cancelTrialExplainConvert: "La prueba no se convertirÃ¡ en una suscripciÃ³n de pago.",
      cancelTrialExplainAccess: "Al terminar, el acceso seguirÃ¡ las reglas de Free Workspace.",
      cancelTrialExplainData: "Los datos de la empresa se conservan.",
      cancelPaidTitle: "Â¿Cancelar la suscripciÃ³n?",
      cancelPaidExplainDate: "La cancelaciÃ³n se aplica el {date}.",
      cancelPaidExplainAccess: "Conservas el acceso hasta esa fecha.",
      cancelPaidExplainAfter:
        "DespuÃ©s, el espacio pasa a Free Workspace. No se eliminan documentos, solicitudes, evidencias ni el historial.",
      confirmCancel: "Confirmar cancelaciÃ³n",
      keepPlan: "Mantener el plan",
      cancellationDate: "Fecha de cancelaciÃ³n",
      accessUntil: "El acceso sigue disponible hasta el {date}.",
      freeWorkspace: "Free Workspace",
      freeWorkspaceBody:
        "Un espacio limitado. Incluye Company Profile y Document Compliance limitado. Las capacidades de pago no estÃ¡n incluidas.",
      freeCapabilityProfile: "Company Profile",
      freeCapabilityCompliance: "Document Compliance (limitado)",
      nextBillingDate: "PrÃ³xima fecha de facturaciÃ³n",
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
      analysesUsage: "AnÃ¡lisis",
      analysesNotIncluded: "No incluido",
      cancelError: "No se pudo cancelar ahora. IntÃ©ntalo de nuevo o contacta con soporte.",
      started: "Inicio",
      paypalMethod: "PayPal",
      graceTitle: "Problema de pago â€” periodo de gracia",
      graceBody:
        "El pago fallÃ³. El acceso continÃºa hasta el {date}. Actualiza la facturaciÃ³n para evitar la interrupciÃ³n.",
      inactiveTitle: "SuscripciÃ³n inactiva",
      inactiveBody:
        "Tu suscripciÃ³n no estÃ¡ activa. Los datos de la empresa se conservan. Renueva o mejora el plan para recuperar las capacidades de pago.",
      billingHistory: "Historial de facturaciÃ³n",
      billingHistoryEmpty:
        "AÃºn no hay facturas. AparecerÃ¡n aquÃ­ tras un cargo correcto o fallido.",
      invoiceDate: "Fecha",
      invoiceAmount: "Importe",
      invoiceStatus: "Estado",
      viewReceipt: "Ver recibo",
      updatePaymentMethod: "Actualizar mÃ©todo de pago",
      retryPayment: "Resolver el pago",
      paymentProblemTitle: "Problema de pago",
      paymentProblemBody:
        "No pudimos cobrar la suscripciÃ³n. Actualiza el mÃ©todo de pago para conservar el acceso.",
      paypalManageHint:
        "PayPal gestiona el mÃ©todo de pago de esta suscripciÃ³n en tu cuenta de PayPal.",
      paymentPortalError:
        "No se pudo abrir la pÃ¡gina de pago segura. IntÃ©ntalo de nuevo o contacta con soporte.",
      canceledAlertTitle: "Tu suscripciÃ³n estÃ¡ cancelada",
      subscriptionEndedTitle: "Tu suscripciÃ³n ha finalizado",
      subscriptionEndedBody:
        "Tu espacio de trabajo estÃ¡ a salvo, pero algunas funciones premium ahora estÃ¡n bloqueadas.",
      choosePlan: "Elegir un plan",
      graceDaysRemaining: "Te quedan {days} dÃ­as para resolver el pago.",
      graceDaysRemainingOne: "Te queda 1 dÃ­a para resolver el pago.",
    },
    alerts: {
      title: "Alertas",
      subtitle: "Plazos, Decision Memory, puntuaciones, requisitos y flujo de trabajo.",
      emptyTitle: "AÃºn no hay alertas",
      emptyDescription: "AquÃ­ verÃ¡s notificaciones de plazos, riesgos y anÃ¡lisis.",
      newBadge: "Nueva",
      markAllRead: "Marcar todo como leÃ­do",
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
      avatarHint: "Se muestra en la barra superior. JPG, PNG, WebP o GIF Â· mÃ¡x. 5 MB.",
      avatarUpload: "Subir foto",
      avatarUploading: "Subiendoâ€¦",
      avatarRemove: "Quitar",
      accountSave: "Guardar cambios",
      accountSaving: "Guardandoâ€¦",
      accountSaved: "Cuenta actualizada.",
      emailChangeHint:
        "Al cambiar el correo se pide tu contraseÃ±a y un enlace de confirmaciÃ³n a la nueva direcciÃ³n.",
      emailChangePending: "ConfirmaciÃ³n pendiente para {email}.",
      emailChangeSent:
        "Revisa {email} para confirmar. Tu correo actual sigue activo hasta que confirmes.",
      emailChangeResend: "Reenviar confirmaciÃ³n",
      emailChangeResent: "ConfirmaciÃ³n reenviada a {email}.",
      emailChangeExpires: "Caduca {when}.",
      emailChangePasswordLabel: "ContraseÃ±a actual",
      emailChangePasswordHint: "Obligatoria para solicitar un cambio de correo.",
      emailChangePasswordRequired: "Introduce tu contraseÃ±a actual para cambiar el correo.",
      emailChangeCancel: "Cancelar cambio de correo",
      emailChangeCancelled: "Cambio de correo cancelado.",
      emailChangeInvalidTitle: "Enlace invÃ¡lido o caducado",
      emailChangeInvalidBody: "Solicita un nuevo enlace desde Ajustes.",
      emailChangeBackSettings: "Volver a Ajustes",
      companyProfileTitle: "Perfil de la empresa",
      companyProfileBody:
        "Sector, tamaÃ±o, servicios, paÃ­s y experiencia usados para el ajuste empresaâ€“licitaciÃ³n en anÃ¡lisis futuros. Privado para tu organizaciÃ³n.",
      editCompanyProfile: "Editar perfil de la empresa",
      notificationsTitle: "Notificaciones",
      notificationsBody:
        "Alertas de plazos y anÃ¡lisis â€” en la app y por correo. WhatsApp / SMS / push se podrÃ¡n conectar mÃ¡s adelante.",
      moduleRemindersTitle: "Programas de recordatorios por mÃ³dulo",
      moduleRemindersBody: "Cumplimiento documental y Calendario tienen sus propios plazos de recordatorio.",
      complianceRemindersLink: "Recordatorios de cumplimiento documental",
      calendarRemindersLink: "Recordatorios del calendario",
      planTitle: "Plan",
      planUnlimited: "Business Â· Ilimitado Â· {used} usados",
      planLimited: "{used}/{limit} anÃ¡lisis usados",
      manageBilling: "Gestionar facturaciÃ³n",
      viewUpgrade: "Ver opciones de mejora",
      signOut: "Cerrar sesiÃ³n",
      revokeOtherSessions: "Cerrar sesiÃ³n en otros dispositivos",
      revokeOtherSessionsHint: "Mantiene esta sesiÃ³n activa.",
      timezone: "Zona horaria de la empresa",
      timezoneHint: "Se usa para el texto de alertas de plazo y la hora local.",
      channels: "Canales",
      channelInApp: "Alertas en la app",
      channelEmail: "Correo",
      channelWhatsapp: "WhatsApp (prÃ³ximamente)",
      channelSms: "SMS (prÃ³ximamente)",
      channelPush: "Push (prÃ³ximamente)",
      deadlineAlerts: "Alertas de plazo",
      deadline7d: "7 dÃ­as antes",
      deadline3d: "3 dÃ­as antes",
      deadline24h: "24 horas antes",
      deadlinePassed: "Plazo vencido",
      otherAlerts: "Otras alertas",
      alertAnalysisDone: "AnÃ¡lisis completado",
      alertHighRisk: "Hallazgos de alto riesgo",
      alertMissingDocs: "Documentos faltantes",
      alertScoreChange: "Cambios de puntuaciÃ³n o decisiÃ³n",
      alertRequirementStatus: "Cambios de estado de requisitos",
      alertDecisionMemory: "Decision Memory relevante",
      alertWorkflow: "Eventos de flujo / paquete",
      prefsSaved: "Preferencias guardadas.",
      savePrefs: "Guardar preferencias de notificaciÃ³n",
    },
    tenders: {
      title: "Licitaciones",
      subtitle: "{count} licitaciones Â· filtrar por decisiÃ³n, riesgo y plazo",
      subtitleOne: "1 licitaciÃ³n Â· filtrar por decisiÃ³n, riesgo y plazo",
      analyzeCta: "Analizar licitaciÃ³n",
      emptyTitle: "AÃºn no hay licitaciones",
      emptyDescription:
        "Sube un ITT o PQQ para obtener una recomendaciÃ³n Bid / Review / No-Bid.",
      search: "Buscar",
      searchPlaceholder: "TÃ­tulo o cliente",
      decision: "DecisiÃ³n",
      allDecisions: "Todas las decisiones",
      bid: "Ofertar",
      review: "Revisar",
      noBid: "No ofertar",
      risk: "Riesgo",
      allRiskLevels: "Todos los niveles",
      low: "Bajo",
      medium: "Medio",
      high: "Alto",
      critical: "CrÃ­tico",
      deadline: "Plazo",
      anyDeadline: "Cualquier plazo",
      next7d: "PrÃ³ximos 7 dÃ­as",
      next14d: "PrÃ³ximos 14 dÃ­as",
      next30d: "PrÃ³ximos 30 dÃ­as",
      overdue: "Vencidas",
      sort: "Orden",
      sortRecent: "Analizadas recientemente",
      sortDeadlineSoon: "Plazo mÃ¡s cercano",
      sortDeadlineLate: "Plazo mÃ¡s lejano",
      sortFit: "PuntuaciÃ³n de ajuste",
      sortTitle: "TÃ­tulo Aâ€“Z",
      colTender: "LicitaciÃ³n",
      colClient: "Cliente",
      colDeadline: "Plazo",
      colFit: "Ajuste",
      colDecision: "DecisiÃ³n",
      colRisk: "Riesgo",
      colAnalyzed: "Analizada",
      colNextAction: "Siguiente acciÃ³n",
      deadlineWithDate: "Plazo {date}",
      fitWithScore: "Ajuste {score}",
      noNextAction: "Sin siguiente acciÃ³n",
    },
    upload: {
      title: "Analizar licitaciÃ³n",
      subtitle:
        "Sube un ITT o PQQ para obtener una recomendaciÃ³n Bid / Review / No-Bid.",
      trialLeft: "Prueba Â· {remaining} anÃ¡lisis restantes",
      trialEnds: " Â· termina {date}",
      phaseIdleTitle: "Sube un paquete de licitaciÃ³n",
      phaseIdleBody:
        "Sube varios archivos o un paquete ZIP/RAR. Nos centramos en la decisiÃ³n de oferta â€” no en un volcado del documento.",
      phaseUploadingTitle: "Subiendoâ€¦",
      phaseUploadingBody: "Transfiriendo tus archivos de forma segura.",
      phaseDiscoveringTitle: "Descubriendo archivosâ€¦",
      phaseDiscoveringBody: "Inventariando cada documento del paquete de licitaciÃ³n.",
      phaseExtractingTitle: "Extrayendo paqueteâ€¦",
      phaseExtractingBody: "Descomprimiendo ZIP/RAR y descubriendo documentos de licitaciÃ³n.",
      phasePreparingTitle: "Preparando documentosâ€¦",
      phasePreparingBody: "Validando archivos y preparando el paquete para el anÃ¡lisis.",
      phaseProcessingTitle: "Procesando documentoâ€¦",
      phaseProcessingBody: "En cola para extracciÃ³n y estructuraciÃ³n de requisitos.",
      phaseAnalyzingTitle: "Analizando ajusteâ€¦",
      phaseAnalyzingBody:
        "Comparando el perfil de la empresa, aplicando reglas y generando una decisiÃ³n.",
      phaseSuccessTitle: "AnÃ¡lisis listo",
      phaseSuccessBody: "Tu paquete de decisiÃ³n estÃ¡ disponible.",
      phaseErrorTitle: "Error al subir",
      phaseErrorBody: "Algo saliÃ³ mal al subir o preparar el paquete. Revisa los archivos e intÃ©ntalo de nuevo.",
      phaseAnalysisErrorTitle: "El anÃ¡lisis no pudo terminar",
      phaseAnalysisErrorBody:
        "Tu paquete se subiÃ³ y preparÃ³ correctamente. El fallo ocurriÃ³ durante el anÃ¡lisis â€” abre la licitaciÃ³n para mÃ¡s detalles.",
      phaseTimeoutBody:
        "Sigue procesÃ¡ndose tras 1 minuto. Abre la licitaciÃ³n en breve â€” el anÃ¡lisis puede terminar en segundo plano.",
      phaseTimeoutTitle: "AÃºn procesando",
      stillWorking: "El anÃ¡lisis continÃºa en segundo plano",
      openTender: "Abrir licitaciÃ³n",
      trialUsedTitle: "AnÃ¡lisis de prueba agotados",
      trialUsedBody: "Mejora el plan para analizar mÃ¡s licitaciones.",
      viewPlans: "Ver planes",
      unlimitedPlan: "AnÃ¡lisis ilimitados en tu plan Business activo",
      remainingAnalyses: "{count} anÃ¡lisis gratuitos restantes",
      dragHere: "Arrastra y suelta archivos o paquetes ZIP/RAR aquÃ­",
      processingTender: "Procesando tu paquete de licitaciÃ³nâ€¦",
      fileTypes: "PDF, Word, Excel, PowerPoint, CSV, TXT, imÃ¡genes, ZIP/RAR Â· hasta {max} archivos por paquete Â· mÃ¡x. {maxFileMb}MB por archivo Â· mÃ¡x. {maxPackageMb}MB por paquete",
      chooseFile: "Elegir archivos",
      filesSelected: "{count} archivos seleccionados",
      maxFilesReached: "Hasta {max} archivos por paquete.",
      filesDiscovered: "{count} archivos descubiertos en el paquete",
      removeFile: "Quitar",
      statusReady: "Listo",
      statusUploading: "Subiendoâ€¦",
      statusDiscovering: "Descubriendoâ€¦",
      statusExtracting: "Extrayendoâ€¦",
      statusPreparing: "Preparandoâ€¦",
      statusProcessing: "Procesandoâ€¦",
      statusAnalyzing: "Analizandoâ€¦",
      startUpload: "Subir y analizar",
      waitForUpload: "Espera a que termine la subida actual antes de aÃ±adir mÃ¡s archivos.",
      bodyTooLarge:
        "El paquete de licitaciÃ³n es demasiado grande para esta solicitud. Prueba con menos archivos, o reinicia la app tras el aumento del lÃ­mite e intÃ©ntalo de nuevo.",
      decisionReady: "DecisiÃ³n lista â€” abre el paquete abajo.",
      unableContinue: "No se puede continuar",
      openDecision: "Abrir decisiÃ³n",
      uploadAnother: "Subir otra",
      tryAgain: "Reintentar",
      creditsExhausted: "Has usado todos los anÃ¡lisis gratuitos. Mejora el plan para continuar.",
      passwordRequiredTitle: "ContraseÃ±a requerida",
      passwordRequiredBody:
        "Este archivo estÃ¡ protegido con contraseÃ±a. IntrodÃºcela para continuar.",
      passwordLabel: "ContraseÃ±a del archivo",
      passwordSubmit: "Desbloquear y continuar",
      passwordCancel: "Cancelar",
      passwordWrong: "ContraseÃ±a incorrecta. IntÃ©ntalo de nuevo.",
      intakeRepairedTitle: "Reparado automÃ¡ticamente",
      intakePartialTitle: "Parcialmente legible",
      intakeIncompleteTitle: "Paquete incompleto",
      intakeReadyTitle: "Listo para analizar",
      intakeBlockedTitle: "AnÃ¡lisis bloqueado",
      intakeUnsupportedTitle: "Formato no compatible",
      intakeCorruptedTitle: "Archivo daÃ±ado",
      intakePartiallyReadableTitle: "Parcialmente legible2",
    },
    tenderDetail: {
      backToTenders: "â† Licitaciones",
      unknownClient: "Cliente desconocido",
      deadline: "Plazo",
      analyzed: "Analizado",
      fullReport: "Informe completo",
      analysisInProgressTitle: "AnÃ¡lisis en curso",
      analysisInProgressBody:
        "Estado: {status}. Actualiza en breve â€” el procesamiento estÃ¡ en marcha.",
      analysisFailedTitle: "AnÃ¡lisis fallido",
      analysisFailedBody:
        "El procesamiento terminÃ³ en un fallo terminal. Consulta el detalle del error abajo.",
      analysisFailedPhase: "Se detuvo en la fase: {phase}",
      canonicalNote:
        "AnÃ¡lisis canÃ³nico â€” los mismos requisitos, cumplimiento, ajuste, preparaciÃ³n, riesgos, Bid Score y recomendaciÃ³n para cada usuario autorizado. Los roles solo controlan el acceso.",
      missingDocuments: "Documentos faltantes",
      required: "Obligatorio",
      nextActions: "Siguientes acciones",
      noNextActions: "No hay acciones recomendadas para esta decisiÃ³n.",
      teamWorkflow: {
        title: "Flujo de decisiÃ³n del equipo",
        subtitle:
          "Asigna requisitos, riesgos y evidencia faltante a Finanzas, Legal, TÃ©cnico y otros. Las respuestas son evidencia â€” no cambian automÃ¡ticamente el Decision Engine.",
        empty: "AÃºn no hay tareas de equipo.",
        criticalBanner: "{count} tarea(s) crÃ­tica(s) sin resolver antes de la decisiÃ³n final.",
        assign: "Asignar",
        respond: "Guardar respuesta",
        complete: "Completar con respuesta",
        create: "Crear tarea",
        responsePlaceholder: "Respuesta verificada (no inventar)â€¦",
        evidencePlaceholder: "Nota de evidencia (opcional)â€¦",
        department: "Departamento",
        assignee: "Asignado",
        requiredResponse: "Respuesta requerida",
        linkedItem: "Elemento vinculado",
      },
      decisionSupport: "Apoyo a la decisiÃ³n",
      fitSuffix: "Ajuste",
      overallFit: "Ajuste general",
      confidence: "Confianza",
      confidenceHigh: "ALTA",
      confidenceMedium: "MEDIA",
      confidenceLow: "BAJA",
      heroBidLabel: "Bidvera recomienda ofertar",
      heroBidHint:
        "SegÃºn la informaciÃ³n disponible, el ajuste apoya invertir esfuerzo â€” verifica antes de presentar.",
      heroReviewLabel: "Bidvera recomienda revisar",
      heroReviewHint:
        "La ambigÃ¼edad, lagunas o desconocidos requieren confirmaciÃ³n humana antes de comprometerse.",
      heroNoBidLabel: "Bidvera recomienda no ofertar",
      heroNoBidHint:
        "SegÃºn los datos disponibles, las brechas crÃ­ticas hacen poco rentable el esfuerzo â€” confirma con tu equipo.",
      companyTenderFit: "Ajuste empresaâ€“licitaciÃ³n",
      unknown: "Desconocido",
      basisAi: " Â· EvaluaciÃ³n IA",
      basisNotProvided: " Â· No facilitado",
      basisFromProfile: " Â· Del perfil de la empresa",
      basisFromTender: " Â· De la licitaciÃ³n",
      tenderReadiness: "PreparaciÃ³n de la licitaciÃ³n",
      readinessCounts: "{ready} listos Â· {verify} verificar Â· {missing} faltantes",
      recommendation: "RecomendaciÃ³n:",
      keyBlockers: "Bloqueos clave",
      keyBlockersNext:
        "Siguiente paso: resuelve los problemas destacados antes de la decisiÃ³n final.",
      whyTitle: "Â¿Por quÃ© esta recomendaciÃ³n?",
      executiveSummary: "Resumen ejecutivo",
      viewDetails: "Ver detalles",
      hideDetails: "Ocultar detalles",
      topReasons: "Razones clave",
      criticalAlerts: "Elementos crÃ­ticos",
      whatToDoNext: "QuÃ© hacer ahora",
      decisionDisclaimer:
        "Bidvera ofrece una recomendaciÃ³n basada en evidencia. La decisiÃ³n final corresponde a su empresa.",
      expiredDeadlineAlert:
        "El plazo de presentaciÃ³n ha vencido â€” confirme si la licitaciÃ³n sigue abierta.",
      mandatoryGapAlert: "Brecha obligatoria",
      missingDocumentAlert: "Documento faltante",
      detailedAnalysisTitle: "AnÃ¡lisis detallado",
      detailedAnalysisHint:
        "Requisitos, cumplimiento, evidencia, riesgos, ajuste y flujo de trabajo â€” mismos datos canÃ³nicos que el informe.",
    },
    report: {
      backToTender: "â† LicitaciÃ³n",
      title: "Informe de anÃ¡lisis",
      subtitle:
        "Paquete completo de decisiÃ³n â€” ver, imprimir, descargar PDF o compartir un enlace de solo lectura.",
      reportNotReady: "Informe no listo",
      reportNotReadyBody:
        "Este informe aÃºn no estÃ¡ listo. IntÃ©ntalo de nuevo en unos momentos.",
      print: "Imprimir",
      downloadPdf: "Descargar PDF",
      shareLink: "Compartir enlace",
      copied: "Copiado.",
      shareExpires: "Caduca en 72 h Â· solo lectura:",
      revokeShare: "Revocar enlaces compartidos",
      shareRevoked: "Enlaces compartidos revocados.",
      reportEyebrow: "Informe de decisiÃ³n Bidvera",
      unknownClient: "Cliente desconocido",
      deadline: "Fecha lÃ­mite",
      analyzed: "Analizado",
      recommendation: "RecomendaciÃ³n",
      companyTenderFit: "Ajuste empresaâ€“licitaciÃ³n",
      confidence: "Confianza",
      whyTitle: "Por quÃ© esta recomendaciÃ³n",
      bidScore: "PuntuaciÃ³n de oferta",
      bidScoreLine: "PuntuaciÃ³n: {score}/100 â€” {priority}",
      expectedValue: "Valor esperado:",
      risk: "Riesgo:",
      effort: "Esfuerzo:",
      positive: "Positivo",
      negative: "Negativo",
      overall: "Total",
      unknown: "Desconocido",
      tenderReadiness: "PreparaciÃ³n de la licitaciÃ³n",
      readinessCounts: "{ready} listos Â· {verify} verificar Â· {missing} faltantes",
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
      page: "PÃ¡gina {n}",
      sourceNotLocated: "No se pudo ubicar la fuente con precisiÃ³n.",
      noRequirements: "No se extrajeron requisitos para esta licitaciÃ³n.",
      missingRequirements: "Requisitos faltantes",
      noMissingRequirements: "No se identificaron requisitos faltantes.",
      mandatoryParen: " (obligatorio)",
      verificationItems: "Elementos a verificar",
      nothingPendingVerify: "Nada pendiente de verificaciÃ³n.",
      risks: "Riesgos",
      noRisks: "No se seÃ±alaron riesgos significativos.",
      clarifications: "Preguntas de aclaraciÃ³n",
      noClarifications:
        "No se generaron preguntas de aclaraciÃ³n â€” no se detectÃ³ ambigÃ¼edad relevante.",
      reason: "Motivo:",
      source: "Fuente:",
      evidence: "Evidencia",
      noEvidence: "No hay extractos de fuente disponibles.",
      historicalTitle: "Inteligencia histÃ³rica relevante",
      historicalBody:
        "Resultados histÃ³ricos similares pueden aportar una seÃ±al Ãºtil para esta oportunidad. Es una seÃ±al adicional â€” no una garantÃ­a de Ã©xito o fracaso.",
      historicalPriority:
        "La evidencia de la licitaciÃ³n actual y el perfil de tu empresa siempre tienen prioridad.",
      historicalEmpty:
        "AÃºn no aplica ningÃºn patrÃ³n histÃ³rico verificado a esta oportunidad.",
      decisionMemoryTitle: "Memoria de decisiÃ³n",
      currentAnalysisLabel: "AnÃ¡lisis actual",
      historicalDecisionLabel: "DecisiÃ³n histÃ³rica",
      decisionMemoryCurrentNote:
        "Las puntuaciones, requisitos y la recomendaciÃ³n anteriores son autoritativos para esta licitaciÃ³n y no cambian con el historial.",
      decisionMemoryEmpty: "AÃºn no hay decisiones previas relevantes para esta oportunidad.",
      relevanceReasons: "Por quÃ© es relevante",
      missingDocuments: "Documentos faltantes",
      nextActions: "PrÃ³ximas acciones recomendadas",
      noNextActions: "No hay acciones recomendadas.",
      basisDirect: "Fuente directa",
      basisAi: "InterpretaciÃ³n de IA",
      basisUncertain: "Fuente incierta",
      evidenceVerificationTitle: "Evidencia y verificaciÃ³n",
      evidenceVerificationDisclaimer:
        "La verificaciÃ³n refleja Ãºnicamente evidencia registrada y revisiÃ³n humana. Las interpretaciones de IA nunca se tratan como verificadas.",
      verificationSummary:
        "{verified} verificados Â· {needs} requieren verificaciÃ³n Â· {missing} sin evidencia Â· {na} no aplicable",
      noVerificationChains: "No hay cadenas de verificaciÃ³n disponibles para esta licitaciÃ³n.",
      verificationStatusVerified: "Verificado",
      verificationStatusNeedsVerification: "Requiere verificaciÃ³n",
      verificationStatusMissingEvidence: "Sin evidencia",
      verificationStatusNotApplicable: "No aplicable",
      verifierLabel: "Verificador:",
      verifiedAtLabel: "Verificado el:",
      decisionOutcomeTitle: "Resultado de la decisiÃ³n",
      decisionOutcomeBidvera: "DecisiÃ³n de Bidvera",
      decisionOutcomeHuman: "DecisiÃ³n humana final",
      decisionOutcomeActual: "Resultado real",
      decisionOutcomeDate: "Fecha del resultado",
      decisionOutcomeReason: "Motivo del resultado",
      decisionOutcomeSuccess: "DecisiÃ³n vs resultado",
      decisionOutcomeSuccessAligned: "La decisiÃ³n original coincidiÃ³ con el resultado",
      decisionOutcomeSuccessMisaligned: "La decisiÃ³n original no coincidiÃ³ con el resultado",
      decisionOutcomeSuccessPending: "Resultado aÃºn pendiente",
      decisionOutcomeSuccessNeutral: "Neutral respecto a la decisiÃ³n original",
      decisionOutcomeRecorded: "Resultado registrado",
      outcomeLearningTitle: "Inteligencia histÃ³rica basada en resultados",
      decisionOutcomeAttachment: "Documento de respaldo",
      decisionOutcomeEvalSuccessful: "Exitoso",
      decisionOutcomeEvalUnsuccessful: "No exitoso",
      decisionOutcomeEvalNotEvaluated: "No evaluado",
    },
    decisionMemory: {
      title: "Memoria de decisiÃ³n",
      subtitle:
        "Decisiones previas de tu empresa â€” solo referencia. Nunca cambia el anÃ¡lisis actual.",
      emptyTitle: "AÃºn no hay decisiones guardadas",
      emptyDescription:
        "Los anÃ¡lisis completados aparecen aquÃ­ automÃ¡ticamente. Abre una licitaciÃ³n para ver AnÃ¡lisis actual frente a DecisiÃ³n histÃ³rica.",
      emptyDescriptionCompanyContext:
        "Las decisiones almacenadas aparecen aquÃ­ cuando Decision Intelligence registra un resultado para tu empresa. MantÃ©n cualificaciones y evidencia al dÃ­a para dar contexto sÃ³lido a futuras decisiones.",
      viewTender: "Abrir licitaciÃ³n",
      openCompanyProfile: "Abrir perfil de empresa",
      analyzed: "Analizado",
      scores: "Puntuaciones",
      requirements: "Requisitos",
      risks: "Riesgos",
      reasoning: "Razonamiento",
      relevance: "Relevancia",
      disclaimer:
        "DecisiÃ³n histÃ³rica â€” solo referencia. No cambia las puntuaciones ni la recomendaciÃ³n del AnÃ¡lisis actual.",
      back: "Volver a Memoria de decisiÃ³n",
    },
    pwa: {
      availableOn: "Disponible en Windows y macOS",
      updateTitle: "ActualizaciÃ³n lista",
      updateBody: "Hay una versiÃ³n nueva de Bidvera de escritorio. Recarga para aplicarla.",
      updateNow: "Actualizar ahora",
      installedTitle: "Bidvera estÃ¡ instalada",
      installedBody:
        "EstÃ¡s en modo aplicaciÃ³n de escritorio â€” acceso mÃ¡s rÃ¡pido desde el dock o la barra de tareas.",
      title: "Instala Bidvera como app de escritorio",
      bodyBefore: "Funciona en",
      bodyAnd: "y",
      bodyAfter: "â€” se abre en su propia ventana, sin App Store.",
      installCta: "Instalar Bidvera",
      openingInstaller: "Abriendo instaladorâ€¦",
      dismiss: "Cerrar",
      guideTitleSafari: "Instalar Bidvera en Safari",
      guideTitleEdge: "Instalar Bidvera en Edge",
      guideTitleChrome: "Instalar Bidvera en Chrome",
      guideTitleDefault: "Instalar Bidvera",
      guideDescription: "Sigue estos pasos para aÃ±adir Bidvera como app de escritorio.",
      desktopMeta: "App de escritorio Â· Windows y macOS",
      openInstallDialog: "Abrir diÃ¡logo de instalaciÃ³n",
      gotIt: "Entendido",
      iosStep1: "Toca el botÃ³n Compartir en Safari.",
      iosStep2: "Elige",
      iosStep2Strong: "AÃ±adir a pantalla de inicio",
      iosStep3: "Confirma â€” Bidvera se abre a pantalla completa desde el inicio.",
      safariMacStep1: "En la barra de menÃº abre",
      safariMacStep1Strong: "Archivo",
      safariMacStep2: "Elige",
      safariMacStep2Strong: "AÃ±adir al Dock",
      safariMacStep3: "Confirma â€” Bidvera aparece en el Dock como una app de Mac.",
      chromiumStep1Before: "Mira a la derecha de la barra de direcciones de {browser} el icono",
      chromiumStep1Strong: "instalar / ordenador",
      chromiumStep1After: ".",
      chromiumStep2Before: "Haz clic y elige",
      chromiumStep2Strong: "Instalar",
      chromiumStep3Before: "O abre el menÃº del navegador â†’",
      chromiumStep3Install: "Instalar Bidvera",
      chromiumStep3Mid: "/",
      chromiumStep3Apps: "Apps â†’ Instalar este sitio como una aplicaciÃ³n",
    },
  },
};

const zh: Dictionary = {
  nav: {
    product: "äº§å“",
    pricing: "å®šä»·",
    faq: "å¸¸è§é—®é¢˜",
    solutions: "è§£å†³æ–¹æ¡ˆ",
    resources: "èµ„æº",
    signIn: "ç™»å½•",
    startFree: "å…è´¹å¼€å§‹",
    app: "åº”ç”¨",
    language: "è¯­è¨€",
  },
  brand: {
    tagline: "çŸ¥é“è¯¥è¿½æ±‚ä»€ä¹ˆã€‚çŸ¥é“è‡ªå·±å‡†å¤‡å¥½äº†ä»€ä¹ˆã€‚",
    description:
      "Bidvera å¸®åŠ©ä¼ä¸šç†è§£å°±ç»ªåº¦ï¼Œç®¡ç†åˆè§„ä¸Žèµ„è´¨ï¼Œæ•´ç†è¯æ®ï¼Œå‘çŽ°ç›¸å…³æœºä¼šï¼Œå¹¶åšå‡ºå¯è§£é‡Šçš„å†³ç­–ã€‚",
  },
  legal: {
    footerHeading: "æ³•å¾‹ä¿¡æ¯",
    privacyLink: "éšç§æ”¿ç­–",
    termsLink: "æœåŠ¡æ¡æ¬¾",
    privacyEyebrow: "æ³•å¾‹ä¿¡æ¯",
    privacyTitle: "éšç§æ”¿ç­–",
    privacyMetaDescription:
      "Bidvera å¦‚ä½•å¤„ç†è´¦æˆ·ã€å·¥ä½œåŒºã€æ–‡æ¡£ã€è®¡è´¹ã€Google ç™»å½•ä¸Žå®‰å…¨ç›¸å…³çš„ä¸ªäººæ•°æ®ï¼ˆgetbidvera.comï¼‰ã€‚",
    termsEyebrow: "æ³•å¾‹ä¿¡æ¯",
    termsTitle: "æœåŠ¡æ¡æ¬¾",
    termsMetaDescription:
      "Bidvera SaaS å¹³å°ä½¿ç”¨æ¡æ¬¾ï¼Œæ¶µç›–è´¦æˆ·ã€AI è¾“å‡ºã€è®¢é˜…ä¸Žå¯æŽ¥å—ä½¿ç”¨ã€‚",
    effectiveDateLabel: "ç”Ÿæ•ˆæ—¥æœŸ",
    lastUpdatedLabel: "æœ€åŽæ›´æ–°",
    onThisPage: "æœ¬é¡µå†…å®¹",
    relatedDocuments: "ç›¸å…³é“¾æŽ¥",
  },
  landing: {
    headline: "çŸ¥é“è¯¥è¿½æ±‚ä»€ä¹ˆã€‚çŸ¥é“è‡ªå·±å‡†å¤‡å¥½äº†ä»€ä¹ˆã€‚",
    subhead:
      "Bidvera å¸®åŠ©ä¸šåŠ¡å›¢é˜Ÿç†è§£ä¼ä¸šå°±ç»ªåº¦ï¼Œç®¡ç†åˆè§„ä¸Žèµ„è´¨ï¼Œæ•´ç†è¯æ®ï¼Œè¯„ä¼°ç›¸å…³å·¥ä½œï¼Œå¹¶å°†å¯è§£é‡Šçš„å†³ç­–è½¬åŒ–ä¸ºæ¸…æ™°çš„ä¸‹ä¸€æ­¥ã€‚",
    ctaPrimary: "æŽ¢ç´¢ Bidvera",
    ctaSecondary: "äº†è§£è¿ä½œæ–¹å¼",
    trialNote: "å°±ç»ªåº¦ Â· æœºä¼š Â· è¯æ® Â· å†³ç­– Â· è¡ŒåŠ¨",
    previewLabel: "å†³ç­–æƒ…æŠ¥",
    previewQuestion: "æ˜¯å¦å€¼å¾—è·Ÿè¿›ï¼Ÿ",
    previewDecision: "REVIEW",
    previewFit: "å°±ç»ªåº¦åŒ¹é…è‰¯å¥½",
    previewRisk: "è¯æ®å·²æ ¸éªŒ",
    previewRiskValue: "3 é¡¹è¦æ±‚å·²ç¡®è®¤",
    previewMissing: "éœ€è¦å…³æ³¨",
    previewMissingValue: "1 é¡¹èµ„è´¨å¾…æ ¸éªŒ",
    previewNext: "ä¸‹ä¸€æ­¥",
    previewNextValue: "ç¡®è®¤å°šæœªé½å¤‡çš„è¯æ®",
    previewWhy: "èµ„è´¨çœ‹èµ·æ¥å……åˆ†ã€‚å›¢é˜Ÿæ‰¿è¯ºå‰ä»æœ‰ä¸€é¡¹éœ€è¦æ ¸éªŒã€‚",
    sectionTitle: "ä¼ä¸šä¸ºä»€ä¹ˆä½¿ç”¨ Bidvera",
    sectionBody:
      "ä¸å¿…å†ä»Žæ–‡ä»¶å¤¹ã€é‚®ä»¶å’Œè¡¨æ ¼æ‹¼å‡‘å°±ç»ªåº¦ã€‚Bidvera ä¸ºå…¬å¸ä¿¡æ¯ã€è¯æ®ã€å†³ç­–ä¸Žè·Ÿè¿›æä¾›ç»“æž„åŒ–å·¥ä½œåŒºã€‚",
    feature1Title: "äº†è§£å°±ç»ªåº¦",
    feature1Body: "æŒç»­æ•´ç†å…¬å¸ä¿¡æ¯ã€èµ„è´¨ä¸Žåˆè§„è¯æ®ã€‚",
    feature2Title: "æ•´ç†ç›¸å…³å·¥ä½œ",
    feature2Body: "è®°å½•å®¢æˆ·è¯·æ±‚ä¸Žæ—¥åŽ†æˆªæ­¢æ—¥æœŸï¼Œå¹¶å¯¹ç…§çœŸå®žäº¤ä»˜èƒ½åŠ›è¯„ä¼°è¦æ±‚ã€‚",
    feature3Title: "è‡ªä¿¡è¡ŒåŠ¨",
    feature3Body: "åšå‡ºå¯è§£é‡Šçš„å†³ç­–ï¼Œåˆ†é…ä¸‹ä¸€æ­¥ï¼Œå¹¶ä¿æŒå›¢é˜Ÿä¸€è‡´ã€‚",
    capabilitiesTitle: "å…«é¡¹èƒ½åŠ›ï¼šå°±ç»ªåº¦ã€æœºä¼šä¸Žè¡ŒåŠ¨",
    capabilitiesLearnMore: "äº†è§£æ›´å¤š",
    capabilitiesShowLess: "æ”¶èµ·",
    capabilities: [
      {
        title: "å…¬å¸èµ„æ–™",
        body: "åœ¨ä¸€ä¸ªå·¥ä½œåŒºæ•´ç†ä¼ä¸šèº«ä»½ã€æœåŠ¡ä¸Žå°±ç»ªä¿¡æ¯ã€‚",
        detail:
          "è®°å½•è¡Œä¸šã€æœåŠ¡ã€åœ°ç†ä¸Žè§„æ¨¡ï¼Œè®©å›¢é˜Ÿå…±äº«å…¬å¸çŽ°çŠ¶ã€‚è¯¥åŸºç¡€æ”¯æ’‘èµ„è´¨ã€è¯æ®ä¸Žæœºä¼šè¯„å®¡ã€‚",
      },
      {
        title: "æ–‡ä»¶åˆè§„",
        body: "è·Ÿè¸ªå…³é”®å…¬å¸æ–‡ä»¶ä¸Žåˆ°æœŸæ—¥ï¼Œé¿å…æˆä¸ºå¡ç‚¹ã€‚",
        detail:
          "åœ¨å®‰å…¨å·¥ä½œåŒºå­˜æ”¾è¯ç…§ä¸Žä¿é™©ï¼Œç›‘æŽ§æœ‰æ•ˆæœŸï¼Œå¹¶åœ¨è¿‡æœŸå‰çœ‹åˆ°å¾…åŠžäº‹é¡¹ã€‚",
      },
      {
        title: "ä¾›åº”å•†èµ„è´¨",
        body: "å±•ç¤ºå…¬å¸æœ‰èµ„æ ¼äº¤ä»˜ä»€ä¹ˆâ€”â€”ä»¥åŠç¼ºå£åœ¨å“ªé‡Œã€‚",
        detail: "ç»´æŠ¤èµ„è´¨ã€è¦†ç›–èŒƒå›´ä¸Žæ”¯æ’‘è¯æ®ï¼Œåœ¨æŠ•å…¥æ—¶é—´å‰çœ‹æ¸…å°±ç»ªåº¦ã€‚",
      },
      {
        title: "å®¢æˆ·è¯·æ±‚",
        body: "æŠŠä¹°æ–¹æ–‡ä»¶ä¸Žä¿¡æ¯è¯·æ±‚é›†ä¸­åˆ°æ¸…æ™°æ¡ˆå·ã€‚",
        detail:
          "æ•èŽ·è¿›é¡¹è¯·æ±‚ã€å…³è”å·²æœ‰è¯æ®ã€è·Ÿè¸ªå®Œæˆåº¦å¹¶å®‰å…¨å…±äº«ï¼Œå‡å°‘é‚®ä»¶çº¿ç¨‹æ··ä¹±ã€‚",
      },
      {
        title: "æ‹›æ ‡æ—¥åŽ†",
        body: "è®©ä½ è·Ÿè¸ªçš„æœºä¼šæˆªæ­¢æ—¥æœŸã€é‡Œç¨‹ç¢‘ä¸Žæé†’å¯è§ã€‚",
        detail:
          "æ•´ç†å…³é”®æ—¥æœŸä¸Žæé†’ï¼Œé™ä½Žé”™è¿‡æäº¤çš„é£Žé™©ï¼Œå¹¶ä¸Žå®¢æˆ·è¯·æ±‚å½¢æˆå…±äº«æ—¶é—´çº¿ã€‚",
      },
      {
        title: "é—®å·åŠ©æ‰‹",
        body: "ç»“æž„åŒ–é—®é¢˜ï¼Œå¹¶åŸºäºŽè¯æ®èµ·è‰éœ€äººå·¥æ ¸éªŒçš„ç­”æ¡ˆã€‚",
        detail:
          "æ£€æµ‹å¹¶æ•´ç†é—®å·å†…å®¹ï¼ŒåŸºäºŽå¯ç”¨è¯æ®èµ·è‰ç­”å¤ï¼Œå¹¶æ ‡å‡ºä»éœ€äººå·¥æ ¸éªŒçš„é¡¹ã€‚",
      },
      {
        title: "å†³ç­–å¼•æ“Ž",
        body: "æ ¹æ®å°±ç»ªåº¦ã€èµ„è´¨ä¸Žè¯æ®ç»™å‡ºå¯è§£é‡Šçš„ æŠ•æ ‡ / å¤æ ¸ / ä¸æŠ•æ ‡ã€‚",
        detail:
          "ç»“åˆå…¬å¸å°±ç»ªä¿¡å·ä¸Žè¦æ±‚ã€è¯æ®ä¸Šä¸‹æ–‡ç”Ÿæˆå¯è§£é‡Šå†³ç­–ã€‚å†³ç­–è®°å¿†ä¸Žæ¨¡æ‹Ÿå™¨æ”¯æŒåˆ¤æ–­â€”â€”ä¸èƒ½æ›¿ä»£å›¢é˜Ÿè´£ä»»ã€‚",
      },
      {
        title: "å›¢é˜Ÿå†³ç­–æµç¨‹",
        body: "æŠŠå†³ç­–å˜æˆå¯æ‰§è¡Œçš„å·²åˆ†é…æ­¥éª¤ã€æ ¸éªŒä¸Žæé†’ã€‚",
        detail:
          "åˆ›å»ºä»»åŠ¡ã€é™„ä¸Šè¯æ®ã€é—­çŽ¯æ ¸éªŒï¼Œå¹¶åœ¨æƒé™å…è®¸æ—¶ä½¿ç”¨æ™ºèƒ½æé†’ä¸Žè¡ŒåŠ¨è®¡åˆ’ã€‚",
      },
    ],
    smartMatch: {
      eyebrow: "Smart Match Engine",
      title: "çœ‹æ¸…å“ªäº›æœºä¼šæ›´ç¬¦åˆå…¬å¸èµ„æ–™",
      body: "Smart Match Engine å°†æœºä¼šä¿¡å·ä¸Žå…¬å¸èµ„æ–™å¯¹æ¯”ï¼Œå¸®åŠ©å›¢é˜Ÿä¼˜å…ˆå®‰æŽ’è¿›ä¸€æ­¥è¯„å®¡â€”â€”è€Œä¸æ˜¯ç”¨åŒä¸€æ–¹å¼æ‰«è¿‡æ¯æ¡çº¿ç´¢ã€‚",
      benefit1: "æŒ‰æœåŠ¡ã€è¡Œä¸šä¸Žåœ°ç†çªå‡ºç›¸å…³æœºä¼šã€‚",
      benefit2: "ç”¨èµ„è´¨ã€ç»éªŒä¸Žå…¬å¸è§„æ¨¡ä½œä¸ºç»“æž„åŒ–åŒ¹é…ç»´åº¦ã€‚",
      benefit3: "åœ¨æŠ•å…¥å›¢é˜Ÿæ—¶é—´å‰æŸ¥çœ‹åŒ¹é…è¯´æ˜Žã€‚",
      dimensionsLabel: "åŒ¹é…ç»´åº¦",
      dimensions: ["æœåŠ¡", "è¡Œä¸š", "åœ°ç†", "èµ„è´¨", "ç»éªŒ", "å…¬å¸è§„æ¨¡"],
      note: "åŒ¹é…åˆ†æ•°ç”¨äºŽæŽ¢ç´¢ä¸Žè¯„å®¡ï¼Œä¸ä¿è¯èµ„æ ¼ã€å…¨å¸‚åœºè¦†ç›–æˆ–ä¸­æ ‡ã€‚è®¿é—®å–å†³äºŽå·¥ä½œåŒºé…ç½®ã€‚",
      ctaPrimary: "åˆ›å»ºå…¬å¸èµ„æ–™",
      ctaSecondary: "äº†è§£ Bidvera å¦‚ä½•è¿ä½œ",
    },
    bottomTitle: "æŠŠå°±ç»ªåº¦ã€æœºä¼šä¸Žå†³ç­–æ”¾è¿›åŒä¸€ä¸ªå·¥ä½œåŒº",
    bottomBody:
      "æ•´ç†ä¼ä¸šå·²æœ‰èƒ½åŠ›ï¼Œæ ¸éªŒå¯è¯æ˜Žäº‹é¡¹ï¼Œè¯„ä¼°ç›¸å…³å·¥ä½œï¼Œå¹¶ä¸Žå›¢é˜Ÿå†³å®šè·Ÿè¿›ä»€ä¹ˆã€‚",
    bottomCta: "æŽ¢ç´¢ Bidvera",
    howTitle: "å¦‚ä½•è¿ä½œ",
    howBody: "ä»Žä¼ä¸šå°±ç»ªåº¦åˆ°æœ‰æŠŠæ¡çš„è¡ŒåŠ¨ã€‚",
    step1Title: "ç†è§£",
    step1Body: "å»ºç«‹å…¬å¸ã€æ–‡ä»¶ã€èµ„è´¨ä¸Žå°±ç»ªåº¦çš„æ¸…æ™°å›¾æ™¯ã€‚",
    step2Title: "æ•´ç†",
    step2Body: "é€šè¿‡å®¢æˆ·è¯·æ±‚æ•èŽ·è¿›é¡¹å·¥ä½œï¼Œå¹¶æŠŠå…³é”®æ—¥æœŸæ”¾åœ¨æ‹›æ ‡æ—¥åŽ†ä¸Šã€‚",
    step3Title: "æ ¸éªŒ",
    step3Body: "å¯¹ç…§èµ„æ–™ã€æ–‡ä»¶ã€èµ„è´¨ä¸Žè¯æ®æ£€æŸ¥è¦æ±‚ã€‚",
    step4Title: "å†³ç­–å¹¶è¡ŒåŠ¨",
    step4Body: "å½¢æˆå¯è§£é‡Šå†³ç­–ï¼Œå†é€šè¿‡å›¢é˜Ÿæµç¨‹ã€æé†’ä¸Žè¡ŒåŠ¨è®¡åˆ’æŽ¨è¿›ã€‚",
    beforeAfterTitle: "ä»Žåˆ†æ•£ä¿¡æ¯åˆ°æœ‰æŠŠæ¡çš„è¡ŒåŠ¨",
    beforeAfterBody:
      "ä¸å¿…å†ä»Žä¸åŒåœ°æ–¹æ‹¼å‡‘æ–‡ä»¶ã€èµ„è´¨ä¸Žæœºä¼šã€‚Bidvera æŠŠå°±ç»ªåº¦ã€è¯æ®ä¸Žå†³ç­–æ”¾åœ¨åŒä¸€å·¥ä½œåŒºã€‚",
    beforeLabel: "æ²¡æœ‰ç»“æž„åŒ– Bidvera æµç¨‹æ—¶",
    afterLabel: "ä½¿ç”¨ Bidvera",
    beforeItems: [
      "æ–‡ä»¶ã€èµ„è´¨ä¸Žè¯æ®æ•£è½åœ¨æ–‡ä»¶å¤¹å’Œæ”¶ä»¶ç®±ä¸­",
      "ä¸æ¸…æ¥šå“ªäº›è¯·æ±‚ä½ çœŸæ­£å‡†å¤‡å¥½äº†",
      "äººå·¥å®¡é˜…ç¼ºå°‘å…±äº«çš„è¯æ®è½¨è¿¹",
      "åšäº†å†³ç­–å´æ²¡æœ‰æ¸…æ™°çš„ä¸‹ä¸€æ­¥è´£ä»»äºº",
    ],
    afterItems: [
      "ä¸€ä¸ªå·¥ä½œåŒºè¦†ç›–ä¼ä¸šæƒ…æŠ¥ã€å°±ç»ªåº¦ä¸Žå·²æ ¸éªŒè¯æ®",
      "è¿›é¡¹å·¥ä½œå¯¹ç…§çœŸå®žèƒ½åŠ›æ•´ç†",
      "å¯è§£é‡Šçš„ æŠ•æ ‡ / å¤æ ¸ / ä¸æŠ•æ ‡ï¼Œå¹¶é™„å¸¦ä¾æ®",
      "å·²åˆ†é…çš„ä¸‹ä¸€æ­¥ã€æé†’å’Œå›¢é˜Ÿå¯æ‰§è¡Œçš„è®¡åˆ’",
    ],
    complianceEyebrow: "æ–‡ä»¶åˆè§„",
    complianceHeadline: "è®©å…¬å¸éšæ—¶ä¿æŒå°±ç»ªã€‚",
    complianceBody:
      "åœ¨ä¸€ä¸ªå®‰å…¨å·¥ä½œåŒºæ•´ç†å…³é”®å…¬å¸æ–‡ä»¶ã€è·Ÿè¸ªåˆ°æœŸæ—¥ï¼Œå¹¶æŽŒæ¡åˆè§„è¦æ±‚ã€‚",
    complianceBenefit1Title: "ä¿æŒæœ‰åº",
    complianceBenefit1Body: "æŠŠå…¨éƒ¨å…¬å¸æ–‡ä»¶æ”¾åœ¨åŒä¸€ä¸ªå®‰å…¨å·¥ä½œåŒºã€‚",
    complianceBenefit2Title: "è·Ÿè¸ªåˆ°æœŸæ—¥",
    complianceBenefit2Body: "çœ‹æ¸…å“ªäº›ä»æœ‰æ•ˆã€å“ªäº›éœ€è¦åœ¨è¿‡æœŸå‰å¤„ç†ã€‚",
    complianceBenefit3Title: "éšæ—¶åº”å¯¹è¦æ±‚",
    complianceBenefit3Body: "çŸ¥é“å“ªäº›æ–‡ä»¶èƒ½æ”¯æ’‘ä¸‹ä¸€é¡¹è¦æ±‚ã€‚",
    compliancePanelTitle: "å…¬å¸æ–‡ä»¶",
    complianceAddLabel: "æ·»åŠ æ–‡ä»¶",
    complianceAlertTitle: "ä¿é™©å³å°†åˆ°æœŸ",
    complianceReadyLabel: "å·²å°±ç»ª",
    complianceReadyHint: "å…³é”®æ–‡ä»¶å·²åœ¨åŒä¸€å·¥ä½œåŒºè·Ÿè¸ªã€‚",
    complianceStatusValid: "æœ‰æ•ˆ",
    complianceStatusExpiring: "å³å°†åˆ°æœŸ",
    complianceDocTrade: "è¥ä¸šæ‰§ç…§",
    complianceDocTax: "ç¨ŽåŠ¡è¯æ˜Ž",
    complianceDocInsurance: "ä¿é™©",
    complianceDocQuality: "è´¨é‡è¯ä¹¦",
    complianceDocFinancial: "è´¢åŠ¡æŠ¥è¡¨",
    complianceDateTrade: "æœ‰æ•ˆæœŸè‡³ 2026å¹´12æœˆ31æ—¥",
    complianceDateTax: "æœ‰æ•ˆæœŸè‡³ 2026å¹´10æœˆ15æ—¥",
    complianceDateInsurance: "2026å¹´11æœˆ28æ—¥åˆ°æœŸ",
    complianceDateQuality: "æœ‰æ•ˆæœŸè‡³ 2027å¹´8æœˆ1æ—¥",
    complianceDateFinancial: "æœ‰æ•ˆæœŸè‡³ 2027å¹´2æœˆ10æ—¥",
    pricingTeaserTitle: "é€‚åˆæˆé•¿å›¢é˜Ÿçš„ç®€æ˜Žå®šä»·",
    pricingTeaserBody:
      "å…è´¹å¼€å§‹ã€‚å½“ Bidvera çœŸæ­£èŠ‚çœå›¢é˜Ÿæ—¶é—´åŽå†å‡çº§â€”â€”Pro èµ· {price}/æœˆã€‚",
    pricingTeaserCta: "æ¯”è¾ƒæ–¹æ¡ˆ",
    viewAllFaq: "æŸ¥çœ‹å…¨éƒ¨å¸¸è§é—®é¢˜ â†’",
    testimonialsTitle: "å›¢é˜Ÿæ€Žä¹ˆè¯´",
    testimonialsBody: "æ¥è‡ªä½¿ç”¨ Bidvera ä¿æŒå°±ç»ªå¹¶è‡ªä¿¡å†³ç­–çš„å›¢é˜Ÿçš„çœŸå®žåé¦ˆã€‚",
    testimonialsEmptyTitle: "æ—©æœŸå®¢æˆ·åé¦ˆ",
    testimonialsEmptyBody:
      "æˆ‘ä»¬åªå‘å¸ƒçœŸå®žå®¢æˆ·è¯„ä»·ã€‚æˆä¸ºé¦–æ‰¹æŠŠå°±ç»ªåº¦ã€è¯æ®ä¸Žå†³ç­–æ”¾è¿›åŒä¸€å·¥ä½œåŒºçš„å›¢é˜Ÿâ€”â€”ç„¶åŽå‘Šè¯‰æˆ‘ä»¬æ•ˆæžœã€‚",
    testimonialsEmptyCta: "æŽ¢ç´¢ Bidvera",
  },
  product: {
    eyebrow: "äº§å“",
    title: "ä¼ä¸šæƒ…æŠ¥ã€‚å°±ç»ªåº¦ã€‚å¯è§£é‡Šçš„å†³ç­–ã€‚",
    body: "Bidvera ä¸æ˜¯é€šç”¨ AI PDF æ‘˜è¦å·¥å…·ã€‚å®ƒæ˜¯é¢å‘ä¼ä¸šå°±ç»ªåº¦ã€åˆè§„ã€èµ„è´¨ã€è¯æ®ã€æœºä¼šæƒ…æŠ¥ä¸Žå¯è§£é‡Šå†³ç­–çš„å·¥ä½œåŒºã€‚æŠ•æ ‡ / å¤æ ¸ / ä¸æŠ•æ ‡ æ˜¯å†³ç­–å¼•æ“Žçš„ä¸€ç§ç»“æžœï¼Œä¸æ˜¯å…¨éƒ¨äº§å“ã€‚",
    step1Title: "ç†è§£ä¼ä¸š",
    step1Body: "å»ºç«‹å…¬å¸èµ„æ–™ã€æ–‡ä»¶ã€èµ„è´¨ä¸Žå°±ç»ªåº¦çš„æŒç»­è§†å›¾ã€‚",
    step2Title: "å‘çŽ°ç›¸å…³æœºä¼š",
    step2Body: "å‘çŽ°ä¸Žä¼ä¸šçœŸå®žäº¤ä»˜èƒ½åŠ›ç›¸ç¬¦çš„æœºä¼šä¸Žå®¢æˆ·è¯·æ±‚ã€‚",
    step3Title: "æ ¸éªŒã€å†³ç­–å¹¶è¡ŒåŠ¨",
    step3Body: "åˆ†æžå…³é”®è¦æ±‚ã€å…³è”è¯æ®ï¼Œåšå‡ºå¯è§£é‡Šçš„ æŠ•æ ‡ / å¤æ ¸ / ä¸æŠ•æ ‡ å†³ç­–ï¼Œå¹¶è½¬åŒ–ä¸ºå›¢é˜Ÿä¸‹ä¸€æ­¥ã€‚",
    seeTitle: "å›¢é˜Ÿåœ¨å·¥ä½œåŒºä¸­ä½¿ç”¨çš„èƒ½åŠ›",
    seeItems: [
      "å…¬å¸èµ„æ–™ã€æ–‡ä»¶åˆè§„ä¸Žä¾›åº”å•†èµ„è´¨",
      "å®¢æˆ·è¯·æ±‚ä¸Žæ—¥åŽ†æˆªæ­¢æ—¥æœŸ",
      "æœ‰æ¥æºæ”¯æ’‘çš„è¯æ®æƒ…æŠ¥",
      "å†³ç­–å¼•æ“Žç»“æžœï¼šæŠ•æ ‡ / å¤æ ¸ / ä¸æŠ•æ ‡",
      "å¯è§£é‡Šä¾æ®ã€å†³ç­–è®°å¿†ä¸Žæ¨¡æ‹Ÿ",
      "æ‹›æ ‡åˆ†æžä½œä¸ºæµç¨‹ä¸­çš„ä¸€æ­¥",
      "é—®å·åŠ©æ‰‹ä¸Ž PDF å¯¼å‡º",
      "å›¢é˜Ÿå†³ç­–æµç¨‹ã€è¡ŒåŠ¨è®¡åˆ’ä¸Žæ™ºèƒ½æé†’",
    ],
    cta: "æŽ¢ç´¢ Bidvera",
    futureTitle: "ä¸€ä¸ªå·¥ä½œåŒºä¸­çš„çŽ°æœ‰èƒ½åŠ›",
    futureBody: "Bidvera å·²è¦†ç›–ä¼ä¸šåŸºç¡€ã€æœºä¼šæƒ…æŠ¥ã€è¯æ®ã€å†³ç­–ä¸Žå›¢é˜Ÿè¡ŒåŠ¨ã€‚",
    highlightItems: [
      "å…¬å¸èµ„æ–™",
      "æ–‡ä»¶åˆè§„",
      "å®¢æˆ·è¯·æ±‚",
      "è¯æ®æƒ…æŠ¥",
      "å†³ç­–å¼•æ“Ž",
      "æ‹›æ ‡åˆ†æž",
      "å›¢é˜Ÿå†³ç­–æµç¨‹",
      "é«˜çº§ AI ä¿¡ä»»ä¸Žå®‰å…¨",
    ],
  },
  pricing: {
    eyebrow: "å®šä»·",
    title: "ä¸€ä¸ªç”¨äºŽå°±ç»ªã€æœºä¼šä¸Žè¡ŒåŠ¨çš„å·¥ä½œåŒº",
    body: "å¯å…ˆä½¿ç”¨æœ‰é™çš„å…è´¹å·¥ä½œåŒºï¼Œæˆ–è¯•ç”¨ä»˜è´¹å¥—é¤ 14 å¤©ã€‚ä»·æ ¼æ¥è‡ª Bidvera å½“å‰å¥—é¤ã€‚",
    perMonth: "/æœˆ",
    perMonthYearly: "/æœˆï¼ˆæŒ‰å¹´è®¡è´¹ï¼‰",
    analysesSeats: "æ¯æœˆ {analyses} æ¬¡åˆ†æž Â· {seats} ä¸ªå¸­ä½",
    seatsOnly: "{seats} ä¸ªå¸­ä½",
    startFree: "å…è´¹å¼€å§‹",
    startFreeWorkspace: "å¼€å§‹å…è´¹å·¥ä½œåŒº",
    startTrial: "å¼€å§‹ 14 å¤©å…è´¹è¯•ç”¨",
    startSubscription: "å¼€å§‹è®¢é˜…",
    choose: "é€‰æ‹© {plan}",
    monthly: "æŒ‰æœˆ",
    yearly: "æŒ‰å¹´",
    save: "çº¦çœ 17%",
    recommended: "æœ€å—æ¬¢è¿Ž",
    mostPopular: "é€‚åˆæˆé•¿å›¢é˜Ÿ",
    trialBadge: "14 å¤©å…è´¹è¯•ç”¨",
    noChargeToday: "ä»Šå¤©ä¸æ‰£è´¹",
    paymentMethodRequired: "éœ€è¦æ”¯ä»˜æ–¹å¼",
    cancelBeforeTrial: "è¯·åœ¨è¯•ç”¨ç»“æŸå‰å–æ¶ˆï¼Œä»¥å…äº§ç”Ÿè®¢é˜…è´¹ç”¨ã€‚",
    freeHeadline: "å…è´¹å¼€å§‹ã€‚æ­å»ºå…¬å¸å·¥ä½œåŒºã€‚",
    freeLimitedNote: "æœ‰é™å·¥ä½œåŒº â€” ä»…å«å…¬å¸èµ„æ–™ä¸Žæ–‡æ¡£åˆè§„ã€‚",
    comparisonTitle: "å¥—é¤å¯¹æ¯”",
    comparisonFeature: "èƒ½åŠ›",
    yearlyNote: "å¹´ä»˜æ€»é¢ä»¥å„å¥—é¤å·²é…ç½®ä»·æ ¼ä¸ºå‡†ã€‚ç»“è´¦ä½¿ç”¨ä½ é€‰æ‹©çš„å‘¨æœŸã€‚",
    valueTitle1: "ä¼ä¸šæƒ…æŠ¥å·¥ä½œåŒº",
    valueBody1: "åœ¨ä¸€å¤„æ•´ç†å…¬å¸ä¿¡æ¯ã€åˆè§„ã€èµ„è´¨ã€è¯æ®ä¸Žè¯·æ±‚ï¼Œå†ä¸Žå›¢é˜Ÿä¸€èµ·è¡ŒåŠ¨ã€‚",
    valueTitle2: "é™é¢æ¸…æ™°ï¼Œæ²¡æœ‰éšè—ç”¨é‡",
    valueBody2: "å¸­ä½ä¸Žç”¨é‡é™åˆ¶éƒ½æ˜¾ç¤ºåœ¨å¥—é¤ä¸Šã€‚æ‰€è§å³æ‰€å¾—ã€‚",
    valueTitle3: "å…ˆè¯•ç”¨ä»˜è´¹å¥—é¤ï¼Œå†å†³å®š",
    valueBody3: "ç¬¦åˆæ¡ä»¶çš„å¥—é¤æä¾› 14 å¤©è¯•ç”¨å¹¶éœ€ç»‘å®šæ”¯ä»˜æ–¹å¼ã€‚è‹¥ä¸å¸Œæœ›è®¢é˜…å¼€å§‹ï¼Œè¯·åœ¨è¯•ç”¨ç»“æŸå‰å–æ¶ˆã€‚",
    ctaTitle: "å‡†å¤‡å¥½ä¿æŒå…¬å¸å°±ç»ªäº†å—ï¼Ÿ",
    ctaBody: "ä»Žå…è´¹å·¥ä½œåŒºå¼€å§‹ï¼Œæˆ–é€‰æ‹©å¥—é¤è¯•ç”¨ Bidvera 14 å¤©ã€‚",
    groups: {
      readiness: "ä¼ä¸šå°±ç»ª",
      opportunities: "æœºä¼šä¸Žè¯·æ±‚",
      intelligence: "æƒ…æŠ¥ä¸Žå†³ç­–",
      workflow: "AI ä¸Žåä½œ",
    },
    features: {
      company_profile: "å…¬å¸èµ„æ–™",
      document_compliance: "æ–‡æ¡£åˆè§„",
      supplier_qualification: "ä¾›åº”å•†èµ„è´¨",
      client_requests: "å®¢æˆ·è¯·æ±‚",
      tender_calendar: "æ—¥åŽ†",
      evidence_intelligence: "è¯æ®æƒ…æŠ¥",
      advanced_decision_engine: "å†³ç­–å¼•æ“Ž",
      decision_memory: "å†³ç­–è®°å¿†",
      decision_simulator: "å†³ç­–æ¨¡æ‹Ÿ",
      explainable_decision: "å¯è§£é‡Šå†³ç­–",
      tender_analysis: "æ‹›æ ‡åˆ†æž",
      questionnaire_assistant: "é—®å·åŠ©æ‰‹",
      smart_alerts: "æ™ºèƒ½æé†’",
      team_collaboration: "å›¢é˜Ÿå†³ç­–æµç¨‹",
      pdf_export: "PDF å¯¼å‡º",
      tender_action_plan: "è¡ŒåŠ¨è®¡åˆ’",
    },
  },
  faq: {
    eyebrow: "å¸¸è§é—®é¢˜",
    title: "ç›´ç™½å›žç­”",
    items: [
      {
        q: "Bidvera æ˜¯ä»€ä¹ˆï¼Ÿ",
        a: "Bidvera æ˜¯ä¸€ä¸ªä¼ä¸šæƒ…æŠ¥å·¥ä½œåŒºï¼Œå¸®åŠ©ä¼ä¸šæ•´ç†å…¬å¸ä¿¡æ¯ã€ç®¡ç†åˆè§„ã€å‘çŽ°ç›¸å…³æœºä¼šã€å¤„ç†è¯æ®å¹¶è‡ªä¿¡åœ°é‡‡å–è¡ŒåŠ¨ã€‚",
      },
      {
        q: "Bidvera å¦‚ä½•å¸®åŠ©ä¿æŒä¼ä¸šå°±ç»ªï¼Ÿ",
        a: "Bidvera å°†å…¬å¸èµ„æ–™ã€èµ„è´¨ä¸Žå…³é”®æ–‡æ¡£é›†ä¸­åœ¨ä¸€èµ·ï¼Œå¸®åŠ©å›¢é˜Ÿç»´æŠ¤å¯é ä¸”æœ€æ–°çš„ä¸šåŠ¡åŸºç¡€ã€‚",
      },
      {
        q: "Document Compliance å¦‚ä½•è¿ä½œï¼Ÿ",
        a: "è·Ÿè¸ªé‡è¦å…¬å¸æ–‡æ¡£ã€ç›‘æŽ§åˆ°æœŸæ—¥æœŸï¼Œå¹¶åœ¨éœ€è¦å…³æ³¨æ—¶æ”¶åˆ°æé†’ï¼Œå¸®åŠ©ä¼ä¸šä¿æŒå‡†å¤‡çŠ¶æ€ã€‚",
      },
      {
        q: "Bidvera å¦‚ä½•å¸®åŠ©å¤„ç†æœºä¼šä¸Žå®¢æˆ·è¯·æ±‚ï¼Ÿ",
        a: "å›¢é˜Ÿå¯ä»¥æ•èŽ·å®¢æˆ·è¯·æ±‚ã€åœ¨æ‹›æ ‡æ—¥åŽ†ä¸Šè·Ÿè¸ªæˆªæ­¢æ—¥æœŸï¼Œå¹¶å¯¹ç…§å…¬å¸èµ„æ–™ã€èƒ½åŠ›ä¸Žèµ„è´¨è¯„ä¼°è¦æ±‚ã€‚",
      },
      {
        q: "Bidvera èƒ½å¦å¸®åŠ©å¤„ç†å®¢æˆ·è¯·æ±‚ä¸Žé—®å·ï¼Ÿ",
        a: "å¯ä»¥ã€‚å›¢é˜Ÿå¯ä»¥ç®¡ç†å®¢æˆ·è¯·æ±‚ï¼Œå¹¶ä½¿ç”¨ Questionnaire Assistant æ›´é«˜æ•ˆåœ°æ•´ç†å’Œå›žå¤æ‰€éœ€ä¿¡æ¯ã€‚",
      },
      {
        q: "Bidvera å¦‚ä½•ä½¿ç”¨è¯æ®ï¼Ÿ",
        a: "Evidence Intelligence å°†å…¬å¸ä¿¡æ¯ã€èµ„è´¨ä¸Žæ”¯æŒè¯æ®è¿žæŽ¥èµ·æ¥ï¼Œå¸®åŠ©å›¢é˜Ÿäº†è§£å“ªäº›å·²éªŒè¯ã€å“ªäº›éœ€è¦å…³æ³¨ä»¥åŠåŽŸå› ã€‚",
      },
      {
        q: "å›¢é˜Ÿå¯ä»¥åœ¨ Bidvera ä¸­åä½œå—ï¼Ÿ",
        a: "å¯ä»¥ã€‚Team Decision Workflow å¸®åŠ©æˆå‘˜å…±åŒå·¥ä½œã€åˆ†é…èŒè´£ã€å®¡é˜…ä¿¡æ¯ï¼Œå¹¶åœ¨ä¸€ä¸ªå·¥ä½œåŒºä¸­åè°ƒåŽç»­è¡ŒåŠ¨ã€‚",
      },
      {
        q: "Bidvera å®‰å…¨å—ï¼Ÿ",
        a: "Bidvera é‡‡ç”¨å—æŽ§è®¿é—®ã€ç§Ÿæˆ·éš”ç¦»ä¸Žå®‰å…¨ä¿æŠ¤è®¾è®¡ï¼Œç¡®ä¿æ¯å®¶å…¬å¸çš„ç©ºé—´ä¸Žä¿¡æ¯å½¼æ­¤åˆ†ç¦»ã€‚",
      },
      {
        q: "è®¢é˜…å‰å¯ä»¥è¯•ç”¨ Bidvera å—ï¼Ÿ",
        a: "å¯ä»¥ã€‚ä½ å¯ä»¥å…ˆä½¿ç”¨å¯ç”¨çš„å…è´¹è¯•ç”¨ï¼Œåœ¨è®¢é˜…å‰æŽ¢ç´¢å¹³å°ã€‚",
      },
    ],
  },
  auth: {
    loginTitle: "ç™»å½•",
    loginBody: "è¿›å…¥å…¬å¸çš„ Bidvera å·¥ä½œåŒºã€‚",
    emailChangedNotice: "é‚®ç®±å·²æ›´æ–°ã€‚è¯·ä½¿ç”¨æ–°åœ°å€ç™»å½•ã€‚å…¶ä»–ä¼šè¯å·²é€€å‡ºã€‚",
    sideHeadline: "çŸ¥é“è¯¥è¿½æ±‚ä»€ä¹ˆã€‚çŸ¥é“è‡ªå·±å‡†å¤‡å¥½äº†ä»€ä¹ˆã€‚",
    sideBody: "Bidvera å¸®åŠ©å›¢é˜Ÿæ•´ç†å°±ç»ªåº¦ã€æ ¸éªŒè¯æ®ã€è¯„ä¼°æœºä¼šï¼Œå¹¶è‡ªä¿¡å†³ç­–ã€‚",
    sidePillMatched: "åŒ¹é… â€” å·²ä¸ºå…¬å¸æ‰¾åˆ°åˆé€‚çš„æœºä¼šã€‚",
    sidePillReview: "å¤æ ¸ â€” è¯·å®¡é˜…è¯¥æœºä¼šçš„è¯¦æƒ…åŠå…¶ç›¸å…³æ€§ã€‚",
    sidePillNotAMatch: "ä¸åŒ¹é… â€” è¯¥æœºä¼šä¸Žå…¬å¸èµ„æ–™ä¸ç¬¦ã€‚",
    signupTitle: "åˆ›å»º Bidvera è´¦æˆ·",
    signupBody: "å…ˆè®¾ç½®é‚®ç®±å’Œå¯†ç ï¼ŒéšåŽå®Œå–„å…¬å¸ä¿¡æ¯ã€‚",
    name: "æ‚¨çš„å§“å",
    companyName: "å…¬å¸åç§°",
    email: "å·¥ä½œé‚®ç®±",
    password: "å¯†ç ",
    confirmPassword: "ç¡®è®¤å¯†ç ",
    submitLogin: "ç™»å½•",
    submitSignup: "åˆ›å»ºè´¦æˆ·",
    haveAccount: "å·²æœ‰è´¦æˆ·ï¼Ÿ",
    newHere: "ç¬¬ä¸€æ¬¡ä½¿ç”¨ Bidveraï¼Ÿ",
    acceptTerms: "æˆ‘æŽ¥å—æœåŠ¡æ¡æ¬¾ä¸Žéšç§æ”¿ç­–ã€‚",
    acceptTermsLead: "æˆ‘æŽ¥å—",
    acceptTermsJoiner: "ä¸Ž",
    termsOfServiceLink: "æœåŠ¡æ¡æ¬¾",
    privacyPolicyLink: "éšç§æ”¿ç­–",
    acceptTermsError: "å¿…é¡»æŽ¥å—æœåŠ¡æ¡æ¬¾ä¸Žéšç§æ”¿ç­–ã€‚",
    continueGoogle: "ä½¿ç”¨ Google ç»§ç»­",
    googleComingSoon: "Google ç™»å½•å³å°†æŽ¨å‡º",
    googleOAuthError: "Google ç™»å½•å¤±è´¥ï¼Œè¯·é‡è¯•ã€‚",
    continueMicrosoft: "ä½¿ç”¨ Microsoft ç»§ç»­",
    microsoftComingSoon: "Microsoft ç™»å½•å³å°†æŽ¨å‡º",
    forgotPassword: "å¿˜è®°å¯†ç ï¼Ÿ",
    forgotTitle: "é‡ç½®å¯†ç ",
    forgotBody: "è‹¥è´¦æˆ·å­˜åœ¨ï¼Œæˆ‘ä»¬å°†å‘é€ä¸€æ¬¡æ€§é“¾æŽ¥ã€‚",
    forgotSubmit: "å‘é€é‡ç½®é“¾æŽ¥",
    forgotSent: "è‹¥é‚®ç®±å·²æ³¨å†Œï¼Œé‡ç½®é“¾æŽ¥æ­£åœ¨å‘é€ã€‚",
    resetTitle: "è®¾ç½®æ–°å¯†ç ",
    resetBody: "è‡³å°‘ 12 ä¸ªå­—ç¬¦ã€‚",
    resetSubmit: "æ›´æ–°å¯†ç ",
    passwordMismatch: "ä¸¤æ¬¡å¯†ç ä¸ä¸€è‡´ã€‚",
  },
  assistant: {
    askLabel: "è¯¢é—® Bidvera",
    title: "Bidvera AI åŠ©æ‰‹",
    description:
      "è¯¢é—® Bidveraã€ä¼ä¸šå°±ç»ªåº¦ã€æœºä¼šã€è¯æ®æˆ–ä¸‹ä¸€æ­¥ã€‚å›žç­”ç”± Bidvera AI ç”Ÿæˆï¼›è¯­éŸ³ä¸ºå®‰å…¨ TTSã€‚",
    placeholder: "è¾“å…¥é—®é¢˜â€¦",
    send: "å‘é€",
    thinking: "æ€è€ƒä¸­â€¦",
    play: "æ’­æ”¾",
    pause: "æš‚åœ",
    mute: "é™éŸ³",
    unmute: "å–æ¶ˆé™éŸ³",
    voiceUnavailable: "è¯­éŸ³æš‚ä¸å¯ç”¨ï¼Œä»å¯é˜…è¯»æ–‡å­—å›žç­”ã€‚",
    errorGeneric: "æ— æ³•èŽ·å–å›žç­”ï¼Œè¯·é‡è¯•ã€‚",
    attachImage: "æ·»åŠ å›¾ç‰‡",
    removeImage: "ç§»é™¤å›¾ç‰‡",
    imageOnlyOne: "åªèƒ½æ·»åŠ ä¸€å¼ å›¾ç‰‡ã€‚",
    imageTooLarge: "å›¾ç‰‡è¿‡å¤§ï¼ˆæœ€å¤§ 4MBï¼‰ã€‚",
    imageInvalid: "è¯·ä½¿ç”¨ JPEGã€PNGã€WebP æˆ– GIFã€‚",
    imageQuotaReached: "å›¾ç‰‡ä¸Šä¼ å·²é”å®š â€” æœ¬æµè§ˆå™¨ä¸Žåœ°å€æ¯ 4 å°æ—¶ä»… 1 å¼ ã€‚",
    replyQuotaReached: "å‘é€å·²é”å®š â€” æœ¬æµè§ˆå™¨ä¸Žåœ°å€å·²ç”¨å®Œ 10 æ¬¡å›žå¤ï¼ˆ4 å°æ—¶åŽé‡ç½®ï¼‰ã€‚",
  },
  app: {
    nav: {
      dashboard: "ä»ªè¡¨ç›˜",
      tenders: "æ‹›æ ‡åˆ†æž",
      tenderCalendar: "æ‹›æ ‡æ—¥åŽ†",
      documentCompliance: "æ–‡ä»¶åˆè§„",
      supplierQualification: "ä¾›åº”å•†èµ„è´¨",
      clientRequests: "å®¢æˆ·è¯·æ±‚",
      questionnaireAssistant: "é—®å·åŠ©æ‰‹",
      matchedOpportunities: "åŒ¹é…æœºä¼š",
      company: "å…¬å¸èµ„æ–™",
      billing: "è´¦å•",
      alerts: "æé†’",
      settings: "è®¾ç½®",
      decisionMemory: "å†³ç­–è®°å¿†",
      teamWorkflow: "å›¢é˜Ÿæµç¨‹",
      sectionCapabilities: "èƒ½åŠ›",
      sectionWorkspace: "å·¥ä½œåŒº",
      sectionAccount: "è´¦æˆ·",
    },
    shell: {
      tagline: "å…ˆéªŒè¯ï¼Œå†æŠ•æ ‡ã€‚",
      analyzeTender: "åˆ†æžæ‹›æ ‡",
      upgrade: "å‡çº§",
      signOut: "é€€å‡ºç™»å½•",
      openMenu: "æ‰“å¼€èœå•",
      closeMenu: "å…³é—­èœå•",
      decisionWorkspace: "Bidvera å·¥ä½œåŒº",
      yourCompany: "æ‚¨çš„å…¬å¸",
      workspace: "å·¥ä½œåŒº",
    },
    dashboard: {
      eyebrow: "é«˜ç®¡æ¦‚è§ˆ",
      title: "ä»ªè¡¨ç›˜",
      subtitle: "ä¸‹ä¸€æ­¥åšä»€ä¹ˆã€å“ªäº›æ‹›æ ‡å€¼å¾—è·Ÿè¿›ï¼Œä»¥åŠä»€ä¹ˆåœ¨é˜»ç¢ä½ ã€‚",
      analyzeCta: "åˆ†æžæ‹›æ ‡",
      activeTenders: "è¿›è¡Œä¸­çš„æ‹›æ ‡",
      inPipeline: "ç®¡çº¿ä¸­",
      bid: "æŠ•æ ‡",
      pursue: "è·Ÿè¿›",
      review: "å¤æ ¸",
      verifyFirst: "å…ˆæ ¸å®ž",
      noBid: "ä¸æŠ•æ ‡",
      skipEffort: "è·³è¿‡æŠ•å…¥",
      upcomingDeadlines: "å³å°†åˆ°æœŸ",
      upcomingEmpty: "æœªæ¥ä¸¤å‘¨å†…æ²¡æœ‰å³å°†åˆ°æœŸçš„æˆªæ­¢æ—¥æœŸã€‚",
      upcomingCalendarDeadlines: "å³å°†åˆ°æ¥çš„æˆªæ­¢æ—¥æœŸ",
      upcomingCalendarHint:
        "From Tender Calendar â€” same deadlines shown in the calendar module",
      upcomingCalendarEmpty: "æš‚æ— å³å°†åˆ°æ¥çš„æ—¥åŽ†æˆªæ­¢æ—¥æœŸã€‚",
      addCalendarTender: "æ·»åŠ æ—¥åŽ†æ‹›æ ‡",
      highRisk: "é«˜é£Žé™©æ‹›æ ‡",
      highRiskEmpty: "å½“å‰æ²¡æœ‰é«˜é£Žé™©æˆ–å…³é”®é£Žé™©æ‹›æ ‡ã€‚",
      recentAnalyses: "æœ€è¿‘åˆ†æž",
      recentEmpty: "å°šæ— åˆ†æžã€‚ä¸Šä¼ ä¸€ä»½æ‹›æ ‡ä»¥èŽ·å¾—é¦–æ¬¡å†³ç­–ã€‚",
      viewAll: "æŸ¥çœ‹å…¨éƒ¨",
      due: "æˆªæ­¢",
      analyzed: "å·²åˆ†æž",
      decisionDistribution: "å†³ç­–åˆ†å¸ƒ",
      decisionDistributionHint: "å·²å®Œæˆ BID / REVIEW / NO-BID ç»“æžœå æ¯”",
      upcomingHint: "ä»åœ¨æ—¥ç¨‹ä¸­çš„æ‹›æ ‡",
      uploadTender: "ä¸Šä¼ æ‹›æ ‡æ–‡ä»¶",
      riskOverview: "é£Žé™©æ¦‚è§ˆ",
      riskOverviewHint: "ä¸¥é‡æˆ–é«˜å–æ¶ˆèµ„æ ¼é£Žé™©",
      recentHint: "æœ€æ–°çš„æŠ•æ ‡ / ä¸æŠ•æ ‡ç»“æžœ",
      platformTitle: "æ‚¨å¯ä»¥åœ¨ Bidvera ä¸­åšä»€ä¹ˆ",
      platformHint: "Four capabilities in one product â€” open any module to continue.",
      capabilityAnalysisDesc: "ä¸Šä¼ æ ‡ä¹¦åŒ…å¹¶èŽ·å¾—ç»§ç»­/ä¸ç»§ç»­çš„å†³ç­–ã€‚",
      capabilityComplianceDesc: "è·Ÿè¸ªä¸šåŠ¡æ–‡æ¡£ä¸Žåˆ°æœŸæé†’ã€‚",
      capabilityQualificationDesc:
        "Supplier readiness for bids and questionnaires â€” not your workspace Company Profile.",
      capabilityCalendarDesc: "è·Ÿè¸ªæœºä¼šæˆªæ­¢æ—¥æœŸä¸Žæé†’ã€‚",
      capabilityOpen: "æ‰“å¼€",
      capabilityGetStarted: "å¼€å§‹",
      capabilityUpgrade: "å‡çº§ä»¥è§£é”",
      statusAnalyses: "{count} æ¬¡åˆ†æž",
      statusDocuments: "{count} ä»½æ–‡æ¡£",
      statusCompleteness: "å®Œæ•´åº¦ {percent}%",
      statusDeadlines: "{count} ä¸ªå³å°†åˆ°æ¥",
      statusLocked: "ä¸åœ¨å½“å‰å¥—é¤å†…",
      gettingStartedTitle: "å»ºè®®çš„ä¸‹ä¸€æ­¥",
      gettingStartedHint: "Pick any path â€” you can come back anytime.",
    },
    onboarding: {
      signOutHint: "è´¦æˆ·",
      stepVerify: "éªŒè¯é‚®ç®±",
      stepCompany: "å…¬å¸",
      stepPlan: "å¥—é¤",
      verifyTitle: "éªŒè¯æ‚¨çš„é‚®ç®±",
      verifyBody: "æˆ‘ä»¬å·²å‘é€é“¾æŽ¥è‡³",
      resend: "é‡æ–°å‘é€éªŒè¯é‚®ä»¶",
      resent: "éªŒè¯é‚®ä»¶å·²å‘é€ã€‚",
      verifyInvalidTitle: "é“¾æŽ¥æ— æ•ˆæˆ–å·²è¿‡æœŸ",
      verifyInvalidBody: "è¯·åœ¨å¼•å¯¼æµç¨‹ä¸­é‡æ–°ç”³è¯·éªŒè¯é‚®ä»¶ã€‚",
      companyTitle: "å‘Šè¯‰æˆ‘ä»¬æ‚¨çš„å…¬å¸",
      companyBody: "è¿™æœ‰åŠ©äºŽ Bidvera è¯„ä¼°æ‹›æ ‡ä¸Žæ‚¨ä¸šåŠ¡çš„åŒ¹é…ç¨‹åº¦ã€‚",
      companyName: "å…¬å¸åç§°",
      country: "å›½å®¶ / ä¸šåŠ¡æ‰€åœ¨åœ°",
      industry: "è¡Œä¸š / é¢†åŸŸ",
      companySize: "å…¬å¸è§„æ¨¡",
      services: "ä¸»è¦æœåŠ¡ / èƒ½åŠ›",
      servicesHint: "å¯æ·»åŠ å¤šä¸ªæ ‡ç­¾ â€” æ¯é¡¹åŽæŒ‰ Enterã€‚",
      experience: "ç»éªŒæ°´å¹³",
      experienceOptional: "å¯é€‰",
      privacyNote:
        "æˆ‘ä»¬ä»…ç”¨è¿™äº›ä¿¡æ¯ä¸ªæ€§åŒ– Bidvera ä½“éªŒå¹¶æ”¹è¿›æ‹›æ ‡åŒ¹é…åˆ†æžã€‚æˆ‘ä»¬ä¸éœ€è¦æ•æ„Ÿçš„å…¬å¸æˆ–ä¸ªäººèµ„æ–™ã€‚",
      companySubmit: "ç»§ç»­",
      companySkip: "æš‚æ—¶è·³è¿‡",
      planTitle: "é€‰æ‹©å¼€å§‹æ–¹å¼",
      planBody: "å¯å…ˆä½¿ç”¨å…è´¹å·¥ä½œåŒºï¼Œæˆ–é€‰æ‹©ä»˜è´¹å¥—é¤ã€‚ç¬¦åˆæ¡ä»¶çš„ Stripe å¥—é¤å« 14 å¤©è¯•ç”¨ã€‚",
      trialTitle: "14 å¤©å…è´¹è¯•ç”¨",
      trialBody: "éœ€è¦æ”¯ä»˜æ–¹å¼ã€‚ä»Šå¤©ä¸æ‰£è´¹ã€‚è‹¥æœªå–æ¶ˆï¼Œæ‰€é€‰å¥—é¤å°†è‡ªåŠ¨å¼€å§‹ã€‚",
      trialCta: "å¼€å§‹ 14 å¤©è¯•ç”¨",
      paidCta: "å¼€å§‹è®¢é˜…",
      freeTitle: "å…è´¹å·¥ä½œåŒº",
      freeBody: "å…è´¹å¼€å§‹ï¼Œæ­å»ºå…¬å¸å·¥ä½œåŒºã€‚ä»…åŒ…å«å…¬å¸èµ„æ–™ä¸Žæ–‡æ¡£åˆè§„ã€‚",
      freeCta: "å¼€å§‹å…è´¹å·¥ä½œåŒº",
      noChargeToday: "ä»Šå¤©ä¸æ‰£è´¹",
      paymentMethodRequired: "éœ€è¦æ”¯ä»˜æ–¹å¼",
      cancelBeforeTrial: "è¯·åœ¨è¯•ç”¨ç»“æŸå‰å–æ¶ˆï¼Œä»¥å…äº§ç”Ÿè®¢é˜…è´¹ç”¨ã€‚",
      monthly: "æŒ‰æœˆ",
      yearly: "æŒ‰å¹´",
      checkoutCanceled: "æ”¯ä»˜å·²å–æ¶ˆï¼Œå¯éšæ—¶é‡è¯•ã€‚",
      checkoutPending: "å·²æ”¶åˆ°ä»˜æ¬¾ â€” æ­£åœ¨å¼€é€šâ€¦",
    },
    companyProfile: {
      title: "å…¬å¸èµ„æ–™",
      subtitle:
        "ç”¨äºŽåŽç»­åˆ†æžä¸­çš„å…¬å¸ä¸Žæ ‡ä¹¦åŒ¹é…ã€‚ä»…é™è´µç»„ç»‡å¯è§ â€” æ— éœ€æ•æ„Ÿä¸ªäººæˆ–è´¢åŠ¡ä¿¡æ¯ã€‚",
      headerHint: "é€æ­¥æé«˜åŒ¹é…è´¨é‡ã€‚æ›´æ”¹ä»…åº”ç”¨äºŽæœªæ¥çš„æ ‡ä¹¦åˆ†æžã€‚",
      supplierQualificationHint: "éœ€è¦æŠ•æ ‡å°±ç»ªçš„æ³¨å†Œè¯¦æƒ…ä¸Žè¯æ®ï¼Ÿè¯·ä½¿ç”¨",
      supplierQualificationLink: "ä¾›åº”å•†èµ„è´¨",
      companyName: "å…¬å¸åç§°",
      completeness: "å®Œæ•´åº¦",
      savedTitle: "å·²ä¿å­˜",
      savedBody: "å…¬å¸èµ„æ–™å·²æ›´æ–°ã€‚ä¸‹æ¬¡åˆ†æžå°†ä½¿ç”¨æœ€æ–°ä¿¡æ¯ã€‚",
      saveErrorTitle: "æ— æ³•ä¿å­˜",
      basicsTitle: "åŸºæœ¬ä¿¡æ¯",
      basicsBody: "ä»…ç”¨äºŽåŒ¹é…åˆ†æž â€” æ— éœ€æ•æ„Ÿä¸ªäººæˆ–è´¢åŠ¡ä¿¡æ¯ã€‚",
      industry: "è¡Œä¸š",
      country: "å›½å®¶",
      companySize: "å…¬å¸è§„æ¨¡",
      notProvided: "æœªæä¾›",
      experienceLevel: "ç»éªŒæ°´å¹³ï¼ˆå¯é€‰ï¼‰",
      experienceYears: "ç›¸å…³å¹´é™ï¼ˆå¯é€‰ï¼‰",
      experienceYearsPlaceholder: "ä¾‹å¦‚ 5",
      revenueRange: "è¥æ”¶åŒºé—´ï¼ˆå¯é€‰ï¼‰",
      revenuePlaceholder: "ä¾‹å¦‚ Â£2mâ€“Â£5m",
      employees: "å‘˜å·¥è§„æ¨¡ï¼ˆå¯é€‰ï¼‰",
      employeesPlaceholder: "ä¾‹å¦‚ 50â€“100",
      sizeSolo: "ä¸ªäºº",
      sizeSmall: "å°åž‹",
      sizeMedium: "ä¸­åž‹",
      sizeEnterprise: "å¤§åž‹",
      expNew: "æ–°ä¸šåŠ¡ / ç»éªŒæœ‰é™",
      expSome: "æœ‰ä¸€å®šç»éªŒ",
      expExperienced: "ç»éªŒä¸°å¯Œ",
      expHighly: "é«˜åº¦æˆç†Ÿ",
      capabilitiesTitle: "èƒ½åŠ›ä¸Žè¦†ç›–èŒƒå›´",
      services: "æœåŠ¡",
      certifications: "è®¤è¯",
      geographicCoverage: "åœ°ç†è¦†ç›–",
      commaSeparated: "é€—å·åˆ†éš”",
      contractTitle: "åˆåŒåå¥½",
      contractMin: "æœ€å°åˆåŒé‡‘é¢ï¼ˆÂ£ï¼‰",
      contractMax: "æœ€å¤§åˆåŒé‡‘é¢ï¼ˆÂ£ï¼‰",
      rulesTitle: "è‡ªå®šä¹‰èµ„æ ¼è§„åˆ™",
      rulesBody: "æ¯è¡Œä¸€æ¡è§„åˆ™ï¼Œå°†åœ¨åˆ†æžä¸­ä½œä¸ºç­›é€‰æ¡ä»¶ã€‚",
      save: "ä¿å­˜èµ„æ–™",
      learningTitle: "å…¨çƒå­¦ä¹ æŽˆæƒ",
      learningBody:
        "å¯ç”¨åŽï¼ŒBidvera å¯å°†ç»è¿‡éšç§è¿‡æ»¤çš„ç»“æžœæ¨¡å¼ï¼ˆç»ä¸åŒ…å«å…¬å¸åç§°ã€æ–‡æ¡£ã€ç­–ç•¥æˆ–å¯è¯†åˆ«åŽ†å²ï¼‰è´¡çŒ®åˆ°å…¨çƒå­¦ä¹ å±‚ã€‚è´µå…¬å¸ç§æœ‰ç»“æžœå§‹ç»ˆä¿æŒç§Ÿæˆ·éš”ç¦»ã€‚å¯éšæ—¶é€€å‡ºã€‚",
      learningCheckbox: "å‘å·²éªŒè¯çš„å…¨çƒæ¨¡å¼è´¡çŒ®åŒ¿ååŒ–ç»“æžœ",
      learningSaving: "ï¼ˆä¿å­˜ä¸­â€¦ï¼‰",
    },
    billing: {
      title: "è´¦å•",
      subtitle: "å½“å‰å¥—é¤ã€ç»­è´¹ã€ä»˜æ¬¾è®°å½•ä¸Žå‘ç¥¨ã€‚",
      activatedTitle: "è®¢é˜…å·²æ¿€æ´»",
      activatedBody: "å¥—é¤çŽ°å·²ç”Ÿæ•ˆï¼Œé™é¢ç«‹å³æ›´æ–°ã€‚",
      trialEndedTitle: "è¯•ç”¨å·²ç»“æŸ",
      trialEndedBody: "å…è´¹è¯•ç”¨å·²ç»“æŸã€‚å‡çº§å‰æ— æ³•åˆ†æžæ ‡ä¹¦ã€‚",
      viewPlans: "æŸ¥çœ‹å¥—é¤ â†’",
      currentPlanTitle: "å½“å‰å¥—é¤",
      currentPlanBody: "è®¢é˜…çŠ¶æ€ä¸Žè®¡è´¹å‘¨æœŸ",
      plan: "å¥—é¤",
      status: "çŠ¶æ€",
      provider: "æ”¯ä»˜æ–¹",
      billingCycle: "è®¡è´¹å‘¨æœŸ",
      renewal: "ç»­è´¹",
      paymentMethod: "æ”¯ä»˜æ–¹å¼",
      changePlan: "æ›´æ”¹å¥—é¤",
      upgradePlan: "å‡çº§å¥—é¤",
      cancelSubscription: "å–æ¶ˆè®¢é˜…",
      cancelScheduled: "å·²å®‰æŽ’åœ¨å‘¨æœŸç»“æŸæ—¶å–æ¶ˆã€‚",
      upgradesTitle: "å¯ç”¨å‡çº§",
      upgradesBody: "æœ‰ {count} ä¸ªå¥—é¤åŠå·²å¯ç”¨çš„æ”¯ä»˜é€šé“å¯è§",
      upgradesBodyOne: "æœ‰ 1 ä¸ªå¥—é¤åŠå·²å¯ç”¨çš„æ”¯ä»˜é€šé“å¯è§",
      openCheckout: "æ‰“å¼€ç»“è´¦ â†’",
      paymentHistory: "ä»˜æ¬¾è®°å½•",
      noPayments: "æš‚æ— ä»˜æ¬¾ã€‚",
      invoices: "å‘ç¥¨",
      noInvoices: "æš‚æ— å‘ç¥¨ã€‚",
      viewInvoice: "æŸ¥çœ‹",
      trialFallback: "è¯•ç”¨",
      usageTitle: "å·¥ä½œåŒºç”¨é‡",
      trialUsageTitle: "è¯•ç”¨ç”¨é‡",
      trialEndedDesc: "å…è´¹è¯•ç”¨å·²ç»“æŸ â€” å‡çº§ä»¥ç»§ç»­åˆ†æžæ ‡ä¹¦ã€‚",
      unlimitedDesc: "{plan} Â· æ— é™åˆ†æž Â· {status}",
      remainingDesc: "å‰©ä½™ {remaining} / {limit} æ¬¡å…è´¹åˆ†æž",
      trialEnds: "è¯•ç”¨æˆªæ­¢ {date}",
      expired: "Â· å·²è¿‡æœŸ",
      analysesUsed: "å·²ç”¨åˆ†æžæ¬¡æ•°",
      used: "å·²ç”¨",
      remaining: "å‰©ä½™",
      unlimited: "æ— é™",
      hoursSaved: "é¢„è®¡èŠ‚çœå·¥æ—¶",
      risksDetected: "å·²è¯†åˆ«é£Žé™©",
      upgradeContinue: "å‡çº§ä»¥ç»§ç»­",
      runningLow: "é¢åº¦ä¸è¶³ï¼Ÿ",
      seePlans: "æŸ¥çœ‹å¥—é¤",
      trialBadge: "14 å¤©å…è´¹è¯•ç”¨",
      trialEndsIn: "è¯•ç”¨å°†åœ¨ {days} å¤©åŽç»“æŸ",
      trialEndsInOne: "è¯•ç”¨å°†åœ¨ 1 å¤©åŽç»“æŸ",
      trialEndingToday: "è¯•ç”¨å°†äºŽä»Šå¤©ç»“æŸ",
      trialEndsOn: "ç»“æŸæ—¥æœŸï¼š{date}",
      noChargeToday: "ä»Šå¤©ä¸æ‰£è´¹ã€‚",
      paymentMethodRequired: "éœ€è¦æ”¯ä»˜æ–¹å¼",
      trialAutoConvert: "é™¤éžä½ åœ¨è¯•ç”¨ç»“æŸå‰å–æ¶ˆï¼Œæ‰€é€‰è®¢é˜…å°†åœ¨è¯•ç”¨ç»“æŸåŽè‡ªåŠ¨å¼€å§‹ã€‚",
      cancelTrial: "å–æ¶ˆè¯•ç”¨",
      cancelTrialTitle: "å–æ¶ˆè¯•ç”¨ï¼Ÿ",
      cancelTrialExplainConvert: "è¯•ç”¨ä¸ä¼šè½¬ä¸ºä»˜è´¹è®¢é˜…ã€‚",
      cancelTrialExplainAccess: "è¯•ç”¨ç»“æŸåŽï¼Œè®¿é—®å°†éµå¾ªå…è´¹å·¥ä½œåŒºè§„åˆ™ã€‚",
      cancelTrialExplainData: "å…¬å¸æ•°æ®å°†è¢«ä¿ç•™ã€‚",
      cancelPaidTitle: "å–æ¶ˆè®¢é˜…ï¼Ÿ",
      cancelPaidExplainDate: "å–æ¶ˆå°†äºŽ {date} ç”Ÿæ•ˆã€‚",
      cancelPaidExplainAccess: "åœ¨è¯¥æ—¥æœŸä¹‹å‰ä½ ä»å¯ç»§ç»­ä½¿ç”¨ã€‚",
      cancelPaidExplainAfter:
        "æ­¤åŽå·¥ä½œåŒºå°†è½¬ä¸ºå…è´¹å·¥ä½œåŒºã€‚ä¸ä¼šåˆ é™¤å…¬å¸æ–‡æ¡£ã€è¯·æ±‚ã€è¯æ®æˆ–åŽ†å²è®°å½•ã€‚",
      confirmCancel: "ç¡®è®¤å–æ¶ˆ",
      keepPlan: "ä¿ç•™å½“å‰å¥—é¤",
      cancellationDate: "å–æ¶ˆæ—¥æœŸ",
      accessUntil: "åœ¨ {date} ä¹‹å‰ä»å¯ç»§ç»­ä½¿ç”¨ã€‚",
      freeWorkspace: "å…è´¹å·¥ä½œåŒº",
      freeWorkspaceBody:
        "æœ‰é™å·¥ä½œåŒºã€‚åŒ…å«å…¬å¸èµ„æ–™å’Œæœ‰é™çš„æ–‡ä»¶åˆè§„ã€‚ä¸åŒ…å«ä»˜è´¹èƒ½åŠ›ã€‚",
      freeCapabilityProfile: "å…¬å¸èµ„æ–™",
      freeCapabilityCompliance: "æ–‡ä»¶åˆè§„ï¼ˆæœ‰é™ï¼‰",
      nextBillingDate: "ä¸‹æ¬¡æ‰£è´¹æ—¥æœŸ",
      usage: "ç”¨é‡",
      paymentFailed: "æ”¯ä»˜å¤±è´¥",
      pastDue: "å·²é€¾æœŸ",
      statusTrialing: "è¯•ç”¨ä¸­",
      statusActive: "å·²ç”Ÿæ•ˆ",
      statusCanceled: "å·²å–æ¶ˆ",
      statusUnpaid: "æœªæ”¯ä»˜",
      statusExpired: "å·²è¿‡æœŸ",
      statusIncomplete: "æœªå®Œæˆ",
      monthlyInterval: "æŒ‰æœˆ",
      yearlyInterval: "æŒ‰å¹´",
      seatsUsage: "å¸­ä½",
      aiUsage: "AI ç”¨é‡",
      analysesUsage: "åˆ†æžæ¬¡æ•°",
      analysesNotIncluded: "æœªåŒ…å«",
      cancelError: "æš‚æ—¶æ— æ³•å–æ¶ˆã€‚è¯·é‡è¯•æˆ–è”ç³»æ”¯æŒã€‚",
      started: "å¼€å§‹æ—¶é—´",
      paypalMethod: "PayPal",
      graceTitle: "æ”¯ä»˜é—®é¢˜ â€” å®½é™æœŸ",
      graceBody: "æ”¯ä»˜å¤±è´¥ã€‚è®¿é—®å°†æŒç»­åˆ° {date}ã€‚è¯·æ›´æ–°è´¦å•ä»¥å…ä¸­æ–­ã€‚",
      inactiveTitle: "è®¢é˜…æœªç”Ÿæ•ˆ",
      inactiveBody: "å½“å‰è®¢é˜…æœªç”Ÿæ•ˆã€‚å…¬å¸æ•°æ®å·²ä¿ç•™ã€‚ç»­è®¢æˆ–å‡çº§å¯æ¢å¤ä»˜è´¹èƒ½åŠ›ã€‚",
      billingHistory: "è´¦å•è®°å½•",
      billingHistoryEmpty: "æš‚æ— å‘ç¥¨ã€‚æˆåŠŸæˆ–å¤±è´¥çš„æ‰£è´¹åŽä¼šæ˜¾ç¤ºåœ¨è¿™é‡Œã€‚",
      invoiceDate: "æ—¥æœŸ",
      invoiceAmount: "é‡‘é¢",
      invoiceStatus: "çŠ¶æ€",
      viewReceipt: "æŸ¥çœ‹æ”¶æ®",
      updatePaymentMethod: "æ›´æ–°æ”¯ä»˜æ–¹å¼",
      retryPayment: "å¤„ç†ä»˜æ¬¾",
      paymentProblemTitle: "ä»˜æ¬¾é—®é¢˜",
      paymentProblemBody: "æœªèƒ½æ”¶å–è®¢é˜…è´¹ç”¨ã€‚è¯·æ›´æ–°æ”¯ä»˜æ–¹å¼ä»¥ä¿æŒè®¿é—®ã€‚",
      paypalManageHint: "æ­¤è®¢é˜…çš„æ”¯ä»˜æ–¹å¼ç”± PayPal è´¦æˆ·ç®¡ç†ã€‚",
      paymentPortalError: "æ— æ³•æ‰“å¼€å®‰å…¨æ”¯ä»˜é¡µé¢ã€‚è¯·é‡è¯•æˆ–è”ç³»æ”¯æŒã€‚",
      canceledAlertTitle: "æ‚¨çš„è®¢é˜…å·²å–æ¶ˆ",
      subscriptionEndedTitle: "æ‚¨çš„è®¢é˜…å·²ç»“æŸ",
      subscriptionEndedBody: "æ‚¨çš„å·¥ä½œåŒºæ•°æ®å®‰å…¨æ— è™žï¼Œä½†éƒ¨åˆ†é«˜çº§åŠŸèƒ½å·²é”å®šã€‚",
      choosePlan: "é€‰æ‹©å¥—é¤",
      graceDaysRemaining: "æ‚¨è¿˜æœ‰ {days} å¤©æ—¶é—´è§£å†³ä»˜æ¬¾é—®é¢˜ã€‚",
      graceDaysRemainingOne: "æ‚¨è¿˜æœ‰ 1 å¤©æ—¶é—´è§£å†³ä»˜æ¬¾é—®é¢˜ã€‚",
    },
    alerts: {
      title: "æé†’",
      subtitle: "æˆªæ­¢æ—¥æœŸã€å†³ç­–è®°å¿†ã€è¯„åˆ†ã€è¦æ±‚ä¸Žæµç¨‹æ›´æ–°ã€‚",
      emptyTitle: "æš‚æ— æé†’",
      emptyDescription: "æˆªæ­¢æ—¥æœŸã€é£Žé™©ä¸Žåˆ†æžé€šçŸ¥å°†æ˜¾ç¤ºåœ¨è¿™é‡Œã€‚",
      newBadge: "æ–°",
      markAllRead: "å…¨éƒ¨æ ‡ä¸ºå·²è¯»",
      unreadCount: "{count} æ¡æœªè¯»",
    },
    settings: {
      title: "è®¾ç½®",
      subtitle: "è´¦æˆ·åå¥½ä¸Žå·¥ä½œåŒºé»˜è®¤é¡¹ã€‚",
      accountTitle: "è´¦æˆ·",
      accountBody: "å½“å‰ç™»å½•ç”¨æˆ·",
      name: "å§“å",
      email: "é‚®ç®±",
      avatarLabel: "å¤´åƒ",
      avatarHint: "æ˜¾ç¤ºåœ¨é¡¶éƒ¨æ ã€‚æ”¯æŒ JPGã€PNGã€WebP æˆ– GIF Â· æœ€å¤§ 5MBã€‚",
      avatarUpload: "ä¸Šä¼ ç…§ç‰‡",
      avatarUploading: "ä¸Šä¼ ä¸­â€¦",
      avatarRemove: "ç§»é™¤",
      accountSave: "ä¿å­˜æ›´æ”¹",
      accountSaving: "ä¿å­˜ä¸­â€¦",
      accountSaved: "è´¦æˆ·å·²æ›´æ–°ã€‚",
      emailChangeHint: "æ›´æ”¹é‚®ç®±éœ€è¦å½“å‰å¯†ç ï¼Œå¹¶å‘æ–°åœ°å€å‘é€ç¡®è®¤é“¾æŽ¥ã€‚",
      emailChangePending: "å¾…ç¡®è®¤ï¼š{email}ã€‚",
      emailChangeSent: "è¯·æŸ¥æ”¶ {email} ä¸­çš„ç¡®è®¤é“¾æŽ¥ã€‚ç¡®è®¤å‰ä»ä½¿ç”¨å½“å‰é‚®ç®±ã€‚",
      emailChangeResend: "é‡æ–°å‘é€ç¡®è®¤",
      emailChangeResent: "å·²é‡æ–°å‘é€ç¡®è®¤è‡³ {email}ã€‚",
      emailChangeExpires: "è¿‡æœŸæ—¶é—´ {when}ã€‚",
      emailChangePasswordLabel: "å½“å‰å¯†ç ",
      emailChangePasswordHint: "æ›´æ”¹é‚®ç®±æ—¶å¿…é¡»éªŒè¯ã€‚",
      emailChangePasswordRequired: "æ›´æ”¹é‚®ç®±è¯·è¾“å…¥å½“å‰å¯†ç ã€‚",
      emailChangeCancel: "å–æ¶ˆé‚®ç®±æ›´æ”¹",
      emailChangeCancelled: "å·²å–æ¶ˆé‚®ç®±æ›´æ”¹ã€‚",
      emailChangeInvalidTitle: "é“¾æŽ¥æ— æ•ˆæˆ–å·²è¿‡æœŸ",
      emailChangeInvalidBody: "è¯·åœ¨è®¾ç½®ä¸­é‡æ–°ç”³è¯·ç¡®è®¤é“¾æŽ¥ã€‚",
      emailChangeBackSettings: "è¿”å›žè®¾ç½®",
      companyProfileTitle: "å…¬å¸èµ„æ–™",
      companyProfileBody:
        "è¡Œä¸šã€è§„æ¨¡ã€æœåŠ¡ã€å›½å®¶ä¸Žç»éªŒï¼Œç”¨äºŽåŽç»­åˆ†æžä¸­çš„å…¬å¸â€“æ ‡ä¹¦åŒ¹é…ã€‚ä»…é™æœ¬ç»„ç»‡å¯è§ã€‚",
      editCompanyProfile: "ç¼–è¾‘å…¬å¸èµ„æ–™",
      notificationsTitle: "é€šçŸ¥",
      notificationsBody:
        "æˆªæ­¢æ—¥æœŸä¸Žåˆ†æžæé†’ â€” åº”ç”¨å†…ä¸Žé‚®ä»¶ã€‚WhatsApp / çŸ­ä¿¡ / æŽ¨é€å¯ç¨åŽæŽ¥å…¥ã€‚",
      moduleRemindersTitle: "æ¨¡å—æé†’è®¡åˆ’",
      moduleRemindersBody: "æ–‡æ¡£åˆè§„ä¸Žæ‹›æ ‡æ—¥åŽ†å„è‡ªæœ‰æé†’æå‰é‡ã€‚",
      complianceRemindersLink: "æ–‡æ¡£åˆè§„æé†’",
      calendarRemindersLink: "æ‹›æ ‡æ—¥åŽ†æé†’",
      planTitle: "å¥—é¤",
      planUnlimited: "Business Â· æ— é™ Â· å·²ç”¨ {used}",
      planLimited: "å·²ç”¨ {used}/{limit} æ¬¡åˆ†æž",
      manageBilling: "ç®¡ç†è´¦å•",
      viewUpgrade: "æŸ¥çœ‹å‡çº§é€‰é¡¹",
      signOut: "é€€å‡ºç™»å½•",
      revokeOtherSessions: "é€€å‡ºå…¶ä»–è®¾å¤‡",
      revokeOtherSessionsHint: "ä¿æŒå½“å‰ä¼šè¯æœ‰æ•ˆã€‚",
      timezone: "å…¬å¸æ—¶åŒº",
      timezoneHint: "ç”¨äºŽæˆªæ­¢æ—¥æœŸæé†’æ–‡æ¡ˆä¸Žæœ¬åœ°æ—¶é—´æ˜¾ç¤ºã€‚",
      channels: "æ¸ é“",
      channelInApp: "åº”ç”¨å†…æé†’",
      channelEmail: "é‚®ä»¶",
      channelWhatsapp: "WhatsAppï¼ˆå³å°†æŽ¨å‡ºï¼‰",
      channelSms: "çŸ­ä¿¡ï¼ˆå³å°†æŽ¨å‡ºï¼‰",
      channelPush: "æŽ¨é€ï¼ˆå³å°†æŽ¨å‡ºï¼‰",
      deadlineAlerts: "æˆªæ­¢æ—¥æœŸæé†’",
      deadline7d: "æå‰ 7 å¤©",
      deadline3d: "æå‰ 3 å¤©",
      deadline24h: "æå‰ 24 å°æ—¶",
      deadlinePassed: "æˆªæ­¢æ—¥æœŸå·²è¿‡",
      otherAlerts: "å…¶ä»–æé†’",
      alertAnalysisDone: "åˆ†æžå®Œæˆ",
      alertHighRisk: "é«˜é£Žé™©å‘çŽ°",
      alertMissingDocs: "ç¼ºå°‘æ–‡æ¡£",
      alertScoreChange: "è¯„åˆ†æˆ–å†³ç­–å˜æ›´",
      alertRequirementStatus: "è¦æ±‚çŠ¶æ€å˜æ›´",
      alertDecisionMemory: "ç›¸å…³å†³ç­–è®°å¿†",
      alertWorkflow: "æµç¨‹ / ææ–™åŒ…äº‹ä»¶",
      prefsSaved: "åå¥½å·²ä¿å­˜ã€‚",
      savePrefs: "ä¿å­˜é€šçŸ¥åå¥½",
    },
    tenders: {
      title: "æ‹›æ ‡",
      subtitle: "{count} ä»½æ‹›æ ‡ Â· æŒ‰å†³ç­–ã€é£Žé™©ä¸Žæˆªæ­¢æ—¥æœŸç­›é€‰",
      subtitleOne: "1 ä»½æ‹›æ ‡ Â· æŒ‰å†³ç­–ã€é£Žé™©ä¸Žæˆªæ­¢æ—¥æœŸç­›é€‰",
      analyzeCta: "åˆ†æžæ‹›æ ‡",
      emptyTitle: "æš‚æ— æ‹›æ ‡",
      emptyDescription: "ä¸Šä¼  ITT æˆ– PQQï¼ŒèŽ·å– Bid / Review / No-Bid å»ºè®®ã€‚",
      search: "æœç´¢",
      searchPlaceholder: "æ ‡é¢˜æˆ–å®¢æˆ·",
      decision: "å†³ç­–",
      allDecisions: "å…¨éƒ¨å†³ç­–",
      bid: "æŠ•æ ‡",
      review: "å¤æ ¸",
      noBid: "ä¸æŠ•æ ‡",
      risk: "é£Žé™©",
      allRiskLevels: "å…¨éƒ¨é£Žé™©ç­‰çº§",
      low: "ä½Ž",
      medium: "ä¸­",
      high: "é«˜",
      critical: "ä¸¥é‡",
      deadline: "æˆªæ­¢æ—¥æœŸ",
      anyDeadline: "ä»»æ„æˆªæ­¢æ—¥æœŸ",
      next7d: "æœªæ¥ 7 å¤©",
      next14d: "æœªæ¥ 14 å¤©",
      next30d: "æœªæ¥ 30 å¤©",
      overdue: "å·²é€¾æœŸ",
      sort: "æŽ’åº",
      sortRecent: "æœ€è¿‘åˆ†æž",
      sortDeadlineSoon: "æˆªæ­¢æ—¥æœŸæœ€è¿‘",
      sortDeadlineLate: "æˆªæ­¢æ—¥æœŸæœ€è¿œ",
      sortFit: "åŒ¹é…åˆ†æ•°",
      sortTitle: "æ ‡é¢˜ Aâ€“Z",
      colTender: "æ‹›æ ‡",
      colClient: "å®¢æˆ·",
      colDeadline: "æˆªæ­¢æ—¥æœŸ",
      colFit: "åŒ¹é…",
      colDecision: "å†³ç­–",
      colRisk: "é£Žé™©",
      colAnalyzed: "å·²åˆ†æž",
      colNextAction: "ä¸‹ä¸€æ­¥",
      deadlineWithDate: "æˆªæ­¢ {date}",
      fitWithScore: "åŒ¹é… {score}",
      noNextAction: "æš‚æ— ä¸‹ä¸€æ­¥",
    },
    upload: {
      title: "åˆ†æžæ‹›æ ‡",
      subtitle: "ä¸Šä¼  ITT æˆ– PQQï¼ŒèŽ·å– Bid / Review / No-Bid å»ºè®®ã€‚",
      trialLeft: "è¯•ç”¨ Â· å‰©ä½™ {remaining} æ¬¡åˆ†æž",
      trialEnds: " Â· æˆªæ­¢ {date}",
      phaseIdleTitle: "ä¸Šä¼ æ‹›æ ‡æ–‡ä»¶åŒ…",
      phaseIdleBody: "å¯ä¸Šä¼ å¤šä¸ªæ‹›æ ‡æ–‡ä»¶æˆ– ZIP/RAR åŽ‹ç¼©åŒ…ã€‚æˆ‘ä»¬å…³æ³¨æŠ•æ ‡å†³ç­– â€” è€ŒéžåŽŸå§‹æ–‡æ¡£å †ç Œã€‚",
      phaseUploadingTitle: "ä¸Šä¼ ä¸­â€¦",
      phaseUploadingBody: "æ­£åœ¨å®‰å…¨ä¼ è¾“ä½ çš„æ–‡ä»¶ã€‚",
      phaseDiscoveringTitle: "æ­£åœ¨å‘çŽ°æ–‡ä»¶â€¦",
      phaseDiscoveringBody: "æ­£åœ¨æ¸…ç‚¹æ‹›æ ‡åŒ…ä¸­çš„æ¯ä»½æ–‡æ¡£ã€‚",
      phaseExtractingTitle: "æ­£åœ¨è§£åŽ‹æ–‡ä»¶åŒ…â€¦",
      phaseExtractingBody: "æ­£åœ¨è§£åŽ‹ ZIP/RAR å¹¶å‘çŽ°æ‹›æ ‡æ–‡æ¡£ã€‚",
      phasePreparingTitle: "æ­£åœ¨å‡†å¤‡æ–‡æ¡£â€¦",
      phasePreparingBody: "æ­£åœ¨æ ¡éªŒæ–‡ä»¶å¹¶å‡†å¤‡åˆ†æžã€‚",
      phaseProcessingTitle: "æ­£åœ¨å¤„ç†æ–‡æ¡£â€¦",
      phaseProcessingBody: "å·²æŽ’é˜Ÿè¿›è¡Œæå–ä¸Žéœ€æ±‚ç»“æž„åŒ–ã€‚",
      phaseAnalyzingTitle: "æ­£åœ¨åˆ†æžåŒ¹é…â€¦",
      phaseAnalyzingBody: "å¯¹ç…§å…¬å¸èµ„æ–™ã€è¿è¡Œè§„åˆ™å¹¶ç”Ÿæˆå†³ç­–ã€‚",
      phaseSuccessTitle: "åˆ†æžå·²å®Œæˆ",
      phaseSuccessBody: "å†³ç­–åŒ…å·²å¯ç”¨ã€‚",
      phaseErrorTitle: "ä¸Šä¼ å¤±è´¥",
      phaseErrorBody: "ä¸Šä¼ æˆ–å‡†å¤‡æ–‡ä»¶åŒ…æ—¶å‡ºé”™ã€‚è¯·æ£€æŸ¥æ–‡ä»¶åŽé‡è¯•ã€‚",
      phaseAnalysisErrorTitle: "åˆ†æžæœªèƒ½å®Œæˆ",
      phaseAnalysisErrorBody: "æ–‡ä»¶åŒ…å·²æˆåŠŸä¸Šä¼ å¹¶å‡†å¤‡å°±ç»ªã€‚å¤±è´¥å‘ç”Ÿåœ¨åˆ†æžé˜¶æ®µ â€” æ‰“å¼€æ‹›æ ‡æŸ¥çœ‹è¯¦æƒ…ã€‚",
      phaseTimeoutBody: "å·²è¶…è¿‡ 1 åˆ†é’Ÿä»åœ¨å¤„ç†ã€‚è¯·ç¨åŽæ‰“å¼€è¯¥æ‹›æ ‡ â€” åˆ†æžå¯èƒ½åœ¨åŽå°å®Œæˆã€‚",
      phaseTimeoutTitle: "ä»åœ¨å¤„ç†",
      stillWorking: "åˆ†æžä»åœ¨åŽå°è¿›è¡Œ",
      openTender: "æ‰“å¼€æ‹›æ ‡",
      trialUsedTitle: "è¯•ç”¨åˆ†æžå·²ç”¨å°½",
      trialUsedBody: "å‡çº§åŽå¯ç»§ç»­åˆ†æžæ›´å¤šæ‹›æ ‡ã€‚",
      viewPlans: "æŸ¥çœ‹å¥—é¤",
      unlimitedPlan: "å½“å‰ Business å¥—é¤ä¸ºæ— é™åˆ†æž",
      remainingAnalyses: "å‰©ä½™ {count} æ¬¡å…è´¹åˆ†æž",
      dragHere: "å°†æ‹›æ ‡æ–‡ä»¶æˆ– ZIP/RAR åŽ‹ç¼©åŒ…æ‹–æ”¾åˆ°æ­¤å¤„",
      processingTender: "æ­£åœ¨å¤„ç†ä½ çš„æ‹›æ ‡åŒ…â€¦",
      fileTypes: "PDFã€Wordã€Excelã€PowerPointã€CSVã€TXTã€å›¾ç‰‡ã€ZIP/RAR Â· æ¯åŒ…æœ€å¤š {max} ä¸ªæ–‡ä»¶ Â· å•æ–‡ä»¶æœ€å¤§ {maxFileMb}MB Â· æ•´åŒ…æœ€å¤§ {maxPackageMb}MB",
      chooseFile: "é€‰æ‹©æ–‡ä»¶",
      filesSelected: "å·²é€‰æ‹© {count} ä¸ªæ–‡ä»¶",
      maxFilesReached: "æ¯ä¸ªåŒ…æœ€å¤š {max} ä¸ªæ–‡ä»¶ã€‚",
      filesDiscovered: "åŒ…ä¸­å‘çŽ° {count} ä¸ªæ–‡ä»¶",
      removeFile: "ç§»é™¤",
      statusReady: "å°±ç»ª",
      statusUploading: "ä¸Šä¼ ä¸­â€¦",
      statusDiscovering: "å‘çŽ°ä¸­â€¦",
      statusExtracting: "è§£åŽ‹ä¸­â€¦",
      statusPreparing: "å‡†å¤‡ä¸­â€¦",
      statusProcessing: "å¤„ç†ä¸­â€¦",
      statusAnalyzing: "åˆ†æžä¸­â€¦",
      startUpload: "ä¸Šä¼ å¹¶åˆ†æž",
      waitForUpload: "è¯·ç­‰å¾…å½“å‰ä¸Šä¼ å®ŒæˆåŽå†æ·»åŠ æ›´å¤šæ–‡ä»¶ã€‚",
      bodyTooLarge:
        "æ‹›æ ‡åŒ…è¿‡å¤§ï¼Œæ— æ³•å®Œæˆæœ¬æ¬¡è¯·æ±‚ã€‚è¯·å‡å°‘æ–‡ä»¶æ•°é‡ï¼Œæˆ–åœ¨æé«˜å¤§å°é™åˆ¶åŽé‡å¯åº”ç”¨å†è¯•ã€‚",
      decisionReady: "å†³ç­–å·²å°±ç»ª â€” è¯·æ‰“å¼€ä¸‹æ–¹ç»“æžœåŒ…ã€‚",
      unableContinue: "æ— æ³•ç»§ç»­",
      openDecision: "æ‰“å¼€å†³ç­–",
      uploadAnother: "å†ä¸Šä¼ ä¸€ä»½",
      tryAgain: "é‡è¯•",
      creditsExhausted: "å…è´¹åˆ†æžæ¬¡æ•°å·²ç”¨å®Œã€‚å‡çº§åŽå¯ç»§ç»­ã€‚",
      passwordRequiredTitle: "éœ€è¦å¯†ç ",
      passwordRequiredBody: "æ­¤æ–‡ä»¶å—å¯†ç ä¿æŠ¤ã€‚è¯·è¾“å…¥å¯†ç ä»¥ç»§ç»­ã€‚",
      passwordLabel: "åŽ‹ç¼©åŒ…å¯†ç ",
      passwordSubmit: "è§£é”å¹¶ç»§ç»­",
      passwordCancel: "å–æ¶ˆ",
      passwordWrong: "å¯†ç ä¸æ­£ç¡®ã€‚è¯·é‡è¯•ã€‚",
      intakeRepairedTitle: "å·²è‡ªåŠ¨ä¿®å¤",
      intakePartialTitle: "éƒ¨åˆ†å¯è¯»",
      intakeIncompleteTitle: "æ–‡ä»¶åŒ…ä¸å®Œæ•´",
      intakeReadyTitle: "å¯å¼€å§‹åˆ†æž",
      intakeBlockedTitle: "åˆ†æžå·²é˜»æ­¢",
      intakeUnsupportedTitle: "ä¸æ”¯æŒçš„æ ¼å¼",
      intakeCorruptedTitle: "æ–‡ä»¶å·²æŸå",
      intakePartiallyReadableTitle: "éƒ¨åˆ†å¯è¯»2",
    },
    tenderDetail: {
      backToTenders: "â† æ‹›æ ‡",
      unknownClient: "æœªçŸ¥å®¢æˆ·",
      deadline: "æˆªæ­¢æ—¥æœŸ",
      analyzed: "å·²åˆ†æž",
      fullReport: "å®Œæ•´æŠ¥å‘Š",
      analysisInProgressTitle: "åˆ†æžè¿›è¡Œä¸­",
      analysisInProgressBody: "çŠ¶æ€ï¼š{status}ã€‚è¯·ç¨åŽåˆ·æ–° â€” æ­£åœ¨å¤„ç†ã€‚",
      analysisFailedTitle: "åˆ†æžå¤±è´¥",
      analysisFailedBody: "å¤„ç†å·²ä»¥ç»ˆç«¯å¤±è´¥ç»“æŸã€‚è¯·æŸ¥çœ‹ä¸‹æ–¹é”™è¯¯è¯¦æƒ…ã€‚",
      analysisFailedPhase: "åœæ­¢äºŽé˜¶æ®µï¼š{phase}",
      canonicalNote:
        "è§„èŒƒåˆ†æž â€” æ¯ä½æŽˆæƒç”¨æˆ·çœ‹åˆ°ç›¸åŒçš„è¦æ±‚ã€åˆè§„ã€åŒ¹é…ã€å°±ç»ªåº¦ã€é£Žé™©ã€Bid Score ä¸Žå»ºè®®ã€‚è§’è‰²ä»…æŽ§åˆ¶è®¿é—®æƒé™ã€‚",
      missingDocuments: "ç¼ºå°‘æ–‡æ¡£",
      required: "å¿…éœ€",
      nextActions: "ä¸‹ä¸€æ­¥",
      noNextActions: "æ­¤å†³ç­–æš‚æ— æŽ¨èè¡ŒåŠ¨ã€‚",
      teamWorkflow: {
        title: "å›¢é˜Ÿå†³ç­–æµç¨‹",
        subtitle:
          "å°†è¦æ±‚ã€é£Žé™©ä¸Žç¼ºå¤±è¯æ®åˆ†é…ç»™è´¢åŠ¡ã€æ³•åŠ¡ã€æŠ€æœ¯ç­‰éƒ¨é—¨ã€‚å›¢é˜Ÿå›žå¤ä»…ä¸ºè¯æ®ï¼Œä¸ä¼šè‡ªåŠ¨æ”¹å˜ Decision Engineã€‚",
        empty: "æš‚æ— å›¢é˜Ÿä»»åŠ¡ã€‚",
        criticalBanner: "æœ€ç»ˆå†³ç­–å‰ä»æœ‰ {count} é¡¹æœªè§£å†³çš„å…³é”®å›¢é˜Ÿä»»åŠ¡ã€‚",
        assign: "åˆ†é…",
        respond: "ä¿å­˜å›žå¤",
        complete: "å®Œæˆå¹¶æäº¤å›žå¤",
        create: "åˆ›å»ºä»»åŠ¡",
        responsePlaceholder: "è¾“å…¥å·²æ ¸å®žå›žå¤ï¼ˆå‹¿ç¼–é€ ï¼‰â€¦",
        evidencePlaceholder: "è¯æ®è¯´æ˜Žï¼ˆå¯é€‰ï¼‰â€¦",
        department: "éƒ¨é—¨",
        assignee: "è´Ÿè´£äºº",
        requiredResponse: "æ‰€éœ€å›žå¤",
        linkedItem: "å…³è”æ ‡ä¹¦é¡¹",
      },
      decisionSupport: "å†³ç­–æ”¯æŒ",
      fitSuffix: "åŒ¹é…",
      overallFit: "æ€»ä½“åŒ¹é…",
      confidence: "ç½®ä¿¡åº¦",
      confidenceHigh: "é«˜",
      confidenceMedium: "ä¸­",
      confidenceLow: "ä½Ž",
      heroBidLabel: "Bidvera å»ºè®®è·Ÿè¿›",
      heroBidHint: "æ ¹æ®çŽ°æœ‰ä¿¡æ¯ï¼ŒåŒ¹é…åº¦æ”¯æŒæŠ•å…¥æŠ•æ ‡ç²¾åŠ› â€” æäº¤å‰ä»éœ€æ ¸å®žã€‚",
      heroReviewLabel: "Bidvera å»ºè®®å¤æ ¸",
      heroReviewHint: "æ¨¡ç³Šã€ç¼ºå£æˆ–æœªçŸ¥é¡¹éœ€äººå·¥ç¡®è®¤åŽå†æ‰¿è¯ºã€‚",
      heroNoBidLabel: "Bidvera å»ºè®®ä¸è·Ÿè¿›",
      heroNoBidHint: "æ ¹æ®çŽ°æœ‰æ•°æ®ï¼Œå…³é”®ç¼ºå£ä½¿æŠ•æ ‡æŠ•å…¥å›žæŠ¥ä¸å¤§ â€” è¯·ä¸Žå›¢é˜Ÿç¡®è®¤ã€‚",
      companyTenderFit: "å…¬å¸â€“æ‹›æ ‡åŒ¹é…",
      unknown: "æœªçŸ¥",
      basisAi: " Â· AI è¯„ä¼°",
      basisNotProvided: " Â· æœªæä¾›",
      basisFromProfile: " Â· æ¥è‡ªå…¬å¸èµ„æ–™",
      basisFromTender: " Â· æ¥è‡ªæ‹›æ ‡",
      tenderReadiness: "æ‹›æ ‡å°±ç»ªåº¦",
      readinessCounts: "{ready} å°±ç»ª Â· {verify} å¾…æ ¸ Â· {missing} ç¼ºå¤±",
      recommendation: "å»ºè®®ï¼š",
      keyBlockers: "å…³é”®é˜»ç¢",
      keyBlockersNext: "å»ºè®®ä¸‹ä¸€æ­¥ï¼šåœ¨æœ€ç»ˆæŠ•æ ‡å†³ç­–å‰è§£å†³çªå‡ºé—®é¢˜ã€‚",
      whyTitle: "ä¸ºä½•ç»™å‡ºæ­¤å»ºè®®ï¼Ÿ",
      executiveSummary: "æ‰§è¡Œæ‘˜è¦",
      viewDetails: "æŸ¥çœ‹è¯¦æƒ…",
      hideDetails: "æ”¶èµ·è¯¦æƒ…",
      topReasons: "å…³é”®åŽŸå› ",
      criticalAlerts: "å…³é”®äº‹é¡¹",
      whatToDoNext: "ä¸‹ä¸€æ­¥å»ºè®®",
      decisionDisclaimer:
        "Bidvera æä¾›åŸºäºŽè¯æ®çš„å»ºè®®ã€‚æœ€ç»ˆå†³ç­–æƒåœ¨è´µå…¬å¸ã€‚",
      expiredDeadlineAlert: "æäº¤æˆªæ­¢æ—¥æœŸå·²è¿‡ â€” è¯·ç¡®è®¤è¯¥æ‹›æ ‡æ˜¯å¦ä»å¼€æ”¾ã€‚",
      mandatoryGapAlert: "å¼ºåˆ¶æ€§ç¼ºå£",
      missingDocumentAlert: "ç¼ºå°‘æ–‡æ¡£",
      detailedAnalysisTitle: "è¯¦ç»†åˆ†æž",
      detailedAnalysisHint:
        "å®Œæ•´è¦æ±‚ã€åˆè§„ã€è¯æ®ã€é£Žé™©ã€åŒ¹é…ä¸Žå·¥ä½œæµ â€” ä¸ŽæŠ¥å‘Šç›¸åŒçš„è§„èŒƒæ•°æ®ã€‚",
    },
    report: {
      backToTender: "â† æ‹›æ ‡",
      title: "åˆ†æžæŠ¥å‘Š",
      subtitle: "å®Œæ•´å†³ç­–åŒ… â€” æŸ¥çœ‹ã€æ‰“å°ã€ä¸‹è½½ PDF æˆ–åˆ†äº«åªè¯»é“¾æŽ¥ã€‚",
      reportNotReady: "æŠ¥å‘Šå°šæœªå°±ç»ª",
      reportNotReadyBody: "æŠ¥å‘Šå°šæœªå°±ç»ªï¼Œè¯·ç¨åŽé‡è¯•ã€‚",
      print: "æ‰“å°",
      downloadPdf: "ä¸‹è½½ PDF",
      shareLink: "åˆ†äº«é“¾æŽ¥",
      copied: "å·²å¤åˆ¶ã€‚",
      shareExpires: "72 å°æ—¶åŽå¤±æ•ˆ Â· åªè¯»ï¼š",
      revokeShare: "æ’¤é”€å·²åˆ†äº«é“¾æŽ¥",
      shareRevoked: "å·²æ’¤é”€åˆ†äº«é“¾æŽ¥ã€‚",
      reportEyebrow: "Bidvera å†³ç­–æŠ¥å‘Š",
      unknownClient: "æœªçŸ¥å®¢æˆ·",
      deadline: "æˆªæ­¢æ—¥æœŸ",
      analyzed: "å·²åˆ†æž",
      recommendation: "å»ºè®®",
      companyTenderFit: "å…¬å¸â€“æ‹›æ ‡åŒ¹é…åº¦",
      confidence: "ç½®ä¿¡åº¦",
      whyTitle: "ä¸ºä½•ç»™å‡ºæ­¤å»ºè®®",
      bidScore: "æŠ•æ ‡è¯„åˆ†",
      bidScoreLine: "æŠ•æ ‡è¯„åˆ†ï¼š{score}/100 â€” {priority}",
      expectedValue: "é¢„æœŸä»·å€¼ï¼š",
      risk: "é£Žé™©ï¼š",
      effort: "æŠ•å…¥ï¼š",
      positive: "æ­£é¢",
      negative: "è´Ÿé¢",
      overall: "æ€»ä½“",
      unknown: "æœªçŸ¥",
      tenderReadiness: "æ‹›æ ‡å°±ç»ªåº¦",
      readinessCounts: "{ready} å°±ç»ª Â· {verify} å¾…æ ¸ Â· {missing} ç¼ºå¤±",
      nextStep: "ä¸‹ä¸€æ­¥ï¼š",
      complianceMatrix: "åˆè§„çŸ©é˜µ",
      requirements: "è¦æ±‚",
      ready: "å°±ç»ª",
      missing: "ç¼ºå¤±",
      verify: "å¾…æ ¸",
      notApplicable: "ä¸é€‚ç”¨",
      withSources: "æœ‰æ¥æº",
      mandatory: "å¼ºåˆ¶",
      optional: "å¯é€‰",
      evidenceLabel: "è¯æ®ï¼š",
      noExcerpt: "æš‚æ— æ”¯æŒæ‘˜å½•ã€‚",
      page: "ç¬¬ {n} é¡µ",
      sourceNotLocated: "æ— æ³•ç²¾ç¡®å®šä½æ¥æºã€‚",
      noRequirements: "æœªä»Žæ­¤æ‹›æ ‡ä¸­æå–åˆ°è¦æ±‚ã€‚",
      missingRequirements: "ç¼ºå¤±è¦æ±‚",
      noMissingRequirements: "æœªå‘çŽ°ç¼ºå¤±è¦æ±‚ã€‚",
      mandatoryParen: "ï¼ˆå¼ºåˆ¶ï¼‰",
      verificationItems: "å¾…æ ¸é¡¹",
      nothingPendingVerify: "æ— å¾…æ ¸é¡¹ã€‚",
      risks: "é£Žé™©",
      noRisks: "æœªæ ‡è®°é‡å¤§é£Žé™©ã€‚",
      clarifications: "æ¾„æ¸…é—®é¢˜",
      noClarifications: "æœªç”Ÿæˆæ¾„æ¸…é—®é¢˜ â€” æœªæ£€æµ‹åˆ°æ˜Žæ˜¾æ­§ä¹‰ã€‚",
      reason: "åŽŸå› ï¼š",
      source: "æ¥æºï¼š",
      evidence: "è¯æ®",
      noEvidence: "æš‚æ— æ¥æºæ‘˜å½•ã€‚",
      historicalTitle: "ç›¸å…³åŽ†å²æƒ…æŠ¥",
      historicalBody:
        "ç±»ä¼¼çš„åŽ†å²ç»“æžœå¯ä¸ºæœ¬æ¬¡æœºä¼šæä¾›å‚è€ƒä¿¡å·ã€‚è¿™åªæ˜¯é¢å¤–ä¿¡å· â€” ä¸ä¿è¯æˆè´¥ã€‚",
      historicalPriority: "å½“å‰æ‹›æ ‡è¯æ®ä¸Žå…¬å¸èµ„æ–™å§‹ç»ˆä¼˜å…ˆã€‚",
      historicalEmpty: "å°šæ— é€‚ç”¨äºŽæœ¬æœºä¼šçš„å·²éªŒè¯åŽ†å²æ¨¡å¼ã€‚",
      decisionMemoryTitle: "å†³ç­–è®°å¿†",
      currentAnalysisLabel: "å½“å‰åˆ†æž",
      historicalDecisionLabel: "åŽ†å²å†³ç­–",
      decisionMemoryCurrentNote:
        "ä¸Šæ–¹çš„è¯„åˆ†ã€è¦æ±‚ä¸Žå»ºè®®æ˜¯æœ¬æ‹›æ ‡çš„æƒå¨ç»“æžœï¼Œä¸ä¼šå› åŽ†å²è®°å½•è€Œæ”¹å˜ã€‚",
      decisionMemoryEmpty: "å°šæ— ä¸Žæœ¬æ¬¡æœºä¼šç›¸å…³çš„æ—¢å¾€å†³ç­–ã€‚",
      relevanceReasons: "ç›¸å…³åŽŸå› ",
      missingDocuments: "ç¼ºå¤±æ–‡ä»¶",
      nextActions: "å»ºè®®ä¸‹ä¸€æ­¥",
      noNextActions: "æ— å»ºè®®æ“ä½œã€‚",
      basisDirect: "ç›´æŽ¥æ¥æº",
      basisAi: "AI è§£è¯»",
      basisUncertain: "æ¥æºä¸ç¡®å®š",
      evidenceVerificationTitle: "è¯æ®ä¸ŽéªŒè¯",
      evidenceVerificationDisclaimer:
        "éªŒè¯ä»…åæ˜ å·²è®°å½•çš„è¯æ®å’Œäººå·¥å®¡æ ¸ã€‚AI è§£è¯»æ°¸è¿œä¸ä¼šè¢«è§†ä¸ºå·²éªŒè¯ã€‚",
      verificationSummary:
        "{verified} å·²éªŒè¯ Â· {needs} å¾…éªŒè¯ Â· {missing} ç¼ºå°‘è¯æ® Â· {na} ä¸é€‚ç”¨",
      noVerificationChains: "æ­¤æ‹›æ ‡æš‚æ— éªŒè¯é“¾ã€‚",
      verificationStatusVerified: "å·²éªŒè¯",
      verificationStatusNeedsVerification: "å¾…éªŒè¯",
      verificationStatusMissingEvidence: "ç¼ºå°‘è¯æ®",
      verificationStatusNotApplicable: "ä¸é€‚ç”¨",
      verifierLabel: "éªŒè¯äººï¼š",
      verifiedAtLabel: "éªŒè¯æ—¶é—´ï¼š",
      decisionOutcomeTitle: "å†³ç­–ç»“æžœ",
      decisionOutcomeBidvera: "Bidvera å†³ç­–",
      decisionOutcomeHuman: "äººå·¥æœ€ç»ˆå†³ç­–",
      decisionOutcomeActual: "å®žé™…ç»“æžœ",
      decisionOutcomeDate: "ç»“æžœæ—¥æœŸ",
      decisionOutcomeReason: "ç»“æžœåŽŸå› ",
      decisionOutcomeSuccess: "å†³ç­–ä¸Žç»“æžœ",
      decisionOutcomeSuccessAligned: "åŽŸå§‹å†³ç­–ä¸Žç»“æžœä¸€è‡´",
      decisionOutcomeSuccessMisaligned: "åŽŸå§‹å†³ç­–ä¸Žç»“æžœä¸ä¸€è‡´",
      decisionOutcomeSuccessPending: "ç»“æžœå¾…å®š",
      decisionOutcomeSuccessNeutral: "ç›¸å¯¹äºŽåŽŸå§‹å†³ç­–ä¸ºä¸­æ€§",
      decisionOutcomeRecorded: "å·²è®°å½•ç»“æžœ",
      outcomeLearningTitle: "åŸºäºŽç»“æžœçš„åŽ†å²æƒ…æŠ¥",
      decisionOutcomeAttachment: "æ”¯æŒæ–‡ä»¶",
      decisionOutcomeEvalSuccessful: "æˆåŠŸ",
      decisionOutcomeEvalUnsuccessful: "æœªæˆåŠŸ",
      decisionOutcomeEvalNotEvaluated: "æœªè¯„ä¼°",
    },
    decisionMemory: {
      title: "å†³ç­–è®°å¿†",
      subtitle: "è´µå¸æ—¢å¾€æ‹›æ ‡å†³ç­– â€” ä»…ä¾›å‚è€ƒï¼Œç»ä¸æ”¹å˜å½“å‰åˆ†æžã€‚",
      emptyTitle: "å°šæ— å·²å­˜å‚¨å†³ç­–",
      emptyDescription: "å®Œæˆçš„æ‹›æ ‡åˆ†æžä¼šè‡ªåŠ¨å‡ºçŽ°åœ¨æ­¤ã€‚æ‰“å¼€æ‹›æ ‡å¯å¯¹æ¯”å½“å‰åˆ†æžä¸ŽåŽ†å²å†³ç­–ã€‚",
      emptyDescriptionCompanyContext:
        "å½“å†³ç­–æ™ºèƒ½ä¸ºè´µå¸è®°å½•ç»“æžœæ—¶ï¼Œå·²å­˜å†³ç­–ä¼šå‡ºçŽ°åœ¨æ­¤ã€‚è¯·ä¿æŒèµ„è´¨ä¸Žè¯æ®æœ€æ–°ï¼Œä»¥ä¾¿æœªæ¥å†³ç­–æœ‰å……åˆ†çš„å…¬å¸èƒŒæ™¯ã€‚",
      viewTender: "æ‰“å¼€æ‹›æ ‡",
      openCompanyProfile: "æ‰“å¼€å…¬å¸èµ„æ–™",
      analyzed: "å·²åˆ†æž",
      scores: "è¯„åˆ†",
      requirements: "è¦æ±‚",
      risks: "é£Žé™©",
      reasoning: "ç†ç”±",
      relevance: "ç›¸å…³æ€§",
      disclaimer: "åŽ†å²å†³ç­– â€” ä»…ä¾›å‚è€ƒã€‚ä¸ä¼šæ”¹å˜å½“å‰åˆ†æžçš„è¯„åˆ†æˆ–å»ºè®®ã€‚",
      back: "è¿”å›žå†³ç­–è®°å¿†",
    },
    pwa: {
      availableOn: "é€‚ç”¨äºŽ Windows ä¸Ž macOS",
      updateTitle: "åº”ç”¨æ›´æ–°å·²å°±ç»ª",
      updateBody: "æœ‰æ–°çš„ Bidvera æ¡Œé¢ç‰ˆæœ¬å¯ç”¨ã€‚é‡æ–°åŠ è½½ä»¥åº”ç”¨ã€‚",
      updateNow: "ç«‹å³æ›´æ–°",
      installedTitle: "Bidvera å·²å®‰è£…",
      installedBody: "ä½ æ­£åœ¨ä½¿ç”¨æ¡Œé¢åº”ç”¨æ¨¡å¼ â€” å¯ä»Žç¨‹åºåžæˆ–ä»»åŠ¡æ æ›´å¿«æ‰“å¼€ã€‚",
      title: "å°† Bidvera å®‰è£…ä¸ºæ¡Œé¢åº”ç”¨",
      bodyBefore: "é€‚ç”¨äºŽ",
      bodyAnd: "å’Œ",
      bodyAfter: "â€” ç‹¬ç«‹çª—å£æ‰“å¼€ï¼Œæ— éœ€ App Storeã€‚",
      installCta: "å®‰è£… Bidvera",
      openingInstaller: "æ­£åœ¨æ‰“å¼€å®‰è£…ç¨‹åºâ€¦",
      dismiss: "å…³é—­",
      guideTitleSafari: "åœ¨ Safari ä¸­å®‰è£… Bidvera",
      guideTitleEdge: "åœ¨ Edge ä¸­å®‰è£… Bidvera",
      guideTitleChrome: "åœ¨ Chrome ä¸­å®‰è£… Bidvera",
      guideTitleDefault: "å®‰è£… Bidvera",
      guideDescription: "æŒ‰ä»¥ä¸‹æ­¥éª¤å°† Bidvera æ·»åŠ ä¸ºæ¡Œé¢åº”ç”¨ã€‚",
      desktopMeta: "æ¡Œé¢åº”ç”¨ Â· Windows ä¸Ž macOS",
      openInstallDialog: "æ‰“å¼€å®‰è£…å¯¹è¯æ¡†",
      gotIt: "çŸ¥é“äº†",
      iosStep1: "åœ¨ Safari ä¸­ç‚¹æŒ‰å…±äº«æŒ‰é’®ã€‚",
      iosStep2: "é€‰æ‹©",
      iosStep2Strong: "æ·»åŠ åˆ°ä¸»å±å¹•",
      iosStep3: "ç¡®è®¤ â€” Bidvera å¯ä»Žä¸»å±å¹•å…¨å±æ‰“å¼€ã€‚",
      safariMacStep1: "åœ¨èœå•æ æ‰“å¼€",
      safariMacStep1Strong: "æ–‡ä»¶",
      safariMacStep2: "é€‰æ‹©",
      safariMacStep2Strong: "æ·»åŠ åˆ°ç¨‹åºåž",
      safariMacStep3: "ç¡®è®¤ â€” Bidvera ä¼šåƒ Mac åº”ç”¨ä¸€æ ·å‡ºçŽ°åœ¨ç¨‹åºåžã€‚",
      chromiumStep1Before: "æŸ¥çœ‹ {browser} åœ°å€æ å³ä¾§çš„",
      chromiumStep1Strong: "å®‰è£… / ç”µè„‘",
      chromiumStep1After: "å›¾æ ‡ã€‚",
      chromiumStep2Before: "ç‚¹å‡»åŽé€‰æ‹©",
      chromiumStep2Strong: "å®‰è£…",
      chromiumStep3Before: "æˆ–æ‰“å¼€æµè§ˆå™¨èœå• â†’",
      chromiumStep3Install: "å®‰è£… Bidvera",
      chromiumStep3Mid: "/",
      chromiumStep3Apps: "åº”ç”¨ â†’ å°†æ­¤ç½‘ç«™å®‰è£…ä¸ºåº”ç”¨",
    },
  },
};

const ar: Dictionary = {
  nav: {
    product: "Ø§Ù„Ù…Ù†ØªØ¬",
    pricing: "Ø§Ù„Ø£Ø³Ø¹Ø§Ø±",
    faq: "Ø§Ù„Ø£Ø³Ø¦Ù„Ø©",
    solutions: "Ø§Ù„Ø­Ù„ÙˆÙ„",
    resources: "Ø§Ù„Ù…ÙˆØ§Ø±Ø¯",
    signIn: "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„",
    startFree: "Ø§Ø¨Ø¯Ø£ Ù…Ø¬Ø§Ù†Ù‹Ø§",
    app: "Ø§Ù„ØªØ·Ø¨ÙŠÙ‚",
    language: "Ø§Ù„Ù„ØºØ©",
  },
  brand: {
    tagline: "Ø§Ø¹Ø±Ù Ù…Ø§ ÙŠØ³ØªØ­Ù‚ Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©. Ø§Ø¹Ø±Ù Ù…Ø§ Ø£Ù†Øª Ø¬Ø§Ù‡Ø² Ù„Ù‡.",
    description:
      "ØªØ³Ø§Ø¹Ø¯ Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ Ø§Ù„Ø´Ø±ÙƒØ§Øª Ø¹Ù„Ù‰ ÙÙ‡Ù… Ø§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© ÙˆØ¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø§Ù…ØªØ«Ø§Ù„ ÙˆØ§Ù„ØªØ£Ù‡ÙŠÙ„ ÙˆØªÙ†Ø¸ÙŠÙ… Ø§Ù„Ø£Ø¯Ù„Ø© ÙˆØªÙ‚ÙŠÙŠÙ… Ø§Ù„ÙØ±Øµ Ø°Ø§Øª Ø§Ù„ØµÙ„Ø© ÙˆØ§ØªØ®Ø§Ø° Ù‚Ø±Ø§Ø±Ø§Øª Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„ØªÙØ³ÙŠØ±.",
  },
  legal: {
    footerHeading: "Ù‚Ø§Ù†ÙˆÙ†ÙŠ",
    privacyLink: "Ø³ÙŠØ§Ø³Ø© Ø§Ù„Ø®ØµÙˆØµÙŠØ©",
    termsLink: "Ø´Ø±ÙˆØ· Ø§Ù„Ø®Ø¯Ù…Ø©",
    privacyEyebrow: "Ù‚Ø§Ù†ÙˆÙ†ÙŠ",
    privacyTitle: "Ø³ÙŠØ§Ø³Ø© Ø§Ù„Ø®ØµÙˆØµÙŠØ©",
    privacyMetaDescription:
      "ÙƒÙŠÙ ØªØ¹Ø§Ù„Ø¬ Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø´Ø®ØµÙŠØ© Ù„Ù„Ø­Ø³Ø§Ø¨Ø§Øª ÙˆÙ…Ø³Ø§Ø­Ø§Øª Ø§Ù„Ø¹Ù…Ù„ ÙˆØ§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª ÙˆØ§Ù„ÙÙˆØªØ±Ø© ÙˆØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¹Ø¨Ø± ÙƒÙˆÙƒÙˆÙ„ ÙˆØ§Ù„Ø£Ù…Ø§Ù† Ø¹Ù„Ù‰ getbidvera.com.",
    termsEyebrow: "Ù‚Ø§Ù†ÙˆÙ†ÙŠ",
    termsTitle: "Ø´Ø±ÙˆØ· Ø§Ù„Ø®Ø¯Ù…Ø©",
    termsMetaDescription:
      "Ø´Ø±ÙˆØ· Ø§Ø³ØªØ®Ø¯Ø§Ù… Ù…Ù†ØµØ© Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ Ø§Ù„Ø³Ø­Ø§Ø¨ÙŠØ©ØŒ Ø¨Ù…Ø§ ÙÙŠ Ø°Ù„Ùƒ Ø§Ù„Ø­Ø³Ø§Ø¨Ø§Øª ÙˆÙ…Ø®Ø±Ø¬Ø§Øª Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ ÙˆØ§Ù„Ø§Ø´ØªØ±Ø§ÙƒØ§Øª ÙˆØ§Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„Ù…Ù‚Ø¨ÙˆÙ„.",
    effectiveDateLabel: "ØªØ§Ø±ÙŠØ® Ø§Ù„Ø³Ø±ÙŠØ§Ù†",
    lastUpdatedLabel: "Ø¢Ø®Ø± ØªØ­Ø¯ÙŠØ«",
    onThisPage: "ÙÙŠ Ù‡Ø°Ù‡ Ø§Ù„ØµÙØ­Ø©",
    relatedDocuments: "Ø°Ø§Øª ØµÙ„Ø©",
  },
  landing: {
    headline: "Ø§Ø¹Ø±Ù Ù…Ø§ ÙŠØ³ØªØ­Ù‚ Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©. Ø§Ø¹Ø±Ù Ù…Ø§ Ø£Ù†Øª Ø¬Ø§Ù‡Ø² Ù„Ù‡.",
    subhead:
      "ØªØ³Ø§Ø¹Ø¯ Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ ÙØ±Ù‚ Ø§Ù„Ø£Ø¹Ù…Ø§Ù„ Ø¹Ù„Ù‰ ÙÙ‡Ù… Ø¬Ø§Ù‡Ø²ÙŠØ© Ø§Ù„Ø´Ø±ÙƒØ©ØŒ ÙˆØ¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø§Ù…ØªØ«Ø§Ù„ ÙˆØ§Ù„ØªØ£Ù‡ÙŠÙ„ØŒ ÙˆØªÙ†Ø¸ÙŠÙ… Ø§Ù„Ø£Ø¯Ù„Ø©ØŒ ÙˆØªÙ‚ÙŠÙŠÙ… Ø§Ù„Ø¹Ù…Ù„ Ø°ÙŠ Ø§Ù„ØµÙ„Ø©ØŒ ÙˆØªØ­ÙˆÙŠÙ„ Ø§Ù„Ù‚Ø±Ø§Ø±Ø§Øª Ø§Ù„Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„ØªÙØ³ÙŠØ± Ø¥Ù„Ù‰ Ø®Ø·ÙˆØ§Øª ØªØ§Ù„ÙŠØ© ÙˆØ§Ø¶Ø­Ø©.",
    ctaPrimary: "Ø§Ø³ØªÙƒØ´Ù Ø¨ÙŠØ¯ÙØ±Ø§Ø¡",
    ctaSecondary: "ÙƒÙŠÙ ÙŠØ¹Ù…Ù„",
    trialNote: "Ø§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© Â· Ø§Ù„ÙØ±Øµ Â· Ø§Ù„Ø£Ø¯Ù„Ø© Â· Ø§Ù„Ù‚Ø±Ø§Ø±Ø§Øª Â· Ø§Ù„ØªÙ†ÙÙŠØ°",
    previewLabel: "Ø°ÙƒØ§Ø¡ Ø§Ù„Ù‚Ø±Ø§Ø±",
    previewQuestion: "Ù‡Ù„ Ø£Ù†Øª Ø¬Ø§Ù‡Ø² Ù„Ù„Ù…ØªØ§Ø¨Ø¹Ø©ØŸ",
    previewDecision: "REVIEW",
    previewFit: "ØªÙˆØ§ÙÙ‚ Ø¬Ø§Ù‡Ø²ÙŠØ© Ù‚ÙˆÙŠ",
    previewRisk: "ØªÙ… Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø§Ù„Ø£Ø¯Ù„Ø©",
    previewRiskValue: "Ù£ Ù…ØªØ·Ù„Ø¨Ø§Øª Ù…Ø¤ÙƒØ¯Ø©",
    previewMissing: "ÙŠØ­ØªØ§Ø¬ Ø§Ù†ØªØ¨Ø§Ù‡Ù‹Ø§",
    previewMissingValue: "Ø¨Ù†Ø¯ ØªØ£Ù‡ÙŠÙ„ ÙˆØ§Ø­Ø¯ Ù„Ù„ØªØ­Ù‚Ù‚",
    previewNext: "Ø§Ù„Ø®Ø·ÙˆØ© Ø§Ù„ØªØ§Ù„ÙŠØ©",
    previewNextValue: "ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø£Ø¯Ù„Ø© Ø§Ù„Ù…ØªØ¨Ù‚ÙŠØ©",
    previewWhy:
      "Ø§Ù„ØªØ£Ù‡ÙŠÙ„ ÙŠØ¨Ø¯Ùˆ Ù‚ÙˆÙŠÙ‹Ø§. Ù…Ø§ ÙŠØ²Ø§Ù„ Ø¨Ù†Ø¯ ÙˆØ§Ø­Ø¯ ÙŠØ­ØªØ§Ø¬ ØªØ­Ù‚Ù‚Ù‹Ø§ Ù‚Ø¨Ù„ Ø§Ù„ØªØ²Ø§Ù… Ø§Ù„ÙØ±ÙŠÙ‚.",
    sectionTitle: "Ù„Ù…Ø§Ø°Ø§ ØªØ³ØªØ®Ø¯Ù… Ø§Ù„Ø´Ø±ÙƒØ§Øª Ø¨ÙŠØ¯ÙØ±Ø§Ø¡",
    sectionBody:
      "Ø¨Ø¯Ù„Ù‹Ø§ Ù…Ù† Ø¥Ø¹Ø§Ø¯Ø© Ø¨Ù†Ø§Ø¡ Ø§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© Ù…Ù† Ø§Ù„Ù…Ø¬Ù„Ø¯Ø§Øª ÙˆØ§Ù„Ø¨Ø±ÙŠØ¯ ÙˆØ¬Ø¯Ø§ÙˆÙ„ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§ØªØŒ ØªÙˆÙÙ‘Ø± Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ Ù…Ø³Ø§Ø­Ø© Ù…Ù†Ø¸Ù…Ø© Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØ§Ù„Ø¥Ø«Ø¨Ø§Øª ÙˆØ§Ù„Ù‚Ø±Ø§Ø±Ø§Øª ÙˆØ§Ù„Ù…ØªØ§Ø¨Ø¹Ø©.",
    feature1Title: "Ø§Ø¹Ø±Ù Ø¬Ø§Ù‡Ø²ÙŠØªÙƒ",
    feature1Body:
      "Ø£Ø¨Ù‚Ù Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØ§Ù„ØªØ£Ù‡ÙŠÙ„ ÙˆØ£Ø¯Ù„Ø© Ø§Ù„Ø§Ù…ØªØ«Ø§Ù„ Ù…Ù†Ø¸Ù…Ø© ÙˆÙ…Ø­Ø¯Ù‘Ø«Ø©.",
    feature2Title: "Ù†Ø¸Ù‘Ù… Ø§Ù„Ø¹Ù…Ù„ Ø°Ø§ Ø§Ù„ØµÙ„Ø©",
    feature2Body:
      "Ø§Ù„ØªÙ‚Ø· Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ ÙˆÙ…ÙˆØ§Ø¹ÙŠØ¯ Ø§Ù„ØªÙ‚ÙˆÙŠÙ…ØŒ Ø«Ù… Ù‚ÙŠÙ‘Ù… Ø§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª Ù…Ù‚Ø§Ø¨Ù„ Ù…Ø§ ØªØ³ØªØ·ÙŠØ¹ ØªØ³Ù„ÙŠÙ…Ù‡ ÙØ¹Ù„ÙŠÙ‹Ø§.",
    feature3Title: "Ù†ÙÙ‘Ø° Ø¨Ø«Ù‚Ø©",
    feature3Body:
      "Ø§ØªØ®Ø° Ù‚Ø±Ø§Ø±Ø§Øª Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„ØªÙØ³ÙŠØ±ØŒ ÙˆØ¹ÙŠÙ‘Ù† Ø§Ù„Ø®Ø·ÙˆØ§Øª Ø§Ù„ØªØ§Ù„ÙŠØ©ØŒ ÙˆØ£Ø¨Ù‚Ù Ø§Ù„ÙØ±ÙŠÙ‚ Ù…ØªÙˆØ§ÙÙ‚Ù‹Ø§.",
    capabilitiesTitle: "Ø«Ù…Ø§Ù†ÙŠ Ù‚Ø¯Ø±Ø§Øª Ù„Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© ÙˆØ§Ù„ÙØ±Øµ ÙˆØ§Ù„ØªÙ†ÙÙŠØ°",
    capabilitiesLearnMore: "Ø§Ø¹Ø±Ù Ø§Ù„Ù…Ø²ÙŠØ¯",
    capabilitiesShowLess: "Ø¹Ø±Ø¶ Ø£Ù‚Ù„",
    capabilities: [
      {
        title: "Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ©",
        body: "Ø£Ø¨Ù‚Ù Ù‡ÙˆÙŠØ© Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØ®Ø¯Ù…Ø§ØªÙ‡Ø§ ÙˆÙ…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© Ù…Ù†Ø¸Ù…Ø© ÙÙŠ Ù…Ø³Ø§Ø­Ø© ÙˆØ§Ø­Ø¯Ø©.",
        detail:
          "Ø³Ø¬Ù‘Ù„ Ø§Ù„Ù‚Ø·Ø§Ø¹ ÙˆØ§Ù„Ø®Ø¯Ù…Ø§Øª ÙˆØ§Ù„Ø¬ØºØ±Ø§ÙÙŠØ§ ÙˆØ§Ù„Ø­Ø¬Ù… Ù„ÙŠØªØ´Ø§Ø±Ùƒ Ø§Ù„ÙØ±ÙŠÙ‚ ØµÙˆØ±Ø© Ø­Ø¯ÙŠØ«Ø© Ø¹Ù…Ø§ ØªÙ‚Ø¯Ù‘Ù…Ù‡ Ø§Ù„Ø´Ø±ÙƒØ©. ÙŠØ¯Ø¹Ù… Ù‡Ø°Ø§ Ø§Ù„Ø£Ø³Ø§Ø³ Ø§Ù„ØªØ£Ù‡ÙŠÙ„ ÙˆØ§Ù„Ø£Ø¯Ù„Ø© ÙˆÙ…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„ÙØ±Øµ.",
      },
      {
        title: "Ø§Ù…ØªØ«Ø§Ù„ Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª",
        body: "ØªØªØ¨Ù‘Ø¹ Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ø´Ø±ÙƒØ© Ø§Ù„Ø­Ø±Ø¬Ø© ÙˆØªÙˆØ§Ø±ÙŠØ® Ø§Ù„Ø§Ù†ØªÙ‡Ø§Ø¡ Ù‚Ø¨Ù„ Ø£Ù† ØªØµØ¨Ø­ Ø¹ÙˆØ§Ø¦Ù‚.",
        detail:
          "Ø§Ø­ÙØ¸ Ø§Ù„ØªØ±Ø§Ø®ÙŠØµ ÙˆØ§Ù„Ø´Ù‡Ø§Ø¯Ø§Øª ÙˆØ§Ù„ØªØ£Ù…ÙŠÙ† ÙÙŠ Ù…Ø³Ø§Ø­Ø© Ø¢Ù…Ù†Ø©ØŒ ÙˆØ±Ø§Ù‚Ø¨ Ø§Ù„ØµÙ„Ø§Ø­ÙŠØ©ØŒ ÙˆØ§Ø¹Ø±Ù Ù…Ø§ ÙŠØ­ØªØ§Ø¬ Ø§Ù†ØªØ¨Ø§Ù‡Ù‹Ø§ Ù‚Ø¨Ù„ Ø§Ù†ØªÙ‡Ø§Ø¡ Ø§Ù„Ù…Ø¯Ø©.",
      },
      {
        title: "ØªØ£Ù‡ÙŠÙ„ Ø§Ù„Ù…ÙˆØ±Ù‘Ø¯",
        body: "Ø£Ø¸Ù‡Ø± Ù…Ø§ Ø£Ù†Øª Ù…Ø¤Ù‡Ù‘Ù„ Ù„ØªÙ‚Ø¯ÙŠÙ…Ù‡ â€” ÙˆØ£ÙŠÙ† ØªÙˆØ¬Ø¯ Ø§Ù„ÙØ¬ÙˆØ§Øª.",
        detail:
          "Ø­Ø§ÙØ¸ Ø¹Ù„Ù‰ Ø§Ù„ØªØ£Ù‡ÙŠÙ„Ø§Øª ÙˆØ§Ù„ØªØºØ·ÙŠØ© ÙˆØ§Ù„Ø£Ø¯Ù„Ø© Ø§Ù„Ø¯Ø§Ø¹Ù…Ø© Ù„ØªØ±Ù‰ Ø§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© Ù‚Ø¨Ù„ Ø§Ø³ØªØ«Ù…Ø§Ø± Ø§Ù„ÙˆÙ‚Øª ÙÙŠ Ø·Ù„Ø¨.",
      },
      {
        title: "Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡",
        body: "Ù…Ø±ÙƒØ² Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ù…Ø´ØªØ±ÙŠ Ù„Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª ÙˆØ§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª ÙÙŠ Ù…Ù„Ù ÙˆØ§Ø¶Ø­.",
        detail:
          "Ø§Ù„ØªÙ‚Ø· Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø§Ù„ÙˆØ§Ø±Ø¯Ø©ØŒ ÙˆØ§Ø±Ø¨Ø· Ø§Ù„Ø£Ø¯Ù„Ø© Ø§Ù„Ù…ÙˆØ¬ÙˆØ¯Ø©ØŒ ÙˆØªØªØ¨Ù‘Ø¹ Ø§Ù„Ø¥Ù†Ø¬Ø§Ø²ØŒ ÙˆØ´Ø§Ø±Ùƒ Ø­Ø²Ù…Ø© Ø¢Ù…Ù†Ø© â€” Ù„ØªÙ‚Ù„ÙŠÙ„ ÙÙˆØ¶Ù‰ Ø³Ù„Ø§Ø³Ù„ Ø§Ù„Ø¨Ø±ÙŠØ¯.",
      },
      {
        title: "ØªÙ‚ÙˆÙŠÙ… Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª",
        body: "Ø£Ø¨Ù‚Ù Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠØ© ÙˆØ§Ù„Ù…Ø¹Ø§Ù„Ù… ÙˆØ§Ù„ØªØ°ÙƒÙŠØ±Ø§Øª Ù…Ø±Ø¦ÙŠØ© Ù„Ù„ÙØ±Øµ Ø§Ù„ØªÙŠ ØªØªØ§Ø¨Ø¹Ù‡Ø§.",
        detail:
          "Ù†Ø¸Ù‘Ù… Ø§Ù„ØªÙˆØ§Ø±ÙŠØ® Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ© ÙˆØ¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ø§Ù„ØªØ°ÙƒÙŠØ± Ù„ØªÙ‚Ù„ÙŠÙ„ Ø§Ø­ØªÙ…Ø§Ù„ ØªÙÙˆÙŠØª Ø§Ù„ØªØ³Ù„ÙŠÙ…Ø§Øª Ø§Ù„Ù…Ù‡Ù…Ø©ØŒ Ù…Ø¹ Ø®Ø· Ø²Ù…Ù†ÙŠ Ù…Ø´ØªØ±Ùƒ Ù„Ù„ÙØ±ÙŠÙ‚.",
      },
      {
        title: "Ù…Ø³Ø§Ø¹Ø¯ Ø§Ù„Ø§Ø³ØªØ¨ÙŠØ§Ù†Ø§Øª",
        body: "Ù‡ÙŠÙƒÙ„ Ø§Ù„Ø£Ø³Ø¦Ù„Ø© ÙˆØ§ØµÙ†Ø¹ Ù…Ø³ÙˆØ¯Ø§Øª Ø¥Ø¬Ø§Ø¨Ø§Øª Ù…Ø¯Ø¹ÙˆÙ…Ø© Ø¨Ø§Ù„Ø£Ø¯Ù„Ø© Ù…Ø¹ Ø®Ø·ÙˆØ§Øª ØªØ­Ù‚Ù‚ ÙˆØ§Ø¶Ø­Ø©.",
        detail:
          "Ø§ÙƒØªØ´Ù Ù…Ø­ØªÙˆÙ‰ Ø§Ù„Ø§Ø³ØªØ¨ÙŠØ§Ù† ÙˆÙ†Ø¸Ù‘Ù…Ù‡ØŒ ÙˆØµØº Ø¥Ø¬Ø§Ø¨Ø§Øª Ù…Ø¨Ù†ÙŠØ© Ø¹Ù„Ù‰ Ø§Ù„Ø£Ø¯Ù„Ø© Ø§Ù„Ù…ØªØ§Ø­Ø©ØŒ ÙˆÙ…ÙŠÙ‘Ø² Ù…Ø§ ÙŠØ²Ø§Ù„ ÙŠØ­ØªØ§Ø¬ ØªØ­Ù‚Ù‚Ù‹Ø§ Ø¨Ø´Ø±ÙŠÙ‹Ø§.",
      },
      {
        title: "Ù…Ø­Ø±Ùƒ Ø§Ù„Ù‚Ø±Ø§Ø±",
        body: "ØµÙ„ Ø¥Ù„Ù‰ BID Ø£Ùˆ REVIEW Ø£Ùˆ NO-BID Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„ØªÙØ³ÙŠØ± Ù…Ù† Ø§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© ÙˆØ§Ù„ØªØ£Ù‡ÙŠÙ„ ÙˆØ§Ù„Ø£Ø¯Ù„Ø©.",
        detail:
          "Ø§Ø¯Ù…Ø¬ Ø¥Ø´Ø§Ø±Ø§Øª Ø¬Ø§Ù‡Ø²ÙŠØ© Ø§Ù„Ø´Ø±ÙƒØ© Ù…Ø¹ Ø³ÙŠØ§Ù‚ Ø§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª ÙˆØ§Ù„Ø£Ø¯Ù„Ø© Ù„Ø¥Ù†ØªØ§Ø¬ Ù‚Ø±Ø§Ø± ÙŠÙ…ÙƒÙ† Ø´Ø±Ø­Ù‡. ØªØ¯Ø¹Ù… Ø°Ø§ÙƒØ±Ø© Ø§Ù„Ù‚Ø±Ø§Ø± ÙˆØ§Ù„Ù…Ø­Ø§ÙƒÙŠ Ø§Ù„Ø­ÙƒÙ… â€” ÙˆÙ„Ø§ ØªØ­Ù„ Ù…Ø­Ù„ Ù…Ø³Ø¤ÙˆÙ„ÙŠØ© Ø§Ù„ÙØ±ÙŠÙ‚.",
      },
      {
        title: "Ø³ÙŠØ± Ø¹Ù…Ù„ Ù‚Ø±Ø§Ø± Ø§Ù„ÙØ±ÙŠÙ‚",
        body: "Ø­ÙˆÙ‘Ù„ Ø§Ù„Ù‚Ø±Ø§Ø± Ø¥Ù„Ù‰ Ø®Ø·ÙˆØ§Øª Ù…Ø¹ÙŠÙ‘Ù†Ø© ÙˆØªØ­Ù‚Ù‚ ÙˆØªÙ†Ø¨ÙŠÙ‡Ø§Øª ÙŠÙ…ÙƒÙ† ØªÙ†ÙÙŠØ°Ù‡Ø§.",
        detail:
          "Ø£Ù†Ø´Ø¦ Ù…Ù‡Ø§Ù… Ø³ÙŠØ± Ø§Ù„Ø¹Ù…Ù„ØŒ ÙˆØ£Ø±ÙÙ‚ Ø§Ù„Ø£Ø¯Ù„Ø©ØŒ ÙˆØ£ØºÙ„Ù‚ Ø­Ù„Ù‚Ø© Ø§Ù„ØªØ­Ù‚Ù‚ØŒ ÙˆØ§Ø³ØªØ®Ø¯Ù… Ø§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø§Ù„Ø°ÙƒÙŠØ© ÙˆØ®Ø·Ø© Ø§Ù„Ø¹Ù…Ù„ Ø¹Ù†Ø¯ ØªÙˆÙØ±Ù‡Ø§ ÙÙŠ Ø§Ù„Ø®Ø·Ø©.",
      },
    ],
    smartMatch: {
      eyebrow: "Smart Match Engine",
      title: "Ø§Ø¹Ø±Ù Ø£ÙŠ Ø§Ù„ÙØ±Øµ ØªÙ†Ø§Ø³Ø¨ Ù…Ù„Ù Ø´Ø±ÙƒØªÙƒ",
      body: "ÙŠÙ‚Ø§Ø±Ù† Smart Match Engine Ø¥Ø´Ø§Ø±Ø§Øª Ø§Ù„ÙØ±ØµØ© Ù…Ø¹ Ù…Ù„Ù Ø´Ø±ÙƒØªÙƒ Ù„Ù…Ø³Ø§Ø¹Ø¯Ø© Ø§Ù„ÙØ±Ù‚ Ø¹Ù„Ù‰ ØªØ±ØªÙŠØ¨ Ø£ÙˆÙ„ÙˆÙŠØ© Ø§Ù„Ù…Ø±Ø§Ø¬Ø¹Ø© â€” Ø¨Ø¯Ù„ Ù…Ø¹Ø§Ù…Ù„Ø© ÙƒÙ„ ÙØ±ØµØ© Ø¨Ù†ÙØ³ Ø§Ù„Ø·Ø±ÙŠÙ‚Ø©.",
      benefit1: "Ø£Ø¨Ø±Ø² Ø§Ù„ÙØ±Øµ Ø§Ù„Ù…ØªÙˆØ§ÙÙ‚Ø© Ù…Ø¹ Ø§Ù„Ø®Ø¯Ù…Ø§Øª ÙˆØ§Ù„Ù‚Ø·Ø§Ø¹ ÙˆØ§Ù„Ø¬ØºØ±Ø§ÙÙŠØ§.",
      benefit2: "Ø§Ø³ØªØ®Ø¯Ù… Ø§Ù„ØªØ£Ù‡ÙŠÙ„ ÙˆØ§Ù„Ø®Ø¨Ø±Ø© ÙˆØ­Ø¬Ù… Ø§Ù„Ø´Ø±ÙƒØ© ÙƒØ£Ø¨Ø¹Ø§Ø¯ Ù…Ø·Ø§Ø¨Ù‚Ø© Ù…Ù†Ø¸Ù…Ø©.",
      benefit3: "Ø±Ø§Ø¬Ø¹ ØªÙØ³ÙŠØ±Ø§Øª Ø§Ù„Ù…Ø·Ø§Ø¨Ù‚Ø© Ù‚Ø¨Ù„ ØªØ®ØµÙŠØµ ÙˆÙ‚Øª Ø§Ù„ÙØ±ÙŠÙ‚.",
      dimensionsLabel: "Ø£Ø¨Ø¹Ø§Ø¯ Ø§Ù„Ù…Ø·Ø§Ø¨Ù‚Ø©",
      dimensions: ["Ø§Ù„Ø®Ø¯Ù…Ø§Øª", "Ø§Ù„Ù‚Ø·Ø§Ø¹", "Ø§Ù„Ø¬ØºØ±Ø§ÙÙŠØ§", "Ø§Ù„ØªØ£Ù‡ÙŠÙ„", "Ø§Ù„Ø®Ø¨Ø±Ø©", "Ø­Ø¬Ù… Ø§Ù„Ø´Ø±ÙƒØ©"],
      note: "Ø¯Ø±Ø¬Ø§Øª Ø§Ù„Ù…Ø·Ø§Ø¨Ù‚Ø© ØªÙˆØ¬Ù‘Ù‡ Ø§Ù„Ø§Ø³ØªÙƒØ´Ø§Ù ÙˆØ§Ù„Ù…Ø±Ø§Ø¬Ø¹Ø©. Ù„Ø§ ØªØ¶Ù…Ù† Ø§Ù„Ø£Ù‡Ù„ÙŠØ© Ø£Ùˆ ØªØºØ·ÙŠØ© ÙƒÙ„ Ø§Ù„Ø£Ø³ÙˆØ§Ù‚ Ø£Ùˆ ØªØ±Ø³ÙŠØ© Ø§Ù„Ø¹Ù‚ÙˆØ¯. ÙŠØ¹ØªÙ…Ø¯ Ø§Ù„ÙˆØµÙˆÙ„ Ø¹Ù„Ù‰ Ø¥Ø¹Ø¯Ø§Ø¯ Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„.",
      ctaPrimary: "Ø£Ù†Ø´Ø¦ Ù…Ù„Ù Ø´Ø±ÙƒØªÙƒ",
      ctaSecondary: "ØªØ¹Ø±Ù‘Ù ÙƒÙŠÙ ØªØ¹Ù…Ù„ Ø¨ÙŠØ¯ÙØ±Ø§Ø¡",
    },
    bottomTitle: "Ø§Ø¬Ù…Ø¹ Ø§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© ÙˆØ§Ù„ÙØ±Øµ ÙˆØ§Ù„Ù‚Ø±Ø§Ø±Ø§Øª ÙÙŠ Ù…Ø³Ø§Ø­Ø© ÙˆØ§Ø­Ø¯Ø©",
    bottomBody:
      "Ù†Ø¸Ù‘Ù… Ù…Ø§ ØªÙ…Ù„ÙƒÙ‡ Ø§Ù„Ø´Ø±ÙƒØ©ØŒ ÙˆØªØ­Ù‚Ù‚ Ù…Ù…Ø§ ÙŠÙ…ÙƒÙ† Ø¥Ø«Ø¨Ø§ØªÙ‡ØŒ ÙˆÙ‚ÙŠÙ‘Ù… Ù…Ø§ Ù‡Ùˆ Ø°Ùˆ ØµÙ„Ø©ØŒ ÙˆÙ‚Ø±Ø± Ù…Ø§ ÙŠØ³ØªØ­Ù‚ Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø© â€” Ù…Ø¹ Ø§Ù„ÙØ±ÙŠÙ‚.",
    bottomCta: "Ø§Ø³ØªÙƒØ´Ù Ø¨ÙŠØ¯ÙØ±Ø§Ø¡",
    howTitle: "ÙƒÙŠÙ ÙŠØ¹Ù…Ù„",
    howBody: "Ù…Ù† Ø¬Ø§Ù‡Ø²ÙŠØ© Ø§Ù„Ø´Ø±ÙƒØ© Ø¥Ù„Ù‰ ØªÙ†ÙÙŠØ° ÙˆØ§Ø«Ù‚.",
    step1Title: "Ø§ÙÙ‡Ù…",
    step1Body: "Ø§Ø¨Ù†Ù ØµÙˆØ±Ø© ÙˆØ§Ø¶Ø­Ø© Ù„Ø´Ø±ÙƒØªÙƒ ÙˆÙ…Ø³ØªÙ†Ø¯Ø§ØªÙ‡Ø§ ÙˆØªØ£Ù‡ÙŠÙ„Ù‡Ø§ ÙˆØ¬Ø§Ù‡Ø²ÙŠØªÙ‡Ø§.",
    step2Title: "Ù†Ø¸Ù‘Ù…",
    step2Body:
      "Ø§Ø³ØªØ®Ø¯Ù… Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ Ù„Ø§Ù„ØªÙ‚Ø§Ø· Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„ÙˆØ§Ø±Ø¯ØŒ ÙˆØ£Ø¨Ù‚Ù Ø§Ù„ØªÙˆØ§Ø±ÙŠØ® Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ© ÙÙŠ ØªÙ‚ÙˆÙŠÙ… Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª.",
    step3Title: "ØªØ­Ù‚Ù‚",
    step3Body: "Ù‚Ø§Ø¨Ù„ Ø§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª Ø¨Ø§Ù„Ù…Ù„Ù ÙˆØ§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª ÙˆØ§Ù„ØªØ£Ù‡ÙŠÙ„ ÙˆØ§Ù„Ø£Ø¯Ù„Ø©.",
    step4Title: "Ù‚Ø±Ø± ÙˆÙ†ÙÙ‘Ø°",
    step4Body:
      "ØµÙ„ Ø¥Ù„Ù‰ Ù‚Ø±Ø§Ø± Ù‚Ø§Ø¨Ù„ Ù„Ù„ØªÙØ³ÙŠØ± Ø«Ù… Ø§Ø¯ÙØ¹Ù‡ Ø¹Ø¨Ø± Ø³ÙŠØ± Ø¹Ù…Ù„ Ø§Ù„ÙØ±ÙŠÙ‚ ÙˆØ§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª ÙˆØ®Ø·Ø© Ø¹Ù…Ù„ ÙˆØ§Ø¶Ø­Ø©.",
    beforeAfterTitle: "Ù…Ù† Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ù…Ø´ØªØªØ© Ø¥Ù„Ù‰ ØªÙ†ÙÙŠØ° ÙˆØ§Ø«Ù‚",
    beforeAfterBody:
      "ØªÙˆÙ‚Ù Ø¹Ù† ØªØ¬Ù…ÙŠØ¹ Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª ÙˆØ§Ù„ØªØ£Ù‡ÙŠÙ„ ÙˆØ§Ù„ÙØ±Øµ Ù…Ù† Ø£Ù…Ø§ÙƒÙ† Ù…Ø®ØªÙ„ÙØ©. ØªØ¬Ù…Ø¹ Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ Ø§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© ÙˆØ§Ù„Ø£Ø¯Ù„Ø© ÙˆØ§Ù„Ù‚Ø±Ø§Ø±Ø§Øª.",
    beforeLabel: "Ø¨Ø¯ÙˆÙ† Ø³ÙŠØ± Ø¹Ù…Ù„ Ù…Ù†Ø¸Ù… ÙÙŠ Ø¨ÙŠØ¯ÙØ±Ø§Ø¡",
    afterLabel: "Ù…Ø¹ Ø¨ÙŠØ¯ÙØ±Ø§Ø¡",
    beforeItems: [
      "Ù…Ø³ØªÙ†Ø¯Ø§Øª ÙˆØªØ£Ù‡ÙŠÙ„ ÙˆØ£Ø¯Ù„Ø© Ù…Ø´ØªØªØ© Ø¹Ø¨Ø± Ø§Ù„Ù…Ø¬Ù„Ø¯Ø§Øª ÙˆØµÙ†Ø§Ø¯ÙŠÙ‚ Ø§Ù„ÙˆØ§Ø±Ø¯",
      "ØºÙŠØ± ÙˆØ§Ø¶Ø­ Ø£ÙŠ Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø£Ù†Øª Ø¬Ø§Ù‡Ø² Ù„Ù‡Ø§ ÙØ¹Ù„ÙŠÙ‹Ø§",
      "Ù…Ø±Ø§Ø¬Ø¹Ø© ÙŠØ¯ÙˆÙŠØ© Ø¨Ù„Ø§ Ù…Ø³Ø§Ø± Ø£Ø¯Ù„Ø© Ù…Ø´ØªØ±Ùƒ",
      "Ù‚Ø±Ø§Ø±Ø§Øª Ø¨Ù„Ø§ Ù…Ù„ÙƒÙŠØ© ÙˆØ§Ø¶Ø­Ø© Ù„Ù„Ø®Ø·ÙˆØ§Øª Ø§Ù„ØªØ§Ù„ÙŠØ©",
    ],
    afterItems: [
      "Ù…Ø³Ø§Ø­Ø© ÙˆØ§Ø­Ø¯Ø© Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØ§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© ÙˆØ§Ù„Ø£Ø¯Ù„Ø© Ø§Ù„Ù…ØªØ­Ù‚Ù‚Ø©",
      "Ø¹Ù…Ù„ ÙˆØ§Ø±Ø¯ Ù…Ù†Ø¸Ù… Ù…Ù‚Ø§Ø¨Ù„ Ø§Ù„Ù‚Ø¯Ø±Ø© Ø§Ù„Ø­Ù‚ÙŠÙ‚ÙŠØ©",
      "BID / REVIEW / NO-BID Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„ØªÙØ³ÙŠØ± Ù…Ø¹ Ø§Ù„Ù…Ø¨Ø±Ø±",
      "Ø®Ø·ÙˆØ§Øª ØªØ§Ù„ÙŠØ© Ù…Ø¹ÙŠÙ‘Ù†Ø© ÙˆØªÙ†Ø¨ÙŠÙ‡Ø§Øª ÙˆØ®Ø·Ø© ÙŠÙ…ÙƒÙ† Ù„Ù„ÙØ±ÙŠÙ‚ ØªÙ†ÙÙŠØ°Ù‡Ø§",
    ],
    complianceEyebrow: "Ø§Ù…ØªØ«Ø§Ù„ Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª",
    complianceHeadline: "Ø£Ø¨Ù‚Ù Ø´Ø±ÙƒØªÙƒ Ø¬Ø§Ù‡Ø²Ø© ÙÙŠ ÙƒÙ„ Ø­ÙŠÙ†.",
    complianceBody:
      "Ù†Ø¸Ù‘Ù… Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ø´Ø±ÙƒØ© Ø§Ù„Ø­Ø±Ø¬Ø©ØŒ ÙˆØªØªØ¨Ø¹ ØªÙˆØ§Ø±ÙŠØ® Ø§Ù„Ø§Ù†ØªÙ‡Ø§Ø¡ØŒ ÙˆØªØ§Ø¨Ø¹ Ù…ØªØ·Ù„Ø¨Ø§Øª Ø§Ù„Ø§Ù…ØªØ«Ø§Ù„ Ù…Ù† Ù…Ø³Ø§Ø­Ø© Ø¢Ù…Ù†Ø© ÙˆØ§Ø­Ø¯Ø©.",
    complianceBenefit1Title: "Ø§Ø¨Ù‚ÙŽ Ù…Ù†Ø¸Ù…Ù‹Ø§",
    complianceBenefit1Body: "ÙƒÙ„ Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ø´Ø±ÙƒØ© ÙÙŠ Ù…Ø³Ø§Ø­Ø© Ø¢Ù…Ù†Ø© ÙˆØ§Ø­Ø¯Ø©.",
    complianceBenefit2Title: "ØªØªØ¨Ù‘Ø¹ Ø§Ù„Ø§Ù†ØªÙ‡Ø§Ø¡",
    complianceBenefit2Body: "Ø§Ø¹Ø±Ù Ù…Ø§ Ù‡Ùˆ Ø³Ø§Ø±ÙŠ ÙˆÙ…Ø§ ÙŠØ­ØªØ§Ø¬ Ø§Ù†ØªØ¨Ø§Ù‡Ù‹Ø§ Ù‚Ø¨Ù„ Ø§Ù†ØªÙ‡Ø§Ø¡ Ø§Ù„Ù…Ø¯Ø©.",
    complianceBenefit3Title: "Ø¬Ø§Ù‡Ø² Ù„Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª",
    complianceBenefit3Body: "Ø§Ø¹Ø±Ù Ø£ÙŠ Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª ØªØ¯Ø¹Ù… Ø§Ù„Ù…Ø·Ù„Ø¨ Ø§Ù„ØªØ§Ù„ÙŠ.",
    compliancePanelTitle: "Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ø´Ø±ÙƒØ©",
    complianceAddLabel: "Ø¥Ø¶Ø§ÙØ© Ù…Ø³ØªÙ†Ø¯",
    complianceAlertTitle: "Ø§Ù„ØªØ£Ù…ÙŠÙ† ÙŠÙ†ØªÙ‡ÙŠ Ù‚Ø±ÙŠØ¨Ù‹Ø§",
    complianceReadyLabel: "Ø£Ù†Øª Ø¬Ø§Ù‡Ø²",
    complianceReadyHint: "Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ© Ù…ØªØªØ¨Ù‘ÙŽØ¹Ø© ÙÙŠ Ù…Ø³Ø§Ø­Ø© ÙˆØ§Ø­Ø¯Ø©.",
    complianceStatusValid: "Ø³Ø§Ø±ÙŠ",
    complianceStatusExpiring: "ÙŠÙ†ØªÙ‡ÙŠ Ù‚Ø±ÙŠØ¨Ù‹Ø§",
    complianceDocTrade: "Ø±Ø®ØµØ© ØªØ¬Ø§Ø±ÙŠØ©",
    complianceDocTax: "Ø´Ù‡Ø§Ø¯Ø© Ø¶Ø±ÙŠØ¨ÙŠØ©",
    complianceDocInsurance: "ØªØ£Ù…ÙŠÙ†",
    complianceDocQuality: "Ø´Ù‡Ø§Ø¯Ø© Ø¬ÙˆØ¯Ø©",
    complianceDocFinancial: "Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ø§Ù„ÙŠØ©",
    complianceDateTrade: "Ø³Ø§Ø±ÙŠ Ø­ØªÙ‰ Ù£Ù¡ Ø¯ÙŠØ³Ù…Ø¨Ø± Ù¢Ù Ù¢Ù¦",
    complianceDateTax: "Ø³Ø§Ø±ÙŠ Ø­ØªÙ‰ Ù¡Ù¥ Ø£ÙƒØªÙˆØ¨Ø± Ù¢Ù Ù¢Ù¦",
    complianceDateInsurance: "ÙŠÙ†ØªÙ‡ÙŠ Ù¢Ù¨ Ù†ÙˆÙÙ…Ø¨Ø± Ù¢Ù Ù¢Ù¦",
    complianceDateQuality: "Ø³Ø§Ø±ÙŠ Ø­ØªÙ‰ Ù¡ Ø£ØºØ³Ø·Ø³ Ù¢Ù Ù¢Ù§",
    complianceDateFinancial: "Ø³Ø§Ø±ÙŠ Ø­ØªÙ‰ Ù¡Ù  ÙØ¨Ø±Ø§ÙŠØ± Ù¢Ù Ù¢Ù§",
    pricingTeaserTitle: "Ø£Ø³Ø¹Ø§Ø± Ø¨Ø³ÙŠØ·Ø© Ù„Ù„ÙØ±Ù‚ Ø§Ù„Ù†Ø§Ù…ÙŠØ©",
    pricingTeaserBody:
      "Ø§Ø¨Ø¯Ø£ Ù…Ø¬Ø§Ù†Ù‹Ø§. Ø±Ù‚Ù‘Ù Ø§Ù„Ø®Ø·Ø© Ø¹Ù†Ø¯Ù…Ø§ ØªÙˆÙÙ‘Ø± Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ ÙˆÙ‚ØªÙ‹Ø§ Ø­Ù‚ÙŠÙ‚ÙŠÙ‹Ø§ â€” Ù…Ù† {price}/Ø´Ù‡Ø± Ø¹Ù„Ù‰ Pro.",
    pricingTeaserCta: "Ù‚Ø§Ø±Ù† Ø§Ù„Ø®Ø·Ø·",
    viewAllFaq: "Ø¹Ø±Ø¶ ÙƒÙ„ Ø§Ù„Ø£Ø³Ø¦Ù„Ø© â†",
    testimonialsTitle: "Ù…Ø§Ø°Ø§ ØªÙ‚ÙˆÙ„ Ø§Ù„ÙØ±Ù‚",
    testimonialsBody:
      "Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ø­Ù‚ÙŠÙ‚ÙŠØ© Ù…Ù† ÙØ±Ù‚ ØªØ³ØªØ®Ø¯Ù… Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ Ù„Ù„Ø¨Ù‚Ø§Ø¡ Ø¬Ø§Ù‡Ø²Ø© ÙˆØ§ØªØ®Ø§Ø° Ù‚Ø±Ø§Ø±Ø§Øª Ø¨Ø«Ù‚Ø©.",
    testimonialsEmptyTitle: "Ù…Ù„Ø§Ø­Ø¸Ø§Øª Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ Ø§Ù„Ø£ÙˆØ§Ø¦Ù„",
    testimonialsEmptyBody:
      "Ù†Ù†Ø´Ø± ÙÙ‚Ø· Ø´Ù‡Ø§Ø¯Ø§Øª Ø¹Ù…Ù„Ø§Ø¡ Ø­Ù‚ÙŠÙ‚ÙŠØ©. ÙƒÙ† Ù…Ù† Ø£ÙˆØ§Ø¦Ù„ Ø§Ù„ÙØ±Ù‚ Ø§Ù„ØªÙŠ ØªØ¬Ù…Ø¹ Ø§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© ÙˆØ§Ù„Ø£Ø¯Ù„Ø© ÙˆØ§Ù„Ù‚Ø±Ø§Ø±Ø§Øª â€” Ø«Ù… Ø£Ø®Ø¨Ø±Ù†Ø§ Ø¨Ø§Ù„Ù†ØªÙŠØ¬Ø©.",
    testimonialsEmptyCta: "Ø§Ø³ØªÙƒØ´Ù Ø¨ÙŠØ¯ÙØ±Ø§Ø¡",
  },
  product: {
    eyebrow: "Ø§Ù„Ù…Ù†ØªØ¬",
    title: "Ø°ÙƒØ§Ø¡ Ø§Ù„Ø´Ø±ÙƒØ©. Ø§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ©. Ù‚Ø±Ø§Ø±Ø§Øª Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„ØªÙØ³ÙŠØ±.",
    body: "Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ Ù„ÙŠØ³Øª Ù…Ù„Ø®Ù‘Øµ PDF Ø¹Ø§Ù… Ø¨Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ. Ù‡ÙŠ Ù…Ø³Ø§Ø­Ø© Ø¹Ù…Ù„ Ù„Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© ÙˆØ§Ù„Ø§Ù…ØªØ«Ø§Ù„ ÙˆØ§Ù„ØªØ£Ù‡ÙŠÙ„ ÙˆØ§Ù„Ø£Ø¯Ù„Ø© ÙˆØ°ÙƒØ§Ø¡ Ø§Ù„ÙØ±Øµ ÙˆØ§Ù„Ù‚Ø±Ø§Ø±Ø§Øª Ø§Ù„Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„ØªÙØ³ÙŠØ±. Ù…ØªÙˆØ§ÙÙ‚ / ÙŠØ­ØªØ§Ø¬ ØªØ­Ù‚Ù‚ / ØºÙŠØ± Ù…ØªÙˆØ§ÙÙ‚ Ù†ØªÙŠØ¬Ø© Ù„Ù…Ø­Ø±Ùƒ Ø§Ù„Ù‚Ø±Ø§Ø± â€” ÙˆÙ„ÙŠØ³Øª Ø§Ù„Ù…Ù†ØªØ¬ Ø¨Ø£ÙƒÙ…Ù„Ù‡.",
    step1Title: "Ø§ÙÙ‡Ù… Ø§Ù„Ø´Ø±ÙƒØ©",
    step1Body:
      "Ø§Ø¨Ù†Ù ØµÙˆØ±Ø© Ø­ÙŠØ© Ù„Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØ§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª ÙˆØ§Ù„ØªØ£Ù‡ÙŠÙ„ ÙˆØ§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ©.",
    step2Title: "Ø§ÙƒØªØ´Ù Ù…Ø§ Ù‡Ùˆ Ù…Ù„Ø§Ø¦Ù…",
    step2Body:
      "Ø£Ø¸Ù‡Ø± Ø§Ù„ÙØ±Øµ ÙˆØ·Ù„Ø¨Ø§Øª Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ Ø§Ù„Ù…ØªÙˆØ§ÙÙ‚Ø© Ù…Ø¹ Ù…Ø§ ØªØ³ØªØ·ÙŠØ¹ Ø´Ø±ÙƒØªÙƒ ØªØ³Ù„ÙŠÙ…Ù‡ ÙØ¹Ù„ÙŠÙ‹Ø§.",
    step3Title: "ØªØ­Ù‚Ù‚ØŒ Ù‚Ø±Ù‘Ø± ÙˆÙ†ÙÙ‘Ø°",
    step3Body:
      "Ø­Ù„Ù‘Ù„ Ø§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª Ø§Ù„Ù…Ù‡Ù…Ø©ØŒ Ø§Ø±Ø¨Ø· Ø§Ù„Ø£Ø¯Ù„Ø©ØŒ ÙˆØ§ØªØ®Ø° Ù‚Ø±Ø§Ø±Ø§Øª Ù…ØªÙˆØ§ÙÙ‚ / ÙŠØ­ØªØ§Ø¬ ØªØ­Ù‚Ù‚ / ØºÙŠØ± Ù…ØªÙˆØ§ÙÙ‚ Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„ØªÙØ³ÙŠØ±ØŒ Ø«Ù… Ø­ÙˆÙ‘Ù„Ù‡Ø§ Ø¥Ù„Ù‰ Ø®Ø·ÙˆØ§Øª ØªØ§Ù„ÙŠØ© Ù…Ø¹ Ø§Ù„ÙØ±ÙŠÙ‚.",
    seeTitle: "Ù…Ø§ ÙŠØ¹Ù…Ù„ Ø¹Ù„ÙŠÙ‡ ÙØ±ÙŠÙ‚Ùƒ",
    seeItems: [
      "Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØ§Ù…ØªØ«Ø§Ù„ Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª ÙˆØªØ£Ù‡ÙŠÙ„ Ø§Ù„Ù…ÙˆØ±Ø¯",
      "Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ ÙˆÙ…ÙˆØ§Ø¹ÙŠØ¯ Ø§Ù„ØªÙ‚ÙˆÙŠÙ…",
      "Ø°ÙƒØ§Ø¡ Ø§Ù„Ø£Ø¯Ù„Ø© Ù…Ø¹ ØªØ­Ù‚Ù‚ Ù…Ø¯Ø¹ÙˆÙ… Ø¨Ø§Ù„Ù…ØµØ§Ø¯Ø±",
      "Ù†ØªØ§Ø¦Ø¬ Ù…Ø­Ø±Ùƒ Ø§Ù„Ù‚Ø±Ø§Ø±: Ù…ØªÙˆØ§ÙÙ‚ / ÙŠØ­ØªØ§Ø¬ ØªØ­Ù‚Ù‚ / ØºÙŠØ± Ù…ØªÙˆØ§ÙÙ‚",
      "ØªØ¨Ø±ÙŠØ± Ù‚Ø§Ø¨Ù„ Ù„Ù„ØªÙØ³ÙŠØ± ÙˆØ°Ø§ÙƒØ±Ø© Ø§Ù„Ù‚Ø±Ø§Ø± ÙˆØ§Ù„Ù…Ø­Ø§ÙƒÙŠ",
      "ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª ÙƒØ®Ø·ÙˆØ© Ø¶Ù…Ù† Ø³ÙŠØ± Ø§Ù„Ø¹Ù…Ù„",
      "Ù…Ø³Ø§Ø¹Ø¯ Ø§Ù„Ø§Ø³ØªØ¨ÙŠØ§Ù†Ø§Øª ÙˆØªØµØ¯ÙŠØ± PDF",
      "Ø³ÙŠØ± Ù‚Ø±Ø§Ø± Ø§Ù„ÙØ±ÙŠÙ‚ ÙˆØ®Ø·Ø· Ø§Ù„Ø¹Ù…Ù„ ÙˆØ§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø§Ù„Ø°ÙƒÙŠØ©",
    ],
    cta: "Ø§Ø³ØªÙƒØ´Ù Ø¨ÙŠØ¯ÙØ±Ø§Ø¡",
    futureTitle: "Ù‚Ø¯Ø±Ø§Øª Ù†Ø´Ø·Ø© ÙÙŠ Ù…Ø³Ø§Ø­Ø© ÙˆØ§Ø­Ø¯Ø©",
    futureBody:
      "ØªØºØ·ÙŠ Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ Ø¨Ø§Ù„ÙØ¹Ù„ Ø£Ø³Ø§Ø³ Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØ°ÙƒØ§Ø¡ Ø§Ù„ÙØ±Øµ ÙˆØ§Ù„Ø£Ø¯Ù„Ø© ÙˆØ§Ù„Ù‚Ø±Ø§Ø±Ø§Øª ÙˆØ¹Ù…Ù„ Ø§Ù„ÙØ±ÙŠÙ‚.",
    highlightItems: [
      "Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ©",
      "Ø§Ù…ØªØ«Ø§Ù„ Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª",
      "Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡",
      "Ø°ÙƒØ§Ø¡ Ø§Ù„Ø£Ø¯Ù„Ø©",
      "Ù…Ø­Ø±Ùƒ Ø§Ù„Ù‚Ø±Ø§Ø±",
      "ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª",
      "Ø³ÙŠØ± Ù‚Ø±Ø§Ø± Ø§Ù„ÙØ±ÙŠÙ‚",
      "Ø«Ù‚Ø© ÙˆØ£Ù…Ø§Ù† Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ",
    ],
  },
  pricing: {
    eyebrow: "Ø§Ù„Ø£Ø³Ø¹Ø§Ø±",
    title: "Ù…Ø³Ø§Ø­Ø© ÙˆØ§Ø­Ø¯Ø© Ù„Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© ÙˆØ§Ù„ÙØ±Øµ ÙˆØ§Ù„Ø¹Ù…Ù„",
    body: "Ø§Ø¨Ø¯Ø£ Ø¨Ù…Ø³Ø§Ø­Ø© Ø¹Ù…Ù„ Ù…Ø¬Ø§Ù†ÙŠØ© Ù…Ø­Ø¯ÙˆØ¯Ø©ØŒ Ø£Ùˆ Ø¬Ø±Ù‘Ø¨ Ø®Ø·Ø© Ù…Ø¯ÙÙˆØ¹Ø© Ù„Ù€ 14 ÙŠÙˆÙ…Ù‹Ø§. Ø§Ù„Ø£Ø³Ø¹Ø§Ø± Ù…Ù† Ø®Ø·Ø· Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ Ø§Ù„Ø­Ø§Ù„ÙŠØ©.",
    perMonth: "/Ø´Ù‡Ø±",
    perMonthYearly: "/Ø´Ù‡Ø± ØªÙÙÙˆØªØ± Ø³Ù†ÙˆÙŠÙ‹Ø§",
    analysesSeats: "{analyses} ØªØ­Ù„ÙŠÙ„Ø§Øª / Ø´Ù‡Ø± Â· {seats} Ù…Ù‚Ø§Ø¹Ø¯",
    seatsOnly: "{seats} Ù…Ù‚Ø§Ø¹Ø¯",
    startFree: "Ø§Ø¨Ø¯Ø£ Ù…Ø¬Ø§Ù†Ù‹Ø§",
    startFreeWorkspace: "Ø§Ø¨Ø¯Ø£ Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ù…Ø¬Ø§Ù†ÙŠØ©",
    startTrial: "Ø§Ø¨Ø¯Ø£ ØªØ¬Ø±Ø¨Ø© 14 ÙŠÙˆÙ…Ù‹Ø§",
    startSubscription: "Ø¨Ø¯Ø¡ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ",
    choose: "Ø§Ø®ØªØ± {plan}",
    monthly: "Ø´Ù‡Ø±ÙŠ",
    yearly: "Ø³Ù†ÙˆÙŠ",
    save: "ÙˆÙÙ‘Ø± Ø­ÙˆØ§Ù„ÙŠ 17%",
    recommended: "Ø§Ù„Ø£ÙƒØ«Ø± Ø§Ø®ØªÙŠØ§Ø±Ù‹Ø§",
    mostPopular: "Ø§Ù„Ø£Ù†Ø³Ø¨ Ù„Ù„ÙØ±Ù‚ Ø§Ù„Ù†Ø§Ù…ÙŠØ©",
    trialBadge: "ØªØ¬Ø±Ø¨Ø© Ù…Ø¬Ø§Ù†ÙŠØ© 14 ÙŠÙˆÙ…Ù‹Ø§",
    noChargeToday: "Ù„Ø§ Ø±Ø³ÙˆÙ… Ø§Ù„ÙŠÙˆÙ…",
    paymentMethodRequired: "ÙŠÙ„Ø²Ù… Ø£Ø³Ù„ÙˆØ¨ Ø¯ÙØ¹",
    cancelBeforeTrial: "Ø£Ù„ØºÙ Ù‚Ø¨Ù„ Ø§Ù†ØªÙ‡Ø§Ø¡ Ø§Ù„ØªØ¬Ø±Ø¨Ø© Ù„ØªØ¬Ù†Ø¨ Ø±Ø³ÙˆÙ… Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ.",
    freeHeadline: "Ø§Ø¨Ø¯Ø£ Ù…Ø¬Ø§Ù†Ù‹Ø§. Ø§Ø¨Ù†Ù Ù…Ø³Ø§Ø­Ø© Ø¹Ù…Ù„ Ø´Ø±ÙƒØªÙƒ.",
    freeLimitedNote: "Ù…Ø³Ø§Ø­Ø© Ù…Ø­Ø¯ÙˆØ¯Ø© â€” Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØ§Ù„Ø§Ù…ØªØ«Ø§Ù„ Ø§Ù„Ù…Ø³ØªÙ†Ø¯ÙŠ ÙÙ‚Ø·.",
    comparisonTitle: "Ù…Ù‚Ø§Ø±Ù†Ø© Ø§Ù„Ø®Ø·Ø·",
    comparisonFeature: "Ø§Ù„Ù‚Ø¯Ø±Ø©",
    yearlyNote: "Ø§Ù„Ù…Ø¬Ø§Ù…ÙŠØ¹ Ø§Ù„Ø³Ù†ÙˆÙŠØ© ØªØ³ØªØ®Ø¯Ù… Ø³Ø¹Ø± ÙƒÙ„ Ø®Ø·Ø© ÙƒÙ…Ø§ Ù‡Ùˆ Ù…Ø¶Ø¨ÙˆØ·. Ø§Ù„Ø¯ÙØ¹ ÙŠØ³ØªØ®Ø¯Ù… Ø§Ù„ÙØªØ±Ø© Ø§Ù„ØªÙŠ ØªØ®ØªØ§Ø±Ù‡Ø§.",
    valueTitle1: "Ù…Ø³Ø§Ø­Ø© Ø°ÙƒØ§Ø¡ Ù„Ù„Ø´Ø±ÙƒØ©",
    valueBody1: "Ù†Ø¸Ù‘Ù… Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØ§Ù„Ø§Ù…ØªØ«Ø§Ù„ ÙˆØ§Ù„ØªØ£Ù‡ÙŠÙ„ ÙˆØ§Ù„Ø£Ø¯Ù„Ø© ÙˆØ§Ù„Ø·Ù„Ø¨Ø§Øª ÙÙŠ Ù…ÙƒØ§Ù† ÙˆØ§Ø­Ø¯ØŒ Ø«Ù… Ø§Ø¹Ù…Ù„ Ù…Ø¹ Ø§Ù„ÙØ±ÙŠÙ‚.",
    valueTitle2: "Ø­Ø¯ÙˆØ¯ ÙˆØ§Ø¶Ø­Ø© Ø¨Ù„Ø§ Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø®ÙÙŠ",
    valueBody2: "Ø§Ù„Ù…Ù‚Ø§Ø¹Ø¯ ÙˆØ­Ø¯ÙˆØ¯ Ø§Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø¸Ø§Ù‡Ø±Ø© Ø¹Ù„Ù‰ ÙƒÙ„ Ø®Ø·Ø©. Ù…Ø§ ØªØ±Ø§Ù‡ Ù‡Ùˆ Ù…Ø§ ØªØªØ¶Ù…Ù†Ù‡ Ø§Ù„Ø®Ø·Ø©.",
    valueTitle3: "Ø¬Ø±Ù‘Ø¨ Ø®Ø·Ø© Ù…Ø¯ÙÙˆØ¹Ø© Ø«Ù… Ù‚Ø±Ø±",
    valueBody3:
      "Ø§Ù„Ø®Ø·Ø· Ø§Ù„Ù…Ø¤Ù‡Ù„Ø© ØªØªØ¶Ù…Ù† ØªØ¬Ø±Ø¨Ø© 14 ÙŠÙˆÙ…Ù‹Ø§ Ù…Ø¹ Ø£Ø³Ù„ÙˆØ¨ Ø¯ÙØ¹. Ø£Ù„ØºÙ Ù‚Ø¨Ù„ Ø§Ù†ØªÙ‡Ø§Ø¦Ù‡Ø§ Ø¥Ù† Ù„Ù… ØªØ±Ø¯ Ø¨Ø¯Ø¡ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ.",
    ctaTitle: "Ø¬Ø§Ù‡Ø²ÙˆÙ† Ù„Ø¥Ø¨Ù‚Ø§Ø¡ Ø§Ù„Ø´Ø±ÙƒØ© Ù…Ø³ØªØ¹Ø¯Ø©ØŸ",
    ctaBody: "Ø§Ø¨Ø¯Ø£ Ø¨Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ù…Ø¬Ø§Ù†ÙŠØ©ØŒ Ø£Ùˆ Ø§Ø®ØªØ± Ø®Ø·Ø© ÙˆØ¬Ø±Ù‘Ø¨ Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ 14 ÙŠÙˆÙ…Ù‹Ø§.",
    groups: {
      readiness: "Ø¬Ø§Ù‡Ø²ÙŠØ© Ø§Ù„Ø´Ø±ÙƒØ©",
      opportunities: "Ø§Ù„ÙØ±Øµ ÙˆØ§Ù„Ø·Ù„Ø¨Ø§Øª",
      intelligence: "Ø§Ù„Ø°ÙƒØ§Ø¡ ÙˆØ§Ù„Ù‚Ø±Ø§Ø±Ø§Øª",
      workflow: "Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ ÙˆØ³ÙŠØ± Ø§Ù„Ø¹Ù…Ù„",
    },
    features: {
      company_profile: "Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ©",
      document_compliance: "Ø§Ù…ØªØ«Ø§Ù„ Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª",
      supplier_qualification: "ØªØ£Ù‡ÙŠÙ„ Ø§Ù„Ù…ÙˆØ±Ø¯",
      client_requests: "Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡",
      tender_calendar: "Ø§Ù„ØªÙ‚ÙˆÙŠÙ…",
      evidence_intelligence: "Ø°ÙƒØ§Ø¡ Ø§Ù„Ø£Ø¯Ù„Ø©",
      advanced_decision_engine: "Ù…Ø­Ø±Ùƒ Ø§Ù„Ù‚Ø±Ø§Ø±",
      decision_memory: "Ø°Ø§ÙƒØ±Ø© Ø§Ù„Ù‚Ø±Ø§Ø±",
      decision_simulator: "Ù…Ø­Ø§ÙƒÙŠ Ø§Ù„Ù‚Ø±Ø§Ø±",
      explainable_decision: "Ù‚Ø±Ø§Ø± Ù‚Ø§Ø¨Ù„ Ù„Ù„ØªÙØ³ÙŠØ±",
      tender_analysis: "ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª",
      questionnaire_assistant: "Ù…Ø³Ø§Ø¹Ø¯ Ø§Ù„Ø§Ø³ØªØ¨ÙŠØ§Ù†Ø§Øª",
      smart_alerts: "ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø°ÙƒÙŠØ©",
      team_collaboration: "Ø³ÙŠØ± Ù‚Ø±Ø§Ø± Ø§Ù„ÙØ±ÙŠÙ‚",
      pdf_export: "ØªØµØ¯ÙŠØ± PDF",
      tender_action_plan: "Ø®Ø·Ø© Ø§Ù„Ø¹Ù…Ù„",
    },
  },
  faq: {
    eyebrow: "Ø§Ù„Ø£Ø³Ø¦Ù„Ø©",
    title: "Ø¥Ø¬Ø§Ø¨Ø§Øª ÙˆØ§Ø¶Ø­Ø©",
    items: [
      {
        q: "Ù…Ø§ Ù‡ÙŠ BidveraØŸ",
        a: "Bidvera Ù‡ÙŠ Ù…Ø³Ø§Ø­Ø© Ø¹Ù…Ù„ Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø´Ø±ÙƒØ© ØªØ³Ø§Ø¹Ø¯ Ø§Ù„Ø´Ø±ÙƒØ§Øª Ø¹Ù„Ù‰ ØªÙ†Ø¸ÙŠÙ… Ù…Ø¹Ù„ÙˆÙ…Ø§ØªÙ‡Ø§ØŒ ÙˆØ¥Ø¯Ø§Ø±Ø© Ø§Ù„Ø§Ù…ØªØ«Ø§Ù„ØŒ ÙˆØªÙ‚ÙŠÙŠÙ… Ø§Ù„ÙØ±Øµ Ø°Ø§Øª Ø§Ù„ØµÙ„Ø©ØŒ ÙˆØ§Ù„Ø¹Ù…Ù„ Ø¨Ø§Ù„Ø£Ø¯Ù„Ø©ØŒ ÙˆØ§ØªØ®Ø§Ø° Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª Ø¨Ø«Ù‚Ø©.",
      },
      {
        q: "ÙƒÙŠÙ ØªØ³Ø§Ø¹Ø¯ Bidvera ÙÙŠ Ø¥Ø¨Ù‚Ø§Ø¡ Ø´Ø±ÙƒØªÙŠ Ø¬Ø§Ù‡Ø²Ø©ØŸ",
        a: "ØªØ¬Ù…Ø¹ Bidvera Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØ§Ù„ØªØ£Ù‡ÙŠÙ„Ø§Øª ÙˆØ§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ø£Ø³Ø§Ø³ÙŠØ© Ù…Ø¹Ù‹Ø§ Ø­ØªÙ‰ ÙŠØªÙ…ÙƒÙ† ÙØ±ÙŠÙ‚Ùƒ Ù…Ù† Ø§Ù„Ø­ÙØ§Ø¸ Ø¹Ù„Ù‰ Ø£Ø³Ø§Ø³ Ø¹Ù…Ù„ Ù…ÙˆØ«ÙˆÙ‚ ÙˆÙ…Ø­Ø¯Ù‘Ø«.",
      },
      {
        q: "ÙƒÙŠÙ ÙŠØ¹Ù…Ù„ Document ComplianceØŸ",
        a: "ØªØªØ¨Ù‘Ø¹ Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ø´Ø±ÙƒØ© Ø§Ù„Ù…Ù‡Ù…Ø©ØŒ ÙˆØ±Ø§Ù‚Ø¨ ØªÙˆØ§Ø±ÙŠØ® Ø§Ù„Ø§Ù†ØªÙ‡Ø§Ø¡ØŒ ÙˆØªÙ„Ù‚Ù‘ÙŽ ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø¹Ù†Ø¯ Ø§Ù„Ø­Ø§Ø¬Ø© Ø¥Ù„Ù‰ Ø§Ù‡ØªÙ…Ø§Ù…ØŒ Ù…Ù…Ø§ ÙŠØ³Ø§Ø¹Ø¯ Ø´Ø±ÙƒØªÙƒ Ø¹Ù„Ù‰ Ø§Ù„Ø¨Ù‚Ø§Ø¡ Ù…Ø³ØªØ¹Ø¯Ø©.",
      },
      {
        q: "ÙƒÙŠÙ ØªØ³Ø§Ø¹Ø¯ Bidvera ÙÙŠ Ø§Ù„ÙØ±Øµ ÙˆØ·Ù„Ø¨Ø§Øª Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ØŸ",
        a: "ÙŠÙ…ÙƒÙ† Ù„Ù„ÙØ±Ù‚ Ø§Ù„ØªÙ‚Ø§Ø· Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ØŒ ÙˆÙ…ØªØ§Ø¨Ø¹Ø© Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯ ÙÙŠ ØªÙ‚ÙˆÙŠÙ… Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§ØªØŒ ÙˆØªÙ‚ÙŠÙŠÙ… Ø§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª Ù…Ù‚Ø§Ø¨Ù„ Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØ§Ù„Ù‚Ø¯Ø±Ø§Øª ÙˆØ§Ù„ØªØ£Ù‡ÙŠÙ„Ø§Øª.",
      },
      {
        q: "Ù‡Ù„ ÙŠÙ…ÙƒÙ† Ù„Ù€ Bidvera Ø§Ù„Ù…Ø³Ø§Ø¹Ø¯Ø© ÙÙŠ Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ ÙˆØ§Ù„Ø§Ø³ØªØ¨ÙŠØ§Ù†Ø§ØªØŸ",
        a: "Ù†Ø¹Ù…. ÙŠÙ…ÙƒÙ† Ù„Ù„ÙØ±Ù‚ Ø¥Ø¯Ø§Ø±Ø© Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡ ÙˆØ§Ø³ØªØ®Ø¯Ø§Ù… Questionnaire Assistant Ù„ØªÙ†Ø¸ÙŠÙ… Ø§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ù…Ø·Ù„ÙˆØ¨Ø© ÙˆØ§Ù„Ø±Ø¯ Ø¹Ù„ÙŠÙ‡Ø§ Ø¨ÙƒÙØ§Ø¡Ø© Ø£ÙƒØ¨Ø±.",
      },
      {
        q: "ÙƒÙŠÙ ØªØ³ØªØ®Ø¯Ù… Bidvera Ø§Ù„Ø£Ø¯Ù„Ø©ØŸ",
        a: "ÙŠØ±Ø¨Ø· Evidence Intelligence Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØ§Ù„ØªØ£Ù‡ÙŠÙ„Ø§Øª ÙˆØ§Ù„Ø£Ø¯Ù„Ø© Ø§Ù„Ø¯Ø§Ø¹Ù…Ø© Ø­ØªÙ‰ ØªÙÙ‡Ù… Ø§Ù„ÙØ±Ù‚ Ù…Ø§ ØªÙ… Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù†Ù‡ ÙˆÙ…Ø§ ÙŠØ­ØªØ§Ø¬ Ø¥Ù„Ù‰ Ø§Ù‡ØªÙ…Ø§Ù… ÙˆÙ„Ù…Ø§Ø°Ø§.",
      },
      {
        q: "Ù‡Ù„ ÙŠÙ…ÙƒÙ† Ù„ÙØ±ÙŠÙ‚ÙŠ Ø§Ù„ØªØ¹Ø§ÙˆÙ† ÙÙŠ BidveraØŸ",
        a: "Ù†Ø¹Ù…. ÙŠØ³Ø§Ø¹Ø¯ Team Decision Workflow Ø§Ù„Ø£Ø¹Ø¶Ø§Ø¡ Ø¹Ù„Ù‰ Ø§Ù„Ø¹Ù…Ù„ Ù…Ø¹Ù‹Ø§ØŒ ÙˆØªØ¹ÙŠÙŠÙ† Ø§Ù„Ù…Ø³Ø¤ÙˆÙ„ÙŠØ§ØªØŒ ÙˆÙ…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§ØªØŒ ÙˆØªÙ†Ø³ÙŠÙ‚ Ø§Ù„Ø®Ø·ÙˆØ§Øª Ø§Ù„ØªØ§Ù„ÙŠØ© ÙÙŠ Ù…Ø³Ø§Ø­Ø© ÙˆØ§Ø­Ø¯Ø©.",
      },
      {
        q: "Ù‡Ù„ Bidvera Ø¢Ù…Ù†Ø©ØŸ",
        a: "ØµÙÙ…Ù…Øª Bidvera Ø¨ÙˆØµÙˆÙ„ Ù…ÙØªØ­ÙƒÙ‘ÙŽÙ… ÙÙŠÙ‡ ÙˆØ¹Ø²Ù„ Ù„Ù„Ù…Ø³ØªØ£Ø¬Ø±ÙŠÙ† ÙˆØ­Ù…Ø§ÙŠØ§Øª Ø£Ù…Ù†ÙŠØ© Ø­ØªÙ‰ ØªØ¨Ù‚Ù‰ Ù…Ø³Ø§Ø­Ø© Ø¹Ù…Ù„ ÙˆÙ…Ø¹Ù„ÙˆÙ…Ø§Øª ÙƒÙ„ Ø´Ø±ÙƒØ© Ù…Ù†ÙØµÙ„Ø©.",
      },
      {
        q: "Ù‡Ù„ ÙŠÙ…ÙƒÙ†Ù†ÙŠ ØªØ¬Ø±Ø¨Ø© Bidvera Ù‚Ø¨Ù„ Ø§Ù„Ø§Ø´ØªØ±Ø§ÙƒØŸ",
        a: "Ù†Ø¹Ù…. ÙŠÙ…ÙƒÙ†Ùƒ Ø§Ù„Ø¨Ø¯Ø¡ Ø¨Ø§Ù„ØªØ¬Ø±Ø¨Ø© Ø§Ù„Ù…Ø¬Ø§Ù†ÙŠØ© Ø§Ù„Ù…ØªØ§Ø­Ø© ÙˆØ§Ø³ØªÙƒØ´Ø§Ù Ø§Ù„Ù…Ù†ØµØ© Ù‚Ø¨Ù„ Ø§Ø®ØªÙŠØ§Ø± Ø§Ø´ØªØ±Ø§Ùƒ.",
      },
    ],
  },
  auth: {
    loginTitle: "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„",
    loginBody: "Ø§Ø¯Ø®Ù„ Ø¥Ù„Ù‰ Ù…Ø³Ø§Ø­Ø© Ø¹Ù…Ù„ Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ Ù„Ø´Ø±ÙƒØªÙƒ.",
    emailChangedNotice:
      "ØªÙ… ØªØ­Ø¯ÙŠØ« Ø¨Ø±ÙŠØ¯Ùƒ. Ø³Ø¬Ù‘Ù„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¨Ø§Ù„Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ø¬Ø¯ÙŠØ¯. ØªÙ… Ø¥Ù†Ù‡Ø§Ø¡ Ø§Ù„Ø¬Ù„Ø³Ø§Øª Ø§Ù„Ø£Ø®Ø±Ù‰.",
    sideHeadline: "Ø§Ø¹Ø±Ù Ù…Ø§ ÙŠØ³ØªØ­Ù‚ Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©. Ø§Ø¹Ø±Ù Ù…Ø§ Ø£Ù†Øª Ø¬Ø§Ù‡Ø² Ù„Ù‡.",
    sideBody:
      "ØªØ³Ø§Ø¹Ø¯ Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ ÙØ±ÙŠÙ‚Ùƒ Ø¹Ù„Ù‰ ØªÙ†Ø¸ÙŠÙ… Ø§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© ÙˆØ§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø§Ù„Ø£Ø¯Ù„Ø© ÙˆØªÙ‚ÙŠÙŠÙ… Ø§Ù„ÙØ±Øµ ÙˆØ§ØªØ®Ø§Ø° Ø§Ù„Ù‚Ø±Ø§Ø± Ø¨Ø«Ù‚Ø©.",
    sidePillMatched: "Ù…Ø·Ø§Ø¨Ù‚Ø© â€” ÙˆÙØ¬Ø¯Øª ÙØ±ØµØ© Ù…Ù†Ø§Ø³Ø¨Ø© Ù„Ù„Ø´Ø±ÙƒØ©.",
    sidePillReview: "Ù…Ø±Ø§Ø¬Ø¹Ø© â€” Ø±Ø§Ø¬Ø¹ ØªÙØ§ØµÙŠÙ„ Ø§Ù„ÙØ±ØµØ© ÙˆÙ…Ø¯Ù‰ ØµÙ„ØªÙ‡Ø§.",
    sidePillNotAMatch: "Ù„ÙŠØ³Øª Ù…Ø·Ø§Ø¨Ù‚Ø© â€” Ø§Ù„ÙØ±ØµØ© Ù„Ø§ ØªØªÙˆØ§ÙÙ‚ Ù…Ø¹ Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ©.",
    signupTitle: "Ø£Ù†Ø´Ø¦ Ø­Ø³Ø§Ø¨ Bidvera",
    signupBody: "Ø§Ù„Ø¨Ø±ÙŠØ¯ ÙˆÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø£ÙˆÙ„Ø§Ù‹ØŒ Ø«Ù… Ø¥Ø¹Ø¯Ø§Ø¯ Ø§Ù„Ø´Ø±ÙƒØ©.",
    name: "Ø§Ø³Ù…Ùƒ",
    companyName: "Ø§Ø³Ù… Ø§Ù„Ø´Ø±ÙƒØ©",
    email: "Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ù…Ù‡Ù†ÙŠ",
    password: "ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±",
    confirmPassword: "ØªØ£ÙƒÙŠØ¯ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±",
    submitLogin: "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„",
    submitSignup: "Ø¥Ù†Ø´Ø§Ø¡ Ø­Ø³Ø§Ø¨",
    haveAccount: "Ù„Ø¯ÙŠÙƒ Ø­Ø³Ø§Ø¨ Ø¨Ø§Ù„ÙØ¹Ù„ØŸ",
    newHere: "Ø¬Ø¯ÙŠØ¯ Ø¹Ù„Ù‰ BidveraØŸ",
    acceptTerms: "Ø£ÙˆØ§ÙÙ‚ Ø¹Ù„Ù‰ Ø§Ù„Ø´Ø±ÙˆØ· ÙˆØ³ÙŠØ§Ø³Ø© Ø§Ù„Ø®ØµÙˆØµÙŠØ©.",
    acceptTermsLead: "Ø£ÙˆØ§ÙÙ‚ Ø¹Ù„Ù‰",
    acceptTermsJoiner: "Ùˆ",
    termsOfServiceLink: "Ø´Ø±ÙˆØ· Ø§Ù„Ø®Ø¯Ù…Ø©",
    privacyPolicyLink: "Ø³ÙŠØ§Ø³Ø© Ø§Ù„Ø®ØµÙˆØµÙŠØ©",
    acceptTermsError: "ÙŠØ¬Ø¨ Ù‚Ø¨ÙˆÙ„ Ø§Ù„Ø´Ø±ÙˆØ· ÙˆØ³ÙŠØ§Ø³Ø© Ø§Ù„Ø®ØµÙˆØµÙŠØ©.",
    continueGoogle: "ØªØ³Ø¬ÙŠÙ„ Ø¨ÙˆØ§Ø³Ø·Ø© ÙƒÙˆÙƒÙˆÙ„",
    googleComingSoon: "ØªØ³Ø¬ÙŠÙ„ ÙƒÙˆÙƒÙˆÙ„ Ù‚Ø±ÙŠØ¨Ù‹Ø§",
    googleOAuthError: "ÙØ´Ù„ ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø¯Ø®ÙˆÙ„ Ø¹Ø¨Ø± ÙƒÙˆÙƒÙˆÙ„. Ø­Ø§ÙˆÙ„ Ù…Ø±Ø© Ø£Ø®Ø±Ù‰.",
    continueMicrosoft: "ØªØ³Ø¬ÙŠÙ„ Ø¨ÙˆØ§Ø³Ø·Ø© Microsoft",
    microsoftComingSoon: "ØªØ³Ø¬ÙŠÙ„ Microsoft Ù‚Ø±ÙŠØ¨Ù‹Ø§",
    forgotPassword: "Ù†Ø³ÙŠØª ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±ØŸ",
    forgotTitle: "Ø¥Ø¹Ø§Ø¯Ø© ØªØ¹ÙŠÙŠÙ† ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±",
    forgotBody: "Ø³Ù†Ø±Ø³Ù„ Ø±Ø§Ø¨Ø·Ù‹Ø§ Ù„Ù…Ø±Ø© ÙˆØ§Ø­Ø¯Ø© Ø¥Ù† ÙˆÙØ¬Ø¯ Ø§Ù„Ø­Ø³Ø§Ø¨.",
    forgotSubmit: "Ø¥Ø±Ø³Ø§Ù„ Ø±Ø§Ø¨Ø· Ø§Ù„Ø¥Ø¹Ø§Ø¯Ø©",
    forgotSent: "Ø¥Ù† ÙƒØ§Ù† Ø§Ù„Ø¨Ø±ÙŠØ¯ Ù…Ø³Ø¬Ù„Ø§Ù‹ØŒ ÙØ§Ù„Ø±Ø§Ø¨Ø· ÙÙŠ Ø§Ù„Ø·Ø±ÙŠÙ‚.",
    resetTitle: "Ø§Ø®ØªØ± ÙƒÙ„Ù…Ø© Ù…Ø±ÙˆØ± Ø¬Ø¯ÙŠØ¯Ø©",
    resetBody: "Ø§Ø³ØªØ®Ø¯Ù… 12 Ø­Ø±ÙÙ‹Ø§ Ø¹Ù„Ù‰ Ø§Ù„Ø£Ù‚Ù„.",
    resetSubmit: "ØªØ­Ø¯ÙŠØ« ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ±",
    passwordMismatch: "ÙƒÙ„Ù…ØªØ§ Ø§Ù„Ù…Ø±ÙˆØ± ØºÙŠØ± Ù…ØªØ·Ø§Ø¨Ù‚ØªÙŠÙ†.",
  },
  assistant: {
    askLabel: "Ø§Ø³Ø£Ù„ Bidvera",
    title: "Ù…Ø³Ø§Ø¹Ø¯ Ø¨ÙŠØ¯ÙØ±Ø§Ø¡",
    description:
      "Ø§Ø³Ø£Ù„ Ø¹Ù† Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ Ø£Ùˆ Ø§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© Ø£Ùˆ Ø§Ù„ÙØ±Øµ Ø£Ùˆ Ø§Ù„Ø£Ø¯Ù„Ø© Ø£Ùˆ Ø§Ù„Ø®Ø·ÙˆØ§Øª Ø§Ù„ØªØ§Ù„ÙŠØ©. Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø§Øª Ù…Ù† Ø§Ù„Ù…Ø³Ø§Ø¹Ø¯ Ø§Ù„Ø°ÙƒÙŠØŒ ÙˆØ§Ù„ØµÙˆØª Ø¹Ø¨Ø± ØªØ­ÙˆÙŠÙ„ Ù†Øµ Ø¥Ù„Ù‰ ÙƒÙ„Ø§Ù… Ø¢Ù…Ù†.",
    placeholder: "Ø§Ø·Ø±Ø­ Ø³Ø¤Ø§Ù„Ø§Ù‹â€¦",
    send: "Ø¥Ø±Ø³Ø§Ù„",
    thinking: "Ø¬Ø§Ø±Ù Ø§Ù„ØªÙÙƒÙŠØ±â€¦",
    play: "ØªØ´ØºÙŠÙ„",
    pause: "Ø¥ÙŠÙ‚Ø§Ù Ù…Ø¤Ù‚Øª",
    mute: "ÙƒØªÙ…",
    unmute: "Ø¥Ù„ØºØ§Ø¡ Ø§Ù„ÙƒØªÙ…",
    voiceUnavailable: "Ø§Ù„ØµÙˆØª ØºÙŠØ± Ù…ØªØ§Ø­ Ø§Ù„Ø¢Ù†. ÙŠÙ…ÙƒÙ†Ùƒ Ù‚Ø±Ø§Ø¡Ø© Ø§Ù„Ø¥Ø¬Ø§Ø¨Ø©.",
    errorGeneric: "ØªØ¹Ø°Ø± Ø§Ù„Ø­ØµÙˆÙ„ Ø¹Ù„Ù‰ Ø¥Ø¬Ø§Ø¨Ø©. Ø­Ø§ÙˆÙ„ Ù…Ø±Ø© Ø£Ø®Ø±Ù‰.",
    attachImage: "Ø¥Ø±ÙØ§Ù‚ ØµÙˆØ±Ø©",
    removeImage: "Ø¥Ø²Ø§Ù„Ø© Ø§Ù„ØµÙˆØ±Ø©",
    imageOnlyOne: "ÙŠÙØ³Ù…Ø­ Ø¨ØµÙˆØ±Ø© ÙˆØ§Ø­Ø¯Ø© ÙÙ‚Ø·.",
    imageTooLarge: "Ø§Ù„ØµÙˆØ±Ø© ÙƒØ¨ÙŠØ±Ø© Ø¬Ø¯Ø§Ù‹ (Ø§Ù„Ø­Ø¯ 4 Ù…ÙŠØ¬Ø§Ø¨Ø§ÙŠØª).",
    imageInvalid: "Ø§Ø³ØªØ®Ø¯Ù… ØµÙˆØ±Ø© JPEG Ø£Ùˆ PNG Ø£Ùˆ WebP Ø£Ùˆ GIF.",
    imageQuotaReached: "ØªÙ… ØªØ¬Ù…ÙŠØ¯ Ø±ÙØ¹ Ø§Ù„ØµÙˆØ± â€” ØµÙˆØ±Ø© ÙˆØ§Ø­Ø¯Ø© ÙƒÙ„ 4 Ø³Ø§Ø¹Ø§Øª Ù„Ù‡Ø°Ø§ Ø§Ù„Ù…ØªØµÙØ­ ÙˆØ§Ù„Ø¹Ù†ÙˆØ§Ù†.",
    replyQuotaReached: "ØªÙ… ØªØ¬Ù…ÙŠØ¯ Ø§Ù„Ø¥Ø±Ø³Ø§Ù„ â€” Ø§Ø³ØªÙÙ‡Ù„ÙƒØª 10 Ø±Ø¯ÙˆØ¯ Ù„Ù‡Ø°Ø§ Ø§Ù„Ù…ØªØµÙØ­ ÙˆØ§Ù„Ø¹Ù†ÙˆØ§Ù† (ÙŠÙØ¹Ø§Ø¯ Ø¨Ø¹Ø¯ 4 Ø³Ø§Ø¹Ø§Øª).",
  },
  app: {
    nav: {
      dashboard: "Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ…",
      tenders: "ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª",
      tenderCalendar: "ØªÙ‚ÙˆÙŠÙ… Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª",
      documentCompliance: "Ø§Ù…ØªØ«Ø§Ù„ Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª",
      supplierQualification: "ØªØ£Ù‡ÙŠÙ„ Ø§Ù„Ù…ÙˆØ±Ø¯",
      clientRequests: "Ø·Ù„Ø¨Ø§Øª Ø§Ù„Ø¹Ù…Ù„Ø§Ø¡",
      questionnaireAssistant: "Ù…Ø³Ø§Ø¹Ø¯ Ø§Ù„Ø§Ø³ØªØ¨ÙŠØ§Ù†Ø§Øª",
      matchedOpportunities: "Ø§Ù„ÙØ±Øµ Ø§Ù„Ù…Ø·Ø§Ø¨Ù‚Ø©",
      company: "Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ©",
      billing: "Ø§Ù„ÙÙˆØªØ±Ø©",
      alerts: "Ø§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª",
      settings: "Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª",
      decisionMemory: "Ø°Ø§ÙƒØ±Ø© Ø§Ù„Ù‚Ø±Ø§Ø±",
      teamWorkflow: "Ø³ÙŠØ± Ø¹Ù…Ù„ Ø§Ù„ÙØ±ÙŠÙ‚",
      sectionCapabilities: "Ø§Ù„Ù‚Ø¯Ø±Ø§Øª",
      sectionWorkspace: "Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„",
      sectionAccount: "Ø§Ù„Ø­Ø³Ø§Ø¨",
    },
    shell: {
      tagline: "ØªØ­Ù‚Ù‘Ù‚ Ù‚Ø¨Ù„ Ø£Ù† ØªÙ‚Ø¯Ù‘Ù….",
      analyzeTender: "ØªØ­Ù„ÙŠÙ„ Ù…Ù†Ø§Ù‚ØµØ©",
      upgrade: "ØªØ±Ù‚ÙŠØ©",
      signOut: "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬",
      openMenu: "ÙØªØ­ Ø§Ù„Ù‚Ø§Ø¦Ù…Ø©",
      closeMenu: "Ø¥ØºÙ„Ø§Ù‚ Ø§Ù„Ù‚Ø§Ø¦Ù…Ø©",
      decisionWorkspace: "Ù…Ø³Ø§Ø­Ø© Bidvera",
      yourCompany: "Ø´Ø±ÙƒØªÙƒ",
      workspace: "Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„",
    },
    dashboard: {
      eyebrow: "Ù†Ø¸Ø±Ø© ØªÙ†ÙÙŠØ°ÙŠØ©",
      title: "Ù„ÙˆØ­Ø© Ø§Ù„ØªØ­ÙƒÙ…",
      subtitle:
        "Ù…Ø§ Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„ØªØ§Ù„ÙŠØŒ ÙˆØ£ÙŠ Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª ØªØ³ØªØ­Ù‚ Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©ØŒ ÙˆÙ…Ø§ Ø§Ù„Ø°ÙŠ ÙŠØ¹ÙŠÙ‚Ùƒ.",
      analyzeCta: "ØªØ­Ù„ÙŠÙ„ Ù…Ù†Ø§Ù‚ØµØ©",
      activeTenders: "Ù…Ù†Ø§Ù‚ØµØ§Øª Ù†Ø´Ø·Ø©",
      inPipeline: "ÙÙŠ Ø§Ù„Ù…Ø³Ø§Ø±",
      bid: "Ù…ØªÙˆØ§ÙÙ‚",
      pursue: "Ù…ØªØ§Ø¨Ø¹Ø©",
      review: "ÙŠØ­ØªØ§Ø¬ ØªØ­Ù‚Ù‚",
      verifyFirst: "ØªØ­Ù‚Ù‘Ù‚ Ø£ÙˆÙ„Ù‹Ø§",
      noBid: "ØºÙŠØ± Ù…ØªÙˆØ§ÙÙ‚",
      skipEffort: "ØªØ¬Ù†Ù‘Ø¨ Ø§Ù„Ø¬Ù‡Ø¯",
      upcomingDeadlines: "Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯ Ø§Ù„Ù‚Ø§Ø¯Ù…Ø©",
      upcomingEmpty: "Ù„Ø§ Ù…ÙˆØ§Ø¹ÙŠØ¯ Ù†Ù‡Ø§Ø¦ÙŠØ© Ø®Ù„Ø§Ù„ Ø§Ù„Ø£Ø³Ø¨ÙˆØ¹ÙŠÙ† Ø§Ù„Ù‚Ø§Ø¯Ù…ÙŠÙ†.",
      upcomingCalendarDeadlines: "Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯ Ø§Ù„Ù‚Ø§Ø¯Ù…Ø©",
      upcomingCalendarHint:
        "From Tender Calendar â€” same deadlines shown in the calendar module",
      upcomingCalendarEmpty: "Ù„Ø§ Ù…ÙˆØ§Ø¹ÙŠØ¯ ØªÙ‚ÙˆÙŠÙ… Ù‚Ø§Ø¯Ù…Ø© Ø¨Ø¹Ø¯.",
      addCalendarTender: "Ø¥Ø¶Ø§ÙØ© Ù…Ù†Ø§Ù‚ØµØ© Ø¥Ù„Ù‰ Ø§Ù„ØªÙ‚ÙˆÙŠÙ…",
      highRisk: "Ù…Ù†Ø§Ù‚ØµØ§Øª Ø¹Ø§Ù„ÙŠØ© Ø§Ù„Ù…Ø®Ø§Ø·Ø±",
      highRiskEmpty: "Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ù†Ø§Ù‚ØµØ§Øª Ø¨Ù…Ø®Ø§Ø·Ø± Ø¹Ø§Ù„ÙŠØ© Ø£Ùˆ Ø­Ø±Ø¬Ø© Ø­Ø§Ù„ÙŠÙ‹Ø§.",
      recentAnalyses: "Ø§Ù„ØªØ­Ù„ÙŠÙ„Ø§Øª Ø§Ù„Ø£Ø®ÙŠØ±Ø©",
      recentEmpty:
        "Ù„Ø§ ØªØ­Ù„ÙŠÙ„Ø§Øª Ø¨Ø¹Ø¯. Ø§Ø±ÙØ¹ Ù…Ù†Ø§Ù‚ØµØ© Ù„Ù„Ø­ØµÙˆÙ„ Ø¹Ù„Ù‰ Ù‚Ø±Ø§Ø±Ùƒ Ø§Ù„Ø£ÙˆÙ„.",
      viewAll: "Ø¹Ø±Ø¶ Ø§Ù„ÙƒÙ„",
      due: "Ø§Ù„Ø§Ø³ØªØ­Ù‚Ø§Ù‚",
      analyzed: "ØªÙ… Ø§Ù„ØªØ­Ù„ÙŠÙ„",
      decisionDistribution: "ØªÙˆØ²ÙŠØ¹ Ø§Ù„Ù‚Ø±Ø§Ø±Ø§Øª",
      decisionDistributionHint: "Ø­ØµØ© Ù†ØªØ§Ø¦Ø¬ Ù…ØªÙˆØ§ÙÙ‚ / ÙŠØ­ØªØ§Ø¬ ØªØ­Ù‚Ù‚ / ØºÙŠØ± Ù…ØªÙˆØ§ÙÙ‚ Ø§Ù„Ù…ÙƒØªÙ…Ù„Ø©",
      upcomingHint: "Ù…Ù†Ø§Ù‚ØµØ§Øª Ù„Ø§ ØªØ²Ø§Ù„ ÙÙŠ Ø§Ù„ØªÙ‚ÙˆÙŠÙ…",
      uploadTender: "Ø±ÙØ¹ Ù…Ù†Ø§Ù‚ØµØ©",
      riskOverview: "Ù†Ø¸Ø±Ø© Ø¹Ù„Ù‰ Ø§Ù„Ù…Ø®Ø§Ø·Ø±",
      riskOverviewHint: "ØªØ¹Ø±Ø¶ Ø­Ø±Ø¬ Ø£Ùˆ Ø¹Ø§Ù„Ù Ù„Ù„Ø§Ø³ØªØ¨Ø¹Ø§Ø¯",
      recentHint: "Ø£Ø­Ø¯Ø« Ù†ØªØ§Ø¦Ø¬ Ù…ØªÙˆØ§ÙÙ‚ / ÙŠØ­ØªØ§Ø¬ ØªØ­Ù‚Ù‚ / ØºÙŠØ± Ù…ØªÙˆØ§ÙÙ‚",
      platformTitle: "Ù…Ø§ ÙŠÙ…ÙƒÙ†Ùƒ ÙØ¹Ù„Ù‡ ÙÙŠ Ø¨ÙŠØ¯ÙØ±Ø§Ø¡",
      platformHint: "Four capabilities in one product â€” open any module to continue.",
      capabilityAnalysisDesc: "Ø§Ø±ÙØ¹ Ø§Ù„Ø­Ø²Ù… ÙˆØ§Ø­ØµÙ„ Ø¹Ù„Ù‰ Ù‚Ø±Ø§Ø±Ø§Øª Ù…ØªØ§Ø¨Ø¹Ø© / Ø¹Ø¯Ù… Ù…ØªØ§Ø¨Ø¹Ø©.",
      capabilityComplianceDesc: "ØªØªØ¨Ù‘Ø¹ Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ø¹Ù…Ù„ ÙˆØªØ°ÙƒÙŠØ±Ø§Øª Ø§Ù†ØªÙ‡Ø§Ø¡ Ø§Ù„ØµÙ„Ø§Ø­ÙŠØ©.",
      capabilityQualificationDesc:
        "Supplier readiness for bids and questionnaires â€” not your workspace Company Profile.",
      capabilityCalendarDesc: "ØªØªØ¨Ù‘Ø¹ Ù…ÙˆØ§Ø¹ÙŠØ¯ Ø§Ù„ÙØ±Øµ ÙˆØ§Ù„ØªØ°ÙƒÙŠØ±Ø§Øª.",
      capabilityOpen: "ÙØªØ­",
      capabilityGetStarted: "Ø§Ø¨Ø¯Ø£",
      capabilityUpgrade: "Ø±Ù‚Ù‘Ù Ø§Ù„Ø®Ø·Ø© Ù„Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ù‚ÙÙ„",
      statusAnalyses: "{count} ØªØ­Ù„ÙŠÙ„Ø§Øª",
      statusDocuments: "{count} Ù…Ø³ØªÙ†Ø¯Ø§Øª",
      statusCompleteness: "Ù…ÙƒØªÙ…Ù„ Ø¨Ù†Ø³Ø¨Ø© {percent}%",
      statusDeadlines: "{count} Ù‚Ø§Ø¯Ù…Ø©",
      statusLocked: "ØºÙŠØ± Ù…Ø¯Ø±Ø¬ ÙÙŠ Ø®Ø·ØªÙƒ Ø§Ù„Ø­Ø§Ù„ÙŠØ©",
      gettingStartedTitle: "Ø§Ù„Ø®Ø·ÙˆØ§Øª Ø§Ù„ØªØ§Ù„ÙŠØ© Ø§Ù„Ù…Ù‚ØªØ±Ø­Ø©",
      gettingStartedHint: "Pick any path â€” you can come back anytime.",
    },
    onboarding: {
      signOutHint: "Ø§Ù„Ø­Ø³Ø§Ø¨",
      stepVerify: "ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø¨Ø±ÙŠØ¯",
      stepCompany: "Ø§Ù„Ø´Ø±ÙƒØ©",
      stepPlan: "Ø§Ù„Ø®Ø·Ø©",
      verifyTitle: "Ø£ÙƒØ¯ Ø¨Ø±ÙŠØ¯Ùƒ",
      verifyBody: "Ø£Ø±Ø³Ù„Ù†Ø§ Ø±Ø§Ø¨Ø·Ù‹Ø§ Ø¥Ù„Ù‰",
      resend: "Ø¥Ø¹Ø§Ø¯Ø© Ø¥Ø±Ø³Ø§Ù„ Ø±Ø³Ø§Ù„Ø© Ø§Ù„ØªØ£ÙƒÙŠØ¯",
      resent: "ØªÙ… Ø¥Ø±Ø³Ø§Ù„ Ø±Ø³Ø§Ù„Ø© Ø§Ù„ØªØ£ÙƒÙŠØ¯.",
      verifyInvalidTitle: "Ø§Ù„Ø±Ø§Ø¨Ø· ØºÙŠØ± ØµØ§Ù„Ø­ Ø£Ùˆ Ù…Ù†ØªÙ‡Ù",
      verifyInvalidBody: "Ø§Ø·Ù„Ø¨ Ø±Ø³Ø§Ù„Ø© ØªØ£ÙƒÙŠØ¯ Ø¬Ø¯ÙŠØ¯Ø© Ù…Ù† Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯.",
      companyTitle: "Ø£Ø®Ø¨Ø±Ù†Ø§ Ø¹Ù† Ø´Ø±ÙƒØªÙƒ",
      companyBody: "ÙŠØ³Ø§Ø¹Ø¯ Ù‡Ø°Ø§ Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ Ø¹Ù„Ù‰ ØªÙ‚ÙŠÙŠÙ… Ù…Ø¯Ù‰ Ù…Ù„Ø§Ø¡Ù…Ø© Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ© Ù„Ø¹Ù…Ù„Ùƒ.",
      companyName: "Ø§Ø³Ù… Ø§Ù„Ø´Ø±ÙƒØ©",
      country: "Ø§Ù„Ø¨Ù„Ø¯ / Ù…ÙˆÙ‚Ø¹ Ø§Ù„Ø¹Ù…Ù„",
      industry: "Ø§Ù„Ù‚Ø·Ø§Ø¹ / Ø§Ù„Ù…Ø¬Ø§Ù„",
      companySize: "Ø­Ø¬Ù… Ø§Ù„Ø´Ø±ÙƒØ©",
      services: "Ø§Ù„Ø®Ø¯Ù…Ø§Øª / Ø§Ù„Ù‚Ø¯Ø±Ø§Øª Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©",
      servicesHint: "Ø£Ø¶Ù Ø¹Ø¯Ø© ÙˆØ³ÙˆÙ… â€” Ø§Ø¶ØºØ· Enter Ø¨Ø¹Ø¯ ÙƒÙ„ ÙˆØ§Ø­Ø¯Ø©.",
      experience: "Ù…Ø³ØªÙˆÙ‰ Ø§Ù„Ø®Ø¨Ø±Ø©",
      experienceOptional: "Ø§Ø®ØªÙŠØ§Ø±ÙŠ",
      privacyNote:
        "Ù†Ø³ØªØ®Ø¯Ù… Ù‡Ø°Ù‡ Ø§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª ÙÙ‚Ø· Ù„ØªØ®ØµÙŠØµ ØªØ¬Ø±Ø¨Ø© Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ ÙˆØªØ­Ø³ÙŠÙ† ØªØ­Ù„ÙŠÙ„ Ù…Ù„Ø§Ø¡Ù…Ø© Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª. Ù„Ø§ Ù†Ø­ØªØ§Ø¬ Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø­Ø³Ø§Ø³Ø© Ø¹Ù† Ø§Ù„Ø´Ø±ÙƒØ© Ø£Ùˆ Ø§Ù„Ø£ÙØ±Ø§Ø¯.",
      companySubmit: "Ù…ØªØ§Ø¨Ø¹Ø©",
      companySkip: "ØªØ®Ø·Ù‘ Ø§Ù„Ø¢Ù†",
      planTitle: "Ø§Ø®ØªØ± Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø¨Ø¯Ø¡",
      planBody: "Ø§Ø¨Ø¯Ø£ Ø¨Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ù…Ø¬Ø§Ù†ÙŠØ© Ø£Ùˆ Ø§Ø®ØªØ± Ø®Ø·Ø© Ù…Ø¯ÙÙˆØ¹Ø©. Ø®Ø·Ø· Stripe Ø§Ù„Ù…Ø¤Ù‡Ù„Ø© ØªØªØ¶Ù…Ù† ØªØ¬Ø±Ø¨Ø© 14 ÙŠÙˆÙ…Ù‹Ø§.",
      trialTitle: "ØªØ¬Ø±Ø¨Ø© 14 ÙŠÙˆÙ…Ù‹Ø§",
      trialBody: "ÙŠÙ„Ø²Ù… Ø£Ø³Ù„ÙˆØ¨ Ø¯ÙØ¹. Ù„Ø§ Ø±Ø³ÙˆÙ… Ø§Ù„ÙŠÙˆÙ…. ØªØ¨Ø¯Ø£ Ø§Ù„Ø®Ø·Ø© Ø§Ù„Ù…Ø­Ø¯Ø¯Ø© ØªÙ„Ù‚Ø§Ø¦ÙŠÙ‹Ø§ Ù…Ø§ Ù„Ù… ØªÙÙ„ØºÙ.",
      trialCta: "Ø§Ø¨Ø¯Ø£ ØªØ¬Ø±Ø¨Ø© 14 ÙŠÙˆÙ…Ù‹Ø§",
      paidCta: "Ø¨Ø¯Ø¡ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ",
      freeTitle: "Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ù…Ø¬Ø§Ù†ÙŠØ©",
      freeBody: "Ø§Ø¨Ø¯Ø£ Ù…Ø¬Ø§Ù†Ù‹Ø§ ÙˆØ§Ø¨Ù†Ù Ù…Ø³Ø§Ø­Ø© Ø´Ø±ÙƒØªÙƒ. Ù…Ù‚ØªØµØ±Ø© Ø¹Ù„Ù‰ Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØ§Ù„Ø§Ù…ØªØ«Ø§Ù„ Ø§Ù„Ù…Ø³ØªÙ†Ø¯ÙŠ.",
      freeCta: "Ø§Ø¨Ø¯Ø£ Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ù…Ø¬Ø§Ù†ÙŠØ©",
      noChargeToday: "Ù„Ø§ Ø±Ø³ÙˆÙ… Ø§Ù„ÙŠÙˆÙ…",
      paymentMethodRequired: "ÙŠÙ„Ø²Ù… Ø£Ø³Ù„ÙˆØ¨ Ø¯ÙØ¹",
      cancelBeforeTrial: "Ø£Ù„ØºÙ Ù‚Ø¨Ù„ Ø§Ù†ØªÙ‡Ø§Ø¡ Ø§Ù„ØªØ¬Ø±Ø¨Ø© Ù„ØªØ¬Ù†Ø¨ Ø±Ø³ÙˆÙ… Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ.",
      monthly: "Ø´Ù‡Ø±ÙŠ",
      yearly: "Ø³Ù†ÙˆÙŠ",
      checkoutCanceled: "Ø£ÙÙ„ØºÙŠ Ø§Ù„Ø¯ÙØ¹. ÙŠÙ…ÙƒÙ†Ùƒ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù„Ø§Ø­Ù‚Ù‹Ø§.",
      checkoutPending: "ØªÙ… Ø§Ø³ØªÙ„Ø§Ù… Ø§Ù„Ø¯ÙØ¹ â€” Ø¬Ø§Ø±ÙŠ Ø§Ù„ØªÙØ¹ÙŠÙ„â€¦",
    },
    companyProfile: {
      title: "Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ©",
      subtitle:
        "ÙŠÙØ³ØªØ®Ø¯Ù… Ù„Ù…Ø·Ø§Ø¨Ù‚Ø© Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØ§Ù„Ù…Ù†Ø§Ù‚ØµØ© ÙÙŠ Ø§Ù„ØªØ­Ù„ÙŠÙ„Ø§Øª Ø§Ù„Ù‚Ø§Ø¯Ù…Ø©. Ø®Ø§Øµ Ø¨Ù…Ø¤Ø³Ø³ØªÙƒ â€” Ù„Ø§ Ù†Ø·Ù„Ø¨ Ø¨ÙŠØ§Ù†Ø§Øª Ø´Ø®ØµÙŠØ© Ø£Ùˆ Ù…Ø§Ù„ÙŠØ© Ø­Ø³Ø§Ø³Ø©.",
      headerHint:
        "Ø­Ø³Ù‘Ù† Ø¬ÙˆØ¯Ø© Ø§Ù„Ù…Ø·Ø§Ø¨Ù‚Ø© Ù…Ø¹ Ø§Ù„ÙˆÙ‚Øª. ØªÙØ·Ø¨Ù‘ÙŽÙ‚ Ø§Ù„ØªØºÙŠÙŠØ±Ø§Øª Ø¹Ù„Ù‰ ØªØ­Ù„ÙŠÙ„Ø§Øª Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª Ø§Ù„Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠØ© ÙÙ‚Ø·.",
      supplierQualificationHint:
        "Ù‡Ù„ ØªØ­ØªØ§Ø¬ ØªÙØ§ØµÙŠÙ„ ØªØ³Ø¬ÙŠÙ„ ÙˆØ£Ø¯Ù„Ø© Ø¬Ø§Ù‡Ø²Ø© Ù„Ù„Ù…Ù†Ø§Ù‚ØµØ©ØŸ Ø§Ø³ØªØ®Ø¯Ù…",
      supplierQualificationLink: "ØªØ£Ù‡ÙŠÙ„ Ø§Ù„Ù…ÙˆØ±Ø¯",
      companyName: "Ø§Ø³Ù… Ø§Ù„Ø´Ø±ÙƒØ©",
      completeness: "Ø§ÙƒØªÙ…Ø§Ù„ Ø§Ù„Ù…Ù„Ù",
      savedTitle: "ØªÙ… Ø§Ù„Ø­ÙØ¸",
      savedBody:
        "ØªÙ… ØªØ­Ø¯ÙŠØ« Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ©. Ø³ÙŠØ³ØªØ®Ø¯Ù… Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ø£Ø­Ø¯Ø« Ø§Ù„ØªÙØ§ØµÙŠÙ„ ÙÙŠ Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ© Ø§Ù„ØªØ§Ù„ÙŠØ©.",
      saveErrorTitle: "ØªØ¹Ø°Ù‘Ø± Ø§Ù„Ø­ÙØ¸",
      basicsTitle: "Ø£Ø³Ø§Ø³ÙŠØ§Øª Ø§Ù„Ø´Ø±ÙƒØ©",
      basicsBody:
        "Ù„Ù„ØªØ­Ù„ÙŠÙ„ ÙˆØ§Ù„Ù…Ø·Ø§Ø¨Ù‚Ø© ÙÙ‚Ø· â€” Ù„Ø§ Ø­Ø§Ø¬Ø© Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø´Ø®ØµÙŠØ© Ø£Ùˆ Ù…Ø§Ù„ÙŠØ© Ø­Ø³Ø§Ø³Ø©.",
      industry: "Ø§Ù„Ù‚Ø·Ø§Ø¹",
      country: "Ø§Ù„Ø¯ÙˆÙ„Ø©",
      companySize: "Ø­Ø¬Ù… Ø§Ù„Ø´Ø±ÙƒØ©",
      notProvided: "ØºÙŠØ± Ù…Ø­Ø¯Ø¯",
      experienceLevel: "Ù…Ø³ØªÙˆÙ‰ Ø§Ù„Ø®Ø¨Ø±Ø© (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)",
      experienceYears: "Ø³Ù†ÙˆØ§Øª Ø§Ù„Ø®Ø¨Ø±Ø© (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)",
      experienceYearsPlaceholder: "Ù…Ø«Ø§Ù„: 5",
      revenueRange: "Ù†Ø·Ø§Ù‚ Ø§Ù„Ø¥ÙŠØ±Ø§Ø¯Ø§Øª (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)",
      revenuePlaceholder: "Ù…Ø«Ø§Ù„: Â£2mâ€“Â£5m",
      employees: "Ø¹Ø¯Ø¯ Ø§Ù„Ù…ÙˆØ¸ÙÙŠÙ† (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)",
      employeesPlaceholder: "Ù…Ø«Ø§Ù„: 50â€“100",
      sizeSolo: "ÙØ±Ø¯ÙŠ",
      sizeSmall: "ØµØºÙŠØ±Ø©",
      sizeMedium: "Ù…ØªÙˆØ³Ø·Ø©",
      sizeEnterprise: "ÙƒØ¨ÙŠØ±Ø©",
      expNew: "Ø¬Ø¯ÙŠØ¯Ø© / Ø®Ø¨Ø±Ø© Ù…Ø­Ø¯ÙˆØ¯Ø©",
      expSome: "Ø¨Ø¹Ø¶ Ø§Ù„Ø®Ø¨Ø±Ø©",
      expExperienced: "Ø°Ø§Øª Ø®Ø¨Ø±Ø©",
      expHighly: "Ø®Ø¨Ø±Ø© Ø¹Ø§Ù„ÙŠØ©",
      capabilitiesTitle: "Ø§Ù„Ù‚Ø¯Ø±Ø§Øª ÙˆØ§Ù„ØªØºØ·ÙŠØ©",
      services: "Ø§Ù„Ø®Ø¯Ù…Ø§Øª",
      certifications: "Ø§Ù„Ø´Ù‡Ø§Ø¯Ø§Øª",
      geographicCoverage: "Ø§Ù„ØªØºØ·ÙŠØ© Ø§Ù„Ø¬ØºØ±Ø§ÙÙŠØ©",
      commaSeparated: "Ù…ÙØµÙˆÙ„Ø© Ø¨ÙÙˆØ§ØµÙ„",
      contractTitle: "ØªÙØ¶ÙŠÙ„Ø§Øª Ø§Ù„Ø¹Ù‚ÙˆØ¯",
      contractMin: "Ø§Ù„Ø­Ø¯ Ø§Ù„Ø£Ø¯Ù†Ù‰ Ù„Ù‚ÙŠÙ…Ø© Ø§Ù„Ø¹Ù‚Ø¯ (Â£)",
      contractMax: "Ø§Ù„Ø­Ø¯ Ø§Ù„Ø£Ù‚ØµÙ‰ Ù„Ù‚ÙŠÙ…Ø© Ø§Ù„Ø¹Ù‚Ø¯ (Â£)",
      rulesTitle: "Ù‚ÙˆØ§Ø¹Ø¯ Ø§Ù„ØªØ£Ù‡ÙŠÙ„ Ø§Ù„Ù…Ø®ØµØµØ©",
      rulesBody: "Ù‚Ø§Ø¹Ø¯Ø© ÙˆØ§Ø­Ø¯Ø© ÙÙŠ ÙƒÙ„ Ø³Ø·Ø±. ØªÙØ³ØªØ®Ø¯Ù… ÙƒÙ…Ø±Ø´Ù‘Ø­Ø§Øª Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„ØªØ­Ù„ÙŠÙ„.",
      save: "Ø­ÙØ¸ Ø§Ù„Ù…Ù„Ù",
      learningTitle: "Ø§Ù„Ù…ÙˆØ§ÙÙ‚Ø© Ø¹Ù„Ù‰ Ø§Ù„ØªØ¹Ù„Ù… Ø§Ù„Ø¹Ø§Ù„Ù…ÙŠ",
      learningBody:
        "Ø¹Ù†Ø¯ Ø§Ù„ØªÙØ¹ÙŠÙ„ØŒ Ù‚Ø¯ ØªØ³Ø§Ù‡Ù… Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ Ø¨Ø£Ù†Ù…Ø§Ø· Ù†ØªØ§Ø¦Ø¬ Ù…ÙÙÙ„ØªØ±Ø© Ù„Ù„Ø®ØµÙˆØµÙŠØ© (Ø¯ÙˆÙ† Ø£Ø³Ù…Ø§Ø¡ Ø´Ø±ÙƒØ§Øª Ø£Ùˆ Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø£Ùˆ Ø§Ø³ØªØ±Ø§ØªÙŠØ¬ÙŠØ§Øª Ø£Ùˆ Ø³Ø¬Ù„Ø§Øª Ù‚Ø§Ø¨Ù„Ø© Ù„Ù„ØªØ¹Ø±ÙŠÙ) ÙÙŠ Ø·Ø¨Ù‚Ø© Ø§Ù„ØªØ¹Ù„Ù… Ø§Ù„Ø¹Ø§Ù„Ù…ÙŠØ©. ØªØ¨Ù‚Ù‰ Ù†ØªØ§Ø¦Ø¬ Ø´Ø±ÙƒØªÙƒ Ø§Ù„Ø®Ø§ØµØ© Ù…Ø¹Ø²ÙˆÙ„Ø© Ø¯Ø§Ø®Ù„ Ø§Ù„Ù…Ø³ØªØ£Ø¬Ø±. ÙŠÙ…ÙƒÙ†Ùƒ Ø§Ù„Ø¥Ù„ØºØ§Ø¡ ÙÙŠ Ø£ÙŠ ÙˆÙ‚Øª.",
      learningCheckbox:
        "Ø§Ù„Ù…Ø³Ø§Ù‡Ù…Ø© Ø¨Ù†ØªØ§Ø¦Ø¬ Ù…Ø¬Ù‡ÙˆÙ„Ø© Ø§Ù„Ù‡ÙˆÙŠØ© ÙÙŠ Ø§Ù„Ø£Ù†Ù…Ø§Ø· Ø§Ù„Ø¹Ø§Ù„Ù…ÙŠØ© Ø§Ù„Ù…ÙˆØ«Ù‘Ù‚Ø©",
      learningSaving: "(Ø¬Ø§Ø±Ù Ø§Ù„Ø­ÙØ¸â€¦)",
    },
    billing: {
      title: "Ø§Ù„ÙÙˆØªØ±Ø©",
      subtitle: "Ø§Ù„Ø®Ø·Ø© Ø§Ù„Ø­Ø§Ù„ÙŠØ© ÙˆØ§Ù„ØªØ¬Ø¯ÙŠØ¯ ÙˆØ³Ø¬Ù„ Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø§Øª ÙˆØ§Ù„ÙÙˆØ§ØªÙŠØ±.",
      activatedTitle: "ØªÙ… ØªÙØ¹ÙŠÙ„ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ",
      activatedBody: "Ø®Ø·ØªÙƒ Ù†Ø´Ø·Ø© Ø§Ù„Ø¢Ù†. ØªÙØ­Ø¯Ù‘ÙŽØ« Ø§Ù„Ø­Ø¯ÙˆØ¯ ÙÙˆØ±Ù‹Ø§.",
      trialEndedTitle: "Ø§Ù†ØªÙ‡Øª Ø§Ù„ØªØ¬Ø±Ø¨Ø©",
      trialEndedBody:
        "Ø§Ù†ØªÙ‡Øª ØªØ¬Ø±Ø¨ØªÙƒ Ø§Ù„Ù…Ø¬Ø§Ù†ÙŠØ©. ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª ØºÙŠØ± Ù…ØªØ§Ø­ Ø­ØªÙ‰ ØªÙ‚ÙˆÙ… Ø¨Ø§Ù„ØªØ±Ù‚ÙŠØ©.",
      viewPlans: "Ø¹Ø±Ø¶ Ø§Ù„Ø®Ø·Ø· â†",
      currentPlanTitle: "Ø§Ù„Ø®Ø·Ø© Ø§Ù„Ø­Ø§Ù„ÙŠØ©",
      currentPlanBody: "Ø­Ø§Ù„Ø© Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ ÙˆØ¯ÙˆØ±Ø© Ø§Ù„ÙÙˆØªØ±Ø©",
      plan: "Ø§Ù„Ø®Ø·Ø©",
      status: "Ø§Ù„Ø­Ø§Ù„Ø©",
      provider: "Ù…Ø²ÙˆÙ‘Ø¯ Ø§Ù„Ø¯ÙØ¹",
      billingCycle: "Ø¯ÙˆØ±Ø© Ø§Ù„ÙÙˆØªØ±Ø©",
      renewal: "Ø§Ù„ØªØ¬Ø¯ÙŠØ¯",
      paymentMethod: "Ø·Ø±ÙŠÙ‚Ø© Ø§Ù„Ø¯ÙØ¹",
      changePlan: "ØªØºÙŠÙŠØ± Ø§Ù„Ø®Ø·Ø©",
      upgradePlan: "ØªØ±Ù‚ÙŠØ© Ø§Ù„Ø®Ø·Ø©",
      cancelSubscription: "Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ",
      cancelScheduled: "ØªÙ… Ø¬Ø¯ÙˆÙ„Ø© Ø§Ù„Ø¥Ù„ØºØ§Ø¡ Ø¹Ù†Ø¯ Ù†Ù‡Ø§ÙŠØ© Ø§Ù„ÙØªØ±Ø©.",
      upgradesTitle: "ØªØ±Ù‚ÙŠØ§Øª Ù…ØªØ§Ø­Ø©",
      upgradesBody: "{count} Ø®Ø·Ø· Ø¸Ø§Ù‡Ø±Ø© Ù…Ø¹ Ø¨ÙˆØ§Ø¨Ø§Øª Ø¯ÙØ¹ Ù…ÙØ¹Ù‘Ù„Ø©",
      upgradesBodyOne: "Ø®Ø·Ø© ÙˆØ§Ø­Ø¯Ø© Ø¸Ø§Ù‡Ø±Ø© Ù…Ø¹ Ø¨ÙˆØ§Ø¨Ø§Øª Ø¯ÙØ¹ Ù…ÙØ¹Ù‘Ù„Ø©",
      openCheckout: "ÙØªØ­ Ø§Ù„Ø¯ÙØ¹ â†",
      paymentHistory: "Ø³Ø¬Ù„ Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø§Øª",
      noPayments: "Ù„Ø§ Ù…Ø¯ÙÙˆØ¹Ø§Øª Ø¨Ø¹Ø¯.",
      invoices: "Ø§Ù„ÙÙˆØ§ØªÙŠØ±",
      noInvoices: "Ù„Ø§ ÙÙˆØ§ØªÙŠØ± Ø¨Ø¹Ø¯.",
      viewInvoice: "Ø¹Ø±Ø¶",
      trialFallback: "ØªØ¬Ø±Ø¨Ø©",
      usageTitle: "Ø§Ø³ØªØ®Ø¯Ø§Ù… Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„",
      trialUsageTitle: "Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„ØªØ¬Ø±Ø¨Ø©",
      trialEndedDesc:
        "Ø§Ù†ØªÙ‡Øª ØªØ¬Ø±Ø¨ØªÙƒ Ø§Ù„Ù…Ø¬Ø§Ù†ÙŠØ© â€” Ù‚Ù… Ø¨Ø§Ù„ØªØ±Ù‚ÙŠØ© Ù„ØªØ­Ù„ÙŠÙ„ Ù…Ø²ÙŠØ¯ Ù…Ù† Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª.",
      unlimitedDesc: "{plan} Â· ØªØ­Ù„ÙŠÙ„Ø§Øª ØºÙŠØ± Ù…Ø­Ø¯ÙˆØ¯Ø© Â· {status}",
      remainingDesc: "{remaining} Ù…Ù† {limit} ØªØ­Ù„ÙŠÙ„Ø§Øª Ù…Ø¬Ø§Ù†ÙŠØ© Ù…ØªØ¨Ù‚ÙŠØ©",
      trialEnds: "ØªÙ†ØªÙ‡ÙŠ Ø§Ù„ØªØ¬Ø±Ø¨Ø© ÙÙŠ {date}",
      expired: "Â· Ù…Ù†ØªÙ‡ÙŠØ©",
      analysesUsed: "Ø§Ù„ØªØ­Ù„ÙŠÙ„Ø§Øª Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…Ø©",
      used: "Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…",
      remaining: "Ø§Ù„Ù…ØªØ¨Ù‚ÙŠ",
      unlimited: "ØºÙŠØ± Ù…Ø­Ø¯ÙˆØ¯",
      hoursSaved: "Ø³Ø§Ø¹Ø§Øª Ù…ÙˆÙÙ‘Ø±Ø© ØªÙ‚Ø¯ÙŠØ±ÙŠÙ‹Ø§",
      risksDetected: "Ø§Ù„Ù…Ø®Ø§Ø·Ø± Ø§Ù„Ù…ÙƒØªØ´ÙØ©",
      upgradeContinue: "ØªØ±Ù‚ÙŠØ© Ù„Ù„Ù…ØªØ§Ø¨Ø¹Ø©",
      runningLow: "Ø§Ù„Ø±ØµÙŠØ¯ ÙŠÙ†ÙØ¯ØŸ",
      seePlans: "Ø§Ø·Ù‘Ù„Ø¹ Ø¹Ù„Ù‰ Ø§Ù„Ø®Ø·Ø·",
      trialBadge: "ØªØ¬Ø±Ø¨Ø© Ù…Ø¬Ø§Ù†ÙŠØ© Ù„Ù…Ø¯Ø© 14 ÙŠÙˆÙ…Ù‹Ø§",
      trialEndsIn: "ØªÙ†ØªÙ‡ÙŠ ØªØ¬Ø±Ø¨ØªÙƒ Ø®Ù„Ø§Ù„ {days} Ø£ÙŠØ§Ù…",
      trialEndsInOne: "ØªÙ†ØªÙ‡ÙŠ ØªØ¬Ø±Ø¨ØªÙƒ Ø®Ù„Ø§Ù„ ÙŠÙˆÙ… ÙˆØ§Ø­Ø¯",
      trialEndingToday: "ØªÙ†ØªÙ‡ÙŠ ØªØ¬Ø±Ø¨ØªÙƒ Ø§Ù„ÙŠÙˆÙ…",
      trialEndsOn: "ØªÙ†ØªÙ‡ÙŠ ÙÙŠ {date}",
      noChargeToday: "Ù„Ø§ Ø±Ø³ÙˆÙ… Ø§Ù„ÙŠÙˆÙ….",
      paymentMethodRequired: "ÙŠÙ„Ø²Ù… ÙˆØ³ÙŠÙ„Ø© Ø¯ÙØ¹",
      trialAutoConvert:
        "ÙŠØ¨Ø¯Ø£ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ Ø§Ù„Ù…Ø­Ø¯Ø¯ ØªÙ„Ù‚Ø§Ø¦ÙŠÙ‹Ø§ Ø¨Ø¹Ø¯ Ø§Ù†ØªÙ‡Ø§Ø¡ Ø§Ù„ØªØ¬Ø±Ø¨Ø© Ù…Ø§ Ù„Ù… ØªÙÙ„ØºÙ Ù‚Ø¨Ù„ Ø§Ù†ØªÙ‡Ø§Ø¦Ù‡Ø§.",
      cancelTrial: "Ø¥Ù„ØºØ§Ø¡ Ø§Ù„ØªØ¬Ø±Ø¨Ø©",
      cancelTrialTitle: "Ø¥Ù„ØºØ§Ø¡ Ø§Ù„ØªØ¬Ø±Ø¨Ø©ØŸ",
      cancelTrialExplainConvert: "Ù„Ù† ØªØªØ­ÙˆÙ„ Ø§Ù„ØªØ¬Ø±Ø¨Ø© Ø¥Ù„Ù‰ Ø§Ø´ØªØ±Ø§Ùƒ Ù…Ø¯ÙÙˆØ¹.",
      cancelTrialExplainAccess: "Ø¨Ø¹Ø¯ Ø§Ù†ØªÙ‡Ø§Ø¡ Ø§Ù„ØªØ¬Ø±Ø¨Ø© ÙŠØªØ¨Ø¹ Ø§Ù„ÙˆØµÙˆÙ„ Ù‚ÙˆØ§Ø¹Ø¯ Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ù…Ø¬Ø§Ù†ÙŠØ©.",
      cancelTrialExplainData: "Ø³ØªÙØ­ÙØ¸ Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø´Ø±ÙƒØ©.",
      cancelPaidTitle: "Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø§Ø´ØªØ±Ø§ÙƒØŸ",
      cancelPaidExplainDate: "ÙŠØ³Ø±ÙŠ Ø§Ù„Ø¥Ù„ØºØ§Ø¡ ÙÙŠ {date}.",
      cancelPaidExplainAccess: "ØªØ­ØªÙØ¸ Ø¨Ø§Ù„ÙˆØµÙˆÙ„ Ø­ØªÙ‰ Ø°Ù„Ùƒ Ø§Ù„ØªØ§Ø±ÙŠØ®.",
      cancelPaidExplainAfter:
        "Ø¨Ø¹Ø¯ Ø°Ù„Ùƒ ØªÙ†ØªÙ‚Ù„ Ø§Ù„Ù…Ø³Ø§Ø­Ø© Ø¥Ù„Ù‰ Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ù…Ø¬Ø§Ù†ÙŠØ©. Ù„Ø§ ØªÙØ­Ø°Ù Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø£Ùˆ Ø§Ù„Ø·Ù„Ø¨Ø§Øª Ø£Ùˆ Ø§Ù„Ø£Ø¯Ù„Ø© Ø£Ùˆ Ø§Ù„Ø³Ø¬Ù„.",
      confirmCancel: "ØªØ£ÙƒÙŠØ¯ Ø§Ù„Ø¥Ù„ØºØ§Ø¡",
      keepPlan: "Ø§Ù„Ø¥Ø¨Ù‚Ø§Ø¡ Ø¹Ù„Ù‰ Ø§Ù„Ø®Ø·Ø©",
      cancellationDate: "ØªØ§Ø±ÙŠØ® Ø§Ù„Ø¥Ù„ØºØ§Ø¡",
      accessUntil: "ÙŠØ¨Ù‚Ù‰ Ø§Ù„ÙˆØµÙˆÙ„ Ù…ØªØ§Ø­Ù‹Ø§ Ø­ØªÙ‰ {date}.",
      freeWorkspace: "Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ù…Ø¬Ø§Ù†ÙŠØ©",
      freeWorkspaceBody:
        "Ù…Ø³Ø§Ø­Ø© Ù…Ø­Ø¯ÙˆØ¯Ø©. ØªØ´Ù…Ù„ Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØ§Ù…ØªØ«Ø§Ù„ Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ù…Ø­Ø¯ÙˆØ¯. Ù„Ø§ ØªØ´Ù…Ù„ Ø§Ù„Ù‚Ø¯Ø±Ø§Øª Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø©.",
      freeCapabilityProfile: "Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ©",
      freeCapabilityCompliance: "Ø§Ù…ØªØ«Ø§Ù„ Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª (Ù…Ø­Ø¯ÙˆØ¯)",
      nextBillingDate: "ØªØ§Ø±ÙŠØ® Ø§Ù„ÙÙˆØªØ±Ø© Ø§Ù„ØªØ§Ù„ÙŠ",
      usage: "Ø§Ù„Ø§Ø³ØªØ®Ø¯Ø§Ù…",
      paymentFailed: "ÙØ´Ù„ Ø§Ù„Ø¯ÙØ¹",
      pastDue: "Ù…ØªØ£Ø®Ø±",
      statusTrialing: "Ù‚ÙŠØ¯ Ø§Ù„ØªØ¬Ø±Ø¨Ø©",
      statusActive: "Ù†Ø´Ø·",
      statusCanceled: "Ù…Ù„ØºÙ‰",
      statusUnpaid: "ØºÙŠØ± Ù…Ø¯ÙÙˆØ¹",
      statusExpired: "Ù…Ù†ØªÙ‡Ù",
      statusIncomplete: "ØºÙŠØ± Ù…ÙƒØªÙ…Ù„",
      monthlyInterval: "Ø´Ù‡Ø±ÙŠ",
      yearlyInterval: "Ø³Ù†ÙˆÙŠ",
      seatsUsage: "Ø§Ù„Ù…Ù‚Ø§Ø¹Ø¯",
      aiUsage: "Ø§Ø³ØªØ®Ø¯Ø§Ù… Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ",
      analysesUsage: "Ø§Ù„ØªØ­Ù„ÙŠÙ„Ø§Øª",
      analysesNotIncluded: "ØºÙŠØ± Ù…Ø´Ù…ÙˆÙ„",
      cancelError: "ØªØ¹Ø°Ù‘Ø± Ø§Ù„Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø¢Ù†. Ø£Ø¹Ø¯ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ø£Ùˆ ØªÙˆØ§ØµÙ„ Ù…Ø¹ Ø§Ù„Ø¯Ø¹Ù….",
      started: "ØªØ§Ø±ÙŠØ® Ø§Ù„Ø¨Ø¯Ø¡",
      paypalMethod: "PayPal",
      graceTitle: "Ù…Ø´ÙƒÙ„Ø© ÙÙŠ Ø§Ù„Ø¯ÙØ¹ â€” ÙØªØ±Ø© Ø³Ù…Ø§Ø­",
      graceBody: "ÙØ´Ù„ Ø§Ù„Ø¯ÙØ¹. ÙŠØ³ØªÙ…Ø± Ø§Ù„ÙˆØµÙˆÙ„ Ø­ØªÙ‰ {date}. Ø­Ø¯Ù‘Ø« Ø§Ù„ÙÙˆØªØ±Ø© Ù„ØªØ¬Ù†Ø¨ Ø§Ù„Ø§Ù†Ù‚Ø·Ø§Ø¹.",
      inactiveTitle: "Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ ØºÙŠØ± Ù†Ø´Ø·",
      inactiveBody:
        "Ø§Ø´ØªØ±Ø§ÙƒÙƒ ØºÙŠØ± Ù†Ø´Ø·. Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ø´Ø±ÙƒØ© Ù…Ø­ÙÙˆØ¸Ø©. Ø¬Ø¯Ù‘Ø¯ Ø£Ùˆ Ø±Ù‚Ù‘Ù Ø§Ù„Ø®Ø·Ø© Ù„Ø§Ø³ØªØ¹Ø§Ø¯Ø© Ø§Ù„Ù‚Ø¯Ø±Ø§Øª Ø§Ù„Ù…Ø¯ÙÙˆØ¹Ø©.",
      billingHistory: "Ø³Ø¬Ù„ Ø§Ù„ÙÙˆØªØ±Ø©",
      billingHistoryEmpty: "Ù„Ø§ ÙÙˆØ§ØªÙŠØ± Ø¨Ø¹Ø¯. ØªØ¸Ù‡Ø± Ø§Ù„ÙÙˆØ§ØªÙŠØ± Ù‡Ù†Ø§ Ø¨Ø¹Ø¯ Ø¹Ù…Ù„ÙŠØ© ØªØ­ØµÙŠÙ„ Ù†Ø§Ø¬Ø­Ø© Ø£Ùˆ ÙØ§Ø´Ù„Ø©.",
      invoiceDate: "Ø§Ù„ØªØ§Ø±ÙŠØ®",
      invoiceAmount: "Ø§Ù„Ù…Ø¨Ù„Øº",
      invoiceStatus: "Ø§Ù„Ø­Ø§Ù„Ø©",
      viewReceipt: "Ø¹Ø±Ø¶ Ø§Ù„Ø¥ÙŠØµØ§Ù„",
      updatePaymentMethod: "ØªØ­Ø¯ÙŠØ« ÙˆØ³ÙŠÙ„Ø© Ø§Ù„Ø¯ÙØ¹",
      retryPayment: "Ù…Ø¹Ø§Ù„Ø¬Ø© Ø§Ù„Ø¯ÙØ¹",
      paymentProblemTitle: "Ù…Ø´ÙƒÙ„Ø© ÙÙŠ Ø§Ù„Ø¯ÙØ¹",
      paymentProblemBody:
        "ØªØ¹Ø°Ù‘Ø± ØªØ­ØµÙŠÙ„ Ø±Ø³ÙˆÙ… Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ. Ø­Ø¯Ù‘Ø« ÙˆØ³ÙŠÙ„Ø© Ø§Ù„Ø¯ÙØ¹ Ù„Ù„Ø­ÙØ§Ø¸ Ø¹Ù„Ù‰ Ø§Ù„ÙˆØµÙˆÙ„.",
      paypalManageHint: "ÙŠØ¯ÙŠØ± PayPal ÙˆØ³ÙŠÙ„Ø© Ø§Ù„Ø¯ÙØ¹ Ù„Ù‡Ø°Ø§ Ø§Ù„Ø§Ø´ØªØ±Ø§Ùƒ Ù…Ù† Ø­Ø³Ø§Ø¨Ùƒ ÙÙŠ PayPal.",
      paymentPortalError: "ØªØ¹Ø°Ù‘Ø± ÙØªØ­ ØµÙØ­Ø© Ø§Ù„Ø¯ÙØ¹ Ø§Ù„Ø¢Ù…Ù†Ø©. Ø£Ø¹Ø¯ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ø£Ùˆ ØªÙˆØ§ØµÙ„ Ù…Ø¹ Ø§Ù„Ø¯Ø¹Ù….",
      canceledAlertTitle: "ØªÙ… Ø¥Ù„ØºØ§Ø¡ Ø§Ø´ØªØ±Ø§ÙƒÙƒ",
      subscriptionEndedTitle: "Ø§Ù†ØªÙ‡Ù‰ Ø§Ø´ØªØ±Ø§ÙƒÙƒ",
      subscriptionEndedBody:
        "Ù…Ø³Ø§Ø­Ø© Ø¹Ù…Ù„Ùƒ Ø¢Ù…Ù†Ø©ØŒ Ù„ÙƒÙ† Ø¨Ø¹Ø¶ Ø§Ù„Ù…ÙŠØ²Ø§Øª Ø§Ù„Ù…Ù…ÙŠØ²Ø© Ø£ØµØ¨Ø­Øª Ù…Ù‚ÙÙ„Ø© Ø§Ù„Ø¢Ù†.",
      choosePlan: "Ø§Ø®ØªØ± Ø®Ø·Ø©",
      graceDaysRemaining: "ÙŠØªØ¨Ù‚Ù‰ Ù„Ø¯ÙŠÙƒ {days} Ø£ÙŠØ§Ù… Ù„Ø­Ù„ Ù…Ø´ÙƒÙ„Ø© Ø§Ù„Ø¯ÙØ¹.",
      graceDaysRemainingOne: "ÙŠØªØ¨Ù‚Ù‰ Ù„Ø¯ÙŠÙƒ ÙŠÙˆÙ… ÙˆØ§Ø­Ø¯ Ù„Ø­Ù„ Ù…Ø´ÙƒÙ„Ø© Ø§Ù„Ø¯ÙØ¹.",
    },
    alerts: {
      title: "Ø§Ù„ØªÙ†Ø¨ÙŠÙ‡Ø§Øª",
      subtitle: "Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯ ÙˆØ°Ø§ÙƒØ±Ø© Ø§Ù„Ù‚Ø±Ø§Ø± ÙˆØ§Ù„Ø¯Ø±Ø¬Ø§Øª ÙˆØ§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª ÙˆØ³ÙŠØ± Ø§Ù„Ø¹Ù…Ù„.",
      emptyTitle: "Ù„Ø§ ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø¨Ø¹Ø¯",
      emptyDescription: "Ø³ØªØ¸Ù‡Ø± Ù‡Ù†Ø§ Ø¥Ø´Ø¹Ø§Ø±Ø§Øª Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯ ÙˆØ§Ù„Ù…Ø®Ø§Ø·Ø± ÙˆØ§Ù„ØªØ­Ù„ÙŠÙ„.",
      newBadge: "Ø¬Ø¯ÙŠØ¯",
      markAllRead: "ØªØ¹Ù„ÙŠÙ… Ø§Ù„ÙƒÙ„ ÙƒÙ…Ù‚Ø±ÙˆØ¡",
      unreadCount: "{count} ØºÙŠØ± Ù…Ù‚Ø±ÙˆØ¡",
    },
    settings: {
      title: "Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª",
      subtitle: "ØªÙØ¶ÙŠÙ„Ø§Øª Ø§Ù„Ø­Ø³Ø§Ø¨ ÙˆØ¥Ø¹Ø¯Ø§Ø¯Ø§Øª Ù…Ø³Ø§Ø­Ø© Ø§Ù„Ø¹Ù…Ù„ Ø§Ù„Ø§ÙØªØ±Ø§Ø¶ÙŠØ©.",
      accountTitle: "Ø§Ù„Ø­Ø³Ø§Ø¨",
      accountBody: "Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù… Ø§Ù„Ù…Ø³Ø¬Ù‘Ù„",
      name: "Ø§Ù„Ø§Ø³Ù…",
      email: "Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ",
      avatarLabel: "ØµÙˆØ±Ø© Ø§Ù„Ù…Ù„Ù Ø§Ù„Ø´Ø®ØµÙŠ",
      avatarHint: "ØªØ¸Ù‡Ø± ÙÙŠ Ø§Ù„Ø´Ø±ÙŠØ· Ø§Ù„Ø¹Ù„ÙˆÙŠ. JPG Ø£Ùˆ PNG Ø£Ùˆ WebP Ø£Ùˆ GIF Â· Ø¨Ø­Ø¯ Ø£Ù‚ØµÙ‰ 5 Ù…ÙŠØºØ§Ø¨Ø§ÙŠØª.",
      avatarUpload: "Ø±ÙØ¹ ØµÙˆØ±Ø©",
      avatarUploading: "Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø±ÙØ¹â€¦",
      avatarRemove: "Ø¥Ø²Ø§Ù„Ø©",
      accountSave: "Ø­ÙØ¸ Ø§Ù„ØªØºÙŠÙŠØ±Ø§Øª",
      accountSaving: "Ø¬Ø§Ø±ÙŠ Ø§Ù„Ø­ÙØ¸â€¦",
      accountSaved: "ØªÙ… ØªØ­Ø¯ÙŠØ« Ø§Ù„Ø­Ø³Ø§Ø¨.",
      emailChangeHint: "ØªØºÙŠÙŠØ± Ø§Ù„Ø¨Ø±ÙŠØ¯ ÙŠØªØ·Ù„Ø¨ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± ÙˆØ±Ø§Ø¨Ø· ØªØ£ÙƒÙŠØ¯ Ø¥Ù„Ù‰ Ø§Ù„Ø¹Ù†ÙˆØ§Ù† Ø§Ù„Ø¬Ø¯ÙŠØ¯.",
      emailChangePending: "ØªØ£ÙƒÙŠØ¯ Ù…Ø¹Ù„Ù‘Ù‚ Ù„Ù€ {email}.",
      emailChangeSent: "ØªØ­Ù‚Ù‚ Ù…Ù† {email} Ù„Ø±Ø§Ø¨Ø· Ø§Ù„ØªØ£ÙƒÙŠØ¯. ÙŠØ¨Ù‚Ù‰ Ø¨Ø±ÙŠØ¯Ùƒ Ø§Ù„Ø­Ø§Ù„ÙŠ Ù†Ø´Ø·Ù‹Ø§ Ø­ØªÙ‰ ØªØ¤ÙƒØ¯.",
      emailChangeResend: "Ø¥Ø¹Ø§Ø¯Ø© Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªØ£ÙƒÙŠØ¯",
      emailChangeResent: "Ø£ÙØ¹ÙŠØ¯ Ø¥Ø±Ø³Ø§Ù„ Ø§Ù„ØªØ£ÙƒÙŠØ¯ Ø¥Ù„Ù‰ {email}.",
      emailChangeExpires: "ÙŠÙ†ØªÙ‡ÙŠ {when}.",
      emailChangePasswordLabel: "ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø­Ø§Ù„ÙŠØ©",
      emailChangePasswordHint: "Ù…Ø·Ù„ÙˆØ¨Ø© Ù„Ø·Ù„Ø¨ ØªØºÙŠÙŠØ± Ø§Ù„Ø¨Ø±ÙŠØ¯.",
      emailChangePasswordRequired: "Ø£Ø¯Ø®Ù„ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ø§Ù„Ø­Ø§Ù„ÙŠØ© Ù„ØªØºÙŠÙŠØ± Ø§Ù„Ø¨Ø±ÙŠØ¯.",
      emailChangeCancel: "Ø¥Ù„ØºØ§Ø¡ ØªØºÙŠÙŠØ± Ø§Ù„Ø¨Ø±ÙŠØ¯",
      emailChangeCancelled: "ØªÙ… Ø¥Ù„ØºØ§Ø¡ ØªØºÙŠÙŠØ± Ø§Ù„Ø¨Ø±ÙŠØ¯.",
      emailChangeInvalidTitle: "Ø§Ù„Ø±Ø§Ø¨Ø· ØºÙŠØ± ØµØ§Ù„Ø­ Ø£Ùˆ Ù…Ù†ØªÙ‡Ù",
      emailChangeInvalidBody: "Ø§Ø·Ù„Ø¨ Ø±Ø§Ø¨Ø· ØªØ£ÙƒÙŠØ¯ Ø¬Ø¯ÙŠØ¯ Ù…Ù† Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª.",
      emailChangeBackSettings: "Ø§Ù„Ø¹ÙˆØ¯Ø© Ø¥Ù„Ù‰ Ø§Ù„Ø¥Ø¹Ø¯Ø§Ø¯Ø§Øª",
      companyProfileTitle: "Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ©",
      companyProfileBody:
        "Ø§Ù„Ù‚Ø·Ø§Ø¹ ÙˆØ§Ù„Ø­Ø¬Ù… ÙˆØ§Ù„Ø®Ø¯Ù…Ø§Øª ÙˆØ§Ù„Ø¨Ù„Ø¯ ÙˆØ§Ù„Ø®Ø¨Ø±Ø© Ø§Ù„Ù…Ø³ØªØ®Ø¯Ù…Ø© Ù„Ù…Ù„Ø§Ø¡Ù…Ø© Ø§Ù„Ø´Ø±ÙƒØ©â€“Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ© ÙÙŠ Ø§Ù„ØªØ­Ù„ÙŠÙ„Ø§Øª Ø§Ù„Ù‚Ø§Ø¯Ù…Ø©. Ø®Ø§Øµ Ø¨Ù…Ù†Ø¸Ù…ØªÙƒ.",
      editCompanyProfile: "ØªØ¹Ø¯ÙŠÙ„ Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ©",
      notificationsTitle: "Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª",
      notificationsBody:
        "ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø§Ù„Ù…ÙˆØ§Ø¹ÙŠØ¯ ÙˆØ§Ù„ØªØ­Ù„ÙŠÙ„ â€” Ø¯Ø§Ø®Ù„ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ ÙˆØ§Ù„Ø¨Ø±ÙŠØ¯. ÙŠÙ…ÙƒÙ† Ø±Ø¨Ø· ÙˆØ§ØªØ³Ø§Ø¨ / SMS / Ø§Ù„Ø¯ÙØ¹ Ù„Ø§Ø­Ù‚Ù‹Ø§.",
      moduleRemindersTitle: "Ø¬Ø¯Ø§ÙˆÙ„ ØªØ°ÙƒÙŠØ± Ø§Ù„ÙˆØ­Ø¯Ø§Øª",
      moduleRemindersBody: "Ø§Ù…ØªØ«Ø§Ù„ Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª ÙˆØªÙ‚ÙˆÙŠÙ… Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª Ù„Ù‡Ù…Ø§ Ø¥Ø²Ø§Ø­Ø§Øª ØªØ°ÙƒÙŠØ± Ø®Ø§ØµØ©.",
      complianceRemindersLink: "ØªØ°ÙƒÙŠØ±Ø§Øª Ø§Ù…ØªØ«Ø§Ù„ Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª",
      calendarRemindersLink: "ØªØ°ÙƒÙŠØ±Ø§Øª ØªÙ‚ÙˆÙŠÙ… Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª",
      planTitle: "Ø§Ù„Ø®Ø·Ø©",
      planUnlimited: "Business Â· ØºÙŠØ± Ù…Ø­Ø¯ÙˆØ¯ Â· {used} Ù…Ø³ØªØ®Ø¯Ù…",
      planLimited: "{used}/{limit} ØªØ­Ù„ÙŠÙ„Ø§Øª Ù…Ø³ØªØ®Ø¯Ù…Ø©",
      manageBilling: "Ø¥Ø¯Ø§Ø±Ø© Ø§Ù„ÙÙˆØªØ±Ø©",
      viewUpgrade: "Ø¹Ø±Ø¶ Ø®ÙŠØ§Ø±Ø§Øª Ø§Ù„ØªØ±Ù‚ÙŠØ©",
      signOut: "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬",
      revokeOtherSessions: "ØªØ³Ø¬ÙŠÙ„ Ø§Ù„Ø®Ø±ÙˆØ¬ Ù…Ù† Ø§Ù„Ø£Ø¬Ù‡Ø²Ø© Ø§Ù„Ø£Ø®Ø±Ù‰",
      revokeOtherSessionsHint: "ØªØ¨Ù‚Ù‰ Ù‡Ø°Ù‡ Ø§Ù„Ø¬Ù„Ø³Ø© Ù†Ø´Ø·Ø©.",
      timezone: "Ø§Ù„Ù…Ù†Ø·Ù‚Ø© Ø§Ù„Ø²Ù…Ù†ÙŠØ© Ù„Ù„Ø´Ø±ÙƒØ©",
      timezoneHint: "ØªÙØ³ØªØ®Ø¯Ù… Ù„Ù†Øµ ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø§Ù„Ù…ÙˆØ¹Ø¯ ÙˆØ¹Ø±Ø¶ Ø§Ù„Ø³Ø§Ø¹Ø© Ø§Ù„Ù…Ø­Ù„ÙŠØ©.",
      channels: "Ø§Ù„Ù‚Ù†ÙˆØ§Øª",
      channelInApp: "ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø¯Ø§Ø®Ù„ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚",
      channelEmail: "Ø§Ù„Ø¨Ø±ÙŠØ¯ Ø§Ù„Ø¥Ù„ÙƒØªØ±ÙˆÙ†ÙŠ",
      channelWhatsapp: "ÙˆØ§ØªØ³Ø§Ø¨ (Ù‚Ø±ÙŠØ¨Ù‹Ø§)",
      channelSms: "SMS (Ù‚Ø±ÙŠØ¨Ù‹Ø§)",
      channelPush: "Ø¯ÙØ¹ (Ù‚Ø±ÙŠØ¨Ù‹Ø§)",
      deadlineAlerts: "ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø§Ù„Ù…ÙˆØ¹Ø¯ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ",
      deadline7d: "Ù‚Ø¨Ù„ 7 Ø£ÙŠØ§Ù…",
      deadline3d: "Ù‚Ø¨Ù„ 3 Ø£ÙŠØ§Ù…",
      deadline24h: "Ù‚Ø¨Ù„ 24 Ø³Ø§Ø¹Ø©",
      deadlinePassed: "Ø§Ù†ØªÙ‡Ù‰ Ø§Ù„Ù…ÙˆØ¹Ø¯",
      otherAlerts: "ØªÙ†Ø¨ÙŠÙ‡Ø§Øª Ø£Ø®Ø±Ù‰",
      alertAnalysisDone: "Ø§ÙƒØªÙ…Ù„ Ø§Ù„ØªØ­Ù„ÙŠÙ„",
      alertHighRisk: "Ù†ØªØ§Ø¦Ø¬ Ø¹Ø§Ù„ÙŠØ© Ø§Ù„Ù…Ø®Ø§Ø·Ø±",
      alertMissingDocs: "Ù…Ø³ØªÙ†Ø¯Ø§Øª Ù†Ø§Ù‚ØµØ©",
      alertScoreChange: "ØªØºÙŠÙ‘Ø± Ø§Ù„Ø¯Ø±Ø¬Ø© Ø£Ùˆ Ø§Ù„Ù‚Ø±Ø§Ø±",
      alertRequirementStatus: "ØªØºÙŠÙ‘Ø± Ø­Ø§Ù„Ø© Ø§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª",
      alertDecisionMemory: "Ø°Ø§ÙƒØ±Ø© Ù‚Ø±Ø§Ø± Ø°Ø§Øª ØµÙ„Ø©",
      alertWorkflow: "Ø£Ø­Ø¯Ø§Ø« Ø³ÙŠØ± Ø§Ù„Ø¹Ù…Ù„ / Ø§Ù„Ø­Ø²Ù…Ø©",
      prefsSaved: "ØªÙ… Ø­ÙØ¸ Ø§Ù„ØªÙØ¶ÙŠÙ„Ø§Øª.",
      savePrefs: "Ø­ÙØ¸ ØªÙØ¶ÙŠÙ„Ø§Øª Ø§Ù„Ø¥Ø´Ø¹Ø§Ø±Ø§Øª",
    },
    tenders: {
      title: "Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª",
      subtitle: "{count} Ù…Ù†Ø§Ù‚ØµØ§Øª Â· ØªØµÙÙŠØ© Ø­Ø³Ø¨ Ø§Ù„Ù‚Ø±Ø§Ø± ÙˆØ§Ù„Ù…Ø®Ø§Ø·Ø± ÙˆØ§Ù„Ù…ÙˆØ¹Ø¯",
      subtitleOne: "Ù…Ù†Ø§Ù‚ØµØ© ÙˆØ§Ø­Ø¯Ø© Â· ØªØµÙÙŠØ© Ø­Ø³Ø¨ Ø§Ù„Ù‚Ø±Ø§Ø± ÙˆØ§Ù„Ù…Ø®Ø§Ø·Ø± ÙˆØ§Ù„Ù…ÙˆØ¹Ø¯",
      analyzeCta: "ØªØ­Ù„ÙŠÙ„ Ù…Ù†Ø§Ù‚ØµØ©",
      emptyTitle: "Ù„Ø§ Ù…Ù†Ø§Ù‚ØµØ§Øª Ø¨Ø¹Ø¯",
      emptyDescription:
        "Ø§Ø±ÙØ¹ ITT Ø£Ùˆ PQQ Ù„Ù„Ø­ØµÙˆÙ„ Ø¹Ù„Ù‰ ØªÙˆØµÙŠØ© Ù…ØªÙˆØ§ÙÙ‚ / ÙŠØ­ØªØ§Ø¬ ØªØ­Ù‚Ù‚ / ØºÙŠØ± Ù…ØªÙˆØ§ÙÙ‚.",
      search: "Ø¨Ø­Ø«",
      searchPlaceholder: "Ø§Ù„Ø¹Ù†ÙˆØ§Ù† Ø£Ùˆ Ø§Ù„Ø¹Ù…ÙŠÙ„",
      decision: "Ø§Ù„Ù‚Ø±Ø§Ø±",
      allDecisions: "ÙƒÙ„ Ø§Ù„Ù‚Ø±Ø§Ø±Ø§Øª",
      bid: "Ù…ØªÙˆØ§ÙÙ‚",
      review: "ÙŠØ­ØªØ§Ø¬ ØªØ­Ù‚Ù‚",
      noBid: "ØºÙŠØ± Ù…ØªÙˆØ§ÙÙ‚",
      risk: "Ø§Ù„Ù…Ø®Ø§Ø·Ø±",
      allRiskLevels: "ÙƒÙ„ Ù…Ø³ØªÙˆÙŠØ§Øª Ø§Ù„Ù…Ø®Ø§Ø·Ø±",
      low: "Ù…Ù†Ø®ÙØ¶",
      medium: "Ù…ØªÙˆØ³Ø·",
      high: "Ù…Ø±ØªÙØ¹",
      critical: "Ø­Ø±Ø¬",
      deadline: "Ø§Ù„Ù…ÙˆØ¹Ø¯ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ",
      anyDeadline: "Ø£ÙŠ Ù…ÙˆØ¹Ø¯",
      next7d: "Ø®Ù„Ø§Ù„ 7 Ø£ÙŠØ§Ù…",
      next14d: "Ø®Ù„Ø§Ù„ 14 ÙŠÙˆÙ…Ù‹Ø§",
      next30d: "Ø®Ù„Ø§Ù„ 30 ÙŠÙˆÙ…Ù‹Ø§",
      overdue: "Ù…ØªØ£Ø®Ø±Ø©",
      sort: "ØªØ±ØªÙŠØ¨",
      sortRecent: "Ø§Ù„Ø£Ø­Ø¯Ø« ØªØ­Ù„ÙŠÙ„Ù‹Ø§",
      sortDeadlineSoon: "Ø£Ù‚Ø±Ø¨ Ù…ÙˆØ¹Ø¯",
      sortDeadlineLate: "Ø£Ø¨Ø¹Ø¯ Ù…ÙˆØ¹Ø¯",
      sortFit: "Ø¯Ø±Ø¬Ø© Ø§Ù„Ù…Ù„Ø§Ø¡Ù…Ø©",
      sortTitle: "Ø§Ù„Ø¹Ù†ÙˆØ§Ù† Ø£â€“ÙŠ",
      colTender: "Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ©",
      colClient: "Ø§Ù„Ø¹Ù…ÙŠÙ„",
      colDeadline: "Ø§Ù„Ù…ÙˆØ¹Ø¯",
      colFit: "Ø§Ù„Ù…Ù„Ø§Ø¡Ù…Ø©",
      colDecision: "Ø§Ù„Ù‚Ø±Ø§Ø±",
      colRisk: "Ø§Ù„Ù…Ø®Ø§Ø·Ø±",
      colAnalyzed: "ØªØ§Ø±ÙŠØ® Ø§Ù„ØªØ­Ù„ÙŠÙ„",
      colNextAction: "Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡ Ø§Ù„ØªØ§Ù„ÙŠ",
      deadlineWithDate: "Ø§Ù„Ù…ÙˆØ¹Ø¯ {date}",
      fitWithScore: "Ø§Ù„Ù…Ù„Ø§Ø¡Ù…Ø© {score}",
      noNextAction: "Ù„Ø§ Ø¥Ø¬Ø±Ø§Ø¡ ØªØ§Ù„Ù",
    },
    upload: {
      title: "ØªØ­Ù„ÙŠÙ„ Ù…Ù†Ø§Ù‚ØµØ©",
      subtitle:
        "Ø§Ø±ÙØ¹ ITT Ø£Ùˆ PQQ Ù„Ù„Ø­ØµÙˆÙ„ Ø¹Ù„Ù‰ ØªÙˆØµÙŠØ© Ù…ØªÙˆØ§ÙÙ‚ / ÙŠØ­ØªØ§Ø¬ ØªØ­Ù‚Ù‚ / ØºÙŠØ± Ù…ØªÙˆØ§ÙÙ‚.",
      trialLeft: "ØªØ¬Ø±Ø¨Ø© Â· Ù…ØªØ¨Ù‚Ù {remaining} ØªØ­Ù„ÙŠÙ„Ø§Øª",
      trialEnds: " Â· ØªÙ†ØªÙ‡ÙŠ {date}",
      phaseIdleTitle: "Ø§Ø±ÙØ¹ Ø­Ø²Ù…Ø© Ù…Ù†Ø§Ù‚ØµØ©",
      phaseIdleBody:
        "Ø§Ø±ÙØ¹ Ø¹Ø¯Ø© Ù…Ù„ÙØ§Øª Ø£Ùˆ Ø­Ø²Ù…Ø© ZIP/RAR. Ù†Ø±ÙƒÙ‘Ø² Ø¹Ù„Ù‰ Ù‚Ø±Ø§Ø± Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ© â€” ÙˆÙ„ÙŠØ³ ØªÙØ±ÙŠØºÙ‹Ø§ Ø®Ø§Ù…Ù‹Ø§ Ù„Ù„Ù…Ø³ØªÙ†Ø¯.",
      phaseUploadingTitle: "Ø¬Ø§Ø±Ù Ø§Ù„Ø±ÙØ¹â€¦",
      phaseUploadingBody: "Ù†Ù‚Ù„ Ø¢Ù…Ù† Ù„Ù…Ù„ÙØ§ØªÙƒ.",
      phaseDiscoveringTitle: "Ø¬Ø§Ø±Ù Ø§ÙƒØªØ´Ø§Ù Ø§Ù„Ù…Ù„ÙØ§Øªâ€¦",
      phaseDiscoveringBody: "Ø¬Ø±Ø¯ ÙƒÙ„ Ù…Ø³ØªÙ†Ø¯ ÙÙŠ Ø­Ø²Ù…Ø© Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ©.",
      phaseExtractingTitle: "Ø¬Ø§Ø±Ù Ø§Ø³ØªØ®Ø±Ø§Ø¬ Ø§Ù„Ø­Ø²Ù…Ø©â€¦",
      phaseExtractingBody: "ÙÙƒ Ø¶ØºØ· ZIP/RAR ÙˆØ§ÙƒØªØ´Ø§Ù Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ©.",
      phasePreparingTitle: "Ø¬Ø§Ø±Ù ØªØ¬Ù‡ÙŠØ² Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øªâ€¦",
      phasePreparingBody: "Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø§Ù„Ù…Ù„ÙØ§Øª ÙˆØªØ¬Ù‡ÙŠØ² Ø§Ù„Ø­Ø²Ù…Ø© Ù„Ù„ØªØ­Ù„ÙŠÙ„.",
      phaseProcessingTitle: "Ø¬Ø§Ø±Ù Ù…Ø¹Ø§Ù„Ø¬Ø© Ø§Ù„Ù…Ø³ØªÙ†Ø¯â€¦",
      phaseProcessingBody: "ÙÙŠ Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ø§Ù†ØªØ¸Ø§Ø± Ù„Ù„Ø§Ø³ØªØ®Ø±Ø§Ø¬ ÙˆÙ‡ÙŠÙƒÙ„Ø© Ø§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª.",
      phaseAnalyzingTitle: "Ø¬Ø§Ø±Ù ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ù…Ù„Ø§Ø¡Ù…Ø©â€¦",
      phaseAnalyzingBody:
        "Ù…Ø·Ø§Ø¨Ù‚Ø© Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ© ÙˆØªØ´ØºÙŠÙ„ Ø§Ù„Ù‚ÙˆØ§Ø¹Ø¯ ÙˆØ¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ù‚Ø±Ø§Ø±.",
      phaseSuccessTitle: "Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ø¬Ø§Ù‡Ø²",
      phaseSuccessBody: "Ø­Ø²Ù…Ø© Ø§Ù„Ù‚Ø±Ø§Ø± Ù…ØªØ§Ø­Ø©.",
      phaseErrorTitle: "ÙØ´Ù„ Ø§Ù„Ø±ÙØ¹",
      phaseErrorBody: "Ø­Ø¯Ø« Ø®Ø·Ø£ Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„Ø±ÙØ¹ Ø£Ùˆ ØªØ¬Ù‡ÙŠØ² Ø§Ù„Ø­Ø²Ù…Ø©. ØªØ­Ù‚Ù‚ Ù…Ù† Ø§Ù„Ù…Ù„ÙØ§Øª ÙˆØ­Ø§ÙˆÙ„ Ù…Ø¬Ø¯Ø¯Ù‹Ø§.",
      phaseAnalysisErrorTitle: "ØªØ¹Ø°Ù‘Ø± Ø¥ÙƒÙ…Ø§Ù„ Ø§Ù„ØªØ­Ù„ÙŠÙ„",
      phaseAnalysisErrorBody:
        "ØªÙ… Ø±ÙØ¹ Ø§Ù„Ø­Ø²Ù…Ø© ÙˆØªØ¬Ù‡ÙŠØ²Ù‡Ø§ Ø¨Ù†Ø¬Ø§Ø­. Ø­Ø¯Ø« Ø§Ù„ÙØ´Ù„ Ø£Ø«Ù†Ø§Ø¡ Ø§Ù„ØªØ­Ù„ÙŠÙ„ â€” Ø§ÙØªØ­ Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ© Ù„Ù„ØªÙØ§ØµÙŠÙ„.",
      phaseTimeoutBody:
        "Ø§Ù„Ù…Ù„ÙØ§Øª Ø§Ù„ÙƒØ¨ÙŠØ±Ø© Ù‚Ø¯ ØªØ³ØªØºØ±Ù‚ Ø¹Ø¯Ø© Ø¯Ù‚Ø§Ø¦Ù‚. Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ù…Ø§ Ø²Ø§Ù„ ÙŠØ¹Ù…Ù„ ÙÙŠ Ø§Ù„Ø®Ù„ÙÙŠØ© â€” Ø§ÙØªØ­ Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ© Ø¹Ù†Ø¯ Ø§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ©.",
      phaseTimeoutTitle: "Ù…Ø§ Ø²Ø§Ù„ Ù‚ÙŠØ¯ Ø§Ù„Ù…Ø¹Ø§Ù„Ø¬Ø©",
      stillWorking: "ÙŠØ³ØªÙ…Ø± Ø§Ù„ØªØ­Ù„ÙŠÙ„ ÙÙŠ Ø§Ù„Ø®Ù„ÙÙŠØ©",
      openTender: "ÙØªØ­ Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ©",
      trialUsedTitle: "Ø§Ø³ØªÙÙ†ÙØ¯Øª ØªØ­Ù„ÙŠÙ„Ø§Øª Ø§Ù„ØªØ¬Ø±Ø¨Ø©",
      trialUsedBody: "Ù‚Ù… Ø¨Ø§Ù„ØªØ±Ù‚ÙŠØ© Ù„ØªØ­Ù„ÙŠÙ„ Ù…Ø²ÙŠØ¯ Ù…Ù† Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª.",
      viewPlans: "Ø¹Ø±Ø¶ Ø§Ù„Ø®Ø·Ø·",
      unlimitedPlan: "ØªØ­Ù„ÙŠÙ„Ø§Øª ØºÙŠØ± Ù…Ø­Ø¯ÙˆØ¯Ø© Ø¹Ù„Ù‰ Ø®Ø·Ø© Business Ø§Ù„Ù†Ø´Ø·Ø©",
      remainingAnalyses: "{count} ØªØ­Ù„ÙŠÙ„Ø§Øª Ù…Ø¬Ø§Ù†ÙŠØ© Ù…ØªØ¨Ù‚ÙŠØ©",
      dragHere: "Ø§Ø³Ø­Ø¨ Ù…Ù„ÙØ§Øª Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ© Ø£Ùˆ Ø­Ø²Ù… ZIP/RAR ÙˆØ£ÙÙ„ØªÙ‡Ø§ Ù‡Ù†Ø§",
      processingTender: "Ø¬Ø§Ø±Ù Ù…Ø¹Ø§Ù„Ø¬Ø© Ø­Ø²Ù…Ø© Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ©â€¦",
      fileTypes: "PDF ÙˆWord ÙˆExcel ÙˆPowerPoint ÙˆCSV ÙˆTXT ÙˆØ§Ù„ØµÙˆØ± ÙˆZIP/RAR Â· Ø­ØªÙ‰ {max} Ù…Ù„ÙÙ‹Ø§ Ù„ÙƒÙ„ Ø­Ø²Ù…Ø© Â· Ø¨Ø­Ø¯ Ø£Ù‚ØµÙ‰ {maxFileMb}MB Ù„ÙƒÙ„ Ù…Ù„Ù Â· Ùˆ{maxPackageMb}MB Ù„ÙƒÙ„ Ø­Ø²Ù…Ø©",
      chooseFile: "Ø§Ø®ØªØ± Ù…Ù„ÙØ§Øª",
      filesSelected: "{count} Ù…Ù„ÙØ§Øª Ù…Ø­Ø¯Ø¯Ø©",
      maxFilesReached: "Ø­ØªÙ‰ {max} Ù…Ù„ÙÙ‹Ø§ Ù„ÙƒÙ„ Ø­Ø²Ù…Ø©.",
      filesDiscovered: "ØªÙ… Ø§ÙƒØªØ´Ø§Ù {count} Ù…Ù„ÙØ§Øª ÙÙŠ Ø§Ù„Ø­Ø²Ù…Ø©",
      removeFile: "Ø¥Ø²Ø§Ù„Ø©",
      statusReady: "Ø¬Ø§Ù‡Ø²",
      statusUploading: "Ø¬Ø§Ø±Ù Ø§Ù„Ø±ÙØ¹â€¦",
      statusDiscovering: "Ø¬Ø§Ø±Ù Ø§Ù„Ø§ÙƒØªØ´Ø§Ùâ€¦",
      statusExtracting: "Ø¬Ø§Ø±Ù Ø§Ù„Ø§Ø³ØªØ®Ø±Ø§Ø¬â€¦",
      statusPreparing: "Ø¬Ø§Ø±Ù Ø§Ù„ØªØ¬Ù‡ÙŠØ²â€¦",
      statusProcessing: "Ø¬Ø§Ø±Ù Ø§Ù„Ù…Ø¹Ø§Ù„Ø¬Ø©â€¦",
      statusAnalyzing: "Ø¬Ø§Ø±Ù Ø§Ù„ØªØ­Ù„ÙŠÙ„â€¦",
      startUpload: "Ø±ÙØ¹ ÙˆØ¨Ø¯Ø¡ Ø§Ù„ØªØ­Ù„ÙŠÙ„",
      waitForUpload: "Ø§Ù†ØªØ¸Ø± Ø§Ù†ØªÙ‡Ø§Ø¡ Ø§Ù„Ø±ÙØ¹ Ø§Ù„Ø­Ø§Ù„ÙŠ Ù‚Ø¨Ù„ Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ù…Ø²ÙŠØ¯ Ù…Ù† Ø§Ù„Ù…Ù„ÙØ§Øª.",
      bodyTooLarge:
        "Ø­Ø²Ù…Ø© Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ© Ø£ÙƒØ¨Ø± Ù…Ù† Ø­Ø¯ Ø§Ù„Ø·Ù„Ø¨. Ù‚Ù„Ù‘Ù„ Ø¹Ø¯Ø¯ Ø§Ù„Ù…Ù„ÙØ§ØªØŒ Ø£Ùˆ Ø£Ø¹Ø¯ ØªØ´ØºÙŠÙ„ Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ Ø¨Ø¹Ø¯ Ø±ÙØ¹ Ø­Ø¯ Ø§Ù„Ø­Ø¬Ù… Ø«Ù… Ø§Ø±ÙØ¹ Ù…Ø¬Ø¯Ø¯Ù‹Ø§.",
      decisionReady: "Ø§Ù„Ù‚Ø±Ø§Ø± Ø¬Ø§Ù‡Ø² â€” Ø§ÙØªØ­ Ø§Ù„Ø­Ø²Ù…Ø© Ø£Ø¯Ù†Ø§Ù‡.",
      unableContinue: "ØªØ¹Ø°Ù‘Ø± Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©",
      openDecision: "ÙØªØ­ Ø§Ù„Ù‚Ø±Ø§Ø±",
      uploadAnother: "Ø±ÙØ¹ Ù…Ù„Ù Ø¢Ø®Ø±",
      tryAgain: "Ø­Ø§ÙˆÙ„ Ù…Ø¬Ø¯Ø¯Ù‹Ø§",
      creditsExhausted: "Ø§Ø³ØªØ®Ø¯Ù…Øª ÙƒÙ„ Ø§Ù„ØªØ­Ù„ÙŠÙ„Ø§Øª Ø§Ù„Ù…Ø¬Ø§Ù†ÙŠØ©. Ù‚Ù… Ø¨Ø§Ù„ØªØ±Ù‚ÙŠØ© Ù„Ù„Ù…ØªØ§Ø¨Ø¹Ø©.",
      passwordRequiredTitle: "ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ù…Ø·Ù„ÙˆØ¨Ø©",
      passwordRequiredBody: "Ù‡Ø°Ø§ Ø§Ù„Ù…Ù„Ù Ù…Ø­Ù…ÙŠ Ø¨ÙƒÙ„Ù…Ø© Ù…Ø±ÙˆØ±. Ø£Ø¯Ø®Ù„ ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± Ù„Ù„Ù…ØªØ§Ø¨Ø¹Ø©.",
      passwordLabel: "ÙƒÙ„Ù…Ø© Ù…Ø±ÙˆØ± Ø§Ù„Ø£Ø±Ø´ÙŠÙ",
      passwordSubmit: "ÙØªØ­ ÙˆÙ…ØªØ§Ø¨Ø¹Ø©",
      passwordCancel: "Ø¥Ù„ØºØ§Ø¡",
      passwordWrong: "ÙƒÙ„Ù…Ø© Ø§Ù„Ù…Ø±ÙˆØ± ØºÙŠØ± ØµØ­ÙŠØ­Ø©. Ø­Ø§ÙˆÙ„ Ù…Ø±Ø© Ø£Ø®Ø±Ù‰.",
      intakeRepairedTitle: "ØªÙ… Ø§Ù„Ø¥ØµÙ„Ø§Ø­ ØªÙ„Ù‚Ø§Ø¦ÙŠÙ‹Ø§",
      intakePartialTitle: "Ù‚Ø§Ø¨Ù„ Ù„Ù„Ù‚Ø±Ø§Ø¡Ø© Ø¬Ø²Ø¦ÙŠÙ‹Ø§",
      intakeIncompleteTitle: "Ø§Ù„Ø­Ø²Ù…Ø© ØºÙŠØ± Ù…ÙƒØªÙ…Ù„Ø©",
      intakeReadyTitle: "Ø¬Ø§Ù‡Ø² Ù„Ù„ØªØ­Ù„ÙŠÙ„",
      intakeBlockedTitle: "Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ù…Ø­Ø¸ÙˆØ±",
      intakeUnsupportedTitle: "ØªÙ†Ø³ÙŠÙ‚ ØºÙŠØ± Ù…Ø¯Ø¹ÙˆÙ…",
      intakeCorruptedTitle: "Ù…Ù„Ù ØªØ§Ù„Ù",
      intakePartiallyReadableTitle: "Ù‚Ø§Ø¨Ù„ Ù„Ù„Ù‚Ø±Ø§Ø¡Ø© Ø¬Ø²Ø¦ÙŠÙ‹Ø§2",
    },
    tenderDetail: {
      backToTenders: "â† Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª",
      unknownClient: "Ø¹Ù…ÙŠÙ„ ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ",
      deadline: "Ø§Ù„Ù…ÙˆØ¹Ø¯ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ",
      analyzed: "ØªÙ… Ø§Ù„ØªØ­Ù„ÙŠÙ„",
      fullReport: "Ø§Ù„ØªÙ‚Ø±ÙŠØ± Ø§Ù„ÙƒØ§Ù…Ù„",
      analysisInProgressTitle: "Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ù‚ÙŠØ¯ Ø§Ù„ØªÙ†ÙÙŠØ°",
      analysisInProgressBody:
        "Ø§Ù„Ø­Ø§Ù„Ø©: {status}. Ø­Ø¯Ù‘Ø« Ø§Ù„ØµÙØ­Ø© Ø¨Ø¹Ø¯ Ù‚Ù„ÙŠÙ„ â€” Ø§Ù„Ù…Ø¹Ø§Ù„Ø¬Ø© Ø¬Ø§Ø±ÙŠØ©.",
      analysisFailedTitle: "ÙØ´Ù„ Ø§Ù„ØªØ­Ù„ÙŠÙ„",
      analysisFailedBody:
        "Ø§Ù†ØªÙ‡Ù‰ Ø§Ù„Ù…Ø¹Ø§Ù„Ø¬Ø© Ø¨ÙØ´Ù„ Ù†Ù‡Ø§Ø¦ÙŠ. Ø±Ø§Ø¬Ø¹ ØªÙØ§ØµÙŠÙ„ Ø§Ù„Ø®Ø·Ø£ Ø£Ø¯Ù†Ø§Ù‡.",
      analysisFailedPhase: "ØªÙˆÙ‚Ù Ø¹Ù†Ø¯ Ø§Ù„Ù…Ø±Ø­Ù„Ø©: {phase}",
      canonicalNote:
        "ØªØ­Ù„ÙŠÙ„ Ù…ÙˆØ­Ù‘Ø¯ â€” Ù†ÙØ³ Ø§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª ÙˆØ§Ù„Ø§Ù…ØªØ«Ø§Ù„ ÙˆØ§Ù„Ù…Ù„Ø§Ø¡Ù…Ø© ÙˆØ§Ù„Ø¬Ø§Ù‡Ø²ÙŠØ© ÙˆØ§Ù„Ù…Ø®Ø§Ø·Ø± ÙˆØ¯Ø±Ø¬Ø© Ø§Ù„Ø¹Ø±Ø¶ ÙˆØ§Ù„ØªÙˆØµÙŠØ© Ù„ÙƒÙ„ Ù…Ø³ØªØ®Ø¯Ù… Ù…Ø®ÙˆÙ‘Ù„. Ø§Ù„Ø£Ø¯ÙˆØ§Ø± ØªØªØ­ÙƒÙ… ÙÙŠ Ø§Ù„ÙˆØµÙˆÙ„ ÙÙ‚Ø·.",
      missingDocuments: "Ù…Ø³ØªÙ†Ø¯Ø§Øª Ù†Ø§Ù‚ØµØ©",
      required: "Ø¥Ù„Ø²Ø§Ù…ÙŠ",
      nextActions: "Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª Ø§Ù„ØªØ§Ù„ÙŠØ©",
      noNextActions: "Ù„Ø§ Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª Ù…ÙˆØµÙ‰ Ø¨Ù‡Ø§ Ù„Ù‡Ø°Ø§ Ø§Ù„Ù‚Ø±Ø§Ø±.",
      teamWorkflow: {
        title: "Ø³ÙŠØ± Ø¹Ù…Ù„ Ù‚Ø±Ø§Ø± Ø§Ù„ÙØ±ÙŠÙ‚",
        subtitle:
          "Ø¹ÙŠÙ‘Ù† Ø§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª ÙˆØ§Ù„Ù…Ø®Ø§Ø·Ø± ÙˆØ§Ù„Ø£Ø¯Ù„Ø© Ø§Ù„Ù†Ø§Ù‚ØµØ© Ù„Ù„Ù…Ø§Ù„ÙŠØ© ÙˆØ§Ù„Ù‚Ø§Ù†ÙˆÙ†ÙŠ ÙˆØ§Ù„ØªÙ‚Ù†ÙŠ ÙˆØºÙŠØ±Ù‡Ø§. Ø±Ø¯ÙˆØ¯ Ø§Ù„ÙØ±ÙŠÙ‚ Ø£Ø¯Ù„Ø© ÙÙ‚Ø· â€” Ù„Ø§ ØªØºÙŠÙ‘Ø± Decision Engine ØªÙ„Ù‚Ø§Ø¦ÙŠÙ‹Ø§.",
        empty: "Ù„Ø§ Ù…Ù‡Ø§Ù… ÙØ±ÙŠÙ‚ Ø¨Ø¹Ø¯.",
        criticalBanner: "{count} Ù…Ù‡Ù…Ø© ÙØ±ÙŠÙ‚ Ø­Ø±Ø¬Ø© ØºÙŠØ± Ù…Ø­Ù„ÙˆÙ„Ø© Ù‚Ø¨Ù„ Ø§Ù„Ù‚Ø±Ø§Ø± Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ.",
        assign: "ØªØ¹ÙŠÙŠÙ†",
        respond: "Ø­ÙØ¸ Ø§Ù„Ø±Ø¯",
        complete: "Ø¥ÙƒÙ…Ø§Ù„ Ù…Ø¹ Ø§Ù„Ø±Ø¯",
        create: "Ø¥Ù†Ø´Ø§Ø¡ Ù…Ù‡Ù…Ø©",
        responsePlaceholder: "Ø£Ø¯Ø®Ù„ Ø±Ø¯Ù‹Ø§ Ù…ÙˆØ«Ù‘Ù‚Ù‹Ø§ (Ù„Ø§ ØªØ®ØªÙ„Ù‚)â€¦",
        evidencePlaceholder: "Ù…Ù„Ø§Ø­Ø¸Ø© Ø§Ù„Ø¯Ù„ÙŠÙ„ (Ø§Ø®ØªÙŠØ§Ø±ÙŠ)â€¦",
        department: "Ø§Ù„Ù‚Ø³Ù…",
        assignee: "Ø§Ù„Ù…ÙÙƒÙ„Ù‘ÙŽÙ",
        requiredResponse: "Ø§Ù„Ø±Ø¯ Ø§Ù„Ù…Ø·Ù„ÙˆØ¨",
        linkedItem: "Ø¹Ù†ØµØ± Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ© Ø§Ù„Ù…Ø±ØªØ¨Ø·",
      },
      decisionSupport: "Ø¯Ø¹Ù… Ø§Ù„Ù‚Ø±Ø§Ø±",
      fitSuffix: "Ù…Ù„Ø§Ø¡Ù…Ø©",
      overallFit: "Ø§Ù„Ù…Ù„Ø§Ø¡Ù…Ø© Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠØ©",
      confidence: "Ø§Ù„Ø«Ù‚Ø©",
      confidenceHigh: "Ù…Ø±ØªÙØ¹Ø©",
      confidenceMedium: "Ù…ØªÙˆØ³Ø·Ø©",
      confidenceLow: "Ù…Ù†Ø®ÙØ¶Ø©",
      heroBidLabel: "Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ ØªÙˆØµÙŠ Ø¨Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©",
      heroBidHint:
        "Ø¨Ù†Ø§Ø¡Ù‹ Ø¹Ù„Ù‰ Ø§Ù„Ù…Ø¹Ù„ÙˆÙ…Ø§Øª Ø§Ù„Ù…ØªÙˆÙØ±Ø©ØŒ ØªØ¯Ø¹Ù… Ø§Ù„Ù…Ù„Ø§Ø¡Ù…Ø© Ø¨Ø°Ù„ Ø¬Ù‡Ø¯ Ø§Ù„Ø¹Ø±Ø¶ â€” Ù…Ø¹ Ø§Ù„ØªØ­Ù‚Ù‚ Ù‚Ø¨Ù„ Ø§Ù„ØªÙ‚Ø¯ÙŠÙ….",
      heroReviewLabel: "Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ ØªÙˆØµÙŠ Ø¨Ø§Ù„Ù…Ø±Ø§Ø¬Ø¹Ø©",
      heroReviewHint:
        "Ø§Ù„ØºÙ…ÙˆØ¶ Ø£Ùˆ Ø§Ù„ÙØ¬ÙˆØ§Øª Ø£Ùˆ Ø§Ù„Ù…Ø¬Ù‡ÙˆÙ„ ÙŠØ­ØªØ§Ø¬ ØªØ£ÙƒÙŠØ¯Ù‹Ø§ Ø¨Ø´Ø±ÙŠÙ‹Ø§ Ù‚Ø¨Ù„ Ø§Ù„Ø§Ù„ØªØ²Ø§Ù….",
      heroNoBidLabel: "Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ ØªÙˆØµÙŠ Ø¨Ø¹Ø¯Ù… Ø§Ù„Ù…ØªØ§Ø¨Ø¹Ø©",
      heroNoBidHint:
        "Ø¨Ù†Ø§Ø¡Ù‹ Ø¹Ù„Ù‰ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…ØªØ§Ø­Ø©ØŒ ÙØ¬ÙˆØ§Øª Ø­Ø±Ø¬Ø© ØªØ¬Ø¹Ù„ Ø¬Ù‡Ø¯ Ø§Ù„Ø¹Ø±Ø¶ ØºÙŠØ± Ù…Ø¬Ø¯Ù â€” Ø£ÙƒÙ‘Ø¯ Ù…Ø¹ ÙØ±ÙŠÙ‚Ùƒ.",
      companyTenderFit: "Ù…Ù„Ø§Ø¡Ù…Ø© Ø§Ù„Ø´Ø±ÙƒØ©â€“Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ©",
      unknown: "ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ",
      basisAi: " Â· ØªÙ‚ÙŠÙŠÙ… Ø¨Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ",
      basisNotProvided: " Â· ØºÙŠØ± Ù…ØªÙˆÙØ±",
      basisFromProfile: " Â· Ù…Ù† Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ©",
      basisFromTender: " Â· Ù…Ù† Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ©",
      tenderReadiness: "Ø¬Ø§Ù‡Ø²ÙŠØ© Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ©",
      readinessCounts: "{ready} Ø¬Ø§Ù‡Ø² Â· {verify} ØªØ­Ù‚Ù‚ Â· {missing} Ù†Ø§Ù‚Øµ",
      recommendation: "Ø§Ù„ØªÙˆØµÙŠØ©:",
      keyBlockers: "Ø¹ÙˆØ§Ø¦Ù‚ Ø±Ø¦ÙŠØ³ÙŠØ©",
      keyBlockersNext:
        "Ø§Ù„Ø®Ø·ÙˆØ© Ø§Ù„ØªØ§Ù„ÙŠØ© Ø§Ù„Ù…ÙˆØµÙ‰ Ø¨Ù‡Ø§: Ø¹Ø§Ù„Ø¬ Ø§Ù„Ù…Ø´ÙƒÙ„Ø§Øª Ø§Ù„Ù…ÙˆØ¶Ù‘Ø­Ø© Ù‚Ø¨Ù„ Ø§ØªØ®Ø§Ø° Ù‚Ø±Ø§Ø± Ø§Ù„Ø¹Ø±Ø¶ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ.",
      whyTitle: "Ù„Ù…Ø§Ø°Ø§ Ù‡Ø°Ù‡ Ø§Ù„ØªÙˆØµÙŠØ©ØŸ",
      executiveSummary: "Ø§Ù„Ù…Ù„Ø®Øµ Ø§Ù„ØªÙ†ÙÙŠØ°ÙŠ",
      viewDetails: "Ø¹Ø±Ø¶ Ø§Ù„ØªÙØ§ØµÙŠÙ„",
      hideDetails: "Ø¥Ø®ÙØ§Ø¡ Ø§Ù„ØªÙØ§ØµÙŠÙ„",
      topReasons: "Ø§Ù„Ø£Ø³Ø¨Ø§Ø¨ Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©",
      criticalAlerts: "Ø¹Ù†Ø§ØµØ± Ø­Ø±Ø¬Ø©",
      whatToDoNext: "Ù…Ø§Ø°Ø§ ØªÙØ¹Ù„ Ø§Ù„Ø¢Ù†",
      decisionDisclaimer:
        "ÙŠÙ‚Ø¯Ù‘Ù… Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ ØªÙˆØµÙŠØ© Ù…Ø¨Ù†ÙŠØ© Ø¹Ù„Ù‰ Ø§Ù„Ø£Ø¯Ù„Ø©. Ø§Ù„Ù‚Ø±Ø§Ø± Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ ÙŠØ¨Ù‚Ù‰ Ù„Ø´Ø±ÙƒØªÙƒÙ….",
      expiredDeadlineAlert:
        "Ø§Ù†ØªÙ‡Ù‰ Ø§Ù„Ù…ÙˆØ¹Ø¯ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ Ù„Ù„ØªÙ‚Ø¯ÙŠÙ… â€” ØªØ£ÙƒÙ‘Ø¯ÙˆØ§ Ù…Ù…Ø§ Ø¥Ø°Ø§ ÙƒØ§Ù†Øª Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ© Ù…Ø§ Ø²Ø§Ù„Øª Ù…ÙØªÙˆØ­Ø©.",
      mandatoryGapAlert: "ÙØ¬ÙˆØ© Ø¥Ù„Ø²Ø§Ù…ÙŠØ©",
      missingDocumentAlert: "Ù…Ø³ØªÙ†Ø¯ Ù†Ø§Ù‚Øµ",
      detailedAnalysisTitle: "ØªØ­Ù„ÙŠÙ„ Ù…ÙØµÙ‘Ù„",
      detailedAnalysisHint:
        "Ø§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª ÙˆØ§Ù„Ø§Ù…ØªØ«Ø§Ù„ ÙˆØ§Ù„Ø£Ø¯Ù„Ø© ÙˆØ§Ù„Ù…Ø®Ø§Ø·Ø± ÙˆØ§Ù„Ù…Ù„Ø§Ø¡Ù…Ø© ÙˆØ³ÙŠØ± Ø§Ù„Ø¹Ù…Ù„ â€” Ù†ÙØ³ Ø§Ù„Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„Ù…ÙˆØ­Ù‘Ø¯Ø© ÙƒÙ…Ø§ ÙÙŠ Ø§Ù„ØªÙ‚Ø±ÙŠØ±.",
    },
    report: {
      backToTender: "â† Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ©",
      title: "ØªÙ‚Ø±ÙŠØ± Ø§Ù„ØªØ­Ù„ÙŠÙ„",
      subtitle:
        "Ø­Ø²Ù…Ø© Ø§Ù„Ù‚Ø±Ø§Ø± Ø§Ù„ÙƒØ§Ù…Ù„Ø© â€” Ø¹Ø±Ø¶ØŒ Ø·Ø¨Ø§Ø¹Ø©ØŒ ØªÙ†Ø²ÙŠÙ„ PDFØŒ Ø£Ùˆ Ù…Ø´Ø§Ø±ÙƒØ© Ø±Ø§Ø¨Ø· Ù„Ù„Ù‚Ø±Ø§Ø¡Ø© ÙÙ‚Ø·.",
      reportNotReady: "Ø§Ù„ØªÙ‚Ø±ÙŠØ± ØºÙŠØ± Ø¬Ø§Ù‡Ø²",
      reportNotReadyBody: "Ø§Ù„ØªÙ‚Ø±ÙŠØ± ØºÙŠØ± Ø¬Ø§Ù‡Ø² Ù„Ù„Ø¹Ø±Ø¶ Ø¨Ø¹Ø¯. ÙŠØ±Ø¬Ù‰ Ø§Ù„Ù…Ø­Ø§ÙˆÙ„Ø© Ù„Ø§Ø­Ù‚Ù‹Ø§.",
      print: "Ø·Ø¨Ø§Ø¹Ø©",
      downloadPdf: "ØªÙ†Ø²ÙŠÙ„ PDF",
      shareLink: "Ù…Ø´Ø§Ø±ÙƒØ© Ø§Ù„Ø±Ø§Ø¨Ø·",
      copied: "ØªÙ… Ø§Ù„Ù†Ø³Ø®.",
      shareExpires: "ÙŠÙ†ØªÙ‡ÙŠ Ø®Ù„Ø§Ù„ 72 Ø³Ø§Ø¹Ø© Â· Ù„Ù„Ù‚Ø±Ø§Ø¡Ø© ÙÙ‚Ø·:",
      revokeShare: "Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø±ÙˆØ§Ø¨Ø· Ø§Ù„Ù…Ø´ØªØ±ÙƒØ©",
      shareRevoked: "ØªÙ… Ø¥Ù„ØºØ§Ø¡ Ø§Ù„Ø±ÙˆØ§Ø¨Ø· Ø§Ù„Ù…Ø´ØªØ±ÙƒØ©.",
      reportEyebrow: "ØªÙ‚Ø±ÙŠØ± Ù‚Ø±Ø§Ø± Ø¨ÙŠØ¯ÙØ±Ø§Ø¡",
      unknownClient: "Ø¹Ù…ÙŠÙ„ ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ",
      deadline: "Ø§Ù„Ù…ÙˆØ¹Ø¯ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ",
      analyzed: "ØªÙ… Ø§Ù„ØªØ­Ù„ÙŠÙ„",
      recommendation: "Ø§Ù„ØªÙˆØµÙŠØ©",
      companyTenderFit: "Ù…Ù„Ø§Ø¡Ù…Ø© Ø§Ù„Ø´Ø±ÙƒØ©â€“Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ©",
      confidence: "Ø§Ù„Ø«Ù‚Ø©",
      whyTitle: "Ù„Ù…Ø§Ø°Ø§ Ù‡Ø°Ù‡ Ø§Ù„ØªÙˆØµÙŠØ©",
      bidScore: "Ø¯Ø±Ø¬Ø© Ø§Ù„Ø¹Ø±Ø¶",
      bidScoreLine: "Ø¯Ø±Ø¬Ø© Ø§Ù„Ø¹Ø±Ø¶: {score}/100 â€” {priority}",
      expectedValue: "Ø§Ù„Ù‚ÙŠÙ…Ø© Ø§Ù„Ù…ØªÙˆÙ‚Ø¹Ø©:",
      risk: "Ø§Ù„Ù…Ø®Ø§Ø·Ø±:",
      effort: "Ø§Ù„Ø¬Ù‡Ø¯:",
      positive: "Ø¥ÙŠØ¬Ø§Ø¨ÙŠ",
      negative: "Ø³Ù„Ø¨ÙŠ",
      overall: "Ø§Ù„Ø¥Ø¬Ù…Ø§Ù„ÙŠ",
      unknown: "ØºÙŠØ± Ù…Ø¹Ø±ÙˆÙ",
      tenderReadiness: "Ø¬Ø§Ù‡Ø²ÙŠØ© Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ©",
      readinessCounts: "{ready} Ø¬Ø§Ù‡Ø² Â· {verify} ØªØ­Ù‚Ù‚ Â· {missing} Ù†Ø§Ù‚Øµ",
      nextStep: "Ø§Ù„Ø®Ø·ÙˆØ© Ø§Ù„ØªØ§Ù„ÙŠØ©:",
      complianceMatrix: "Ù…ØµÙÙˆÙØ© Ø§Ù„Ø§Ù…ØªØ«Ø§Ù„",
      requirements: "Ø§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª",
      ready: "Ø¬Ø§Ù‡Ø²",
      missing: "Ù†Ø§Ù‚Øµ",
      verify: "ØªØ­Ù‚Ù‚",
      notApplicable: "ØºÙŠØ± Ù…Ù†Ø·Ø¨Ù‚",
      withSources: "Ù…Ø¹ Ù…ØµØ§Ø¯Ø±",
      mandatory: "Ø¥Ù„Ø²Ø§Ù…ÙŠ",
      optional: "Ø§Ø®ØªÙŠØ§Ø±ÙŠ",
      evidenceLabel: "Ø§Ù„Ø¯Ù„ÙŠÙ„:",
      noExcerpt: "Ù„Ø§ ÙŠØªÙˆÙØ± Ù…Ù‚ØªØ·Ù Ø¯Ø§Ø¹Ù….",
      page: "ØµÙØ­Ø© {n}",
      sourceNotLocated: "ØªØ¹Ø°Ù‘Ø± ØªØ­Ø¯ÙŠØ¯ Ø§Ù„Ù…ØµØ¯Ø± Ø¨Ø¯Ù‚Ø©.",
      noRequirements: "Ù„Ù… ØªÙØ³ØªØ®Ø±Ø¬ Ù…ØªØ·Ù„Ø¨Ø§Øª Ù„Ù‡Ø°Ù‡ Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ©.",
      missingRequirements: "Ø§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª Ø§Ù„Ù†Ø§Ù‚ØµØ©",
      noMissingRequirements: "Ù„Ù… ØªÙØ­Ø¯Ù‘ÙŽØ¯ Ù…ØªØ·Ù„Ø¨Ø§Øª Ù†Ø§Ù‚ØµØ©.",
      mandatoryParen: " (Ø¥Ù„Ø²Ø§Ù…ÙŠ)",
      verificationItems: "Ø¨Ù†ÙˆØ¯ Ø§Ù„ØªØ­Ù‚Ù‚",
      nothingPendingVerify: "Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ù…Ø§ ÙŠÙ†ØªØ¸Ø± Ø§Ù„ØªØ­Ù‚Ù‚.",
      risks: "Ø§Ù„Ù…Ø®Ø§Ø·Ø±",
      noRisks: "Ù„Ù… ØªÙØ´Ø± Ø¥Ù„Ù‰ Ù…Ø®Ø§Ø·Ø± Ø¬ÙˆÙ‡Ø±ÙŠØ©.",
      clarifications: "Ø£Ø³Ø¦Ù„Ø© Ø§Ù„ØªÙˆØ¶ÙŠØ­",
      noClarifications:
        "Ù„Ù… ØªÙÙ†Ø´Ø£ Ø£Ø³Ø¦Ù„Ø© ØªÙˆØ¶ÙŠØ­ â€” Ù„Ù… ØªÙÙƒØªØ´Ù Ø£ÙŠ ØºÙ…ÙˆØ¶ Ø°ÙŠ Ù…Ø¹Ù†Ù‰.",
      reason: "Ø§Ù„Ø³Ø¨Ø¨:",
      source: "Ø§Ù„Ù…ØµØ¯Ø±:",
      evidence: "Ø§Ù„Ø£Ø¯Ù„Ø©",
      noEvidence: "Ù„Ø§ ØªØªÙˆÙØ± Ù…Ù‚ØªØ·ÙØ§Øª Ù…Ù† Ø§Ù„Ù…ØµØ¯Ø±.",
      historicalTitle: "Ø°ÙƒØ§Ø¡ ØªØ§Ø±ÙŠØ®ÙŠ Ø°Ùˆ ØµÙ„Ø©",
      historicalBody:
        "Ù‚Ø¯ ØªÙˆÙØ± Ù†ØªØ§Ø¦Ø¬ ØªØ§Ø±ÙŠØ®ÙŠØ© Ù…Ø´Ø§Ø¨Ù‡Ø© Ø¥Ø´Ø§Ø±Ø© Ù…ÙÙŠØ¯Ø© Ù„Ù‡Ø°Ù‡ Ø§Ù„ÙØ±ØµØ©. Ù‡Ø°Ù‡ Ø¥Ø´Ø§Ø±Ø© Ø¥Ø¶Ø§ÙÙŠØ© â€” ÙˆÙ„ÙŠØ³Øª Ø¶Ù…Ø§Ù†Ù‹Ø§ Ù„Ù„Ù†Ø¬Ø§Ø­ Ø£Ùˆ Ø§Ù„ÙØ´Ù„.",
      historicalPriority:
        "Ø£Ø¯Ù„Ø© Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ© Ø§Ù„Ø­Ø§Ù„ÙŠØ© ÙˆÙ…Ù„Ù Ø´Ø±ÙƒØªÙƒ Ù„Ù‡Ù…Ø§ Ø§Ù„Ø£ÙˆÙ„ÙˆÙŠØ© Ø¯Ø§Ø¦Ù…Ù‹Ø§.",
      historicalEmpty: "Ù„Ø§ ÙŠÙ†Ø·Ø¨Ù‚ Ø¨Ø¹Ø¯ Ø£ÙŠ Ù†Ù…Ø· ØªØ§Ø±ÙŠØ®ÙŠ Ù…ÙˆØ«Ù‘Ù‚ Ø¹Ù„Ù‰ Ù‡Ø°Ù‡ Ø§Ù„ÙØ±ØµØ©.",
      decisionMemoryTitle: "Ø°Ø§ÙƒØ±Ø© Ø§Ù„Ù‚Ø±Ø§Ø±",
      currentAnalysisLabel: "Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ø­Ø§Ù„ÙŠ",
      historicalDecisionLabel: "Ù‚Ø±Ø§Ø± ØªØ§Ø±ÙŠØ®ÙŠ",
      decisionMemoryCurrentNote:
        "Ø§Ù„Ø¯Ø±Ø¬Ø§Øª ÙˆØ§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª ÙˆØ§Ù„ØªÙˆØµÙŠØ© Ø£Ø¹Ù„Ø§Ù‡ Ù‡ÙŠ Ø§Ù„Ù…Ø±Ø¬Ø¹ Ù„Ù‡Ø°Ù‡ Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ© ÙˆÙ„Ø§ ØªØªØºÙŠÙ‘Ø± Ø¨Ø³Ø¨Ø¨ Ø§Ù„Ø³Ø¬Ù„ Ø§Ù„ØªØ§Ø±ÙŠØ®ÙŠ.",
      decisionMemoryEmpty: "Ù„Ø§ ØªÙˆØ¬Ø¯ Ù‚Ø±Ø§Ø±Ø§Øª Ø³Ø§Ø¨Ù‚Ø© Ø°Ø§Øª ØµÙ„Ø© Ø¨Ù‡Ø°Ù‡ Ø§Ù„ÙØ±ØµØ© Ø¨Ø¹Ø¯.",
      relevanceReasons: "Ø³Ø¨Ø¨ Ø§Ù„ØµÙ„Ø©",
      missingDocuments: "Ø§Ù„Ù…Ø³ØªÙ†Ø¯Ø§Øª Ø§Ù„Ù†Ø§Ù‚ØµØ©",
      nextActions: "Ø§Ù„Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª Ø§Ù„ØªØ§Ù„ÙŠØ© Ø§Ù„Ù…ÙˆØµÙ‰ Ø¨Ù‡Ø§",
      noNextActions: "Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¥Ø¬Ø±Ø§Ø¡Ø§Øª Ù…ÙˆØµÙ‰ Ø¨Ù‡Ø§.",
      basisDirect: "Ù…ØµØ¯Ø± Ù…Ø¨Ø§Ø´Ø±",
      basisAi: "ØªÙØ³ÙŠØ± Ø¨Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ",
      basisUncertain: "Ù…ØµØ¯Ø± ØºÙŠØ± Ù…Ø¤ÙƒØ¯",
      evidenceVerificationTitle: "Ø§Ù„Ø£Ø¯Ù„Ø© ÙˆØ§Ù„ØªØ­Ù‚Ù‚",
      evidenceVerificationDisclaimer:
        "ÙŠØ¹ÙƒØ³ Ø§Ù„ØªØ­Ù‚Ù‚ Ø§Ù„Ø£Ø¯Ù„Ø© Ø§Ù„Ù…Ø³Ø¬Ù„Ø© ÙˆØ§Ù„Ù…Ø±Ø§Ø¬Ø¹Ø© Ø§Ù„Ø¨Ø´Ø±ÙŠØ© ÙÙ‚Ø·. Ù„Ø§ ØªÙØ¹Ø§Ù…Ù„ ØªÙØ³ÙŠØ±Ø§Øª Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„Ø§ØµØ·Ù†Ø§Ø¹ÙŠ ÙƒÙ…ÙØ­Ù‚Ù‚Ø© Ø£Ø¨Ø¯Ø§Ù‹.",
      verificationSummary:
        "{verified} Ù…ÙØ­Ù‚Ù‚ Â· {needs} ÙŠØ­ØªØ§Ø¬ ØªØ­Ù‚Ù‚ Â· {missing} Ø£Ø¯Ù„Ø© Ù…ÙÙ‚ÙˆØ¯Ø© Â· {na} ØºÙŠØ± Ù‚Ø§Ø¨Ù„ Ù„Ù„ØªØ·Ø¨ÙŠÙ‚",
      noVerificationChains: "Ù„Ø§ ØªÙˆØ¬Ø¯ Ø³Ù„Ø§Ø³Ù„ ØªØ­Ù‚Ù‚ Ù…ØªØ§Ø­Ø© Ù„Ù‡Ø°Ù‡ Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ©.",
      verificationStatusVerified: "Ù…ÙØ­Ù‚Ù‚",
      verificationStatusNeedsVerification: "ÙŠØ­ØªØ§Ø¬ ØªØ­Ù‚Ù‚",
      verificationStatusMissingEvidence: "Ø£Ø¯Ù„Ø© Ù…ÙÙ‚ÙˆØ¯Ø©",
      verificationStatusNotApplicable: "ØºÙŠØ± Ù‚Ø§Ø¨Ù„ Ù„Ù„ØªØ·Ø¨ÙŠÙ‚",
      verifierLabel: "Ø§Ù„Ù…ÙØ­Ù‚Ù‚:",
      verifiedAtLabel: "ØªØ§Ø±ÙŠØ® Ø§Ù„ØªØ­Ù‚Ù‚:",
      decisionOutcomeTitle: "Ù†ØªÙŠØ¬Ø© Ø§Ù„Ù‚Ø±Ø§Ø±",
      decisionOutcomeBidvera: "Ù‚Ø±Ø§Ø± Bidvera",
      decisionOutcomeHuman: "Ø§Ù„Ù‚Ø±Ø§Ø± Ø§Ù„Ø¨Ø´Ø±ÙŠ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ",
      decisionOutcomeActual: "Ø§Ù„Ù†ØªÙŠØ¬Ø© Ø§Ù„ÙØ¹Ù„ÙŠØ©",
      decisionOutcomeDate: "ØªØ§Ø±ÙŠØ® Ø§Ù„Ù†ØªÙŠØ¬Ø©",
      decisionOutcomeReason: "Ø³Ø¨Ø¨ Ø§Ù„Ù†ØªÙŠØ¬Ø©",
      decisionOutcomeSuccess: "Ø§Ù„Ù‚Ø±Ø§Ø± Ù…Ù‚Ø§Ø¨Ù„ Ø§Ù„Ù†ØªÙŠØ¬Ø©",
      decisionOutcomeSuccessAligned: "Ø§Ù„Ù‚Ø±Ø§Ø± Ø§Ù„Ø£ØµÙ„ÙŠ Ù…ØªÙˆØ§ÙÙ‚ Ù…Ø¹ Ø§Ù„Ù†ØªÙŠØ¬Ø©",
      decisionOutcomeSuccessMisaligned: "Ø§Ù„Ù‚Ø±Ø§Ø± Ø§Ù„Ø£ØµÙ„ÙŠ ØºÙŠØ± Ù…ØªÙˆØ§ÙÙ‚ Ù…Ø¹ Ø§Ù„Ù†ØªÙŠØ¬Ø©",
      decisionOutcomeSuccessPending: "Ø§Ù„Ù†ØªÙŠØ¬Ø© Ù„Ø§ ØªØ²Ø§Ù„ Ù…Ø¹Ù„Ù‚Ø©",
      decisionOutcomeSuccessNeutral: "Ù…Ø­Ø§ÙŠØ¯ Ø¨Ø§Ù„Ù†Ø³Ø¨Ø© Ù„Ù„Ù‚Ø±Ø§Ø± Ø§Ù„Ø£ØµÙ„ÙŠ",
      decisionOutcomeRecorded: "Ù†ØªÙŠØ¬Ø© Ù…Ø³Ø¬Ù„Ø©",
      outcomeLearningTitle: "Ø§Ù„Ø°ÙƒØ§Ø¡ Ø§Ù„ØªØ§Ø±ÙŠØ®ÙŠ Ø§Ù„Ù‚Ø§Ø¦Ù… Ø¹Ù„Ù‰ Ø§Ù„Ù†ØªØ§Ø¦Ø¬",
      decisionOutcomeAttachment: "Ù…Ø³ØªÙ†Ø¯ Ø¯Ø§Ø¹Ù…",
      decisionOutcomeEvalSuccessful: "Ù†Ø§Ø¬Ø­",
      decisionOutcomeEvalUnsuccessful: "ØºÙŠØ± Ù†Ø§Ø¬Ø­",
      decisionOutcomeEvalNotEvaluated: "ØºÙŠØ± Ù…Ù‚ÙŠÙ‘Ù…",
    },
    decisionMemory: {
      title: "Ø°Ø§ÙƒØ±Ø© Ø§Ù„Ù‚Ø±Ø§Ø±",
      subtitle:
        "Ù‚Ø±Ø§Ø±Ø§Øª Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ§Øª Ø§Ù„Ø³Ø§Ø¨Ù‚Ø© Ù„Ø´Ø±ÙƒØªÙƒ â€” Ù„Ù„Ù…Ø±Ø¬Ø¹ ÙÙ‚Ø·. Ù„Ø§ ØªØºÙŠÙ‘Ø± Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ø­Ø§Ù„ÙŠ Ø£Ø¨Ø¯Ù‹Ø§.",
      emptyTitle: "Ù„Ø§ Ù‚Ø±Ø§Ø±Ø§Øª Ù…Ø®Ø²Ù‘Ù†Ø© Ø¨Ø¹Ø¯",
      emptyDescription:
        "ØªØ¸Ù‡Ø± Ø§Ù„ØªØ­Ù„ÙŠÙ„Ø§Øª Ø§Ù„Ù…ÙƒØªÙ…Ù„Ø© Ù‡Ù†Ø§ ØªÙ„Ù‚Ø§Ø¦ÙŠÙ‹Ø§. Ø§ÙØªØ­ Ù…Ù†Ø§Ù‚ØµØ© Ù„Ù…Ù‚Ø§Ø±Ù†Ø© Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ø­Ø§Ù„ÙŠ Ø¨Ø§Ù„Ù‚Ø±Ø§Ø± Ø§Ù„ØªØ§Ø±ÙŠØ®ÙŠ.",
      emptyDescriptionCompanyContext:
        "ØªØ¸Ù‡Ø± Ø§Ù„Ù‚Ø±Ø§Ø±Ø§Øª Ø§Ù„Ù…Ø®Ø²Ù‘Ù†Ø© Ù‡Ù†Ø§ Ø¹Ù†Ø¯Ù…Ø§ ÙŠØ³Ø¬Ù‘Ù„ Ø°ÙƒØ§Ø¡ Ø§Ù„Ù‚Ø±Ø§Ø± Ù†ØªÙŠØ¬Ø© Ù„Ø´Ø±ÙƒØªÙƒ. Ø£Ø¨Ù‚Ù Ø§Ù„Ù…Ø¤Ù‡Ù„Ø§Øª ÙˆØ§Ù„Ø£Ø¯Ù„Ø© Ù…Ø­Ø¯Ù‘Ø«Ø© Ø­ØªÙ‰ ØªØ­Ø¸Ù‰ Ø§Ù„Ù‚Ø±Ø§Ø±Ø§Øª Ø§Ù„Ù…Ø³ØªÙ‚Ø¨Ù„ÙŠØ© Ø¨Ø³ÙŠØ§Ù‚ Ø´Ø±ÙƒØ© Ù‚ÙˆÙŠ.",
      viewTender: "ÙØªØ­ Ø§Ù„Ù…Ù†Ø§Ù‚ØµØ©",
      openCompanyProfile: "ÙØªØ­ Ù…Ù„Ù Ø§Ù„Ø´Ø±ÙƒØ©",
      analyzed: "ØªÙ… Ø§Ù„ØªØ­Ù„ÙŠÙ„",
      scores: "Ø§Ù„Ø¯Ø±Ø¬Ø§Øª",
      requirements: "Ø§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª",
      risks: "Ø§Ù„Ù…Ø®Ø§Ø·Ø±",
      reasoning: "Ø§Ù„Ù…Ø¨Ø±Ø±Ø§Øª",
      relevance: "Ø§Ù„ØµÙ„Ø©",
      disclaimer:
        "Ù‚Ø±Ø§Ø± ØªØ§Ø±ÙŠØ®ÙŠ â€” Ù„Ù„Ù…Ø±Ø¬Ø¹ ÙÙ‚Ø·. Ù„Ø§ ÙŠØºÙŠÙ‘Ø± Ø¯Ø±Ø¬Ø§Øª Ø§Ù„ØªØ­Ù„ÙŠÙ„ Ø§Ù„Ø­Ø§Ù„ÙŠ Ø£Ùˆ Ø§Ù„ØªÙˆØµÙŠØ©.",
      back: "Ø§Ù„Ø¹ÙˆØ¯Ø© Ø¥Ù„Ù‰ Ø°Ø§ÙƒØ±Ø© Ø§Ù„Ù‚Ø±Ø§Ø±",
    },
    pwa: {
      availableOn: "Ù…ØªØ§Ø­ Ø¹Ù„Ù‰ Windows Ùˆ macOS",
      updateTitle: "ØªØ­Ø¯ÙŠØ« Ø§Ù„ØªØ·Ø¨ÙŠÙ‚ Ø¬Ø§Ù‡Ø²",
      updateBody: "ÙŠØªÙˆÙØ± Ø¥ØµØ¯Ø§Ø± Ø£Ø­Ø¯Ø« Ù…Ù† Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ Ù„Ø³Ø·Ø­ Ø§Ù„Ù…ÙƒØªØ¨. Ø£Ø¹Ø¯ Ø§Ù„ØªØ­Ù…ÙŠÙ„ Ù„Ù„ØªØ·Ø¨ÙŠÙ‚.",
      updateNow: "Ø­Ø¯Ù‘Ø« Ø§Ù„Ø¢Ù†",
      installedTitle: "ØªÙ… ØªØ«Ø¨ÙŠØª Ø¨ÙŠØ¯ÙØ±Ø§Ø¡",
      installedBody:
        "Ø£Ù†Øª ÙÙŠ ÙˆØ¶Ø¹ ØªØ·Ø¨ÙŠÙ‚ Ø³Ø·Ø­ Ø§Ù„Ù…ÙƒØªØ¨ â€” ÙˆØµÙˆÙ„ Ø£Ø³Ø±Ø¹ Ù…Ù† Ø§Ù„Ø´Ø±ÙŠØ· Ø£Ùˆ Ø´Ø±ÙŠØ· Ø§Ù„Ù…Ù‡Ø§Ù….",
      title: "Ø«Ø¨Ù‘Øª Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ ÙƒØªØ·Ø¨ÙŠÙ‚ Ø³Ø·Ø­ Ù…ÙƒØªØ¨",
      bodyBefore: "ÙŠØ¹Ù…Ù„ Ø¹Ù„Ù‰",
      bodyAnd: "Ùˆ",
      bodyAfter: "â€” ÙŠÙØªØ­ ÙÙŠ Ù†Ø§ÙØ°ØªÙ‡ Ø§Ù„Ø®Ø§ØµØ© Ø¯ÙˆÙ† Ù…ØªØ¬Ø± ØªØ·Ø¨ÙŠÙ‚Ø§Øª.",
      installCta: "ØªØ«Ø¨ÙŠØª Ø¨ÙŠØ¯ÙØ±Ø§Ø¡",
      openingInstaller: "Ø¬Ø§Ø±Ù ÙØªØ­ Ø§Ù„Ù…Ø«Ø¨Ù‘Øªâ€¦",
      dismiss: "Ø¥ØºÙ„Ø§Ù‚",
      guideTitleSafari: "ØªØ«Ø¨ÙŠØª Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ ÙÙŠ Safari",
      guideTitleEdge: "ØªØ«Ø¨ÙŠØª Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ ÙÙŠ Edge",
      guideTitleChrome: "ØªØ«Ø¨ÙŠØª Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ ÙÙŠ Chrome",
      guideTitleDefault: "ØªØ«Ø¨ÙŠØª Ø¨ÙŠØ¯ÙØ±Ø§Ø¡",
      guideDescription: "Ø§ØªØ¨Ø¹ Ù‡Ø°Ù‡ Ø§Ù„Ø®Ø·ÙˆØ§Øª Ù„Ø¥Ø¶Ø§ÙØ© Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ ÙƒØªØ·Ø¨ÙŠÙ‚ Ø³Ø·Ø­ Ù…ÙƒØªØ¨.",
      desktopMeta: "ØªØ·Ø¨ÙŠÙ‚ Ø³Ø·Ø­ Ù…ÙƒØªØ¨ Â· Windows Ùˆ macOS",
      openInstallDialog: "ÙØªØ­ Ù†Ø§ÙØ°Ø© Ø§Ù„ØªØ«Ø¨ÙŠØª",
      gotIt: "Ø­Ø³Ù†Ù‹Ø§",
      iosStep1: "Ø§Ø¶ØºØ· Ø²Ø± Ø§Ù„Ù…Ø´Ø§Ø±ÙƒØ© ÙÙŠ Safari.",
      iosStep2: "Ø§Ø®ØªØ±",
      iosStep2Strong: "Ø¥Ø¶Ø§ÙØ© Ø¥Ù„Ù‰ Ø§Ù„Ø´Ø§Ø´Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©",
      iosStep3: "Ø£ÙƒÙ‘Ø¯ â€” ØªÙØªØ­ Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ Ø¨Ù…Ù„Ø¡ Ø§Ù„Ø´Ø§Ø´Ø© Ù…Ù† Ø§Ù„Ø´Ø§Ø´Ø© Ø§Ù„Ø±Ø¦ÙŠØ³ÙŠØ©.",
      safariMacStep1: "Ù…Ù† Ø´Ø±ÙŠØ· Ø§Ù„Ù‚ÙˆØ§Ø¦Ù… Ø§ÙØªØ­",
      safariMacStep1Strong: "Ù…Ù„Ù",
      safariMacStep2: "Ø§Ø®ØªØ±",
      safariMacStep2Strong: "Ø¥Ø¶Ø§ÙØ© Ø¥Ù„Ù‰ Dock",
      safariMacStep3: "Ø£ÙƒÙ‘Ø¯ â€” ØªØ¸Ù‡Ø± Ø¨ÙŠØ¯ÙØ±Ø§Ø¡ ÙÙŠ Dock ÙƒØªØ·Ø¨ÙŠÙ‚ Mac.",
      chromiumStep1Before: "Ø§Ù†Ø¸Ø± Ø¥Ù„Ù‰ ÙŠÙ…ÙŠÙ† Ø´Ø±ÙŠØ· Ø¹Ù†ÙˆØ§Ù† {browser} Ù„Ø£ÙŠÙ‚ÙˆÙ†Ø©",
      chromiumStep1Strong: "ØªØ«Ø¨ÙŠØª / Ø¬Ù‡Ø§Ø²",
      chromiumStep1After: ".",
      chromiumStep2Before: "Ø§Ù†Ù‚Ø± Ø«Ù… Ø§Ø®ØªØ±",
      chromiumStep2Strong: "ØªØ«Ø¨ÙŠØª",
      chromiumStep3Before: "Ø£Ùˆ Ø§ÙØªØ­ Ù‚Ø§Ø¦Ù…Ø© Ø§Ù„Ù…ØªØµÙØ­ â†",
      chromiumStep3Install: "ØªØ«Ø¨ÙŠØª Ø¨ÙŠØ¯ÙØ±Ø§Ø¡",
      chromiumStep3Mid: "/",
      chromiumStep3Apps: "Ø§Ù„ØªØ·Ø¨ÙŠÙ‚Ø§Øª â† ØªØ«Ø¨ÙŠØª Ù‡Ø°Ø§ Ø§Ù„Ù…ÙˆÙ‚Ø¹ ÙƒØªØ·Ø¨ÙŠÙ‚",
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
    tagline: "Sachez quoi poursuivre. Sachez pour quoi vous Ãªtes prÃªts.",
    description:
      "Bidvera aide les entreprises Ã  comprendre leur prÃ©paration, gÃ©rer conformitÃ© et qualifications, organiser les preuves, Ã©valuer des opportunitÃ©s pertinentes et prendre des dÃ©cisions explicables.",
  },
  legal: {
    footerHeading: "Mentions lÃ©gales",
    privacyLink: "Politique de confidentialitÃ©",
    termsLink: "Conditions dâ€™utilisation",
    privacyEyebrow: "Mentions lÃ©gales",
    privacyTitle: "Politique de confidentialitÃ©",
    privacyMetaDescription:
      "Comment Bidvera traite les donnÃ©es personnelles des comptes, espaces de travail, documents, facturation, connexion Google et sÃ©curitÃ© sur getbidvera.com.",
    termsEyebrow: "Mentions lÃ©gales",
    termsTitle: "Conditions dâ€™utilisation",
    termsMetaDescription:
      "Conditions rÃ©gissant lâ€™utilisation de la plateforme SaaS Bidvera : comptes, sorties IA, abonnements et usage acceptable.",
    effectiveDateLabel: "Date dâ€™entrÃ©e en vigueur",
    lastUpdatedLabel: "DerniÃ¨re mise Ã  jour",
    onThisPage: "Sur cette page",
    relatedDocuments: "Documents associÃ©s",
  },
  landing: {
    headline: "Sachez quoi poursuivre. Sachez pour quoi vous Ãªtes prÃªts.",
    subhead:
      "Bidvera aide les Ã©quipes Ã  comprendre la prÃ©paration de lâ€™entreprise, gÃ©rer conformitÃ© et qualifications, organiser les preuves, Ã©valuer le travail pertinent et transformer des dÃ©cisions explicables en prochaines actions claires.",
    ctaPrimary: "Explorer Bidvera",
    ctaSecondary: "Voir le fonctionnement",
    trialNote: "PrÃ©paration Â· OpportunitÃ©s Â· Preuves Â· DÃ©cisions Â· Action",
    previewLabel: "Intelligence de dÃ©cision",
    previewQuestion: "PRÃŠT Ã€ POURSUIVRE ?",
    previewDecision: "REVIEW",
    previewFit: "Bon alignement de prÃ©paration",
    previewRisk: "Preuves vÃ©rifiÃ©es",
    previewRiskValue: "3 exigences confirmÃ©es",
    previewMissing: "Ã€ traiter",
    previewMissingValue: "1 Ã©lÃ©ment de qualification Ã  vÃ©rifier",
    previewNext: "Prochaine action",
    previewNextValue: "Confirmer les preuves restantes",
    previewWhy:
      "La qualification paraÃ®t solide. Un Ã©lÃ©ment doit encore Ãªtre vÃ©rifiÃ© avant que lâ€™Ã©quipe sâ€™engage.",
    sectionTitle: "Pourquoi les entreprises utilisent Bidvera",
    sectionBody:
      "Au lieu de reconstruire la prÃ©paration depuis dossiers, e-mails et tableurs, Bidvera offre un espace structurÃ© pour lâ€™information dâ€™entreprise, les preuves, les dÃ©cisions et le suivi.",
    feature1Title: "ConnaÃ®tre votre prÃ©paration",
    feature1Body:
      "Gardez Ã  jour les informations dâ€™entreprise, les qualifications et les preuves de conformitÃ©.",
    feature2Title: "Organiser le travail pertinent",
    feature2Body:
      "Capturez les demandes clients et les Ã©chÃ©ances du calendrier, puis Ã©valuez les exigences face Ã  ce que vous pouvez rÃ©ellement livrer.",
    feature3Title: "Agir en confiance",
    feature3Body:
      "Prenez des dÃ©cisions explicables, assignez les prochaines actions et alignez lâ€™Ã©quipe.",
    capabilitiesTitle: "Huit capacitÃ©s pour la prÃ©paration, les opportunitÃ©s et lâ€™action",
    capabilitiesLearnMore: "En savoir plus",
    capabilitiesShowLess: "RÃ©duire",
    capabilities: [
      {
        title: "Profil dâ€™entreprise",
        body: "Gardez identitÃ©, services et prÃ©paration de lâ€™entreprise dans un seul espace.",
        detail:
          "Capturez secteur, services, gÃ©ographie et taille pour une vue partagÃ©e de lâ€™offre. Cette base soutient qualification, preuves et revue dâ€™opportunitÃ©s.",
      },
      {
        title: "ConformitÃ© documentaire",
        body: "Suivez les documents critiques et les dates dâ€™expiration avant quâ€™ils ne bloquent.",
        detail:
          "Stockez licences, certificats et assurances dans un espace sÃ©curisÃ©, surveillez la validitÃ© et voyez ce qui demande attention avant expiration.",
      },
      {
        title: "Qualification fournisseur",
        body: "Montrez ce que votre entreprise est qualifiÃ©e Ã  livrer â€” et oÃ¹ restent des Ã©carts.",
        detail:
          "Maintenez qualifications, couverture et preuves pour voir la prÃ©paration avant dâ€™investir du temps sur une demande.",
      },
      {
        title: "Demandes clients",
        body: "Centralisez les demandes dâ€™information et de documents de lâ€™acheteur dans un dossier clair.",
        detail:
          "Capturez les demandes entrantes, liez les preuves existantes, suivez lâ€™avancement et partagez un dossier sÃ©curisÃ©.",
      },
      {
        title: "Calendrier des appels dâ€™offres",
        body: "Gardez visibles Ã©chÃ©ances, jalons et rappels pour les opportunitÃ©s suivies.",
        detail:
          "Organisez les dates clÃ©s et rappels pour rÃ©duire les oublis de soumission, avec une chronologie partagÃ©e pour lâ€™Ã©quipe.",
      },
      {
        title: "Assistant questionnaires",
        body: "Structurez les questions et rÃ©digez des rÃ©ponses fondÃ©es sur des preuves avec Ã©tapes de vÃ©rification.",
        detail:
          "DÃ©tectez et organisez le contenu du questionnaire, rÃ©digez des brouillons basÃ©s sur les preuves disponibles et signalez ce qui nÃ©cessite encore une vÃ©rification humaine.",
      },
      {
        title: "Moteur de dÃ©cision",
        body: "Aboutissez Ã  BID, REVIEW ou NO-BID explicables Ã  partir de la prÃ©paration, de la qualification et des preuves.",
        detail:
          "Combinez les signaux de prÃ©paration avec le contexte des exigences et des preuves. La mÃ©moire et le simulateur de dÃ©cision soutiennent le jugement â€” ils ne remplacent pas la responsabilitÃ© de lâ€™Ã©quipe.",
      },
      {
        title: "Workflow de dÃ©cision dâ€™Ã©quipe",
        body: "Transformez une dÃ©cision en prochaines Ã©tapes assignÃ©es, vÃ©rifications et alertes exÃ©cutables.",
        detail:
          "CrÃ©ez des tÃ¢ches, joignez des preuves, fermez la boucle de vÃ©rification et utilisez alertes intelligentes et plan dâ€™action selon le plan.",
      },
    ],
    smartMatch: {
      eyebrow: "Smart Match Engine",
      title: "Voyez quelles opportunitÃ©s correspondent au profil de votre entreprise",
      body: "Smart Match Engine compare les signaux dâ€™opportunitÃ© au profil de votre entreprise pour prioriser la revue â€” au lieu de traiter chaque piste de la mÃªme faÃ§on.",
      benefit1: "Faites remonter les opportunitÃ©s alignÃ©es sur services, secteur et gÃ©ographie.",
      benefit2: "Utilisez qualifications, expÃ©rience et taille comme dimensions structurÃ©es.",
      benefit3: "Examinez les explications dâ€™adÃ©quation avant dâ€™engager le temps de lâ€™Ã©quipe.",
      dimensionsLabel: "Dimensions de correspondance",
      dimensions: [
        "Services",
        "Secteur",
        "GÃ©ographie",
        "Qualifications",
        "ExpÃ©rience",
        "Taille dâ€™entreprise",
      ],
      note: "Les scores guident lâ€™exploration et la revue. Ils ne garantissent ni Ã©ligibilitÃ©, ni couverture de tout le marchÃ©, ni attribution de contrats. Lâ€™accÃ¨s dÃ©pend de la configuration de lâ€™espace de travail.",
      ctaPrimary: "CrÃ©er le profil de votre entreprise",
      ctaSecondary: "Comment fonctionne Bidvera",
    },
    bottomTitle: "RÃ©unissez prÃ©paration, opportunitÃ©s et dÃ©cisions dans un seul espace",
    bottomBody:
      "Organisez ce que lâ€™entreprise a, vÃ©rifiez ce qui peut Ãªtre prouvÃ©, Ã©valuez ce qui est pertinent et dÃ©cidez quoi poursuivre â€” avec lâ€™Ã©quipe.",
    bottomCta: "Explorer Bidvera",
    howTitle: "Comment Ã§a fonctionne",
    howBody: "De la prÃ©paration de lâ€™entreprise Ã  une action confiante.",
    step1Title: "Comprendre",
    step1Body:
      "Construisez une image claire de lâ€™entreprise, des documents, des qualifications et de la prÃ©paration.",
    step2Title: "Organiser",
    step2Body:
      "Utilisez les demandes clients pour capturer le travail entrant, puis gardez les dates clÃ©s sur le calendrier.",
    step3Title: "VÃ©rifier",
    step3Body:
      "Comparez les exigences au profil, aux documents, aux qualifications et aux preuves.",
    step4Title: "DÃ©cider et agir",
    step4Body:
      "Aboutissez Ã  une dÃ©cision explicable, puis avancez via le workflow dâ€™Ã©quipe, les alertes et un plan dâ€™action clair.",
    beforeAfterTitle: "Dâ€™informations dispersÃ©es Ã  une action confiante",
    beforeAfterBody:
      "ArrÃªtez de reconstituer documents, qualifications et opportunitÃ©s depuis des endroits diffÃ©rents. Bidvera rÃ©unit prÃ©paration, preuves et dÃ©cisions.",
    beforeLabel: "Sans un workflow Bidvera structurÃ©",
    afterLabel: "Avec Bidvera",
    beforeItems: [
      "Documents, qualifications et preuves dispersÃ©s dans dossiers et boÃ®tes mail",
      "Peu clair quelles demandes vous Ãªtes rÃ©ellement prÃªts Ã  poursuivre",
      "Revue manuelle sans piste de preuve partagÃ©e",
      "DÃ©cisions sans propriÃ©tÃ© claire des prochaines actions",
    ],
    afterItems: [
      "Un espace pour lâ€™intelligence dâ€™entreprise, la prÃ©paration et les preuves vÃ©rifiÃ©es",
      "Travail entrant organisÃ© face Ã  la capacitÃ© rÃ©elle",
      "BID / REVIEW / NO-BID explicables, avec le raisonnement derriÃ¨re",
      "Prochaines actions assignÃ©es, alertes et un plan exÃ©cutable par lâ€™Ã©quipe",
    ],
    complianceEyebrow: "ConformitÃ© documentaire",
    complianceHeadline: "Gardez votre entreprise prÃªte, en permanence.",
    complianceBody:
      "Organisez les documents critiques, suivez les dates dâ€™expiration et maÃ®trisez les exigences de conformitÃ© depuis un espace sÃ©curisÃ©.",
    complianceBenefit1Title: "Restez organisÃ©",
    complianceBenefit1Body: "Tous les documents dâ€™entreprise dans un espace sÃ©curisÃ©.",
    complianceBenefit2Title: "Suivez les expirations",
    complianceBenefit2Body: "Voyez ce qui est valide et ce qui demande attention avant expiration.",
    complianceBenefit3Title: "PrÃªt pour les exigences",
    complianceBenefit3Body: "Sachez quels documents soutiennent la prochaine exigence.",
    compliancePanelTitle: "Documents dâ€™entreprise",
    complianceAddLabel: "Ajouter un document",
    complianceAlertTitle: "Lâ€™assurance expire bientÃ´t",
    complianceReadyLabel: "Vous Ãªtes prÃªts",
    complianceReadyHint: "Les documents clÃ©s sont suivis dans un seul espace.",
    complianceStatusValid: "Valide",
    complianceStatusExpiring: "Expire bientÃ´t",
    complianceDocTrade: "Licence commerciale",
    complianceDocTax: "Attestation fiscale",
    complianceDocInsurance: "Assurance",
    complianceDocQuality: "Certificat qualitÃ©",
    complianceDocFinancial: "Ã‰tats financiers",
    complianceDateTrade: "Valide jusquâ€™au 31 dÃ©c. 2026",
    complianceDateTax: "Valide jusquâ€™au 15 oct. 2026",
    complianceDateInsurance: "Expire le 28 nov. 2026",
    complianceDateQuality: "Valide jusquâ€™au 1 aoÃ»t 2027",
    complianceDateFinancial: "Valide jusquâ€™au 10 fÃ©v. 2027",
    pricingTeaserTitle: "Tarifs simples pour les Ã©quipes en croissance",
    pricingTeaserBody:
      "Commencez gratuitement. Passez Ã  un plan supÃ©rieur quand Bidvera fait gagner du temps rÃ©el â€” dÃ¨s {price}/mois sur Pro.",
    pricingTeaserCta: "Comparer les plans",
    viewAllFaq: "Voir toute la FAQ â†’",
    testimonialsTitle: "Ce que disent les Ã©quipes",
    testimonialsBody:
      "Retours rÃ©els dâ€™Ã©quipes qui utilisent Bidvera pour rester prÃªtes et dÃ©cider en confiance.",
    testimonialsEmptyTitle: "Retours des premiers clients",
    testimonialsEmptyBody:
      "Nous publions uniquement de vrais tÃ©moignages. Soyez parmi les premiÃ¨res Ã©quipes Ã  rÃ©unir prÃ©paration, preuves et dÃ©cisions â€” puis dites-nous comment cela sâ€™est passÃ©.",
    testimonialsEmptyCta: "Explorer Bidvera",
  },
  product: {
    eyebrow: "Produit",
    title: "Intelligence dâ€™entreprise. PrÃ©paration. DÃ©cisions explicables.",
    body: "Bidvera nâ€™est pas un rÃ©sumeur PDF gÃ©nÃ©rique. Câ€™est un espace de travail pour la prÃ©paration, la conformitÃ©, la qualification, les preuves, lâ€™intelligence dâ€™opportunitÃ©s et les dÃ©cisions explicables. SOUMISSIONNER / REVOIR / NE PAS SOUMISSIONNER est un rÃ©sultat du moteur de dÃ©cision â€” pas le produit entier.",
    step1Title: "Comprendre lâ€™entreprise",
    step1Body:
      "Construisez une vision vivante du profil, des documents, des qualifications et de la prÃ©paration.",
    step2Title: "Organiser ce qui est pertinent",
    step2Body:
      "Utilisez les demandes clients pour capturer le travail alignÃ© sur ce que votre entreprise peut rÃ©ellement livrer, et gardez les Ã©chÃ©ances au calendrier.",
    step3Title: "VÃ©rifier, dÃ©cider et agir",
    step3Body:
      "Analysez les exigences qui comptent, reliez les preuves, prenez des dÃ©cisions SOUMISSIONNER / REVOIR / NE PAS SOUMISSIONNER explicables, et transformez-les en prochaines actions avec lâ€™Ã©quipe.",
    seeTitle: "Ce avec quoi votre Ã©quipe travaille",
    seeItems: [
      "Profil entreprise, conformitÃ© documentaire et qualification fournisseur",
      "Demandes clients et calendrier des Ã©chÃ©ances",
      "Intelligence de preuves avec vÃ©rification sourcÃ©e",
      "RÃ©sultats du moteur de dÃ©cision : SOUMISSIONNER / REVOIR / NE PAS",
      "Justification explicable, mÃ©moire et simulateur de dÃ©cision",
      "Analyse dâ€™AO comme une Ã©tape du flux",
      "Assistant questionnaires et export PDF",
      "Flux dâ€™Ã©quipe, plan dâ€™action et alertes intelligentes",
    ],
    cta: "Explorer Bidvera",
    futureTitle: "CapacitÃ©s actives dans un seul espace",
    futureBody:
      "Bidvera couvre dÃ©jÃ  le socle entreprise, lâ€™intelligence dâ€™opportunitÃ©s, les preuves, les dÃ©cisions et lâ€™action dâ€™Ã©quipe.",
    highlightItems: [
      "Profil entreprise",
      "ConformitÃ© documentaire",
      "Demandes clients",
      "Intelligence de preuves",
      "Moteur de dÃ©cision",
      "Analyse dâ€™AO",
      "Flux de dÃ©cision dâ€™Ã©quipe",
      "Confiance et sÃ©curitÃ© IA",
    ],
  },
  pricing: {
    eyebrow: "Tarifs",
    title: "Un espace pour la prÃ©paration, les opportunitÃ©s et lâ€™action",
    body: "Commencez par un Free Workspace limitÃ©, ou essayez une offre pendant 14 jours. Les prix viennent des plans Bidvera en vigueur.",
    perMonth: "/mois",
    perMonthYearly: "/mois facturÃ© Ã  lâ€™annÃ©e",
    analysesSeats: "{analyses} analyses / mois Â· {seats} siÃ¨ges",
    seatsOnly: "{seats} siÃ¨ges",
    startFree: "Commencer gratuitement",
    startFreeWorkspace: "DÃ©marrer Free Workspace",
    startTrial: "DÃ©marrer lâ€™essai de 14 jours",
    startSubscription: "DÃ©marrer lâ€™abonnement",
    choose: "Choisir {plan}",
    monthly: "Mensuel",
    yearly: "Annuel",
    save: "Ã‰conomisez ~17%",
    recommended: "Le plus choisi",
    mostPopular: "IdÃ©al pour les Ã©quipes en croissance",
    trialBadge: "Essai gratuit de 14 jours",
    noChargeToday: "Aucun prÃ©lÃ¨vement aujourdâ€™hui",
    paymentMethodRequired: "Moyen de paiement requis",
    cancelBeforeTrial: "Annulez avant la fin de lâ€™essai pour Ã©viter le prÃ©lÃ¨vement.",
    freeHeadline: "Commencez gratuitement. Construisez lâ€™espace de votre entreprise.",
    freeLimitedNote: "Espace limitÃ© â€” profil entreprise et conformitÃ© documentaire uniquement.",
    comparisonTitle: "Comparer les offres",
    comparisonFeature: "CapacitÃ©",
    yearlyNote: "Les totaux annuels utilisent le prix configurÃ© de chaque offre. Le paiement utilise lâ€™intervalle choisi.",
    valueTitle1: "Un espace dâ€™intelligence dâ€™entreprise",
    valueBody1:
      "Organisez informations, conformitÃ©, qualifications, preuves et demandes au mÃªme endroit, puis agissez avec lâ€™Ã©quipe.",
    valueTitle2: "Des limites claires, sans usage cachÃ©",
    valueBody2: "SiÃ¨ges et limites dâ€™usage sont affichÃ©s sur chaque offre. Ce que vous voyez est inclus.",
    valueTitle3: "Essayez une offre, puis dÃ©cidez",
    valueBody3:
      "Les offres Ã©ligibles incluent 14 jours dâ€™essai avec un moyen de paiement. Annulez avant la fin si vous ne souhaitez pas dÃ©marrer lâ€™abonnement.",
    ctaTitle: "PrÃªts Ã  garder lâ€™entreprise prÃ©parÃ©e ?",
    ctaBody: "Commencez par Free Workspace, ou choisissez une offre et essayez Bidvera 14 jours.",
    groups: {
      readiness: "PrÃ©paration de lâ€™entreprise",
      opportunities: "OpportunitÃ©s et demandes",
      intelligence: "Intelligence et dÃ©cisions",
      workflow: "IA et flux de travail",
    },
    features: {
      company_profile: "Profil entreprise",
      document_compliance: "ConformitÃ© documentaire",
      supplier_qualification: "Qualification fournisseur",
      client_requests: "Demandes clients",
      tender_calendar: "Calendrier",
      evidence_intelligence: "Intelligence de preuves",
      advanced_decision_engine: "Moteur de dÃ©cision",
      decision_memory: "MÃ©moire de dÃ©cision",
      decision_simulator: "Simulateur de dÃ©cision",
      explainable_decision: "DÃ©cision explicable",
      tender_analysis: "Analyse dâ€™appels dâ€™offres",
      questionnaire_assistant: "Assistant questionnaires",
      smart_alerts: "Alertes intelligentes",
      team_collaboration: "Flux de dÃ©cision dâ€™Ã©quipe",
      pdf_export: "Export PDF",
      tender_action_plan: "Plan dâ€™action",
    },
  },
  faq: {
    eyebrow: "FAQ",
    title: "Des rÃ©ponses claires",
    items: [
      {
        q: "Quâ€™est-ce que Bidvera ?",
        a: "Bidvera est un espace de travail dâ€™intelligence dâ€™entreprise qui aide les sociÃ©tÃ©s Ã  organiser leurs informations, gÃ©rer la conformitÃ©, Ã©valuer des opportunitÃ©s pertinentes, travailler avec les preuves et agir en confiance.",
      },
      {
        q: "Comment Bidvera aide-t-il Ã  maintenir mon entreprise prÃªte ?",
        a: "Bidvera rassemble le profil entreprise, les qualifications et les documents clÃ©s pour que votre Ã©quipe maintienne une base mÃ©tier fiable et Ã  jour.",
      },
      {
        q: "Comment fonctionne Document Compliance ?",
        a: "Suivez les documents importants, surveillez les dates dâ€™expiration et recevez des alertes lorsquâ€™une attention est nÃ©cessaire, pour garder votre entreprise prÃ©parÃ©e.",
      },
      {
        q: "Comment Bidvera aide-t-il avec les opportunitÃ©s et demandes clients ?",
        a: "Les Ã©quipes peuvent capturer les demandes clients, suivre les Ã©chÃ©ances au calendrier, et Ã©valuer les exigences par rapport au profil, aux capacitÃ©s et aux qualifications.",
      },
      {
        q: "Bidvera peut-il aider avec les demandes clients et les questionnaires ?",
        a: "Oui. Les Ã©quipes peuvent gÃ©rer les demandes clients et utiliser le Questionnaire Assistant pour organiser et rÃ©pondre aux informations requises plus efficacement.",
      },
      {
        q: "Comment Bidvera utilise-t-il les preuves ?",
        a: "Evidence Intelligence relie les informations dâ€™entreprise, les qualifications et les preuves Ã  lâ€™appui pour que les Ã©quipes comprennent ce qui est vÃ©rifiÃ©, ce qui nÃ©cessite attention et pourquoi.",
      },
      {
        q: "Mon Ã©quipe peut-elle collaborer dans Bidvera ?",
        a: "Oui. Team Decision Workflow aide les membres Ã  travailler ensemble, assigner les responsabilitÃ©s, examiner les informations et coordonner les prochaines actions dans un seul espace.",
      },
      {
        q: "Bidvera est-il sÃ©curisÃ© ?",
        a: "Bidvera est conÃ§u avec un accÃ¨s contrÃ´lÃ©, lâ€™isolation des locataires et des protections de sÃ©curitÃ© pour que lâ€™espace et les informations de chaque entreprise restent sÃ©parÃ©s.",
      },
      {
        q: "Puis-je essayer Bidvera avant de mâ€™abonner ?",
        a: "Oui. Vous pouvez commencer avec lâ€™essai gratuit disponible et explorer la plateforme avant de choisir un abonnement.",
      },
    ],
  },
  auth: {
    loginTitle: "Connexion",
    loginBody: "AccÃ©dez Ã  lâ€™espace Bidvera de votre entreprise.",
    emailChangedNotice:
      "Votre e-mail a Ã©tÃ© mis Ã  jour. Connectez-vous avec la nouvelle adresse. Les autres sessions ont Ã©tÃ© fermÃ©es.",
    sideHeadline: "Sachez quoi poursuivre. Sachez pour quoi vous Ãªtes prÃªts.",
    sideBody:
      "Bidvera aide votre Ã©quipe Ã  organiser la prÃ©paration, vÃ©rifier les preuves, Ã©valuer des opportunitÃ©s et dÃ©cider en confiance.",
    sidePillMatched: "CORRESPONDANCE â€” Une opportunitÃ© adaptÃ©e a Ã©tÃ© trouvÃ©e pour lâ€™entreprise.",
    sidePillReview: "REVUE â€” Examinez les dÃ©tails de lâ€™opportunitÃ© et sa pertinence.",
    sidePillNotAMatch: "PAS DE CORRESPONDANCE â€” Lâ€™opportunitÃ© ne correspond pas au profil de lâ€™entreprise.",
    signupTitle: "CrÃ©ez votre compte Bidvera",
    signupBody: "Email et mot de passe dâ€™abord. Lâ€™entreprise ensuite.",
    name: "Votre nom",
    companyName: "Nom de lâ€™entreprise",
    email: "Email professionnel",
    password: "Mot de passe",
    confirmPassword: "Confirmer le mot de passe",
    submitLogin: "Connexion",
    submitSignup: "CrÃ©er un compte",
    haveAccount: "Vous avez dÃ©jÃ  un compte ?",
    newHere: "Nouveau sur Bidvera ?",
    acceptTerms: "Jâ€™accepte les Conditions et la Politique de confidentialitÃ©.",
    acceptTermsLead: "Jâ€™accepte les",
    acceptTermsJoiner: "et la",
    termsOfServiceLink: "Conditions dâ€™utilisation",
    privacyPolicyLink: "Politique de confidentialitÃ©",
    acceptTermsError: "Vous devez accepter les Conditions et la Politique.",
    continueGoogle: "Continuer avec Google",
    googleComingSoon: "Connexion Google bientÃ´t disponible",
    googleOAuthError: "Ã‰chec de la connexion Google. RÃ©essayez.",
    continueMicrosoft: "Continuer avec Microsoft",
    microsoftComingSoon: "Connexion Microsoft bientÃ´t disponible",
    forgotPassword: "Mot de passe oubliÃ© ?",
    forgotTitle: "RÃ©initialiser le mot de passe",
    forgotBody: "Nous enverrons un lien unique si le compte existe.",
    forgotSubmit: "Envoyer le lien",
    forgotSent: "Si lâ€™email est enregistrÃ©, le lien est en route.",
    resetTitle: "Choisissez un nouveau mot de passe",
    resetBody: "Au moins 12 caractÃ¨res.",
    resetSubmit: "Mettre Ã  jour",
    passwordMismatch: "Les mots de passe ne correspondent pas.",
  },
  assistant: {
    askLabel: "Demander Ã  Bidvera",
    title: "Assistant Bidvera AI",
    description:
      "Posez des questions sur Bidvera, la prÃ©paration, les opportunitÃ©s, les preuves ou les prochaines Ã©tapes. RÃ©ponses Bidvera AI ; voix via TTS sÃ©curisÃ©.",
    placeholder: "Posez une questionâ€¦",
    send: "Envoyer",
    thinking: "RÃ©flexionâ€¦",
    play: "Lecture",
    pause: "Pause",
    mute: "Muet",
    unmute: "Son",
    voiceUnavailable: "La voix est indisponible. Vous pouvez lire la rÃ©ponse.",
    errorGeneric: "Impossible dâ€™obtenir une rÃ©ponse. RÃ©essayez.",
    attachImage: "Joindre une image",
    removeImage: "Retirer lâ€™image",
    imageOnlyOne: "Une seule image est autorisÃ©e.",
    imageTooLarge: "Image trop volumineuse (max. 4 Mo).",
    imageInvalid: "Utilisez JPEG, PNG, WebP ou GIF.",
    imageQuotaReached: "Envoi dâ€™images verrouillÃ© â€” 1 image / 4 h pour ce navigateur et cette adresse.",
    replyQuotaReached: "Envoi verrouillÃ© â€” 10 rÃ©ponses utilisÃ©es (rÃ©initialisation dans 4 h).",
  },
  app: {
    nav: {
      dashboard: "Tableau de bord",
      tenders: "Analyse dâ€™AO",
      tenderCalendar: "Calendrier des AO",
      documentCompliance: "ConformitÃ© documentaire",
      supplierQualification: "Qualification fournisseur",
      clientRequests: "Demandes clients",
      questionnaireAssistant: "Assistant questionnaires",
      matchedOpportunities: "OpportunitÃ©s correspondantes",
      company: "Profil entreprise",
      billing: "Facturation",
      alerts: "Alertes",
      settings: "ParamÃ¨tres",
      decisionMemory: "MÃ©moire de dÃ©cision",
      teamWorkflow: "Flux dâ€™Ã©quipe",
      sectionCapabilities: "CapacitÃ©s",
      sectionWorkspace: "Espace de travail",
      sectionAccount: "Compte",
    },
    shell: {
      tagline: "VÃ©rifiez avant de soumissionner.",
      analyzeTender: "Analyser un AO",
      upgrade: "Passer au plan supÃ©rieur",
      signOut: "Se dÃ©connecter",
      openMenu: "Ouvrir le menu",
      closeMenu: "Fermer le menu",
      decisionWorkspace: "Espace Bidvera",
      yourCompany: "Votre entreprise",
      workspace: "Espace de travail",
    },
    dashboard: {
      eyebrow: "Vue exÃ©cutive",
      title: "Tableau de bord",
      subtitle:
        "Que faire ensuite, quels AO valent la peine dâ€™Ãªtre poursuivis, et ce qui vous bloque.",
      analyzeCta: "Analyser un AO",
      activeTenders: "AO actifs",
      inPipeline: "En pipeline",
      bid: "Soumissionner",
      pursue: "Poursuivre",
      review: "Revoir",
      verifyFirst: "VÃ©rifier dâ€™abord",
      noBid: "Ne pas soumissionner",
      skipEffort: "Ã‰viter lâ€™effort",
      upcomingDeadlines: "Ã‰chÃ©ances Ã  venir",
      upcomingEmpty: "Aucune Ã©chÃ©ance dans les deux prochaines semaines.",
      upcomingCalendarDeadlines: "Ã‰chÃ©ances Ã  venir",
      upcomingCalendarHint:
        "From Tender Calendar â€” same deadlines shown in the calendar module",
      upcomingCalendarEmpty: "Aucune Ã©chÃ©ance calendrier Ã  venir pour le moment.",
      addCalendarTender: "Ajouter un appel dâ€™offres au calendrier",
      highRisk: "AO Ã  haut risque",
      highRiskEmpty: "Aucun AO Ã  risque Ã©levÃ© ou critique pour le moment.",
      recentAnalyses: "Analyses rÃ©centes",
      recentEmpty:
        "Aucune analyse pour lâ€™instant. DÃ©posez un AO pour obtenir votre premiÃ¨re dÃ©cision.",
      viewAll: "Tout voir",
      due: "Ã‰chÃ©ance",
      analyzed: "AnalysÃ©",
      decisionDistribution: "RÃ©partition des dÃ©cisions",
      decisionDistributionHint: "Part des rÃ©sultats BID / REVIEW / NO-BID terminÃ©s",
      upcomingHint: "Appels d'offres encore au calendrier",
      uploadTender: "TÃ©lÃ©verser un appel d'offres",
      riskOverview: "Vue des risques",
      riskOverviewHint: "Exposition critique ou Ã©levÃ©e Ã  la disqualification",
      recentHint: "Derniers rÃ©sultats go / no-go",
      platformTitle: "Ce que vous pouvez faire dans Bidvera",
      platformHint: "Four capabilities in one product â€” open any module to continue.",
      capabilityAnalysisDesc: "TÃ©lÃ©versez des dossiers et obtenez des dÃ©cisions go / no-go.",
      capabilityComplianceDesc: "Suivez les documents mÃ©tier et les rappels dâ€™expiration.",
      capabilityQualificationDesc:
        "Supplier readiness for bids and questionnaires â€” not your workspace Company Profile.",
      capabilityCalendarDesc: "Suivez les Ã©chÃ©ances dâ€™opportunitÃ©s et les rappels.",
      capabilityOpen: "Ouvrir",
      capabilityGetStarted: "Commencer",
      capabilityUpgrade: "Passez Ã  une offre supÃ©rieure pour dÃ©bloquer",
      statusAnalyses: "{count} analyses",
      statusDocuments: "{count} documents",
      statusCompleteness: "{percent}% complÃ©tÃ©",
      statusDeadlines: "{count} Ã  venir",
      statusLocked: "Non inclus dans votre offre actuelle",
      gettingStartedTitle: "Prochaines Ã©tapes suggÃ©rÃ©es",
      gettingStartedHint: "Pick any path â€” you can come back anytime.",
    },
    onboarding: {
      signOutHint: "Compte",
      stepVerify: "VÃ©rifier lâ€™email",
      stepCompany: "Entreprise",
      stepPlan: "Offre",
      verifyTitle: "VÃ©rifiez votre email",
      verifyBody: "Nous avons envoyÃ© un lien Ã ",
      resend: "Renvoyer lâ€™email de vÃ©rification",
      resent: "Email de vÃ©rification envoyÃ©.",
      verifyInvalidTitle: "Lien invalide ou expirÃ©",
      verifyInvalidBody: "Demandez un nouvel email depuis lâ€™onboarding.",
      companyTitle: "Parlez-nous de votre entreprise",
      companyBody:
        "Cela aide Bidvera Ã  Ã©valuer lâ€™adÃ©quation dâ€™un appel dâ€™offres avec votre activitÃ©.",
      companyName: "Nom de lâ€™entreprise",
      country: "Pays / localisation dâ€™activitÃ©",
      industry: "Secteur dâ€™activitÃ©",
      companySize: "Taille de lâ€™entreprise",
      services: "Services / capacitÃ©s principales",
      servicesHint: "Ajoutez plusieurs tags â€” EntrÃ©e aprÃ¨s chacun.",
      experience: "Niveau dâ€™expÃ©rience",
      experienceOptional: "facultatif",
      privacyNote:
        "Nous utilisons ces informations uniquement pour personnaliser Bidvera et amÃ©liorer lâ€™analyse dâ€™adÃ©quation. Nous nâ€™avons pas besoin dâ€™informations sensibles.",
      companySubmit: "Continuer",
      companySkip: "Passer pour lâ€™instant",
      planTitle: "Choisissez comment dÃ©marrer",
      planBody: "Commencez par Free Workspace ou choisissez une offre. Les offres Stripe Ã©ligibles incluent 14 jours dâ€™essai.",
      trialTitle: "Essai de 14 jours",
      trialBody: "Un moyen de paiement est requis. Aucun prÃ©lÃ¨vement aujourdâ€™hui. Lâ€™offre choisie dÃ©marre automatiquement sauf annulation.",
      trialCta: "DÃ©marrer lâ€™essai de 14 jours",
      paidCta: "DÃ©marrer lâ€™abonnement",
      freeTitle: "Free Workspace",
      freeBody: "Commencez gratuitement. Espace limitÃ© au profil entreprise et Ã  la conformitÃ© documentaire.",
      freeCta: "DÃ©marrer Free Workspace",
      noChargeToday: "Aucun prÃ©lÃ¨vement aujourdâ€™hui",
      paymentMethodRequired: "Moyen de paiement requis",
      cancelBeforeTrial: "Annulez avant la fin de lâ€™essai pour Ã©viter le prÃ©lÃ¨vement.",
      monthly: "Mensuel",
      yearly: "Annuel",
      checkoutCanceled: "Paiement annulÃ©. RÃ©essayez quand vous voulez.",
      checkoutPending: "Paiement reÃ§u â€” activation en coursâ€¦",
    },
    companyProfile: {
      title: "Profil entreprise",
      subtitle:
        "UtilisÃ© pour lâ€™adÃ©quation entrepriseâ€“appel dâ€™offres dans les analyses futures. PrivÃ© Ã  votre organisation â€” aucune donnÃ©e personnelle ou financiÃ¨re sensible nâ€™est requise.",
      headerHint:
        "AmÃ©liorez la qualitÃ© dâ€™adÃ©quation au fil du temps. Les changements sâ€™appliquent uniquement aux analyses futures.",
      supplierQualificationHint:
        "Besoin de dÃ©tails dâ€™enregistrement et de preuves prÃªts Ã  soumissionner ? Utilisez",
      supplierQualificationLink: "Qualification fournisseur",
      companyName: "Nom de lâ€™entreprise",
      completeness: "ComplÃ©tude",
      savedTitle: "EnregistrÃ©",
      savedBody:
        "Profil mis Ã  jour. Lâ€™analyse utilisera les derniÃ¨res informations sur le prochain appel dâ€™offres.",
      saveErrorTitle: "Enregistrement impossible",
      basicsTitle: "Informations de base",
      basicsBody:
        "Uniquement pour lâ€™analyse dâ€™adÃ©quation â€” aucune donnÃ©e personnelle ou financiÃ¨re sensible.",
      industry: "Secteur",
      country: "Pays",
      companySize: "Taille de lâ€™entreprise",
      notProvided: "Non renseignÃ©",
      experienceLevel: "Niveau dâ€™expÃ©rience (facultatif)",
      experienceYears: "AnnÃ©es dâ€™expÃ©rience (facultatif)",
      experienceYearsPlaceholder: "ex. 5",
      revenueRange: "Fourchette de revenus (facultatif)",
      revenuePlaceholder: "ex. Â£2mâ€“Â£5m",
      employees: "Effectifs (facultatif)",
      employeesPlaceholder: "ex. 50â€“100",
      sizeSolo: "IndÃ©pendant",
      sizeSmall: "Petite",
      sizeMedium: "Moyenne",
      sizeEnterprise: "Grande",
      expNew: "Nouvelle / expÃ©rience limitÃ©e",
      expSome: "Quelque expÃ©rience",
      expExperienced: "ExpÃ©rimentÃ©e",
      expHighly: "TrÃ¨s expÃ©rimentÃ©e",
      capabilitiesTitle: "CapacitÃ©s et couverture",
      services: "Services",
      certifications: "Certifications",
      geographicCoverage: "Couverture gÃ©ographique",
      commaSeparated: "SÃ©parÃ©s par des virgules",
      contractTitle: "PrÃ©fÃ©rences contractuelles",
      contractMin: "Taille minimale de contrat (Â£)",
      contractMax: "Taille maximale de contrat (Â£)",
      rulesTitle: "RÃ¨gles de qualification personnalisÃ©es",
      rulesBody: "Une rÃ¨gle par ligne. Elles deviennent des filtres lors de lâ€™analyse.",
      save: "Enregistrer le profil",
      learningTitle: "Consentement Ã  lâ€™apprentissage global",
      learningBody:
        "Si activÃ©, Bidvera peut contribuer des motifs de rÃ©sultats filtrÃ©s pour la confidentialitÃ© (jamais de noms dâ€™entreprise, documents, stratÃ©gies ou historiques identifiables) Ã  la couche dâ€™apprentissage globale. Vos rÃ©sultats privÃ©s restent isolÃ©s par locataire. Vous pouvez vous retirer Ã  tout moment.",
      learningCheckbox:
        "Contribuer des rÃ©sultats anonymisÃ©s aux motifs globaux vÃ©rifiÃ©s",
      learningSaving: "(enregistrementâ€¦)",
    },
    billing: {
      title: "Facturation",
      subtitle: "Offre actuelle, renouvellement, historique des paiements et factures.",
      activatedTitle: "Abonnement activÃ©",
      activatedBody: "Votre offre est active. Les plafonds sont mis Ã  jour immÃ©diatement.",
      trialEndedTitle: "Essai terminÃ©",
      trialEndedBody:
        "Votre essai gratuit est terminÃ©. Lâ€™analyse dâ€™appels dâ€™offres est indisponible jusquâ€™Ã  une mise Ã  niveau.",
      viewPlans: "Voir les offres â†’",
      currentPlanTitle: "Offre actuelle",
      currentPlanBody: "Statut de lâ€™abonnement et cycle de facturation",
      plan: "Offre",
      status: "Statut",
      provider: "Fournisseur",
      billingCycle: "Cycle de facturation",
      renewal: "Renouvellement",
      paymentMethod: "Moyen de paiement",
      changePlan: "Changer dâ€™offre",
      upgradePlan: "Mettre Ã  niveau",
      cancelSubscription: "Annuler lâ€™abonnement",
      cancelScheduled: "Annulation prÃ©vue en fin de pÃ©riode.",
      upgradesTitle: "Mises Ã  niveau disponibles",
      upgradesBody: "{count} offres visibles avec passerelles activÃ©es",
      upgradesBodyOne: "1 offre visible avec passerelles activÃ©es",
      openCheckout: "Ouvrir le paiement â†’",
      paymentHistory: "Historique des paiements",
      noPayments: "Aucun paiement pour le moment.",
      invoices: "Factures",
      noInvoices: "Aucune facture pour le moment.",
      viewInvoice: "Voir",
      trialFallback: "Essai",
      usageTitle: "Usage de lâ€™espace",
      trialUsageTitle: "Usage de lâ€™essai",
      trialEndedDesc:
        "Votre essai gratuit est terminÃ© â€” mettez Ã  niveau pour analyser davantage dâ€™appels dâ€™offres.",
      unlimitedDesc: "{plan} Â· Analyses illimitÃ©es Â· {status}",
      remainingDesc: "{remaining} sur {limit} analyses gratuites restantes",
      trialEnds: "Lâ€™essai se termine le {date}",
      expired: "Â· ExpirÃ©",
      analysesUsed: "Analyses utilisÃ©es",
      used: "UtilisÃ©es",
      remaining: "Restantes",
      unlimited: "IllimitÃ©es",
      hoursSaved: "Heures estimÃ©es gagnÃ©es",
      risksDetected: "Risques dÃ©tectÃ©s",
      upgradeContinue: "Mettre Ã  niveau pour continuer",
      runningLow: "Quota bas ?",
      seePlans: "Voir les offres",
      trialBadge: "Essai gratuit de 14 jours",
      trialEndsIn: "Votre essai se termine dans {days} jours",
      trialEndsInOne: "Votre essai se termine dans 1 jour",
      trialEndingToday: "Votre essai se termine aujourdâ€™hui",
      trialEndsOn: "Se termine le {date}",
      noChargeToday: "Aucun prÃ©lÃ¨vement aujourdâ€™hui.",
      paymentMethodRequired: "Un moyen de paiement est requis",
      trialAutoConvert:
        "Lâ€™abonnement choisi commence automatiquement Ã  la fin de lâ€™essai, sauf annulation avant cette date.",
      cancelTrial: "Annuler lâ€™essai",
      cancelTrialTitle: "Annuler lâ€™essai ?",
      cancelTrialExplainConvert: "Lâ€™essai ne se convertira pas en abonnement payant.",
      cancelTrialExplainAccess:
        "AprÃ¨s lâ€™essai, lâ€™accÃ¨s suit les rÃ¨gles de Free Workspace.",
      cancelTrialExplainData: "Les donnÃ©es de lâ€™entreprise sont conservÃ©es.",
      cancelPaidTitle: "Annuler lâ€™abonnement ?",
      cancelPaidExplainDate: "Lâ€™annulation prend effet le {date}.",
      cancelPaidExplainAccess: "Vous conservez lâ€™accÃ¨s jusquâ€™Ã  cette date.",
      cancelPaidExplainAfter:
        "Ensuite, lâ€™espace passe en Free Workspace. Les documents, demandes, preuves et lâ€™historique ne sont pas supprimÃ©s.",
      confirmCancel: "Confirmer lâ€™annulation",
      keepPlan: "Conserver lâ€™offre",
      cancellationDate: "Date dâ€™annulation",
      accessUntil: "Lâ€™accÃ¨s reste disponible jusquâ€™au {date}.",
      freeWorkspace: "Free Workspace",
      freeWorkspaceBody:
        "Espace limitÃ©. Profil dâ€™entreprise et conformitÃ© documentaire limitÃ©e sont inclus. Les capacitÃ©s payantes ne le sont pas.",
      freeCapabilityProfile: "Profil dâ€™entreprise",
      freeCapabilityCompliance: "ConformitÃ© documentaire (limitÃ©e)",
      nextBillingDate: "Prochaine date de facturation",
      usage: "Usage",
      paymentFailed: "Paiement Ã©chouÃ©",
      pastDue: "En retard",
      statusTrialing: "En essai",
      statusActive: "Actif",
      statusCanceled: "AnnulÃ©",
      statusUnpaid: "ImpayÃ©",
      statusExpired: "ExpirÃ©",
      statusIncomplete: "Incomplet",
      monthlyInterval: "Mensuel",
      yearlyInterval: "Annuel",
      seatsUsage: "SiÃ¨ges",
      aiUsage: "Usage IA",
      analysesUsage: "Analyses",
      analysesNotIncluded: "Non inclus",
      cancelError: "Impossible dâ€™annuler pour le moment. RÃ©essayez ou contactez le support.",
      started: "DÃ©but",
      paypalMethod: "PayPal",
      graceTitle: "ProblÃ¨me de paiement â€” pÃ©riode de grÃ¢ce",
      graceBody:
        "Le paiement a Ã©chouÃ©. Lâ€™accÃ¨s continue jusquâ€™au {date}. Mettez Ã  jour la facturation pour Ã©viter lâ€™interruption.",
      inactiveTitle: "Abonnement inactif",
      inactiveBody:
        "Votre abonnement nâ€™est pas actif. Les donnÃ©es de lâ€™entreprise sont conservÃ©es. Renouvelez ou mettez Ã  niveau pour rÃ©tablir les capacitÃ©s payantes.",
      billingHistory: "Historique de facturation",
      billingHistoryEmpty:
        "Aucune facture pour le moment. Elles apparaissent ici aprÃ¨s un prÃ©lÃ¨vement rÃ©ussi ou Ã©chouÃ©.",
      invoiceDate: "Date",
      invoiceAmount: "Montant",
      invoiceStatus: "Statut",
      viewReceipt: "Voir le reÃ§u",
      updatePaymentMethod: "Mettre Ã  jour le moyen de paiement",
      retryPayment: "RÃ©gulariser le paiement",
      paymentProblemTitle: "ProblÃ¨me de paiement",
      paymentProblemBody:
        "Le paiement de lâ€™abonnement nâ€™a pas pu Ãªtre encaissÃ©. Mettez Ã  jour le moyen de paiement pour conserver lâ€™accÃ¨s.",
      paypalManageHint:
        "PayPal gÃ¨re le moyen de paiement de cet abonnement dans votre compte PayPal.",
      paymentPortalError:
        "Impossible dâ€™ouvrir la page de paiement sÃ©curisÃ©e. RÃ©essayez ou contactez le support.",
      canceledAlertTitle: "Votre abonnement est annulÃ©",
      subscriptionEndedTitle: "Votre abonnement a pris fin",
      subscriptionEndedBody:
        "Votre espace de travail est en sÃ©curitÃ©, mais certaines fonctionnalitÃ©s premium sont dÃ©sormais verrouillÃ©es.",
      choosePlan: "Choisir un plan",
      graceDaysRemaining: "Il vous reste {days} jours pour rÃ©soudre le paiement.",
      graceDaysRemainingOne: "Il vous reste 1 jour pour rÃ©soudre le paiement.",
    },
    alerts: {
      title: "Alertes",
      subtitle: "Ã‰chÃ©ances, Decision Memory, scores, exigences et flux de travail.",
      emptyTitle: "Pas encore dâ€™alertes",
      emptyDescription: "Les notifications dâ€™Ã©chÃ©ances, risques et analyses apparaÃ®tront ici.",
      newBadge: "Nouveau",
      markAllRead: "Tout marquer comme lu",
      unreadCount: "{count} non lues",
    },
    settings: {
      title: "ParamÃ¨tres",
      subtitle: "PrÃ©fÃ©rences du compte et valeurs par dÃ©faut de lâ€™espace de travail.",
      accountTitle: "Compte",
      accountBody: "Utilisateur connectÃ©",
      name: "Nom",
      email: "E-mail",
      avatarLabel: "Photo de profil",
      avatarHint: "AffichÃ©e dans la barre supÃ©rieure. JPG, PNG, WebP ou GIF Â· max. 5 Mo.",
      avatarUpload: "TÃ©lÃ©verser une photo",
      avatarUploading: "TÃ©lÃ©versementâ€¦",
      avatarRemove: "Supprimer",
      accountSave: "Enregistrer les modifications",
      accountSaving: "Enregistrementâ€¦",
      accountSaved: "Compte mis Ã  jour.",
      emailChangeHint:
        "Changer lâ€™e-mail exige votre mot de passe et un lien de confirmation Ã  la nouvelle adresse.",
      emailChangePending: "Confirmation en attente pour {email}.",
      emailChangeSent:
        "VÃ©rifiez {email} pour le lien de confirmation. Votre e-mail actuel reste actif jusquâ€™Ã  confirmation.",
      emailChangeResend: "Renvoyer la confirmation",
      emailChangeResent: "Confirmation renvoyÃ©e Ã  {email}.",
      emailChangeExpires: "Expire le {when}.",
      emailChangePasswordLabel: "Mot de passe actuel",
      emailChangePasswordHint: "Requis pour demander un changement dâ€™e-mail.",
      emailChangePasswordRequired: "Saisissez votre mot de passe actuel pour changer lâ€™e-mail.",
      emailChangeCancel: "Annuler le changement dâ€™e-mail",
      emailChangeCancelled: "Changement dâ€™e-mail annulÃ©.",
      emailChangeInvalidTitle: "Lien invalide ou expirÃ©",
      emailChangeInvalidBody: "Demandez un nouveau lien depuis les ParamÃ¨tres.",
      emailChangeBackSettings: "Retour aux ParamÃ¨tres",
      companyProfileTitle: "Profil de lâ€™entreprise",
      companyProfileBody:
        "Secteur, taille, services, pays et expÃ©rience utilisÃ©s pour lâ€™adÃ©quation entrepriseâ€“appel dâ€™offres sur les analyses futures. PrivÃ© Ã  votre organisation.",
      editCompanyProfile: "Modifier le profil de lâ€™entreprise",
      notificationsTitle: "Notifications",
      notificationsBody:
        "Alertes dâ€™Ã©chÃ©ances et dâ€™analyse â€” dans lâ€™app et par e-mail. WhatsApp / SMS / push pourront Ãªtre branchÃ©s plus tard.",
      moduleRemindersTitle: "Planifications de rappels par module",
      moduleRemindersBody: "La conformitÃ© documentaire et le calendrier ont leurs propres dÃ©calages de rappel.",
      complianceRemindersLink: "Rappels de conformitÃ© documentaire",
      calendarRemindersLink: "Rappels du calendrier",
      planTitle: "Offre",
      planUnlimited: "Business Â· IllimitÃ© Â· {used} utilisÃ©s",
      planLimited: "{used}/{limit} analyses utilisÃ©es",
      manageBilling: "GÃ©rer la facturation",
      viewUpgrade: "Voir les options de mise Ã  niveau",
      signOut: "Se dÃ©connecter",
      revokeOtherSessions: "DÃ©connecter les autres appareils",
      revokeOtherSessionsHint: "Cette session reste active.",
      timezone: "Fuseau horaire de lâ€™entreprise",
      timezoneHint: "UtilisÃ© pour le texte des alertes dâ€™Ã©chÃ©ance et lâ€™affichage de lâ€™heure locale.",
      channels: "Canaux",
      channelInApp: "Alertes dans lâ€™app",
      channelEmail: "E-mail",
      channelWhatsapp: "WhatsApp (bientÃ´t)",
      channelSms: "SMS (bientÃ´t)",
      channelPush: "Push (bientÃ´t)",
      deadlineAlerts: "Alertes dâ€™Ã©chÃ©ance",
      deadline7d: "7 jours avant",
      deadline3d: "3 jours avant",
      deadline24h: "24 heures avant",
      deadlinePassed: "Ã‰chÃ©ance dÃ©passÃ©e",
      otherAlerts: "Autres alertes",
      alertAnalysisDone: "Analyse terminÃ©e",
      alertHighRisk: "Constats Ã  haut risque",
      alertMissingDocs: "Documents manquants",
      alertScoreChange: "Changements de score ou de dÃ©cision",
      alertRequirementStatus: "Changements dâ€™Ã©tat des exigences",
      alertDecisionMemory: "Decision Memory pertinente",
      alertWorkflow: "Ã‰vÃ©nements de flux / dossier",
      prefsSaved: "PrÃ©fÃ©rences enregistrÃ©es.",
      savePrefs: "Enregistrer les prÃ©fÃ©rences de notification",
    },
    tenders: {
      title: "Appels dâ€™offres",
      subtitle: "{count} appels dâ€™offres Â· filtrer par dÃ©cision, risque et Ã©chÃ©ance",
      subtitleOne: "1 appel dâ€™offres Â· filtrer par dÃ©cision, risque et Ã©chÃ©ance",
      analyzeCta: "Analyser un appel dâ€™offres",
      emptyTitle: "Pas encore dâ€™appels dâ€™offres",
      emptyDescription:
        "TÃ©lÃ©versez un ITT ou PQQ pour obtenir une recommandation Bid / Review / No-Bid.",
      search: "Recherche",
      searchPlaceholder: "Titre ou client",
      decision: "DÃ©cision",
      allDecisions: "Toutes les dÃ©cisions",
      bid: "Soumettre",
      review: "RÃ©viser",
      noBid: "Ne pas soumettre",
      risk: "Risque",
      allRiskLevels: "Tous les niveaux",
      low: "Faible",
      medium: "Moyen",
      high: "Ã‰levÃ©",
      critical: "Critique",
      deadline: "Ã‰chÃ©ance",
      anyDeadline: "Toute Ã©chÃ©ance",
      next7d: "7 prochains jours",
      next14d: "14 prochains jours",
      next30d: "30 prochains jours",
      overdue: "En retard",
      sort: "Tri",
      sortRecent: "RÃ©cemment analysÃ©s",
      sortDeadlineSoon: "Ã‰chÃ©ance la plus proche",
      sortDeadlineLate: "Ã‰chÃ©ance la plus lointaine",
      sortFit: "Score dâ€™adÃ©quation",
      sortTitle: "Titre Aâ€“Z",
      colTender: "Appel dâ€™offres",
      colClient: "Client",
      colDeadline: "Ã‰chÃ©ance",
      colFit: "AdÃ©quation",
      colDecision: "DÃ©cision",
      colRisk: "Risque",
      colAnalyzed: "AnalysÃ©",
      colNextAction: "Prochaine action",
      deadlineWithDate: "Ã‰chÃ©ance {date}",
      fitWithScore: "AdÃ©quation {score}",
      noNextAction: "Aucune action suivante",
    },
    upload: {
      title: "Analyser un appel dâ€™offres",
      subtitle:
        "TÃ©lÃ©versez un ITT ou PQQ pour obtenir une recommandation Bid / Review / No-Bid.",
      trialLeft: "Essai Â· {remaining} analyses restantes",
      trialEnds: " Â· se termine le {date}",
      phaseIdleTitle: "TÃ©lÃ©verser un dossier dâ€™appel dâ€™offres",
      phaseIdleBody:
        "TÃ©lÃ©versez plusieurs fichiers ou un package ZIP/RAR. Nous nous concentrons sur la dÃ©cision â€” pas sur un dump brut du document.",
      phaseUploadingTitle: "TÃ©lÃ©versementâ€¦",
      phaseUploadingBody: "Transfert sÃ©curisÃ© de vos fichiers.",
      phaseDiscoveringTitle: "DÃ©couverte des fichiersâ€¦",
      phaseDiscoveringBody: "Inventaire de chaque document du dossier dâ€™appel dâ€™offres.",
      phaseExtractingTitle: "Extraction du packageâ€¦",
      phaseExtractingBody: "DÃ©compression ZIP/RAR et dÃ©couverte des documents dâ€™appel dâ€™offres.",
      phasePreparingTitle: "PrÃ©paration des documentsâ€¦",
      phasePreparingBody: "Validation des fichiers et prÃ©paration du dossier pour lâ€™analyse.",
      phaseProcessingTitle: "Traitement du documentâ€¦",
      phaseProcessingBody: "En file pour extraction et structuration des exigences.",
      phaseAnalyzingTitle: "Analyse de lâ€™adÃ©quationâ€¦",
      phaseAnalyzingBody:
        "Correspondance au profil, rÃ¨gles et gÃ©nÃ©ration dâ€™une dÃ©cision.",
      phaseSuccessTitle: "Analyse prÃªte",
      phaseSuccessBody: "Votre pack de dÃ©cision est disponible.",
      phaseErrorTitle: "Ã‰chec du tÃ©lÃ©versement",
      phaseErrorBody:
        "Une erreur sâ€™est produite lors du tÃ©lÃ©versement ou de la prÃ©paration du dossier. VÃ©rifiez les fichiers et rÃ©essayez.",
      phaseAnalysisErrorTitle: "Lâ€™analyse nâ€™a pas pu aboutir",
      phaseAnalysisErrorBody:
        "Votre dossier a bien Ã©tÃ© tÃ©lÃ©versÃ© et prÃ©parÃ©. Lâ€™Ã©chec sâ€™est produit pendant lâ€™analyse â€” ouvrez lâ€™appel dâ€™offres pour plus de dÃ©tails.",
      phaseTimeoutBody:
        "Toujours en cours aprÃ¨s 1 minute. Ouvrez lâ€™appel dâ€™offres sous peu â€” lâ€™analyse peut se terminer en arriÃ¨re-plan.",
      phaseTimeoutTitle: "Toujours en cours",
      stillWorking: "Lâ€™analyse continue en arriÃ¨re-plan",
      openTender: "Ouvrir lâ€™appel dâ€™offres",
      trialUsedTitle: "Analyses dâ€™essai Ã©puisÃ©es",
      trialUsedBody: "Passez Ã  une offre supÃ©rieure pour analyser davantage.",
      viewPlans: "Voir les offres",
      unlimitedPlan: "Analyses illimitÃ©es sur votre offre Business active",
      remainingAnalyses: "{count} analyses gratuites restantes",
      dragHere: "Glissez-dÃ©posez vos fichiers ou packages ZIP/RAR ici",
      processingTender: "Traitement de votre dossier dâ€™appel dâ€™offresâ€¦",
      fileTypes: "PDF, Word, Excel, PowerPoint, CSV, TXT, images, ZIP/RAR Â· jusquâ€™Ã  {max} fichiers par dossier Â· max {maxFileMb}MB par fichier Â· max {maxPackageMb}MB par dossier",
      chooseFile: "Choisir des fichiers",
      filesSelected: "{count} fichiers sÃ©lectionnÃ©s",
      maxFilesReached: "Jusquâ€™Ã  {max} fichiers par dossier.",
      filesDiscovered: "{count} fichiers dÃ©couverts dans le dossier",
      removeFile: "Retirer",
      statusReady: "PrÃªt",
      statusUploading: "TÃ©lÃ©versementâ€¦",
      statusDiscovering: "DÃ©couverteâ€¦",
      statusExtracting: "Extractionâ€¦",
      statusPreparing: "PrÃ©parationâ€¦",
      statusProcessing: "Traitementâ€¦",
      statusAnalyzing: "Analyseâ€¦",
      startUpload: "TÃ©lÃ©verser et analyser",
      waitForUpload: "Attendez la fin du tÃ©lÃ©versement en cours avant dâ€™ajouter dâ€™autres fichiers.",
      bodyTooLarge:
        "Le dossier est trop volumineux pour cette requÃªte. RÃ©duisez le nombre de fichiers, ou redÃ©marrez lâ€™app aprÃ¨s lâ€™augmentation de la limite puis rÃ©essayez.",
      decisionReady: "DÃ©cision prÃªte â€” ouvrez le pack ci-dessous.",
      unableContinue: "Impossible de continuer",
      openDecision: "Ouvrir la dÃ©cision",
      uploadAnother: "TÃ©lÃ©verser un autre",
      tryAgain: "RÃ©essayer",
      creditsExhausted:
        "Vous avez utilisÃ© toutes les analyses gratuites. Passez Ã  une offre supÃ©rieure pour continuer.",
      passwordRequiredTitle: "Mot de passe requis",
      passwordRequiredBody:
        "Ce fichier est protÃ©gÃ© par mot de passe. Saisissez le mot de passe pour continuer.",
      passwordLabel: "Mot de passe de lâ€™archive",
      passwordSubmit: "DÃ©verrouiller et continuer",
      passwordCancel: "Annuler",
      passwordWrong: "Mot de passe incorrect. RÃ©essayez.",
      intakeRepairedTitle: "RÃ©parÃ© automatiquement",
      intakePartialTitle: "Partiellement lisible",
      intakeIncompleteTitle: "Dossier incomplet",
      intakeReadyTitle: "PrÃªt pour lâ€™analyse",
      intakeBlockedTitle: "Analyse bloquÃ©e",
      intakeUnsupportedTitle: "Format non pris en charge",
      intakeCorruptedTitle: "Fichier corrompu",
      intakePartiallyReadableTitle: "Partiellement lisible2",
    },
    tenderDetail: {
      backToTenders: "â† Appels dâ€™offres",
      unknownClient: "Client inconnu",
      deadline: "Ã‰chÃ©ance",
      analyzed: "AnalysÃ©",
      fullReport: "Rapport complet",
      analysisInProgressTitle: "Analyse en cours",
      analysisInProgressBody:
        "Statut : {status}. Actualisez sous peu â€” le traitement est en cours.",
      analysisFailedTitle: "Ã‰chec de lâ€™analyse",
      analysisFailedBody:
        "Le traitement sâ€™est terminÃ© par un Ã©chec dÃ©finitif. Voir le dÃ©tail de lâ€™erreur ci-dessous.",
      analysisFailedPhase: "ArrÃªt Ã  la phase : {phase}",
      canonicalNote:
        "Analyse canonique â€” les mÃªmes exigences, conformitÃ©, adÃ©quation, prÃ©paration, risques, Bid Score et recommandation pour chaque utilisateur autorisÃ©. Les rÃ´les contrÃ´lent uniquement lâ€™accÃ¨s.",
      missingDocuments: "Documents manquants",
      required: "Obligatoire",
      nextActions: "Prochaines actions",
      noNextActions: "Aucune action recommandÃ©e pour cette dÃ©cision.",
      teamWorkflow: {
        title: "Flux de dÃ©cision dâ€™Ã©quipe",
        subtitle:
          "Assignez exigences, risques et preuves manquantes Ã  Finance, Juridique, Technique, etc. Les rÃ©ponses sont des preuves â€” elles ne modifient pas automatiquement le Decision Engine.",
        empty: "Aucune tÃ¢che dâ€™Ã©quipe pour lâ€™instant.",
        criticalBanner:
          "{count} tÃ¢che(s) critique(s) non rÃ©solue(s) avant la dÃ©cision finale.",
        assign: "Assigner",
        respond: "Enregistrer la rÃ©ponse",
        complete: "Terminer avec rÃ©ponse",
        create: "CrÃ©er une tÃ¢che",
        responsePlaceholder: "RÃ©ponse vÃ©rifiÃ©e (ne rien inventer)â€¦",
        evidencePlaceholder: "Note de preuve (optionnel)â€¦",
        department: "DÃ©partement",
        assignee: "AssignÃ©",
        requiredResponse: "RÃ©ponse requise",
        linkedItem: "Ã‰lÃ©ment liÃ©",
      },
      decisionSupport: "Aide Ã  la dÃ©cision",
      fitSuffix: "AdÃ©quation",
      overallFit: "AdÃ©quation globale",
      confidence: "Confiance",
      confidenceHigh: "Ã‰LEVÃ‰E",
      confidenceMedium: "MOYENNE",
      confidenceLow: "FAIBLE",
      heroBidLabel: "Bidvera recommande de poursuivre",
      heroBidHint:
        "Dâ€™aprÃ¨s les informations fournies, lâ€™adÃ©quation justifie lâ€™effort â€” vÃ©rifiez avant soumission.",
      heroReviewLabel: "Bidvera recommande une revue",
      heroReviewHint:
        "AmbiguÃ¯tÃ©s, Ã©carts ou inconnues nÃ©cessitent une confirmation humaine avant engagement.",
      heroNoBidLabel: "Bidvera recommande de ne pas poursuivre",
      heroNoBidHint:
        "Dâ€™aprÃ¨s les donnÃ©es disponibles, des Ã©carts critiques rendent lâ€™effort peu rentable â€” confirmez avec votre Ã©quipe.",
      companyTenderFit: "AdÃ©quation entrepriseâ€“appel dâ€™offres",
      unknown: "Inconnu",
      basisAi: " Â· Ã‰valuation IA",
      basisNotProvided: " Â· Non fourni",
      basisFromProfile: " Â· Depuis le profil entreprise",
      basisFromTender: " Â· Depuis lâ€™appel dâ€™offres",
      tenderReadiness: "PrÃ©paration de lâ€™appel dâ€™offres",
      readinessCounts: "{ready} prÃªts Â· {verify} Ã  vÃ©rifier Â· {missing} manquants",
      recommendation: "Recommandation :",
      keyBlockers: "Blocages clÃ©s",
      keyBlockersNext:
        "Prochaine Ã©tape : rÃ©soudre les points signalÃ©s avant la dÃ©cision finale.",
      whyTitle: "Pourquoi cette recommandation ?",
      executiveSummary: "RÃ©sumÃ© exÃ©cutif",
      viewDetails: "Voir les dÃ©tails",
      hideDetails: "Masquer les dÃ©tails",
      topReasons: "Raisons clÃ©s",
      criticalAlerts: "Points critiques",
      whatToDoNext: "Prochaines actions",
      decisionDisclaimer:
        "Bidvera fournit une recommandation fondÃ©e sur les preuves. La dÃ©cision finale reste celle de votre entreprise.",
      expiredDeadlineAlert:
        "La date limite de soumission est dÃ©passÃ©e â€” confirmez si lâ€™appel dâ€™offres est encore ouvert.",
      mandatoryGapAlert: "Ã‰cart obligatoire",
      missingDocumentAlert: "Document manquant",
      detailedAnalysisTitle: "Analyse dÃ©taillÃ©e",
      detailedAnalysisHint:
        "Exigences, conformitÃ©, preuves, risques, adÃ©quation et workflow â€” mÃªmes donnÃ©es canoniques que le rapport.",
    },
    report: {
      backToTender: "â† Appel dâ€™offres",
      title: "Rapport dâ€™analyse",
      subtitle:
        "Dossier de dÃ©cision complet â€” consulter, imprimer, tÃ©lÃ©charger en PDF ou partager un lien en lecture seule.",
      reportNotReady: "Rapport pas encore prÃªt",
      reportNotReadyBody:
        "Ce rapport nâ€™est pas encore prÃªt. RÃ©essayez dans un instant.",
      print: "Imprimer",
      downloadPdf: "TÃ©lÃ©charger le PDF",
      shareLink: "Partager le lien",
      copied: "CopiÃ©.",
      shareExpires: "Expire dans 72 h Â· lecture seule :",
      revokeShare: "RÃ©voquer les liens partagÃ©s",
      shareRevoked: "Liens partagÃ©s rÃ©voquÃ©s.",
      reportEyebrow: "Rapport de dÃ©cision Bidvera",
      unknownClient: "Client inconnu",
      deadline: "Ã‰chÃ©ance",
      analyzed: "AnalysÃ©",
      recommendation: "Recommandation",
      companyTenderFit: "AdÃ©quation entrepriseâ€“appel dâ€™offres",
      confidence: "Confiance",
      whyTitle: "Pourquoi cette recommandation",
      bidScore: "Score dâ€™offre",
      bidScoreLine: "Score dâ€™offre : {score}/100 â€” {priority}",
      expectedValue: "Valeur attendue :",
      risk: "Risque :",
      effort: "Effort :",
      positive: "Positif",
      negative: "NÃ©gatif",
      overall: "Global",
      unknown: "Inconnu",
      tenderReadiness: "PrÃ©paration de lâ€™appel dâ€™offres",
      readinessCounts: "{ready} prÃªts Â· {verify} Ã  vÃ©rifier Â· {missing} manquants",
      nextStep: "Prochaine Ã©tape :",
      complianceMatrix: "Matrice de conformitÃ©",
      requirements: "Exigences",
      ready: "PrÃªt",
      missing: "Manquant",
      verify: "Ã€ vÃ©rifier",
      notApplicable: "Non applicable",
      withSources: "Avec sources",
      mandatory: "Obligatoire",
      optional: "Facultatif",
      evidenceLabel: "Preuve :",
      noExcerpt: "Aucun extrait justificatif disponible.",
      page: "Page {n}",
      sourceNotLocated: "La source nâ€™a pas pu Ãªtre localisÃ©e prÃ©cisÃ©ment.",
      noRequirements: "Aucune exigence nâ€™a Ã©tÃ© extraite pour cet appel dâ€™offres.",
      missingRequirements: "Exigences manquantes",
      noMissingRequirements: "Aucune exigence manquante identifiÃ©e.",
      mandatoryParen: " (obligatoire)",
      verificationItems: "Points Ã  vÃ©rifier",
      nothingPendingVerify: "Rien en attente de vÃ©rification.",
      risks: "Risques",
      noRisks: "Aucun risque significatif signalÃ©.",
      clarifications: "Questions de clarification",
      noClarifications:
        "Aucune question de clarification gÃ©nÃ©rÃ©e â€” aucune ambiguÃ¯tÃ© pertinente dÃ©tectÃ©e.",
      reason: "Motif :",
      source: "Source :",
      evidence: "Preuves",
      noEvidence: "Aucun extrait de source disponible.",
      historicalTitle: "Intelligence historique pertinente",
      historicalBody:
        "Des rÃ©sultats historiques similaires peuvent fournir un signal utile pour cette opportunitÃ©. Câ€™est un signal supplÃ©mentaire â€” pas une garantie de succÃ¨s ou dâ€™Ã©chec.",
      historicalPriority:
        "Les preuves de lâ€™appel dâ€™offres actuel et votre profil entreprise ont toujours la prioritÃ©.",
      historicalEmpty:
        "Aucun schÃ©ma historique vÃ©rifiÃ© ne sâ€™applique encore Ã  cette opportunitÃ©.",
      decisionMemoryTitle: "MÃ©moire de dÃ©cision",
      currentAnalysisLabel: "Analyse actuelle",
      historicalDecisionLabel: "DÃ©cision historique",
      decisionMemoryCurrentNote:
        "Les scores, exigences et la recommandation ci-dessus font autoritÃ© pour cet appel dâ€™offres et ne sont pas modifiÃ©s par lâ€™historique.",
      decisionMemoryEmpty:
        "Aucune dÃ©cision antÃ©rieure pertinente pour cette opportunitÃ© pour le moment.",
      relevanceReasons: "Pourquoi câ€™est pertinent",
      missingDocuments: "Documents manquants",
      nextActions: "Prochaines actions recommandÃ©es",
      noNextActions: "Aucune action recommandÃ©e.",
      basisDirect: "Source directe",
      basisAi: "InterprÃ©tation IA",
      basisUncertain: "Source incertaine",
      evidenceVerificationTitle: "Preuves et vÃ©rification",
      evidenceVerificationDisclaimer:
        "La vÃ©rification reflÃ¨te uniquement les preuves enregistrÃ©es et la revue humaine. Les interprÃ©tations IA ne sont jamais traitÃ©es comme vÃ©rifiÃ©es.",
      verificationSummary:
        "{verified} vÃ©rifiÃ©s Â· {needs} Ã  vÃ©rifier Â· {missing} preuves manquantes Â· {na} non applicable",
      noVerificationChains: "Aucune chaÃ®ne de vÃ©rification disponible pour cet appel d'offres.",
      verificationStatusVerified: "VÃ©rifiÃ©",
      verificationStatusNeedsVerification: "Ã€ vÃ©rifier",
      verificationStatusMissingEvidence: "Preuve manquante",
      verificationStatusNotApplicable: "Non applicable",
      verifierLabel: "VÃ©rificateur :",
      verifiedAtLabel: "VÃ©rifiÃ© le :",
      decisionOutcomeTitle: "RÃ©sultat de la dÃ©cision",
      decisionOutcomeBidvera: "DÃ©cision Bidvera",
      decisionOutcomeHuman: "DÃ©cision humaine finale",
      decisionOutcomeActual: "RÃ©sultat rÃ©el",
      decisionOutcomeDate: "Date du rÃ©sultat",
      decisionOutcomeReason: "Motif du rÃ©sultat",
      decisionOutcomeSuccess: "DÃ©cision vs rÃ©sultat",
      decisionOutcomeSuccessAligned: "La dÃ©cision initiale correspond au rÃ©sultat",
      decisionOutcomeSuccessMisaligned: "La dÃ©cision initiale ne correspond pas au rÃ©sultat",
      decisionOutcomeSuccessPending: "RÃ©sultat encore en attente",
      decisionOutcomeSuccessNeutral: "Neutre par rapport Ã  la dÃ©cision initiale",
      decisionOutcomeRecorded: "RÃ©sultat enregistrÃ©",
      outcomeLearningTitle: "Intelligence historique basÃ©e sur les rÃ©sultats",
      decisionOutcomeAttachment: "Document justificatif",
      decisionOutcomeEvalSuccessful: "RÃ©ussi",
      decisionOutcomeEvalUnsuccessful: "Non rÃ©ussi",
      decisionOutcomeEvalNotEvaluated: "Non Ã©valuÃ©",
    },
    decisionMemory: {
      title: "MÃ©moire de dÃ©cision",
      subtitle:
        "DÃ©cisions dâ€™appels dâ€™offres antÃ©rieures de votre entreprise â€” rÃ©fÃ©rence uniquement. Ne modifie jamais lâ€™analyse en cours.",
      emptyTitle: "Aucune dÃ©cision enregistrÃ©e",
      emptyDescription:
        "Les analyses terminÃ©es apparaissent ici automatiquement. Ouvrez un appel dâ€™offres pour comparer Analyse actuelle et DÃ©cision historique.",
      emptyDescriptionCompanyContext:
        "Les dÃ©cisions enregistrÃ©es apparaissent ici lorsque Decision Intelligence consigne un rÃ©sultat pour votre entreprise. Maintenez qualifications et preuves Ã  jour pour donner un contexte solide aux dÃ©cisions futures.",
      viewTender: "Ouvrir lâ€™appel dâ€™offres",
      openCompanyProfile: "Ouvrir le profil entreprise",
      analyzed: "AnalysÃ©",
      scores: "Scores",
      requirements: "Exigences",
      risks: "Risques",
      reasoning: "Raisonnement",
      relevance: "Pertinence",
      disclaimer:
        "DÃ©cision historique â€” rÃ©fÃ©rence uniquement. Ne modifie pas les scores ni la recommandation de lâ€™Analyse actuelle.",
      back: "Retour Ã  la MÃ©moire de dÃ©cision",
    },
    pwa: {
      availableOn: "Disponible sur Windows et macOS",
      updateTitle: "Mise Ã  jour prÃªte",
      updateBody:
        "Une nouvelle version bureau de Bidvera est disponible. Rechargez pour lâ€™appliquer.",
      updateNow: "Mettre Ã  jour",
      installedTitle: "Bidvera est installÃ©e",
      installedBody:
        "Vous Ãªtes en mode application bureau â€” accÃ¨s plus rapide depuis le dock ou la barre des tÃ¢ches.",
      title: "Installer Bidvera comme application bureau",
      bodyBefore: "Fonctionne sur",
      bodyAnd: "et",
      bodyAfter: "â€” sâ€™ouvre dans sa propre fenÃªtre, sans App Store.",
      installCta: "Installer Bidvera",
      openingInstaller: "Ouverture de lâ€™installateurâ€¦",
      dismiss: "Fermer",
      guideTitleSafari: "Installer Bidvera dans Safari",
      guideTitleEdge: "Installer Bidvera dans Edge",
      guideTitleChrome: "Installer Bidvera dans Chrome",
      guideTitleDefault: "Installer Bidvera",
      guideDescription:
        "Suivez ces Ã©tapes pour ajouter Bidvera comme application bureau.",
      desktopMeta: "Application bureau Â· Windows et macOS",
      openInstallDialog: "Ouvrir la boÃ®te dâ€™installation",
      gotIt: "Compris",
      iosStep1: "Appuyez sur le bouton Partager dans Safari.",
      iosStep2: "Choisissez",
      iosStep2Strong: "Sur lâ€™Ã©cran dâ€™accueil",
      iosStep3: "Confirmez â€” Bidvera sâ€™ouvre en plein Ã©cran depuis lâ€™accueil.",
      safariMacStep1: "Dans la barre de menus, ouvrez",
      safariMacStep1Strong: "Fichier",
      safariMacStep2: "Choisissez",
      safariMacStep2Strong: "Ajouter au Dock",
      safariMacStep3: "Confirmez â€” Bidvera apparaÃ®t dans le Dock comme une app Mac.",
      chromiumStep1Before:
        "Regardez Ã  droite de la barre dâ€™adresse de {browser} lâ€™icÃ´ne",
      chromiumStep1Strong: "installer / ordinateur",
      chromiumStep1After: ".",
      chromiumStep2Before: "Cliquez puis choisissez",
      chromiumStep2Strong: "Installer",
      chromiumStep3Before: "Ou ouvrez le menu du navigateur â†’",
      chromiumStep3Install: "Installer Bidvera",
      chromiumStep3Mid: "/",
      chromiumStep3Apps: "Applications â†’ Installer ce site en tant quâ€™application",
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

/** @deprecated use getDictionary â€” exposed for structural tests */
export function getCoreDictionary(locale: Locale): Dictionary {
  return dictionaries[locale] ?? dictionaries.en;
}
