import { createFileRoute } from '@tanstack/react-router';
import { DQScreen, screenHead } from '@/components/dq-screen';
export const Route = createFileRoute('/machines')({ head: () => screenHead('Machines / Fleet', 'Connected production assets, fleet health, equipment telemetry, critical downtime, and maintenance history.'), component: () => <DQScreen screen="machines" /> });
