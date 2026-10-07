import { createFileRoute } from '@tanstack/react-router';
import { DQScreen, screenHead } from '@/components/dq-screen';
export const Route = createFileRoute('/exceptions')({ head: () => screenHead('Operational Exceptions', 'Critical operational blockers, SLA breaches, resource conflicts, and mitigation approvals for DQ Service.'), component: () => <DQScreen screen="exceptions" /> });
