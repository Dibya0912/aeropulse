'use client'

import { useEffect, useMemo, useReducer, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Database,
  Menu,
  Package,
  Plane,
  Search,
  Settings2,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react'
import { prognosticsApiUrl } from '@/lib/runtime-config'
import modelMetadata from '@/ml-service/models/rul_fd001_v1.metadata.json'
import {
  type DemoState,
  type InspectionFinding,
  canPerform,
  createInitialDemoState,
  demoReducer,
  demoStorageKey,
  getActiveUser,
  getAircraftRows,
  getFleetSummary,
  getNotificationHref,
  getPredictionForComponent,
  roleLabels,
} from '@/lib/aeropulse-demo'

type Route = { path: string; query: URLSearchParams }
type NavItem = readonly [label: string, href: string, Icon: typeof Plane]

const nav = [
  { group: 'Operations', items: [['Command center', '/command-center', Plane], ['Fleet registry', '/fleet', ClipboardList], ['Aircraft health', '/aircraft-health', ShieldCheck], ['Predictive alerts', '/alerts', AlertTriangle]] },
  { group: 'Maintenance', items: [['Maintenance board', '/maintenance', Wrench], ['Work orders', '/work-orders', ClipboardList], ['Schedule', '/schedule', CalendarDays]] },
  { group: 'Resources', items: [['Spares', '/spares', Package], ['Personnel & bays', '/resources', Database]] },
  { group: 'System', items: [['Audit trail', '/audit', Database], ['Administration', '/admin', Settings2]] },
] satisfies { group: string; items: NavItem[] }[]

type ModelMetadata = typeof modelMetadata
const trainedModelMetadata = modelMetadata as ModelMetadata
type ServiceStatus = {
  status: 'CHECKING' | 'READY' | 'DEGRADED' | 'BLOCKED'
  apiReachable: boolean
  trainedProvider: boolean
  fallbackProvider: boolean
  message: string
}

function useServiceStatus(): ServiceStatus {
  const [status, setStatus] = useState<ServiceStatus>({
    status: 'CHECKING',
    apiReachable: false,
    trainedProvider: false,
    fallbackProvider: true,
    message: 'Checking FastAPI service health.',
  })

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 2500)
    Promise.all([
      fetch(`${prognosticsApiUrl}/health`, { signal: controller.signal }).then((response) => response.json()),
      fetch(`${prognosticsApiUrl}/models`, { signal: controller.signal }).then((response) => response.json()),
    ])
      .then(([health, models]) => {
        const trainedProvider = health.trained_model_available === true && models.active?.prediction_mode === 'TRAINED_MODEL'
        const fallbackProvider = health.fallback_available === true && models.fallback?.prediction_mode === 'DETERMINISTIC_FALLBACK'
        setStatus({
          status: trainedProvider && fallbackProvider ? 'READY' : fallbackProvider ? 'DEGRADED' : 'BLOCKED',
          apiReachable: true,
          trainedProvider,
          fallbackProvider,
          message: trainedProvider && fallbackProvider ? 'FastAPI and both prognostics modes are available.' : 'FastAPI is reachable, but one prognostics mode is unavailable.',
        })
      })
      .catch(() => {
        setStatus({
          status: 'DEGRADED',
          apiReachable: false,
          trainedProvider: false,
          fallbackProvider: true,
          message: 'FastAPI is unavailable. The AF-017 operational demo still runs locally with deterministic fallback.',
        })
      })
      .finally(() => window.clearTimeout(timeout))
    return () => {
      controller.abort()
      window.clearTimeout(timeout)
    }
  }, [])

  return status
}

function routeFromLocation(): Route {
  return { path: window.location.pathname || '/command-center', query: new URLSearchParams(window.location.search) }
}

function go(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

function ButtonLink({ children, href, className = '' }: { children: React.ReactNode; href: string; className?: string }) {
  return <button className={`link-button ${className}`} onClick={() => go(href)}>{children}</button>
}

function Status({ children }: { children: React.ReactNode }) {
  const value = String(children).toLowerCase().replaceAll(' ', '-').replaceAll('_', '-')
  return <span className={`status status-${value}`}>{children}</span>
}

function Panel({ title, eyebrow, children, className = '' }: { title: string; eyebrow?: string; children: React.ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h2>{title}</h2></div><ChevronRight aria-hidden="true" className="panel-arrow" /></div>{children}</section>
}

function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return <nav className="breadcrumbs" aria-label="Breadcrumb">{items.map((item, index) => <span key={`${item.label}-${index}`}>{item.href ? <ButtonLink href={item.href}>{item.label}</ButtonLink> : item.label}{index < items.length - 1 && <b>/</b>}</span>)}</nav>
}

function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p className="subtitle">{subtitle}</p></div><div className="date-button"><CalendarDays />03 Oct 2026</div></div>
}

function DataPage({ title, subtitle, children, crumbs, eyebrow = 'AEROPULSE OPERATIONS · DETERMINISTIC DEMO DATA' }: { title: string; subtitle: string; children: React.ReactNode; crumbs?: { label: string; href?: string }[]; eyebrow?: string }) {
  return <><PageHeader eyebrow={eyebrow} title={title} subtitle={subtitle} />{crumbs && <Breadcrumbs items={crumbs} />}{children}</>
}

function AppMessage({ state }: { state: DemoState }) {
  if (!state.lastMessage) return null
  return <p className={state.lastMessage.type === 'error' ? 'error-note' : 'success-note'}>{state.lastMessage.text}</p>
}

