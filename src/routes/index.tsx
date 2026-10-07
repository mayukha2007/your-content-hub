import { createFileRoute } from '@tanstack/react-router';
import { DQScreen, screenHead } from '@/components/dq-screen';
export const Route = createFileRoute('/')({ head: () => screenHead('Operations Dashboard', 'DQ Service industrial fleet operations, active work orders, asset health, and technician dispatch across four manufacturing plants.'), component: () => <DQScreen screen="dashboard" /> });
