import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// ─── Mock all heavy child components ─────────────────────────────────────────

vi.mock('../components/DesktopDashboard', () => ({
  default: ({ projects }: { projects: unknown[] }) => (
    <div data-testid="desktop-dashboard">DesktopDashboard ({projects.length} projects)</div>
  ),
}));
vi.mock('../components/ProjectDetails', () => ({ default: () => <div data-testid="project-details">ProjectDetails</div> }));
vi.mock('../components/PhotoDocumentation', () => ({ default: () => <div data-testid="photos">PhotoDocumentation</div> }));
vi.mock('../components/EquipmentManager', () => ({ default: () => <div data-testid="equipment">EquipmentManager</div> }));
vi.mock('../components/TicSheet', () => ({ default: () => <div data-testid="tic-sheet">TicSheet</div> }));
vi.mock('../components/Billing', () => ({ default: () => <div>Billing</div> }));
vi.mock('../components/Reporting', () => ({ default: () => <div>Reporting</div> }));
vi.mock('../components/AdminPanel', () => ({ default: () => <div>AdminPanel</div> }));
vi.mock('../components/ARMapping', () => ({ default: () => <div>ARMapping</div> }));

vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  getDocs: vi.fn().mockResolvedValue({
    forEach: (cb: (doc: unknown) => void) => [
      { id: 'p-1', data: () => ({ client: 'Alpha Corp', address: '1 St', status: 'Active', currentStage: 'Monitor', companyId: 'c-1' }) },
      { id: 'p-2', data: () => ({ client: 'Beta Inc', address: '2 Ave', status: 'Closed', currentStage: 'Closeout', companyId: 'c-1' }) },
    ].forEach(cb),
  }),
}));

vi.mock('../firebase', () => ({
  db: {},
  handleFirestoreError: vi.fn(),
  OperationType: { GET: 'GET' }
}));

vi.mock('../context/AppContext', () => ({
  useAppContext: vi.fn(),
}));

