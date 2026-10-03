export type AircraftStatus = 'READY' | 'HIGH RISK' | 'MAINTENANCE'
export type ComponentStatus = 'NOMINAL' | 'DEGRADED' | 'RESTORED'
export type AlertStatus = 'NEW' | 'ACKNOWLEDGED' | 'RESOLVED'
export type Role = 'FLEET_COMMANDER' | 'MAINTENANCE_OFFICER' | 'TECHNICIAN' | 'INVENTORY_MANAGER' | 'ADMINISTRATOR'
export type WorkStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'AWAITING_PART'
  | 'COMPLETED'
  | 'VERIFIED'
  | 'REWORK_REQUIRED'
  | 'CANCELLED'
export type InspectionFinding = 'PENDING' | 'CONFIRMED' | 'PARTIALLY_CONFIRMED' | 'NOT_CONFIRMED'
export type Permission =
  | 'ACK_ALERT'
  | 'SUBMIT_WORK_ORDER'
  | 'APPROVE_WORK_ORDER'
  | 'SCHEDULE_WORK_ORDER'
  | 'START_WORK'
  | 'RECORD_INSPECTION'
  | 'CONSUME_PART'
  | 'COMPLETE_WORK'
  | 'VERIFY_WORK'
  | 'RETURN_REWORK'
  | 'RESERVE_PART'
  | 'RELEASE_PART'
  | 'RESET_DEMO'
  | 'SWITCH_ROLE'

export type DemoUser = {
  id: string
  name: string
  initials: string
  role: Role
}

export type Aircraft = {
  id: string
  type: string
  location: string
  status: AircraftStatus
  health: number
  operatingHours: number
  operatingCycles: number
  lastMaintenance: string
  nextMaintenance: string
  componentIds: string[]
}

export type Component = {
  id: string
  aircraftId: string
  name: string
  status: ComponentStatus
  health: number
  lastInspection: string
}

export type TelemetryPoint = {
  cycle: number
  temperature: number
  vibration: number
  pressure: number
  rpm: number
}

export type Prediction = {
  id: string
  aircraftId: string
  componentId: string
  engine: 'DETERMINISTIC_RULES'
  version: string
  predictionMode: 'TRAINED_MODEL' | 'DETERMINISTIC_FALLBACK'
  modelId: string
  modelVersion: string
  modelType: string
  dataset?: string
  datasetSubset?: string
  trainingTimestamp?: string
  evaluationMetrics?: Record<string, number>
  rulUnit: 'cycles'
  anomalyState: 'NORMAL' | 'WATCH' | 'ANOMALOUS' | 'CRITICAL'
  anomalyScore: number
  rulCycles: number
  failureRisk: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  generatedAt: string
  inputSignals: {
    cycleSpan: number
    latestTemperature: number
    latestVibration: number
    latestPressure: number
    latestRpm: number
    temperatureRise: number
    vibrationRise: number
    pressureDrop: number
    healthAtPrediction: number
  }
  riskDerivation: string[]
  explanation: string[]
  status: 'HISTORICAL_PRE_MAINTENANCE' | 'CURRENT'
}

export type Alert = {
  id: string
  aircraftId: string
  componentId: string
  predictionId: string
  severity: 'INFO' | 'HIGH' | 'CRITICAL'
  reason: string
  rulCycles: number
  status: AlertStatus
  createdAt: string
}

export type Part = {
  id: string
  partNumber: string
  description: string
  category: string
  onHand: number
  reserved: number
  consumed: number
  reorderLevel: number
  forecastNeed: number
  leadTimeDays: number
  location: string
  condition: 'SERVICEABLE' | 'LOW_STOCK'
}

export type Technician = {
  id: string
  name: string
  skills: string[]
  certifications: string[]
  status: 'AVAILABLE' | 'ASSIGNED'
  availableFrom: string
  assignedWorkOrderIds: string[]
}

export type MaintenanceBay = {
  id: string
  name: string
  capabilities: string[]
  status: 'AVAILABLE' | 'RESERVED'
  assignedWorkOrderIds: string[]
}

export type ScheduleAssignment = {
  id: string
  workOrderId: string
  aircraftId: string
  technicianId: string
  bayId: string
  start: string
  end: string
}

export type InventoryTransaction = {
  id: string
  partId: string
  workOrderId: string
  quantity: number
  actor: string
  time: string
  type: 'RESERVED' | 'RELEASED' | 'ISSUED' | 'CONSUMED' | 'ADJUSTED'
}

export type WorkTransition = {
  id: string
  from: WorkStatus
  to: WorkStatus
  actor: string
  actorRole: Role
  time: string
  remarks: string
}

export type Notification = {
  id: string
  type: 'PREDICTION' | 'WORK_ORDER' | 'INVENTORY' | 'VERIFICATION' | 'REWORK'
  recipientRole: Role
  recipientUserId?: string
  title: string
  message: string
  entityType: 'Aircraft' | 'Alert' | 'WorkOrder' | 'Part'
  entityId: string
  createdAt: string
  read: boolean
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
}

export type WorkOrder = {
  id: string
  aircraftId: string
  componentId: string
  sourceAlertId: string
  requiredPartId: string
  technicianId: string
  bayId: string
  priority: 'P1' | 'P2'
  status: WorkStatus
  scheduledWindow: string
  requiredSkill: string
  reservationComplete: boolean
  partConsumed: boolean
  inspectionFinding: InspectionFinding
  maintenanceAction?: string
  verifiedBy?: string
  transitionHistory: WorkTransition[]
}