function currentUserNotifications(state: DemoState) {
  const user = getActiveUser(state)
  return Object.values(state.notifications)
    .filter((item) => item.recipientRole === user.role && (!item.recipientUserId || item.recipientUserId === user.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

function NotificationPanel({ state, dispatch }: { state: DemoState; dispatch: React.Dispatch<Parameters<typeof demoReducer>[1]> }) {
  const items = currentUserNotifications(state)
  return <div className="search-overlay"><div className="search-dialog"><div className="panel-heading"><div><p className="eyebrow">ROLE NOTIFICATIONS</p><h2>{roleLabels[getActiveUser(state).role]}</h2></div><button className="secondary-button" onClick={() => dispatch({ type: 'MARK_ALL_NOTIFICATIONS_READ' })}>Mark all read</button></div><div className="events">{items.length === 0 && <p className="body-copy">No notifications for this role.</p>}{items.map((item) => <div className="notification-row" key={item.id}><ButtonLink href={getNotificationHref(item)} className={item.read ? '' : 'active'}><time>{item.createdAt}</time><span><b>{item.title}</b><small>{item.message}</small></span></ButtonLink><button className="secondary-button" onClick={() => dispatch({ type: 'MARK_NOTIFICATION_READ', notificationId: item.id })}>Read</button></div>)}</div></div></div>
}

function telemetryKey(aircraftId: string, componentId: string) {
  return `${aircraftId}:${componentId}`
}

function CommandCenter({ state }: { state: DemoState }) {
  const summary = getFleetSummary(state)
  const rows = getAircraftRows(state)
  const workOrders = Object.values(state.workOrders)
  const activeWorkOrders = workOrders.filter((order) => order.status !== 'VERIFIED')
  const activeAlerts = Object.values(state.alerts).filter((alert) => alert.status !== 'RESOLVED')
  const golden = state.workOrders['WO-1048']
  const part = state.parts[golden.requiredPartId]

  return <>
    <PageHeader eyebrow="03 OCT 2026 · 14:32 IST · SEEDED TELEMETRY DEMO" title="Command center" subtitle="Fleet operational readiness and connected AF-017 maintenance flow" />
    <div className="readiness-strip"><div className="readiness-intro"><p className="eyebrow">FLEET READINESS</p><strong>{summary.availability}%</strong><span>availability</span></div>{[
      ['Total fleet', String(summary.total), 'demo aircraft', '/fleet'],
      ['Ready', String(summary.ready), `${summary.availability}% of fleet`, '/fleet?status=READY'],
      ['Maintenance', String(summary.maintenance), `${activeWorkOrders.length} active WO`, '/maintenance'],
      ['High risk', String(summary.highRisk), `${activeAlerts.length} active alert`, '/alerts'],
    ].map(([label, value, note, href]) => <ButtonLink key={label} href={href} className="metric"><span>{label}</span><strong className={label === 'Ready' ? 'good' : label === 'High risk' ? 'bad' : ''}>{value}</strong><small>{note}</small></ButtonLink>)}<div className="target"><span>Target</span><strong>85%</strong><div><i style={{ width: `${Math.min(summary.availability, 100)}%` }} /></div></div></div>
    <div className="primary-grid"><Panel title="Fleet readiness" eyebrow="DERIVED FROM AIRCRAFT STATUS" className="chart-panel"><div className="chart-summary"><strong>{summary.availability}%</strong><span className="trend">{summary.ready}/{summary.total} ready</span><small>Updates when AF-017 is verified</small></div><div className="line-chart"><div className="chart-lines"><i /><i /><i /><i /></div><svg viewBox="0 0 700 170" preserveAspectRatio="none" aria-label="Fleet availability trend"><path d="M0 128 C80 132 125 117 190 123 S300 104 360 110 S470 86 540 96 S620 65 700 72" fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg></div><div className="axis"><span>SEEDED</span><span>ALERT</span><span>WORK</span><span>VERIFY</span></div></Panel><Panel title="Attention required" eyebrow="RANKED BY CURRENT STATE"><div className="attention-list">{activeAlerts.map((alert) => <ButtonLink key={alert.id} href={`/alerts/${alert.id}`}><b className="priority p1">{alert.severity}</b><strong>{alert.aircraftId} · {alert.componentId}</strong><span>RUL {alert.rulCycles} cycles · {alert.reason}</span><time>{alert.createdAt.split(', ')[1]}</time></ButtonLink>)}{activeWorkOrders.map((order) => <ButtonLink key={order.id} href={`/work-orders/${order.id}`}><b className="priority p2">{order.priority}</b><strong>{order.id} · {order.status}</strong><span>{order.requiredPartId} reserved · {state.bays[order.bayId].name}</span><time>Live</time></ButtonLink>)}{activeAlerts.length === 0 && activeWorkOrders.length === 0 && <p className="body-copy">No active alerts or open work orders.</p>}</div><ButtonLink href="/alerts" className="text-button">View all alerts <ChevronRight /></ButtonLink></Panel></div>
    <Panel title="Fleet status" eyebrow={`${summary.total} DEMO AIRCRAFT · SHARED SOURCE`}><FleetTable rows={rows} /></Panel>
    <div className="lower-grid"><Panel title="Maintenance load" eyebrow="DERIVED FROM WORK ORDERS"><div className="load-grid">{[
      [String(workOrders.filter((wo) => wo.status === 'SCHEDULED').length), 'Scheduled'],
      [String(workOrders.filter((wo) => wo.status === 'IN_PROGRESS').length), 'In progress'],
      [String(workOrders.filter((wo) => wo.status === 'COMPLETED').length), 'Awaiting verification'],
      [String(workOrders.filter((wo) => wo.status === 'VERIFIED').length), 'Verified'],
    ].map(([n, label]) => <div key={label}><strong>{n}</strong><span>{label}</span></div>)}</div><div className="load-bar"><i style={{ width: '50%' }} /><i style={{ width: '25%' }} /><i style={{ width: '25%' }} /></div></Panel><Panel title="Spares at risk" eyebrow="INVENTORY SIGNALS"><div className="spare-row"><ButtonLink href={`/spares/${part.id}`}><strong>{part.id}</strong></ButtonLink><span>Available <b>{part.onHand - part.reserved}</b></span><span>Forecast need <b>{part.forecastNeed}</b></span><Status>{part.onHand - part.reserved <= part.reorderLevel ? 'SHORTAGE RISK' : 'READY'}</Status></div><ButtonLink href="/spares" className="text-button">Open spares intelligence <ChevronRight /></ButtonLink></Panel></div>
    <div className="lower-grid"><Panel title="Recent operational events" eyebrow="AUDIT RECORDS"><AuditList state={state} limit={3} /></Panel><Panel title="System traceability" eyebrow="ACTUAL IMPLEMENTATION CONTEXT"><div className="trace"><p><Database />Telemetry source <b>Seeded sequence</b></p><p><ShieldCheck />Prediction engine <b>Rule-based demo</b></p><p><ClipboardList />Last audit event <b>{state.audit[0]?.time}</b></p></div></Panel></div>
  </>
}

function FleetTable({ rows }: { rows: ReturnType<typeof getAircraftRows> }) {
  return <div className="table-wrap"><table><thead><tr><th>AIRCRAFT</th><th>STATUS</th><th>HEALTH</th><th>TOP RISK</th><th>RUL</th><th>OPEN ALERTS</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><ButtonLink href={`/fleet/${row.id}`}><strong>{row.id}</strong><small>{row.type} · {row.location}</small></ButtonLink></td><td><Status>{row.status}</Status></td><td><div className="health"><span>{row.health}%</span><i><b className={row.status === 'HIGH RISK' ? 'critical' : row.status === 'MAINTENANCE' ? 'watch' : ''} style={{ width: `${row.health}%` }} /></i></div></td><td><ButtonLink href={row.topRisk === '-' ? `/fleet/${row.id}` : `/fleet/${row.id}/components/${row.topRisk}`}>{row.topRisk}</ButtonLink></td><td><ButtonLink href={`/fleet/${row.id}/prognostics`}>{row.rul}</ButtonLink></td><td><ButtonLink href={`/alerts?aircraft=${row.id}`}>{row.alerts}</ButtonLink></td></tr>)}</tbody></table></div>
}

function FleetPage({ state, route }: { state: DemoState; route: Route }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState(route.query.get('status') ?? 'ALL')
  const rows = getAircraftRows(state).filter((item) => (!search || item.id.toLowerCase().includes(search.toLowerCase())) && (status === 'ALL' || item.status === status))

  return <DataPage title="Fleet registry" subtitle="A single operational register for aircraft readiness, health and risk"><Panel title="Aircraft registry" eyebrow={`${rows.length} SHOWN · SHARED DEMO STATE`}><div className="filters"><div className="search-field"><Search /><input aria-label="Search aircraft" placeholder="Search aircraft ID" value={search} onChange={(event) => setSearch(event.target.value)} /></div><select aria-label="Filter by status" value={status} onChange={(event) => { setStatus(event.target.value); go(`/fleet?status=${event.target.value}`) }}><option>ALL</option><option>READY</option><option>HIGH RISK</option><option>MAINTENANCE</option></select></div>{rows.length === 0 ? <p className="body-copy">No aircraft match the current filter.</p> : <FleetTable rows={rows} />}</Panel></DataPage>
}

function AircraftPage({ state, id }: { state: DemoState; id: string }) {
  const aircraft = state.aircraft[id]
  if (!aircraft) return <GenericPage title="Aircraft not found" subtitle={`No demo aircraft record exists for ${id}.`} links={[{ label: 'Fleet registry', href: '/fleet', note: 'Return to the shared four-aircraft demo fleet.' }]} />
  const component = aircraft.componentIds.map((componentId) => state.components[componentId]).find(Boolean)
  const prediction = component ? getPredictionForComponent(state, aircraft.id, component.id) : undefined
  const openAlerts = Object.values(state.alerts).filter((alert) => alert.aircraftId === aircraft.id && alert.status !== 'RESOLVED')

  return <DataPage title={`${aircraft.id} health passport`} subtitle={`${aircraft.type} · ${aircraft.location} · unified aircraft health record`} crumbs={[{ label: 'Fleet registry', href: '/fleet' }, { label: aircraft.id }]}><div className="detail-hero"><div><span className="eyebrow">AIRCRAFT ID</span><h2>{aircraft.id}</h2><p>{aircraft.type} · {aircraft.operatingHours} hours · {aircraft.operatingCycles} cycles</p></div><Status>{aircraft.status}</Status></div><div className="tabs"><ButtonLink href={`/fleet/${aircraft.id}`}>Overview</ButtonLink><ButtonLink href={`/fleet/${aircraft.id}/components/${component?.id ?? 'ENG-02'}`}>Components</ButtonLink><ButtonLink href={`/fleet/${aircraft.id}/prognostics`}>Prognostics</ButtonLink><ButtonLink href={`/work-orders/WO-1048`}>Maintenance</ButtonLink><ButtonLink href={`/audit?entity=aircraft&id=${aircraft.id}`}>History</ButtonLink></div><div className="detail-grid"><Panel title="Readiness profile" eyebrow="CURRENT STATE"><div className="big-number">{aircraft.health}% <small>overall health</small></div><div className="stat-list"><p>Failure risk <b>{prediction?.failureRisk ?? 'LOW'}</b></p><p>Remaining useful life <ButtonLink href={`/fleet/${aircraft.id}/prognostics`}>{prediction ? `${prediction.rulCycles} cycles` : '-'}</ButtonLink></p><p>Active alerts <ButtonLink href={`/alerts?aircraft=${aircraft.id}`}>{openAlerts.length}</ButtonLink></p><p>Last maintenance <b>{aircraft.lastMaintenance}</b></p><p>Next maintenance <b>{aircraft.nextMaintenance}</b></p></div></Panel><Panel title="Next action" eyebrow="OPERATOR GUIDANCE"><div className="action-card"><AlertTriangle /><strong>{aircraft.status === 'READY' ? 'Aircraft restored to ready state' : 'Inspect and execute ENG-02 work order'}</strong><p>Recommendations are produced by deterministic prototype rules and require human approval.</p><ButtonLink href={aircraft.status === 'READY' ? '/fleet' : '/work-orders/WO-1048'} className="primary-button">{aircraft.status === 'READY' ? 'Return to fleet' : 'Open work order'} <ChevronRight /></ButtonLink></div></Panel></div></DataPage>
}

function ComponentPage({ state, aircraftId, componentId }: { state: DemoState; aircraftId: string; componentId: string }) {
  if (!state.aircraft[aircraftId]) return <GenericPage title="Aircraft not found" subtitle={`No demo aircraft record exists for ${aircraftId}.`} links={[{ label: 'Fleet registry', href: '/fleet', note: 'Return to the shared four-aircraft demo fleet.' }]} />
  const component = state.components[componentId]
  if (!component || component.aircraftId !== aircraftId) return <GenericPage title="Component not found" subtitle={`No component ${componentId} is assigned to ${aircraftId}.`} links={[{ label: 'Aircraft passport', href: `/fleet/${aircraftId}`, note: 'Open the aircraft health passport.' }]} />
  const prediction = getPredictionForComponent(state, aircraftId, component.id)
  const telemetry = state.telemetry[telemetryKey(aircraftId, component.id)] ?? []
  const latest = telemetry.at(-1)

  return <DataPage title={`${component.id} component health`} subtitle="Evidence, degradation signals and traceable maintenance action" crumbs={[{ label: 'Fleet registry', href: '/fleet' }, { label: aircraftId, href: `/fleet/${aircraftId}` }, { label: component.id }]}><div className="detail-grid"><Panel title="Component passport" eyebrow="COMPONENT HEALTH"><div className="component-summary"><strong>{component.id}</strong><Status>{component.status}</Status></div><div className="stat-list"><p>Component type <b>{component.name}</b></p><p>Current health <b>{component.health}%</b></p><p>Remaining useful life <b>{prediction ? `${prediction.rulCycles} cycles` : '-'}</b></p><p>Anomaly score <b>{prediction?.anomalyScore.toFixed(2) ?? '-'}</b></p><p>Last inspection <b>{component.lastInspection}</b></p></div></Panel><Panel title="Telemetry snapshot" eyebrow="SEEDED SENSOR CHANNELS"><div className="stat-list"><p>Temperature <b>{latest?.temperature ?? '-'} C</b></p><p>Vibration <b>{latest?.vibration.toFixed(2) ?? '-'} g</b></p><p>Pressure <b>{latest?.pressure.toFixed(1) ?? '-'} psi</b></p><p>RPM <b>{latest?.rpm ?? '-'}</b></p><p>Operating cycle <b>{latest?.cycle ?? '-'}</b></p></div><ButtonLink href={`/fleet/${aircraftId}/prognostics`} className="primary-button">View prognostics</ButtonLink><ButtonLink href="/alerts/ALT-017-ENG02-001" className="secondary-button">View active alert</ButtonLink></Panel></div></DataPage>
}

function PrognosticsPage({ state, aircraftId }: { state: DemoState; aircraftId: string }) {
  if (!state.aircraft[aircraftId]) return <GenericPage title="Aircraft not found" subtitle={`No demo aircraft record exists for ${aircraftId}.`} links={[{ label: 'Fleet registry', href: '/fleet', note: 'Return to the shared four-aircraft demo fleet.' }]} />
  const componentId = state.aircraft[aircraftId]?.componentIds[0] ?? 'ENG-02'
  const prediction = getPredictionForComponent(state, aircraftId, componentId)

  if (!prediction) return <GenericPage title="Prognostics" subtitle="No active prediction for this aircraft" links={[{ label: 'Fleet registry', href: '/fleet', note: 'Return to the shared aircraft registry.' }]} />

  return <DataPage title="Prognostics" subtitle="RUL, anomaly and risk evidence with explicit prediction mode" crumbs={[{ label: aircraftId, href: `/fleet/${aircraftId}` }, { label: 'Prognostics' }]}><div className="detail-grid"><Panel title={`${aircraftId} · ${componentId}`} eyebrow={prediction.predictionMode}><div className="big-number">{prediction.rulCycles} <small>{prediction.rulUnit} RUL</small></div><div className="stat-list"><p>Failure risk <b>{prediction.failureRisk}</b></p><p>Anomaly state <b>{prediction.anomalyState}</b></p><p>Anomaly score <b>{prediction.anomalyScore.toFixed(2)}</b></p><p>Generated <b>{prediction.generatedAt}</b></p><p>Model <b>{prediction.modelId} · {prediction.modelVersion}</b></p><p>Model type <b>{prediction.modelType}</b></p><p>Prediction record <ButtonLink href={`/predictions/${prediction.id}`}>{prediction.id}</ButtonLink></p></div></Panel><Panel title="Evidence" eyebrow="INPUT SIGNALS"><div className="stat-list"><p>Cycle span <b>{prediction.inputSignals.cycleSpan}</b></p><p>Latest temperature <b>{prediction.inputSignals.latestTemperature} C</b></p><p>Latest vibration <b>{prediction.inputSignals.latestVibration.toFixed(2)} g</b></p><p>Latest pressure <b>{prediction.inputSignals.latestPressure.toFixed(1)} psi</b></p><p>Temperature rise <b>{prediction.inputSignals.temperatureRise} C</b></p><p>Vibration rise <b>{prediction.inputSignals.vibrationRise.toFixed(2)} g</b></p><p>Pressure drop <b>{prediction.inputSignals.pressureDrop.toFixed(1)} psi</b></p></div></Panel></div><div className="detail-grid"><Panel title="Risk derivation" eyebrow="TRANSPARENT LOGIC">{prediction.riskDerivation.map((line) => <p className="body-copy" key={line}>{line}</p>)}</Panel><Panel title="Rule contributions" eyebrow="FALLBACK EXPLAINABILITY">{prediction.explanation.map((line) => <p className="body-copy" key={line}>{line}</p>)}<ButtonLink href="/alerts/ALT-017-ENG02-001" className="primary-button">Open linked alert</ButtonLink></Panel></div></DataPage>
}

function PredictionDetailPage({ state, predictionId }: { state: DemoState; predictionId: string }) {
  const prediction = state.predictions[predictionId]
  if (!prediction) return <GenericPage title="Prediction not found" subtitle={`No prediction record exists for ${predictionId}.`} links={[{ label: 'AF-017 prognostics', href: '/fleet/AF-017/prognostics', note: 'Open the deterministic AF-017 / ENG-02 prediction evidence.' }, { label: 'Model Validation', href: '/admin/model-validation', note: 'Open the trained benchmark validation page.' }]} />
  const alert = Object.values(state.alerts).find((item) => item.predictionId === prediction.id)
  const workOrder = alert ? Object.values(state.workOrders).find((item) => item.sourceAlertId === alert.id) : undefined
  const component = state.components[prediction.componentId]
  const aircraft = state.aircraft[prediction.aircraftId]

  return <DataPage title={prediction.id} subtitle="Prediction traceability from telemetry to maintenance outcome" crumbs={[{ label: 'Prognostics', href: `/fleet/${prediction.aircraftId}/prognostics` }, { label: prediction.id }]}><div className="detail-grid"><Panel title="Prediction record" eyebrow={prediction.status.replaceAll('_', ' ')}><div className="stat-list"><p>Aircraft <ButtonLink href={`/fleet/${prediction.aircraftId}`}>{prediction.aircraftId}</ButtonLink></p><p>Component <ButtonLink href={`/fleet/${prediction.aircraftId}/components/${prediction.componentId}`}>{prediction.componentId}</ButtonLink></p><p>Mode <b>{prediction.predictionMode}</b></p><p>Model <b>{prediction.modelId} · {prediction.modelVersion}</b></p><p>Dataset <b>{prediction.dataset ?? 'None used for fallback'}</b></p><p>RUL <b>{prediction.rulCycles} {prediction.rulUnit}</b></p><p>Anomaly <b>{prediction.anomalyState} · {prediction.anomalyScore.toFixed(2)}</b></p><p>Risk <b>{prediction.failureRisk}</b></p></div></Panel><Panel title="Maintenance outcome" eyebrow="POST-MAINTENANCE STATE"><div className="stat-list"><p>Aircraft current status <b>{aircraft.status}</b></p><p>Aircraft current health <b>{aircraft.health}%</b></p><p>Component current status <b>{component.status}</b></p><p>Component current health <b>{component.health}%</b></p><p>Alert {alert ? <ButtonLink href={`/alerts/${alert.id}`}>{alert.id} · {alert.status}</ButtonLink> : <b>None</b>}</p><p>Work order {workOrder ? <ButtonLink href={`/work-orders/${workOrder.id}`}>{workOrder.id} · {workOrder.status}</ButtonLink> : <b>None</b>}</p></div></Panel></div><Panel title="Telemetry/input snapshot" eyebrow="RECORDED EVIDENCE"><div className="table-wrap"><table><thead><tr><th>SIGNAL</th><th>VALUE</th></tr></thead><tbody>{Object.entries(prediction.inputSignals).map(([key, value]) => <tr key={key}><td>{key}</td><td>{value}</td></tr>)}</tbody></table></div></Panel><Panel title="Explanation" eyebrow="NO SHAP CLAIM">{[...prediction.explanation, ...prediction.riskDerivation].map((line) => <p className="body-copy" key={line}>{line}</p>)}</Panel></DataPage>
}

function AlertsPage({ state, alertId, dispatch }: { state: DemoState; alertId?: string; dispatch: React.Dispatch<Parameters<typeof demoReducer>[1]> }) {
  if (alertId) return <AlertDetail state={state} alertId={alertId} dispatch={dispatch} />
  const alerts = Object.values(state.alerts)

  return <DataPage title="Predictive alerts" subtitle="Prioritized rule-based signals requiring human review"><Panel title="Alert center" eyebrow={`${alerts.length} DEMO SIGNALS`}><div className="table-wrap"><table><thead><tr><th>SEVERITY</th><th>ALERT</th><th>AIRCRAFT</th><th>COMPONENT</th><th>REASON</th><th>RUL</th><th>STATUS</th><th>ACTION</th></tr></thead><tbody>{alerts.map((alert) => <tr key={alert.id}><td><Status>{alert.severity}</Status></td><td><ButtonLink href={`/alerts/${alert.id}`}><strong>{alert.id}</strong></ButtonLink></td><td><ButtonLink href={`/fleet/${alert.aircraftId}`}>{alert.aircraftId}</ButtonLink></td><td><ButtonLink href={`/fleet/${alert.aircraftId}/components/${alert.componentId}`}>{alert.componentId}</ButtonLink></td><td>{alert.reason}</td><td>{alert.rulCycles} cycles</td><td><Status>{alert.status}</Status></td><td><ButtonLink href={`/alerts/${alert.id}`} className="text-button">Review</ButtonLink></td></tr>)}</tbody></table></div></Panel></DataPage>
}

function AlertDetail({ state, alertId, dispatch }: { state: DemoState; alertId: string; dispatch: React.Dispatch<Parameters<typeof demoReducer>[1]> }) {
  const alert = state.alerts[alertId]
  if (!alert) return <GenericPage title="Alert not found" subtitle={`No predictive alert exists for ${alertId}.`} links={[{ label: 'Predictive alerts', href: '/alerts', note: 'Return to the alert center.' }]} />
  const prediction = state.predictions[alert.predictionId]

  return <DataPage title={alert.id} subtitle={`Critical predictive alert · generated ${alert.createdAt}`} crumbs={[{ label: 'Predictive alerts', href: '/alerts' }, { label: alert.id }]}><div className="detail-grid"><Panel title="Prediction evidence" eyebrow={`${alert.severity} · ${alert.status}`}><div className="stat-list"><p>Aircraft <ButtonLink href={`/fleet/${alert.aircraftId}`}>{alert.aircraftId}</ButtonLink></p><p>Component <ButtonLink href={`/fleet/${alert.aircraftId}/components/${alert.componentId}`}>{alert.componentId}</ButtonLink></p><p>Prediction <ButtonLink href={`/fleet/${alert.aircraftId}/prognostics`}>{prediction.id}</ButtonLink></p><p>RUL <b>{alert.rulCycles} cycles</b></p><p>Anomaly <b>{prediction.anomalyScore.toFixed(2)}</b></p><p>Engine <b>{prediction.version}</b></p></div></Panel><Panel title="Operator actions" eyebrow="HUMAN APPROVAL REQUIRED"><p className="body-copy">{alert.reason}. This is a deterministic prototype signal generated by fixed rules.</p>{alert.status === 'NEW' && <button className="primary-button" onClick={() => dispatch({ type: 'ACK_ALERT', alertId: alert.id })}><CheckCircle2 />Acknowledge alert</button>}{alert.status !== 'NEW' && <p className="success-note"><CheckCircle2 /> Alert status: {alert.status}</p>}<ButtonLink href="/work-orders/WO-1048" className="primary-button">View work order WO-1048</ButtonLink><ButtonLink href={`/fleet/${alert.aircraftId}`} className="secondary-button">View aircraft</ButtonLink></Panel></div></DataPage>
}

function WorkOrdersPage({ state, orderId, dispatch }: { state: DemoState; orderId?: string; dispatch: React.Dispatch<Parameters<typeof demoReducer>[1]> }) {
  if (orderId) return <WorkOrderDetail state={state} orderId={orderId} dispatch={dispatch} />
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL STATUS')
  const orders = Object.values(state.workOrders).filter((order) => {
    const matchesSearch = !search.trim() || [order.id, order.aircraftId, order.componentId].some((value) => value.toLowerCase().includes(search.toLowerCase()))
    const matchesStatus = status === 'ALL STATUS' || order.status === status
    return matchesSearch && matchesStatus
  })

  return <DataPage title="Work orders" subtitle="Traceable maintenance execution from prediction to verification"><Panel title="Work order register" eyebrow={`${orders.length} SHOWN`}><div className="filters"><div className="search-field"><Search /><input aria-label="Search work orders" placeholder="Search WO, aircraft or component" value={search} onChange={(event) => setSearch(event.target.value)} /></div><select aria-label="Filter work order status" value={status} onChange={(event) => setStatus(event.target.value)}><option>ALL STATUS</option><option>IN_PROGRESS</option><option>SCHEDULED</option><option>COMPLETED</option><option>VERIFIED</option></select></div>{orders.length === 0 ? <p className="body-copy">No work orders match the current filter.</p> : <div className="table-wrap"><table><thead><tr><th>WORK ORDER</th><th>AIRCRAFT</th><th>COMPONENT</th><th>PRIORITY</th><th>SOURCE</th><th>STATUS</th><th>TECHNICIAN</th><th>BAY</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><ButtonLink href={`/work-orders/${order.id}`}><strong>{order.id}</strong></ButtonLink></td><td><ButtonLink href={`/fleet/${order.aircraftId}`}>{order.aircraftId}</ButtonLink></td><td>{order.componentId}</td><td>{order.priority}</td><td><ButtonLink href={`/alerts/${order.sourceAlertId}`}>{order.sourceAlertId}</ButtonLink></td><td><Status>{order.status}</Status></td><td><ButtonLink href={`/resources/personnel/${order.technicianId}`}>{state.technicians[order.technicianId].name}</ButtonLink></td><td><ButtonLink href={`/resources/bays/${order.bayId}`}>{state.bays[order.bayId].name}</ButtonLink></td></tr>)}</tbody></table></div>}</Panel></DataPage>
}

