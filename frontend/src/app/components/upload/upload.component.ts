import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output } from '@angular/core';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-upload',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './upload.component.html',
  styleUrl: './upload.component.css'
})
export class UploadComponent {
  @Output() importFinished = new EventEmitter<void>();

  selectedFile: File | null = null;
  isUploading = false;
  successMessage = '';
  errorMessage = '';

  constructor(private readonly apiService: ApiService) {}

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.selectedFile = input.files && input.files.length > 0 ? input.files[0] : null;
    this.successMessage = '';
    this.errorMessage = '';
  }

  upload(): void {
    if (!this.selectedFile) {
      this.errorMessage = 'Bitte zuerst eine CSV- oder JSON-Datei auswaehlen.';
      return;
    }

    this.isUploading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.apiService.uploadTransactions(this.selectedFile).subscribe({
      next: (response) => {
        this.isUploading = false;
        this.successMessage = `${response.importedTransactions} Transaktionen importiert.`;
        this.selectedFile = null;
        this.importFinished.emit();
      },
      error: (error) => {
        this.isUploading = false;
        this.errorMessage = error?.error?.message ?? 'Import fehlgeschlagen. Bitte Dateiformat pruefen.';
      }
    });
  }
}
