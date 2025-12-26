import React, { useState, useEffect } from 'react';
import { Database, Server, HardDrive, ChevronDown, ChevronRight, Table, X, Loader2, RefreshCw, Trash2, Zap } from 'lucide-react';

const API_BASE = 'http://localhost:8005';

const SchemaDataModal = ({ isOpen, onClose, dbName, tableName }) => {
    const [activeTab, setActiveTab] = useState('schema');
    const [schema, setSchema] = useState(null);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [clearing, setClearing] = useState(false);
    const [page, setPage] = useState(1);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && tableName) {
            fetchSchema();
            fetchData(1);
        }
    }, [isOpen, tableName]);

    const fetchSchema = async () => {
        try {
            const res = await fetch(`${API_BASE}/databases/${dbName}/tables/${tableName}/schema`);
            if (!res.ok) throw new Error('Failed to fetch schema');
            const data = await res.json();
            setSchema(data);
        } catch (err) {
            setError(err.message);
        }
    };

    const fetchData = async (pageNum) => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/databases/${dbName}/tables/${tableName}/data?page=${pageNum}&page_size=10`);
            if (!res.ok) throw new Error('Failed to fetch data');
            const result = await res.json();
            setData(result);
            setPage(pageNum);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const clearTable = async () => {
        if (!confirm(`Are you sure you want to clear ALL data from table "${tableName}"? This action cannot be undone.`)) {
            return;
        }

        setClearing(true);
        try {
            const res = await fetch(`${API_BASE}/databases/${dbName}/tables/${tableName}/clear`, {
                method: 'DELETE'
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.detail || 'Failed to clear table');
            }

            const result = await res.json();
            alert(`Successfully cleared table "${tableName}". ${result.rows_deleted} rows deleted.`);

            // Refresh the data to show empty table
            fetchData(1);
        } catch (err) {
            alert(`Error clearing table: ${err.message}`);
        } finally {
            setClearing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[85vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center space-x-2">
                        <Table className="text-green-600" size={20} />
                        <h2 className="text-lg font-semibold text-gray-800">{tableName}</h2>
                        <span className="text-sm text-gray-500">in {dbName}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={clearTable}
                            disabled={clearing}
                            className="flex items-center space-x-1 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {clearing ? (
                                <Loader2 className="animate-spin" size={14} />
                            ) : (
                                <Trash2 size={14} />
                            )}
                            <span>{clearing ? 'Clearing...' : 'Clear Table'}</span>
                        </button>
                        <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
                            <X size={20} className="text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b">
                    <button
                        onClick={() => setActiveTab('schema')}
                        className={`px-6 py-3 text-sm font-medium ${activeTab === 'schema'
                            ? 'text-green-600 border-b-2 border-green-600'
                            : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Schema
                    </button>
                    <button
                        onClick={() => setActiveTab('data')}
                        className={`px-6 py-3 text-sm font-medium ${activeTab === 'data'
                            ? 'text-green-600 border-b-2 border-green-600'
                            : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Data
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4">
                    {error && (
                        <div className="text-red-500 text-center py-4">{error}</div>
                    )}

                    {activeTab === 'schema' && schema && (
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="text-left p-3 font-medium text-gray-700">Column</th>
                                    <th className="text-left p-3 font-medium text-gray-700">Type</th>
                                    <th className="text-left p-3 font-medium text-gray-700">Nullable</th>
                                    <th className="text-left p-3 font-medium text-gray-700">Primary Key</th>
                                    <th className="text-left p-3 font-medium text-gray-700">Default</th>
                                </tr>
                            </thead>
                            <tbody>
                                {schema.columns.map((col, idx) => (
                                    <tr key={idx} className="border-t hover:bg-gray-50">
                                        <td className="p-3 font-mono text-gray-800">{col.name}</td>
                                        <td className="p-3 font-mono text-blue-600">{col.type}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs ${col.nullable ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                                {col.nullable ? 'YES' : 'NO'}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            {col.primary_key && <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">PK</span>}
                                        </td>
                                        <td className="p-3 font-mono text-gray-500 text-xs">{col.default || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}

                    {activeTab === 'data' && (
                        <div>
                            {loading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="animate-spin text-green-600" size={24} />
                                </div>
                            ) : data ? (
                                <>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-50">
                                                    {data.columns.map((col, idx) => (
                                                        <th key={idx} className="text-left p-3 font-medium text-gray-700 whitespace-nowrap">
                                                            {col}
                                                        </th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.rows.map((row, rowIdx) => (
                                                    <tr key={rowIdx} className="border-t hover:bg-gray-50">
                                                        {data.columns.map((col, colIdx) => (
                                                            <td key={colIdx} className="p-3 font-mono text-gray-800 whitespace-nowrap max-w-xs truncate">
                                                                {row[col] !== null ? String(row[col]) : <span className="text-gray-400">NULL</span>}
                                                            </td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    {/* Pagination */}
                                    <div className="flex items-center justify-between mt-4 pt-4 border-t">
                                        <span className="text-sm text-gray-500">
                                            Showing {(page - 1) * data.page_size + 1} - {Math.min(page * data.page_size, data.total_count)} of {data.total_count}
                                        </span>
                                        <div className="flex space-x-2">
                                            <button
                                                onClick={() => fetchData(page - 1)}
                                                disabled={page <= 1}
                                                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Previous
                                            </button>
                                            <button
                                                onClick={() => fetchData(page + 1)}
                                                disabled={page * data.page_size >= data.total_count}
                                                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                Next
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const DatabaseCard = ({ database, onTableClick }) => {
    const [expanded, setExpanded] = useState(false);
    const [tables, setTables] = useState([]);
    const [loading, setLoading] = useState(false);

    const icons = {
        timescaledb: HardDrive,
        auth_db: Server,
        postgis: Database,
        reco_db: Zap
    };
    const colors = {
        timescaledb: 'bg-blue-600',
        auth_db: 'bg-orange-600',
        postgis: 'bg-green-600',
        reco_db: 'bg-emerald-600'
    };

    const Icon = icons[database.name] || Database;
    const color = colors[database.name] || 'bg-gray-600';

    const toggleExpand = async () => {
        if (!expanded && tables.length === 0) {
            setLoading(true);
            try {
                const res = await fetch(`${API_BASE}/databases/${database.name}/tables`);
                if (res.ok) {
                    const data = await res.json();
                    setTables(data);
                }
            } catch (err) {
                console.error('Failed to fetch tables:', err);
            } finally {
                setLoading(false);
            }
        }
        setExpanded(!expanded);
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Header */}
            <div
                className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={toggleExpand}
            >
                <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                        <div className={`w-10 h-10 rounded-lg ${color} flex items-center justify-center`}>
                            <Icon className="text-white" size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-gray-800">{database.display_name}</h3>
                            <p className="text-xs text-gray-500">{database.type}</p>
                        </div>
                    </div>
                    <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${database.table_count >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {database.table_count >= 0 ? `${database.table_count} tables` : 'Offline'}
                        </span>
                        {expanded ? <ChevronDown size={18} className="text-gray-400" /> : <ChevronRight size={18} className="text-gray-400" />}
                    </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">{database.description}</p>
            </div>

            {/* Expanded Table List */}
            {expanded && (
                <div className="border-t bg-gray-50 p-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-4">
                            <Loader2 className="animate-spin text-gray-400" size={20} />
                        </div>
                    ) : tables.length > 0 ? (
                        <div className="space-y-2">
                            {tables.map((table, idx) => (
                                <div
                                    key={idx}
                                    onClick={() => onTableClick(database.name, table.name)}
                                    className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-green-300 hover:shadow-sm transition-all"
                                >
                                    <div className="flex items-center space-x-2">
                                        <Table size={16} className="text-gray-400" />
                                        <span className="font-mono text-sm text-gray-700">{table.name}</span>
                                    </div>
                                    <span className="text-xs text-gray-500">
                                        {table.row_count !== null ? `${table.row_count} rows` : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 text-center py-2">No tables found</p>
                    )}
                </div>
            )}
        </div>
    );
};

export default function Databases() {
    const [databases, setDatabases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedDb, setSelectedDb] = useState(null);
    const [selectedTable, setSelectedTable] = useState(null);

    const fetchDatabases = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_BASE}/databases`);
            if (!res.ok) throw new Error('Failed to connect to DB Explorer');
            const data = await res.json();
            setDatabases(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDatabases();
    }, []);

    const handleTableClick = (dbName, tableName) => {
        setSelectedDb(dbName);
        setSelectedTable(tableName);
        setModalOpen(true);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Databases</h1>
                    <p className="text-gray-500 mt-1">
                        Explore database tables, schemas, and data
                    </p>
                </div>
                <button
                    onClick={fetchDatabases}
                    className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                    <RefreshCw size={16} />
                    <span>Refresh</span>
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-red-700 text-sm">
                        <strong>Error:</strong> {error}
                    </p>
                    <p className="text-red-600 text-xs mt-1">
                        Make sure the db-explorer service is running on port 8005
                    </p>
                </div>
            )}

            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-green-600" size={32} />
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {databases.map((db, idx) => (
                        <DatabaseCard key={idx} database={db} onTableClick={handleTableClick} />
                    ))}
                </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-sm font-medium text-blue-800 mb-2">Usage Tips</h3>
                <ul className="text-sm text-blue-700 list-disc list-inside space-y-1">
                    <li>Click on a database card to expand and view its tables</li>
                    <li>Click on a table to view its schema and data</li>
                    <li>Use the Refresh button to reload database information</li>
                </ul>
            </div>

            <SchemaDataModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                dbName={selectedDb}
                tableName={selectedTable}
            />
        </div>
    );
}
