import {
  MegaphoneIcon, CalculatorIcon, DocumentDuplicateIcon, PencilSquareIcon, ClipboardDocumentListIcon,
  ShieldExclamationIcon, ChartPieIcon, ShieldCheckIcon, DocumentMagnifyingGlassIcon, ChartBarIcon,
  CommandLineIcon, UserGroupIcon, UsersIcon, UserPlusIcon, CheckBadgeIcon, ArrowsRightLeftIcon,
  CpuChipIcon, PresentationChartLineIcon, ChatBubbleLeftRightIcon, Cog6ToothIcon,
} from '@heroicons/react/24/outline';

// Icon per dashboard section id, shared by every role's sidebar. Sections
// without an entry fall back to a monogram (see DashboardShell).
export const SECTION_ICONS = {
  updates: MegaphoneIcon,
  'gcp-billing': CalculatorIcon,
  templates: DocumentDuplicateIcon,
  notes: PencilSquareIcon,
  'case-tracker': ClipboardDocumentListIcon,
  'spii-cases': ShieldExclamationIcon,
  'spii-dashboard': ChartPieIcon,
  'spii-analytics': ChartPieIcon,
  'spii-cases-mgmt': ShieldCheckIcon,
  'spii-audit': DocumentMagnifyingGlassIcon,
  'metric-analytics': ChartBarIcon,
  'apps-script': CommandLineIcon,
  'team-members': UserGroupIcon,
  users: UsersIcon,
  pending: UserPlusIcon,
  acknowledgments: CheckBadgeIcon,
  migrations: ArrowsRightLeftIcon,
  utilization: CpuChipIcon,
  analytics: PresentationChartLineIcon,
  feedback: ChatBubbleLeftRightIcon,
  settings: Cog6ToothIcon,
};

export const getSectionIcon = (id) => SECTION_ICONS[id] || null;
