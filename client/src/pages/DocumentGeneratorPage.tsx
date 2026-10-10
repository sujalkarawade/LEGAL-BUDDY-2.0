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
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin border-3 border-[#0a0a0a] border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-black uppercase tracking-wider text-[#0a0a0a]">
          Legal Document Generator
        </h1>
        <p className="text-xs font-mono text-[#666666] uppercase tracking-wide mt-1">
          Structured template drafting // Instant clause assembly // Export to Word (.docx)
        </p>
      </div>

      {/* Step Indicator */}
      <div className="border-[3px] border-[#0a0a0a] bg-white p-4 shadow-[4px_4px_0_#0a0a0a] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-6 overflow-x-auto pb-1 sm:pb-0">
          {[
            { step: 1, label: '1. Select Template' },
            { step: 2, label: '2. Contract Terms' },
            { step: 3, label: '3. Review Details' },
            { step: 4, label: '4. Preview & Export' },
          ].map((item) => {
            const isActive = currentStep === item.step;
            const isDone = currentStep > item.step;
            return (
              <button
                type="button"
                key={item.step}
                onClick={() => {
                  if (item.step < currentStep || (item.step === 3 && validateCurrentFields())) {
                    setCurrentStep(item.step);
                  }
                }}
                className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider cursor-pointer whitespace-nowrap transition-all ${
                  isActive
                    ? 'text-[#0a0a0a]'
                    : isDone
                    ? 'text-[#0a0a0a]'
                    : 'text-[#888888]'
                }`}
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center font-mono text-[11px] font-bold border-2 ${
                    isActive
                      ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white shadow-[2px_2px_0_#0a0a0a]'
                      : isDone
                      ? 'border-[#0a0a0a] bg-[#e0e0e0] text-[#0a0a0a]'
                      : 'border-[#d0d0d0] bg-[#f0f0f0] text-[#888888]'
                  }`}
                >
                  {isDone ? '✓' : item.step}
                </div>
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="text-xs font-mono text-[#666666] border-t sm:border-t-0 pt-2 sm:pt-0 border-[#e0e0e0]">
          Template: <span className="font-bold text-[#0a0a0a]">{selectedTemplate?.title || 'None Selected'}</span>
        </div>
      </div>

      {/* STEP 1: Template Selection Gallery */}
      {currentStep === 1 && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {templates.map((tpl) => {
              const isSelected = selectedTemplate?.id === tpl.id;
              return (
                <div
                  key={tpl.id}
                  onClick={() => handleTemplateSelect(tpl)}
                  className={`border-[3px] border-[#0a0a0a] bg-white p-5 shadow-[4px_4px_0_#0a0a0a] hover:shadow-[6px_6px_0_#0a0a0a] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected ? 'bg-[#f5f5f5] ring-2 ring-[#0a0a0a]' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="border border-[#0a0a0a] bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-[#0a0a0a]">
                        {tpl.category}
                      </span>
                      <FileText className="h-4 w-4 text-[#0a0a0a]" />
                    </div>
                    <h3 className="text-sm font-black uppercase tracking-wide text-[#0a0a0a]">{tpl.title}</h3>
                    <p className="text-xs text-[#555555] mt-2 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>

                  <div className="mt-5 pt-3 border-t-2 border-[#0a0a0a] flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#0a0a0a]">
                    <span>Configure Template</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 2: Input Form Wizard */}
      {currentStep === 2 && selectedTemplate && (
        <div className="border-[3px] border-[#0a0a0a] bg-white p-6 sm:p-8 shadow-[6px_6px_0_#0a0a0a] space-y-6">
          <div className="flex items-center justify-between pb-4 border-b-2 border-[#0a0a0a]">
            <div>
              <span className="border border-[#0a0a0a] bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-[#0a0a0a]">
                {selectedTemplate.category}
              </span>
              <h2 className="text-base font-black uppercase tracking-wide text-[#0a0a0a] mt-1.5">
                {selectedTemplate.title}
              </h2>
              <p className="text-xs font-mono text-[#666666] mt-0.5">
                Complete required contractual parameters and variable fields
              </p>
            </div>
            <button
              onClick={() => setCurrentStep(1)}
              className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Change Template
            </button>
          </div>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#0a0a0a] mb-1.5">
                Custom Document Title (Optional)
              </label>
              <input
                type="text"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                placeholder={`${selectedTemplate.title} - Final Executable Draft`}
                className="w-full border-2 border-[#0a0a0a] bg-[#f9f9f9] px-4 py-2.5 text-xs font-medium text-[#0a0a0a] placeholder-[#888888] focus:bg-white focus:shadow-[4px_4px_0_#0a0a0a] focus:outline-none transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {selectedTemplate.fields?.map((field) => (
                <div
                  key={field.name}
                  className={field.type === 'textarea' ? 'md:col-span-2' : ''}
                >
                  <label className="block text-xs font-bold uppercase tracking-wider text-[#0a0a0a] mb-1.5">
                    {field.label} {field.required && <span className="text-[#c0392b] font-bold">*</span>}
                  </label>

                  {field.type === 'textarea' ? (
                    <textarea
                      rows={3}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      className={`w-full border-2 bg-[#f9f9f9] px-4 py-2 text-xs font-medium text-[#0a0a0a] placeholder-[#888888] focus:bg-white focus:outline-none transition-all ${
                        formErrors[field.name]
                          ? 'border-[#c0392b] bg-[#fff5f5]'
                          : 'border-[#0a0a0a] focus:shadow-[4px_4px_0_#0a0a0a]'
                      }`}
                    />
                  ) : (
                    <input
                      type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                      value={formData[field.name] || ''}
                      onChange={(e) => handleInputChange(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      className={`w-full border-2 bg-[#f9f9f9] px-4 py-2.5 text-xs font-medium text-[#0a0a0a] placeholder-[#888888] focus:bg-white focus:outline-none transition-all ${
                        formErrors[field.name]
                          ? 'border-[#c0392b] bg-[#fff5f5]'
                          : 'border-[#0a0a0a] focus:shadow-[4px_4px_0_#0a0a0a]'
                      }`}
                    />
                  )}

                  {formErrors[field.name] && (
                    <p className="text-[11px] font-mono text-[#c0392b] font-bold mt-1">
                      ! {formErrors[field.name]}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t-2 border-[#0a0a0a] flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(1)}
              className="btn btn-secondary btn-sm text-xs font-bold uppercase tracking-wider"
            >
              Back
            </button>
            <button
              onClick={() => {
                if (validateCurrentFields()) {
                  setCurrentStep(3);
                }
              }}
              className="btn btn-primary btn-sm flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
            >
              <span>Review Details</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Review Details Before Assembly */}
      {currentStep === 3 && selectedTemplate && (
        <div className="border-[3px] border-[#0a0a0a] bg-white p-6 sm:p-8 shadow-[6px_6px_0_#0a0a0a] space-y-6">
          <div className="pb-4 border-b-2 border-[#0a0a0a]">
            <h2 className="text-base font-black uppercase tracking-wide text-[#0a0a0a]">
              Review Document Parameters
            </h2>
            <p className="text-xs font-mono text-[#666666] mt-0.5">
              Confirm all operational covenants before generating the draft document
            </p>
          </div>

          <div className="border-2 border-[#0a0a0a] bg-[#f9f9f9] p-5 shadow-[3px_3px_0_#0a0a0a] grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
            {selectedTemplate.fields?.map((field) => (
              <div key={field.name} className="space-y-1">
                <span className="text-[11px] text-[#666666] uppercase font-bold tracking-wider">
                  {field.label}:
                </span>
                <p className="font-bold text-[#0a0a0a] bg-white border border-[#0a0a0a] p-2">
                  {formData[field.name] ? String(formData[field.name]) : '[Not Provided]'}
                </p>
              </div>
            ))}
          </div>

          <div className="border-2 border-[#0a0a0a] bg-[#fffbe6] p-4 text-xs text-[#0a0a0a] shadow-[3px_3px_0_#0a0a0a] leading-relaxed">
            <p className="font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4" />
              Notice on Template Generation:
            </p>
            This document will be generated with standard commercial clauses and stamped as "DRAFT — REVIEW BEFORE USE". Consult qualified legal counsel before official execution.
          </div>

          <div className="pt-2 flex items-center justify-between">
            <button
              onClick={() => setCurrentStep(2)}
              className="btn btn-secondary btn-sm text-xs font-bold uppercase tracking-wider"
            >
              Modify Fields
            </button>
            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="btn btn-primary flex items-center gap-2 text-xs font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {isGenerating ? (
                <>
                  <div className="h-3.5 w-3.5 animate-spin border-2 border-white border-t-transparent"></div>
                  <span>Generating Contract...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  <span>Generate Editable Draft & DOCX</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* STEP 4: Live Editable Preview & Export Actions */}
      {currentStep === 4 && (
        <div className="space-y-6">
          {/* Action Ribbon */}
          <div className="border-[3px] border-[#0a0a0a] bg-white p-4 shadow-[4px_4px_0_#0a0a0a] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#0a0a0a]">
              <span className="flex h-5 w-5 items-center justify-center border-2 border-[#0a0a0a] bg-[#0a0a0a] text-white font-mono text-[11px]">
                ✓
              </span>
              <span>Draft Generated Successfully</span>
            </div>

            <div className="flex items-center flex-wrap gap-2">
              <button
                onClick={handleCopy}
                className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>{copySuccess ? 'Copied!' : 'Copy Text'}</span>
              </button>
              <button
                onClick={handlePrint}
                className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
              >
                <Printer className="h-3.5 w-3.5" />
                <span>Print / Save PDF</span>
              </button>
              {generatedResult && (
                <a
                  href={`/api/document-generator/${generatedResult.id}/download`}
                  className="btn btn-primary btn-sm flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download .DOCX</span>
                </a>
              )}
            </div>
          </div>

          {/* Draft Watermark Banner */}
          <div className="border-2 border-[#0a0a0a] bg-[#f0f0f0] p-3 text-center text-xs font-mono font-bold uppercase tracking-widest text-[#0a0a0a] shadow-[3px_3px_0_#0a0a0a]">
            [ DRAFT — REVIEW BEFORE USE. NOT LEGAL ADVICE. ]
          </div>

          {/* Editable Document Editor */}
          <div className="border-[3px] border-[#0a0a0a] bg-white p-6 sm:p-8 shadow-[6px_6px_0_#0a0a0a]">
            <textarea
              rows={24}
              value={editableContent}
              onChange={(e) => setEditableContent(e.target.value)}
              className="w-full bg-[#fcfcfc] border-2 border-[#0a0a0a] p-5 font-mono text-xs text-[#0a0a0a] leading-relaxed focus:outline-none focus:bg-white resize-y shadow-inner"
            />
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => {
                setCurrentStep(1);
                setFormData({});
                setGeneratedResult(null);
              }}
              className="btn btn-secondary btn-sm text-xs font-bold uppercase tracking-wider"
            >
              Draft another document →
            </button>
          </div>
        </div>
      )}

      {/* Generated Draft History */}
      {draftHistory.length > 0 && currentStep === 1 && (
        <div className="border-[3px] border-[#0a0a0a] bg-white p-5 shadow-[4px_4px_0_#0a0a0a] space-y-4">
          <div className="flex items-center justify-between pb-3 border-b-2 border-[#0a0a0a]">
            <h3 className="text-sm font-black uppercase tracking-wider text-[#0a0a0a]">
              Saved Drafts History
            </h3>
            <span className="font-mono text-xs text-[#666666]">
              {draftHistory.length} drafts archived
            </span>
          </div>

          <div className="divide-y-2 divide-[#0a0a0a] text-xs">
            {draftHistory.map((draft) => (
              <div key={draft.id} className="py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-bold uppercase tracking-wide text-[#0a0a0a]">{draft.title}</p>
                  <p className="font-mono text-[11px] text-[#666666] mt-0.5">
                    {draft.category} • Created {new Date(draft.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <a
                  href={`/api/document-generator/${draft.id}/download`}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider"
                >
                  <Download className="h-3 w-3" />
                  <span>DOCX</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