export type AuditEvent = {
  id: string
  time: string
  actor: string
  entityType: string
  entityId: string
  action: string
  detail: string
}

export type DemoState = {
  aircraft: Record<string, Aircraft>
  components: Record<string, Component>
  telemetry: Record<string, TelemetryPoint[]>
  predictions: Record<string, Prediction>
  alerts: Record<string, Alert>
  parts: Record<string, Part>
  technicians: Record<string, Technician>
  bays: Record<string, MaintenanceBay>
  schedule: Record<string, ScheduleAssignment>
  workOrders: Record<string, WorkOrder>
  inventoryTransactions: InventoryTransaction[]
  notifications: Record<string, Notification>
  users: Record<string, DemoUser>
  activeUserId: string
  lastMessage?: { type: 'success' | 'error'; text: string }
  audit: AuditEvent[]
}

export type DemoAction =
  | { type: 'LOAD_STATE'; state: DemoState }
  | { type: 'SWITCH_USER'; userId: string }
  | { type: 'ACK_ALERT'; alertId: string }
  | { type: 'SUBMIT_WORK_ORDER'; workOrderId: string }
  | { type: 'APPROVE_WORK_ORDER'; workOrderId: string }
  | { type: 'SCHEDULE_WORK_ORDER'; workOrderId: string }
  | { type: 'START_WORK'; workOrderId: string }
  | { type: 'RECORD_INSPECTION'; workOrderId: string; finding: InspectionFinding }
  | { type: 'RECORD_MAINTENANCE_ACTION'; workOrderId: string; text: string }
  | { type: 'RESERVE_PART'; workOrderId: string; partId: string; quantity: number }
  | { type: 'RELEASE_PART'; workOrderId: string; partId: string; quantity: number }
  | { type: 'CONSUME_PART'; workOrderId: string }
  | { type: 'COMPLETE_WORK'; workOrderId: string }
  | { type: 'VERIFY_WORK'; workOrderId: string }
  | { type: 'RETURN_REWORK'; workOrderId: string; remarks: string }
  | { type: 'MARK_NOTIFICATION_READ'; notificationId: string }
  | { type: 'MARK_ALL_NOTIFICATIONS_READ' }
  | { type: 'RESET_DEMO' }

const goldenTelemetry: TelemetryPoint[] = [
  { cycle: 5181, temperature: 640, vibration: 0.42, pressure: 35.8, rpm: 9120 },
  { cycle: 5184, temperature: 649, vibration: 0.48, pressure: 35.4, rpm: 9145 },
  { cycle: 5187, temperature: 662, vibration: 0.55, pressure: 34.9, rpm: 9165 },
  { cycle: 5190, temperature: 681, vibration: 0.64, pressure: 34.3, rpm: 9188 },
  { cycle: 5193, temperature: 704, vibration: 0.78, pressure: 33.7, rpm: 9211 },
  { cycle: 5196, temperature: 728, vibration: 0.91, pressure: 33.1, rpm: 9230 },
]

export const roleLabels: Record<Role, string> = {
  FLEET_COMMANDER: 'Fleet Commander',
  MAINTENANCE_OFFICER: 'Maintenance Officer',
  TECHNICIAN: 'Technician',
  INVENTORY_MANAGER: 'Inventory Manager',
  ADMINISTRATOR: 'Administrator',
}

const permissionsByRole: Record<Role, Permission[]> = {
  FLEET_COMMANDER: [],
  MAINTENANCE_OFFICER: ['ACK_ALERT', 'SUBMIT_WORK_ORDER', 'APPROVE_WORK_ORDER', 'SCHEDULE_WORK_ORDER', 'VERIFY_WORK', 'RETURN_REWORK'],
  TECHNICIAN: ['START_WORK', 'RECORD_INSPECTION', 'CONSUME_PART', 'COMPLETE_WORK'],
  INVENTORY_MANAGER: ['RESERVE_PART', 'RELEASE_PART', 'CONSUME_PART'],
  ADMINISTRATOR: ['RESET_DEMO', 'SWITCH_ROLE'],
}

export function hasPermission(role: Role, permission: Permission) {
  return permissionsByRole[role].includes(permission)
}

export function getActiveUser(state: DemoState) {
  return state.users[state.activeUserId] ?? state.users.fc
}

export function canPerform(state: DemoState, permission: Permission) {
  return hasPermission(getActiveUser(state).role, permission)
}

function message(state: DemoState, text: string, type: 'success' | 'error' = 'error'): DemoState {
  return { ...state, lastMessage: { type, text } }
}

function requirePermission(state: DemoState, permission: Permission): DemoState | undefined {
  if (canPerform(state, permission)) return undefined
  const user = getActiveUser(state)
  return message(state, `${roleLabels[user.role]} is not permitted to perform this action in the prototype authorization model.`)
}