function WorkOrderDetail({ state, orderId, dispatch }: { state: DemoState; orderId: string; dispatch: React.Dispatch<Parameters<typeof demoReducer>[1]> }) {
  const order = state.workOrders[orderId]
  if (!order) return <GenericPage title="Work order not found" subtitle={`No work order exists for ${orderId}.`} links={[{ label: 'Work orders', href: '/work-orders', note: 'Return to the work-order register.' }]} />
  const part = state.parts[order.requiredPartId]
  const technician = state.technicians[order.technicianId]
  const bay = state.bays[order.bayId]
  const [actionText, setActionText] = useState(order.maintenanceAction ?? '')
  const canComplete = order.status === 'IN_PROGRESS' && order.inspectionFinding !== 'PENDING' && order.partConsumed && Boolean(order.maintenanceAction?.trim())

  return <DataPage title={order.id} subtitle="Predictive maintenance execution record" crumbs={[{ label: 'Work orders', href: '/work-orders' }, { label: order.id }]}><div className="detail-hero"><div><span className="eyebrow">WORK ORDER · {order.priority}</span><h2>{order.aircraftId} · {order.componentId}</h2><p>Source alert <ButtonLink href={`/alerts/${order.sourceAlertId}`}>{order.sourceAlertId}</ButtonLink></p></div><Status>{order.status}</Status></div><div className="detail-grid"><Panel title="Issue and traceability" eyebrow="PREDICTIVE SOURCE"><div className="stat-list"><p>Aircraft <ButtonLink href={`/fleet/${order.aircraftId}`}>{order.aircraftId}</ButtonLink></p><p>Component <ButtonLink href={`/fleet/${order.aircraftId}/components/${order.componentId}`}>{order.componentId}</ButtonLink></p><p>Source prediction <ButtonLink href="/predictions/PRED-017-ENG02-001">PRED-017-ENG02-001</ButtonLink></p><p>Required part <ButtonLink href={`/spares/${part.id}`}>{part.id}</ButtonLink></p><p>Reservation <b>{order.reservationComplete ? 'RESERVED' : 'NOT RESERVED'}</b></p><p>Part consumed <b>{order.partConsumed ? 'YES' : 'NO'}</b></p><p>Maintenance action <b>{order.maintenanceAction ?? 'Required before completion'}</b></p><p>Technician <ButtonLink href={`/resources/personnel/${technician.id}`}>{technician.name}</ButtonLink></p><p>Bay <ButtonLink href={`/resources/bays/${bay.id}`}>{bay.name}</ButtonLink></p><p>Schedule <b>{order.scheduledWindow}</b></p></div></Panel><Panel title="Workflow actions" eyebrow="CENTRAL PERMISSION CHECKS"><div className="workflow"><span className="active">{order.status}</span><b>·</b><span>Finding: {order.inspectionFinding}</span></div><p className="body-copy">Prototype authorization is enforced in the shared reducer. Unauthorized attempts are blocked with a message.</p>{order.status === 'DRAFT' && <button className="primary-button" disabled={!canPerform(state, 'SUBMIT_WORK_ORDER')} onClick={() => dispatch({ type: 'SUBMIT_WORK_ORDER', workOrderId: order.id })}>Submit for approval</button>}{order.status === 'PENDING_APPROVAL' && <button className="primary-button" disabled={!canPerform(state, 'APPROVE_WORK_ORDER')} onClick={() => dispatch({ type: 'APPROVE_WORK_ORDER', workOrderId: order.id })}>Approve work order</button>}{order.status === 'APPROVED' && <button className="primary-button" disabled={!canPerform(state, 'SCHEDULE_WORK_ORDER')} onClick={() => dispatch({ type: 'SCHEDULE_WORK_ORDER', workOrderId: order.id })}>Schedule work</button>}{order.status === 'SCHEDULED' && <button className="primary-button" disabled={!canPerform(state, 'START_WORK')} onClick={() => dispatch({ type: 'START_WORK', workOrderId: order.id })}>Start work</button>}{order.status === 'IN_PROGRESS' && <div className="work-action-stack"><div className="filters"><select aria-label="Inspection finding" value={order.inspectionFinding} disabled={!canPerform(state, 'RECORD_INSPECTION')} onChange={(event) => dispatch({ type: 'RECORD_INSPECTION', workOrderId: order.id, finding: event.target.value as InspectionFinding })}><option value="PENDING">PENDING</option><option value="CONFIRMED">CONFIRMED</option><option value="PARTIALLY_CONFIRMED">PARTIALLY_CONFIRMED</option><option value="NOT_CONFIRMED">NOT_CONFIRMED</option></select><button className="secondary-button" disabled={!canPerform(state, 'CONSUME_PART') || order.partConsumed} onClick={() => dispatch({ type: 'CONSUME_PART', workOrderId: order.id })}>Consume {part.id}</button></div><div className="action-input"><textarea aria-label="Maintenance action details" placeholder="Record maintenance action before completion" value={actionText} disabled={!canPerform(state, 'RECORD_INSPECTION')} onChange={(event) => setActionText(event.target.value)} /><button className="secondary-button" disabled={!canPerform(state, 'RECORD_INSPECTION') || !actionText.trim()} onClick={() => dispatch({ type: 'RECORD_MAINTENANCE_ACTION', workOrderId: order.id, text: actionText })}>Record action</button></div><button className="primary-button" disabled={!canPerform(state, 'COMPLETE_WORK') || !canComplete} onClick={() => dispatch({ type: 'COMPLETE_WORK', workOrderId: order.id })}>Complete work</button></div>}{order.status === 'COMPLETED' && <div className="filters"><button className="primary-button" disabled={!canPerform(state, 'VERIFY_WORK')} onClick={() => dispatch({ type: 'VERIFY_WORK', workOrderId: order.id })}>Verify and restore aircraft</button><button className="secondary-button" disabled={!canPerform(state, 'RETURN_REWORK')} onClick={() => dispatch({ type: 'RETURN_REWORK', workOrderId: order.id, remarks: 'Officer returned work for re-inspection.' })}>Return for rework</button></div>}{order.status === 'REWORK_REQUIRED' && <button className="primary-button" disabled={!canPerform(state, 'START_WORK')} onClick={() => dispatch({ type: 'START_WORK', workOrderId: order.id })}>Resume rework</button>}{order.status === 'VERIFIED' && <p className="success-note"><CheckCircle2 /> Verified by {order.verifiedBy}; AF-017 is READY.</p>}<ButtonLink href="/audit?entity=work-order&id=WO-1048" className="secondary-button">View audit timeline</ButtonLink></Panel></div><Panel title="Transition history" eyebrow="WORKFLOW TRACE"><div className="table-wrap"><table><thead><tr><th>TIME</th><th>FROM</th><th>TO</th><th>ACTOR</th><th>REMARKS</th></tr></thead><tbody>{order.transitionHistory.map((entry) => <tr key={entry.id}><td>{entry.time}</td><td>{entry.from}</td><td><Status>{entry.to}</Status></td><td>{entry.actor}<small>{roleLabels[entry.actorRole]}</small></td><td>{entry.remarks}</td></tr>)}</tbody></table></div></Panel></DataPage>
}

