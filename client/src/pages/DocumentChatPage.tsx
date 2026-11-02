import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  Trash2,
  Sparkles,
  Shield,
  ExternalLink,
  BookOpen,
  ArrowRight,
  Info,
  ChevronRight,
} from 'lucide-react';
import ApiService from '../services/api.js';
import { DocumentRecord, ChatMessage, ChatCitation } from '../types/index.js';
import { DocumentNavHeader } from '../components/document/DocumentNavHeader.js';

export const DocumentChatPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [aiProvider, setAiProvider] = useState<string>('groq');
  const [activeCitation, setActiveCitation] = useState<ChatCitation | null>(null);
  const currentDocumentId = useRef(id);
  currentDocumentId.current = id;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchChat = async () => {
    if (!id) return;
    try {
      const [docRes, chatRes] = await Promise.all([
        ApiService.getDocumentById(id),
        ApiService.getChat(id),
      ]);
      if (currentDocumentId.current !== id) return;
      setDocument(docRes.document);
      if (docRes.document?.summary?.analysisProvider) {
        setAiProvider(docRes.document.summary.analysisProvider);
      }
      setMessages(chatRes.conversation.messages || []);
    } catch (err) {
      console.error('Failed to load chat session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setMessages([]);
    setDocument(null);
    setActiveCitation(null);
    setInputQuestion('');
    setIsLoading(true);
    fetchChat();
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  const handleSendMessage = async (questionText?: string) => {
    const q = questionText || inputQuestion;
    if (!q.trim() || !id || isSending) return;

    setInputQuestion('');
    setIsSending(true);

    const tempUserMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId: '',
      role: 'user',
      content: q.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await ApiService.sendChatMessage(id, q.trim());
      if (currentDocumentId.current !== id) return;
      if (res.provider) setAiProvider(res.provider);
      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, res.message]);
    } catch (err: any) {
      setMessages((prev) => prev.filter((m) => m.id !== tempUserMsg.id));
      alert(`Chat error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = async () => {
    if (!id) return;
    if (!confirm('Clear chat conversation for this document?')) return;

    try {
      await ApiService.clearChat(id);
      setMessages([]);
      setActiveCitation(null);
    } catch (err: any) {
      alert(`Failed to reset chat: ${err.message}`);
    }
  };

  const samplePrompts = [
    'What is the title, purpose, or main subject of this agreement?',
    'What payment terms, consideration amounts, and invoices are specified?',
    'Who are the contracting parties and their roles?',
    'What is the required notice period for termination or renewal?',
    'Are there limitation of liability caps or indemnity terms?',
  ];

  const parseCitations = (citationsStr?: string | null): ChatCitation[] => {
    if (!citationsStr) return [];
    try {
      const parsed = JSON.parse(citationsStr);
      return Array.isArray(parsed)
        ? parsed.filter((c) => c.verified === true && c.chunkId && Number.isInteger(c.pageNumber))
        : [];
    } catch {
      return [];
    }
  };

  return (
    <div style={{ width: '100%', margin: '0' }} className="animate-fade-in">
      <DocumentNavHeader document={document} />

      {!['READY', 'KEYWORD_READY'].includes(document?.ragStatus || '') && (
        <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
          <Info size={16} style={{ flexShrink: 0 }} />
          <div>
            <p style={{ fontWeight: 600 }}>Document text indexing is still in progress</p>
            <p style={{ fontSize: '0.8125rem', marginTop: '2px' }}>
              Chat works best once indexing completes.{' '}
              <Link to={`/documents/${id}/ocr-preview`} style={{ textDecoration: 'underline', color: 'inherit' }}>
                Review OCR pages
              </Link>
            </p>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(280px, 1fr)', gap: '20px' }}>
        {/* Main Chat Interface */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '680px',
            padding: 0,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--white)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--radius)',
                  background: 'var(--black)',
                  color: 'var(--white)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MessageSquare size={16} />
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '0.9375rem', fontWeight: 600 }}>Legal Assistant</h3>
                  <span className="badge badge-default" style={{ fontSize: '0.6875rem' }}>
                    Document RAG
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Answers grounded in verified document text
                </p>
              </div>
            </div>

            <button
              onClick={handleClearChat}
              disabled={messages.length === 0}
              className="btn btn-ghost btn-sm"
              style={{ color: messages.length === 0 ? 'var(--text-muted)' : 'var(--danger)' }}
              title="Clear conversation"
            >
              <Trash2 size={14} />
              <span>Reset</span>
            </button>
          </div>

          {/* Messages Stream */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: 'var(--surface)',
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  margin: 'auto',
                  textAlign: 'center',
                  maxWidth: '420px',
                  padding: '30px 16px',
                }}
              >
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: 'var(--radius)',
                    background: 'var(--white)',
                    border: '1px solid var(--border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 16px',
                  }}
                >
                  <MessageSquare size={22} style={{ color: 'var(--text-secondary)' }} />
                </div>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Ask questions about this contract
                </h4>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '6px', lineHeight: 1.5 }}>
                  Inquire about obligations, terms, deadlines, and liabilities. Every response is verified with exact citations.
                </p>

                <div style={{ marginTop: '24px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Suggested Questions
                  </p>
                  {samplePrompts.slice(0, 3).map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt)}
                      className="btn"
                      style={{
                        justifyContent: 'space-between',
                        textAlign: 'left',
                        padding: '10px 14px',
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        width: '100%',
                        background: 'var(--white)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{prompt}</span>
                      <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: '8px' }} />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => {
                const isUser = msg.role === 'user';
                const citations = parseCitations(msg.sourceCitations);

                return (
                  <div
                    key={msg.id}
                    style={{
                      display: 'flex',
                      justifyContent: isUser ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '85%',
                        borderRadius: 'var(--radius)',
                        padding: '14px 18px',
                        background: isUser ? 'var(--black)' : 'var(--white)',
                        color: isUser ? 'var(--white)' : 'var(--text-primary)',
                        border: isUser ? 'none' : '1px solid var(--border)',
                        fontSize: '0.875rem',
                        lineHeight: 1.6,
                      }}
                    >
                      {/* Body */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {!isUser && msg.content.includes('could not find enough relevant passages') ? (
                          <div className="alert alert-warning" style={{ fontSize: '0.8125rem', padding: '10px 12px' }}>
                            <Info size={16} style={{ flexShrink: 0 }} />
                            <div>
                              <p style={{ fontWeight: 600, marginBottom: '2px' }}>Information Not Found</p>
                              <p>{msg.content}</p>
                            </div>
                          </div>
                        ) : (
                          msg.content.split(/\n+/).filter(Boolean).map((para, i) => {
                            const colonIdx = para.indexOf(':');
                            if (colonIdx > 0 && colonIdx < 35 && !para.startsWith('http') && !para.startsWith('"')) {
                              const key = para.slice(0, colonIdx);
                              const rest = para.slice(colonIdx + 1);
                              return (
                                <p key={i}>
                                  <strong style={{ color: isUser ? 'var(--white)' : 'var(--text-primary)' }}>
                                    {key}:
                                  </strong>
                                  <span style={{ marginLeft: '6px' }}>{rest}</span>
                                </p>
                              );
                            }
                            return <p key={i}>{para}</p>;
                          })
                        )}
                      </div>

                      {/* Attached Citations */}
                      {!isUser && citations.length > 0 && (
                        <div
                          style={{
                            marginTop: '12px',
                            paddingTop: '10px',
                            borderTop: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            flexWrap: 'wrap',
                            gap: '6px',
                          }}
                        >
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, marginRight: '4px' }}>
                            Sources:
                          </span>
                          {citations.map((cite, cIdx) => (
                            <button
                              key={cIdx}
                              onClick={() => setActiveCitation(cite)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid var(--border)',
                                background: activeCitation === cite ? 'var(--black)' : 'var(--surface)',
                                color: activeCitation === cite ? 'var(--white)' : 'var(--text-primary)',
                                cursor: 'pointer',
                              }}
                            >
                              <BookOpen size={11} />
                              <span>Page {cite.pageNumber}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}

            {isSending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: 'var(--radius)',
                    background: 'var(--white)',
                    border: '1px solid var(--border)',
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}
                >
                  <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                  <span>Searching document text and preparing answer…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div
            style={{
              padding: '16px 20px',
              borderTop: '1px solid var(--border)',
              background: 'var(--white)',
            }}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              style={{ display: 'flex', gap: '8px' }}
            >
              <input
                type="text"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                placeholder="Ask about clauses, payment terms, parties, or liability..."
                disabled={isSending}
                className="input"
                style={{ flex: 1, fontSize: '0.875rem' }}
              />
              <button
                type="submit"
                disabled={isSending || !inputQuestion.trim()}
                className="btn btn-primary"
                style={{ minWidth: '44px' }}
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </div>

        {/* Right Sidebar: Citation Inspector & Quick Questions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Citation Inspector */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '12px', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <BookOpen size={15} style={{ color: 'var(--text-secondary)' }} />
                <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Citation Inspector</h4>
              </div>
              {activeCitation && (
                <span className="badge badge-default">Page {activeCitation.pageNumber}</span>
              )}
            </div>

            {activeCitation ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {activeCitation.documentName || document?.originalName} · Page {activeCitation.pageNumber}
                </p>

                <div
                  style={{
                    padding: '12px',
                    background: 'var(--surface)',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    fontSize: '0.8125rem',
                    lineHeight: 1.6,
                    color: 'var(--text-primary)',
                    fontStyle: 'italic',
                  }}
                >
                  "{activeCitation.excerpt}"
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '4px' }}>
                  <Link
                    to={`/documents/${id}/ocr-preview?page=${activeCitation.pageNumber}`}
                    className="btn btn-secondary btn-sm"
                    style={{ justifyContent: 'center' }}
                  >
                    <span>View in OCR Preview</span>
                    <ExternalLink size={12} />
                  </Link>
                  <button
                    onClick={() => {
                      if (id) ApiService.openDocumentPage(id, activeCitation.pageNumber).catch((err) => alert(err.message));
                    }}
                    className="btn btn-ghost btn-sm"
                    style={{ justifyContent: 'center' }}
                  >
                    Open Original PDF Page
                  </button>
                </div>
              </div>
            ) : (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', textAlign: 'center', padding: '24px 0' }}>
                Click a page tag on any answer to view its verified source excerpt here.
              </p>
            )}
          </div>

          {/* Quick Questions */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '12px', paddingBottom: '10px' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 600 }}>Common Questions</h4>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {samplePrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(prompt)}
                  disabled={isSending}
                  className="btn btn-ghost"
                  style={{
                    textAlign: 'left',
                    justifyContent: 'flex-start',
                    fontSize: '0.8125rem',
                    padding: '8px 10px',
                    borderRadius: 'var(--radius)',
                    whiteSpace: 'normal',
                    lineHeight: 1.4,
                  }}
                >
                  <span style={{ color: 'var(--text-primary)' }}>{prompt}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Document Grounding Notice */}
          <div
            style={{
              padding: '14px',
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
              <Shield size={14} style={{ color: 'var(--text-secondary)' }} />
              <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>Verified Grounding</p>
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Explanations are strictly derived from extracted contract text. Always review critical clauses against the signed document.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
