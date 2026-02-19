'use client';

import { useState, useRef, useEffect } from 'react';

const BACKEND_URL = 'https://rec-clawding-backend-production.up.railway.app';

// Main App Component
export default function Home() {
  const [activeTab, setActiveTab] = useState('grabar');
  const [settings, setSettings] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('reclawding-settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    } else {
      const defaultSettings = {
        yourName: 'Nando',
        yourCompany: 'Kattegat Industries',
        language: 'es',
        backendUrl: BACKEND_URL,
        autoProcess: true,
      };
      setSettings(defaultSettings);
      localStorage.setItem('reclawding-settings', JSON.stringify(defaultSettings));
    }
  }, []);

  // Load conversations when tab changes
  useEffect(() => {
    if (activeTab === 'conversaciones' && settings) {
      loadConversations();
    }
  }, [activeTab, settings]);

  const loadConversations = async () => {
    if (!settings) return;
    setLoading(true);
    setError(null);
    try {
      const url = `${settings.backendUrl}/conversations?limit=50`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load conversations');
      const data = await response.json();
      setConversations(Array.isArray(data) ? data : data.conversations || []);
    } catch (err) {
      setError('Error cargando conversaciones');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!settings) {
    return <div className="flex items-center justify-center h-screen bg-reclawding-bg text-reclawding-text">Cargando...</div>;
  }

  return (
    <div className="flex flex-col h-screen bg-reclawding-bg text-reclawding-text overflow-hidden">
      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pb-20">
        {selectedConversation && (
          <ConversationDetail
            conversation={selectedConversation}
            settings={settings}
            onBack={() => setSelectedConversation(null)}
            onDelete={() => {
              setSelectedConversation(null);
              loadConversations();
            }}
          />
        )}

        {!selectedConversation && activeTab === 'grabar' && (
          <GrabarTab settings={settings} onRecordingComplete={loadConversations} />
        )}

        {!selectedConversation && activeTab === 'conversaciones' && (
          <ConversacionesTab
            conversations={conversations}
            loading={loading}
            error={error}
            onSelect={setSelectedConversation}
            onRefresh={loadConversations}
            settings={settings}
          />
        )}

        {!selectedConversation && activeTab === 'config' && (
          <ConfigTab settings={settings} setSettings={setSettings} backendUrl={BACKEND_URL} />
        )}
      </div>

      {/* Bottom Tab Navigation */}
      {!selectedConversation && (
        <div className="fixed bottom-0 left-0 right-0 bg-reclawding-card border-t border-slate-700 flex">
          <button
            onClick={() => setActiveTab('grabar')}
            className={`flex-1 py-4 flex flex-col items-center gap-1 ${
              activeTab === 'grabar'
                ? 'text-reclawding-primary'
                : 'text-slate-400 hover:text-reclawding-text'
            }`}
          >
            <span className="text-xl">🎤</span>
            <span className="text-xs">Grabar</span>
          </button>
          <button
            onClick={() => setActiveTab('conversaciones')}
            className={`flex-1 py-4 flex flex-col items-center gap-1 ${
              activeTab === 'conversaciones'
                ? 'text-reclawding-primary'
                : 'text-slate-400 hover:text-reclawding-text'
            }`}
          >
            <span className="text-xl">💬</span>
            <span className="text-xs">Conversaciones</span>
          </button>
          <button
            onClick={() => setActiveTab('config')}
            className={`flex-1 py-4 flex flex-col items-center gap-1 ${
              activeTab === 'config'
                ? 'text-reclawding-primary'
                : 'text-slate-400 hover:text-reclawding-text'
            }`}
          >
            <span className="text-xl">⚙️</span>
            <span className="text-xs">Config</span>
          </button>
        </div>
      )}
    </div>
  );
}

