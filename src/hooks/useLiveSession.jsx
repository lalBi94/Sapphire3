import { useEffect, useRef, useState } from 'react'
import { startLive, sendLiveInputs, sendLiveEvents, setLiveSpeed, pauseLive, resumeLive, stopLive } from '../services/liveRunner.js'

const initialLive = Object.freeze({ status: 'idle', steps: 0, output: [], currentNodeId: null, states: {}, errorCode: null, error: '' })

// Expose une session live : démarrage, entrées, pause, reprise et arrêt.
export default function useLiveSession() {
  const [live, setLive] = useState(initialLive)
  const statusRef = useRef('idle')

  useEffect(() => () => stopLive(), [])

  // Démarre un programme en continu avec ses entrées initiales.
  function start(project, inputs = {}, options = {}) {
    statusRef.current = 'running'
    setLive({ ...initialLive, status: 'running' })
    startLive(project, {
      inputs,
      speed: options.speed,
      onFrame: (state) => {
        if (statusRef.current === 'stopped') return
        setLive((current) => ({
          ...current,
          status: current.status === 'paused' ? 'paused' : 'running',
          steps: state.steps,
          output: state.output ?? [],
          currentNodeId: state.currentNodeId ?? null,
          states: {
            screens: state.screens ?? {},
            gauges: state.gauges ?? {},
            leds: state.leds ?? {},
            rgbLeds: state.rgbLeds ?? {},
            progresses: state.progresses ?? {},
            barCharts: state.barCharts ?? {},
            xyPlots: state.xyPlots ?? {},
            oscilloscopes: state.oscilloscopes ?? {},
            heatmaps: state.heatmaps ?? {},
          },
        }))
      },
      onStatus: (status) => {
        statusRef.current = status.status
        setLive((current) => ({ ...current, status: status.status, errorCode: status.errorCode ?? current.errorCode, error: status.error ?? current.error }))
      },
    })
  }

  // Transmet les entrées courantes au worker live.
  function sendInputs(inputs) {
    sendLiveInputs(inputs)
  }

  // Transmet les événements de bouton au worker live.
  function sendEvents(events) {
    sendLiveEvents(events)
  }

  // Modifie la cadence du live courant.
  function setSpeed(value) {
    setLiveSpeed(value)
  }

  // Suspend la session live.
  function pause() {
    pauseLive()
  }

  // Reprend la session live.
  function resume() {
    resumeLive()
  }

  // Arrête la session et conserve la dernière image visible.
  function stop() {
    stopLive()
    statusRef.current = 'stopped'
    setLive((current) => ({ ...current, status: 'stopped' }))
  }

  // Réinitialise l'état local après fermeture du panneau.
  function reset() {
    stopLive()
    statusRef.current = 'idle'
    setLive(initialLive)
  }

  return { live, start, sendInputs, sendEvents, setSpeed, pause, resume, stop, reset }
}
