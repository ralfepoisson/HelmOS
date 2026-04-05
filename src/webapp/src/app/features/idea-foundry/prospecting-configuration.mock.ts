import { ProspectingConfigurationSnapshot } from './prospecting-configuration.models';

export const PROSPECTING_CONFIGURATION_MOCK: ProspectingConfigurationSnapshot = {
  agentState: 'active',
  strategyMode: 'Focused search',
  lastRun: 'Today, 09:20',
  nextRun: 'Today, 14:00',
  objective: {
    name: 'Recurring operational pain in fragmented service sectors',
    description:
      'Surface repeated workflow problems that signal persistent administrative burden, coordination failure, or compliance-heavy work that founders and operators still manage with manual effort.',
    targetDomain: 'SMB and mid-market service businesses in Europe',
    searchPosture: 'Targeted exploration',
    includeKeywords: 'compliance burden, monthly admin, rota gaps, invoicing friction, reconciliation, scheduling chaos',
    excludeThemes: 'pure venture news, generic AI hype, enterprise transformation marketing, founder inspiration content',
    operatorNote:
      'Keep the search anchored in concrete day-to-day pain. Prioritise evidence that the workflow repeats frequently and is painful enough to create workarounds.'
  },
  strategySummary:
    'The current strategy leans into repeated operational friction that appears in conversational sources before it becomes visible in polished market reports.',
  steeringHypothesis: 'Prioritise recurring compliance pain in fragmented service sectors.',
  strategyPatterns: [
    {
      id: 'workflow-pain-discovery',
      label: 'Workflow pain discovery',
      description: 'Look for evidence that a recurring task is brittle, manual, or operationally expensive.',
      selected: true,
      priority: 'High'
    },
    {
      id: 'complaint-mining',
      label: 'Complaint mining',
      description: 'Mine complaint language that reveals frustration, repeated effort, or workaround behaviour.',
      selected: true,
      priority: 'High'
    },
    {
      id: 'underserved-niche-search',
      label: 'Underserved niche search',
      description: 'Focus on narrow segments where pain is real but tooling remains weak or fragmented.',
      selected: true,
      priority: 'Medium'
    },
    {
      id: 'adjacent-market-transfer',
      label: 'Adjacent market transfer',
      description: 'Find patterns that may transfer from one domain to another with minimal adaptation.',
      selected: false,
      priority: 'Low'
    },
    {
      id: 'regulatory-friction',
      label: 'Regulatory / operational friction',
      description: 'Seek mandatory workflows where complexity or compliance creates repeated burden.',
      selected: true,
      priority: 'High'
    },
    {
      id: 'labour-intensive-workflow',
      label: 'Labour-intensive workflow discovery',
      description: 'Look for people-heavy processes that scale poorly and depend on manual coordination.',
      selected: true,
      priority: 'Medium'
    }
  ],
  themes: [
    {
      id: 'theme-1',
      label: 'recurring admin burden',
      status: 'active',
      priority: 'High',
      rationale: 'Repeated monthly work is a strong signal of durable pain and monetisable urgency.'
    },
    {
      id: 'theme-2',
      label: 'fragmented compliance workflows',
      status: 'active',
      priority: 'High',
      rationale: 'Compliance tasks tend to combine frequency, risk, and switching costs.'
    },
    {
      id: 'theme-3',
      label: 'staffing coordination failures',
      status: 'active',
      priority: 'Medium',
      rationale: 'Scheduling pain often shows up clearly in operator communities and job-related discussions.'
    },
    {
      id: 'theme-4',
      label: 'manual reconciliation pain',
      status: 'active',
      priority: 'Medium',
      rationale: 'Manual reconciliation hints at spreadsheet dependence and expensive hidden labour.'
    },
    {
      id: 'theme-5',
      label: 'cross-border complexity',
      status: 'active',
      priority: 'Medium',
      rationale: 'Cross-border friction increases workflow entropy and can create strong product wedges.'
    },
    {
      id: 'theme-6',
      label: 'last-minute scheduling pressure',
      status: 'paused',
      priority: 'Low',
      rationale: 'Still relevant, but currently secondary to recurring administrative and compliance workflows.'
    }
  ],
  sources: [
    {
      id: 'source-1',
      label: 'Reddit / forums',
      description: 'Unfiltered complaint language and workaround discussions from operators and practitioners.',
      enabled: true,
      freshness: 'Fresh',
      signalType: 'Complaints and repeated friction',
      noiseProfile: 'Balanced',
      reviewFrequency: 'Every run'
    },
    {
      id: 'source-2',
      label: 'App reviews',
      description: 'Evidence of where incumbent tools break down in live workflows.',
      enabled: true,
      freshness: 'Fresh',
      signalType: 'Tool dissatisfaction and missing capabilities',
      noiseProfile: 'Balanced',
      reviewFrequency: 'Daily'
    },
    {
      id: 'source-3',
      label: 'Niche communities',
      description: 'Higher-context conversations in specialist groups and industry communities.',
      enabled: true,
      freshness: 'Stable',
      signalType: 'Role-specific pain and jargon-rich evidence',
      noiseProfile: 'Low noise',
      reviewFrequency: 'Daily'
    },
    {
      id: 'source-4',
      label: 'Job boards',
      description: 'Proxy for repeated manual work and staffing-heavy processes.',
      enabled: false,
      freshness: 'Stable',
      signalType: 'Process clues and labour intensity',
      noiseProfile: 'Balanced',
      reviewFrequency: 'Twice weekly'
    },
    {
      id: 'source-5',
      label: 'Product review sites',
      description: 'Structured evidence of software gaps, friction, and unmet needs.',
      enabled: true,
      freshness: 'Stable',
      signalType: 'Capability gaps and recurring complaints',
      noiseProfile: 'Low noise',
      reviewFrequency: 'Every other day'
    },
    {
      id: 'source-6',
      label: 'News / industry publications',
      description: 'Broader context for regulation, market shifts, and structural pressure.',
      enabled: true,
      freshness: 'Fresh',
      signalType: 'Context and triggering events',
      noiseProfile: 'High noise',
      reviewFrequency: 'Daily'
    },
    {
      id: 'source-7',
      label: 'Academic / reports',
      description: 'Supporting context for deeper validation and structural patterns.',
      enabled: false,
      freshness: 'Aging',
      signalType: 'Longer-horizon validation',
      noiseProfile: 'Low noise',
      reviewFrequency: 'Weekly'
    },
    {
      id: 'source-8',
      label: 'Search trend inputs',
      description: 'Directional search demand that can hint at emerging operational pain.',
      enabled: true,
      freshness: 'Fresh',
      signalType: 'Trend shifts and topic acceleration',
      noiseProfile: 'Balanced',
      reviewFrequency: 'Daily'
    }
  ],
  queryFamilies: [
    {
      id: 'query-1',
      title: 'Complaint language around invoicing / VAT / reminders',
      intent: 'Detect recurring frustration around mandatory administrative work and financial follow-up.',
      representativeQueries: [
        'hate doing VAT reminders every month',
        'manual invoice follow up small business',
        'why is monthly invoicing still spreadsheet based'
      ],
      themeLink: 'fragmented compliance workflows',
      sourceApplicability: ['Reddit / forums', 'App reviews', 'Niche communities'],
      status: 'Active',
      confidence: 'Promising',
      expanded: true,
      priorityRank: 1
    },
    {
      id: 'query-2',
      title: 'Urgent rota / scheduling breakdowns',
      intent: 'Find last-minute staffing and shift coordination pain that causes operational disruption.',
      representativeQueries: [
        'rota fell apart again short notice cover',
        'how do clinics manage emergency shift gaps',
        'manual scheduling chaos healthcare practice'
      ],
      themeLink: 'staffing coordination failures',
      sourceApplicability: ['Niche communities', 'Job boards', 'News / industry publications'],
      status: 'Watch',
      confidence: 'Useful',
      expanded: false,
      priorityRank: 4
    },
    {
      id: 'query-3',
      title: 'Spreadsheet-based manual coordination pain',
      intent: 'Identify workflows still glued together by spreadsheets, inboxes, and ad hoc handoffs.',
      representativeQueries: [
        'still tracking this in spreadsheets every week',
        'manual reconciliation workflow too much admin',
        'operations team spreadsheet nightmare small business'
      ],
      themeLink: 'manual reconciliation pain',
      sourceApplicability: ['Reddit / forums', 'Product review sites', 'App reviews'],
      status: 'Active',
      confidence: 'Promising',
      expanded: false,
      priorityRank: 2
    },
    {
      id: 'query-4',
      title: '“I hate doing this every month” recurring burden patterns',
      intent: 'Capture repeated monthly or quarterly chores that imply durable pain frequency.',
      representativeQueries: [
        'i hate doing this every month business admin',
        'monthly compliance task takes forever',
        'quarterly reporting manual process rant'
      ],
      themeLink: 'recurring admin burden',
      sourceApplicability: ['Reddit / forums', 'Search trend inputs', 'Niche communities'],
      status: 'Active',
      confidence: 'Promising',
      expanded: true,
      priorityRank: 3
    },
    {
      id: 'query-5',
      title: 'Workarounds and shadow-process discussions',
      intent: 'Find evidence that teams created unofficial workarounds because existing tools do not fit reality.',
      representativeQueries: [
        'we built our own workaround for this process',
        'using whatsapp and spreadsheets because software fails',
        'shadow process to manage compliance workload'
      ],
      themeLink: 'cross-border complexity',
      sourceApplicability: ['Reddit / forums', 'App reviews', 'Product review sites'],
      status: 'Paused',
      confidence: 'Watching',
      expanded: false,
      priorityRank: 5
    }
  ],
  signalRules: [
    {
      id: 'rule-1',
      title: 'Favour repeated mentions over isolated anecdotes',
      description: 'Repeated pain across multiple conversations is stronger than a single vivid complaint.',
      enabled: true,
      strictness: 'High'
    },
    {
      id: 'rule-2',
      title: 'Suppress duplicates and near-duplicates',
      description: 'Remove repeated captures so the source queue stays legible and varied.',
      enabled: true,
      strictness: 'High'
    },
    {
      id: 'rule-3',
      title: 'Favour clear problem evidence over vague trend commentary',
      description: 'Prefer grounded descriptions of operational pain over generic market observations.',
      enabled: true,
      strictness: 'High'
    },
    {
      id: 'rule-4',
      title: 'Favour signals with operational pain, frequency, or cost clues',
      description: 'Prioritise evidence that the pain happens often and creates measurable burden.',
      enabled: true,
      strictness: 'Medium'
    },
    {
      id: 'rule-5',
      title: 'Down-rank purely promotional content',
      description: 'Reduce the influence of sales-led content that overstates urgency without real operator evidence.',
      enabled: true,
      strictness: 'Medium'
    },
    {
      id: 'rule-6',
      title: 'Prefer language that implies workaround behaviour',
      description: 'Signals become stronger when people describe hacks, side processes, or patched-together systems.',
      enabled: true,
      strictness: 'Medium'
    }
  ],
  cadence: {
    runMode: 'Scheduled',
    cadence: 'Every 4 hours',
    maxResultsPerRun: 40,
    reviewThreshold: 'Only promote signals with repeated evidence or strong cost/frequency clues',
    geographicScope: 'United Kingdom, Ireland, Benelux, DACH',
    languageScope: 'English first, then Dutch and German review queues',
    budgetGuardrail: 'Medium API budget, with forum-heavy search favoured over expensive report pulls'
  },
  recentMetrics: [
    {
      label: 'Signals captured this week',
      value: '128',
      trend: 'up',
      helper: 'Up from last week as forum coverage widened.'
    },
    {
      label: 'Promoted to source queue',
      value: '34',
      trend: 'steady',
      helper: 'Promotion volume is stable after duplicate tightening.'
    },
    {
      label: 'Duplicate suppression rate',
      value: '27%',
      trend: 'up',
      helper: 'More repeat chatter is being condensed before queue entry.'
    },
    {
      label: 'Weak-signal discard rate',
      value: '41%',
      trend: 'down',
      helper: 'Lower discard rate suggests better query-theme alignment.'
    },
    {
      label: 'Strongest source type recently',
      value: 'Forums',
      trend: 'up',
      helper: 'Forum complaint language is producing the clearest operator evidence.'
    }
  ],
  recentChanges: [
    {
      id: 'change-1',
      title: 'Added “cross-border complexity” theme',
      detail: 'Expanded the theme set to capture pain in multi-country service workflows.',
      timestamp: 'Today, 08:10'
    },
    {
      id: 'change-2',
      title: 'Paused job boards source',
      detail: 'Reduced lower-signal staffing proxy searches while compliance themes are being prioritised.',
      timestamp: 'Yesterday, 17:40'
    },
    {
      id: 'change-3',
      title: 'Increased weight for complaint mining',
      detail: 'Complaint-led search patterns were upgraded to high priority.',
      timestamp: 'Yesterday, 15:05'
    },
    {
      id: 'change-4',
      title: 'Tightened duplicate suppression rule',
      detail: 'Raised strictness after several forum clusters produced repetitive captures.',
      timestamp: 'Monday, 11:20'
    }
  ]
};