// Grabar (Record) Tab Component
function GrabarTab({ settings, onRecordingComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [status, setStatus] = useState('idle'); // idle, uploading, transcribing, analyzing, done
  const [statusMessage, setStatusMessage] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Determine MIME type for iOS Safari compatibility
      let mimeType = 'audio/webm';
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav';
      } else if (!MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = '';
      }

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: mimeType || undefined,
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        handleRecordingStop();
      };

      mediaRecorder.start();
      setIsRecording(true);
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      setError('Error accediendo al micrófono: ' + err.message);
      console.error(err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }

      // Stop all audio tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    }
  };

  const handleRecordingStop = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

    try {
      setStatus('uploading');
      setStatusMessage('Subiendo audio...');

      // Upload audio
      const formData = new FormData();
      formData.append('file', audioBlob, 'recording.webm');

      const uploadResponse = await fetch(
        `${settings.backendUrl}/upload?language=${settings.language}`,
        {
          method: 'POST',
          body: formData,
        }
      );

      if (!uploadResponse.ok) throw new Error('Upload failed');
      const uploadedData = await uploadResponse.json();
      const conversationId = uploadedData.id || uploadedData.conversation_id;

      if (settings.autoProcess) {
        setStatus('transcribing');
        setStatusMessage('Transcribiendo...');

        // Process conversation
        setStatus('analyzing');
        setStatusMessage('Analizando con IA...');

        const processResponse = await fetch(`${settings.backendUrl}/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversation_id: conversationId,
            language: settings.language,
            your_name: settings.yourName,
            your_company: settings.yourCompany,
          }),
        });

        if (!processResponse.ok) throw new Error('Process failed');
      }

      setStatus('done');
      setStatusMessage('¡Listo!');

      setTimeout(() => {
        setStatus('idle');
        setStatusMessage('');
        setDuration(0);
        audioChunksRef.current = [];
        onRecordingComplete();
      }, 2000);
    } catch (err) {
      setStatus('idle');
      setStatusMessage('Error: ' + err.message);
      console.error(err);
    }
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] p-6 gap-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">REClawding</h1>
        <p className="text-slate-400">Grabar y analizar conversaciones</p>
      </div>

      {/* Language Indicator */}
      <div className="text-sm text-slate-400">
        Idioma: {settings.language === 'es' ? 'Español' : 'English'}
      </div>

      {/* Timer */}
      {isRecording && (
        <div className="text-5xl font-mono font-bold text-reclawding-primary">
          {formatDuration(duration)}
        </div>
      )}

      {/* Record Button */}
      <button
        onClick={isRecording ? stopRecording : startRecording}
        disabled={status !== 'idle' && status !== 'done'}
        className={`w-24 h-24 rounded-full flex items-center justify-center text-2xl font-bold transition-all ${
          isRecording
            ? 'bg-red-500 text-white pulse-record hover:bg-red-600'
            : 'bg-reclawding-primary text-white hover:bg-blue-600'
        } disabled:opacity-50`}
      >
        {isRecording ? '⏹' : '🎤'}
      </button>

      {/* Status */}
      {statusMessage && (
        <div className="text-center">
          <p className="text-slate-300">{statusMessage}</p>
        </div>
      )}
    </div>
  );
}

// Conversaciones (Conversations) Tab Component
function ConversacionesTab({
  conversations,
  loading,
  error,
  onSelect,
  onRefresh,
  settings,
}) {
  const [filter, setFilter] = useState('todas');
  const [localError, setLocalError] = useState(null);
  const [setError] = useState(null);

  const filteredConversations = conversations.filter((conv) => {
    if (filter === 'todas') return true;
    if (filter === 'calientes') return conv.lead_score === 'hot';
    if (filter === 'tibios') return conv.lead_score === 'warm';
    if (filter === 'frios') return conv.lead_score === 'cold';
    return true;
  });

  const getScoreBadge = (score) => {
    switch (score) {
      case 'hot':
        return '🔥 Caliente';
      case 'warm':
        return '🟡 Tibio';
      case 'cold':
        return '🔵 Frío';
      default:
        return '⚪ N/A';
    }
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('es-ES', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return dateStr;
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0m';
    const mins = Math.floor(seconds / 60);
    return `${mins}m`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter Chips */}
      <div className="sticky top-0 bg-reclawding-bg border-b border-slate-700 p-4 flex gap-2 overflow-x-auto">
        {['todas', 'calientes', 'tibios', 'frios'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
              filter === f
                ? 'bg-reclawding-primary text-white'
                : 'bg-reclawding-card text-slate-400 hover:text-reclawding-text'
            }`}
          >
            {f === 'todas' && 'Todas'}
            {f === 'calientes' && '🔥 Calientes'}
            {f === 'tibios' && '🟡 Tibios'}
            {f === 'frios' && '🔵 Fríos'}
          </button>
        ))}
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-400">Cargando...</p>
          </div>
        ) : error || localError ? (
          <div className="p-4">
            <div className="bg-red-900 bg-opacity-30 border border-red-700 rounded p-4 text-red-200">
              {error || localError}
            </div>
            <button
              onClick={onRefresh}
              className="mt-4 w-full bg-reclawding-primary text-white py-2 rounded font-semibold hover:bg-blue-600"
            >
              Reintentar
            </button>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-400">No hay conversaciones</p>
          </div>
        ) : (
          <div className="p-4 space-y-3">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className="w-full bg-reclawding-card hover:bg-slate-700 rounded-lg p-4 text-left transition-colors"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{conv.lead_name || 'Sin nombre'}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {formatDate(conv.created_at)} • {formatDuration(conv.duration)}
                    </p>
                  </div>
                  <div className="text-xs bg-reclawding-bg px-2 py-1 rounded whitespace-nowrap">
                    {getScoreBadge(conv.lead_score)}
                  </div>
                </div>
                {conv.summary && (
                  <p className="text-sm text-slate-300 line-clamp-2">{conv.summary}</p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Refresh Button */}
      <div className="p-4 border-t border-slate-700">
        <button
          onClick={onRefresh}
          disabled={loading}
          className="w-full bg-reclawding-primary text-white py-2 rounded font-semibold hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>
    </div>
  );
}

