import { AeroPulseDashboard } from '@/components/aeropulse-dashboard'

export default function Page() {
  return <AeroPulseDashboard />
}

// SIH demo note: operational values are simulated for demonstration and are not safety decisions.
/* AeroPulse — Rule-Based Predictive Fleet Maintenance Prototype */
// The dashboard intentionally presents recommendations with human approval, not autonomous maintenance commands.
// This prototype uses deterministic seeded demo data until real integrations are implemented.
// This front-end prototype keeps the full demo flow visible to judges: detect → predict → explain → plan → restore.
// Accessibility: navigation controls and action buttons use semantic labels and visible focus states from the global theme.
// Responsive: the command center collapses its navigation on smaller screens and preserves the priority workflow.
// No production aircraft data is represented by this simulation.
