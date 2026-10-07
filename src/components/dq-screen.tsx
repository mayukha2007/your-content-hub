import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import parse, { attributesToProps, domToReact, Element, type HTMLReactParserOptions, type DOMNode } from 'html-react-parser';
import { Button } from '@/components/ui/button';
import dashboard from '@/lib/stitch/dashboard.json';
import requests from '@/lib/stitch/requests.json';
import details from '@/lib/stitch/details.json';
import technicians from '@/lib/stitch/technicians.json';
import machines from '@/lib/stitch/machines.json';
import inventory from '@/lib/stitch/inventory.json';
import exceptions from '@/lib/stitch/exceptions.json';

const screens = { dashboard, requests, details, technicians, machines, inventory, exceptions };
export type ScreenName = keyof typeof screens;
const destinations = { dashboard: '/', 'service-requests': '/service-requests', machines: '/machines', technicians: '/technicians', inventory: '/inventory', exceptions: '/exceptions' } as const;
export function screenHead(title: string, description: string) {
  return { meta: [{ title: `${title} | DQ Service` }, { name: 'description', content: description }, { property: 'og:title', content: `${title} | DQ Service` }, { property: 'og:description', content: description }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] };
}
const createdRequests: { id: string; machine: string; priority: string; problem: string }[] = [];
const assignedTechs = new Set<string>();
let completed = false;
const cleanText = (el: HTMLElement) => {
  const clone = el.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('.material-symbols-outlined').forEach(x => x.remove());
  return clone.textContent?.trim().replace(/\s+/g, ' ') || '';
};
const options: HTMLReactParserOptions = {
  replace(node) {
    if (!(node instanceof Element)) return;
    if (['script', 'style'].includes(node.name)) return <></>;
    const attrs = { ...node.attribs };
    Object.keys(attrs).forEach(k => { if (k.startsWith('on')) delete attrs[k]; });
    node.attribs = attrs;
    if (node.name === 'body') return <>{domToReact(node.children as DOMNode[], options)}</>;
    if (node.name === 'button') {
      const props = attributesToProps(attrs);
      const icon = node.children.find(n => n instanceof Element && n.attribs['class']?.includes('material-symbols-outlined'));
      const name = icon instanceof Element ? icon.children.map(n => 'data' in n ? n.data : '').join('').replaceAll('_', ' ') : undefined;
      return <Button {...props} variant="stitch" size="stitch" type="button" title={attrs['title'] || name} aria-label={attrs['aria-label'] || (node.children.length === 1 ? name : undefined)}>{domToReact(node.children as DOMNode[], options)}</Button>;
    }
    if (node.name === 'a') {
      const path = attrs['data-path'] as keyof typeof destinations | undefined;
      if (path && destinations[path]) attrs['href'] = destinations[path];
      else if (attrs['href'] === '#') attrs['href'] = '/service-requests/SR-4102';
      node.attribs = attrs;
    }
    return undefined;
  },
};

type Dialog = { title: string; mode?: 'onboard' | 'receive' | 'note' | 'assign' | 'filter' | 'scan' | 'columns' | 'action'; target?: HTMLElement; name?: string };