// Conversation Detail Component
function ConversationDetail({ conversation, settings, onBack, onDelete }) {
  const [activeDetailTab, setActiveDetailTab] = useState('resumen');
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadDetailData();
  }, [conversation.id]);

  const loadDetailData = async () => {
    setDetailLoading(true);
    try {
      const response = await fetch(`${settings.backendUrl}/conversations/${conversation.id}`);
      if (!response.ok) throw new Error('Failed to load conversation details');
      const data = await response.json();
      setDetailData(data);
    } catch (err) {
      console.error('Error loading details:', err);
      setDetailData(conversation);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar esta conversación?')) return;

    setDeleting(true);
    try {
      const response = await fetch(`${settings.backendUrl}/conversations/${conversation.id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Failed to delete');
      onDelete();
    } catch (err) {
      console.error('Error deleting:', err);
      alert('Error al eliminar la conversación');
    } finally {
      setDeleting(false);
    }
  };

  const getScoreBadge = (score) => {
    switch (score) {
      case 'hot':
        return '🔥 Caliente';
      case 'warm':
        return '🟡 Tibio';
      case 'cold':
        return '🔵 Frío';
      default:
        return '⚪ N/A';
    }
  };

  const formatDuration = (seconds) => {
    if (!seconds) return '0m';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const data = detailData || conversation;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="sticky top-0 bg-reclawding-card border-b border-slate-700 p-4 flex items-center gap-4">
        <button onClick={onBack} className="text-2xl">
          ←
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold truncate">{data.lead_name || 'Sin nombre'}</h2>
          <p className="text-xs text-slate-400">{getScoreBadge(data.lead_score)}</p>
        </div>
      </div>

      {/* Detail Tabs */}
      <div className="sticky top-16 bg-reclawding-bg border-b border-slate-700 flex gap-4 p-4 overflow-x-auto">
        {['resumen', 'transcript', 'followup'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveDetailTab(tab)}
            className={`px-3 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${
              activeDetailTab === tab
                ? 'text-reclawding-primary border-b-2 border-reclawding-primary'
                : 'text-slate-400 hover:text-reclawding-text'
            }`}
          >
            {tab === 'resumen' && 'Resumen'}
            {tab === 'transcript' && 'Transcript'}
            {tab === 'followup' && 'Follow-up'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {detailLoading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-slate-400">Cargando detalles...</p>
          </div>
        ) : activeDetailTab === 'resumen' ? (
          <ResumenView data={data} formatDuration={formatDuration} />
        ) : activeDetailTab === 'transcript' ? (
          <TranscriptView data={data} />
        ) : (
          <FollowupView data={data} />
        )}
      </div>

      {/* Delete Button */}
      <div className="border-t border-slate-700 p-4">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="w-full bg-red-900 bg-opacity-30 border border-red-700 text-red-200 py-2 rounded font-semibold hover:bg-opacity-50 disabled:opacity-50"
        >
          {deleting ? 'Eliminando...' : 'Eliminar conversación'}
        </button>
      </div>
    </div>
  );
}

// Resumen View Component
function ResumenView({ data, formatDuration }) {
  return (
    <div className="space-y-6">
      {/* Metadata */}
      <div className="bg-reclawding-card rounded-lg p-4 space-y-3">
        <div>
          <p className="text-xs text-slate-400 uppercase">Duración</p>
          <p className="font-semibold">{formatDuration(data.duration)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400 uppercase">Idioma</p>
          <p className="font-semibold">{data.language === 'es' ? 'Español' : 'English'}</p>
        </div>
      </div>

      {/* Lead Info */}
      {data.lead_info && (
        <div className="bg-reclawding-card rounded-lg p-4">
          <h3 className="text-sm font-bold text-reclawding-primary mb-3">Información del Cliente</h3>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{data.lead_info}</p>
        </div>
      )}

      {/* Score Reasoning */}
      {data.score_reasoning && (
        <div className="bg-reclawding-card rounded-lg p-4">
          <h3 className="text-sm font-bold text-reclawding-primary mb-3">Razón de Puntuación</h3>
          <p className="text-sm text-slate-300">{data.score_reasoning}</p>
        </div>
      )}

      {/* Summary */}
      {data.summary && (
        <div className="bg-reclawding-card rounded-lg p-4">
          <h3 className="text-sm font-bold text-reclawding-primary mb-3">Resumen</h3>
          <p className="text-sm text-slate-300 whitespace-pre-wrap">{data.summary}</p>
        </div>
      )}

      {/* Action Items */}
      {data.action_items && (
        <div className="bg-reclawding-card rounded-lg p-4">
          <h3 className="text-sm font-bold text-reclawding-primary mb-3">Elementos de Acción</h3>
          <ul className="space-y-2 text-sm text-slate-300">
            {(typeof data.action_items === 'string'
              ? data.action_items.split('\n').filter(Boolean)
              : Array.isArray(data.action_items)
              ? data.action_items
              : []
            ).map((item, idx) => (
              <li key={idx} className="flex gap-2">
                <span>•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Interests */}
      {data.interests && (
        <div className="bg-reclawding-card rounded-lg p-4">
          <h3 className="text-sm font-bold text-reclawding-primary mb-3">Intereses</h3>
          <p className="text-sm text-slate-300">{data.interests}</p>
        </div>
      )}

      {/* Key Quotes */}
      {data.key_quotes && (
        <div className="bg-reclawding-card rounded-lg p-4">
          <h3 className="text-sm font-bold text-reclawding-primary mb-3">Citas Clave</h3>
          <p className="text-sm text-slate-300 italic">"{data.key_quotes}"</p>
        </div>
      )}
    </div>
  );
}

// Transcript View Component
function TranscriptView({ data }) {
  if (!data.transcript) {
    return <p className="text-slate-400">No hay transcript disponible</p>;
  }

  // Parse transcript - can be string or array
  const segments = typeof data.transcript === 'string'
    ? data.transcript.split('\n').filter(Boolean)
    : Array.isArray(data.transcript)
    ? data.transcript
    : [];

  return (
    <div className="space-y-3">
      {segments.map((segment, idx) => {
        // Try to parse speaker: text format
        let speaker = 'Desconocido';
        let text = segment;

        const match = segment.match(/^([^:]+):\s*(.*)$/);
        if (match) {
          speaker = match[1].trim();
          text = match[2].trim();
        }

        const isYou = speaker.toLowerCase().includes('you') || speaker.toLowerCase().includes('yo');
        const color = isYou ? 'text-blue-400' : 'text-slate-300';

        return (
          <div key={idx} className="bg-reclawding-card rounded-lg p-3">
            <p className={`text-xs font-semibold mb-1 ${color}`}>{speaker}</p>
            <p className="text-sm text-slate-300">{text}</p>
          </div>
        );
      })}
    </div>
  );
}

// Follow-up View Component
function FollowupView({ data }) {
  const [copied, setCopied] = useState(false);

  const followupText = data.follow_up_email ||
    data.followup ||
    data.follow_up ||
    'No hay seguimiento disponible';

  const handleCopy = () => {
    navigator.clipboard.writeText(followupText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="bg-reclawding-card rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-reclawding-primary">Email de Seguimiento</h3>
          <button
            onClick={handleCopy}
            className="text-xs bg-reclawding-primary text-white px-3 py-1 rounded hover:bg-blue-600"
          >
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <p className="text-sm text-slate-300 whitespace-pre-wrap">{followupText}</p>
      </div>
    </div>
  );
}

// Config (Settings) Tab Component
function ConfigTab({ settings, setSettings, backendUrl }) {
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState(null);

  const updateSetting = (key, value) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    localStorage.setItem('reclawding-settings', JSON.stringify(updated));
  };

  const testConnection = async () => {
    setTestingConnection(true);
    setConnectionStatus(null);

    try {
      const response = await fetch(`${settings.backendUrl}/`, {
        method: 'GET',
      });

      if (response.ok) {
        const data = await response.json();
        setConnectionStatus({
          success: true,
          message: `Conectado a REClawding v${data.version}`,
        });
      } else {
        setConnectionStatus({
          success: false,
          message: `Error de conexión: ${response.status}`,
        });
      }
    } catch (err) {
      setConnectionStatus({
        success: false,
        message: `Error: ${err.message}`,
      });
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Your Name */}
      <div>
        <label className="block text-sm font-semibold mb-2">Tu Nombre</label>
        <input
          type="text"
          value={settings.yourName}
          onChange={(e) => updateSetting('yourName', e.target.value)}
          className="w-full"
        />
      </div>

      {/* Your Company */}
      <div>
        <label className="block text-sm font-semibold mb-2">Tu Empresa</label>
        <input
          type="text"
          value={settings.yourCompany}
          onChange={(e) => updateSetting('yourCompany', e.target.value)}
          className="w-full"
        />
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-semibold mb-2">Idioma de Grabación</label>
        <select
          value={settings.language}
          onChange={(e) => updateSetting('language', e.target.value)}
          className="w-full"
        >
          <option value="es">Español</option>
          <option value="en">English</option>
        </select>
      </div>

      {/* Backend URL */}
      <div>
        <label className="block text-sm font-semibold mb-2">URL del Backend</label>
        <input
          type="text"
          value={settings.backendUrl}
          onChange={(e) => updateSetting('backendUrl', e.target.value)}
          className="w-full"
          placeholder={backendUrl}
        />
        <p className="text-xs text-slate-400 mt-1">
          Por defecto: {backendUrl}
        </p>
      </div>

      {/* Auto Process */}
      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="autoProcess"
          checked={settings.autoProcess}
          onChange={(e) => updateSetting('autoProcess', e.target.checked)}
          className="w-4 h-4"
        />
        <label htmlFor="autoProcess" className="text-sm font-semibold">
          Procesar automáticamente después de grabar
        </label>
      </div>

      {/* Test Connection */}
      <div>
        <button
          onClick={testConnection}
          disabled={testingConnection}
          className="w-full bg-reclawding-primary text-white py-3 rounded font-semibold hover:bg-blue-600 disabled:opacity-50"
        >
          {testingConnection ? 'Probando...' : 'Probar Conexión'}
        </button>

        {connectionStatus && (
          <div
            className={`mt-3 p-3 rounded text-sm ${
              connectionStatus.success
                ? 'bg-green-900 bg-opacity-30 border border-green-700 text-green-200'
                : 'bg-red-900 bg-opacity-30 border border-red-700 text-red-200'
            }`}
          >
            {connectionStatus.message}
          </div>
        )}
      </div>

      {/* App Version */}
      <div className="text-center text-xs text-slate-500 mt-8">
        <p>REClawding v1.0.0</p>
        <p>PWA instalable en iOS y Android</p>
      </div>
    </div>
  );
}