function buildPrediction(points: TelemetryPoint[]): Prediction {
  const latest = points.at(-1) ?? points[0]
  const first = points[0]
  const tempRise = latest.temperature - first.temperature
  const vibrationRise = latest.vibration - first.vibration
  const pressureDrop = first.pressure - latest.pressure
  const anomalyScore = Math.min(0.99, Number((vibrationRise * 1.9 + tempRise / 180 + pressureDrop / 18).toFixed(2)))
  const rulCycles = Math.max(12, Math.round(92 - anomalyScore * 60))
  const failureRisk = anomalyScore >= 0.82 ? 'HIGH' : anomalyScore >= 0.55 ? 'MEDIUM' : 'LOW'
  const anomalyState = anomalyScore >= 0.9 ? 'CRITICAL' : anomalyScore >= 0.75 ? 'ANOMALOUS' : anomalyScore >= 0.5 ? 'WATCH' : 'NORMAL'

  return {
    id: 'PRED-017-ENG02-001',
    aircraftId: 'AF-017',
    componentId: 'ENG-02',
    engine: 'DETERMINISTIC_RULES',
    version: 'RULE-RUL-DEMO-v1',
    predictionMode: 'DETERMINISTIC_FALLBACK',
    modelId: 'RULE-RUL-DEMO',
    modelVersion: 'v1',
    modelType: 'transparent deterministic rules',
    rulUnit: 'cycles',
    anomalyState,
    anomalyScore,
    rulCycles,
    failureRisk,
    generatedAt: '03 Oct 2026, 14:31 IST',
    inputSignals: {
      cycleSpan: latest.cycle - first.cycle,
      latestTemperature: latest.temperature,
      latestVibration: latest.vibration,
      latestPressure: latest.pressure,
      latestRpm: latest.rpm,
      temperatureRise: tempRise,
      vibrationRise,
      pressureDrop,
      healthAtPrediction: 64,
    },
    riskDerivation: [
      `RUL ${rulCycles} cycles is below the 45-cycle maintenance threshold.`,
      `Anomaly score ${anomalyScore.toFixed(2)} is above the 0.82 high-risk threshold.`,
      'Failure risk is derived from RUL, anomaly score and component health; no classifier is claimed.',
    ],
    explanation: [
      `Vibration increased from ${first.vibration.toFixed(2)}g to ${latest.vibration.toFixed(2)}g across the seeded demo sequence.`,
      `Exhaust temperature rose by ${tempRise}C while pressure dropped by ${pressureDrop.toFixed(1)} psi.`,
      'Rule engine classifies the component as high risk when anomaly score is above 0.82 and RUL is below 45 cycles.',
    ],
    status: 'HISTORICAL_PRE_MAINTENANCE',
  }
}

