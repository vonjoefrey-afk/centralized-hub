import React, { useState, useRef } from 'react';
import { logger } from '../../../utils/logger';

import { CloudArrowUpIcon, CheckCircleIcon, ArrowPathIcon, ExclamationCircleIcon, SparklesIcon } from '@heroicons/react/24/outline';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase/config';
import { Modal } from '../../ui';
import { showError, showSuccess } from '../../../utils/toast';

const TemplateImportButton = ({ onImportSuccess }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [extractedTemplates, setExtractedTemplates] = useState([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showImportOptions, setShowImportOptions] = useState(false);
  const [googleUrl, setGoogleUrl] = useState('');
  
  const fileInputRef = useRef(null);
  
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check file size (limit to 5MB to avoid payload issues)
    if (file.size > 5 * 1024 * 1024) {
      showError("File is too large. Please upload a file smaller than 5MB.");
      e.target.value = '';
      return;
    }
    
    setIsAnalyzing(true);
    
    try {
      const base64Data = await convertFileToBase64(file);
      
      const extractTemplatesFromFile = httpsCallable(functions, 'extractTemplatesFromFile');
      
      const result = await extractTemplatesFromFile({
        fileData: base64Data,
        mimeType: file.type || getMimeTypeFromExt(file.name),
        fileName: file.name
      });
      
      if (result.data.success && result.data.templates) {
        // Add selected state to each template
        const templatesWithSelection = result.data.templates.map((t, idx) => ({
          ...t,
          id: `ai-temp-${idx}`,
          selected: true
        }));
        
        setExtractedTemplates(templatesWithSelection);
        setShowValidationModal(true);
      } else {
        throw new Error("Invalid response from AI");
      }
    } catch (err) {
      logger.error("AI Extraction Error:", err);
      showError("Failed to extract templates. Please try again or check file format.");
    } finally {
      setIsAnalyzing(false);
      setShowImportOptions(false); // Close the options modal
      // Reset input so the same file can be selected again
      e.target.value = '';
    }
  };

  const handleGoogleUrlSubmit = async (e) => {
    e.preventDefault();
    if (!googleUrl.trim()) return;

    setIsAnalyzing(true);
    
    try {
      const extractTemplatesFromFile = httpsCallable(functions, 'extractTemplatesFromFile');
      
      const result = await extractTemplatesFromFile({
        googleUrl: googleUrl.trim()
      });
      
      if (result.data.success && result.data.templates) {
        const templatesWithSelection = result.data.templates.map((t, idx) => ({
          ...t,
          id: `ai-temp-${idx}`,
          selected: true
        }));
        
        setExtractedTemplates(templatesWithSelection);
        setShowValidationModal(true);
      } else {
        throw new Error("Invalid response from AI");
      }
    } catch (err) {
      logger.error("AI Extraction Error from URL:", err);
      const msg = err.message || "Failed to extract templates. Please try again.";
      showError(msg);
    } finally {
      setIsAnalyzing(false);
      setShowImportOptions(false);
      setGoogleUrl('');
    }
  };


  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });
  };

  const getMimeTypeFromExt = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
      case 'csv': return 'text/csv';
      case 'txt': return 'text/plain';
      case 'pdf': return 'application/pdf';
      case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      case 'xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      case 'xls': return 'application/vnd.ms-excel';
      default: return 'text/plain';
    }
  };

  const toggleSelection = (id) => {
    setExtractedTemplates(prev => prev.map(t => 
      t.id === id ? { ...t, selected: !t.selected } : t
    ));
  };

  const handleTemplateChange = (id, field, value) => {
    setExtractedTemplates(prev => prev.map(t => 
      t.id === id ? { ...t, [field]: value } : t
    ));
  };

  const handleImportSelected = async () => {
    const selectedTemplates = extractedTemplates.filter(t => t.selected);
    if (selectedTemplates.length === 0) {
      showError("Please select at least one template to import.");
      return;
    }

    setIsImporting(true);
    try {
      await onImportSuccess(selectedTemplates);
      showSuccess(`Successfully imported ${selectedTemplates.length} templates!`);
      setShowValidationModal(false);
    } catch (err) {
      logger.error("Import Error:", err);
      showError("Failed to import templates.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowImportOptions(true)}
        disabled={isAnalyzing}
        className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
          isAnalyzing 
            ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed' 
            : 'bg-indigo-50/50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 active:scale-[0.97]'
        }`}
        title="Import templates using AI"
      >
        {isAnalyzing ? (
          <ArrowPathIcon className="w-4 h-4 animate-spin" />
        ) : (
          <SparklesIcon className="w-4 h-4" />
        )}
        <span className="hidden sm:inline">{isAnalyzing ? 'Analyzing...' : 'AI Import'}</span>
      </button>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        accept=".csv,.txt,.pdf,.docx,.xlsx,.xls"
      />

      {showImportOptions && (
        <Modal isOpen={true} onClose={() => setShowImportOptions(false)} size="md">
          <Modal.Header onClose={() => setShowImportOptions(false)}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
                <CloudArrowUpIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <Modal.Title>Import Templates</Modal.Title>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-normal mt-0.5">
                  Choose how you want to import your templates
                </p>
              </div>
            </div>
          </Modal.Header>
          <Modal.Body className="space-y-6">
            
            {/* Option 1: File Upload */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Option 1: Upload File</h4>
              <p className="text-xs text-gray-500 mb-3">Accepts .csv, .txt, .pdf, .docx, .xlsx</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors"
              >
                <CloudArrowUpIcon className="w-5 h-5" />
                Select File to Upload
              </button>
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center" aria-hidden="true">
                <div className="w-full border-t border-gray-200 dark:border-white/10" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white dark:bg-[#1a1a1a] px-2 text-xs text-gray-500">OR</span>
              </div>
            </div>

            {/* Option 2: Google URL */}
            <div>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Option 2: Google Doc or Sheet</h4>
              <p className="text-xs text-gray-500 mb-3">Paste a public link (Must be "Anyone with the link can view")</p>
              <form onSubmit={handleGoogleUrlSubmit} className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://docs.google.com/..."
                  value={googleUrl}
                  onChange={(e) => setGoogleUrl(e.target.value)}
                  className="flex-1 px-3 py-2 bg-gray-50/60 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50"
                  required
                />
                <button
                  type="submit"
                  disabled={!googleUrl.trim() || isAnalyzing}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  Analyze
                </button>
              </form>
            </div>
            
          </Modal.Body>
        </Modal>
      )}

      {showValidationModal && (
        <Modal isOpen={true} onClose={() => !isImporting && setShowValidationModal(false)} size="4xl">
          <Modal.Header onClose={() => !isImporting && setShowValidationModal(false)}>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-500/20 rounded-lg">
                <SparklesIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <Modal.Title>Review Extracted Templates</Modal.Title>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-normal mt-0.5">
                  AI found {extractedTemplates.length} potential template{extractedTemplates.length !== 1 ? 's' : ''}. Select and edit the ones you want to keep.
                </p>
              </div>
            </div>
          </Modal.Header>
          <Modal.Body className="max-h-[60vh] overflow-y-auto bg-gray-50/50 dark:bg-[#0a0a0a] p-0">
            {extractedTemplates.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-10 text-center">
                <ExclamationCircleIcon className="w-12 h-12 text-gray-400 mb-3" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">No templates found</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm">
                  The AI couldn't identify any clear templates in the uploaded file. Please try a different file.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-white/5">
                {extractedTemplates.map((template, idx) => (
                  <div 
                    key={template.id} 
                    className={`p-5 flex gap-4 transition-colors ${template.selected ? 'bg-white dark:bg-[#141414]' : 'bg-gray-50/80 dark:bg-white/[0.02] opacity-60'}`}
                  >
                    <div className="pt-1 shrink-0">
                      <input 
                        type="checkbox" 
                        checked={template.selected} 
                        onChange={() => toggleSelection(template.id)}
                        className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 cursor-pointer"
                      />
                    </div>
                    <div className="flex-1 space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Title</label>
                        <input
                          type="text"
                          value={template.title}
                          onChange={(e) => handleTemplateChange(template.id, 'title', e.target.value)}
                          disabled={!template.selected}
                          className="w-full px-3 py-2 bg-transparent border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 disabled:cursor-not-allowed"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Content</label>
                        <textarea
                          rows={3}
                          value={template.description}
                          onChange={(e) => handleTemplateChange(template.id, 'description', e.target.value)}
                          disabled={!template.selected}
                          className="w-full px-3 py-2 bg-transparent border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 resize-y disabled:cursor-not-allowed"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <div className="flex items-center justify-between w-full">
              <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                {extractedTemplates.filter(t => t.selected).length} selected
              </span>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={isImporting}
                  onClick={() => setShowValidationModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isImporting || extractedTemplates.filter(t => t.selected).length === 0}
                  onClick={handleImportSelected}
                  className="flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-purple-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isImporting ? (
                    <><ArrowPathIcon className="w-4 h-4 animate-spin" /> Importing...</>
                  ) : (
                    <><CheckCircleIcon className="w-4 h-4" /> Import Selected</>
                  )}
                </button>
              </div>
            </div>
          </Modal.Footer>
        </Modal>
      )}
    </>
  );
};

export default TemplateImportButton;
