import { useState } from 'react'

// Édite le nom d'un module sans transformer son identité ou ses racines.
export default function ModuleNameForm({ module, onRename }) {
  const [name, setName] = useState(module.name)
  return <form className="node-form" onSubmit={(event) => { event.preventDefault(); if (name.trim()) onRename(module.id, name.trim()) }}>
    <label>Name<input aria-label="Module name" value={name} required onChange={(event) => setName(event.target.value)} /></label>
    <button type="submit">Save</button>
  </form>
}
