import { createFileRoute } from '@tanstack/react-router';
import { DQScreen, screenHead } from '@/components/dq-screen';
export const Route = createFileRoute('/service-requests/')({ head: () => screenHead('Service Requests', 'Track industrial service requests, priorities, spare parts, assigned specialists, and SLA windows with DQ Service.'), component: () => <DQScreen screen="requests" /> });