export function createInitialDemoState(): DemoState {
  const prediction = buildPrediction(goldenTelemetry)

  return {
    aircraft: {
      'AF-017': {
        id: 'AF-017',
        type: 'Tejas Mk1A',
        location: 'Hangar 02',
        status: 'HIGH RISK',
        health: 64,
        operatingHours: 1840,
        operatingCycles: 5196,
        lastMaintenance: '28 Sep 2026',
        nextMaintenance: 'Immediate inspection',
        componentIds: ['ENG-02'],
      },
      'AF-021': {
        id: 'AF-021',
        type: 'Tejas Mk1A',
        location: 'Apron 01',
        status: 'READY',
        health: 94,
        operatingHours: 1530,
        operatingCycles: 4480,
        lastMaintenance: '26 Sep 2026',
        nextMaintenance: '12 Oct 2026',
        componentIds: [],
      },
      'AF-024': {
        id: 'AF-024',
        type: 'Tejas Mk1A',
        location: 'Hangar 01',
        status: 'HIGH RISK',
        health: 78,
        operatingHours: 1712,
        operatingCycles: 4820,
        lastMaintenance: '21 Sep 2026',
        nextMaintenance: '05 Oct 2026',
        componentIds: [],
      },
      'AF-031': {
        id: 'AF-031',
        type: 'Tejas Mk1A',
        location: 'Apron 03',
        status: 'READY',
        health: 96,
        operatingHours: 1320,
        operatingCycles: 3920,
        lastMaintenance: '30 Sep 2026',
        nextMaintenance: '18 Oct 2026',
        componentIds: [],
      },
    },
    components: {
      'ENG-02': {
        id: 'ENG-02',
        aircraftId: 'AF-017',
        name: 'Engine bearing assembly',
        status: 'DEGRADED',
        health: 64,
        lastInspection: '28 Sep 2026',
      },
    },
    telemetry: {
      'AF-017:ENG-02': goldenTelemetry,
    },
    predictions: {
      [prediction.id]: prediction,
    },
    alerts: {
      'ALT-017-ENG02-001': {
        id: 'ALT-017-ENG02-001',
        aircraftId: 'AF-017',
        componentId: 'ENG-02',
        predictionId: prediction.id,
        severity: 'CRITICAL',
        reason: 'Rule-based engine bearing degradation threshold crossed',
        rulCycles: prediction.rulCycles,
        status: 'NEW',
        createdAt: '03 Oct 2026, 14:31 IST',
      },
    },
    parts: {
      'BRG-X21': {
        id: 'BRG-X21',
        partNumber: 'BRG-X21',
        description: 'Engine bearing assembly',
        category: 'Engine',
        onHand: 4,
        reserved: 1,
        consumed: 0,
        reorderLevel: 3,
        forecastNeed: 4,
        leadTimeDays: 12,
        location: 'Stores A-2',
        condition: 'LOW_STOCK',
      },
      'HYD-SEAL-04': {
        id: 'HYD-SEAL-04',
        partNumber: 'HYD-SEAL-04',
        description: 'Hydraulic seal kit',
        category: 'Hydraulics',
        onHand: 12,
        reserved: 2,
        consumed: 0,
        reorderLevel: 5,
        forecastNeed: 6,
        leadTimeDays: 7,
        location: 'Stores B-1',
        condition: 'SERVICEABLE',
      },
    },
    technicians: {
      'AK-01': {
        id: 'AK-01',
        name: 'A. Kumar',
        skills: ['Engine systems', 'Bearing inspection'],
        certifications: ['ENG-BRG-L2'],
        status: 'ASSIGNED',
        availableFrom: '12:00 IST',
        assignedWorkOrderIds: ['WO-1048'],
      },
    },
    bays: {
      B04: {
        id: 'B04',
        name: 'Bay 04',
        capabilities: ['Engine maintenance'],
        status: 'RESERVED',
        assignedWorkOrderIds: ['WO-1048'],
      },
    },
    schedule: {
      'SCH-1048': {
        id: 'SCH-1048',
        workOrderId: 'WO-1048',
        aircraftId: 'AF-017',
        technicianId: 'AK-01',
        bayId: 'B04',
        start: '03 Oct 2026, 09:00 IST',
        end: '03 Oct 2026, 12:00 IST',
      },
    },
    workOrders: {
      'WO-1048': {
        id: 'WO-1048',
        aircraftId: 'AF-017',
        componentId: 'ENG-02',
        sourceAlertId: 'ALT-017-ENG02-001',
        requiredPartId: 'BRG-X21',
        technicianId: 'AK-01',
        bayId: 'B04',
        priority: 'P1',
        status: 'SCHEDULED',
        scheduledWindow: '03 Oct 2026, 09:00-12:00 IST',
        requiredSkill: 'Engine systems',
        reservationComplete: true,
        partConsumed: false,
        inspectionFinding: 'PENDING',
        transitionHistory: [
          {
            id: 'TR-001',
            from: 'APPROVED',
            to: 'SCHEDULED',
            actor: 'M. Iyer',
            actorRole: 'MAINTENANCE_OFFICER',
            time: '14:32:10',
            remarks: 'Scheduled deterministic golden demo assignment.',
          },
        ],
      },
    },
    inventoryTransactions: [
      {
        id: 'INV-TXN-001',
        partId: 'BRG-X21',
        workOrderId: 'WO-1048',
        quantity: 1,
        actor: 'I. Sen',
        time: '14:32:05',
        type: 'RESERVED',
      },
    ],
    notifications: {
      'NOTIF-001': {
        id: 'NOTIF-001',
        type: 'PREDICTION',
        recipientRole: 'MAINTENANCE_OFFICER',
        title: 'Critical ENG-02 risk',
        message: 'AF-017 / ENG-02 crossed deterministic high-risk threshold.',
        entityType: 'Alert',
        entityId: 'ALT-017-ENG02-001',
        createdAt: '14:31:25',
        read: false,
        priority: 'CRITICAL',
      },
      'NOTIF-002': {
        id: 'NOTIF-002',
        type: 'WORK_ORDER',
        recipientRole: 'TECHNICIAN',
        recipientUserId: 'tech',
        title: 'WO-1048 assigned',
        message: 'A. Kumar assigned to AF-017 / ENG-02 in Bay 04.',
        entityType: 'WorkOrder',
        entityId: 'WO-1048',
        createdAt: '14:32:20',
        read: false,
        priority: 'HIGH',
      },
      'NOTIF-003': {
        id: 'NOTIF-003',
        type: 'INVENTORY',
        recipientRole: 'INVENTORY_MANAGER',
        recipientUserId: 'inv',
        title: 'BRG-X21 reserved',
        message: 'One BRG-X21 reserved for WO-1048.',
        entityType: 'Part',
        entityId: 'BRG-X21',
        createdAt: '14:32:22',
        read: false,
        priority: 'MEDIUM',
      },
    },
    users: {
      fc: { id: 'fc', name: 'R. Sharma', initials: 'RS', role: 'FLEET_COMMANDER' },
      mo: { id: 'mo', name: 'M. Iyer', initials: 'MI', role: 'MAINTENANCE_OFFICER' },
      tech: { id: 'tech', name: 'A. Kumar', initials: 'AK', role: 'TECHNICIAN' },
      inv: { id: 'inv', name: 'I. Sen', initials: 'IS', role: 'INVENTORY_MANAGER' },
      admin: { id: 'admin', name: 'Admin', initials: 'AD', role: 'ADMINISTRATOR' },
    },
    activeUserId: 'fc',
    audit: [
      {
        id: 'AUD-001',
        time: '14:32:10',
        actor: 'Maintenance officer',
        entityType: 'WorkOrder',
        entityId: 'WO-1048',
        action: 'Work order scheduled',
        detail: 'BRG-X21 reserved, A. Kumar assigned, Bay 04 allocated.',
      },
      {
        id: 'AUD-002',
        time: '14:31:20',
        actor: 'System',
        entityType: 'Alert',
        entityId: 'ALT-017-ENG02-001',
        action: 'Alert opened',
        detail: 'Critical predictive alert linked to PRED-017-ENG02-001.',
      },
      {
        id: 'AUD-003',
        time: '14:31:05',
        actor: 'Rule engine',
        entityType: 'Prediction',
        entityId: prediction.id,
        action: 'Prediction generated',
        detail: 'AF-017 / ENG-02 deterministic degradation rules produced high risk.',
      },
    ],
  }
}

export const demoStorageKey = 'aeropulse-demo-state-v1'

export function getAircraftRows(state: DemoState) {
  return Object.values(state.aircraft).map((aircraft) => {
    const component = aircraft.componentIds.map((id) => state.components[id]).find(Boolean)
    const prediction = component ? getPredictionForComponent(state, aircraft.id, component.id) : undefined
    const alerts = Object.values(state.alerts).filter((alert) => alert.aircraftId === aircraft.id && alert.status !== 'RESOLVED')

    return {
      ...aircraft,
      topRisk: component?.id ?? '-',
      rul: prediction ? `${prediction.rulCycles} cycles` : '-',
      alerts: alerts.length,
    }
  })
}

