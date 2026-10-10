// @ts-ignore
import * as docxModule from 'docx';
const docxAny = (docxModule as any).default || docxModule;
const {
  Document: DocxDocument,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} = docxAny;
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { GENERATED_DIR } from '../config/index.js';

export class DocxService {
  /**
   * Generates a clean, formatted .docx file from rendered contract text.
   */
  static async generateContractDocx(
    title: string,
    renderedContent: string
  ): Promise<{ filePath: string; fileName: string }> {
    const lines = renderedContent.split('\n');
    const docChildren: any[] = [];

    // Header notice / Disclaimer banner
    docChildren.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 240 },
        children: [
          new TextRun({
            text: 'LEGAL BUDDY — DRAFT AGREEMENT',
            bold: true,
            size: 20,
            color: '4338CA',
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 360 },
        children: [
          new TextRun({
            text: '[ NOTICE: DRAFT FOR REVIEW PURPOSES ONLY — NOT LEGAL ADVICE ]',
            italics: true,
            size: 18,
            color: '64748B',
          }),
        ],
      })
    );

    // Document Title
    docChildren.push(
      new Paragraph({
        text: title.toUpperCase(),
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 400 },
      })
    );

    // Body content processing
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        docChildren.push(new Paragraph({ spacing: { after: 120 } }));
        continue;
      }

      // Detect Headings (e.g., "1. PURPOSE" or "PARTIES:")
      if (/^(\d+\.|\bPARTIES\b|\bRECITALS\b|\bWITNESSETH\b)/i.test(trimmed)) {
        docChildren.push(
          new Paragraph({
            text: trimmed,
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 140 },
          })
        );
      } else if (trimmed.startsWith('•') || trimmed.startsWith('-')) {
        docChildren.push(
          new Paragraph({
            text: trimmed.replace(/^[•-]\s*/, ''),
            bullet: { level: 0 },
            spacing: { after: 100 },
          })
        );
      } else {
        docChildren.push(
          new Paragraph({
            children: [
              new TextRun({
                text: trimmed,
                size: 22, // 11pt
              }),
            ],
            spacing: { after: 140, line: 300 },
          })
        );
      }
    }

    const doc = new DocxDocument({
      sections: [
        {
          properties: {},
          children: docChildren,
        },
      ],
    });

    const randomSuffix = crypto.randomBytes(4).toString('hex');
    const sanitizedTitle = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const fileName = `${sanitizedTitle}_${Date.now()}_${randomSuffix}.docx`;
    const filePath = path.join(GENERATED_DIR, fileName);

    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(filePath, buffer);

    return { filePath, fileName };
  }
}
