import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  MessageSquareQuote,
  Send,
  Trash2,
  Sparkles,
  Shield,
  FileText,
  User,
  Bot,
  Info,
  ChevronRight,
  ExternalLink,
  BookOpen,
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
  const [activeCitation, setActiveCitation] = useState<ChatCitation | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchChat = async () => {
    if (!id) return;
    try {
      const [docRes, chatRes] = await Promise.all([
        ApiService.getDocumentById(id),
        ApiService.getChat(id),
      ]);
      setDocument(docRes.document);
      setMessages(chatRes.conversation.messages || []);
    } catch (err) {
      console.error('Failed to load chat session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChat();
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (questionText?: string) => {
    const q = questionText || inputQuestion;
    if (!q.trim() || !id || isSending) return;

    setInputQuestion('');
    setIsSending(true);

    // Optimistic user message
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
      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, res.message]);
    } catch (err: any) {
      alert(`Chat error: ${err.message}`);
    } finally {
      setIsSending(false);
    }
  };

  const handleClearChat = async () => {
    if (!id) return;
    if (!confirm('Clear this chat conversation?')) return;

    try {
      await ApiService.clearChat(id);
      setMessages([]);
      setActiveCitation(null);
    } catch (err: any) {
      alert(`Failed to reset chat: ${err.message}`);
    }
  };

  const samplePrompts = [
    'What payment terms and invoices are specified?',
    'What is the required notice period for termination?',
    'Are there limitation of liability caps in this contract?',
    'Does the agreement contain automatic renewal?',
    'What important contract details could not be found?',
  ];

  const parseCitations = (citationsStr?: string | null): ChatCitation[] => {
    if (!citationsStr) return [];
    try {
      return JSON.parse(citationsStr);
    } catch (e) {
      return [];
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fadeUp">
      <DocumentNavHeader document={document} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chat Interface (2 cols) */}
        <div className="lg:col-span-2 border-[3px] border-[#0a0a0a] bg-white shadow-[6px_6px_0_#0a0a0a] flex flex-col h-[650px] overflow-hidden">
          {/* Chat Header */}
          <div className="flex items-center justify-between p-4 border-b-[3px] border-[#0a0a0a] bg-[#0a0a0a] text-white">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center border-2 border-white bg-[#0a0a0a] text-white font-mono font-black text-xs">
                AI
              </div>
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-white flex items-center gap-2">
                  Legal Buddy Assistant
                  <span className="border border-white/60 px-1.5 py-0.2 text-[9px] font-black uppercase font-mono">
                    Grounded RAG
                  </span>
                  <span className="border border-[#27ae60] bg-[#27ae60]/20 text-[#2ecc71] px-1.5 py-0.2 text-[9px] font-black uppercase font-mono">
                    Neural AI (Llama 3.3 70B)
                  </span>
                </h3>
                <p className="text-[10px] text-white/60 font-mono font-semibold uppercase">
                  Strictly grounded in {document?.originalName || 'this agreement'}
                </p>
              </div>
            </div>

            <button
              onClick={handleClearChat}
              disabled={messages.length === 0}
              className="btn btn-sm bg-white text-[#c0392b] border-2 border-[#0a0a0a] hover:bg-[#c0392b] hover:text-white"
              title="Clear Chat History"
            >
              <Trash2 className="h-3 w-3" />
              <span>Reset</span>
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#f9f9f9]">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                <div className="border-[3px] border-[#0a0a0a] bg-white p-4 shadow-[4px_4px_0_#0a0a0a]">
                  <MessageSquareQuote className="h-8 w-8 text-[#0a0a0a]" />
                </div>
                <div>
                  <h4 className="text-sm font-black uppercase tracking-wider text-[#0a0a0a]">Ask questions about this contract</h4>
                  <p className="text-xs text-gray-600 mt-1 max-w-sm leading-relaxed font-medium">
                    Legal Buddy will extract operative clauses, cite exact source pages, and flag any provisions not present in the document.
                  </p>
                </div>

                <div className="w-full max-w-md pt-2 space-y-2">
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 font-mono text-left">
                    Suggested Inquiries:
                  </p>
                  {samplePrompts.slice(0, 3).map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt)}
                      className="w-full text-left border-2 border-gray-300 bg-white hover:border-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white p-2.5 text-xs font-bold transition-all flex items-center justify-between group shadow-sm"
                    >
                      <span className="truncate">{prompt}</span>
                      <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-white shrink-0 ml-2" />
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
                    className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'} animate-fadeUp`}
                  >
                    {!isUser && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-[#0a0a0a] bg-white text-[#0a0a0a] font-mono font-black text-[10px] mt-0.5">
                        AI
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] p-4 text-xs leading-relaxed border-2 border-[#0a0a0a] ${
                        isUser
                          ? 'bg-[#0a0a0a] text-white shadow-[3px_3px_0_#666]'
                          : 'bg-white text-[#0a0a0a] shadow-[4px_4px_0_#0a0a0a]'
                      }`}
                    >
                      <div className="whitespace-pre-wrap font-medium">{msg.content}</div>

                      {/* Attached Citations */}
                      {!isUser && citations.length > 0 && (
                        <div className="mt-3 pt-3 border-t-2 border-[#0a0a0a] space-y-2">
                          <p className="text-[10px] font-black uppercase text-gray-500 font-mono flex items-center gap-1.5">
                            <BookOpen className="h-3 w-3 text-[#0a0a0a]" />
                            <span>Supporting Evidence Citations:</span>
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {citations.map((cite, cIdx) => (
                              <button
                                key={cIdx}
                                onClick={() => setActiveCitation(cite)}
                                className="flex items-center gap-1.5 border border-[#0a0a0a] bg-[#f0f0f0] hover:bg-[#0a0a0a] hover:text-white px-2 py-0.5 text-[10px] font-black font-mono uppercase transition-colors cursor-pointer"
                              >
                                <span>PAGE {cite.pageNumber}</span>
                                <span className="opacity-70">
                                  ({Math.round(cite.score * 100)}% MATCH)
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {isUser && (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center border-2 border-[#0a0a0a] bg-[#0a0a0a] text-white font-mono font-black text-[10px] mt-0.5">
                        ME
                      </div>
                    )}
                  </div>
                );
              })
            )}

            {isSending && (
              <div className="flex items-center gap-3 animate-fadeUp">
                <div className="flex h-7 w-7 items-center justify-center border-2 border-[#0a0a0a] bg-white text-[#0a0a0a] font-mono font-black text-[10px]">
                  AI
                </div>
                <div className="border-2 border-[#0a0a0a] bg-white p-3 flex items-center gap-2 text-xs font-mono font-bold text-[#0a0a0a] shadow-[3px_3px_0_#0a0a0a]">
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0a0a0a] border-t-transparent"></div>
                  <span>Searching document chunks and formulating answer...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Bar */}
          <div className="p-4 border-t-[3px] border-[#0a0a0a] bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center border-2 border-[#0a0a0a] focus-within:shadow-[4px_4px_0_#0a0a0a] transition-all bg-white"
            >
              <input
                type="text"
                value={inputQuestion}
                onChange={(e) => setInputQuestion(e.target.value)}
                placeholder="Ask any question about this contract's clauses or obligations..."
                disabled={isSending}
                className="flex-1 px-4 py-3 text-xs font-medium text-[#0a0a0a] placeholder-gray-400 focus:outline-none bg-white"
              />
              <button
                type="submit"
                disabled={isSending || !inputQuestion.trim()}
                className="flex items-center justify-center h-10 px-4 bg-[#0a0a0a] text-white border-l-2 border-[#0a0a0a] hover:bg-[#222] disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Sidebar: Citation Inspector & Safeguard Info (1 col) */}
        <div className="space-y-4">
          {/* Selected Citation Inspector Drawer */}
          <div className="border-2 border-[#0a0a0a] bg-white p-5 shadow-[4px_4px_0_#0a0a0a] space-y-3">
            <div className="flex items-center justify-between pb-3 border-b-2 border-[#0a0a0a]">
              <div className="flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-[#0a0a0a]" />
                <h4 className="text-xs font-black uppercase tracking-wider text-[#0a0a0a]">Citation Inspector</h4>
              </div>
              {activeCitation && (
                <span className="border border-[#0a0a0a] bg-[#0a0a0a] px-1.5 py-0.5 text-[9px] font-black uppercase text-white font-mono">
                  PAGE {activeCitation.pageNumber}
                </span>
              )}
            </div>

            {activeCitation ? (
              <div className="space-y-3 text-xs animate-fadeUp">
                <p className="text-[10px] text-gray-500 uppercase font-black font-mono">
                  Retrieved Passage Evidence:
                </p>
                <div className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-3 font-mono text-[11px] text-[#0a0a0a] leading-relaxed">
                  "{activeCitation.excerpt}"
                </div>
                <p className="text-[10px] font-mono font-bold text-gray-600 uppercase">
                  Relevance Match: {Math.round(activeCitation.score * 100)}%
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 py-6 text-center leading-relaxed font-medium">
                Click any citation tag below an assistant answer to inspect the exact verbatim excerpt and page index.
              </p>
            )}
          </div>

          {/* Quick Prompts Drawer */}
          <div className="border-2 border-[#0a0a0a] bg-white p-5 shadow-[4px_4px_0_#0a0a0a] space-y-2.5">
            <h4 className="text-xs font-black uppercase tracking-wider text-[#0a0a0a] mb-3">Common Legal Questions</h4>
            {samplePrompts.map((prompt, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(prompt)}
                disabled={isSending}
                className="w-full text-left border-2 border-gray-200 bg-white hover:border-[#0a0a0a] hover:bg-[#0a0a0a] hover:text-white p-2 text-[11px] font-bold transition-all truncate block cursor-pointer"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Safeguard & Out-of-Document Disclaimer */}
          <div className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-4 text-[11px] text-gray-700 space-y-1.5 shadow-[2px_2px_0_#0a0a0a]">
            <div className="flex items-center gap-1.5 font-black uppercase text-[#0a0a0a]">
              <Shield className="h-4 w-4 text-[#0a0a0a]" />
              <span>Document-Grounded Assurance</span>
            </div>
            <p className="leading-relaxed font-medium">
              Legal Buddy does not hallucinate contract provisions. If an inquiry cannot be substantiated by the uploaded text, the assistant explicitly states that the clause was not found.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