function SparesPage({ state, partId, dispatch }: { state: DemoState; partId?: string; dispatch: React.Dispatch<Parameters<typeof demoReducer>[1]> }) {
  if (partId) {
    const part = state.parts[partId]
    if (!part) return <GenericPage title="Part not found" subtitle={`No spare part record exists for ${partId}.`} links={[{ label: 'Spares', href: '/spares', note: 'Return to the spares register.' }]} />
    const order = state.workOrders['WO-1048']
    const transactions = state.inventoryTransactions.filter((item) => item.partId === part.id)
    return <DataPage title={part.id} subtitle="Inventory position, reservations and predicted demand" crumbs={[{ label: 'Spares', href: '/spares' }, { label: part.id }]}><div className="detail-grid"><Panel title="Inventory position" eyebrow="PART DETAIL"><div className="big-number">{part.onHand - part.reserved} <small>available</small></div><div className="stat-list"><p>Part number <b>{part.partNumber}</b></p><p>Location <b>{part.location}</b></p><p>Condition <b>{part.condition}</b></p><p>On hand <b>{part.onHand}</b></p><p>Reserved <b>{part.reserved}</b></p><p>Consumed <b>{part.consumed}</b></p><p>Reorder level <b>{part.reorderLevel}</b></p><p>Lead time <b>{part.leadTimeDays} days</b></p></div></Panel><Panel title="Inventory controls" eyebrow="ROLE-GATED"><p className="body-copy">BRG-X21 is reserved for <ButtonLink href="/work-orders/WO-1048">WO-1048</ButtonLink>. Reservation, release and consumption are blocked when lifecycle or role rules do not allow them.</p><div className="filters"><button className="secondary-button" disabled={!canPerform(state, 'RESERVE_PART') || order.reservationComplete} onClick={() => dispatch({ type: 'RESERVE_PART', workOrderId: order.id, partId: part.id, quantity: 1 })}>Reserve 1</button><button className="secondary-button" disabled={!canPerform(state, 'RELEASE_PART') || !order.reservationComplete || order.partConsumed} onClick={() => dispatch({ type: 'RELEASE_PART', workOrderId: order.id, partId: part.id, quantity: 1 })}>Release 1</button><button className="primary-button" disabled={!canPerform(state, 'CONSUME_PART') || order.status !== 'IN_PROGRESS' || order.partConsumed} onClick={() => dispatch({ type: 'CONSUME_PART', workOrderId: order.id })}>Consume for WO-1048</button></div></Panel></div><Panel title="Inventory transaction ledger" eyebrow={`${transactions.length} EVENTS`}><div className="table-wrap"><table><thead><tr><th>TIME</th><th>TYPE</th><th>WORK ORDER</th><th>QTY</th><th>ACTOR</th></tr></thead><tbody>{transactions.map((item) => <tr key={item.id}><td>{item.time}</td><td><Status>{item.type}</Status></td><td><ButtonLink href={`/work-orders/${item.workOrderId}`}>{item.workOrderId}</ButtonLink></td><td>{item.quantity}</td><td>{item.actor}</td></tr>)}</tbody></table></div></Panel></DataPage>
  }
  const parts = Object.values(state.parts)
  return <DataPage title="Spares" subtitle="Inventory intelligence connected to maintenance demand"><Panel title="Inventory register" eyebrow={`${parts.length} PART RECORDS`}><div className="table-wrap"><table><thead><tr><th>PART</th><th>DESCRIPTION</th><th>LOCATION</th><th>ON HAND</th><th>RESERVED</th><th>AVAILABLE</th><th>FORECAST NEED</th><th>STATUS</th></tr></thead><tbody>{parts.map((part) => <tr key={part.id}><td><ButtonLink href={`/spares/${part.id}`}><strong>{part.id}</strong></ButtonLink></td><td>{part.description}</td><td>{part.location}</td><td>{part.onHand}</td><td>{part.reserved}</td><td>{part.onHand - part.reserved}</td><td>{part.forecastNeed}</td><td><Status>{part.onHand - part.reserved <= part.reorderLevel ? 'SHORTAGE RISK' : 'READY'}</Status></td></tr>)}</tbody></table></div></Panel><Panel title="Recent inventory transactions" eyebrow="SHARED LEDGER"><div className="events">{state.inventoryTransactions.map((item) => <ButtonLink key={item.id} href={`/spares/${item.partId}`}><time>{item.time}</time><span><b>{item.type} · {item.partId}</b><small>{item.quantity} for {item.workOrderId} by {item.actor}</small></span></ButtonLink>)}</div></Panel></DataPage>
}

