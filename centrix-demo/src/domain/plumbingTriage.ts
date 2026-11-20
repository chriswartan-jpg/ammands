export type PlumbingRoute = 'plumbing' | 'not_plumbing' | 'uncertain'

export type PlumbingSubtype =
  | 'leak'
  | 'blocked_drain'
  | 'toilet'
  | 'hot_water'
  | 'water_pressure'
  | 'fixture'
  | 'general'

export interface Classification {
  route: PlumbingRoute
  subtype?: PlumbingSubtype
  confidence: 'high' | 'medium' | 'low'
  label: string
  evidence: string[]
  explanation: string
}

export interface FollowUpOption {
  value: string
  label: string
}

export interface FollowUpQuestion {
  id: string
  fact: string
  text: string
  options: FollowUpOption[]
}

export interface IntakeTriage {
  classification: Classification
  questions: FollowUpQuestion[]
}

export interface FollowUpAnswer {
  questionId: string
  fact: string
  question: string
  value: string
  label: string
}

const PLUMBING_SIGNALS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(pipe|pipes|plumb(?:er|ing)?)\b/i, label: 'pipe or plumbing mentioned' },
  { pattern: /\b(sink|toilet|wc|tap|faucet|shower|drain|bathtub|bath)\b/i, label: 'plumbing fixture mentioned' },
  { pattern: /\b(leak(?:ing)?|drip(?:ping)?|clog(?:ged)?|block(?:ed|age)?|burst)\b/i, label: 'water fault mentioned' },
  { pattern: /\b(no|low)\s+(?:hot\s+)?water\b/i, label: 'water supply problem mentioned' },
  { pattern: /\bwater pressure\b/i, label: 'water pressure mentioned' },
  { pattern: /\bflush(?:ing)?\b/i, label: 'toilet flushing mentioned' },
  {
    pattern:
      /\b(?:(?:broken|loose|not working)\s+(?:sink|toilet|wc|tap|faucet|shower)|(?:sink|toilet|wc|tap|faucet|shower)\s+(?:is\s+)?(?:broken|loose|not working))\b/i,
    label: 'damaged plumbing fixture mentioned',
  },
]

const NON_PLUMBING_SIGNALS: { pattern: RegExp; label: string }[] = [
  { pattern: /\b(socket|outlet|electric(?:al|ity)?|power|light switch|sparking)\b/i, label: 'electrical issue mentioned' },
  { pattern: /\b(window|glass|door|lock|key)\b/i, label: 'door, window or access issue mentioned' },
  { pattern: /\b(radiator|heating|heater|boiler)\b/i, label: 'heating issue mentioned' },
  { pattern: /\b(pest|mice|mouse|rat|cockroach|insect)\b/i, label: 'pest issue mentioned' },
  { pattern: /\b(noise|neighbou?r|rent|lease|contract)\b/i, label: 'non-repair request mentioned' },
  { pattern: /\b(lift|elevator|roof tile|wall crack)\b/i, label: 'building issue mentioned' },
]

function matchingSignals(text: string, signals: { pattern: RegExp; label: string }[]): string[] {
  return signals.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label)
}

function subtypeFor(text: string): PlumbingSubtype {
  if (/\b(toilet|wc|flush(?:ing)?)\b/i.test(text)) return 'toilet'
  if (/\b(clog(?:ged)?|block(?:ed|age)?|drain)\b/i.test(text)) return 'blocked_drain'
  if (/\b(no hot water|hot water)\b/i.test(text)) return 'hot_water'
  if (/\b(pressure|weak flow)\b/i.test(text)) return 'water_pressure'
  if (/\b(leak(?:ing)?|drip(?:ping)?|burst)\b/i.test(text)) return 'leak'
  if (/\b(tap|faucet|shower|sink|bathtub|bath)\b/i.test(text)) return 'fixture'
  return 'general'
}

const SUBTYPE_LABEL: Record<PlumbingSubtype, string> = {
  leak: 'Water leak',
  blocked_drain: 'Blocked drain',
  toilet: 'Toilet problem',
  hot_water: 'Hot-water problem',
  water_pressure: 'Water-pressure problem',
  fixture: 'Plumbing fixture problem',
  general: 'Plumbing problem',
}