vi.mock('../data/mockApi', () => ({
  getProjects: vi.fn().mockResolvedValue([
    { id: 'p-1', client: 'Alpha Corp', address: '1 St', status: 'Active', currentStage: 'Monitor', totalCost: 5000, companyId: 'c-1', rooms: [], milestones: [], tasks: [], lineItems: [], invoiceStatus: 'Draft', roomScans: [], videos: [], dailyNarratives: [], progress: 50, riskLevel: 'low' },
    { id: 'p-2', client: 'Beta Inc', address: '2 Ave', status: 'Closed', currentStage: 'Closeout', totalCost: 3000, companyId: 'c-1', rooms: [], milestones: [], tasks: [], lineItems: [], invoiceStatus: 'Paid', roomScans: [], videos: [], dailyNarratives: [], progress: 100, riskLevel: 'low' },
  ]),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import DesktopApp from '../components/DesktopApp';
import { useAppContext } from '../context/AppContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const makeCtx = (overrides = {}) => ({
  activeTab: 'dashboard',
  setActiveTab: vi.fn(),
  selectedProjectId: null,
  setSelectedProjectId: vi.fn(),
  isOnline: true,
  currentUser: { id: 'u-1', companyId: 'c-1', name: 'Admin', email: 'a@a.com', role: 'SuperAdmin', permissions: ['view_losses', 'view_billing', 'view_admin', 'create_loss'] },
  hasPermission: vi.fn((p) => ['view_losses', 'view_billing', 'view_admin', 'create_loss'].includes(p)),
  setAuthentication: vi.fn(),
  setIsCliOpen: vi.fn(),
  notifications: [],
  addNotification: vi.fn(),
  markNotificationAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  clearNotifications: vi.fn(),
  settings: {
    language: 'English (US)',
    dateFormat: 'Month/Day/Year',
    timeFormat: 'Twelve Hours (AM/PM)',
    units: {
      temperature: 'Fahrenheit',
      dimension: 'LF Inch',
      humidity: 'Grains / Pound',
      volume: 'Pint',
    },
    copyPhotosToGallery: true,
    defaultView: 'Timeline',
  },
  updateSettings: vi.fn(),
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('DesktopApp', () => {
  beforeEach(() => {
    vi.mocked(useAppContext).mockReturnValue(makeCtx() as ReturnType<typeof useAppContext>);
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  it('renders without crashing', async () => {
    render(<DesktopApp />);
    expect(await screen.findByText('Mission Control')).toBeInTheDocument();
  });

  it('renders the sidebar with navigation buttons', async () => {
    render(<DesktopApp />);
    expect(await screen.findByText('Mission Control')).toBeInTheDocument();
  });

  it('renders the DesktopDashboard on the "dashboard" tab', async () => {
    render(<DesktopApp />);
    await waitFor(() => expect(screen.getByTestId('desktop-dashboard')).toBeInTheDocument());
  });

  // ── Offline banner ───────────────────────────────────────────────────────────

  it('shows the Offline Mode banner when isOnline is false', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      makeCtx({ isOnline: false }) as ReturnType<typeof useAppContext>,
    );
    render(<DesktopApp />);
    expect(await screen.findByText(/Offline Mode Active/i)).toBeInTheDocument();
  });

  it('does NOT show the Offline Mode banner when online', async () => {
    render(<DesktopApp />);
    await screen.findByText('Mission Control');
    expect(screen.queryByText(/Offline Mode Active/i)).not.toBeInTheDocument();
  });

  // ── Sign out ─────────────────────────────────────────────────────────────────

  it('calls setAuthentication(false) when the sign-out button is clicked', async () => {
    const ctx = makeCtx();
    vi.mocked(useAppContext).mockReturnValue(ctx as ReturnType<typeof useAppContext>);
    render(<DesktopApp />);
    const signOutBtn = await screen.findByText('Sign Out');
    fireEvent.click(signOutBtn);
    expect(ctx.setAuthentication).toHaveBeenCalledWith(false);
  });

  // ── Sidebar navigation ───────────────────────────────────────────────────────

  it('calls setActiveTab("dashboard") when Mission Control nav button is clicked', async () => {
    const ctx = makeCtx({ activeTab: 'losses' });
    vi.mocked(useAppContext).mockReturnValue(ctx as ReturnType<typeof useAppContext>);
    render(<DesktopApp />);
    fireEvent.click(await screen.findByText('Mission Control'));
    expect(ctx.setActiveTab).toHaveBeenCalledWith('dashboard');
  });

  it('calls setActiveTab("losses") when Active Jobs nav button is clicked', async () => {
    const ctx = makeCtx();
    vi.mocked(useAppContext).mockReturnValue(ctx as ReturnType<typeof useAppContext>);
    render(<DesktopApp />);
    fireEvent.click(await screen.findByText('Active Jobs'));
    expect(ctx.setSelectedProjectId).toHaveBeenCalledWith(null);
    expect(ctx.setActiveTab).toHaveBeenCalledWith('losses');
  });

  it('calls setActiveTab("billing") when Billing nav button is clicked', async () => {
    const ctx = makeCtx();
    vi.mocked(useAppContext).mockReturnValue(ctx as ReturnType<typeof useAppContext>);
    render(<DesktopApp />);
    fireEvent.click(await screen.findByText('Billing & Invoices'));
    expect(ctx.setActiveTab).toHaveBeenCalledWith('billing');
  });

  it('calls setActiveTab("reporting") when Reports nav button is clicked', async () => {
    const ctx = makeCtx();
    vi.mocked(useAppContext).mockReturnValue(ctx as ReturnType<typeof useAppContext>);
    render(<DesktopApp />);
    fireEvent.click(await screen.findByText('Reports'));
    expect(ctx.setActiveTab).toHaveBeenCalledWith('reporting');
  });

  it('calls setActiveTab("admin") when Admin nav button is clicked', async () => {
    const ctx = makeCtx();
    vi.mocked(useAppContext).mockReturnValue(ctx as ReturnType<typeof useAppContext>);
    render(<DesktopApp />);
    fireEvent.click(await screen.findByText('Admin'));
    expect(ctx.setActiveTab).toHaveBeenCalledWith('admin');
  });

  // ── Permission-gated nav items ───────────────────────────────────────────────

  it('hides Jobs / Billing when permissions are denied', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      makeCtx({ hasPermission: vi.fn().mockReturnValue(false) }) as ReturnType<typeof useAppContext>,
    );
    render(<DesktopApp />);
    await screen.findByText('Mission Control');
    expect(screen.queryByText('Active Jobs')).not.toBeInTheDocument();
    expect(screen.queryByText('Billing & Invoices')).not.toBeInTheDocument();
  });

  // ── Project list secondary sidebar ───────────────────────────────────────────

  it('shows the secondary project list sidebar when activeTab is "losses"', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      makeCtx({ activeTab: 'losses' }) as ReturnType<typeof useAppContext>,
    );
    render(<DesktopApp />);
    await waitFor(() => expect(screen.getByText(/Active Projects/i)).toBeInTheDocument());
  });

  it('loads and displays projects from the API in the sidebar', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      makeCtx({ activeTab: 'losses' }) as ReturnType<typeof useAppContext>,
    );
    render(<DesktopApp />);
    await waitFor(() => expect(screen.getByText('Alpha Corp')).toBeInTheDocument());
    expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  });

  // ── Access Denied component ───────────────────────────────────────────────────

  it('renders Access Restricted when viewing reporting without view_admin permission', async () => {
    vi.mocked(useAppContext).mockReturnValue(
      makeCtx({
        activeTab: 'reporting',
        hasPermission: vi.fn().mockReturnValue(false),
      }) as ReturnType<typeof useAppContext>,
    );
    render(<DesktopApp />);
    await waitFor(() => expect(screen.getByText(/Access Restricted/i)).toBeInTheDocument());
  });
});