export function DQScreen({ screen }: { screen: ScreenName }) {
  const root = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const markup = useMemo(() => parse(screens[screen], options), [screen]);
  const filters = useRef({ query: '', global: '', tab: 'all', selections: new Map<HTMLSelectElement, string>() });
  const notify = (text: string) => setToast(text);
  const go = (to: '/' | '/service-requests' | '/service-requests/SR-4102' | '/machines' | '/technicians' | '/inventory' | '/exceptions') => { setMenuOpen(false); if (to === '/service-requests/SR-4102') void navigate({ to: '/service-requests/$requestId', params: { requestId: 'SR-4102' } }); else void navigate({ to }); };

  function applyFilters() {
    const area = root.current;
    if (!area) return;
    const f = filters.current;
    const candidates = screen === 'technicians' ? [...area.querySelectorAll<HTMLElement>('.tech-card')] : screen === 'machines' ? [...area.querySelectorAll<HTMLElement>('main .grid > div')].filter(x => x.textContent?.includes('Health Index')) : [...area.querySelectorAll<HTMLElement>('main tbody tr')];
    let visible = 0;
    candidates.forEach(row => {
      const text = row.textContent?.toLowerCase() || '';
      let show = (!f.query || text.includes(f.query)) && (!f.global || text.includes(f.global));
      f.selections.forEach((value, select) => {
        if (!value || value === 'all' || select.selectedIndex === 0) return;
        const selected = select.options[select.selectedIndex]?.text.toLowerCase() || value.toLowerCase();
        let terms = selected.replace(/\([^)]*\)/g, '').trim().split(/[ &-]+/).filter(x => x.length > 2 && !['plant','assembly','central','precision','industrial','requirement','stock','all','normal','adequate'].includes(x));
        if (/priority/i.test(select.options[0]?.text || '')) terms = [selected.match(/p[1-4]/)?.[0] || selected];
        if (/stock/i.test(select.options[0]?.text || '')) terms = [selected.includes('out') ? 'out of stock' : selected.includes('low') ? 'low stock' : selected.includes('reserved') ? 'reserved' : 'normal'];
        show = show && (terms.length === 0 || terms.some(term => text.includes(term) || row.dataset['plant']?.toLowerCase().includes(term) || row.dataset['skills']?.toLowerCase().includes(term)));
      });
      const tab = f.tab;
      if (tab !== 'all') {
        const matches: Record<string, boolean> = {
          active: !/resolved|closed|completed|verified/.test(text), unassigned: /unassigned|not assigned/.test(text), critical: /p1|critical/.test(text), parts: /awaiting|stockout|in transit|out of stock|pending po|blocked/.test(text), sla: /imminent|breach|risk|00h|00:/.test(text), resolved: /resolved|closed|completed|verified/.test(text), normal: /normal/.test(text), degraded: /degraded/.test(text), conflict: /conflict/.test(text), stockout: /stockout/.test(text), breach: /sla|breach/.test(text), unavailable: /unavailable|shift/.test(text), bearings: /bearing|bushing/.test(text), hydraulics: /seal|hydraulic|oil|pressure/.test(text), electrical: /electrical|plc|drive|lidar|sensor/.test(text), motors: /motor|drive/.test(text), pneumatics: /pneumatic|valve/.test(text),
        };
        show = show && (screen === 'technicians' ? row.dataset['status'] === tab : matches[tab] ?? text.includes(tab));
      }
      row.classList.toggle('dq-filtered-out', !show);
      if (show) visible++;
    });
    const empty = area.querySelector<HTMLElement>('#dq-empty');
    if (empty) { empty.hidden = visible !== 0 || candidates.length === 0; }
    area.querySelector('#no-results-msg')?.classList.toggle('hidden', visible !== 0);
    const footer = [...area.querySelectorAll<HTMLElement>('main div,main span')].find(x => x.children.length === 0 && /^Showing \d/.test(x.textContent?.trim() || ''));
    if (footer && candidates.length) footer.textContent = `Showing ${visible} of ${candidates.length} ${screen === 'inventory' ? 'parts' : 'records'}`;
  }

  function toggleDrawer(open: boolean) {
    const area = root.current;
    if (!area) return;
    const ids = screen === 'requests' ? ['request-drawer', 'drawer-backdrop'] : screen === 'details' ? ['signoff-modal'] : screen === 'technicians' ? ['assign-drawer', 'drawer-backdrop', 'drawer-panel'] : ['inspectorDrawerBackdrop', 'inspectorDrawerPanel'];
    ids.forEach(id => {
      const el = area.querySelector<HTMLElement>(`#${id}`);
      if (!el) return;
      el.classList.toggle('hidden', !open && (id === 'assign-drawer' || id === 'signoff-modal'));
      el.classList.toggle('pointer-events-none', !open);
      if (open) { el.classList.remove('hidden', 'opacity-0', 'translate-x-full'); el.classList.add('pointer-events-auto'); }
      else { el.classList.remove('pointer-events-auto'); if (id.includes('backdrop') || id.includes('Backdrop')) el.classList.add('opacity-0'); else if (id !== 'signoff-modal' && id !== 'assign-drawer') el.classList.add('translate-x-full'); }
      if (/drawer|Panel|modal/i.test(id) && !/backdrop/i.test(id)) { el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); }
    });
    if (open) area.querySelector<HTMLElement>('#request-drawer input, #signoff-modal input, #drawer-panel select')?.focus();
  }

  function selectTab(button: HTMLElement, tab: string) {
    filters.current.tab = tab;
    const parent = button.parentElement;
    parent?.querySelectorAll('button').forEach(b => {
      b.classList.remove('bg-primary', 'text-on-primary', 'bg-primary-container', 'text-on-primary-container');
      b.classList.toggle('dq-active-tab', b === button);
      b.setAttribute('aria-pressed', String(b === button));
    });
    applyFilters();
  }

  useEffect(() => {
    const area = root.current;
    if (!area) return;
    filters.current = { query: '', global: '', tab: 'all', selections: new Map() };
    area.querySelectorAll('input').forEach(input => {
      if (input.type === 'checkbox' || input.type === 'radio') { input.setAttribute('aria-label', input.closest('label')?.textContent?.trim() || 'Select item'); return; }
      input.setAttribute('aria-label', input.placeholder || 'Field value');
    });
    area.querySelectorAll('select').forEach(select => select.setAttribute('aria-label', select.options[0]?.text || 'Select option'));
    area.querySelectorAll('textarea').forEach(input => input.setAttribute('aria-label', input.placeholder || 'Notes'));
    const main = area.querySelector('main');
    if (main && !area.querySelector('#dq-empty')) { const empty = document.createElement('div'); empty.id = 'dq-empty'; empty.className = 'dq-empty'; empty.hidden = true; empty.textContent = 'No records match your filters.'; main.appendChild(empty); }
    if (screen === 'requests') {
      createdRequests.forEach(request => appendRequest(request));
      if (completed) area.querySelector('tbody tr')?.querySelectorAll('td').forEach(td => { if (cleanText(td).includes('In Progress')) td.textContent = 'Awaiting QA'; });
    }
    assignedTechs.forEach(name => { area.querySelectorAll<HTMLElement>('.tech-card').forEach(card => { if (card.dataset['name']?.startsWith(name)) card.dataset['status'] = 'dispatched'; }); });
    const inputListener = (event: Event) => {
      const el = event.target;
      if (!(el instanceof HTMLInputElement)) return;
      if (el.type === 'checkbox' && el.closest('thead')) { el.closest('table')?.querySelectorAll<HTMLInputElement>('tbody input[type=checkbox]').forEach(x => x.checked = el.checked); return; }
      if (el.closest('header')) filters.current.global = el.value.toLowerCase();
      else if (el.placeholder && /search|filter/i.test(el.placeholder)) filters.current.query = el.value.toLowerCase();
      else return;
      applyFilters();
    };
    const changeListener = (event: Event) => {
      const el = event.target;
      if (!(el instanceof HTMLSelectElement)) return;
      if (el.closest('#request-drawer, #drawer-panel, #signoff-modal')) return;
      if (el.id === 'engine-sr-select') {
        const rec = area.querySelector<HTMLElement>('[class*="bg-surface-container-low"]');
        rec?.setAttribute('data-evaluated-request', el.value); notify(`Match scores refreshed for ${el.value}.`); return;
      }
      filters.current.selections.set(el, el.value); applyFilters();
    };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { toggleDrawer(false); setDialog(null); setMenuOpen(false); } };
    area.addEventListener('input', inputListener); area.addEventListener('change', changeListener); document.addEventListener('keydown', onKey);
    return () => { area.removeEventListener('input', inputListener); area.removeEventListener('change', changeListener); document.removeEventListener('keydown', onKey); };
  }, [screen]);

  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (screen !== 'details') return;
    let seconds = 1455;
    const timer = setInterval(() => { seconds = Math.max(0, seconds - 1); const el = root.current?.querySelector('#sla-ticker'); if (el) el.textContent = `00:${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`; }, 1000);
    return () => clearInterval(timer);
  }, [screen]);

  function appendRequest(request: typeof createdRequests[number]) {
    const body = root.current?.querySelector('main tbody');
    const first = body?.querySelector('tr');
    if (!body || !first || body.querySelector(`[data-demo-id="${request.id}"]`)) return;
    const row = first.cloneNode(true) as HTMLElement;
    row.classList.remove('dq-filtered-out');
    row.dataset['demoId'] = request.id;
    const cells = row.querySelectorAll('td');
    if (cells[0]) cells[0].textContent = request.id;
    if (cells[1]) cells[1].textContent = request.machine;
    if (cells[2]) cells[2].textContent = request.problem;
    if (cells[3]) cells[3].textContent = request.priority;
    cells.forEach(cell => { if (/In Progress/.test(cell.textContent || '')) cell.textContent = 'Open'; });
    body.prepend(row);
  }

  function exportCSV() {
    const rows = [...(root.current?.querySelectorAll('main table tr') || [])].filter(x => !x.classList.contains('dq-filtered-out'));
    const csv = rows.length ? rows.map(row => [...row.querySelectorAll('td,th')].map(cell => `"${cleanText(cell as HTMLElement).replaceAll('"', '""')}"`).join(',')).join('\n') : [...(root.current?.querySelectorAll('.tech-card') || [])].map(row => `"${row.textContent?.trim().replaceAll('"', '""')}"`).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv || root.current?.querySelector('main')?.textContent || ''], { type: 'text/csv;charset=utf-8;' })); a.download = `dq-service-${screen}.csv`; a.click(); URL.revokeObjectURL(a.href); notify('Manifest downloaded.');
  }

  function click(event: React.MouseEvent<HTMLDivElement>) {
    const origin = event.target;
    if (!(origin instanceof HTMLElement)) return;
    const link = origin.closest<HTMLAnchorElement>('a');
    if (link) {
      event.preventDefault();
      const path = link.dataset['path'] as keyof typeof destinations;
      if (path && destinations[path]) go(destinations[path]);
      else go(screen === 'details' ? '/service-requests' : '/service-requests/SR-4102');
      return;
    }
    const button = origin.closest<HTMLElement>('button');
    if (!button) { if (/backdrop/i.test(origin.id)) toggleDrawer(false); return; }
    const text = cleanText(button); const id = button.id; const icon = button.querySelector('.material-symbols-outlined')?.textContent?.trim();
    if (button.closest('header')) {
      if (/New Service Request/i.test(text)) { go('/service-requests'); setTimeout(() => document.getElementById('open-drawer-btn')?.click(), 180); }
      else if (icon === 'notifications' || icon === 'notifications_active' || icon === 'notification_important') go('/exceptions');
      else if (icon === 'sensors' || icon === 'wifi_tethering') notify('All 141 sample telemetry nodes are online.');
      else setDialog({ title: 'Elena Rostova · Plant Ops Director', mode: 'action' });
      return;
    }
    if (['open-drawer-btn','btn-complete-modal'].includes(id)) { toggleDrawer(true); return; }
    if (['close-drawer-btn','cancel-drawer-btn','btn-close-modal','btn-cancel-modal'].includes(id) || text === 'Cancel' || text === 'Close Inspector' || icon === 'close') { toggleDrawer(false); return; }
    if (id === 'submit-ticket-btn') {
      const drawer = root.current?.querySelector('#request-drawer');
      const selects = drawer?.querySelectorAll<HTMLSelectElement>('select');
      const request = { id: `SR-${4103 + createdRequests.length}`, machine: selects?.[0]?.selectedOptions[0]?.text || 'Welder Arm #04', priority: selects?.[1]?.selectedOptions[0]?.text || 'P2 High', problem: selects?.[2]?.selectedOptions[0]?.text || 'Hydraulic circuit fault' };
      createdRequests.push(request); appendRequest(request); toggleDrawer(false); notify(`${request.id} created and added to the dispatch queue.`); return;
    }
    if (id === 'btn-confirm-signoff') {
      const checks = root.current?.querySelectorAll<HTMLInputElement>('#signoff-modal input[type=checkbox]');
      if (checks && [...checks].some(c => !c.checked)) { notify('Complete all sign-off checks before submitting.'); return; }
      completed = true; toggleDrawer(false);
      const btn = root.current?.querySelector('#btn-complete-modal'); if (btn) btn.textContent = '✓ Sign-off Requested';
      notify('SR-4102 submitted for QA verification.'); return;
    }
    if (id === 'btn-post-note') {
      const input = root.current?.querySelector<HTMLTextAreaElement>('#field-note-input');
      if (!input?.value.trim()) { notify('Enter a field update before posting.'); input?.focus(); return; }
      const note = document.createElement('div'); note.className = 'p-space-sm bg-surface-container-low mb-space-sm';
      const author = document.createElement('strong'); author.textContent = 'Elena Rostova · Just now'; const p = document.createElement('p'); p.textContent = input.value; note.append(author,p); input.parentElement?.parentElement?.before(note); input.value = ''; notify('Field update added to the technician log.'); return;
    }
    if (/Print|Asset Report/.test(text)) { window.print(); return; }
    if (/Export|Manifest/.test(text)) { exportCSV(); return; }
    if (/Reset/.test(text)) {
      root.current?.querySelectorAll<HTMLInputElement>('main input[placeholder]').forEach(x => x.value = ''); root.current?.querySelectorAll<HTMLSelectElement>('main select').forEach(x => x.selectedIndex = 0);
      filters.current = { query:'',global:'',tab:'all',selections:new Map() }; root.current?.querySelectorAll('.dq-active-tab').forEach(x => x.classList.remove('dq-active-tab')); applyFilters(); return;
    }
    if (screen === 'technicians' && /Assign Task|Queue Task|Re-Route|Assign & Dispatch|Allocate Contingent|Assign As Assist|Confirm & Transmit/.test(text)) {
      if (/Confirm/.test(text)) {
        const name = root.current?.querySelector('#drawer-tech-name')?.textContent || 'Technician'; assignedTechs.add(name);
        const card = [...(root.current?.querySelectorAll<HTMLElement>('.tech-card') || [])].find(x => x.dataset['name']?.startsWith(name));
        if (card) { card.dataset['status'] = 'dispatched'; const action = card.querySelector('button'); if (action) action.textContent = 'Re-Route'; }
        toggleDrawer(false); applyFilters(); notify(`${name} assigned and dispatched.`); return;
      }
      const card = button.closest<HTMLElement>('.tech-card');
      const name = card?.dataset['name']?.replace(/ DQ-.*/, '') || (/Contingent/.test(text) ? 'Sarah Chen' : /Assist/.test(text) ? 'Elena Costa' : 'Jan Hofer');
      const nameEl = root.current?.querySelector('#drawer-tech-name'); if (nameEl) nameEl.textContent = name;
      const plant = root.current?.querySelector('#drawer-tech-plant'); if (plant) plant.textContent = card?.dataset['plant'] || 'Stuttgart Plant';
      toggleDrawer(true); return;
    }
    if (screen === 'machines' && /Inspector|Telemetry|Inspect History|Inspect Event/.test(text)) { toggleDrawer(true); return; }
    const tabs: Record<string, string> = { 'All Requests':'all','Open Active':'active','Unassigned':'unassigned','P1 Critical':'critical','Awaiting Parts':'parts','SLA Risk':'sla','Resolved':'resolved','All Sites':'all','Critical Only':'critical','My Triage Queue':'unassigned','All Exceptions':'all','Resource Conflicts':'conflict','Part Stockouts':'stockout','SLA Breaches':'breach','Tech Unavailable':'unavailable','All SKUs':'all','Bearings & Bushings':'bearings','Hydraulics & Seals':'hydraulics','Electrical & PLCs':'electrical','Motors & Drives':'motors','Pneumatics':'pneumatics','Normal':'normal','Degraded':'degraded','Critical Down':'critical' };
    const match = Object.keys(tabs).find(k => text.startsWith(k));
    if (button.dataset['filter']) { selectTab(button,button.dataset['filter']); return; }
    if (match || /^All \d/.test(text)) { selectTab(button, match ? (tabs[match] ?? 'all') : 'all'); return; }
    if (['Critical','High','Medium'].includes(text) && screen === 'exceptions') { selectTab(button, text === 'Critical' ? 'critical' : text.toLowerCase()); return; }
    if (/^(Critical P1|Elevated P2|Routine P3)/.test(text)) { button.parentElement?.querySelectorAll('button').forEach(b => b.classList.toggle('dq-active-tab',b === button)); return; }
    if (/Jump to Critical/.test(text)) { root.current?.querySelector('#critical-workbench')?.scrollIntoView({ behavior:'smooth' }); return; }
    if (/Density/.test(text)) { root.current?.querySelectorAll<HTMLElement>('td').forEach(td => td.classList.toggle('py-1')); notify('Table density updated.'); return; }
    if (/Columns|Cols/.test(text) || icon === 'view_column') { setDialog({ title:'Visible columns',mode:'columns' }); return; }
    if (/^(Prev|Previous|Next|\d+)$/.test(text) || ['chevron_left','chevron_right'].includes(icon || '')) {
      const table = root.current?.querySelector('tbody');
      if (table) { const rows = [...table.children]; if (/Next/.test(text) || icon === 'chevron_right') rows.reverse().forEach(row => table.appendChild(row)); else rows.sort((a,b) => (a.textContent || '').localeCompare(b.textContent || '')).forEach(row => table.appendChild(row)); }
      button.parentElement?.querySelectorAll('button').forEach(b => b.classList.toggle('dq-active-tab',b===button)); notify('Sample records updated.'); return;
    }
    if (/Force Sync/.test(text) || icon === 'refresh') { notify('All sample plant records synchronized.'); return; }
    if (/Auto-Balance|Auto-Match/.test(text)) { notify('Shift allocation optimized across all four plants. Jan Hofer is the top available match.'); return; }
    if (/Onboard/.test(text)) { setDialog({ title:'Onboard Technician',mode:'onboard' }); return; }
    if (/Receive Parts/.test(text)) { setDialog({ title:'Receive Parts / Purchase Order',mode:'receive' }); return; }
    if (/Cycle Count/.test(text)) { setDialog({ title:'Cycle Count Scan',mode:'scan' }); return; }
    if (/Advanced Filters|Filter Grid|Site Plant|Category|Criticality Tier/.test(text)) { setDialog({ title:'Filter operational records',mode:'filter' }); return; }
    if (/Telemetry Insights|Live Telemetry/.test(text) || icon === 'monitoring') { go('/machines'); return; }
    if (/Dispatch Tech|Emergency Crew|Reassign Specialist|Dispatch \(SR/.test(text) || ['swap_horiz','person_add'].includes(icon || '')) { if (screen === 'requests' || screen === 'details') go('/technicians'); else setDialog({ title:'Dispatch technician',mode:'assign',target:button }); return; }
    if (/Escalate|Notify Plant/.test(text)) { setDialog({ title:text,mode:'note',target:button }); return; }
    if (icon === 'visibility') { go('/service-requests/SR-4102'); return; }
    if (['more_vert','more_horiz'].includes(icon || '')) { setDialog({ title:'Work order actions',mode:'action',target:button }); return; }
    if (icon === 'grid_view' || icon === 'view_headline') { const grids = root.current?.querySelectorAll<HTMLElement>('main .grid'); grids?.forEach(grid => { if (grid.textContent?.includes('Health Index')) grid.classList.toggle('dq-list-mode',icon==='view_headline'); }); notify(icon==='view_headline'?'Fleet list view selected.':'Fleet grid view selected.'); return; }
    if (icon === 'mic') { notify('Voice recording is unavailable in this frontend demo. You can type a field update.'); return; }
    setDialog({ title: text || (icon || 'Item action').replaceAll('_',' '),mode:/edit|description/.test(icon || '') ? 'note':'action',target:button });
  }

  function submitDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!dialog) return;
    const values = new FormData(event.currentTarget);
    if (dialog.mode === 'filter') { filters.current.query = String(values.get('query') || '').toLowerCase(); applyFilters(); notify('Filters applied.'); }
    else if (dialog.mode === 'scan') { filters.current.query = String(values.get('sku') || '').toLowerCase(); applyFilters(); notify('SKU located for cycle count.'); }
    else if (dialog.mode === 'onboard') {
      const grid = root.current?.querySelector('#tech-card-grid'); const first = grid?.querySelector<HTMLElement>('.tech-card');
      if (grid && first) { const card = first.cloneNode(true) as HTMLElement; const name = String(values.get('name')); card.dataset['name'] = name; card.dataset['status'] = 'available'; const title = card.querySelector<HTMLElement>('h3,h4,.font-headline-md'); if (title) title.textContent = name; else card.insertAdjacentText('afterbegin',name); grid.prepend(card); }
      notify(`${values.get('name')} added to the technician roster.`);
    } else if (dialog.mode === 'receive') {
      const sku = String(values.get('sku')).toLowerCase(); const qty = Number(values.get('quantity'));
      const row = [...(root.current?.querySelectorAll('tbody tr') || [])].find(r => r.textContent?.toLowerCase().includes(sku));
      if (!row) { notify('SKU not found. Enter a listed SKU such as SK-4481.'); return; }
      const cells = row.querySelectorAll('td'); const stockCell = [...cells].find(c => /^\d+$/.test(cleanText(c)));
      if (stockCell) stockCell.textContent = String(Number(stockCell.textContent) + qty);
      notify(`${qty} units received for ${String(values.get('sku')).toUpperCase()}.`);
    } else {
      const row = dialog.target?.closest('tr');
      if (row && /Authorize|PO|Dispatch|Connect|Assign/.test(dialog.title)) { const cell = row.querySelector('td:nth-last-child(2)'); if (cell) cell.textContent = /PO|Authorize/.test(dialog.title) ? 'PO Authorized' : 'Actioned'; }
      if (dialog.target && /Approve|Authorize|Generate|Switch/.test(dialog.title)) { dialog.target.textContent = '✓ Authorized'; dialog.target.setAttribute('disabled',''); }
      notify(`${dialog.title} ${dialog.mode === 'note' ? 'recorded in the audit trail' : 'confirmed'}.`);
    }
    setDialog(null);
  }

  return <>
    <Button variant="stitch" size="stitch" className="dq-menu-toggle" title="Toggle navigation" aria-label="Toggle navigation" onClick={() => setMenuOpen(v=>!v)}><span className="material-symbols-outlined">menu</span></Button>
    <div ref={root} className={`dq-screen ${menuOpen ? 'dq-nav-open' : ''}`} onClick={click}>{markup}</div>
    {toast && <div className="dq-toast" role="status">{toast}</div>}
    {dialog && <div className="dq-action-overlay" onClick={() => setDialog(null)}><section className="dq-action-dialog" role="dialog" aria-modal="true" aria-label={dialog.title} onClick={e=>e.stopPropagation()}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"><h2 className="text-headline-lg font-semibold min-w-0">{dialog.title}</h2><Button variant="ghost" size="icon" aria-label="Close dialog" onClick={()=>setDialog(null)}><span className="material-symbols-outlined">close</span></Button></div>
      <form onSubmit={submitDialog}>
        {dialog.mode === 'onboard' && <><label>Full name<input name="name" required placeholder="Technician name" /></label><label>Certification<select name="skill"><option>Hydraulics L3</option><option>CNC Precision L3</option><option>Robotics & Vision L3</option><option>Electrical L2</option></select></label><label>Plant<select name="site"><option>Detroit Alpha</option><option>Stuttgart Plant</option><option>Osaka Robotic Cell</option><option>Austin Microfab</option></select></label></>}
        {dialog.mode === 'receive' && <><label>Part SKU<input name="sku" required placeholder="SK-4481" /></label><label>Quantity received<input name="quantity" type="number" min="1" required defaultValue="1" /></label><label>Purchase order<input name="po" required placeholder="PO-2026-0142" /></label></>}
        {dialog.mode === 'scan' && <><label>Scan or enter SKU<input name="sku" required placeholder="SK-4481" /></label><label>Physical count<input type="number" min="0" defaultValue="4" /></label></>}
        {dialog.mode === 'filter' && <label>Plant, priority, status, or asset<input name="query" placeholder="Detroit, P1, low stock…" defaultValue={filters.current.query} /></label>}
        {dialog.mode === 'assign' && <><label>Technician<select name="tech"><option>Jan Hofer · CNC L3 · Available</option><option>Sarah Chen · Mechatronics L2 · Available</option><option>Elena Costa · Electrical L2 · Available</option><option>Marcus Vance · Hydraulics L3</option></select></label><label>Work order<select name="wo"><option>SR-4102 · Welder Arm #04</option><option>SR-4101 · Haas 5-Axis Spindle</option><option>SR-4091 · VDC-02 Chamber</option></select></label></>}
        {dialog.mode === 'note' && <label>Operational note<textarea name="note" required rows={4} placeholder="Enter a root cause note or dispatch instruction…" /></label>}
        {dialog.mode === 'action' && <><div className="mt-4 text-body-md text-on-surface-variant">{dialog.target?.closest('tr') ? cleanText(dialog.target.closest('tr') as HTMLElement).slice(0,180) : 'Plant Operations · Four-site operational scope'}</div><label>Reference / authorization note<textarea name="note" rows={3} placeholder="Optional authorization note" /></label></>}
        {dialog.mode === 'columns' && <div className="mt-4 grid gap-2">{[...(root.current?.querySelectorAll('main thead th') || [])].map((th,i)=><label key={i} className="!flex items-center !mt-0"><input className="!w-auto" type="checkbox" defaultChecked={!th.classList.contains('hidden')} onChange={e=>root.current?.querySelectorAll(`main tr > :nth-child(${i+1})`).forEach(cell=>cell.classList.toggle('hidden',!e.target.checked))}/>{cleanText(th as HTMLElement)}</label>)}</div>}
        <div className="mt-6 flex justify-end gap-2"><Button variant="outline" onClick={()=>setDialog(null)}>Cancel</Button><Button type="submit">{dialog.mode==='columns'?'Done':dialog.mode==='scan'?'Find SKU':dialog.mode==='filter'?'Apply filters':'Confirm'}</Button></div>
      </form>
    </section></div>}
  </>;
}