export function getPredictionForComponent(state: DemoState, aircraftId: string, componentId: string) {
  return Object.values(state.predictions).find(
    (prediction) => prediction.aircraftId === aircraftId && prediction.componentId === componentId,
  )
}

export function getFleetSummary(state: DemoState) {
  const aircraft = Object.values(state.aircraft)
  const ready = aircraft.filter((item) => item.status === 'READY').length
  const highRisk = aircraft.filter((item) => item.status === 'HIGH RISK').length
  const maintenance = aircraft.filter((item) => item.status === 'MAINTENANCE').length
  const availability = Number(((ready / aircraft.length) * 100).toFixed(1))

  return {
    total: aircraft.length,
    ready,
    highRisk,
    maintenance,
    availability,
  }
}

function normalizeDemoState(saved: DemoState): DemoState {
  const initial = createInitialDemoState()
  const workOrders = Object.fromEntries(
    Object.entries({ ...initial.workOrders, ...(saved.workOrders ?? {}) }).map(([id, order]) => {
      const base = initial.workOrders[id] ?? initial.workOrders['WO-1048']
      return [id, { ...base, ...order, transitionHistory: order.transitionHistory ?? base.transitionHistory }]
    }),
  )
  const predictions = Object.fromEntries(
    Object.entries({ ...initial.predictions, ...(saved.predictions ?? {}) }).map(([id, prediction]) => {
      const base = initial.predictions[id] ?? initial.predictions['PRED-017-ENG02-001']
      return [id, { ...base, ...prediction, inputSignals: prediction.inputSignals ?? base.inputSignals, riskDerivation: prediction.riskDerivation ?? base.riskDerivation }]
    }),
  )

  return {
    ...initial,
    ...saved,
    aircraft: { ...initial.aircraft, ...(saved.aircraft ?? {}) },
    components: { ...initial.components, ...(saved.components ?? {}) },
    telemetry: { ...initial.telemetry, ...(saved.telemetry ?? {}) },
    predictions,
    alerts: { ...initial.alerts, ...(saved.alerts ?? {}) },
    parts: { ...initial.parts, ...(saved.parts ?? {}) },
    technicians: { ...initial.technicians, ...(saved.technicians ?? {}) },
    bays: { ...initial.bays, ...(saved.bays ?? {}) },
    schedule: { ...initial.schedule, ...(saved.schedule ?? {}) },
    workOrders,
    inventoryTransactions: saved.inventoryTransactions ?? initial.inventoryTransactions,
    notifications: { ...initial.notifications, ...(saved.notifications ?? {}) },
    users: { ...initial.users, ...(saved.users ?? {}) },
    activeUserId: saved.activeUserId && (saved.users?.[saved.activeUserId] || initial.users[saved.activeUserId]) ? saved.activeUserId : initial.activeUserId,
    audit: saved.audit ?? initial.audit,
  }
}

function addAudit(state: DemoState, event: Omit<AuditEvent, 'id'>): AuditEvent[] {
  return [
    {
      id: `AUD-${String(state.audit.length + 1).padStart(3, '0')}`,
      ...event,
    },
    ...state.audit,
  ]
}

function addTransition(state: DemoState, workOrder: WorkOrder, to: WorkStatus, remarks: string): WorkOrder {
  const user = getActiveUser(state)
  return {
    ...workOrder,
    status: to,
    transitionHistory: [
      {
        id: `TR-${String(workOrder.transitionHistory.length + 1).padStart(3, '0')}`,
        from: workOrder.status,
        to,
        actor: user.name,
        actorRole: user.role,
        time: demoTimeForStatus(to),
        remarks,
      },
      ...workOrder.transitionHistory,
    ],
  }
}

function demoTimeForStatus(status: WorkStatus) {
  const times: Partial<Record<WorkStatus, string>> = {
    PENDING_APPROVAL: '14:33:00',
    APPROVED: '14:35:10',
    SCHEDULED: '14:36:00',
    IN_PROGRESS: '14:40:00',
    AWAITING_PART: '14:48:00',
    COMPLETED: '15:35:00',
    VERIFIED: '15:50:00',
    REWORK_REQUIRED: '15:42:00',
    CANCELLED: '15:00:00',
  }
  return times[status] ?? '14:30:00'
}

function addNotification(state: DemoState, notification: Omit<Notification, 'id'>): Record<string, Notification> {
  const id = `NOTIF-${String(Object.keys(state.notifications).length + 1).padStart(3, '0')}`
  return { ...state.notifications, [id]: { id, ...notification } }
}

function addInventoryTransaction(state: DemoState, transaction: Omit<InventoryTransaction, 'id' | 'actor'>): InventoryTransaction[] {
  const actor = getActiveUser(state).name
  return [
    {
      id: `INV-TXN-${String(state.inventoryTransactions.length + 1).padStart(3, '0')}`,
      actor,
      ...transaction,
    },
    ...state.inventoryTransactions,
  ]
}

function isAssignedTechnician(state: DemoState, workOrder: WorkOrder) {
  const user = getActiveUser(state)
  return user.role !== 'TECHNICIAN' || workOrder.technicianId === 'AK-01'
}