/**
 * Transparent stand-in for a production classifier. Unknown and mixed reports
 * fail closed to the normal property-management route.
 */
export function classifyReport(text: string): Classification {
  const plumbing = matchingSignals(text, PLUMBING_SIGNALS)
  const other = matchingSignals(text, NON_PLUMBING_SIGNALS)

  if (plumbing.length >= 2 && other.length === 0) {
    const subtype = subtypeFor(text)
    return {
      route: 'plumbing',
      subtype,
      confidence: 'high',
      label: SUBTYPE_LABEL[subtype],
      evidence: plumbing,
      explanation: `The report contains ${plumbing.length} independent plumbing signals.`,
    }
  }

  if (other.length > 0 && plumbing.length === 0) {
    return {
      route: 'not_plumbing',
      confidence: 'high',
      label: 'Property-manager review',
      evidence: other,
      explanation: 'The report describes an issue outside this plumbing workflow.',
    }
  }

  if (plumbing.length === 1 && other.length === 0) {
    return {
      route: 'uncertain',
      subtype: subtypeFor(text),
      confidence: 'low',
      label: 'Property-manager review',
      evidence: plumbing,
      explanation: 'There is only one plumbing signal, so Centrix will not contact a plumber automatically.',
    }
  }

  return {
    route: 'uncertain',
    confidence: 'low',
    label: 'Property-manager review',
    evidence: [...plumbing, ...other],
    explanation:
      plumbing.length && other.length
        ? 'The report contains mixed signals and needs human review.'
        : 'The report does not contain enough information to confirm a plumbing problem.',
  }
}

const COMMON_LOCATION: FollowUpQuestion = {
  id: 'location',
  fact: 'Exact location',
  text: 'Where exactly is the problem?',
  options: [
    { value: 'kitchen_sink', label: 'Kitchen sink' },
    { value: 'bathroom_sink', label: 'Bathroom sink' },
    { value: 'toilet', label: 'Toilet' },
    { value: 'shower_bath', label: 'Shower or bath' },
    { value: 'other_unknown', label: 'Somewhere else / I’m not sure' },
  ],
}

