import { createFileRoute } from '@tanstack/react-router';
import { DQScreen, screenHead } from '@/components/dq-screen';
export const Route = createFileRoute('/technicians')({ head: () => screenHead('Technicians & Dispatch', 'Technician certifications, availability, smart job matching, and workforce allocation across four DQ Service plants.'), component: () => <DQScreen screen="technicians" /> });