export function getNotificationHref(notification: Notification) {
  if (notification.entityType === 'Alert') return `/alerts/${notification.entityId}`
  if (notification.entityType === 'WorkOrder') return `/work-orders/${notification.entityId}`
  if (notification.entityType === 'Part') return `/spares/${notification.entityId}`
  if (notification.entityType === 'Aircraft') return `/fleet/${notification.entityId}`
  return '/command-center'
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  if (action.type === 'LOAD_STATE') return normalizeDemoState(action.state)
  if (action.type === 'RESET_DEMO') {
    const blocked = requirePermission(state, 'RESET_DEMO')
    if (blocked) return blocked
    return createInitialDemoState()
  }
  if (action.type === 'SWITCH_USER') {
    if (!state.users[action.userId]) return message(state, 'Unknown demo user.')
    return { ...state, activeUserId: action.userId, lastMessage: { type: 'success', text: `Switched to ${state.users[action.userId].name}.` } }
  }
  if (action.type === 'MARK_NOTIFICATION_READ') {
    const item = state.notifications[action.notificationId]
    if (!item) return state
    return { ...state, notifications: { ...state.notifications, [item.id]: { ...item, read: true } } }
  }
  if (action.type === 'MARK_ALL_NOTIFICATIONS_READ') {
    return {
      ...state,
      notifications: Object.fromEntries(Object.entries(state.notifications).map(([id, item]) => [id, { ...item, read: true }])),
    }
  }

  if (action.type === 'ACK_ALERT') {
    const blocked = requirePermission(state, 'ACK_ALERT')
    if (blocked) return blocked
    const alert = state.alerts[action.alertId]
    if (!alert || alert.status !== 'NEW') return state
    return {
      ...state,
      alerts: { ...state.alerts, [alert.id]: { ...alert, status: 'ACKNOWLEDGED' } },
      notifications: addNotification(state, {
        type: 'WORK_ORDER',
        recipientRole: 'MAINTENANCE_OFFICER',
        title: 'Alert acknowledged',
        message: `${alert.aircraftId} / ${alert.componentId} accepted for work-order execution.`,
        entityType: 'WorkOrder',
        entityId: 'WO-1048',
        createdAt: '14:34:05',
        read: false,
        priority: 'HIGH',
      }),
      audit: addAudit(state, {
        time: '14:34:02',
        actor: getActiveUser(state).name,
        entityType: 'Alert',
        entityId: alert.id,
        action: 'Alert acknowledged',
        detail: `${alert.aircraftId} / ${alert.componentId} alert accepted for maintenance action.`,
      }),
    }
  }

  const workOrderId = 'workOrderId' in action ? action.workOrderId : ''
  const workOrder = state.workOrders[workOrderId]
  if (!workOrder) return state

  if (action.type === 'SUBMIT_WORK_ORDER') {
    const blocked = requirePermission(state, 'SUBMIT_WORK_ORDER')
    if (blocked) return blocked
    if (workOrder.status !== 'DRAFT') return message(state, 'Only draft work orders can be submitted.')
    const updated = addTransition(state, workOrder, 'PENDING_APPROVAL', 'Submitted for maintenance approval.')
    return {
      ...state,
      workOrders: { ...state.workOrders, [workOrder.id]: updated },
      audit: addAudit(state, {
        time: '14:33:00',
        actor: getActiveUser(state).name,
        entityType: 'WorkOrder',
        entityId: workOrder.id,
        action: 'Work order submitted',
        detail: 'Work order moved to pending approval.',
      }),
    }
  }

  if (action.type === 'APPROVE_WORK_ORDER' && workOrder.status === 'PENDING_APPROVAL') {
    const blocked = requirePermission(state, 'APPROVE_WORK_ORDER')
    if (blocked) return blocked
    const updated = addTransition(state, workOrder, 'APPROVED', 'Approved by maintenance officer.')
    return {
      ...state,
      workOrders: { ...state.workOrders, [workOrder.id]: updated },
      audit: addAudit(state, {
        time: '14:35:10',
        actor: getActiveUser(state).name,
        entityType: 'WorkOrder',
        entityId: workOrder.id,
        action: 'Work order approved',
        detail: 'Human approval completed for predictive maintenance execution.',
      }),
    }
  }

  if (action.type === 'SCHEDULE_WORK_ORDER') {
    const blocked = requirePermission(state, 'SCHEDULE_WORK_ORDER')
    if (blocked) return blocked
    if (workOrder.status !== 'APPROVED') return message(state, 'Only approved work orders can be scheduled.')
    const technician = state.technicians[workOrder.technicianId]
    const bay = state.bays[workOrder.bayId]
    const part = state.parts[workOrder.requiredPartId]
    if (!technician.skills.includes(workOrder.requiredSkill)) return message(state, `${technician.name} lacks ${workOrder.requiredSkill}.`)
    if (!bay.capabilities.includes('Engine maintenance')) return message(state, `${bay.name} is incompatible with engine maintenance.`)
    if (part.onHand - part.reserved < 0) return message(state, `${part.id} is unavailable for scheduling.`)
    const updated = addTransition(state, workOrder, 'SCHEDULED', 'Scheduled with assigned technician, bay and reserved part.')
    return {
      ...state,
      workOrders: { ...state.workOrders, [workOrder.id]: updated },
      audit: addAudit(state, {
        time: '14:36:00',
        actor: getActiveUser(state).name,
        entityType: 'WorkOrder',
        entityId: workOrder.id,
        action: 'Work order scheduled',
        detail: 'Resource conflict checks passed.',
      }),
    }
  }

  if (action.type === 'START_WORK' && workOrder.status === 'SCHEDULED') {
    const blocked = requirePermission(state, 'START_WORK')
    if (blocked) return blocked
    if (!isAssignedTechnician(state, workOrder)) return message(state, 'Technicians can only start assigned work orders.')
    const updated = addTransition(state, workOrder, 'IN_PROGRESS', 'Technician started assigned maintenance.')
    return {
      ...state,
      aircraft: {
        ...state.aircraft,
        [workOrder.aircraftId]: { ...state.aircraft[workOrder.aircraftId], status: 'MAINTENANCE' },
      },
      workOrders: { ...state.workOrders, [workOrder.id]: updated },
      audit: addAudit(state, {
        time: '14:40:00',
        actor: getActiveUser(state).name,
        entityType: 'WorkOrder',
        entityId: workOrder.id,
        action: 'Maintenance started',
        detail: 'Aircraft moved to maintenance state for ENG-02 inspection.',
      }),
    }
  }

  if (action.type === 'RECORD_INSPECTION' && workOrder.status === 'IN_PROGRESS') {
    const blocked = requirePermission(state, 'RECORD_INSPECTION')
    if (blocked) return blocked
    if (!isAssignedTechnician(state, workOrder)) return message(state, 'Technicians can only inspect assigned work orders.')
    return {
      ...state,
      workOrders: {
        ...state.workOrders,
        [workOrder.id]: { ...workOrder, inspectionFinding: action.finding },
      },
      audit: addAudit(state, {
        time: '15:05:00',
        actor: getActiveUser(state).name,
        entityType: 'WorkOrder',
        entityId: workOrder.id,
        action: 'Inspection recorded',
        detail: `Finding marked ${action.finding.replaceAll('_', ' ')}.`,
      }),
    }
  }

  if (action.type === 'RECORD_MAINTENANCE_ACTION' && workOrder.status === 'IN_PROGRESS') {
    const blocked = requirePermission(state, 'RECORD_INSPECTION')
    if (blocked) return blocked
    const text = action.text.trim()
    if (!text) return message(state, 'Maintenance action text is required.')
    return {
      ...state,
      workOrders: { ...state.workOrders, [workOrder.id]: { ...workOrder, maintenanceAction: text } },
      audit: addAudit(state, {
        time: '15:20:00',
        actor: getActiveUser(state).name,
        entityType: 'WorkOrder',
        entityId: workOrder.id,
        action: 'Maintenance action recorded',
        detail: text,
      }),
    }
  }

  if (action.type === 'RESERVE_PART') {
    const blocked = requirePermission(state, 'RESERVE_PART')
    if (blocked) return blocked
    if (action.partId !== workOrder.requiredPartId) return message(state, 'Cannot reserve an unrelated part for this work order.')
    const part = state.parts[action.partId]
    if (!part || action.quantity < 1 || part.onHand - part.reserved < action.quantity) return message(state, 'Insufficient available stock for reservation.')
    if (workOrder.reservationComplete) return message(state, 'Required part is already reserved.')
    return {
      ...state,
      parts: { ...state.parts, [part.id]: { ...part, reserved: part.reserved + action.quantity } },
      workOrders: { ...state.workOrders, [workOrder.id]: { ...workOrder, reservationComplete: true } },
      inventoryTransactions: addInventoryTransaction(state, { partId: part.id, workOrderId: workOrder.id, quantity: action.quantity, time: '14:32:05', type: 'RESERVED' }),
      audit: addAudit(state, {
        time: '14:32:05',
        actor: getActiveUser(state).name,
        entityType: 'Part',
        entityId: part.id,
        action: 'Part reserved',
        detail: `${action.quantity} ${part.id} reserved for ${workOrder.id}.`,
      }),
    }
  }

  if (action.type === 'RELEASE_PART') {
    const blocked = requirePermission(state, 'RELEASE_PART')
    if (blocked) return blocked
    const part = state.parts[action.partId]
    if (!part || action.quantity < 1 || part.reserved < action.quantity) return message(state, 'No reservation is available to release.')
    return {
      ...state,
      parts: { ...state.parts, [part.id]: { ...part, reserved: part.reserved - action.quantity } },
      workOrders: { ...state.workOrders, [workOrder.id]: { ...workOrder, reservationComplete: false } },
      inventoryTransactions: addInventoryTransaction(state, { partId: part.id, workOrderId: workOrder.id, quantity: action.quantity, time: '14:50:00', type: 'RELEASED' }),
      audit: addAudit(state, {
        time: '14:50:00',
        actor: getActiveUser(state).name,
        entityType: 'Part',
        entityId: part.id,
        action: 'Part reservation released',
        detail: `${action.quantity} ${part.id} released from ${workOrder.id}.`,
      }),
    }
  }

  if (action.type === 'CONSUME_PART' && workOrder.status === 'IN_PROGRESS') {
    const blocked = requirePermission(state, 'CONSUME_PART')
    if (blocked) return blocked
    const part = state.parts[workOrder.requiredPartId]
    if (workOrder.partConsumed) return message(state, `${part.id} has already been consumed for ${workOrder.id}.`)
    if (!part || part.reserved < 1 || part.onHand < 1) return message(state, 'Reserved stock is not available to consume.')
    return {
      ...state,
      parts: {
        ...state.parts,
        [part.id]: { ...part, reserved: part.reserved - 1, consumed: part.consumed + 1, onHand: part.onHand - 1 },
      },
      workOrders: { ...state.workOrders, [workOrder.id]: { ...workOrder, partConsumed: true } },
      inventoryTransactions: addInventoryTransaction(state, { partId: part.id, workOrderId: workOrder.id, quantity: 1, time: '15:12:00', type: 'CONSUMED' }),
      audit: addAudit(state, {
        time: '15:12:00',
        actor: getActiveUser(state).name,
        entityType: 'Part',
        entityId: part.id,
        action: 'Part consumed',
        detail: `${part.id} issued to ${workOrder.id}; inventory recalculated.`,
      }),
    }
  }

  if (action.type === 'COMPLETE_WORK' && workOrder.status === 'IN_PROGRESS') {
    const blocked = requirePermission(state, 'COMPLETE_WORK')
    if (blocked) return blocked
    if (workOrder.inspectionFinding === 'PENDING') return message(state, 'Inspection finding is required before completion.')
    if (!workOrder.partConsumed) return message(state, 'Required part consumption must be recorded before completion.')
    if (!workOrder.maintenanceAction?.trim()) return message(state, 'Maintenance action details are required before completion.')
    const maintenanceAction = workOrder.maintenanceAction
    const updated = addTransition(state, { ...workOrder, maintenanceAction }, 'COMPLETED', 'Maintenance action submitted for verification.')
    return {
      ...state,
      workOrders: {
        ...state.workOrders,
        [workOrder.id]: updated,
      },
      notifications: addNotification(state, {
        type: 'VERIFICATION',
        recipientRole: 'MAINTENANCE_OFFICER',
        recipientUserId: 'mo',
        title: 'Verification required',
        message: `${workOrder.id} is complete and ready for officer verification.`,
        entityType: 'WorkOrder',
        entityId: workOrder.id,
        createdAt: '15:35:05',
        read: false,
        priority: 'HIGH',
      }),
      audit: addAudit(state, {
        time: '15:35:00',
        actor: getActiveUser(state).name,
        entityType: 'WorkOrder',
        entityId: workOrder.id,
        action: 'Maintenance completed',
        detail: 'Repair action submitted for verification.',
      }),
    }
  }

  if (action.type === 'VERIFY_WORK' && workOrder.status === 'COMPLETED') {
    const blocked = requirePermission(state, 'VERIFY_WORK')
    if (blocked) return blocked
    const aircraft = state.aircraft[workOrder.aircraftId]
    const component = state.components[workOrder.componentId]
    const alert = state.alerts[workOrder.sourceAlertId]
    const updated = addTransition(state, { ...workOrder, verifiedBy: getActiveUser(state).name }, 'VERIFIED', 'Officer verified maintenance and restored aircraft readiness.')
    return {
      ...state,
      aircraft: {
        ...state.aircraft,
        [aircraft.id]: { ...aircraft, status: 'READY', health: 91, nextMaintenance: '18 Oct 2026' },
      },
      components: {
        ...state.components,
        [component.id]: { ...component, status: 'RESTORED', health: 91, lastInspection: '03 Oct 2026' },
      },
      alerts: {
        ...state.alerts,
        [alert.id]: { ...alert, status: 'RESOLVED' },
      },
      workOrders: {
        ...state.workOrders,
        [workOrder.id]: updated,
      },
      bays: {
        ...state.bays,
        [workOrder.bayId]: { ...state.bays[workOrder.bayId], status: 'AVAILABLE', assignedWorkOrderIds: [] },
      },
      technicians: {
        ...state.technicians,
        [workOrder.technicianId]: {
          ...state.technicians[workOrder.technicianId],
          status: 'AVAILABLE',
          availableFrom: 'Available now',
          assignedWorkOrderIds: [],
        },
      },
      audit: addAudit(state, {
        time: '15:50:00',
        actor: getActiveUser(state).name,
        entityType: 'WorkOrder',
        entityId: workOrder.id,
        action: 'Verification completed',
        detail: 'AF-017 restored to READY; alert resolved; fleet availability recalculated.',
      }),
    }
  }

  if (action.type === 'RETURN_REWORK' && workOrder.status === 'COMPLETED') {
    const blocked = requirePermission(state, 'RETURN_REWORK')
    if (blocked) return blocked
    const remarks = action.remarks.trim()
    if (!remarks) return message(state, 'Remarks are required to return work for rework.')
    const updated = addTransition(state, workOrder, 'REWORK_REQUIRED', remarks)
    return {
      ...state,
      workOrders: { ...state.workOrders, [workOrder.id]: updated },
      notifications: addNotification(state, {
        type: 'REWORK',
        recipientRole: 'TECHNICIAN',
        recipientUserId: 'tech',
        title: 'Rework requested',
        message: `${workOrder.id} returned for rework: ${remarks}`,
        entityType: 'WorkOrder',
        entityId: workOrder.id,
        createdAt: '15:42:00',
        read: false,
        priority: 'HIGH',
      }),
      audit: addAudit(state, {
        time: '15:42:00',
        actor: getActiveUser(state).name,
        entityType: 'WorkOrder',
        entityId: workOrder.id,
        action: 'Returned for rework',
        detail: remarks,
      }),
    }
  }

  if (action.type === 'START_WORK' && workOrder.status === 'REWORK_REQUIRED') {
    const blocked = requirePermission(state, 'START_WORK')
    if (blocked) return blocked
    const updated = addTransition(state, workOrder, 'IN_PROGRESS', 'Technician resumed rework.')
    return { ...state, workOrders: { ...state.workOrders, [workOrder.id]: updated } }
  }

  return state
}
