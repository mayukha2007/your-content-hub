import { createFileRoute } from '@tanstack/react-router';
import { DQScreen, screenHead } from '@/components/dq-screen';
export const Route = createFileRoute('/inventory')({ head: () => screenHead('Inventory / Spare Parts', 'Industrial spare parts inventory, critical stockouts, reservations, warehouse balances, and purchasing.'), component: () => <DQScreen screen="inventory" /> });
