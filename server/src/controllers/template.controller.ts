import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import prisma from '../prisma/client.js';
import { DocxService } from '../services/docx-service.js';
import { GENERATED_DIR } from '../config/index.js';

export class TemplateController {
  /**
   * Get all available legal document templates
   */
  static async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await prisma.documentTemplate.findMany({
        orderBy: { title: 'asc' },
      });

      const parsedTemplates = templates.map((t) => ({
        ...t,
        fields: JSON.parse(t.schemaJson),
      }));

      res.json({ templates: parsedTemplates });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve document templates.' });
    }
  }

  /**
   * Get template by ID
   */
  static async getTemplateById(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const template = await prisma.documentTemplate.findUnique({ where: { id } });

      if (!template) {
        res.status(404).json({ error: 'Template not found.' });
        return;
      }

      res.json({
        template: {
          ...template,
          fields: JSON.parse(template.schemaJson),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve template.' });
    }
  }

  /**
   * Generate draft document from form values
   */
  static async generateDocument(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { templateId, customTitle, formData } = req.body;

      if (!templateId || !formData) {
        res.status(400).json({ error: 'Template ID and form data are required.' });
        return;
      }

      const template = await prisma.documentTemplate.findUnique({ where: { id: templateId } });
      if (!template) {
        res.status(404).json({ error: 'Selected template not found.' });
        return;
      }

      const fields: Array<{ name: string; label: string; required: boolean }> = JSON.parse(template.schemaJson);

      // Validate required fields
      const missingFields: string[] = [];
      for (const f of fields) {
        if (f.required && (!formData[f.name] || String(formData[f.name]).trim() === '')) {
          missingFields.push(f.label);
        }
      }

      if (missingFields.length > 0) {
        res.status(400).json({
          error: `Missing required fields: ${missingFields.join(', ')}`,
        });
        return;
      }

      // Render template text
      let rendered = template.templateText;
      for (const [key, value] of Object.entries(formData)) {
        const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        rendered = rendered.replace(regex, String(value || ''));
      }

      // Clear any unresolved placeholders
      rendered = rendered.replace(/\{\{[a-zA-Z0-9_]+\}\}/g, '[UNSPECIFIED]');

      const title = customTitle || `${template.title} Draft`;

      // Generate DOCX file
      const { fileName } = await DocxService.generateContractDocx(title, rendered);

      // Save record in database
      const savedDoc = await prisma.generatedDocument.create({
        data: {
          userId,
          templateId: template.id,
          title,
          category: template.category,
          inputDataJson: JSON.stringify(formData),
          renderedContent: rendered,
          docxFileName: fileName,
        },
      });

      res.status(201).json({
        message: 'Draft document generated successfully.',
        generatedDocument: savedDoc,
      });
    } catch (error: any) {
      console.error('Document generation error:', error);
      res.status(500).json({ error: 'Failed to generate draft document.' });
    }
  }

  /**
   * Get user generated document drafts history
   */
  static async getHistory(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const docs = await prisma.generatedDocument.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ generatedDocuments: docs });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to retrieve generated drafts.' });
    }
  }

  /**
   * Download DOCX file
   */
  static async downloadDocx(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const doc = await prisma.generatedDocument.findUnique({ where: { id } });
      if (!doc || doc.userId !== userId) {
        res.status(404).json({ error: 'Document not found or access denied.' });
        return;
      }

      if (!doc.docxFileName) {
        res.status(404).json({ error: 'DOCX file not available for this draft.' });
        return;
      }

      const filePath = path.join(GENERATED_DIR, doc.docxFileName);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'File does not exist on server storage.' });
        return;
      }

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${doc.title.replace(/[^a-z0-9]/gi, '_')}.docx"`);
      fs.createReadStream(filePath).pipe(res);
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to download DOCX.' });
    }
  }
}