function ResourcesPage({ state, personId, bayId }: { state: DemoState; personId?: string; bayId?: string }) {
  if (personId) {
    const tech = state.technicians[personId]
    if (!tech) return <GenericPage title="Technician not found" subtitle={`No technician record exists for ${personId}.`} links={[{ label: 'Personnel & bays', href: '/resources', note: 'Return to resource assignments.' }]} />
    const assignment = tech.assignedWorkOrderIds[0]
    return <DataPage title={tech.name} subtitle="Technician skills, availability and assignments" crumbs={[{ label: 'Personnel & bays', href: '/resources' }, { label: tech.id }]}><Panel title="Technician detail" eyebrow={tech.id}><div className="stat-list"><p>Status <b>{tech.status}</b></p><p>Skills <b>{tech.skills.join(', ')}</b></p><p>Certifications <b>{tech.certifications.join(', ')}</b></p><p>Available from <b>{tech.availableFrom}</b></p><p>Assignment {assignment ? <ButtonLink href={`/work-orders/${assignment}`}>{assignment}</ButtonLink> : <b>None</b>}</p></div></Panel></DataPage>
  }
  if (bayId) {
    const bay = state.bays[bayId]
    if (!bay) return <GenericPage title="Bay not found" subtitle={`No maintenance bay record exists for ${bayId}.`} links={[{ label: 'Personnel & bays', href: '/resources', note: 'Return to resource assignments.' }]} />
    const assignment = bay.assignedWorkOrderIds[0]
    return <DataPage title={bay.name} subtitle="Maintenance bay capability and availability" crumbs={[{ label: 'Personnel & bays', href: '/resources' }, { label: bay.id }]}><Panel title="Bay detail" eyebrow={bay.id}><div className="stat-list"><p>Capabilities <b>{bay.capabilities.join(', ')}</b></p><p>Available <b>{bay.status === 'AVAILABLE' ? 'YES' : 'NO'}</b></p><p>Assignment {assignment ? <ButtonLink href={`/work-orders/${assignment}`}>{assignment}</ButtonLink> : <b>None</b>}</p></div></Panel></DataPage>
  }
  const order = state.workOrders['WO-1048']
  const tech = state.technicians[order.technicianId]
  const bay = state.bays[order.bayId]
  return <DataPage title="Personnel & bays" subtitle="Technician skills, bay capacity and assignment conflicts"><div className="detail-grid"><Panel title="Technicians" eyebrow="SKILL MATCHING"><div className="table-wrap"><table><thead><tr><th>PERSON</th><th>STATUS</th><th>SKILLS</th><th>ASSIGNMENT</th></tr></thead><tbody>{Object.values(state.technicians).map((item) => <tr key={item.id}><td><ButtonLink href={`/resources/personnel/${item.id}`}><strong>{item.name}</strong><small>{item.id}</small></ButtonLink></td><td><Status>{item.status}</Status></td><td>{item.skills.join(', ')}</td><td>{item.assignedWorkOrderIds.map((id) => <ButtonLink key={id} href={`/work-orders/${id}`}>{id}</ButtonLink>)}</td></tr>)}</tbody></table></div></Panel><Panel title="Maintenance bays" eyebrow="CAPACITY"><div className="table-wrap"><table><thead><tr><th>BAY</th><th>STATUS</th><th>CAPABILITY</th><th>ASSIGNMENT</th></tr></thead><tbody>{Object.values(state.bays).map((item) => <tr key={item.id}><td><ButtonLink href={`/resources/bays/${item.id}`}><strong>{item.name}</strong><small>{item.id}</small></ButtonLink></td><td><Status>{item.status}</Status></td><td>{item.capabilities.join(', ')}</td><td>{item.assignedWorkOrderIds.map((id) => <ButtonLink key={id} href={`/work-orders/${id}`}>{id}</ButtonLink>)}</td></tr>)}</tbody></table></div></Panel></div><Panel title="Conflict check" eyebrow="WO-1048"><div className="stat-list"><p>Technician eligibility <b>{tech.skills.includes(order.requiredSkill) ? 'PASS' : 'BLOCKED'}</b></p><p>Technician double-booking <b>{tech.assignedWorkOrderIds.length > 1 ? 'CONFLICT' : 'CLEAR'}</b></p><p>Bay compatibility <b>{bay.capabilities.includes('Engine maintenance') ? 'PASS' : 'BLOCKED'}</b></p><p>Bay double-booking <b>{bay.assignedWorkOrderIds.length > 1 ? 'CONFLICT' : 'CLEAR'}</b></p></div></Panel></DataPage>
}