const QUESTIONS: Record<PlumbingSubtype, FollowUpQuestion[]> = {
  leak: [
    {
      id: 'leak_state',
      fact: 'Current state',
      text: 'Is water currently leaking?',
      options: [
        { value: 'continuous', label: 'Yes, continuously' },
        { value: 'when_used', label: 'Only when the fixture is used' },
        { value: 'stopped', label: 'It has stopped' },
        { value: 'unknown', label: 'I’m not sure' },
      ],
    },
    {
      id: 'leak_amount',
      fact: 'Amount of water',
      text: 'How much water is coming out?',
      options: [
        { value: 'drops', label: 'Occasional drops' },
        { value: 'steady', label: 'A steady flow' },
        { value: 'spreading', label: 'Water is spreading' },
        { value: 'unknown', label: 'I’m not sure' },
      ],
    },
    {
      id: 'water_isolated',
      fact: 'Water isolated',
      text: 'Were you able to stop the water at the nearby valve?',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'unknown', label: 'I don’t know where it is' },
      ],
    },
  ],
  blocked_drain: [
    COMMON_LOCATION,
    {
      id: 'drain_extent',
      fact: 'Extent',
      text: 'Is the fixture completely blocked?',
      options: [
        { value: 'complete', label: 'Yes, water does not drain' },
        { value: 'slow', label: 'No, but it drains slowly' },
        { value: 'intermittent', label: 'It comes and goes' },
        { value: 'unknown', label: 'I’m not sure' },
      ],
    },
    {
      id: 'other_drains',
      fact: 'Other fixtures affected',
      text: 'Are any other drains affected?',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'unknown', label: 'I haven’t checked' },
      ],
    },
  ],
  toilet: [
    {
      id: 'toilet_problem',
      fact: 'Toilet condition',
      text: 'What is happening with the toilet?',
      options: [
        { value: 'blocked', label: 'It is blocked' },
        { value: 'leaking', label: 'It is leaking' },
        { value: 'not_flushing', label: 'It does not flush' },
        { value: 'other_unknown', label: 'Something else / I’m not sure' },
      ],
    },
    {
      id: 'only_toilet',
      fact: 'Only toilet in unit',
      text: 'Is this the only toilet in the unit?',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'unknown', label: 'I’m not sure' },
      ],
    },
    {
      id: 'toilet_usable',
      fact: 'Usable',
      text: 'Can it still be used?',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'unknown', label: 'I’m not sure' },
      ],
    },
  ],
  hot_water: [
    {
      id: 'cold_water',
      fact: 'Cold water',
      text: 'Is cold water still working?',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'unknown', label: 'I’m not sure' },
      ],
    },
    {
      id: 'hot_water_extent',
      fact: 'Fixtures affected',
      text: 'Is hot water unavailable at every tap?',
      options: [
        { value: 'all', label: 'Yes, every tap' },
        { value: 'one', label: 'No, only one fixture' },
        { value: 'unknown', label: 'I haven’t checked' },
      ],
    },
    {
      id: 'hot_water_started',
      fact: 'When it started',
      text: 'When did the problem begin?',
      options: [
        { value: 'today', label: 'Today' },
        { value: 'days', label: 'A few days ago' },
        { value: 'longer', label: 'More than a week ago' },
        { value: 'unknown', label: 'I’m not sure' },
      ],
    },
  ],
  water_pressure: [
    {
      id: 'pressure_temperature',
      fact: 'Water affected',
      text: 'Is the pressure low for hot water, cold water, or both?',
      options: [
        { value: 'hot', label: 'Hot water only' },
        { value: 'cold', label: 'Cold water only' },
        { value: 'both', label: 'Both' },
        { value: 'unknown', label: 'I’m not sure' },
      ],
    },
    {
      id: 'pressure_extent',
      fact: 'Fixtures affected',
      text: 'Is the problem at one fixture or throughout the unit?',
      options: [
        { value: 'one', label: 'One fixture' },
        { value: 'all', label: 'Throughout the unit' },
        { value: 'unknown', label: 'I haven’t checked' },
      ],
    },
    {
      id: 'pressure_started',
      fact: 'When it started',
      text: 'When did you first notice it?',
      options: [
        { value: 'today', label: 'Today' },
        { value: 'days', label: 'A few days ago' },
        { value: 'longer', label: 'More than a week ago' },
        { value: 'unknown', label: 'I’m not sure' },
      ],
    },
  ],
  fixture: [
    COMMON_LOCATION,
    {
      id: 'fixture_problem',
      fact: 'Problem type',
      text: 'What best describes the problem?',
      options: [
        { value: 'leaking', label: 'It is leaking' },
        { value: 'loose_broken', label: 'It is loose or broken' },
        { value: 'not_working', label: 'It does not work' },
        { value: 'other_unknown', label: 'Something else / I’m not sure' },
      ],
    },
    {
      id: 'fixture_usable',
      fact: 'Usable',
      text: 'Can the fixture still be used?',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'unknown', label: 'I’m not sure' },
      ],
    },
  ],
  general: [
    COMMON_LOCATION,
    {
      id: 'general_problem',
      fact: 'Problem type',
      text: 'What best describes the plumbing problem?',
      options: [
        { value: 'leak', label: 'A leak' },
        { value: 'blocked', label: 'A blockage' },
        { value: 'supply', label: 'No water or low pressure' },
        { value: 'other_unknown', label: 'Something else / I’m not sure' },
      ],
    },
    {
      id: 'general_usable',
      fact: 'Fixture usable',
      text: 'Can the affected fixture still be used?',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'unknown', label: 'I’m not sure' },
      ],
    },
  ],
}

export function questionsFor(classification: Classification): FollowUpQuestion[] {
  return classification.route === 'plumbing' ? QUESTIONS[classification.subtype ?? 'general'] : []
}

export function generalPlumbingClassification(): Classification {
  return {
    route: 'plumbing',
    subtype: 'general',
    confidence: 'medium',
    label: 'Plumbing problem',
    evidence: ['Manager classified this case as plumbing'],
    explanation: 'The property manager overrode the initial routing decision.',
  }
}

export function answerQuestion(question: FollowUpQuestion, value: string): FollowUpAnswer | null {
  const option = question.options.find((candidate) => candidate.value === value)
  if (!option) return null
  return {
    questionId: question.id,
    fact: question.fact,
    question: question.text,
    value: option.value,
    label: option.label,
  }
}
