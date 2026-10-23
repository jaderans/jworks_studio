export const ACTIVITY_LABELS: Record<string, string> = {
  create: 'Added',
  status: 'Status',
  move: 'Moved',
  delete: 'Deleted',
  review: 'Review',
  approve: 'Approved',
  changes: 'Changes',
  reschedule: 'Planned',
  trends: 'Trends',
  results: 'Results',
  stage: 'Client',
  price: 'Price',
  proposal: 'Proposal',
  contract: 'Contract',
  role: 'Role',
  security: 'Security',
  setup: 'Setup',
  import: 'Import',
  merge: 'Merge',
  share: 'Client link',
  email: 'Email',
  template: 'Template',
};

export function activityTone(action: string): 'teal' | 'yellow' | 'good' | 'warn' | 'bad' | undefined {
  if (action === 'delete' || action === 'security') return 'bad';
  if (action === 'approve' || action === 'results' || action === 'share') return 'good';
  if (action === 'changes' || action === 'price') return 'warn';
  if (action === 'review' || action === 'contract' || action === 'proposal') return 'yellow';
  if (action === 'create' || action === 'import' || action === 'reschedule') return 'teal';
  return undefined;
}