function AircraftHealthPage({ state }: { state: DemoState }) {
  const rows = getAircraftRows(state)
  return <DataPage title="Aircraft health" subtitle="Fleet-wide component health and risk overview"><Panel title="Health matrix" eyebrow={`${rows.length} DEMO AIRCRAFT`}><div className="table-wrap"><table><thead><tr><th>AIRCRAFT</th><th>STATUS</th><th>HEALTH</th><th>COMPONENT</th><th>RISK</th><th>RUL</th><th>ACTION</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><ButtonLink href={`/fleet/${row.id}`}><strong>{row.id}</strong><small>{row.type}</small></ButtonLink></td><td><Status>{row.status}</Status></td><td>{row.health}%</td><td>{row.topRisk}</td><td>{row.alerts > 0 ? 'ACTIVE ALERT' : 'NORMAL'}</td><td>{row.rul}</td><td><ButtonLink className="text-button" href={row.topRisk === '-' ? `/fleet/${row.id}` : `/fleet/${row.id}/components/${row.topRisk}`}>Open</ButtonLink></td></tr>)}</tbody></table></div></Panel></DataPage>
}

function MaintenanceBoardPage({ state }: { state: DemoState }) {
  const statuses = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED'] as const
  const orders = Object.values(state.workOrders)
  return <DataPage title="Maintenance board" subtitle="Operational work queue grouped by execution state"><div className="card-grid">{statuses.map((status) => <Panel key={status} title={status.replaceAll('_', ' ')} eyebrow={`${orders.filter((order) => order.status === status).length} WORK ORDERS`}><div className="events">{orders.filter((order) => order.status === status).map((order) => <ButtonLink key={order.id} href={`/work-orders/${order.id}`}><time>{order.priority}</time><span><b>{order.id} · {order.aircraftId}</b><small>{order.componentId} · {state.technicians[order.technicianId].name} · {state.bays[order.bayId].name}</small></span></ButtonLink>)}{orders.filter((order) => order.status === status).length === 0 && <p className="body-copy">No work orders in this state.</p>}</div></Panel>)}</div></DataPage>
}

function SchedulePage({ state }: { state: DemoState }) {
  const assignments = Object.values(state.schedule)
  return <DataPage title="Schedule" subtitle="Maintenance assignments, bays and planning"><Panel title="03 October schedule" eyebrow={`${assignments.length} ASSIGNMENT`}><div className="table-wrap"><table><thead><tr><th>WINDOW</th><th>WORK ORDER</th><th>AIRCRAFT</th><th>TECHNICIAN</th><th>BAY</th><th>CONFLICTS</th></tr></thead><tbody>{assignments.map((item) => { const tech = state.technicians[item.technicianId]; const bay = state.bays[item.bayId]; const conflict = tech.assignedWorkOrderIds.length > 1 || bay.assignedWorkOrderIds.length > 1; return <tr key={item.id}><td>{item.start} - {item.end}</td><td><ButtonLink href={`/work-orders/${item.workOrderId}`}>{item.workOrderId}</ButtonLink></td><td><ButtonLink href={`/fleet/${item.aircraftId}`}>{item.aircraftId}</ButtonLink></td><td><ButtonLink href={`/resources/personnel/${item.technicianId}`}>{tech.name}</ButtonLink></td><td><ButtonLink href={`/resources/bays/${item.bayId}`}>{bay.name}</ButtonLink></td><td><Status>{conflict ? 'CONFLICT' : 'CLEAR'}</Status></td></tr> })}</tbody></table></div></Panel><Panel title="Planning rules" eyebrow="DETERMINISTIC CHECKS"><div className="stat-list"><p>AK-01 skill match <b>{state.technicians['AK-01'].skills.includes('Engine systems') ? 'PASS' : 'BLOCKED'}</b></p><p>B04 engine capability <b>{state.bays.B04.capabilities.includes('Engine maintenance') ? 'PASS' : 'BLOCKED'}</b></p><p>BRG-X21 reservation <b>{state.workOrders['WO-1048'].reservationComplete ? 'PASS' : 'BLOCKED'}</b></p></div></Panel></DataPage>
}

