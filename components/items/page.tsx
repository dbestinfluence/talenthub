'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ItemRow = {
  id: number
  name: string
  qty: number
  status: string
  price: number
}

type CellField = 'name' | 'qty' | 'status' | 'price'

type ItemsPageProps = {
  rows?: ItemRow[]
  loading?: boolean
  onRowsChange?: (rows: ItemRow[] | ((prev: ItemRow[]) => ItemRow[])) => void
  onRefresh?: () => Promise<void>
}

export default function ItemsPage({
  rows: externalRows,
  loading: externalLoading,
  onRowsChange,
  onRefresh
}: ItemsPageProps = {}) {
  const [internalRows, setInternalRows] = useState<ItemRow[]>([])
  const [internalLoading, setInternalLoading] = useState(true)
  const [savingMap, setSavingMap] = useState<Record<string, boolean>>({})
  const [errorMap, setErrorMap] = useState<Record<string, boolean>>({})
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const rows = externalRows ?? internalRows
  const loading = externalLoading ?? internalLoading

  const setRows = useCallback((next: ItemRow[] | ((prev: ItemRow[]) => ItemRow[])) => {
    if (onRowsChange) {
      onRowsChange(next)
      return
    }

    setInternalRows(next)
  }, [onRowsChange])

  const fetchRows = useCallback(async () => {
    if (onRefresh) {
      await onRefresh()
      return
    }

    try {
      setInternalLoading(true)
      const res = await fetch('/api/items', { cache: 'no-store' })

      if (!res.ok) {
        throw new Error('Failed to load data')
      }

      const data: ItemRow[] = await res.json()
      setRows(data)
    } catch (error) {
      console.error(error)
      alert('Failed to load data')
    } finally {
      setInternalLoading(false)
    }
  }, [onRefresh, setRows])

  useEffect(() => {
    if (!onRowsChange) {
      void fetchRows()
    }
  }, [fetchRows, onRowsChange])

  function updateLocalCell(id: number, field: CellField, value: string) {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row

        if (field === 'qty' || field === 'price') {
          return {
            ...row,
            [field]: value === '' ? 0 : Number(value),
          }
        }

        return {
          ...row,
          [field]: value,
        }
      })
    )
  }

  function setSaving(cellKey: string, value: boolean) {
    setSavingMap((prev) => ({ ...prev, [cellKey]: value }))
  }

  function setError(cellKey: string, value: boolean) {
    setErrorMap((prev) => ({ ...prev, [cellKey]: value }))
  }

  function autoSaveCell(id: number, field: CellField, value: string) {
    const cellKey = `${id}-${field}`

    setSaving(cellKey, true)
    setError(cellKey, false)

    if (debounceTimers.current[cellKey]) {
      clearTimeout(debounceTimers.current[cellKey])
    }

    debounceTimers.current[cellKey] = setTimeout(async () => {
      try {
        const payloadValue =
          field === 'qty' || field === 'price'
            ? value === ''
              ? 0
              : Number(value)
            : value

        const res = await fetch(`/api/items/${id}/cell`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ field, value: payloadValue }),
        })

        if (!res.ok) {
          throw new Error('Failed to save data')
        }

        const result: { success: boolean; item: ItemRow } = await res.json()

        setRows((prev) =>
          prev.map((row) => (row.id === id ? { ...row, ...result.item } : row))
        )

        setSaving(cellKey, false)
        setError(cellKey, false)
      } catch (error) {
        console.error(error)
        setSaving(cellKey, false)
        setError(cellKey, true)
      }
    }, 500)
  }

  function handleChange(id: number, field: CellField, value: string) {
    updateLocalCell(id, field, value)
    autoSaveCell(id, field, value)
  }

  async function addRow() {
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
      })

      if (!res.ok) {
        throw new Error('Failed to add row')
      }

      const newRow: ItemRow = await res.json()
      setRows((prev) => [...prev, newRow])
    } catch (error) {
      console.error(error)
      alert('Failed to add row')
    }
  }

  async function deleteRow(id: number) {
    const ok = window.confirm('Delete this row?')
    if (!ok) return

    try {
      const res = await fetch(`/api/items/${id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        throw new Error('Failed to delete row')
      }

      setRows((prev) => prev.filter((row) => row.id !== id))
    } catch (error) {
      console.error(error)
      alert('Failed to delete data')
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Editable Grid</h1>

        <button
          onClick={addRow}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Add Row
        </button>
      </div>

      <div className="overflow-auto rounded-lg border">
        <table className="min-w-full border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-3 py-2 text-left">No</th>
              <th className="border px-3 py-2 text-left">Name</th>
              <th className="border px-3 py-2 text-left">Qty</th>
              <th className="border px-3 py-2 text-left">Status</th>
              <th className="border px-3 py-2 text-left">Price</th>
              <th className="border px-3 py-2 text-left">Action</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="border px-3 py-2">{row.id}</td>

                <td className="border p-0">
                  <CellInput
                    value={row.name}
                    onChange={(val) => handleChange(row.id, 'name', val)}
                    saving={savingMap[`${row.id}-name`]}
                    error={errorMap[`${row.id}-name`]}
                  />
                </td>

                <td className="border p-0">
                  <CellInput
                    value={String(row.qty)}
                    onChange={(val) => handleChange(row.id, 'qty', val)}
                    saving={savingMap[`${row.id}-qty`]}
                    error={errorMap[`${row.id}-qty`]}
                    inputMode="numeric"
                  />
                </td>

                <td className="border p-0">
                  <CellInput
                    value={row.status}
                    onChange={(val) => handleChange(row.id, 'status', val)}
                    saving={savingMap[`${row.id}-status`]}
                    error={errorMap[`${row.id}-status`]}
                  />
                </td>

                <td className="border p-0">
                  <CellInput
                    value={String(row.price)}
                    onChange={(val) => handleChange(row.id, 'price', val)}
                    saving={savingMap[`${row.id}-price`]}
                    error={errorMap[`${row.id}-price`]}
                    inputMode="decimal"
                  />
                </td>

                <td className="border px-3 py-2">
                  <button
                    onClick={() => deleteRow(row.id)}
                    className="rounded bg-red-500 px-3 py-1 text-white"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  )
}

type CellInputProps = {
  value: string
  onChange: (value: string) => void
  saving?: boolean
  error?: boolean
  inputMode?:
    | 'text'
    | 'search'
    | 'email'
    | 'tel'
    | 'url'
    | 'none'
    | 'numeric'
    | 'decimal'
}

function CellInput({
  value,
  onChange,
  saving,
  error,
  inputMode = 'text',
}: CellInputProps) {
  return (
    <div className="relative">
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        inputMode={inputMode}
        className="w-full min-w-[160px] border-0 bg-transparent px-3 py-2 outline-none focus:bg-yellow-50"
      />

      <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs">
        {saving && <span className="text-blue-500">Saving...</span>}
        {!saving && error && <span className="text-red-500">Error</span>}
      </div>
    </div>
  )
}
