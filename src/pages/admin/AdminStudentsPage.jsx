import { useState, useRef } from 'react'
import { Upload, AlertTriangle, Users, RefreshCw, Download } from 'lucide-react'
import Papa from 'papaparse'
import { upsertApprovedStudents, getApprovedStudents } from '../../lib/api'
import { LevelBadge, StatusBadge } from '../../components/ui/Badge'
import { Alert } from '../../components/ui/Alert'
import { Spinner } from '../../components/ui/Spinner'
import { EmptyState } from '../../components/ui/EmptyState'

const VALID_LEVELS = ['100', '200', '300', '400', '500']

function genBatchId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

function validateRow(row, index) {
  const errors = []
  if (!row.matric_number?.trim())                      errors.push(`Row ${index+1}: missing matric_number`)
  if (!row.full_name?.trim())                          errors.push(`Row ${index+1}: missing full_name`)
  if (!VALID_LEVELS.includes(String(row.level).trim())) errors.push(`Row ${index+1}: invalid level "${row.level}"`)
  if ((row.matric_number?.trim().length ?? 0) > 20)    errors.push(`Row ${index+1}: matric number too long`)
  return errors
}

function CsvDropzone({ onFileParsed }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  function processFile(file) {
    if (!file) return
    if (!file.name.endsWith('.csv')) { alert('Please upload a .csv file.'); return }
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
      complete: r => onFileParsed(r.data, r.errors),
      error:    e => alert('CSV parse error: ' + e.message),
    })
  }

  return (
    <label htmlFor="csv-upload"
      onDrop={e => { e.preventDefault(); setDragging(false); processFile(e.dataTransfer.files[0]) }}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed
        px-6 py-10 cursor-pointer transition-colors
        ${dragging ? 'border-gold-400 bg-gold-900/20' : 'border-pitch-600 bg-pitch-800/30 hover:border-pitch-500'}`}>
      <Upload className={`h-8 w-8 ${dragging ? 'text-gold-400' : 'text-pitch-400'}`} aria-hidden />
      <div className="text-center">
        <p className="text-sm font-medium text-white">Drop your CSV here or click to browse</p>
        <p className="text-xs text-pitch-400 mt-1">
          Required: <code className="text-gold-300">matric_number, full_name, level</code>
          {' '}· Optional: <code className="text-gold-300">eligibility</code>
        </p>
      </div>
      <input id="csv-upload" ref={inputRef} type="file" accept=".csv" className="sr-only"
        onChange={e => processFile(e.target.files[0])} />
    </label>
  )
}

function ExistingStudentsList() {
  const [students, setStudents] = useState([])
  const [loading,  setLoading]  = useState(false)
  const [loaded,   setLoaded]   = useState(false)
  const [search,   setSearch]   = useState('')
  const [level,    setLevel]    = useState('')

  async function load() {
    setLoading(true)
    try {
      const data = await getApprovedStudents({ level: level || undefined, search: search || undefined })
      setStudents(data ?? [])
      setLoaded(true)
    } catch (err) {
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="card p-5 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-white flex items-center gap-2">
          <Users className="h-4 w-4 text-gold-400" /> Approved Students
        </h3>
        <button onClick={load} className="btn-outline text-xs py-1.5 px-3 gap-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loaded ? 'Refresh' : 'Load'}
        </button>
      </div>
      {loaded && (
        <>
          <div className="flex gap-2 mb-3">
            <input type="search" value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && load()}
              placeholder="Search name or matric…" className="input text-sm py-1.5 flex-1" />
            <select value={level} onChange={e => setLevel(e.target.value)} className="input text-sm py-1.5 w-28">
              <option value="">All levels</option>
              {VALID_LEVELS.map(l => <option key={l} value={l}>{l}L</option>)}
            </select>
          </div>
          {loading ? (
            <div className="flex justify-center py-6"><Spinner /></div>
          ) : students.length === 0 ? (
            <EmptyState icon={Users} title="No students found" />
          ) : (
            <div className="table-container max-h-80 overflow-y-auto">
              <table className="table">
                <thead><tr><th>Matric</th><th>Name</th><th>Level</th><th>Eligibility</th></tr></thead>
                <tbody>
                  {students.map(s => (
                    <tr key={s.id}>
                      <td className="font-mono text-xs">{s.matric_number}</td>
                      <td className="text-sm">{s.full_name}</td>
                      <td><LevelBadge level={s.level} /></td>
                      <td><StatusBadge status={s.eligibility} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function downloadTemplate() {
  const csv  = 'matric_number,full_name,level,eligibility\nCVE/2022/001,John Doe,100,eligible'
  const blob = new Blob([csv], { type: 'text/csv' })
  const a    = document.createElement('a')
  a.href     = URL.createObjectURL(blob)
  a.download = 'approved_students_template.csv'
  a.click()
}

export default function AdminStudentsPage() {
  const [rows,         setRows]         = useState([])
  const [parseErrors,  setParseErrors]  = useState([])
  const [uploading,    setUploading]    = useState(false)
  const [uploadResult, setUploadResult] = useState(null)
  const [uploadError,  setUploadError]  = useState('')

  function handleFileParsed(data) {
    setUploadResult(null); setUploadError('')
    setParseErrors(data.flatMap((r, i) => validateRow(r, i)))
    setRows(data)
  }

  async function handleUpload() {
    if (rows.length === 0 || parseErrors.length > 0) return
    setUploading(true); setUploadError('')
    try {
      const result = await upsertApprovedStudents(rows, genBatchId())
      setUploadResult(result)
      setRows([]); setParseErrors([])
    } catch (err) {
      setUploadError(err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Approved Student List</h1>
          <p className="text-sm text-pitch-400">Upload a CSV to define who may register</p>
        </div>
        <button onClick={downloadTemplate} className="btn-outline text-sm gap-1.5 py-2">
          <Download className="h-4 w-4" /> CSV Template
        </button>
      </div>

      {uploadResult && (
        <Alert variant="success" className="mb-4" dismissible>
          <strong>{uploadResult.count} students</strong> uploaded successfully.
        </Alert>
      )}
      {uploadError && <Alert variant="error" className="mb-4" dismissible>{uploadError}</Alert>}

      <div className="card-elevated p-6">
        <h2 className="font-semibold text-white mb-4">Upload CSV</h2>
        {rows.length === 0 ? (
          <CsvDropzone onFileParsed={handleFileParsed} />
        ) : (
          <>
            {parseErrors.length > 0 && (
              <Alert variant="error" className="mb-3">
                <ul className="list-disc list-inside text-xs space-y-0.5">
                  {parseErrors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </Alert>
            )}
            <div className="table-container max-h-64 overflow-y-auto mb-4">
              <table className="table">
                <thead><tr><th>Matric</th><th>Name</th><th>Level</th><th>Eligibility</th></tr></thead>
                <tbody>
                  {rows.slice(0, 100).map((r, i) => (
                    <tr key={i}>
                      <td className="font-mono text-xs">{r.matric_number}</td>
                      <td>{r.full_name}</td>
                      <td><LevelBadge level={String(r.level).trim()} /></td>
                      <td><StatusBadge status={r.eligibility || 'eligible'} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <button onClick={handleUpload} disabled={uploading || parseErrors.length > 0}
                className="btn-gold flex-1 justify-center py-2.5">
                {uploading ? <><Spinner size="sm" /> Uploading…</> : `Upload ${rows.length} Students`}
              </button>
              <button onClick={() => { setRows([]); setParseErrors([]) }} className="btn-outline px-5">
                Cancel
              </button>
            </div>
            {parseErrors.length > 0 && (
              <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
                <AlertTriangle className="h-3.5 w-3.5" /> Fix all errors before uploading.
              </p>
            )}
          </>
        )}
      </div>

      <ExistingStudentsList />
    </div>
  )
}
