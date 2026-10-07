import { createFileRoute } from '@tanstack/react-router';
import { DQScreen, screenHead } from '@/components/dq-screen';
export const Route = createFileRoute('/service-requests/$requestId')({ head: () => screenHead('SR-4102 · Service Request Details', 'Hydraulic circuit pressure loss diagnosis, field evidence, specialist assignment, parts allocation, and sign-off for SR-4102.'), component: () => <DQScreen screen="details" /> });
