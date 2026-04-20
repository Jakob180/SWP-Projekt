import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FileImportResponse } from '../../models/api.models';
import { UploadComponent } from '../../components/upload/upload.component';

interface StoredDocument {
  addedAt: string;
  name: string;
  size: number;
  type: string;
}

@Component({
  selector: 'app-imports-page',
  standalone: true,
  imports: [CommonModule, RouterLink, UploadComponent],
  templateUrl: './imports-page.component.html',
  styleUrl: './imports-page.component.css'
})
export class ImportsPageComponent {
  private static readonly DOCUMENTS_STORAGE_KEY = 'finance_dashboard_documents';

  selectedDocuments: File[] = [];
  documents: StoredDocument[] = [];
  documentMessage = '';

  constructor(private readonly router: Router) {
    this.loadStoredDocuments();
  }

  onBankImportFinished(response: FileImportResponse): void {
    if (response.importedFrom && response.importedTo) {
      this.documentMessage = `${response.importedTransactions} Transaktionen importiert (${response.importedFrom} bis ${response.importedTo}).`;
      void this.router.navigate(['/dashboard'], {
        queryParams: {
          from: response.importedFrom,
          to: response.importedTo,
          imported: 'true'
        }
      });
      return;
    }

    this.documentMessage = `${response.importedTransactions} Transaktionen importiert.`;
    void this.router.navigate(['/dashboard'], {
      queryParams: { imported: 'true' }
    });
  }

  onDocumentsSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    this.selectedDocuments = files;
    this.documentMessage = '';
  }

  saveDocumentsLocally(): void {
    if (this.selectedDocuments.length === 0) {
      this.documentMessage = 'Bitte zuerst Dokumente auswaehlen.';
      return;
    }

    const now = new Date().toISOString();
    const newDocuments = this.selectedDocuments.map((file) => ({
      addedAt: now,
      name: file.name,
      size: file.size,
      type: file.type || 'application/octet-stream'
    }));

    this.documents = [...newDocuments, ...this.documents].slice(0, 80);
    this.persistDocuments();
    this.documentMessage = `${newDocuments.length} Dokument(e) lokal gespeichert.`;
    this.selectedDocuments = [];
  }

  removeDocument(index: number): void {
    if (index < 0 || index >= this.documents.length) {
      return;
    }

    this.documents = this.documents.filter((_, currentIndex) => currentIndex !== index);
    this.persistDocuments();
  }

  formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  private loadStoredDocuments(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const raw = localStorage.getItem(ImportsPageComponent.DOCUMENTS_STORAGE_KEY);
    if (!raw) {
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.documents = parsed.filter((item) =>
          item && typeof item.name === 'string' && typeof item.size === 'number'
        );
      }
    } catch {
      this.documents = [];
    }
  }

  private persistDocuments(): void {
    if (typeof window === 'undefined') {
      return;
    }

    localStorage.setItem(ImportsPageComponent.DOCUMENTS_STORAGE_KEY, JSON.stringify(this.documents));
  }
}
