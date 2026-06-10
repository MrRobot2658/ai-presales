import { SCENARIO_OPTIONS } from '@/data/presales-mock'
import type { ContentDraft, Opportunity } from '@/data/presales-mock'

export interface DraftReferenceItem {
  key: string
  label: string
  value: string
  multiline?: boolean
}

export function scenarioLabels(scenario: string[]): string[] {
  const byValue = new Map(SCENARIO_OPTIONS.map((opt) => [opt.value, opt.label]))
  return scenario.map((value) => byValue.get(value) ?? value)
}

export function buildDraftReferenceSources(input: {
  draft: ContentDraft
  opportunity?: Opportunity | null
  knowledgeLabels: string[]
  labels: {
    opportunity: string
    company: string
    requirement: string
    knowledge: string
    scenario: string
    description: string
    outputFile: string
    updatedAt: string
    none: string
  }
}): DraftReferenceItem[] {
  const { draft, opportunity, knowledgeLabels, labels } = input
  const items: DraftReferenceItem[] = [
    {
      key: 'opportunity',
      label: labels.opportunity,
      value: opportunity?.companyName || draft.companyName || labels.none,
    },
  ]

  if (opportunity?.description?.trim()) {
    items.push({
      key: 'requirement',
      label: labels.requirement,
      value: opportunity.description.trim(),
      multiline: true,
    })
  }

  items.push({
    key: 'knowledge',
    label: labels.knowledge,
    value: knowledgeLabels.length ? knowledgeLabels.join('\n') : labels.none,
    multiline: knowledgeLabels.length > 1,
  })

  items.push({
    key: 'scenario',
    label: labels.scenario,
    value: scenarioLabels(draft.scenario).join('、') || labels.none,
  })

  if (draft.description?.trim()) {
    items.push({
      key: 'description',
      label: labels.description,
      value: draft.description.trim(),
      multiline: true,
    })
  }

  if (draft.outputFile?.trim()) {
    items.push({
      key: 'outputFile',
      label: labels.outputFile,
      value: draft.outputFile.trim(),
    })
  }

  if (draft.updatedAt) {
    items.push({
      key: 'updatedAt',
      label: labels.updatedAt,
      value: new Date(draft.updatedAt).toLocaleString(),
    })
  }

  return items
}
