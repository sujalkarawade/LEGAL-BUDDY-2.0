import React, { useState, useEffect } from 'react';
import {
  FileCode2,
  CheckCircle,
  Download,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  FileText,
  AlertCircle,
  Copy,
  Printer,
  Calendar,
  Building,
  Shield,
  Layers,
  Check,
} from 'lucide-react';
import ApiService from '../services/api.js';
import { DocumentTemplate, GeneratedDocument } from '../types/index.js';

export const DocumentGeneratorPage: React.FC = () => {
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [draftHistory, setDraftHistory] = useState<GeneratedDocument[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplate | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [customTitle, setCustomTitle] = useState('');
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<GeneratedDocument | null>(null);
  const [editableContent, setEditableContent] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    try {
      const [tplRes, histRes] = await Promise.all([
        ApiService.getTemplates(),
        ApiService.getGeneratedDrafts(),
      ]);
      setTemplates(tplRes.templates);
      setDraftHistory(histRes.generatedDocuments);
      if (tplRes.templates.length > 0 && !selectedTemplate) {
        setSelectedTemplate(tplRes.templates[0]);
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleTemplateSelect = (tpl: DocumentTemplate) => {
    setSelectedTemplate(tpl);
    setFormData({});
    setFormErrors({});
    setGeneratedResult(null);
    setCurrentStep(2);
  };

  const handleInputChange = (fieldName: string, value: any) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    if (formErrors[fieldName]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[fieldName];
        return next;
      });
    }
  };

  const validateCurrentFields = (): boolean => {
    if (!selectedTemplate || !selectedTemplate.fields) return true;
    const errors: Record<string, string> = {};

    for (const field of selectedTemplate.fields) {
      if (field.required && (!formData[field.name] || String(formData[field.name]).trim() === '')) {
        errors[field.name] = `${field.label} is required.`;
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleGenerate = async () => {
    if (!selectedTemplate) return;
    if (!validateCurrentFields()) return;

    setIsGenerating(true);
    try {
      const res = await ApiService.generateDocument({
        templateId: selectedTemplate.id,
        customTitle: customTitle || `${selectedTemplate.title} Draft`,
        formData,
      });

      setGeneratedResult(res.generatedDocument);
      setEditableContent(res.generatedDocument.renderedContent);
      setCurrentStep(4);
      fetchData();
    } catch (err: any) {
      alert(`Generation failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(editableContent);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '320px' }}>
        <div className="spinner" />
      </div>
    );
  }

  const steps = [
    { step: 1, label: 'Select Template' },
    { step: 2, label: 'Fill Details' },
    { step: 3, label: 'Review' },
    { step: 4, label: 'Export' },
  ];

  return (
    <div style={{ width: '100%', margin: '0' }} className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-text">
          <h1>Document Generator</h1>
          <p>Standardized commercial contract drafting and .docx export</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div
        className="card"
        style={{
          padding: '12px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {steps.map((item, idx) => {
            const isActive = currentStep === item.step;
            const isDone = currentStep > item.step;
            return (
              <React.Fragment key={item.step}>
                <button
                  type="button"
                  onClick={() => {
                    if (item.step < currentStep || (item.step === 3 && validateCurrentFields())) {
                      setCurrentStep(item.step);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: 'none',
                    border: 'none',
                    cursor: item.step <= currentStep ? 'pointer' : 'default',
                    color: isActive ? 'var(--text-primary)' : isDone ? 'var(--text-secondary)' : 'var(--text-muted)',
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.8125rem',
                  }}
                >
                  <span
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: isActive ? 'var(--black)' : isDone ? 'var(--surface-alt)' : 'var(--surface)',
                      color: isActive ? 'var(--white)' : isDone ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: isDone ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    {isDone ? <Check size={12} /> : item.step}
                  </span>
                  <span>{item.label}</span>
                </button>
                {idx < steps.length - 1 && (
                  <span style={{ color: 'var(--border-strong)', fontSize: '0.75rem' }}>/</span>
                )}
              </React.Fragment>
            );
          })}
        </div>

        {selectedTemplate && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            Selected: <strong style={{ color: 'var(--text-primary)' }}>{selectedTemplate.title}</strong>
          </span>
        )}
      </div>

      {/* STEP 1: Template Selection Gallery */}
      {currentStep === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {templates.map((tpl) => {
              const isSelected = selectedTemplate?.id === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => handleTemplateSelect(tpl)}
                  className="card"
                  style={{
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    borderColor: isSelected ? 'var(--black)' : 'var(--border)',
                    boxShadow: isSelected ? '0 0 0 1px var(--black)' : 'none',
                    transition: 'border-color var(--transition)',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <span className="badge badge-default">{tpl.category}</span>
                      <FileText size={16} style={{ color: 'var(--text-muted)' }} />
                    </div>
                    <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, marginBottom: '6px' }}>{tpl.title}</h3>
                    <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      {tpl.description}
                    </p>
                  </div>

                  <div
                    style={{
                      marginTop: '20px',
                      paddingTop: '12px',
                      borderTop: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: 'var(--text-primary)',
                    }}
                  >
                    <span>Use this template</span>
                    <ArrowRight size={14} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Draft History */}
          {draftHistory.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div>
                  <h3 style={{ fontSize: '0.9375rem' }}>Previous Drafts</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {draftHistory.length} documents generated previously
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {draftHistory.map((draft) => (
                  <div
                    key={draft.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{draft.title}</p>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {draft.category} · {new Date(draft.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <a
                      href={`/api/document-generator/${draft.id}/download`}
                      className="btn btn-secondary btn-sm"
                    >
                      <Download size={13} />
                      <span>Download .DOCX</span>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* STEP 2: Input Form */}
      {currentStep === 2 && selectedTemplate && (
        <div className="card" style={{ padding: '28px' }}>
          <div className="card-header" style={{ marginBottom: '20px', paddingBottom: '14px' }}>
            <div>
              <span className="badge badge-default" style={{ marginBottom: '6px' }}>{selectedTemplate.category}</span>
              <h2 style={{ fontSize: '1.125rem' }}>{selectedTemplate.title}</h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Fill in the required fields to assemble this agreement
              </p>
            </div>
            <button onClick={() => setCurrentStep(1)} className="btn btn-secondary btn-sm">
              <ArrowLeft size={13} />
              <span>Change Template</span>
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                Custom Document Title (Optional)
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={`${selectedTemplate.title} - Draft`}
                className="input"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
              {selectedTemplate.fields?.map((field) => (
                <div
                  key={field.name}
                  style={field.type === 'textarea' ? { gridColumn: '1 / -1' } : {}}
                >
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '6px' }}>
                    {field.label} {field.required && <span style={{ color: 'var(--danger)' }}>*</span>}
                  </label>

                  {field.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      className="textarea"
                      style={formErrors[field.name] ? { borderColor: 'var(--danger)' } : {}}
                    />
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      className="input"
                      style={formErrors[field.name] ? { borderColor: 'var(--danger)' } : {}}
                    />
                  )}

                  {formErrors[field.name] && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: '4px', fontWeight: 500 }}>
                      {formErrors[field.name]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              marginTop: '28px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <button onClick={() => setCurrentStep(1)} className="btn btn-secondary btn-sm">
              Back
            </button>
            <button
              onClick={() => {
                if (validateCurrentFields()) {
                  setCurrentStep(3);
                }
              }}
              className="btn btn-primary"
            >
              <span>Review Details</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Review Details */}
      {currentStep === 3 && selectedTemplate && (
        <div className="card" style={{ padding: '28px' }}>
          <div className="card-header" style={{ marginBottom: '20px', paddingBottom: '14px' }}>
            <div>
              <h2 style={{ fontSize: '1.125rem' }}>Review Document Parameters</h2>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Verify all contractual terms before assembling the draft
              </p>
            </div>
          </div>

          <div
            style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border)',
              padding: '16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '14px',
              marginBottom: '20px',
            }}
          >
            {selectedTemplate.fields?.map((field) => (
              <div key={field.name}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  {field.label}:
                </span>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
                  {formData[field.name] ? String(formData[field.name]) : '—'}
                </p>
              </div>
            ))}
          </div>

          <div className="alert alert-warning" style={{ marginBottom: '24px' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 600 }}>Standard Draft Notice</p>
              <p style={{ fontSize: '0.8125rem', marginTop: '2px' }}>
                This draft will be generated with standard commercial clauses. Review all clauses with qualified counsel prior to formal execution.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <button onClick={() => setCurrentStep(2)} className="btn btn-secondary">
              Modify Fields
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="btn btn-primary"
            >
              {isGenerating ? (
                <>
                  <div className="spinner" style={{ width: '14px', height: '14px', borderWidth: '2px', borderColor: '#fff', borderTopColor: 'transparent' }} />
                  <span>Generating Contract…</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>Generate Contract Draft</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Live Preview & Export */}
      {currentStep === 4 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Action Ribbon */}
          <div
            className="card"
            style={{
              padding: '14px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  background: 'var(--success)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={14} />
              </div>
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Draft Ready</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={handleCopy} className="btn btn-secondary btn-sm">
                <Copy size={13} />
                <span>{copySuccess ? 'Copied!' : 'Copy Text'}</span>
              </button>
              <button onClick={handlePrint} className="btn btn-secondary btn-sm">
                <Printer size={13} />
                <span>Print / Save PDF</span>
              </button>
              {generatedResult && (
                <a
                  href={`/api/document-generator/${generatedResult.id}/download`}
                  className="btn btn-primary btn-sm"
                >
                  <Download size={13} />
                  <span>Download .DOCX</span>
                </a>
              )}
            </div>
          </div>

          {/* Textarea Paper */}
          <div className="card" style={{ padding: '20px' }}>
            <textarea
              rows={24}
              value={editableContent}
              onChange={(e) => setEditableContent(e.target.value)}
              className="textarea"
              style={{
                width: '100%',
                fontFamily: 'monospace',
                fontSize: '0.8125rem',
                lineHeight: 1.7,
                padding: '16px',
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                resize: 'vertical',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={() => {
                setCurrentStep(1);
                setFormData({});
                setGeneratedResult(null);
              }}
              className="btn btn-secondary btn-sm"
            >
              Draft Another Document →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