function AuditList({ state, limit }: { state: DemoState; limit?: number }) {
  const events = limit ? state.audit.slice(0, limit) : state.audit
  const hrefFor = (entityType: string, entityId: string) => {
    if (entityType === 'Prediction') return '/fleet/AF-017/prognostics'
    if (entityType === 'Alert') return `/alerts/${entityId}`
    if (entityType === 'WorkOrder') return `/work-orders/${entityId}`
    if (entityType === 'Part') return `/spares/${entityId}`
    return '/audit'
  }
  return <div className="events">{events.map((event) => <ButtonLink key={event.id} href={hrefFor(event.entityType, event.entityId)}><time>{event.time}</time><span><b>{event.action}</b><small>{event.entityType} {event.entityId} · {event.detail}</small></span></ButtonLink>)}</div>
}

function AuditPage({ state }: { state: DemoState }) {
  return <DataPage title="Audit trail" subtitle="Chronological event records produced by demo actions"><Panel title="Operational audit history" eyebrow={`${state.audit.length} EVENTS`}><AuditList state={state} /></Panel></DataPage>
}

function ModelValidationPage() {
  const metrics = trainedModelMetadata.evaluation_metrics
  const example = trainedModelMetadata.benchmark_inference_example
  const candidates = Object.entries(trainedModelMetadata.candidate_metrics)
  const removed = Object.entries(trainedModelMetadata.removed_features)
  const service = useServiceStatus()
  return <DataPage title="Model Validation" subtitle="Public benchmark validation for the trained FD001 RUL model" eyebrow="PUBLIC BENCHMARK MODEL · TRAINED FD001 RUL" crumbs={[{ label: 'Administration', href: '/admin' }, { label: 'Model Validation' }]}><Panel title="Service pre-flight" eyebrow={service.status}><div className="stat-list"><p>Prognostics API <b>{service.apiReachable ? `Reachable at ${prognosticsApiUrl}` : `Unavailable at ${prognosticsApiUrl}`}</b></p><p>Benchmark model provider <b>{service.trainedProvider ? 'AVAILABLE' : 'UNAVAILABLE'}</b></p><p>Deterministic fallback <b>{service.fallbackProvider ? 'AVAILABLE' : 'UNAVAILABLE'}</b></p><p>Model artifact <b>rul_fd001_v1.joblib present</b></p><p>Model metadata <b>rul_fd001_v1.metadata.json loaded</b></p></div><p className={service.status === 'READY' ? 'success-note' : 'error-note'}>{service.message}</p></Panel><div className="detail-grid"><Panel title="Trained benchmark model" eyebrow="PUBLIC BENCHMARK VALIDATION"><div className="stat-list"><p>Model <b>{trainedModelMetadata.model_id}</b></p><p>Version <b>{trainedModelMetadata.model_version}</b></p><p>Estimator <b>{trainedModelMetadata.model_type}</b></p><p>Prediction mode <b>TRAINED_MODEL</b></p><p>Dataset <b>{trainedModelMetadata.dataset}</b></p><p>Subset <b>{trainedModelMetadata.dataset_subset}</b></p><p>Training timestamp <b>{trainedModelMetadata.training_timestamp}</b></p><p>Target <b>{trainedModelMetadata.target_definition}</b></p></div></Panel><Panel title="Operational boundary" eyebrow="NO MILITARY DATA CLAIM"><p className="body-copy">NASA C-MAPSS FD001 is a public simulated turbofan degradation benchmark. It does not contain AF-017, ENG-02, military aircraft telemetry or operational maintenance records.</p><p className="body-copy">AF-017 continues to use deterministic demo prognostics. The trained FD001 model is demonstrated only on matching benchmark feature vectors.</p><ButtonLink href="/predictions/PRED-017-ENG02-001" className="secondary-button">Open AF-017 fallback trace</ButtonLink></Panel></div><div className="detail-grid"><Panel title="Measured metrics" eyebrow="EXECUTED TRAINING RUN"><div className="stat-list"><p>Validation MAE <b>{metrics.validation.mae.toFixed(2)}</b></p><p>Validation RMSE <b>{metrics.validation.rmse.toFixed(2)}</b></p><p>Validation R2 <b>{metrics.validation.r2.toFixed(3)}</b></p><p>Test last-cycle MAE <b>{metrics.test_last_cycle.mae.toFixed(2)}</b></p><p>Test last-cycle RMSE <b>{metrics.test_last_cycle.rmse.toFixed(2)}</b></p><p>Test last-cycle R2 <b>{metrics.test_last_cycle.r2.toFixed(3)}</b></p></div></Panel><Panel title="Methodology" eyebrow="UNIT-AWARE SPLIT"><div className="stat-list"><p>Training units <b>{trainedModelMetadata.training_unit_count}</b></p><p>Validation units <b>{trainedModelMetadata.validation_unit_count}</b></p><p>Test units <b>{trainedModelMetadata.test_unit_count}</b></p><p>Random seed <b>{trainedModelMetadata.random_seed}</b></p><p>RUL cap <b>{trainedModelMetadata.rul_cap} cycles</b></p><p>Selected model <b>{trainedModelMetadata.selected_model}</b></p></div></Panel></div><Panel title="Candidate comparison" eyebrow="LOWER RMSE SELECTED"><div className="table-wrap"><table><thead><tr><th>MODEL</th><th>MAE</th><th>RMSE</th><th>R2</th></tr></thead><tbody>{candidates.map(([name, result]) => <tr key={name}><td>{name}</td><td>{result.mae.toFixed(2)}</td><td>{result.rmse.toFixed(2)}</td><td>{result.r2.toFixed(3)}</td></tr>)}</tbody></table></div></Panel><Panel title="Feature schema" eyebrow={`${trainedModelMetadata.features.length} FEATURES USED`}><div className="table-wrap"><table><thead><tr><th>USED FEATURES</th><th>REMOVED FEATURES</th></tr></thead><tbody><tr><td>{trainedModelMetadata.features.join(', ')}</td><td>{removed.map(([name, reason]) => `${name}: ${reason}`).join('; ')}</td></tr></tbody></table></div></Panel><Panel title="Benchmark inference example" eyebrow="NASA C-MAPSS FD001"><div className="stat-list"><p>Source <b>{example.source}</b></p><p>Unit / cycle <b>{example.unit_id} / {example.cycle}</b></p><p>Predicted RUL <b>{example.predicted_rul} cycles</b></p><p>Provided RUL label <b>{example.provided_rul_label} cycles</b></p><p>Prediction mode <b>{example.prediction_mode}</b></p></div><p className="body-copy">The FastAPI service accepts matching FD001 benchmark requests through <b>/predict/rul</b> with <b>benchmark_source=NASA_CMAPSS_FD001</b>. Feature order is enforced by metadata, wrong schemas are rejected, and fallback output is never labeled as the trained model.</p></Panel></DataPage>
}

function AdminPage({ state, dispatch }: { state: DemoState; dispatch: React.Dispatch<Parameters<typeof demoReducer>[1]> }) {
  const activeUser = getActiveUser(state)
  const prediction = state.predictions['PRED-017-ENG02-001']
  return <DataPage title="Administration" subtitle="Prototype controls, roles and deterministic system context"><div className="detail-grid"><Panel title="Active demo user" eyebrow="APP AUTHORIZATION"><div className="stat-list"><p>User <b>{activeUser.name}</b></p><p>Role <b>{roleLabels[activeUser.role]}</b></p><p>Scope <b>Prototype app authorization only</b></p></div><div className="role-grid">{Object.values(state.users).map((user) => <button key={user.id} className={user.id === state.activeUserId ? 'secondary-button active' : 'secondary-button'} onClick={() => dispatch({ type: 'SWITCH_USER', userId: user.id })}>{user.initials} · {roleLabels[user.role]}</button>)}</div></Panel><Panel title="Demo reset" eyebrow="ADMIN ONLY"><p className="body-copy">Restores aircraft, telemetry, alert, work order, inventory, schedule, resources, notifications and audit records to the deterministic SIH demo start state. It does not alter C-MAPSS raw files, model artifacts or benchmark metrics.</p><button className="primary-button" disabled={!canPerform(state, 'RESET_DEMO')} onClick={() => { if (window.confirm('Reset AeroPulse demo state to the deterministic starting point? Model artifacts and benchmark metadata are preserved.')) dispatch({ type: 'RESET_DEMO' }) }}>Reset demo state</button></Panel></div><div className="detail-grid"><Panel title="Operational prognostics" eyebrow="AF-017 FALLBACK PRESERVED"><div className="stat-list"><p>AF-017 prediction mode <b>{prediction.predictionMode}</b></p><p>Model ID <b>{prediction.modelId}</b></p><p>Version <b>{prediction.modelVersion}</b></p><p>Model type <b>{prediction.modelType}</b></p><p>Dataset <b>{prediction.dataset ?? 'No trained dataset used for AF-017'}</b></p><p>Fallback availability <b>AVAILABLE</b></p><p>Prediction detail <ButtonLink href="/predictions/PRED-017-ENG02-001">PRED-017-ENG02-001</ButtonLink></p></div></Panel><Panel title="ML service workspace" eyebrow="P2.5 REAL MODEL"><div className="stat-list"><p>FastAPI service <b>Implemented in ml-service</b></p><p>Trained benchmark model <b>{trainedModelMetadata.model_id} · {trainedModelMetadata.model_version}</b></p><p>C-MAPSS artifact <b>Present</b></p><p>Validation RMSE <b>{trainedModelMetadata.evaluation_metrics.validation.rmse.toFixed(2)}</b></p><p>Test last-cycle RMSE <b>{trainedModelMetadata.evaluation_metrics.test_last_cycle.rmse.toFixed(2)}</b></p><p>SHAP <b>Not implemented</b></p></div><ButtonLink href="/admin/model-validation" className="primary-button">Open model validation</ButtonLink></Panel></div></DataPage>
}

function GenericPage({ title, subtitle, links }: { title: string; subtitle: string; links: { label: string; href: string; note: string }[] }) {
  return <DataPage title={title} subtitle={subtitle}><div className="card-grid">{links.map((link) => <Panel key={link.label} title={link.label}><p className="body-copy">{link.note}</p><ButtonLink href={link.href} className="primary-button">Open {link.label} <ChevronRight /></ButtonLink></Panel>)}</div></DataPage>
}

function usePersistentDemoState() {
  const [hydrated, setHydrated] = useState(false)
  const [state, dispatch] = useReducer(demoReducer, undefined, () => createInitialDemoState())

  useEffect(() => {
    const saved = window.localStorage.getItem(demoStorageKey)
    if (saved) {
      try {
        dispatch({ type: 'LOAD_STATE', state: JSON.parse(saved) as DemoState })
      } catch {
        window.localStorage.removeItem(demoStorageKey)
      }
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    window.localStorage.setItem(demoStorageKey, JSON.stringify(state))
  }, [hydrated, state])

  return [state, dispatch, hydrated] as const
}

export function AeroPulseDashboard() {
  const [route, setRoute] = useState<Route>({ path: '/command-center', query: new URLSearchParams() })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [state, dispatch, hydrated] = usePersistentDemoState()

  useEffect(() => {
    const update = () => setRoute(routeFromLocation())
    window.addEventListener('popstate', update)
    update()
    return () => window.removeEventListener('popstate', update)
  }, [])

  const navItems: NavItem[] = nav.flatMap((section) => section.items)
  const active = navItems.find(([, href]) => route.path.startsWith(href))?.[0] ?? 'Command center'
  const activeAlerts = Object.values(state.alerts).filter((alert) => alert.status !== 'RESOLVED').length
  const activeUser = getActiveUser(state)
  const unreadNotifications = currentUserNotifications(state).filter((item) => !item.read).length

  const content = useMemo(() => {
    if (!hydrated) return <DataPage title="Loading demo state" subtitle="Restoring the deterministic AeroPulse demo state"><Panel title="State hydration" eyebrow="LOCAL DEMO STORE"><p className="body-copy">Preparing shared aircraft, telemetry, prediction, alert, work-order and inventory records.</p></Panel></DataPage>
    if (route.path === '/' || route.path === '/command-center') return <CommandCenter state={state} />
    if (route.path === '/fleet') return <FleetPage state={state} route={route} />
    if (route.path.startsWith('/fleet/') && route.path.includes('/components/')) {
      const [, , aircraftId, , componentId] = route.path.split('/')
      return <ComponentPage state={state} aircraftId={aircraftId} componentId={componentId} />
    }
    if (route.path.startsWith('/fleet/') && route.path.endsWith('/prognostics')) return <PrognosticsPage state={state} aircraftId={route.path.split('/')[2]} />
    if (route.path.startsWith('/fleet/')) return <AircraftPage state={state} id={route.path.split('/')[2]} />
    if (route.path === '/alerts' || route.path.startsWith('/alerts?')) return <AlertsPage state={state} dispatch={dispatch} />
    if (route.path.startsWith('/alerts/')) return <AlertsPage state={state} alertId={route.path.split('/')[2]} dispatch={dispatch} />
    if (route.path.startsWith('/predictions/')) return <PredictionDetailPage state={state} predictionId={route.path.split('/')[2]} />
    if (route.path === '/work-orders') return <WorkOrdersPage state={state} dispatch={dispatch} />
    if (route.path.startsWith('/work-orders/')) return <WorkOrdersPage state={state} orderId={route.path.split('/')[2]} dispatch={dispatch} />
    if (route.path === '/spares') return <SparesPage state={state} dispatch={dispatch} />
    if (route.path.startsWith('/spares/')) return <SparesPage state={state} partId={route.path.split('/')[2]} dispatch={dispatch} />
    if (route.path === '/resources') return <ResourcesPage state={state} />
    if (route.path.startsWith('/resources/personnel/')) return <ResourcesPage state={state} personId={route.path.split('/')[3]} />
    if (route.path.startsWith('/resources/bays/')) return <ResourcesPage state={state} bayId={route.path.split('/')[3]} />
    if (route.path === '/audit' || route.path.startsWith('/audit?')) return <AuditPage state={state} />
    if (route.path === '/admin/model-validation') return <ModelValidationPage />
    if (route.path === '/admin') return <AdminPage state={state} dispatch={dispatch} />
    if (route.path === '/aircraft-health') return <AircraftHealthPage state={state} />
    if (route.path === '/maintenance') return <MaintenanceBoardPage state={state} />
    if (route.path === '/schedule') return <SchedulePage state={state} />
    return <CommandCenter state={state} />
  }, [dispatch, hydrated, route, state])

  function search(value: string) {
    const query = value.toUpperCase().trim()
    setSearchOpen(false)
    if (state.aircraft[query]) go(`/fleet/${query}`)
    else if (state.components[query]) go(`/fleet/${state.components[query].aircraftId}/components/${query}`)
    else if (state.workOrders[query]) go(`/work-orders/${query}`)
    else if (state.predictions[query]) go(`/predictions/${query}`)
    else if (state.parts[query]) go(`/spares/${query}`)
    else if (state.alerts[query]) go(`/alerts/${query}`)
    else go('/fleet')
  }

  return <div className="aero-app"><aside className={`aero-sidebar ${mobileOpen ? 'is-open' : ''}`}><div className="brand"><div className="brand-mark"><Plane aria-hidden="true" /></div><div><strong>AEROPULSE</strong><span>Fleet maintenance intelligence</span></div><button className="mobile-close" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X /></button></div><div className="nav-scroll">{nav.map((section) => <div className="nav-section" key={section.group}><p>{section.group}</p>{section.items.map(([label, href, Icon]) => <button key={label} className={active === label ? 'nav-item active' : 'nav-item'} onClick={() => { go(href); setMobileOpen(false) }}><Icon aria-hidden="true" /><span>{label}</span>{label === 'Predictive alerts' && activeAlerts > 0 && <b>{activeAlerts}</b>}</button>)}</div>)}</div><div className="sidebar-footer"><div className="stream"><div><span className="live-dot" /> <span>SEEDED TELEMETRY</span></div><strong>{getFleetSummary(state).total} demo aircraft</strong><small>AF-017 / ENG-02 golden flow</small></div><div className="demo-label">DEMONSTRATION ENVIRONMENT<br /><span>Prototype app authorization</span></div></div></aside>{mobileOpen && <button className="scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}<div className="aero-main"><header className="topbar"><div className="topbar-left"><button className="menu-button" aria-label="Open navigation" onClick={() => setMobileOpen(true)}><Menu /></button><span className="breadcrumb">OPERATIONS / {String(active).toUpperCase()}</span></div><div className="top-actions"><button className="search global-search" onClick={() => setSearchOpen(true)}><Search aria-hidden="true" /><span>Search aircraft, component, work order or part</span><kbd>⌘ K</kbd></button><button className="icon-button" aria-label="Notifications" onClick={() => setNotificationsOpen(true)}><Bell />{unreadNotifications > 0 && <b>{unreadNotifications}</b>}</button><ButtonLink href="/admin" className="profile"><span>{activeUser.initials}</span><div><strong>{activeUser.name}</strong><small>{roleLabels[activeUser.role]}</small></div></ButtonLink></div></header>{searchOpen && <div className="search-overlay"><div className="search-dialog"><div className="search-field"><Search /><input autoFocus aria-label="Global search" placeholder="Try AF-017, ENG-02, WO-1048 or BRG-X21" onKeyDown={(event) => { if (event.key === 'Enter') search(event.currentTarget.value) }} /></div><p>Press Enter to open a matching demo record.</p></div></div>}{notificationsOpen && <><button className="scrim" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)} /><NotificationPanel state={state} dispatch={dispatch} /></>}<main className="content"><AppMessage state={state} />{content}<footer>AeroPulse · Predictive Fleet Maintenance & Availability Intelligence <span>Simulated demo data · deterministic rules</span></footer></main></div></div>
}

export default AeroPulseDashboard

